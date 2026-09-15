# CodeArena — Execution Flow

## 1. Document Information

| Field | Value |
|---|---|
| Product | CodeArena |
| Component | Execution Engine |
| Version | 1.0 |
| Execution Model | Synchronous MVP |
| Status | Approved |

---

# 2. Purpose

The Execution Engine is responsible for running user-submitted source code and producing a reliable execution result.

Its main responsibilities are:

- Validate execution requests
- Resolve programming language
- Create sandbox
- Prepare source code
- Compile when required
- Execute program
- Enforce resource limits
- Evaluate output
- Generate verdict
- Collect metrics
- Clean up resources

---

# 3. Execution Architecture

```text
Backend
   |
   v
Execution Adapter
   |
   v
Execution Engine
   |
   v
Sandbox Manager
   |
   v
Docker Sandbox
   |
   v
User Program
```

The Execution Engine is separated from normal Backend business logic because user code is untrusted and resource-intensive.

---

# 4. Execution Request

The Backend sends an execution request containing the information required to run a submission.

Conceptually:

```text
ExecutionRequest
├── submissionId
├── language
├── sourceCode
├── testCases
└── resourceLimits
```

The exact internal request format can evolve independently from the public API.

---

# 5. Execution Lifecycle

The general lifecycle is:

```text
Receive Request
      |
      v
Validate
      |
      v
Resolve Language
      |
      v
Create Sandbox
      |
      v
Prepare Source
      |
      v
Compile
      |
      v
Execute
      |
      v
Evaluate
      |
      v
Generate Verdict
      |
      v
Cleanup
      |
      v
Return Result
```

---

# 6. Step 1 — Validate Request

The Execution Engine validates:

- Submission ID
- Language
- Source code
- Test cases
- Resource configuration

Invalid requests should be rejected before execution begins.

---

# 7. Step 2 — Resolve Language

The requested language is mapped to a trusted configuration.

Example:

```text
CPP
  |
  v
C++ Runtime Configuration

PYTHON
  |
  v
Python Runtime Configuration

JAVASCRIPT
  |
  v
Node.js Runtime Configuration
```

Users cannot provide arbitrary compiler or runtime commands.

---

# 8. Step 3 — Create Sandbox

A disposable Docker container is created.

```text
Execution Engine
       |
       v
Docker Runtime
       |
       v
New Container
```

The sandbox receives only the data required for execution.

---

# 9. Step 4 — Prepare Workspace

The Execution Engine prepares a temporary workspace.

Typical contents:

```text
/workspace
├── source code
├── executable (if compiled)
└── temporary files
```

The workspace should not expose host filesystem data.

---

# 10. Step 5 — Compile

Compiled languages require compilation.

For C++:

```text
Source Code
    |
    v
Compiler
    |
    +---- Error
    |       |
    |       v
    | COMPILATION_ERROR
    |
    v
Executable
```

Interpreted languages do not require a separate compilation stage.

---

# 11. Step 6 — Execute Program

The program is executed inside the sandbox.

```text
Sandbox
   |
   v
Program
   |
   v
stdin
   |
   v
stdout / stderr
```

The program must not have unrestricted access to:

- Host filesystem
- Network
- Docker socket
- Application secrets

---

# 12. Step 7 — Execute Test Cases

The MVP executes test cases sequentially.

```text
Test 1
  |
  v
Execute
  |
  v
Compare
  |
  +---- Failed → Stop
  |
  v
Test 2
  |
  v
Execute
  |
  v
Compare
  |
 ...
  |
  v
All Tests Passed
```

Early termination can be used when a definitive failure occurs.

---

# 13. Step 8 — Resource Enforcement

Execution limits include:

```text
CPU
Memory
Execution Time
Processes
Output Size
```

If a limit is exceeded, execution is terminated.

---

# 14. Timeout Handling

Example:

```text
Program Starts
      |
      v
Timer Starts
      |
      v
Program Running
      |
      +---- Finishes → Continue
      |
      +---- Timeout → Terminate
                         |
                         v
                  TIME_LIMIT_EXCEEDED
```

