# Pull-Only UX -- Implementation Tasks

## Objective

Add pull support to the TUI so users can fast-forward branches that are behind
their remote tracking branch. Refresh should automatically fetch so behind counts
are always accurate without a separate fetch keybinding.

## Acceptance Criteria

1. Refresh (and initial load) runs `git fetch --prune origin` once per cycle so
   behind counts reflect actual remote state.
2. Pressing `l` on a selected worktree fast-forwards the branch when behind.
3. Detached HEAD, no-remote, and diverged states are blocked with clear messages.

---

## Tasks

### Task 1 -- Add `pullBranch` to git operations layer
**Status:** DONE

---

### Task 2 -- Add `fetchRemote` and integrate into refresh path
**Status:** DONE

---

### Task 3 -- Add pull keybinding (`l`) with guardrails in WorktreeList
**Status:** DONE

---

### Task 4 -- Update README keybindings and add tests for pull flow
**Status:** DONE

---

## Future Tasks (not yet detailed)

- **Task 5:** Stretch -- add integration-level test for pull keybinding behavior in WorktreeList (render test with ink-testing-library).
