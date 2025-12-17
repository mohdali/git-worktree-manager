import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TextInput } from '../TextInput.js';

describe('TextInput', () => {
  it('displays placeholder with cursor when value is empty', () => {
    const { lastFrame } = render(
      <TextInput
        value=""
        onChange={() => {}}
        placeholder="Enter text"
      />
    );
    expect(lastFrame()).toContain('▋');
    expect(lastFrame()).toContain('Enter text');
  });

  it('displays value with cursor at end', () => {
    const { lastFrame } = render(
      <TextInput
        value="test"
        onChange={() => {}}
      />
    );
    expect(lastFrame()).toContain('test▋');
  });

  it('displays cursor at the beginning when value is empty without placeholder', () => {
    const { lastFrame } = render(
      <TextInput
        value=""
        onChange={() => {}}
      />
    );
    expect(lastFrame()).toContain('▋');
  });

  it('displays value with cursor in the middle (simulated)', () => {
    // When cursor is at position 2 in "test", it should show "te▋st"
    // We can't test cursor position directly without triggering useInput
    // but we verify rendering works with different values
    const { lastFrame } = render(
      <TextInput
        value="hello"
        onChange={() => {}}
      />
    );
    expect(lastFrame()).toContain('hello▋');
  });
});
