#!/usr/bin/env pwsh

param(
    [string]$BranchName = "",
    [int]$RefreshInterval = 30  # Status refresh interval in seconds (0 to disable)
)

# Helper function to generate random hash
function Get-RandomHash {
    return [System.Guid]::NewGuid().ToString("N").Substring(0, 8)
}

# Helper function to convert branch name to valid folder name
function ConvertTo-ValidFolderName {
    param([string]$BranchName)
    
    # Extract the last segment after '/' for complex branch names
    $folderName = $BranchName.Split('/')[-1]
    
    # Convert to kebab-case and remove invalid characters
    $folderName = $folderName -replace '[^a-zA-Z0-9\-_]', '-'
    $folderName = $folderName -replace '--+', '-'
    $folderName = $folderName.Trim('-')
    
    return $folderName
}

# Helper function to validate branch name
function Test-ValidBranchName {
    param([string]$BranchName)
    
    # Basic git branch name validation
    if ([string]::IsNullOrWhiteSpace($BranchName)) {
        return $false
    }
    
    # Check for invalid characters
    if ($BranchName -match '[\s~\^:\\?\*\[\]@\{]|\.\.|\.|/$|^/|@\{') {
        return $false
    }
    
    return $true
}

# Helper function to get cross-platform worktrees directory
function Get-WorktreesDirectory {
    if ($IsWindows) {
        return Join-Path $env:USERPROFILE ".worktrees"
    } else {
        return Join-Path $env:HOME ".worktrees"
    }
}

# Helper function to launch VS Code
function Start-VSCode {
    param([string]$Path)
    
    try {
        if (Get-Command code -ErrorAction SilentlyContinue) {
            Start-Process "code" -ArgumentList "`"$Path`"" -NoNewWindow
            Write-Host "VS Code launched in: $Path" -ForegroundColor Green
        } else {
            Write-Host "VS Code not found in PATH. Please install VS Code or ensure it's in your PATH." -ForegroundColor Red
        }
    } catch {
        Write-Host "Failed to launch VS Code: $_" -ForegroundColor Red
    }
}

# Helper function to get current directory
function Get-CurrentDirectory {
    return (Get-Location).Path
}

# Global status cache
$global:StatusCache = @{}

# Helper function to check git status in worktree (cached and fast)
function Get-WorktreeStatus {
    param([string]$WorktreePath)
    
    # Check cache first
    if ($global:StatusCache.ContainsKey($WorktreePath)) {
        return $global:StatusCache[$WorktreePath]
    }
    
    # Fast status check with minimal git operations
    $currentDir = Get-Location
    try {
        Set-Location $WorktreePath
        
        # Single git command for file status
        $statusOutput = git status --porcelain 2>$null
        $hasChanges = -not [string]::IsNullOrWhiteSpace($statusOutput)
        
        # Quick count of different types
        $added = 0; $modified = 0; $deleted = 0; $untracked = 0
        
        if ($hasChanges) {
            # Count without detailed parsing for speed
            $added = ($statusOutput | Select-String "^A" | Measure-Object).Count
            $modified = ($statusOutput | Select-String "^M|^ M" | Measure-Object).Count
            $deleted = ($statusOutput | Select-String "^D|^ D" | Measure-Object).Count
            $untracked = ($statusOutput | Select-String "^\?\?" | Measure-Object).Count
        }
        
        # Simple branch check
        $branchName = git rev-parse --abbrev-ref HEAD 2>$null
        $remoteExists = $false
        $aheadCount = 0
        $behindCount = 0
        
        # Only check remote if branch exists
        if ($branchName -and $branchName -ne "HEAD") {
            # Fast check for remote existence
            $remoteRef = git show-ref "refs/remotes/origin/$branchName" 2>$null
            $remoteExists = -not [string]::IsNullOrWhiteSpace($remoteRef)
            
            if ($remoteExists) {
                # Quick ahead/behind check
                $revList = git rev-list --count --left-right "origin/$branchName...HEAD" 2>$null
                if ($revList) {
                    $counts = $revList.Split("`t")
                    if ($counts.Length -eq 2) {
                        $behindCount = [int]$counts[0]
                        $aheadCount = [int]$counts[1]
                    }
                }
            }
        }
        
        $status = @{
            HasUncommittedChanges = $hasChanges
            BranchName = $branchName
            RemoteExists = $remoteExists
            IsAhead = $aheadCount -gt 0
            IsBehind = $behindCount -gt 0
            AheadCount = $aheadCount
            BehindCount = $behindCount
            Added = $added
            Modified = $modified
            Deleted = $deleted
            Untracked = $untracked
        }
        
        # Cache the result
        $global:StatusCache[$WorktreePath] = $status
        return $status
        
    } finally {
        Set-Location $currentDir
    }
}

