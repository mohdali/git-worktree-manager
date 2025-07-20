# Git Worktree Manager Test Suite

This directory contains comprehensive tests for the Git Worktree Manager script.

## Running Tests

### Quick Start
```powershell
# Run all tests
./run-tests.ps1

# Run with verbose output
./run-tests.ps1 -Verbose

# Stop on first failure
./run-tests.ps1 -FailFast

# Show help
./run-tests.ps1 -Help
```

### Running Specific Test Files
```powershell
# Run main test suite
./tests/Test-WorktreeManager.ps1

# Run interactive mode tests
./tests/Test-InteractiveMode.ps1
```

## Test Coverage

### Basic Functionality Tests
- `ConvertTo-ValidFolderName` - Branch name to folder name conversion
- `Test-ValidBranchName` - Branch name validation
- Command line worktree creation
- Error handling for invalid inputs

### Interactive Mode Tests
- Menu navigation simulation
- Keyboard input handling (q, Escape, n, D, p, o)
- Create new worktree interactively
- Delete worktree with confirmation
- Push branch functionality
- Open worktree in VS Code

### Status and Display Tests
- Status indicator formatting
- Refresh interval settings (default, custom, disabled)
- Multiple worktrees display
- Empty worktree list handling

### Error Condition Tests
- Invalid branch names
- Duplicate branch names
- Missing permissions
- Git repository validation

## Test Architecture

### Test Framework
The test suite uses a custom PowerShell testing framework that provides:
- Colored output for pass/fail results
- Test grouping and organization
- Simulated user input for interactive testing
- Temporary test repositories
- Automatic cleanup

### Key Functions
- `Write-TestResult` - Records and displays test results
- `Test-Function` - Groups related tests
- `New-TestRepo` - Creates isolated test repositories
- `Invoke-ScriptWithInput` - Simulates user keyboard input
- `Simulate-KeyboardInput` - Advanced keyboard simulation

## CI/CD Integration

Tests are automatically run on:
- **Push to main branch**
- **Pull requests**
- **Manual workflow dispatch**

Supported platforms:
- Windows (PowerShell 5.1 and 7.x)
- Linux (PowerShell 7.x)
- macOS (PowerShell 7.x)

## Writing New Tests

To add new tests:

1. Create a test function:
```powershell
Test-Function "Feature name" {
    # Arrange
    $testData = "..."
    
    # Act
    $result = Some-Function -Parameter $testData
    
    # Assert
    Write-TestResult -TestName "Expected behavior" -Success ($result -eq "expected")
}
```

2. For interactive tests:
```powershell
Test-Function "Interactive feature" {
    # Simulate user input
    $result = Invoke-ScriptWithInput -Arguments @("-RefreshInterval", "0") -Inputs @("n", "branch-name", "q")
    $output = $result.Output -join "`n"
    
    # Check output
    $hasExpectedText = $output -match "Expected text"
    Write-TestResult -TestName "Shows expected output" -Success $hasExpectedText
}
```

## Known Limitations

1. **Arrow Key Simulation**: Full arrow key simulation in PowerShell is complex. Tests use alternative methods to verify navigation.

2. **VS Code Launch**: Tests verify the launch message but cannot confirm VS Code actually opens (would require UI automation).

3. **Remote Operations**: Push/pull operations are limited in test environment without actual remotes.

4. **Async Operations**: Status refresh timing can cause intermittent test failures.

## Troubleshooting

### Tests Fail on Git Commands
Ensure Git is installed and in PATH:
```powershell
git --version
```

### Permission Errors
On Linux/macOS, ensure scripts are executable:
```bash
chmod +x ./run-tests.ps1
chmod +x ./manage-worktrees.ps1
```

### PowerShell Version Issues
Check your PowerShell version:
```powershell
$PSVersionTable
```
Minimum required: PowerShell 5.1

### Cleanup Issues
If tests leave behind temporary files:
```powershell
Remove-Item -Path "$env:TEMP/worktree-test-*" -Recurse -Force
```