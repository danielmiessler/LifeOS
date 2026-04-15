#!/bin/bash

# Uninstall Voice Server

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/platform.sh
. "$SCRIPT_DIR/lib/platform.sh"

SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SYSTEMD_UNIT_NAME="pai-voice.service"
SYSTEMD_UNIT_PATH="$HOME/.config/systemd/user/$SYSTEMD_UNIT_NAME"
LOG_PATH="$(pai_log_path)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}     PAI Voice Server Uninstall${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo

# Confirm uninstall
echo -e "${YELLOW}This will:${NC}"
echo "  - Stop the voice server"
if pai_is_darwin; then
    echo "  - Remove the LaunchAgent"
else
    echo "  - Remove the systemd --user unit"
fi
echo "  - Keep your server files and configuration"
echo
read -p "Are you sure you want to uninstall? (y/n): " -n 1 -r
echo
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstall cancelled"
    exit 0
fi

# Stop the service if running — platform branch.
# Darwin path preserved byte-identical.
echo -e "${YELLOW}> Stopping voice server...${NC}"
if pai_is_darwin; then
    if launchctl list | grep -q "$SERVICE_NAME" 2>/dev/null; then
        launchctl unload "$PLIST_PATH" 2>/dev/null
        echo -e "${GREEN}OK Voice server stopped${NC}"
    else
        echo -e "${YELLOW}  Service was not running${NC}"
    fi

    # Remove LaunchAgent plist
    echo -e "${YELLOW}> Removing LaunchAgent...${NC}"
    if [ -f "$PLIST_PATH" ]; then
        rm "$PLIST_PATH"
        echo -e "${GREEN}OK LaunchAgent removed${NC}"
    else
        echo -e "${YELLOW}  LaunchAgent file not found${NC}"
    fi
else
    if systemctl --user is-active --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null; then
        systemctl --user stop "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
        echo -e "${GREEN}OK Voice server stopped${NC}"
    else
        echo -e "${YELLOW}  Service was not running${NC}"
    fi

    # Remove systemd unit
    echo -e "${YELLOW}> Removing systemd unit...${NC}"
    systemctl --user disable "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
    if [ -f "$SYSTEMD_UNIT_PATH" ]; then
        rm "$SYSTEMD_UNIT_PATH"
        systemctl --user daemon-reload 2>/dev/null || true
        echo -e "${GREEN}OK systemd unit removed${NC}"
    else
        echo -e "${YELLOW}  systemd unit file not found${NC}"
    fi
fi

# Kill any remaining processes on port 8888 — pai_port_pids cascades
# lsof > ss > netstat for cross-platform coverage.
PORT_PIDS=$(pai_port_pids 8888 || true)
if [ -n "$PORT_PIDS" ]; then
    echo -e "${YELLOW}> Cleaning up port 8888...${NC}"
    # shellcheck disable=SC2086
    kill -9 $PORT_PIDS 2>/dev/null || true
    echo -e "${GREEN}OK Port 8888 cleared${NC}"
fi

# Ask about logs
echo
read -p "Do you want to remove log files? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "$LOG_PATH" ]; then
        rm "$LOG_PATH"
        echo -e "${GREEN}OK Log file removed${NC}"
    fi
fi

echo
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}     Uninstall Complete${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo
echo -e "${BLUE}Notes:${NC}"
echo "  - Your server files are still in: $(dirname "${BASH_SOURCE[0]}")"
echo "  - Your ~/.env configuration is preserved"
echo "  - To reinstall, run: ./install.sh"
echo
echo "To completely remove all files:"
echo "  rm -rf $(dirname "${BASH_SOURCE[0]}")"
