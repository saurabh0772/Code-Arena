# CodeArena — System Architecture

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | System Architecture |
| Version | 1.0 |
| Status | Approved |

---

## 2. Purpose

This document describes the high-level architecture of CodeArena.

The architecture focuses on:

- Clear component boundaries
- Secure code execution
- Simple MVP implementation
- Maintainability
- Future scalability

---

# 3. Architecture Overview

CodeArena follows a **modular monolith architecture** with asynchronous submission processing via **Redis**, **BullMQ**, and a dedicated background **Worker** daemon.

The major components are:

```text
Frontend (React SPA)
    │
    ▼
Backend API (Modular Monolith)
    │
    ├─── Persists ────▶ MongoDB
    │
    └─── Enqueues ───▶ Redis / BullMQ ({ submissionId })
                           │
                           ▼
                        Worker Daemon
                           │
                           ▼
                    Execution Engine Boundary
                           │
                           ▼
                     Docker Sandbox (codearena-sandbox:v1)
```

The Backend is the main API and submission producer layer.

The Worker is the autonomous queue consumer that orchestrates execution.

The Execution Engine is separated because it handles untrusted user code inside isolated, disposable Docker sandboxes.

---

# 4. Architecture Style

## MVP Architecture

The Backend uses a modular monolith structure.

```text
Backend
├── Auth Module
├── User Module
├── Problem Module
├── Test Case Module
├── Submission Module
└── Execution Adapter
```

All Backend modules initially run within the same application.

This keeps the MVP simple while maintaining logical boundaries.

---

# 5. Frontend

The Frontend provides the user interface.

Main responsibilities:

- User registration
- User login
- Problem browsing
- Problem details
- Code submission
- Submission result
- Submission history
- Admin interfaces

The Frontend communicates with the Backend through the REST API.

```text
Frontend
    |
    | HTTPS
    v
Backend API
```

The Frontend must never communicate directly with MongoDB or the execution sandbox.

---

# 6. Backend

The Backend is responsible for:

- Authentication
- Authorization
- Request validation
- Problem management
- Test case management
- Submission management
- Database access
- Execution orchestration
- API responses

The Backend acts as the main business-logic layer.

---

# 7. Backend Modules

## 7.1 Authentication Module

Responsible for:

- Registration
- Login
- Authentication
- Token handling
- Password security

---

## 7.2 User Module

Responsible for:

- User profile
- User roles
- User status
- User-related operations

---

## 7.3 Problem Module

Responsible for:

- Creating problems
- Updating problems
- Retrieving problems
- Filtering problems
- Problem availability

---

## 7.4 Test Case Module

Responsible for:

- Creating test cases
- Updating test cases
- Deactivating test cases
- Test case visibility

Hidden test cases are only available to trusted execution components.

---

## 7.5 Submission Module

Responsible for:

- Creating submissions
- Validating submissions
- Tracking submission status
- Storing execution results
- Retrieving submission history

---

## 7.6 Execution Adapter

The Execution Adapter separates the Submission module from the execution infrastructure.

```text
Submission Service
       |
       v
Execution Adapter
       |
       v
Execution Engine
```

This abstraction allows the execution architecture to change later without changing the public API.

---

# 8. Execution Engine

The Execution Engine is responsible for running submitted code.

Its responsibilities include:

- Execution request validation
- Language resolution
- Sandbox creation
- Source preparation
- Compilation
- Program execution
- Resource enforcement
- Output collection
- Output comparison
- Verdict generation
- Sandbox cleanup

---

# 9. Docker Sandbox

Each submission should run inside a disposable sandbox.

```text
Execution Engine
       |
       v
Docker Container
       |
       v
User Program
```

The sandbox should have:

- CPU limits
- Memory limits
- Execution timeout
- Process limits
- Output limits
- No network access
- Non-root execution
- Restricted filesystem

---

# 10. Database

MongoDB stores application data.

Primary collections:

```text
Users
Problems
TestCases
Submissions
```

The Backend is the primary application-level database access layer.

---

# 11. Request Flow

Normal API request:

```text
Client
  |
  v
HTTP Request
  |
  v
Route
  |
  v
Middleware
  |
  v
Controller
  |
  v
Service
  |
  v
Repository / Model
  |
  v
MongoDB
```

---

# 12. Submission Flow

