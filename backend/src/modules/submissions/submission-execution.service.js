/**
 * Submission Execution Service
 * Manages the synchronous/sequential execution workflow for submissions.
 */

const Submission = require('./submission.model');
const TestCase = require('../test-cases/test-case.model');
const executionAdapter = require('./execution.adapter');
const AppError = require('../../utils/app-error');

const SUPPORTED_LANGUAGES = ['CPP', 'PYTHON', 'JAVASCRIPT'];

/**
 * Executes a submission against all active test cases for the problem.
 * Sequential execution model following ADR-008.
 *
 * @param {string|ObjectId} submissionId
 * @returns {Promise<void>}
 */
async function executeSubmission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    return;
  }

  // Validate language
  if (!SUPPORTED_LANGUAGES.includes(submission.language)) {
    submission.status = 'COMPLETED';
    submission.verdict = 'RUNTIME_ERROR';
    submission.testsPassed = 0;
    submission.totalTests = 0;
    await submission.save();
    return;
  }

  // Retrieve active test cases (both PUBLIC and HIDDEN)
  const testCases = await TestCase.find({
    problemId: submission.problemId,
    isActive: true
  }).sort({ order: 1 });

  // Defensive validation: problem with no test cases must never be ACCEPTED
  if (!testCases || testCases.length === 0) {
    submission.status = 'COMPLETED';
    submission.verdict = 'RUNTIME_ERROR';
    submission.testsPassed = 0;
    submission.totalTests = 0;
    await submission.save();
    throw new AppError(
      'This problem has no active test cases and is not ready for submissions.',
      422,
      'PROBLEM_NOT_READY'
    );
  }

  // Transition to RUNNING state
  submission.status = 'RUNNING';
  await submission.save();

  try {
    let testsPassed = 0;
    let totalRuntimeMs = 0;
    let finalVerdict = 'ACCEPTED';

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];

      const execResult = await executionAdapter.executeTestCase({
        language: submission.language,
        sourceCode: submission.sourceCode,
        testCase: {
          input: tc.input,
          expectedOutput: tc.expectedOutput
        }
      });

      if (typeof execResult.runtimeMs === 'number') {
        totalRuntimeMs += execResult.runtimeMs;
      }

      // 1. Compilation error: program cannot compile, terminate remaining tests immediately
      if (execResult.verdict === 'COMPILATION_ERROR') {
        submission.status = 'COMPLETED';
        submission.verdict = 'COMPILATION_ERROR';
        submission.testsPassed = testsPassed;
        submission.totalTests = testCases.length;
        submission.runtimeMs = null;
        submission.memoryKb = null;
        await submission.save();
        return;
      }

      if (execResult.verdict === 'ACCEPTED') {
        testsPassed++;
      } else if (execResult.verdict === 'WRONG_ANSWER') {
        if (!['TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR'].includes(finalVerdict)) {
          finalVerdict = 'WRONG_ANSWER';
        }
      } else if (execResult.verdict === 'TIME_LIMIT_EXCEEDED') {
        finalVerdict = 'TIME_LIMIT_EXCEEDED';
        break;
      } else if (execResult.verdict === 'MEMORY_LIMIT_EXCEEDED') {
        finalVerdict = 'MEMORY_LIMIT_EXCEEDED';
        break;
      } else if (execResult.verdict === 'OUTPUT_LIMIT_EXCEEDED') {
        finalVerdict = 'RUNTIME_ERROR';
        break;
      } else if (execResult.verdict === 'RUNTIME_ERROR') {
        finalVerdict = 'RUNTIME_ERROR';
        break;
      }
    }

    // Determine final verdict
    if (testsPassed === testCases.length && finalVerdict === 'ACCEPTED') {
      finalVerdict = 'ACCEPTED';
    } else if (testsPassed !== testCases.length && finalVerdict === 'ACCEPTED') {
      finalVerdict = 'WRONG_ANSWER';
    }

    // Finalize submission state
    submission.status = 'COMPLETED';
    submission.verdict = finalVerdict;
    submission.testsPassed = testsPassed;
    submission.totalTests = testCases.length;
    submission.runtimeMs = totalRuntimeMs;
    submission.memoryKb = null;
    await submission.save();
  } catch (error) {
    console.error(`Execution failure for submission ${submissionId}:`, error);

    // Prevent submission from being permanently stuck in RUNNING state
    submission.status = 'COMPLETED';
    submission.verdict = 'RUNTIME_ERROR';
    await submission.save().catch((saveErr) => {
      console.error(`Failed to save error state for submission ${submissionId}:`, saveErr);
    });
  }
}

module.exports = {
  executeSubmission
};
