# Stop the Voice Server (Windows)

$TASK_NAME = "PAI-VoiceServer"

$ESC = [char]0x1B
$RED = "$ESC[0;31m"; $GREEN = "$ESC[0;32m"; $YELLOW = "$ESC[1;33m"; $NC = "$ESC[0m"

Write-Host "${YELLOW}> Stopping Voice Server...${NC}"

# Check if task exists and stop it
$task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($task -and $task.State -eq "Running") {
    Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
    Write-Host "${GREEN}OK Voice server stopped successfully${NC}"
} else {
    Write-Host "${YELLOW}! Voice server is not running${NC}"
}

# Kill any remaining processes on port 8888
$portProcess = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($portProcess) {
    Write-Host "${YELLOW}> Cleaning up port 8888...${NC}"
    $portProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Write-Host "${GREEN}OK Port 8888 cleared${NC}"
}
