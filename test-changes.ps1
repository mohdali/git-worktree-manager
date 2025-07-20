#!/usr/bin/env pwsh

Write-Host "Testing worktree manager changes..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This test will:" -ForegroundColor Yellow
Write-Host "1. Launch the worktree manager" -ForegroundColor Yellow
Write-Host "2. You should press Enter or 'o' to open a worktree" -ForegroundColor Yellow
Write-Host "3. VS Code should open in the background" -ForegroundColor Yellow
Write-Host "4. You should see a prompt to return to the menu" -ForegroundColor Yellow
Write-Host "5. After pressing any key, you should return to the main menu" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to start the test..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run the manage-worktrees script
& "./manage-worktrees.ps1"