const testCaseService = require('./test-case.service');

/**
 * Create a new test case for a problem (ADMIN only)
 * POST /api/v1/problems/:problemId/test-cases
 */
const createTestCase = async (req, res, next) => {
  try {
    const testCase = await testCaseService.createTestCase(req.params.problemId, req.body, req.user);

    res.status(201).json({
      success: true,
      data: {
        testCase
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List test cases for a problem
 * GET /api/v1/problems/:problemId/test-cases
 * Note: Role-based filtering is enforced in service layer
 */
const getTestCasesForProblem = async (req, res, next) => {
  try {
    const testCases = await testCaseService.getTestCasesForProblem(
      req.params.problemId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      data: {
        testCases
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single test case by ID
 * GET /api/v1/test-cases/:testCaseId
 */
const getTestCase = async (req, res, next) => {
  try {
    const testCase = await testCaseService.getTestCaseById(
      req.params.testCaseId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      data: {
        testCase
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing test case (ADMIN only)
 * PATCH /api/v1/test-cases/:testCaseId
 */
const updateTestCase = async (req, res, next) => {
  try {
    const testCase = await testCaseService.updateTestCase(req.params.testCaseId, req.body, req.user);

    res.status(200).json({
      success: true,
      data: {
        testCase
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate (soft delete) a test case (ADMIN only)
 * DELETE /api/v1/test-cases/:testCaseId
 */
const deactivateTestCase = async (req, res, next) => {
  try {
    const result = await testCaseService.deactivateTestCase(req.params.testCaseId, req.user);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTestCase,
  getTestCasesForProblem,
  getTestCase,
  updateTestCase,
  deactivateTestCase
};
