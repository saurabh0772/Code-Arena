# CodeArena — Functional Requirements

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Functional Requirements |
| Version | 1.0 |
| Status | Approved |

---

## 2. Purpose

This document defines the functional behavior required by CodeArena.

Functional requirements describe **what the system must do**.

The requirements are grouped into:

- Authentication
- User Management
- Problem Management
- Test Case Management
- Submission Management
- Code Execution
- Verdict Management
- Administration

---

# 3. Authentication Requirements

## FR-01 — User Registration

The system shall allow a new user to register.

### Input

- Name
- Email
- Password

### Requirements

- Name must be valid.
- Email must have a valid format.
- Email must be unique.
- Password must satisfy the minimum password policy.
- Password must never be stored as plaintext.

### Result

A valid registration shall create a new user account.

---

## FR-02 — User Login

The system shall allow registered users to authenticate.

### Requirements

- User provides email and password.
- Credentials are validated.
- Invalid credentials are rejected.
- Successful authentication returns an authentication token.

---

## FR-03 — Authentication

Protected resources shall require valid authentication.

The system shall reject:

- Missing authentication
- Invalid authentication
- Expired authentication

---

## FR-04 — Logout

The system shall provide a logout mechanism.

The implementation shall ensure that the client can terminate its authenticated session/token usage.

---

# 4. User Management Requirements

## FR-05 — View Current User

Authenticated users shall be able to retrieve their own profile.

The response may contain:

- User ID
- Name
- Email
- Role
- Account status
- Creation date

Sensitive authentication information must not be returned.

---

## FR-06 — User Authorization

The system shall distinguish between:

```text
USER
ADMIN
```

Authorization shall be checked on protected operations.

---

## FR-07 — Resource Ownership

Users shall only be able to access resources they are authorized to access.

For example:

```text
User A
   |
   +---- Submission A ✓

User A
   |
   +---- Submission B ✗
```

---

# 5. Problem Requirements

## FR-08 — List Problems

The system shall provide an endpoint for retrieving active problems.

The endpoint shall support:

- Pagination
- Difficulty filtering
- Tag filtering
- Sorting

---

## FR-09 — View Problem

Users shall be able to retrieve a specific problem.

The response shall contain:

- Title
- Description
- Difficulty
- Tags
- Input format
- Output format
- Constraints
- Public examples

Hidden test case data must not be included.

---

## FR-10 — Problem Status

Only active problems shall be available to normal users.

Inactive problems may remain stored for administrative purposes.

---

# 6. Problem Administration Requirements

## FR-11 — Create Problem

An administrator shall be able to create a problem.

Required information includes:

- Title
- Description
- Difficulty
- Tags
- Input format
- Output format
- Constraints
- Examples

---

## FR-12 — Update Problem

An administrator shall be able to update an existing problem.

The system shall validate updated fields before saving them.

---

## FR-13 — Delete Problem

An administrator shall be able to deactivate a problem.

Soft deletion is preferred so historical submissions remain valid.

---

# 7. Test Case Requirements

## FR-14 — Create Test Case

An administrator shall be able to create test cases for a problem.

A test case contains:

- Problem ID
- Input
- Expected output
- Visibility
- Order

---

## FR-15 — Test Case Visibility

A test case shall have one of:

```text
PUBLIC
HIDDEN
```

Public test cases may be displayed to users.

Hidden test cases must remain private.

---

## FR-16 — Update Test Case

An administrator shall be able to update a test case.

---

## FR-17 — Delete Test Case

An administrator shall be able to deactivate a test case.

Historical submissions should remain unaffected.

---

# 8. Submission Requirements

## FR-18 — Create Submission

An authenticated user shall be able to submit source code.

Required input:

```text
problemId
language
sourceCode
```

The user's identity shall come from the authentication context rather than the request body.

---

## FR-19 — Validate Submission

Before execution, the system shall validate:

- Problem existence
- Problem availability
- Supported language
- Source code presence
- Source code size
- User authentication

Invalid submissions shall be rejected before execution.

---

## FR-20 — Store Submission

Every accepted submission request shall create a submission record.

The record shall contain:

- User ID
- Problem ID
- Language
- Source code
- Status
- Verdict
- Runtime
- Memory usage
- Test results
- Timestamps

---

# 9. Code Execution Requirements

## FR-21 — Execute Source Code

The Execution Engine shall execute submitted source code.

Execution shall happen in an isolated environment.

---

## FR-22 — Language Resolution

The system shall resolve the requested language to a predefined execution configuration.

Initial languages:

```text
CPP
PYTHON
JAVASCRIPT
```

Users shall not be allowed to provide arbitrary compiler or runtime commands.

---

## FR-23 — Compilation

Compiled languages shall be compiled before execution.

For example:

```text
C++ Source
    |
    v
Compiler
    |
    +---- Compilation Error
    |
    v
Executable
```

Compilation failures shall result in:

```text
COMPILATION_ERROR
```

---

