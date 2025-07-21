#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Integration tests for Git Worktree Manager
.DESCRIPTION
    Tests actual worktree operations without interactive mode
#>

param(
    [switch]$Verbose,
    [switch]$SkipCleanup
)

# Test configuration
$script:TestResults = @{
    Passed = 0
    Failed = 0
    StartTime = Get-Date
}

$script:ScriptPath = Join-Path $PSScriptRoot ".." "manage-worktrees.ps1"
$script:TempDir = Join-Path ([System.IO.Path]::GetTempPath()) "worktree-test-$(Get-Random)"
$script:CreatedWorktrees = @()

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

function Test-Integration {
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

function Initialize-TestRepo {
    Write-Host "Initializing test repository..." -ForegroundColor Gray
    
    # Create temp directory
    New-Item -ItemType Directory -Path $script:TempDir -Force | Out-Null
    
    # Create test repo
    $testRepo = Join-Path $script:TempDir "test-repo"
    New-Item -ItemType Directory -Path $testRepo -Force | Out-Null
    
    Push-Location $testRepo
    
    # Initialize git repo
    git init --quiet
    git config user.email "test@example.com"
    git config user.name "Test User"
    
    # Create initial commit
    "# Test Repository" | Out-File -FilePath "README.md"
    git add .
    git commit -m "Initial commit" --quiet
    
    Write-Host "Test repository created at: $testRepo" -ForegroundColor Gray
}

function Cleanup-TestRepo {
    if ($SkipCleanup) {
        Write-Host "`nSkipping cleanup. Test directory: $script:TempDir" -ForegroundColor Yellow
        return
    }
    
    Write-Host "`nCleaning up test repository..." -ForegroundColor Gray
    
    Pop-Location
    
    # Force remove test directory
    if (Test-Path $script:TempDir) {
        Remove-Item $script:TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Main test execution
Write-Host "Git Worktree Manager - Integration Tests" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Initialize test environment
Initialize-TestRepo

try {
    # Test 1: Create worktree via command line
    Test-Integration "Command line worktree creation" {
        $branchName = "cli-test-$(Get-Random)"
        
        # Run the script to create a worktree
        $output = & $script:ScriptPath -BranchName $branchName -RefreshInterval 0 2>&1
        
        # Verify worktree was created
        $worktrees = git worktree list 2>$null
        $created = $worktrees -match $branchName
        
        Write-TestResult -TestName "Worktree created" -Success $created
        
        if ($created) {
            # Track for cleanup
            $worktreePath = (git worktree list --porcelain | Select-String "worktree" | Select-Object -Skip 1 -First 1) -replace "worktree ", ""
            $script:CreatedWorktrees += @{ Branch = $branchName; Path = $worktreePath }
            
            # Verify branch exists
            $branches = git branch 2>$null
            $branchExists = $branches -match $branchName
            Write-TestResult -TestName "Branch created" -Success $branchExists
            
            # Verify directory exists
            $dirExists = Test-Path $worktreePath
            Write-TestResult -TestName "Directory created" -Success $dirExists
        }
    }
    
    # Test 2: Invalid branch name handling
    Test-Integration "Invalid branch name rejection" {
        $invalidName = "invalid branch name"
        
        # Run the script with invalid name
        $output = & $script:ScriptPath -BranchName $invalidName -RefreshInterval 0 2>&1
        $outputText = $output -join "`n"
        
        # Check for error message
        $hasError = $outputText -match "Invalid branch name"
        Write-TestResult -TestName "Shows error for invalid name" -Success $hasError
        
        # Verify worktree was NOT created
        $worktrees = git worktree list 2>$null
        $notCreated = -not ($worktrees -match "invalid branch name")
        Write-TestResult -TestName "Worktree not created" -Success $notCreated
    }
    
    # Test 3: Duplicate branch name handling
    Test-Integration "Duplicate branch name handling" {
        $branchName = "duplicate-test-$(Get-Random)"
        
        # Create first worktree
        $output1 = & $script:ScriptPath -BranchName $branchName -RefreshInterval 0 2>&1
        
        # Try to create duplicate
        $output2 = & $script:ScriptPath -BranchName $branchName -RefreshInterval 0 2>&1
        $outputText = $output2 -join "`n"
        
        # Check for error message
        $hasError = $outputText -match "already exists"
        Write-TestResult -TestName "Shows error for duplicate branch" -Success $hasError
        
        # Track for cleanup
        if (git worktree list -match $branchName) {
            $worktreePath = (git worktree list --porcelain | Select-String "worktree" | 
                Where-Object { $_ -notmatch "test-repo" } | Select-Object -First 1) -replace "worktree ", ""
            $script:CreatedWorktrees += @{ Branch = $branchName; Path = $worktreePath }
        }
    }
    
    # Test 4: Multiple worktrees
    Test-Integration "Multiple worktrees creation" {
        $branches = @(
            "multi-test-1-$(Get-Random)",
            "multi-test-2-$(Get-Random)",
            "multi-test-3-$(Get-Random)"
        )
        
        $createdCount = 0
        foreach ($branch in $branches) {
            $output = & $script:ScriptPath -BranchName $branch -RefreshInterval 0 2>&1
            
            if (git worktree list -match $branch) {
                $createdCount++
                $worktreePath = (git worktree list --porcelain | Select-String $branch -Context 0,1 | 
                    Select-String "worktree" | Select-Object -First 1) -replace ".*worktree ", ""
                $script:CreatedWorktrees += @{ Branch = $branch; Path = $worktreePath }
            }
        }
        
        Write-TestResult -TestName "All worktrees created" -Success ($createdCount -eq $branches.Count)
        
        # List all worktrees
        $allWorktrees = git worktree list 2>$null
        $worktreeCount = ($allWorktrees | Measure-Object).Count
        Write-TestResult -TestName "Correct number of worktrees" -Success ($worktreeCount -eq ($branches.Count + 1))
    }
    
    # Test 5: Worktree with special characters
    Test-Integration "Branch names with special characters" {
        $specialBranches = @(
            "feature/test-$(Get-Random)",
            "bugfix/JIRA-$(Get-Random)",
            "release-v1.0.$(Get-Random)"
        )
        
        foreach ($branch in $specialBranches) {
            $output = & $script:ScriptPath -BranchName $branch -RefreshInterval 0 2>&1
            
            $created = git worktree list -match $branch
            Write-TestResult -TestName "Created: $branch" -Success $created
            
            if ($created) {
                # Get the actual worktree path
                $worktreeInfo = git worktree list --porcelain | Select-String $branch -Context 0,1
                if ($worktreeInfo) {
                    $worktreePath = ($worktreeInfo | Select-String "^worktree" | Select-Object -First 1) -replace "worktree ", ""
                    $script:CreatedWorktrees += @{ Branch = $branch; Path = $worktreePath }
                }
            }
        }
    }
    
    # Test 6: Cleanup worktrees
    Test-Integration "Worktree cleanup" {
        $cleanupCount = 0
        $errorCount = 0
        
        foreach ($wt in $script:CreatedWorktrees) {
            try {
                if ($wt.Path -and (Test-Path $wt.Path)) {
                    git worktree remove $wt.Path --force 2>$null
                    if ($LASTEXITCODE -eq 0) {
                        $cleanupCount++
                    } else {
                        $errorCount++
                    }
                }
                
                # Also try to delete the branch
                git branch -D $wt.Branch 2>$null
            } catch {
                $errorCount++
            }
        }
        
        Write-TestResult -TestName "Worktrees cleaned up" -Success ($errorCount -eq 0)
        
        if ($Verbose) {
            Write-Host "   Cleaned up $cleanupCount worktrees" -ForegroundColor Gray
        }
    }
    
} finally {
    # Cleanup
    Cleanup-TestRepo
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