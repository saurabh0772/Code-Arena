const argon2 = require('argon2');

/**
 * Hash a plaintext password using Argon2
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  return argon2.hash(password);
};

/**
 * Verify a plaintext password against an Argon2 hash
 * @param {string} hash
 * @param {string} password
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (hash, password) => {
  return argon2.verify(hash, password);
};

module.exports = {
  hashPassword,
  verifyPassword
};
