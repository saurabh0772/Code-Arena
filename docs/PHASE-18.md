# Phase 18 — Advanced Infrastructure & Operational Reliability

## 1. Title & Executive Summary

Phase 18 represents the **Final Roadmap Phase** for CodeArena: establishing a **production-oriented advanced infrastructure architecture and operational reliability model** based on Docker, Docker Compose, Nginx, Redis, BullMQ, and independent worker processes.

Building upon the distributed worker architecture of Phase 17, Phase 18 introduces production observability with Prometheus histograms, W3C distributed trace context propagation, MongoDB replica set fail-fast configuration, and sandbox runtime abstractions without compromising the stability of earlier phases or introducing unnecessary orchestration complexity.

### Core Architectural Pillars
1. **Horizontally Scalable Architecture (Docker Compose)**: Multi-container orchestration supporting dynamic horizontal scaling of backend API instances (`docker compose up -d --scale backend=N`) and worker daemons (`docker compose up -d --scale worker=N`).
2. **Nginx Reverse Proxy & Load Balancer**: Nginx acts as the single entry point for API traffic, dynamically resolving backend replicas using Docker's embedded DNS (`resolver 127.0.0.11 valid=5s`) with health-aware failover (`proxy_next_upstream`).
3. **Stateless API Invariant & Zero Docker Socket Access**: Backend API instances remain strictly stateless with liveness probes (`/health`), readiness probes (`/ready`), and **zero Docker socket access**. Backend instances purely validate requests, persist records in MongoDB, and enqueue minimal `{ submissionId }` jobs to Redis BullMQ.
4. **Dedicated Worker Tier & Security-Sensitive Capability**: Distributed worker processes consume jobs from BullMQ and mount `/var/run/docker.sock` to execute untrusted code inside hardened, disposable sandboxes. This capability is explicitly designated as **security-sensitive** and isolated exclusively to worker containers.
5. **Independent Worker Daemons & Concurrency**: Workers operate autonomously with configurable per-process concurrency (`WORKER_CONCURRENCY`), unique collision-resistant IDs, ephemeral Redis heartbeat registrations, and atomic stale submission reclamation.
6. **Production Observability**: Standard Prometheus metrics exporter (`GET /metrics`) featuring normalized route templates (e.g. `/api/v1/problems/:id`), true latency histograms (`_bucket`, `_sum`, `_count`), bounded non-blocking execution (<500ms even during Redis outages), and zero high-cardinality labels.
7. **W3C Distributed Trace Context Propagation**: Propagates RFC-standard `traceparent` context across the HTTP → Queue → Worker → Execution pipeline while strictly preserving the BullMQ business payload contract `{ submissionId }`.
8. **Datastore Reliability & MongoDB Replica Sets**: Supports both standalone local development and high-availability MongoDB replica sets (`replicaSet`, `readPreference`, `retryWrites`) with fail-fast validation without silent downgrade.
9. **Sandbox Runtime Abstraction**: Introduces the `ExecutionRuntime` contract, keeping `DockerRuntime` active and tested while establishing documented experimental interfaces for `GVisorRuntime` and `FirecrackerRuntime`.

---

## 2. Production Topology & Component Architecture

```text
                                  Internet / Clients
                                          │
                                          ▼
                         Nginx Reverse Proxy (Port 5000:80)
                                          │ (Dynamic DNS discovery)
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                     Frontend SPA (Port 5173)   Backend Replicas (Port 5000)
                     (React 18 / Nginx)         (Express.js --scale backend=N)
                                                        │
                                         ┌──────────────┴──────────────┐
                                         ▼                             ▼
                             MongoDB 7.0 (Port 27017)          Redis 7.2 Broker
                             • Primary persistent store        • Queue transport
                             • Users, problems, submissions    • Distributed rate limiting
                                                                       │
                                                                       ▼
                                                            BullMQ Submission Queue
                                                           (Payload: { submissionId })
                                                           (Opts: { traceparent })
                                                                       │
                                                 ┌─────────────────────┴─────────────────────┐
                                                 ▼                                           ▼
                                          Worker Process 1                            Worker Process N
                                          (--scale worker=N)                          (--scale worker=N)
                                                 │                                           │
                                                 ▼                                           ▼
                                          ExecutionRuntime                            ExecutionRuntime
                                                 │                                           │
                                         [DockerRuntime Active]                      [DockerRuntime Active]
                                         [gVisor/FC Experimental]                    [gVisor/FC Experimental]
                                                 │                                           │
                                                 ▼                                           ▼
                                          Docker Sandbox Container                    Docker Sandbox Container
                                           (--network none)                            (--network none)

                        ┌─────────────────────────────────────────────────────────────┐
                        │                 Observability Tier                          │
                        │ • Prometheus Metrics (/metrics - Histograms & Bounded Wait) │
                        │ • W3C Trace Context (API ──▶ Job Opts ──▶ Worker Logs)      │
                        │ • Structured JSON Logs (Redacted Secrets & Trace IDs)       │
                        │ • Queue Metrics API (/api/v1/admin/queue-metrics)           │
                        └─────────────────────────────────────────────────────────────┘
```

---

## 3. Horizontal Scaling Strategy

CodeArena is designed for horizontal scaling across both API and worker tiers using standard Docker Compose tooling:

