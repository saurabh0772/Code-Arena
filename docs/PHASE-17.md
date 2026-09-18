# Phase 17 — Distributed Execution Architecture

## 1. Title & Executive Summary

Phase 17 establishes the **Distributed Execution Architecture** for CodeArena. Building directly upon the foundation of Phase 15 (Multiple Workers / Concurrency) and Phase 16 (Horizontal Scaling / Multi-Backend Replicas), Phase 17 decouples code execution into an autonomous, distributed, and resilient execution tier.

In this architecture:
- The **Backend API Tier** is strictly stateless, serving client traffic load-balanced behind Nginx, ingesting submissions, validating payloads, and enqueuing minimal `{ submissionId }` jobs into BullMQ. The Backend API does not have Docker daemon access (`/var/run/docker.sock`) and never executes untrusted user code or interfaces directly with Docker sandbox engines.
- The **Worker Tier** consists of distributed, autonomous worker daemons running across isolated processes or nodes. Workers independently consume jobs from the shared `submission-execution` BullMQ queue, claim submissions using atomic state transitions with stale-ownership recovery, execute code in secured container sandboxes, record diagnostic execution metadata, and publish ephemeral heartbeats to Redis. Only the trusted worker/execution infrastructure owns Docker execution access.
- A **Redis-Backed Ephemeral Registry** tracks active worker instances with automatic TTL expiration, providing real-time fleet health and administrative observability without coupling workers to a central coordinator.
- A robust **Stale Execution Ownership Recovery Protocol** protects active executions from being stolen while allowing BullMQ retry attempts to safely recover stalled `RUNNING` submissions abandoned by crashed workers.
- **Failure Classification** ensures that legitimate evaluation verdicts complete normally, transient infrastructure errors leverage BullMQ retries, and non-retryable domain failures (e.g. missing test cases) fail immediately without endless retry loops.

---

## 2. Distributed Execution Architecture

```text
                         ┌──────────────────┐
                         │     Frontend     │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      Nginx       │
                         └────────┬─────────┘
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
              ┌──────────────┐          ┌──────────────┐
              │ Backend API  │          │ Backend API  │
              │   Replica 1  │          │   Replica 2  │
              └──────┬───────┘          └──────┬───────┘
                     │                         │
                     └───────────┬─────────────┘
                                 ▼
                         ┌──────────────────┐
                         │ Redis / BullMQ   │
                         └────────┬─────────┘
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
              ┌──────────────┐          ┌──────────────┐
              │   Worker 1   │          │   Worker 2   │
              └──────┬───────┘          └──────┬───────┘
                     │                         │
                     └────────────┬────────────┘
                                  ▼
                         ┌──────────────────┐
                         │ Execution Engine │
                         └────────┬─────────┘
                                  ▼
                         ┌──────────────────┐
                         │ Docker Sandbox   │
                         └──────────────────┘

              Backend ──────────────┐
                                    ├──► MongoDB
              Workers ──────────────┘
```

> **Security Invariant**: `Backend → Docker` does NOT exist. Backend has zero Docker daemon access. Only trusted worker/execution infrastructure reaches Docker.

---

## 3. Stateless Backend API Layer

The backend API tier adheres strictly to the following invariants:
1. **Zero Execution Coupling & Docker Isolation**: The API server (`server.js`, `app.js`) strictly routes submissions to Redis via `submissionQueue.add('submission-execution', { submissionId })`. It does not mount `/var/run/docker.sock`, contains no execution workspaces, and never interfaces with the Docker engine.
2. **Stateless Scalability**: API instances maintain no process-local state, session storage, or sticky caches. Any API replica can accept submissions, authenticate requests via stateless JWT, or serve administrative metrics.
3. **Minimal Job Ingestion**: Submissions are created in MongoDB in `PENDING` / `QUEUED` status, and only the minimal reference `{ submissionId }` is enqueued into BullMQ.

---

## 4. Autonomous Worker Execution Layer

Worker daemons (`submission.worker.js`) are decoupled, autonomous background processes:
1. **Independent Process Lifecycles**: Workers do not mount Express routers, listen on HTTP ports, or serve web traffic.
2. **Dynamic Scaling**: Workers can be scaled dynamically (e.g. `docker compose up --scale worker=N -d`) without modifying API configurations or restarting queues.
3. **Trusted Execution Access**: Workers mount `/var/run/docker.sock` and execution workspaces to invoke the Execution Engine and spawn isolated ephemeral containers (`codearena-sandbox:v1`).
4. **Collision-Resistant Identity**: Every worker resolves a unique, persistent identifier at startup:
   ```javascript
   process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
   ```
   This guarantees collision freedom even when multiple worker containers run on identical hostnames or in containerized environments.

---

## 5. BullMQ Queue Contract & Job Lifecycle

