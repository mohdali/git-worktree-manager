import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { CreateWorktreeModal } from '../CreateWorktreeModal.js';

describe('CreateWorktreeModal', () => {
  it('renders modal with title and help footer', () => {
    const { lastFrame } = render(
      <CreateWorktreeModal onClose={() => {}} />
    );

    const output = lastFrame()!;
    expect(output).toContain('Create Worktree');
    expect(output).toContain('Branch name:');
    expect(output).toContain('[Enter] Create');
    expect(output).toContain('[Esc] Cancel');
  });

  it('displays placeholder text when input is empty', () => {
    const { lastFrame } = render(
      <CreateWorktreeModal onClose={() => {}} />
    );

    const output = lastFrame()!;
    expect(output).toContain('feature/new-branch');
  });

  it('displays cursor in input field', () => {
    const { lastFrame } = render(
      <CreateWorktreeModal onClose={() => {}} />
    );

    const output = lastFrame()!;
    expect(output).toContain('▋');
  });
});
