# CodeArena --- Project Recall / Master Context

> **Purpose:** This is the master recall document for the CodeArena
> project.\
> If context is lost in a future conversation, provide this file to
> ChatGPT so the project can be reconstructed accurately.

------------------------------------------------------------------------

## 1. Project Identity

**Project Name:** CodeArena

**Current tagline:** Online Judge & Secure Code Execution Platform

**Future tagline:** Distributed Online Judge & Secure Code Execution
Platform

**Project Type:** Online Judge / Competitive Programming Platform

**Primary Career Goal:** Backend Engineer / Backend Developer portfolio
project

**Core idea:** Users submit source code for programming problems.
CodeArena executes the code safely against public/hidden test cases and
returns a verdict such as Accepted, Wrong Answer, Compilation Error,
Runtime Error, Time Limit Exceeded, or Memory Limit Exceeded.

------------------------------------------------------------------------

## 2. Main Technical Goal

CodeArena is designed to demonstrate real backend engineering concepts:

-   REST API design
-   Authentication and authorization
-   MongoDB data modeling
-   Secure execution of untrusted code
-   Docker sandboxing
-   Resource limits
-   Execution orchestration
-   Error handling
-   Testing
-   Containerized deployment
-   Future queues and worker pools
-   Future horizontal scaling
-   Future distributed execution

**Important:** Do NOT over-engineer the MVP. The project starts simple
and evolves toward a distributed architecture.

------------------------------------------------------------------------

## 3. Current Architecture Decision

### MVP Architecture

The MVP uses a **modular monolith**, NOT microservices.

``` text
Frontend
    |
    v
Backend (Modular Monolith)
    |
    +----------> MongoDB
    |
    +----------> Execution Engine
                    |
                    v
               Docker Sandbox
```

The Backend contains logical modules:

-   Auth
-   Users
-   Problems
-   Test Cases
-   Submissions
-   Execution Adapter

The Execution Engine is a separate component/process boundary because
code execution is resource-intensive and security-sensitive.

### Future Architecture

``` text
Frontend
    |
    v
Load Balancer
    |
    v
Backend Instances
    |
    v
Queue
    |
    +---- Worker 1
    +---- Worker 2
    +---- Worker N
             |
             v
        Execution Engine
             |
             v
          Sandboxes
```

Do not call the MVP a fully distributed/microservices system.

------------------------------------------------------------------------

## 4. Repository Structure

``` text
CodeArena/
│
├── frontend/
├── backend/
├── execution-engine/
│
├── docs/
│   ├── 01-product/
│   │   ├── product-requirements.md
│   │   ├── user-stories.md
│   │   └── mvp-scope.md
│   │
│   ├── 02-requirements/
│   │   ├── functional-requirements.md
│   │   └── non-functional-requirements.md
│   │
│   ├── 03-system-design/
│   │   ├── architecture.md
│   │   ├── system-context.md
│   │   ├── container-diagram.md
│   │   ├── data-flow.md
│   │   └── scalability.md
│   │
│   ├── 04-database/
│   │   ├── database-design.md
│   │   ├── er-diagram.md
│   │   └── indexes.md
│   │
│   ├── 05-api/
│   │   ├── api-design.md
│   │   └── api-reference.md
│   │
│   ├── 06-security/
│   │   └── security-design.md
│   │
│   ├── 07-execution-engine/
│   │   ├── execution-flow.md
│   │   ├── sandbox-design.md
│   │   └── language-support.md
│   │
│   ├── 08-testing/
│   │   ├── test-strategy.md
│   │   └── test-cases.md
│   │
│   ├── 09-deployment/
│   │   ├── deployment.md
│   │   └── docker.md
│   │
│   └── 10-decisions/
│       └── ADR/
│
├── README.md
├── docker-compose.yml
└── .env.example
```

------------------------------------------------------------------------

## 5. Database

**Database:** MongoDB\
**ODM:** Mongoose

### Primary Collections

``` text
Users
Problems
TestCases
Submissions
```

### User

``` text
User
├── _id
├── name
├── email
├── passwordHash
├── role
├── isActive
├── createdAt
└── updatedAt
```

Roles:

``` text
USER
ADMIN
```

### Problem

``` text
Problem
├── _id
├── title
├── description
├── difficulty
├── tags
├── inputFormat
├── outputFormat
├── constraints
├── examples[]
├── authorId
├── isActive
├── createdAt
└── updatedAt
```

Difficulty:

``` text
EASY
MEDIUM
HARD
```

### TestCase

``` text
TestCase
├── _id
├── problemId
├── input
├── expectedOutput
├── visibility
├── order
├── isActive
├── createdAt
└── updatedAt
```

Visibility:

``` text
PUBLIC
HIDDEN
```

### Submission

