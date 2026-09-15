# ADR-004: Store Test Cases in a Separate Collection

## Status

Accepted

## Date

2026-09-15

## Context

Every CodeArena problem can contain multiple test cases.

A test case contains:

```text
input
expectedOutput
visibility
order
```

Some test cases are public while others are hidden.

A problem may eventually contain many test cases.

Embedding all test cases directly inside the Problem document would make the Problem document larger and would make sensitive hidden data part of the main problem object.

## Decision

Test cases will be stored in a dedicated:

```text
TestCases
```

MongoDB collection.

Relationship:

```text
Problem
   |
   | 1:N
   v
TestCases
```

Each test case contains:

```text
problemId
input
expectedOutput
visibility
order
isActive
```

## Why

Separate storage provides:

### Security

Hidden test cases can be accessed only by trusted backend/execution components.

### Scalability

A problem can have many test cases without continuously increasing the size of the main Problem document.

### Independent Lifecycle

Test cases can be:

- Added
- Updated
- Deleted
- Disabled

without modifying the entire Problem document.

### Execution Efficiency

The Execution Engine can retrieve test cases independently when preparing an execution.

## Embedded Alternatives

### Embed All Test Cases

Rejected because:

- Hidden data becomes part of the main problem document.
- Problem documents can grow significantly.
- Test case lifecycle becomes coupled to the Problem document.
- Execution-specific access becomes less clean.

### Store Only Test Cases

Rejected because small public examples are naturally part of the problem description.

Therefore:

```text
Public Examples -> Embedded in Problem

Actual Test Cases -> Separate Collection
```

## Consequences

### Positive

- Better separation of sensitive data.
- Better scalability.
- Independent test-case management.
- Cleaner execution architecture.

### Negative

- Additional database queries.
- Application must manage the `problemId` relationship.
- Execution requires retrieving multiple documents.

## Security Rule

Normal users must never receive:

```text
hidden input
hidden expectedOutput
```

through the public API.

## Future Evolution

If the test-case dataset becomes very large, test-case storage can evolve toward:

```text
Object Storage
+
Metadata Database
```

while keeping the public API unchanged.