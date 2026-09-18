# CodeArena — Phase 14: Worker Architecture

## 1. Overview & Architectural Motivation

Following the establishment of the Redis + BullMQ queue foundation in Phase 13, Phase 14 formalizes and hardens the **Worker Architecture** for CodeArena.

In an online judge and code execution platform, running untrusted user code is computationally expensive, unpredictable in execution duration, and fraught with security risks. Executing code inside the web/API process degrades HTTP request throughput, exposes the API service to resource starvation (CPU, memory, file descriptors), and creates critical security attack surfaces.

Phase 14 establishes a dedicated, reliable, and independently executable **Submission Worker Daemon** (`node src/workers/submission.worker.js` / `npm run worker`). This worker daemon:
- Operates in a completely decoupled OS process from the Express HTTP API.
- Implements a deterministic, fail-fast startup sequence verifying MongoDB and Redis readiness before accepting jobs.
- Enforces strict input validation on job payloads, rejecting invalid or non-ObjectId identifiers cleanly without crashing the worker process.
- Uses atomic database state transitions (`QUEUED` → `RUNNING`) to prevent concurrent duplicate claims of the same submission.
- Strictly separates user code evaluation verdicts from infrastructure failures, enabling BullMQ exponential backoff retries for transient engine issues while marking evaluation verdicts as terminal `COMPLETED`.
- Provides an idempotent graceful shutdown mechanism handling `SIGTERM` and `SIGINT` signals, draining active jobs, and releasing all resources within a 10-second safety window.
- Emits structured lifecycle observability logs with execution duration tracking (`durationMs`) while completely sanitizing source code, tokens, and test case secrets.

---

## 2. Canonical Roadmap Placement

Phase 14 strictly adheres to the canonical CodeArena architecture roadmap:

```text
Phase 1–10  ──▶ MVP Implementation (Core, RBAC, Submissions, Sandboxes, Frontend)
Phase 11    ──▶ Production Hardening + Observability
Phase 12    ──▶ Async Submission Processing (Queue, Worker, Polling)
Phase 13    ──▶ Redis + Queue (Centralized Client, Minimal Payload, Queue Metrics) [FROZEN]
Phase 14    ──▶ Worker Architecture (Dedicated Daemon, Fail-Fast Lifecycle, State Safety, Graceful Shutdown) [CURRENT / COMPLETE]
Phase 15    ──▶ Multiple Workers / Concurrency [FUTURE]
Phase 16    ──▶ Horizontal Scaling [FUTURE]
Phase 17    ──▶ Distributed Execution Architecture [FUTURE]
Phase 18    ──▶ Advanced Infrastructure [FUTURE]
```

> **Scope Guard**: Phase 14 establishes the robust single-worker daemon process architecture. It does NOT implement multiple worker replicas, dynamic worker auto-scaling, distributed worker discovery, Kubernetes operators, or message brokers like Kafka/RabbitMQ. Those capabilities belong strictly to **Phase 15+**.

---

## 3. Worker Process Architecture & Boundary Separation

CodeArena strictly separates responsibilities between API producers and execution workers:

```text
+-------------------------------------------------------------------------+
|                        API Process (server.js)                          |
|                                                                         |
|   HTTP Client ──▶ Express API ──▶ MongoDB (Write QUEUED)               |
|                                    │                                    |
|                                    ▼                                    |
|                             Redis / BullMQ Queue                        |
|                                                                         |
|   Process Boundary:                                                     |
|   - Exposes HTTP ports (default: 5000)                                  |
|   - Never executes user code                                            |
|   - Enqueues lightweight job: { submissionId }                          |
+-------------------------------------------------------------------------+
                                    │
                                    │ Redis Job Queue (submission-execution)
                                    │
+-------------------------------------------------------------------------+
|                   Worker Process (submission.worker.js)                 |
|                                                                         |
|   BullMQ Worker ──▶ Atomic Claim (QUEUED ──▶ RUNNING)                   |
|         │                                                               |
|         ├── Hydrates Submission & Problem Data from MongoDB             |
|         │                                                               |
|         └── Invokes Sandbox Execution via execution-engine              |
|                   │                                                     |
|                   ▼                                                     |
|         Docker Container Sandbox (codearena-sandbox:v1)                 |
|                   │                                                     |
|                   ▼                                                     |
|         Persists Verdict (COMPLETED) in MongoDB                         |
|                                                                         |
|   Process Boundary:                                                     |
|   - Completely decoupled from Express API                               |
|   - Never calls app.listen() or binds HTTP ports                        |
|   - Consumes jobs from BullMQ queue                                     |
|   - Mounts Docker socket for isolated container execution               |
+-------------------------------------------------------------------------+
```

