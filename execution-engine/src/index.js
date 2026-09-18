/**
 * CodeArena Execution Engine
 * Main Entry Point
 */

const { execute, validateExecutionRequest } = require('./executor/execution.service');
const { VERDICTS, SUPPORTED_LANGUAGES, LIMITS } = require('./config/constants');
const { LANGUAGE_CONFIGS, resolveLanguage } = require('./config/languages');
const {
  ExecutionEngineError,
  ValidationError,
  CompilationError,
  RuntimeExecutionError
} = require('./utils/errors');
const { createWorkspace, cleanupWorkspace } = require('./utils/workspace');
const { normalizeOutput, evaluateOutput } = require('./evaluator/output.evaluator');
const { runInDockerSandbox, checkDockerAvailable } = require('./runner/docker.sandbox');
const { runProcess } = require('./runner/process.runner');
const { ExecutionRuntime } = require('./runner/runtime.interface');
const { DockerRuntime } = require('./runner/docker.runtime');
const { GVisorRuntime } = require('./runner/gvisor.runtime');
const { FirecrackerRuntime } = require('./runner/firecracker.runtime');

module.exports = {
  execute,
  validateExecutionRequest,
  VERDICTS,
  SUPPORTED_LANGUAGES,
  LIMITS,
  LANGUAGE_CONFIGS,
  resolveLanguage,
  ExecutionEngineError,
  ValidationError,
  CompilationError,
  RuntimeExecutionError,
  createWorkspace,
  cleanupWorkspace,
  normalizeOutput,
  evaluateOutput,
  runInDockerSandbox,
  checkDockerAvailable,
  runProcess,
  ExecutionRuntime,
  DockerRuntime,
  GVisorRuntime,
  FirecrackerRuntime
};
