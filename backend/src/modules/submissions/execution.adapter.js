/**
 * Execution Adapter Module
 * Decoupled boundary between the Backend Submission Module and the Execution Engine.
 */

const path = require('path');
const AppError = require('../../utils/app-error');

// Resolves execution engine module boundary
let executionEngine;
try {
  const executionEnginePath = path.resolve(__dirname, '../../../../execution-engine/src');
  executionEngine = require(executionEnginePath);
} catch (err) {
  console.error('Failed to load Execution Engine:', err.message);
}

/**
 * Executes source code against a single test case using the Execution Engine.
 *
 * @param {object} params
 * @param {string} params.language - 'CPP'
 * @param {string} params.sourceCode - Code string
 * @param {object} params.testCase - { input: string, expectedOutput: string }
 * @returns {Promise<{ verdict: string, stdout: string, stderr: string, runtimeMs: number|null }>}
 */
async function executeTestCase({ language, sourceCode, testCase }) {
  if (!executionEngine) {
    throw new AppError('Execution Engine is currently unavailable', 500);
  }

  try {
    const result = await executionEngine.execute({
      language,
      sourceCode,
      testCase: {
        input: testCase.input ?? '',
        expectedOutput: testCase.expectedOutput ?? ''
      }
    });

    return result;
  } catch (err) {
    if (err.name === 'ValidationError') {
      throw new AppError(err.message, 400);
    }
    console.error('Execution Engine error during test case execution:', err);
    throw new AppError('Internal execution engine failure', 500);
  }
}

/**
 * Checks readiness of the Execution Engine runtime (e.g. Docker availability)
 * @returns {Promise<boolean>}
 */
async function checkExecutionReadiness() {
  if (!executionEngine) {
    return { ready: false, mode: 'unknown', details: 'Execution engine module not loaded' };
  }
  if (process.env.EXECUTION_MODE === 'local') {
    return { ready: true, mode: 'local' };
  }
  const dockerReady = await executionEngine.checkDockerAvailable();
  return {
    ready: !!dockerReady,
    mode: 'docker',
    details: dockerReady ? 'Docker sandbox daemon available' : 'Docker daemon not accessible'
  };
}

module.exports = {
  executeTestCase,
  checkExecutionReadiness
};
