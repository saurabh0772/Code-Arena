const Problem = require('./problem.model');
const TestCase = require('../test-cases/test-case.model');
const Submission = require('../submissions/submission.model');
const AppError = require('../../utils/app-error');
const { logAuditAction } = require('../audit/audit-log.service');

/**
 * Calculate problem readiness metrics based on active test cases
 */
async function getProblemReadiness(problemId) {
  const counts = await TestCase.aggregate([
    {
      $match: {
        problemId: typeof problemId === 'string' ? new (require('mongoose').Types.ObjectId)(problemId) : problemId,
        isActive: true
      }
    },
    {
      $group: {
        _id: '$visibility',
        count: { $sum: 1 }
      }
    }
  ]);

  let publicCount = 0;
  let hiddenCount = 0;

  counts.forEach((c) => {
    if (c._id === 'PUBLIC') publicCount = c.count;
    if (c._id === 'HIDDEN') hiddenCount = c.count;
  });

  const totalCount = publicCount + hiddenCount;
  const missingRequirements = [];
  if (publicCount === 0) missingRequirements.push('Missing active public test cases');
  if (hiddenCount === 0) missingRequirements.push('Missing active hidden test cases');
  if (totalCount === 0) missingRequirements.push('No active test cases configured');

  return {
    isReady: totalCount > 0 && publicCount > 0,
    publicCount,
    hiddenCount,
    totalCount,
    missingRequirements
  };
}

/**
 * Create a new problem
 * @param {Object} data - Validated problem content
 * @param {string} authorId - Authenticated user ID
 * @returns {Promise<Object>} Created problem object
 */
const createProblem = async (data, authorId) => {
  const problem = await Problem.create({
    ...data,
    authorId,
    isActive: true
  });

  await logAuditAction({
    userId: authorId,
    action: 'PROBLEM_CREATED',
    targetType: 'Problem',
    targetId: problem._id,
    details: {
      title: problem.title,
      difficulty: problem.difficulty,
      tags: problem.tags
    }
  });

  const safe = problem.toSafeObject();
  safe.readiness = {
    isReady: false,
    publicCount: 0,
    hiddenCount: 0,
    totalCount: 0,
    missingRequirements: ['No active test cases configured']
  };

  return safe;
};

/**
 * Update an existing problem
 * @param {string} problemId
 * @param {Object} updateData - Validated update fields
 * @param {Object} [user] - Authenticated user performing the update
 * @returns {Promise<Object>} Updated problem object
 */
const updateProblem = async (problemId, updateData, user = null) => {
  const problem = await Problem.findById(problemId);

  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  const allowedFields = [
    'title',
    'description',
    'difficulty',
    'tags',
    'inputFormat',
    'outputFormat',
    'constraints',
    'examples'
  ];

  const changedFields = {};
  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      problem[field] = updateData[field];
      changedFields[field] = updateData[field];
    }
  });

  await problem.save();

  if (user) {
    await logAuditAction({
      userId: user._id || user.id,
      action: 'PROBLEM_UPDATED',
      targetType: 'Problem',
      targetId: problem._id,
      details: changedFields
    });
  }

  const readiness = await getProblemReadiness(problem._id);
  const safe = problem.toSafeObject();
  safe.readiness = readiness;
  safe.testCasesCount = readiness.totalCount;
  return safe;
};

/**
 * Deactivate (soft delete) a problem
 * @param {string} problemId
 * @param {Object} [user] - Authenticated user performing the deactivation
 * @returns {Promise<Object>} Confirmation message
 */
const deactivateProblem = async (problemId, user = null) => {
  const problem = await Problem.findById(problemId);

  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  // Idempotent soft deletion
  if (problem.isActive) {
    problem.isActive = false;
    await problem.save();

    if (user) {
      await logAuditAction({
        userId: user._id || user.id,
        action: 'PROBLEM_DELETED',
        targetType: 'Problem',
        targetId: problem._id,
        details: { title: problem.title }
      });
    }
  }

  return { message: 'Problem deactivated successfully' };
};

/**
 * List active problems with summary projection, filtering, pagination, readiness, and solved status
 * @param {Object} queryParams
 * @param {Object} [user] - Authenticated user if available
 * @returns {Promise<Object>} List of active problems and pagination metadata
 */
