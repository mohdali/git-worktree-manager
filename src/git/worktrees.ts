import { randomBytes } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { mkdir } from 'fs/promises';
import { runGit } from './runner.js';
import { Worktree, GitError } from './types.js';
import { setupWorktreeEnv } from './env.js';

/**
 * List all worktrees in repository
 * Parses 'git worktree list --porcelain' format
 * @returns Array of worktrees
 * @throws GitError if git command fails
 */
export async function listWorktrees(): Promise<Worktree[]> {
  const result = await runGit(['worktree', 'list', '--porcelain']);

  if (result.exitCode !== 0) {
    const error = new Error('Failed to list worktrees') as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = 'git worktree list --porcelain';
    throw error;
  }

  return parseWorktreeList(result.stdout);
}

/**
 * Parse output from 'git worktree list --porcelain'
 * @param output - Raw porcelain output
 * @returns Array of parsed worktrees
 */
export function parseWorktreeList(output: string): Worktree[] {
  if (!output.trim()) {
    return [];
  }

  const blocks = output.split('\n\n').filter(b => b.trim());
  const worktrees: Worktree[] = [];

  for (const [index, block] of blocks.entries()) {
    const lines = block.split('\n');
    const worktree: Partial<Worktree> = {
      isMainWorktree: index === 0,
      branch: null
    };

    for (const line of lines) {
      const worktreeMatch = line.match(/^worktree (.+)$/);
      if (worktreeMatch) {
        worktree.path = worktreeMatch[1];
        continue;
      }

      const headMatch = line.match(/^HEAD (.+)$/);
      if (headMatch) {
        worktree.head = headMatch[1];
        continue;
      }

      const branchMatch = line.match(/^branch refs\/heads\/(.+)$/);
      if (branchMatch) {
        worktree.branch = branchMatch[1];
        continue;
      }

      if (line === 'detached') {
        worktree.branch = null;
      }
    }

    // Validate required fields
    if (worktree.path && worktree.head !== undefined) {
      worktrees.push(worktree as Worktree);
    }
  }

  return worktrees;
}

/**
 * Generate a folder name for a new worktree
 * @param branchName - Branch name to generate folder from
 * @returns Folder name with random suffix
 */
function generateFolderName(branchName: string): string {
  // Extract last segment of branch name (e.g., feature/auth-system -> auth-system)
  const lastSegment = branchName.split('/').pop() || branchName;

  // Convert to kebab-case: replace non-alphanumeric with dash
  const kebabCase = lastSegment
    .replace(/[^a-zA-Z0-9\-_]/g, '-')
    .replace(/--+/g, '-')  // Collapse multiple dashes
    .replace(/^-+|-+$/g, '');  // Trim dashes

  // Generate random 8-char hex suffix
  const hash = randomBytes(4).toString('hex');

  return `${kebabCase}_${hash}`;
}

/**
 * Create new worktree with branch
 * @param branchName - New branch name (validates before creation)
 * @param basePath - Parent directory for worktree (defaults to ~/.worktrees)
 * @returns Path to created worktree
 * @throws GitError if branch exists or creation fails
 */
export async function createWorktree(
  branchName: string,
  basePath?: string
): Promise<string> {
  // Validate branch name
  if (!isValidBranchName(branchName)) {
    const error = new Error(`Invalid branch name: ${branchName}`) as GitError;
    error.exitCode = -1;
    error.stderr = 'Branch name contains invalid characters';
    error.command = 'git worktree add';
    throw error;
  }

  // Generate folder name and path
  const folderName = generateFolderName(branchName);
  const worktreesBase = basePath || join(homedir(), '.worktrees');
  const worktreePath = join(worktreesBase, folderName);

  // Ensure base directory exists (like PS script)
  await mkdir(worktreesBase, { recursive: true });

  // Create worktree with branch in single operation
  const result = await runGit([
    'worktree',
    'add',
    '-b',
    branchName,
    worktreePath
  ]);

  if (result.exitCode !== 0) {
    const error = new Error(`Failed to create worktree: ${result.stderr}`) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = `git worktree add -b ${branchName} ${worktreePath}`;
    throw error;
  }

  // Setup .env file for docker-compose isolation
  await setupWorktreeEnv(worktreePath, folderName);

  return worktreePath;
}

/**
 * Remove worktree and optionally clean up branch
 * @param path - Absolute path to worktree
 * @param force - Use --force flag
 * @throws GitError if removal fails
 */
export async function removeWorktree(
  path: string,
  force: boolean = false
): Promise<void> {
  const args = ['worktree', 'remove'];
  if (force) {
    args.push('--force');
  }
  args.push(path);

  const result = await runGit(args);

  if (result.exitCode !== 0) {
    const error = new Error(`Failed to remove worktree: ${result.stderr}`) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = `git ${args.join(' ')}`;
    throw error;
  }
}

/**
 * Delete local branch
 * @param branchName - Branch name to delete
 * @param force - Use -D instead of -d
 * @throws GitError if deletion fails
 */
export async function deleteLocalBranch(
  branchName: string,
  force: boolean = false
): Promise<void> {
  const args = ['branch', force ? '-D' : '-d', branchName];
  const result = await runGit(args);

  if (result.exitCode !== 0) {
    const error = new Error(`Failed to delete branch: ${result.stderr}`) as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = `git ${args.join(' ')}`;
    throw error;
  }
}

/**
 * Validate branch name against git rules
 * Rejects: spaces, ~^:?*[]{}, .., starting/ending with /, @{
 * @param name - Branch name to validate
 * @returns true if valid
 */
function isValidBranchName(name: string): boolean {
  if (!name || name.trim() !== name) {
    return false;
  }

  // Git branch name restrictions
  if (/[\s~\^:\\?\*\[\]@\{]|\.\.|\.$|^\.|@\{|^\/|\/$/.test(name)) {
    return false;
  }

  return true;
}
