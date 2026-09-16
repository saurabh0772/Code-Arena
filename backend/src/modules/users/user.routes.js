const express = require('express');
const userController = require('./user.controller');
const authenticate = require('../../middleware/authenticate');

const router = express.Router();

// GET /api/v1/users/me - Protected by authenticate middleware
router.get('/me', authenticate, userController.getMe);

module.exports = router;
