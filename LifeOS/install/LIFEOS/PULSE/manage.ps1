# LifeOS Pulse - Windows process management.
# ASCII-only: PowerShell 5.1 reads BOM-less UTF-8 as ANSI (public issue #2222, @aveneri)
# Usage: powershell -ExecutionPolicy Bypass -File manage.ps1 {start|stop|restart|status|install|uninstall}
#
# Ported from public issue #1733, @umair-a11y.
# Verified on Windows by @umair-a11y: install + PulseStart + PATH fix. The
# uninstall/start/stop/restart/status verbs are an unverified adaptation of
# manage.sh - needs a Windows pass before reliance.
# Windows-only - manage.sh remains the macOS (launchd) and Linux (systemd) path.
#
# Registers a CURRENT-USER scheduled task: no admin rights, no machine-wide state.

param([string]$Command = "status")

$ErrorActionPreference = "Stop"

$pulseDir = $PSScriptRoot
$startScript = Join-Path $pulseDir "PulseStart.ps1"
# Same folder and label every other LifeOS task uses (TOOLS/lib/WinTask.ts), so
# `bun LIFEOS/TOOLS/Services.ts status` sees Pulse beside them.
$taskPath = "\LifeOS\"
$taskName = "com.lifeos.pulse"
$legacyTaskName = "LifeOS Pulse"
$specFile = Join-Path $pulseDir "..\MEMORY\STATE\wintask\com.lifeos.pulse.json"
$pulseUrl = "http://localhost:31337/"

function Test-PulseUp {
    try {
        # public issue #2224, @aveneri (first WinINet call pays proxy autodetect)
        $probe = Invoke-WebRequest -Uri $pulseUrl -UseBasicParsing -TimeoutSec 8
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
        # NOTE: do not rename this to $Action - PowerShell variables are
        # case-insensitive, so it would collide with a param named $Action and
        # Register-ScheduledTask would be handed the string instead of the action.
        $taskAction = New-ScheduledTaskAction -Execute "powershell.exe" `
            -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`"" `
            -WorkingDirectory $pulseDir
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
            -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
        # An install from before the \LifeOS\ folder registered the task at the root.
        if (Get-ScheduledTask -TaskPath "\" -TaskName $legacyTaskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskPath "\" -TaskName $legacyTaskName -Confirm:$false
        }
        Register-ScheduledTask -TaskPath $taskPath -TaskName $taskName -Action $taskAction -Trigger $trigger -Settings $settings -Force | Out-Null
        # The spec record Services.ts reads for state and cadence (WinTask.ts writes the same for its tasks).
        New-Item -ItemType Directory -Force (Split-Path $specFile) | Out-Null
        '{ "label": "com.lifeos.pulse", "managedBy": "PULSE/manage.ps1", "schedule": { "kind": "daemon", "restartSec": 60 } }' |
            Set-Content -Path $specFile -Encoding ASCII
        Write-Host "LifeOS Pulse installed (scheduled task '$taskPath$taskName', runs at logon)"
        # Start it now too: the install is verified by Pulse answering, not by the next logon.
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
    }

    "uninstall" {
        $removed = $false
        foreach ($t in @(@{ Path = $taskPath; Name = $taskName }, @{ Path = "\"; Name = $legacyTaskName })) {
            if (Get-ScheduledTask -TaskPath $t.Path -TaskName $t.Name -ErrorAction SilentlyContinue) {
                Unregister-ScheduledTask -TaskPath $t.Path -TaskName $t.Name -Confirm:$false
                $removed = $true
            }
        }
        Remove-Item -Force -ErrorAction SilentlyContinue $specFile
        Write-Host $(if ($removed) { "LifeOS Pulse uninstalled (scheduled task removed)" } else { "LifeOS Pulse not installed" })
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
        $task = Get-ScheduledTask -TaskPath $taskPath -TaskName $taskName -ErrorAction SilentlyContinue
        Write-Host "Scheduled task: $(if ($task) { $task.State } else { 'not installed' })"
        Write-Host "Responding on :31337: $(if (Test-PulseUp) { 'yes' } else { 'no' })"
        $procs = Get-PulseProcess
        Write-Host "bun pulse.ts processes: $(@($procs).Count)"
    }

    default {
        Write-Host "Usage: manage.ps1 {start|stop|restart|status|install|uninstall}"
        exit 1
    }
}
