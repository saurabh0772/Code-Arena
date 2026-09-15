# CodeArena — Entity Relationship Diagram

## 1. Purpose

This document describes the relationships between the main CodeArena database entities.

The MVP contains four primary entities:

```text
User
Problem
TestCase
Submission
```

---

# 2. Entity Overview

```text
+-------------+
|    User     |
+-------------+
      |
      | 1:N
      |
      +------------------+
      |                  |
      v                  v
+-------------+    +-------------+
|   Problem   |    | Submission  |
+------+------+    +------+------+
       |                  |
       | 1:N              |
       v                  |
+-------------+           |
|  TestCase   |           |
+-------------+           |
       ^                  |
       |                  |
       +------------------+
```

---

# 3. User Entity

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

A User can:

- Author problems
- Create submissions

---

# 4. Problem Entity

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

A Problem:

- Belongs to an author
- Has many test cases
- Has many submissions

---

# 5. TestCase Entity

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

A TestCase belongs to one Problem.

---

# 6. Submission Entity

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

A Submission belongs to:

- One User
- One Problem

---

# 7. Relationships

## User → Problem

```text
User 1 ───────── N Problem
```

A user can author multiple problems.

Foreign/reference field:

```text
Problem.authorId
```

---

## User → Submission

```text
User 1 ───────── N Submission
```

A user can create multiple submissions.

Reference field:

```text
Submission.userId
```

---

## Problem → TestCase

```text
Problem 1 ────── N TestCase
```

A problem can have multiple test cases.

Reference field:

```text
TestCase.problemId
```

---

## Problem → Submission

```text
Problem 1 ────── N Submission
```

A problem can receive many submissions.

Reference field:

```text
Submission.problemId
```

---

# 8. Complete Relationship Diagram

```text
                     +----------------+
                     |      User      |
                     +-------+--------+
                             |
                 +-----------+-----------+
                 |                       |
              1:N|                    1:N|
                 |                       |
                 v                       v
        +----------------+       +----------------+
        |    Problem     |       |   Submission   |
        +-------+--------+       +-------+--------+
                |                        |
             1:N|                        |N:1
                |                        |
                v                        |
        +----------------+               |
        |    TestCase    |               |
        +----------------+               |
                                         |
                                         |
                     +-------------------+
                     |
                     v
                   Problem
```

---

# 9. Cardinality Summary

| Relationship | Cardinality |
|---|---|
| User → Problem | 1:N |
| User → Submission | 1:N |
| Problem → TestCase | 1:N |
| Problem → Submission | 1:N |

---

# 10. Embedding vs References

Public examples are embedded:

```text
Problem
   └── examples[]
```

Other major entities use references:

```text
Problem
   └── authorId

TestCase
   └── problemId

Submission
   ├── userId
   └── problemId
```

---

# 11. Design Rationale

The model avoids embedding large growing collections.

For example, submissions are not stored as:

```text
User
└── submissions[]
```

Instead:

```text
Submission
├── userId
└── problemId
```

This keeps documents manageable and allows independent pagination and indexing.

---

# 12. Data Ownership

| Entity | Primary Owner |
|---|---|
| User | User/Auth module |
| Problem | Problem module |
| TestCase | Test Case module |
| Submission | Submission module |

---

# 13. Historical Data

Problems and test cases may be deactivated rather than immediately removed.

This helps preserve relationships with historical submissions.

```text
Problem
   |
   +---- isActive = false
   |
   +---- Historical Submissions remain valid
```