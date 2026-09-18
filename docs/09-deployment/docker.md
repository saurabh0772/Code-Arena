# CodeArena — Docker Strategy

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Docker Strategy |
| Version | 1.0 |
| Status | Approved |

---

# 2. Purpose

Docker is used in CodeArena for two different purposes:

```text
1. Application Containerization
2. Untrusted Code Sandbox
```

These two uses must be treated differently.

---

# 3. Application Containerization

CodeArena application components run as containerized services orchestrated by Docker Compose:

```text
frontend (React 18 SPA served via Nginx)
backend (Express API modular monolith)
worker (Background BullMQ consumer daemon, reusing backend image)
redis (Redis 7.2 Alpine queue transport)
mongodb (MongoDB 7.0 database)
```

In addition, an unprivileged template image:

```text
codearena-sandbox:v1 (Built from execution-engine/Dockerfile.sandbox)
```

is used exclusively to create ephemeral, disposable containers for executing untrusted user code.

---

# 4. Application Architecture

```text
                            User
                              │
                              │ Port 5173
                              ▼
                           Frontend (Nginx)
                              │
                              │ Port 5000
                              ▼
                           Backend API
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
            MongoDB                 Redis 7.2 (Queue Transport)
         (Port 27017)             (Internal: redis:6379, Host: 6380)
                                             │
                                             ▼
                                       Worker Daemon
                                             │
                                             ▼
                                      Execution Engine
                                             │
                                             ▼ Docker API (/var/run/docker.sock)
                                   Disposable Sandbox Containers
                                      (codearena-sandbox:v1)
```

---

# 5. Docker Compose

Local development uses `docker-compose.yml` over the default Docker Compose network (`<project>_default`).

Active services:

```text
frontend (Build: frontend/Dockerfile, Host: 5173 -> Container: 80)
backend (Build: backend/Dockerfile, Host: 5000 -> Container: 5000)
worker (Build: backend/Dockerfile, Command: node src/workers/submission.worker.js)
redis (Image: redis:7.2-alpine, Host: 127.0.0.1:6380 -> Container: 6379)
mongodb (Image: mongo:7.0, Host: 27017 -> Container: 27017)
```

Sandbox template image:
Built via `npm run docker:build-sandbox` (or `npm run docker:up`).
It is **not** a persistent Compose service container.

Compose coordinates local service orchestration and networking.

---

# 6. Frontend Container

The Frontend container should:

- Install dependencies
- Build the application
- Serve production assets

A multi-stage Docker build can be used.

Conceptually:

```text
Node Build Environment
        |
        v
Build Frontend
        |
        v
Production Image
```

---

# 7. Backend & Worker Containers (`backend/Dockerfile`)

The Node.js backend image is defined in `backend/Dockerfile`. It is used by two services in Docker Compose:
1. **Backend API**: Runs Express server (`node src/server.js`) handling REST endpoints, auth, and queueing.
2. **Worker Daemon**: Runs the BullMQ background worker (`node src/workers/submission.worker.js`), consuming execution jobs.

There is **no dedicated worker Dockerfile**; the worker reuses the backend image and executes the worker entrypoint.

The image contains:

```text
Node.js Runtime
Application Code
Production Dependencies
```

---

# 8. Execution Engine & Sandbox Builder (`execution-engine/Dockerfile.sandbox`)

The Execution Engine runs inside the Worker process (and Backend in local dev) and requires access to the Docker socket (`/var/run/docker.sock`) to launch disposable sandbox containers:

```text
Worker Process (Host/Container)
       │
       ▼ Docker Socket (/var/run/docker.sock)
Docker Daemon
       │
       ▼ Spawns disposable container from codearena-sandbox:v1
Disposable Sandbox Container
```

### Sandbox Template Image (`execution-engine/Dockerfile.sandbox`)
- Builds `codearena-sandbox:v1`
- Contains C++ (`g++`), Python 3, and Node.js runtimes
- Executes untrusted user code under non-root user `1000:1000`
- Disposable: Created per test execution and destroyed immediately
- **NOT** a persistent or long-running Compose service

The user code inside the sandbox never receives Docker socket access or network access.

---

# 9. Frontend Container (`frontend/Dockerfile`)

`frontend/Dockerfile` uses a multi-stage Docker build:
1. Build stage compiles the React 18 SPA with Vite.
2. Production stage serves static assets using an unprivileged Nginx server on port 80 (mapped to host port 5173).

---

# 10. Repository Dockerfiles Summary

The repository contains exactly three Dockerfiles:

| Dockerfile | Target Service / Role | Lifecycle |
|---|---|---|
| `backend/Dockerfile` | `backend` API & `worker` daemon | Long-running services |
| `frontend/Dockerfile` | `frontend` web application | Long-running service (Nginx) |
| `execution-engine/Dockerfile.sandbox` | `codearena-sandbox:v1` image | Ephemeral sandboxes (disposable) |

