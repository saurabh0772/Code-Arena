/**
 * CodeArena Execution Engine Comprehensive Test Suite
 * Tests C++, Python, and JavaScript execution, stdin/stdout, output normalization,
 * verdicts (ACCEPTED, WRONG_ANSWER, COMPILATION_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, OUTPUT_LIMIT_EXCEEDED),
 * Docker sandbox isolation, security controls, and resource limits.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs/promises');
const os = require('os');
const { execSync } = require('child_process');

const {
  execute,
  validateExecutionRequest,
  VERDICTS,
  SUPPORTED_LANGUAGES,
  ValidationError,
  normalizeOutput,
  evaluateOutput
} = require('../src/index');

describe('CodeArena Execution Engine Comprehensive Test Suite', () => {

  // ==========================================
  // 1. VALIDATION & LANGUAGE SUPPORT
  // ==========================================
  describe('Request Validation & Language Resolution', () => {
    it('should include CPP, PYTHON, and JAVASCRIPT in SUPPORTED_LANGUAGES', () => {
      assert.deepStrictEqual(SUPPORTED_LANGUAGES, ['CPP', 'PYTHON', 'JAVASCRIPT']);
    });

    it('should accept valid C++ execution request', () => {
      const validReq = {
        language: 'CPP',
        sourceCode: '#include <iostream>\nint main() { return 0; }',
        testCase: { input: '5', expectedOutput: '25' }
      };
      assert.doesNotThrow(() => validateExecutionRequest(validReq));
    });

    it('should accept valid Python execution request', () => {
      const validReq = {
        language: 'PYTHON',
        sourceCode: 'print("hello")',
        testCase: { input: '', expectedOutput: 'hello' }
      };
      assert.doesNotThrow(() => validateExecutionRequest(validReq));
    });

    it('should accept valid JavaScript execution request', () => {
      const validReq = {
        language: 'JAVASCRIPT',
        sourceCode: 'console.log("hello")',
        testCase: { input: '', expectedOutput: 'hello' }
      };
      assert.doesNotThrow(() => validateExecutionRequest(validReq));
    });

    it('should reject non-object request', () => {
      assert.throws(() => validateExecutionRequest(null), ValidationError);
      assert.throws(() => validateExecutionRequest('string'), ValidationError);
    });

    it('should reject missing or non-string language', () => {
      assert.throws(
        () => validateExecutionRequest({ sourceCode: 'int main(){}', testCase: { expectedOutput: '1' } }),
        ValidationError
      );
    });

    it('should reject missing or empty sourceCode', () => {
      assert.throws(
        () => validateExecutionRequest({ language: 'CPP', sourceCode: '', testCase: { expectedOutput: '1' } }),
        ValidationError
      );
      assert.throws(
        () => validateExecutionRequest({ language: 'CPP', sourceCode: '   ', testCase: { expectedOutput: '1' } }),
        ValidationError
      );
    });

    it('should reject oversized source code (> 64KB)', () => {
      const bigCode = 'a'.repeat(65537);
      assert.throws(
        () => validateExecutionRequest({ language: 'CPP', sourceCode: bigCode, testCase: { expectedOutput: '1' } }),
        ValidationError
      );
    });

    it('should reject missing testCase or missing expectedOutput', () => {
      assert.throws(
        () => validateExecutionRequest({ language: 'CPP', sourceCode: 'int main(){}' }),
        ValidationError
      );
      assert.throws(
        () => validateExecutionRequest({ language: 'CPP', sourceCode: 'int main(){}', testCase: {} }),
        ValidationError
      );
    });

    it('should reject unknown languages', async () => {
      await assert.rejects(
        async () => {
          await execute({
            language: 'RUST',
            sourceCode: 'fn main() {}',
            testCase: { input: '', expectedOutput: '' }
          });
        },
        ValidationError
      );
    });
  });

  // ==========================================
  // 2. OUTPUT NORMALIZATION
  // ==========================================
  describe('Output Evaluator & Normalization', () => {
    it('should normalize CRLF line endings to LF', () => {
      const input = 'hello\r\nworld\r\n';
      const expected = 'hello\nworld';
      assert.strictEqual(normalizeOutput(input), expected);
    });

    it('should strip trailing line whitespace', () => {
      const input = 'line1   \nline2 \t \nline3';
      const expected = 'line1\nline2\nline3';
      assert.strictEqual(normalizeOutput(input), expected);
    });

    it('should strip trailing newlines at end of output', () => {
      const input = 'result\n\n\n';
      const expected = 'result';
      assert.strictEqual(normalizeOutput(input), expected);
    });

    it('should evaluate matching outputs as ACCEPTED', () => {
      const evalResult = evaluateOutput('42\r\n', '42\n\n');
      assert.strictEqual(evalResult.isMatch, true);
      assert.strictEqual(evalResult.verdict, VERDICTS.ACCEPTED);
    });

    it('should evaluate mismatched outputs as WRONG_ANSWER', () => {
      const evalResult = evaluateOutput('42\n', '43\n');
      assert.strictEqual(evalResult.isMatch, false);
      assert.strictEqual(evalResult.verdict, VERDICTS.WRONG_ANSWER);
    });
  });

  // ==========================================
  // 3. C++ EXECUTION
  // ==========================================
  describe('C++ Compilation & Sandbox Execution', () => {
    it('should compile and execute valid C++ program with stdin, returning ACCEPTED', async () => {
      const sourceCode = `
#include <iostream>
int main() {
    long long n;
    if (std::cin >> n) {
        std::cout << (n * n) << std::endl;
    }
    return 0;
}
      `.trim();

      const result = await execute({
        language: 'CPP',
        sourceCode,
        testCase: { input: '7\n', expectedOutput: '49\n' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), '49');
      assert.strictEqual(result.stderr, '');
      assert.strictEqual(typeof result.runtimeMs, 'number');
    });

    it('should return WRONG_ANSWER when C++ output does not match expected output', async () => {
      const sourceCode = `
#include <iostream>
int main() {
    int n;
    std::cin >> n;
    std::cout << (n + 1) << std::endl;
    return 0;
}
      `.trim();

      const result = await execute({
        language: 'CPP',
        sourceCode,
        testCase: { input: '10', expectedOutput: '100' }
      });

      assert.strictEqual(result.verdict, VERDICTS.WRONG_ANSWER);
      assert.strictEqual(result.stdout.trim(), '11');
    });

    it('should return COMPILATION_ERROR when C++ has syntax errors', async () => {
      const sourceCode = `
#include <iostream>
int main() {
    syntax_error_not_valid_code;
    return 0;
}
      `.trim();

      const result = await execute({
        language: 'CPP',
        sourceCode,
        testCase: { input: '', expectedOutput: '' }
      });

      assert.strictEqual(result.verdict, VERDICTS.COMPILATION_ERROR);
      assert.strictEqual(result.stdout, '');
      assert.strictEqual(result.runtimeMs, null);
      assert.match(result.stderr, /syntax_error_not_valid_code/);
    });

    it('should return RUNTIME_ERROR when C++ program exits with non-zero code', async () => {
      const sourceCode = `
#include <iostream>
int main() {
    std::cout << "Starting error..." << std::endl;
    return 42;
}
      `.trim();

      const result = await execute({
        language: 'CPP',
        sourceCode,
        testCase: { input: '', expectedOutput: 'Starting error...' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stdout, /Starting error.../);
    });
  });

  // ==========================================
  // 4. PYTHON EXECUTION
  // ==========================================
  describe('Python Sandbox Execution', () => {
    it('should execute valid Python program with stdin, returning ACCEPTED', async () => {
      const sourceCode = `
import sys
line = sys.stdin.read().split()
if line:
    print(int(line[0]) * int(line[1]))
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '6 7', expectedOutput: '42' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), '42');
    });

    it('should return WRONG_ANSWER when Python output does not match', async () => {
      const sourceCode = `
print("wrong")
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'correct' }
      });

      assert.strictEqual(result.verdict, VERDICTS.WRONG_ANSWER);
      assert.strictEqual(result.stdout.trim(), 'wrong');
    });

    it('should return RUNTIME_ERROR on unhandled Python exception', async () => {
      const sourceCode = `
x = 1 / 0
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: '' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stderr, /ZeroDivisionError/);
    });

    it('should return RUNTIME_ERROR on Python SyntaxError', async () => {
      const sourceCode = `
def broken_syntax(
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: '' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stderr, /SyntaxError/);
    });
  });

  // ==========================================
  // 5. JAVASCRIPT EXECUTION
  // ==========================================
  describe('JavaScript Sandbox Execution', () => {
    it('should execute valid JavaScript program with stdin, returning ACCEPTED', async () => {
      const sourceCode = `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
const [a, b] = input.split(/\\s+/).map(Number);
console.log(a + b);
      `.trim();

      const result = await execute({
        language: 'JAVASCRIPT',
        sourceCode,
        testCase: { input: '25 75', expectedOutput: '100' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), '100');
    });

    it('should return WRONG_ANSWER when JavaScript output does not match', async () => {
      const sourceCode = `
console.log(999);
      `.trim();

      const result = await execute({
        language: 'JAVASCRIPT',
        sourceCode,
        testCase: { input: '', expectedOutput: '1000' }
      });

      assert.strictEqual(result.verdict, VERDICTS.WRONG_ANSWER);
      assert.strictEqual(result.stdout.trim(), '999');
    });

    it('should return RUNTIME_ERROR on unhandled JavaScript exception', async () => {
      const sourceCode = `
throw new Error("Custom JS crash");
      `.trim();

      const result = await execute({
        language: 'JAVASCRIPT',
        sourceCode,
        testCase: { input: '', expectedOutput: '' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stderr, /Custom JS crash/);
    });

    it('should return RUNTIME_ERROR on JavaScript SyntaxError', async () => {
      const sourceCode = `
const x = ;
      `.trim();

      const result = await execute({
        language: 'JAVASCRIPT',
        sourceCode,
        testCase: { input: '', expectedOutput: '' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stderr, /SyntaxError/);
    });
  });

  // ==========================================
  // 6. TIMEOUT & RESOURCE LIMITS
  // ==========================================
  describe('Timeout, Memory & Output Resource Limits', () => {
    it('FIX #1: Infinite loop in C++ maps strictly to TIME_LIMIT_EXCEEDED (not RUNTIME_ERROR)', async () => {
      const sourceCode = `
#include <iostream>
int main() {
    while (true) {}
    return 0;
}
      `.trim();

      const result = await execute({
        language: 'CPP',
        sourceCode,
        testCase: { input: '', expectedOutput: '42' }
      });

      assert.strictEqual(result.verdict, VERDICTS.TIME_LIMIT_EXCEEDED);
      assert.notStrictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
    });

    it('Infinite loop in Python maps strictly to TIME_LIMIT_EXCEEDED', async () => {
      const sourceCode = `
while True:
    pass
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'done' }
      });

      assert.strictEqual(result.verdict, VERDICTS.TIME_LIMIT_EXCEEDED);
      assert.notStrictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
    });

    it('Repeated memory allocation maps to MEMORY_LIMIT_EXCEEDED', async () => {
      const sourceCode = `
# Allocate 500MB when sandbox limit is 256MB
data = bytearray(500 * 1024 * 1024)
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'ok' }
      });

      assert.strictEqual(result.verdict, VERDICTS.MEMORY_LIMIT_EXCEEDED);
    });

    it('Excessive output triggers active termination and maps to OUTPUT_LIMIT_EXCEEDED', async () => {
      const sourceCode = `
while True:
    print("X" * 10000)
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'ok' }
      });

      assert.strictEqual(result.verdict, VERDICTS.OUTPUT_LIMIT_EXCEEDED);
      // Ensure captured output does not exceed buffer ceiling
      assert.strictEqual(result.stdout.length <= 512 * 1024, true);
    });
  });

  // ==========================================
  // 7. SANDBOX SECURITY BOUNDARIES
  // ==========================================
  describe('Sandbox Security Controls & Host Isolation', () => {
    it('Network isolation: outbound connection attempt is blocked', async () => {
      const sourceCode = `
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1.0)
try:
    s.connect(("8.8.8.8", 53))
    print("NETWORK_CONNECTED")
except Exception as e:
    print("NETWORK_BLOCKED")
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'NETWORK_BLOCKED' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), 'NETWORK_BLOCKED');
    });

    it('Docker socket isolation: /var/run/docker.sock does not exist inside sandbox', async () => {
      const sourceCode = `
import os
exists = os.path.exists("/var/run/docker.sock")
print("SOCKET_EXISTS" if exists else "SOCKET_BLOCKED")
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'SOCKET_BLOCKED' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), 'SOCKET_BLOCKED');
    });

    it('Secret isolation: host environment secrets are not leaked into sandbox', async () => {
      const sourceCode = `
import os
leaks = []
for secret in ["MONGODB_URI", "JWT_SECRET", "AWS_ACCESS_KEY_ID"]:
    if secret in os.environ:
        leaks.append(secret)
print(",".join(leaks) if leaks else "NO_SECRETS_LEAKED")
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'NO_SECRETS_LEAKED' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), 'NO_SECRETS_LEAKED');
    });

    it('Non-root execution: sandbox executes under non-root UID 1000', async () => {
      const sourceCode = `
import os
print(os.getuid())
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: '1000' }
      });

      assert.strictEqual(result.verdict, VERDICTS.ACCEPTED);
      assert.strictEqual(result.stdout.trim(), '1000');
    });

    it('PID / fork bomb limit: process explosion is contained', async () => {
      const sourceCode = `
import os
while True:
    os.fork()
      `.trim();

      const result = await execute({
        language: 'PYTHON',
        sourceCode,
        testCase: { input: '', expectedOutput: 'never' }
      });

      assert.strictEqual(result.verdict, VERDICTS.RUNTIME_ERROR);
      assert.match(result.stderr, /Resource temporarily unavailable|BlockingIOError/);
    });

    it('Guaranteed cleanup: zero lingering sandbox containers remain', async () => {
      const output = execSync('docker ps -a --filter "name=codearena-sbx-" --format "{{.Names}}"').toString().trim();
      assert.strictEqual(output, '', 'No abandoned sandbox containers should remain');
    });
  });
});
