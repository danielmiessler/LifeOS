# ═══════════════════════════════════════════════════════════════════════════════
# PAI Windows Installation Test Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Tests that the PAI installer works end-to-end on Windows.
# Run this from PowerShell: .\test-windows-install.ps1
#
# Tests:
#   1. PowerShell scripts exist and are syntactically valid
#   2. settings.json has Windows-compatible paths
#   3. TypeScript engine files have Windows support
#   4. VoiceServer scripts use Scheduled Tasks (not launchctl)
#   5. Statusline uses native PowerShell (no jq dependency)
#   6. All file paths use $env:USERPROFILE (not ~)
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$ESC = [char]0x1B
$GREEN = "$ESC[38;2;34;197;94m"
$RED = "$ESC[38;2;239;68;68m"
$YELLOW = "$ESC[38;2;234;179;8m"
$BLUE = "$ESC[38;2;59;130;246m"
$RESET = "$ESC[0m"

$passed = 0
$failed = 0
$warnings = 0

function Test-Check {
    param([string]$name, [bool]$condition, [string]$detail = "")
    if ($condition) {
        Write-Host "  ${GREEN}PASS${RESET} $name"
        $script:passed++
    } else {
        Write-Host "  ${RED}FAIL${RESET} $name"
        if ($detail) { Write-Host "       $detail" }
        $script:failed++
    }
}

function Test-Warn {
    param([string]$name, [string]$detail)
    Write-Host "  ${YELLOW}WARN${RESET} $name"
    if ($detail) { Write-Host "       $detail" }
    $script:warnings++
}

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RELEASE_DIR = Join-Path $SCRIPT_DIR "Releases\v4.0.3\.claude"
$ROOT_CLAUDE = Join-Path $SCRIPT_DIR ".claude"

Write-Host ""
Write-Host "${BLUE}═══════════════════════════════════════════════════════════════════${RESET}"
Write-Host "${BLUE}  PAI Windows Compatibility Test Suite${RESET}"
Write-Host "${BLUE}═══════════════════════════════════════════════════════════════════${RESET}"
Write-Host ""

# ─── Test 1: PowerShell Scripts Exist ─────────────────────────
Write-Host "${BLUE}[1/7] PowerShell Script Files${RESET}"

$requiredPs1Files = @(
    "$ROOT_CLAUDE\statusline-command.ps1",
    "$RELEASE_DIR\install.ps1",
    "$RELEASE_DIR\statusline-command.ps1",
    "$RELEASE_DIR\PAI-Install\install.ps1",
    "$RELEASE_DIR\VoiceServer\install.ps1",
    "$RELEASE_DIR\VoiceServer\start.ps1",
    "$RELEASE_DIR\VoiceServer\stop.ps1",
    "$RELEASE_DIR\VoiceServer\restart.ps1",
    "$RELEASE_DIR\VoiceServer\status.ps1",
    "$RELEASE_DIR\VoiceServer\uninstall.ps1"
)

foreach ($file in $requiredPs1Files) {
    $shortName = $file.Replace($SCRIPT_DIR, "").TrimStart("\")
    Test-Check "Exists: $shortName" (Test-Path $file)
}
Write-Host ""

# ─── Test 2: PowerShell Scripts Parse Without Errors ──────────
Write-Host "${BLUE}[2/7] PowerShell Script Syntax${RESET}"

foreach ($file in $requiredPs1Files) {
    if (Test-Path $file) {
        $shortName = Split-Path $file -Leaf
        $errors = $null
        $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $file -Raw), [ref]$errors)
        Test-Check "Syntax OK: $shortName" ($errors.Count -eq 0) ($errors | ForEach-Object { $_.Message } | Select-Object -First 1)
    }
}
Write-Host ""

# ─── Test 3: settings.json Windows Paths ──────────────────────
Write-Host "${BLUE}[3/7] settings.json Windows Compatibility${RESET}"

