# Observability Dashboard Manager - Part of PAI infrastructure
# Location: $PAI_DIR\Observability\ (defaults to ~\.claude\Observability\)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Ensure bun is in PATH
$BunPath = Join-Path $env:USERPROFILE ".bun\bin"
if (Test-Path $BunPath) {
    $env:PATH = "$BunPath;$env:PATH"
}

function Test-PortInUse {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Stop-PortProcesses {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

$Command = $args[0]

switch ($Command) {
    "start" {
        if (Test-PortInUse 4000) {
            Write-Host "Already running. Use: manage.ps1 restart"
            exit 1
        }

        # Start server (silent)
        $serverDir = Join-Path $ScriptDir "apps\server"
        $serverJob = Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru

        # Wait for server
        for ($i = 1; $i -le 10; $i++) {
            try {
                Invoke-RestMethod -Uri "http://localhost:4000/events/filter-options" -TimeoutSec 2 -ErrorAction Stop | Out-Null
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }

        # Start client (silent)
        $clientDir = Join-Path $ScriptDir "apps\client"
        $clientJob = Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -WindowStyle Hidden -PassThru

        # Wait for client
        for ($i = 1; $i -le 10; $i++) {
            try {
                Invoke-WebRequest -Uri "http://localhost:5172" -TimeoutSec 2 -ErrorAction Stop | Out-Null
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }

        Write-Host "Observability running at http://localhost:5172"

        # Wait and cleanup on Ctrl+C
        try {
            Write-Host "Press Ctrl+C to stop..."
            Wait-Process -Id $serverJob.Id, $clientJob.Id
        } finally {
            Stop-Process -Id $serverJob.Id -Force -ErrorAction SilentlyContinue
            Stop-Process -Id $clientJob.Id -Force -ErrorAction SilentlyContinue
        }
    }

    "stop" {
        # Kill processes on ports
        Stop-PortProcesses 4000
        Stop-PortProcesses 5172

        # Kill remaining bun processes related to observability
        Get-Process -Name "bun" -ErrorAction SilentlyContinue | Where-Object {
            try { $_.CommandLine -match "apps[\\/](server|client)" } catch { $false }
        } | Stop-Process -Force -ErrorAction SilentlyContinue

        # Clean SQLite WAL files
        $walFile = Join-Path $ScriptDir "apps\server\events.db-wal"
        $shmFile = Join-Path $ScriptDir "apps\server\events.db-shm"
        Remove-Item -Path $walFile, $shmFile -Force -ErrorAction SilentlyContinue

        Write-Host "Observability stopped"
    }

    "restart" {
        Write-Host "Restarting..."
        & $MyInvocation.MyCommand.Path stop 2>$null
        Start-Sleep -Seconds 1
        & $MyInvocation.MyCommand.Path start
    }

    "status" {
        if (Test-PortInUse 4000) {
            Write-Host "Running at http://localhost:5172"
        } else {
            Write-Host "Not running"
        }
    }

    "start-detached" {
        if (Test-PortInUse 4000) {
            Write-Host "Already running. Use: manage.ps1 restart"
            exit 1
        }

        # Start server detached
        $serverDir = Join-Path $ScriptDir "apps\server"
        Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $serverDir -WindowStyle Hidden

        # Wait for server to be ready
        for ($i = 1; $i -le 10; $i++) {
            try {
                Invoke-RestMethod -Uri "http://localhost:4000/events/filter-options" -TimeoutSec 2 -ErrorAction Stop | Out-Null
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }

        # Start client detached
        $clientDir = Join-Path $ScriptDir "apps\client"
        Start-Process -FilePath "bun" -ArgumentList "run", "dev" -WorkingDirectory $clientDir -WindowStyle Hidden

        # Wait for client to be ready
        for ($i = 1; $i -le 10; $i++) {
            try {
                Invoke-WebRequest -Uri "http://localhost:5172" -TimeoutSec 2 -ErrorAction Stop | Out-Null
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }

        Write-Host "Observability running at http://localhost:5172"
    }

    default {
        Write-Host "Usage: manage.ps1 {start|stop|restart|status|start-detached}"
        exit 1
    }
}
