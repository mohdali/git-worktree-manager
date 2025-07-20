#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Advanced interactive mode tests for Git Worktree Manager
.DESCRIPTION
    Tests complex interactive scenarios with simulated keyboard inputs
#>

param(
    [switch]$Verbose
)

# Import test framework functions
. (Join-Path $PSScriptRoot "Test-WorktreeManager.ps1")

# Additional test functions for interactive mode
function Simulate-KeyboardInput {
    param(
        [string]$ScriptPath,
        [string[]]$KeySequence,
        [int]$RefreshInterval = 0
    )
    
    # Convert key sequences to actual input
    $inputMap = @{
        "UP" = "`e[A"
        "DOWN" = "`e[B"
        "ENTER" = "`r"
        "ESC" = "`e"
    }
    
    $inputs = $KeySequence | ForEach-Object {
        if ($inputMap.ContainsKey($_)) {
            $inputMap[$_]
        } else {
            $_
        }
    }
    
    return Invoke-ScriptWithInput -Arguments @("-RefreshInterval", $RefreshInterval) -Inputs $inputs
}

Write-Host "`nAdvanced Interactive Mode Tests" -ForegroundColor Magenta
Write-Host "===============================" -ForegroundColor Magenta

# Test 1: Navigation with arrow keys
Test-Function "Navigation - Arrow keys (simulated)" {
    # Create test worktrees first
    $branches = @("nav-test-1", "nav-test-2", "nav-test-3")
    $createdPaths = @()
    
    foreach ($branch in $branches) {
        git worktree add -b $branch "../$branch" 2>$null
        $createdPaths += "../$branch"
    }
    
    try {
        # Simulate: Down, Down, Enter (should select third worktree)
        # Note: Actual arrow key simulation is complex in PowerShell
        # This is a simplified version
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        # Verify all worktrees are shown
        $showsAll = $true
        foreach ($branch in $branches) {
            if ($output -notmatch $branch) {
                $showsAll = $false
                break
            }
        }
        
        Write-TestResult -TestName "Shows all worktrees for navigation" -Success $showsAll
        
    } finally {
        # Cleanup
        foreach ($i in 0..($branches.Count - 1)) {
            git worktree remove $createdPaths[$i] --force 2>$null
            git branch -D $branches[$i] 2>$null
        }
    }
}

# Test 2: Delete worktree with confirmation
Test-Function "Delete worktree - With confirmation" {
    # Create a test worktree
    $branchName = "delete-test-$(Get-Random)"
    git worktree add -b $branchName "../$branchName" 2>$null
    
    try {
        # Simulate: D (delete), y (confirm)
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("D", "y", "q")
        $output = $result.Output -join "`n"
        
        # Check for delete confirmation
        $hasDeletePrompt = $output -match "Delete Worktree Confirmation"
        $hasConfirmPrompt = $output -match "Are you sure you want to delete"
        
        Write-TestResult -TestName "Shows delete confirmation" -Success $hasDeletePrompt
        Write-TestResult -TestName "Shows confirmation prompt" -Success $hasConfirmPrompt
        
        # Verify worktree was deleted
        $worktrees = git worktree list 2>$null
        $stillExists = $worktrees | Select-String $branchName
        
        Write-TestResult -TestName "Worktree deleted after confirmation" -Success ($null -eq $stillExists)
        
    } finally {
        # Cleanup if still exists
        if (Test-Path "../$branchName") {
            git worktree remove "../$branchName" --force 2>$null
        }
        git branch -D $branchName 2>$null
    }
}

# Test 3: Delete worktree - Cancel
Test-Function "Delete worktree - Cancel deletion" {
    # Create a test worktree
    $branchName = "cancel-delete-$(Get-Random)"
    git worktree add -b $branchName "../$branchName" 2>$null
    
    try {
        # Simulate: D (delete), n (cancel)
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("D", "n", "q")
        $output = $result.Output -join "`n"
        
        # Check for cancellation message
        $hasCancelled = $output -match "Deletion cancelled"
        Write-TestResult -TestName "Shows cancellation message" -Success $hasCancelled
        
        # Verify worktree still exists
        $worktrees = git worktree list 2>$null
        $stillExists = $worktrees | Select-String $branchName
        
        Write-TestResult -TestName "Worktree not deleted on cancel" -Success ($null -ne $stillExists)
        
    } finally {
        # Cleanup
        git worktree remove "../$branchName" --force 2>$null
        git branch -D $branchName 2>$null
    }
}

