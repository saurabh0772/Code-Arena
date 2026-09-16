/**
 * C++ Compiler Module
 * Compiles C++ source code safely using structured process spawning.
 */

const { spawn } = require('child_process');
const { LIMITS } = require('../config/constants');
const { sanitizeOutput } = require('../utils/sanitizer');
const { ExecutionEngineError } = require('../utils/errors');

/**
 * Compiles C++ source code in the specified workspace.
 *
 * @param {string} workspaceDir - Path to workspace containing main.cpp
 * @param {object} languageConfig - Trusted language configuration for CPP
 * @param {number} [timeoutMs] - Compilation timeout in ms
 * @returns {Promise<{ success: boolean, stderr: string, stdout: string, exitCode: number }>}
 */
function compileCpp(workspaceDir, languageConfig, timeoutMs = LIMITS.COMPILE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;

    let child;
    try {
      child = spawn(languageConfig.compiler, languageConfig.compileArgs, {
        cwd: workspaceDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      return reject(new ExecutionEngineError(`Failed to start compiler: ${err.message}`));
    }

    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdoutData.length < LIMITS.MAX_BUFFER_BYTES) {
        stdoutData += chunk.toString();
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderrData.length < LIMITS.MAX_BUFFER_BYTES) {
        stderrData += chunk.toString();
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        return reject(
          new ExecutionEngineError(
            `Compiler '${languageConfig.compiler}' is not available on this system.`
          )
        );
      }
      return reject(new ExecutionEngineError(`Compilation process error: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);

      const sanitizedStderr = sanitizeOutput(
        stderrData,
        workspaceDir,
        languageConfig.sourceFilename
      );
      const sanitizedStdout = sanitizeOutput(
        stdoutData,
        workspaceDir,
        languageConfig.sourceFilename
      );

      if (isTimedOut) {
        return resolve({
          success: false,
          exitCode: code,
          signal,
          stdout: sanitizedStdout,
          stderr: 'Compilation timed out.',
          isTimedOut: true
        });
      }

      if (code !== 0) {
        return resolve({
          success: false,
          exitCode: code,
          signal,
          stdout: sanitizedStdout,
          stderr: sanitizedStderr || `Compilation failed with exit code ${code}`,
          isTimedOut: false
        });
      }

      return resolve({
        success: true,
        exitCode: 0,
        signal: null,
        stdout: sanitizedStdout,
        stderr: sanitizedStderr,
        isTimedOut: false
      });
    });
  });
}

module.exports = {
  compileCpp
};