# Helper function to format git status indicators (icons and digits only)
function Get-StatusIndicators {
    param([hashtable]$Status)
    
    $indicators = @()
    
    # File changes with icons
    if ($Status.Added -gt 0) { $indicators += "+$($Status.Added)" }
    if ($Status.Modified -gt 0) { $indicators += "~$($Status.Modified)" }
    if ($Status.Deleted -gt 0) { $indicators += "-$($Status.Deleted)" }
    if ($Status.Untracked -gt 0) { $indicators += "?$($Status.Untracked)" }
    
    # Remote status with icons
    if (-not $Status.RemoteExists) {
        $indicators += "⚠️"
    } else {
        if ($Status.AheadCount -gt 0) { $indicators += "↑$($Status.AheadCount)" }
        if ($Status.BehindCount -gt 0) { $indicators += "↓$($Status.BehindCount)" }
    }
    
    if ($indicators.Count -eq 0) {
        return "✓"
    }
    
    return $indicators -join " "
}

# Helper function to clear status cache
function Clear-StatusCache {
    $global:StatusCache.Clear()
}

# Helper function to push branch to remote
function Push-WorktreeBranch {
    param([string]$WorktreePath, [string]$BranchName)
    
    $currentDir = Get-Location
    try {
        Set-Location $WorktreePath
        
        Write-Host "Pushing branch '$BranchName' to remote..." -ForegroundColor Cyan
        
        # Push branch, creating remote branch if it doesn't exist
        $pushOutput = git push -u origin $BranchName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully pushed '$BranchName' to remote!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "Failed to push branch: $pushOutput" -ForegroundColor Red
            return $false
        }
    } finally {
        Set-Location $currentDir
    }
}

