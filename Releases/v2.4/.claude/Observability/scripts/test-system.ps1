# Multi-Agent Observability System Test

$ESC = [char]0x1B
$GREEN = "$ESC[0;32m"
$RED = "$ESC[0;31m"
$NC = "$ESC[0m"

Write-Host "Multi-Agent Observability System Test"
Write-Host "========================================"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Step 1: Start the server in background
Write-Host "`n${GREEN}Step 1: Starting server...${NC}"
$serverDir = Join-Path $ProjectRoot "apps\server"
$serverProc = Start-Process -FilePath "bun" -ArgumentList "run", "start" -WorkingDirectory $serverDir -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3

# Check if server is running
if (-not $serverProc.HasExited) {
    Write-Host "Server started successfully (PID: $($serverProc.Id))"
} else {
    Write-Host "${RED}Server failed to start${NC}"
    exit 1
}

# Step 2: Test sending an event
Write-Host "`n${GREEN}Step 2: Testing event endpoint...${NC}"
try {
    $body = '{"source_app":"test","session_id":"test-123","hook_event_type":"PreToolUse","payload":{"tool":"Bash","command":"ls -la"}}'
    $response = Invoke-RestMethod -Uri "http://localhost:4000/events" -Method Post -ContentType "application/json" -Body $body
    Write-Host "Event sent successfully"
    Write-Host "Response: $($response | ConvertTo-Json -Compress)"
} catch {
    Write-Host "${RED}Failed to send event${NC}"
}

# Step 3: Test filter options endpoint
Write-Host "`n${GREEN}Step 3: Testing filter options endpoint...${NC}"
try {
    $filters = Invoke-RestMethod -Uri "http://localhost:4000/events/filter-options"
    Write-Host "Filter options retrieved"
    Write-Host "Filters: $($filters | ConvertTo-Json -Compress)"
} catch {
    Write-Host "${RED}Failed to get filter options${NC}"
}

# Step 4: Test demo agent hook
Write-Host "`n${GREEN}Step 4: Testing demo agent hook script...${NC}"
$demoDir = Join-Path $ProjectRoot "apps\demo-cc-agent"
try {
    $hookInput = '{"session_id":"demo-test","tool_name":"Bash","tool_input":{"command":"echo test"}}'
    $hookScript = Join-Path $demoDir ".claude\hooks\send_event.py"
    $hookInput | uv run $hookScript --source-app demo --event-type PreToolUse
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Demo agent hook executed successfully"
    } else {
        Write-Host "${RED}Demo agent hook failed${NC}"
    }
} catch {
    Write-Host "${RED}Demo agent hook failed${NC}"
}

# Step 5: Check recent events
Write-Host "`n${GREEN}Step 5: Checking recent events...${NC}"
try {
    $recent = Invoke-RestMethod -Uri "http://localhost:4000/events/recent?limit=5"
    Write-Host "Recent events retrieved"
    Write-Host "Events: $($recent | ConvertTo-Json -Depth 5)"
} catch {
    Write-Host "${RED}Failed to get recent events${NC}"
}

# Cleanup
Write-Host "`n${GREEN}Cleaning up...${NC}"
Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
Write-Host "Server stopped"

Write-Host "`n${GREEN}Test complete!${NC}"
Write-Host "To run the full system:"
Write-Host "1. In terminal 1: cd apps\server; bun run dev"
Write-Host "2. In terminal 2: cd apps\client; bun run dev"
Write-Host "3. Open http://localhost:5173 in your browser"
