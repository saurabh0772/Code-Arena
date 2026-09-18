/**
 * CodeArena Phase 18 — Modest Architectural Load Test Benchmark
 *
 * Purpose:
 * Evaluates API throughput, response latencies (P50, P95, P99), and error rates under
 * realistic concurrency without artificial laptop strain.
 *
 * Usage:
 *   node scripts/load-test.js [targetUrl] [totalRequests] [concurrency]
 * Example:
 *   node scripts/load-test.js http://localhost:5000 50 5
 */

const http = require('http');
const https = require('https');

const TARGET_URL = process.argv[2] || process.env.LOAD_TEST_URL || 'http://localhost:5000';
const TOTAL_REQUESTS = parseInt(process.argv[3] || '50', 10);
const CONCURRENCY = parseInt(process.argv[4] || '5', 10);

async function makeRequest(url) {
  const parsed = new URL(url);
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const start = Date.now();
    const req = client.get(
      url,
      {
        headers: {
          'traceparent': `00-4bf92f3577b34da6a3ce929d0e0e4736-${Math.random().toString(16).slice(2, 18).padStart(16, '0')}-01`,
          'User-Agent': 'CodeArena-LoadTest/1.0'
        },
        timeout: 5000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            success: res.statusCode >= 200 && res.statusCode < 400
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        durationMs: Date.now() - start,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 408,
        durationMs: Date.now() - start,
        success: false,
        error: 'Timeout'
      });
    });
  });
}

function calculatePercentile(latencies, percentile) {
  if (latencies.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * latencies.length) - 1;
  return latencies[Math.max(0, Math.min(index, latencies.length - 1))];
}

async function runLoadTest() {
  console.log('================================================================');
  console.log('CODEARENA PHASE 18 — MODEST ARCHITECTURAL LOAD BENCHMARK');
  console.log('================================================================');
  console.log(`Target URL:     ${TARGET_URL}/health`);
  console.log(`Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`Concurrency:    ${CONCURRENCY}\n`);

  const results = [];
  let completed = 0;
  const startTime = Date.now();

  async function worker() {
    while (completed < TOTAL_REQUESTS) {
      completed++;
      const result = await makeRequest(`${TARGET_URL}/health`);
      results.push(result);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const throughput = ((results.length / totalTimeMs) * 1000).toFixed(2);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2);

  console.log('--- Benchmark Results ---');
  console.log(`Total Elapsed:  ${(totalTimeMs / 1000).toFixed(3)}s`);
  console.log(`Throughput:     ${throughput} req/s`);
  console.log(`Successful:     ${successCount}`);
  console.log(`Failed:         ${failureCount}`);
  console.log(`Latency Min:    ${latencies[0] || 0}ms`);
  console.log(`Latency Avg:    ${avgLatency}ms`);
  console.log(`Latency P50:    ${calculatePercentile(latencies, 50)}ms`);
  console.log(`Latency P95:    ${calculatePercentile(latencies, 95)}ms`);
  console.log(`Latency P99:    ${calculatePercentile(latencies, 99)}ms`);
  console.log(`Latency Max:    ${latencies[latencies.length - 1] || 0}ms`);
  console.log('================================================================\n');

  if (failureCount > 0 && failureCount === results.length) {
    console.log('Note: Target server was unreachable. Run load test against a live stack or cluster.');
  }
}

runLoadTest().catch((err) => {
  console.error('Load test encountered unhandled error:', err);
  process.exit(1);
});
