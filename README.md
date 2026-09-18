# CodeArena

> **Distributed Online Judge & Secure Code Execution Platform**

CodeArena is a production-grade, secure online judge platform designed as a high-performance **Modular Monolith**. It provides asynchronous code evaluation for **C++ (C++17)**, **Python 3**, and **JavaScript (Node.js)** inside isolated, disposable Docker sandboxes, orchestrated through a Redis-backed BullMQ job queue and an autonomous worker daemon.

---

## Roadmap & Current Status

### Canonical Architecture Roadmap

| Phase | Module / Focus | Status |
|---|---|---|
| **Phase 1** | Repository & Backend Foundation | **COMPLETE** |
| **Phase 2** | Backend Core & Database (MongoDB + Mongoose) | **COMPLETE** |
| **Phase 3** | Authentication & RBAC (JWT, Argon2, Role Guards) | **COMPLETE** |
| **Phase 4** | Problem Module (CRUD, Public Slugs & Filtering) | **COMPLETE** |
| **Phase 5** | Test Case Module (Public & Hidden Test Isolation) | **COMPLETE** |
| **Phase 6** | Submission Module (Persisted State Lifecycle & History) | **COMPLETE** |
| **Phase 7** | Execution Engine (C++, Python 3, Node.js Docker Runners) | **COMPLETE** |
| **Phase 8** | Connect Everything (End-to-End Online Judge Flow) | **COMPLETE** |
| **Phase 9** | Frontend SPA (React 18, Vite, Tailwind CSS, Monaco Editor) | **COMPLETE** |
| **Phase 10** | Testing + Deployment (Docker Compose & Security Verification) | **COMPLETE** |
| **Phase 11** | Production Hardening, Observability & Admin Governance | **COMPLETE** |
| **Phase 12** | Asynchronous Submission Processing (Queue, Worker, Polling) | **COMPLETE** |
| **Phase 13** | Redis + Queue Foundation (Centralized Client, Minimal Payload, Metrics) | **COMPLETE** |
| **Phase 14** | Worker Architecture (Autonomous Daemon, Lifecycle, State Machine Safety) | **COMPLETE** |
| **Phase 15** | Multiple Workers / Concurrency | **COMPLETE** |
| **Phase 16** | Horizontal Scaling | **COMPLETE** |
| **Phase 17** | Distributed Execution Architecture | **COMPLETE** |
| **Phase 18** | Advanced Infrastructure | **IMPLEMENTED & TESTED LOCALLY** |

---

## Architecture Overview

CodeArena enforces strict separation between trusted API infrastructure, asynchronous job scheduling, worker execution runtimes, and disposable untrusted sandbox containers:

```text
[ React 18 Frontend SPA (Port 5173 / Nginx) ]
                    ↓  HTTP / REST
[ Express.js Modular Monolith Backend (Port 5000) ]
        ├── Request ID Middleware (X-Request-Id Correlation)
        ├── Structured JSON Logging (Redacted Secrets & Source Code)
        ├── Auth & RBAC (JWT + Argon2)
        ├── Problems & Test Cases (Public / Hidden Isolation & Readiness Guard)
        ├── Submissions Service (Fast 201 Response, Status: QUEUED)
        ├── Admin Audit Logs & Queue Metrics API (/api/v1/admin/queue-metrics)
        ├── OpenAPI 3.0.3 Specification & Swagger UI (/api/v1/docs)
        └── Liveness (/health) & Deep Dependency Readiness (/ready) Probes
                    ↓  BullMQ Job Queue ({ submissionId })
[ Redis 7.2 Transport ]
                    ↓  Job Consumer (submission-execution)
[ Autonomous Worker Daemon (submission.worker.js) ]
        ├── Fail-Fast Initialization (MongoDB & Redis Readiness Probes)
        ├── Defensive Payload Validation (ObjectId Format Integrity)
        ├── Atomic State Claiming (QUEUED ──▶ RUNNING via findOneAndUpdate)
        ├── Clear Verdict (COMPLETED) vs. Infrastructure (Retry) Separation
        └── Idempotent Graceful Shutdown (Active Job Drainage & 10s Timeout)
                    ↓  Direct Module Boundary
[ Execution Engine Module Boundary ]
        ├── Language Resolvers (C++17, Python 3.11, Node.js 20)
        ├── Scoped DooD Shared Workspaces (/tmp/codearena-workspaces)
        └── Docker Sandbox Runner
                    ↓  Docker Daemon Socket (/var/run/docker.sock)
[ Disposable Sandbox Containers (codearena-sandbox:v1) ]
        ├── --network none (Zero network access, syscalls fail immediately)
        ├── --user 1000:1000 (Non-root user execution)
        ├── --memory 256m --memory-swap 256m (Strict memory ceilings)
        ├── --pids-limit 64 (Fork bomb containment)
        ├── --read-only root filesystem + ephemeral tmpfs (/tmp)
        └── --cap-drop ALL + no-new-privileges
```

---

## Core System Invariants

