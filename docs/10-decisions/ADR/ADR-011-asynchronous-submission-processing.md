# ADR-011: Asynchronous Submission Processing via Redis and BullMQ

## Status

Accepted

## Date

2026-09-17

## Context

In the initial Phase 10/11 MVP, `POST /api/v1/submissions` processed code submissions synchronously.
The API thread held the client HTTP request open while preparing the workspace, compiling binaries, and sequentially running test cases inside Docker sandbox containers.

Under concurrent load or with long-running/TLE submissions, this synchronous model:
- Couples HTTP API responsiveness and latency directly to sandbox compilation and execution time.
- Holds open HTTP client connections and reverse-proxy buffers for several seconds.
- Creates backend process memory and event-loop pressure.
- Prevents smooth buffering during traffic spikes.

## Decision

Adopt an asynchronous submission execution architecture within the modular monolith using **Redis** as the job transport, **BullMQ** as the queue engine, and a dedicated **Worker** process:

1. `POST /api/v1/submissions` validates the submission, stores an initial `PENDING` record in MongoDB, enqueues a minimal payload `{ submissionId }` to BullMQ, transitions the status to `QUEUED`, and immediately responds with HTTP 201.
2. A separate background Worker daemon subscribes to the `submission-execution` queue, consumes jobs with configurable concurrency, checks idempotency, executes tests via the existing Execution Engine, and updates final status and verdicts in MongoDB.
3. The frontend polls `GET /api/v1/submissions/:submissionId` until terminal status (`COMPLETED` or `FAILED`) is reached.

## Consequences

### Positive

- **Sub-100ms API Latency**: Submission creation returns almost instantaneously without waiting for Docker sandbox execution.
- **Queue Buffering**: Submissions absorb traffic spikes safely in Redis rather than exhausting HTTP socket pools.
- **Clean Decoupling**: API routes remain thin producers; execution logic resides in worker consumers.
- **Horizontal Scalability**: Worker concurrency and future worker container pools can scale independently from the API tier.

### Negative / Trade-offs

- **Infrastructure Dependency**: Introduces Redis 7.2 as a required operational dependency.
- **Eventual Consistency**: Client UI must poll submission state until terminal status is evaluated.
- **Failure Modes**: Requires explicit handling for queue delivery failures and worker crashes (`FAILED` state).
