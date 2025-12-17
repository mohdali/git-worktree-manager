import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface ConfirmDialogProps {
  title: string;           // e.g., "Delete Worktree"
  message: string;         // Main confirmation message
  warning?: string;        // Optional warning (for dirty worktrees)
  onConfirm: () => void;   // Called on 'y' key
  onCancel: () => void;    // Called on 'n' or Escape
}

/**
 * Reusable yes/no confirmation dialog
 * Features:
 * - Yellow border styling for warning tone
 * - Optional warning message with ⚠️ symbol
 * - Keyboard shortcuts: 'y' to confirm, 'n'/Escape to cancel
 */
export function ConfirmDialog({
  title,
  message,
  warning,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'y') {
      onConfirm();
    } else if (input === 'n' || key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      width={50}
    >
      {/* Dialog title */}
      <Text bold color="yellow">{title}</Text>

      {/* Confirmation message */}
      <Box marginTop={1} flexDirection="column">
        {message.split('\n').map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>

      {/* Warning message (optional) */}
      {warning && (
        <Box marginTop={1}>
          <Text color="yellow">⚠️  Warning: {warning}</Text>
        </Box>
      )}

      {/* Help footer */}
      <Box marginTop={1}>
        <Text dimColor>[y] Yes  [n/Esc] No</Text>
      </Box>
    </Box>
  );
}
