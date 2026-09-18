# ADR-014: Distributed Execution Architecture, Ephemeral Worker Registry, and Stale-Owner Recovery

## Status

Accepted

## Date

2026-09-18

## Context

Following the horizontal scaling of stateless backend API replicas (Phase 16) and multi-worker concurrency foundations (Phase 15), CodeArena required evolution into a production-grade **Distributed Execution Architecture** (Phase 17).

Executing untrusted, sandboxed user code across distributed nodes introduces key architectural requirements:
1. **Stateless API Ingestion vs. Distributed Execution Isolation**: The backend API tier must remain strictly stateless, handling HTTP requests, authentication, and job queuing. The backend API container does not have Docker daemon access (`/var/run/docker.sock`), compiler toolchains, or execution workspaces. Under no circumstances should backend API nodes execute user code or invoke Docker execution engines directly.
2. **Autonomous Worker Daemon Lifecycle**: Workers function as decoupled, autonomous daemon processes pulling work from a shared BullMQ queue (`submission-execution`), independently scaling across physical or virtual hosts. Only trusted worker/execution infrastructure owns Docker daemon access to spawn sandboxes.
3. **Collision-Resistant Worker Identity**: In a distributed topology where containers or hosts share hostnames, worker IDs must remain unique and collision-resistant without manual coordination (`worker-${hostname}-${pid}-${randomHex}`).
4. **Decoupled Worker Observability & Ephemeral Registry**: System operators and administrators need real-time visibility into active workers, their concurrency, operational status, and health. However, workers should not require heavy coordination frameworks or direct coupling between workers.
5. **Diagnostic Execution Metadata**: Submissions must track execution telemetry (which worker claimed the submission, when execution started, and when it completed) for debugging, tracing, and auditability.
6. **Execution Ownership with Stale-Owner Recovery**: In distributed systems, worker processes may crash abruptly (OOM, hardware fault, unhandled signal) while a submission is in `RUNNING` status. However, active executions must not be stolen simply because they are `RUNNING`. A `RUNNING` submission may only be reclaimed if its ownership has become stale (`startedAt < now - WORKER_STALE_TIMEOUT_MS`).
7. **Failure Classification**: The system must cleanly differentiate:
   - **Evaluation Verdicts** (`ACCEPTED`, `WRONG_ANSWER`, `TLE`, `MLE`, `CE`, `RTE`): Persist terminal verdict, mark `COMPLETED`, acknowledge job.
   - **Infrastructure/Transient Failures** (Docker glitch, Redis blip, transient DB error): Revert to `QUEUED` and allow BullMQ exponential backoff retry.
   - **Non-Retryable Domain/System Errors** (problem not ready, missing test cases, validation failure): Mark `FAILED` with `errorMessage` and acknowledge job without endless BullMQ retry loops.
8. **Controlled Draining & Zero-Drop Shutdown**: Workers receiving termination signals (`SIGTERM`) must transition to a draining state, cease accepting new jobs, finish in-flight sandboxes within a bounded grace period, update registry status to `STOPPED`, and deregister cleanly.

## Decision

We establish the **CodeArena Distributed Execution Architecture** with the following technical specifications:

### 1. Docker Daemon Access Boundary
- **Backend API**: Does not mount `/var/run/docker.sock` and has no Docker access. Backend solely enqueues `{ submissionId }` into BullMQ and persists state to MongoDB.
- **Worker Infrastructure**: Mounts `/var/run/docker.sock` and execution workspaces to invoke the Execution Engine and spawn isolated Docker sandboxes (`codearena-sandbox:v1`).

### 2. Collision-Resistant Worker Identity Resolution
- Workers resolve identity using:
  ```
  WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  ```
- This guarantees uniqueness across multi-replica Docker Compose environments where container hostnames may be identical or reset across restarts.

### 3. Redis-Backed Ephemeral Worker Registry (`worker-registry.service.js`)
- Each worker registers an ephemeral key in Redis at startup: `codearena:workers:<workerId>` with a 15-second TTL (3x the standard 5s heartbeat interval).
- Key payload includes:
  ```json
  {
    "workerId": "worker-node-1-1234-a1b2c3d4",
    "status": "READY",
    "concurrency": 2,
    "startedAt": "2026-09-18T10:00:00.000Z",
    "lastHeartbeat": "2026-09-18T10:00:05.000Z",
    "pid": 1234,
    "hostname": "worker-node-1"
  }
  ```
