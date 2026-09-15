# CodeArena — Language Support

## 1. Purpose

This document defines how CodeArena supports multiple programming languages.

The goal is to provide a common execution interface while allowing each language to have its own compiler, runtime, and configuration.

---

# 2. Initial Languages

The MVP supports:

| Language | Identifier | Execution Type |
|---|---|---|
| C++ | `CPP` | Compiled |
| Python | `PYTHON` | Interpreted |
| JavaScript | `JAVASCRIPT` | Interpreted |

Additional languages can be added later.

---

# 3. Language Abstraction

The Execution Engine should not contain language-specific logic scattered throughout the codebase.

Instead, each language should have a configuration.

Conceptually:

```text
LanguageConfig
├── identifier
├── sourceFilename
├── image
├── compiler
├── compileCommand
├── runCommand
└── resourceLimits
```

---

# 4. Language Resolution

```text
Request
   |
   v
language = CPP
   |
   v
Language Registry
   |
   v
C++ Configuration
```

Unknown languages must be rejected.

```text
language = UNKNOWN
       |
       v
UNSUPPORTED_LANGUAGE
```

---

# 5. C++ Execution

C++ requires compilation before execution.

```text
main.cpp
   |
   v
C++ Compiler
   |
   +---- Failure
   |       |
   |       v
   | COMPILATION_ERROR
   |
   v
Executable
   |
   v
Run
```

A dedicated versioned C++ execution image should contain the required compiler/runtime.

Example concept:

```text
codearena/cpp-runtime:v1
```

---

# 6. Python Execution

Python source can be executed using a predefined Python runtime.

```text
main.py
   |
   v
Python Runtime
   |
   v
Program
```

The environment should not allow arbitrary package installation or network downloads.

---

# 7. JavaScript Execution

JavaScript source can be executed using a predefined Node.js runtime.

```text
main.js
   |
   v
Node.js Runtime
   |
   v
Program
```

The Node.js version should be explicitly defined by the execution environment.

---

# 8. Common Execution Interface

All languages should follow the same conceptual flow:

```text
Source Code
    |
    v
Language Configuration
    |
    v
Prepare
    |
    v
Compile if Required
    |
    v
Execute
    |
    v
Capture Result
```

This keeps the Execution Engine architecture consistent.

---

# 9. Source Filenames

Each language should have a predefined source filename.

Example:

| Language | Filename |
|---|---|
| C++ | `main.cpp` |
| Python | `main.py` |
| JavaScript | `main.js` |

Users should not control arbitrary filesystem paths.

---

# 10. Compiler and Runtime Commands

Commands must come from trusted application configuration.

Example:

```text
CPP
   |
   +---- Compiler: g++
   +---- Compile Command: predefined
   +---- Run Command: predefined
```

User input must never be directly inserted into shell commands.

---

# 11. Language Images

Each language can use a dedicated versioned runtime image.

```text
Execution Engine
       |
       +---- CPP Image
       |
       +---- Python Image
       |
       +---- Node.js Image
```

Versioning improves reproducibility.

---

# 12. Resource Limits

Every language should have execution limits.

Possible limits include:

```text
CPU
Memory
Time
Processes
Output
```

Language-specific defaults may be defined while still enforcing global safety limits.

---

# 13. Deterministic Environment

Execution environments should be as deterministic as practical.

Avoid:

- Network downloads
- Runtime package installation
- Uncontrolled external dependencies
- Environment-specific behavior

The same submission should ideally produce the same result under the same test inputs.

---

# 14. Standard Input and Output

Programs communicate through:

```text
stdin
stdout
stderr
```

Test input is provided through standard input.

Expected output is compared against captured standard output.

---

# 15. Compilation Errors

For compiled languages:

```text
Source
  |
  v
Compile
  |
  +---- Failure
           |
           v
    COMPILATION_ERROR
```

Compiler output may be captured for debugging but should be sanitized before being returned to users if it contains sensitive internal information.

---

# 16. Runtime Errors

If a program crashes:

```text
Program
   |
   v
Runtime Failure
   |
   v
RUNTIME_ERROR
```

---

# 17. Unsupported Languages

The API and Execution Engine must reject unsupported languages.

Example:

```text
JAVA
  |
  v
Not configured
  |
  v
UNSUPPORTED_LANGUAGE
```

Java should not become available until its runtime configuration and execution environment are explicitly added.

---

# 18. Adding a New Language

Adding a language should generally require:

```text
Create Runtime Image
        ↓
Define Language Configuration
        ↓
Define Source Filename
        ↓
Define Compile/Run Commands
        ↓
Define Resource Limits
        ↓
Add Tests
        ↓
Enable Language
```

---

# 19. Future Languages

Potential future languages include:

```text
Java
Go
Rust
C
Kotlin
```

They should follow the same language abstraction.

---

# 20. Language Support Principles

1. Languages are explicitly whitelisted.
2. Compiler/runtime commands are trusted configurations.
3. Each language uses a controlled environment.
4. Runtime versions should be pinned.
5. Network access is disabled.
6. Arbitrary dependencies are not allowed.
7. Resource limits are always enforced.
8. Every language requires execution tests.