import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupWorktreeEnv } from '../env.js';
import { copyFile, access } from 'fs/promises';

vi.mock('fs/promises', () => ({
  copyFile: vi.fn(),
  access: vi.fn(),
}));

const mockAccess = vi.mocked(access);
const mockCopyFile = vi.mocked(copyFile);

describe('setupWorktreeEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should copy .env from cwd when worktree has no .env', async () => {
    // First access call: target .env does not exist
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
    // Second access call: source .env exists
    mockAccess.mockResolvedValueOnce(undefined);

    await setupWorktreeEnv('/worktrees/feature-auth');

    expect(mockCopyFile).toHaveBeenCalledOnce();
  });

  it('should not overwrite existing .env in worktree', async () => {
    // Target .env exists
    mockAccess.mockResolvedValueOnce(undefined);

    await setupWorktreeEnv('/worktrees/feature-auth');

    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it('should do nothing when no source .env exists', async () => {
    // Target .env does not exist
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
    // Source .env does not exist either
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

    await setupWorktreeEnv('/worktrees/feature-auth');

    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it('should not throw on copy failure', async () => {
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
    mockAccess.mockResolvedValueOnce(undefined);
    mockCopyFile.mockRejectedValueOnce(new Error('Permission denied'));

    // Should not throw
    await expect(setupWorktreeEnv('/worktrees/feature-auth')).resolves.toBeUndefined();
  });
});
