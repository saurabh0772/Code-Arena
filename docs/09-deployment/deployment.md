# CodeArena — Deployment

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Deployment Architecture |
| Version | 1.0 |
| Status | Approved |
| Deployment Model | Containerized |

---

# 2. Purpose

This document describes how CodeArena is deployed across development, testing, and production environments.

The deployment architecture should keep the application simple for the MVP while allowing individual components to scale later.

---

# 3. Deployment Architecture

The deployment consists of:

```text
Frontend (React SPA / Nginx)
Backend (Express API)
Redis (Queue Transport)
Worker (Autonomous BullMQ Consumer)
Execution Engine
MongoDB
Docker Sandbox (codearena-sandbox:v1)
```

High-level deployment:

```text
Internet
   │
   ▼
Frontend (Nginx)
   │
   ▼
Backend API
   ├───► MongoDB
   │
   └───► Redis 7.2 (Queue Transport)
            │
            ▼
         Worker Daemon
            │
            ▼
         Execution Engine
            │
            ▼
         Docker Sandbox (codearena-sandbox:v1)
```

---

# 4. Deployment Components

| Component | Responsibility |
|---|---|
| Frontend | User interface (SPA served via Nginx) |
| Backend | API, authentication, RBAC, queue producer |
| Redis | In-memory message broker & queue transport for BullMQ |
| Worker | Asynchronous queue consumer running execution tasks |
| Execution Engine | Multi-language compilation and sandbox runner |
| MongoDB | Application database (users, problems, test cases, submissions) |
| Docker | Host container engine + ephemeral execution sandboxes |

---

# 5. Frontend Deployment

The Frontend can be deployed independently from the Backend.

Typical flow:

```text
Developer
   |
   v
Build Frontend
   |
   v
Static Assets
   |
   v
Frontend Hosting
```

The Frontend should communicate with the configured Backend API URL.

---

# 6. Backend Deployment

The Backend runs as a Node.js application.

Responsibilities include:

- REST API
- Authentication
- Authorization
- Business logic
- Database access
- Submission orchestration

The Backend should not contain unnecessary compiler/runtime dependencies.

---

# 7. Execution Engine Deployment

The Execution Engine runs separately from the main Backend application.

```text
Backend
   |
   v
Execution Engine
   |
   v
Docker Runtime
```

This separation allows execution resources to be managed independently.

---

# 8. MongoDB Deployment

MongoDB stores:

```text
Users
Problems
TestCases
Submissions
```

In production, MongoDB should preferably be hosted using a managed database service or a properly secured private deployment.

MongoDB should not be publicly exposed.

---

# 9. Network Architecture

A simplified production architecture:

```text
                    Internet
                       │
                       ▼
                  Frontend (Nginx)
                       │ HTTPS
                       ▼
                  Backend API
                 /     │     \
                ▼      ▼      ▼
           MongoDB   Redis  Execution Engine
                       │        │
                       ▼        ▼
                    Worker  Docker Runtime
                                │
                                ▼
                             Sandbox (codearena-sandbox:v1)
```

---

# 10. Public vs Private Components

Publicly accessible components:

```text
Frontend (Port 5173 / Nginx 80)
Backend API (Port 5000)
```

Private components:

```text
MongoDB (Port 27017)
Redis (Container 6379, Host 6380)
Worker Daemon
Execution Engine
Docker Runtime (/var/run/docker.sock)
Sandbox Containers (Isolated --network none)
```

The exact exposure depends on the hosting environment.

---

# 11. Environment Separation

CodeArena should maintain separate configurations for:

```text
Development
Testing
Production
```

Each environment should use separate:

- Database
- Secrets
- API configuration
- Frontend URL
- Execution configuration

---

# 12. Environment Variables

The Backend and Worker require:

```text
NODE_ENV
PORT
MONGODB_URI
JWT_SECRET
FRONTEND_URL
REDIS_HOST
REDIS_PORT
WORKER_CONCURRENCY
CODEARENA_WORKSPACE_BASE
CODEARENA_SANDBOX_IMAGE
```

Secrets must not be committed to Git.

---

# 13. Frontend Configuration

The Frontend should only receive values that are safe to expose publicly.

Example:

```text
Backend API URL
```

The Frontend must never contain:

```text
MongoDB Credentials
JWT Signing Secret
Database Password
Private API Keys
```

---

# 14. HTTPS

Production traffic should use HTTPS.

```text
Browser
   |
 HTTPS
   v
Backend
```

HTTP should not be used for sensitive production communication.

---

# 15. Health Checks

The Backend should expose a health endpoint.

Example:

```text
GET /health
```

A health check should indicate whether the application process is alive.

A separate readiness check can be used to verify whether required dependencies are available.

---

# 16. Graceful Shutdown

