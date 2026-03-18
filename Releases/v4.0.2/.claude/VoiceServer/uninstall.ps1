# Uninstall Voice Server (Windows)

$TASK_NAME = "PAI-VoiceServer"
$LOG_PATH = Join-Path $env:USERPROFILE "AppData\Local\PAI\voice-server.log"

$ESC = [char]0x1B
$RED = "$ESC[0;31m"; $GREEN = "$ESC[0;32m"; $YELLOW = "$ESC[1;33m"; $BLUE = "$ESC[0;34m"; $NC = "$ESC[0m"

Write-Host "${BLUE}=====================================================${NC}"
Write-Host "${BLUE}     PAI Voice Server Uninstall${NC}"
Write-Host "${BLUE}=====================================================${NC}"
Write-Host ""

# Confirm
Write-Host "${YELLOW}This will:${NC}"
Write-Host "  - Stop the voice server"
Write-Host "  - Remove the Scheduled Task"
Write-Host "  - Keep your server files and configuration"
Write-Host ""
$reply = Read-Host "Are you sure you want to uninstall? (y/n)"
if ($reply -notmatch '^[Yy]$') {
    Write-Host "Uninstall cancelled"
    exit 0
}

# Stop the service
Write-Host "${YELLOW}> Stopping voice server...${NC}"
$task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "${GREEN}OK Scheduled Task removed${NC}"
} else {
    Write-Host "${YELLOW}  Task was not registered${NC}"
}

# Kill remaining processes on port 8888
$portProcess = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcess) {
    Write-Host "${YELLOW}> Cleaning up port 8888...${NC}"
    $portProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Write-Host "${GREEN}OK Port 8888 cleared${NC}"
}

# Ask about logs
Write-Host ""
$reply = Read-Host "Do you want to remove log files? (y/n)"
if ($reply -match '^[Yy]$') {
    if (Test-Path $LOG_PATH) {
        Remove-Item $LOG_PATH -Force
        Write-Host "${GREEN}OK Log file removed${NC}"
    }
}

Write-Host ""
Write-Host "${GREEN}=====================================================${NC}"
Write-Host "${GREEN}     Uninstall Complete${NC}"
Write-Host "${GREEN}=====================================================${NC}"
Write-Host ""
Write-Host "${BLUE}Notes:${NC}"
Write-Host "  - Your server files are still in: $(Split-Path -Parent $MyInvocation.MyCommand.Definition)"
Write-Host "  - Your $env:USERPROFILE\.env configuration is preserved"
Write-Host "  - To reinstall, run: .\install.ps1"
