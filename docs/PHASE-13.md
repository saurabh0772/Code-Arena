# CodeArena — Phase 13: Redis + Queue

## 1. Overview & Architectural Motivation

Following the introduction of asynchronous submission processing in Phase 12, Phase 13 hardens and standardizes the **Redis + Queue foundation** for CodeArena.

While Phase 12 established the end-to-end asynchronous workflow (API producer → BullMQ queue → Worker daemon → Docker sandbox), Phase 13 focuses on:
- **Centralizing Redis connection and lifecycle management** across all application contexts (API, Worker, scripts, and tests).
- **Enforcing strict BullMQ compatibility parameters** (`maxRetriesPerRequest: null`, `enableReadyCheck: false`) across both standalone connection options and uniform connection string formats (`REDIS_URL`).
- **Standardizing the Minimal Payload Invariant**: guaranteeing that Redis acts strictly as a lightweight job buffer carrying only `{ submissionId }`, completely shielding Redis memory from source code, test cases, or authentication credentials.
- **Hardening idempotency boundaries**: ensuring that BullMQ `jobId` strictly mirrors `submissionId` to eliminate duplicate queue jobs, while MongoDB atomic state transitions protect at-most-once execution.
- **Introducing administrative queue observability**: exposing `GET /api/v1/admin/queue-metrics` with strict role-based access control (RBAC).
- **Formalizing Redis failure resilience**: ensuring that detected Redis outages fail fast with HTTP 503 `QUEUE_UNAVAILABLE` and transition the MongoDB submission record to `FAILED` when caught by the application.

---

## 2. Canonical Roadmap Placement

Phase 13 strictly adheres to the canonical CodeArena architecture roadmap:

```text
Phase 1–10  ──▶ MVP Implementation (Core, RBAC, Submissions, Sandboxes, Frontend)
Phase 11    ──▶ Production Hardening + Observability
Phase 12    ──▶ Async Submission Processing (Queue, Worker, Polling)
Phase 13    ──▶ Redis + Queue (Centralized Client, Minimal Payload, Queue Metrics, Hardening) [CURRENT]
Phase 14    ──▶ Worker Architecture [FUTURE]
Phase 15    ──▶ Multiple Workers / Concurrency [FUTURE]
Phase 16    ──▶ Horizontal Scaling [FUTURE]
Phase 17    ──▶ Distributed Execution Architecture [FUTURE]
Phase 18    ──▶ Advanced Infrastructure [FUTURE]
```

> **Scope Guard**: Phase 13 does not introduce multi-worker clustering, dynamic worker discovery, Kubernetes operators, or distributed schedulers. These concerns belong strictly to **Phase 14+**.

---

## 3. Centralized Redis Configuration & Lifecycle (`src/config/redis.js`)

All Redis client instantiation and connection configuration is centralized in `backend/src/config/redis.js`.

### 3.1. Connection Parameter Support
The module seamlessly handles two connection topologies:
1. **Standalone Connection Parameters**:
   - `REDIS_HOST` (default: `localhost` or `redis` in Docker Compose)
   - `REDIS_PORT` (default: `6379`)
   - `REDIS_PASSWORD` (optional, credentials sanitized in logs)
2. **Connection URI**:
   - `REDIS_URL` (e.g., `redis://:password@host:6379/0`)

### 3.2. BullMQ Mandated Options
BullMQ requires specific ioredis options to prevent connection timeouts and unhandled promise rejections during blocking commands:
```javascript
const baseOptions = {
  maxRetriesPerRequest: null, // Mandatory for BullMQ queues and workers
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy(times) {
    // Capped exponential backoff (100ms, 200ms, ... up to 3000ms max)
    return Math.min(times * 100, 3000);
  }
};
```
These parameters are enforced consistently in both parameter-based and `REDIS_URL`-based connection modes.

### 3.3. Lifecycle Helpers
- `getRedisConnection()`: Returns a shared singleton ioredis client.
- `createRedisClient(options)`: Instantiates an independent ioredis client (essential when BullMQ workers or subscribers require separate TCP sockets).
- `checkRedisReadiness(client)`: Executes an explicit Redis `PING` returning `{ ready: boolean, status: 'healthy' | 'unhealthy', latencyMs: number }`.
- `closeRedisConnection()`: Gracefully issues `QUIT` or `disconnect()` without leaving unhandled socket rejections.

---

## 4. BullMQ Queue Module (`src/queues/submission.queue.js`)

### 4.1. Queue Invariants
- **Stable Queue Name**: `submission-execution` (exported as `SUBMISSION_QUEUE_NAME`).
- **Retry Strategy**:
  - `attempts: 3`
  - `backoff: { type: 'exponential', delay: 1000 }`
  - *Note*: Retries only apply to transient infrastructure failures (e.g., Docker socket unavailability). Normal user code verdicts (`WRONG_ANSWER`, `COMPILATION_ERROR`, `TLE`) conclude as `COMPLETED` and are never retried.
