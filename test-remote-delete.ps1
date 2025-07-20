#!/usr/bin/env pwsh

Write-Host "Testing remote branch deletion functionality..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This test will:" -ForegroundColor Yellow
Write-Host "1. Create a test worktree with a new branch" -ForegroundColor Yellow
Write-Host "2. Push the branch to remote" -ForegroundColor Yellow
Write-Host "3. Delete the worktree" -ForegroundColor Yellow
Write-Host "4. You should see a prompt to delete the remote branch" -ForegroundColor Yellow
Write-Host "5. Verify both local and remote branches are deleted" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test branch name: test-remote-delete-$(Get-Random -Maximum 9999)" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to start the test..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Generate test branch name
$testBranch = "test-remote-delete-$(Get-Random -Maximum 9999)"

Write-Host ""
Write-Host "Creating test worktree with branch: $testBranch" -ForegroundColor Cyan

# Create the worktree
& "./manage-worktrees.ps1" $testBranch

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. The worktree manager should open" -ForegroundColor Yellow
Write-Host "2. Find the new test branch in the list" -ForegroundColor Yellow
Write-Host "3. Press 'p' to push it to remote" -ForegroundColor Yellow
Write-Host "4. Press 'D' to delete it" -ForegroundColor Yellow
Write-Host "5. Confirm deletion and observe the remote branch deletion prompt" -ForegroundColor Yellow
Write-Host ""
Write-Host "After the test, you can verify with:" -ForegroundColor Green
Write-Host "git branch -a | grep $testBranch" -ForegroundColor White