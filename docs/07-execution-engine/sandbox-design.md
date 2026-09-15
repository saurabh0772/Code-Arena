# CodeArena — Sandbox Design

## 1. Purpose

The Sandbox is the security boundary used to execute untrusted user-submitted code.

The MVP uses Docker containers to isolate individual submissions.

The primary goals are:

- Process isolation
- Resource control
- Network isolation
- Filesystem restriction
- Privilege reduction
- Automatic cleanup

---

# 2. Security Principle

The most important rule is:

> Never execute untrusted user code directly on the application host.

Unsafe:

```text
Backend
   |
   v
Host Shell
   |
   v
User Code
```

Preferred:

```text
Backend
   |
   v
Execution Engine
   |
   v
Docker Sandbox
   |
   v
User Code
```

---

# 3. Sandbox Architecture

```text
                  Backend
                     |
                     v
              Execution Engine
                     |
                     v
               Sandbox Manager
                     |
                     v
                Docker Runtime
                     |
          +----------+----------+
          |                     |
          v                     v
     Sandbox A              Sandbox B
     User Code              User Code
```

Each submission should receive its own disposable execution environment.

---

# 4. Sandbox Lifecycle

```text
Create
  |
  v
Configure
  |
  v
Prepare Workspace
  |
  v
Run Program
  |
  v
Collect Result
  |
  v
Destroy
```

The container should not remain running after the submission finishes.

---

# 5. Isolation Per Submission

Submission environments should not be shared.

```text
Submission A
     |
     v
Sandbox A

Submission B
     |
     v
Sandbox B
```

A program from Submission A must not be able to access files belonging to Submission B.

---

# 6. Network Isolation

Submitted programs should not have normal network access.

```text
User Program
     |
     X
Internet
```

This prevents programs from:

- Making arbitrary HTTP requests
- Downloading files
- Scanning internal networks
- Communicating with external systems

---

# 7. Filesystem Isolation

The sandbox should expose only the files required for execution.

The program should not have access to:

```text
Host filesystem
Application source
MongoDB credentials
Environment secrets
Other submissions
Docker configuration
```

---

# 8. Temporary Workspace

A submission may use a temporary workspace.

Example:

```text
/workspace
├── main.cpp
├── executable
└── temporary files
```

The workspace should be removed after execution.

---

# 9. Read-Only Filesystem

Where practical, the container filesystem should be read-only.

A small temporary writable area may be provided when the compiler/runtime requires it.

Conceptually:

```text
Container Filesystem
       |
       +---- Read Only
       |
       +---- Temporary Writable Area
```

---

# 10. Non-Root Execution

User code should run as a non-root user.

```text
Container
   |
   v
Non-root User
   |
   v
User Program
```

The container should not grant unnecessary privileges.

---

# 11. Linux Capabilities

Unnecessary Linux capabilities should be dropped.

The execution environment should follow the principle:

```text
Minimum Required Privileges
```

rather than granting broad container privileges.

---

# 12. No-New-Privileges

The sandbox should use a no-new-privileges policy where supported.

Conceptually:

```text
User Program
     |
     X
Privilege Escalation
```

---

# 13. Seccomp

Docker's default security mechanisms, including seccomp where appropriate, should be retained or hardened rather than disabled unnecessarily.

The project should avoid configurations that grant unrestricted system-call access.

---

# 14. CPU Limits

Each sandbox must have a CPU limit.

Example:

```text
Program
   |
   v
CPU Limit
   |
   +---- Exceeded
            |
            v
        Terminate
```

This prevents one submission from consuming all available CPU.

---

# 15. Memory Limits

Each sandbox must have a memory limit.

```text
Program
   |
   v
Memory Limit
   |
   +---- Exceeded
            |
            v
MEMORY_LIMIT_EXCEEDED
```

---

# 16. Execution Time Limit

Every submission must have a maximum execution duration.

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

This protects against infinite loops and unexpectedly long programs.

---

# 17. Process Limits

The sandbox should limit the number of processes a program can create.

This helps protect against:

```text
Fork Bomb
Process Exhaustion
Resource Abuse
```

---

# 18. Output Limits

Program output should be bounded.

```text
Program
   |
   v
stdout
   |
   v
Output Limit
   |
   +---- Exceeded
            |
            v
        Terminate
```

This prevents unlimited output from consuming memory or storage.

---

# 19. Docker Socket Protection

The Docker socket must never be exposed to user code.

Dangerous architecture:

```text
User Code
    |
    v
Docker Socket
    |
    v
Docker Host
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

Only the trusted Execution Engine should manage sandbox lifecycle.

---

# 20. Secret Isolation

The sandbox must not receive application secrets.

Never provide:

```text
JWT_SECRET
MONGODB_URI
DATABASE_PASSWORD
API_KEYS
CLOUD_CREDENTIALS
```

Only execution-specific data should be passed into the sandbox.

---

# 21. Environment Variables

Environment variables available inside the sandbox should be explicitly controlled.

Avoid passing the Backend's complete environment into the container.

---

# 22. Host Mounts

Host directories should not be mounted into the sandbox unless absolutely necessary.

If a mount is required, it should be:

- Explicit
- Minimal
- Read-only where possible
- Limited to the required path

---

# 23. Container Image Security

Execution images should:

- Use trusted base images.
- Use pinned versions.
- Install only required packages.
- Avoid unnecessary services.
- Avoid embedded secrets.
- Be regularly updated.

Example:

```text
codearena/cpp-runtime:v1
codearena/python-runtime:v1
codearena/node-runtime:v1
```

---

# 24. No Package Installation During Execution

User programs should not be allowed to install arbitrary packages during execution.

For example:

```text
pip install ...
npm install ...
apt install ...
```

should not be available as unrestricted execution mechanisms.

The runtime image should contain the required dependencies beforehand.

---

# 25. No Network Dependency

The execution environment should not depend on network connectivity.

```text
Runtime Image
      |
      v
