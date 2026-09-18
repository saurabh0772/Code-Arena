const config = require('../config/env');

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const CURRENT_LEVEL = LOG_LEVELS[config.logging?.level?.toLowerCase()] || LOG_LEVELS.info;

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'jwt',
  'secret',
  'authorization',
  'sourcecode',
  'input',
  'expectedoutput'
]);

/**
 * Recursively redacts sensitive keys from metadata objects
 */
function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = redact(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function writeLog(level, message, meta = {}) {
  if (config.env === 'test') {
    return; // Keep test output clean
  }

  if (LOG_LEVELS[level] < CURRENT_LEVEL) {
    return;
  }

  const sanitizedMeta = redact(meta);
  const timestamp = new Date().toISOString();

  if (config.isProduction) {
    const entry = {
      timestamp,
      level,
      message,
      ...sanitizedMeta
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const reqStr = meta.requestId ? ` [${meta.requestId}]` : '';
    const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : '';
    const color =
      level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : level === 'info' ? '\x1b[36m' : '\x1b[90m';
    const reset = '\x1b[0m';
    process.stdout.write(`${color}[${timestamp}] [${level.toUpperCase()}]${reqStr}${reset} ${message}${metaStr}\n`);
  }
}

const logger = {
  debug(message, meta) {
    writeLog('debug', message, meta);
  },
  info(message, meta) {
    writeLog('info', message, meta);
  },
  warn(message, meta) {
    writeLog('warn', message, meta);
  },
  error(message, meta) {
    writeLog('error', message, meta);
  }
};

module.exports = logger;
