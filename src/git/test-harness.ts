#!/usr/bin/env tsx
/**
 * Manual integration test harness for git module
 * Usage: tsx src/git/test-harness.ts <command> [arg]
 */

import * as git from './index.js';

const [, , command, arg] = process.argv;

async function main() {
  try {
    switch (command) {
      case 'list': {
        console.log('Listing worktrees...');
        const worktrees = await git.listWorktrees();
        console.log(`Found ${worktrees.length} worktree(s):\n`);
        worktrees.forEach((wt, index) => {
          console.log(`${index + 1}. ${wt.branch || 'DETACHED HEAD'}`);
          console.log(`   Path: ${wt.path}`);
          console.log(`   HEAD: ${wt.head}`);
          console.log(`   Main: ${wt.isMainWorktree ? 'Yes' : 'No'}`);
          console.log();
        });
        break;
      }

      case 'status': {
        const path = arg || process.cwd();
        console.log(`Getting status for: ${path}\n`);
        const status = await git.getWorktreeStatus(path);
        console.log('File Changes:');
        console.log(`  Added:     ${status.added}`);
        console.log(`  Modified:  ${status.modified}`);
        console.log(`  Deleted:   ${status.deleted}`);
        console.log(`  Untracked: ${status.untracked}`);
        console.log('\nRemote Sync:');
        console.log(`  Remote exists: ${status.remoteExists}`);
        console.log(`  Ahead:         ${status.ahead}`);
        console.log(`  Behind:        ${status.behind}`);
        break;
      }

      case 'create': {
        if (!arg) {
          console.error('Error: Branch name required');
          console.log('Usage: tsx test-harness.ts create <branch-name>');
          process.exit(1);
        }
        console.log(`Creating worktree for branch: ${arg}\n`);
        const path = await git.createWorktree(arg);
        console.log(`✓ Created worktree at: ${path}`);
        break;
      }

      case 'remove': {
        if (!arg) {
          console.error('Error: Worktree path required');
          console.log('Usage: tsx test-harness.ts remove <worktree-path>');
          process.exit(1);
        }
        console.log(`Removing worktree: ${arg}\n`);
        await git.removeWorktree(arg, true);
        console.log('✓ Removed worktree successfully');
        break;
      }

      case 'root': {
        const root = await git.getRepoRoot();
        console.log(`Repository root: ${root}`);
        break;
      }

      case 'validate': {
        if (!arg) {
          console.error('Error: Branch name required');
          console.log('Usage: tsx test-harness.ts validate <branch-name>');
          process.exit(1);
        }
        const isValid = git.isValidBranchName(arg);
        console.log(`Branch name "${arg}" is ${isValid ? 'valid' : 'invalid'}`);
        break;
      }

      default:
        console.log('Git Module Test Harness');
        console.log('\nUsage: tsx test-harness.ts <command> [arg]');
        console.log('\nCommands:');
        console.log('  list              - List all worktrees in repository');
        console.log('  status [path]     - Get status of worktree (defaults to cwd)');
        console.log('  create <branch>   - Create new worktree with branch');
        console.log('  remove <path>     - Remove worktree at path');
        console.log('  root              - Show repository root');
        console.log('  validate <branch> - Validate branch name');
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if ('stderr' in error && error.stderr) {
        console.error(`Git stderr: ${error.stderr}`);
      }
      process.exit(1);
    }
    throw error;
  }
}

main();
