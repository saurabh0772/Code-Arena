🚀 What we create next
Step 1 — Finish ADRs

First:

docs/
└── 10-decisions/
    └── ADR/
        ├── ADR-001-modular-monolith.md
        ├── ADR-002-mongodb.md
        ├── ADR-003-rest-api.md
        ├── ADR-004-separate-testcases.md
        ├── ADR-005-docker-sandbox.md
        ├── ADR-006-synchronous-execution.md
        ├── ADR-007-separate-execution-engine.md
        ├── ADR-008-stable-public-api.md
        ├── ADR-009-sequential-execution.md
        └── ADR-010-language-support.md

These should be short, around 20–40 lines each.

They answer:

"Why did we make this architectural decision?"

Step 2 — Then we start actual development

After ADRs, we move from:

                    DOCUMENTATION
                         ↓
                   ARCHITECTURE
                         ↓
                       CODE

The first thing I recommend creating is the actual repository foundation.

Initial structure
CodeArena/
│
├── frontend/
│
├── backend/
│
├── execution-engine/
│
├── docs/
│
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── package.json / workspace config

But we won't build Frontend first.

Step 3 — Backend first

Since your goal is Backend Engineer, the backend should be the core of the project.

We'll create:

backend/
├── src/
│   ├── config/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── problems/
│   │   ├── test-cases/
│   │   └── submissions/
│   │
│   ├── middleware/
│   ├── utils/
│   ├── app.js
│   └── server.js
│
├── tests/
├── package.json
├── Dockerfile
└── .env.example

We're going to build this module by module.

Step 4 — MongoDB + Mongoose

Then we'll implement the database layer.

MongoDB
   ↑
Mongoose
   ↑
Repository / Models
   ↑
Services

First models:

User
Problem
TestCase
Submission

We'll implement the schemas according to the database documentation we already created.

Step 5 — Authentication

Then:

Register
   ↓
Hash Password
   ↓
Save User

and:

Login
   ↓
Verify Password
   ↓
Generate JWT
   ↓
Authenticated Request

Then middleware:

authenticate
authorize
Step 6 — Problem System

Then build:

Admin
  ↓
Create Problem
  ↓
Add Test Cases

and users:

User
  ↓
Get Problems
  ↓
Get Problem Details

At this point we'll have a functional problem management system.

Step 7 — Submission System

Then comes the important part:

User
  |
  | Submit Code
  v
Backend
  |
  v
Submission
  |
  v
Execution Adapter

Initially we won't immediately introduce Redis/BullMQ.

Remember:

MVP first.

Step 8 — Execution Engine 🔥

This is the most interesting part of CodeArena.

We'll create:

execution-engine/
├── src/
│   ├── config/
│   ├── languages/
│   ├── sandbox/
│   ├── executor/
│   ├── comparator/
│   ├── verdict/
│   └── server.js
│
├── tests/
├── Dockerfile
└── package.json

Then:

Backend
   ↓
Execution Engine
   ↓
Language Resolver
   ↓
Sandbox Manager
   ↓
Docker Container
   ↓
User Code
Step 9 — First working language

We'll start with C++.

Why?

Because it demonstrates the complete execution pipeline:

main.cpp
   ↓
g++
   ↓
Executable
   ↓
stdin
   ↓
Program
   ↓
stdout
   ↓
Comparator
   ↓
Verdict

Then add:

Python
JavaScript
Step 10 — Docker Sandbox

Then we'll make execution safe:

User Code
    ↓
Disposable Container
    ↓
CPU Limit
Memory Limit
Time Limit
Process Limit
Output Limit
No Network
Restricted Filesystem
Non-root
    ↓
Verdict

This is one of the strongest parts of the project for your resume.

Step 11 — Connect Backend + Execution Engine

Eventually:

POST /submissions
       ↓
Submission Service
       ↓
Execution Adapter
       ↓
Execution Engine
       ↓
Docker Sandbox
       ↓
Execution Result
       ↓
Submission Updated
       ↓
MongoDB

Now CodeArena actually works end-to-end.

Step 12 — Frontend

Only after the backend + execution pipeline works.

We'll then create the UI:

Login
   ↓
Problems
   ↓
Problem Details
   ↓
Code Editor
   ↓
Submit
   ↓
Verdict
   ↓
Submission History

The frontend is basically the interface over the backend system we've already built.

Step 13 — Testing

Then we implement the testing strategy we already documented:

Unit Tests
    ↓
API Tests
    ↓
Integration Tests
    ↓
Execution Tests
    ↓
Sandbox Security Tests
    ↓
E2E Tests
Step 14 — Docker Compose

Then make the entire project runnable with:

docker compose up

which starts:

Frontend
Backend
Execution Engine
MongoDB
Step 15 — Deployment

Finally:

Local
  ↓
Dockerized
  ↓
Production
  ↓
Monitoring
Step 16 — THEN evolve it toward distributed architecture

This is where the project becomes much more interesting.

Current:

Backend
   ↓
Execution Engine
   ↓
Sandbox

Future:

Backend
   ↓
Redis / Queue
   ↓
Worker Pool
   ↓
Execution Engine
   ↓
Sandbox

Then potentially:

                    Load Balancer
                         |
             +-----------+-----------+
             |           |           |
          Backend     Backend     Backend
             |           |           |
             +-----------+-----------+
                         |
                       Queue
                         |
          +--------------+--------------+
          |              |              |
       Worker 1       Worker 2       Worker N
          |              |              |
       Sandbox        Sandbox        Sandbox

This is when "Distributed Online Judge" becomes a technically accurate description.

🧭 Complete Roadmap

So our project journey is:

DOCUMENTATION
     │
     ├── 01 Product                 ✓
     ├── 02 Requirements            ✓
     ├── 03 System Design           ✓
     ├── 04 Database                ✓
     ├── 05 API                    ✓
     ├── 06 Security               ✓
     ├── 07 Execution Engine       ✓
     ├── 08 Testing                ✓
     ├── 09 Deployment             ✓
     └── 10 ADRs                    ← NEXT
              │
              ▼
       PROJECT FOUNDATION
              │
              ▼
          BACKEND SETUP
              │
              ▼
        DATABASE + MODELS
              │
              ▼
       AUTHENTICATION/RBAC
              │
              ▼
       PROBLEM MANAGEMENT
              │
              ▼
       TEST CASE MANAGEMENT
              │
              ▼
       SUBMISSION SYSTEM
              │
              ▼
       EXECUTION ENGINE
              │
              ▼
        DOCKER SANDBOX
              │
              ▼
      BACKEND ↔ EXECUTION
              │
              ▼
           FRONTEND
              │
              ▼
           TESTING
              │
              ▼
        DOCKER COMPOSE
              │
              ▼
          DEPLOYMENT
              │
              ▼
       ─── MVP COMPLETE ───
              │
              ▼
       ASYNC EXECUTION
              │
              ▼
        QUEUE + WORKERS
              │
              ▼
      HORIZONTAL SCALING
              │
              ▼
     DISTRIBUTED CODEARENA