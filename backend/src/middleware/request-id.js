const crypto = require('crypto');

/**
 * Request Correlation ID Middleware
 * Assigns or propagates a unique correlation ID for every incoming HTTP request.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];

  // Reuse safe incoming client header or generate server-side correlation ID
  const requestId =
    typeof existingId === 'string' && existingId.trim().length > 0 && existingId.length <= 128
      ? existingId.trim()
      : `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

module.exports = requestIdMiddleware;
