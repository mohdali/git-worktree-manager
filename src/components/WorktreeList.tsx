import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { listWorktrees, getWorktreeStatus, removeWorktree, deleteLocalBranch, pushBranch } from '../git/index.js';
import { Worktree, WorktreeStatus } from '../git/types.js';
import { WorktreeItem } from './WorktreeItem.js';
import { openInVSCode, EditorError } from '../utils/editor.js';
import { CreateWorktreeModal } from './CreateWorktreeModal.js';
import { ConfirmDialog } from './ConfirmDialog.js';

export function WorktreeList() {
  const { exit } = useApp();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [statuses, setStatuses] = useState<Map<string, WorktreeStatus>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Worktree | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch worktrees (reusable function)
  const fetchWorktrees = useCallback(async () => {
    try {
      const wts = await listWorktrees();
      setWorktrees(wts);
      setIsLoading(false);

      // Fetch status for each worktree (async, non-blocking)
      wts.forEach(async (wt) => {
        try {
          const status = await getWorktreeStatus(wt.path);
          setStatuses(prev => new Map(prev).set(wt.path, status));
        } catch (err) {
          // Ignore status fetch errors (e.g., permissions)
        }
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

    setShowDeleteConfirm(false);
    setMessage({ text: `Deleting ${deleteTarget.branch || 'worktree'}...`, type: 'success' });

    try {
      // Remove worktree
      await removeWorktree(deleteTarget.path);

      // Delete local branch if it exists
      if (deleteTarget.branch) {
        try {
          await deleteLocalBranch(deleteTarget.branch, true); // force delete
        } catch (err) {
          // Branch deletion failure is non-critical, log but continue
          console.error('Failed to delete branch:', err);
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
  }, [deleteTarget, fetchWorktrees]);

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

    // Open selected worktree in VS Code
    if (key.return || input === 'o') {
      if (worktrees.length > 0) {
        const selected = worktrees[selectedIndex];
        try {
          await openInVSCode(selected.path);
          setMessage({ text: `Opening ${selected.path} in VS Code...`, type: 'success' });
          // Give user brief moment to see success message before exit
          setTimeout(() => exit(), 300);
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
        <CreateWorktreeModal onClose={handleModalClose} />
      ) : (
        <>
          <Text bold color="cyan">Git Worktree Manager</Text>
          {isRefreshing && <Text color="yellow">Refreshing...</Text>}
          <Text dimColor>Use arrow keys to navigate</Text>
          <Box marginTop={1} flexDirection="column">
            {worktrees.map((wt, index) => (
              <WorktreeItem
                key={wt.path}
                worktree={wt}
                status={statuses.get(wt.path) || null}
                isSelected={index === selectedIndex}
              />
            ))}
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
