# Git Worktree Manager Setup Instructions

This guide will help you set up the `gwm` alias for the Git Worktree Manager script across different platforms.

## 🖥️ Windows Setup

### Method 1: PowerShell Profile (Recommended)

1. **Open PowerShell as Administrator**
2. **Check if you have a PowerShell profile:**
   ```powershell
   Test-Path $PROFILE
   ```

3. **If it returns `False`, create the profile:**
   ```powershell
   New-Item -Path $PROFILE -Type File -Force
   ```

4. **Edit your PowerShell profile:**
   ```powershell
   notepad $PROFILE
   ```

5. **Add the alias to your profile:**
   ```powershell
   # Git Worktree Manager alias
   function gwm {
       param([string]$BranchName = "")
       
       $scriptPath = "C:\path\to\your\manage-worktrees.ps1"
       
       if ([string]::IsNullOrWhiteSpace($BranchName)) {
           & $scriptPath
       } else {
           & $scriptPath -BranchName $BranchName
       }
   }
   ```

6. **Update the script path** in the function above to match your actual script location

7. **Reload your profile:**
   ```powershell
   . $PROFILE
   ```

### Method 2: System-wide Alias (Alternative)

1. **Copy the script to a system directory:**
   ```powershell
   Copy-Item "manage-worktrees.ps1" -Destination "C:\Windows\System32\gwm.ps1"
   ```

2. **Create a batch file wrapper:**
   ```batch
   @echo off
   powershell -ExecutionPolicy Bypass -File "C:\Windows\System32\gwm.ps1" %*
   ```

3. **Save as `gwm.bat` in `C:\Windows\System32\`**

## 🐧 Linux / WSL Setup

### Method 1: Shell Function (Recommended)

1. **Edit your shell profile:**
   ```bash
   # For bash
   nano ~/.bashrc
   
   # For zsh
   nano ~/.zshrc
   
   # For fish
   nano ~/.config/fish/config.fish
   ```

2. **Add the alias function:**
   ```bash
   # Git Worktree Manager alias
   gwm() {
       local script_path="/path/to/your/manage-worktrees.ps1"
       
       if [ -z "$1" ]; then
           pwsh "$script_path"
       else
           pwsh "$script_path" -BranchName "$1"
       fi
   }
   ```

3. **Update the script path** to match your actual script location

4. **Reload your shell configuration:**
   ```bash
   # For bash
   source ~/.bashrc
   
   # For zsh
   source ~/.zshrc
   
   # For fish
   source ~/.config/fish/config.fish
   ```

### Method 2: Symbolic Link (Alternative)

1. **Make the script executable:**
   ```bash
   chmod +x /path/to/your/manage-worktrees.ps1
   ```

2. **Create a wrapper script:**
   ```bash
   sudo nano /usr/local/bin/gwm
   ```

3. **Add the wrapper content:**
   ```bash
   #!/bin/bash
   pwsh "/path/to/your/manage-worktrees.ps1" "$@"
   ```

4. **Make it executable:**
   ```bash
   sudo chmod +x /usr/local/bin/gwm
   ```

## 🍎 macOS Setup

### Method 1: Shell Function (Recommended)

1. **Edit your shell profile:**
   ```bash
   # For bash (default on older macOS)
   nano ~/.bash_profile
   
   # For zsh (default on macOS Catalina+)
   nano ~/.zshrc
   ```

2. **Add the alias function:**
   ```bash
   # Git Worktree Manager alias
   gwm() {
       local script_path="/path/to/your/manage-worktrees.ps1"
       
       if [ -z "$1" ]; then
           pwsh "$script_path"
       else
           pwsh "$script_path" -BranchName "$1"
       fi
   }
   ```

3. **Update the script path** to match your actual script location

4. **Reload your shell configuration:**
   ```bash
   # For bash
   source ~/.bash_profile
   
   # For zsh
   source ~/.zshrc
   ```

### Method 2: Homebrew Path (Alternative)

1. **Install PowerShell via Homebrew (if not already installed):**
   ```bash
   brew install powershell
   ```

2. **Create a wrapper script:**
   ```bash
   sudo nano /usr/local/bin/gwm
   ```

3. **Add the wrapper content:**
   ```bash
   #!/bin/bash
   pwsh "/path/to/your/manage-worktrees.ps1" "$@"
   ```

4. **Make it executable:**
   ```bash
   sudo chmod +x /usr/local/bin/gwm
   ```

## 📋 Prerequisites

### PowerShell Installation

- **Windows**: PowerShell is pre-installed
- **Linux**: Install PowerShell:
  ```bash
  # Ubuntu/Debian
  sudo apt update && sudo apt install -y powershell
  
  # CentOS/RHEL/Fedora
  sudo dnf install -y powershell
  
  # Arch Linux
  yay -S powershell-bin
  ```
- **macOS**: Install PowerShell:
  ```bash
  brew install powershell
  ```

### Git Installation

Ensure Git is installed and accessible from the command line:
```bash
git --version
```

## 🚀 Usage Examples

After setup, you can use the `gwm` alias:

```bash
# Interactive mode
gwm

# Create new worktree
gwm feature/new-feature
gwm bugfix/login-issue
gwm "hotfix/security patch"
```

## 🔧 Troubleshooting

### Common Issues

1. **"gwm: command not found"**
   - Check that you've reloaded your shell profile
   - Verify the script path is correct
   - Ensure the script file exists and is accessible

2. **"PowerShell not found"**
   - Install PowerShell using the instructions above
   - Verify installation with `pwsh --version`

3. **"Execution policy" errors (Windows)**
   - Run PowerShell as Administrator
   - Execute: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

4. **Permission denied (Linux/macOS)**
   - Make sure the script is executable: `chmod +x manage-worktrees.ps1`
   - Check file permissions and ownership

### Path Configuration

Update the script path in your alias configuration:
- **Windows**: `C:\Users\YourName\Scripts\manage-worktrees.ps1`
- **Linux/WSL**: `/home/username/scripts/manage-worktrees.ps1`
- **macOS**: `/Users/YourName/Scripts/manage-worktrees.ps1`

## 🎯 Quick Setup Script

For quick setup on Linux/macOS, you can use this one-liner:

```bash
# Replace with your actual script path
SCRIPT_PATH="/path/to/your/manage-worktrees.ps1"
echo "gwm() { pwsh \"$SCRIPT_PATH\" \"\$@\"; }" >> ~/.bashrc && source ~/.bashrc
```

For zsh users:
```bash
SCRIPT_PATH="/path/to/your/manage-worktrees.ps1"
echo "gwm() { pwsh \"$SCRIPT_PATH\" \"\$@\"; }" >> ~/.zshrc && source ~/.zshrc
```

## ✅ Verification

Test your setup:
```bash
# Should show the interactive worktree manager
gwm

# Should create a new worktree
gwm test-branch
```

If everything works correctly, you should see the Git Worktree Manager interface! 🎉