# Test 4: Push branch functionality
Test-Function "Push branch - Local only branch" {
    # Create a test worktree without pushing
    $branchName = "push-test-$(Get-Random)"
    git worktree add -b $branchName "../$branchName" 2>$null
    
    try {
        # Make a commit in the worktree
        Push-Location "../$branchName"
        "test" | Out-File -FilePath "test.txt"
        git add .
        git commit -m "Test commit" --quiet
        Pop-Location
        
        # Simulate: p (push), q (quit)
        # Note: This will fail in test environment without remote
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("p", "", "q")
        $output = $result.Output -join "`n"
        
        # Check for push-related output
        $hasPushPrompt = $output -match "Pushing branch" -or $output -match "Current status"
        Write-TestResult -TestName "Shows push functionality" -Success $hasPushPrompt
        
    } finally {
        # Cleanup
        git worktree remove "../$branchName" --force 2>$null
        git branch -D $branchName 2>$null
    }
}

# Test 5: Empty worktree list
Test-Function "Empty worktree list - Create new" {
    # This test assumes we're in the main worktree
    # Remove all other worktrees first
    $worktrees = git worktree list --porcelain 2>$null
    $mainPath = (Get-Location).Path
    
    # Simulate empty list: n (new), branch name, q
    $newBranch = "empty-list-test-$(Get-Random)"
    $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("n", $newBranch, "q")
    $output = $result.Output -join "`n"
    
    # Check for empty list message
    $hasEmptyMessage = $output -match "No other worktrees found"
    Write-TestResult -TestName "Shows empty worktree message" -Success $hasEmptyMessage
    
    # Cleanup if created
    $worktrees = git worktree list 2>$null
    $created = $worktrees | Select-String $newBranch
    if ($created) {
        $worktreePath = ($created -split '\s+')[0]
        git worktree remove $worktreePath --force 2>$null
        git branch -D $newBranch 2>$null
    }
}

# Test 6: Status indicators in interactive mode
Test-Function "Status indicators - Modified files" {
    # Create a worktree with modifications
    $branchName = "status-test-$(Get-Random)"
    git worktree add -b $branchName "../$branchName" 2>$null
    
    try {
        # Make modifications
        Push-Location "../$branchName"
        "modified" | Out-File -FilePath "README.md"
        "new file" | Out-File -FilePath "new.txt"
        Pop-Location
        
        # Run and check status indicators
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("q")
        $output = $result.Output -join "`n"
        
        # Look for status indicators in output
        # Note: Status loading might be async, so this might not always show
        $hasStatusLine = $output -match "Status:"
        Write-TestResult -TestName "Shows status legend" -Success $hasStatusLine
        
    } finally {
        # Cleanup
        git worktree remove "../$branchName" --force 2>$null
        git branch -D $branchName 2>$null
    }
}

# Test 7: Open worktree functionality
Test-Function "Open worktree - VS Code launch" {
    # Create a test worktree
    $branchName = "open-test-$(Get-Random)"
    git worktree add -b $branchName "../$branchName" 2>$null
    
    try {
        # Simulate: o (open), any key to return, q
        $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("o", "", "q")
        $output = $result.Output -join "`n"
        
        # Check for open messages
        $hasOpenMessage = $output -match "Opening:" -or $output -match "VS Code"
        $hasReturnPrompt = $output -match "Press any key to return to menu"
        
        Write-TestResult -TestName "Shows open message" -Success $hasOpenMessage
        Write-TestResult -TestName "Shows return prompt" -Success $hasReturnPrompt
        
    } finally {
        # Cleanup
        git worktree remove "../$branchName" --force 2>$null
        git branch -D $branchName 2>$null
    }
}

# Summary for advanced tests
Write-Host "`nAdvanced test scenarios completed" -ForegroundColor Green