---

# 11. Docker Network

Application services can communicate over private Docker networks.

Conceptually:

```text
Frontend
   |
   v
Backend
   |
   +---- MongoDB
   |
   +---- Execution Engine
```

MongoDB should not be directly accessible from the public Internet.

---

# 12. Sandbox Network

The user-code container should have network access disabled.

```text
Sandbox
   |
   X
Internet
```

This is separate from normal application networking.

---

# 13. Docker Images

Language runtimes should use dedicated images.

Example:

```text
codearena/cpp-runtime:v1
codearena/python-runtime:v1
codearena/node-runtime:v1
```

Each image should contain only the tools required for that language.

---

# 14. Image Versioning

Runtime images should be versioned.

Example:

```text
cpp-runtime:v1
cpp-runtime:v2
```

Changing an image should be deliberate because it can affect execution results.

---

# 15. Reproducibility

Pinned runtime images help ensure:

```text
Same Code
+
Same Runtime
+
Same Input
      ↓
Predictable Result
```

Compiler/runtime versions should not change unexpectedly.

---

# 16. Dockerfile Principles

Application Dockerfiles should:

- Use trusted base images.
- Prefer specific versions.
- Install only required dependencies.
- Avoid unnecessary packages.
- Avoid secrets.
- Run as a non-root user where practical.
- Keep images small.

---

# 17. Multi-Stage Builds

Multi-stage builds can reduce production image size.

Conceptually:

```text
Build Stage
    |
    | Source + Build Dependencies
    v
Compiled Application
    |
    v
Production Stage
    |
    v
Minimal Runtime Image
```

---

# 18. `.dockerignore`

The Docker build context should exclude unnecessary files.

Examples:

```text
node_modules
.git
.env
logs
temporary files
```

This reduces image build context and helps prevent accidental inclusion of sensitive files.

---

# 19. Secrets

Secrets must not be baked into Docker images.

Never put:

```text
JWT_SECRET
MONGODB_URI
API_KEYS
PASSWORDS
```

inside a Dockerfile.

Secrets should be supplied through the deployment environment or a dedicated secret-management system.

---

# 20. Sandbox Privileges

Sandbox containers should run with minimum privileges.

Preferred controls include:

```text
Non-root user
Dropped capabilities
No-new-privileges
Restricted filesystem
No network
Resource limits
```

---

# 21. CPU Limit

Sandbox containers must have CPU limits.

```text
User Program
     |
     v
CPU Limit
     |
     +---- Exceeded → Terminate
```

This prevents one submission from consuming all available CPU.

---

# 22. Memory Limit

Sandbox containers must have memory limits.

```text
User Program
     |
     v
Memory Limit
     |
     +---- Exceeded → Terminate
```

The resulting verdict should be:

```text
MEMORY_LIMIT_EXCEEDED
```

where appropriate.

---

# 23. Process Limit

Sandbox containers should restrict process creation.

This helps defend against:

```text
Fork Bombs
Process Exhaustion
```

---

# 24. Execution Timeout

Every program must have a maximum execution duration.

```text
Start
  |
  v
Timer
  |
  +---- Finish → Result
  |
  +---- Timeout → Terminate
```

---

# 25. Output Limit

Program output should be limited.

```text
Program
   |
   v
stdout
   |
   v
Output Limit
   |
   +---- Exceeded → Terminate
```

---

# 26. Filesystem Restrictions

The sandbox should not expose host directories unnecessarily.

Avoid broad host mounts such as:

```text
/
```

or other sensitive host paths.

If a mount is required, it should be explicitly limited.

---

# 27. Docker Socket

The Docker socket must not be available inside user-code containers.

Dangerous:

```text
User Code
    |
    v
Docker Socket
    |
    v
Host
```

Preferred:

```text
Execution Engine
    |
    v
Docker Runtime

Sandbox
    |
    X
Docker Socket
```

---

# 28. Application Secrets in Sandbox

The sandbox must not inherit the Backend environment.

For example, it should not receive:

```text
MONGODB_URI
JWT_SECRET
CLOUDINARY_SECRET
API_KEYS
```

Only execution-specific configuration should be provided.

---

# 29. Runtime Dependencies

Language images should contain their dependencies before execution.

User code should not be able to perform unrestricted:

```text
apt install
pip install
npm install
```

during execution.

This improves security and reproducibility.

---

# 30. Docker Image Security

Images should be regularly checked for known vulnerabilities.

Security checks should cover:

```text
Base Image
System Packages
Language Runtime
Application Dependencies
```

---

# 31. Container Cleanup

After execution:

```text
Collect Result
     |
     v
Destroy Container
```

Cleanup must occur even when execution fails.

---

# 32. Cleanup Failure

