# ADR-005: Use Docker-Based Sandboxing for the MVP

## Status

Accepted

## Date

2026-09-15

## Context

CodeArena executes arbitrary user-submitted source code.

Submitted programs must be treated as untrusted.

Potential threats include:

```text
Infinite loops
Memory exhaustion
Process exhaustion
Huge output
Filesystem access
Network access
Privilege escalation
Host attacks
```

Running code directly on the Backend host would create an unacceptable security risk.

## Decision

The MVP will execute user code inside **disposable Docker containers**.

Architecture:

```text
Backend
   |
   v
Execution Engine
   |
   v
Disposable Docker Container
   |
   v
User Code
```

Each submission receives an isolated execution environment.

## Sandbox Controls

The sandbox should enforce:

```text
No Network
Non-root User
CPU Limit
Memory Limit
Process Limit
Execution Timeout
Output Limit
Restricted Filesystem
No Docker Socket
No Application Secrets
Dropped Capabilities
No-New-Privileges
```

## Why Docker

Docker was selected because it provides:

- Practical isolation for the MVP
- Resource controls
- Reproducible environments
- Easy local development
- Language-specific images
- Easy integration with the Execution Engine

It also allows CodeArena to package:

```text
C++ compiler
Python runtime
Node.js runtime
```

into controlled execution environments.

## Alternatives Considered

### Direct Host Execution

Rejected.

This would allow untrusted code to run directly on the host.

### Virtual Machines

Rejected for MVP because they introduce more resource and operational overhead.

### gVisor

Not selected initially.

It may provide stronger isolation but adds additional infrastructure and operational complexity.

### Firecracker / MicroVM

Not selected for MVP.

It is a strong candidate for future production-grade isolation.

## Important Limitation

Docker containers share the host kernel.

Therefore Docker should not be considered a perfect security boundary for arbitrary hostile code.

The MVP should be treated as a portfolio/learning implementation rather than a production-grade public online judge.

## Consequences

### Positive

- Stronger isolation than host execution.
- Reproducible environments.
- Language-specific runtime images.
- Resource controls.
- Simple MVP implementation.

### Negative

- Container startup overhead.
- Additional resource consumption.
- Docker daemon becomes part of the execution infrastructure.
- Docker is not a perfect hostile-code isolation boundary.

## Future Evolution

The execution boundary can later evolve:

```text
Docker Sandbox
      |
      v
Stronger Isolation
      |
      +---- gVisor
      |
      +---- Firecracker
      |
      +---- MicroVM
```

The Execution Engine abstraction should hide the underlying sandbox technology from the public API.