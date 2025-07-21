#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Unit tests for Git Worktree Manager functions
.DESCRIPTION
    Tests individual functions without interactive mode
#>

param(
    [switch]$Verbose
)

# Test configuration
$script:TestResults = @{
    Passed = 0
    Failed = 0
    StartTime = Get-Date
}

$script:ScriptPath = Join-Path $PSScriptRoot ".." "manage-worktrees.ps1"

# Helper functions
function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Success,
        [string]$Message = ""
    )
    
    if ($Success) {
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        $script:TestResults.Passed++
    } else {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "   Error: $Message" -ForegroundColor Red
        }
        $script:TestResults.Failed++
    }
}

function Test-Function {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    Write-Host "`nTesting: $Name" -ForegroundColor Cyan
    
    try {
        & $Test
    } catch {
        Write-TestResult -TestName $Name -Success $false -Message $_.Exception.Message
    }
}

# Load the script functions
Write-Host "Git Worktree Manager - Function Tests" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "Loading script: $script:ScriptPath" -ForegroundColor Gray
Write-Host ""

# Dot-source the script to load functions
. $script:ScriptPath

# Test 1: Helper Functions
Test-Function "Get-RandomHash" {
    $hash1 = Get-RandomHash
    $hash2 = Get-RandomHash
    
    Write-TestResult -TestName "Generates 8-character hash" -Success ($hash1.Length -eq 8)
    Write-TestResult -TestName "Generates unique hashes" -Success ($hash1 -ne $hash2)
    Write-TestResult -TestName "Contains only alphanumeric" -Success ($hash1 -match '^[a-z0-9]+$')
}

Test-Function "ConvertTo-ValidFolderName" {
    $tests = @(
        @{ Input = "feature/new-feature"; Expected = "new-feature" }
        @{ Input = "bugfix/JIRA-123"; Expected = "JIRA-123" }
        @{ Input = "release/v1.0.0"; Expected = "v1-0-0" }
        @{ Input = "hotfix/urgent_fix"; Expected = "urgent-fix" }
        @{ Input = "feature/test@#$%feature"; Expected = "test-feature" }
        @{ Input = "fix"; Expected = "fix" }
    )
    
    foreach ($test in $tests) {
        $result = ConvertTo-ValidFolderName -BranchName $test.Input
        Write-TestResult -TestName "Convert '$($test.Input)' -> '$($test.Expected)'" -Success ($result -eq $test.Expected)
    }
}

Test-Function "Test-ValidBranchName" {
    $validNames = @(
        "main",
        "feature/new-feature",
        "bugfix/JIRA-123",
        "release-1.0",
        "hotfix_urgent"
    )
    
    $invalidNames = @(
        "",
        " ",
        "branch with spaces",
        "branch~name",
        "branch^name",
        "branch:name",
        "branch[name]",
        "branch..name",
        "/branch",
        "branch/"
    )
    
    foreach ($name in $validNames) {
        $result = Test-ValidBranchName -BranchName $name
        Write-TestResult -TestName "Valid: '$name'" -Success ($result -eq $true)
    }
    
    foreach ($name in $invalidNames) {
        $result = Test-ValidBranchName -BranchName $name
        Write-TestResult -TestName "Invalid: '$name'" -Success ($result -eq $false)
    }
}

Test-Function "Get-WorktreesDirectory" {
    $result = Get-WorktreesDirectory
    
    $isValid = $false
    if ($IsWindows) {
        $isValid = $result -eq (Join-Path $env:USERPROFILE ".worktrees")
    } else {
        $isValid = $result -eq (Join-Path $env:HOME ".worktrees")
    }
    
    Write-TestResult -TestName "Returns correct worktrees directory" -Success $isValid
    Write-TestResult -TestName "Path is absolute" -Success ([System.IO.Path]::IsPathRooted($result))
}

Test-Function "Get-StatusIndicators" {
    # Test with clean status
    $cleanStatus = @{
        HasUncommittedChanges = $false
        RemoteExists = $true
        IsAhead = $false
        IsBehind = $false
        AheadCount = 0
        BehindCount = 0
        Added = 0
        Modified = 0
        Deleted = 0
        Untracked = 0
    }
    
    $result = Get-StatusIndicators -Status $cleanStatus
    Write-TestResult -TestName "Clean status shows ✓" -Success ($result -eq "✓")
    
    # Test with changes
    $dirtyStatus = @{
        HasUncommittedChanges = $true
        RemoteExists = $true
        IsAhead = $true
        IsBehind = $false
        AheadCount = 2
        BehindCount = 0
        Added = 1
        Modified = 3
        Deleted = 0
        Untracked = 2
    }
    
    $result = Get-StatusIndicators -Status $dirtyStatus
    Write-TestResult -TestName "Shows added indicator" -Success ($result -match "\+1")
    Write-TestResult -TestName "Shows modified indicator" -Success ($result -match "~3")
    Write-TestResult -TestName "Shows untracked indicator" -Success ($result -match "\?2")
    Write-TestResult -TestName "Shows ahead indicator" -Success ($result -match "↑2")
    
    # Test local-only branch
    $localOnlyStatus = @{
        HasUncommittedChanges = $false
        RemoteExists = $false
        IsAhead = $false
        IsBehind = $false
        AheadCount = 0
        BehindCount = 0
        Added = 0
        Modified = 0
        Deleted = 0
        Untracked = 0
    }
    
    $result = Get-StatusIndicators -Status $localOnlyStatus
    Write-TestResult -TestName "Local-only shows 📍" -Success ($result -match "📍")
}

Test-Function "Show-ConfirmationDialog" {
    # This would normally require user input, so we'll just test that it exists
    $functionExists = Get-Command Show-ConfirmationDialog -ErrorAction SilentlyContinue
    Write-TestResult -TestName "Function exists" -Success ($null -ne $functionExists)
}

# Test global variables initialization
Test-Function "Global Variables" {
    # Check if global variables are defined
    Write-TestResult -TestName "StatusCache hashtable exists" -Success ($null -ne $global:StatusCache)
}

# Summary
$duration = (Get-Date) - $script:TestResults.StartTime
Write-Host "`n" -NoNewline
Write-Host ("=" * 50) -ForegroundColor Magenta
Write-Host "Test Summary" -ForegroundColor Magenta
Write-Host ("=" * 50) -ForegroundColor Magenta
Write-Host "Total Tests: $($script:TestResults.Passed + $script:TestResults.Failed)"
Write-Host "Passed: $($script:TestResults.Passed)" -ForegroundColor Green
Write-Host "Failed: $($script:TestResults.Failed)" -ForegroundColor Red
Write-Host "Duration: $($duration.TotalSeconds.ToString('0.00'))s"
Write-Host ""

# Exit code
exit $script:TestResults.Failed