If container cleanup itself fails, the Execution Engine should detect the failure and attempt appropriate cleanup/reconciliation rather than silently ignoring abandoned containers.

---

# 33. Container Naming

Sandbox containers should have unique identifiers.

Conceptually:

```text
codearena-sandbox-<submission-id>
```

Names must not be constructed in a way that allows arbitrary user input to become unsafe Docker arguments.

---

# 34. Docker Resource Monitoring

The execution infrastructure should monitor:

```text
Running Containers
CPU Usage
Memory Usage
Container Creation Rate
Execution Duration
Failed Containers
```

This becomes especially important when concurrent submissions increase.

---

# 35. Docker Compose Development Flow

```text
Developer
   │
   ├─ 1. npm run docker:build-sandbox (Builds codearena-sandbox:v1)
   ▼
docker compose up -d
   │
   ├── frontend (Port 5173 -> Nginx 80)
   ├── backend (Port 5000 -> Express API)
   ├── worker (Reuses backend image, no HTTP port)
   ├── redis (Port 6380 -> 6379)
   └── mongodb (Port 27017 -> 27017)
```

The developer can run the complete application locally using the Compose environment.

---

# 36. Production Docker Strategy

Production should use explicitly versioned images.

```text
Frontend Image
Backend Image
Execution Engine Image
Language Runtime Images
```

MongoDB may be replaced by a managed database service.

---

# 37. Docker Security Boundary

The architecture contains two distinct trust levels:

```text
Trusted
   |
   v
Execution Engine
   |
   v
Docker Runtime
   |
   v
Untrusted
   |
   v
User Code
```

The Execution Engine is trusted infrastructure.

User code is not.

---

# 38. Docker Limitations

Docker shares the host kernel.

Therefore:

```text
Docker
   ≠
Perfect Isolation
```

The MVP should not claim complete protection against every possible container escape.

---

# 39. Future Sandbox Technologies

If stronger isolation is required, the Execution Engine can later support:

```text
Docker
   ↓
gVisor
   ↓
Firecracker / MicroVM
```

The underlying sandbox technology should remain an implementation detail of the Execution Engine.

---

# 40. Docker Checklist

### Application Containers (Local MVP Verified vs. Production Deployment)

- [x] Trusted base image.
- [ ] Versioned images (scheduled for future production deployment pipeline; local MVP uses latest tag).
- [x] Minimal dependencies.
- [x] No secrets in image (runtime injection via untracked .env).
- [x] `.dockerignore` configured.
- [x] Non-root where practical.
- [x] Health checks available.

### Sandbox Containers (Local MVP Verified)

- [x] Fresh container per submission.
- [x] Network disabled.
- [x] CPU limit.
- [x] Memory limit.
- [x] Process limit.
- [x] Execution timeout.
- [x] Output limit.
- [x] Restricted filesystem.
- [x] Non-root execution.
- [x] Reduced capabilities.
- [x] No-new-privileges where practical.
- [x] No Docker socket.
- [x] No application secrets.
- [x] Cleanup guaranteed.

---

### Docker Security Boundaries & Limitations

1. **Shared Host Kernel**: Docker containers provide process and namespace isolation (cgroups, namespaces, seccomp) but share the underlying host Linux kernel.
2. **Infrastructure Boundary**: The Docker daemon socket (`/var/run/docker.sock`) is accessible strictly to the trusted backend process; it is never exposed to untrusted code or mounted inside sandbox containers.
3. **Future Isolation**: For multi-tenant production deployments with untrusted untrusted code, future iterations (Phase 11+) can evaluate microVM or user-space kernel virtualization technologies such as **gVisor (runsc)** or **AWS Firecracker**.

---

# 41. Final Docker Model

```text
                  CodeArena
                      |
          +-----------+-----------+
          |                       |
          v                       v
   Application Containers     Execution Engine
                                  |
                                  v
                           Docker Runtime
                                  |
                    +-------------+-------------+
                    |             |             |
                    v             v             v
                 Sandbox       Sandbox       Sandbox
                    |             |             |
                    v             v             v
                 User Code     User Code     User Code
```

Docker provides the practical containerization and sandboxing foundation for the MVP, while the architecture leaves room for stronger execution isolation in the future.

---

# 42. Docker-outside-of-Docker (DooD) Workspace Mount

When running within Docker Compose:
1. The backend container mounts `/var/run/docker.sock` to control the host Docker daemon.
2. To allow the host daemon to mount sandbox workspaces, a dedicated shared workspace directory (`/tmp/codearena-workspaces`) is bind-mounted at the identical path between host and backend.
3. Each submission creates an isolated subdirectory (`/tmp/codearena-workspaces/sbx-XXXXXX`) with `0777` permissions so sandbox user `UID 1000` can write compiled binaries.
4. Guaranteed cleanup removes both the container (`docker rm -f`) and the temporary workspace directory across all execution verdicts.