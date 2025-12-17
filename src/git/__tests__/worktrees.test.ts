import { describe, it, expect } from 'vitest';
import { parseWorktreeList } from '../worktrees.js';

describe('parseWorktreeList', () => {
  it('should parse standard worktree output with multiple worktrees', () => {
    const output = `worktree /home/user/project
HEAD abcd1234567890abcdef1234567890abcdef1234
branch refs/heads/main

worktree /home/user/.worktrees/feature_a1b2c3d4
HEAD efgh5678901234efgh5678901234efgh56789012
branch refs/heads/feature/auth-system`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: '/home/user/project',
      head: 'abcd1234567890abcdef1234567890abcdef1234',
      branch: 'main',
      isMainWorktree: true
    });
    expect(result[1]).toEqual({
      path: '/home/user/.worktrees/feature_a1b2c3d4',
      head: 'efgh5678901234efgh5678901234efgh56789012',
      branch: 'feature/auth-system',
      isMainWorktree: false
    });
  });

  it('should handle detached HEAD worktree', () => {
    const output = `worktree /home/user/project
HEAD abcd1234567890abcdef1234567890abcdef1234
branch refs/heads/main

worktree /home/user/.worktrees/detached_xyz
HEAD deadbeef1234567890deadbeef1234567890de
detached`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      path: '/home/user/.worktrees/detached_xyz',
      head: 'deadbeef1234567890deadbeef1234567890de',
      branch: null,
      isMainWorktree: false
    });
  });

  it('should handle empty worktree list', () => {
    const output = '';
    const result = parseWorktreeList(output);
    expect(result).toHaveLength(0);
  });

  it('should parse branch names with slashes', () => {
    const output = `worktree /home/user/project
HEAD abcd1234567890abcdef1234567890abcdef1234
branch refs/heads/feature/deep/nested/branch`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('feature/deep/nested/branch');
  });

  it('should handle single worktree', () => {
    const output = `worktree /home/user/project
HEAD abcd1234567890abcdef1234567890abcdef1234
branch refs/heads/main`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(1);
    expect(result[0].isMainWorktree).toBe(true);
  });

  it('should skip incomplete worktree blocks', () => {
    const output = `worktree /home/user/project

worktree /home/user/.worktrees/valid
HEAD efgh5678901234efgh5678901234efgh56789012
branch refs/heads/test`;

    const result = parseWorktreeList(output);

    // Should only include the valid one (first one is missing HEAD)
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/home/user/.worktrees/valid');
  });
});
