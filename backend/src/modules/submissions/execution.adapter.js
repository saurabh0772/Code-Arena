/**
 * Execution Adapter Module
 * Decoupled boundary between the Backend Submission Module and the Execution Engine.
 */

const path = require('path');
const AppError = require('../../utils/app-error');

// Resolves standalone execution engine package
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

module.exports = {
  executeTestCase
};