# Helper function to delete worktree
function Remove-WorktreeWithConfirmation {
    param($Worktree)
    
    if ($null -eq $Worktree -or [string]::IsNullOrWhiteSpace($Worktree.Path)) {
        Write-Host "❌ Error: Worktree object or path is null or empty!" -ForegroundColor Red
        Write-Host "Cannot proceed with deletion." -ForegroundColor Red
        Write-Host ""
        Write-Host "Press any key to continue..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return $false
    }
    
    $status = Get-WorktreeStatus -WorktreePath $Worktree.Path
    
    Clear-Host
    Write-Host "Delete Worktree Confirmation" -ForegroundColor Red
    Write-Host "============================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Branch: $($Worktree.Branch)" -ForegroundColor White
    Write-Host "Path: $($Worktree.Path)" -ForegroundColor White
    Write-Host ""
    
    # Show status warnings
    $hasWarnings = $false
    if ($status.HasUncommittedChanges) {
        Write-Host "⚠️  WARNING: This worktree has uncommitted changes!" -ForegroundColor Yellow
        $hasWarnings = $true
    }
    
    if (-not $status.RemoteExists) {
        Write-Host "⚠️  WARNING: This branch does not exist on remote!" -ForegroundColor Yellow
        $hasWarnings = $true
    } elseif ($status.IsAhead) {
        Write-Host "⚠️  WARNING: This branch has unpushed commits!" -ForegroundColor Yellow
        $hasWarnings = $true
    }
    
    if ($hasWarnings) {
        Write-Host ""
        Write-Host "Deleting this worktree will permanently remove:" -ForegroundColor Red
        Write-Host "- All uncommitted changes" -ForegroundColor Red
        Write-Host "- The local branch and worktree directory" -ForegroundColor Red
        Write-Host ""
    }
    
    Write-Host "Are you sure you want to delete this worktree? (y/N): " -ForegroundColor Red -NoNewline
    $confirmation = Read-Host
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        try {
            Write-Host "Deleting worktree..." -ForegroundColor Yellow
            Write-Host ""
            
            # Step 1: Try to remove the worktree with git
            Write-Host "Step 1: Removing git worktree..." -ForegroundColor Cyan
            Write-Host "Worktree path: '$($Worktree.Path)'" -ForegroundColor Gray
            
            # Validate that we have a valid path
            if ([string]::IsNullOrWhiteSpace($Worktree.Path)) {
                Write-Host "❌ Error: Worktree path is null or empty!" -ForegroundColor Red
                Write-Host "Worktree object: $($Worktree | ConvertTo-Json)" -ForegroundColor Red
                Write-Host ""
                Write-Host "Press any key to continue..." -ForegroundColor Cyan
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                return $false
            }
            
            $gitOutput = git worktree remove "$($Worktree.Path)" --force 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Git worktree removed successfully!" -ForegroundColor Green
                return $true
            } else {
                Write-Host "❌ Git worktree removal failed:" -ForegroundColor Red
                Write-Host $gitOutput -ForegroundColor Red
                Write-Host ""
                Write-Host "Press any key to continue with alternative cleanup methods..." -ForegroundColor Cyan
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                Write-Host ""
                
                # Step 2: Try alternative approach - force remove with filesystem cleanup
                Write-Host "Step 2: Attempting force removal with filesystem cleanup..." -ForegroundColor Cyan
                
                # First try to unlock any locked files (Windows-specific)
                if ($IsWindows) {
                    Write-Host "Attempting to unlock files (Windows)..." -ForegroundColor Yellow
                    try {
                        # Remove read-only attributes recursively
                        if (-not [string]::IsNullOrWhiteSpace($Worktree.Path) -and (Test-Path $Worktree.Path)) {
                            Get-ChildItem $Worktree.Path -Recurse -Force | ForEach-Object {
                                try {
                                    $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
                                } catch {
                                    # Ignore individual file errors
                                }
                            }
                        }
                    } catch {
                        Write-Host "Warning: Could not unlock all files: $_" -ForegroundColor Yellow
                    }
                }
                
                # Try git worktree remove again
                $gitOutput2 = git worktree remove "$($Worktree.Path)" --force 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Git worktree removed successfully after unlock!" -ForegroundColor Green
                    return $true
                } else {
                    Write-Host "❌ Git worktree removal still failed:" -ForegroundColor Red
                    Write-Host $gitOutput2 -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Press any key to continue with manual cleanup..." -ForegroundColor Cyan
                    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                    Write-Host ""
                    
                    # Step 3: Manual cleanup if git removal fails
                    Write-Host "Step 3: Manual cleanup..." -ForegroundColor Cyan
                    
                    # Try to remove the directory manually
                    if (-not [string]::IsNullOrWhiteSpace($Worktree.Path) -and (Test-Path $Worktree.Path)) {
                        try {
                            Write-Host "Attempting to remove directory: $($Worktree.Path)" -ForegroundColor Yellow
                            Remove-Item $Worktree.Path -Recurse -Force -ErrorAction Stop
                            Write-Host "✅ Directory removed successfully!" -ForegroundColor Green
                            
                            # Clean up git worktree list
                            Write-Host "Cleaning up git worktree list..." -ForegroundColor Yellow
                            git worktree prune 2>$null
                            
                            Write-Host "✅ Worktree cleanup completed!" -ForegroundColor Green
                            return $true
                        } catch {
                            Write-Host "❌ Failed to remove directory manually:" -ForegroundColor Red
                            Write-Host $_.Exception.Message -ForegroundColor Red
                            Write-Host ""
                            Write-Host "Manual steps required:" -ForegroundColor Yellow
                            Write-Host "1. Close any applications using files in: $($Worktree.Path)" -ForegroundColor Yellow
                            Write-Host "2. Run: git worktree remove `"$($Worktree.Path)`" --force" -ForegroundColor Yellow
                            Write-Host "3. If that fails, manually delete: $($Worktree.Path)" -ForegroundColor Yellow
                            Write-Host "4. Then run: git worktree prune" -ForegroundColor Yellow
                            Write-Host ""
                            Write-Host "Press any key to continue..." -ForegroundColor Cyan
                            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                            return $false
                        }
                    } else {
                        Write-Host "✅ Directory already removed, cleaning up git worktree list..." -ForegroundColor Green
                        git worktree prune 2>$null
                        return $true
                    }
                }
            }
        } catch {
            Write-Host "❌ Unexpected error during worktree deletion:" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            Write-Host ""
            Write-Host "Stack trace:" -ForegroundColor Red
            Write-Host $_.ScriptStackTrace -ForegroundColor Red
            Write-Host ""
            Write-Host "Press any key to continue..." -ForegroundColor Cyan
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            return $false
        }
    } else {
        Write-Host "Deletion cancelled." -ForegroundColor Yellow
        return $false
    }
}

# Helper function to show confirmation dialog
function Show-ConfirmationDialog {
    param([string]$Message, [string]$Title = "Confirmation")
    
    Write-Host "$Title" -ForegroundColor Yellow
    Write-Host ("=" * $Title.Length) -ForegroundColor Yellow
    Write-Host ""
    Write-Host "$Message (y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    
    return ($response -eq 'y' -or $response -eq 'Y')
}

# Helper function to display worktree menu with selection
function Show-WorktreeList {
    param(
        [array]$Worktrees,
        [int]$SelectedIndex,
        [int]$StartLine = 0,
        [bool]$LoadStatus = $false
    )
    
    if ($StartLine -eq 0) {
        Clear-Host
        Write-Host "Git Worktree Manager" -ForegroundColor Cyan
        Write-Host "===================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "↑/↓: Navigate | Enter/o: Open | p: Push | D: Delete | n: New | Esc/q: Quit" -ForegroundColor Yellow
        if ($global:RefreshEnabled) {
            Write-Host "Status refresh: every $($global:RefreshInterval)s" -ForegroundColor DarkGray
        } else {
            Write-Host "Status refresh: disabled" -ForegroundColor DarkGray
        }
        Write-Host ""
        Write-Host "Available worktrees:" -ForegroundColor Green
        Write-Host ""
        $StartLine = 9  # Updated to account for refresh status line
    }
    
    # Set cursor position to start of worktree list
    $Host.UI.RawUI.CursorPosition = @{X=0; Y=$StartLine}
    
    # Build the entire display as a single string to minimize flicker
    $display = ""
    for ($i = 0; $i -lt $Worktrees.Count; $i++) {
        $wt = $Worktrees[$i]
        $shortHash = $wt.Hash.Substring(0, 7)
        
        # Only load status if requested or if cached
        $statusIndicators = ""
        if ($LoadStatus -or $global:StatusCache.ContainsKey($wt.Path)) {
            $status = Get-WorktreeStatus -WorktreePath $wt.Path
            $statusIndicators = " [$(Get-StatusIndicators -Status $status)]"
        }
        
        if ($i -eq $SelectedIndex) {
            # Highlight selected item
            $display += "`e[7m► $($wt.Branch) ($shortHash)$statusIndicators`e[0m`n"
            $display += "`e[7m  Path: $($wt.Path)`e[0m`n"
        } else {
            $display += "  $($wt.Branch) ($shortHash)$statusIndicators`n"
            $display += "  Path: $($wt.Path)`n"
        }
        $display += "`n"
    }
    
    # Clear the rest of the screen from cursor position
    $display += "`e[0J"
    
    # Write the entire display at once
    Write-Host $display -NoNewline
}

# Helper function to load status in background
function Start-StatusUpdate {
    param([array]$Worktrees, [int]$SelectedIndex, [int]$StartLine)
    
    # Save current cursor position
    $savedPosition = $Host.UI.RawUI.CursorPosition
    
    # Show refresh indicator
    $Host.UI.RawUI.CursorPosition = @{X=0; Y=6}
    Write-Host "Refreshing status... " -ForegroundColor DarkGray -NoNewline
    
    # Load status for all worktrees in background
    $refreshCount = 0
    for ($i = 0; $i -lt $Worktrees.Count; $i++) {
        $wt = $Worktrees[$i]
        # Force refresh by removing from cache first
        if ($global:StatusCache.ContainsKey($wt.Path)) {
            $global:StatusCache.Remove($wt.Path)
        }
        $null = Get-WorktreeStatus -WorktreePath $wt.Path
        $refreshCount++
        
        # Update progress indicator
        if ($refreshCount % 2 -eq 0) {
            $Host.UI.RawUI.CursorPosition = @{X=20; Y=6}
            Write-Host "[$refreshCount/$($Worktrees.Count)]" -ForegroundColor DarkGray -NoNewline
        }
    }
    
    # Clear refresh indicator
    $Host.UI.RawUI.CursorPosition = @{X=0; Y=6}
    Write-Host "                                        " -NoNewline
    
    # Restore cursor position
    $Host.UI.RawUI.CursorPosition = $savedPosition
    
    # Refresh display with loaded status
    Show-WorktreeList -Worktrees $Worktrees -SelectedIndex $SelectedIndex -StartLine $StartLine -LoadStatus $true
}

# Interactive mode - list existing worktrees with keyboard navigation
function Show-WorktreeMenu {
    Write-Host "Git Worktree Manager" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    Write-Host ""
    
    # Get worktree list
    try {
        $worktreeOutput = git worktree list --porcelain 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Not in a git repository or git worktree command failed." -ForegroundColor Red
            return
        }
    } catch {
        Write-Host "Error: Git command failed. Make sure git is installed and you're in a git repository." -ForegroundColor Red
        return
    }
    
    # Parse worktree output
    $worktrees = @()
    $currentWorktree = @{}
    $currentDir = Get-CurrentDirectory
    
    foreach ($line in $worktreeOutput) {
        if ($line -match '^worktree (.+)$') {
            if ($currentWorktree.Count -gt 0) {
                $worktrees += $currentWorktree
            }
            $currentWorktree = @{
                Path = $matches[1]
                Branch = ""
                Hash = ""
            }
        } elseif ($line -match '^HEAD (.+)$') {
            $currentWorktree.Hash = $matches[1]
        } elseif ($line -match '^branch (.+)$') {
            $currentWorktree.Branch = $matches[1] -replace '^refs/heads/', ''
        }
    }
    
    # Add the last worktree
    if ($currentWorktree.Count -gt 0) {
        $worktrees += $currentWorktree
    }
    
    # Filter out current directory (handle both Windows and Linux path formats)
    $otherWorktrees = @($worktrees | Where-Object { 
        $normalizedWorktreePath = $_.Path.TrimEnd('\', '/').Replace('\', '/').ToLower()
        $normalizedCurrentDir = $currentDir.TrimEnd('\', '/').Replace('\', '/').ToLower()
        $normalizedWorktreePath -ne $normalizedCurrentDir
    })
    
    if ($otherWorktrees.Count -eq 0) {
        Write-Host "No other worktrees found." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press 'n' to create a new worktree, or 'q' to quit." -ForegroundColor Cyan
        
        # Handle empty worktree list navigation
        do {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            
            if ($key.VirtualKeyCode -eq 78) { # n key (New worktree)
                Clear-Host
                Write-Host "Create New Worktree" -ForegroundColor Cyan
                Write-Host "===================" -ForegroundColor Cyan
                Write-Host ""
                Write-Host "Enter branch name for new worktree:" -ForegroundColor Yellow
                Write-Host "(Examples: feature/new-feature, bugfix/login-issue, hotfix/security-patch)" -ForegroundColor Gray
                Write-Host ""
                
                $branchName = Read-Host "Branch name"
                
                if ([string]::IsNullOrWhiteSpace($branchName)) {
                    Write-Host ""
                    Write-Host "❌ Branch name cannot be empty!" -ForegroundColor Red
                    Write-Host "Press any key to continue..." -ForegroundColor Cyan
                    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                    
                    # Return to empty state
                    Clear-Host
                    Write-Host "Git Worktree Manager" -ForegroundColor Cyan
                    Write-Host "===================" -ForegroundColor Cyan
                    Write-Host ""
                    Write-Host "No other worktrees found." -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "Press 'n' to create a new worktree, or 'q' to quit." -ForegroundColor Cyan
                } else {
                    Write-Host ""
                    Write-Host "Creating new worktree with branch: '$branchName'" -ForegroundColor Cyan
                    
                    $createResult = New-Worktree -BranchName $branchName
                    
                    Write-Host ""
                    Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
                    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                    
                    if ($createResult) {
                        # Restart the menu to show the new worktree
                        Show-WorktreeMenu
                        return
                    } else {
                        # Return to empty state
                        Clear-Host
                        Write-Host "Git Worktree Manager" -ForegroundColor Cyan
                        Write-Host "===================" -ForegroundColor Cyan
                        Write-Host ""
                        Write-Host "No other worktrees found." -ForegroundColor Yellow
                        Write-Host ""
                        Write-Host "Press 'n' to create a new worktree, or 'q' to quit." -ForegroundColor Cyan
                    }
                }
            }
            elseif ($key.VirtualKeyCode -eq 81 -or $key.VirtualKeyCode -eq 27) { # q key or Escape
                Clear-Host
                Write-Host "Exiting..." -ForegroundColor Yellow
                return
            }
        } while ($true)
    }
    
    # Initialize selection
    $selectedIndex = 0
    $startLine = 9  # Updated to account for refresh status line
    
    # Display initial menu without status (fast)
    Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
    
    # Start background status loading
    Start-Job -ScriptBlock {
        param($Worktrees, $SelectedIndex, $StartLine)
        
        # Load status for all worktrees
        for ($i = 0; $i -lt $Worktrees.Count; $i++) {
            $wt = $Worktrees[$i]
            # Status loading logic would go here
            Start-Sleep -Milliseconds 50  # Small delay to prevent blocking
        }
    } -ArgumentList $otherWorktrees, $selectedIndex, $startLine | Out-Null
    
    # Load status in background after a short delay
    Start-Sleep -Milliseconds 100
    Start-StatusUpdate -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine $startLine
    
    # Setup periodic status refresh timer
    $global:LastRefreshTime = [DateTime]::Now
    $global:RefreshInterval = $RefreshInterval  # Use parameter value
    $global:PendingRefresh = $false
    $global:RefreshEnabled = $RefreshInterval -gt 0
    
    # Handle keyboard navigation
    $refreshNeeded = $false
    do {
        # Check if we need to refresh status (non-blocking)
        if ($global:RefreshEnabled -and ([DateTime]::Now - $global:LastRefreshTime).TotalSeconds -ge $global:RefreshInterval) {
            $global:PendingRefresh = $true
            $global:LastRefreshTime = [DateTime]::Now
        }
        
        # Check for keyboard input with timeout
        $keyAvailable = $Host.UI.RawUI.KeyAvailable
        
        if ($keyAvailable) {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        } elseif ($global:PendingRefresh) {
            # No key pressed and refresh is pending - do background refresh
            $global:PendingRefresh = $false
            
            # Clear status cache to force refresh
            Clear-StatusCache
            
            # Update status for all worktrees in background
            Start-StatusUpdate -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine $startLine
            
            # Small delay to allow UI to update
            Start-Sleep -Milliseconds 100
            continue
        } else {
            # No key pressed and no refresh pending - small delay to prevent CPU spinning
            Start-Sleep -Milliseconds 100
            continue
        }
        
        # Reset refresh timer on any key press
        $global:LastRefreshTime = [DateTime]::Now
        
        # Debug output (temporary)
        # Write-Host "DEBUG: VirtualKeyCode=$($key.VirtualKeyCode), KeyChar='$($key.KeyChar)', Character='$($key.Character)'" -ForegroundColor Magenta
        
        # Handle all keys using VirtualKeyCode and Character combined
        if ($key.VirtualKeyCode -eq 38) { # Up arrow
            if ($selectedIndex -gt 0) {
                $selectedIndex--
                Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine $startLine
            }
        }
        elseif ($key.VirtualKeyCode -eq 40) { # Down arrow
            if ($selectedIndex -lt ($otherWorktrees.Count - 1)) {
                $selectedIndex++
                Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine $startLine
            }
        }
        elseif ($key.VirtualKeyCode -eq 13) { # Enter
            $selectedWorktree = $otherWorktrees[$selectedIndex]
            Clear-Host
            Write-Host "Opening: $($selectedWorktree.Branch) at $($selectedWorktree.Path)" -ForegroundColor Green
            Start-VSCode -Path $selectedWorktree.Path
            
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            
            # Refresh the display and continue
            Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
        }
        elseif ($key.VirtualKeyCode -eq 27) { # Escape
            Clear-Host
            Write-Host "Exiting..." -ForegroundColor Yellow
            return
        }
        elseif ($key.VirtualKeyCode -eq 79) { # o key (Open) - VirtualKeyCode 79
            $selectedWorktree = $otherWorktrees[$selectedIndex]
            Clear-Host
            Write-Host "Opening: $($selectedWorktree.Branch) at $($selectedWorktree.Path)" -ForegroundColor Green
            Start-VSCode -Path $selectedWorktree.Path
            
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            
            # Refresh the display and continue
            Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
        }
        elseif ($key.VirtualKeyCode -eq 80) { # p key (Push) - VirtualKeyCode 80
            $selectedWorktree = $otherWorktrees[$selectedIndex]
            Clear-Host
            Write-Host "Pushing branch: $($selectedWorktree.Branch)" -ForegroundColor Cyan
            Write-Host "Path: $($selectedWorktree.Path)" -ForegroundColor Gray
            Write-Host ""
            
            # Show current status before push
            $prePushStatus = Get-WorktreeStatus -WorktreePath $selectedWorktree.Path
            Write-Host "Current status: $(Get-StatusIndicators -Status $prePushStatus)" -ForegroundColor Yellow
            Write-Host ""
            
            $pushResult = Push-WorktreeBranch -WorktreePath $selectedWorktree.Path -BranchName $selectedWorktree.Branch
            
            # Clear cache and show updated status after push
            $global:StatusCache.Remove($selectedWorktree.Path)
            Write-Host ""
            $postPushStatus = Get-WorktreeStatus -WorktreePath $selectedWorktree.Path
            Write-Host "Updated status: $(Get-StatusIndicators -Status $postPushStatus)" -ForegroundColor Green
            
            if ($pushResult) {
                Write-Host ""
                Write-Host "✅ Push completed successfully!" -ForegroundColor Green
                if ($postPushStatus.AheadCount -eq 0 -and $postPushStatus.RemoteExists) {
                    Write-Host "✅ Branch is now synchronized with remote" -ForegroundColor Green
                }
            } else {
                Write-Host ""
                Write-Host "❌ Push failed. Check the error message above." -ForegroundColor Red
            }
            
            Write-Host ""
            Write-Host "Press any key to continue..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            
            # Refresh the display
            Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
        }
        elseif ($key.VirtualKeyCode -eq 68) { # D key (Delete - capital D) - VirtualKeyCode 68
            # Ensure we have a proper array (Windows PowerShell compatibility)
            if ($otherWorktrees -isnot [array]) {
                $otherWorktrees = @($otherWorktrees)
            }
            
            if ($selectedIndex -ge 0 -and $selectedIndex -lt $otherWorktrees.Count) {
                $selectedWorktree = $otherWorktrees[$selectedIndex]
                $deleteResult = Remove-WorktreeWithConfirmation -Worktree $selectedWorktree
            } else {
                Write-Host "Error: Selected index is out of bounds!" -ForegroundColor Red
                Write-Host "Press any key to continue..." -ForegroundColor Cyan
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                continue
            }
            
            if ($deleteResult) {
                # Set a flag to refresh the worktree list
                $refreshNeeded = $true
                break
            } else {
                Write-Host ""
                Write-Host "Press any key to continue..." -ForegroundColor Yellow
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                
                # Refresh the display
                Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
            }
        }
        elseif ($key.VirtualKeyCode -eq 78) { # n key (New worktree) - VirtualKeyCode 78
            Clear-Host
            Write-Host "Create New Worktree" -ForegroundColor Cyan
            Write-Host "===================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Enter branch name for new worktree:" -ForegroundColor Yellow
            Write-Host "(Examples: feature/new-feature, bugfix/login-issue, hotfix/security-patch)" -ForegroundColor Gray
            Write-Host ""
            
            $branchName = Read-Host "Branch name"
            
            if ([string]::IsNullOrWhiteSpace($branchName)) {
                Write-Host ""
                Write-Host "❌ Branch name cannot be empty!" -ForegroundColor Red
                Write-Host "Press any key to continue..." -ForegroundColor Cyan
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                
                # Refresh the display
                Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
            } else {
                Write-Host ""
                Write-Host "Creating new worktree with branch: '$branchName'" -ForegroundColor Cyan
                
                $createResult = New-Worktree -BranchName $branchName
                
                Write-Host ""
                Write-Host "Press any key to return to menu..." -ForegroundColor Cyan
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                
                if ($createResult) {
                    # Set a flag to refresh the worktree list
                    $refreshNeeded = $true
                    break
                } else {
                    # Refresh the display
                    Show-WorktreeList -Worktrees $otherWorktrees -SelectedIndex $selectedIndex -StartLine 0
                }
            }
        }
        elseif ($key.VirtualKeyCode -eq 81) { # q key (Quit) - VirtualKeyCode 81
            Clear-Host
            Write-Host "Exiting..." -ForegroundColor Yellow
            return
        }
    } while ($true)
    
    # Handle refresh after successful worktree creation
    if ($refreshNeeded) {
        Clear-Host
        Write-Host "Refreshing worktree list..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
        Show-WorktreeMenu
    }
}

# Create new worktree mode
function New-Worktree {
    param([string]$BranchName)
    
    # Validate branch name
    if (-not (Test-ValidBranchName -BranchName $BranchName)) {
        Write-Host "Error: Invalid branch name '$BranchName'" -ForegroundColor Red
        Write-Host "Branch names cannot contain spaces, special characters like ~^:?*[]{}, or start/end with '/'" -ForegroundColor Red
        return $false
    }
    
    # Get worktrees directory
    $worktreesDir = Get-WorktreesDirectory
    
    # Create worktrees directory if it doesn't exist
    if (-not (Test-Path $worktreesDir)) {
        try {
            New-Item -ItemType Directory -Path $worktreesDir -Force | Out-Null
            Write-Host "Created worktrees directory: $worktreesDir" -ForegroundColor Green
        } catch {
            Write-Host "Error: Failed to create worktrees directory: $_" -ForegroundColor Red
            return $false
        }
    }
    
    # Generate folder name
    $folderName = ConvertTo-ValidFolderName -BranchName $BranchName
    $randomHash = Get-RandomHash
    $worktreeFolderName = "$folderName`_$randomHash"
    $worktreePath = Join-Path $worktreesDir $worktreeFolderName
    
    # Check if worktree path already exists
    if (Test-Path $worktreePath) {
        Write-Host "Error: Worktree path already exists: $worktreePath" -ForegroundColor Red
        return $false
    }
    
    # Create the worktree
    try {
        Write-Host "Creating worktree '$BranchName' at: $worktreePath" -ForegroundColor Cyan
        Write-Host "[DEBUG] Using enhanced error handling v2.0" -ForegroundColor Magenta
        
        # Capture both stdout and stderr from git command
        $gitOutput = git worktree add -b $BranchName $worktreePath 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host ""
            Write-Host "❌ Failed to create worktree!" -ForegroundColor Red
            Write-Host "Git error output:" -ForegroundColor Red
            Write-Host $gitOutput -ForegroundColor Red
            Write-Host ""
            Write-Host "Common causes:" -ForegroundColor Yellow
            Write-Host "- Branch name already exists" -ForegroundColor Yellow
            Write-Host "- Not in a git repository" -ForegroundColor Yellow
            Write-Host "- Invalid branch name characters" -ForegroundColor Yellow
            Write-Host "- Permission issues with target directory" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Press any key to continue..." -ForegroundColor Cyan
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            return $false
        }
        
        Write-Host "Worktree created successfully!" -ForegroundColor Green
        Write-Host "Branch: $BranchName" -ForegroundColor White
        Write-Host "Path: $worktreePath" -ForegroundColor White
        Write-Host ""
        
        # Launch VS Code
        Start-VSCode -Path $worktreePath
        
        return $true
        
    } catch {
        Write-Host "Error: Failed to create worktree: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Press any key to continue..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        return $false
    }
}

# Main script logic
if ([string]::IsNullOrWhiteSpace($BranchName)) {
    # Interactive mode
    Show-WorktreeMenu
} else {
    # Create new worktree mode
    New-Worktree -BranchName $BranchName
}