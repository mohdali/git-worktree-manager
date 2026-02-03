# Git Worktree Manager

Cross-platform TUI for managing git worktrees with interactive navigation.

## Prerequisites

- Node.js 18+ (includes npm)
- Git

## Install

### Option 1: npm (after publishing)

```powershell
npm install -g git-worktree-manager
```

### Option 2: Local repo (recommended for development)

From the repo root:

```powershell
npm install
npm run build
npm link
```

To run without installing globally:

```powershell
npm run dev
```

## Usage

```powershell
gwm [branch-name] [--worktrees-dir <path>]
```

Examples:

```powershell
# Interactive mode
gwm

# Create a new worktree
gwm feature/new-feature
gwm bugfix/login-issue

# Use a custom worktrees directory
gwm --worktrees-dir D:\worktrees feature/new-feature
```

## Configuration

Set a default worktrees directory in `.gwmrc` (JSON):

```json
{
  "worktreesDir": "D:\\worktrees"
}
```

Config lookup order:

- Nearest `.gwmrc` from the current directory upward
- `~/.gwmrc` if no local config is found

The `--worktrees-dir` flag overrides `.gwmrc`.

## Troubleshooting

- "gwm: command not found": run `npm link` (local) or `npm install -g git-worktree-manager`, then restart your shell.
- "node is not recognized": install Node.js 18+ and reopen your terminal.
- Running outside a git repo: run `gwm` from inside a git repository.
