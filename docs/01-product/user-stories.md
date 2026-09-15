# CodeArena — User Stories

## 1. Overview

This document describes the main actions users should be able to perform in CodeArena.

User stories are grouped by:

- Guest
- Registered User
- Administrator
- System

---

# 2. Guest User Stories

## US-GUEST-01: Register

**As a** guest user,

**I want to** create a CodeArena account,

**so that** I can submit solutions.

### Acceptance Criteria

- User can provide name, email, and password.
- Email must be unique.
- Invalid input is rejected.
- Password is securely stored.
- Successful registration creates a user account.

---

## US-GUEST-02: Login

**As a** registered user,

**I want to** log into CodeArena,

**so that** I can access protected features.

### Acceptance Criteria

- Valid credentials are accepted.
- Invalid credentials are rejected.
- Authentication token is returned.
- Protected resources require authentication.

---

## US-GUEST-03: Browse Problems

**As a** visitor,

**I want to** browse available problems,

**so that** I can see what problems are available.

### Acceptance Criteria

- Active problems are displayed.
- Difficulty is visible.
- Tags are visible.
- Pagination is supported.

---

## US-GUEST-04: View Problem

**As a** visitor,

**I want to** open a problem,

**so that** I can understand the programming task.

### Acceptance Criteria

The problem page displays:

- Title
- Description
- Difficulty
- Tags
- Input format
- Output format
- Constraints
- Public examples

Hidden test cases must not be displayed.

---

# 3. Registered User Stories

## US-USER-01: View Profile

**As a** logged-in user,

**I want to** view my profile,

**so that** I can see my account information.

### Acceptance Criteria

- User can retrieve their own profile.
- Password hash is never returned.
- User cannot access another user's private profile data.

---

## US-USER-02: Write Solution

**As a** user,

**I want to** write source code for a problem,

**so that** I can attempt to solve it.

### Acceptance Criteria

- Supported languages are available.
- Source code can be provided.
- Source code size is validated.

---

## US-USER-03: Submit Solution

**As a** user,

**I want to** submit my solution,

**so that** CodeArena can evaluate it.

### Acceptance Criteria

- User must be authenticated.
- Problem must exist.
- Language must be supported.
- Source code must be valid.
- Submission is stored.

---

## US-USER-04: Receive Verdict

**As a** user,

**I want to** know whether my solution passed,

**so that** I can improve my solution if necessary.

### Acceptance Criteria

The system can return:

- Accepted
- Wrong Answer
- Compilation Error
- Runtime Error
- Time Limit Exceeded
- Memory Limit Exceeded

---

## US-USER-05: View Submission

**As a** user,

**I want to** view my submission result,

**so that** I can understand its execution result.

### Acceptance Criteria

The submission may display:

- Language
- Status
- Verdict
- Runtime
- Memory usage
- Tests passed
- Submission time

---

## US-USER-06: View Submission History

**As a** user,

**I want to** view my previous submissions,

**so that** I can track my attempts.

### Acceptance Criteria

- Only the authenticated user's submissions are returned.
- Results can be paginated.
- Latest submissions appear first.

---

# 4. Administrator User Stories

## US-ADMIN-01: Create Problem

**As an** administrator,

**I want to** create a programming problem,

**so that** users can solve it.

### Acceptance Criteria

Administrator can define:

- Title
- Description
- Difficulty
- Tags
- Input format
- Output format
- Constraints
- Examples

---

## US-ADMIN-02: Update Problem

**As an** administrator,

**I want to** update a problem,

**so that** incorrect or outdated information can be fixed.

---

## US-ADMIN-03: Manage Test Cases

**As an** administrator,

**I want to** manage test cases,

**so that** submitted programs can be evaluated correctly.

### Acceptance Criteria

Administrator can:

- Add test cases
- Update test cases
- Delete/deactivate test cases
- Mark test cases as public or hidden

---

## US-ADMIN-04: Protect Hidden Test Cases

**As an** administrator,

**I want to** keep hidden test cases private,

**so that** users cannot inspect expected outputs.

### Acceptance Criteria

- Hidden inputs are not returned to normal users.
- Hidden expected outputs are not returned to normal users.
- Execution components can access required hidden data.

---

# 5. System User Stories

## US-SYSTEM-01: Execute Code Safely

**As the** system,

**I want to** execute submitted code inside an isolated environment,

**so that** user code cannot directly affect the application host.

---

## US-SYSTEM-02: Enforce Resource Limits

**As the** system,

**I want to** enforce CPU, memory, process, time, and output limits,

**so that** a submission cannot consume unlimited resources.

---

## US-SYSTEM-03: Store Execution Result

**As the** system,

**I want to** store the result of every submission,

**so that** users can view their submission history.

---

## US-SYSTEM-04: Clean Up Sandbox

**As the** system,

**I want to** remove the execution environment after execution,

**so that** temporary resources do not accumulate.

---

# 6. MVP Priority

| User Story | Priority |
|---|---|
| Registration | P0 |
| Login | P0 |
| Browse Problems | P0 |
| View Problem | P0 |
| Submit Solution | P0 |
| Execute Code | P0 |
| Receive Verdict | P0 |
| Submission History | P0 |
| Admin Problem Management | P1 |
| Admin Test Case Management | P1 |
| Advanced Statistics | P2 |
| Contests | P2 |
| Leaderboards | P2 |

---

# 7. Core MVP Journey

The most important user story chain is:

```text
Register
   ↓
Login
   ↓
Browse Problems
   ↓
Open Problem
   ↓
Write Code
   ↓
Submit
   ↓
Execute
   ↓
Evaluate
   ↓
Receive Verdict
   ↓
View History
```

This flow represents the core value of CodeArena.