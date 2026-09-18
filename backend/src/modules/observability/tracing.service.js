/**
 * CodeArena W3C Trace Context Propagation Service
 *
 * Implements the W3C Trace Context (Level 1) specification:
 * Format: 00-{traceId}-{spanId}-{traceFlags}
 *
 * Architectural Boundary:
 * This module provides explicit, lightweight W3C Trace Context propagation across
 * HTTP requests, BullMQ queue jobs (via job.opts.traceparent), worker execution daemons,
 * and structured log metadata.
 *
 * Note on Observability Scope:
 * This is an explicit, standards-compliant context propagation protocol for distributed
 * correlation, not an automatic agent-based SDK instrumentation framework.
 */

const crypto = require('crypto');

const TRACEPARENT_REGEX = /^00-([0-9a-fA-F]{32})-([0-9a-fA-F]{16})-([0-9a-fA-F]{2})$/;

/**
 * Generate a new random 16-byte (32 hex char) traceId
 *
 * @returns {string}
 */
function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a new random 8-byte (16 hex char) spanId
 *
 * @returns {string}
 */
function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Formats a valid W3C traceparent string
 *
 * @param {string} traceId
 * @param {string} spanId
 * @param {string} [flags='01']
 * @returns {string}
 */
function formatTraceparent(traceId, spanId, flags = '01') {
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Extracts and parses a W3C traceparent header or initializes a fresh trace context.
 *
 * @param {Object|string} [headerInput] Request headers object or traceparent string
 * @returns {{ traceId: string, spanId: string, traceFlags: string, traceparent: string, isNew: boolean }}
 */
function extractOrCreateContext(headerInput) {
  let headerValue = '';

  if (typeof headerInput === 'string') {
    headerValue = headerInput.trim();
  } else if (headerInput && typeof headerInput === 'object') {
    headerValue = (headerInput['traceparent'] || headerInput['x-trace-id'] || '').trim();
  }

  const match = TRACEPARENT_REGEX.exec(headerValue);
  if (match) {
    const [, traceId, spanId, traceFlags] = match;
    // Disallow all-zero traceId or spanId per W3C specification
    if (traceId !== '00000000000000000000000000000000' && spanId !== '0000000000000000') {
      return {
        traceId,
        spanId,
        traceFlags,
        traceparent: formatTraceparent(traceId, spanId, traceFlags),
        isNew: false
      };
    }
  }

  // Create fresh trace context
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const traceFlags = '01'; // sampled

  return {
    traceId,
    spanId,
    traceFlags,
    traceparent: formatTraceparent(traceId, spanId, traceFlags),
    isNew: true
  };
}

/**
 * Creates a child span maintaining the same traceId while generating a new spanId.
 * Used when enqueuing to BullMQ or handing off to the Worker.
 *
 * @param {string} parentTraceparent
 * @returns {{ traceId: string, spanId: string, traceFlags: string, traceparent: string }}
 */
function createChildSpan(parentTraceparent) {
  const parent = extractOrCreateContext(parentTraceparent);
  const childSpanId = generateSpanId();

  return {
    traceId: parent.traceId,
    spanId: childSpanId,
    traceFlags: parent.traceFlags,
    traceparent: formatTraceparent(parent.traceId, childSpanId, parent.traceFlags)
  };
}

module.exports = {
  generateTraceId,
  generateSpanId,
  formatTraceparent,
  extractOrCreateContext,
  createChildSpan
};
