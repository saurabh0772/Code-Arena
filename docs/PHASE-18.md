# Phase 18 — Advanced Infrastructure

## 1. Title & Executive Summary

Phase 18 represents the **Final Roadmap Phase** for CodeArena: establishing a **production-oriented advanced infrastructure architecture with documented deployment boundaries**.

Building upon the distributed worker architecture of Phase 17, Phase 18 introduces declarative container orchestration, dual-signal autoscaling, least-privilege network policies, production telemetry, and runtime abstractions without compromising the stability of earlier phases.

### Core Architectural Pillars
1. **Declarative Kubernetes Architecture (`k8s/`)**: Kustomize-based manifests separating base resources (`k8s/base/`) from environment overlays (`k8s/overlays/local/`, `k8s/overlays/production/`).
2. **Stateless API Invariant & Zero Docker Access**: Backend API pods remain strictly stateless with non-root security contexts (`runAsNonRoot: true`), liveness probes (`/health`), readiness probes (`/ready`), and **zero Docker socket access**.
3. **Dedicated Worker Tier & Security-Sensitive Capability**: Distributed worker pods consume from BullMQ and mount `/var/run/docker.sock` to execute sandboxes. This capability is explicitly designated as **security-sensitive**, isolated to dedicated worker node pools in production via `requiredDuringSchedulingIgnoredDuringExecution` and tolerations (`dedicated=codearena-worker:NoSchedule`).
4. **Dual-Signal Autoscaling**:
   - **Backend API**: Scaled via Horizontal Pod Autoscaler (`HPA`) monitoring CPU (70%) and Memory (80%) utilization.
   - **Worker Tier**: Scaled via KEDA (`ScaledObject`) monitoring BullMQ v6 queue backlog depth on `bull:submission-execution:wait` (5 jobs/replica).
5. **Network Segmentation & Least-Privilege Policies**: Least-privilege `NetworkPolicy` resources with default-deny rules and explicit CoreDNS (`UDP/TCP 53`) egress. Backend ingress is restricted strictly to Frontend pods and Ingress Controller. In production, egress to managed datastores is restricted to designated private cloud CIDRs without unrestricted `0.0.0.0/0`.
6. **Production Observability**: Prometheus metrics (`GET /metrics`) with normalized route templates, true latency histograms (`_bucket`, `_sum`, `_count`), bounded non-blocking execution (<500ms even when Redis is down), and zero high-cardinality labels, paired with a curated Grafana dashboard calculating P95/P99 latency.
7. **W3C Trace Context Propagation**: Propagates RFC-standard `traceparent` context across HTTP → Queue → Worker → Execution without modifying the BullMQ business payload contract `{ submissionId }`.
8. **Sandbox Runtime Abstraction**: Introduces the `ExecutionRuntime` contract, keeping `DockerRuntime` active and tested while establishing documented experimental interfaces for `GVisorRuntime` and `FirecrackerRuntime`.
9. **Datastore Strategy**: Authoritatively establishes Managed MongoDB (Atlas) and Managed Redis (ElastiCache) as the production path, while preserving standalone instances for Docker Compose local development and demonstrating K8s StatefulSet/Sentinel configurations.

---

## 2. Production Topology & Component Architecture

```text
                                  Internet / Clients
                                          │
                                          ▼
                             Ingress Controller / TLS
                                          │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                     Frontend SPA                 Backend API Pods
                     (Nginx Pods)             (HPA: CPU / Memory Scaled)
                                                        │
                                         ┌──────────────┴──────────────┐
                                         ▼                             ▼
                             MongoDB Database                  Redis Message Broker
                             • Local: Standalone               • Local: Standalone
                             • Prod: Managed Atlas             • Prod: Managed ElastiCache
                             • Demo: K8s ReplicaSet            • Demo: Redis Sentinel
                                                                       │
                                                                       ▼
                                                            BullMQ Submission Queue
                                                           (Payload: { submissionId })
                                                           (Opts: { traceparent })
                                                                       │
                                                 ┌─────────────────────┴─────────────────────┐
                                                 │ KEDA Queue-Backlog Autoscaler             │
                                                 │ (Targets bull:submission-execution:wait)  │
                                                 ▼                                           ▼
                                         Worker Pod 1                                Worker Pod N
                                  (Dedicated Node Pool)                       (Dedicated Node Pool)
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
                        │ • Grafana Dashboard (P95/P99 Histograms, Queue Depth)       │
                        │ • Structured JSON Logs (Redacted Secrets & Trace IDs)       │
                        └─────────────────────────────────────────────────────────────┘
```

