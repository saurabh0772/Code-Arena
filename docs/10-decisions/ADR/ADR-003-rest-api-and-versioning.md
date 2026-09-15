# ADR-003: Use REST API with Versioned Endpoints

## Status

Accepted

## Date

2026-09-15

## Context

The frontend needs to communicate with the Backend for:

- Authentication
- User information
- Problems
- Test cases
- Submissions

The API should be simple, predictable, and easy to consume from the React frontend.

The internal execution architecture may change significantly in the future.

For example:

```text
MVP:
Backend -> Execution Engine

Future:
Backend -> Queue -> Worker Pool -> Sandbox
```

The public API should not need to change simply because the internal execution architecture changes.

## Decision

CodeArena will use a RESTful HTTP API.

The API will use:

```text
/api/v1
```

as its base version.

Examples:

```text
POST /api/v1/auth/register

POST /api/v1/auth/login

GET /api/v1/problems

GET /api/v1/problems/:problemId

POST /api/v1/submissions

GET /api/v1/submissions/:submissionId
```

## Why REST

REST was selected because:

- It is widely understood.
- It works naturally with HTTP.
- It is easy to test.
- It works well with React.
- It is easy to document.
- It is appropriate for CRUD resources.
- It avoids unnecessary infrastructure for the MVP.

## API Design Principles

The API should:

- Use HTTP methods correctly.
- Return JSON.
- Use meaningful status codes.
- Validate requests.
- Authenticate protected endpoints.
- Authorize resources server-side.
- Use consistent error responses.
- Support pagination where needed.

## Versioning

The initial API version is:

```text
v1
```

Example:

```text
/api/v1/problems
```

If breaking API changes become necessary:

```text
/api/v2/problems
```

can be introduced.

## Alternatives Considered

### GraphQL

Rejected for MVP because the application's initial requirements do not justify the additional complexity.

### gRPC

Rejected for the public API because REST is simpler for browser clients.

gRPC may still be considered for internal service-to-service communication in a future distributed architecture.

## Consequences

### Positive

- Simple frontend integration
- Easy debugging
- Clear API contract
- Easy external testing
- Stable public interface

### Negative

- Some clients may require multiple requests.
- Version management will be required for future breaking changes.

## Future Evolution

The API can remain REST-based even if the internal architecture becomes:

```text
API
 |
 v
Submission Service
 |
 v
Queue
 |
 v
Execution Workers
```

The public API does not need to expose the queue or worker infrastructure.