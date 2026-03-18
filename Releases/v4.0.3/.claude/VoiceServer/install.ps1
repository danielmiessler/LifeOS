# Voice Server Installation Script (Windows)
# Installs the voice server as a Windows Scheduled Task

$ErrorActionPreference = "Stop"

# Colors
$ESC = [char]0x1B
$RED = "$ESC[0;31m"; $GREEN = "$ESC[0;32m"; $YELLOW = "$ESC[1;33m"; $BLUE = "$ESC[0;34m"; $NC = "$ESC[0m"

# Configuration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$TASK_NAME = "PAI-VoiceServer"
$LOG_PATH = Join-Path $env:USERPROFILE "AppData\Local\PAI\voice-server.log"
$ENV_FILE = Join-Path $env:USERPROFILE ".env"

Write-Host "${BLUE}=====================================================${NC}"
Write-Host "${BLUE}     PAI Voice Server Installation (Windows)${NC}"
Write-Host "${BLUE}=====================================================${NC}"
Write-Host ""

# Check for Bun
Write-Host "${YELLOW}> Checking prerequisites...${NC}"
$hasBun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $hasBun) {
    Write-Host "${RED}X Bun is not installed${NC}"
    Write-Host "  Please install Bun first:"
    Write-Host "  irm bun.sh/install.ps1 | iex"
    exit 1
}
Write-Host "${GREEN}OK Bun is installed${NC}"

# Check for existing installation
$existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "${YELLOW}! Voice server is already installed${NC}"
    $reply = Read-Host "Do you want to reinstall? (y/n)"
    if ($reply -match '^[Yy]$') {
        Write-Host "${YELLOW}> Stopping existing service...${NC}"
        Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "${GREEN}OK Existing service stopped${NC}"
    } else {
        Write-Host "Installation cancelled"
        exit 0
    }
}

# Check for ElevenLabs configuration
Write-Host "${YELLOW}> Checking ElevenLabs configuration...${NC}"
$ELEVENLABS_CONFIGURED = $false
if (Test-Path $ENV_FILE) {
    $envContent = Get-Content $ENV_FILE -Raw
    if ($envContent -match 'ELEVENLABS_API_KEY=(.+)') {
        $API_KEY = $matches[1].Trim()
        if ($API_KEY -ne "your_api_key_here" -and $API_KEY.Length -gt 0) {
            Write-Host "${GREEN}OK ElevenLabs API key configured${NC}"
            $ELEVENLABS_CONFIGURED = $true
        }
    }
}

if (-not $ELEVENLABS_CONFIGURED) {
    Write-Host "${YELLOW}! No ElevenLabs configuration found${NC}"
    Write-Host "  Voice server will use Windows SAPI as fallback"
    Write-Host ""
    Write-Host "To enable AI voices, add your ElevenLabs API key to $ENV_FILE:"
    Write-Host "  Add-Content `$env:USERPROFILE\.env 'ELEVENLABS_API_KEY=your_api_key_here'"
    Write-Host "  Get a free key at: https://elevenlabs.io"
    Write-Host ""
}

# Create log directory
$logDir = Split-Path $LOG_PATH -Parent
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Get bun path
$bunPath = (Get-Command bun).Source

# Create Scheduled Task
Write-Host "${YELLOW}> Creating Scheduled Task...${NC}"

$action = New-ScheduledTaskAction `
    -Execute $bunPath `
    -Argument "run `"$(Join-Path $SCRIPT_DIR 'server.ts')`"" `
    -WorkingDirectory $SCRIPT_DIR

$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

try {
    Register-ScheduledTask `
        -TaskName $TASK_NAME `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "PAI Voice Server - Text-to-speech notification service" `
        -Force | Out-Null
    Write-Host "${GREEN}OK Scheduled Task created${NC}"
} catch {
    Write-Host "${RED}X Failed to create Scheduled Task${NC}"
    Write-Host "  Error: $_"
    exit 1
}

# Start the task
Write-Host "${YELLOW}> Starting voice server...${NC}"
Start-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue

# Wait for server to start
Start-Sleep -Seconds 2

# Test the server
Write-Host "${YELLOW}> Testing voice server...${NC}"
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8888/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "${GREEN}OK Voice server is running${NC}"

    # Send test notification
    Write-Host "${YELLOW}> Sending test notification...${NC}"
    Invoke-RestMethod -Uri "http://localhost:8888/notify" `
        -Method Post `
        -ContentType "application/json" `
        -Body '{"message": "Voice server installed successfully"}' `
        -ErrorAction SilentlyContinue | Out-Null
    Write-Host "${GREEN}OK Test notification sent${NC}"
} catch {
    Write-Host "${RED}X Voice server is not responding${NC}"
    Write-Host "  Try running manually: bun run $SCRIPT_DIR\server.ts"
    exit 1
}

# Show summary
Write-Host ""
Write-Host "${GREEN}=====================================================${NC}"
Write-Host "${GREEN}     Installation Complete!${NC}"
Write-Host "${GREEN}=====================================================${NC}"
Write-Host ""
Write-Host "${BLUE}Service Information:${NC}"
Write-Host "  - Task:   $TASK_NAME"
Write-Host "  - Status: Running"
Write-Host "  - Port:   8888"
Write-Host "  - Logs:   $LOG_PATH"

if ($ELEVENLABS_CONFIGURED) {
    Write-Host "  - Voice: ElevenLabs AI"
} else {
    Write-Host "  - Voice: Windows SAPI (fallback)"
}

Write-Host ""
Write-Host "${BLUE}Management Commands:${NC}"
Write-Host "  - Status:    .\status.ps1"
Write-Host "  - Stop:      .\stop.ps1"
Write-Host "  - Start:     .\start.ps1"
Write-Host "  - Restart:   .\restart.ps1"
Write-Host "  - Uninstall: .\uninstall.ps1"
Write-Host ""
Write-Host "${BLUE}Test the server:${NC}"
Write-Host '  Invoke-RestMethod -Uri "http://localhost:8888/notify" -Method Post -ContentType "application/json" -Body ''{"message": "Hello from PAI"}'''
Write-Host ""
Write-Host "${GREEN}The voice server will now start automatically when you log in.${NC}"
