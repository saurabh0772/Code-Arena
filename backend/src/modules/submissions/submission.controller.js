const submissionService = require('./submission.service');

/**
 * Create a new code submission
 * POST /api/v1/submissions
 */
const createSubmission = async (req, res, next) => {
  try {
    const submission = await submissionService.createSubmission(req.body, req.user);

    res.status(201).json({
      success: true,
      data: {
        submission
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get submission by ID (owner or admin only)
 * GET /api/v1/submissions/:submissionId
 */
const getSubmission = async (req, res, next) => {
  try {
    const submission = await submissionService.getSubmissionById(
      req.params.submissionId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: {
        submission
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get submissions of authenticated user
 * GET /api/v1/submissions/me
 */
const getMySubmissions = async (req, res, next) => {
  try {
    const result = await submissionService.getMySubmissions(req.user._id, req.query);

    res.status(200).json({
      success: true,
      data: {
        submissions: result.submissions,
        pagination: result.pagination
      },
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubmission,
  getSubmission,
  getMySubmissions
};