### 1. Minimal Payload Invariant (Redis Security)
- Redis job payloads strictly contain only `{ submissionId }` (~50 bytes).
- Source code, problem statements, test cases, and credentials are **never** serialized into Redis.
- The worker hydrates execution data directly from MongoDB, preserving MongoDB as the single authoritative source of truth.

### 2. State Machine Safety & Concurrent Claim Prevention
- Submissions transition from `QUEUED` to `RUNNING` using an atomic MongoDB operation:
  ```javascript
  Submission.findOneAndUpdate(
    { _id: submissionId, status: 'QUEUED' },
    { $set: { status: 'RUNNING', startedAt: new Date() } },
    { new: true }
  );
  ```
- This prevents concurrent workers or parallel worker threads from claiming the same submission.
- Non-existent, already running, completed, or failed submissions are safely skipped without re-execution.

### 3. Verdict vs. Infrastructure Separation
- **Code Evaluation Verdicts**: User code verdicts (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `COMPILATION_ERROR`, `RUNTIME_ERROR`) mark the submission as `status: 'COMPLETED'` and resolve cleanly in BullMQ. BullMQ **never retries** completed verdicts.
- **Infrastructure Failures**: If an underlying engine or Docker error occurs, the worker checks remaining retry attempts (`attemptsMade + 1 < maxAttempts`). If retries remain, MongoDB status reverts to `QUEUED` for exponential backoff retries; if exhausted, the record transitions to `FAILED`.

### 4. Process Decoupling
- The **API Server** (`server.js`) strictly serves HTTP traffic, manages authentication, and enqueues jobs. It never executes user code.
- The **Worker Daemon** (`submission.worker.js`) strictly pulls jobs from Redis and coordinates sandbox executions. It never mounts Express or binds HTTP ports.

---

