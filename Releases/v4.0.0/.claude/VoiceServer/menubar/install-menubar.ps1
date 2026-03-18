# Menu Bar Indicator Installation (Windows)
# Menu bar indicators (SwiftBar/BitBar) are macOS-only features.
# This functionality is not supported on Windows.

$ESC = [char]0x1B
$YELLOW = "$ESC[1;33m"; $BLUE = "$ESC[0;34m"; $NC = "$ESC[0m"

Write-Host "${BLUE}=====================================================${NC}"
Write-Host "${BLUE}     PAI Voice Menu Bar Installation${NC}"
Write-Host "${BLUE}=====================================================${NC}"
Write-Host ""
Write-Host "${YELLOW}! Menu bar indicators are not supported on Windows.${NC}"
Write-Host ""
Write-Host "The SwiftBar/BitBar menu bar indicator is a macOS-only feature."
Write-Host ""
Write-Host "On Windows, you can check the voice server status using:"
Write-Host "  .\status.ps1"
Write-Host ""
Write-Host "Or check the Scheduled Task in Task Scheduler."
