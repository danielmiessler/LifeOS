#!/bin/bash

# Voice Server Menu Bar Indicator
# For BitBar/SwiftBar - updates every 5 seconds

# Get the VoiceServer directory
PAI_DIR="${PAI_DIR:-$HOME/.claude}"
VOICE_SERVER_DIR="$PAI_DIR/VoiceServer"

# Source the shared platform helpers if available. BitBar/SwiftBar runs this
# from an arbitrary cwd so we resolve the library relative to the script.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -r "$SCRIPT_DIR/../lib/platform.sh" ]; then
    # shellcheck source=../lib/platform.sh
    . "$SCRIPT_DIR/../lib/platform.sh"
elif [ -r "$VOICE_SERVER_DIR/lib/platform.sh" ]; then
    # shellcheck source=/dev/null
    . "$VOICE_SERVER_DIR/lib/platform.sh"
fi

# Resolve log path once. Fall back to the historical macOS literal if the
# helper isn't available (e.g., running from an older checkout).
if command -v pai_log_path >/dev/null 2>&1; then
    LOG_PATH="$(pai_log_path)"
else
    LOG_PATH="$HOME/Library/Logs/pai-voice-server.log"
fi

# Check if server is running
if curl -s -f http://localhost:8888/health > /dev/null 2>&1; then
    # Server is running - show green indicator with size
    echo "🎙️ | size=18"
    echo "---"
    echo "Voice Server: ✅ Running"

    # Check for ElevenLabs
    if [ -f ~/.env ] && grep -q "ELEVENLABS_API_KEY=" ~/.env 2>/dev/null; then
        API_KEY=$(grep "ELEVENLABS_API_KEY=" ~/.env | cut -d'=' -f2)
        if [ "$API_KEY" != "your_api_key_here" ] && [ -n "$API_KEY" ]; then
            echo "Voice: ElevenLabs AI"
        else
            echo "Voice: macOS Say"
        fi
    else
        echo "Voice: macOS Say"
    fi

    echo "Port: 8888"
    echo "---"
    echo "Stop Server | bash='$VOICE_SERVER_DIR/stop.sh' terminal=false refresh=true"
    echo "Restart Server | bash='$VOICE_SERVER_DIR/restart.sh' terminal=false refresh=true"
else
    # Server is not running - show gray indicator with size
    echo "🎙️⚫ | size=18"
    echo "---"
    echo "Voice Server: ⚫ Stopped"
    echo "---"
    echo "Start Server | bash='$VOICE_SERVER_DIR/start.sh' terminal=false refresh=true"
fi

echo "---"
echo "Check Status | bash='$VOICE_SERVER_DIR/status.sh' terminal=true"
echo "View Logs | bash='tail -f $LOG_PATH' terminal=true"
echo "---"
echo "Test Voice | bash='curl -X POST http://localhost:8888/notify -H \"Content-Type: application/json\" -d \"{\\\"message\\\":\\\"Testing voice server\\\"}\"' terminal=false"
echo "---"
echo "Open Voice Server Folder | bash='open $VOICE_SERVER_DIR'"
echo "Uninstall | bash='$VOICE_SERVER_DIR/uninstall.sh' terminal=true"
