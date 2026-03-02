#!/bin/bash

# Check status of Voice Server

SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
LOG_PATH="$HOME/Library/Logs/pai-voice-server.log"
ENV_FILE="$HOME/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}     PAI Voice Server Status${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo

# Check LaunchAgent
echo -e "${BLUE}Service Status:${NC}"
if launchctl list | grep -q "$SERVICE_NAME" 2>/dev/null; then
    PID=$(launchctl list | grep "$SERVICE_NAME" | awk '{print $1}')
    if [ "$PID" != "-" ]; then
        echo -e "  ${GREEN}OK Service is loaded (PID: $PID)${NC}"
    else
        echo -e "  ${YELLOW}! Service is loaded but not running${NC}"
    fi
else
    echo -e "  ${RED}X Service is not loaded${NC}"
fi

# Check if server is responding
echo
echo -e "${BLUE}Server Status:${NC}"
if curl -s -f -X GET http://localhost:8888/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}OK Server is responding on port 8888${NC}"

    # Get health info
    HEALTH=$(curl -s http://localhost:8888/health)
    echo "  Response: $HEALTH"
else
    echo -e "  ${RED}X Server is not responding${NC}"
fi

# Check port binding
echo
echo -e "${BLUE}Port Status:${NC}"
if lsof -i :8888 > /dev/null 2>&1; then
    PROCESS=$(lsof -i :8888 | grep LISTEN | head -1)
    echo -e "  ${GREEN}OK Port 8888 is in use${NC}"
    echo "$PROCESS" | awk '{print "  Process: " $1 " (PID: " $2 ")"}'
else
    echo -e "  ${YELLOW}! Port 8888 is not in use${NC}"
fi

# Check ElevenLabs configuration
echo
echo -e "${BLUE}Voice Configuration:${NC}"
if [ -f "$ENV_FILE" ] && grep -q "ELEVENLABS_API_KEY=" "$ENV_FILE"; then
    API_KEY=$(grep "ELEVENLABS_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    if [ "$API_KEY" != "your_api_key_here" ] && [ -n "$API_KEY" ]; then
        echo -e "  ${GREEN}OK ElevenLabs API configured${NC}"
        if grep -q "ELEVENLABS_VOICE_ID=" "$ENV_FILE"; then
            VOICE_ID=$(grep "ELEVENLABS_VOICE_ID=" "$ENV_FILE" | cut -d'=' -f2)
            echo "  Voice ID: $VOICE_ID"
        fi
    else
        echo -e "  ${YELLOW}! Using macOS 'say' (no API key)${NC}"
    fi
else
    echo -e "  ${YELLOW}! Using macOS 'say' (no configuration)${NC}"
fi

# Check logs
echo
echo -e "${BLUE}Recent Logs:${NC}"
if [ -f "$LOG_PATH" ]; then
    echo "  Log file: $LOG_PATH"
    echo "  Last 5 lines:"
    tail -5 "$LOG_PATH" | while IFS= read -r line; do
        echo "    $line"
    done
else
    echo -e "  ${YELLOW}! No log file found${NC}"
fi

# Show commands
echo
echo -e "${BLUE}Available Commands:${NC}"
echo "  - Start:     ./start.sh"
echo "  - Stop:      ./stop.sh"
echo "  - Restart:   ./restart.sh"
echo "  - Logs:      tail -f $LOG_PATH"
echo "  - Test:      curl -X POST http://localhost:8888/notify -H 'Content-Type: application/json' -d '{\"message\":\"Test\"}'"
