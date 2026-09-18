# ADR-013: Submission Worker Architecture & Process Decoupling

## Status

Accepted

## Date

2026-09-18

## Context

Following the establishment of asynchronous submission processing (Phase 12) and the Redis + BullMQ queue foundation (Phase 13), CodeArena decoupled HTTP submission ingestion from synchronous container execution.

However, executing untrusted code requires a dedicated, resilient, and deterministic execution runtime. Specifically:
1. **Process Isolation**: The worker daemon must run in an OS process completely isolated from the Express HTTP API. The worker must never bind HTTP ports, call `app.listen()`, or expose external web endpoints.
2. **Fail-Fast Startup**: If downstream dependencies (MongoDB or Redis) are unavailable, the worker must fail fast at startup rather than dequeuing jobs into an unprocessable state.
3. **Payload & Input Validation**: The worker must strictly validate job payloads (`submissionId`), gracefully skipping malformed or non-ObjectId payloads without unhandled exceptions or process crashes.
4. **State Machine Safety & Idempotency**: The worker must atomically claim jobs from `QUEUED` to `RUNNING`, skipping duplicate or already resolved submissions cleanly.
5. **Verdict Evaluation vs. Infrastructure Failure**: The worker must strictly distinguish normal user code evaluation verdicts (`ACCEPTED`, `WRONG_ANSWER`, `TLE`, `MLE`, `CE`, `RTE`) from transient infrastructure errors (e.g. Docker daemon socket unavailability, transient database disconnects). Code verdicts must be marked `COMPLETED` and never retried by BullMQ, while infrastructure errors must revert the database record to `QUEUED` and leverage BullMQ exponential backoff retries.
6. **Graceful Shutdown**: The worker must handle OS signals (`SIGTERM`, `SIGINT`) idempotently, drain active jobs, close database and queue connections, and enforce a safety timeout.
7. **Observability**: Execution timings (`durationMs`, `runtimeMs`) must be logged in structured JSON without leaking sensitive source code, passwords, or test case secrets.

## Decision

Establish a robust, standalone Submission Worker Architecture adhering to the canonical CodeArena roadmap:

1. **Dedicated Worker Process (`backend/src/workers/submission.worker.js`)**:
   - Establish an independent daemon entrypoint executed via `npm run worker` (`node src/workers/submission.worker.js`).
   - The worker process strictly never instantiates Express, mounts routers, or binds HTTP ports.
   - The Express API process (`server.js`) strictly never runs code execution sandboxes.

2. **Fail-Fast Startup Sequence (`startWorker`)**:
   - Worker startup connects to MongoDB via `connectDB()`.
   - Worker verifies Redis connection via `redisConfig.checkRedisReadiness()`.
   - If either datastore is unhealthy or unreachable, the worker throws an explicit error and halts startup before instantiating the BullMQ worker.
   - BullMQ worker is instantiated with a dedicated Redis client (`redisConfig.createRedisClient()`).

3. **Strict Payload Validation**:
   - `processSubmission(job)` validates that `submissionId` exists and is a valid MongoDB ObjectId (`mongoose.Types.ObjectId.isValid`).
   - Invalid payloads log a warning and return `{ status: 'SKIPPED', reason: 'INVALID_PAYLOAD' }`, acknowledging the job without crashing.

4. **Atomic State Claiming & Idempotency**:
   - The worker executes `Submission.findOneAndUpdate({ _id: submissionId, status: 'QUEUED' }, { $set: { status: 'RUNNING', startedAt: new Date() } })`.
   - If the submission does not exist, or is already in `RUNNING`, `COMPLETED`, or `FAILED` state, the worker safely skips execution, preventing concurrent duplicate claims of the same submission.

5. **Verdict vs. Infrastructure Error Separation**:
   - **Evaluation Verdicts**: User code verdicts update the submission record to `status: 'COMPLETED'`, record test metrics, and resolve the BullMQ job successfully. BullMQ does not retry completed jobs.
   - **Infrastructure Failures**: If execution throws an unexpected infrastructure error:
     - Check remaining attempts (`job.attemptsMade + 1 < maxAttempts`).
     - If retries remain: revert MongoDB submission to `status: 'QUEUED'` and rethrow so BullMQ applies exponential backoff.
     - If retries exhausted: mark MongoDB submission as `status: 'FAILED'`, record failure timestamp and error message, and rethrow to mark the BullMQ job failed.

6. **Idempotent Graceful Shutdown (`shutdown`)**:
   - Listen for `SIGTERM` and `SIGINT` signals.
   - Guard against duplicate invocations with an `isShuttingDown` flag.
   - Arm an unreferenced 10-second safety timeout to prevent hanging on zombie processes.
   - Close BullMQ worker (`worker.close()`), waiting for in-flight jobs to complete.
   - Close Redis queue client and shared connection.
   - Disconnect MongoDB Mongoose connection.
   - Terminate process with exit code 0.

7. **Structured Observability**:
   - Measure wall-clock execution time (`durationMs = Date.now() - startTime`).
   - Emit structured JSON log events (`worker_started`, `submission_job_started`, `submission.execution.started`, `submission.execution.completed`, `submission_job_completed`).
   - Sanitize all log payloads, ensuring source code, passwords, and secrets are never emitted to log aggregators.

## Consequences

### Positive

- **Process Decoupling**: API server throughput is immune to CPU spikes, memory leaks, or sandbox hangs caused by user code execution.
- **Fail-Fast Reliability**: Worker will never pull jobs when MongoDB or Redis are down, preventing silent job loss or thrashing.
- **Concurrent Duplicate Claim Prevention**: Atomic database claiming combined with BullMQ `jobId = submissionId` prevents concurrent duplicate claims of the same submission across workers.
- **Clear Failure Semantics**: User code verdicts are never retried unnecessarily, while transient infrastructure failures automatically recover through backoff retries.
- **Graceful Deployment**: Workers drain active jobs during container redeployment without dropping executions or leaving stale `RUNNING` submissions.
- **Clean Scope Boundary**: Establishes a rock-solid single-worker architecture ready for Phase 15 (Multiple Workers / Concurrency).

### Negative / Trade-offs

- **Database Hydration Overhead**: Worker queries MongoDB to hydrate code and test cases for each job. This is an intentional security and architectural trade-off to maintain minimal Redis payload size (~50 bytes) and keep MongoDB as the single source of truth.
- **Single-Worker Scalability Boundary**: Concurrency is limited by the local worker process resources. Horizontal scaling and multi-worker replicas are deferred to Phase 15 and Phase 16.
