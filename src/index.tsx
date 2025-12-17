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

// Get branch name from CLI args if provided
const initialBranchName = cli.input[0] || null;

function App() {
  return <WorktreeList initialBranchName={initialBranchName} />;
}

render(<App />);
