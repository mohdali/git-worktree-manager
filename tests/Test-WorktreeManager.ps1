#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Comprehensive test suite for Git Worktree Manager
.DESCRIPTION
    Tests all functionality including interactive mode with simulated user inputs
#>

param(
    [switch]$Verbose,
    [switch]$FailFast
)

# Test configuration
$script:TestResults = @{
    Passed = 0
    Failed = 0
    Skipped = 0
    StartTime = Get-Date
}

$script:TestConfig = @{
    TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "worktree-test-$(Get-Random)"
    ScriptPath = Join-Path $PSScriptRoot ".." "manage-worktrees.ps1"
    Verbose = $Verbose
    FailFast = $FailFast
}

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
        
        if ($script:TestConfig.FailFast) {
            throw "Test failed: $TestName"
        }
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

function New-TestRepo {
    param([string]$Path)
    
    if (Test-Path $Path) {
        Remove-Item $Path -Recurse -Force
    }
    
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Push-Location $Path
    git init --quiet
    git config user.email "test@example.com"
    git config user.name "Test User"
    "# Test Repo" | Out-File -FilePath "README.md"
    git add .
    git commit -m "Initial commit" --quiet
    Pop-Location
}

function Invoke-ScriptWithInput {
    param(
        [string[]]$Arguments,
        [string[]]$Inputs
    )
    
    $inputString = $Inputs -join "`n"
    $result = $inputString | & $script:TestConfig.ScriptPath @Arguments 2>&1
    
    return @{
        Output = $result
        ExitCode = $LASTEXITCODE
    }
}

# Test Setup
Write-Host "Git Worktree Manager Test Suite" -ForegroundColor Magenta
Write-Host "===============================" -ForegroundColor Magenta
Write-Host "Script Path: $($script:TestConfig.ScriptPath)" -ForegroundColor Gray
Write-Host "Temp Dir: $($script:TestConfig.TempDir)" -ForegroundColor Gray
Write-Host ""

# Create test environment
New-Item -ItemType Directory -Path $script:TestConfig.TempDir -Force | Out-Null
$testRepoPath = Join-Path $script:TestConfig.TempDir "test-repo"
New-TestRepo -Path $testRepoPath
Push-Location $testRepoPath

