import { describe, it, expect } from 'vitest';
import { isValidBranchName } from '../operations.js';

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
