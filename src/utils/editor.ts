import { spawn } from 'child_process';
import { platform } from 'os';

/**
 * Custom error class for editor-related errors
 */
export class EditorError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'EditorError';
  }
}

/**
 * Get the VS Code command for the current platform
 */
function getVSCodeCommand(): string {
  return platform() === 'win32' ? 'code.cmd' : 'code';
}

/**
 * Generate helpful installation instructions for VS Code CLI
 */
function getInstallationInstructions(): string {
  const os = platform();
  if (os === 'darwin') {
    return 'Install it via VS Code: Open Command Palette (⌘+⇧+P) → "Shell Command: Install \'code\' command in PATH"';
  } else if (os === 'win32') {
    return 'Install it via VS Code installer or add VS Code to PATH manually';
  } else {
    return 'Install it via your package manager or add VS Code to PATH';
  }
}

/**
 * Open a directory in VS Code
 * @param path - Absolute path to directory to open
 * @throws EditorError if VS Code CLI is not found or fails to launch
 */
export async function openInVSCode(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = getVSCodeCommand();

    const proc = spawn(command, [path], {
      detached: true,
      stdio: 'ignore',
      shell: false
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        const instructions = getInstallationInstructions();
        reject(new EditorError(
          `VS Code CLI not found. ${instructions}`,
          err
        ));
      } else {
        reject(new EditorError(
          `Failed to launch VS Code: ${err.message}`,
          err
        ));
      }
    });

    // Unref the process so it runs independently
    proc.unref();

    // Resolve immediately after spawning successfully
    // We don't wait for VS Code to actually open
    resolve();
  });
}
