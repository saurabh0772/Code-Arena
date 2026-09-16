const AppError = require('../../utils/app-error');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Middleware to validate registration payload
 */
const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return next(new AppError('Name is required and must be between 2 and 100 characters', 400));
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return next(new AppError('A valid email address is required', 400));
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return next(new AppError('Password is required and must be at least 8 characters long', 400));
  }

  if (password.length > 128) {
    return next(new AppError('Password cannot exceed 128 characters', 400));
  }

  // Sanitize input and strip any privileged/prohibited fields
  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.password = password;

  // Explicitly disallow client-assigned roles or sensitive fields
  delete req.body.role;
  delete req.body.isActive;
  delete req.body.userId;
  delete req.body.id;
  delete req.body._id;
  delete req.body.passwordHash;

  next();
};

/**
 * Middleware to validate login payload
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return next(new AppError('A valid email address is required', 400));
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return next(new AppError('Password is required', 400));
  }

  req.body.email = email.trim().toLowerCase();
  req.body.password = password;

  next();
};

module.exports = {
  validateRegister,
  validateLogin
};
