# CodeArena — Non-Functional Requirements

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Document | Non-Functional Requirements |
| Version | 1.0 |
| Status | Approved |

---

## 2. Purpose

This document defines the quality attributes and operational requirements of CodeArena.

Non-functional requirements describe **how well the system should operate** rather than what features it provides.

The major areas are:

- Performance
- Scalability
- Availability
- Security
- Reliability
- Maintainability
- Observability
- Testability

---

# 3. Performance

## NFR-01 — API Response Time

For normal API operations, the system should target:

```text
p95 < 500 ms
```

This target applies to operations such as:

- Login
- Problem listing
- Problem retrieval
- Submission creation
- Submission retrieval

Code execution time is excluded because execution depends on submitted programs.

---

## NFR-02 — Database Queries

Common API operations should use appropriate indexes.

The system should avoid unnecessary full collection scans for frequently accessed resources.

---

## NFR-03 — Submission Handling

Submission creation should not perform unnecessary heavy processing inside the HTTP request path.

The architecture should allow execution to move to asynchronous workers in the future.

---

# 4. Scalability

## NFR-04 — Horizontal Backend Scaling

The Backend should be designed to support multiple instances.

```text
             Load Balancer
                  |
        +---------+---------+
        |         |         |
        v         v         v
    Backend   Backend   Backend
```

The Backend should avoid relying on process-local state for critical application data.

---

## NFR-05 — Execution Scaling

Execution workloads should be independently scalable from normal API workloads.

Future architecture:

```text
Backend
   |
   v
Queue
   |
   +---- Worker
   +---- Worker
   +---- Worker
```

---

## NFR-06 — Database Growth

Database queries must remain efficient as:

- Users increase
- Problems increase
- Submissions increase
- Test cases increase

Indexes should be based on actual query patterns.

---

# 5. Security

## NFR-07 — Authentication Security

Passwords must never be stored in plaintext.

Passwords must use a strong password hashing algorithm such as:

```text
Argon2
```

or an appropriately configured alternative such as bcrypt.

---

## NFR-08 — Authorization

The system must enforce:

- Role-based authorization
- Resource ownership
- Server-side authorization checks

Client-side authorization alone is insufficient.

---

## NFR-09 — Untrusted Code Isolation

User-submitted code must never execute directly on the Backend host.

The Execution Engine must use an isolated sandbox.

---

## NFR-10 — Sandbox Restrictions

The execution environment should enforce:

- No network access
- CPU limits
- Memory limits
- Process limits
- Execution timeout
- Output limits
- Non-root execution
- Restricted filesystem access
- No application secrets

---

## NFR-11 — Hidden Test Security

Hidden test cases must not be exposed through normal user APIs.

The following must remain private:

```text
Hidden input
Hidden expected output
```

---

## NFR-12 — Input Validation

All externally supplied input must be validated before processing.

This includes:

- Authentication fields
- Problem data
- Test case data
- Submission data
- Query parameters

---

## NFR-13 — Rate Limiting

Sensitive and resource-intensive endpoints should have rate limits.

Priority endpoints include:

```text
Login
Registration
Submission
```

---

# 6. Reliability

## NFR-14 — Failure Isolation

A failed user submission should not crash the Backend.

Execution failures must be isolated from normal API operations.

---

## NFR-15 — Cleanup Reliability

Execution resources must be cleaned even when execution fails.

```text
Success
Failure
Timeout
Crash
    |
    v
Cleanup
```

---

## NFR-16 — Graceful Shutdown

Backend and Execution Engine processes should gracefully handle shutdown signals.

Running operations should be handled according to the component's shutdown policy.

---

# 7. Availability

## NFR-17 — Health Checks

The Backend shall expose a health endpoint such as:

```text
GET /health
```

The Execution Engine should also provide a health/readiness mechanism.

---

## NFR-18 — Dependency Health

The system should be able to detect important dependency failures such as:

- MongoDB unavailable
- Execution Engine unavailable

Failures should produce appropriate error responses rather than hanging indefinitely.

---

# 8. Maintainability

## NFR-19 — Modular Architecture

The Backend should maintain clear module boundaries.

Example:

```text
auth
users
problems
test-cases
submissions
```

Business logic should not be placed directly inside route handlers.

---

## NFR-20 — Layered Backend Design

The Backend should follow a structure similar to:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository / Model
  ↓
Database
```

---

## NFR-21 — Configuration

Environment-specific configuration must be externalized.

Secrets must not be hard-coded into source code.

---

## NFR-22 — Documentation

Important architectural decisions must be documented using ADRs.

Major components should have corresponding technical documentation.

---

# 9. Observability

## NFR-23 — Logging

The system should produce structured logs for important events.

Examples:

```text
Request received
Authentication failure
Submission created
Execution started
Execution completed
Execution failed
```

---

## NFR-24 — Request Identification

Requests should have a request ID or correlation ID where practical.

This helps trace a request across:

```text
Frontend
   ↓