``` text
Submission
├── _id
├── userId
├── problemId
├── language
├── sourceCode
├── status
├── verdict
├── runtimeMs
├── memoryKb
├── testsPassed
├── totalTests
├── errorMessage
├── createdAt
└── updatedAt
```

### Relationships

``` text
User 1:N Problem
User 1:N Submission
Problem 1:N TestCase
Problem 1:N Submission
```

### Important Database Decisions

-   Test cases are a separate collection.
-   Problem examples are embedded.
-   Submissions are referenced, not embedded.
-   Users are referenced by problems/submissions.
-   Hidden test data must never be returned to normal users.
-   Problems/test cases preferably use `isActive` for soft deletion.
-   Frontend never connects directly to MongoDB.

### Main Indexes

``` text
Users:
  email

Problems:
  isActive + difficulty
  tags

TestCases:
  problemId + isActive + order

Submissions:
  userId + createdAt
  problemId + createdAt
  userId + problemId + createdAt
```

------------------------------------------------------------------------

## 6. API

**Style:** REST\
**Version:** `/api/v1`\
**Format:** JSON\
**Authentication:** JWT

### Public

``` text
POST /api/v1/auth/register
POST /api/v1/auth/login

GET /api/v1/problems
GET /api/v1/problems/:problemId
```

### Protected

``` text
POST /api/v1/auth/logout

GET /api/v1/users/me

POST /api/v1/submissions
GET /api/v1/submissions/:submissionId
GET /api/v1/submissions/me
```

### Admin

``` text
POST /api/v1/problems
PATCH /api/v1/problems/:problemId
DELETE /api/v1/problems/:problemId

POST /api/v1/problems/:problemId/test-cases
PATCH /api/v1/test-cases/:testCaseId
DELETE /api/v1/test-cases/:testCaseId
```

### Submission Request

``` text
problemId
language
sourceCode
```

The client must NOT provide `userId`. The Backend derives the user from
authentication.

### Initial Languages

``` text
CPP
PYTHON
JAVASCRIPT
```

### Submission Status

Phase 12:

``` text
PENDING
QUEUED
RUNNING
COMPLETED
FAILED
```

### Verdicts

``` text
PENDING
ACCEPTED
WRONG_ANSWER
COMPILATION_ERROR
RUNTIME_ERROR
TIME_LIMIT_EXCEEDED
MEMORY_LIMIT_EXCEEDED
```

### Important API Principle

The public API exposes business resources, not infrastructure.

The API should not expose:

``` text
Docker
Queue
Worker
Sandbox
Internal execution details
```

The API should remain stable even when execution architecture changes.

------------------------------------------------------------------------

## 7. Security

Security is one of CodeArena's most important areas because the platform
executes **untrusted user code**.

### Authentication

-   JWT authentication
-   Password hashing using Argon2 preferred; bcrypt acceptable
-   Never store plaintext passwords
-   Never expose password hashes through normal APIs

### Authorization

Roles:

``` text
USER
ADMIN
```

Server-side RBAC is required.

Also enforce object-level authorization:

``` text
User A → Own Submission ✓
User A → User B's Submission ✗
```

### Input Security

Validate:

-   IDs
-   Email
-   Password
-   Language
-   Source code
-   Source code size
-   Query parameters

Never construct shell commands directly from user input.

Compiler/runtime commands come from trusted language configurations.

### Hidden Test Security

Normal users must never receive:

``` text
hidden input
hidden expected output
```

### Database Security

-   MongoDB should be private.
-   Frontend must not contain database credentials.
-   Use least-privilege database access.
-   Secrets must not be committed to Git.

------------------------------------------------------------------------

## 8. Execution Engine

### Responsibility

The Execution Engine:

1.  Validates execution request.
2.  Resolves language.
3.  Creates sandbox.
4.  Prepares source.
5.  Compiles if required.
6.  Executes program.
7.  Enforces resource limits.
8.  Captures output.
9.  Compares output.
10. Generates verdict.
11. Collects metrics.
12. Cleans up sandbox.

### Execution Flow

``` text
Submission
   |
   v
Backend
   |
   v
Execution Adapter
   |
   v
Execution Engine
   |
   v
Validate
   |
   v
Create Sandbox
   |
   v
Prepare Source
   |
   v
Compile
   |
   v
Execute Tests
   |
   v
Compare Output
   |
   v
Verdict
   |
   v
Cleanup
   |
   v
Backend
   |
   v
MongoDB
```

### MVP

Execution is synchronous and test cases are executed sequentially.

### Future

Execution becomes asynchronous using a queue and worker pool.

------------------------------------------------------------------------

## 9. Language Support

Initial languages:

``` text
C++
Python
JavaScript
```

Each language uses a trusted `LanguageConfig` concept:

``` text
LanguageConfig
├── identifier
├── sourceFilename
├── image
├── compiler
├── compileCommand
├── runCommand
└── resourceLimits
```

