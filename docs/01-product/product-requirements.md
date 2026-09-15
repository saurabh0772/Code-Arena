# CodeArena — Product Requirements Document

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Product Requirements |
| Version | 1.0 |
| Status | Approved |
| Target | MVP |
| Platform | Web Application |

---

## 2. Product Overview

CodeArena is a web-based coding platform where users can solve programming problems and submit their solutions for automatic evaluation.

The platform accepts source code, executes it against predefined test cases, compares the output with expected results, and returns a verdict.

The initial platform will support:

- User authentication
- Problem browsing
- Problem details
- Code submission
- Automatic code execution
- Test case evaluation
- Submission history
- Basic administrative problem management

---

## 3. Problem Statement

Students and developers need a platform where they can:

- Practice programming problems.
- Write code in a browser.
- Submit solutions.
- Receive immediate feedback.
- Track previous submissions.
- Understand why a solution failed.

Existing competitive programming platforms provide these capabilities, but CodeArena is being designed as a backend-focused engineering project that demonstrates how an online judge can be designed and implemented.

---

## 4. Product Goals

### Primary Goals

1. Allow users to solve programming problems.
2. Allow users to submit source code.
3. Execute submitted code safely.
4. Evaluate submissions against test cases.
5. Return meaningful verdicts.
6. Store submission history.
7. Provide a clean REST API.
8. Maintain a scalable architecture for future improvements.

### Engineering Goals

CodeArena should demonstrate:

- Backend API design
- Authentication and authorization
- Database design
- Code execution
- Sandboxing
- Resource limits
- Error handling
- Testing
- Docker
- System design
- Future scalability

---

## 5. Non-Goals

The MVP will not attempt to implement every feature of platforms such as LeetCode or Codeforces.

The following are outside the initial scope:

- Live contests
- Leaderboards
- Social feeds
- Real-time multiplayer coding
- Discussion forums
- Editorial system
- Rating system
- Advanced recommendation algorithms
- Plagiarism detection
- Multiple execution regions
- Kubernetes-based deployment
- Production-grade microservice architecture

These may be considered later.

---

## 6. Target Users

### 6.1 Student

A student wants to practice programming problems and improve problem-solving skills.

### 6.2 Developer

A developer wants to practice coding problems and evaluate different solutions.

### 6.3 Administrator

An administrator manages problems and their test cases.

---

## 7. Core User Journey

The main user journey is:

```text
Register / Login
      |
      v
Browse Problems
      |
      v
Open Problem
      |
      v
Write Solution
      |
      v
Submit Code
      |
      v
Code Execution
      |
      v
Test Case Evaluation
      |
      v
Verdict
      |
      v
View Submission History
```

---

## 8. Functional Requirements

### FR-01: User Registration

The system shall allow a new user to create an account.

Required information:

- Name
- Email
- Password

The email must be unique.

---

### FR-02: User Login

The system shall allow registered users to authenticate using their credentials.

Successful authentication shall provide an authentication token.

---

### FR-03: User Profile

Authenticated users shall be able to retrieve their own profile information.

The system shall not expose password hashes.

---

### FR-04: Problem Listing

Users shall be able to view available programming problems.

The problem list should support:

- Difficulty filtering
- Tag filtering
- Pagination
- Sorting

---

### FR-05: Problem Details

Users shall be able to view:

- Problem title
- Description
- Difficulty
- Tags
- Input format
- Output format
- Constraints
- Public examples

Hidden test cases must not be exposed.

---

### FR-06: Code Submission

Authenticated users shall be able to submit source code.

A submission shall contain:

- Problem ID
- Programming language
- Source code

The authenticated user's ID shall be derived from the authentication context.

---

### FR-07: Code Execution

The system shall execute submitted code in an isolated environment.

The execution environment shall enforce resource restrictions.

---

### FR-08: Test Case Evaluation

The submitted program shall be evaluated against the problem's test cases.

The system shall compare program output with expected output.

---

### FR-09: Submission Verdict

The system shall return a meaningful verdict.

Initial verdicts include:

- `PENDING`
- `ACCEPTED`
- `WRONG_ANSWER`
- `COMPILATION_ERROR`
- `RUNTIME_ERROR`
- `TIME_LIMIT_EXCEEDED`
- `MEMORY_LIMIT_EXCEEDED`

---

### FR-10: Submission History

Authenticated users shall be able to view their previous submissions.

A submission record should contain:

- Problem
- Language
- Status
- Verdict
- Runtime
- Memory usage
- Submission time

---

### FR-11: Admin Problem Management

Administrators shall be able to:

- Create problems
- Update problems
- Delete/deactivate problems
- Add test cases
- Update test cases
- Delete/deactivate test cases

---

## 9. Code Execution Requirements

The execution system shall:

1. Validate the requested language.
2. Validate source code size.
3. Create an isolated execution environment.
4. Prepare the source code.
5. Compile when required.
6. Execute the program.
7. Apply resource limits.
8. Capture output.
9. Compare output.
10. Generate a verdict.
11. Clean up the execution environment.

---

## 10. Security Requirements

Because users submit arbitrary source code, the execution environment must treat submitted code as untrusted.

The MVP should provide:

- No network access
- Non-root execution
- CPU limits
- Memory limits
- Process limits
- Execution timeout
- Output limits
- Restricted filesystem access
- No application secrets
- No Docker socket inside sandbox
- Fresh sandbox per submission

---

## 11. Initial Language Support

The MVP will support:

| Language | Identifier |
|---|---|
| C++ | `CPP` |
| Python | `PYTHON` |
| JavaScript | `JAVASCRIPT` |

Additional languages may be added later.

---

## 12. Product Success Criteria

The MVP will be considered successful when a user can:

```text
Create Account
      ↓
Login
      ↓
Browse Problem
      ↓
Open Problem
      ↓
Submit Code
      ↓
Execute Code
      ↓
Evaluate Test Cases
      ↓
Receive Verdict
      ↓
View Submission
```

The execution environment must also prevent basic resource and isolation abuse.

---

## 13. Future Product Direction

Future versions may introduce:

- Asynchronous submissions
- Job queues
- Worker pools
- Real-time submission status
- Contests
- Leaderboards
- User statistics
- Problem discussions
- More languages
- Difficulty recommendations
- Stronger sandboxing
- Horizontal scaling

These features are intentionally excluded from the initial MVP.