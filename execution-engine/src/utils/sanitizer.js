/**
 * Path Sanitizer Utility
 * Strips internal host filesystem paths from compiler and runtime error outputs.
 */

/**
 * Sanitizes output by replacing absolute workspace paths with generic relative paths.
 *
 * @param {string} output - Raw stderr or stdout
 * @param {string} workspaceDir - The temporary workspace directory path to sanitize
 * @param {string} sourceFilename - The source filename (e.g., 'main.cpp')
 * @returns {string} Sanitized string
 */
function sanitizeOutput(output, workspaceDir, sourceFilename = 'main.cpp') {
  if (!output || typeof output !== 'string') {
    return '';
  }

  if (!workspaceDir) {
    return output;
  }

  // Escape special regex characters in the workspaceDir
  const escapedWorkspaceDir = workspaceDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Replace workspaceDir/sourceFilename with sourceFilename
  // Replace workspaceDir with '.'
  const fileRegex = new RegExp(`${escapedWorkspaceDir}[/\\\\]?`, 'g');
  return output.replace(fileRegex, '');
}

module.exports = {
  sanitizeOutput
};
