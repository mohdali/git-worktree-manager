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

## Docker Compose Isolation

When creating a new worktree, `gwm` automatically sets up a `.env` file for docker-compose isolation:

1. **Copies `.env` from current directory** - If you have a `.env` file where you run `gwm`, it's copied to the new worktree
2. **Preserves existing `.env`** - If the worktree already has a `.env` (tracked or user-created), it's preserved and updated
3. **Sets `COMPOSE_PROJECT_NAME`** - Matches the worktree folder name, ensuring each worktree uses separate docker containers, networks, and volumes

Example `.env` in a new worktree:

```env
# Original content from source directory
DATABASE_URL=postgres://localhost/dev

# Added by gwm for docker-compose isolation
COMPOSE_PROJECT_NAME=feature-auth_a1b2c3d4
```

This ensures that running `docker-compose up` in different worktrees creates isolated container stacks that don't interfere with each other.

## Troubleshooting

- "gwm: command not found": run `npm link` (local) or `npm install -g git-worktree-manager`, then restart your shell.
- "node is not recognized": install Node.js 18+ and reopen your terminal.
- Running outside a git repo: run `gwm` from inside a git repository.
