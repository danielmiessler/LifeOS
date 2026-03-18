# Update Fabric patterns from upstream
# This script pulls the latest patterns using the fabric CLI
# and copies them to PAI's local patterns directory

$ErrorActionPreference = "Stop"

$PAI_DIR = if ($env:PAI_DIR) { $env:PAI_DIR } else { Join-Path $env:USERPROFILE ".claude" }
$FabricPatternsSource = Join-Path $env:USERPROFILE ".config\fabric\patterns"
$PAIPatternsDir = Join-Path $PAI_DIR "skills\CORE\Tools\fabric\patterns"

Write-Host "Updating Fabric patterns..."

# First, update patterns using fabric CLI
Write-Host "Pulling latest patterns from fabric..."
fabric -U

# Then sync to PAI's local copy
Write-Host "Syncing to PAI patterns directory..."
if (-not (Test-Path $PAIPatternsDir)) {
    New-Item -ItemType Directory -Force -Path $PAIPatternsDir | Out-Null
}

# Mirror the source directory (equivalent to rsync --delete)
if (Test-Path $FabricPatternsSource) {
    # Remove existing patterns directory content
    if (Test-Path $PAIPatternsDir) {
        Remove-Item -Path "$PAIPatternsDir\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
    # Copy fresh from source
    Copy-Item -Path "$FabricPatternsSource\*" -Destination $PAIPatternsDir -Recurse -Force
} else {
    Write-Host "Error: Fabric patterns source not found at $FabricPatternsSource"
    exit 1
}

# Count patterns
$PatternCount = (Get-ChildItem -Path $PAIPatternsDir -Directory).Count

Write-Host "Updated $PatternCount patterns in $PAIPatternsDir"
Write-Host ""
Write-Host "Patterns are now available for native PAI usage."
Write-Host "No need to call 'fabric -p' - just use the pattern prompts directly."
