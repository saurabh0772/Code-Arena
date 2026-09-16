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

module.exports = {
  getMe
};
