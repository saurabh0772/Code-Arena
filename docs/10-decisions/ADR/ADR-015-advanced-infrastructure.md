# ADR-015: Advanced Infrastructure, Kubernetes Orchestration, Dual-Signal Autoscaling, Network Segmentation, and Production Observability

## Status

Accepted

## Date

2026-09-18

## Context

Following the establishment of the Distributed Execution Architecture (Phase 17) with stateless backend replicas, ephemeral worker registries, and backend Docker socket isolation, CodeArena required evolution into a production-oriented advanced infrastructure architecture (Phase 18).

Deploying a multi-tenant Online Judge platform at scale presents distinct operational challenges:
1. **Heterogeneous Workload Characteristics**: Public HTTP API traffic fluctuates based on user browsing and submission volume (I/O and CPU bound), whereas background code evaluation is heavily compute, memory, and process intensive. Scaling both tiers using the same metric (e.g. CPU) causes either sluggish queue drain or wasteful idle capacity.
2. **Untrusted Code Execution Isolation**: Executing untrusted user code requires strict host-level separation. Shared worker nodes hosting public API endpoints increase attack surfaces if container escape vulnerabilities occur.
3. **Network Boundary Segmentation**: Pods within a cluster must not have unconstrained network communication. Backend APIs require access to MongoDB and Redis, but must be blocked from reaching the Docker daemon or arbitrary external endpoints. Workers require datastore access and container runtime communication, while untrusted code sandboxes must be completely severed from any network stack.
4. **Telemetry & Metric Cardinality**: Exposing metrics for high-throughput online judges risks metric explosion if dynamic entity identifiers (user IDs, submission IDs, request IDs, worker IDs) leak into metric labels. Furthermore, average metrics fail to provide accurate P95/P99 latency percentiles.
5. **Trace Propagation Across Queue Boundaries**: Correlating an end-user submission HTTP request with background worker execution requires standards-compliant context propagation without mutating or coupling business payload data contracts.
6. **Datastore Reliability & Production Realism**: Authoring in-cluster database StatefulSets does not automatically constitute high availability. A clear distinction must be maintained between local standalone instances, demonstration configurations, and managed cloud datastores.

---

## Decision

We establish the **CodeArena Phase 18 Advanced Infrastructure Architecture** according to the following specifications:

### 1. Declarative Kubernetes Orchestration (`k8s/`)
- **Stateless Backend API**: Deployed as an independently scalable `Deployment` with 2+ replicas behind an Ingress controller, configured with non-root security contexts (`runAsNonRoot: true`), `livenessProbe` (`/health`), and `readinessProbe` (`/ready`).
- **Strict Docker Isolation Boundary**: Backend API pods have **ZERO** access to the Docker daemon (`/var/run/docker.sock`). Backend purely validates payloads, persists submission records, and enqueues minimal `{ submissionId }` jobs to BullMQ.
- **Dedicated Worker Tier**: Workers run as decoupled daemons mounting `/var/run/docker.sock` and execution workspaces using the unified `codearena-backend` image. This capability is explicitly designated as **security-sensitive**. In production, worker pods target dedicated execution node pools via `requiredDuringSchedulingIgnoredDuringExecution` and tolerations (`dedicated=codearena-worker:NoSchedule`).
- **Kustomize Organization**: Clean base and overlay structure:
  - `k8s/base/`: Common declarative manifests. Does NOT include `secrets.example.yaml` in its resources list.
  - `k8s/overlays/local/`: Local development settings, non-sensitive demonstration secrets, and demonstration StatefulSets.
  - `k8s/overlays/production/`: Production resource requests/limits, replicas, managed datastore endpoints, External Secrets Operator synchronization references, and required node affinity.

### 2. Dual-Signal Autoscaling Strategy
- **Backend API (CPU & Memory)**: Managed by the Kubernetes Horizontal Pod Autoscaler (`HPA`), targeting 70% CPU and 80% Memory utilization to absorb incoming HTTP surges.
- **Worker Tier (Queue Backlog Depth)**: Managed by KEDA (`ScaledObject`) monitoring the BullMQ v6 Redis wait list: `bull:submission-execution:wait`. Scales worker pods up to 10 replicas when pending jobs exceed 5 per replica. Worker autoscaling is driven primarily by queue backlog, not CPU.

