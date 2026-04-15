#!/bin/bash

# Check status of Voice Server

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/platform.sh
. "$SCRIPT_DIR/lib/platform.sh"

SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SYSTEMD_UNIT_NAME="pai-voice.service"
LOG_PATH="$(pai_log_path)"
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

# Check service manager — platform branch.
# Darwin path preserved byte-identical. Linux/WSL reads systemd --user
# state via `systemctl is-active` and `is-enabled`.
echo -e "${BLUE}Service Status:${NC}"
if pai_is_darwin; then
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
else
    if systemctl --user is-active --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null; then
        SYSTEMD_PID=$(systemctl --user show "$SYSTEMD_UNIT_NAME" -p MainPID 2>/dev/null | cut -d= -f2)
        if [ -n "$SYSTEMD_PID" ] && [ "$SYSTEMD_PID" != "0" ]; then
            echo -e "  ${GREEN}OK Service is active (PID: $SYSTEMD_PID)${NC}"
        else
            echo -e "  ${GREEN}OK Service is active${NC}"
        fi
    elif systemctl --user list-unit-files "$SYSTEMD_UNIT_NAME" 2>/dev/null | grep -q "$SYSTEMD_UNIT_NAME"; then
        echo -e "  ${YELLOW}! Service is installed but not running${NC}"
    else
        echo -e "  ${RED}X Service is not installed${NC}"
    fi
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

# Check port binding — pai_port_pids cascades lsof > ss > netstat.
echo
echo -e "${BLUE}Port Status:${NC}"
PORT_PIDS=$(pai_port_pids 8888 || true)
if [ -n "$PORT_PIDS" ]; then
    echo -e "  ${GREEN}OK Port 8888 is in use${NC}"
    for pid in $PORT_PIDS; do
        PNAME=""
        if [ -r "/proc/$pid/comm" ]; then
            PNAME=$(cat "/proc/$pid/comm" 2>/dev/null || true)
        elif command -v ps >/dev/null 2>&1; then
            PNAME=$(ps -p "$pid" -o comm= 2>/dev/null || true)
        fi
        echo "  Process: ${PNAME:-unknown} (PID: $pid)"
    done
else
    echo -e "  ${YELLOW}! Port 8888 is not in use${NC}"
fi

# Check ElevenLabs configuration
echo
echo -e "${BLUE}Voice Configuration:${NC}"
# Platform-aware fallback messages — Darwin strings preserved
# byte-identical. On Linux/WSL the server has no built-in TTS
# fallback when ElevenLabs is not configured, and the status line
# now says so instead of falsely claiming macOS 'say'.
if [ -f "$ENV_FILE" ] && grep -q "ELEVENLABS_API_KEY=" "$ENV_FILE"; then
    API_KEY=$(grep "ELEVENLABS_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    if [ "$API_KEY" != "your_api_key_here" ] && [ -n "$API_KEY" ]; then
        echo -e "  ${GREEN}OK ElevenLabs API configured${NC}"
        if grep -q "ELEVENLABS_VOICE_ID=" "$ENV_FILE"; then
            VOICE_ID=$(grep "ELEVENLABS_VOICE_ID=" "$ENV_FILE" | cut -d'=' -f2)
            echo "  Voice ID: $VOICE_ID"
        fi
    else
        if pai_is_darwin; then
            echo -e "  ${YELLOW}! Using macOS 'say' (no API key)${NC}"
        else
            echo -e "  ${YELLOW}! No TTS fallback (no API key)${NC}"
        fi
    fi
else
    if pai_is_darwin; then
        echo -e "  ${YELLOW}! Using macOS 'say' (no configuration)${NC}"
    else
        echo -e "  ${YELLOW}! No TTS fallback (no configuration)${NC}"
    fi
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