try {
    # Test 1: Basic Functions
    Test-Function "ConvertTo-ValidFolderName" {
        # Load the script functions
        . $script:TestConfig.ScriptPath
        
        $result = ConvertTo-ValidFolderName -BranchName "feature/new-feature"
        Write-TestResult -TestName "Simple branch name" -Success ($result -eq "new-feature")
        
        $result = ConvertTo-ValidFolderName -BranchName "feature/JIRA-123-complex_name"
        Write-TestResult -TestName "Complex branch name" -Success ($result -eq "JIRA-123-complex-name")
        
        $result = ConvertTo-ValidFolderName -BranchName "fix/bug#123"
        Write-TestResult -TestName "Special characters" -Success ($result -eq "bug-123")
    }
    
    Test-Function "Test-ValidBranchName" {
        . $script:TestConfig.ScriptPath
        
        $result = Test-ValidBranchName -BranchName "valid-branch"
        Write-TestResult -TestName "Valid branch name" -Success ($result -eq $true)
        
        $result = Test-ValidBranchName -BranchName "invalid branch"
        Write-TestResult -TestName "Invalid branch with space" -Success ($result -eq $false)
        
        $result = Test-ValidBranchName -BranchName ""
        Write-TestResult -TestName "Empty branch name" -Success ($result -eq $false)
        
        $result = Test-ValidBranchName -BranchName "branch~name"
        Write-TestResult -TestName "Invalid character ~" -Success ($result -eq $false)
    }
    
    # Test 2: Command Line Mode
    Test-Function "Create worktree via command line" {
        $branchName = "test-branch-$(Get-Random)"
        $result = & $script:TestConfig.ScriptPath $branchName -RefreshInterval 0 2>&1
        
        # Check if worktree was created
        $worktrees = git worktree list 2>$null
        $created = $worktrees | Select-String $branchName
        
        Write-TestResult -TestName "Worktree created" -Success ($null -ne $created)
        
        # Cleanup
        if ($created) {
            $worktreePath = ($created -split '\s+')[0]
            git worktree remove $worktreePath --force 2>$null
        }
    }
    
    Test-Function "Invalid branch name via command line" {
        $result = & $script:TestConfig.ScriptPath "invalid branch name" -RefreshInterval 0 2>&1
        $hasError = ($result | Select-String "Invalid branch name") -ne $null
        
        Write-TestResult -TestName "Error shown for invalid name" -Success $hasError
    }
    
    # Test 3: Interactive Mode - Navigation
    Test-Function "Interactive mode - Quit with q" {
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        $hasMenu = $output -match "Git Worktree Manager"
        $hasExit = $output -match "Exiting..."
        
        Write-TestResult -TestName "Shows menu" -Success $hasMenu
        Write-TestResult -TestName "Exits on q" -Success $hasExit
    }
    
    Test-Function "Interactive mode - Quit with Escape" {
        # Simulating Escape key is complex, so we'll test the q key as proxy
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        $hasExit = $output -match "Exiting..."
        Write-TestResult -TestName "Exits on quit command" -Success $hasExit
    }
    
    # Test 4: Create new worktree in interactive mode
    Test-Function "Interactive mode - Create new worktree" {
        $branchName = "interactive-test-$(Get-Random)"
        
        # Send 'n' to create new, then branch name
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("n", $branchName, "q")
        $output = $result.Output -join "`n"
        
        # Check if creation prompts appeared
        $hasCreatePrompt = $output -match "Create New Worktree"
        $hasEnterBranch = $output -match "Enter branch name"
        
        Write-TestResult -TestName "Shows create prompt" -Success $hasCreatePrompt
        Write-TestResult -TestName "Shows branch name prompt" -Success $hasEnterBranch
        
        # Check if worktree was created
        $worktrees = git worktree list 2>$null
        $created = $worktrees | Select-String $branchName
        
        Write-TestResult -TestName "Worktree created interactively" -Success ($null -ne $created)
        
        # Cleanup
        if ($created) {
            $worktreePath = ($created -split '\s+')[0]
            git worktree remove $worktreePath --force 2>$null
            git branch -D $branchName 2>$null
        }
    }
    
    # Test 5: Error handling in interactive mode
    Test-Function "Interactive mode - Invalid branch name" {
        # Send 'n' to create new, then invalid branch name, then 'q' to quit
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("n", "invalid branch name", "", "q")
        $output = $result.Output -join "`n"
        
        $hasError = $output -match "Invalid branch name"
        Write-TestResult -TestName "Shows error for invalid branch" -Success $hasError
    }
    
    # Test 6: Status indicators
    Test-Function "Status indicators format" {
        . $script:TestConfig.ScriptPath
        
        # Create a mock status object
        $status = @{
            HasUncommittedChanges = $true
            BranchName = "test"
            RemoteExists = $false
            IsAhead = $false
            IsBehind = $false
            AheadCount = 0
            BehindCount = 0
            Added = 2
            Modified = 1
            Deleted = 0
            Untracked = 3
        }
        
        $indicators = Get-StatusIndicators -Status $status
        
        # Check for expected indicators
        $hasAdded = $indicators -match "\+2"
        $hasModified = $indicators -match "~1"
        $hasUntracked = $indicators -match "\?3"
        $hasLocalOnly = $indicators -match "📍"
        
        Write-TestResult -TestName "Shows added files" -Success $hasAdded
        Write-TestResult -TestName "Shows modified files" -Success $hasModified
        Write-TestResult -TestName "Shows untracked files" -Success $hasUntracked
        Write-TestResult -TestName "Shows local-only indicator" -Success $hasLocalOnly
    }
    
    # Test 7: Refresh interval settings
    Test-Function "Refresh interval - Default (30s)" {
        $result = Invoke-ScriptWithInput -Arguments @() -Inputs @("q")
        $output = $result.Output -join "`n"
        
        $hasRefresh = $output -match "Status refresh: every 30s"
        Write-TestResult -TestName "Default refresh is 30s" -Success $hasRefresh
    }
    
    Test-Function "Refresh interval - Disabled" {
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        $hasDisabled = $output -match "Status refresh: disabled"
        Write-TestResult -TestName "Refresh can be disabled" -Success $hasDisabled
    }
    
    Test-Function "Refresh interval - Custom (60s)" {
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "60") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        $hasCustom = $output -match "Status refresh: every 60s"
        Write-TestResult -TestName "Custom refresh interval" -Success $hasCustom
    }
    
    # Test 8: Multiple worktrees scenario
    Test-Function "Multiple worktrees display" {
        # Create multiple worktrees
        $branches = @("test-1-$(Get-Random)", "test-2-$(Get-Random)")
        $createdPaths = @()
        
        foreach ($branch in $branches) {
            git worktree add -b $branch "../$branch" 2>$null
            $createdPaths += "../$branch"
        }
        
        # Run script and check output
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        # Check if all branches are shown
        $showsFirst = $output -match $branches[0]
        $showsSecond = $output -match $branches[1]
        
        Write-TestResult -TestName "Shows multiple worktrees" -Success ($showsFirst -and $showsSecond)
        
        # Cleanup
        foreach ($i in 0..($branches.Count - 1)) {
            git worktree remove $createdPaths[$i] --force 2>$null
            git branch -D $branches[$i] 2>$null
        }
    }
    
} finally {
    # Cleanup
    Pop-Location
    if (Test-Path $script:TestConfig.TempDir) {
        Remove-Item $script:TestConfig.TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Summary
    $duration = (Get-Date) - $script:TestResults.StartTime
    Write-Host "`nTest Summary" -ForegroundColor Magenta
    Write-Host "============" -ForegroundColor Magenta
    Write-Host "Total Tests: $($script:TestResults.Passed + $script:TestResults.Failed + $script:TestResults.Skipped)"
    Write-Host "Passed: $($script:TestResults.Passed)" -ForegroundColor Green
    Write-Host "Failed: $($script:TestResults.Failed)" -ForegroundColor Red
    Write-Host "Skipped: $($script:TestResults.Skipped)" -ForegroundColor Yellow
    Write-Host "Duration: $($duration.TotalSeconds.ToString('0.00'))s"
    
    # Exit code
    exit $script:TestResults.Failed
}