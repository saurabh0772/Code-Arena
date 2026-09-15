# ADR-010: Resource Limits and Execution Isolation

## Status

Accepted

## Context

CodeArena executes source code submitted by users.

User-submitted programs must be treated as untrusted because they may intentionally or unintentionally:

- Consume excessive CPU
- Consume excessive memory
- Run indefinitely
- Create excessive processes
- Generate huge output
- Access the network
- Access sensitive files
- Attempt privilege escalation

Executing such code directly on the application host would create a major security and availability risk.

## Decision

Every submission will execute inside a restricted, disposable sandbox.

The MVP will use Docker containers with resource and security restrictions.

```text
User Code
    ↓
Execution Engine
    ↓
Disposable Docker Sandbox
    ↓
Restricted Execution
    ↓
Verdict
```

## Required Restrictions

The sandbox should enforce:

```text
CPU Limit
Memory Limit
Execution Time Limit
Process Limit
Output Limit
Network Isolation
Restricted Filesystem
Non-root Execution
Reduced Privileges
No Docker Socket
No Application Secrets
```

## Rationale

Resource limits prevent a single submission from consuming resources needed by other users.

Isolation reduces the impact of malicious or faulty programs.

This is especially important because the execution workload is fundamentally different from normal API traffic.

## Consequences

### Positive

- Better security
- Resource protection
- Failure isolation
- More predictable execution
- Safer handling of untrusted code

### Negative

- Additional infrastructure complexity
- Container startup overhead
- Docker runtime dependency
- Docker is not a perfect security boundary

## Important Limitation

Docker containers share the host kernel.

Therefore:

```text
Docker ≠ Perfect Security Boundary
```

The MVP should not be considered a fully hardened production online judge without further security review.

## Future Evolution

If stronger isolation is required, the Execution Engine may later support technologies such as:

```text
gVisor
Firecracker
MicroVM-based execution
```

The sandbox implementation should remain behind the Execution Engine boundary so the underlying technology can evolve.

## Related Documentation

- `06-security/security-design.md`
- `07-execution-engine/sandbox-design.md`
- `07-execution-engine/execution-flow.md`
- `09-deployment/docker.md`