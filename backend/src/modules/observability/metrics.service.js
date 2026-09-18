/**
 * CodeArena Prometheus Metrics Service
 *
 * Exposes lightweight, Prometheus/OpenMetrics-compatible metrics without high-cardinality labels.
 *
 * High-Cardinality Protection:
 * Strictly avoids user IDs, submission IDs, request IDs, and worker IDs in Prometheus labels.
 * Labels are limited to: method, normalized route template, status code, language, and verdict.
 *
 * Bounded Latency & Failure Resilience:
 * Queue metrics collection is guarded by a strict 200ms timeout to prevent /metrics from blocking
 * or hanging when Redis is degraded or unavailable.
 */

const os = require('os');
const submissionQueue = require('../../queues/submission.queue');
const workerRegistry = require('../../workers/worker-registry.service');

// Standard latency bucket boundaries (in seconds)
const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const EXEC_DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10];
const REDIS_METRICS_TIMEOUT_MS = 200;

// Metrics in-memory storage
const httpRequestsTotal = new Map(); // key: "method|route|status" -> count
const httpRequestDurationHistograms = new Map(); // key: "method|route" -> { sum, count, buckets: Map(le -> count) }
const submissionsTotal = new Map(); // key: "language|verdict" -> count
const workerJobsTotal = new Map(); // key: "status" -> count
const workerFailuresTotal = new Map(); // key: "failure_type" -> count
const executionDurationHistograms = new Map(); // key: "language" -> { sum, count, buckets: Map(le -> count) }

/**
 * Resets in-memory metrics (primarily used in test suites)
 */
function resetMetrics() {
  httpRequestsTotal.clear();
  httpRequestDurationHistograms.clear();
  submissionsTotal.clear();
  workerJobsTotal.clear();
  workerFailuresTotal.clear();
  executionDurationHistograms.clear();
}

/**
 * Normalizes HTTP route path into an Express route template or generalized category.
 * Prevents dynamic IDs (e.g. MongoDB ObjectIds, UUIDs, numeric IDs) from exploding metric label cardinality.
 *
 * @param {string} rawPath
 * @param {string} [routePath] Optional route path from req.route?.path
 * @param {string} [baseUrl] Optional baseUrl from req.baseUrl
 * @returns {string} Normalized route template
 */
function normalizeRoute(rawPath, routePath = '', baseUrl = '') {
  if (routePath) {
    return `${baseUrl}${routePath}`;
  }

  if (!rawPath || rawPath === '/') {
    return '/';
  }

  // Replace 24-hex Mongo ObjectIds
  let normalized = rawPath.replace(/[0-9a-fA-F]{24}/g, ':id');
  // Replace standard UUIDs
  normalized = normalized.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, ':id');
  // Replace trailing or path-segment numeric IDs (e.g. /submissions/123 -> /submissions/:id)
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');

  return normalized;
}

/**
 * Helper to record a sample into a histogram structure.
 */
function recordHistogramSample(histogramMap, key, valueSec, buckets) {
  let hist = histogramMap.get(key);
  if (!hist) {
    const bucketMap = new Map();
    for (const b of buckets) {
      bucketMap.set(b, 0);
    }
    hist = { sum: 0, count: 0, buckets: bucketMap };
    histogramMap.set(key, hist);
  }

  hist.sum += valueSec;
  hist.count += 1;

  for (const b of buckets) {
    if (valueSec <= b) {
      hist.buckets.set(b, hist.buckets.get(b) + 1);
    }
  }
}

/**
 * Record an HTTP request outcome
 */
function recordHttpRequest(method, route, statusCode, durationMs) {
  const normRoute = normalizeRoute(route);
  const statusGroup = `${statusCode}`;
  const key = `${method.toUpperCase()}|${normRoute}|${statusGroup}`;

  httpRequestsTotal.set(key, (httpRequestsTotal.get(key) || 0) + 1);

  const durationKey = `${method.toUpperCase()}|${normRoute}`;
  recordHistogramSample(httpRequestDurationHistograms, durationKey, durationMs / 1000, HTTP_DURATION_BUCKETS);
}

