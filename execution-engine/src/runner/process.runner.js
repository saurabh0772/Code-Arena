/**
 * Process Runner Module
 * Executes compiled binaries with stdin piping, stdout/stderr capture, and runtime measurement.
 */

const { spawn } = require('child_process');
const path = require('path');
const { LIMITS } = require('../config/constants');
const { sanitizeOutput } = require('../utils/sanitizer');
const { ExecutionEngineError } = require('../utils/errors');

/**
 * Runs an executable in the given workspace.
 *
 * @param {string} workspaceDir - Working directory for the process
 * @param {string} executableFilename - Executable filename (e.g. 'main')
 * @param {string} input - Input data to feed to stdin
 * @param {number} [timeoutMs] - Execution timeout in ms
 * @returns {Promise<{ success: boolean, exitCode: number|null, signal: string|null, stdout: string, stderr: string, runtimeMs: number }>}
 */
function runProcess(
  workspaceDir,
  commandOrFile,
  argsOrInput = [],
  input = '',
  timeoutMs = LIMITS.EXECUTION_TIMEOUT_MS
) {
  return new Promise((resolve, reject) => {
    let command = commandOrFile;
    let args = [];
    let stdinInput = '';
    let timeout = timeoutMs;

    // Support legacy signature: runProcess(workspaceDir, executableFilename, input, timeoutMs)
    if (typeof argsOrInput === 'string') {
      stdinInput = argsOrInput;
      timeout = typeof input === 'number' ? input : LIMITS.EXECUTION_TIMEOUT_MS;
      args = [];
    } else {
      args = Array.isArray(argsOrInput) ? argsOrInput : [];
      stdinInput = typeof input === 'string' ? input : '';
      timeout = typeof timeoutMs === 'number' ? timeoutMs : LIMITS.EXECUTION_TIMEOUT_MS;
    }

    const executablePath = command.startsWith('./')
      ? path.join(workspaceDir, command.slice(2))
      : (command.includes('/') ? command : command);

    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;
    let isOutputLimit = false;
    let startTime = 0n;

    let child;
    try {
      startTime = process.hrtime.bigint();
      child = spawn(executablePath, args, {
        cwd: workspaceDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      return reject(new ExecutionEngineError(`Failed to spawn process: ${err.message}`));
    }

    // Safety timeout to prevent hanging forever on infinite loops
    const timer = setTimeout(() => {
      isTimedOut = true;
      try {
        child.kill('SIGKILL');
      } catch (_) {}
    }, timeout);

    // Feed stdin safely
    if (child.stdin) {
      child.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') {
          console.warn('Child stdin error:', err.message);
        }
      });

      if (typeof stdinInput === 'string' && stdinInput.length > 0) {
        child.stdin.write(stdinInput);
      }
      child.stdin.end();
    }

    // Capture stdout with active termination on output threshold
    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      if (stdoutData.length + stderrData.length >= LIMITS.MAX_OUTPUT_BYTES) {
        isOutputLimit = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }
    });

    // Capture stderr with active termination on output threshold
    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      if (stdoutData.length + stderrData.length >= LIMITS.MAX_OUTPUT_BYTES) {
        isOutputLimit = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      return reject(new ExecutionEngineError(`Process execution error: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const endTime = process.hrtime.bigint();
      const runtimeMs = Math.max(0, Math.round(Number(endTime - startTime) / 1e6));

      // Truncate to maximum buffer
      if (stdoutData.length > LIMITS.MAX_BUFFER_BYTES) {
        stdoutData = stdoutData.slice(0, LIMITS.MAX_BUFFER_BYTES);
      }
      if (stderrData.length > LIMITS.MAX_BUFFER_BYTES) {
        stderrData = stderrData.slice(0, LIMITS.MAX_BUFFER_BYTES);
      }

      const sanitizedStdout = sanitizeOutput(stdoutData, workspaceDir);
      const sanitizedStderr = sanitizeOutput(stderrData, workspaceDir);

      const success = code === 0 && signal === null && !isTimedOut && !isOutputLimit;

      resolve({
        success,
        exitCode: code,
        signal,
        stdout: sanitizedStdout,
        stderr: sanitizedStderr,
        runtimeMs,
        isTimedOut,
        isOutputLimit
      });
    });
  });
}

module.exports = {
  runProcess
};
