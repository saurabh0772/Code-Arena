# CodeArena

Online Judge & Secure Code Execution Platform

CodeArena is a full-featured, secure online judge platform designed as a high-performance **Modular Monolith**. It supports multi-language execution across **C++ (C++17)**, **Python 3**, and **JavaScript (Node.js)** inside isolated, disposable Docker sandboxes.

## Current Status: Phase 10 — Testing + Deployment

| Phase | Module / Focus | Status |
|---|---|---|
| **Phase 1** | Repository & Backend Setup | **COMPLETE** |
| **Phase 2** | Backend Core & Database (MongoDB + Mongoose) | **COMPLETE** |
| **Phase 3** | Authentication & RBAC (JWT, Argon2) | **COMPLETE** |
| **Phase 4** | Problem Module (CRUD & Public Access) | **COMPLETE** |
| **Phase 5** | Test Case Module (Public & Hidden Isolation) | **COMPLETE** |
| **Phase 6** | Submission Module (Persisted State Lifecycle) | **COMPLETE** |
| **Phase 7** | Execution Engine (C++, Python, JS Runners) | **COMPLETE** |
| **Phase 8** | Connect Everything (End-to-End Online Judge Flow) | **COMPLETE** |
| **Phase 9** | Frontend SPA (React 18, Vite, Tailwind CSS) | **COMPLETE** |
| **Phase 10** | Testing + Deployment (Docker Compose & Security Verification) | **COMPLETE** |
| **Phase 11** | Distributed Execution Engine (Queues, Workers, Microservices) | **FUTURE** |

---

## Architecture Overview

CodeArena operates as a clean modular monolith with a strict separation between trusted infrastructure and untrusted user code execution:

```text
[ React 18 Frontend SPA (Port 5173 / Nginx) ]
                    ↓  HTTP / REST
[ Express.js Modular Monolith Backend (Port 5000) ]
       ├── Auth & RBAC (JWT + Argon2)
       ├── Problems & Test Cases (Public / Hidden Isolation)
       └── Submissions Service
                    ↓  Direct Module Call
[ Execution Engine Module ]
       ├── Language Resolvers (C++, Python 3, Node.js)
       ├── Scoped DooD Shared Workspaces (/tmp/codearena-workspaces)
       └── Docker Sandbox Runner
                    ↓  Docker Daemon Socket (/var/run/docker.sock)
[ Disposable Sandbox Containers (codearena-sandbox:latest) ]
       ├── --network none (Zero network access)
       ├── --user 1000:1000 (Non-root user)
       ├── --memory 256m --memory-swap 256m
       ├── --pids-limit 64 (Fork bomb containment)
       ├── --read-only + tmpfs (/tmp)
       └── --cap-drop ALL + no-new-privileges
```

---

## Getting Started

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/) (v24+) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (v20+ LTS)
- [MongoDB](https://www.mongodb.com/) (v7.0+ if running locally outside Docker)

### 1. Build the Sandbox Image (Required Once)

The execution engine runs all untrusted code inside the hardened `codearena-sandbox:latest` image:

```bash
docker build -t codearena-sandbox:latest -f execution-engine/Dockerfile.sandbox execution-engine
```

### 2. Configure Environment & Run via Docker Compose

1. Initialize local environment configuration from template:
   ```bash
   cp .env.example .env
   ```
   Provide a secure `JWT_SECRET` in `.env`.

2. Start MongoDB, Backend, and Frontend in unified containerized orchestration:
   ```bash
   docker compose up -d
   ```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Health Endpoint**: [http://localhost:5000/health](http://localhost:5000/health)

Verify service status:
```bash
docker compose ps
```

---

## Development Seeding & Demo Problems

To seed the initial demo problems and administrative account into MongoDB:

```bash
# Seed default system administrator (admin@codearena.com / AdminPass123!)
npm run seed:admin --prefix backend

# Seed canonical demo problems (idempotent; preserves user-created problems)
npm run seed:problems --prefix backend
```

### Seeded Problem & Test Case Structure
1. **Sum of Two Numbers** (`EASY`, tags: `math`, `basics`):
   - 2 `PUBLIC` test cases, 3 `HIDDEN` test cases (5 total)
2. **Maximum Element in an Array** (`MEDIUM`, tags: `arrays`, `search`, `basics`):
   - 2 `PUBLIC` test cases, 4 `HIDDEN` test cases (6 total)
3. **Longest Increasing Subsequence Length** (`HARD`, tags: `dynamic-programming`, `arrays`, `binary-search`):
   - 2 `PUBLIC` test cases, 4 `HIDDEN` test cases (6 total)

### Problem Readiness & Evaluation Guarantee
- Problems with zero active test cases are strictly guarded against submission.
- Attempting to submit to a problem without active test cases fails immediately with HTTP `422 Unprocessable Entity` (`errorCode: "PROBLEM_NOT_READY"`).
- No untrusted code is executed, no sandbox container is spawned, and no `ACCEPTED (0/0)` verdict is possible.
- Inactive test cases (`isActive: false`) are ignored during evaluation. `ACCEPTED` strictly requires `totalTests > 0` and `testsPassed === totalTests`.

---

## Running Test Suites

All automated test suites are implemented and verified in the local environment:

### Execution Engine Test Suite (Docker Sandbox Verification)
Verifies multi-language compilation/runtime, timeouts, memory limits, output caps, PID limits, network blocking, and filesystem restrictions:
```bash
cd execution-engine
npm test
```
*(Verified: 43/43 tests passing)*

### Backend Test Suite
Verifies authentication, RBAC, problems, test case visibility, submissions, zero-test regressions, and rate limiting (requires running MongoDB):
```bash
cd backend
npm test
```
*(Verified: 126/126 tests passing)*

### Frontend Test Suite & Production Build
```bash
cd frontend
npm test
npm run build
```
*(Verified: 21/21 tests passing, 0 build errors)*

---

## Security Model

1. **Network Isolation**: All untrusted user code runs with `--network none`. Network syscalls fail immediately with `Network is unreachable`.
2. **Privilege Boundary**: Sandboxes execute strictly under UID `1000:1000` with `--cap-drop ALL` and `--security-opt no-new-privileges`.
3. **Filesystem Protection**: Root filesystem is mounted read-only (`--read-only`). Only the submission workspace and an ephemeral `/tmp` tmpfs are writable. Sensitive paths (`/etc/shadow`, `/root`) are inaccessible.
4. **Secret Isolation**: Sandbox containers receive zero backend secrets (`MONGODB_URI`, `JWT_SECRET`, host environment variables). Docker socket is never mounted into sandboxes.
5. **Resource Ceilings**:
   - Time Limit: 5,000 ms (maps strictly to `TIME_LIMIT_EXCEEDED`).
   - Memory Limit: 256 MB (maps strictly to `MEMORY_LIMIT_EXCEEDED`).
   - Process Limit: 64 PIDs (fork bombs trigger `Resource temporarily unavailable`).
   - Output Cap: 512 KB (active termination with `OUTPUT_LIMIT_EXCEEDED`).