### 3.1. Process Decoupling Invariants
1. **Zero HTTP Footprint**: The worker daemon never imports Express or calls `app.listen()`. It runs exclusively as a background event loop listening to Redis via BullMQ.
2. **Dedicated Entrypoints**:
   - `npm run worker`: Production worker daemon entrypoint (`node src/workers/submission.worker.js`).
   - `npm run dev:worker`: Development worker entrypoint using nodemon.
   - Docker container entrypoint: Docker Compose `worker` service invokes `npm run worker`.
3. **Module Independence**: The worker process directly references data models and configuration (`src/models/submission.model.js`, `src/config/db.js`, `src/config/redis.js`, `src/modules/submissions/submission-execution.service.js`) without depending on API routing or controller layers.

---

## 4. Worker Lifecycle & Fail-Fast Initialization

To prevent the worker from entering an invalid state where jobs are dequeued but cannot be processed, the worker implements an explicit, fail-fast startup sequence:

```javascript
async function startWorker() {
  // Step 1: Connect to MongoDB
  await connectDB();
  logger.info('Worker connected to MongoDB database successfully.');

  // Step 2: Verify Redis connection and readiness
  const redisReadiness = await redisConfig.checkRedisReadiness();
  if (!redisReadiness.ready) {
    throw new Error(`Redis readiness check failed: ${redisReadiness.status}`);
  }
  logger.info('Worker verified Redis connection readiness successfully.', {
    latencyMs: redisReadiness.latencyMs
  });

  // Step 3: Instantiate BullMQ Worker
  workerInstance = new Worker(
    SUBMISSION_QUEUE_NAME,
    processSubmission,
    {
      connection: redisConfig.createRedisClient(),
      concurrency: Number(process.env.WORKER_CONCURRENCY) || 2
    }
  );

  return workerInstance;
}
```

### 4.1. Startup Invariants
- **Database Dependency**: If MongoDB is unreachable at startup, `connectDB()` fails, and the worker process aborts before pulling any jobs.
- **Redis Dependency**: If Redis fails `checkRedisReadiness()`, an explicit error is thrown and logged, aborting startup.
- **Dedicated Redis Socket**: The worker instantiates a dedicated Redis client via `redisConfig.createRedisClient()` to satisfy BullMQ's requirement for independent blocking connections.

---

## 5. Job Processing Lifecycle & Payload Validation

When BullMQ delivers a job, `processSubmission(job)` executes with strict guards.

### 5.1. Strict Payload Validation
The job payload is validated before any database or execution calls:
```javascript
const { submissionId } = job.data || {};

if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
  logger.warn('Worker received job with invalid submissionId payload. Skipping.', {
    jobId: job.id,
    data: job.data
  });
  return { status: 'SKIPPED', reason: 'INVALID_PAYLOAD' };
}
```
- **Malformed Payloads**: Missing, null, undefined, or non-ObjectId hex strings are rejected cleanly.
- **Resilience**: The job completes cleanly (skipped) without throwing unhandled exceptions or crashing the worker process.

### 5.2. Atomic State Claim & State Machine Invariants
To prevent race conditions, concurrent duplicate claims, or re-evaluating completed jobs:
```javascript
const submission = await Submission.findOneAndUpdate(
  { _id: submissionId, status: 'QUEUED' },
  { $set: { status: 'RUNNING', startedAt: new Date() } },
  { new: true }
);
```

#### Handling Edge States:
1. **Submission Not Found**: If no record matches `_id: submissionId`, the worker logs a warning and skips execution. The job completes cleanly.
2. **Submission Not In `QUEUED` State**: If the record exists but is already `RUNNING`, `COMPLETED`, or `FAILED`, `findOneAndUpdate` returns `null`. The worker logs an informational skip message and completes the job cleanly, preventing redundant execution attempts.
3. **Atomic Transition**: Only the single worker execution that successfully flips `QUEUED` → `RUNNING` proceeds to sandbox execution.

> **Distributed Systems Semantics Note**: The atomic state transition (`QUEUED` → `RUNNING`) strictly prevents **concurrent duplicate claims** of the same submission across workers. It does not provide an absolute "exactly-once execution" guarantee: if a worker process crashes abruptly after executing the submission in the sandbox but before persisting the final database state, queue recovery or retry mechanisms may trigger another execution attempt.

---

## 6. Verdict Evaluation vs. Infrastructure Failure Handling

A critical architectural responsibility of the worker is distinguishing **user code evaluation verdicts** from **transient infrastructure failures**:

