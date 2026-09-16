# CodeArena — Execution Engine

The **Execution Engine** is an isolated component responsible for compiling, executing, and evaluating untrusted user code against test cases, and producing an authoritative verdict.

---

## 1. Execution Flow

```text
Execution Request
       |
       v
Request Validation
       |
       v
Language Resolution (Trusted Configuration)
       |
       v
Workspace Preparation (Isolated Temp Dir)
       |
       v
C++ Compilation (g++)
       |
       +---- Failure ----> COMPILATION_ERROR
       |
       v (Success)
Process Execution
       |
     stdin (Piped)
       |
    stdout / stderr (Captured)
       |
       +---- Crash / Signal ----> RUNTIME_ERROR
       |
       v (Exit 0)
Output Evaluation (Normalized Whitespace Comparison)
       |
       +---- Mismatch ----> WRONG_ANSWER
       |
       +---- Match -------> ACCEPTED
       |
       v
Cleanup Workspace (Guaranteed via finally)
       |
       v
Execution Result
```

---

## 2. Verdicts Supported in Phase 7

| Verdict | Trigger Condition |
| :--- | :--- |
| `ACCEPTED` | Program exits with code 0 and normalized stdout matches expected test case output. |
| `WRONG_ANSWER` | Program exits with code 0 but normalized stdout does not match expected output. |
| `COMPILATION_ERROR` | C++ compiler (`g++`) fails to compile source code with non-zero exit status or timeout. |
| `RUNTIME_ERROR` | Program terminates with a non-zero exit code or is terminated by a signal (e.g., `SIGSEGV`, `SIGABRT`, `SIGFPE`). |

*Note: `PENDING`, `TIME_LIMIT_EXCEEDED`, and `MEMORY_LIMIT_EXCEEDED` are retained in constants for future compatibility, but resource limit quotas are scheduled for subsequent sandbox phases.*

---

## 3. Scope & Security Boundaries

### Implemented in Current Phase
- **C++ Execution**: Compilation using `g++` (`-O2 -std=c++17`).
- **Input Delivery**: Secure piping of input via standard input (`stdin`).
- **Output Capture**: Capture of `stdout` and `stderr` streams up to buffer limits.
- **Output Normalization**: Deterministic normalization ignoring CRLF/LF line endings, line trailing spaces, and end-of-file newlines.
- **Runtime Measurement**: High-resolution execution duration tracking in milliseconds (`runtimeMs`).
- **Workspace Isolation & Cleanup**: Temporary directories (`/tmp/codearena-exec-*`) created per execution and guaranteed to be purged in `finally` blocks.
- **Path Sanitization**: Compiler and runtime error messages are scrubbed of host filesystem paths before being returned.

### Not Implemented in Current Phase
- ❌ **Docker Sandbox**: Container isolation, disposable containers, seccomp, AppArmor.
- ❌ **Resource Limits**: cgroups, hard CPU quotas, hard memory limits, process limits.
- ❌ **Network Isolation**: Disabled host networking for child processes.
- ❌ **Other Languages**: Python and JavaScript execution (will be added in future phases).
- ❌ **Backend Integration**: Automatic execution of submissions from `backend/` or asynchronous workers.
- ❌ **Queues & Workers**: BullMQ, Redis, worker pools.

> [!WARNING]
> This phase executes code as local system processes for development and validation of the execution pipeline. It does NOT yet provide kernel-level container sandboxing or resource enforcement. Do not expose this service to untrusted public inputs without the subsequent Docker sandbox phase.

---

## 4. Running Tests

Run the Execution Engine test suite using Node.js built-in test runner:

```bash
npm test
```
