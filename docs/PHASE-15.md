# CodeArena — Phase 15: Multiple Workers / Concurrency

## 1. Objective

Phase 15 evolves CodeArena's execution architecture from a single dedicated worker daemon (established in Phase 14) into a robust system that can safely run **multiple independent worker instances** concurrently against the same shared BullMQ submission queue (`submission-execution`).

This phase provides:
- Multiple independent worker OS processes/containers consuming from one queue without queue partitioning or duplicate queues.
- In-process concurrency control per worker instance via `WORKER_CONCURRENCY`.
- Safe job distribution using native BullMQ/Redis atomic pop and claim semantics.
- Distinguishable runtime worker identity (`WORKER_ID` or `worker-<hostname>-<pid>`) for diagnostics and operational logging.
- Concurrency-safe atomic database transitions (`QUEUED` → `RUNNING`) to prevent concurrent duplicate claims across workers.
- Worker failure isolation and graceful shutdown of individual worker instances without disrupting peer workers or shared infrastructure.
- Single scalable worker service definition in Docker Compose (`docker compose up --scale worker=3`).

---

## 2. Phase 14 → Phase 15 Evolution

In **Phase 14**, the worker architecture formalized a single, autonomous background daemon (`node src/workers/submission.worker.js` / `npm run worker`) isolated completely from the Express HTTP API. It established the pre-flight fail-fast dependency verification (MongoDB + Redis), atomic database claiming, verdict vs. infrastructure error handling, and graceful signal cleanup (`SIGTERM`/`SIGINT`).

In **Phase 15**, the architecture expands horizontally to support multiple concurrent worker daemons:

```text
                  Phase 14: Single Worker
                  
                   ┌─────────────────┐
                   │ Redis / BullMQ  │
                   └────────┬────────┘
                            │
                            ↓
                   ┌─────────────────┐
                   │ Worker Daemon 1 │ (C=2)
                   └────────┬────────┘
                            │
                            ↓
                    Execution Engine / Docker Sandbox
```

```text
               Phase 15: Multiple Workers & Concurrency

                             ┌─────────────────┐
                             │  Express API    │
                             └────────┬────────┘
                                      │ Enqueues { submissionId }
                                      ↓
                             ┌─────────────────┐
                             │ Redis / BullMQ  │
                             │ Queue:          │
                             │ 'submission-    │
                             │  execution'     │
                             └────────┬────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ↓                    ↓                    ↓
         ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
         │   Worker A    │    │   Worker B    │    │   Worker C    │
         │  (worker-1)   │    │  (worker-2)   │    │  (worker-3)   │
         │ Concurrency=2 │    │ Concurrency=2 │    │ Concurrency=2 │
         └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
                 │                    │                    │
                 ↓                    ↓                    ↓
         ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
         │   Execution   │    │   Execution   │    │   Execution   │
         │    Engine     │    │    Engine     │    │    Engine     │
         └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
                 │                    │                    │
                 ↓                    ↓                    ↓
         ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
         │Docker Sandbox │    │Docker Sandbox │    │Docker Sandbox │
         │(Ephemeral Ctr)│    │(Ephemeral Ctr)│    │(Ephemeral Ctr)│
         └───────────────┘    └───────────────┘    └───────────────┘
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │ Atomic Claim & Persistence
                                      ↓
                             ┌─────────────────┐
                             │    MongoDB      │
                             └─────────────────┘
```

---

## 3. Worker Instance Model vs. Concurrency Model

A fundamental architectural distinction in Phase 15 is between **Worker Concurrency** and **Multiple Worker Instances**:

### 3.1. Worker Concurrency (In-Process)
- **Scope**: Within a single OS process/Node.js runtime.
- **Mechanism**: BullMQ `concurrency` option. When `concurrency = N`, a single worker process pulls and executes up to $N$ jobs concurrently using Node.js asynchronous event loop multitasking.
- **Configuration**: `WORKER_CONCURRENCY` environment variable (default: `2`).
- **Structure**:
  ```text
  Worker Process (PID: 1042)
      ├── Job A (active execution)
      ├── Job B (active execution)
      └── (waiting on I/O / container runner)
  ```

### 3.2. Multiple Worker Instances (Multi-Process / Multi-Container)
- **Scope**: Across independent OS processes or container instances.
- **Mechanism**: Running `node src/workers/submission.worker.js` multiple times or scaling containers via Docker Compose.
- **Structure**:
  ```text
  Worker Process 1 (PID: 1042, Container A) ──▶ Concurrency: 2 (up to 2 active jobs)
  Worker Process 2 (PID: 2085, Container B) ──▶ Concurrency: 2 (up to 2 active jobs)
  Worker Process 3 (PID: 3128, Container C) ──▶ Concurrency: 2 (up to 2 active jobs)
  ```

