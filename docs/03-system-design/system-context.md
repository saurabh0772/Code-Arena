# CodeArena — System Context

## 1. Purpose

This document describes CodeArena from a system-level perspective.

It identifies:

- Users
- External actors
- CodeArena
- External dependencies
- Major interactions

---

# 2. System Boundary

CodeArena is responsible for:

```text
Authentication
Problem Management
Submission Management
Code Execution
Test Evaluation
Result Storage
```

The following are outside the application boundary:

```text
User's Browser
MongoDB Infrastructure
Docker Runtime
Future Queue Infrastructure
```

---

# 3. Context Diagram

```text
                  +----------------+
                  |     User       |
                  +-------+--------+
                          |
                          | HTTPS
                          v
                +----------------------+
                |      CodeArena       |
                |----------------------|
                | Authentication       |
                | Problems             |
                | Submissions          |
                | Code Execution       |
                | Evaluation           |
                +----+------------+----+
                     |            |
                     |            |
                     v            v
               +---------+   +----------------+
               | MongoDB |   | Docker Runtime |
               +---------+   +-------+--------+
                                      |
                                      v
                                User Programs
```

---

# 4. Primary Actor

## User

A user interacts with CodeArena to:

- Create an account
- Log in
- Browse problems
- View problem details
- Submit code
- View verdicts
- View submission history

---

# 5. Administrator

An administrator is responsible for managing platform content.

Admin operations include:

- Create problems
- Update problems
- Deactivate problems
- Create test cases
- Update test cases
- Deactivate test cases

---

# 6. External Systems

## MongoDB

MongoDB stores:

- Users
- Problems
- Test cases
- Submissions

---

## Docker Runtime

Docker provides the execution environment used by the Execution Engine.

It runs submitted programs inside disposable containers.

---

# 7. Main Interactions

## User → CodeArena

```text
Register
Login
Browse Problems
Submit Code
View Results
```

---

## Administrator → CodeArena

```text
Create Problem
Update Problem
Manage Test Cases
```

---

## CodeArena → MongoDB

```text
Store Users
Read Problems
Read Test Cases
Store Submissions
Read Submission History
```

---

## CodeArena → Execution Environment

```text
Send Source Code
Send Execution Configuration
Execute Tests
Receive Execution Result
```

---

# 8. Context-Level Submission Flow

```text
User
  |
  | Source Code
  v
CodeArena
  |
  | Execution Request
  v
Execution Environment
  |
  | Verdict + Metrics
  v
CodeArena
  |
  | Result
  v
User
```

---

# 9. Context-Level Principle

The User interacts with **CodeArena**, not directly with:

- MongoDB
- Docker
- Execution workers
- Test case storage
- Internal infrastructure

This keeps infrastructure details behind the application boundary.

---

# 10. Future Context

The system may later introduce:

```text
CodeArena
    |
    v
Message Queue
    |
    v
Execution Workers
    |
    v
Sandbox Infrastructure
```

This change should remain internal to the system boundary from the user's perspective.