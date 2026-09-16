const User = require('./user.model');

/**
 * Find user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

module.exports = {
  getUserById
};
