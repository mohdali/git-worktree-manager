#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { WorktreeList } from './components/WorktreeList.js';

const cli = meow(
  `
  Usage
    $ gwm [branch-name]

  Options
    --help     Show this help message

  Examples
    $ gwm                      Interactive worktree manager
    $ gwm feature/new-feature  Create new worktree
`,
  {
    importMeta: import.meta,
    flags: {},
  }
);

// Suppress unused variable warning - cli will be used in Task 4+
void cli;

function App() {
  return <WorktreeList />;
}

render(<App />);