/**
 * Record a completed submission outcome
 */
function recordSubmissionVerdict(language, verdict) {
  const key = `${(language || 'unknown').toLowerCase()}|${verdict || 'UNKNOWN'}`;
  submissionsTotal.set(key, (submissionsTotal.get(key) || 0) + 1);
}

/**
 * Record a worker job lifecycle event
 */
function recordWorkerJob(status) {
  workerJobsTotal.set(status, (workerJobsTotal.get(status) || 0) + 1);
}

/**
 * Record a worker execution failure
 */
function recordWorkerFailure(failureType) {
  workerFailuresTotal.set(failureType, (workerFailuresTotal.get(failureType) || 0) + 1);
}

/**
 * Record execution duration by programming language
 */
function recordExecutionDuration(language, durationMs) {
  const key = (language || 'unknown').toLowerCase();
  recordHistogramSample(executionDurationHistograms, key, durationMs / 1000, EXEC_DURATION_BUCKETS);
}

/**
 * Executes a promise with a hard timeout. Returns defaultValue on rejection or timeout.
 * Prevents hanging when Redis is unavailable or sluggish.
 */
function withTimeout(promise, ms, defaultValue = null) {
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(defaultValue), ms);
  });

  return Promise.race([
    Promise.resolve(promise)
      .then((res) => {
        clearTimeout(timer);
        return res;
      })
      .catch(() => {
        clearTimeout(timer);
        return defaultValue;
      }),
    timeoutPromise
  ]);
}

/**
 * Generates the OpenMetrics / Prometheus exposition text format.
 * Bounded execution time: guarantees prompt response even if Redis is completely unavailable.
 *
 * @returns {Promise<string>}
 */
