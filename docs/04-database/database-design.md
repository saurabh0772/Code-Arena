# CodeArena — Database Design

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Database | MongoDB |
| ODM | Mongoose |
| Version | 1.0 |
| Status | Approved |

---

## 2. Purpose

This document defines the database architecture and data model used by CodeArena.

The MVP uses MongoDB because it fits well with the Node.js/MERN stack and provides a flexible document model.

---

# 3. Database Architecture

The Backend is the primary application layer responsible for database access.

```text
Frontend
    |
    v
Backend
    |
    v
MongoDB
```

The Frontend must never connect directly to MongoDB.

---

# 4. Primary Collections

CodeArena uses four primary collections:

```text
Users
Problems
TestCases
Submissions
```

High-level relationship:

```text
Users
  |
  +--------< Problems
  |
  +--------< Submissions
                 |
                 v
              Problems
                 |
                 v
             TestCases
```

---

# 5. Collection Overview

| Collection | Purpose |
|---|---|
| Users | User accounts and roles |
| Problems | Programming problem information |
| TestCases | Public and hidden evaluation data |
| Submissions | User code and execution results |

---

# 6. Users Collection

The `Users` collection stores account information.

Logical structure:

```text
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

---

## 6.1 User Fields

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Unique user identifier |
| `name` | String | User's display name |
| `email` | String | Unique email address |
| `passwordHash` | String | Hashed password |
| `role` | String | `USER` or `ADMIN` |
| `isActive` | Boolean | Account status |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

---

## 6.2 User Rules

- Email must be unique.
- Passwords must never be stored as plaintext.
- Password hashes must never be returned through normal APIs.
- Role must be validated.
- Inactive users should not be allowed to perform protected operations.

---

# 7. Problems Collection

The `Problems` collection stores programming problem information.

Logical structure:

```text
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

---

## 7.1 Problem Fields

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Problem identifier |
| `title` | String | Problem title |
| `description` | String | Problem statement |
| `difficulty` | String | `EASY`, `MEDIUM`, `HARD` |
| `tags` | Array[String] | Problem categories |
| `inputFormat` | String | Input description |
| `outputFormat` | String | Output description |
| `constraints` | String | Input constraints |
| `examples` | Array | Public examples |
| `authorId` | ObjectId | Reference to Users |
| `isActive` | Boolean | Problem availability |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

---

# 8. Problem Examples

Public examples are embedded inside the Problem document.

Example structure:

```text
examples[]
├── input
└── output
```

Examples are:

- Small
- Bounded
- Public
- Naturally associated with the problem

Therefore embedding is appropriate.

---

# 9. TestCases Collection

Test cases are stored separately from Problems.

Logical structure:

```text
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

---

## 9.1 Test Case Fields

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Test case identifier |
| `problemId` | ObjectId | Related problem |
| `input` | String | Program input |
| `expectedOutput` | String | Expected program output |
| `visibility` | String | `PUBLIC` or `HIDDEN` |
| `order` | Number | Execution/order position |
| `isActive` | Boolean | Whether test is active |
| `createdAt` | Date | Creation timestamp |
| `updatedAt` | Date | Last update timestamp |

---

# 10. Why Test Cases Are Separate

Test cases are not embedded inside Problems because:

- A problem can contain many test cases.
- Hidden test cases are sensitive.
- Test cases have an independent lifecycle.
- Test cases may grow independently.
- Execution requires controlled access to them.

Therefore:

```text
Problem
   |
   | 1:N
   v
TestCases
```

---

# 11. Test Case Visibility

Each test case has:

```text
PUBLIC
HIDDEN
```

Public test cases may be shown to users.

Hidden test cases must remain private.

```text
User
  |
  X---- Hidden Input
  |
  X---- Hidden Expected Output

Execution Engine
  |
  ✓---- Required Test Data
```

---

# 12. Submissions Collection

The `Submissions` collection stores user attempts and their execution results.

Logical structure:

```text
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

---

# 13. Submission Fields

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Submission identifier |
| `userId` | ObjectId | Submitting user |
| `problemId` | ObjectId | Target problem |
| `language` | String | Programming language |
| `sourceCode` | String | Submitted source code |
| `status` | String | Execution status |
| `verdict` | String | Evaluation result |
| `runtimeMs` | Number | Execution time |
| `memoryKb` | Number | Memory usage |
| `testsPassed` | Number | Passed tests |
| `totalTests` | Number | Total tests |
| `errorMessage` | String | Relevant execution error |
| `createdAt` | Date | Submission timestamp |
| `updatedAt` | Date | Last update timestamp |

