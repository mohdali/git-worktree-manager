import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { runGit } from './runner.js';

/**
 * Get .env content from current HEAD using `git show HEAD:.env`
 * Uses the current branch/commit when gwm is launched as the source
 * @returns The .env file content, or null if it doesn't exist
 */
export async function getEnvFromHead(): Promise<string | null> {
  const result = await runGit(['show', 'HEAD:.env']);

  if (result.exitCode !== 0) {
    // .env doesn't exist in HEAD
    return null;
  }

  return result.stdout;
}

/**
 * Read existing .env file from a path
 * @param envPath - Path to .env file
 * @returns The .env file content, or null if it doesn't exist
 */
async function readExistingEnv(envPath: string): Promise<string | null> {
  try {
    return await readFile(envPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Parse .env content into key-value map
 * Preserves order and handles comments
 * @param content - Raw .env file content
 * @returns Map of environment variable key-value pairs
 */
export function parseEnv(content: string): Map<string, string> {
  const env = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env.set(key, value);
    }
  }

  return env;
}

/**
 * Serialize env map back to .env format
 * Updates existing content, preserving comments and structure
 * @param originalContent - Original .env content (or empty string)
 * @param updates - Key-value pairs to add/update
 * @returns Serialized .env content
 */
export function serializeEnv(
  originalContent: string,
  updates: Map<string, string>
): string {
  const lines = originalContent ? originalContent.split('\n') : [];
  const updatedKeys = new Set<string>();
  const result: string[] = [];

  // Process existing lines, updating values as needed
  for (const line of lines) {
    const trimmed = line.trim();

    // Keep empty lines and comments as-is
    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }

    // Check if this line has a key we need to update
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim();

      if (updates.has(key)) {
        // Update with new value
        result.push(`${key}=${updates.get(key)}`);
        updatedKeys.add(key);
      } else {
        // Keep original line
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  // Add any new keys that weren't in the original
  const newKeys = [...updates.entries()].filter(([key]) => !updatedKeys.has(key));

  if (newKeys.length > 0) {
    // Add separator comment if we have content
    if (result.length > 0 && result[result.length - 1].trim() !== '') {
      result.push('');
    }
    result.push('# Added by gwm for docker-compose isolation');

    for (const [key, value] of newKeys) {
      result.push(`${key}=${value}`);
    }
  }

  return result.join('\n');
}

/**
 * Compute PORT_OFFSET from worktree name (0-99 range using hash)
 * Deterministic so rebuilding the same worktree gets the same offset
 * Range limited to 0-99 to keep ports valid when used as prefix (e.g., ${PORT_OFFSET}80 -> max 9980)
 * @param worktreeName - The worktree folder name
 * @returns A number between 0 and 99
 */
export function computePortOffset(worktreeName: string): number {
  // Simple hash: sum of char codes
  let hash = 0;
  for (let i = 0; i < worktreeName.length; i++) {
    // Use a prime multiplier for better distribution
    hash = ((hash << 5) - hash + worktreeName.charCodeAt(i)) | 0;
  }

  // Map to 0-99 range (use absolute value)
  return Math.abs(hash) % 100;
}

/**
 * Setup .env for a new worktree
 * - If .env already exists in worktree (tracked or created), merge updates into it
 * - Otherwise, copy .env from default branch if it exists
 * - Adds/updates COMPOSE_PROJECT_NAME and PORT_OFFSET
 * @param worktreePath - Full path to the new worktree
 * @param worktreeFolderName - The folder name of the worktree
 */
export async function setupWorktreeEnv(
  worktreePath: string,
  worktreeFolderName: string
): Promise<void> {
  try {
    const envPath = join(worktreePath, '.env');

    // Check if .env already exists in the worktree (tracked in branch or user-created)
    let existingContent = await readExistingEnv(envPath);

    // If no existing .env in worktree, try to get from current HEAD
    if (existingContent === null) {
      existingContent = await getEnvFromHead();
    }

    // Prepare updates
    const updates = new Map<string, string>();
    updates.set('COMPOSE_PROJECT_NAME', worktreeFolderName);
    updates.set('PORT_OFFSET', String(computePortOffset(worktreeFolderName)));

    // Serialize with updates (merges into existing content)
    const newContent = serializeEnv(existingContent || '', updates);

    // Write to worktree
    await writeFile(envPath, newContent, 'utf8');
  } catch (error) {
    // Log warning but don't fail worktree creation
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: Failed to setup .env for worktree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
