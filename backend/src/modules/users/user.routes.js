const express = require('express');
const userController = require('./user.controller');
const authenticate = require('../../middleware/authenticate');

const router = express.Router();

// GET /api/v1/users/me/stats - User profile statistics
router.get('/me/stats', authenticate, userController.getMyStats);

// GET /api/v1/users/me/solved-problems - User solved problems
router.get('/me/solved-problems', authenticate, userController.getMySolvedProblems);

// GET /api/v1/users/me/activity - User submission calendar activity
router.get('/me/activity', authenticate, userController.getMyActivity);

// GET /api/v1/users/me - Protected by authenticate middleware
router.get('/me', authenticate, userController.getMe);

module.exports = router;

