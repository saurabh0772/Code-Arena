const mongoose = require('mongoose');
const AppError = require('../../utils/app-error');

const VALID_VISIBILITIES = ['PUBLIC', 'HIDDEN'];

/**
 * Validate MongoDB ObjectId for testCaseId parameter
 */
const validateTestCaseId = (req, res, next) => {
  const { testCaseId } = req.params;

  if (!testCaseId || !mongoose.Types.ObjectId.isValid(testCaseId)) {
    return next(new AppError('Invalid test case ID format', 400));
  }

  next();
};

/**
 * Validate test case creation payload
 */
const validateCreateTestCase = (req, res, next) => {
  const { input, expectedOutput, visibility, order } = req.body || {};

  if (input === undefined || typeof input !== 'string') {
    return next(new AppError('Input is required and must be a string', 400));
  }

  if (expectedOutput === undefined || typeof expectedOutput !== 'string') {
    return next(new AppError('Expected output is required and must be a string', 400));
  }

  if (!visibility || !VALID_VISIBILITIES.includes(visibility)) {
    return next(new AppError('Visibility must be either PUBLIC or HIDDEN', 400));
  }

  if (order === undefined || typeof order !== 'number' || isNaN(order) || order < 0) {
    return next(new AppError('Order must be a non-negative number', 400));
  }

  // Sanitize and strip immutable/client-controlled fields
  req.body.input = input;
  req.body.expectedOutput = expectedOutput;
  req.body.visibility = visibility;
  req.body.order = order;

  delete req.body.problemId;
  delete req.body.isActive;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.id;
  delete req.body._id;

  next();
};

/**
 * Validate test case update payload
 */
const validateUpdateTestCase = (req, res, next) => {
  const allowedFields = ['input', 'expectedOutput', 'visibility', 'order'];

  // Strip immutable fields
  delete req.body.problemId;
  delete req.body.isActive;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.id;
  delete req.body._id;

  const updates = Object.keys(req.body).filter((key) => allowedFields.includes(key));

  if (updates.length === 0) {
    return next(new AppError('At least one valid field must be provided for update', 400));
  }

  const { input, expectedOutput, visibility, order } = req.body;

  if (input !== undefined && typeof input !== 'string') {
    return next(new AppError('Input must be a string', 400));
  }

  if (expectedOutput !== undefined && typeof expectedOutput !== 'string') {
    return next(new AppError('Expected output must be a string', 400));
  }

  if (visibility !== undefined && !VALID_VISIBILITIES.includes(visibility)) {
    return next(new AppError('Visibility must be either PUBLIC or HIDDEN', 400));
  }

  if (order !== undefined && (typeof order !== 'number' || isNaN(order) || order < 0)) {
    return next(new AppError('Order must be a non-negative number', 400));
  }

  next();
};

module.exports = {
  validateTestCaseId,
  validateCreateTestCase,
  validateUpdateTestCase
};
