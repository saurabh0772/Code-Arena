/**
 * Output Evaluator Module
 * Normalizes harmless whitespace differences and compares program output with expected output.
 */

const { VERDICTS } = require('../config/constants');

/**
 * Normalizes output string for deterministic comparison.
 * - Converts CRLF to LF (\r\n -> \n)
 * - Removes trailing whitespace on each line
 * - Trims trailing whitespace/newlines from the end of the text
 *
 * @param {string} str - Raw output string
 * @returns {string} Normalized string
 */
function normalizeOutput(str) {
  if (typeof str !== 'string') {
    return '';
  }

  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * Compares actual program stdout against expected output.
 *
 * @param {string} actualOutput - Program stdout
 * @param {string} expectedOutput - Expected test case output
 * @returns {{ isMatch: boolean, verdict: string, normalizedActual: string, normalizedExpected: string }}
 */
function evaluateOutput(actualOutput, expectedOutput) {
  const normalizedActual = normalizeOutput(actualOutput);
  const normalizedExpected = normalizeOutput(expectedOutput);

  const isMatch = normalizedActual === normalizedExpected;

  return {
    isMatch,
    verdict: isMatch ? VERDICTS.ACCEPTED : VERDICTS.WRONG_ANSWER,
    normalizedActual,
    normalizedExpected
  };
}

module.exports = {
  normalizeOutput,
  evaluateOutput
};
