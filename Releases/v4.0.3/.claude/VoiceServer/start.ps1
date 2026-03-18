# Start the Voice Server (Windows)

$TASK_NAME = "PAI-VoiceServer"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition

$ESC = [char]0x1B
$RED = "$ESC[0;31m"; $GREEN = "$ESC[0;32m"; $YELLOW = "$ESC[1;33m"; $NC = "$ESC[0m"

Write-Host "${YELLOW}> Starting Voice Server...${NC}"

# Check if task exists
$task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "${RED}X Service not installed${NC}"
    Write-Host "  Run .\install.ps1 first to install the service"
    exit 1
}

# Check if already running
if ($task.State -eq "Running") {
    Write-Host "${YELLOW}! Voice server is already running${NC}"
    Write-Host "  To restart, use: .\restart.ps1"
    exit 0
}

# Start the task
try {
    Start-ScheduledTask -TaskName $TASK_NAME
    Start-Sleep -Seconds 2

    # Test if server is responding
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:8888/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "${GREEN}OK Voice server started successfully${NC}"
        Write-Host "  Port: 8888"
        Write-Host '  Test: Invoke-RestMethod -Uri "http://localhost:8888/notify" -Method Post -ContentType "application/json" -Body ''{"message":"Test"}'''
    } catch {
        Write-Host "${YELLOW}! Server started but not responding yet${NC}"
        Write-Host "  Check logs: Get-Content `"$env:USERPROFILE\AppData\Local\PAI\voice-server.log`" -Tail 20"
    }
} catch {
    Write-Host "${RED}X Failed to start voice server${NC}"
    Write-Host "  Try running manually: bun run $SCRIPT_DIR\server.ts"
    exit 1
}
