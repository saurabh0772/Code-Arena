# ADR-008: Sequential Test Execution

## Status

Accepted

## Context

A submission may contain multiple public and hidden test cases.

The Execution Engine needs to decide whether these test cases should initially run sequentially or in parallel.

Parallel execution could reduce total execution time, but it would also increase implementation complexity and resource consumption.

The MVP should prioritize correctness, simplicity, and predictable resource usage.

## Decision

CodeArena will execute test cases **sequentially in the MVP**.

The Execution Engine will:

```text
Test Case 1
    ↓
Execute
    ↓
Compare
    ↓
Test Case 2
    ↓
Execute
    ↓
Compare
    ↓
...
```

Execution may stop early when a definitive failure occurs.

For example, if a test case produces `WRONG_ANSWER`, remaining test cases do not need to execute.

## Rationale

Sequential execution provides:

- Simpler implementation
- Easier debugging
- Predictable resource usage
- Easier sandbox management
- Simpler failure handling
- Lower MVP complexity

## Consequences

### Positive

The execution pipeline is easier to implement, test, and reason about.

### Negative

A submission with many test cases may take longer than a parallel implementation.

## Future Evolution

Parallel test execution may be introduced after the MVP if performance measurements justify it.

A future worker-based architecture could distribute execution work across multiple workers.

## Related Documentation

- `07-execution-engine/execution-flow.md`
- `07-execution-engine/sandbox-design.md`
- `08-testing/test-strategy.md`