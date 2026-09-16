const mongoose = require('mongoose');
const AppError = require('../../utils/app-error');

const SUPPORTED_LANGUAGES = ['CPP', 'PYTHON', 'JAVASCRIPT'];
const MAX_SOURCE_CODE_LENGTH = 65536; // 64KB

/**
 * Validate MongoDB ObjectId for submissionId parameter
 */
const validateSubmissionId = (req, res, next) => {
  const { submissionId } = req.params;

  if (!submissionId || !mongoose.Types.ObjectId.isValid(submissionId)) {
    return next(new AppError('Invalid submission ID format', 400));
  }

  next();
};

/**
 * Validate submission creation payload
 */
const validateCreateSubmission = (req, res, next) => {
  const { problemId, language, sourceCode } = req.body || {};

  if (!problemId || !mongoose.Types.ObjectId.isValid(problemId)) {
    return next(new AppError('Valid problem ID is required', 400));
  }

  if (!language || typeof language !== 'string') {
    return next(new AppError('Language is required', 400));
  }

  const normalizedLanguage = language.trim().toUpperCase();
  if (!SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
    return next(
      new AppError(
        `Unsupported language '${language}'. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
        400
      )
    );
  }

  if (!sourceCode || typeof sourceCode !== 'string' || sourceCode.trim().length === 0) {
    return next(new AppError('Source code is required and cannot be empty', 400));
  }

  if (sourceCode.length > MAX_SOURCE_CODE_LENGTH) {
    return next(new AppError('Source code cannot exceed 64KB (65536 characters)', 400));
  }

  // Set sanitized fields
  req.body.problemId = problemId;
  req.body.language = normalizedLanguage;
  req.body.sourceCode = sourceCode;

  // Strictly strip all server-controlled/immutable fields
  delete req.body.userId;
  delete req.body.status;
  delete req.body.verdict;
  delete req.body.runtimeMs;
  delete req.body.memoryKb;
  delete req.body.testsPassed;
  delete req.body.totalTests;
  delete req.body.id;
  delete req.body._id;
  delete req.body.createdAt;
  delete req.body.updatedAt;

  next();
};

module.exports = {
  validateSubmissionId,
  validateCreateSubmission
};