```text
+-------------------------------------------------------------------------+
|                        Worker Job Execution                             |
+-------------------------------------------------------------------------+
                                    │
                                    ▼
                     submissionExecutionService.executeSubmission()
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         │                                                     │
         ▼                                                     ▼
   [User Code Verdict]                                [Infrastructure Error]
   - ACCEPTED                                         - Docker daemon down
   - WRONG_ANSWER                                     - Socket timeout
   - TIME_LIMIT_EXCEEDED                              - MongoDB disconnect
   - MEMORY_LIMIT_EXCEEDED                                     │
   - COMPILATION_ERROR                                         ▼
   - RUNTIME_ERROR                                    Check BullMQ Retries:
         │                                            attemptsMade + 1 < maxAttempts
         ▼                                                     │
   MongoDB State:                                ┌─────────────┴─────────────┐
   - status: 'COMPLETED'                         │ (Retries Remain)          │ (Retries Exhausted)
   - verdict: <verdict>                          ▼                           ▼
   - completedAt: <timestamp>             MongoDB State:             MongoDB State:
         │                                - status: 'QUEUED'         - status: 'FAILED'
         ▼                                - startedAt: null          - failedAt: <timestamp>
   BullMQ Job:                                   │                   - errorMessage: <details>
   - Resolves successfully                       ▼                           │
   - Never retried                        Rethrow Error:                     ▼
                                          - BullMQ schedules         BullMQ Job:
                                            exponential backoff      - Marks job FAILED
```

### 6.1. User Code Evaluation Verdicts
When user code fails to compile, exceeds resource limits, or produces incorrect output, the code evaluation is considered **successful**:
- The submission record in MongoDB transitions to `status: 'COMPLETED'`.
- The evaluation verdict (`ACCEPTED`, `WRONG_ANSWER`, `TLE`, `MLE`, `CE`, `RTE`) is recorded alongside test metrics and execution timings.
- The worker job returns successfully. BullMQ marks the job as completed and **never retries it**.

### 6.2. Infrastructure Failures & Retry Lifecycle
When an infrastructure or environment exception occurs (e.g., Docker daemon socket unavailable):
- The worker calculates remaining retry attempts: `job.attemptsMade + 1 < maxAttempts`.
- **Retries Remaining**:
  - The submission in MongoDB is reverted to `status: 'QUEUED'` with `startedAt: null`.
  - The worker rethrows the error, signaling BullMQ to schedule an exponential backoff retry.
  - Upon retry, any worker can atomically claim the submission from `QUEUED` again.
- **Retries Exhausted**:
  - The submission in MongoDB transitions to terminal `status: 'FAILED'`.
  - `failedAt` is timestamped and `errorMessage` records the root failure cause.
  - The error is rethrown, moving the BullMQ job to the failed state for administrative audit.

---

## 7. Graceful Shutdown & Signal Handling

The worker daemon registers signal listeners for `SIGTERM` and `SIGINT` to ensure zero job corruption during container restarts, deployments, or server maintenance.

```javascript
async function shutdown(exitProcess = true) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  logger.info('Worker shutdown initiated. Draining active jobs...');

  // 10-second safety force-exit timer
  const forceTimer = setTimeout(() => {
    logger.error('Worker graceful shutdown timed out after 10s. Forcing exit.');
    if (exitProcess) process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    // Step 1: Close BullMQ worker (stops pulling new jobs, waits for active jobs)
    if (workerInstance) {
      await workerInstance.close();
      logger.info('BullMQ worker closed successfully.');
    }

    // Step 2: Close Redis connections
    await closeSubmissionQueue();
    await redisConfig.closeRedisConnection();
    logger.info('Redis connections closed successfully.');

    // Step 3: Disconnect from MongoDB
    await disconnectDB();
    logger.info('MongoDB disconnected successfully.');

    clearTimeout(forceTimer);
    logger.info('Worker graceful shutdown complete.');
    if (exitProcess) process.exit(0);
  } catch (err) {
    logger.error('Error during worker graceful shutdown:', { error: err.message });
    clearTimeout(forceTimer);
    if (exitProcess) process.exit(1);
  }
}
```

### 7.1. Shutdown Guarantees
1. **Idempotency**: Repeated `SIGTERM`/`SIGINT` signals are ignored by the `isShuttingDown` guard.
2. **Active Job Drainage**: `workerInstance.close()` halts job fetching while permitting in-flight executions to finish their evaluation and database updates.
3. **Resource Cleardown**: Redis connections and MongoDB connection pools are gracefully terminated.
4. **Deterministic Timeout**: If an execution hangs indefinitely, the 10-second unreferenced timer terminates the process with code 1.