### 1. Backend API Scaling
```bash
docker compose up -d --scale backend=3
```
- **Load Balancing**: The Nginx reverse proxy service listens on port 5000 and forwards requests to `http://backend:5000`.
- **Dynamic Resolution**: Nginx queries Docker's internal DNS (`127.0.0.11`) with a short 5-second TTL (`valid=5s`), allowing newly spawned or destroyed backend replicas to be discovered automatically without restarting Nginx.
- **Failover**: If a replica becomes temporarily unresponsive, `proxy_next_upstream error timeout http_502 http_503 http_504` routes the request to an alternative healthy replica.
- **Statelessness**: All authentication is verified using stateless JWT tokens, and rate limits are tracked globally across replicas in Redis via `rate-limit-redis`.

### 2. Background Worker Scaling
```bash
docker compose up -d --scale worker=3
```
- **Autonomous Consumption**: Workers pull jobs independently from the shared BullMQ queue `submission-execution` hosted on Redis.
- **Concurrency**: Each worker container processes multiple concurrent submissions in parallel governed by `WORKER_CONCURRENCY`.
- **Atomic Claiming**: Submissions transition from `QUEUED` to `RUNNING` via atomic `findOneAndUpdate` queries, preventing race conditions or duplicate claims between worker processes.
- **Heartbeat & Recovery**: Each worker maintains a 5-second heartbeat in Redis. If a worker crashes mid-execution, peer workers automatically reclaim stale submissions after the stale threshold expires.

---

## 4. Production Observability & Telemetry

### 1. Prometheus Metrics (`/metrics`)
- **Endpoint**: `GET /metrics` returning standard Prometheus/OpenMetrics text format.
- **Normalized Route Templates**: Route labels strictly use normalized templates (e.g. `/api/v1/submissions/:id`, `/api/v1/problems/:id`), avoiding dynamic ID label explosion.
- **Low-Cardinality Enforcement**: Metric labels strictly exclude dynamic entity IDs (`userId`, `submissionId`, `requestId`, `workerId`).
- **True Prometheus Histograms**: Exposes `_bucket`, `_sum`, and `_count` for:
  - `codearena_http_request_duration_seconds`
  - `codearena_execution_duration_seconds`
- **Bounded Latency Strategy**: Queue metrics collection is wrapped in a strict 200ms timeout race. If Redis is down, `/metrics` returns in under 500ms with `codearena_queue_metrics_available 0` and omits queue count gauges rather than hanging.

### 2. W3C Trace Context Propagation
- **Standard**: W3C TraceContext Level 1 (`00-${traceId}-${spanId}-${flags}`).
- **Data Contract Preservation**: **The BullMQ business payload contract `{ submissionId }` remains strictly untouched**.
- **Propagation Path**:
  ```text
  HTTP Client (traceparent header)
         ↓
  Express Middleware (extractOrCreateContext -> req.traceContext)
         ↓
  Submission Service (enqueues submission)
         ↓
  BullMQ Queue (passes traceparent inside job.opts.traceparent, NOT job.data)
         ↓
  Submission Worker (reads job.opts.traceparent -> binds to logger metadata)
         ↓
  Execution Engine & Structured Logs
  ```
- **Privacy & Security**: No user source code, passwords, JWTs, or test inputs are logged or exposed in traces.

---

## 5. MongoDB High-Availability & Replica Set Configuration

CodeArena includes built-in support for MongoDB replica set connections:

- **Standalone Mode**: Standard configuration for local Docker Compose development (`mongodb://mongodb:27017/codearena`).
- **Replica Set Mode**: Activated when `replicaSet` is specified in configuration or connection URI:
  - Enables `replicaSet`, `readPreference`, and `retryWrites`.
  - Enforces fail-fast behavior on connection failure without silent fallback to standalone.
- **Managed Clusters**: Seamlessly supports managed MongoDB Atlas connection strings (`mongodb+srv://`) with full connection string option preservation.

---

## 6. Sandbox Runtime Abstraction

The execution engine abstracts sandbox environments via the `ExecutionRuntime` contract:

```text
                    ExecutionRuntime (Interface)
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   DockerRuntime           GVisorRuntime        FirecrackerRuntime
  [Active & Tested]     [Experimental Stub]    [Experimental Stub]
```

- `DockerRuntime`: Active, verified production runtime utilizing disposable Docker containers with `--network none`, read-only root filesystems, `cap-drop ALL`, non-root user execution, and resource caps.
- `GVisorRuntime`: Documented experimental runtime that checks for `runsc` binary availability and rejects execution cleanly if not configured.
- `FirecrackerRuntime`: Documented experimental runtime that checks for host hardware virtualization (`/dev/kvm`) and the Firecracker jailer binary.

---

## 7. Verification & Automated Test Coverage

The Phase 18 advanced infrastructure capabilities are validated through automated regression test suites:

- **Phase 18 Test Suite (`backend/tests/phase18.test.js`)**: 17 tests covering:
  - Route normalization and dynamic ID templating
  - Low-cardinality metric label guarantees
  - True Prometheus histogram metrics format
  - Prompt, bounded `/metrics` response when Redis is unavailable
  - W3C traceparent generation, derivation, and propagation
  - BullMQ business payload contract preservation
  - MongoDB replica-set configuration and fail-fast validation
  - Execution runtime abstraction contract compliance
- **Reliability & Failure Recovery Suite (`backend/tests/failure.test.js`)**: Validating worker crash recovery, stale ownership reclamation, and graceful draining.
- **Docker Compose Configuration Validation**: Validated via `docker compose config`.
