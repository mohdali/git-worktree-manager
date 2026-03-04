import { describe, it, expect, vi } from 'vitest';
import { isValidBranchName } from '../operations.js';

// Mock runGit to avoid real git calls
vi.mock('../runner.js', () => ({
  runGit: vi.fn(),
}));

import { pullBranch, fetchRemote } from '../operations.js';
import { runGit } from '../runner.js';

const mockedRunGit = vi.mocked(runGit);

describe('isValidBranchName', () => {
  it('should accept valid branch names', () => {
    expect(isValidBranchName('feature/test')).toBe(true);
    expect(isValidBranchName('fix-bug')).toBe(true);
    expect(isValidBranchName('my_branch')).toBe(true);
    expect(isValidBranchName('feature/deep/nested')).toBe(true);
    expect(isValidBranchName('release-1.0')).toBe(true);
    expect(isValidBranchName('main')).toBe(true);
  });

  it('should reject branch names with spaces', () => {
    expect(isValidBranchName('feature test')).toBe(false);
    expect(isValidBranchName('my branch')).toBe(false);
    expect(isValidBranchName(' feature')).toBe(false);
    expect(isValidBranchName('feature ')).toBe(false);
  });

  it('should reject branch names with invalid characters', () => {
    expect(isValidBranchName('feature~test')).toBe(false);
    expect(isValidBranchName('feature^test')).toBe(false);
    expect(isValidBranchName('feature:test')).toBe(false);
    expect(isValidBranchName('feature?test')).toBe(false);
    expect(isValidBranchName('feature*test')).toBe(false);
    expect(isValidBranchName('feature[test]')).toBe(false);
    expect(isValidBranchName('feature{test}')).toBe(false);
    expect(isValidBranchName('feature@{test}')).toBe(false);
  });

  it('should reject branch names with double dots', () => {
    expect(isValidBranchName('feature..test')).toBe(false);
    expect(isValidBranchName('..feature')).toBe(false);
  });

  it('should reject branch names starting or ending with slash', () => {
    expect(isValidBranchName('/feature')).toBe(false);
    expect(isValidBranchName('feature/')).toBe(false);
  });

  it('should reject branch names starting or ending with dot', () => {
    expect(isValidBranchName('.feature')).toBe(false);
    expect(isValidBranchName('feature.')).toBe(false);
  });

  it('should reject empty or whitespace-only names', () => {
    expect(isValidBranchName('')).toBe(false);
    expect(isValidBranchName('   ')).toBe(false);
  });
});

describe('pullBranch', () => {
  it('succeeds on zero exit code', async () => {
    mockedRunGit.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    await expect(pullBranch('main', '/repo')).resolves.toBeUndefined();
    expect(mockedRunGit).toHaveBeenCalledWith(
      ['pull', '--ff-only', 'origin', 'main'],
      { cwd: '/repo' }
    );
  });

  it('throws diverged error when fast-forward not possible', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'fatal: Not possible to fast-forward, aborting.', exitCode: 1
    });
    await expect(pullBranch('main', '/repo')).rejects.toThrow('Branch has diverged');
  });

  it('throws remote ref error when branch not found on remote', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: "fatal: couldn't find remote ref my-branch", exitCode: 1
    });
    await expect(pullBranch('my-branch', '/repo')).rejects.toThrow('Remote branch not found');
  });

  it('throws remote ref error when Remote branch not found', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'fatal: Remote branch my-branch not found in upstream origin', exitCode: 1
    });
    await expect(pullBranch('my-branch', '/repo')).rejects.toThrow('Remote branch not found');
  });

  it('throws network error when host unreachable', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'fatal: Could not resolve host: github.com', exitCode: 128
    });
    await expect(pullBranch('main', '/repo')).rejects.toThrow('Network error');
  });

  it('throws auth error on authentication failure', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'fatal: Authentication failed for remote', exitCode: 128
    });
    await expect(pullBranch('main', '/repo')).rejects.toThrow('Authentication failed');
  });

  it('throws fallback error for unknown failures', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'something unexpected', exitCode: 1
    });
    await expect(pullBranch('main', '/repo')).rejects.toThrow('Failed to pull branch');
  });
});

describe('fetchRemote', () => {
  it('succeeds on zero exit code', async () => {
    mockedRunGit.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    await expect(fetchRemote('/repo')).resolves.toBeUndefined();
    expect(mockedRunGit).toHaveBeenCalledWith(
      ['fetch', '--prune', 'origin'],
      { cwd: '/repo' }
    );
  });

  it('throws on non-zero exit code', async () => {
    mockedRunGit.mockResolvedValueOnce({
      stdout: '', stderr: 'fatal: remote error', exitCode: 1
    });
    await expect(fetchRemote('/repo')).rejects.toThrow('Failed to fetch from remote');
  });
});
