const mongoose = require('mongoose');
const Submission = require('./submission.model');
const Problem = require('../problems/problem.model');
const TestCase = require('../test-cases/test-case.model');
const AppError = require('../../utils/app-error');
const submissionQueue = require('../../queues/submission.queue');
const logger = require('../../utils/logger');

/**
 * Create a new submission (authenticated user)
 * Validates, persists PENDING submission, enqueues to Redis, and returns immediately as QUEUED.
 *
 * @param {Object} data - Validated payload { problemId, language, sourceCode }
 * @param {Object} authenticatedUser - req.user object
 * @returns {Promise<Object>} Queued submission safe object
 */
const createSubmission = async (data, authenticatedUser) => {
  const { problemId, language, sourceCode } = data;

  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  if (!problem.isActive) {
    throw new AppError('Cannot submit to an inactive problem', 400);
  }

  // Defensive check: problem must have at least one active test case
  const activeTestCasesCount = await TestCase.countDocuments({
    problemId: problem._id,
    isActive: true
  });

  if (activeTestCasesCount === 0) {
    throw new AppError(
      'This problem has no active test cases and is not ready for submissions.',
      422,
      'PROBLEM_NOT_READY'
    );
  }

  // 1. Persist initial PENDING submission record in MongoDB
  const submission = await Submission.create({
    userId: authenticatedUser._id,
    problemId,
    language,
    sourceCode,
    status: 'PENDING',
    verdict: 'PENDING',
    runtimeMs: null,
    memoryKb: null,
    testsPassed: null,
    totalTests: null,
    queuedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null
  });

  // 2. Explicitly transition and persist QUEUED state in MongoDB before enqueueing.
  // This allows the worker to observe QUEUED and atomically claim it.
  //
  // ARCHITECTURE NOTE — MONGODB → REDIS/BULLMQ DUAL-WRITE CONSISTENCY WINDOW:
  // MongoDB and Redis are separate systems, so updating MongoDB and enqueueing a BullMQ
  // job are not one atomic transaction. A process crash between these operations
  // can leave a submission in QUEUED state without a queue job.
  // Application-detected Redis/enqueue failures are caught below and marked FAILED.
  // This is a known consistency window that can be addressed in future phases
  // with reconciliation or transactional outbox-style reliability mechanisms.
  submission.status = 'QUEUED';
  submission.queuedAt = new Date();
  await submission.save();

  // 3. Enqueue minimal payload { submissionId } into BullMQ submission queue
  try {
    await submissionQueue.enqueueSubmission(submission._id.toString());

    logger.info('submission_created_and_queued', {
      submissionId: submission._id.toString(),
      problemId: problem._id.toString(),
      userId: authenticatedUser._id.toString(),
      language
    });

    return submission.toSafeObject();
  } catch (queueError) {
    logger.error('submission_queue_failed', {
      submissionId: submission._id.toString(),
      error: queueError.message
    });

    // If enqueue fails, transition QUEUED -> FAILED so it does not remain QUEUED forever
    submission.status = 'FAILED';
    submission.failedAt = new Date();
    submission.errorMessage = 'Failed to enqueue submission for processing';
    await submission.save().catch((saveErr) => {
      logger.error('Failed to update submission failed state after queue error', {
        submissionId: submission._id.toString(),
        error: saveErr.message
      });
    });

    throw new AppError(
      'Failed to queue submission for processing. Please try again.',
      503,
      'QUEUE_UNAVAILABLE'
    );
  }
};

/**
 * Retrieve a single submission with object-level authorization
 * - Owner (matching userId) can retrieve submission
 * - ADMIN can retrieve submission
 * - Other users receive 403 Forbidden
 * 
 * @param {string} submissionId
 * @param {Object} requestingUser - req.user object
 * @returns {Promise<Object>} Safe submission object
 */
const getSubmissionById = async (submissionId, requestingUser) => {
  const submission = await Submission.findById(submissionId);

  if (!submission) {
    throw new AppError('Submission not found', 404);
  }

  const isOwner = submission.userId.toString() === requestingUser._id.toString();
  const isAdmin = requestingUser.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new AppError(
      'Access denied: you do not have permission to view this submission',
      403
    );
  }

  return submission.toSafeObject();
};

/**
 * Retrieve submissions for the authenticated user only
 * @param {string|ObjectId} userId
 * @param {Object} queryParams - { page, limit, problemId }
 * @returns {Promise<Object>} Paginated submissions
 */
const getMySubmissions = async (userId, queryParams = {}) => {
  const query = { userId };

  if (queryParams.problemId) {
    if (!mongoose.Types.ObjectId.isValid(queryParams.problemId)) {
      throw new AppError('Invalid problem ID format', 400);
    }
    query.problemId = queryParams.problemId;
  }
  if (queryParams.language && typeof queryParams.language === 'string') {
    query.language = queryParams.language.toUpperCase();
  }
  if (queryParams.verdict && typeof queryParams.verdict === 'string') {
    query.verdict = queryParams.verdict.toUpperCase();
  }

  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const includeCode = queryParams.includeCode === 'true' || queryParams.includeCode === true;

  let findQuery = Submission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (!includeCode) {
    findQuery = findQuery.select('-sourceCode');
  }

  const [submissions, total] = await Promise.all([
    findQuery,
    Submission.countDocuments(query)
  ]);

  return {
    submissions: submissions.map((s) => s.toSafeObject({ includeCode })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

module.exports = {
  createSubmission,
  getSubmissionById,
  getMySubmissions
};
