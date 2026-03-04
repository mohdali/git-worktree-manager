// Re-export public API
export { listWorktrees, createWorktree, removeWorktree, deleteLocalBranch } from './worktrees.js';
export { getWorktreeStatus } from './status.js';
export { pushBranch, pullBranch, fetchRemote, isValidBranchName } from './operations.js';
export { getRepoRoot, isGitRepository } from './runner.js';
export type { Worktree, WorktreeStatus, GitError, GitResult } from './types.js';
