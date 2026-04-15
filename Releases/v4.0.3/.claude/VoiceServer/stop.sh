#!/bin/bash

# Stop the Voice Server

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/platform.sh
. "$SCRIPT_DIR/lib/platform.sh"

SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SYSTEMD_UNIT_NAME="pai-voice.service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}> Stopping Voice Server...${NC}"

# Darwin path preserved byte-identical. Linux/WSL uses systemd --user.
if pai_is_darwin; then
    # Check if service is loaded
    if launchctl list | grep -q "$SERVICE_NAME" 2>/dev/null; then
        # Unload the service
        launchctl unload "$PLIST_PATH" 2>/dev/null

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}OK Voice server stopped successfully${NC}"
        else
            echo -e "${RED}X Failed to stop voice server${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}! Voice server is not running${NC}"
    fi
else
    # Check if systemd unit is active
    if systemctl --user is-active --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null; then
        if systemctl --user stop "$SYSTEMD_UNIT_NAME"; then
            echo -e "${GREEN}OK Voice server stopped successfully${NC}"
        else
            echo -e "${RED}X Failed to stop voice server${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}! Voice server is not running${NC}"
    fi
fi

# Kill any remaining processes on port 8888 — uses pai_port_pids which
# cascades lsof > ss > netstat for cross-platform coverage.
PORT_PIDS=$(pai_port_pids 8888 || true)
if [ -n "$PORT_PIDS" ]; then
    echo -e "${YELLOW}> Cleaning up port 8888...${NC}"
    # shellcheck disable=SC2086
    kill -9 $PORT_PIDS 2>/dev/null || true
    echo -e "${GREEN}OK Port 8888 cleared${NC}"
fi
