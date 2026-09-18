# CodeArena — Phase 12: Asynchronous Submission Processing

## 1. Overview & Architectural Motivation

In earlier phases, CodeArena operated as a synchronous modular monolith where `POST /api/v1/submissions` processed compilation, sandbox container creation, test case execution, and evaluation in the immediate context of the HTTP request.

While appropriate for the MVP foundation, synchronous execution:
- Tied HTTP request lifetimes directly to sandbox execution durations (up to several seconds).
- Consumed HTTP server connections and worker threads while waiting on I/O and process execution.
- Left the platform vulnerable to connection timeouts and thread exhaustion during traffic spikes.

Phase 12 evolves CodeArena to **asynchronous submission processing** using **Redis**, **BullMQ**, and a dedicated background **Worker** process while preserving the clean modular monolith boundary.

---

## 2. Architecture Comparison

### Previous Synchronous Flow (Phase 11)

```text
Client (Browser)
   │ POST /api/v1/submissions
   ▼
Backend API
   ├── 1. Validate submission & readiness
   ├── 2. Create MongoDB Submission (status: PENDING)
   ├── 3. Synchronously invoke Execution Engine
   │      ├── Spawns Docker sandbox container
   │      ├── Compiles source code (if C++)
   │      └── Sequentially evaluates test cases
   ├── 4. Update MongoDB Submission (status: COMPLETED)
   ▼
Return HTTP 201 with final verdict & metrics (Blocks for 2-5+ seconds)
```

### New Asynchronous Flow (Phase 12)

```text
Client (Browser)
   │ 1. POST /api/v1/submissions
   ▼
Backend API
   ├── Validate problem & readiness (active test cases > 0)
   ├── Persist initial record in MongoDB (status: PENDING)
   ├── Transition & persist MongoDB record (status: QUEUED, queuedAt)
   ├── Enqueue minimal job to BullMQ (payload: { submissionId })
   │   └── On enqueue failure: transition QUEUED ──▶ FAILED & return 503
   ▼
Return HTTP 201 with QUEUED status immediately (< 50ms)

Background Worker (Autonomous Daemon Process)
   │ 2. Pops job from 'submission-execution' queue
   ├── Atomic Claim: findOneAndUpdate({ _id: submissionId, status: 'QUEUED' }, { status: 'RUNNING', startedAt })
   │   └── If already RUNNING / COMPLETED / FAILED: skip & log submission_job_skipped
   ├── Delegate to Execution Engine boundary
   │   └── Launch disposable Docker sandbox (codearena-sandbox:v1)
   ├── Normal User Verdicts (ACCEPTED, WRONG_ANSWER, TLE, MLE, RUNTIME_ERROR, COMPILATION_ERROR)
   │   └── Set status: COMPLETED & return normally (never retried)
   └── Infrastructure Failure (Docker crash, network timeout)
       ├── Retries remaining: revert status to QUEUED & rethrow for BullMQ retry backoff
       └── Retries exhausted: mark status: FAILED with failedAt & errorMessage
   ▼
Client Polling
   │ 3. Periodic GET /api/v1/submissions/:submissionId (every 1.5s)
   ▼
Transitions: QUEUED ──▶ RUNNING ──▶ COMPLETED (or FAILED on infrastructure error)
```

---

## 3. Component Roles & Security Boundaries

### 3.1. Redis (Transport Only)
- **Role**: High-performance in-memory job transport and coordination store for BullMQ.
- **Payload Minimality**: Queue jobs strictly contain `{ "submissionId": "<mongo_id>" }`.
- **Security Rule**: Source code, test case inputs, expected outputs, passwords, JWTs, and system secrets are **never** written to Redis.
- **Network & Port Configuration**:
  - **Internal Container Port**: `6379`
  - **Internal Docker Connection**: `redis:6379` (communicating over the default Docker Compose network)
  - **Host Port Mapping**: `127.0.0.1:6380:6379` (host port defaults to `6380` via `${REDIS_HOST_PORT:-6380}` to prevent port collisions if the host machine runs a local Redis server on 6379). It is strictly bound to `127.0.0.1` and never exposed on `0.0.0.0`.

### 3.2. BullMQ (Queue Abstraction)
- **Queue Name**: `submission-execution` (centralized in `submission.queue.js`).
- **Deduplication**: `jobId: submissionId` guarantees at most one active queue job per submission ID.
- **Job Retention**: Completed jobs capped at 100 entries; failed jobs capped at 500 entries for observability.
- **Retry Policy**: 2 attempts with exponential backoff (`delay: 1000ms`) strictly for transient infrastructure errors. User-code verdicts (`WRONG_ANSWER`, `RUNTIME_ERROR`, `COMPILATION_ERROR`, etc.) are normal execution outcomes and are never retried.

### 3.3. Worker Process
- **Process Model**: Standalone Node.js daemon (`backend/src/workers/submission.worker.js`).
- **Concurrency**: Configurable via `WORKER_CONCURRENCY` (default: `2`).
- **Atomic Claiming**: Uses MongoDB `findOneAndUpdate({ _id, status: 'QUEUED' }, { $set: { status: 'RUNNING', startedAt } })` to guarantee only one worker executes any given submission.
- **Sandbox Security**: The worker process requires Docker socket access (`/var/run/docker.sock`) to launch disposable sandbox containers (`codearena-sandbox:v1`). The Docker socket is never mounted into user sandbox containers.
- **No HTTP Exposure**: The worker does not listen on any HTTP port.