### 3.3. Combined Total Processing Capacity
When both models are utilized together:
$$\text{Theoretical Configured Capacity} = (\text{Worker Instances}) \times (\text{WORKER\_CONCURRENCY})$$

*Example*: 3 worker instances with `WORKER_CONCURRENCY=2` yield up to 6 concurrently active jobs.

> [!IMPORTANT]
> **Capacity vs. Guaranteed Throughput**:
> This number represents configured processing capacity, not an absolute guarantee. Actual execution throughput is strictly bounded by available host CPU cores, memory limits, Docker daemon concurrency, disk I/O, MongoDB connection limits, and network latency.

---

## 4. BullMQ Job Distribution

All worker instances connect to the **same** BullMQ queue name:
$$\text{Queue Name} = \text{'submission-execution'}$$

- **Job Coordination**: BullMQ provides Redis-backed job coordination and worker job leasing/claiming semantics. Workers do not implement custom polling loops or custom locking.
- **No Per-Worker Queues**: Workers do **NOT** listen on separate queues (e.g., `submission-execution-worker-1`). All workers compete fairly for waiting jobs on the single shared queue.
- **Non-Deterministic Distribution**: BullMQ balances job dispatching dynamically across available workers based on worker availability and configured concurrency. No rigid pre-assignment exists.

---

## 5. Worker Identity & Observability

To enable clear operational tracing across concurrent worker processes, each worker instance possesses a distinguishable runtime identifier:

### 5.1. Identity Resolution
Identity is resolved via `resolveWorkerId(explicitId)`:
1. **Explicit Parameter**: Provided directly in programmatic or test invocation.
2. **Environment Variable**: `WORKER_ID` if defined in environment.
3. **Runtime Fallback**: `worker-${os.hostname()}-${process.pid}` (e.g. `worker-codearena-worker-1-42` or `worker-Mi-NoteBook-73113`).

### 5.2. Observability & Structured Logging
Every major worker lifecycle event includes `workerId`:
- `worker_started`: `{ workerId, queue, concurrency, pid, hostname }`
- `submission_job_started`: `{ submissionId, jobId, workerId, workerPid }`
- `submission_job_skipped`: `{ submissionId, jobId, workerId, status, reason }`
- `submission_job_completed`: `{ submissionId, jobId, workerId, verdict, testsPassed, totalTests, runtimeMs, durationMs }`
- `submission_job_failed`: `{ submissionId, jobId, workerId, error }`
- `submission_job_retry_scheduled`: `{ submissionId, jobId, workerId, attemptsMade, maxAttempts }`
- `submission_job_marked_failed`: `{ submissionId, jobId, workerId, attemptsMade, maxAttempts }`
- `worker_shutdown_initiated`: `{ workerId, signal, pid }`

### 5.3. Sanitization Invariant
All logging strictly redacts:
- User source code (`sourceCode`)
- Hidden test cases (`input`, `expectedOutput`)
- Authentication credentials (`password`, `jwt`, `token`, `secret`)
- Database connection strings and Redis passwords

---

## 6. Duplicate Claim Protection & Idempotency

When multiple workers consume from the same queue, realistic race conditions and duplicate job deliveries can occur:

```text
Worker A (WorkerId: worker-A)                   Worker B (WorkerId: worker-B)
       │                                               │
       ├───────────────────────────────────────────────┤
       │ Both receive a job for submissionId: 67ab...  │
       ├───────────────────────────────────────────────┤
       │                                               │
       ▼                                               ▼
findOneAndUpdate({ _id, status: 'QUEUED' })    findOneAndUpdate({ _id, status: 'QUEUED' })
       │                                               │
       ▼                                               ▼
[SUCCEEDS] ──▶ Status becomes RUNNING          [FAILS] ──▶ Returns null (status is RUNNING)
       │                                               │
       ▼                                               ▼
Executes submission in Docker sandbox          Inspects record: status === 'RUNNING'
       │                                       Logs: 'submission_job_skipped' (in progress)
       ▼                                       Skips execution cleanly without error
Persists COMPLETED verdict in MongoDB
```

