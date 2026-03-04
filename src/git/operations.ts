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
 * Pull branch from remote using fast-forward only
 * Executes: git pull --ff-only origin <branch>
 * Must be called from worktree directory
 *
 * @param branchName - Branch name to pull
 * @param worktreePath - Path to worktree containing the branch
 * @throws GitError if pull fails
 */
export async function pullBranch(
  branchName: string,
  worktreePath: string
): Promise<void> {
  const result = await runGit(
    ['pull', '--ff-only', 'origin', branchName],
    { cwd: worktreePath }
  );

  if (result.exitCode !== 0) {
    let message: string;
    if (result.stderr.includes('Not possible to fast-forward')) {
      message = 'Branch has diverged, cannot fast-forward';
    } else if (
      result.stderr.includes("couldn't find remote ref") ||
      (result.stderr.includes('Remote branch') && result.stderr.includes('not found'))
    ) {
      message = 'Remote branch not found';
    } else if (result.stderr.includes('Could not resolve host')) {
      message = 'Network error: could not reach remote';
    } else if (result.stderr.includes('Authentication failed')) {
      message = 'Authentication failed for remote';
    } else {
      message = `Failed to pull branch: ${result.stderr}`;
    }

    const error = new Error(message) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = `git pull --ff-only origin ${branchName}`;
    throw error;
  }
}

/**
 * Fetch from remote with pruning
 * Executes: git fetch --prune origin
 *
 * @param repoPath - Path to the repository root
 * @throws GitError if fetch fails
 */
export async function fetchRemote(repoPath: string): Promise<void> {
  const result = await runGit(
    ['fetch', '--prune', 'origin'],
    { cwd: repoPath }
  );

  if (result.exitCode !== 0) {
    const error = new Error(`Failed to fetch from remote: ${result.stderr}`) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = 'git fetch --prune origin';
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
