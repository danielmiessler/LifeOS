#!/bin/bash

# Voice Server Installation Script
# Installs the voice server as a system service:
#   - macOS   → launchctl LaunchAgent (unchanged, byte-identical)
#   - Linux   → systemd --user unit
#   - WSL2    → systemd --user unit (requires systemd-on-WSL enabled)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=lib/platform.sh
. "$SCRIPT_DIR/lib/platform.sh"
SERVICE_NAME="com.pai.voice-server"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
SYSTEMD_UNIT_NAME="pai-voice.service"
SYSTEMD_UNIT_DIR="$HOME/.config/systemd/user"
SYSTEMD_UNIT_PATH="$SYSTEMD_UNIT_DIR/$SYSTEMD_UNIT_NAME"
LOG_PATH="$(pai_log_path)"
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
# Darwin path preserved byte-identical. On Linux/WSL we probe the
# systemd --user unit; user is prompted the same way as on macOS.
if pai_is_darwin; then
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
else
    # Require systemd --user to be reachable. On bare Linux this is
    # the default; on WSL2 it requires systemd-on-WSL to be enabled
    # (/etc/wsl.conf: [boot] systemd=true). Fail loudly if not.
    if ! command -v systemctl >/dev/null 2>&1; then
        echo -e "${RED}X systemctl not found${NC}"
        echo "  The Linux voice server installer requires systemd."
        echo "  Install or enable systemd and re-run this script."
        exit 1
    fi
    if ! systemctl --user list-units --no-pager >/dev/null 2>&1; then
        echo -e "${RED}X systemd --user session is not reachable${NC}"
        if pai_is_wsl; then
            echo "  On WSL2, enable systemd by adding the following to"
            echo "  /etc/wsl.conf and running 'wsl --shutdown' from Windows:"
            echo "    [boot]"
            echo "    systemd=true"
        else
            echo "  Ensure systemd --user is available for your session"
            echo "  (user@${UID}.service should be running)."
        fi
        exit 1
    fi
    if [ -f "$SYSTEMD_UNIT_PATH" ] \
       || systemctl --user list-unit-files "$SYSTEMD_UNIT_NAME" 2>/dev/null | grep -q "$SYSTEMD_UNIT_NAME"; then
        echo -e "${YELLOW}! Voice server is already installed${NC}"
        read -p "Do you want to reinstall? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}> Stopping existing service...${NC}"
            systemctl --user stop "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
            systemctl --user disable "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
            echo -e "${GREEN}OK Existing service stopped${NC}"
        else
            echo "Installation cancelled"
            exit 0
        fi
    fi
fi

# Check for ElevenLabs configuration
echo -e "${YELLOW}> Checking ElevenLabs configuration...${NC}"
# Platform-aware fallback message — the historical string mentioned
# macOS 'say' regardless of host OS, which is misleading on Linux/WSL
# where no built-in TTS fallback exists. The Darwin message is kept
# byte-identical so the macOS flow reads the same as before.
if pai_is_darwin; then
    FALLBACK_NOTE="Voice server will use macOS 'say' command as fallback"
else
    FALLBACK_NOTE="Voice server will have no TTS fallback without an ElevenLabs API key"
fi
if [ -f "$ENV_FILE" ] && grep -q "ELEVENLABS_API_KEY=" "$ENV_FILE"; then
    API_KEY=$(grep "ELEVENLABS_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    if [ "$API_KEY" != "your_api_key_here" ] && [ -n "$API_KEY" ]; then
        echo -e "${GREEN}OK ElevenLabs API key configured${NC}"
        ELEVENLABS_CONFIGURED=true
    else
        echo -e "${YELLOW}! ElevenLabs API key not configured${NC}"
        echo "  $FALLBACK_NOTE"
        ELEVENLABS_CONFIGURED=false
    fi
else
    echo -e "${YELLOW}! No ElevenLabs configuration found${NC}"
    echo "  $FALLBACK_NOTE"
    ELEVENLABS_CONFIGURED=false
fi

if [ "$ELEVENLABS_CONFIGURED" = false ]; then
    echo
    echo "To enable AI voices, add your ElevenLabs API key to ~/.env:"
    echo "  echo 'ELEVENLABS_API_KEY=your_api_key_here' >> ~/.env"
    echo "  Get a free key at: https://elevenlabs.io"
    echo
fi

# Create and load the service unit (platform branch)
# Darwin path preserved byte-identical: same plist content, same
# launchctl load invocation. Linux/WSL writes a systemd --user unit
# at ~/.config/systemd/user/pai-voice.service, templated after the
# reference unit that ships with PAI on WSL2.
if pai_is_darwin; then
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
else
    # Create systemd --user unit
    echo -e "${YELLOW}> Creating systemd user unit...${NC}"
    mkdir -p "$SYSTEMD_UNIT_DIR"
    mkdir -p "$(dirname "$LOG_PATH")"

    BUN_BIN="$(command -v bun)"
    if [ -z "$BUN_BIN" ]; then
        echo -e "${RED}X Could not locate bun on PATH${NC}"
        exit 1
    fi

    cat > "$SYSTEMD_UNIT_PATH" << EOF
[Unit]
Description=PAI Voice Server (ElevenLabs TTS)
After=default.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${BUN_BIN} run server.ts
Restart=on-failure
RestartSec=3
StandardOutput=append:${LOG_PATH}
StandardError=append:${LOG_PATH}
Environment=HOME=${HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.bun/bin

[Install]
WantedBy=default.target
EOF

    echo -e "${GREEN}OK systemd unit written to $SYSTEMD_UNIT_PATH${NC}"

    # Load and start the service
    echo -e "${YELLOW}> Starting voice server service...${NC}"
    systemctl --user daemon-reload
    systemctl --user enable --now "$SYSTEMD_UNIT_NAME" || {
        echo -e "${RED}X Failed to start systemd unit${NC}"
        echo "  Try manually: systemctl --user status $SYSTEMD_UNIT_NAME"
        echo "  Logs:          journalctl --user -u $SYSTEMD_UNIT_NAME -n 50"
        exit 1
    }
fi

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
if pai_is_darwin; then
    echo "  - Service: $SERVICE_NAME (launchd)"
else
    echo "  - Service: $SYSTEMD_UNIT_NAME (systemd --user)"
fi
echo "  - Status: Running"
echo "  - Port: 8888"
echo "  - Logs: $LOG_PATH"

if [ "$ELEVENLABS_CONFIGURED" = true ]; then
    echo "  - Voice: ElevenLabs AI"
elif pai_is_darwin; then
    echo "  - Voice: macOS Say (fallback)"
else
    echo "  - Voice: none (configure ElevenLabs API key in ~/.env)"
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
