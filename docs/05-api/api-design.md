# CodeArena — API Design

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| API Style | REST |
| Version | v1 |
| Format | JSON |
| Authentication | JWT |
| Status | Approved |

---

# 2. Purpose

This document defines the design principles and conventions for the CodeArena REST API.

The API provides access to:

- Authentication
- Users
- Problems
- Test cases
- Submissions

The public API should remain independent of internal infrastructure such as Docker, workers, and queues.

---

# 3. API Base URL

The API uses versioned endpoints.

```text
/api/v1
```

Example:

```text
GET /api/v1/problems
```

Versioning allows future breaking changes to be introduced without immediately breaking existing clients.

---

# 4. API Architecture

The request flow follows:

```text
Client
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

For submissions:

```text
Client
   |
   v
Submission Controller
   |
   v
Submission Service
   |
   v
Execution Adapter
   |
   v
Execution Engine
```

---

# 5. HTTP Methods

CodeArena follows standard HTTP methods.

| Method | Purpose |
|---|---|
| GET | Retrieve resource |
| POST | Create resource/action |
| PATCH | Partially update resource |
| DELETE | Delete/deactivate resource |

Examples:

```text
GET    /api/v1/problems
POST   /api/v1/problems
PATCH  /api/v1/problems/:problemId
DELETE /api/v1/problems/:problemId
```

---

# 6. Resource-Oriented URLs

URLs represent resources rather than implementation details.

Preferred:

```text
GET /api/v1/problems/:problemId
```

Avoid exposing infrastructure through public URLs:

```text
/sandbox/:id
/worker/:id
/docker/:id
/queue/:id
```

---

# 7. Authentication

Protected endpoints use JWT authentication.

Conceptually:

```text
Client
   |
   | Authorization: Bearer <token>
   v
Backend
   |
   v
JWT Verification
   |
   v
Authenticated Request
```

The authenticated user's identity is derived from the token.

---

# 8. Authorization

Authentication determines **who the user is**.

Authorization determines **what the user can do**.

CodeArena initially has:

```text
USER
ADMIN
```

Example:

```text
USER
  |
  X---- Create Problem

ADMIN
  |
  ✓---- Create Problem
```

Authorization must always be enforced server-side.

---

# 9. Object-Level Authorization

Users must only access resources they are authorized to access.

For example:

```text
User A
   |
   +---- Submission A ✓

User A
   |
   +---- Submission B ✗
```

The Backend must verify ownership before returning private submission information.

---

# 10. Request Format

Requests containing data should use JSON.

Example:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

The API should validate request bodies before passing data to business logic.

---

# 11. Response Format

Successful responses should follow a consistent structure.

Example:

```json
{
  "success": true,
  "data": {}
}
```

For collections:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

# 12. Error Format

Errors should follow a consistent structure.

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

The API should avoid exposing internal stack traces or sensitive infrastructure details.

---

# 13. HTTP Status Codes

CodeArena uses standard HTTP status codes.

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 201 | Resource created |
| 204 | Successful request with no body |
| 400 | Invalid request |
| 401 | Authentication required/failed |
| 403 | Access denied |
| 404 | Resource not found |
| 409 | Resource conflict |
| 422 | Validation/business rule failure |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Dependency/service unavailable |

---

# 14. Validation

All client-controlled input must be validated.

Validation should cover:

- Required fields
- Data types
- String lengths
- Enum values
- IDs
- Source code size
- Query parameters

Example:

```text
language = CPP ✓

language = RANDOM_LANGUAGE ✗
```

---

# 15. Pagination

List endpoints should support pagination.

Example:

```text
GET /api/v1/problems?page=1&limit=20
```

Recommended default:

```text
page = 1
limit = 20
```

Maximum limits should be enforced to prevent unnecessarily large responses.

---

# 16. Filtering

Problem listing supports filters such as:

```text
difficulty
tag
```

Example:

```text
GET /api/v1/problems?difficulty=MEDIUM
```

Multiple filters may be combined where supported.

---

# 17. Sorting

List endpoints may support controlled sorting.

Example:

```text
GET /api/v1/problems?sort=createdAt
```

Only predefined sort fields should be accepted.

Clients should not be allowed to provide arbitrary database expressions.

---

# 18. Rate Limiting

Rate limiting should protect resource-intensive endpoints.

Higher-priority endpoints include:

```text
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/submissions
```

Submission requests should have stricter limits because they trigger code execution.

---

# 19. Submission API

The submission endpoint accepts:

```json
{
  "problemId": "65f123...",
  "language": "CPP",
  "sourceCode": "#include <iostream>..."
}
```

The Backend derives:

```text
userId
```

from the authenticated user.

The client must not be trusted to specify another user's ID.

---

# 20. Submission Execution Boundary

The public API does not expose execution infrastructure.

The client interacts with:

```text
Submission
```

not:

```text
Worker
Queue
Container
Sandbox
```

This allows the internal execution architecture to evolve.

---

# 21. MVP Submission Behavior

The MVP may execute submissions synchronously.

```text
POST /submissions
       |
       v
Execute
       |
       v
Evaluate
       |
       v
Return Result
```

Future versions may use asynchronous execution.

```text
POST /submissions
       |
       v
Create Submission
       |
       v
Queue
       |
       v
Worker
```

---

# 22. Future Asynchronous Response

A future asynchronous submission may return:

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

The frontend can then retrieve the submission status separately.

---

# 23. Hidden Test Case Protection

Normal users must never receive:

```text
Hidden input
Hidden expected output
```

The problem API should return only public examples.

The Execution Engine may receive hidden test data through a trusted internal path.

---

# 24. API and Database Separation

The API should not expose database implementation details unnecessarily.

For example, clients should work with:

```text
problemId
submissionId
userId
```

rather than MongoDB-specific implementation details.

---

# 25. API and Execution Separation

The API should not depend on whether execution uses:

```text
Synchronous Engine
Queue
Worker Pool
Docker
gVisor
MicroVM
```

These are internal implementation details.

---

# 26. API Version Evolution

Current:

```text
/api/v1
```

Future breaking version:

```text
/api/v2
```

Non-breaking additions should generally remain within the current version.

Breaking changes should be evaluated carefully before introducing a new version.

---

# 27. API Design Principles

CodeArena follows these principles:

1. RESTful resource design.
2. Versioned API.
3. Consistent responses.
4. Consistent errors.
5. Server-side validation.
6. Server-side authorization.
7. Pagination for large collections.
8. Rate limiting for sensitive operations.
9. No hidden test case leakage.
10. No infrastructure details in the public API.
11. Stable API contracts.
12. Internal architecture can evolve independently.