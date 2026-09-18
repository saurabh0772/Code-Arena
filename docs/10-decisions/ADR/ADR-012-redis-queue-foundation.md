# ADR-012: Redis + BullMQ Queue Foundation & Minimal Payload Invariant

## Status

Accepted

## Date

2026-09-18

## Context

With asynchronous submission processing introduced in Phase 12, CodeArena decoupled the HTTP submission creation endpoint from synchronous Docker sandbox execution. However, scaling and stabilizing the asynchronous foundation for production requires rigorous standards for:
1. **Redis Connection Management**: Ensuring robust configuration whether connecting via standalone parameters (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`) or uniform connection strings (`REDIS_URL`), and strictly satisfying BullMQ engine requirements (`maxRetriesPerRequest: null`, `enableReadyCheck: false`).
2. **Security & Payload Minimalism**: Preventing Redis memory bloat and credential or source code exposure by enforcing strict payload constraints.
3. **Idempotency & State Invariants**: Guaranteeing at-most-once execution even under duplicate job submissions or network retries.
4. **Queue Observability**: Providing operational visibility into queue depth and job states for system administrators.
5. **Infrastructure Failure Resilience**: Ensuring graceful degradation when Redis is temporarily unreachable without leaving orphan submissions in indeterminate states.

## Decision

Establish a centralized, production-grade Redis + BullMQ foundation adhering to the canonical CodeArena roadmap:

1. **Centralized Redis Client Lifecycle (`backend/src/config/redis.js`)**:
   - Centralize all Redis connection options parsing, instantiation, readiness verification, and graceful shutdown.
   - Support both parameter-based (`host`, `port`, `password`) and URI-based (`REDIS_URL`) configurations.
   - Enforce `maxRetriesPerRequest: null` and `enableReadyCheck: false` across all modes, preventing BullMQ initialization failures.
   - Implement capped exponential backoff (`times * 100` up to 3000ms) for transient network disconnects.
   - Redact credentials from all connection and error logging.

2. **Strict Minimal Payload Rule**:
   - The BullMQ queue (`submission-execution`) strictly accepts and stores only `{ submissionId }`.
   - Never serialize source code, test case inputs/outputs, user identities, or JWT tokens into Redis.
   - Workers hydrate the submission entity directly from MongoDB, preserving MongoDB as the single source of truth.

3. **Two-Tier Idempotency**:
   - **Queue Tier**: BullMQ `jobId` is explicitly set to `submissionId`, preventing duplicate active or waiting jobs for the same submission.
   - **Database Tier**: Workers claim jobs via atomic query `Submission.findOneAndUpdate({ _id: submissionId, status: 'QUEUED' }, { $set: { status: 'RUNNING', startedAt: new Date() } })`.

4. **Job Lifecycle & Retention Policies**:
   - Job retry configuration: `attempts: 3`, with exponential backoff (`delay: 1000ms`).
   - Sane retention limits: `removeOnComplete: { count: 1000, age: 86400 }` (24h) and `removeOnFail: { count: 5000, age: 604800 }` (7d) to prevent unbounded memory growth.

5. **Operational Observability**:
   - Expose `getQueueMetrics()` reporting `waiting`, `active`, `completed`, `failed`, and `delayed` job counts.
   - Provide administrative endpoint `GET /api/v1/admin/queue-metrics`, strictly guarded by `authenticate` and `authorize('ADMIN')`.

6. **Infrastructure Failure Handling & Consistency Boundaries**:
   - When Redis enqueue fails during submission creation and the process remains healthy, the database record is updated to `status: 'FAILED'` with a timestamp and error explanation, and the client receives HTTP 503 `QUEUE_UNAVAILABLE`.
   - **Dual-Write Consistency Window**: If the application process crashes (e.g. SIGKILL, container eviction, or hardware failure) precisely between persisting `status: 'QUEUED'` in MongoDB and completing the BullMQ `queue.add()` call, the record remains in `QUEUED` without an active BullMQ job. Full two-phase commit or distributed outbox patterns are intentionally excluded in Phase 13 to maintain architectural simplicity.
   - **Future Reconciliation**: A background reconciliation scanner that periodically queries stale `QUEUED` submissions and verifies BullMQ job presence is documented as a future reliability improvement.

## Consequences

### Positive

- **Deterministic Redis Configuration**: Single source of truth for all Redis client connections eliminates drift and BullMQ misconfigurations.
- **Minimal Redis Footprint & Zero Leaks**: Storing only 24-character ObjectIds keeps Redis memory overhead negligible and guarantees secrets or user code cannot leak via Redis snapshots or inspection.
- **Idempotency Guarantee**: Eliminates redundant or competing sandbox executions.
- **Admin Visibility**: Operational queue metrics readily available for monitoring dashboards and alerting.
- **Clean Scope Boundary**: Establishes a solid queue foundation without prematurely introducing multi-worker clustering or distributed schedulers, keeping the architecture ready for Phase 14 (Worker Architecture).

### Negative / Trade-offs

- **Database Hydration Overhead**: Workers must query MongoDB to fetch problem and submission details; this is an intentional, acceptable trade-off that maintains data consistency and minimal payload security.
- **MongoDB → Redis/BullMQ Dual-Write Consistency Window**: In the event of an abrupt process crash between MongoDB save and BullMQ enqueue, background reconciliation or outbox-style mechanisms (deferred to future reliability phases) are required to clear stale `QUEUED` records.