- **Retention Strategy**:
  - `removeOnComplete: { count: 1000, age: 86400 }` (Retains up to 1,000 completed jobs for 24 hours).
  - `removeOnFail: { count: 5000, age: 604800 }` (Retains up to 5,000 failed jobs for 7 days for diagnostic audits).

### 4.2. Minimal Payload Security Rule
The payload pushed to Redis is strictly validated:
```javascript
// Validated in enqueueSubmission(submissionId):
const job = await queue.add(
  'execute',
  { submissionId: sanitizedId }, // Payload strictly contains ONLY submissionId
  { jobId: sanitizedId }         // Deduplication key
);
```

**Why this rule is critical**:
1. **Memory Footprint**: Each job in Redis consumes ~50 bytes instead of several kilobytes or megabytes of code and test cases.
2. **Security & Data Isolation**: If Redis is dumped, inspected, or monitored, no source code, user data, or system tokens can ever leak.
3. **Single Source of Truth**: MongoDB remains the single authoritative store for submission code, problem data, and test cases.

### 4.3. Two-Tier Idempotency
- **Tier 1 (Queue Level)**: BullMQ `jobId = submissionId` ensures that enqueuing the same submission multiple times will not create duplicate waiting or active jobs in Redis.
- **Tier 2 (Database Level)**: When the worker picks up a job, it executes:
  ```javascript
  const claimed = await Submission.findOneAndUpdate(
    { _id: submissionId, status: 'QUEUED' },
    { $set: { status: 'RUNNING', startedAt: new Date() } },
    { returnDocument: 'after' }
  );
  ```
  If `claimed` is `null` (because another worker or a previous run already claimed it), the worker safely skips processing without re-running code.

---

## 5. Queue Observability & Admin Metrics Endpoint

To monitor queue depth and worker throughput, Phase 13 introduces dedicated queue metrics:

### 5.1. Internal Metric Extraction
`getQueueMetrics()` queries BullMQ counters in parallel:
```javascript
const [waiting, active, completed, failed, delayed] = await Promise.all([
  queue.getWaitingCount(),
  queue.getActiveCount(),
  queue.getCompletedCount(),
  queue.getFailedCount(),
  queue.getDelayedCount()
]);
```

### 5.2. Admin API Endpoint
- **Route**: `GET /api/v1/admin/queue-metrics`
- **Access Control**: Strict RBAC (`authenticate`, `authorize('ADMIN')`).
  - Unauthenticated requests → `401 Unauthorized`.
  - Normal users (`USER` role) → `403 Forbidden`.
  - Admins (`ADMIN` role) → `200 OK`.
- **Sample Response**:
  ```json
  {
    "success": true,
    "data": {
      "waiting": 0,
      "active": 1,
      "completed": 42,
      "failed": 2,
      "delayed": 0
    }
  }
  ```
- **Error Response (when Redis is down)**:
  ```json
  {
    "success": false,
    "message": "Queue service unavailable",
    "errorCode": "QUEUE_UNAVAILABLE"
  }
  ```

---

## 6. Failure Handling, Consistency & Recovery Design

### 6.1. Handled Enqueue Failures (Observed Redis Outage)
When `POST /api/v1/submissions` attempts to enqueue a submission and Redis is down or rejects the command:
1. The submission record in MongoDB has already been persisted with status `QUEUED` and timestamp `queuedAt`.
2. The `catch` block intercepts the Redis/queue error.
3. The database record is immediately updated:
   - `status = 'FAILED'`
   - `failedAt = new Date()`
   - `errorMessage = 'Failed to enqueue submission for processing'`
4. The API returns HTTP `503 Service Unavailable`:
   ```json
   {
     "success": false,
     "message": "Failed to queue submission for processing. Please try again.",
     "errorCode": "QUEUE_UNAVAILABLE"
   }
   ```
5. **Outcome**: When the Node.js API process remains alive to handle the exception, the submission is safely transitioned to `FAILED` and does not remain stuck in `QUEUED`.

### 6.2. Known Consistency Window: MongoDB → Redis/BullMQ Dual-Write Boundary
MongoDB and Redis are separate systems, so updating MongoDB and enqueueing a BullMQ job are not one atomic transaction.
```text
MongoDB Submission (status: PENDING)
       │
       ▼
MongoDB Update (status: QUEUED)  ──▶ Saved to MongoDB
       │
       ├─── [CONSISTENCY WINDOW] ──▶ Process crashes (e.g., SIGKILL / container crash)
       ▼
BullMQ queue.add()               ──▶ Never executed
```
- **The Consistency Window**: If the application process crashes after MongoDB successfully saves `QUEUED` but before the Redis/BullMQ enqueue succeeds, the submission can remain in `QUEUED` state without a corresponding queue job.
- **Scope Clarification**: Application-detected errors during enqueue are caught and safely marked `FAILED`. However, full transactional coordination (such as a transactional outbox pattern or two-phase commit) is intentionally not part of Phase 13 to keep the architecture simple and focused on the core queue foundation.
- This represents a known MongoDB → Redis/BullMQ dual-write consistency window that can be addressed in future phases with reconciliation or outbox-style reliability mechanisms.

