import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { listWorktrees, getWorktreeStatus, removeWorktree, deleteLocalBranch, pushBranch, createWorktree } from '../git/index.js';
import { Worktree, WorktreeStatus } from '../git/types.js';
import { WorktreeItem } from './WorktreeItem.js';
import { openInVSCode, EditorError } from '../utils/editor.js';
import { CreateWorktreeModal } from './CreateWorktreeModal.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { createLimiter } from '../utils/concurrency.js';

// Viewport configuration
const VIEWPORT_SIZE = 10; // Max visible items
const STATUS_CONCURRENCY = 4; // Max concurrent status fetches

interface WorktreeListProps {
  initialBranchName?: string | null;
  worktreesDir?: string;
  configError?: string | null;
}

export function WorktreeList({ initialBranchName, worktreesDir, configError }: WorktreeListProps) {
  const { exit } = useApp();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [statuses, setStatuses] = useState<Map<string, WorktreeStatus>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(
    configError ? { text: configError, type: 'error' } : null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Worktree | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialCreationAttempted = useRef(false);

  // Fetch worktrees (reusable function)
  const fetchWorktrees = useCallback(async () => {
    try {
      const wts = await listWorktrees();
      setWorktrees(wts);
      setIsLoading(false);

      // Fetch status for each worktree with concurrency limiting
      const limiter = createLimiter(STATUS_CONCURRENCY);
      wts.forEach((wt) => {
        limiter(async () => {
          try {
            const status = await getWorktreeStatus(wt.path);
            setStatuses(prev => new Map(prev).set(wt.path, status));
          } catch {
            // Ignore status fetch errors (e.g., permissions)
          }
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  // Fetch worktrees on mount
  useEffect(() => {
    fetchWorktrees();
  }, [fetchWorktrees]);

  // Handle initial branch creation from CLI args
  useEffect(() => {
    if (!initialBranchName || initialCreationAttempted.current) {
      return;
    }
    initialCreationAttempted.current = true;

    const createInitialWorktree = async () => {
      setMessage({ text: `Creating worktree for '${initialBranchName}'...`, type: 'success' });
      try {
        const path = await createWorktree(initialBranchName, worktreesDir);
        setMessage({ text: `Created worktree at ${path}`, type: 'success' });
        await fetchWorktrees();
      } catch (err) {
        setMessage({
          text: `Failed to create worktree: ${err instanceof Error ? err.message : 'Unknown error'}`,
          type: 'error'
        });
      }
    };

    createInitialWorktree();
  }, [initialBranchName, fetchWorktrees, worktreesDir]);

  // Handle modal close
  const handleModalClose = useCallback((created: boolean) => {
    setShowCreateModal(false);
    if (created) {
      setMessage({ text: 'Worktree created successfully!', type: 'success' });
      fetchWorktrees();
    }
  }, [fetchWorktrees]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    // Check if worktree is dirty to determine force flag
    const targetStatus = statuses.get(deleteTarget.path);
    const isDirty = targetStatus
      ? targetStatus.added > 0 || targetStatus.modified > 0 || targetStatus.deleted > 0 || targetStatus.untracked > 0
      : false;

    setShowDeleteConfirm(false);
    setMessage({ text: `Deleting ${deleteTarget.branch || 'worktree'}...`, type: 'success' });

    try {
      // Remove worktree (force if dirty)
      await removeWorktree(deleteTarget.path, isDirty);

      // Delete local branch if it exists
      if (deleteTarget.branch) {
        try {
          await deleteLocalBranch(deleteTarget.branch, true); // force delete
        } catch {
          // Branch deletion failure is non-critical, silently continue
        }
      }

      setMessage({ text: 'Worktree deleted successfully', type: 'success' });
      fetchWorktrees(); // Refresh list
    } catch (err) {
      setMessage({
        text: `Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, statuses, fetchWorktrees]);

  // Handle delete cancellation
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  }, []);

  // Keyboard navigation and actions
  useInput(async (input, key) => {
    // Ignore input when modal is open
    if (showCreateModal || showDeleteConfirm) {
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(worktrees.length - 1, prev + 1));
    }

    // Open selected worktree in VS Code (keep TUI open like PS script)
    if (key.return || input === 'o') {
      if (worktrees.length > 0) {
        const selected = worktrees[selectedIndex];
        try {
          await openInVSCode(selected.path);
          setMessage({ text: `Opened ${selected.path} in VS Code`, type: 'success' });
        } catch (err) {
          if (err instanceof EditorError) {
            setMessage({ text: err.message, type: 'error' });
          } else {
            setMessage({ text: `Failed to open VS Code: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
          }
        }
      }
    }

    // Create new worktree
    if (input === 'c') {
      setShowCreateModal(true);
    }

    // Delete worktree
    if (input === 'd') {
      if (worktrees.length === 0) return;

      const selected = worktrees[selectedIndex];

      // Block main worktree deletion
      if (selected.isMainWorktree) {
        setMessage({
          text: 'Cannot delete main worktree',
          type: 'error'
        });
        return;
      }

      // Block current worktree deletion (can't delete where you're running from)
      if (selected.path === process.cwd()) {
        setMessage({
          text: 'Cannot delete current worktree',
          type: 'error'
        });
        return;
      }

      // Store target and show confirmation
      setDeleteTarget(selected);
      setShowDeleteConfirm(true);
    }

    // Push branch to remote
    if (input === 'p') {
      if (worktrees.length === 0) return;

      const selected = worktrees[selectedIndex];

      // Block detached HEAD
      if (!selected.branch) {
        setMessage({
          text: 'Cannot push detached HEAD',
          type: 'error'
        });
        return;
      }

      // Execute push
      setMessage({ text: `Pushing ${selected.branch}...`, type: 'success' });
      try {
        await pushBranch(selected.branch, selected.path);
        setMessage({
          text: `Branch '${selected.branch}' pushed to origin`,
          type: 'success'
        });
      } catch (err) {
        setMessage({
          text: `Push failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          type: 'error'
        });
      }
    }

    // Refresh worktree list
    if (input === 'r') {
      setIsRefreshing(true);
      setStatuses(new Map());
      await fetchWorktrees();
      setIsRefreshing(false);
    }

    // Quit application
    if (input === 'q') {
      exit();
    }
  });

  // Calculate viewport window (virtualization for large lists)
  // Must be called unconditionally before early returns (Rules of Hooks)
  const viewport = useMemo(() => {
    const total = worktrees.length;
    if (total <= VIEWPORT_SIZE) {
      // No scrolling needed
      return { start: 0, end: total, hasAbove: false, hasBelow: false };
    }

    // Center selected item in viewport when possible
    let start = Math.max(0, selectedIndex - Math.floor(VIEWPORT_SIZE / 2));
    let end = start + VIEWPORT_SIZE;

    // Adjust if we're near the end
    if (end > total) {
      end = total;
      start = Math.max(0, end - VIEWPORT_SIZE);
    }

    return {
      start,
      end,
      hasAbove: start > 0,
      hasBelow: end < total
    };
  }, [worktrees.length, selectedIndex]);

  const visibleWorktrees = worktrees.slice(viewport.start, viewport.end);

  // Loading state
  if (isLoading) {
    return <Text>Loading worktrees...</Text>;
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Make sure you're in a git repository</Text>
      </Box>
    );
  }

  // Empty state
  if (worktrees.length === 0) {
    return <Text dimColor>No worktrees found</Text>;
  }

  // Check if deleteTarget has uncommitted changes
  const isDirty = deleteTarget && statuses.get(deleteTarget.path)
    ? (() => {
        const s = statuses.get(deleteTarget.path)!;
        return s.added > 0 || s.modified > 0 || s.deleted > 0 || s.untracked > 0;
      })()
    : false;

  // Main list
  return (
    <Box flexDirection="column">
      {showDeleteConfirm && deleteTarget ? (
        <ConfirmDialog
          title="Delete Worktree"
          message={`Delete ${deleteTarget.branch || 'detached HEAD'}?\nPath: ${deleteTarget.path}`}
          warning={isDirty ? 'This worktree has uncommitted changes' : undefined}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      ) : showCreateModal ? (
        <CreateWorktreeModal onClose={handleModalClose} worktreesDir={worktreesDir} />
      ) : (
        <>
          <Text bold color="cyan">Git Worktree Manager</Text>
          {isRefreshing && <Text color="yellow">Refreshing...</Text>}
          <Text dimColor>Use arrow keys to navigate {worktrees.length > VIEWPORT_SIZE ? `(${selectedIndex + 1}/${worktrees.length})` : ''}</Text>
          <Box marginTop={1} flexDirection="column">
            {viewport.hasAbove && <Text dimColor>  ↑ {viewport.start} more above</Text>}
            {visibleWorktrees.map((wt, index) => (
              <WorktreeItem
                key={wt.path}
                worktree={wt}
                status={statuses.get(wt.path) || null}
                isSelected={index + viewport.start === selectedIndex}
              />
            ))}
            {viewport.hasBelow && <Text dimColor>  ↓ {worktrees.length - viewport.end} more below</Text>}
          </Box>

          {/* Message feedback */}
          {message && (
            <Box marginTop={1}>
              <Text color={message.type === 'error' ? 'red' : 'green'}>
                {message.text}
              </Text>
            </Box>
          )}

          {/* Help footer */}
          <Box marginTop={1}>
            <Text dimColor>[Enter/o] Open  [c] Create  [d] Delete  [p] Push  [r] Refresh  [q] Quit</Text>
          </Box>
        </>
      )}
    </Box>
  );
}
