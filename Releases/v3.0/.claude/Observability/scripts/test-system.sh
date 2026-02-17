#!/bin/bash

echo "🚀 Multi-Agent Observability System Test"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the project root directory (parent of scripts)
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Step 1: Start the server in background
echo -e "\n${GREEN}Step 1: Starting server...${NC}"
cd "$PROJECT_ROOT/apps/server"
bun run start &
SERVER_PID=$!
sleep 3

# Check if server is running
if ps -p $SERVER_PID > /dev/null; then
    echo "✅ Server started successfully (PID: $SERVER_PID)"
else
    echo -e "${RED}❌ Server failed to start${NC}"
    exit 1
fi

# Step 2: Test sending an event
echo -e "\n${GREEN}Step 2: Testing event endpoint...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"test-123","hook_event_type":"PreToolUse","payload":{"tool":"Bash","command":"ls -la"}}')

if [ $? -eq 0 ]; then
    echo "✅ Event sent successfully"
    echo "Response: $RESPONSE"
else
    echo -e "${RED}❌ Failed to send event${NC}"
fi

# Step 3: Test filter options endpoint
echo -e "\n${GREEN}Step 3: Testing filter options endpoint...${NC}"
FILTERS=$(curl -s http://localhost:4000/events/filter-options)
if [ $? -eq 0 ]; then
    echo "✅ Filter options retrieved"
    echo "Filters: $FILTERS"
else
    echo -e "${RED}❌ Failed to get filter options${NC}"
fi

# Step 4: Test demo agent hook
echo -e "\n${GREEN}Step 4: Testing demo agent hook script...${NC}"
cd "$PROJECT_ROOT/apps/demo-cc-agent"
echo '{"session_id":"demo-test","tool_name":"Bash","tool_input":{"command":"echo test"}}' | \
    uv run .claude/hooks/send_event.py --source-app demo --event-type PreToolUse

if [ $? -eq 0 ]; then
    echo "✅ Demo agent hook executed successfully"
else
    echo -e "${RED}❌ Demo agent hook failed${NC}"
fi

# Step 5: Check recent events
echo -e "\n${GREEN}Step 5: Checking recent events...${NC}"
RECENT=$(curl -s http://localhost:4000/events/recent?limit=5)
if [ $? -eq 0 ]; then
    echo "✅ Recent events retrieved"
    echo "Events: $RECENT" | python3 -m json.tool 2>/dev/null || echo "$RECENT"
else
    echo -e "${RED}❌ Failed to get recent events${NC}"
fi

# Cleanup
echo -e "\n${GREEN}Cleaning up...${NC}"
kill $SERVER_PID 2>/dev/null
echo "✅ Server stopped"

echo -e "\n${GREEN}Test complete!${NC}"
echo "To run the full system:"
echo "1. In terminal 1: cd apps/server && bun run dev"
echo "2. In terminal 2: cd apps/client && bun run dev"
echo "3. Open http://localhost:5173 in your browser"