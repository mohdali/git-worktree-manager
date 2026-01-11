#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { dirname } from 'path';
import { WorktreeList } from './components/WorktreeList.js';
import { loadConfig, resolveWorktreesDir } from './config.js';

const cli = meow(
  `
  Usage
    $ gwm [branch-name]

  Options
    --worktrees-dir, -w  Base directory for new worktrees
    --help               Show this help message

  Examples
    $ gwm                      Interactive worktree manager
    $ gwm feature/new-feature  Create new worktree
    $ gwm -w D:\\worktrees     Use a custom worktrees directory
`,
  {
    importMeta: import.meta,
    flags: {
      worktreesDir: {
        type: 'string',
        shortFlag: 'w'
      }
    },
  }
);

// Get branch name from CLI args if provided
const initialBranchName = cli.input[0] || null;
const configResult = loadConfig();
const configBaseDir = configResult.source ? dirname(configResult.source) : process.cwd();
const configWorktreesDir = configResult.config.worktreesDir
  ? resolveWorktreesDir(configResult.config.worktreesDir, configBaseDir)
  : undefined;
const cliWorktreesDir = cli.flags.worktreesDir
  ? resolveWorktreesDir(cli.flags.worktreesDir, process.cwd())
  : undefined;
const worktreesDir = cliWorktreesDir ?? configWorktreesDir;
const configError = configResult.error ?? null;

function App() {
  return (
    <WorktreeList
      initialBranchName={initialBranchName}
      worktreesDir={worktreesDir}
      configError={configError}
    />
  );
}

render(<App />);
