#!/usr/bin/env pwsh

Write-Host "Testing periodic refresh functionality..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Default behavior (no parameters):" -ForegroundColor Yellow
Write-Host "./manage-worktrees.ps1" -ForegroundColor White
Write-Host "- Status refresh is ENABLED (every 30 seconds)" -ForegroundColor Green
Write-Host ""
Write-Host "To customize refresh interval:" -ForegroundColor Yellow
Write-Host "./manage-worktrees.ps1 -RefreshInterval 5     # Refresh every 5 seconds" -ForegroundColor White
Write-Host "./manage-worktrees.ps1 -RefreshInterval 60    # Refresh every 60 seconds" -ForegroundColor White
Write-Host ""
Write-Host "To disable refresh:" -ForegroundColor Yellow
Write-Host "./manage-worktrees.ps1 -RefreshInterval 0     # Disable refresh" -ForegroundColor White
Write-Host ""
Write-Host "This test will launch with 5-second refresh for easier observation." -ForegroundColor Cyan
Write-Host "Watch for the 'Refreshing status...' indicator every 5 seconds." -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to start test..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Run with 5-second refresh interval for testing
& "./manage-worktrees.ps1" -RefreshInterval 5