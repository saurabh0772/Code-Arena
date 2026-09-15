# CodeArena — MVP Scope

## 1. Purpose

This document defines what will and will not be included in the first working version of CodeArena.

The goal is to build a functional online judge with a strong backend architecture without introducing unnecessary complexity.

---

# 2. MVP Objective

The MVP must allow a user to:

```text
Register
   ↓
Login
   ↓
Browse Problems
   ↓
View Problem
   ↓
Submit Code
   ↓
Execute Code
   ↓
Evaluate Test Cases
   ↓
Receive Verdict
   ↓
View Submission
```

---

# 3. MVP Components

The MVP consists of:

```text
Frontend
Backend
Execution Engine
MongoDB
Docker Sandbox
```

High-level architecture:

```text
                Frontend
                    |
                    v
             Backend API
              /         \
             /           \
            v             v
       MongoDB       Execution Engine
                           |
                           v
                      Docker Sandbox
```

---

# 4. MVP Features

## 4.1 Authentication

Included:

- User registration
- User login
- JWT authentication
- Password hashing
- Authenticated user information
- Basic logout/token invalidation strategy

---

## 4.2 Problem Management

Users can:

- View problem list
- Filter problems
- View problem details

Administrators can:

- Create problems
- Update problems
- Delete/deactivate problems

---

## 4.3 Test Case Management

Administrators can:

- Add test cases
- Update test cases
- Delete/deactivate test cases
- Define public/hidden visibility

Hidden test cases must remain inaccessible to normal users.

---

## 4.4 Code Submission

Users can submit:

- Problem ID
- Programming language
- Source code

Initial languages:

```text
C++
Python
JavaScript
```

---

## 4.5 Code Execution

The Execution Engine will:

1. Validate execution request.
2. Create sandbox.
3. Prepare source code.
4. Compile if required.
5. Execute program.
6. Apply resource limits.
7. Capture output.
8. Compare output.
9. Generate verdict.
10. Clean up sandbox.

---

## 4.6 Verdict System

Initial verdicts:

| Verdict | Meaning |
|---|---|
| `PENDING` | Evaluation has not completed |
| `ACCEPTED` | All required tests passed |
| `WRONG_ANSWER` | Output differs from expected output |
| `COMPILATION_ERROR` | Source code failed to compile |
| `RUNTIME_ERROR` | Program crashed during execution |
| `TIME_LIMIT_EXCEEDED` | Program exceeded execution time |
| `MEMORY_LIMIT_EXCEEDED` | Program exceeded memory limit |

---

## 4.7 Submission History

Users can view their previous submissions.

Each submission contains:

- Problem
- Language
- Source code
- Status
- Verdict
- Runtime
- Memory
- Tests passed
- Total tests
- Timestamp

---

# 5. MVP Database

The MVP uses MongoDB.

Primary collections:

```text
Users
Problems
TestCases
Submissions
```

Relationships:

```text
User
 ├── Problems
 └── Submissions

Problem
 ├── TestCases
 └── Submissions
```

---

# 6. MVP API

The API will use:

```text
/api/v1
```

Core endpoints include:

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/problems
GET    /api/v1/problems/:problemId

GET    /api/v1/users/me

POST   /api/v1/submissions
GET    /api/v1/submissions/:submissionId
GET    /api/v1/submissions/me
```

Administrative endpoints will handle problem and test-case management.

---

# 7. MVP Security

The MVP must protect both the application and the execution environment.

Required controls:

- JWT authentication
- Password hashing
- Role-based authorization
- Object-level authorization
- Request validation
- Rate limiting
- Source-code size limits
- Supported-language whitelist
- Hidden test case protection
- Docker sandboxing
- No network access for submitted programs
- CPU limits
- Memory limits
- Process limits
- Execution timeout
- Output limits
- No application secrets inside sandbox

---

# 8. MVP Execution Architecture

The initial execution flow is synchronous:

```text
Client
  |
  v
Backend
  |
  v
Execution Engine
  |
  v
Docker Sandbox
  |
  v
Execute + Evaluate
  |
  v
Result
  |
  v
Backend
  |
  v
Client
```

The architecture will keep an abstraction around execution so that asynchronous execution can be introduced later.

---

# 9. Explicitly Out of MVP

The following features are not part of the initial implementation:

### Platform Features

- Contests
- Leaderboards
- Ratings
- Badges
- Social features
- Discussion forums
- Follow system
- User messaging

### Advanced Judge Features

- Plagiarism detection
- Custom checkers
- Interactive problems
- Multi-file submissions
- Special judge
- Distributed test execution

### Infrastructure

- Kubernetes
- Service mesh
- Multi-region deployment
- Complex microservice architecture
- Global worker federation

### Advanced Analytics

- Detailed user statistics
- Recommendation engine
- Learning paths
- Advanced performance analytics

---

# 10. MVP Architecture Principles

The MVP follows these principles:

### Principle 1 — Keep It Simple

Do not introduce infrastructure that is not required by the MVP.

### Principle 2 — Maintain Boundaries

Modules should have clear responsibilities even inside the modular monolith.

### Principle 3 — Secure Untrusted Code

User code must never execute directly on the Backend host.

### Principle 4 — Keep API Stable

The public API should not depend on internal execution infrastructure.

### Principle 5 — Design for Evolution

Future queues, workers, and stronger sandboxing should be possible without rewriting the entire system.

---

# 11. MVP Completion Criteria

The MVP is complete when all of the following work:

- User can register.
- User can log in.
- User can browse problems.
- User can view problem details.
- Admin can create problems.
- Admin can manage test cases.
- User can submit code.
- C++ execution works.
- Python execution works.
- JavaScript execution works.
- Code executes inside a sandbox.
- Resource limits are enforced.
- Outputs are compared correctly.
- Correct verdicts are generated.
- Submission results are stored.
- Users can view their own submission history.
- Users cannot access another user's private submissions.
- Hidden test cases remain protected.
- Sandbox resources are cleaned after execution.
- Core API and execution flows are tested.

---

# 12. Post-MVP Evolution

After the MVP is stable, CodeArena can evolve toward:

```text
                Load Balancer
                     |
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

Potential additions:

- Redis
- Job queue
- Worker pool
- Real-time status
- Horizontal scaling
- Stronger sandbox isolation
- Additional languages
- Contest system
- Leaderboards

These changes should be introduced only when justified by actual requirements.

---

# 13. Scope Summary

| Area | MVP |
|---|---|
| Authentication | Yes |
| Problem Management | Yes |
| Test Cases | Yes |
| Code Submission | Yes |
| Code Execution | Yes |
| C++ | Yes |
| Python | Yes |
| JavaScript | Yes |
| Docker Sandbox | Yes |
| Submission History | Yes |
| Admin Management | Yes |
| Async Queue | Future |
| Worker Pool | Future |
| Contests | Future |
| Leaderboards | Future |
| Microservices | Future |
| Kubernetes | Future |

---

## Final MVP Boundary

The MVP focuses on one core capability:

> **Safely execute user-submitted code against programming problem test cases and return a reliable verdict.**

Everything else should support this core workflow without unnecessarily increasing MVP complexity.