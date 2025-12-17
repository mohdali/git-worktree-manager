import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ConfirmDialog } from '../ConfirmDialog.js';

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete Worktree"
        message="Delete feature/test?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const output = lastFrame()!;
    expect(output).toContain('Delete Worktree');
    expect(output).toContain('Delete feature/test?');
  });

  it('shows warning when provided', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete Worktree"
        message="Delete feature/test?"
        warning="This worktree has uncommitted changes"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const output = lastFrame()!;
    expect(output).toContain('⚠️  Warning:');
    expect(output).toContain('uncommitted');
  });

  it('displays keyboard hints', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete Worktree"
        message="Delete feature/test?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const output = lastFrame()!;
    expect(output).toContain('[y] Yes');
    expect(output).toContain('[n/Esc] No');
  });

  it('handles multiline messages', () => {
    const { lastFrame } = render(
      <ConfirmDialog
        title="Delete Worktree"
        message="Delete feature/test?\nPath: /path/to/worktree"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const output = lastFrame()!;
    expect(output).toContain('Delete feature/test?');
    expect(output).toContain('/path/to/worktree');
  });
});