const listProblems = async (queryParams = {}, user = null) => {
  const query = { isActive: true };

  if (queryParams.difficulty) {
    if (Array.isArray(queryParams.difficulty)) {
      query.difficulty = {
        $in: queryParams.difficulty
          .map((d) => (typeof d === 'string' ? d.toUpperCase() : ''))
          .filter((d) => ['EASY', 'MEDIUM', 'HARD'].includes(d))
      };
    } else if (typeof queryParams.difficulty === 'string') {
      const diff = queryParams.difficulty.toUpperCase();
      if (['EASY', 'MEDIUM', 'HARD'].includes(diff)) {
        query.difficulty = diff;
      }
    }
  }

  const tagInput = queryParams.tag || queryParams.tags;
  if (tagInput) {
    const tagsArray = Array.isArray(tagInput)
      ? tagInput
      : tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tagsArray.length > 0) {
      query.tags = { $in: tagsArray };
    }
  }

  if (queryParams.search && typeof queryParams.search === 'string' && queryParams.search.trim()) {
    const term = queryParams.search.trim();
    query.title = { $regex: term, $options: 'i' };
  }

  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  let sortCriteria = { createdAt: -1 };
  if (queryParams.sort === 'title_asc') sortCriteria = { title: 1 };
  else if (queryParams.sort === 'title_desc') sortCriteria = { title: -1 };
  else if (queryParams.sort === 'oldest') sortCriteria = { createdAt: 1 };

  // Efficient projection: omit large text fields
  const [problems, total] = await Promise.all([
    Problem.find(query)
      .select('title difficulty tags authorId createdAt')
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit),
    Problem.countDocuments(query)
  ]);

  const problemIds = problems.map((p) => p._id);
  const activeTestCounts = await TestCase.aggregate([
    {
      $match: {
        problemId: { $in: problemIds },
        isActive: true
      }
    },
    {
      $group: {
        _id: { problemId: '$problemId', visibility: '$visibility' },
        count: { $sum: 1 }
      }
    }
  ]);

  const countsMap = new Map();
  activeTestCounts.forEach((entry) => {
    const pid = entry._id.problemId.toString();
    if (!countsMap.has(pid)) {
      countsMap.set(pid, { publicCount: 0, hiddenCount: 0 });
    }
    const current = countsMap.get(pid);
    if (entry._id.visibility === 'PUBLIC') current.publicCount = entry.count;
    if (entry._id.visibility === 'HIDDEN') current.hiddenCount = entry.count;
  });

  // Derive solved status for authenticated user without N+1 queries
  let solvedProblemSet = new Set();
  if (user && user._id) {
    const mongoose = require('mongoose');
    const userObjectId = typeof user._id === 'string' ? new mongoose.Types.ObjectId(user._id) : user._id;
    const solvedProblemIds = await Submission.find({
      userId: userObjectId,
      problemId: { $in: problemIds },
      verdict: 'ACCEPTED'
    }).distinct('problemId');

    solvedProblemSet = new Set(solvedProblemIds.map((id) => id.toString()));
  }

  const problemList = problems.map((p) => {
    const pid = p._id.toString();
    const stats = countsMap.get(pid) || { publicCount: 0, hiddenCount: 0 };
    const totalCount = stats.publicCount + stats.hiddenCount;
    const missingRequirements = [];
    if (stats.publicCount === 0) missingRequirements.push('Missing active public test cases');
    if (stats.hiddenCount === 0) missingRequirements.push('Missing active hidden test cases');
    if (totalCount === 0) missingRequirements.push('No active test cases configured');

    return {
      id: pid,
      title: p.title,
      difficulty: p.difficulty,
      tags: p.tags,
      authorId: p.authorId,
      createdAt: p.createdAt,
      solved: solvedProblemSet.has(pid),
      testCasesCount: totalCount,
      readiness: {
        isReady: totalCount > 0 && stats.publicCount > 0,
        publicCount: stats.publicCount,
        hiddenCount: stats.hiddenCount,
        totalCount,
        missingRequirements
      }
    };
  });

  return {
    problems: problemList,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Get full problem details by ID (active problems only)
 * @param {string} problemId
 * @returns {Promise<Object>} Full problem details with readiness breakdown
 */
const getProblemById = async (problemId) => {
  const problem = await Problem.findById(problemId);

  if (!problem || !problem.isActive) {
    throw new AppError('Problem not found', 404);
  }

  const readiness = await getProblemReadiness(problem._id);
  const safe = problem.toSafeObject();
  safe.testCasesCount = readiness.totalCount;
  safe.readiness = readiness;
  return safe;
};

module.exports = {
  createProblem,
  updateProblem,
  deactivateProblem,
  listProblems,
  getProblemById,
  getProblemReadiness
};
