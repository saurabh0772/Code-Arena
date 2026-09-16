const TestCase = require('./test-case.model');
const Problem = require('../problems/problem.model');
const AppError = require('../../utils/app-error');

/**
 * Create a new test case for a problem (ADMIN only)
 * @param {string} problemId
 * @param {Object} data - Validated test case payload
 * @returns {Promise<Object>} Created test case object
 */
const createTestCase = async (problemId, data) => {
  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  const testCase = await TestCase.create({
    ...data,
    problemId,
    isActive: true
  });

  return testCase.toSafeObject();
};

/**
 * Retrieve test cases for a problem with role-based filtering
 * - ADMIN: Returns all active test cases (both PUBLIC and HIDDEN)
 * - USER: Returns ONLY active PUBLIC test cases. Hidden test cases are never queried or leaked.
 * 
 * @param {string} problemId
 * @param {string} userRole
 * @returns {Promise<Array<Object>>} List of accessible test cases
 */
const getTestCasesForProblem = async (problemId, userRole) => {
  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  // Database-level query isolation based on role
  const query = {
    problemId,
    isActive: true
  };

  if (userRole !== 'ADMIN') {
    // Strictly restrict to PUBLIC visibility at the database query level
    query.visibility = 'PUBLIC';
  }

  const testCases = await TestCase.find(query).sort({ order: 1 });

  return testCases.map((tc) => tc.toSafeObject());
};

/**
 * Get a single test case by ID
 * - ADMIN: Can retrieve active or hidden test case
 * - USER: Can ONLY retrieve if active and visibility is PUBLIC (otherwise 404)
 * 
 * @param {string} testCaseId
 * @param {string} userRole
 * @returns {Promise<Object>} Safe test case object
 */
const getTestCaseById = async (testCaseId, userRole) => {
  const query = { _id: testCaseId };

  if (userRole !== 'ADMIN') {
    // For non-admin, must be active AND public
    query.isActive = true;
    query.visibility = 'PUBLIC';
  }

  const testCase = await TestCase.findOne(query);

  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  return testCase.toSafeObject();
};

/**
 * Update an existing test case (ADMIN only)
 * @param {string} testCaseId
 * @param {Object} updateData - Validated update fields
 * @returns {Promise<Object>} Updated test case object
 */
const updateTestCase = async (testCaseId, updateData) => {
  const testCase = await TestCase.findById(testCaseId);

  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  const allowedFields = ['input', 'expectedOutput', 'visibility', 'order'];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      testCase[field] = updateData[field];
    }
  });

  await testCase.save();
  return testCase.toSafeObject();
};

/**
 * Deactivate (soft delete) a test case (ADMIN only)
 * @param {string} testCaseId
 * @returns {Promise<Object>} Confirmation message
 */
const deactivateTestCase = async (testCaseId) => {
  const testCase = await TestCase.findById(testCaseId);

  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  if (testCase.isActive) {
    testCase.isActive = false;
    await testCase.save();
  }

  return { message: 'Test case deactivated successfully' };
};

module.exports = {
  createTestCase,
  getTestCasesForProblem,
  getTestCaseById,
  updateTestCase,
  deactivateTestCase
};
