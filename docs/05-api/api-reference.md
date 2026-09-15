# CodeArena — API Reference

## 1. API Information

| Property | Value |
|---|---|
| Base Path | `/api/v1` |
| Protocol | HTTP/HTTPS |
| Format | JSON |
| Authentication | JWT |
| API Style | REST |

---

# 2. Authentication

Protected endpoints require:

```text
Authorization: Bearer <JWT>
```

Public endpoints do not require authentication.

---

# 3. Authentication Endpoints

## 3.1 Register User

```text
POST /api/v1/auth/register
```

### Authentication

Public

### Request

```json
{
  "name": "Saurabh",
  "email": "saurabh@example.com",
  "password": "StrongPassword123"
}
```

### Success

```text
201 Created
```

```json
{
  "success": true,
  "data": {
    "id": "user123",
    "name": "Saurabh",
    "email": "saurabh@example.com",
    "role": "USER"
  }
}
```

### Possible Errors

```text
400 VALIDATION_ERROR
409 EMAIL_ALREADY_EXISTS
```

---

## 3.2 Login

```text
POST /api/v1/auth/login
```

### Authentication

Public

### Request

```json
{
  "email": "saurabh@example.com",
  "password": "StrongPassword123"
}
```

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "user": {
      "id": "user123",
      "name": "Saurabh",
      "email": "saurabh@example.com",
      "role": "USER"
    }
  }
}
```

### Possible Errors

```text
400 VALIDATION_ERROR
401 INVALID_CREDENTIALS
```

---

## 3.3 Logout

```text
POST /api/v1/auth/logout
```

### Authentication

Required

### Success

```text
204 No Content
```

The exact token invalidation mechanism depends on the authentication implementation.

---

# 4. User Endpoints

## 4.1 Get Current User

```text
GET /api/v1/users/me
```

### Authentication

Required

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "id": "user123",
    "name": "Saurabh",
    "email": "saurabh@example.com",
    "role": "USER",
    "isActive": true
  }
}
```

### Possible Errors

```text
401 AUTHENTICATION_REQUIRED
404 RESOURCE_NOT_FOUND
```

---

# 5. Problem Endpoints

## 5.1 List Problems

```text
GET /api/v1/problems
```

### Authentication

Public

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `page` | No | Page number |
| `limit` | No | Results per page |
| `difficulty` | No | Filter by difficulty |
| `tag` | No | Filter by tag |
| `sort` | No | Sort field |

### Example

```text
GET /api/v1/problems?page=1&limit=20&difficulty=MEDIUM
```

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": [
    {
      "id": "problem123",
      "title": "Two Sum",
      "difficulty": "EASY",
      "tags": [
        "ARRAY",
        "HASHING"
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### Notes

Only active problems should be returned to normal users.

---

## 5.2 Get Problem

```text
GET /api/v1/problems/:problemId
```

### Authentication

Public

### Path Parameter

```text
problemId
```

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "id": "problem123",
    "title": "Two Sum",
    "description": "Find two numbers...",
    "difficulty": "EASY",
    "tags": [
      "ARRAY",
      "HASHING"
    ],
    "inputFormat": "...",
    "outputFormat": "...",
    "constraints": "...",
    "examples": [
      {
        "input": "[2,7,11,15], target=9",
        "output": "[0,1]"
      }
    ]
  }
}
```

### Security

Hidden test cases must not be included.

### Possible Errors

```text
404 PROBLEM_NOT_FOUND
```

---

# 6. Admin Problem Endpoints

The following endpoints require:

```text
ADMIN
```

---

## 6.1 Create Problem

```text
POST /api/v1/problems
```

### Authentication

Required

### Authorization

Admin only

### Request

```json
{
  "title": "Two Sum",
  "description": "Find two numbers...",
  "difficulty": "EASY",
  "tags": [
    "ARRAY",
    "HASHING"
  ],
  "inputFormat": "...",
  "outputFormat": "...",
  "constraints": "...",
  "examples": [
    {
      "input": "...",
      "output": "..."
    }
  ]
}
```

### Success

```text
201 Created
```

```json
{
  "success": true,
  "data": {
    "id": "problem123",
    "title": "Two Sum",
    "difficulty": "EASY"
  }
}
```

### Possible Errors

```text
400 VALIDATION_ERROR
401 AUTHENTICATION_REQUIRED
403 FORBIDDEN
```

---

## 6.2 Update Problem

```text
PATCH /api/v1/problems/:problemId
```

### Authentication

Required

### Authorization

Admin only

### Request

Only fields that need to change should be provided.

```json
{
  "difficulty": "MEDIUM",
  "tags": [
    "ARRAY",
    "HASHING"
  ]
}
```

### Success

```text
200 OK
```

### Possible Errors

```text
400 VALIDATION_ERROR
401 AUTHENTICATION_REQUIRED
403 FORBIDDEN
404 PROBLEM_NOT_FOUND
```

---

## 6.3 Deactivate Problem

```text
DELETE /api/v1/problems/:problemId
```

### Authentication

Required

### Authorization

Admin only

### Success

```text
204 No Content
```

The MVP should preferably use soft deletion:

```text
isActive = false
```

This preserves historical submission references.

---

# 7. Test Case Endpoints

Test case management is restricted to administrators.

---

## 7.1 Create Test Case

```text
POST /api/v1/problems/:problemId/test-cases
```

### Authentication

Required

### Authorization

Admin only

### Request

```json
{
  "input": "5\n1 2 3 4 5",
  "expectedOutput": "15",
  "visibility": "HIDDEN",
  "order": 1
}
```

### Success

```text
201 Created
```

```json
{
  "success": true,
  "data": {
    "id": "testcase123",
    "problemId": "problem123",
    "visibility": "HIDDEN",
    "order": 1
  }
}
```

### Possible Errors

```text
400 VALIDATION_ERROR
401 AUTHENTICATION_REQUIRED
403 FORBIDDEN
404 PROBLEM_NOT_FOUND
```

---

## 7.2 Update Test Case

```text
PATCH /api/v1/test-cases/:testCaseId
```

### Authentication

Required

### Authorization

Admin only

### Request

```json
{
  "expectedOutput": "20",
  "visibility": "HIDDEN"
}
```

### Success

```text
200 OK
```

### Possible Errors

```text
400 VALIDATION_ERROR
401 AUTHENTICATION_REQUIRED
403 FORBIDDEN
404 RESOURCE_NOT_FOUND
```

---

## 7.3 Deactivate Test Case

```text
DELETE /api/v1/test-cases/:testCaseId
```

### Authentication

Required

### Authorization

Admin only

### Success

```text
204 No Content
```

The preferred implementation is:

```text
isActive = false
```

---

# 8. Submission Endpoints

## 8.1 Create Submission

```text
POST /api/v1/submissions
```

### Authentication

Required

### Request

```json
{
  "problemId": "problem123",
  "language": "CPP",
  "sourceCode": "#include <iostream>\n..."
}
```

### Important Rule

The request must not contain:

```text
userId
```

The Backend obtains the authenticated user from the JWT.

---

## 8.2 Submission Validation

Before execution, the Backend validates:

```text
User authenticated
       ↓