### 6.1. Atomic State Machine Invariants
1. The transition `QUEUED` → `RUNNING` is performed atomically via MongoDB `findOneAndUpdate`.
2. Only the single worker process whose atomic query matches `status: 'QUEUED'` receives the document and proceeds to execution.
3. Any competing or duplicate worker invocation receives `null`. It inspects the record, observes `status: 'RUNNING'` or `status: 'COMPLETED'`, logs an informational skip event, and terminates the job cleanly.
4. No external distributed lock (e.g. Redlock) is required; MongoDB document-level atomic writes provide the authoritative claim guard.

---

## 7. Failure Isolation

Independent worker processes must not share volatile state:
- **No Shared In-Memory Queues**: All state is mediated by Redis (BullMQ queue) and MongoDB (document state).
- **Crash Isolation & Stale RUNNING State**: If Worker A crashes abruptly (OOM, unhandled exception, SIGKILL):
  - Worker B and Worker C remain completely healthy and continue pulling available waiting jobs.
  - However, if a worker crashes after claiming a submission, the MongoDB record may remain `RUNNING` while BullMQ later redelivers the stalled job. The current atomic claim intentionally prevents another worker from concurrently executing that `RUNNING` submission. Recovery of stale `RUNNING` submissions requires a future reconciliation or lease-based mechanism.

---

## 8. Graceful Shutdown Across Workers

Each worker handles `SIGTERM` and `SIGINT` cleanly and independently:
1. **Halt Job Ingestion**: `worker.close()` stops pulling new jobs from Redis.
2. **Drain Active Executions**: In-flight submissions are allowed to finish and persist verdicts.
3. **Disconnect Owned Resources**: Dedicated Redis client connections are closed via `client.disconnect()`.
4. **Disconnect Database**: MongoDB connection pool is closed if this is a standalone worker process.
5. **Safety Guard**: A 10-second unreferenced timer (`forceExitTimer`) forces termination if sandboxes or connections hang.
6. **Peer Independence**: Shutting down Worker A has zero impact on Worker B, Worker C, or the shared MongoDB and Redis clusters.

---

## 9. Docker Compose Scaling

In `docker-compose.yml`, the `worker` service definition is designed for native compose scaling:

```yaml
  # Phase 15: Multiple Worker Architecture — can be scaled dynamically via `docker compose up --scale worker=N`
  worker:
    build:
      context: .
      dockerfile: backend/Dockerfile
    command: ["node", "src/workers/submission.worker.js"]
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017/codearena
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-2}
      # If WORKER_ID is unset, each scaled container automatically derives a unique identity from its container hostname & PID
      - WORKER_ID=${WORKER_ID:-}
      - CODEARENA_WORKSPACE_BASE=${CODEARENA_WORKSPACE_BASE:-/tmp/codearena-workspaces}
      - CODEARENA_SANDBOX_IMAGE=codearena-sandbox:v1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${CODEARENA_HOST_WORKSPACE_DIR:-/tmp/codearena-workspaces}:${CODEARENA_WORKSPACE_BASE:-/tmp/codearena-workspaces}:rw
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
```

### 9.1. Scaling Command
```bash
docker compose up --scale worker=3 -d
```
- Starts 3 isolated worker containers (`codearena-worker-1`, `codearena-worker-2`, `codearena-worker-3`).
- Each container has a distinct hostname (Docker container ID), generating distinct worker IDs: `worker-<container_id>-<pid>`.
- The worker service does **not** expose any HTTP ports, avoiding container port collision errors during scaling.

---

## 10. Resource Limits & Host Capacity Considerations

Running multiple concurrent workers executing Docker sandboxes requires careful host capacity planning:

| Resource Dimension | Per-Sandbox Limit | Single Worker (C=2) | Scaled Workers (3 Workers, C=2) |
| :--- | :--- | :--- | :--- |
| **Max Concurrent Sandboxes** | 1 container | Up to 2 containers | Up to 6 containers |
| **CPU Quota** | 1.0 CPU core | Up to 2.0 cores | Up to 6.0 cores |
| **Memory Limit** | 256 MB RAM | Up to 512 MB RAM | Up to 1.5 GB RAM |
| **PIDs Limit** | 64 processes | Up to 128 PIDs | Up to 384 PIDs |
| **Workspace Disk** | Per-execution tempdir | Ephemeral | Ephemeral |

> [!WARNING]
> Setting `WORKER_CONCURRENCY` or worker replica counts too high on resource-constrained hosts can lead to CPU throttling, Docker socket queue contention, or out-of-memory container kills. Concurrency should be tuned to match available host vCPUs and physical RAM.

---

## 11. Verification & Test Suite

The Phase 15 multi-worker architecture is verified by a dedicated test suite in `backend/tests/phase15.test.js`:

