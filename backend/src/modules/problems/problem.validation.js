const mongoose = require('mongoose');
const AppError = require('../../utils/app-error');

const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

/**
 * Validate MongoDB ObjectId parameter
 */
const validateProblemId = (req, res, next) => {
  const { problemId } = req.params;

  if (!problemId || !mongoose.Types.ObjectId.isValid(problemId)) {
    return next(new AppError('Invalid problem ID format', 400));
  }

  next();
};

/**
 * Validate problem creation payload
 */
const validateCreateProblem = (req, res, next) => {
  const {
    title,
    description,
    difficulty,
    tags,
    inputFormat,
    outputFormat,
    constraints,
    examples
  } = req.body || {};

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return next(new AppError('Title is required and must not be empty', 400));
  }

  if (title.trim().length > 200) {
    return next(new AppError('Title cannot exceed 200 characters', 400));
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return next(new AppError('Description is required and must not be empty', 400));
  }

  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return next(new AppError('Difficulty must be one of: EASY, MEDIUM, HARD', 400));
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    return next(new AppError('Tags must be an array of strings', 400));
  }

  if (!inputFormat || typeof inputFormat !== 'string' || inputFormat.trim().length === 0) {
    return next(new AppError('Input format is required', 400));
  }

  if (!outputFormat || typeof outputFormat !== 'string' || outputFormat.trim().length === 0) {
    return next(new AppError('Output format is required', 400));
  }

  if (!constraints || typeof constraints !== 'string' || constraints.trim().length === 0) {
    return next(new AppError('Constraints are required', 400));
  }

  if (!examples || !Array.isArray(examples) || examples.length === 0) {
    return next(new AppError('Examples must be a non-empty array', 400));
  }

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    if (
      !ex ||
      typeof ex !== 'object' ||
      typeof ex.input !== 'string' ||
      typeof ex.output !== 'string'
    ) {
      return next(
        new AppError(`Example at index ${i} must contain string input and output`, 400)
      );
    }
  }

  // Sanitize and trim
  req.body.title = title.trim();
  req.body.description = description.trim();
  req.body.difficulty = difficulty;
  req.body.tags = Array.isArray(tags)
    ? tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
    : [];
  req.body.inputFormat = inputFormat.trim();
  req.body.outputFormat = outputFormat.trim();
  req.body.constraints = constraints.trim();
  req.body.examples = examples.map((ex) => ({
    input: ex.input,
    output: ex.output
  }));

  // Strip client-supplied sensitive/immutable fields
  delete req.body.authorId;
  delete req.body.isActive;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.id;
  delete req.body._id;

  next();
};

/**
 * Validate problem update payload
 */
const validateUpdateProblem = (req, res, next) => {
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

  // Strip immutable fields immediately
  delete req.body.authorId;
  delete req.body.isActive;
  delete req.body.createdAt;
  delete req.body.updatedAt;
  delete req.body.id;
  delete req.body._id;

  const updates = Object.keys(req.body).filter((key) => allowedFields.includes(key));

  if (updates.length === 0) {
    return next(new AppError('At least one valid field must be provided for update', 400));
  }

  const {
    title,
    description,
    difficulty,
    tags,
    inputFormat,
    outputFormat,
    constraints,
    examples
  } = req.body;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return next(new AppError('Title must be a non-empty string', 400));
    }
    if (title.trim().length > 200) {
      return next(new AppError('Title cannot exceed 200 characters', 400));
    }
    req.body.title = title.trim();
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim().length === 0) {
      return next(new AppError('Description must be a non-empty string', 400));
    }
    req.body.description = description.trim();
  }

  if (difficulty !== undefined) {
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return next(new AppError('Difficulty must be one of: EASY, MEDIUM, HARD', 400));
    }
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      return next(new AppError('Tags must be an array of strings', 400));
    }
    req.body.tags = tags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  }

  if (inputFormat !== undefined) {
    if (typeof inputFormat !== 'string' || inputFormat.trim().length === 0) {
      return next(new AppError('Input format must be a non-empty string', 400));
    }
    req.body.inputFormat = inputFormat.trim();
  }

  if (outputFormat !== undefined) {
    if (typeof outputFormat !== 'string' || outputFormat.trim().length === 0) {
      return next(new AppError('Output format must be a non-empty string', 400));
    }
    req.body.outputFormat = outputFormat.trim();
  }

  if (constraints !== undefined) {
    if (typeof constraints !== 'string' || constraints.trim().length === 0) {
      return next(new AppError('Constraints must be a non-empty string', 400));
    }
    req.body.constraints = constraints.trim();
  }

  if (examples !== undefined) {
    if (!Array.isArray(examples) || examples.length === 0) {
      return next(new AppError('Examples must be a non-empty array', 400));
    }
    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      if (
        !ex ||
        typeof ex !== 'object' ||
        typeof ex.input !== 'string' ||
        typeof ex.output !== 'string'
      ) {
        return next(
          new AppError(`Example at index ${i} must contain string input and output`, 400)
        );
      }
    }
  }

  next();
};

module.exports = {
  validateProblemId,
  validateCreateProblem,
  validateUpdateProblem
};
