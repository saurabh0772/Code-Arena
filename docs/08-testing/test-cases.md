# CodeArena — Test Cases

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Test Cases |
| Version | 1.0 |
| Status | Approved |

---

# 2. Purpose

This document lists the important test cases for the CodeArena MVP.

Test cases are grouped by feature and security boundary.

Priority:

```text
P0 = Critical
P1 = High
P2 = Normal
```

---

# 3. Authentication Test Cases

## AUTH-001 — Register Valid User

**Priority:** P0

### Given

A user provides valid registration information.

### When

The user submits the registration request.

### Then

A new account is created successfully.

Expected:

```text
201 Created
```

---

## AUTH-002 — Register Duplicate Email

**Priority:** P0

### Given

An email already exists.

### When

Another account is registered using the same email.

### Then

The request is rejected.

Expected:

```text
409 EMAIL_ALREADY_EXISTS
```

---

## AUTH-003 — Invalid Email

**Priority:** P1

An invalid email should be rejected.

Expected:

```text
400 VALIDATION_ERROR
```

---

## AUTH-004 — Weak/Invalid Password Input

**Priority:** P1

Invalid password input should be rejected according to the application's password policy.

---

## AUTH-005 — Valid Login

**Priority:** P0

Valid credentials should return an authentication token.

Expected:

```text
200 OK
```

---

## AUTH-006 — Invalid Login

**Priority:** P0

Incorrect credentials should not authenticate the user.

Expected:

```text
401 INVALID_CREDENTIALS
```

---

## AUTH-007 — Missing Token

**Priority:** P0

A protected endpoint without authentication should return:

```text
401 AUTHENTICATION_REQUIRED
```

---

## AUTH-008 — Invalid Token

**Priority:** P0

A malformed or invalid JWT should be rejected.

---

## AUTH-009 — Expired Token

**Priority:** P1

An expired token should not grant access to protected resources.

---

# 4. Authorization Test Cases

## AUTHZ-001 — User Accesses Own Submission

**Priority:** P0

A user should be able to access their own submission.

---

## AUTHZ-002 — User Accesses Another User's Submission

**Priority:** P0

A user must not access another user's private submission.

Expected:

```text
403 FORBIDDEN
```

or an appropriate not-found response according to the security policy.

---

## AUTHZ-003 — User Creates Problem

**Priority:** P0

A normal user attempting to create a problem must be rejected.

Expected:

```text
403 FORBIDDEN
```

---

## AUTHZ-004 — Admin Creates Problem

**Priority:** P0

An authenticated administrator should be able to create a problem.

---

## AUTHZ-005 — User Manages Test Cases

**Priority:** P0

Normal users must not create, modify, or delete test cases.

---

# 5. Problem Test Cases

## PROB-001 — List Problems

**Priority:** P0

A user should be able to retrieve active problems.

---

## PROB-002 — Get Problem

**Priority:** P0

A valid problem ID should return problem information.

---

## PROB-003 — Invalid Problem ID

**Priority:** P1

An invalid or malformed ID should be rejected.

---

## PROB-004 — Problem Not Found

**Priority:** P1

A valid but nonexistent problem ID should return:

```text
404 PROBLEM_NOT_FOUND
```

---

## PROB-005 — Filter by Difficulty

**Priority:** P1

Filtering by supported difficulty should return matching problems.

---

## PROB-006 — Filter by Tag

**Priority:** P1

Filtering by tag should return matching problems.

---

## PROB-007 — Inactive Problem

**Priority:** P0

Inactive problems should not appear in the normal public problem list.

---

## PROB-008 — Admin Creates Problem

**Priority:** P0

Admin should be able to create a valid problem.

---

## PROB-009 — Admin Updates Problem

**Priority:** P1

Admin should be able to update a problem.

---

## PROB-010 — Deactivate Problem

**Priority:** P1

Deleting a problem through the API should deactivate it according to the MVP soft-delete policy.

---

# 6. Test Case Management

## TC-001 — Create Public Test Case

**Priority:** P0

Admin creates a valid public test case.

---

## TC-002 — Create Hidden Test Case

**Priority:** P0

Admin creates a hidden test case.

The hidden data must remain protected.

---

## TC-003 — Invalid Test Case

**Priority:** P1

Missing or invalid test case fields should be rejected.

---

## TC-004 — Update Test Case

**Priority:** P1

Admin should be able to update a test case.

---

## TC-005 — Deactivate Test Case

**Priority:** P1

Admin should be able to deactivate a test case.

---

# 7. Hidden Test Security

## SEC-001 — Hidden Input Not Returned

**Priority:** P0

A normal user requests problem information.