### 6.3. Future Reliability Improvement: Periodic Reconciliation Strategy
To detect and recover orphaned `QUEUED` submissions caused by abrupt process crashes, a periodic reconciliation strategy can be introduced in a future reliability phase (Phase 14+):
```text
Periodic Reconciliation Worker (Future Improvement)
       │
       ├── 1. Periodic scan queries MongoDB:
       │      find({ status: 'QUEUED', queuedAt: { $lt: new Date(Date.now() - RECONCILIATION_THRESHOLD) } })
       │      (e.g., threshold = 2 to 5 minutes)
       │
       ├── 2. For each identified candidate submissionId:
       │      Check BullMQ queue state: await queue.getJob(submissionId)
       │
       ├── 3. If job exists in waiting, active, or delayed states:
       │      └── No action needed (job is legitimately queued or in-flight).
       │
       └── 4. If job does NOT exist in Redis (lost due to crash):
              ├── Option A (Auto-Re-enqueue): Re-enqueue { submissionId } with jobId: submissionId
              └── Option B (Mark FAILED): Transition submission to FAILED with errorMessage: 'Orphaned QUEUED submission recovered by reconciliation'
```
*Note*: This reconciliation loop is intentionally documented as a future architectural improvement and is not implemented in Phase 13.

### 6.4. Deep Readiness Probe (`GET /ready`)
The `/ready` probe aggregates health across all critical dependencies:
```json
{
  "status": "ready",
  "service": "codearena-backend",
  "timestamp": "2026-09-18T07:09:20.000Z",
  "checks": {
    "database": { "status": "healthy" },
    "execution": { "status": "healthy", "mode": "docker", "details": "Docker engine responsive" },
    "redis": { "status": "healthy", "latencyMs": 1 }
  }
}
```
If Redis fails to respond to `PING`, `/ready` returns HTTP `503` with `status: 'not_ready'`.

---

## 7. Docker & Environment Configuration

### 7.1. Service Definitions in `docker-compose.yml`
```yaml
  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    expose:
      - "6379"
    ports:
      # Bound strictly to 127.0.0.1; defaults to 6380 on host to prevent conflicts
      - "127.0.0.1:${REDIS_HOST_PORT:-6380}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 3s
```
- **Internal Docker Network**: API and Worker containers connect via hostname `redis` on port `6379`.
- **Host Testing & Local Dev**: Host port binds strictly to `127.0.0.1:6380` by default (preventing conflicts with host redis-server on 6379 and preventing external network exposure).

### 7.2. Environment Variables (`backend/.env.example` & `.env.example`)
- `REDIS_HOST`: Hostname of Redis instance (default: `localhost` in local dev, `redis` in Docker).
- `REDIS_PORT`: Port of Redis instance (default: `6379`).
- `REDIS_PASSWORD`: Optional authentication password.
- `REDIS_URL`: Optional connection string (e.g. `redis://localhost:6379`).
- `WORKER_CONCURRENCY`: Worker parallel execution slots (default: `2`).

---

## 8. Test Suite & Verification

A dedicated test suite was built in `backend/tests/phase13.test.js`:
- **Redis Connection**: Configuration options validation, retry strategy math, connection ping, independent client creation, readiness probe.
- **BullMQ Invariants**: Queue name verification, default job retry and retention settings, rejection of invalid submission IDs.
- **Payload Minimality**: Asserting that Redis jobs strictly contain only `{ submissionId }` and checking that no source code, passwords, or tokens exist in Redis.
- **Queue Idempotency**: Testing duplicate enqueue with identical `submissionId`.
- **Queue Observability**: Verifying `getQueueMetrics()` counts, `GET /api/v1/admin/queue-metrics` authorization (401 unauthenticated, 403 user, 200 admin).
- **Failure Handling**: Simulating Redis outages and verifying HTTP 503 `QUEUE_UNAVAILABLE` plus atomic MongoDB transition to `FAILED`.
- **Readiness**: Validating `/ready` Redis health checks.

### Verification Results:
- **Phase 13 Suite**: 17 tests passed (0 failures).
- **Full Backend Suite**: 197 tests passed across 56 test suites (0 failures).
- **Frontend Suite**: 21 tests passed across 9 test suites (0 failures).

---

## 9. Foundation for Phase 14 (Worker Architecture)

Phase 13 establishes the production-grade queue and Redis foundation. Phase 14 will build directly upon this foundation by:
1. Formalizing the Worker daemon as a dedicated, isolated execution service.
2. Refining Worker lifecycle management (heartbeats, concurrency tuning, and graceful draining).
3. Enhancing sandboxing execution isolation without modifying the queue contract or minimal payload invariant established in Phase 13.
