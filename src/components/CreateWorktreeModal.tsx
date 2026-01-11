import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput } from './TextInput.js';
import { createWorktree } from '../git/worktrees.js';
import { isValidBranchName } from '../git/operations.js';

export interface CreateWorktreeModalProps {
  onClose: (created: boolean) => void;
  worktreesDir?: string;
}

/**
 * Modal dialog for creating new worktrees
 * Features:
 * - Real-time branch name validation
 * - Loading state during creation
 * - Error handling for git operations
 * - Keyboard shortcuts: Enter to submit, Escape to cancel
 */
export function CreateWorktreeModal({ onClose, worktreesDir }: CreateWorktreeModalProps) {
  const [branchName, setBranchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Real-time validation
  useEffect(() => {
    if (!branchName) {
      setValidationError(null);
    } else if (!isValidBranchName(branchName)) {
      setValidationError('Invalid characters: ~^:?*[]{}@{} .. / at edges');
    } else {
      setValidationError(null);
    }
  }, [branchName]);

  // Handle Escape key to cancel
  useInput((_input, key) => {
    if (key.escape && !isLoading) {
      onClose(false);
    }
  });

  // Handle worktree creation
  const handleCreate = async () => {
    // Prevent creation if validation failed or input is empty
    if (validationError || !branchName || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createWorktree(branchName, worktreesDir);
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      width={50}
    >
      {/* Modal title */}
      <Text bold color="cyan">Create Worktree</Text>

      <Box marginTop={1}>
        <Text dimColor>Branch name:</Text>
      </Box>

      {/* Text input */}
      <Box marginTop={0}>
        <Text>{isLoading ? '  ' : '> '}</Text>
        <TextInput
          value={branchName}
          onChange={setBranchName}
          placeholder="feature/new-branch"
          onSubmit={handleCreate}
          isActive={!isLoading}
        />
      </Box>

      {/* Validation error */}
      {validationError && (
        <Box marginTop={1}>
          <Text color="yellow">{validationError}</Text>
        </Box>
      )}

      {/* Git error */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <Box marginTop={1}>
          <Text dimColor>⠋ Creating worktree...</Text>
        </Box>
      )}

      {/* Help footer */}
      <Box marginTop={1}>
        <Text dimColor>[Enter] Create  [Esc] Cancel</Text>
      </Box>
    </Box>
  );
}
