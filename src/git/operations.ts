import { runGit } from './runner.js';
import { GitError } from './types.js';

/**
 * Push branch to remote with upstream tracking
 * Executes: git push -u origin <branch>
 * Must be called from worktree directory
 *
 * @param branchName - Branch name to push
 * @param worktreePath - Path to worktree containing the branch
 * @throws GitError if push fails
 */
export async function pushBranch(
  branchName: string,
  worktreePath: string
): Promise<void> {
  const result = await runGit(
    ['push', '-u', 'origin', branchName],
    { cwd: worktreePath }
  );

  if (result.exitCode !== 0) {
    const error = new Error(`Failed to push branch: ${result.stderr}`) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = `git push -u origin ${branchName}`;
    throw error;
  }
}

/**
 * Validate branch name against git rules
 * Rejects: spaces, ~^:?*[]{}, .., starting/ending with /, @{
 *
 * @param name - Branch name to validate
 * @returns true if valid branch name
 */
export function isValidBranchName(name: string): boolean {
  if (!name || name.trim() !== name) {
    return false;
  }

  // Git branch name restrictions
  if (/[\s~\^:\\?\*\[\]@\{]|\.\.|\.$|^\.|@\{|^\/|\/$/.test(name)) {
    return false;
  }

  return true;
}