- An unreferenced periodic timer (`timer.unref()`) emits heartbeats every 5 seconds, updating `lastHeartbeat` and refreshing the 15-second TTL.
- If a worker dies abruptly (`SIGKILL`, host crash), its registry entry naturally expires from Redis within 15 seconds without administrative intervention or stale manual entries.

### 4. Submission Execution Telemetry Subdocument
- The Mongoose `Submission` schema includes an `execution` subdocument:
  ```javascript
  execution: {
    workerId: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  }
  ```
- `toSafeObject()` exposes this subdocument to authorized callers for end-to-end tracing. Worker identity serves strictly as diagnostic/operational metadata, not permanent lock ownership.

### 5. Atomic Claiming & Stale Execution Ownership Recovery
- To prevent active executions from being stolen while safely recovering abandoned jobs when workers crash, `processSubmission` uses an atomic conditional MongoDB query with a configurable stale threshold (`WORKER_STALE_TIMEOUT_MS`, default: 30000ms):
  ```javascript
  const staleCutoff = new Date(Date.now() - staleTimeoutMs);
  const claimFilter = {
    _id: submissionId,
    $or: [
      { status: 'QUEUED' },
      {
        status: 'RUNNING',
        $or: [
          { 'execution.startedAt': { $lt: staleCutoff } },
          { 'execution.startedAt': { $exists: false }, startedAt: { $lt: staleCutoff } },
          { 'execution.startedAt': null, startedAt: { $lt: staleCutoff } }
        ]
      }
    ]
  };
  ```
- **Fresh `RUNNING`**: If a submission is in `RUNNING` and `startedAt >= staleCutoff`, it is actively being executed. Reclaim attempts are rejected and skipped without interference.
- **Stale `RUNNING`**: If a worker crashed or was killed mid-flight, once `startedAt < staleCutoff`, the next worker retry attempt atomically transfers ownership to the recovering worker.
- **Terminal States (`COMPLETED`, `FAILED`)**: Strictly protected; duplicate deliveries are detected and skipped cleanly without re-running sandboxes.

### 6. Failure Classification & Retry Semantics
- **Evaluation Outcomes**: User code verdicts (`ACCEPTED`, `WRONG_ANSWER`, `TLE`, etc.) update the submission record to `COMPLETED`, record `completedAt`, and resolve the BullMQ job successfully.
- **Non-Retryable Domain/System Errors** (`PROBLEM_NOT_READY`, invalid language, 4xx validation errors): Mark submission as `FAILED`, record `errorMessage` and `completedAt`, and complete the job cleanly without BullMQ retries.
- **Transient Infrastructure Errors**: If retries remain (`attemptsMade + 1 < maxAttempts`), revert status to `QUEUED` and rethrow to BullMQ for exponential backoff retry. Once retries are exhausted, mark `FAILED` with `errorMessage` and `completedAt`.

### 7. Controlled Draining & Shutdown Sequence
- Worker shutdown sequence:
  1. Transition registry status to `DRAINING`.
  2. Pause BullMQ intake via `worker.pause(true)`.
  3. Clear periodic heartbeat timer.
  4. Wait for active jobs to complete (bounded by `WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000`).
  5. Close BullMQ worker, mark registry status as `STOPPED`, and close Redis/Mongo connections.

### 8. Admin Visibility Endpoint (`GET /api/v1/admin/workers`)
- Expose a read-only administration API protected by JWT authentication and `ADMIN` role.
- Aggregates active worker keys via `codearena:workers:*`, calculates `secondsSinceLastHeartbeat`, and returns real-time cluster health.

## Consequences

### Positive
- **Security Boundary**: Backend API has zero access to Docker socket, eliminating Docker daemon attack surface on public-facing API servers.
- **Protection of Active Work**: Active executions cannot be stolen by concurrent workers; recovery occurs only for genuinely stale jobs.
- **No Endless Retries**: Non-retryable domain errors fail immediately rather than clogging queues with useless retries.
- **Independent Horizontal Scalability**: Workers can scale independently from API replicas based on queue depth and hardware capacity.
- **Real-Time Fleet Observability**: Administrators gain direct visibility into worker health and capacity without external sidecars.

### Trade-Offs & Mitigations
- **Stale Timeout Trade-off**: Crashed worker jobs wait for `WORKER_STALE_TIMEOUT_MS` (30s default) before being reclaimed by BullMQ retries. This ensures active long-running jobs are never interrupted.
- **Redis TTL Dependency**: Ephemeral registry depends on Redis availability. If Redis restarts, workers restore their presence on the subsequent heartbeat cycle (≤ 5 seconds).