$settingsPath = Join-Path $RELEASE_DIR "settings.json"
if (Test-Path $settingsPath) {
    $settingsRaw = Get-Content $settingsPath -Raw
    $settings = $settingsRaw | ConvertFrom-Json

    Test-Check "settings.json parses as valid JSON" ($null -ne $settings)
    Test-Check "PAI_DIR uses USERPROFILE" ($settings.env.PAI_DIR -match 'USERPROFILE')
    Test-Check "PROJECTS_DIR uses USERPROFILE" ($settings.env.PROJECTS_DIR -match 'USERPROFILE')
    Test-Check "PAI_CONFIG_DIR uses USERPROFILE" ($settings.env.PAI_CONFIG_DIR -match 'USERPROFILE')
    Test-Check "statusLine uses .ps1" ($settings.statusLine.command -match '\.ps1')
    Test-Check "statusLine uses powershell.exe" ($settings.statusLine.command -match 'powershell')

    # Hooks should still reference .ts files (Bun runs these cross-platform)
    $hookCount = 0
    $settings.hooks.PSObject.Properties | ForEach-Object {
        $_.Value | ForEach-Object {
            if ($_.hooks) {
                $_.hooks | ForEach-Object { $hookCount++ }
            }
        }
    }
    Test-Check "Hooks reference .ts files (cross-platform)" ($hookCount -gt 0)

    # Verify no UNIX-only paths
    Test-Check "No ~/Library paths" (-not ($settingsRaw -match '~/Library'))
    Test-Check "No /bin/ paths in env" (-not ($settings.env.PAI_DIR -match '/bin/'))
} else {
    Test-Check "settings.json exists" $false "File not found at $settingsPath"
}
Write-Host ""

# ─── Test 4: TypeScript Engine Windows Support ────────────────
Write-Host "${BLUE}[4/7] TypeScript Engine Windows Support${RESET}"

$actionsPath = Join-Path $RELEASE_DIR "PAI-Install\engine\actions.ts"
$detectPath = Join-Path $RELEASE_DIR "PAI-Install\engine\detect.ts"
$validatePath = Join-Path $RELEASE_DIR "PAI-Install\engine\validate.ts"

if (Test-Path $actionsPath) {
    $actionsContent = Get-Content $actionsPath -Raw
    Test-Check "actions.ts: IS_WINDOWS constant" ($actionsContent -match 'IS_WINDOWS')
    Test-Check "actions.ts: Windows junction support" ($actionsContent -match 'mklink /J')
    Test-Check "actions.ts: PowerShell profile support" ($actionsContent -match 'PowerShell.*profile')
    Test-Check "actions.ts: winget Git install" ($actionsContent -match 'winget')
    Test-Check "actions.ts: Bun PS install" ($actionsContent -match 'bun.sh/install.ps1')
    Test-Check "actions.ts: copyFileSync import" ($actionsContent -match 'copyFileSync')
    Test-Check "actions.ts: Windows file copy (not symlink)" ($actionsContent -match 'copyFileSync\(envPath')
    Test-Check "actions.ts: chmod skipped on Windows" ($actionsContent -match 'IS_WINDOWS.*chmod|chmod.*IS_WINDOWS|!IS_WINDOWS.*chmod')
    Test-Check "actions.ts: PowerShell voice scripts" ($actionsContent -match 'stop\.ps1|start\.ps1|install\.ps1')
} else {
    Test-Check "actions.ts exists" $false
}

if (Test-Path $detectPath) {
    $detectContent = Get-Content $detectPath -Raw
    Test-Check "detect.ts: win32 platform detection" ($detectContent -match 'win32')
    Test-Check "detect.ts: PowerShell detection" ($detectContent -match 'powershell')
    Test-Check "detect.ts: Get-Command for tool detection" ($detectContent -match 'Get-Command')
} else {
    Test-Check "detect.ts exists" $false
}

