const http = require('http');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + (u.search || ''),
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('PHASE 12 LIVE ASYNC PROCESSING END-TO-END VERIFICATION');
  console.log('====================================================\n');

  // 1. Check readiness probe
  console.log('1. Checking /ready endpoint...');
  const readyRes = await request('http://localhost:5000/ready');
  console.log('   /ready status:', readyRes.status, readyRes.data?.status);
  console.log('   Subsystems:', JSON.stringify(readyRes.data?.checks));
  if (readyRes.status !== 200 || readyRes.data?.checks?.redis?.status !== 'healthy') {
    throw new Error('Readiness check failed!');
  }

  // 2. Log in as test user
  console.log('\n2. Logging in as user@codearena.dev...');
  const loginRes = await request('http://localhost:5000/api/v1/auth/login', { method: 'POST' }, {
    email: 'user@codearena.dev',
    password: 'User@12345'
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.data.token;
  console.log('   Login successful! JWT acquired.');

  // 3. Get Sum of Two Numbers problem
  console.log('\n3. Fetching problem list...');
  const probRes = await request('http://localhost:5000/api/v1/problems', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const problems = probRes.data.data.problems;
  const problem = problems.find((p) => p.title === 'Sum of Two Numbers') || problems[0];
  console.log(`   Selected Problem: "${problem.title}" (${problem.difficulty}) ID: ${problem.id}`);

  // 4. Submit solution (C++)
  console.log('\n4. Submitting solution (POST /api/v1/submissions)...');
  const t0 = Date.now();
  const subRes = await request('http://localhost:5000/api/v1/submissions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }, {
    problemId: problem.id,
    language: 'CPP',
    sourceCode: `#include <iostream>
using namespace std;
int main() {
    long long a, b;
    if (cin >> a >> b) {
        cout << (a + b) << endl;
    }
    return 0;
}`
  });
  const submitDuration = Date.now() - t0;
  console.log(`   HTTP Status: ${subRes.status} (returned in ${submitDuration}ms)`);
  console.log('   Submission Fast-Return Response:', {
    id: subRes.data.data.submission.id,
    status: subRes.data.data.submission.status,
    verdict: subRes.data.data.submission.verdict,
    queuedAt: subRes.data.data.submission.queuedAt
  });

  if (subRes.status !== 201 || subRes.data.data.submission.status !== 'QUEUED') {
    throw new Error('Immediate async fast return failed! Expected status 201 and status QUEUED');
  }

  const submissionId = subRes.data.data.submission.id;

  // 5. Poll for worker completion
  console.log('\n5. Polling GET /api/v1/submissions/:id until completion...');
  let completedSubmission = null;
  const pollStart = Date.now();

  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(800);
    const pollRes = await request(`http://localhost:5000/api/v1/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const sub = pollRes.data.data.submission;
    console.log(`   [Attempt ${attempt} | +${Date.now() - pollStart}ms] Status: ${sub.status} | Verdict: ${sub.verdict}`);

    if (sub.status === 'COMPLETED' || sub.status === 'FAILED') {
      completedSubmission = sub;
      break;
    }
  }

  if (!completedSubmission) {
    throw new Error('Polling timed out without reaching terminal state');
  }

  console.log('\n6. Final Submission Result:');
  console.log('   Status:', completedSubmission.status);
  console.log('   Verdict:', completedSubmission.verdict);
  console.log('   Tests Passed:', `${completedSubmission.testsPassed} / ${completedSubmission.totalTests}`);
  console.log('   Runtime:', `${completedSubmission.runtimeMs} ms`);
  console.log('   QueuedAt:', completedSubmission.queuedAt);
  console.log('   StartedAt:', completedSubmission.startedAt);
  console.log('   CompletedAt:', completedSubmission.completedAt);

  if (completedSubmission.verdict !== 'ACCEPTED') {
    throw new Error(`Expected ACCEPTED verdict, got ${completedSubmission.verdict}`);
  }

  // 7. Submit incorrect solution to verify WRONG_ANSWER
  console.log('\n7. Submitting incorrect solution (to verify WRONG_ANSWER)...');
  const tWrong = Date.now();
  const wrongSubRes = await request('http://localhost:5000/api/v1/submissions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  }, {
    problemId: problem.id,
    language: 'CPP',
    sourceCode: `#include <iostream>
using namespace std;
int main() {
    cout << 99999 << endl;
    return 0;
}`
  });
  console.log(`   HTTP Status: ${wrongSubRes.status} (returned in ${Date.now() - tWrong}ms)`);
  const wrongSubId = wrongSubRes.data.data.submission.id;

  let completedWrongSub = null;
  const pollWrongStart = Date.now();
  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(800);
    const pollRes = await request(`http://localhost:5000/api/v1/submissions/${wrongSubId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sub = pollRes.data.data.submission;
    console.log(`   [Wrong Sub Attempt ${attempt} | +${Date.now() - pollWrongStart}ms] Status: ${sub.status} | Verdict: ${sub.verdict}`);
    if (sub.status === 'COMPLETED' || sub.status === 'FAILED') {
      completedWrongSub = sub;
      break;
    }
  }

  if (completedWrongSub.verdict !== 'WRONG_ANSWER') {
    throw new Error(`Expected WRONG_ANSWER verdict, got ${completedWrongSub.verdict}`);
  }

  // 8. Verify submission history (GET /api/v1/submissions/me)
  console.log('\n8. Verifying submission history (GET /api/v1/submissions/me)...');
  const historyRes = await request('http://localhost:5000/api/v1/submissions/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`   History HTTP Status: ${historyRes.status}`);
  const history = historyRes.data.data.submissions;
  console.log(`   Submissions returned in history: ${history.length}`);
  const hasAccepted = history.some((s) => s.id === submissionId && s.verdict === 'ACCEPTED');
  const hasWrong = history.some((s) => s.id === wrongSubId && s.verdict === 'WRONG_ANSWER');
  console.log('   Contains correct submission (ACCEPTED):', hasAccepted);
  console.log('   Contains incorrect submission (WRONG_ANSWER):', hasWrong);

  if (!hasAccepted || !hasWrong) {
    throw new Error('Submission history did not contain both evaluated submissions!');
  }

  console.log('\n====================================================');
  console.log('✓ ASYNC PIPELINE VERIFIED SUCCESSFULLY ON DOCKER COMPOSE!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
