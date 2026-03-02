#!/bin/bash

# Voice Server Installation Script
# This script installs the voice server as a macOS service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
LOG_PATH="$HOME/Library/Logs/pai-voice-server.log"
ENV_FILE="$HOME/.env"

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}     PAI Voice Server Installation${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo

# Check for Bun
echo -e "${YELLOW}> Checking prerequisites...${NC}"
if ! command -v bun &> /dev/null; then
    echo -e "${RED}X Bun is not installed${NC}"
    echo "  Please install Bun first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo -e "${GREEN}OK Bun is installed${NC}"

# Check for existing installation
if launchctl list | grep -q "$SERVICE_NAME" 2>/dev/null; then
    echo -e "${YELLOW}! Voice server is already installed${NC}"
    read -p "Do you want to reinstall? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}> Stopping existing service...${NC}"
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        echo -e "${GREEN}OK Existing service stopped${NC}"
    else
        echo "Installation cancelled"
        exit 0
    fi
fi

# Check for ElevenLabs configuration
echo -e "${YELLOW}> Checking ElevenLabs configuration...${NC}"
if [ -f "$ENV_FILE" ] && grep -q "ELEVENLABS_API_KEY=" "$ENV_FILE"; then
    API_KEY=$(grep "ELEVENLABS_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    if [ "$API_KEY" != "your_api_key_here" ] && [ -n "$API_KEY" ]; then
        echo -e "${GREEN}OK ElevenLabs API key configured${NC}"
        ELEVENLABS_CONFIGURED=true
    else
        echo -e "${YELLOW}! ElevenLabs API key not configured${NC}"
        echo "  Voice server will use macOS 'say' command as fallback"
        ELEVENLABS_CONFIGURED=false
    fi
else
    echo -e "${YELLOW}! No ElevenLabs configuration found${NC}"
    echo "  Voice server will use macOS 'say' command as fallback"
    ELEVENLABS_CONFIGURED=false
fi

if [ "$ELEVENLABS_CONFIGURED" = false ]; then
    echo
    echo "To enable AI voices, add your ElevenLabs API key to ~/.env:"
    echo "  echo 'ELEVENLABS_API_KEY=your_api_key_here' >> ~/.env"
    echo "  Get a free key at: https://elevenlabs.io"
    echo
fi

# Create LaunchAgent plist
echo -e "${YELLOW}> Creating LaunchAgent configuration...${NC}"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>$(which bun)</string>
        <string>run</string>
        <string>${SCRIPT_DIR}/server.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_PATH}</string>

    <key>StandardErrorPath</key>
    <string>${LOG_PATH}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.bun/bin</string>
    </dict>
</dict>
</plist>
EOF

echo -e "${GREEN}OK LaunchAgent configuration created${NC}"

# Load the LaunchAgent
echo -e "${YELLOW}> Starting voice server service...${NC}"
launchctl load "$PLIST_PATH" 2>/dev/null || {
    echo -e "${RED}X Failed to load LaunchAgent${NC}"
    echo "  Try manually: launchctl load $PLIST_PATH"
    exit 1
}

# Wait for server to start
sleep 2

# Test the server
echo -e "${YELLOW}> Testing voice server...${NC}"
if curl -s -f -X GET http://localhost:8888/health > /dev/null 2>&1; then
    echo -e "${GREEN}OK Voice server is running${NC}"

    # Send test notification
    echo -e "${YELLOW}> Sending test notification...${NC}"
    curl -s -X POST http://localhost:8888/notify \
        -H "Content-Type: application/json" \
        -d '{"message": "Voice server installed successfully"}' > /dev/null
    echo -e "${GREEN}OK Test notification sent${NC}"
else
    echo -e "${RED}X Voice server is not responding${NC}"
    echo "  Check logs at: $LOG_PATH"
    echo "  Try running manually: bun run $SCRIPT_DIR/server.ts"
    exit 1
fi

# Show summary
echo
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}     Installation Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo
echo -e "${BLUE}Service Information:${NC}"
echo "  - Service: $SERVICE_NAME"
echo "  - Status: Running"
echo "  - Port: 8888"
echo "  - Logs: $LOG_PATH"

if [ "$ELEVENLABS_CONFIGURED" = true ]; then
    echo "  - Voice: ElevenLabs AI"
else
    echo "  - Voice: macOS Say (fallback)"
fi

echo
echo -e "${BLUE}Management Commands:${NC}"
echo "  - Status:   ./status.sh"
echo "  - Stop:     ./stop.sh"
echo "  - Start:    ./start.sh"
echo "  - Restart:  ./restart.sh"
echo "  - Uninstall: ./uninstall.sh"

echo
echo -e "${BLUE}Test the server:${NC}"
echo "  curl -X POST http://localhost:8888/notify \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\": \"Hello from PAI\"}'"

echo
echo -e "${GREEN}The voice server will now start automatically when you log in.${NC}"

# Ask about menu bar indicator
echo
read -p "Would you like to install a menu bar indicator? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}> Installing menu bar indicator...${NC}"
    if [ -f "$SCRIPT_DIR/menubar/install-menubar.sh" ]; then
        chmod +x "$SCRIPT_DIR/menubar/install-menubar.sh"
        "$SCRIPT_DIR/menubar/install-menubar.sh"
    else
        echo -e "${YELLOW}! Menu bar installer not found${NC}"
        echo "  You can install it manually later from:"
        echo "  $SCRIPT_DIR/menubar/install-menubar.sh"
    fi
fi
