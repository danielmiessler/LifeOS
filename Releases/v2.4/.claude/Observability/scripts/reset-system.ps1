# Stop observability dashboard - silent operation

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

function Stop-PortProcesses {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-PortProcesses 4000
Stop-PortProcesses 5172

# Kill remaining bun processes (silent)
Get-Process -Name "bun" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -match "apps[\\/](server|client)" } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean SQLite WAL files (silent)
$walFile = Join-Path $ProjectRoot "apps\server\events.db-wal"
$shmFile = Join-Path $ProjectRoot "apps\server\events.db-shm"
Remove-Item -Path $walFile, $shmFile -Force -ErrorAction SilentlyContinue