---

# 14. Submission Status

Initial statuses:

```text
SUBMITTED
RUNNING
COMPLETED
```

Future asynchronous execution may introduce:

```text
QUEUED
EXECUTING
EVALUATING
```

---

# 15. Submission Verdict

Supported verdicts:

```text
PENDING
ACCEPTED
WRONG_ANSWER
COMPILATION_ERROR
RUNTIME_ERROR
TIME_LIMIT_EXCEEDED
MEMORY_LIMIT_EXCEEDED
```

---

# 16. Submission Relationships

A Submission references both a User and a Problem.

```text
User
  |
  | 1:N
  v
Submission
  ^
  |
  | N:1
  |
Problem
```

Submissions are not embedded inside either User or Problem documents.

---

# 17. Why Submissions Are Separate

Submissions can grow rapidly.

A single user may create:

```text
10 submissions
100 submissions
1000+ submissions
```

Embedding submissions inside Users or Problems would make documents unnecessarily large.

Separate storage allows:

- Independent pagination
- Efficient history queries
- Independent indexing
- Better long-term scalability

---

# 18. Relationships

## User → Problems

One user can author multiple problems.

```text
User 1 ─────── N Problem
```

Relationship field:

```text
Problem.authorId
```

---

## User → Submissions

One user can create multiple submissions.

```text
User 1 ─────── N Submission
```

Relationship field:

```text
Submission.userId
```

---

## Problem → TestCases

One problem can contain multiple test cases.

```text
Problem 1 ─────── N TestCase
```

Relationship field:

```text
TestCase.problemId
```

---

## Problem → Submissions

One problem can have many submissions.

```text
Problem 1 ─────── N Submission
```

Relationship field:

```text
Submission.problemId
```

---

# 19. Reference Strategy

CodeArena uses references for large or independently managed entities.

```text
Problem
   |
   +---- authorId → User

TestCase
   |
   +---- problemId → Problem

Submission
   |
   +---- userId → User
   |
   +---- problemId → Problem
```

---

# 20. Embedding Strategy

Small bounded data is embedded.

Currently:

```text
Problem
   |
   └── examples[]
```

Large or independently managed data is referenced.

```text
Problem
   |
   ├── TestCases
   └── Submissions
```

---

# 21. Data Integrity

The application must validate references before performing operations.

Examples:

```text
Submission
    |
    +---- problemId must refer to an existing problem

TestCase
    |
    +---- problemId must refer to an existing problem
```

Inactive resources should be handled according to business rules.

---

# 22. Soft Deletion

Problems and test cases should preferably use:

```text
isActive: false
```

instead of immediately removing historical data.

Example:

```text
Problem
   |
   +---- isActive = false
```

This allows historical submissions to continue referencing the original problem.

---

# 23. Source Code Storage

Submitted source code is stored with the Submission record for the MVP.

The system should enforce a maximum source-code size.

Large source code should not be accepted indefinitely.

---

# 24. Sensitive Data

The following data requires controlled access:

```text
passwordHash
hidden test input
hidden expected output
source code
```

Access should be limited according to user role and ownership.

---

# 25. Database Access Flow

```text
Frontend
    |
    X
    |
    v
Backend
    |
    v
Service Layer
    |
    v
Mongoose
    |
    v
MongoDB
```

The Frontend has no direct database credentials.

---

# 26. Database Design Principles

1. Keep documents reasonably sized.
2. Embed only small bounded data.
3. Reference independently managed entities.
4. Protect sensitive test case data.
5. Index real query patterns.
6. Use pagination for growing collections.
7. Preserve historical submissions.
8. Keep database access inside the Backend.
9. Validate references at the application layer.
10. Avoid unnecessary denormalization in the MVP.

---

# 27. Final Data Model

```text
                    +-------------+
                    |    Users    |
                    +------+------+
                           |
             +-------------+-------------+
             |                           |
             v                           v
       +-----------+               +-------------+
       |  Problems |               | Submissions |
       +-----+-----+               +------+------+
             |                            |
             |                            |
             v                            |
       +-----------+                      |
       | TestCases |<---------------------+
       +-----------+
```

The actual relationships are:

```text
User 1:N Problem
User 1:N Submission
Problem 1:N TestCase
Problem 1:N Submission
```