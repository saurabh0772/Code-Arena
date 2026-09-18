const TestCase = require('./test-case.model');
const Problem = require('../problems/problem.model');
const AppError = require('../../utils/app-error');
const { logAuditAction } = require('../audit/audit-log.service');

/**
 * Create a new test case for a problem (ADMIN only)
 * @param {string} problemId
 * @param {Object} data - Validated test case payload
 * @param {Object} [user] - Authenticated admin user
 * @returns {Promise<Object>} Created test case object
 */
const createTestCase = async (problemId, data, user = null) => {
  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new AppError('Problem not found', 404);
  }

  const testCase = await TestCase.create({
    ...data,
    problemId,
    isActive: true
  });

  if (user) {
    await logAuditAction({
      userId: user._id || user.id,
      action: 'TEST_CASE_CREATED',
      targetType: 'TestCase',
      targetId: testCase._id,
      details: {
        problemId,
        visibility: testCase.visibility,
        order: testCase.order
      }
    });
  }

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
 * @param {Object} [user] - Authenticated admin user
 * @returns {Promise<Object>} Updated test case object
 */
const updateTestCase = async (testCaseId, updateData, user = null) => {
  const testCase = await TestCase.findById(testCaseId);

  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  const allowedFields = ['input', 'expectedOutput', 'visibility', 'order'];
  const changedFields = {};

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      testCase[field] = updateData[field];
      changedFields[field] = updateData[field];
    }
  });

  await testCase.save();

  if (user) {
    await logAuditAction({
      userId: user._id || user.id,
      action: 'TEST_CASE_UPDATED',
      targetType: 'TestCase',
      targetId: testCase._id,
      details: changedFields
    });
  }

  return testCase.toSafeObject();
};

/**
 * Deactivate (soft delete) a test case (ADMIN only)
 * @param {string} testCaseId
 * @param {Object} [user] - Authenticated admin user
 * @returns {Promise<Object>} Confirmation message
 */
const deactivateTestCase = async (testCaseId, user = null) => {
  const testCase = await TestCase.findById(testCaseId);

  if (!testCase) {
    throw new AppError('Test case not found', 404);
  }

  if (testCase.isActive) {
    testCase.isActive = false;
    await testCase.save();

    if (user) {
      await logAuditAction({
        userId: user._id || user.id,
        action: 'TEST_CASE_DELETED',
        targetType: 'TestCase',
        targetId: testCase._id,
        details: { problemId: testCase.problemId }
      });
    }
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