The distributed execution tier interacts exclusively through the BullMQ `submission-execution` queue:
- **Queue Name**: `submission-execution`
- **Job Name**: `submission-execution`
- **Payload Contract**: `{ submissionId: string }`
- **Job Options**:
  - `attempts: 3` (configurable exponential backoff for infrastructure failures)
  - `removeOnComplete: true` / bounded history
  - `removeOnFail: false` (preserved for audit analysis)

### Job State Transitions
```text
   [ Enqueued ] ──> [ BullMQ Active ] ──> [ Evaluated ] ──> [ BullMQ Completed ]
        │                    │                    │
   (QUEUED in DB)       (RUNNING in DB)    (COMPLETED in DB)
        │                    │
        │                    ├──> [ Domain Failure ] ──> [ BullMQ Completed (FAILED in DB) ]
        │                    │
        │                    └──> [ Infra Error ] ──> [ BullMQ Retry ]
        │                                                     │
        └─────────────────────────────────────────────────────┘
```

---

## 6. Ephemeral Worker Registry & Redis Heartbeats

The worker fleet publishes operational status and liveness to Redis via `worker-registry.service.js`:
- **Redis Key Structure**: `codearena:workers:<workerId>`
- **TTL Duration**: 15 seconds (3x standard 5-second heartbeat interval)
- **Registry Record Schema**:
  ```json
  {
    "workerId": "worker-node-1-42-a1b2c3d4",
    "status": "READY",
    "concurrency": 2,
    "startedAt": "2026-09-18T10:00:00.000Z",
    "lastHeartbeat": "2026-09-18T10:00:10.000Z",
    "hostname": "node-1",
    "pid": 42
  }
  ```
- **Operational Statuses**:
  - `STARTING`: Daemon initialized, verifying database and Redis readiness.
  - `READY`: BullMQ worker active, accepting and processing jobs.
  - `DRAINING`: Termination signal received, intake paused, draining active sandboxes.
  - `STOPPED`: Worker terminated gracefully, connections closed.
- **Fault Detection**: If a worker crashes hard (`SIGKILL`, host power loss), its key naturally expires from Redis within 15 seconds, automatically pruning the active fleet view.

---

## 7. Submission Execution Telemetry & Lifecycle Invariants

Every submission maintains diagnostic execution telemetry in MongoDB without permanent lock coupling:

### Submission Model Schema (`execution` subdocument)
```javascript
execution: {
  workerId: { type: String, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null }
}
```

### Invariants
1. **Initial Claim**: When claimed by a worker, `execution.workerId` is stamped with the worker's unique ID, and `execution.startedAt` is set to the current UTC timestamp.
2. **Completion**: Upon finishing evaluation, `execution.completedAt` is recorded, and `status` transitions to `COMPLETED` or `FAILED`.
3. **Auditability**: `toSafeObject()` exposes `execution` telemetry to authorized users and administrators for latency auditing and distributed trace inspection.
4. **Diagnostic Ownership**: `execution.workerId` identifies the current executing worker for observability and stale recovery. It does not confer permanent ownership.

---

## 8. Execution Ownership with Stale-Owner Recovery and Idempotency

Distributed systems must be resilient against mid-execution worker failures without duplicate execution or stealing active executions.

### Stale Ownership Recovery Mechanism
1. **Atomic Conditional Update**:
   Workers claim submissions atomically using an atomic query with a stale cutoff:
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
2. **Fresh Active Execution Protection**:
   If a submission is `RUNNING` and its `startedAt` timestamp is recent (`startedAt >= staleCutoff`), another worker's BullMQ retry delivery will fail the claim and cleanly skip the job without interrupting the active execution.
3. **Stale Recovery for Crashed Workers**:
   If a worker crashes while executing a submission, the submission remains in `RUNNING`. When a subsequent BullMQ retry arrives after `WORKER_STALE_TIMEOUT_MS` (default: 30s), the claim filter matches the stale `startedAt` timestamp, atomically transferring ownership to the recovering worker and resetting `execution.startedAt`.
4. **Terminal State Idempotency**:
   If `submission.status` is already `COMPLETED` or `FAILED`, the job is acknowledged and skipped immediately, preventing re-execution of evaluated submissions.

---

## 9. Failure Classification & Retry Semantics

The execution tier strictly differentiates three distinct error categories:

