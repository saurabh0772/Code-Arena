/**
 * CodeArena — Phase 17: Distributed Worker Registry & Heartbeat Service
 *
 * Provides ephemeral liveness and status visibility for distributed worker daemons.
 * Backed by shared Redis keys under 'codearena:workers:<workerId>' with TTL expiration.
 *
 * Operational Statuses:
 * - STARTING: Worker process initialized, verifying datastore dependencies
 * - READY: BullMQ worker active and accepting jobs
 * - DRAINING: Shutdown signal received, active jobs completing, no new jobs accepted
 * - STOPPED: Worker finalized cleanup and stopped
 */

const os = require('os');
const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

const WORKER_KEY_PREFIX = 'codearena:workers:';
const DEFAULT_HEARTBEAT_TTL_S = 15; // 3x standard 5s heartbeat interval

/**
 * Returns a Redis client instance for registry operations.
 */
function getRedis() {
  return redisConfig.getRedisConnection();
}

/**
 * Formats the Redis key for a given workerId.
 * @param {string} workerId
 * @returns {string}
 */
function getWorkerKey(workerId) {
  return `${WORKER_KEY_PREFIX}${workerId}`;
}

/**
 * Registers a worker process in the ephemeral Redis registry.
 *
 * @param {Object} params
 * @param {string} params.workerId
 * @param {number} [params.concurrency=2]
 * @param {string} [params.status='STARTING']
 * @param {number} [params.ttlSeconds=15]
 * @returns {Promise<boolean>}
 */
async function registerWorker({
  workerId,
  concurrency = 2,
  status = 'STARTING',
  ttlSeconds = DEFAULT_HEARTBEAT_TTL_S
}) {
  if (!workerId) return false;

  try {
    const redis = getRedis();
    const now = new Date().toISOString();
    const record = {
      workerId,
      status,
      concurrency,
      startedAt: now,
      lastHeartbeat: now,
      pid: process.pid,
      hostname: os.hostname()
    };

    const key = getWorkerKey(workerId);
    await redis.set(key, JSON.stringify(record), 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.warn('worker_registry_register_failed', { workerId, error: err.message });
    return false;
  }
}

/**
 * Refreshes the heartbeat timestamp and TTL for an active worker.
 *
 * @param {string} workerId
 * @param {number} [ttlSeconds=15]
 * @returns {Promise<boolean>}
 */
async function heartbeatWorker(workerId, ttlSeconds = DEFAULT_HEARTBEAT_TTL_S) {
  if (!workerId) return false;

  try {
    const redis = getRedis();
    const key = getWorkerKey(workerId);
    const existingRaw = await redis.get(key);

    const now = new Date().toISOString();
    let record;
    if (existingRaw) {
      record = JSON.parse(existingRaw);
      record.lastHeartbeat = now;
    } else {
      record = {
        workerId,
        status: 'READY',
        startedAt: now,
        lastHeartbeat: now,
        pid: process.pid,
        hostname: os.hostname()
      };
    }

    await redis.set(key, JSON.stringify(record), 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.debug('worker_registry_heartbeat_failed', { workerId, error: err.message });
    return false;
  }
}

/**
 * Updates the operational status of a registered worker.
 *
 * @param {string} workerId
 * @param {'STARTING'|'READY'|'DRAINING'|'STOPPED'} status
 * @param {number} [ttlSeconds=15]
 * @returns {Promise<boolean>}
 */
async function updateWorkerStatus(workerId, status, ttlSeconds = DEFAULT_HEARTBEAT_TTL_S) {
  if (!workerId) return false;

  try {
    const redis = getRedis();
    const key = getWorkerKey(workerId);
    const existingRaw = await redis.get(key);

    const now = new Date().toISOString();
    let record;
    if (existingRaw) {
      record = JSON.parse(existingRaw);
      record.status = status;
      record.lastHeartbeat = now;
    } else {
      record = {
        workerId,
        status,
        startedAt: now,
        lastHeartbeat: now,
        pid: process.pid,
        hostname: os.hostname()
      };
    }

    // If stopping, retain for short duration (5s) for observability then expire
    const effectiveTTL = status === 'STOPPED' ? 5 : ttlSeconds;
    await redis.set(key, JSON.stringify(record), 'EX', effectiveTTL);
    return true;
  } catch (err) {
    logger.warn('worker_registry_status_update_failed', { workerId, status, error: err.message });
    return false;
  }
}

/**
 * Deregisters a worker from Redis (e.g. during clean shutdown).
 *
 * @param {string} workerId
 * @returns {Promise<boolean>}
 */
async function deregisterWorker(workerId) {
  if (!workerId) return false;

  try {
    const redis = getRedis();
    const key = getWorkerKey(workerId);
    await redis.del(key);
    return true;
  } catch (err) {
    logger.debug('worker_registry_deregister_failed', { workerId, error: err.message });
    return false;
  }
}

/**
 * Retrieves all currently active and registered workers.
 * Bounded by a 200ms timeout to ensure callers (such as /metrics) never hang if Redis is down.
 *
 * @returns {Promise<Array<Object>>}
 */
async function getActiveWorkers() {
  try {
    const redis = getRedis();
    let timer;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve([]), 200);
    });

    const fetchPromise = (async () => {
      const keys = await redis.keys(`${WORKER_KEY_PREFIX}*`);
      if (!keys || keys.length === 0) {
        return [];
      }

      const values = await redis.mget(keys);
      const workers = [];

      for (let i = 0; i < values.length; i++) {
        if (values[i]) {
          try {
            const parsed = JSON.parse(values[i]);
            workers.push({
              workerId: parsed.workerId,
              status: parsed.status,
              concurrency: parsed.concurrency || 1,
              startedAt: parsed.startedAt,
              lastHeartbeat: parsed.lastHeartbeat,
              hostname: parsed.hostname,
              pid: parsed.pid
            });
          } catch (_) {
            // ignore malformed entries
          }
        }
      }

      // Sort by startedAt ascending
      workers.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
      return workers;
    })().then((res) => {
      clearTimeout(timer);
      return res;
    }).catch((err) => {
      clearTimeout(timer);
      logger.debug('worker_registry_get_active_failed', { error: err.message });
      return [];
    });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    logger.debug('worker_registry_get_active_failed', { error: err.message });
    return [];
  }
}

module.exports = {
  WORKER_KEY_PREFIX,
  DEFAULT_HEARTBEAT_TTL_S,
  registerWorker,
  heartbeatWorker,
  updateWorkerStatus,
  deregisterWorker,
  getActiveWorkers
};