### 3.4. Docker Container Architecture & Dockerfiles
- **`backend/Dockerfile`**: Builds the trusted Node.js application image. Reused by both the `backend` API container (running `node src/server.js`) and the `worker` container (running `node src/workers/submission.worker.js`). There is no separate worker Dockerfile.
- **`frontend/Dockerfile`**: Multi-stage build that compiles the React 18 SPA via Vite and serves production static assets via Nginx.
- **`execution-engine/Dockerfile.sandbox`**: Builds the separate, unprivileged sandbox template image (`codearena-sandbox:v1`). Contains C++ (g++), Python 3, and Node.js runtimes. Runs as non-root user `1000:1000`. This is **NOT** a long-running service in Docker Compose; it is a template image used exclusively to instantiate ephemeral execution containers.
- **Sandbox Image Build Workflow**: Built via project script:
  ```bash
  npm run docker:build-sandbox
  ```
  or directly via Docker:
  ```bash
  docker build -t codearena-sandbox:v1 -f execution-engine/Dockerfile.sandbox execution-engine
  ```

---

## 4. Submission Lifecycle State Machine

```text
       ┌───────────┐
       │  PENDING  │  (Initial persisted record in MongoDB)
       └─────┬─────┘
             │ Transition & save
             ▼
       ┌───────────┐
       │  QUEUED   │  (Persisted in MongoDB & enqueued to Redis)
       └─────┬─────┴────────────────────────────┐
             │ Atomic Claim (findOneAndUpdate)  │ Enqueue failure
             ▼                                  ▼
       ┌───────────┐                      ┌───────────┐
       │  RUNNING  │                      │  FAILED   │
       └─────┬─────┘                      └───────────┘
             │                                  ▲
      ┌──────┴──────────────────────────┐       │ Retries exhausted
      │ Normal evaluation outcomes      │       │
      ▼                                 │ Infrastructure failure
┌───────────┐                           └───────┤
│ COMPLETED │                                   │
└───────────┘                      (Retries remain: revert to QUEUED)
(Verdict: ACCEPTED,
 WRONG_ANSWER, TLE, MLE,
 RUNTIME_ERROR, COMPILATION_ERROR)
```

### Lifecycle Fields & Timestamps
- `status`: `'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'`
- `verdict`: `'PENDING' | 'ACCEPTED' | 'WRONG_ANSWER' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED'`
- `queuedAt`: Timestamp when successfully pushed to BullMQ.
- `startedAt`: Timestamp when worker starts sandbox execution.
- `completedAt`: Timestamp when evaluation successfully concludes.
- `failedAt`: Timestamp if worker or queue experienced infrastructure failure.
- `errorMessage`: Captured error message on infrastructure failure.

---

## 5. Failure Handling & Consistency Strategies

1. **Queue Enqueue Failure**:
   - If Redis is down during `POST /api/v1/submissions`, the submission is immediately marked `status: 'FAILED'`, `errorMessage: 'Failed to enqueue submission for processing'`, and an HTTP `503 Service Unavailable` (`QUEUE_UNAVAILABLE`) error is returned.
   - Submissions are never left orphaned in `PENDING` state.

2. **Idempotency & Duplicate Delivery**:
   - BullMQ deduplicates at enqueue time using `jobId: submissionId`.
   - Before executing, the worker inspects the database: if `status` is already `'COMPLETED'` or `'FAILED'`, the job is skipped and logged (`submission_job_skipped`).
   - If `status` is `'RUNNING'`, simultaneous duplicate execution by another worker thread is prevented.

3. **Infrastructure Failures vs Code Verdicts**:
   - If Docker or MongoDB crashes during execution, the submission is marked `FAILED` with `failedAt`.
   - Normal code issues (segmentation fault, nonzero exit code) result in `COMPLETED` with verdict `RUNTIME_ERROR`. User code verdicts are never conflated with platform infrastructure errors.

---

## 6. Frontend Polling & UX

- **Submitting**: `handleSubmit` sends `POST /api/v1/submissions` and receives `{ submission: { id, status: 'QUEUED', verdict: 'PENDING' } }`.
- **Status Indicator**: Button displays `"Submission queued..."` then `"Running your code..."`.
- **Polling Loop**: Component polls `GET /api/v1/submissions/:submissionId` at a 1.5s interval.
- **Terminal State**: Polling automatically terminates when `status` reaches `'COMPLETED'` or `'FAILED'`.
- **Unmount Protection**: Polling timer (`pollTimerRef`) is explicitly cleared on component unmount.
- **Timeout Guard**: Maximum polling window of 30 seconds; displays a graceful timeout message if worker is delayed.

---

## 7. Operational & Health Checks

- **Liveness (`/health`)**: Returns `200 OK` if the process and MongoDB are running.
- **Readiness (`/ready`)**: Performs deep dependency probe verifying:
  - `database`: MongoDB connected
  - `execution`: Docker sandbox engine available
  - `redis`: Redis server responsive to `PING` (`PONG`)
- **Graceful Shutdown**:
  - Worker process listens for `SIGTERM`/`SIGINT`, closes BullMQ consumer (`worker.close()`), closes Redis queue & client connections (`closeQueue()`), disconnects MongoDB, and exits with code 0.
  - Backend closes HTTP server, shuts down BullMQ queue (`closeQueue()`), disconnects MongoDB, and exits with code 0.

---

## 8. Current Limitations & Future Scaling Path

- **Single Host Worker**: Worker currently runs as a single service in Docker Compose. Horizontal worker autoscaling across multiple nodes can be added in future phases without changing API contracts.
- **HTTP Polling**: Frontend uses lightweight interval polling. Real-time push (WebSockets / SSE) can be introduced later if notification volume warrants it.
