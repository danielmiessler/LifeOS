# LifeOS Pulse — Windows launcher (idempotent, hidden).
# Ported from public issue #1733, @umair-a11y (pattern verified on the
# contributor's Windows 11 install; PATH fix from their follow-up comment).
#
# Windows counterpart to the launchd/systemd paths in manage.sh. Registered as a
# logon-triggered scheduled task by manage.ps1; safe to run by hand.

$ErrorActionPreference = "Stop"

$pulseDir = $PSScriptRoot
$bun = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
# Configured Pulse port: PULSE_PORT env -> first `port =` line in PULSE.toml -> 31337 (#2392)
$pulsePort = if ($env:PULSE_PORT) { $env:PULSE_PORT }
             else { (Select-String -Path (Join-Path $pulseDir "PULSE.toml") -Pattern '^port\s*=\s*(\d+)' -ErrorAction SilentlyContinue | Select-Object -First 1).Matches[0].Groups[1].Value }
if (-not $pulsePort) { $pulsePort = "31337" }

# Already up? Task Scheduler retries on failure and the user may also start Pulse
# by hand, so a second instance must not fight the first for the Pulse port. Probe a
# Pulse-SPECIFIC endpoint: /healthz returns a JSON body carrying a "status" field
# (HTTP 200 healthy, 503 degraded — both mean Pulse already owns the port). A bare
# 200 from some unrelated process that grabbed the port must NOT read as "Pulse up".
function Test-PulseUp {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$pulsePort/healthz" -UseBasicParsing -TimeoutSec 2
        return ($r.Content -match '"status"')
    } catch {
        # PowerShell throws on non-2xx; a 503-degraded Pulse still owns the port,
        # so inspect the error response body for the same Pulse marker.
        try {
            $resp = $_.Exception.Response
            if ($resp) {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                return ($reader.ReadToEnd() -match '"status"')
            }
        } catch { }
        return $false
    }
}
if (Test-PulseUp) { exit 0 }

if (-not (Test-Path $bun)) {
    Write-Error "bun not found at $bun — install bun, or edit this script's `$bun path."
    exit 1
}

# HOME is unset on Windows; pulse.ts and the tools it spawns resolve paths from it.
if (-not $env:HOME) { $env:HOME = $env:USERPROFILE }

# Task Scheduler sessions don't inherit the user's PATH additions, so Pulse boots
# but its cron and voice subsystems die on `bun: command not found`. Git's usr\bin
# supplies the POSIX shell the hooks shell out to. Process-scoped only.
#
# bun's dir goes FIRST (Pulse needs `bun`), but Git's usr\bin is APPENDED, not
# prepended: it ships POSIX find.exe/sort.exe that otherwise shadow Windows'
# System32 versions for Pulse and every child it spawns, breaking any child that
# expects the Windows tools. Appending keeps System32 ahead of Git's POSIX shims
# while still making the shims available as a last resort for the hooks.
$env:PATH = "$(Join-Path $env:USERPROFILE '.bun\bin');$env:PATH;C:\Program Files\Git\usr\bin"

Start-Process -FilePath $bun -ArgumentList "run", "pulse.ts" -WorkingDirectory $pulseDir -WindowStyle Hidden
