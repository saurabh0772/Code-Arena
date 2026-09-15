# ADR-002: Use MongoDB as the MVP Database

## Status

Accepted

## Date

2026-09-15

## Context

CodeArena needs persistent storage for:

```text
Users
Problems
Test Cases
Submissions
```

The user is already familiar with MongoDB and the application naturally contains document-oriented data such as:

```text
Problem
├── title
├── description
├── difficulty
├── tags
├── examples
└── constraints
```

The system also requires relationships between:

```text
Users
Problems
Test Cases
Submissions
```

## Decision

CodeArena will use **MongoDB with Mongoose** for the MVP.

The primary collections are:

```text
Users
Problems
TestCases
Submissions
```

Relationships between large or independently managed entities will use references.

For example:

```text
Submission
    |
    +---- userId
    |
    +---- problemId
```

## Why

MongoDB provides:

- Flexible document model
- Easy integration with Node.js
- Familiarity for the development team
- Good support for JSON-like application data
- Straightforward horizontal scaling options
- Simple MVP development

Mongoose will provide:

- Schema definitions
- Validation
- Models
- Query abstraction
- Index definitions

## Alternatives Considered

### PostgreSQL

PostgreSQL would be a strong choice because CodeArena contains relational data.

However, MongoDB was selected for the MVP because:

- It aligns with the existing MERN stack.
- It reduces learning and implementation overhead.
- The MVP does not require complex relational transactions.

### MySQL

Rejected for similar reasons.

MongoDB provides a more natural fit with the existing Node.js/MERN development stack.

## Data Modeling Decision

The system will not embed everything into a single document.

For example:

```text
Problem
   |
   +---- examples[]        Embedded
   |
   +---- TestCases         Referenced
   |
   +---- Submissions       Referenced
```

Small, bounded data such as examples can be embedded.

Large or independently managed data such as test cases and submissions will remain separate collections.

## Consequences

### Positive

- Simple Node.js integration
- Fast MVP development
- Flexible schema
- Familiar development workflow

### Negative

- Application must carefully manage relationships.
- Some relational integrity must be enforced at the application layer.
- Complex transactional workflows may require additional design.

## Future Evolution

If the workload or data model requires stronger relational guarantees, PostgreSQL can be evaluated later.

The current architecture should avoid tightly coupling business logic to MongoDB-specific behavior wherever practical.