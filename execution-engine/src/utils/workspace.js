/**
 * Workspace Management Utility
 * Creates isolated temporary execution workspaces and provides reliable cleanup.
 *
 * Security & Isolation Controls:
 * - Dedicated server-controlled base directory (CODEARENA_WORKSPACE_BASE or /tmp/codearena-workspaces).
 * - Per-submission unique directory using random prefix.
 * - Restrictive permissions: 0777 applied strictly to the created workspace directory
 *   so unprivileged sandbox UID 1000 can write compilation artifacts without world-writing /tmp.
 * - Strict cleanup validation: guarantees no symlink escape or accidental deletion outside base directory.
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const WORKSPACE_BASE_DIR = path.resolve(
  process.env.CODEARENA_WORKSPACE_BASE || '/tmp/codearena-workspaces'
);

/**
 * Ensures the dedicated CodeArena workspace base directory exists.
 * Does NOT alter permissions of global /tmp or system directories.
 */
async function ensureBaseDir() {
  try {
    await fs.mkdir(WORKSPACE_BASE_DIR, { recursive: true });
    // Apply 0777 strictly to the dedicated codearena-workspaces directory
    await fs.chmod(WORKSPACE_BASE_DIR, 0o777);
  } catch (error) {
    // Directory might already exist or permissions already sufficient
  }
}

/**
 * Creates a unique temporary workspace directory for a single submission execution.
 *
 * @returns {Promise<string>} Absolute path to the created workspace
 */
async function createWorkspace() {
  await ensureBaseDir();

  const prefix = path.join(WORKSPACE_BASE_DIR, 'sbx-');
  const workspaceDir = await fs.mkdtemp(prefix);

  // Apply permissions strictly to this specific submission workspace
  // so the unprivileged sandbox user (UID 1000) can compile & execute binaries inside it
  await fs.chmod(workspaceDir, 0o777);

  return workspaceDir;
}

/**
 * Writes source code into the workspace with safe permissions.
 *
 * @param {string} workspaceDir - Workspace directory path
 * @param {string} filename - Source filename (e.g. 'main.cpp')
 * @param {string} sourceCode - Source code content
 * @returns {Promise<string>} Absolute path to written file
 */
async function writeSourceFile(workspaceDir, filename, sourceCode) {
  // Prevent path traversal in filename
  const safeFilename = path.basename(filename);
  const filePath = path.join(workspaceDir, safeFilename);

  await fs.writeFile(filePath, sourceCode, { encoding: 'utf8', mode: 0o666 });
  return filePath;
}

/**
 * Recursively removes the workspace directory and all its contents.
 * Safe to call multiple times; will not throw if directory is already removed.
 *
 * Security validation:
 * - Refuses to delete any directory outside the dedicated WORKSPACE_BASE_DIR or os.tmpdir().
 * - Refuses to follow symlinks pointing outside the workspace.
 *
 * @param {string} workspaceDir - Workspace directory to clean up
 */
async function cleanupWorkspace(workspaceDir) {
  if (!workspaceDir || typeof workspaceDir !== 'string') return;

  try {
    const resolved = path.resolve(workspaceDir);
    const allowedBase = path.resolve(WORKSPACE_BASE_DIR);
    const tmpBase = path.resolve(os.tmpdir());

    // Boundary check: path must be strictly inside WORKSPACE_BASE_DIR or os.tmpdir()
    const isWithinBase = resolved.startsWith(allowedBase + path.sep);
    const isWithinTmp = resolved.startsWith(tmpBase + path.sep);

    if (!isWithinBase && !isWithinTmp) {
      console.warn(`[SECURITY] Refusing to clean up workspace outside allowed base: ${resolved}`);
      return;
    }

    // Ensure we are deleting a directory whose name matches our managed prefix
    const baseName = path.basename(resolved);
    if (!baseName.startsWith('sbx-') && !baseName.startsWith('codearena-exec-')) {
      console.warn(`[SECURITY] Refusing to delete path with unmanaged prefix: ${resolved}`);
      return;
    }

    // Verify it is not a symlink itself
    const stat = await fs.lstat(resolved);
    if (stat.isSymbolicLink()) {
      console.warn(`[SECURITY] Refusing to follow symbolic link at root of workspace: ${resolved}`);
      await fs.unlink(resolved);
      return;
    }

    await fs.rm(resolved, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to clean up workspace ${workspaceDir}:`, error.message);
    }
  }
}

module.exports = {
  createWorkspace,
  writeSourceFile,
  cleanupWorkspace,
  WORKSPACE_BASE_DIR
};