Preinstalled Dependencies
      |
      v
Offline Execution
```

This improves both security and reproducibility.

---

# 26. Resource Limit Summary

Every sandbox should enforce:

| Resource | Protection |
|---|---|
| CPU | CPU limit |
| Memory | Memory limit |
| Time | Execution timeout |
| Processes | Process/PID limit |
| Output | Output size limit |
| Network | Disabled |
| Filesystem | Restricted |
| Privileges | Non-root / reduced |

---

# 27. Sandbox Creation Flow

```text
Execution Request
       |
       v
Validate Language
       |
       v
Select Runtime Image
       |
       v
Configure Limits
       |
       v
Create Container
       |
       v
Prepare Workspace
       |
       v
Execute
```

---

# 28. Sandbox Execution Flow

```text
Create Container
       |
       v
Copy Source
       |
       v
Compile
       |
       +---- Error → Collect Error
       |
       v
Execute Test
       |
       v
Collect stdout/stderr
       |
       v
Check Limits
       |
       v
Compare Output
```

---

# 29. Sandbox Cleanup

Cleanup must happen for every possible result.

```text
Execution
   |
   +---- ACCEPTED
   +---- WRONG_ANSWER
   +---- COMPILATION_ERROR
   +---- RUNTIME_ERROR
   +---- TIMEOUT
   +---- MEMORY_ERROR
   +---- ENGINE_ERROR
             |
             v
       Destroy Sandbox
```

Cleanup should be placed in a guaranteed cleanup/finalization path.

---

# 30. Failure Scenarios

The Execution Engine must handle:

```text
Container creation failure
Compilation failure
Runtime crash
Timeout
Memory exhaustion
Process exhaustion
Output overflow
Container crash
Unexpected engine error
```

The system should clean up resources even when these failures occur.

---

# 31. Sandbox Failure Isolation

A sandbox failure should not terminate the entire Backend.

```text
Backend
   |
   v
Execution Engine
   |
   +---- Sandbox A → Failure
   |
   +---- Sandbox B → Continues
   |
   +---- Sandbox C → Continues
```

---

# 32. Docker Security Limitation

Docker containers share the host kernel.

Therefore:

```text
Docker
   ≠
Perfect Security Boundary
```

A highly exposed public online judge requires stronger isolation and security review.

---

# 33. Future Stronger Isolation

Potential future technologies include:

```text
Docker
   ↓
gVisor
   ↓
Firecracker / MicroVM
```

The Execution Engine should hide the underlying sandbox technology behind an abstraction.

---

# 34. Execution Boundary

The intended architecture is:

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

The Execution Engine controls the boundary; user code does not.

---

# 35. Security Testing

The sandbox should be tested against:

```text
Infinite Loop
Memory Exhaustion
Fork Bomb
Huge Output
Network Access
Filesystem Access
Environment Secret Access
Docker Socket Access
Cross-Submission Access
Privilege Escalation
```

---

# 36. Sandbox Checklist

Before using the sandbox:

- [ ] Container is disposable.
- [ ] User runs as non-root.
- [ ] Network is disabled.
- [ ] CPU limit is configured.
- [ ] Memory limit is configured.
- [ ] Execution timeout is configured.
- [ ] Process limit is configured.
- [ ] Output limit is configured.
- [ ] Filesystem is restricted.
- [ ] Docker socket is unavailable.
- [ ] Application secrets are unavailable.
- [ ] Unnecessary capabilities are dropped.
- [ ] No-new-privileges is enabled where practical.
- [ ] Sandbox cleanup is guaranteed.

---

# 37. MVP Security Position

The Docker sandbox provides a practical isolation mechanism for the MVP.

However, CodeArena should not claim that this design is equivalent to a hardened production online judge.

A production deployment would require:

- Security review
- Hardened host configuration
- Stronger isolation
- Continuous vulnerability management
- Monitoring
- Incident response
- Potential microVM-based execution

---

## 38. Final Sandbox Model

```text
                  Submission
                      |
                      v
               Execution Engine
                      |
                      v
               Disposable Docker
                  Sandbox
                      |
       +--------------+--------------+
       |              |              |
       v              v              v
    CPU Limit     Memory Limit    Time Limit
       |              |              |
       +--------------+--------------+
                      |
                      v
                  User Code
                      |
            +---------+---------+
            |         |         |
          No Net   Restricted   No Secrets
                    Filesystem
```

The fundamental rule is:

> **Treat every submitted program as hostile and give it only the minimum resources and permissions required to execute.**