Submission requests follow a different path because code execution is involved.

```text
Client
  |
  v
Backend API
  |
  v
Submission Service
  |
  v
Execution Adapter
  |
  v
Execution Engine
  |
  v
Docker Sandbox
  |
  v
Execution Result
  |
  v
Submission Service
  |
  v
MongoDB
```

---

# 13. Asynchronous Execution Model (Current Architecture)

CodeArena utilizes an asynchronous submission pipeline powered by Redis, BullMQ, and an autonomous Worker daemon.

```text
Frontend
   │
   ▼ HTTP POST /api/v1/submissions
Backend API
   │
   ▼ 1. Persist initial PENDING / QUEUED submission
MongoDB Submission
   │
   ▼ 2. Push job { submissionId } to BullMQ
Redis / BullMQ (submission-queue)
   │
   ▼ 3. Atomically claim job & transition to RUNNING
Worker Daemon
   │
   ▼ 4. Retrieve submission & test cases
Execution Engine
   │
   ▼ 5. Run untrusted code in ephemeral sandbox
Docker Sandbox (codearena-sandbox:v1)
   │
   ▼ 6. Persist final verdict, runtime, memory & status (COMPLETED/FAILED)
MongoDB Result
   │
   ▼ 7. Poll GET /api/v1/submissions/:id
Frontend User
```

This ensures HTTP request threads are never blocked by arbitrary compilation or execution times.

---

# 14. Execution Separation & Resilience

The background worker operates as an autonomous BullMQ consumer sharing the modular monolith code base, completely decoupled from HTTP request handling:

```text
Backend API (Express) ─── Enqueues { submissionId } ───► Redis 7.2 (BullMQ)
                                                               │
                                                               ▼ Consumes
                                                    Worker Daemon (BullMQ)
                                                               │
                                                               ▼
                                                     Execution Engine
                                                               │
                                                               ▼
                                                   Isolated Docker Sandbox
```

- Transient infrastructure exceptions trigger automatic retry attempts with exponential backoff.
- User code errors (compilation error, time limit exceeded, wrong answer) are completed application verdicts and do not trigger retries.
- The public API remains stable, allowing the frontend to poll for state updates.

---

# 15. Dependency Direction

The preferred dependency direction is:

```text
Controller
    |
    v
Service
    |
    v
Repository / Adapter
    |
    v
Infrastructure
```

Business logic should not depend directly on HTTP implementation details.

---

# 16. Important Architectural Boundaries

### Frontend → Backend

The Frontend communicates only through the public API.

### Backend → Database

Database access remains inside the Backend.

### Backend → Execution Engine

Execution requests pass through a defined execution interface.

### Execution Engine → Sandbox

The Execution Engine manages sandbox lifecycle.

### Sandbox → Host

User code must not receive unrestricted access to the host.

---

# 17. Why Modular Monolith?

Microservices are intentionally avoided for the MVP.

Benefits:

- Lower complexity
- Easier development
- Easier debugging
- Simpler deployment
- Faster iteration

However, internal modules remain separated so they can evolve independently later.

---

# 18. Architecture Principles

CodeArena follows these principles:

1. Keep the MVP simple.
2. Separate business logic from infrastructure.
3. Treat user code as untrusted.
4. Keep hidden test cases protected.
5. Avoid direct database access from the Frontend.
6. Keep public APIs stable.
7. Isolate execution from the main application.
8. Design clear boundaries for future scaling.

---

# 19. High-Level Architecture

```text
                         Internet
                            |
                            v
                       Frontend
                            |
                         HTTPS
                            |
                            v
                  +-------------------+
                  |      Backend      |
                  |-------------------|
                  | Auth              |
                  | Users             |
                  | Problems          |
                  | Test Cases        |
                  | Submissions       |
                  +---------+---------+
                            |
                 +----------+----------+
                 |                     |
                 v                     v
             MongoDB          Execution Engine
                                      |
                                      v
                                Docker Sandbox
                                      |
                                      v
                                  User Code
```

---

# 20. Future Evolution

The architecture can evolve without replacing the entire system.

Possible evolution:

```text
Modular Monolith
      |
      v
Queue + Workers
      |
      v
Independent Execution Scaling
      |
      v
Service Extraction Where Needed
```

Microservices should only be introduced when actual scaling or operational requirements justify them.