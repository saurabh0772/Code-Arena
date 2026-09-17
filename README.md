# CodeArena

Online Judge & Secure Code Execution Platform

CodeArena is a full-featured, secure online judge platform designed as a high-performance **Modular Monolith**. It supports multi-language execution across **C++ (C++17)**, **Python 3**, and **JavaScript (Node.js)** inside isolated, disposable Docker sandboxes.

## Current Status: Phase 10 — Testing + Deployment

| Phase | Module / Focus | Status |
|---|---|---|
| **Phase 1** | Repository & Backend Setup | **COMPLETE** |
| **Phase 2** | Backend Core & Database (Mongoose 8.x) | **COMPLETE** |
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
[ Standalone Execution Engine ]
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

### 2. Run via Docker Compose (Recommended)

Start MongoDB, Backend, and Frontend in unified containerized orchestration:

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

## Running Test Suites

### Execution Engine Test Suite (Docker Sandbox Verification)
Verifies multi-language compilation/runtime, timeouts, memory limits, output caps, PID limits, network blocking, and filesystem restrictions:
```bash
cd execution-engine
npm test
```
*(42/42 tests passing)*

### Backend Test Suite
Verifies authentication, RBAC, problems, test case visibility, submissions, and rate limiting:
```bash
cd backend
npm test
```
*(123/123 tests passing)*

### Frontend Test Suite & Production Build
```bash
cd frontend
npm test
npm run build
```
*(8/8 tests passing, 0 build errors)*

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
