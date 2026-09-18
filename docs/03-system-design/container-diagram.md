# CodeArena — Container Diagram

## 1. Purpose

This document describes the major deployable/runtime components of CodeArena and how they communicate.

The diagram focuses on the MVP architecture.

---

# 2. Container Overview

The Phase 12 architecture contains:

```text
Frontend (React / Vite / Nginx)
Backend (Modular Monolith API Producer)
Redis (BullMQ Queue Transport)
Worker (Background Daemon Consumer)
Execution Engine Boundary
MongoDB (Document Database)
Docker Sandbox (Disposable codearena-sandbox:v1)
```

---

# 3. Container Diagram

```text
                         User
                           │
                           │ HTTPS (Port 5173 / 80)
                           ▼
                 +-------------------+
                 |     Frontend      |
                 |   React / Nginx   |
                 +---------+---------+
                           │
                           │ REST / JSON (Port 5000)
                           ▼
                 +-------------------+
                 |    Backend API    |
                 |  Modular Monolith |
                 +----+---------+----+
                      │         │
             MongoDB  │         │ BullMQ Enqueue ({ submissionId })
                      │         ▼
                      │    +---------+
                      │    |  Redis  |
                      │    | 7.2 Alp |
                      │    +----+----+
                      │         │
                      │         │ Dequeue Job
                      │         ▼
                      │    +---------+
                      │    | Worker  |
                      │    | Daemon  |
                      │    +----+----+
                      │         │
                      │         │ Internal Module Call
                      │         ▼
                      │    +------------------+
                      │    | Execution Engine |
                      │    +--------+---------+
                      │             │
                      │             │ Docker API Socket
                      │             ▼
                      │     +---------------+
                      │     | Docker Sandbox|
                      │     | codearena-    |
                      │     |  sandbox:v1   |
                      │     +---------------+
                      │             │
                      │ Update      │ Persist Verdict
                      ▼ Result      ▼
                 +-------------------+
                 |      MongoDB      |
                 +-------------------+
```

---

# 4. Frontend Container

## Responsibility

Provides the browser-based user interface.

Main responsibilities:

- Authentication UI
- Problem pages
- Code editor
- Submission UI
- Result display
- Submission history
- Admin UI

## Communication

```text
Frontend → Backend
```

The Frontend does not directly communicate with MongoDB or Docker.

---

# 5. Backend Container

## Responsibility

The Backend contains the main business logic.

Modules include:

```text
Auth
Users
Problems
Test Cases
Submissions
```

It also contains an Execution Adapter for communicating with the Execution Engine.

---

# 6. Execution Engine Container

The Execution Engine handles code execution orchestration.

Responsibilities:

- Validate execution requests
- Resolve language configuration
- Create sandbox
- Execute code
- Enforce limits
- Evaluate output
- Return execution result
- Clean up sandbox

The Execution Engine should not expose unnecessary administrative APIs publicly.

---

# 7. MongoDB Container

MongoDB stores application data.

Collections:

```text
Users
Problems
TestCases
Submissions
```

MongoDB should be placed on a private network in production.

---

# 8. Docker Sandbox

The sandbox is created dynamically for a submission.

```text
Execution Engine
       |
       v
Create Container
       |
       v
Run User Code
       |
       v
Collect Result
       |
       v
Remove Container
```

The sandbox is not a permanent application container.

---

# 9. Communication

| From | To | Protocol |
|---|---|---|
| Browser | Frontend | HTTPS |
| Frontend | Backend | HTTPS / REST |
| Backend | MongoDB | MongoDB protocol |
| Backend | Execution Engine | HTTP/REST initially |
| Execution Engine | Docker | Docker runtime API |

---

# 10. Network Boundaries

The system should use separate network boundaries.

Conceptually:

```text
Public Network
      |
      v
Frontend / Backend
      |
      +-------- Private Application Network
                    |
                    +---- MongoDB
                    |
                    +---- Execution Engine
```

The exact Docker networking configuration can be refined during deployment.

---

# 11. Execution Network Boundary

Submitted programs must have no normal outbound network access.

```text
Execution Engine
       |
       v
Sandbox
       |
       X
   Internet
```

This prevents submitted code from making arbitrary external requests.

---

# 12. Container Lifecycle

Application containers:

```text
Start
  ↓
Run
  ↓
Stay available
```

Sandbox containers:

```text
Create
  ↓
Prepare
  ↓
Execute
  ↓
Collect Result
  ↓
Destroy
```

---

# 13. MVP Deployment View

```text
                 Internet
                    |
              +-----+-----+
              |           |
              v           v
          Frontend      Backend
                            |
                +-----------+-----------+
                |                       |
                v                       v
             MongoDB             Execution Engine
                                        |
                                        v
                                  Docker Sandbox
```

---

# 14. Future Container Architecture

As execution traffic increases:

```text
Backend
   |
   v
Queue
   |
   +---- Execution Worker
   |
   +---- Execution Worker
   |
   +---- Execution Worker
```

Workers can then scale independently from Backend instances.

---

# 15. Important Boundary

The Docker sandbox must never expose the Docker socket to user code.

```text
Execution Engine
      |
      | manages containers
      v
Docker Runtime
      |
      v
Sandbox
      |
      X
Docker Socket
```

The sandbox receives only the resources required to execute the submission.