| # | Test Group / Invariant Verified | Result |
|---|:---|:---:|
| 1 | `WORKER_CONCURRENCY` default is valid (positive integer, default 2) | **PASS** |
| 2 | `WORKER_CONCURRENCY` accepts valid positive integers | **PASS** |
| 3 | Invalid `WORKER_CONCURRENCY` (0, negative, NaN, float, strings) safely defaults | **PASS** |
| 4 | Worker identity generated when `WORKER_ID` is absent (`worker-<hostname>-<pid>`) | **PASS** |
| 5 | Explicit `WORKER_ID` is respected | **PASS** |
| 6 | Worker logs include `workerId`, `jobId`, and `submissionId` without leaking secrets | **PASS** |
| 7 | Multiple worker instances can connect to the same BullMQ queue (`submission-execution`) | **PASS** |
| 8 | Jobs can be distributed across multiple worker instances | **PASS** |
| 9 | Concurrent workers cannot both claim the same queued submission (atomic claim) | **PASS** |
| 10 | Duplicate job delivery does not result in duplicate claims | **PASS** |
| 11 | One worker shutdown does not prevent other workers from processing queue jobs | **PASS** |
| 12 | Graceful shutdown of one worker does not shut down another worker | **PASS** |
| 13 | Multiple workers use the exact same Redis/BullMQ queue name (`submission-execution`) | **PASS** |
| 14 | Worker does not start Express HTTP server or bind ports | **PASS** |
| 15 | Concurrent submissions preserve independent execution context | **PASS** |
| 16 | **Section 21 Integration**: Concurrent workers consume shared queue and complete submissions | **PASS** |
| 17 | **Section 22 Concurrency**: Batch of submissions drained by multiple workers; none stuck in `RUNNING` | **PASS** |

---

## 12. Limitations & Honest Architectural Realities

The Phase 15 implementation adheres to rigorous distributed systems semantics and explicitly avoids making false guarantees:

1. **No "Exactly-Once" or Absolute "At-Most-Once" Execution Across Crashes**:
   - Multiple independent workers consume from the same BullMQ queue. MongoDB atomic state transitions prevent concurrent duplicate claims of the same submission. BullMQ manages job delivery and retries. Execution behavior can still be affected by worker crashes and retries.
   - If a worker crashes after claiming a submission, the MongoDB record may remain `RUNNING` while BullMQ later redelivers the stalled job. The current atomic claim intentionally prevents another worker from concurrently executing that `RUNNING` submission. Recovery of stale `RUNNING` submissions requires a future reconciliation or lease-based mechanism.
   - Stale `RUNNING` recovery is explicitly **NOT** implemented in Phase 15 (no heartbeats, watchdogs, leases, or background reconcilers).
2. **Queue Ordering vs Completion Ordering**:
   - BullMQ processes queued jobs according to its queue scheduling semantics; with multiple workers and concurrency, completion order is not guaranteed.
3. **No Global Scheduler / Capacity Balancer**:
   - Phase 15 does not implement global CPU/RAM-aware scheduling algorithms or fair distribution guarantees across workers.
4. **No Distributed Orchestrator**:
   - Scaling is managed via Docker Compose (`--scale worker=N`). Kubernetes, auto-scaling horizontal pod autoscalers (HPA), and nomad clusters belong to future infrastructure phases.
5. **No Worker Registry Database**:
   - Worker IDs are ephemeral runtime identifiers for logs and diagnostics. Phase 15 intentionally avoids building a database-backed worker registry or heartbeat consensus system.

---

## 13. Canonical Roadmap Alignment

```text
Phase 1–10  ──▶ MVP Implementation (Core, Auth, Submissions, Sandboxes, Frontend) [COMPLETE]
Phase 11    ──▶ Production Hardening + Observability [COMPLETE]
Phase 12    ──▶ Async Submission Processing (Queue, Worker, Polling) [COMPLETE]
Phase 13    ──▶ Redis + Queue (Centralized Client, Idempotency, Metrics) [COMPLETE / FROZEN]
Phase 14    ──▶ Worker Architecture (Dedicated Daemon, Fail-Fast Lifecycle, State Safety) [COMPLETE / FROZEN]
Phase 15    ──▶ Multiple Workers / Concurrency (Multi-Worker Daemon, Atomic Claims, Compose Scaling) [COMPLETE]
Phase 16    ──▶ Horizontal Scaling [FUTURE]
Phase 17    ──▶ Distributed Execution Architecture [FUTURE]
Phase 18    ──▶ Advanced Infrastructure [FUTURE]
```