async function getMetrics() {
  const lines = [];

  // 1. Process CPU and Memory
  lines.push('# HELP codearena_process_uptime_seconds Process uptime in seconds.');
  lines.push('# TYPE codearena_process_uptime_seconds gauge');
  lines.push(`codearena_process_uptime_seconds ${process.uptime()}`);

  lines.push('# HELP codearena_process_resident_memory_bytes Process resident memory size in bytes.');
  lines.push('# TYPE codearena_process_resident_memory_bytes gauge');
  lines.push(`codearena_process_resident_memory_bytes ${process.memoryUsage().rss}`);

  // 2. HTTP Requests Total
  lines.push('# HELP codearena_http_requests_total Total number of HTTP requests processed.');
  lines.push('# TYPE codearena_http_requests_total counter');
  for (const [key, count] of httpRequestsTotal.entries()) {
    const [method, route, status] = key.split('|');
    lines.push(`codearena_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  // 3. HTTP Request Duration Histogram (_bucket, _sum, _count)
  lines.push('# HELP codearena_http_request_duration_seconds HTTP request duration in seconds histogram.');
  lines.push('# TYPE codearena_http_request_duration_seconds histogram');
  for (const [key, hist] of httpRequestDurationHistograms.entries()) {
    const [method, route] = key.split('|');
    for (const [le, count] of hist.buckets.entries()) {
      lines.push(`codearena_http_request_duration_seconds_bucket{method="${method}",route="${route}",le="${le}"} ${count}`);
    }
    lines.push(`codearena_http_request_duration_seconds_bucket{method="${method}",route="${route}",le="+Inf"} ${hist.count}`);
    lines.push(`codearena_http_request_duration_seconds_sum{method="${method}",route="${route}"} ${hist.sum.toFixed(4)}`);
    lines.push(`codearena_http_request_duration_seconds_count{method="${method}",route="${route}"} ${hist.count}`);
  }

  // 4. Submissions Total by Verdict
  lines.push('# HELP codearena_submissions_total Total submissions evaluated by verdict and language.');
  lines.push('# TYPE codearena_submissions_total counter');
  for (const [key, count] of submissionsTotal.entries()) {
    const [language, verdict] = key.split('|');
    lines.push(`codearena_submissions_total{language="${language}",verdict="${verdict}"} ${count}`);
  }

  // 5. Worker Jobs Total
  lines.push('# HELP codearena_worker_jobs_total Total BullMQ jobs processed by worker status.');
  lines.push('# TYPE codearena_worker_jobs_total counter');
  for (const [status, count] of workerJobsTotal.entries()) {
    lines.push(`codearena_worker_jobs_total{status="${status}"} ${count}`);
  }

  // 6. Worker Failures Total
  lines.push('# HELP codearena_worker_failures_total Total worker execution failures by failure type.');
  lines.push('# TYPE codearena_worker_failures_total counter');
  for (const [failureType, count] of workerFailuresTotal.entries()) {
    lines.push(`codearena_worker_failures_total{failure_type="${failureType}"} ${count}`);
  }

  // 7. Execution Duration Histogram (_bucket, _sum, _count)
  lines.push('# HELP codearena_execution_duration_seconds Code execution duration in seconds histogram by language.');
  lines.push('# TYPE codearena_execution_duration_seconds histogram');
  for (const [language, hist] of executionDurationHistograms.entries()) {
    for (const [le, count] of hist.buckets.entries()) {
      lines.push(`codearena_execution_duration_seconds_bucket{language="${language}",le="${le}"} ${count}`);
    }
    lines.push(`codearena_execution_duration_seconds_bucket{language="${language}",le="+Inf"} ${hist.count}`);
    lines.push(`codearena_execution_duration_seconds_sum{language="${language}"} ${hist.sum.toFixed(4)}`);
    lines.push(`codearena_execution_duration_seconds_count{language="${language}"} ${hist.count}`);
  }

  // 8. Queue Metrics (bounded non-blocking retrieval with fast timeout)
  lines.push('# HELP codearena_queue_metrics_available Status of Redis queue metrics availability (1=available, 0=unavailable).');
  lines.push('# TYPE codearena_queue_metrics_available gauge');

  let qMetrics = null;
  try {
    qMetrics = await withTimeout(submissionQueue.getQueueMetrics(), REDIS_METRICS_TIMEOUT_MS, null);
  } catch (_) {
    qMetrics = null;
  }

  if (qMetrics) {
    lines.push('codearena_queue_metrics_available 1');
    lines.push('# HELP codearena_queue_jobs_count Current count of jobs in the BullMQ execution queue by state.');
    lines.push('# TYPE codearena_queue_jobs_count gauge');
    lines.push(`codearena_queue_jobs_count{queue_state="waiting"} ${qMetrics.waiting}`);
    lines.push(`codearena_queue_jobs_count{queue_state="active"} ${qMetrics.active}`);
    lines.push(`codearena_queue_jobs_count{queue_state="completed"} ${qMetrics.completed}`);
    lines.push(`codearena_queue_jobs_count{queue_state="failed"} ${qMetrics.failed}`);
    lines.push(`codearena_queue_jobs_count{queue_state="delayed"} ${qMetrics.delayed}`);
  } else {
    lines.push('codearena_queue_metrics_available 0');
  }

  // 9. Active Worker Registry Count (bounded non-blocking retrieval with fast timeout)
  let workers = null;
  try {
    workers = await withTimeout(workerRegistry.getActiveWorkers(), REDIS_METRICS_TIMEOUT_MS, null);
  } catch (_) {
    workers = null;
  }

  if (workers !== null && Array.isArray(workers)) {
    lines.push('# HELP codearena_active_workers_count Number of active distributed worker daemons in Redis registry.');
    lines.push('# TYPE codearena_active_workers_count gauge');
    lines.push(`codearena_active_workers_count ${workers.length}`);
  }

  return lines.join('\n') + '\n';
}

module.exports = {
  recordHttpRequest,
  recordSubmissionVerdict,
  recordWorkerJob,
  recordWorkerFailure,
  recordExecutionDuration,
  normalizeRoute,
  getMetrics,
  resetMetrics
};