---

## 3. Four Deployment Models

To maintain technical accuracy on a portfolio project, infrastructure components are classified into four clear tiers:

| Tier | Meaning | CodeArena Subsystems |
|---|---|---|
| **Local** | Canonical, everyday developer environment running via Docker Compose | Docker Compose (`docker-compose.yml`), Standalone MongoDB 7.0, Standalone Redis 7.2, `DockerRuntime` sandbox execution, local HTTP API, local worker daemons. |
| **Advanced Local / Demonstration** | Advanced container orchestration demonstrated locally or in test clusters | Kubernetes local overlay (`k8s/overlays/local/`), in-cluster MongoDB StatefulSet, Redis Sentinel high-availability demonstration (`REDIS_SENTINEL_HOSTS`), KEDA autoscaler manifests, Prometheus Operator ServiceMonitor, Grafana dashboard. |
| **Production-Oriented Recommendation** | Documented enterprise production architecture with operational boundaries | Managed MongoDB Atlas (`mongodb+srv://`), Managed Redis (AWS ElastiCache / Redis Cloud), External Secrets Operator (AWS Secrets Manager / Vault), dedicated execution worker nodes with `requiredDuringSchedulingIgnoredDuringExecution`, HPA, KEDA, NetworkPolicies with private CIDRs, Prometheus histogram metrics. |
| **Experimental** | Documented interfaces and architectural stubs; not claimed as production-ready | `GVisorRuntime` (`runsc`), `FirecrackerRuntime` (microVM jailer). Stubs perform honest capability checks and reject execution safely when host virtualization is absent. |

---

## 4. Kubernetes Manifest Structure & Kustomize Layout

CodeArena organizes Kubernetes resources cleanly without duplication:

```text
k8s/
├── base/
│   ├── namespace.yaml          # codearena namespace with baseline pod security labels
│   ├── configmap.yaml          # Baseline environment configuration
│   ├── secrets.example.yaml    # Secret template ONLY (excluded from base kustomization)
│   ├── backend.yaml            # Stateless Backend API Deployment (Non-root, zero Docker access)
│   ├── worker.yaml             # Autonomous Worker Deployment (codearena-backend image, Docker socket)
│   ├── frontend.yaml           # React SPA Nginx Deployment
│   ├── services.yaml           # Internal ClusterIP services for backend (5000) and frontend (80)
│   ├── ingress.yaml            # Ingress with path-based routing (/api/, /health, /ready, /metrics)
│   ├── hpa.yaml                # Backend Horizontal Pod Autoscaler (CPU 70%, Memory 80%)
│   ├── keda-worker-scaler.yaml # Worker KEDA ScaledObject based on BullMQ backlog
│   ├── network-policy.yaml     # Least-privilege network segmentation with CoreDNS UDP/TCP 53
│   └── kustomization.yaml      # Base Kustomization bundle (renders WITHOUT placeholder secrets)
├── overlays/
│   ├── local/
│   │   ├── kustomization.yaml  # Local overlays for Minikube / Kind testing
│   │   ├── local-datastores.yaml # Local demonstration MongoDB and Redis StatefulSets
│   │   └── local-secrets.yaml  # Non-sensitive local demonstration secrets
│   └── production/
│       ├── kustomization.yaml  # Production overlay wiring patches and external secrets
│       ├── patch-resources.yaml# Production resource requests/limits (3 replicas)
│       ├── patch-worker-affinity.yaml # Required worker node isolation (requiredDuringScheduling)
│       ├── patch-configmap.yaml# Managed Redis endpoint & production CORS origin
│       ├── patch-production-network-policy.yaml # Least-privilege managed datastore CIDRs (10.100.0.0/16, 10.200.0.0/16)
│       ├── patch-ingress.yaml  # Production TLS Ingress with cert-manager
│       └── external-secrets.yaml # External Secrets Operator (ESO) reference
└── observability/
    ├── servicemonitor.yaml     # Prometheus Operator ServiceMonitor for /metrics
    └── grafana-dashboard.json  # Grafana dashboard with P95/P99 histogram_quantile queries
```

