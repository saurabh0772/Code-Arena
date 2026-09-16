/**
 * Execution Engine Constants
 */

const VERDICTS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  TIME_LIMIT_EXCEEDED: 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  OUTPUT_LIMIT_EXCEEDED: 'OUTPUT_LIMIT_EXCEEDED'
});

const SUPPORTED_LANGUAGES = Object.freeze(['CPP', 'PYTHON', 'JAVASCRIPT']);

const LIMITS = Object.freeze({
  MAX_SOURCE_CODE_BYTES: 65536, // 64 KB
  COMPILE_TIMEOUT_MS: 10000,    // 10 seconds compilation timeout
  EXECUTION_TIMEOUT_MS: 5000,   // 5 seconds default execution timeout
  MAX_OUTPUT_BYTES: 512 * 1024, // 512 KB output threshold for termination
  MAX_BUFFER_BYTES: 512 * 1024, // 512 KB max stdout/stderr buffer
  MEMORY_LIMIT_MB: 256,         // 256 MB RAM limit
  PID_LIMIT: 64,                // 64 max processes (fork-bomb limit)
  CPU_QUOTA: 1.0                // 1.0 CPU core limit
});

module.exports = {
  VERDICTS,
  SUPPORTED_LANGUAGES,
  LIMITS
};
