/**
 * Custom Error Classes for Execution Engine
 */

class ExecutionEngineError extends Error {
  constructor(message, errorCode = 'EXECUTION_ENGINE_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ExecutionEngineError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

class CompilationError extends ExecutionEngineError {
  constructor(message, compilerOutput = '') {
    super(message, 'COMPILATION_ERROR');
    this.compilerOutput = compilerOutput;
  }
}

class RuntimeExecutionError extends ExecutionEngineError {
  constructor(message, exitCode = null, signal = null, stdout = '', stderr = '') {
    super(message, 'RUNTIME_EXECUTION_ERROR');
    this.exitCode = exitCode;
    this.signal = signal;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

module.exports = {
  ExecutionEngineError,
  ValidationError,
  CompilationError,
  RuntimeExecutionError
};