---

## 5. Dual-Signal Autoscaling: API vs. Worker Tier

### 1. Backend API Autoscaler (`k8s/base/hpa.yaml`)
- Scaling Signal: **CPU & Memory Utilization**.
- Targets: Average CPU 70%, Average Memory 80%.
- Min Replicas: 2, Max Replicas: 10.
- Rationale: HTTP API workloads are bound by I/O, parsing, and database transactions. Spikes in concurrent requests are accurately reflected in pod resource consumption.

### 2. Background Worker Autoscaler (`k8s/base/keda-worker-scaler.yaml`)
- Scaling Signal: **BullMQ Queue Backlog Depth**.
- Pinned BullMQ Key: `bull:submission-execution:wait` (pinned to BullMQ v6 default prefix `bull` and queue name `submission-execution`).
- Trigger: KEDA `redis` list scaler measuring `LLEN`.
- Target: 5 pending jobs per worker replica.
- Min Replicas: 2, Max Replicas: 10.
- Rationale: Workers process sandboxes one job at a time per concurrency slot. A sudden queue surge of 50 submissions requires instant horizontal scaling before worker CPU spikes.

---

## 6. Network Segmentation & Least-Privilege Policies

Kubernetes `NetworkPolicy` resources enforce defense-in-depth isolation:
1. **Default Deny All**: All pod ingress and egress traffic is denied across the `codearena` namespace by default.
2. **CoreDNS Egress Allowance**: Explicitly allows egress to `kube-system` on **UDP and TCP port 53** so that in-cluster name resolution continues to function.
3. **Backend API**: Ingress permitted strictly from Frontend pods and Ingress Controller on port 5000 (no open unauthenticated ports without `from:`); egress permitted strictly to MongoDB, Redis, and CoreDNS. Egress to the external internet or Docker daemon is strictly blocked.
4. **Worker Daemon**: Ingress is blocked completely (workers are purely outbound consumers); egress is restricted to MongoDB, Redis, and CoreDNS.
5. **Production Overlay Datastore Networking**: In production, backend and worker egress to datastores targets approved private cloud CIDRs (MongoDB Atlas VPC Peering `10.100.0.0/16` port 27017, AWS ElastiCache subnet `10.200.0.0/16` port 6379) rather than in-cluster pod labels. Unrestricted `0.0.0.0/0` is strictly prohibited.
6. **Execution Sandboxes**: Ephemeral containers run with Docker runtime `--network none`, completely severed from any network stack.

---

## 7. Production Observability & Telemetry

### 1. Prometheus Metrics (`/metrics`)
- Endpoint: `GET /metrics` returning standard Prometheus/OpenMetrics text format.
- Normalized Route Templates: Route labels strictly use normalized templates (e.g. `/api/v1/submissions/:id`, `/api/v1/problems/:id`), avoiding dynamic ID label explosion.
- Low-Cardinality Enforcement: Metric labels strictly exclude `userId`, `submissionId`, `requestId`, and `workerId`.
- True Prometheus Histograms: Exposes `_bucket`, `_sum`, and `_count` for:
  - `codearena_http_request_duration_seconds`
  - `codearena_execution_duration_seconds`
- Bounded Latency Strategy: Queue metrics collection is wrapped in a strict 200ms timeout race. If Redis is down, `/metrics` returns in under 500ms with `codearena_queue_metrics_available 0` and omits queue count gauges rather than hanging.

### 2. Grafana Dashboard (`k8s/observability/grafana-dashboard.json`)
- Uses `histogram_quantile(0.95, sum(rate(codearena_http_request_duration_seconds_bucket[1m])) by (le, method, route))` for true P95/P99 latency calculations.
- Visualizes BullMQ queue depth, worker fleet count, failure rates, and execution latency by language.

### 3. W3C Trace Context Propagation
- Standard: W3C TraceContext Level 1 (`00-${traceId}-${spanId}-${flags}`).
- Invariant: **The BullMQ business payload contract `{ submissionId }` remains strictly untouched**.
- Propagation Path:
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
- Privacy: No user source code, passwords, JWTs, or test inputs are logged or exposed in traces.

---

## 8. Sandbox Runtime Abstraction

The execution engine abstracts sandbox environments via `ExecutionRuntime`:

