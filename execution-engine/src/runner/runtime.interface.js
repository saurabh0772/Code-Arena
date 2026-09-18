/**
 * Execution Engine Runtime Abstraction Interface
 *
 * Defines the standard contract for sandboxed untrusted code execution runtimes.
 * Implementations:
 * - DockerRuntime (Active & Verified)
 * - GVisorRuntime (Documented Experimental Option)
 * - FirecrackerRuntime (Documented Experimental Option)
 */

class ExecutionRuntime {
  /**
   * Human-readable identifier of the execution runtime.
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by ExecutionRuntime subclass');
  }

  /**
   * Determines if the underlying execution engine / sandbox technology
   * is installed and accessible in the host environment.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by ExecutionRuntime subclass');
  }

  /**
   * Executes a command with resource limits inside the isolated sandbox runtime.
   *
   * @param {Object} options Execution options
   * @param {string} options.workspaceDir Directory containing code and test inputs
   * @param {string} options.command Command to run
   * @param {string[]} options.args Command arguments
   * @param {string} [options.stdin] Standard input to provide
   * @param {number} [options.timeLimitMs] CPU time limit in ms
   * @param {number} [options.memoryLimitMb] Memory limit in MB
   * @returns {Promise<{ stdout: string, stderr: string, exitCode: number, runtimeMs: number, memoryKb: number, timedOut: boolean, oomKilled: boolean }>}
   */
  async runSandbox(options) {
    throw new Error('runSandbox() must be implemented by ExecutionRuntime subclass');
  }

  /**
   * Forcibly cleans up an execution container or microVM instance.
   * @param {string} instanceId
   */
  async cleanup(instanceId) {
    throw new Error('cleanup() must be implemented by ExecutionRuntime subclass');
  }
}

module.exports = { ExecutionRuntime };