Services should handle shutdown signals gracefully.

Conceptually:

```text
Shutdown Signal
      |
      v
Stop Accepting Requests
      |
      v
Finish Safe Operations
      |
      v
Close Database Connections
      |
      v
Exit
```

This reduces the chance of incomplete operations.

---

# 17. Deployment Flow

A typical deployment process:

```text
Code Push
   |
   v
CI Pipeline
   |
   v
Run Tests
   |
   v
Build Images
   |
   v
Push Images
   |
   v
Deploy
   |
   v
Health Check
   |
   v
Release
```

---

# 18. CI/CD

The deployment pipeline should verify:

```text
Lint
Unit Tests
Integration Tests
Execution Tests
Security Checks
Build
```

Deployment should happen only after required checks pass.

---

# 19. Container Registry

Application images should be stored in a container registry.

Example image categories:

```text
codearena/frontend
codearena/backend
codearena/execution-engine
codearena/cpp-runtime
codearena/python-runtime
codearena/node-runtime
```

Images should use meaningful version tags.

---

# 20. Image Versioning

Avoid depending only on:

```text
latest
```

Prefer explicit versions such as:

```text
backend:v1.0.0
execution-engine:v1.0.0
cpp-runtime:v1
```

This makes deployments reproducible.

---

# 21. Database Backups

Production MongoDB data should be backed up regularly.

Important data includes:

```text
Users
Problems
TestCases
Submissions
```

Backup restoration should also be tested rather than assuming backups are usable.

---

# 22. Database Migrations

Schema changes should be handled deliberately.

Before deploying a database change:

```text
Design Change
   |
   v
Migration / Compatibility Plan
   |
   v
Test
   |
   v
Deploy
```

---

# 23. Logging

Each service should produce structured logs where practical.

Useful information includes:

```text
Timestamp
Request ID
Service
Operation
Status
Duration
Error Type
```

Sensitive values must not be logged.

---

# 24. Monitoring

Important production metrics include:

```text
API Response Time
API Error Rate
Database Errors
Submission Rate
Execution Time
Execution Failures
Queue Depth (Future)
Worker Utilization (Future)
```

---

# 25. Resource Monitoring

The Execution Engine requires special monitoring because code execution consumes significant resources.

Monitor:

```text
CPU
Memory
Container Count
Execution Duration
Failed Executions
```

---

# 26. Deployment Rollback

A failed deployment should be reversible.

Conceptually:

```text
New Version
    |
    v
Health Check
    |
    +---- Failure
             |
             v
        Previous Version
```

Versioned images make rollback easier.

---

# 27. MVP Local Deployment

Local development should use Docker Compose.

Conceptually:

```text
docker-compose
      |
      +---- Frontend
      +---- Backend
      +---- Execution Engine
      +---- MongoDB
```

The exact configuration is defined in:

```text
docker-compose.yml
```

---

# 28. Production Deployment

A simple production deployment may initially use:

```text
Frontend Hosting
       +
Backend Container
       +
Execution Engine Container
       +
Managed MongoDB
```

Docker remains responsible for application containerization and execution sandboxing.

---

# 29. Future Scaling

When traffic increases:

```text
Load Balancer
      |
      +---- Backend 1
      |
      +---- Backend 2
      |
      +---- Backend N
```

Execution can scale independently:

```text
Queue
  |
  +---- Worker 1
  +---- Worker 2
  +---- Worker N
```

---

# 30. Deployment Evolution

The intended evolution is:

```text
MVP
  ↓
Containerized Deployment
  ↓
Async Execution
  ↓
Worker Pool
  ↓
Horizontal Scaling
  ↓
Autoscaling
```

Infrastructure should be added based on actual requirements.

---

# 31. Production Deployment Hardening Checklist

The following items are production deployment hardening requirements and are intentionally kept separate from local MVP verification:

- [ ] HTTPS enabled.
- [ ] MongoDB is private (isolated in internal production network / managed cluster).
- [ ] Secrets are not committed (injected securely via production secrets manager).
- [ ] Execution Engine is not unnecessarily public.
- [ ] Sandbox network is restricted.
- [ ] Containers run with minimum privileges.
- [ ] Images are versioned (immutable release tags in container registry).
- [ ] Dependencies are scanned (automated CI vulnerability scans).
- [ ] Database backups are configured (automated snapshots and PITR).
- [ ] Health checks are available.
- [ ] Logs do not contain secrets.

---

# 32. Deployment Principles

1. Keep the MVP deployment simple.
2. Separate execution from the main API.
3. Keep databases private.
4. Never expose secrets to the Frontend.
5. Use versioned images.
6. Automate testing before deployment.
7. Monitor execution infrastructure.
8. Maintain rollback capability.
9. Back up important data.
10. Scale only when actual workload requires it.