Problem exists
       ↓
Problem active
       ↓
Language supported
       ↓
Source code present
       ↓
Source code size valid
```

---

## 8.3 MVP Success Response

The MVP may execute synchronously.

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "id": "submission123",
    "status": "COMPLETED",
    "verdict": "ACCEPTED",
    "runtimeMs": 42,
    "memoryKb": 10240,
    "testsPassed": 5,
    "totalTests": 5
  }
}
```

---

## 8.4 Future Async Response

The API can later return:

```text
201 Created
```

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

The public API remains centered around the Submission resource.

---

## 8.5 Possible Submission Errors

```text
400 VALIDATION_ERROR
401 AUTHENTICATION_REQUIRED
404 PROBLEM_NOT_FOUND
422 UNSUPPORTED_LANGUAGE
422 INVALID_SOURCE_CODE
429 RATE_LIMIT_EXCEEDED
503 EXECUTION_SERVICE_UNAVAILABLE
500 INTERNAL_SERVER_ERROR
```

---

# 9. Get Submission

## 9.1 Get Submission by ID

```text
GET /api/v1/submissions/:submissionId
```

### Authentication

Required

### Authorization

The authenticated user must own the submission, unless an authorized administrative policy permits access.

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": {
    "id": "submission123",
    "problemId": "problem123",
    "language": "CPP",
    "status": "COMPLETED",
    "verdict": "ACCEPTED",
    "runtimeMs": 42,
    "memoryKb": 10240,
    "testsPassed": 5,
    "totalTests": 5,
    "createdAt": "2026-09-15T10:00:00Z"
  }
}
```

### Possible Errors

```text
401 AUTHENTICATION_REQUIRED
403 FORBIDDEN
404 SUBMISSION_NOT_FOUND
```

---

# 10. Submission History

## 10.1 Get My Submissions

```text
GET /api/v1/submissions/me
```

### Authentication

Required

### Query Parameters

| Parameter | Required | Description |
|---|---|---|
| `page` | No | Page number |
| `limit` | No | Results per page |
| `problemId` | No | Filter by problem |

### Example

```text
GET /api/v1/submissions/me?page=1&limit=20
```

### Success

```text
200 OK
```

```json
{
  "success": true,
  "data": [
    {
      "id": "submission123",
      "problemId": "problem123",
      "language": "CPP",
      "status": "COMPLETED",
      "verdict": "ACCEPTED",
      "runtimeMs": 42,
      "memoryKb": 10240,
      "createdAt": "2026-09-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

The Backend automatically filters using the authenticated user's ID.

---

# 11. Supported Languages

The initial API accepts:

```text
CPP
PYTHON
JAVASCRIPT
```

Any other value should be rejected.

Example:

```text
language = CPP ✓

language = JAVA ✗
```

until Java support is explicitly added.

---

# 12. Submission Statuses

Initial statuses:

```text
SUBMITTED
RUNNING
COMPLETED
```

Future asynchronous statuses:

```text
QUEUED
EXECUTING
EVALUATING
```

---

# 13. Submission Verdicts

| Verdict | Meaning |
|---|---|
| `PENDING` | Evaluation not completed |
| `ACCEPTED` | All tests passed |
| `WRONG_ANSWER` | Output was incorrect |
| `COMPILATION_ERROR` | Compilation failed |
| `RUNTIME_ERROR` | Program crashed |
| `TIME_LIMIT_EXCEEDED` | Time limit exceeded |
| `MEMORY_LIMIT_EXCEEDED` | Memory limit exceeded |

---

# 14. Common Error Codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_CREDENTIALS` | Login credentials are incorrect |
| `AUTHENTICATION_REQUIRED` | Authentication is required |
| `FORBIDDEN` | User is not authorized |
| `RESOURCE_NOT_FOUND` | Resource does not exist |
| `EMAIL_ALREADY_EXISTS` | Email is already registered |
| `PROBLEM_NOT_FOUND` | Problem does not exist |
| `SUBMISSION_NOT_FOUND` | Submission does not exist |
| `UNSUPPORTED_LANGUAGE` | Language is not supported |
| `INVALID_SOURCE_CODE` | Source code is invalid |
| `EXECUTION_ERROR` | Execution infrastructure failed |
| `RATE_LIMIT_EXCEEDED` | Request limit exceeded |
| `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

# 15. Authentication Matrix

| Endpoint | Guest | User | Admin |
|---|---:|---:|---:|
| Register | ✓ | ✓ | ✓ |
| Login | ✓ | ✓ | ✓ |
| Logout | ✗ | ✓ | ✓ |
| Get Current User | ✗ | ✓ | ✓ |
| List Problems | ✓ | ✓ | ✓ |
| Get Problem | ✓ | ✓ | ✓ |
| Create Problem | ✗ | ✗ | ✓ |
| Update Problem | ✗ | ✗ | ✓ |
| Delete Problem | ✗ | ✗ | ✓ |
| Create Test Case | ✗ | ✗ | ✓ |
| Update Test Case | ✗ | ✗ | ✓ |
| Delete Test Case | ✗ | ✗ | ✓ |
| Create Submission | ✗ | ✓ | ✓ |
| Get Submission | ✗ | Owner | Admin* |
| My Submissions | ✗ | ✓ | ✓ |

`*` Administrative access should be explicitly defined by the authorization policy.

---

# 16. Security Rules

The API must enforce:

```text
Authentication
Authorization
Input Validation
Rate Limiting
Ownership Checks
Hidden Test Protection
Source Code Limits
```

The API must never trust authorization information supplied by the client.

---

# 17. Hidden Test Case Rule

Normal users must never receive:

```text
input
expectedOutput
```

for hidden test cases.

Example of data that must not be exposed:

```json
{
  "input": "secret input",
  "expectedOutput": "secret output"
}
```

The Execution Engine may access this information through a trusted internal flow.

---

# 18. API Request Flow

```text
HTTP Request
     |
     v
Authentication
     |
     v
Authorization
     |
     v
Validation
     |
     v
Controller
     |
     v
Service
     |
     v
Database / Execution Engine
     |
     v
Response
```

---

# 19. Execution API Boundary

The Execution Engine is an internal component.

Its API should not be treated as a public user API.

```text
Internet
   |
   v
Public API
   |
   v
Backend
   |
   v
Internal Execution Interface
   |
   v
Execution Engine
```

This prevents users from directly requesting arbitrary code execution infrastructure.

---

# 20. API Evolution

The public API should remain stable while internal implementation evolves.

MVP:

```text
POST /submissions
      |
      v
Synchronous Execution
```

Future:

```text
POST /submissions
      |
      v
Queue
      |
      v
Worker
```

The frontend should continue using the Submission API rather than interacting with the queue directly.

---

# 21. API Design Checklist

Before adding an endpoint, verify:

- Is the resource clearly defined?
- Is the HTTP method appropriate?
- Is authentication required?
- Is authorization required?
- Is input validated?
- Is pagination needed?
- Is rate limiting needed?
- Could sensitive data be exposed?
- Is the response consistent?
- Are error codes defined?
- Does the endpoint expose unnecessary infrastructure?

---

# 22. Current API Surface

```text
Authentication
├── POST /auth/register
├── POST /auth/login
└── POST /auth/logout

Users
└── GET /users/me

Problems
├── GET /problems
├── GET /problems/:problemId
├── POST /problems
├── PATCH /problems/:problemId
└── DELETE /problems/:problemId

Test Cases
├── POST /problems/:problemId/test-cases
├── PATCH /test-cases/:testCaseId
└── DELETE /test-cases/:testCaseId

Submissions
├── POST /submissions
├── GET /submissions/:submissionId
└── GET /submissions/me
```

---

## Final API Principle

The CodeArena API should expose **stable business resources** while keeping execution infrastructure behind the Backend.

```text
Public API
    ↓
Business Logic
    ↓
Execution Abstraction
    ↓
Execution Infrastructure
```

This allows CodeArena to evolve from synchronous execution to queues and worker pools without requiring a complete API redesign.