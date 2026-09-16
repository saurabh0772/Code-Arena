const { verifyToken } = require('../utils/jwt');
const User = require('../modules/users/user.model');
const AppError = require('../utils/app-error');

/**
 * Authentication middleware
 * Verifies Bearer JWT, loads user from database, checks isActive status,
 * and attaches trusted user object to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(new AppError('Authentication required: missing authorization header', 401));
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return next(new AppError('Invalid authorization header format. Expected Bearer <token>', 401));
    }

    const token = parts[1];

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return next(err);
    }

    if (!decoded || !decoded.sub) {
      return next(new AppError('Invalid token payload', 401));
    }

    // Load user from database using verified token subject
    const user = await User.findById(decoded.sub);
    if (!user) {
      return next(new AppError('User belonging to this token no longer exists', 401));
    }

    // Reject inactive accounts
    if (!user.isActive) {
      return next(new AppError('User account is inactive', 401));
    }

    // Attach trusted user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
