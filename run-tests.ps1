#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Run the Git Worktree Manager test suite
.DESCRIPTION
    Simple wrapper to run all tests with options
#>

param(
    [switch]$Verbose,
    [switch]$FailFast,
    [switch]$Help
)

if ($Help) {
    Write-Host "Git Worktree Manager Test Runner" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: ./run-tests.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Green
    Write-Host "  -Verbose    Show detailed test output"
    Write-Host "  -FailFast   Stop on first test failure"
    Write-Host "  -Help       Show this help message"
    Write-Host ""
    exit 0
}

# Check if we're in the right directory
if (-not (Test-Path "./manage-worktrees.ps1")) {
    Write-Host "Error: manage-worktrees.ps1 not found!" -ForegroundColor Red
    Write-Host "Please run this script from the git-worktree-manager directory." -ForegroundColor Yellow
    exit 1
}

# Create tests directory if it doesn't exist
if (-not (Test-Path "./tests")) {
    Write-Host "Creating tests directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "./tests" -Force | Out-Null
}

# Check if test file exists
$testScript = "./tests/Test-WorktreeManager.ps1"
if (-not (Test-Path $testScript)) {
    Write-Host "Error: Test script not found at $testScript" -ForegroundColor Red
    exit 1
}

# Run the tests
Write-Host "Running Git Worktree Manager tests..." -ForegroundColor Cyan
Write-Host ""

$args = @()
if ($Verbose) { $args += "-Verbose" }
if ($FailFast) { $args += "-FailFast" }

$totalFailed = 0

# Run function tests
Write-Host "`n=== Running Function Tests ===" -ForegroundColor Yellow
& "./tests/Test-Functions.ps1" @args
$totalFailed += $LASTEXITCODE

# Run integration tests
Write-Host "`n=== Running Integration Tests ===" -ForegroundColor Yellow
& "./tests/Test-Integration.ps1" @args
$totalFailed += $LASTEXITCODE

# Note about interactive tests
Write-Host "`n=== Interactive Tests ===" -ForegroundColor Yellow
Write-Host "Interactive tests must be run manually due to keyboard input requirements." -ForegroundColor DarkGray
Write-Host "To test interactive features, run: ./manage-worktrees.ps1" -ForegroundColor DarkGray

$exitCode = $totalFailed

# Show result
Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed. Exit code: $exitCode" -ForegroundColor Red
}

exit $exitCode