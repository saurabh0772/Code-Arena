# ADR-001: Use a Modular Monolith for the MVP

## Status

Accepted

## Date

2026-09-15

## Context

CodeArena is an online judge platform that needs several logical components:

- Authentication
- User management
- Problem management
- Test case management
- Submission management
- Code execution
- Database access

A microservices architecture could separate these responsibilities into independent services.

However, implementing microservices from the beginning would introduce additional infrastructure and operational complexity:

- Service discovery
- Inter-service communication
- Distributed debugging
- Multiple deployments
- Network failures
- Distributed logging
- Service-to-service authentication
- More complicated local development

The initial goal of CodeArena is to build a functional MVP while demonstrating strong backend and system-design principles.

## Decision

CodeArena will initially use a **modular monolith architecture**.

The Backend will contain clearly separated modules such as:

```text
backend/
├── auth/
├── users/
├── problems/
├── test-cases/
├── submissions/
└── ...
```

The Execution Engine will remain a clearly separated component because arbitrary user code requires a different security boundary.

The initial architecture is:

```text
Frontend
    |
    v
Backend Modular Monolith
    |
    +---- Auth
    +---- Users
    +---- Problems
    +---- Test Cases
    +---- Submissions
    |
    +---- Execution Adapter
              |
              v
        Execution Engine
              |
              v
        Docker Sandbox
```

## Why

A modular monolith provides:

- Simpler development
- Easier debugging
- Lower infrastructure overhead
- Faster MVP development
- Clear module boundaries
- Easier local development
- Easier database transactions
- A straightforward path toward future service extraction

The goal is to keep modules loosely coupled even though they initially run within the same Backend application.

## Alternatives Considered

### Microservices

Rejected for MVP.

Reasons:

- Too much operational complexity
- Distributed communication is unnecessary at small scale
- More difficult local development
- More difficult debugging
- Premature scaling

### Completely Monolithic Application

Rejected.

A completely unstructured monolith would make future evolution harder.

CodeArena therefore uses a modular monolith rather than a tightly coupled monolith.

## Consequences

### Positive

- Fast development
- Simple deployment
- Easier testing
- Lower infrastructure cost
- Clear internal boundaries
- Easy transition toward microservices later

### Negative

- Backend modules still share the same application process.
- A failure in the Backend process can affect multiple modules.
- Independent scaling of Backend modules is not possible initially.

## Future Evolution

If CodeArena grows, modules can be extracted gradually.

Possible future architecture:

```text
API Gateway
     |
     +---- Auth Service
     |
     +---- Problem Service
     |
     +---- Submission Service
     |
     +---- Execution Service
```

The architecture should evolve based on actual scaling and operational requirements rather than introducing microservices prematurely.