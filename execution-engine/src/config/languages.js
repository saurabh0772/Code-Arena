/**
 * Trusted Language Configurations
 */

const { SUPPORTED_LANGUAGES } = require('./constants');
const { ValidationError } = require('../utils/errors');

const LANGUAGE_CONFIGS = Object.freeze({
  CPP: Object.freeze({
    identifier: 'CPP',
    sourceFilename: 'main.cpp',
    compiler: 'g++',
    compileArgs: Object.freeze(['-O2', '-std=c++17', 'main.cpp', '-o', 'main']),
    executableFilename: 'main',
    command: './main',
    args: Object.freeze([]),
    isCompiled: true
  }),
  PYTHON: Object.freeze({
    identifier: 'PYTHON',
    sourceFilename: 'main.py',
    executableFilename: 'main.py',
    command: 'python3',
    args: Object.freeze(['main.py']),
    isCompiled: false
  }),
  JAVASCRIPT: Object.freeze({
    identifier: 'JAVASCRIPT',
    sourceFilename: 'main.js',
    executableFilename: 'main.js',
    command: 'node',
    args: Object.freeze(['main.js']),
    isCompiled: false
  })
});

/**
 * Resolves and validates language configuration.
 * Prevents arbitrary user-controlled compiler commands or arguments.
 *
 * @param {string} language
 * @returns {object} Language configuration
 */
function resolveLanguage(language) {
  if (!language || typeof language !== 'string') {
    throw new ValidationError('Language is required and must be a string');
  }

  const normalizedLanguage = language.trim().toUpperCase();

  if (!SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
    throw new ValidationError(
      `Language '${language}' is not supported. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`
    );
  }

  const config = LANGUAGE_CONFIGS[normalizedLanguage];
  if (!config) {
    throw new ValidationError(`Configuration for language '${normalizedLanguage}' not found`);
  }

  return config;
}

module.exports = {
  LANGUAGE_CONFIGS,
  resolveLanguage
};
