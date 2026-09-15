# ADR-009: Initial Language Support

## Status

Accepted

## Context

CodeArena is intended to support multiple programming languages.

Supporting many languages in the MVP would increase:

- Runtime image management
- Testing requirements
- Compiler/runtime configuration
- Sandbox complexity
- Maintenance effort

The MVP needs a small but useful language set.

## Decision

The MVP will initially support:

```text
C++
Python
JavaScript
```

Their API identifiers are:

```text
CPP
PYTHON
JAVASCRIPT
```

Each language will use a trusted language configuration containing its runtime/compiler information.

## Language Model

```text
Language
   ↓
Language Configuration
   ↓
Runtime Image
   ↓
Compile / Run
   ↓
Execution Result
```

Example source files:

```text
CPP        → main.cpp
PYTHON     → main.py
JAVASCRIPT → main.js
```

## Rationale

These languages provide a good initial balance between:

- Popularity
- Different execution models
- Implementation simplicity
- Competitive programming relevance

C++ demonstrates compilation, while Python and JavaScript demonstrate interpreted/runtime execution.

## Consequences

### Positive

The execution system remains manageable while demonstrating multi-language support.

### Negative

Users cannot submit code in languages not yet supported.

## Future Evolution

Additional languages such as:

```text
Java
Go
Rust
C
Kotlin
```

may be added through the same language abstraction.

A language must not be enabled until its runtime, security configuration, resource limits, and tests are implemented.

## Related Documentation

- `07-execution-engine/language-support.md`
- `07-execution-engine/execution-flow.md`