---

## 8. Observability, Metrics & Security Logging

### 8.1. Structured Lifecycle Events
All worker events are logged through the repository's centralized JSON logger:
- **`worker_started`**: Emitted when the worker starts listening on the queue (`queue`, `concurrency`, `pid`).
- **`submission_job_started`**: Emitted upon claiming a job (`submissionId`, `jobId`, `workerPid`).
- **`submission.execution.started`**: Emitted when code evaluation begins (`submissionId`, `problemId`, `language`, `testCasesCount`).
- **`submission.execution.completed`**: Emitted when evaluation completes (`submissionId`, `language`, `verdict`, `testsPassed`, `totalTests`, `runtimeMs`).
- **`submission_job_completed`**: Emitted when the BullMQ job finishes, recording total worker execution time:
  ```json
  {
    "submissionId": "6aac9ce47947822896436e2b",
    "jobId": "6aac9ce47947822896436e2b",
    "verdict": "WRONG_ANSWER",
    "testsPassed": 0,
    "totalTests": 6,
    "runtimeMs": 1077,
    "durationMs": 3710
  }
  ```

### 8.2. Security & Sanitization Invariants
- **Zero Secret Leakage**: The worker log stream never logs user source code, compiler output containing secrets, database credentials, or Redis passwords.
- **Sanitized Error Reporting**: Internal engine stack traces are logged locally to server logs while client-facing submission records receive structured error summaries.

---

## 9. Docker & Containerized Runtime

The worker is deployed as a dedicated service in `docker-compose.yml`:

```yaml
worker:
  build:
    context: .
    dockerfile: Dockerfile
  container_name: codearena-worker
  restart: unless-stopped
  command: npm run worker
  environment:
    - NODE_ENV=production
    - PORT=5000
    - MONGO_URI=mongodb://mongodb:27017/codearena
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - EXECUTION_MODE=docker
    - WORKER_CONCURRENCY=2
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  depends_on:
    mongodb:
      condition: service_healthy
    redis:
      condition: service_healthy
  networks:
    - codearena-network
```

### 9.1. Sandbox Isolation Boundary
- The worker communicates with the local Docker daemon via `/var/run/docker.sock` to spin up isolated `codearena-sandbox:v1` containers.
- Untrusted code is executed inside ephemeral containers with strict cgroup limits:
  - `--cpus="1.0"`
  - `--memory="256m"`
  - `--network="none"` (zero egress/ingress network access)
  - Read-only root filesystem where applicable.

---

## 10. Verification & Test Suite

The worker architecture is verified by a dedicated test suite in `backend/tests/phase14.test.js`:

| Test Group | Invariant Verified |
| :--- | :--- |
| **1. Process & Decoupling** | Validates worker exports, script commands, and confirms worker never exposes HTTP server or calls `app.listen`. |
| **2. Fail-Fast Startup** | Validates worker connects to MongoDB and validates Redis ping before consuming jobs; verifies failure aborts startup. |
| **3. Payload Validation** | Rejects null, undefined, non-ObjectId hex strings, and malformed job data gracefully without crashing. |
| **4. State Machine & Idempotency** | Confirms atomic `QUEUED` → `RUNNING` transition, skips already `RUNNING`/`COMPLETED` submissions, and handles missing IDs. |
| **5. Verdict vs Infrastructure** | Confirms evaluation verdicts (`ACCEPTED`, `WRONG_ANSWER`, `CE`, etc.) complete BullMQ jobs without retrying; verifies transient engine errors revert status to `QUEUED` for retry. |
| **6. Observability & Timing** | Verifies worker logs structured JSON events including `durationMs`, `runtimeMs`, `verdict`, and `testsPassed`. |
| **7. Graceful Shutdown** | Confirms idempotent shutdown sequence: closes worker, drains active jobs, closes Redis/MongoDB, and exits cleanly. |

---

## 11. Scope Exclusions & Future Phases

To maintain architectural focus, Phase 14 enforces the following boundary:
- **Phase 15 (Multiple Workers / Concurrency)**: Will address multiple worker container replicas, dynamic concurrency tuning, queue priority partitioning, and worker health heartbeats.
- **Phase 16 (Horizontal Scaling)**: Will introduce container auto-scaling and Redis clustering.
- **Phase 17 (Distributed Execution)**: Will decouple Docker sandboxes across remote compute nodes via gRPC / worker agents.
- **Excluded Technologies**: Kafka, RabbitMQ, Celery, Kubernetes Operators, and Nomad are intentionally excluded from Phase 14.
