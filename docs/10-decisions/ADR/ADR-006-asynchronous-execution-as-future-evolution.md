# ADR-006: Evolve Toward Asynchronous Execution

## Status

Accepted

## Date

2026-09-15

## Context

Code execution is computationally expensive and can take significantly longer than normal API operations.

A synchronous architecture would look like:

```text
Client
  |
  v
Backend
  |
  v
Execution
  |
  v
Result
  |
  v
HTTP Response
```

This is simple for the MVP but becomes problematic as execution volume increases.

A large number of simultaneous submissions could cause:

- Long API request durations
- Increased memory usage
- Backend process pressure
- Poor API responsiveness
- Difficult horizontal scaling

## Decision

The MVP may use synchronous execution for simplicity.

However, the architecture will be designed so execution can later become asynchronous.

Future architecture:

```text
Client
  |
  v
Backend
  |
  v
Create Submission
  |
  v
Queue
  |
  v
Execution Worker
  |
  v
Sandbox
  |
  v
Result
```

The API can return:

```json
{
  "success": true,
  "data": {
    "id": "submission123",
    "status": "QUEUED",
    "verdict": "PENDING"
  }
}
```

## Why

Asynchronous execution provides:

- Better API responsiveness
- Independent execution scaling
- Worker pools
- Queue-based load management
- Better failure isolation
- Natural horizontal scaling

## Queue Responsibilities

A future queue will handle:

```text
Submission Job
```

rather than executing the submission directly.

Workers will consume jobs.

```text
Queue
  |
  +---- Worker 1
  +---- Worker 2
  +---- Worker 3
```

## Alternatives Considered

### Keep Synchronous Execution Permanently

Rejected for long-term scalability.

### Introduce Queue Immediately

Rejected for MVP because the initial system does not require distributed execution.

Adding a queue too early would increase:

- Infrastructure
- Debugging complexity
- Deployment complexity
- Failure scenarios

## Consequences

### Positive

- Clear scalability path.
- Execution can scale independently.
- API remains responsive.
- Worker failures can be isolated.

### Negative

Future asynchronous execution introduces:

- Eventual consistency
- Job retry handling
- Duplicate processing concerns
- Queue monitoring
- Worker management

## Future Architecture

```text
                 Load Balancer
                       |
                       v
                Backend Instances
                       |
                       v
                     Queue
                       |
          +------------+------------+
          |            |            |
          v            v            v
       Worker 1     Worker 2     Worker 3
          |            |            |
          v            v            v
       Sandbox      Sandbox      Sandbox
```

The current synchronous MVP should therefore be implemented behind an execution abstraction that can later be backed by a queue.