Expected:

```text
Hidden input is not returned.
```

---

## SEC-002 — Hidden Expected Output Not Returned

**Priority:** P0

A normal user must not receive hidden expected output.

---

## SEC-003 — Hidden Test Through API Manipulation

**Priority:** P0

Changing request parameters or IDs must not expose hidden test data.

---

# 8. Submission Test Cases

## SUB-001 — Valid Submission

**Priority:** P0

A user submits valid source code for an active problem.

Expected:

```text
Submission Created
Execution Started
Verdict Returned
```

---

## SUB-002 — Unauthenticated Submission

**Priority:** P0

A guest attempts to submit code.

Expected:

```text
401 AUTHENTICATION_REQUIRED
```

---

## SUB-003 — Invalid Problem

**Priority:** P0

A submission references a nonexistent problem.

Expected:

```text
404 PROBLEM_NOT_FOUND
```

---

## SUB-004 — Inactive Problem Submission

**Priority:** P0

A user attempts to submit code for an inactive problem.

The request should be rejected according to business rules.

---

## SUB-005 — Unsupported Language

**Priority:** P0

The user submits:

```text
language = JAVA
```

when Java is not enabled.

Expected:

```text
422 UNSUPPORTED_LANGUAGE
```

---

## SUB-006 — Empty Source Code

**Priority:** P1

Empty source code should be rejected.

---

## SUB-007 — Source Code Too Large

**Priority:** P0

Source code exceeding the configured maximum size should be rejected.

---

## SUB-008 — User ID Manipulation

**Priority:** P0

A client attempts to submit a different `userId`.

The Backend must ignore client-supplied identity and use the authenticated user.

---

# 9. Execution Test Cases

## EXEC-001 — Accepted C++ Program

**Priority:** P0

Valid C++ code produces the expected output.

Expected:

```text
ACCEPTED
```

---

## EXEC-002 — Accepted Python Program

**Priority:** P0

Valid Python code produces the expected output.

---

## EXEC-003 — Accepted JavaScript Program

**Priority:** P0

Valid JavaScript code produces the expected output.

---

## EXEC-004 — Wrong Answer

**Priority:** P0

Program executes successfully but produces incorrect output.

Expected:

```text
WRONG_ANSWER
```

---

## EXEC-005 — C++ Compilation Error

**Priority:** P0

Invalid C++ syntax should produce:

```text
COMPILATION_ERROR
```

---

## EXEC-006 — Python Syntax Error

**Priority:** P0

Invalid Python syntax should result in an appropriate execution error.

---

## EXEC-007 — JavaScript Runtime Error

**Priority:** P0

A program that throws an unhandled runtime error should produce:

```text
RUNTIME_ERROR
```

---

## EXEC-008 — Infinite Loop

**Priority:** P0

An infinite loop must be terminated.

Expected:

```text
TIME_LIMIT_EXCEEDED
```

---

## EXEC-009 — Memory Exhaustion

**Priority:** P0

A program exceeding the configured memory limit must be terminated.

Expected:

```text
MEMORY_LIMIT_EXCEEDED
```

---

## EXEC-010 — Huge Output

**Priority:** P0

A program producing excessive output must be terminated or rejected.

---

## EXEC-011 — Multiple Test Cases

**Priority:** P0

A correct program must pass all active test cases.

---

## EXEC-012 — One Test Case Fails

**Priority:** P0

If one test case produces incorrect output, the submission should not be accepted.

Expected:

```text
WRONG_ANSWER
```

---

# 10. Output Comparator Tests

## COMP-001 — Exact Match

Expected and actual outputs match.

Result:

```text
PASS
```

---

## COMP-002 — Different Output

Outputs differ.

Result:

```text
FAIL
```

---

## COMP-003 — Trailing Whitespace

The comparator should follow the defined whitespace normalization policy.

---

## COMP-004 — Multiple Lines

Multi-line output should be compared correctly.

---

# 11. Sandbox Security Test Cases

## SBOX-001 — No Network Access

**Priority:** P0

User code attempts to make an outbound network connection.

Expected:

```text
Network Access Denied
```

---

## SBOX-002 — Host Filesystem Access

**Priority:** P0

User code attempts to access host files.

Expected:

```text
Access Denied
```

---

## SBOX-003 — Environment Secret Access

**Priority:** P0

User code attempts to retrieve application secrets.

Expected:

```text
Secrets Not Available
```

---

## SBOX-004 — Docker Socket Access

**Priority:** P0

User code attempts to access Docker management interfaces.

Expected:

```text
Access Denied
```

---

## SBOX-005 — Process Explosion

**Priority:** P0

A program attempts to create excessive processes.

