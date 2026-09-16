const express = require('express');
const submissionController = require('./submission.controller');
const authenticate = require('../../middleware/authenticate');
const {
  validateSubmissionId,
  validateCreateSubmission
} = require('./submission.validation');
const { submissionLimiter } = require('../../middleware/rate-limiter');

const router = express.Router();

// Create new submission - Authenticated user with rate limiting
router.post(
  '/',
  authenticate,
  submissionLimiter,
  validateCreateSubmission,
  submissionController.createSubmission
);

// Get current user's submissions history - Authenticated user (must precede /:submissionId)
router.get('/me', authenticate, submissionController.getMySubmissions);

// Get single submission by ID - Authenticated owner or admin
router.get('/:submissionId', authenticate, validateSubmissionId, submissionController.getSubmission);

module.exports = router;
