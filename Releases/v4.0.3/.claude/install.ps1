# ═══════════════════════════════════════════════════════════
#  PAI Installer v4.0 — Bootstrap Script (Windows PowerShell)
#  Requirements: PowerShell 5.1+, curl or Invoke-WebRequest
#  This script bootstraps the installer by ensuring Bun is
#  available, then hands off to the TypeScript installer.
# ═══════════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"

# ─── Colors ───────────────────────────────────────────────
$ESC = [char]0x1B
$BLUE = "$ESC[38;2;59;130;246m"
$LIGHT_BLUE = "$ESC[38;2;147;197;253m"
$NAVY = "$ESC[38;2;30;58;138m"
$GREEN = "$ESC[38;2;34;197;94m"
$YELLOW = "$ESC[38;2;234;179;8m"
$RED = "$ESC[38;2;239;68;68m"
$GRAY = "$ESC[38;2;100;116;139m"
$STEEL = "$ESC[38;2;51;65;85m"
$SILVER = "$ESC[38;2;203;213;225m"
$RESET = "$ESC[0m"
$BOLD = "$ESC[1m"
$ITALIC = "$ESC[3m"

# ─── Helpers ──────────────────────────────────────────────
function Info    { param($msg) Write-Host "  ${BLUE}`u{2139}${RESET} $msg" }
function Success { param($msg) Write-Host "  ${GREEN}`u{2713}${RESET} $msg" }
function Warn    { param($msg) Write-Host "  ${YELLOW}`u{26A0}${RESET} $msg" }
function Err     { param($msg) Write-Host "  ${RED}`u{2717}${RESET} $msg" }

# ─── Banner ───────────────────────────────────────────────
$SEP = "${STEEL}`u{2502}${RESET}"
$BAR = "${STEEL}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}`u{2500}${RESET}"

Write-Host ""
Write-Host "${STEEL}`u{250F}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2513}${RESET}"
Write-Host ""
Write-Host "                      ${NAVY}P${RESET}${BLUE}A${RESET}${LIGHT_BLUE}I${RESET} ${STEEL}|${RESET} ${GRAY}Personal AI Infrastructure${RESET}"
Write-Host ""
Write-Host "                     ${ITALIC}${LIGHT_BLUE}`"Magnifying human capabilities...`"${RESET}"
Write-Host ""
Write-Host ""
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${GRAY}`"${RESET}${LIGHT_BLUE}Lean and Mean${RESET}${GRAY}`"${RESET}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${BAR}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${NAVY}`u{2B22}${RESET}  ${GRAY}PAI${RESET}       ${SILVER}v4.0.3${RESET}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${NAVY}`u{2699}${RESET}  ${GRAY}Algo${RESET}      ${SILVER}v3.7.0${RESET}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${LIGHT_BLUE}`u{2726}${RESET}  ${GRAY}Installer${RESET} ${SILVER}v4.0${RESET}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${BAR}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}  ${LIGHT_BLUE}`u{2726}  Lean and Mean${RESET}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}"
Write-Host "           ${NAVY}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}        ${BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}${LIGHT_BLUE}`u{2588}`u{2588}`u{2588}`u{2588}${RESET}   ${SEP}"
Write-Host ""
Write-Host ""
Write-Host "                       ${STEEL}`u{2192}${RESET} ${BLUE}github.com/danielmiessler/PAI${RESET}"
Write-Host ""
Write-Host "${STEEL}`u{2517}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{2501}`u{251B}${RESET}"
Write-Host ""

# ─── Resolve Script Directory ─────────────────────────────
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ─── OS Detection ─────────────────────────────────────────
$OS = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
$ARCH = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture

if ($env:OS -eq "Windows_NT") {
    Info "Platform: Windows ($ARCH)"
} else {
    Err "This script is designed for Windows. Use install.sh for macOS/Linux."
    exit 1
}

# ─── Check curl ───────────────────────────────────────────
# PowerShell has Invoke-WebRequest built-in, but check for curl too
$hasCurl = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($hasCurl) {
    Success "curl found"
} else {
    Info "curl.exe not found, will use Invoke-WebRequest"
}

# ─── Check/Install Git ───────────────────────────────────
$hasGit = Get-Command git -ErrorAction SilentlyContinue
if ($hasGit) {
    $gitVersion = git --version 2>$null | Select-Object -First 1
    Success "Git found: $gitVersion"
} else {
    Warn "Git not found — attempting to install..."
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    if ($hasWinget) {
        try {
            winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements 2>$null
            # Refresh PATH
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
            $hasGit = Get-Command git -ErrorAction SilentlyContinue
            if ($hasGit) {
                Success "Git installed via winget: $(git --version 2>$null | Select-Object -First 1)"
            } else {
                Warn "Git installed but not on PATH. Please restart your terminal."
            }
        } catch {
            Warn "Could not install Git via winget"
        }
    } else {
        Warn "Git could not be installed automatically. Please install from https://git-scm.com/download/win"
    }
}

# ─── Check/Install Bun ───────────────────────────────────
$hasBun = Get-Command bun -ErrorAction SilentlyContinue
if ($hasBun) {
    $bunVersion = bun --version 2>$null
    Success "Bun found: v$bunVersion"
} else {
    Info "Installing Bun runtime..."
    try {
        # Bun's official Windows installer
        irm bun.sh/install.ps1 | iex
        # Add to PATH for this session
        $bunPath = Join-Path $env:USERPROFILE ".bun\bin"
        $env:PATH = "$bunPath;$env:PATH"
        $hasBun = Get-Command bun -ErrorAction SilentlyContinue
        if ($hasBun) {
            Success "Bun installed: v$(bun --version 2>$null)"
        } else {
            Err "Failed to install Bun. Please install manually: https://bun.sh"
            exit 1
        }
    } catch {
        Err "Failed to install Bun. Please install manually: https://bun.sh"
        exit 1
    }
}

# ─── Check Claude Code ───────────────────────────────────
$hasClaude = Get-Command claude -ErrorAction SilentlyContinue
if ($hasClaude) {
    Success "Claude Code found"
} else {
    Warn "Claude Code not found — will install during setup"
}

# ─── Launch Installer ────────────────────────────────────
$INSTALLER_DIR = ""
if (Test-Path (Join-Path $SCRIPT_DIR "PAI-Install")) {
    $INSTALLER_DIR = Join-Path $SCRIPT_DIR "PAI-Install"
} elseif (Test-Path (Join-Path $SCRIPT_DIR "main.ts")) {
    $INSTALLER_DIR = $SCRIPT_DIR
} else {
    Err "Cannot find PAI-Install directory. Expected at: $SCRIPT_DIR\PAI-Install\"
    exit 1
}

Info "Launching installer..."
Write-Host ""

# Windows always uses CLI mode (no DISPLAY/WAYLAND to detect)
$INSTALL_MODE = "cli"

& bun run (Join-Path $INSTALLER_DIR "main.ts") --mode $INSTALL_MODE
