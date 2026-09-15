# CodeArena — Security Design

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Security Design |
| Version | 1.0 |
| Status | Approved |
| Security Focus | Application + Untrusted Code Execution |

---

# 2. Purpose

This document defines the security architecture of CodeArena.

CodeArena has an important security challenge that normal web applications do not have:

> Users can submit arbitrary source code that the system must execute.

Therefore, security must protect both:

```text
Application
     +
Infrastructure
     +
User Data
     +
Execution Environment
```

---

# 3. Security Goals

The primary security goals are:

1. Protect user accounts.
2. Protect private user data.
3. Protect hidden test cases.
4. Prevent unauthorized resource access.
5. Safely execute untrusted code.
6. Limit resource consumption.
7. Prevent execution from accessing the host.
8. Protect application infrastructure.
9. Detect and handle failures safely.

---

# 4. Threat Model

Potential threats include:

```text
Account Attacks
API Abuse
Unauthorized Data Access
Malicious Source Code
Resource Exhaustion
Network Abuse
Filesystem Access
Privilege Escalation
Container Escape
Secret Exposure
```

The most critical threat is malicious user-submitted code.

---

# 5. Security Architecture

High-level security boundary:

```text
                    Internet
                       |
                       v
                 Frontend / API
                       |
                       v
                    Backend
                   /       \
                  /         \
                 v           v
             MongoDB    Execution Engine
                              |
                              v
                        Docker Sandbox
                              |
                              v
                         User Code
```

The Backend and execution environment have different trust levels.

---

# 6. Trust Boundaries

## Boundary 1 — Client → Backend

The client is untrusted.

All client input must be validated server-side.

```text
Client
  |
  | Untrusted Input
  v
Backend
  |
  v
Validation
```

---

## Boundary 2 — Backend → Execution Engine

The Execution Engine receives potentially dangerous source code.

The request must be validated before execution.

---

## Boundary 3 — Execution Engine → Sandbox

The sandbox is the primary isolation boundary for user code.

The Execution Engine controls the sandbox lifecycle.

---

## Boundary 4 — Sandbox → Host

User code must not receive unrestricted access to the host system.

```text
User Code
    |
    X
Host Resources
```

---

# 7. Authentication

CodeArena uses authenticated access for protected operations.

The initial authentication mechanism uses JWT.

Flow:

```text
Login
  |
  v
Validate Credentials
  |
  v
Generate JWT
  |
  v
Client
  |
  v
Protected Request
  |
  v
Verify JWT
```

---

# 8. Password Security

Passwords must never be stored in plaintext.

Instead:

```text
Password
   |
   v
Password Hashing
   |
   v
passwordHash
   |
   v
MongoDB
```

A strong password hashing algorithm such as Argon2 should be preferred.

bcrypt can also be used when configured appropriately.

---

# 9. JWT Security

JWTs should:

- Use a strong signing secret/key.
- Have an appropriate expiration time.
- Contain only required claims.
- Never contain passwords or sensitive secrets.

The server must verify the token before allowing protected operations.

---

# 10. Authorization

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What are you allowed to do?
```

CodeArena initially has:

```text
USER
ADMIN
```

---

# 11. Role-Based Access Control

Example:

```text
USER
 |
 +---- Browse Problems
 +---- Submit Code
 +---- View Own Submissions
 |
 X---- Create Problems

ADMIN
 |
 +---- Browse Problems
 +---- Submit Code
 +---- Create Problems
 +---- Update Problems
 +---- Manage Test Cases
```

Authorization must be enforced by the Backend.

---

# 12. Object-Level Authorization

Role checks alone are not enough.

The Backend must also verify resource ownership.

Example:

```text
User A
   |
   +---- Submission A ✓

User A
   |
   +---- Submission B ✗
```

A user must not retrieve another user's private submission simply by changing the submission ID.

---

# 13. Input Validation

All client-controlled input must be validated.

Examples:

```text
Email
Password
Problem ID
Language
Source Code
Query Parameters
Pagination
```

Validation should happen before business logic or database operations.

---

# 14. Source Code Validation

Submitted source code should have:

- Maximum size
- Supported language
- Valid request format

Example:

```text
language = CPP ✓

language = RANDOM ✗
```

The user must not be able to provide arbitrary compiler or runtime commands.

---

# 15. Command Injection Prevention

The system must never construct shell commands directly from user input.

Unsafe concept:

```text
run("compiler " + userInput)
```

Instead, execution commands should come from trusted language configurations.

```text
Language
   |
   v
Trusted Configuration
   |
   v
Compiler / Runtime
```

---

# 16. Language Whitelist

Only predefined languages are allowed.

Initial languages:

```text
CPP
PYTHON
JAVASCRIPT
```

Each language maps to a trusted execution configuration.

---

# 17. Hidden Test Case Protection

Hidden test cases are sensitive data.

Normal users must never receive:

```text
Hidden Input
Hidden Expected Output
```

The public API should return only public examples.

---

# 18. Test Case Access

Conceptually:

```text
Normal User
     |
     X
