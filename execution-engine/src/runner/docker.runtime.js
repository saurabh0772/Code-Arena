/**
 * Docker Execution Runtime Implementation
 *
 * Implements ExecutionRuntime using disposable Docker container sandboxes
 * with security hardening: --network none, read-only root, cap-drop ALL,
 * memory-swap=memory, and non-root UID.
 */

const { ExecutionRuntime } = require('./runtime.interface');
const dockerSandbox = require('./docker.sandbox');

class DockerRuntime extends ExecutionRuntime {
  getName() {
    return 'docker';
  }

  async isAvailable() {
    return dockerSandbox.checkDockerAvailable();
  }

  async runSandbox(options) {
    return dockerSandbox.runSandbox(options);
  }

  async cleanup(containerName) {
    dockerSandbox.forceCleanupContainer(containerName);
  }
}

module.exports = { DockerRuntime };
