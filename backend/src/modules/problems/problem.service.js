const Problem = require('./problem.model');
const TestCase = require('../test-cases/test-case.model');
const AppError = require('../../utils/app-error');

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

  return problem.toSafeObject();
};

/**
 * Update an existing problem
 * @param {string} problemId
 * @param {Object} updateData - Validated update fields
 * @returns {Promise<Object>} Updated problem object
 */
const updateProblem = async (problemId, updateData) => {
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

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      problem[field] = updateData[field];
    }
  });

  await problem.save();
  return problem.toSafeObject();
};

/**
 * Deactivate (soft delete) a problem
 * @param {string} problemId
 * @returns {Promise<Object>} Confirmation message
 */
const deactivateProblem = async (problemId) => {
  const problem = await Problem.findById(problemId);

  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  // Idempotent soft deletion
  if (problem.isActive) {
    problem.isActive = false;
    await problem.save();
  }

  return { message: 'Problem deactivated successfully' };
};

/**
 * List active problems with summary projection and active test case count
 * @param {Object} queryParams
 * @returns {Promise<Array<Object>>} List of active problems
 */
const listProblems = async (queryParams = {}) => {
  const query = { isActive: true };

  if (queryParams.difficulty) {
    const diff = queryParams.difficulty.toUpperCase();
    if (['EASY', 'MEDIUM', 'HARD'].includes(diff)) {
      query.difficulty = diff;
    }
  }

  // Efficient projection: omit large text fields
  const problems = await Problem.find(query)
    .select('title difficulty tags authorId createdAt')
    .sort({ createdAt: -1 });

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
        _id: '$problemId',
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = new Map();
  activeTestCounts.forEach((tc) => countMap.set(tc._id.toString(), tc.count));

  return problems.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
    authorId: p.authorId,
    createdAt: p.createdAt,
    testCasesCount: countMap.get(p._id.toString()) || 0
  }));
};

/**
 * Get full problem details by ID (active problems only)
 * @param {string} problemId
 * @returns {Promise<Object>} Full problem details
 */
const getProblemById = async (problemId) => {
  const problem = await Problem.findById(problemId);

  if (!problem || !problem.isActive) {
    throw new AppError('Problem not found', 404);
  }

  const activeTestCasesCount = await TestCase.countDocuments({
    problemId: problem._id,
    isActive: true
  });

  const safe = problem.toSafeObject();
  safe.testCasesCount = activeTestCasesCount;
  return safe;
};

module.exports = {
  createProblem,
  updateProblem,
  deactivateProblem,
  listProblems,
  getProblemById
};