Infinite loops must not be allowed to run indefinitely.

---

# 15. Memory Limit Handling

If the program exceeds its configured memory limit:

```text
Memory Usage
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

# 16. Process Limit Handling

The sandbox should restrict the number of processes a submission can create.

This protects the execution environment from process-exhaustion attacks.

---

# 17. Output Handling

Program output is captured and compared against expected output.

Output size should be limited.

```text
Program
   |
   v
stdout
   |
   v
Output Limit
   |
   +---- Exceeded → Terminate
```

---

# 18. Output Comparison

For each test case:

```text
Actual Output
      |
      v
Comparator
      ^
      |
Expected Output
```

The comparator should follow a clearly defined normalization policy, such as handling trailing whitespace where appropriate.

---

# 19. Verdict Generation

The Execution Engine generates a verdict based on execution behavior.

Possible results:

```text
ACCEPTED
WRONG_ANSWER
COMPILATION_ERROR
RUNTIME_ERROR
TIME_LIMIT_EXCEEDED
MEMORY_LIMIT_EXCEEDED
```

---

# 20. Verdict Priority

Execution failures take precedence over output comparison.

Example:

```text
Compilation Failure
       ↓
COMPILATION_ERROR
```

```text
Timeout
       ↓
TIME_LIMIT_EXCEEDED
```

```text
Runtime Crash
       ↓
RUNTIME_ERROR
```

A system failure must not be incorrectly reported as `WRONG_ANSWER`.

---

# 21. Execution Metrics

The engine should collect:

```text
runtimeMs
memoryKb
testsPassed
totalTests
```

Additional internal metrics may be collected for monitoring.

---

# 22. Execution Result

Conceptually:

```text
ExecutionResult
├── status
├── verdict
├── runtimeMs
├── memoryKb
├── testsPassed
├── totalTests
└── errorMessage
```

The Backend uses this result to update the Submission record.

---

# 23. Result Flow

```text
Execution Engine
       |
       v
Execution Result
       |
       v
Execution Adapter
       |
       v
Submission Service
       |
       v
MongoDB
```

---

# 24. Cleanup

Cleanup must happen regardless of the execution outcome.

```text
Execution
   |
   +---- Success
   +---- Wrong Answer
   +---- Compile Error
   +---- Runtime Error
   +---- Timeout
   +---- Memory Error
   +---- Unexpected Error
             |
             v
          Cleanup
```

The sandbox should be destroyed after the submission finishes.

---

# 25. Failure Isolation

A failed submission should not crash the Backend.

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

Each submission should have an isolated execution environment.

---

# 26. Complete MVP Flow

```text
Client
   |
   v
Backend
   |
   v
Submission Service
   |
   v
Execution Adapter
   |
   v
Execution Engine
   |
   v
Validate
   |
   v
Create Sandbox
   |
   v
Prepare Source
   |
   v
Compile
   |
   v
Execute Tests
   |
   v
Compare Outputs
   |
   v
Generate Verdict
   |
   v
Cleanup
   |
   v
Backend
   |
   v
MongoDB
```

---

# 27. MVP Execution Model

The initial implementation is synchronous.

```text
HTTP Request
     |
     v
Execute Submission
     |
     v
Return Result
```

This keeps the initial system simple.

---

# 28. Future Asynchronous Model

The execution model can later become:

```text
Backend
   |
   v
Queue
   |
   v
Execution Worker
   |
   v
Execution Engine
   |
   v
Sandbox
```

The Submission abstraction remains unchanged.

---

# 29. Execution Principles

1. Never execute user code directly on the Backend host.
2. Use a fresh sandbox for each submission.
3. Enforce resource limits.
4. Validate language configurations.
5. Never trust user-provided commands.
6. Capture execution results reliably.
7. Clean up execution resources.
8. Separate infrastructure failures from user-code failures.
9. Keep execution isolated from normal API workloads.