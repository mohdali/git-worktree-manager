import { runGit } from './runner.js';
import { WorktreeStatus, GitError } from './types.js';

/**
 * Get detailed status for a worktree
 * Runs multiple git commands from worktree directory:
 *   1. git status --porcelain (file changes)
 *   2. git rev-parse --abbrev-ref HEAD (branch name)
 *   3. git show-ref refs/remotes/origin/{branch} (remote check)
 *   4. git rev-list --count --left-right origin/{branch}...HEAD (ahead/behind)
 *
 * @param worktreePath - Absolute path to worktree
 * @returns WorktreeStatus with file counts and sync status
 * @throws GitError if worktree path is invalid
 */
export async function getWorktreeStatus(
  worktreePath: string
): Promise<WorktreeStatus> {
  const status: WorktreeStatus = {
    added: 0,
    modified: 0,
    deleted: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    remoteExists: false
  };

  // 1. Get file changes from git status --porcelain
  const statusResult = await runGit(['status', '--porcelain'], { cwd: worktreePath });

  if (statusResult.exitCode !== 0) {
    const error = new Error(`Failed to get status: ${statusResult.stderr}`) as GitError;
    error.exitCode = statusResult.exitCode;
    error.stderr = statusResult.stderr;
    error.command = 'git status --porcelain';
    throw error;
  }

  // Parse file changes
  const statusLines = statusResult.stdout;
  status.added = (statusLines.match(/^A /gm) || []).length;
  status.modified = (statusLines.match(/^(M | M)/gm) || []).length;
  status.deleted = (statusLines.match(/^(D | D)/gm) || []).length;
  status.untracked = (statusLines.match(/^\?\?/gm) || []).length;

  // 2. Get current branch name
  const branchResult = await runGit(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    { cwd: worktreePath }
  );

  if (branchResult.exitCode !== 0) {
    // If we can't get branch, skip remote checks
    return status;
  }

  const branchName = branchResult.stdout;

  // If detached HEAD, skip remote checks
  if (branchName === 'HEAD') {
    return status;
  }

  // 3. Check if remote branch exists
  const remoteCheckResult = await runGit(
    ['show-ref', `refs/remotes/origin/${branchName}`],
    { cwd: worktreePath }
  );

  status.remoteExists = remoteCheckResult.exitCode === 0;

  if (!status.remoteExists) {
    return status;
  }

  // 4. Get ahead/behind counts
  const revListResult = await runGit(
    ['rev-list', '--count', '--left-right', `origin/${branchName}...HEAD`],
    { cwd: worktreePath }
  );

  if (revListResult.exitCode === 0) {
    const parts = revListResult.stdout.split('\t');
    if (parts.length === 2) {
      status.behind = parseInt(parts[0], 10) || 0;
      status.ahead = parseInt(parts[1], 10) || 0;
    }
  }

  return status;
}
