const express = require('express');
const authController = require('./auth.controller');
const { validateRegister, validateLogin } = require('./auth.validation');

const { registerLimiter, loginLimiter } = require('../../middleware/rate-limiter');

const router = express.Router();

router.post('/register', registerLimiter, validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);

module.exports = router;
