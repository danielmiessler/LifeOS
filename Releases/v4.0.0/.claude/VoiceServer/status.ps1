# Check status of Voice Server (Windows)

$TASK_NAME = "PAI-VoiceServer"
$LOG_PATH = Join-Path $env:USERPROFILE "AppData\Local\PAI\voice-server.log"
$ENV_FILE = Join-Path $env:USERPROFILE ".env"

$ESC = [char]0x1B
$RED = "$ESC[0;31m"; $GREEN = "$ESC[0;32m"; $YELLOW = "$ESC[1;33m"; $BLUE = "$ESC[0;34m"; $NC = "$ESC[0m"

Write-Host "${BLUE}=====================================================${NC}"
Write-Host "${BLUE}     PAI Voice Server Status${NC}"
Write-Host "${BLUE}=====================================================${NC}"
Write-Host ""

# Check Scheduled Task
Write-Host "${BLUE}Service Status:${NC}"
$task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($task) {
    if ($task.State -eq "Running") {
        Write-Host "  ${GREEN}OK Service is running${NC}"
    } else {
        Write-Host "  ${YELLOW}! Service registered but not running (State: $($task.State))${NC}"
    }
} else {
    Write-Host "  ${RED}X Service is not installed${NC}"
}

# Check if server is responding
Write-Host ""
Write-Host "${BLUE}Server Health:${NC}"
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8888/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ${GREEN}OK Server responding on port 8888${NC}"
} catch {
    Write-Host "  ${RED}X Server is not responding${NC}"
}

# Check port binding
Write-Host ""
Write-Host "${BLUE}Port Status:${NC}"
$portConn = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue |
    Where-Object State -eq 'Listen'
if ($portConn) {
    $proc = Get-Process -Id $portConn.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "  ${GREEN}OK Port 8888 in use${NC}"
    if ($proc) { Write-Host "  Process: $($proc.ProcessName) (PID: $($proc.Id))" }
} else {
    Write-Host "  ${YELLOW}! Port 8888 not in use${NC}"
}

# Check ElevenLabs config
Write-Host ""
Write-Host "${BLUE}Voice Configuration:${NC}"
if (Test-Path $ENV_FILE) {
    $envContent = Get-Content $ENV_FILE -Raw
    if ($envContent -match 'ELEVENLABS_API_KEY=(.+)') {
        $key = $matches[1].Trim()
        if ($key -ne "your_api_key_here" -and $key.Length -gt 0) {
            Write-Host "  ${GREEN}OK ElevenLabs API configured${NC}"
        } else {
            Write-Host "  ${YELLOW}! Using Windows SAPI (no valid API key)${NC}"
        }
    } else {
        Write-Host "  ${YELLOW}! Using Windows SAPI (no configuration)${NC}"
    }
} else {
    Write-Host "  ${YELLOW}! Using Windows SAPI (no .env file)${NC}"
}

# Show logs
Write-Host ""
Write-Host "${BLUE}Recent Logs:${NC}"
if (Test-Path $LOG_PATH) {
    Write-Host "  Log file: $LOG_PATH"
    Get-Content $LOG_PATH -Tail 5 | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "  ${YELLOW}! No log file found${NC}"
}

Write-Host ""
Write-Host "${BLUE}Commands:${NC}"
Write-Host "  Start:     .\start.ps1"
Write-Host "  Stop:      .\stop.ps1"
Write-Host "  Restart:   .\restart.ps1"
Write-Host "  Uninstall: .\uninstall.ps1"