## FR-24 — Program Execution

The execution engine shall run the compiled/interpreted program against the problem's test cases.

---

## FR-25 — Resource Limits

Execution shall enforce:

- CPU limit
- Memory limit
- Execution timeout
- Process limit
- Output limit

If a limit is exceeded, execution shall terminate safely.

---

# 10. Test Evaluation Requirements

## FR-26 — Execute Test Cases

The system shall evaluate the submission against the configured test cases.

The MVP may execute test cases sequentially.

---

## FR-27 — Output Comparison

The system shall compare program output with expected output.

The comparator should handle normal output differences such as trailing whitespace according to the defined comparison policy.

---

## FR-28 — Test Progress

The execution result shall track:

```text
testsPassed
totalTests
```

---

# 11. Verdict Requirements

## FR-29 — Generate Verdict

The system shall generate a final verdict.

Supported verdicts:

| Verdict | Meaning |
|---|---|
| `PENDING` | Evaluation not completed |
| `ACCEPTED` | All required tests passed |
| `WRONG_ANSWER` | Output is incorrect |
| `COMPILATION_ERROR` | Compilation failed |
| `RUNTIME_ERROR` | Program terminated unexpectedly |
| `TIME_LIMIT_EXCEEDED` | Execution time exceeded |
| `MEMORY_LIMIT_EXCEEDED` | Memory limit exceeded |

---

## FR-30 — Verdict Precedence

Execution errors shall take precedence over normal output comparison.

Example:

```text
Compilation fails
      ↓
COMPILATION_ERROR

Program times out
      ↓
TIME_LIMIT_EXCEEDED

Program crashes
      ↓
RUNTIME_ERROR
```

---

# 12. Submission Retrieval Requirements

## FR-31 — View Submission

Authenticated users shall be able to retrieve their own submission.

---

## FR-32 — Submission History

Authenticated users shall be able to retrieve their submission history.

History shall support:

- Pagination
- Latest-first sorting
- Problem filtering

---

## FR-33 — Submission Ownership

A user must not be able to retrieve another user's private submission through the normal user API.

---

# 13. Execution Cleanup Requirements

## FR-34 — Sandbox Cleanup

The execution engine shall clean up temporary execution resources after every submission.

Cleanup must occur after:

- Successful execution
- Compilation failure
- Runtime failure
- Timeout
- Memory failure
- Unexpected execution error

---

# 14. Error Handling Requirements

## FR-35 — Validation Errors

Invalid requests shall return a structured validation error.

---

## FR-36 — Resource Not Found

Requests for unavailable resources shall return an appropriate not-found response.

Examples:

```text
Problem not found
Submission not found
Test case not found
```

---

## FR-37 — Execution Failure

Unexpected execution-engine failures shall be represented separately from normal user-code verdicts.

The system must not incorrectly report an infrastructure failure as:

```text
WRONG_ANSWER
```

---

# 15. Functional Requirement Summary

| ID | Area | Requirement | Priority |
|---|---|---|---|
| FR-01 | Auth | Registration | P0 |
| FR-02 | Auth | Login | P0 |
| FR-03 | Auth | Authentication | P0 |
| FR-04 | Auth | Logout | P1 |
| FR-05 | Users | Current user | P0 |
| FR-06 | Users | Authorization | P0 |
| FR-07 | Users | Ownership | P0 |
| FR-08 | Problems | List problems | P0 |
| FR-09 | Problems | View problem | P0 |
| FR-10 | Problems | Active status | P0 |
| FR-11 | Admin | Create problem | P1 |
| FR-12 | Admin | Update problem | P1 |
| FR-13 | Admin | Deactivate problem | P1 |
| FR-14 | Tests | Create test case | P1 |
| FR-15 | Tests | Visibility | P0 |
| FR-16 | Tests | Update test case | P1 |
| FR-17 | Tests | Deactivate test case | P1 |
| FR-18 | Submission | Create submission | P0 |
| FR-19 | Submission | Validate submission | P0 |
| FR-20 | Submission | Store submission | P0 |
| FR-21 | Execution | Execute code | P0 |
| FR-22 | Execution | Language resolution | P0 |
| FR-23 | Execution | Compilation | P0 |
| FR-24 | Execution | Program execution | P0 |
| FR-25 | Execution | Resource limits | P0 |
| FR-26 | Evaluation | Execute tests | P0 |
| FR-27 | Evaluation | Compare output | P0 |
| FR-28 | Evaluation | Track progress | P1 |
| FR-29 | Verdict | Generate verdict | P0 |
| FR-30 | Verdict | Verdict precedence | P0 |
| FR-31 | Submission | View submission | P0 |
| FR-32 | Submission | Submission history | P0 |
| FR-33 | Submission | Ownership protection | P0 |
| FR-34 | Execution | Cleanup | P0 |
| FR-35 | Errors | Validation errors | P0 |
| FR-36 | Errors | Not found errors | P0 |
| FR-37 | Errors | Execution failures | P0 |