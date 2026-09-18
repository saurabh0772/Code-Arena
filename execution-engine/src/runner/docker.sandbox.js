/**
 * Docker Sandbox Runner
 * Executes untrusted code inside isolated, disposable Docker containers.
 *
 * Security controls:
 * - Network: none
 * - User: non-root (1000:1000)
 * - Filesystem: read-only root with tmpfs on /tmp
 * - Memory: capped with memory-swap=memory
 * - CPU: capped
 * - PID limit: protects against fork bombs
 * - Capabilities: dropped ALL
 * - Privileges: no-new-privileges
 * - Secrets: NO host or backend environment variables passed
 * - Docker socket: NEVER mounted inside sandbox
 */

const { spawn, exec } = require('child_process');
const crypto = require('crypto');
const { LIMITS } = require('../config/constants');
const { sanitizeOutput } = require('../utils/sanitizer');
const { ExecutionEngineError } = require('../utils/errors');

const SANDBOX_IMAGE = process.env.CODEARENA_SANDBOX_IMAGE || 'codearena-sandbox:v1';

let isDockerAvailableCache = null;

/**
 * Checks if the Docker daemon is accessible to this process.
 * @returns {Promise<boolean>}
 */
function checkDockerAvailable() {
  if (isDockerAvailableCache !== null) {
    return Promise.resolve(isDockerAvailableCache);
  }

  return new Promise((resolve) => {
    exec('docker info', { timeout: 3000 }, (err) => {
      isDockerAvailableCache = !err;
      resolve(isDockerAvailableCache);
    });
  });
}

/**
 * Ensures any lingering sandbox container is forcibly removed.
 * @param {string} containerName
 */
function forceCleanupContainer(containerName) {
  if (!containerName) return;
  exec(`docker rm -f ${containerName}`, { timeout: 3000 }, () => {});
}

/**
 * Runs a command inside a secured Docker sandbox container.
 *
 * @param {object} options
 * @param {string} options.workspaceDir - Host directory mounted to /workspace
 * @param {string} options.command - Command to execute (e.g. './main', 'python3', 'g++')
 * @param {string[]} [options.args=[]] - Command arguments
 * @param {string} [options.input=''] - Input to pipe to stdin
 * @param {number} [options.timeoutMs] - Timeout in milliseconds
 * @param {number} [options.memoryMb] - Memory limit in megabytes
 * @param {number} [options.pidsLimit] - Max processes / threads
 * @param {number} [options.cpuQuota] - CPU quota
 * @param {boolean} [options.isCompile=false] - Whether this is a compilation step
 * @returns {Promise<{ success: boolean, exitCode: number|null, signal: string|null, stdout: string, stderr: string, runtimeMs: number, isTimedOut: boolean, isOom: boolean, isOutputLimit: boolean, isProcessLimit: boolean }>}
 */
async function runInDockerSandbox({
  workspaceDir,
  command,
  args = [],
  input = '',
  timeoutMs = LIMITS.EXECUTION_TIMEOUT_MS,
  memoryMb = LIMITS.MEMORY_LIMIT_MB,
  pidsLimit = LIMITS.PID_LIMIT,
  cpuQuota = LIMITS.CPU_QUOTA,
  isCompile = false
}) {
  const isAvailable = await checkDockerAvailable();
  if (!isAvailable) {
    throw new ExecutionEngineError(
      'EXECUTION_UNAVAILABLE: Docker sandbox runtime is required but unavailable. Untrusted code cannot be executed directly on the host.'
    );
  }

  const containerName = `codearena-sbx-${crypto.randomBytes(8).toString('hex')}`;

  // Construct secure docker run arguments
  const dockerArgs = [
    'run',
    '--name', containerName,
    '--rm',
    '-i',
    '--network', 'none',
    '--user', '1000:1000',
    '--cpus', String(cpuQuota),
    '--memory', `${memoryMb}m`,
    '--memory-swap', `${memoryMb}m`,
    '--pids-limit', String(pidsLimit),
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
    '-v', `${workspaceDir}:/workspace:rw`,
    '-w', '/workspace',
    SANDBOX_IMAGE,
    command,
    ...args
  ];

  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;
    let isOutputLimit = false;
    let startTime = 0n;
    let killedByEngine = false;

    let child;
    try {
      startTime = process.hrtime.bigint();
      child = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      forceCleanupContainer(containerName);
      return reject(new ExecutionEngineError(`Failed to spawn Docker sandbox: ${err.message}`));
    }

    // Safety timeout: terminates runaway processes (infinite loops)
    const timer = setTimeout(() => {
      isTimedOut = true;
      killedByEngine = true;
      exec(`docker kill ${containerName}`, { timeout: 3000 }, () => {});
    }, timeoutMs);

    // Stream stdin safely
    if (child.stdin) {
      child.stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') {
          console.warn('Docker sandbox stdin error:', err.message);
        }
      });

      if (typeof input === 'string' && input.length > 0) {
        child.stdin.write(input);
      }
      child.stdin.end();
    }

    // Stream stdout and actively terminate when output threshold is exceeded
    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      if (stdoutData.length + stderrData.length >= LIMITS.MAX_OUTPUT_BYTES) {
        isOutputLimit = true;
        killedByEngine = true;
        exec(`docker kill ${containerName}`, { timeout: 3000 }, () => {});
      }
    });

    // Stream stderr and actively terminate when output threshold is exceeded
    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      if (stdoutData.length + stderrData.length >= LIMITS.MAX_OUTPUT_BYTES) {
        isOutputLimit = true;
        killedByEngine = true;
        exec(`docker kill ${containerName}`, { timeout: 3000 }, () => {});
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      forceCleanupContainer(containerName);
      return reject(new ExecutionEngineError(`Docker sandbox process error: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const endTime = process.hrtime.bigint();
      const runtimeMs = Math.max(0, Math.round(Number(endTime - startTime) / 1e6));

      // Active assurance of container cleanup
      forceCleanupContainer(containerName);

      // Truncate to maximum buffer
      if (stdoutData.length > LIMITS.MAX_BUFFER_BYTES) {
        stdoutData = stdoutData.slice(0, LIMITS.MAX_BUFFER_BYTES);
      }
      if (stderrData.length > LIMITS.MAX_BUFFER_BYTES) {
        stderrData = stderrData.slice(0, LIMITS.MAX_BUFFER_BYTES);
      }

      const sanitizedStdout = sanitizeOutput(stdoutData, workspaceDir);
      const sanitizedStderr = sanitizeOutput(stderrData, workspaceDir);

      // Detect OOM: exit code 137 (SIGKILL) not caused by timeout or output limit
      const isOom = (code === 137 && !isTimedOut && !isOutputLimit) ||
        sanitizedStderr.includes('bad_alloc') ||
        sanitizedStderr.includes('MemoryError') ||
        sanitizedStderr.includes('out of memory') ||
        sanitizedStderr.includes('JavaScript heap out of memory');

      // Detect Process Limit (fork bomb)
      const isProcessLimit = sanitizedStderr.includes('Resource temporarily unavailable') ||
        sanitizedStderr.includes('EAGAIN') ||
        sanitizedStderr.includes('Cannot allocate memory') && !isOom;

      const success = code === 0 && signal === null && !isTimedOut && !isOutputLimit && !isOom;

      resolve({
        success,
        exitCode: code,
        signal,
        stdout: sanitizedStdout,
        stderr: sanitizedStderr,
        runtimeMs,
        isTimedOut,
        isOom,
        isOutputLimit,
        isProcessLimit
      });
    });
  });
}

module.exports = {
  runInDockerSandbox,
  checkDockerAvailable
};
