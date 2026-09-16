const User = require('../users/user.model');
const { hashPassword, verifyPassword } = require('../../utils/password');
const { generateToken } = require('../../utils/jwt');
const AppError = require('../../utils/app-error');

/**
 * Register a new user
 * @param {Object} userData
 * @param {string} userData.name
 * @param {string} userData.email
 * @param {string} userData.password
 * @returns {Promise<Object>} Safe user data
 */
const register = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Application-level duplicate check
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  // Hash password securely with Argon2
  const passwordHash = await hashPassword(password);

  try {
    // Normal registration strictly creates USER role and active status
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'USER',
      isActive: true
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    // Handle database race condition duplicate key error
    if (error.code === 11000) {
      throw new AppError('User already exists', 409);
    }
    throw error;
  }
};

/**
 * Authenticate user and issue JWT
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<Object>} Safe user data and JWT token
 */
const login = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Reject inactive users
  if (!user.isActive) {
    throw new AppError('User account is inactive', 401);
  }

  // Verify password with Argon2
  const isMatch = await verifyPassword(user.passwordHash, password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  // Minimal token payload: sub and role
  const token = generateToken({
    sub: user._id.toString(),
    role: user.role
  });

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    },
    token
  };
};

module.exports = {
  register,
  login
};
