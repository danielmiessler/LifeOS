# Start observability dashboard - minimal output

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PAI_DIR = if ($env:PAI_DIR) { $env:PAI_DIR } else { Join-Path $env:USERPROFILE ".claude" }

# Check if ports are in use
$port4000 = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if ($port4000) {
    Write-Host "Port 4000 in use. Run: $PAI_DIR\Observability\manage.ps1 stop"
    exit 1
}

$port5172 = Get-NetTCPConnection -LocalPort 5172 -State Listen -ErrorAction SilentlyContinue
if ($port5172) {
    Write-Host "Port 5172 in use. Run: $PAI_DIR\Observability\manage.ps1 stop"
    exit 1
}

# Start server (suppress verbose output)
$serverDir = Join-Path $ProjectRoot "apps\server"
$serverProc = Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru

# Wait for server (silent)
for ($i = 1; $i -le 10; $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:4000/events/filter-options" -TimeoutSec 2 -ErrorAction Stop | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

# Start client (suppress verbose output)
$clientDir = Join-Path $ProjectRoot "apps\client"
$clientProc = Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -WindowStyle Hidden -PassThru

# Wait for client (silent)
for ($i = 1; $i -le 10; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:5172" -TimeoutSec 2 -ErrorAction Stop | Out-Null
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}

# Confirm startup
Write-Host "Observability Dashboard Running"
Write-Host "   Dashboard: http://localhost:5172"
Write-Host "   API: http://localhost:4000"

# Cleanup on exit
try {
    Write-Host "Press Ctrl+C to stop..."
    Wait-Process -Id $serverProc.Id, $clientProc.Id
} finally {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $clientProc.Id -Force -ErrorAction SilentlyContinue
}
