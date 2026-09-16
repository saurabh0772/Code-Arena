/**
 * Execution Service Orchestrator
 * Coordinates validation, workspace preparation, compilation, execution, evaluation, and cleanup.
 *
 * Enforces Docker Sandbox as the mandatory execution boundary for untrusted code.
 * Host process runner is only accessible if explicitly enabled via EXECUTION_MODE=local.
 */

const { VERDICTS, LIMITS } = require('../config/constants');
const { resolveLanguage } = require('../config/languages');
const { ValidationError, ExecutionEngineError } = require('../utils/errors');
const { createWorkspace, writeSourceFile, cleanupWorkspace } = require('../utils/workspace');
const { compileCpp } = require('../compiler/cpp.compiler');
const { runProcess } = require('../runner/process.runner');
const { runInDockerSandbox, checkDockerAvailable } = require('../runner/docker.sandbox');
const { evaluateOutput } = require('../evaluator/output.evaluator');

/**
 * Validates the incoming execution request.
 *
 * @param {object} request
 */
function validateExecutionRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Execution request must be an object');
  }

  if (!request.language || typeof request.language !== 'string') {
    throw new ValidationError('Language is required and must be a string');
  }

  if (typeof request.sourceCode !== 'string' || request.sourceCode.trim().length === 0) {
    throw new ValidationError('Source code is required and cannot be empty');
  }

  if (Buffer.byteLength(request.sourceCode, 'utf8') > LIMITS.MAX_SOURCE_CODE_BYTES) {
    throw new ValidationError(
      `Source code exceeds maximum permitted size of ${LIMITS.MAX_SOURCE_CODE_BYTES} bytes (64KB)`
    );
  }

  if (!request.testCase || typeof request.testCase !== 'object') {
    throw new ValidationError('Test case is required and must be an object');
  }

  if (request.testCase.input !== undefined && typeof request.testCase.input !== 'string') {
    throw new ValidationError('Test case input must be a string if provided');
  }

  if (typeof request.testCase.expectedOutput !== 'string') {
    throw new ValidationError('Test case expectedOutput is required and must be a string');
  }
}

/**
 * Executes a submission request through the full lifecycle:
 * validate -> workspace -> compile -> run in sandbox -> evaluate -> cleanup
 *
 * @param {object} request - Execution request
 * @returns {Promise<{ verdict: string, stdout: string, stderr: string, runtimeMs: number|null, compileOutput?: string }>}
 */
async function execute(request) {
  // 1. Validate request structure & constraints
  validateExecutionRequest(request);

  // 2. Resolve language configuration (CPP, PYTHON, JAVASCRIPT)
  const languageConfig = resolveLanguage(request.language);

  // 3. Determine execution mode (Docker sandbox is the mandatory default)
  const isLocalMode = process.env.EXECUTION_MODE === 'local';

  if (!isLocalMode) {
    const isDockerAvailable = await checkDockerAvailable();
    if (!isDockerAvailable) {
      throw new ExecutionEngineError(
        'EXECUTION_UNAVAILABLE: Docker sandbox runtime is required but unavailable. Untrusted code cannot be executed directly on the host.'
      );
    }
  }

  let workspaceDir = null;

  try {
    // 4. Create isolated temporary workspace
    workspaceDir = await createWorkspace();

    // 5. Write source code file
    await writeSourceFile(workspaceDir, languageConfig.sourceFilename, request.sourceCode);

    // 6. Compile if language requires compilation (CPP)
    if (languageConfig.isCompiled) {
      let compileResult;

      if (isLocalMode) {
        compileResult = await compileCpp(workspaceDir, languageConfig);
      } else {
        const dockerCompile = await runInDockerSandbox({
          workspaceDir,
          command: languageConfig.compiler,
          args: languageConfig.compileArgs,
          timeoutMs: LIMITS.COMPILE_TIMEOUT_MS,
          isCompile: true
        });

        compileResult = {
          success: dockerCompile.success,
          stderr: dockerCompile.stderr,
          stdout: dockerCompile.stdout,
          exitCode: dockerCompile.exitCode
        };
      }

      if (!compileResult.success) {
        return {
          verdict: VERDICTS.COMPILATION_ERROR,
          stdout: '',
          stderr: compileResult.stderr,
          runtimeMs: null,
          compileOutput: compileResult.stderr
        };
      }
    }

    // 7. Execute program with test case stdin inside isolated environment
    const input = request.testCase.input ?? '';
    let runResult;

    if (isLocalMode) {
      runResult = await runProcess(
        workspaceDir,
        languageConfig.command,
        languageConfig.args,
        input
      );
    } else {
      runResult = await runInDockerSandbox({
        workspaceDir,
        command: languageConfig.command,
        args: languageConfig.args,
        input
      });
    }

    // 8. Explicit mapping of timeout failures (FIX #1)
    if (runResult.isTimedOut) {
      return {
        verdict: VERDICTS.TIME_LIMIT_EXCEEDED,
        stdout: runResult.stdout,
        stderr: runResult.stderr || 'Time limit exceeded',
        runtimeMs: runResult.runtimeMs,
        compileOutput: ''
      };
    }

    // 9. Explicit mapping of memory limit failures (FIX #13)
    if (runResult.isOom) {
      return {
        verdict: VERDICTS.MEMORY_LIMIT_EXCEEDED,
        stdout: runResult.stdout,
        stderr: runResult.stderr || 'Memory limit exceeded',
        runtimeMs: runResult.runtimeMs,
        compileOutput: ''
      };
    }

    // 10. Explicit mapping of output limit termination (FIX #15)
    if (runResult.isOutputLimit) {
      return {
        verdict: VERDICTS.OUTPUT_LIMIT_EXCEEDED,
        stdout: runResult.stdout,
        stderr: runResult.stderr || 'Output limit exceeded: program generated excessive stdout/stderr',
        runtimeMs: runResult.runtimeMs,
        compileOutput: ''
      };
    }

    // 11. Check for runtime failure (non-zero exit code or signal crash)
    if (!runResult.success) {
      const exitReason = runResult.signal
        ? `Process terminated by signal: ${runResult.signal}`
        : `Process exited with code ${runResult.exitCode}`;

      return {
        verdict: VERDICTS.RUNTIME_ERROR,
        stdout: runResult.stdout,
        stderr: runResult.stderr || exitReason,
        runtimeMs: runResult.runtimeMs,
        compileOutput: ''
      };
    }

    // 12. Evaluate program output against expected output
    const evaluation = evaluateOutput(runResult.stdout, request.testCase.expectedOutput);

    // 13. Return deterministic execution result
    return {
      verdict: evaluation.verdict,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      runtimeMs: runResult.runtimeMs,
      compileOutput: ''
    };
  } finally {
    // 14. Guaranteed cleanup: temporary workspace directory is always deleted
    if (workspaceDir) {
      await cleanupWorkspace(workspaceDir);
    }
  }
}

module.exports = {
  validateExecutionRequest,
  execute
};