```text
                    ExecutionRuntime (Interface)
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   DockerRuntime           GVisorRuntime        FirecrackerRuntime
  [Active & Tested]     [Experimental Stub]    [Experimental Stub]
```

- `DockerRuntime`: Active, verified production runtime utilizing disposable Docker containers with `--network none`, read-only root filesystems, `cap-drop ALL`, and resource caps.
- `GVisorRuntime`: Documented experimental runtime that checks for `runsc` binary availability and rejects execution cleanly if not configured.
- `FirecrackerRuntime`: Documented experimental runtime that checks for host hardware virtualization (`/dev/kvm`) and the Firecracker jailer binary.

---

## 9. Six-Tier Verification Results

To maintain integrity in portfolio reporting, verification results are strictly separated into six validation tiers and an independent architecture invariants check:

| Level | Meaning | Status | Evidence / Reason |
|---|---|---|---|
| **Level 1** | YAML Syntax Parsing | **VERIFIED** | 23 YAML manifests parsed with zero syntax errors using `yaml` parser. |
| **Level 2** | Kustomize Rendering | **NOT VERIFIED** | `kubectl` / `kustomize` CLI binary is not installed on host environment. |
| **Level 3** | Kubernetes API Schema Validation | **NOT VERIFIED** | Schema validator (`kubeconform`/`kubeval`) or live Kubernetes API server unavailable in host environment. |
| **Level 4** | CRD Specification Validation | **NOT VERIFIED** | KEDA `ScaledObject` and Prometheus `ServiceMonitor` CRD schemas unavailable in host environment. |
| **Level 5** | Live Cluster Verification | **NOT RUN** | No active Kubernetes cluster accessible in host environment. |
| **Level 6** | Live Autoscaling Verification | **NOT RUN** | Requires active cluster with KEDA operator, metrics-server, and automated load generator. |

### Architecture / Invariant Checks (Independent Section)
- **Status: PASSED**
- Evidence:
  1. Backend Docker Isolation: PASSED (ZERO Docker daemon access in backend deployment)
  2. Backend Security Context: PASSED (`runAsNonRoot: true`, `allowPrivilegeEscalation: false`)
  3. Worker Execution Capability: PASSED (Docker socket mounted on isolated worker)
  4. Worker Bounded Drain: PASSED (30s termination grace period)
  5. Worker Image Consistency: PASSED (uses `codearena-backend:latest`)
  6. Production Worker Node Isolation: PASSED (`requiredDuringSchedulingIgnoredDuringExecution` on `dedicated=codearena-worker`)
  7. Base Secrets Exclusion: PASSED (`secrets.example.yaml` excluded from base kustomization resources)
  8. Production Datastore Configuration: PASSED (references managed Redis endpoint)
  9. Production Network Isolation: PASSED (least-privilege managed CIDRs `10.100.0.0/16` and `10.200.0.0/16`, zero `0.0.0.0/0` datastore egress)
  10. NetworkPolicy Ingress Selectors: PASSED (backend ingress restricted with `from:` selectors)
  11. HPA Utilization Targets: PASSED (CPU 70%, Memory 80%)
  12. KEDA Scaler Contract: PASSED (pinned BullMQ v6 key `bull:submission-execution:wait`, target: 5)
  13. Prometheus High-Cardinality Protection: PASSED (zero forbidden labels `userId`, `submissionId`, `requestId`, `workerId`)
  14. Prometheus Histogram Format: PASSED (proper `_bucket`, `_sum`, `_count` exposed)
  15. Prometheus Bounded Latency: PASSED (<500ms response with `codearena_queue_metrics_available 0` when Redis is down)
  16. W3C Trace Context Propagation: PASSED (traceId preserved across child span handoff)
  17. BullMQ Contract Preservation: PASSED (`job.data` strictly `{ submissionId }`, traceparent passed via `job.opts.traceparent`)
  18. MongoDB Fail-Fast Configuration: PASSED (explicit replicaSet mode fails fast without silent downgrade)

---

## 10. Canonical Local Environment & Roadmap Status

- **Canonical Local Stack**: Docker Compose (`docker-compose.yml`) remains the canonical, fully supported local development stack.
- **Roadmap Complete**: Phase 18 completes the canonical 18-phase CodeArena roadmap. There is no Phase 19.
