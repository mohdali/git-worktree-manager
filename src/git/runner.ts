import { spawn } from 'child_process';
import { GitResult, GitError } from './types.js';

/**
 * Execute git command with proper error handling
 * @param args - Git command arguments (e.g., ['worktree', 'list'])
 * @param options - Execution options
 * @returns Promise with stdout, stderr, exitCode
 */
export async function runGit(
  args: string[],
  options: { cwd?: string } = {}
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd: options.cwd,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        const gitError = new Error('Git not installed or not found in PATH') as GitError;
        gitError.exitCode = -1;
        gitError.stderr = '';
        gitError.command = `git ${args.join(' ')}`;
        reject(gitError);
      } else {
        reject(err);
      }
    });

    proc.on('close', (exitCode: number | null) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode ?? -1
      });
    });
  });
}

/**
 * Find git repository root from current or specified directory
 * @param cwd - Directory to start search (defaults to process.cwd())
 * @returns Absolute path to repo root
 * @throws GitError if not in a git repository
 */
export async function getRepoRoot(cwd?: string): Promise<string> {
  const result = await runGit(['rev-parse', '--show-toplevel'], { cwd });

  if (result.exitCode !== 0) {
    const error = new Error('Not in a git repository') as GitError;
    error.exitCode = result.exitCode;
    error.stderr = result.stderr;
    error.command = 'git rev-parse --show-toplevel';
    throw error;
  }

  return result.stdout;
}

/**
 * Check if current directory is in a git repository
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns true if in a git repository
 */
export async function isGitRepository(cwd?: string): Promise<boolean> {
  const result = await runGit(['rev-parse', '--git-dir'], { cwd });
  return result.exitCode === 0;
}