### 3. Network Segmentation & Least-Privilege Policies (`NetworkPolicy`)
- **Default Deny All**: Enforces zero unapproved ingress and egress across the `codearena` namespace.
- **CoreDNS Egress**: Explicitly permits egress on **UDP and TCP port 53** to `kube-system` to ensure in-cluster service discovery remains functional.
- **Tier Isolation & Ingress Selectors**:
  - Frontend: Accepts Ingress Controller traffic; egresses only to Backend API and DNS.
  - Backend: Accepts Frontend/Ingress traffic via explicit `from:` selectors (no open unauthenticated ports); egresses to MongoDB, Redis, and DNS. External outbound internet and Docker daemon access are blocked.
  - Worker: Zero ingress; egresses only to MongoDB, Redis, and DNS.
  - Production Datastores: Egress to managed datastores is restricted to designated private cloud CIDRs (MongoDB Atlas VPC Peering `10.100.0.0/16` port 27017, AWS ElastiCache subnet `10.200.0.0/16` port 6379) without unrestricted `0.0.0.0/0`.
  - Sandboxes: Run strictly with `--network none` in the container runtime.

### 4. Datastore Strategy: Four Deployment Models
- **Local**: Docker Compose (`docker-compose.yml`) with standalone MongoDB 7.0, Redis 7.2, and `DockerRuntime`.
- **Advanced Local / Demonstration**: Kubernetes local overlay (`k8s/overlays/local/`), in-cluster MongoDB StatefulSet, Redis Sentinel high-availability demonstration (`REDIS_SENTINEL_HOSTS`), KEDA, and Prometheus/Grafana.
- **Production-Oriented Recommendation**: Managed MongoDB (MongoDB Atlas with `mongodb+srv://`), Managed Redis (AWS ElastiCache / Redis Cloud), External Secrets Operator, Kubernetes with dedicated worker nodes, HPA, KEDA, and NetworkPolicies with private CIDRs.
- **Experimental**: `GVisorRuntime` (`runsc`) and `FirecrackerRuntime` (microVM jailer) as documented capability interfaces.

### 5. Production Observability & W3C Trace Context Propagation
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

### 6. Sandbox Runtime Abstraction
- Introduces the `ExecutionRuntime` base interface:
  - `DockerRuntime`: Active, verified container sandbox implementation.
  - `GVisorRuntime` & `FirecrackerRuntime`: Documented experimental runtime options with honest capability checks that reject execution if the underlying microVM or gVisor binary is absent.

### 7. Six-Tier Verification Taxonomy
To maintain integrity in portfolio reporting, verification results are strictly classified:
1. **Level 1: YAML Syntax Parsing**
2. **Level 2: Kustomize Rendering**
3. **Level 3: Kubernetes API Schema Validation**
4. **Level 4: Custom Resource Definition (CRD) Validation**
5. **Level 5: Live Cluster Verification**
6. **Level 6: Live Autoscaling Verification**
- **Architecture Invariants**: Evaluated as an independent category covering Docker isolation, non-root security context, dedicated worker node affinity, HPA/KEDA triggers, NetworkPolicies, histogram metrics, and low-cardinality constraints.

---

## Consequences

### Positive
- CodeArena achieves a clear, production-oriented infrastructure blueprint with declarative Kubernetes configurations.
- Dual-signal autoscaling aligns scaling triggers with actual workload dynamics (HTTP traffic vs queue depth).
- NetworkPolicies and node pool isolation significantly restrict attack vectors and blast radiuses.
- True Prometheus histograms and W3C trace correlation provide production observability without high-cardinality metric bloat.
- The business payload contract `{ submissionId }` remains strictly preserved and backward-compatible.
- The `/metrics` endpoint is resilient against Redis outages, returning bounded responses in under 500ms.

### Neutral / Trade-offs
- KEDA and ServiceMonitor resources require custom controllers (CRDs) installed in a production cluster.
- Worker Docker socket access requires dedicated execution node pools to mitigate container breakout risks.