### 1. Evaluation Results (Legitimate Execution Verdicts)
- Verdicts: `ACCEPTED`, `WRONG_ANSWER`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`.
- Outcome: Persist verdict, update `status: 'COMPLETED'`, record test metrics, and resolve the BullMQ job successfully. BullMQ never retries evaluation outcomes.

### 2. Transient Infrastructure Failures
- Failures: Docker daemon unavailability, Redis connection glitches, transient database timeouts.
- Outcome: If retries remain (`attemptsMade + 1 < maxAttempts`), revert MongoDB submission to `status: 'QUEUED'` and rethrow so BullMQ applies exponential backoff. If retries are exhausted, mark `status: 'FAILED'` with `errorMessage` and rethrow to mark the BullMQ job failed.

### 3. Non-Retryable Domain / System Failures
- Failures: Problem not ready (`PROBLEM_NOT_READY`), missing active test cases, unsupported language, payload validation failures.
- Outcome: Immediately mark submission `status: 'FAILED'`, record `errorMessage` and `execution.completedAt`, log warning, and resolve the job cleanly in BullMQ without scheduling futile retries.

---

## 10. Worker Draining, Graceful Shutdown, and Fault Isolation

When receiving OS termination signals (`SIGTERM`, `SIGINT`), workers execute an ordered shutdown sequence:
1. **Status Update**: Immediately updates registry status to `DRAINING`.
2. **Intake Pause**: Calls `worker.pause(true)` to halt dequeuing new jobs.
3. **Heartbeat Teardown**: Clears the periodic heartbeat interval timer.
4. **Bounded Drain**: Waits for active in-flight jobs to complete, bounded by `WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS` (default: 10000ms).
5. **Connection Teardown**: Closes the BullMQ worker (`worker.close()`), sets registry status to `STOPPED`, and closes Redis and MongoDB connections.

---

## 11. Admin Worker Fleet Visibility API

Administrators can inspect active distributed workers via:
- **Endpoint**: `GET /api/v1/admin/workers`
- **RBAC**: Protected via `authenticate` and `authorize('ADMIN')`.
- **Response Format**:
  ```json
  {
    "success": true,
    "data": {
      "count": 2,
      "workers": [
        {
          "workerId": "worker-ee3a21fda008-1-56b05712",
          "status": "READY",
          "concurrency": 2,
          "startedAt": "2026-09-18T06:08:16.993Z",
          "lastHeartbeat": "2026-09-18T06:10:16.995Z",
          "hostname": "ee3a21fda008",
          "pid": 1
        }
      ]
    }
  }
  ```

---

## 12. Docker Compose Multi-Node Topology

The distributed stack runs seamlessly with scaled replicas:
- **Reverse Proxy**: Nginx load-balances traffic across scaled backend replicas (`backend:5000`).
- **Backend Replicas**: Multiple backend instances (`--scale backend=2`) handle API requests. Backend does NOT mount `/var/run/docker.sock`.
- **Worker Replicas**: Multiple worker containers (`--scale worker=2`) consume from BullMQ. Workers mount `/var/run/docker.sock` to execute sandboxes.
- **Shared Datastores**: MongoDB 7.0 and Redis 7.2 act as shared persistence and messaging layers.

---

## 13. Comprehensive Test & Live Verification Strategy

### Automated Test Suite (`backend/tests/phase17.test.js`)
Comprehensive test suite covering:
- **Test A & B**: Backend Docker socket isolation vs Worker Docker access in `docker-compose.yml`.
- **Test C**: Rejection of reclaim attempts on fresh `RUNNING` submissions.
- **Test D**: Successful reclaim and ownership transfer on stale `RUNNING` submissions.
- **Test E**: Atomic conditional updates prevent concurrent duplicate claims (exactly one worker wins).
- **Test F**: Legitimate evaluation verdicts (`ACCEPTED`, `WRONG_ANSWER`, `TLE`, `MLE`, `CE`, `RTE`) persist as `COMPLETED`.
- **Test G**: Transient infrastructure failures revert to `QUEUED` and schedule BullMQ retries.
- **Test H**: Non-retryable domain/configuration errors (`PROBLEM_NOT_READY`) transition to `FAILED` without BullMQ retries.
- **Test I**: Multi-worker concurrent queue consumption and distinct worker attribution.
- **Test J**: Ephemeral worker registry registration, heartbeats, and natural TTL key expiry.
- **Test K**: Worker graceful draining sequence (`READY` → `DRAINING` → intake paused → drain → `STOPPED`).

### Live Integration Verification (`scripts/verify-phase17-live.js`)
Validates the end-to-end multi-container stack against running Docker Compose services:
- Verifies Nginx gateway, backend liveness, and database/Redis readiness.
- Authenticates as admin and verifies active workers in the Redis registry.
- Submits 6 independent solutions across the scaled system.
- Polls submissions to completion and verifies `execution.workerId`, `startedAt`, and `completedAt`.
- Enforces multi-worker distribution: asserts that `executingWorkers.size >= 2` when `registeredWorkers.length >= 2`.
- Confirms active workers maintain fresh heartbeats throughout execution.

---

## 14. Roadmap Integrity & Future Phases

- **Phase 13 (Redis + Queue)**: COMPLETE & FROZEN.
- **Phase 14 (Worker Architecture)**: COMPLETE & FROZEN.
- **Phase 15 (Multiple Workers / Concurrency)**: COMPLETE & FROZEN.
- **Phase 16 (Horizontal Scaling)**: COMPLETE & FROZEN.
- **Phase 17 (Distributed Execution Architecture)**: COMPLETE.
- **Phase 18 (Advanced Infrastructure — Kubernetes, Autoscaling, Service Mesh, Multi-Region)**: **FUTURE / NOT IMPLEMENTED**. Phase 18 concepts remain strictly out of scope.