Backend
   ↓
Execution Engine
```

---

## NFR-25 — Execution Metrics

Execution results should capture metrics such as:

- Runtime
- Memory usage
- Tests passed
- Total tests
- Verdict

---

# 10. Testability

## NFR-26 — Unit Testability

Business logic should be separated from infrastructure dependencies where practical.

Important components should be independently testable.

---

## NFR-27 — Integration Testing

The system should support integration testing with:

- MongoDB
- Backend API
- Execution Engine
- Docker sandbox

---

## NFR-28 — Security Testing

The execution system should be tested against:

- Infinite loops
- Memory exhaustion
- Excessive processes
- Huge output
- Network access
- Filesystem access
- Cross-submission access

---

# 11. Data Integrity

## NFR-29 — Submission Integrity

Once a submission is created, its source code and associated problem/user references should remain consistent.

---

## NFR-30 — Historical Records

Historical submissions should remain available even if a problem is later deactivated.

---

# 12. Resource Management

## NFR-31 — Execution Resource Limits

Every execution must have bounded resource consumption.

At minimum:

```text
CPU
Memory
Time
Processes
Output
```

---

## NFR-32 — Temporary Resource Cleanup

Temporary files, containers, and execution resources must be cleaned after execution.

---

# 13. API Quality

## NFR-33 — Consistent API Responses

API responses should follow a consistent structure.

Success example:

```json
{
  "success": true,
  "data": {}
}
```

Error example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request"
  }
}
```

---

## NFR-34 — API Versioning

The public API shall use versioning:

```text
/api/v1
```

Breaking changes should use a new API version.

---

# 14. Deployment

## NFR-35 — Containerization

Backend and Execution Engine components should be containerized using Docker.

---

## NFR-36 — Environment Separation

The system should support separate configurations for:

```text
Development
Testing
Production
```

Production secrets must not be committed to source control.

---

# 15. Non-Functional Requirement Summary

| ID | Category | Requirement | Priority |
|---|---|---|---|
| NFR-01 | Performance | API response target | P1 |
| NFR-02 | Performance | Indexed queries | P0 |
| NFR-03 | Performance | Efficient submissions | P1 |
| NFR-04 | Scalability | Horizontal backend scaling | P1 |
| NFR-05 | Scalability | Independent execution scaling | P1 |
| NFR-06 | Scalability | Database growth | P1 |
| NFR-07 | Security | Password hashing | P0 |
| NFR-08 | Security | Authorization | P0 |
| NFR-09 | Security | Code isolation | P0 |
| NFR-10 | Security | Sandbox restrictions | P0 |
| NFR-11 | Security | Hidden test protection | P0 |
| NFR-12 | Security | Input validation | P0 |
| NFR-13 | Security | Rate limiting | P1 |
| NFR-14 | Reliability | Failure isolation | P0 |
| NFR-15 | Reliability | Cleanup | P0 |
| NFR-16 | Reliability | Graceful shutdown | P1 |
| NFR-17 | Availability | Health checks | P1 |
| NFR-18 | Availability | Dependency health | P1 |
| NFR-19 | Maintainability | Modular architecture | P0 |
| NFR-20 | Maintainability | Layered design | P0 |
| NFR-21 | Maintainability | External configuration | P0 |
| NFR-22 | Maintainability | Documentation | P1 |
| NFR-23 | Observability | Structured logging | P1 |
| NFR-24 | Observability | Request IDs | P1 |
| NFR-25 | Observability | Execution metrics | P1 |
| NFR-26 | Testability | Unit testing | P0 |
| NFR-27 | Testability | Integration testing | P0 |
| NFR-28 | Testability | Security testing | P0 |
| NFR-29 | Integrity | Submission integrity | P0 |
| NFR-30 | Integrity | Historical records | P1 |
| NFR-31 | Resources | Execution limits | P0 |
| NFR-32 | Resources | Resource cleanup | P0 |
| NFR-33 | API | Consistent responses | P1 |
| NFR-34 | API | API versioning | P0 |
| NFR-35 | Deployment | Containerization | P1 |
| NFR-36 | Deployment | Environment separation | P0 |

---

# 16. Priority Definition

| Priority | Meaning |
|---|---|
| P0 | Critical for MVP correctness/security |
| P1 | Important for a complete MVP |
| P2 | Useful future enhancement |

---

## 17. Quality Target

CodeArena should prioritize:

```text
Secure
   +
Reliable
   +
Maintainable
   +
Predictable
   +
Scalable
```

The MVP does not need production-scale infrastructure, but its architecture should provide a clear path toward it.