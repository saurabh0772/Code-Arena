/**
 * gVisor (runsc) Sandbox Runtime Implementation
 *
 * CLASSIFICATION: Experimental / Documented Future Production Option
 *
 * Provides application-kernel level sandboxing using Google gVisor (runsc)
 * to intercept guest syscalls in userspace, providing defense-in-depth against
 * kernel privilege escalation exploits.
 *
 * NOTE: This implementation does not fake executions. It verifies the presence
 * of the 'runsc' binary or Docker gVisor runtime before attempting invocation.
 */

const { exec } = require('child_process');
const { ExecutionRuntime } = require('./runtime.interface');
const { ExecutionEngineError } = require('../utils/errors');

class GVisorRuntime extends ExecutionRuntime {
  getName() {
    return 'gvisor';
  }

  async isAvailable() {
    return new Promise((resolve) => {
      exec('runsc --version', { timeout: 2000 }, (err) => {
        resolve(!err);
      });
    });
  }

  async runSandbox(options) {
    const available = await this.isAvailable();
    if (!available) {
      throw new ExecutionEngineError(
        'gVisor (runsc) runtime is not configured or installed in the host environment. ' +
        'In production, gVisor requires the runsc binary registered as a containerd/Docker runtime.'
      );
    }

    // In a configured gVisor environment, Docker passes --runtime=runsc
    const dockerSandbox = require('./docker.sandbox');
    return dockerSandbox.runSandbox({
      ...options,
      runtimeOverride: 'runsc'
    });
  }

  async cleanup(instanceId) {
    // Delegates to container cleanup
    const dockerSandbox = require('./docker.sandbox');
    dockerSandbox.forceCleanupContainer(instanceId);
  }
}

module.exports = { GVisorRuntime };
