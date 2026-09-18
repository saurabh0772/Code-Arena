const userService = require('./user.service');

/**
 * Get current authenticated user profile
 * GET /api/v1/users/me
 */
const getMe = async (req, res) => {
  const safeUser = req.user.toSafeObject();

  res.status(200).json({
    success: true,
    data: {
      ...safeUser,
      user: safeUser
    }
  });
};

/**
 * Get current authenticated user's coding statistics
 * GET /api/v1/users/me/stats
 */
const getMyStats = async (req, res, next) => {
  try {
    const stats = await userService.getUserStats(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        ...stats,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get problems solved by authenticated user
 * GET /api/v1/users/me/solved-problems
 */
const getMySolvedProblems = async (req, res, next) => {
  try {
    const result = await userService.getUserSolvedProblems(req.user._id, req.query);

    res.status(200).json({
      success: true,
      data: {
        problems: result.problems,
        pagination: result.pagination
      },
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated user's submission activity
 * GET /api/v1/users/me/activity
 */
const getMyActivity = async (req, res, next) => {
  try {
    const result = await userService.getUserActivity(req.user._id, req.query);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  getMyStats,
  getMySolvedProblems,
  getMyActivity
};

