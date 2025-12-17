import React from 'react';
import { Text, Box } from 'ink';
import { Worktree, WorktreeStatus } from '../git/types.js';
import { formatPath, formatStatusIndicators } from '../utils/format.js';

interface WorktreeItemProps {
  worktree: Worktree;
  status: WorktreeStatus | null;
  isSelected: boolean;
}

export function WorktreeItem({ worktree, status, isSelected }: WorktreeItemProps) {
  const folderName = formatPath(worktree.path);
  const branchDisplay = worktree.branch || '<detached>';
  const statusText = status ? formatStatusIndicators(status) : '';

  return (
    <Box>
      <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
        {isSelected ? '> ' : '  '}
        {branchDisplay}
      </Text>
      <Text dimColor> ({folderName})</Text>
      {statusText && (
        <Text color="yellow"> {statusText}</Text>
      )}
    </Box>
  );
}
