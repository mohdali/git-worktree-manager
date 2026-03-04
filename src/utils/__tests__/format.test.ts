import { describe, it, expect } from 'vitest';
import { formatPath, formatStatusIndicators } from '../format.js';
import { WorktreeStatus } from '../../git/types.js';

// Helper: zero-value status object
const emptyStatus: WorktreeStatus = {
  added: 0, modified: 0, deleted: 0, untracked: 0,
  remoteExists: true, ahead: 0, behind: 0,
};

describe('formatPath', () => {
  it('extracts basename from absolute path', () => {
    expect(formatPath('/Users/dev/.worktrees/feature_abc')).toBe('feature_abc');
  });

  it('handles Windows-style path', () => {
    // On Windows, path.basename splits on backslash; on POSIX it does not.
    const expected = process.platform === 'win32' ? 'my-branch' : 'C:\\worktrees\\my-branch';
    expect(formatPath('C:\\worktrees\\my-branch')).toBe(expected);
  });
});

describe('formatStatusIndicators', () => {
  it('returns empty string when all counts are zero and remote exists', () => {
    expect(formatStatusIndicators(emptyStatus)).toBe('');
  });

  it('renders behind indicator', () => {
    expect(formatStatusIndicators({ ...emptyStatus, behind: 3 })).toBe('[-3]');
  });

  it('renders ahead indicator', () => {
    expect(formatStatusIndicators({ ...emptyStatus, ahead: 2 })).toBe('[+2]');
  });

  it('renders [local] when remoteExists is false', () => {
    expect(formatStatusIndicators({ ...emptyStatus, remoteExists: false })).toBe('[local]');
  });

  it('renders [local] instead of ahead/behind when no remote', () => {
    expect(
      formatStatusIndicators({ ...emptyStatus, remoteExists: false, ahead: 5, behind: 2 })
    ).toBe('[local]');
  });

  it('renders file change indicators', () => {
    const result = formatStatusIndicators({ ...emptyStatus, modified: 2, untracked: 1 });
    expect(result).toBe('[M:2] [?:1]');
  });

  it('renders combined file and sync indicators', () => {
    const result = formatStatusIndicators({ ...emptyStatus, modified: 1, behind: 4 });
    expect(result).toBe('[M:1] [-4]');
  });
});