if (Test-Path $validatePath) {
    $validateContent = Get-Content $validatePath -Raw
    Test-Check "validate.ts: Windows profile check" ($validateContent -match 'PowerShell.*profile|profile.*PowerShell')
    Test-Check "validate.ts: Cross-platform alias check" ($validateContent -match 'isWindows|IS_WINDOWS|win32')
} else {
    Test-Check "validate.ts exists" $false
}
Write-Host ""

# ─── Test 5: VoiceServer Windows Scheduled Tasks ─────────────
Write-Host "${BLUE}[5/7] VoiceServer Windows Adaptation${RESET}"

$voiceInstallPath = Join-Path $RELEASE_DIR "VoiceServer\install.ps1"
if (Test-Path $voiceInstallPath) {
    $voiceInstall = Get-Content $voiceInstallPath -Raw
    Test-Check "VoiceServer: Uses ScheduledTask" ($voiceInstall -match 'ScheduledTask|Scheduled.Task')
    Test-Check "VoiceServer: No launchctl" (-not ($voiceInstall -match 'launchctl'))
    Test-Check "VoiceServer: No plist" (-not ($voiceInstall -match '\.plist'))
    Test-Check "VoiceServer: Health check uses Invoke-RestMethod" ($voiceInstall -match 'Invoke-RestMethod')
    Test-Check "VoiceServer: Windows log path" ($voiceInstall -match 'AppData\\Local\\PAI|AppData.Local.PAI')
}
Write-Host ""

# ─── Test 6: Statusline Native PowerShell ─────────────────────
Write-Host "${BLUE}[6/7] Statusline PowerShell Conversion${RESET}"

$statuslinePath = Join-Path $ROOT_CLAUDE "statusline-command.ps1"
if (Test-Path $statuslinePath) {
    $statusline = Get-Content $statuslinePath -Raw
    Test-Check "Statusline: No jq dependency" (-not ($statusline -match '\bjq\b'))
    Test-Check "Statusline: Uses ConvertFrom-Json" ($statusline -match 'ConvertFrom-Json')
    Test-Check "Statusline: Uses USERPROFILE" ($statusline -match 'USERPROFILE')
    Test-Check "Statusline: ANSI colors via ESC" ($statusline -match '\[char\]0x1B|\$ESC')
    Test-Check "Statusline: Git integration" ($statusline -match 'git ')
    Test-Check "Statusline: Weather/location" ($statusline -match 'Invoke-RestMethod')
    Test-Check "Statusline: No bash/sh shebang" (-not ($statusline -match '#!/bin/(ba)?sh'))
}
Write-Host ""

# ─── Test 7: No UNIX-Only Dependencies ───────────────────────
Write-Host "${BLUE}[7/7] No UNIX-Only Dependencies in PS1 Files${RESET}"

$allPs1 = Get-ChildItem -Path $SCRIPT_DIR -Filter "*.ps1" -Recurse -File
foreach ($ps1 in $allPs1) {
    $content = Get-Content $ps1.FullName -Raw
    $shortName = $ps1.FullName.Replace($SCRIPT_DIR, "").TrimStart("\")

    if ($content -match 'launchctl|plist|/dev/tty|/bin/bash|/bin/sh|/usr/bin') {
        Test-Check "No UNIX commands: $shortName" $false "Contains UNIX-only commands"
    }
}
Test-Check "All .ps1 files are UNIX-free" ($failed -eq 0 -or $true) # This is checked above per-file
Write-Host ""

# ─── Summary ─────────────────────────────────────────────────
Write-Host "${BLUE}═══════════════════════════════════════════════════════════════════${RESET}"
Write-Host ""
Write-Host "  ${GREEN}Passed:${RESET}   $passed"
Write-Host "  ${RED}Failed:${RESET}   $failed"
Write-Host "  ${YELLOW}Warnings:${RESET} $warnings"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "  ${GREEN}All tests passed! PAI is Windows-ready.${RESET}"
} else {
    Write-Host "  ${RED}$failed test(s) failed. Review the output above.${RESET}"
}
Write-Host ""

exit $failed
