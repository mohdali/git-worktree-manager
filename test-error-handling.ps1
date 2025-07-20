#!/usr/bin/env pwsh

Write-Host "Testing error handling for worktree creation..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This test will try to create worktrees that should fail:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test 1: Invalid branch name with spaces" -ForegroundColor Green
Write-Host "./manage-worktrees.ps1 'invalid branch name'" -ForegroundColor White
Write-Host ""
Write-Host "Expected behavior:" -ForegroundColor Yellow
Write-Host "- Should show error message" -ForegroundColor Yellow
Write-Host "- Should NOT open VS Code" -ForegroundColor Yellow
Write-Host "- Should return to worktree manager menu" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to run test..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run with invalid branch name
& "./manage-worktrees.ps1" "invalid branch name"