Hidden Test Cases

Trusted Execution Flow
     |
     ✓
Hidden Test Cases
```

Access to hidden test cases should be limited to trusted application/execution components.

---

# 19. Database Security

MongoDB should not be publicly accessible.

Preferred architecture:

```text
Internet
   |
   X
MongoDB

Backend
   |
   ✓
MongoDB
```

Database credentials must be stored through environment configuration or a secret-management system.

---

# 20. Database Least Privilege

The application should use a database account with only the permissions required by the application.

Administrative database credentials should not be used by normal application processes.

---

# 21. Frontend Database Isolation

The Frontend must never contain:

```text
MongoDB URI
Database Password
Database Credentials
```

The Frontend communicates only with the Backend API.

---

# 22. Rate Limiting

Rate limiting should protect endpoints that can be abused.

High-priority endpoints:

```text
POST /auth/login
POST /auth/register
POST /submissions
```

Submission endpoints require special attention because every request may trigger expensive execution.

---

# 23. API Security

The API should use:

- HTTPS in production
- Authentication
- Authorization
- Input validation
- Rate limiting
- Appropriate CORS configuration
- Security headers

---

# 24. CORS

CORS should allow only trusted application origins.

Development may allow:

```text
localhost
```

Production should use the actual Frontend origin.

Avoid unrestricted:

```text
*
```

for authenticated APIs unless there is a specific reason.

---

# 25. Security Headers

The Backend should use appropriate HTTP security headers.

A standard security middleware such as Helmet can be considered for the Node.js application.

---

# 26. Untrusted Code

The most important rule:

> User-submitted code must never execute directly on the Backend host.

Unsafe:

```text
Backend
   |
   v
Host Shell
   |
   v
User Code
```

Preferred:

```text
Backend
   |
   v
Execution Engine
   |
   v
Sandbox
   |
   v
User Code
```

---

# 27. Docker Sandbox

The MVP uses Docker-based isolation.

Each submission should run inside a disposable container.

```text
Submission
    |
    v
Create Container
    |
    v
Execute
    |
    v
Collect Result
    |
    v
Destroy Container
```

---

# 28. Sandbox Network Isolation

Submitted programs should not have normal network access.

```text
User Program
     |
     X
 Internet
```

This prevents arbitrary outbound requests.

It also reduces the ability of malicious code to communicate with external systems.

---

# 29. Sandbox User Privileges

User code should run as a non-root user.

```text
Container
    |
    +---- Non-root User
              |
              v
          User Code
```

The Docker container should not grant unnecessary Linux capabilities.

---

# 30. Filesystem Restrictions

The sandbox should provide only the filesystem access required for execution.

Where practical:

- Use a restricted workspace.
- Avoid writable host mounts.
- Use a read-only filesystem.
- Provide a temporary writable directory when required.

---

# 31. Docker Socket Protection

The Docker socket must never be exposed to user code.

Dangerous:

```text
User Code
    |
    v
Docker Socket
    |
    v
Host
```

The sandbox must not have access to Docker management credentials or sockets.

---

# 32. Application Secret Protection

The sandbox must not receive:

```text
JWT Secret
MongoDB Credentials
API Keys
Cloud Credentials
Application Secrets
```

Only execution-specific data should be provided.

---

# 33. CPU Limits

Each submission should have a CPU limit.

This prevents one program from consuming all available CPU resources.

```text
Submission
    |
    v
CPU Limit
    |
    +---- Exceeded → Terminate
```

---

# 34. Memory Limits

Each submission should have a memory limit.

```text
Submission
    |
    v
Memory Limit
    |
    +---- Exceeded
             |
             v
MEMORY_LIMIT_EXCEEDED
```

---

# 35. Execution Timeout

Programs must have a maximum execution time.

This protects against:

```text
while(true) {}
```

Flow:

```text
Start
  |
  v
Timer
  |
  +---- Program finishes → Continue
  |
  +---- Timeout → Terminate
```

---

# 36. Process Limits

The sandbox should limit the number of processes that a submission can create.

This helps reduce process-exhaustion attacks.

---

# 37. Output Limits

Programs should have a maximum output size.

This prevents malicious programs from generating unlimited output.

```text
Program
   |
   v
Output
   |
   v
Output Limit
   |
   +---- Exceeded → Terminate
```

---

# 38. Resource Limit Summary

Every execution should have bounded:

```text
CPU
Memory
Time
Processes
Output
```

These limits should be configurable per language/problem where appropriate.

---

# 39. Sandbox Cleanup

Every sandbox must be cleaned after execution.

Cleanup must occur after:

```text
Accepted
Wrong Answer
Compilation Error
Runtime Error
Timeout
Memory Error
Unexpected Failure
```

Preferred flow:

```text
Execute
   |
   v
Result / Error
   |
   v
