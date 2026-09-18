const problemService = require('./problem.service');

/**
 * Create a new problem (ADMIN only)
 * POST /api/v1/problems
 */
const createProblem = async (req, res, next) => {
  try {
    const problem = await problemService.createProblem(req.body, req.user._id);

    res.status(201).json({
      success: true,
      data: {
        problem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing problem (ADMIN only)
 * PATCH /api/v1/problems/:problemId
 */
const updateProblem = async (req, res, next) => {
  try {
    const problem = await problemService.updateProblem(req.params.problemId, req.body, req.user);

    res.status(200).json({
      success: true,
      data: {
        problem
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate (soft delete) a problem (ADMIN only)
 * DELETE /api/v1/problems/:problemId
 */
const deactivateProblem = async (req, res, next) => {
  try {
    const result = await problemService.deactivateProblem(req.params.problemId, req.user);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List active problems
 * GET /api/v1/problems
 */
const listProblems = async (req, res, next) => {
  try {
    const result = await problemService.listProblems(req.query, req.user);

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
 * Get problem details by ID
 * GET /api/v1/problems/:problemId
 */
const getProblem = async (req, res, next) => {
  try {
    const problem = await problemService.getProblemById(req.params.problemId);

    res.status(200).json({
      success: true,
      data: {
        problem
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProblem,
  updateProblem,
  deactivateProblem,
  listProblems,
  getProblem
};
