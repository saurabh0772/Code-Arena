/**
 * Submission Execution Service
 * Manages the synchronous/sequential execution workflow for submissions.
 */

const Submission = require('./submission.model');
const TestCase = require('../test-cases/test-case.model');
const executionAdapter = require('./execution.adapter');
const AppError = require('../../utils/app-error');
const logger = require('../../utils/logger');

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
    logger.warn('Submission rejected due to unsupported language', {
      submissionId: submission._id.toString(),
      language: submission.language
    });
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
    logger.warn('Submission aborted: problem has no active test cases', {
      submissionId: submission._id.toString(),
      problemId: submission.problemId.toString()
    });
    throw new AppError(
      'This problem has no active test cases and is not ready for submissions.',
      422,
      'PROBLEM_NOT_READY'
    );
  }

  // Transition to RUNNING state if not already set atomically
  if (submission.status !== 'RUNNING') {
    submission.status = 'RUNNING';
    submission.startedAt = submission.startedAt || new Date();
    await submission.save();
  }

  logger.info('submission.execution.started', {
    submissionId: submission._id.toString(),
    problemId: submission.problemId.toString(),
    language: submission.language,
    testCasesCount: testCases.length
  });

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
        submission.completedAt = new Date();
        await submission.save();

        logger.info('submission.execution.completed', {
          submissionId: submission._id.toString(),
          language: submission.language,
          verdict: 'COMPILATION_ERROR',
          testsPassed,
          totalTests: testCases.length,
          runtimeMs: null
        });
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
    submission.completedAt = new Date();
    await submission.save();

    logger.info('submission.execution.completed', {
      submissionId: submission._id.toString(),
      language: submission.language,
      verdict: finalVerdict,
      testsPassed,
      totalTests: testCases.length,
      runtimeMs: totalRuntimeMs
    });

    return submission;
  } catch (error) {
    logger.error('submission.execution.failed', {
      submissionId: submissionId.toString(),
      error: error.message
    });

    throw error;
  }
}

module.exports = {
  executeSubmission
};