Example source filenames:

``` text
CPP        → main.cpp
PYTHON     → main.py
JAVASCRIPT → main.js
```

Runtime/compiler versions should be controlled and preferably versioned.

Example runtime images:

``` text
codearena/cpp-runtime:v1
codearena/python-runtime:v1
codearena/node-runtime:v1
```

Potential future languages:

``` text
Java
Go
Rust
C
Kotlin
```

------------------------------------------------------------------------

## 10. Sandbox

**MVP technology:** Docker containers

Every submission gets a disposable sandbox.

``` text
Create
  ↓
Configure
  ↓
Prepare
  ↓
Execute
  ↓
Collect Result
  ↓
Destroy
```

### Required Controls

``` text
CPU Limit
Memory Limit
Execution Timeout
Process/PID Limit
Output Limit
No Network
Restricted Filesystem
Non-root User
Reduced Capabilities
No-new-privileges where practical
No Docker Socket
No Application Secrets
```

### Critical Rule

User code must NEVER run directly on the Backend host.

``` text
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

### Docker Limitation

Docker shares the host kernel and is not a perfect security boundary.

Do not claim the MVP is equivalent to a hardened production online
judge.

Future stronger isolation may use:

``` text
Docker
  ↓
gVisor
  ↓
Firecracker / MicroVM
```

------------------------------------------------------------------------

## 11. Testing

Testing is layered:

``` text
Unit
  ↓
API
  ↓
Integration
  ↓
Execution
  ↓
Security
  ↓
E2E
  ↓
Performance / Load
```

### Critical P0 Areas

-   Authentication
-   Authorization
-   Submission ownership
-   Hidden test protection
-   Code execution
-   Correct verdicts
-   Timeout
-   Memory limits
-   Process limits
-   Output limits
-   Network isolation
-   Filesystem isolation
-   Secret isolation
-   Sandbox cleanup
-   Execution failure handling

### Execution Tests

Each supported language should test:

``` text
Accepted
Wrong Answer
Compilation/Syntax Error
Runtime Error
Timeout
Memory Limit
Large Output
```

### Sandbox Security Tests

Test attempts to:

``` text
Access Network
Access Host Filesystem
Access Other Submission
Access Environment Secrets
Access Docker Socket
Escalate Privileges
Create Excessive Processes
```

------------------------------------------------------------------------

## 12. Deployment

### MVP

``` text
Frontend
Backend
Execution Engine
MongoDB
Docker
```

Local development uses:

``` text
docker-compose.yml
```

### Production Concept

``` text
Internet
   |
   v
Frontend
   |
   v
Backend
   |
   +---- Managed/Private MongoDB
   |
   +---- Execution Engine
             |
             v
        Docker Sandboxes
```

### Deployment Principles

-   Frontend can deploy independently.
-   Backend is containerized.
-   Execution Engine is separately deployable.
-   MongoDB should be private.
-   HTTPS in production.
-   Health/readiness checks.
-   Graceful shutdown.
-   Structured logging.
-   Monitoring.
-   Backups.
-   Versioned container images.
-   CI/CD before deployment.
-   Rollback capability.

### Environment Variables

Backend may use:

``` text
NODE_ENV
PORT
MONGODB_URI
JWT_SECRET
FRONTEND_URL
EXECUTION_ENGINE_URL
```

Never commit real secrets.

------------------------------------------------------------------------

## 13. Scalability

### MVP

``` text
Backend
   |
   +---- MongoDB
   |
   +---- Execution Engine
```

### First Evolution

``` text
Backend
   |
   v
Queue
   |
   v
Worker Pool
```

### Later

``` text
Load Balancer
      |
      +---- Backend 1
      +---- Backend 2
      +---- Backend N
               |
               v
             Queue
               |
       +-------+-------+
       |       |       |
    Worker  Worker  Worker
```

### Scaling Principles

-   Keep API layer stateless.
-   Scale Backend horizontally.
-   Scale execution independently.
-   Use queues for backpressure.
-   Use indexes before complex database scaling.
-   Add caching only where useful.
-   Monitor bottlenecks before scaling.
-   Do not introduce Kubernetes/microservices prematurely.

------------------------------------------------------------------------

## 14. Documentation Philosophy

Documentation should be useful, not unnecessarily huge.

Target style:

-   Concise
-   Industry-oriented
-   No repeated explanations
-   Diagrams where useful
-   Decisions clearly documented
-   Each file has one clear purpose

Current documentation separation:

``` text
01-product
→ What are we building?

02-requirements
→ What must it do?

03-system-design
→ How is the system structured?

04-database
→ How is data stored?

05-api
→ How do clients interact with it?

06-security
→ How do we protect the system?

07-execution-engine
→ How is code executed?

08-testing
→ How do we verify it?

09-deployment
→ How is it deployed?

