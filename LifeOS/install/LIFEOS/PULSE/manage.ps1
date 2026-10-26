# LifeOS Pulse — Windows process management.
# Usage: powershell -ExecutionPolicy Bypass -File manage.ps1 {start|stop|restart|status|install|uninstall}
#
# Ported from public issue #1733, @umair-a11y.
# Verified on Windows by @umair-a11y: install + PulseStart + PATH fix. The
# uninstall/start/stop/restart/status verbs are an unverified adaptation of
# manage.sh — needs a Windows pass before reliance.
# Windows-only — manage.sh remains the macOS (launchd) and Linux (systemd) path.
#
# Registers a CURRENT-USER scheduled task: no admin rights, no machine-wide state.

param([string]$Command = "status")

$ErrorActionPreference = "Stop"

$pulseDir = $PSScriptRoot
$startScript = Join-Path $pulseDir "PulseStart.ps1"
$taskName = "LifeOS Pulse"
# Configured Pulse port: PULSE_PORT env -> first `port =` line in PULSE.toml -> 31337 (#2392)
$pulsePort = if ($env:PULSE_PORT) { $env:PULSE_PORT }
             else { (Select-String -Path (Join-Path $pulseDir "PULSE.toml") -Pattern '^port\s*=\s*(\d+)' -ErrorAction SilentlyContinue | Select-Object -First 1).Matches[0].Groups[1].Value }
if (-not $pulsePort) { $pulsePort = "31337" }
$pulseUrl = "http://localhost:$pulsePort/"

function Test-PulseUp {
    try {
        $probe = Invoke-WebRequest -Uri $pulseUrl -UseBasicParsing -TimeoutSec 2
        return $probe.StatusCode -eq 200
    } catch { return $false }
}

function Get-PulseProcess {
    Get-CimInstance Win32_Process -Filter "Name = 'bun.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -match "pulse\.ts" }
}

switch ($Command.ToLower()) {
    "install" {
        if (-not (Test-Path $startScript)) { Write-Error "missing $startScript"; exit 1 }
        # NOTE: do not rename this to $Action — PowerShell variables are
        # case-insensitive, so it would collide with a param named $Action and
        # Register-ScheduledTask would be handed the string instead of the action.
        $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" `
            -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`"" `
            -WorkingDirectory $pulseDir
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
        Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $trigger -Settings $settings -Force | Out-Null
        Write-Host "LifeOS Pulse installed (scheduled task '$taskName', runs at logon)"
    }

    "uninstall" {
        if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "LifeOS Pulse uninstalled (scheduled task '$taskName' removed)"
        } else {
            Write-Host "LifeOS Pulse not installed"
        }
    }

    "start" {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
        Write-Host "LifeOS Pulse started"
    }

    "stop" {
        $procs = Get-PulseProcess
        if ($procs) {
            $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
            Write-Host "LifeOS Pulse stopped"
        } else {
            Write-Host "LifeOS Pulse not running"
        }
    }

    "restart" {
        Get-PulseProcess | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
        Start-Sleep -Seconds 1
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
        Write-Host "LifeOS Pulse restarted"
    }

    "status" {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Write-Host "Scheduled task: $(if ($task) { $task.State } else { 'not installed' })"
        Write-Host "Responding on :$pulsePort: $(if (Test-PulseUp) { 'yes' } else { 'no' })"
        $procs = Get-PulseProcess
        Write-Host "bun pulse.ts processes: $(@($procs).Count)"
    }

    default {
        Write-Host "Usage: manage.ps1 {start|stop|restart|status|install|uninstall}"
        exit 1
    }
}
