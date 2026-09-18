const express = require('express');
const problemController = require('./problem.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const {
  validateProblemId,
  validateCreateProblem,
  validateUpdateProblem
} = require('./problem.validation');
const { problemTestCaseRouter } = require('../test-cases/test-case.routes');

const router = express.Router();

// List problems - Public with optional authentication for derived solved status
router.get('/', optionalAuthenticate, problemController.listProblems);

// Get single problem - Public
router.get('/:problemId', validateProblemId, problemController.getProblem);

// Create problem - ADMIN only
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validateCreateProblem,
  problemController.createProblem
);

// Update problem - ADMIN only
router.patch(
  '/:problemId',
  authenticate,
  authorize('ADMIN'),
  validateProblemId,
  validateUpdateProblem,
  problemController.updateProblem
);

// Deactivate problem (soft delete) - ADMIN only
router.delete(
  '/:problemId',
  authenticate,
  authorize('ADMIN'),
  validateProblemId,
  problemController.deactivateProblem
);

// Nested test cases: /api/v1/problems/:problemId/test-cases
router.use('/:problemId/test-cases', problemTestCaseRouter);

module.exports = router;
