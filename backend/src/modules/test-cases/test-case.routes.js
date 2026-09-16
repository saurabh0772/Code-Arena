const express = require('express');
const testCaseController = require('./test-case.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validateProblemId } = require('../problems/problem.validation');
const {
  validateTestCaseId,
  validateCreateTestCase,
  validateUpdateTestCase
} = require('./test-case.validation');

// Nested router for problem-specific test cases (/api/v1/problems/:problemId/test-cases)
const problemTestCaseRouter = express.Router({ mergeParams: true });

problemTestCaseRouter.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validateProblemId,
  validateCreateTestCase,
  testCaseController.createTestCase
);

problemTestCaseRouter.get(
  '/',
  authenticate,
  validateProblemId,
  testCaseController.getTestCasesForProblem
);

// Top-level router for direct test case operations (/api/v1/test-cases)
const testCaseRouter = express.Router();

testCaseRouter.get(
  '/:testCaseId',
  authenticate,
  validateTestCaseId,
  testCaseController.getTestCase
);

testCaseRouter.patch(
  '/:testCaseId',
  authenticate,
  authorize('ADMIN'),
  validateTestCaseId,
  validateUpdateTestCase,
  testCaseController.updateTestCase
);

testCaseRouter.delete(
  '/:testCaseId',
  authenticate,
  authorize('ADMIN'),
  validateTestCaseId,
  testCaseController.deactivateTestCase
);

module.exports = {
  problemTestCaseRouter,
  testCaseRouter
};
