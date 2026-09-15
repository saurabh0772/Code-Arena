# ADR-007: Keep the Public API Independent of Execution Infrastructure

## Status

Accepted

## Date

2026-09-15

## Context

The execution architecture is expected to evolve.

MVP:

```text
Backend
   |
   v
Execution Engine
   |
   v
Sandbox
```

Future:

```text
Backend
   |
   v
Queue
   |
   v
Worker Pool
   |
   v
Sandbox
```

Later:

```text
Backend
   |
   v
Queue
   |
   +---- Worker Pool
   |
   +---- Specialized Workers
   |
   v
Strong Isolation
```

If the public API directly exposes these infrastructure details, every architectural change could require frontend changes.

## Decision

The public API will expose **business-level submission resources**, not execution infrastructure.

The frontend should interact with:

```text
Submission
```

rather than:

```text
Worker
Queue
Container
Sandbox
```

Example:

```text
POST /api/v1/submissions
```

The API response should describe submission state:

```json
{
  "id": "submission123",
  "status": "QUEUED",
  "verdict": "PENDING"
}
```

The API should not expose:

```text
workerId
containerId
dockerHost
queuePartition
sandboxId
```

unless there is a strong operational reason to expose such information.

## Why

This creates an abstraction boundary:

```text
Public API
     |
     v
Submission
     |
     v
Internal Execution Infrastructure
```

The frontend only needs to know:

```text
Is my submission queued?
Is it running?
Did it pass?
What was the verdict?
```

It does not need to know how execution is implemented.

## Alternatives Considered

### Expose Execution Details

Rejected.

It would tightly couple the frontend to infrastructure.

### Build Separate APIs for Every Execution Component

Rejected for MVP because it unnecessarily increases API complexity.

## Consequences

### Positive

- Frontend remains stable.
- Execution infrastructure can evolve independently.
- Easier migration from synchronous to asynchronous execution.
- Easier migration from Docker to stronger sandbox technology.
- Cleaner API abstraction.

### Negative

- Backend must maintain an internal execution abstraction.
- Some infrastructure information is intentionally hidden from clients.

## Future Evolution

The public API can remain:

```text
POST /api/v1/submissions
```

while the internal implementation changes from:

```text
Synchronous Execution
```

to:

```text
Queue + Workers
```

without requiring a breaking API change.

This decision is therefore a key architectural boundary for CodeArena.