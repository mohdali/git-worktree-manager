/**
 * Result from executing a git command
 */
export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Represents a git worktree
 */
export interface Worktree {
  path: string;           // Absolute path to worktree
  branch: string | null;  // Branch name (null for detached HEAD)
  head: string;           // Commit hash
  isMainWorktree: boolean;
}

/**
 * Status information for a worktree
 */
export interface WorktreeStatus {
  // File counts from 'git status --porcelain'
  added: number;          // ^A pattern
  modified: number;       // ^M or ^ M pattern
  deleted: number;        // ^D or ^ D pattern
  untracked: number;      // ^\?\? pattern

  // Remote sync status
  remoteExists: boolean;  // From 'git show-ref'
  ahead: number;          // Commits ahead of remote
  behind: number;         // Commits behind remote
}

/**
 * Git operation error with context
 */
export interface GitError extends Error {
  exitCode: number;
  stderr: string;
  command: string;
}
