#!/bin/bash

# Start the Voice Server

SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}> Starting Voice Server...${NC}"

# Check if LaunchAgent exists
if [ ! -f "$PLIST_PATH" ]; then
    echo -e "${RED}X Service not installed${NC}"
    echo "  Run ./install.sh first to install the service"
    exit 1
fi

# Check if already running
if launchctl list | grep -q "$SERVICE_NAME" 2>/dev/null; then
    echo -e "${YELLOW}! Voice server is already running${NC}"
    echo "  To restart, use: ./restart.sh"
    exit 0
fi

# Load the service
launchctl load "$PLIST_PATH" 2>/dev/null

if [ $? -eq 0 ]; then
    # Wait for server to start
    sleep 2

    # Test if server is responding
    if curl -s -f -X GET http://localhost:8888/health > /dev/null 2>&1; then
        echo -e "${GREEN}OK Voice server started successfully${NC}"
        echo "  Port: 8888"
        echo "  Test: curl -X POST http://localhost:8888/notify -H 'Content-Type: application/json' -d '{\"message\":\"Test\"}'"
    else
        echo -e "${YELLOW}! Server started but not responding yet${NC}"
        echo "  Check logs: tail -f ~/Library/Logs/pai-voice-server.log"
    fi
else
    echo -e "${RED}X Failed to start voice server${NC}"
    echo "  Try running manually: bun run $SCRIPT_DIR/server.ts"
    exit 1
fi
