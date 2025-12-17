import { WorktreeStatus } from '../git/types.js';
import path from 'path';

/**
 * Extract folder name from full path
 * /Users/name/.worktrees/feature_abc123 -> feature_abc123
 */
export function formatPath(fullPath: string): string {
  return path.basename(fullPath);
}

/**
 * Build status indicator string from WorktreeStatus
 * Examples:
 *   {modified: 2, added: 1} -> "[M:2] [A:1]"
 *   {ahead: 3, behind: 1} -> "[+3] [-1]"
 *   {remoteExists: false} -> "[local]"
 */
export function formatStatusIndicators(status: WorktreeStatus): string {
  const indicators: string[] = [];

  // File changes (only show if non-zero)
  if (status.modified > 0) indicators.push(`[M:${status.modified}]`);
  if (status.added > 0) indicators.push(`[A:${status.added}]`);
  if (status.deleted > 0) indicators.push(`[D:${status.deleted}]`);
  if (status.untracked > 0) indicators.push(`[?:${status.untracked}]`);

  // Remote sync status
  if (!status.remoteExists) {
    indicators.push('[local]');
  } else {
    if (status.ahead > 0) indicators.push(`[+${status.ahead}]`);
    if (status.behind > 0) indicators.push(`[-${status.behind}]`);
  }

  return indicators.join(' ');
}
