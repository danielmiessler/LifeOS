# Restart the Voice Server (Windows)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Restarting voice server..."
& (Join-Path $SCRIPT_DIR "stop.ps1")
Start-Sleep -Seconds 2
& (Join-Path $SCRIPT_DIR "start.ps1")
