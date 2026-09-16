const AppError = require('../utils/app-error');

/**
 * Role-based authorization middleware
 * Verifies that the authenticated user has one of the allowed roles.
 * Never trusts role from request body, headers, or client params.
 * 
 * @param {...string} allowedRoles - Roles allowed to access the route (e.g. 'ADMIN', 'USER')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Must be preceded by authenticate middleware
    if (!req.user || !req.user.role) {
      return next(new AppError('Authentication required before authorization', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access denied: insufficient permissions', 403));
    }

    next();
  };
};

module.exports = authorize;
