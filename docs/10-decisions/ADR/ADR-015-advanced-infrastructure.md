# ADR-015: Advanced Infrastructure, Docker Horizontal Scaling, Nginx Reverse Proxy Load Balancing, and Production Observability

## Status

Accepted

## Date

2026-09-18

## Context

Following the establishment of the Distributed Execution Architecture (Phase 17) with stateless backend replicas, ephemeral worker registries, and backend Docker socket isolation, CodeArena required evolution into a production-oriented advanced infrastructure architecture (Phase 18).

Deploying a multi-tenant Online Judge platform at scale presents distinct operational challenges:
1. **Heterogeneous Workload Characteristics**: Public HTTP API traffic fluctuates based on user browsing and submission volume (I/O and CPU bound), whereas background code evaluation is heavily compute, memory, and process intensive. Scaling both tiers independently allows optimal resource utilization.
2. **Untrusted Code Execution Isolation**: Executing untrusted user code requires strict host-level separation. Backend API instances must have zero access to the container engine, while workers require isolated container execution capabilities.
3. **Telemetry & Metric Cardinality**: Exposing metrics for high-throughput online judges risks metric explosion if dynamic entity identifiers (user IDs, submission IDs, request IDs, worker IDs) leak into metric labels. Furthermore, average metrics fail to provide accurate P95/P99 latency percentiles.
4. **Trace Propagation Across Queue Boundaries**: Correlating an end-user submission HTTP request with background worker execution requires standards-compliant context propagation without mutating or coupling business payload data contracts.
5. **Datastore Reliability & High Availability**: A clear distinction must be maintained between local standalone instances and managed cloud datastores or replica sets.

---

## Decision

We establish the **CodeArena Phase 18 Advanced Infrastructure Architecture** based on Docker Compose, Nginx, Redis, BullMQ, and independent worker processes according to the following specifications:

### 1. Horizontally Scalable Docker Architecture
- **Stateless Backend API**: Express.js API instances run statelessly and can be scaled horizontally via `docker compose up -d --scale backend=N`.
- **Strict Docker Isolation Boundary**: Backend API containers have **ZERO** access to the Docker daemon (`/var/run/docker.sock`). Backend purely validates payloads, persists submission records in MongoDB, and enqueues minimal `{ submissionId }` jobs to BullMQ.
- **Dedicated Worker Tier**: Workers run as decoupled daemons mounting `/var/run/docker.sock` and execution workspaces using the unified `codearena-backend` image. This capability is explicitly designated as **security-sensitive** and isolated exclusively to worker containers. Workers scale horizontally via `docker compose up -d --scale worker=N`.

### 2. Nginx Reverse Proxy & Load Balancer
- **Dynamic Upstream Resolution**: Nginx routes incoming traffic to `http://backend:5000` using Docker's internal DNS (`resolver 127.0.0.11 valid=5s`), dynamically discovering scaled backend replicas without requiring service restarts.
- **Health-Aware Failover**: Configured with `proxy_next_upstream error timeout http_502 http_503 http_504` to transparently route around failing or restarting backend replicas.
- **Request ID Propagation**: Nginx forwards correlation IDs (`X-Request-Id`) across backend instances.

### 3. Production Observability & W3C Trace Context Propagation
- **Low-Cardinality Prometheus Histograms (`/metrics`)**:
  - Exposes request and execution latency using true Prometheus histograms (`_bucket`, `_sum`, `_count`).
  - Route labels strictly use normalized route templates (e.g. `/api/v1/problems/:id`), never raw paths with dynamic IDs.
  - Metric labels strictly exclude `userId`, `submissionId`, `requestId`, and `workerId`.
  - Queue metrics collection is guarded by a 200ms timeout race. If Redis is down, `/metrics` returns in under 500ms with `codearena_queue_metrics_available 0` and omits queue count gauges rather than hanging.
- **W3C Trace Context (`traceparent`)**:
  - Implements W3C Trace Context (Level 1) format: `00-${traceId}-${spanId}-${flags}`.
  - Preserves the BullMQ business payload contract strictly as `{ submissionId }` in `job.data`.
  - Propagates trace context through BullMQ job options (`job.opts.traceparent`) outside the business payload.
  - Workers restore trace context into structured logger metadata.

### 4. Datastore Strategy & MongoDB Replica Sets
- **Local Development**: Docker Compose with standalone MongoDB 7.0 and Redis 7.2.
- **High-Availability Configuration**: Supports explicit MongoDB replica sets (`replicaSet`, `readPreference`, `retryWrites`) with fail-fast validation on connection errors without silent downgrade to standalone.
- **Managed Datastores**: Compatible with managed cloud instances such as MongoDB Atlas and AWS ElastiCache.

### 5. Sandbox Runtime Abstraction
- Introduces the `ExecutionRuntime` base interface:
  - `DockerRuntime`: Active, verified container sandbox implementation.
  - `GVisorRuntime` & `FirecrackerRuntime`: Documented experimental runtime options with honest capability checks that reject execution if the underlying microVM or gVisor binary is absent.

---

## Consequences

### Positive
- CodeArena achieves a clear, production-oriented infrastructure blueprint using battle-tested Docker and Docker Compose orchestration without unnecessary operational complexity.
- Horizontal scaling allows independent scaling of compute-heavy workers and I/O-heavy API instances.
- Docker socket isolation completely protects the public API tier from container runtime attack vectors.
- True Prometheus histograms and W3C trace correlation provide production observability without high-cardinality metric bloat.
- The business payload contract `{ submissionId }` remains strictly preserved and backward-compatible.
- The `/metrics` endpoint is resilient against Redis outages, returning bounded responses in under 500ms.

### Neutral / Trade-offs
- Worker Docker socket access requires trusted host runners to mitigate container breakout risks.
- Scaling operations are coordinated through Docker Compose CLI (`--scale backend=N`, `--scale worker=N`).
