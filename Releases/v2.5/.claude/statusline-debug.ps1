# Debug wrapper for statusline to capture actual JSON input and compare paths
# Windows PowerShell equivalent of statusline-debug.sh

$inputText = $input | Out-String

# Timestamp for unique capture
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# Save full JSON to debug file
$inputText | Out-File -FilePath "$env:TEMP\statusline-capture-${timestamp}.json" -Encoding UTF8

# Also save latest for easy access
$inputText | Out-File -FilePath "$env:TEMP\statusline-latest.json" -Encoding UTF8

# Extract and log ALL context-related fields for comparison
$debugLog = "$env:TEMP\statusline-debug.log"
$logEntry = @"
=== Context Debug: $timestamp ===
--- Raw paths ---
"@

try {
    $json = $inputText | ConvertFrom-Json

    $logEntry += "`n.tokens.percentage_used: $(if ($json.tokens.percentage_used) { $json.tokens.percentage_used } else { 'NOT FOUND' })"
    $logEntry += "`n.tokens.used: $(if ($json.tokens.used) { $json.tokens.used } else { 'NOT FOUND' })"
    $logEntry += "`n.tokens.max: $(if ($json.tokens.max) { $json.tokens.max } else { 'NOT FOUND' })"
    $logEntry += "`n.context_window.used_percentage: $(if ($json.context_window.used_percentage) { $json.context_window.used_percentage } else { 'NOT FOUND' })"
    $logEntry += "`n.context_window.context_window_size: $(if ($json.context_window.context_window_size) { $json.context_window.context_window_size } else { 'NOT FOUND' })"
    $logEntry += "`n--- Full objects ---"
    $logEntry += "`n.tokens object:"
    $logEntry += "`n$(if ($json.tokens) { $json.tokens | ConvertTo-Json -Depth 5 } else { 'NOT FOUND' })"
    $logEntry += "`n.context_window object:"
    $logEntry += "`n$(if ($json.context_window) { $json.context_window | ConvertTo-Json -Depth 5 } else { 'NOT FOUND' })"
    $logEntry += "`n"
} catch {
    $logEntry += "`nFailed to parse JSON: $_"
}

$logEntry | Out-File -FilePath $debugLog -Append -Encoding UTF8

# Run the actual status line
$inputText | & (Join-Path $env:USERPROFILE ".claude\statusline-command.ps1")
