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

CodeArena application components can run in containers:

```text
Frontend
Backend
Execution Engine
MongoDB (development)
```

This provides consistent development and deployment environments.

---

# 4. Application Architecture

```text
                  Docker Environment
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
    Frontend          Backend       Execution Engine
                         |                |
                         v                v
                      MongoDB        Docker Runtime
                                          |
                                          v
                                       Sandbox
```

---

# 5. Docker Compose

Local development uses:

```text
docker-compose.yml
```

Expected services:

```text
frontend
backend
execution-engine
mongodb
```

Compose simplifies local service orchestration.

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

# 7. Backend Container

The Backend container should contain:

```text
Node.js Runtime
Application Code
Production Dependencies
```

It should not unnecessarily contain:

```text
C++ Compiler
Python Toolchain
Docker Development Tools
```

The Backend should remain focused on API/business logic.

---

# 8. Execution Engine Container

The Execution Engine requires access to the container runtime so that it can create and manage sandbox containers.

This is a privileged architectural boundary and must be protected carefully.

```text
Execution Engine
       |
       v
Docker Runtime
       |
       v
Sandbox
```

The user code inside the sandbox must not receive the same management access.

---

# 9. Sandbox Container

A sandbox is created dynamically for each submission.

```text
Submission
    |
    v
Create Container
    |
    v
Execute
    |
    v
Collect Result
    |
    v
Destroy Container
```

The sandbox is temporary.

---

# 10. Application Containers vs Sandbox Containers

These must not be confused.

### Application Containers

```text
Frontend
Backend
Execution Engine
```

They are long-running services.

### Sandbox Containers

```text
User Code
```

They are short-lived and created per execution.

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
   |
   v
docker compose up
   |
   +---- Frontend
   |
   +---- Backend
   |
   +---- Execution Engine
   |
   +---- MongoDB
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

### Application Containers

- [ ] Trusted base image.
- [ ] Versioned images.
- [ ] Minimal dependencies.
- [ ] No secrets in image.
- [ ] `.dockerignore` configured.
- [ ] Non-root where practical.
- [ ] Health checks available.

### Sandbox Containers

- [ ] Fresh container per submission.
- [ ] Network disabled.
- [ ] CPU limit.
- [ ] Memory limit.
- [ ] Process limit.
- [ ] Execution timeout.
- [ ] Output limit.
- [ ] Restricted filesystem.
- [ ] Non-root execution.
- [ ] Reduced capabilities.
- [ ] No-new-privileges where practical.
- [ ] No Docker socket.
- [ ] No application secrets.
- [ ] Cleanup guaranteed.

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