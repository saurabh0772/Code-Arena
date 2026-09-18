const crypto = require('crypto');
const config = require('../config/env');

/**
 * Request Correlation & Instance ID Middleware
 * Assigns or propagates a unique correlation ID for every incoming HTTP request
 * and tags the response with the processing backend API instance identity.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];

  // Reuse safe incoming client header or generate server-side correlation ID
  const requestId =
    typeof existingId === 'string' && existingId.trim().length > 0 && existingId.length <= 128
      ? existingId.trim()
      : `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const apiInstanceId =
    (req.app && typeof req.app.get === 'function' && req.app.get('apiInstanceId')) ||
    config.apiInstanceId ||
    (config.resolveApiInstanceId ? config.resolveApiInstanceId() : 'api-unknown');

  req.id = requestId;
  req.requestId = requestId;
  req.apiInstanceId = apiInstanceId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-API-Instance-Id', apiInstanceId);

  next();
}

module.exports = requestIdMiddleware;