## Getting Started

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/) (v24+) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (v20+ LTS)
- [MongoDB](https://www.mongodb.com/) (v7.0+ if running locally outside Docker)
- [Redis](https://redis.io/) (v7.0+ if running locally outside Docker)

---

### 1. Build the Sandbox Image (Required Once)

The execution engine runs all untrusted user code inside the hardened, unprivileged `codearena-sandbox:v1` image. Build this template image prior to launching sandboxes:

```bash
# Using the root convenience script:
npm run docker:build-sandbox

# Or directly via Docker:
docker build -t codearena-sandbox:v1 -f execution-engine/Dockerfile.sandbox execution-engine
```

---

### 2. Configure Environment & Launch Stack

1. **Initialize configuration from template**:
   ```bash
   cp .env.example .env
   ```
   Ensure a secure `JWT_SECRET` (at least 32 characters) is configured in `.env`.

2. **Start the complete platform via Docker Compose**:
   ```bash
   docker compose up -d
   ```

3. **Verify running containers**:
   ```bash
   docker compose ps
   ```

### Service Map & Endpoints

| Service | Endpoint | Description |
|---|---|---|
| **Frontend Application** | [http://localhost:5173](http://localhost:5173) | React 18 SPA (Nginx) |
| **Backend API** | [http://localhost:5000](http://localhost:5000) | Express.js API |
| **Interactive API Docs** | [http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs) | Swagger UI (OpenAPI 3.0.3) |
| **OpenAPI Spec JSON** | [http://localhost:5000/api/v1/docs/json](http://localhost:5000/api/v1/docs/json) | OpenAPI Raw JSON |
| **Liveness Probe** | [http://localhost:5000/health](http://localhost:5000/health) | HTTP 200 Health Check |
| **Deep Readiness Probe** | [http://localhost:5000/ready](http://localhost:5000/ready) | DB, Redis & Docker Engine Status |
| **Admin Queue Metrics** | [http://localhost:5000/api/v1/admin/queue-metrics](http://localhost:5000/api/v1/admin/queue-metrics) | RBAC-guarded BullMQ metrics |
| **Worker Daemon** | Autonomous background process | BullMQ consumer (no HTTP port) |
| **Redis Server** | `redis:6379` (Host: `localhost:6380`) | Queue & caching transport |
| **MongoDB Database** | `mongodb://localhost:27017/codearena` | Primary data store |

---

## Development Seeding & Demo Dataset

To seed deterministic development users, programming problems, and comprehensive test cases into MongoDB:

```bash
# Seed development users, 12 problems, and 72 test cases (idempotent):
npm run seed
# or within backend:
npm run seed --prefix backend
```

### Development Credentials

- **Standard User**: `user@codearena.dev` / `User@12345` (Role: `USER`)
- **System Administrator**: `admin@codearena.dev` / `Admin@12345` (Role: `ADMIN`)

### Seeded Problem & Test Case Dataset

- **12 Curated Problems**:
  - **4 EASY**: "Sum of Two Numbers", "Maximum Element in an Array", "Count Even Numbers", "Reverse a String"
  - **4 MEDIUM**: "Valid Parentheses", "Two Sum", "Merge Sorted Arrays", "Binary Search"
  - **4 HARD**: "Longest Increasing Subsequence Length", "Trapping Rain Water", "Median of Two Sorted Arrays", "Word Search"
- **72 Test Cases**: Exactly 6 test cases per problem (2 `PUBLIC` for sample inputs/outputs + 4 `HIDDEN` for evaluation).

### Problem Readiness Guard
- Problems with zero active test cases reject submissions immediately with HTTP `422 Unprocessable Entity` (`errorCode: "PROBLEM_NOT_READY"`).
- Inactive test cases (`isActive: false`) are excluded from total evaluation counts.
- `ACCEPTED` verdicts strictly require `totalTests > 0` and `testsPassed === totalTests`.

---

## Automated Test Suites

All test suites are automated and fully passing across the codebase:

### 1. Execution Engine Test Suite (43 tests)
Verifies multi-language compilation, timeouts, memory ceilings, PID limits, network blocking, and filesystem restrictions:
```bash
cd execution-engine && npm test
```

### 2. Backend Test Suite (211 tests across 63 suites)
Verifies authentication, RBAC, problem CRUD, test case isolation, asynchronous queueing, Redis client resilience, worker lifecycle, payload validation, retry semantics, graceful shutdown, and audit governance:
```bash
cd backend && npm test
```

### 3. Frontend Test Suite (21 tests across 9 suites)
Verifies verdict formatting, submission service payload security, AdminRoute authorization guards, and problem management forms:
```bash
cd frontend && npm test
```

---

## Security Model & Sandbox Hardening

All untrusted user submissions run in disposable containers governed by strict Linux security primitives:

1. **Network Isolation**: Containers run with `--network none`. Sockets, DNS lookups, and egress attempts fail immediately with `Network is unreachable`.
2. **Unprivileged User Execution**: Sandboxes execute strictly under UID `1000:1000` with `--cap-drop ALL` and `--security-opt no-new-privileges`.
3. **Read-Only Root Filesystem**: The container root filesystem is mounted read-only (`--read-only`). Only an ephemeral tmpfs at `/tmp` and the temporary run workspace are writable.
4. **Secret Isolation**: Sandbox containers receive zero backend secrets (`JWT_SECRET`, `MONGO_URI`, Redis credentials). The Docker socket is mounted strictly to trusted host runners and is never accessible inside sandboxes.
5. **Strict Resource Ceilings**:
   - **Time Limit**: 5,000 ms wall-clock limit (maps to `TIME_LIMIT_EXCEEDED`).
   - **Memory Limit**: 256 MB cgroup limit with zero swap (`MEMORY_LIMIT_EXCEEDED`).
   - **PID Limit**: 64 processes maximum (fork bomb mitigation).
   - **Output Cap**: 512 KB maximum stdout/stderr (active termination with `OUTPUT_LIMIT_EXCEEDED`).

---

## Advanced Infrastructure & Deployment Tiers (Phase 18)

CodeArena establishes four distinct deployment tiers with realistic operational boundaries:

1. **Local (Canonical Stack)**: Docker Compose (`docker-compose.yml`) with standalone MongoDB 7.0, Redis 7.2, and `DockerRuntime`.
2. **Advanced Local / Demonstration**: Kubernetes local overlay (`k8s/overlays/local/`), in-cluster MongoDB StatefulSet, Redis Sentinel demonstration (`REDIS_SENTINEL_HOSTS`), KEDA worker autoscaler, and Prometheus/Grafana.
3. **Production-Oriented Recommendation**: Managed MongoDB (Atlas), Managed Redis (ElastiCache), External Secrets Operator, Kubernetes with dedicated worker nodes (`requiredDuringSchedulingIgnoredDuringExecution`), HPA, KEDA, NetworkPolicies with private CIDRs, and true Prometheus histograms.
4. **Experimental**: `GVisorRuntime` (`runsc`) and `FirecrackerRuntime` (microVM jailer) as documented capability interfaces.

### Verification Levels
CodeArena uses strict six-tier verification semantics (`node scripts/verify-phase18.js`):
- **Level 1 — YAML Syntax**: VERIFIED (23 manifests parsed cleanly)
- **Level 2 — Kustomize Rendering**: NOT VERIFIED (CLI unavailable on local host; manifests validated for CI)
- **Level 3 — Kubernetes API Schema**: NOT VERIFIED (kubeconform / live API server unavailable on host)
- **Level 4 — CRD Specification**: NOT VERIFIED (KEDA/Prometheus CRD schemas unavailable on host)
- **Level 5 — Live Cluster**: NOT RUN (No live cluster accessible on host)
- **Level 6 — Live Autoscaling**: NOT RUN (Requires active cluster with KEDA operator & metrics-server)
- **Architecture Invariants**: PASSED (All 9 invariants: Docker isolation, non-root context, dedicated worker affinity, 30s drain, worker image consistency, base secret exclusion, production datastore isolation & managed CIDR NetworkPolicy, HPA/KEDA triggers, low-cardinality histograms, W3C trace context propagation).

---

## License

This project is open source and available under the [MIT License](LICENSE).