Cleanup
```

---

# 40. Failure Isolation

A malicious or broken submission should not crash the Backend.

```text
Submission A
    |
    v
Sandbox A
    |
    X
Failure

Submission B
    |
    v
Sandbox B
    |
    ✓
Continues
```

Each submission should have its own execution environment.

---

# 41. Container Escape Risk

Docker provides useful isolation but shares the host kernel.

Therefore:

```text
Docker ≠ Perfect Security Boundary
```

The MVP should not claim that Docker makes arbitrary code execution completely secure.

---

# 42. Stronger Future Isolation

For a more security-sensitive production deployment, stronger isolation technologies can be evaluated:

```text
Docker
   ↓
gVisor
   ↓
Firecracker / MicroVM
```

The Execution Engine abstraction should make such a migration possible.

---

# 43. Error Information

Users should receive useful errors without receiving sensitive internal information.

Safe:

```text
COMPILATION_ERROR
```

Potentially unsafe:

```text
Internal Docker host path:
 /var/lib/...
```

Internal stack traces, secrets, host paths, and infrastructure details should not be exposed.

---

# 44. Logging Security

Logs should not contain sensitive information unnecessarily.

Avoid logging:

```text
Passwords
JWT Secrets
Database Credentials
API Keys
```

Source code should also not be logged by default.

---

# 45. Dependency Security

Application dependencies should be kept updated.

The project should periodically check for:

- Known vulnerabilities
- Outdated dependencies
- Vulnerable Docker base images

---

# 46. Environment Security

Separate environments should use separate configuration:

```text
Development
Testing
Production
```

Production secrets must never be committed to Git.

Use:

```text
.env
```

or an appropriate secret-management solution.

Only a safe template such as:

```text
.env.example
```

should be committed.

---

# 47. Security Monitoring

Important security-related events should be logged.

Examples:

```text
Failed login
Unauthorized access
Rate limit violation
Execution failure
Sandbox failure
Repeated submission abuse
```

---

# 48. Incident Handling

If a security issue is discovered:

```text
Detect
  ↓
Investigate
  ↓
Contain
  ↓
Fix
  ↓
Test
  ↓
Deploy
  ↓
Document
```

Critical sandbox vulnerabilities should be treated with high priority.

---

# 49. Security Testing

Security tests should include:

```text
Authentication bypass
Authorization bypass
Submission ownership bypass
Hidden test leakage
Command injection
Infinite loops
Memory exhaustion
Process exhaustion
Huge output
Network access
Filesystem access
Secret access
Container isolation
Docker socket access
```

---

# 50. Security Checklist

Before considering the MVP secure enough for its intended environment:

- [ ] Passwords are hashed.
- [ ] JWT validation is implemented.
- [ ] Protected routes require authentication.
- [ ] Admin operations require authorization.
- [ ] Submission ownership is verified.
- [ ] Input validation is implemented.
- [ ] Source-code size is limited.
- [ ] Supported languages are whitelisted.
- [ ] Hidden test cases are protected.
- [ ] User code never runs directly on the host.
- [ ] Docker sandbox is used.
- [ ] Network access is disabled.
- [ ] Containers run without unnecessary privileges.
- [ ] CPU limits are enforced.
- [ ] Memory limits are enforced.
- [ ] Process limits are enforced.
- [ ] Execution timeout is enforced.
- [ ] Output size is limited.
- [ ] Docker socket is not exposed.
- [ ] Secrets are not passed into the sandbox.
- [ ] Sandbox cleanup is guaranteed.
- [ ] Rate limiting is implemented.
- [ ] HTTPS is used in production.
- [ ] Sensitive data is excluded from logs.

---

# 51. Security Priorities

| Area | Priority |
|---|---|
| Authentication | P0 |
| Authorization | P0 |
| Submission ownership | P0 |
| Hidden test protection | P0 |
| Code isolation | P0 |
| CPU/Memory limits | P0 |
| Execution timeout | P0 |
| Network isolation | P0 |
| Filesystem restrictions | P0 |
| Secret protection | P0 |
| Rate limiting | P1 |
| Security logging | P1 |
| Dependency scanning | P1 |
| Stronger sandbox technology | Future |

---

# 52. Important MVP Limitation

CodeArena is a portfolio/learning project.

The Docker-based execution environment is an MVP security design and should not automatically be considered safe for unrestricted hostile code on a public production service.

A production-grade online judge would require deeper security review, stronger isolation, continuous monitoring, hardened infrastructure, and potentially microVM-based execution.

---

## 53. Final Security Model

The fundamental security model is:

```text
                 Untrusted
                    |
                    v
              User Source Code
                    |
                    v
             Execution Engine
                    |
                    v
             Isolated Sandbox
                    |
          +---------+---------+
          |         |         |
        CPU      Memory     Time
        Limit     Limit     Limit
          |         |         |
          +---------+---------+
                    |
                    v
                Verdict
```

The core principle is:

> **Never trust user-submitted code, and never allow it direct access to application or host resources.**