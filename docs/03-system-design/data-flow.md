# CodeArena — Data Flow

## 1. Purpose

This document describes how data moves through CodeArena during important operations.

The main flows are:

- Authentication
- Problem retrieval
- Code submission
- Code execution
- Result storage
- Submission history

---

# 2. General Request Flow

```text
Client
  |
  v
Frontend
  |
  v
Backend API
  |
  v
Controller
  |
  v
Service
  |
  +------> Database
  |
  +------> Execution Engine
```

---

# 3. Registration Flow

```text
User
  |
  | Registration Data
  v
Frontend
  |
  | POST /auth/register
  v
Backend
  |
  | Validate
  v
Auth Service
  |
  | Hash Password
  v
MongoDB
  |
  | User Created
  v
Backend
  |
  v
Frontend
```

The plaintext password must not be stored.

---

# 4. Login Flow

```text
User
  |
  | Email + Password
  v
Frontend
  |
  v
Backend
  |
  v
Auth Service
  |
  v
MongoDB
  |
  | User + Password Hash
  v
Auth Service
  |
  | Verify Credentials
  v
JWT / Session Token
  |
  v
Frontend
```

---

# 5. Problem Retrieval Flow

```text
User
  |
  v
Frontend
  |
  | GET /problems/:id
  v
Backend
  |
  v
Problem Service
  |
  v
MongoDB
  |
  | Problem Data
  v
Backend
  |
  | Sanitized Response
  v
Frontend
```

Hidden test case data is not included in the response.

---

# 6. Submission Flow

A submission begins when an authenticated user sends:

```text
problemId
language
sourceCode
```

Flow:

```text
User
  |
  v
Frontend
  |
  v
Backend
  |
  v
Authentication
  |
  v
Request Validation
  |
  v
Submission Service
  |
  v
Create Submission
  |
  v
Execution Adapter
```

---

# 7. Execution Request

The Backend sends the required execution information to the Execution Engine.

Conceptually:

```text
Execution Request
├── submissionId
├── language
├── sourceCode
├── testCases
└── resourceLimits
```

The exact internal format may change as the system evolves.

---

# 8. Execution Flow

```text
Execution Engine
       |
       v
Validate Request
       |
       v
Resolve Language
       |
       v
Create Sandbox
       |
       v
Prepare Source
       |
       v
Compile if Required
       |
       v
Execute Program
       |
       v
Apply Resource Limits
       |
       v
Capture Output
       |
       v
Compare Output
       |
       v
Generate Verdict
       |
       v
Cleanup Sandbox
```

---

# 9. Test Case Flow

For the MVP, tests may be executed sequentially.

```text
Test Case 1
    |
    v
Execute
    |
    v
Compare
    |
    +---- Fail → Final Verdict
    |
    v
Test Case 2
    |
    v
Execute
    |
    v
Compare
    |
   ...
    |
    v
All Tests Passed
    |
    v
ACCEPTED
```

---

# 10. Compilation Flow

For compiled languages:

```text
Source Code
    |
    v
Compiler
    |
    +---- Failure
    |       |
    |       v
    | COMPILATION_ERROR
    |
    v
Executable
    |
    v
Program Execution
```

---

# 11. Runtime Failure Flow

```text
Program
   |
   v
Execution
   |
   +---- Crash
   |
   v
RUNTIME_ERROR
```

---

# 12. Timeout Flow

```text
Program
   |
   v
Execution
   |
   v
Time Limit
   |
   +---- Exceeded
           |
           v
TIME_LIMIT_EXCEEDED
           |
           v
Terminate Process
```

---

# 13. Result Flow

After execution:

```text
Execution Engine
       |
       | Verdict + Metrics
       v
Execution Adapter
       |
       v
Submission Service
       |
       v
MongoDB
       |
       v
Submission Record Updated
```

Stored information may include:

```text
status
verdict
runtimeMs
memoryKb
testsPassed
totalTests
errorMessage
```

---

# 14. Submission Result Flow

```text
MongoDB
   |
   v
Submission Service
   |
   v
Backend Controller
   |
   v
API Response
   |
   v
Frontend
   |
   v
User
```

---

# 15. Submission History Flow

```text
User
  |
  v
Frontend
  |
  | GET /submissions/me
  v
Backend
  |
  v
Submission Service
  |
  v
MongoDB
  |
  | User's submissions
  v
Backend
  |
  v
Frontend
```

The query must be restricted to the authenticated user's ID.

---

# 16. Admin Test Case Flow

```text
Admin
  |
  v
Frontend
  |
  v
Backend
  |
  v
Authorization
  |
  +---- Not Admin → Forbidden
  |
  v
Test Case Service
  |
  v
MongoDB
```

---

# 17. End-to-End Submission Flow

```text
                  User
                    |
                    v
                Frontend
                    |
                    v
              Backend API
                    |
                    v
          Submission Service
                    |
                    v
              Create Record
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
            Execute Test Cases
                    |
                    v
              Generate Verdict
                    |
                    v
             Cleanup Sandbox
                    |
                    v
          Submission Service
                    |
                    v
                MongoDB
                    |
                    v
                Frontend
                    |
                    v
                  User
```

---

# 18. Future Asynchronous Flow

The same business flow can later become:

```text
Frontend
   |
   v
Backend
   |
   v
Create Submission
   |
   v
Queue
   |
   v
Worker
   |
   v
Execution Engine
   |
   v
Sandbox
   |
   v
Result
   |
   v
MongoDB
```

The major change is execution scheduling, not the business concept of a submission.

---

# 19. Data Ownership

| Data | Primary Owner |
|---|---|
| User data | Backend |
| Problem data | Backend |
| Test case data | Backend |
| Submission data | Backend |
| Execution state | Execution Engine |
| Final submission result | Backend |
| Sandbox lifecycle | Execution Engine |

---

# 20. Important Data Flow Rules

1. Frontend never accesses MongoDB directly.
2. User identity comes from authentication.
3. Hidden test cases are not returned to normal users.
4. Submitted code is treated as untrusted.
5. Execution happens inside the sandbox.
6. Execution resources are cleaned after completion.
7. Infrastructure failures must not be reported as user-code failures.