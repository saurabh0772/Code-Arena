const mongoose = require('mongoose');
const User = require('./user.model');
const Problem = require('../problems/problem.model');
const Submission = require('../submissions/submission.model');

/**
 * Find user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Calculate user profile statistics
 * @param {string|ObjectId} userId
 * @returns {Promise<Object>} Computed statistics
 */
const getUserStats = async (userId) => {
  const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  // 1. Aggregate submission verdicts for the user
  const submissionStats = await Submission.aggregate([
    { $match: { userId: userObjectId } },
    { $group: { _id: '$verdict', count: { $sum: 1 } } }
  ]);

  let totalSubmissions = 0;
  let acceptedSubmissions = 0;
  let wrongAnswerSubmissions = 0;
  let compilationErrorSubmissions = 0;
  let runtimeErrorSubmissions = 0;
  let timeLimitExceededSubmissions = 0;
  let memoryLimitExceededSubmissions = 0;

  for (const stat of submissionStats) {
    totalSubmissions += stat.count;
    if (stat._id === 'ACCEPTED') acceptedSubmissions = stat.count;
    else if (stat._id === 'WRONG_ANSWER') wrongAnswerSubmissions = stat.count;
    else if (stat._id === 'COMPILATION_ERROR') compilationErrorSubmissions = stat.count;
    else if (stat._id === 'RUNTIME_ERROR') runtimeErrorSubmissions = stat.count;
    else if (stat._id === 'TIME_LIMIT_EXCEEDED') timeLimitExceededSubmissions = stat.count;
    else if (stat._id === 'MEMORY_LIMIT_EXCEEDED') memoryLimitExceededSubmissions = stat.count;
  }

  const acceptanceRate = totalSubmissions > 0
    ? Number(((acceptedSubmissions / totalSubmissions) * 100).toFixed(2))
    : 0;

  // 2. Aggregate distinct solved problems by difficulty
  const solvedProblemIds = await Submission.find({
    userId: userObjectId,
    verdict: 'ACCEPTED'
  }).distinct('problemId');

  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;

  if (solvedProblemIds.length > 0) {
    const difficultyCounts = await Problem.aggregate([
      { $match: { _id: { $in: solvedProblemIds }, isActive: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    for (const dc of difficultyCounts) {
      if (dc._id === 'EASY') easySolved = dc.count;
      else if (dc._id === 'MEDIUM') mediumSolved = dc.count;
      else if (dc._id === 'HARD') hardSolved = dc.count;
    }
  }

  const totalProblemsSolved = easySolved + mediumSolved + hardSolved;

  return {
    totalProblemsSolved,
    easySolved,
    mediumSolved,
    hardSolved,
    totalSubmissions,
    acceptedSubmissions,
    wrongAnswerSubmissions,
    compilationErrorSubmissions,
    runtimeErrorSubmissions,
    timeLimitExceededSubmissions,
    memoryLimitExceededSubmissions,
    acceptanceRate
  };
};

/**
 * Retrieve problems solved by authenticated user
 * @param {string|ObjectId} userId
 * @param {Object} queryParams - { page, limit, difficulty }
 * @returns {Promise<Object>} Paginated solved problems
 */
const getUserSolvedProblems = async (userId, queryParams = {}) => {
  const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Find distinct problemIds with at least one ACCEPTED submission
  const solvedProblemIds = await Submission.find({
    userId: userObjectId,
    verdict: 'ACCEPTED'
  }).distinct('problemId');

  if (solvedProblemIds.length === 0) {
    return {
      problems: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }

  const query = {
    _id: { $in: solvedProblemIds },
    isActive: true
  };

  if (queryParams.difficulty) {
    query.difficulty = queryParams.difficulty.toUpperCase();
  }

  const [problems, total] = await Promise.all([
    Problem.find(query)
      .select('title difficulty tags createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Problem.countDocuments(query)
  ]);

  const problemList = problems.map((p) => ({
    id: p._id.toString(),
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags,
    createdAt: p.createdAt,
    solved: true
  }));

  return {
    problems: problemList,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Retrieve user submission activity aggregated by calendar date (UTC)
 * @param {string|ObjectId} userId
 * @param {Object} queryParams - { range }
 * @returns {Promise<Object>} Activity aggregation
 */
const getUserActivity = async (userId, queryParams = {}) => {
  const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const rawRange = (queryParams.range || '1y').toLowerCase();
  let startDate = new Date();
  let normalizedRange = '1y';

  if (rawRange === '30d') {
    startDate.setDate(startDate.getDate() - 30);
    normalizedRange = '30d';
  } else if (rawRange === '90d') {
    startDate.setDate(startDate.getDate() - 90);
    normalizedRange = '90d';
  } else if (rawRange === 'all') {
    startDate = new Date(0);
    normalizedRange = 'all';
  } else {
    // Default 1y (365 days)
    startDate.setFullYear(startDate.getFullYear() - 1);
    normalizedRange = '1y';
  }

  const matchFilter = {
    userId: userObjectId,
    createdAt: { $gte: startDate }
  };

  const activityData = await Submission.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        submissions: '$count'
      }
    }
  ]);

  const totalSubmissions = activityData.reduce((sum, item) => sum + item.submissions, 0);

  return {
    range: normalizedRange,
    totalSubmissions,
    activity: activityData
  };
};

module.exports = {
  getUserById,
  getUserStats,
  getUserSolvedProblems,
  getUserActivity
};