Expected:

```text
Process Limit Enforced
```

---

## SBOX-006 — Privilege Escalation

**Priority:** P0

A program attempts to obtain elevated privileges.

Expected:

```text
Privilege Escalation Prevented
```

---

# 12. Isolation Tests

## ISO-001 — Submission Isolation

**Priority:** P0

Submission A attempts to access Submission B's files.

Expected:

```text
Access Denied
```

---

## ISO-002 — Concurrent Submissions

**Priority:** P0

Multiple submissions execute concurrently without sharing execution state.

---

## ISO-003 — Sandbox Cleanup

**Priority:** P0

After execution, the sandbox is destroyed.

No abandoned execution container should remain.

---

# 13. Resource Limit Tests

## RES-001 — CPU Limit

Program attempts excessive CPU usage.

Expected:

```text
CPU Limit Enforced
```

---

## RES-002 — Memory Limit

Program exceeds memory allocation.

Expected:

```text
MEMORY_LIMIT_EXCEEDED
```

---

## RES-003 — Time Limit

Program exceeds execution timeout.

Expected:

```text
TIME_LIMIT_EXCEEDED
```

---

## RES-004 — Process Limit

Program creates excessive processes.

Expected:

```text
Process Limit Enforced
```

---

## RES-005 — Output Limit

Program generates excessive output.

Expected:

```text
Output Limit Enforced
```

---

# 14. Database Test Cases

## DB-001 — Create User

A valid user should be stored successfully.

---

## DB-002 — Unique Email

Duplicate email addresses must be rejected.

---

## DB-003 — Create Problem

Valid problem data should be stored.

---

## DB-004 — Create Test Case

A test case should reference an existing problem.

---

## DB-005 — Create Submission

A submission should reference a valid user and problem.

---

## DB-006 — Submission History

A user should retrieve only their own submission history.

---

# 15. API Security Tests

## APISEC-001 — Invalid Request Body

Malformed request data should be rejected.

---

## APISEC-002 — Invalid Query Parameters

Unsupported pagination/filter values should be rejected or normalized.

---

## APISEC-003 — Rate Limit

Excessive requests should trigger rate limiting.

---

## APISEC-004 — Sensitive Error Information

Errors must not expose:

```text
Stack Traces
Database Credentials
JWT Secrets
Host Paths
Internal Infrastructure Details
```

---

# 16. Failure Tests

## FAIL-001 — MongoDB Unavailable

The API should return an appropriate server/dependency error.

---

## FAIL-002 — Execution Engine Unavailable

Submission execution should fail gracefully.

Expected:

```text
503 EXECUTION_SERVICE_UNAVAILABLE
```

---

## FAIL-003 — Container Creation Failure

The system should return an execution failure without leaving resources behind.

---

## FAIL-004 — Unexpected Execution Error

Unexpected engine failures must not be reported as incorrect user code.

---

# 17. End-to-End Test

## E2E-001 — Complete User Journey

**Priority:** P0

```text
Register
   ↓
Login
   ↓
Browse Problems
   ↓
Open Problem
   ↓
Submit Code
   ↓
Execute
   ↓
Receive Verdict
   ↓
View Submission
   ↓
View Submission History
```

Expected result:

The complete flow succeeds without exposing protected information.

---

# 18. Regression Tests

Every important production bug should receive a regression test.

Example:

```text
Bug
 ↓
Fix
 ↓
Test Added
 ↓
Future CI Runs
 ↓
Bug Does Not Return
```

---

# 19. Critical P0 Test Areas

The following areas must pass before MVP release:

```text
Authentication
Authorization
Submission Ownership
Hidden Test Protection
Code Execution
Compilation
Verdicts
Timeout
Memory Limit
Network Isolation
Filesystem Isolation
Secret Isolation
Process Limits
Output Limits
Sandbox Cleanup
Execution Failure Handling
```

---

# 20. MVP Test Completion

The MVP testing phase is complete when:

- [ ] Critical P0 tests pass.
- [ ] API tests pass.
- [ ] Authentication tests pass.
- [ ] Authorization tests pass.
- [ ] Execution tests pass for all supported languages.
- [ ] Sandbox security tests pass.
- [ ] Resource limits are verified.
- [ ] Cleanup is verified.
- [ ] E2E flow passes.
- [ ] CI pipeline passes.

---

## 21. Testing Goal

The goal of these test cases is to establish confidence that CodeArena can:

```text
Accept Code
    ↓
Execute Code Safely
    ↓
Evaluate Correctly
    ↓
Return Accurate Verdict
    ↓
Protect the Platform
```

The most important tests are those protecting the execution boundary and user data.