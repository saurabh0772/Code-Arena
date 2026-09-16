/**
 * Workspace Management Utility
 * Creates isolated temporary execution workspaces and provides reliable cleanup.
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

/**
 * Creates a unique temporary workspace directory for an execution.
 *
 * @returns {Promise<string>} Absolute path to the created workspace
 */
async function createWorkspace() {
  const basePrefix = path.join(os.tmpdir(), 'codearena-exec-');
  const workspaceDir = await fs.mkdtemp(basePrefix);
  return workspaceDir;
}

/**
 * Writes source code into the workspace.
 *
 * @param {string} workspaceDir - Workspace directory path
 * @param {string} filename - Source filename (e.g. 'main.cpp')
 * @param {string} sourceCode - Source code content
 */
async function writeSourceFile(workspaceDir, filename, sourceCode) {
  const filePath = path.join(workspaceDir, filename);
  await fs.writeFile(filePath, sourceCode, 'utf8');
  return filePath;
}

/**
 * Recursively removes the workspace directory and all its contents.
 * Safe to call multiple times; will not throw if directory is already removed.
 *
 * @param {string} workspaceDir - Workspace directory to clean up
 */
async function cleanupWorkspace(workspaceDir) {
  if (!workspaceDir) return;
  try {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  } catch (error) {
    // Avoid crashing on cleanup failure; log warning if needed
    console.warn(`Failed to clean up workspace ${workspaceDir}:`, error.message);
  }
}

module.exports = {
  createWorkspace,
  writeSourceFile,
  cleanupWorkspace
};
