import { join } from 'path';
import { copyFile, access } from 'fs/promises';
import { constants } from 'fs';

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy .env to a new worktree if one doesn't already exist
 * Docker-compose automatically uses the folder name as COMPOSE_PROJECT_NAME,
 * so each worktree gets isolated containers, networks, and volumes by default.
 * We just need to ensure the .env file (which is typically gitignored) is available.
 * @param worktreePath - Full path to the new worktree
 */
export async function setupWorktreeEnv(
  worktreePath: string
): Promise<void> {
  try {
    const targetEnvPath = join(worktreePath, '.env');

    // Don't overwrite if the worktree already has a .env
    if (await fileExists(targetEnvPath)) {
      return;
    }

    // Copy .env from the current working directory (where gwm was launched)
    const sourceEnvPath = join(process.cwd(), '.env');
    if (await fileExists(sourceEnvPath)) {
      await copyFile(sourceEnvPath, targetEnvPath);
    }
  } catch (error) {
    // Log warning but don't fail worktree creation
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: Failed to copy .env for worktree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
