const Submission = require('./submission.model');
const Problem = require('../problems/problem.model');
const AppError = require('../../utils/app-error');
const { executeSubmission } = require('./submission-execution.service');

/**
 * Create a new submission (authenticated user)
 * @param {Object} data - Validated payload { problemId, language, sourceCode }
 * @param {Object} authenticatedUser - req.user object
 * @returns {Promise<Object>} Created submission safe object
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

  // Enforce server-controlled fields & authenticated user identity
  const submission = await Submission.create({
    userId: authenticatedUser._id,
    problemId,
    language,
    sourceCode,
    status: 'SUBMITTED',
    verdict: 'PENDING',
    runtimeMs: null,
    memoryKb: null,
    testsPassed: null,
    totalTests: null
  });

  const createdSafeObject = submission.toSafeObject();

  // Execute submission against problem's active test cases
  await executeSubmission(submission._id);

  return createdSafeObject;
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
    query.problemId = queryParams.problemId;
  }

  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    Submission.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Submission.countDocuments(query)
  ]);

  return {
    submissions: submissions.map((s) => s.toSafeObject()),
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