10-decisions/ADR
→ Why were important architectural decisions made?
```

------------------------------------------------------------------------

## 15. Important Architectural Decisions

The following decisions must remain consistent unless deliberately
changed:

1.  **CodeArena** is the project name.
2.  MVP uses a **modular monolith**, not microservices.
3.  Execution Engine is a separate component/boundary.
4.  MongoDB + Mongoose is the MVP database.
5.  TestCases are a separate collection.
6.  Problem examples are embedded.
7.  Submissions are referenced, not embedded.
8.  REST API uses `/api/v1`.
9.  JWT is used for authentication.
10. USER/ADMIN RBAC is used.
11. Object-level authorization is required.
12. C++/Python/JavaScript are the initial languages.
13. Docker is the MVP sandbox technology.
14. User code is never executed directly on the Backend host.
15. Sandbox has strict resource and network restrictions.
16. MVP execution is synchronous.
17. Test cases execute sequentially in the MVP.
18. Queue + worker pool is a future evolution.
19. Public API must remain independent of execution infrastructure.
20. Do not over-engineer the MVP.

------------------------------------------------------------------------

## 16. Current Project Status

### Documentation Completed

``` text
01-product       ✓
02-requirements  ✓
03-system-design ✓
04-database      ✓
05-api           ✓
06-security      ✓
07-execution     ✓
08-testing       ✓
09-deployment    ✓
```

### Next Documentation

``` text
10-decisions/ADR
```

Expected ADRs:

``` text
ADR-001 Modular Monolith over Microservices
ADR-002 MongoDB for MVP
ADR-003 REST API and /api/v1
ADR-004 Separate TestCases Collection
ADR-005 Docker Sandbox for MVP
ADR-006 Synchronous Execution for MVP
ADR-007 Separate Execution Engine Boundary
ADR-008 Stable Public API
ADR-009 Sequential Test Execution
ADR-010 Initial Language Support
```

After documentation, move toward implementation.

------------------------------------------------------------------------

## 17. Implementation Direction

Recommended implementation order:

``` text
1. Repository setup
      ↓
2. Backend project setup
      ↓
3. MongoDB + Mongoose
      ↓
4. User/Auth module
      ↓
5. Problem module
      ↓
6. Test Case module
      ↓
7. Submission module
      ↓
8. Execution Engine
      ↓
9. Docker sandbox
      ↓
10. API integration
      ↓
11. Frontend
      ↓
12. Testing
      ↓
13. Docker Compose
      ↓
14. Deployment
      ↓
15. Async queue/worker evolution
```

------------------------------------------------------------------------

## 18. Resume Positioning

The project should eventually be described as:

**CodeArena --- Online Judge & Secure Code Execution Platform**

Example resume bullets after implementation:

-   Built a MERN-based online judge platform with REST APIs for
    problems, submissions, authentication, and execution results.
-   Designed an isolated Docker-based execution engine for running
    untrusted C++, Python, and JavaScript code with CPU, memory, time,
    process, and output limits.
-   Designed the architecture for asynchronous execution using queues
    and scalable worker pools.

Only claim features that are actually implemented.

------------------------------------------------------------------------

## 19. Golden Rules for Future Work

When continuing CodeArena:

### Do

-   Keep architecture consistent.
-   Prefer simple MVP solutions.
-   Maintain clear module boundaries.
-   Treat user code as hostile.
-   Document important decisions.
-   Build before over-engineering.
-   Add distributed architecture incrementally.

### Do Not

-   Turn the MVP into microservices without a reason.
-   Add Kubernetes just for resume value.
-   Give user code Docker socket access.
-   Execute user code directly on the host.
-   Expose hidden test cases.
-   Let the Frontend access MongoDB.
-   Let clients choose arbitrary compiler commands.
-   Claim Docker is perfect isolation.
-   Claim distributed architecture before implementing it.

------------------------------------------------------------------------

## 20. One-Paragraph Recall

**CodeArena is a Backend Engineer-focused online judge and secure code
execution platform. The MVP is a modular monolith with a separate
Execution Engine boundary, MongoDB/Mongoose, REST `/api/v1` APIs, JWT
authentication, USER/ADMIN RBAC, separate TestCases collection, and
Docker-based disposable sandboxes. Users submit C++, Python, or
JavaScript code, which is executed sequentially against public/hidden
test cases under CPU, memory, time, process, output, network,
filesystem, and privilege restrictions. The MVP executes synchronously.
The architecture is intentionally designed to evolve later into
asynchronous queue + worker-pool execution with horizontal scaling and
stronger sandbox isolation such as gVisor or Firecracker. The project
documentation covers product, requirements, system design, database,
API, security, execution engine, testing, deployment, and ADRs. Keep the
MVP simple, secure, modular, and industry-oriented; do not prematurely
introduce microservices or Kubernetes.**
