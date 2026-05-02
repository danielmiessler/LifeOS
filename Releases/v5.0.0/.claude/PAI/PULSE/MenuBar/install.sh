#!/bin/bash
# PAI Pulse Menu Bar — Install Script
# Builds, deploys, removes old Monitor, installs launchd plist, launches

set -euo pipefail

# shellcheck source=PAI/lib/paths.sh
. "${CLAUDE_CONFIG_DIR:-${HOME:?HOME unset}/.claude}/PAI/lib/paths.sh"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME"
APP_NAME="PAI Pulse"
APP_DIR="$HOME_DIR/Applications"
APP_DEST="$APP_DIR/$APP_NAME.app"
OLD_APP="$APP_DIR/PAI Monitor.app"

PLIST_LABEL="com.pai.pulse-menubar"
PLIST_SRC="$SCRIPT_DIR/com.pai.pulse-menubar.plist"
PLIST_DST="$HOME_DIR/Library/LaunchAgents/$PLIST_LABEL.plist"

OLD_PLIST_LABEL="com.pai.monitor-menubar"
OLD_PLIST_DST="$HOME_DIR/Library/LaunchAgents/$OLD_PLIST_LABEL.plist"

echo "=== PAI Pulse Menu Bar Installer ==="
echo ""

# Step 1: Build
echo "[1/6] Building..."
bash "$SCRIPT_DIR/build.sh"
echo ""

# Step 2: Unload old menu bar plist if present
echo "[2/6] Removing old Monitor menu bar agent..."
if [ -f "$OLD_PLIST_DST" ]; then
    launchctl unload "$OLD_PLIST_DST" 2>/dev/null || true
    rm -f "$OLD_PLIST_DST"
    echo "  Removed $OLD_PLIST_LABEL"
fi

# Step 3: Remove old Monitor app
echo "[3/6] Removing old Monitor app..."
if [ -d "$OLD_APP" ]; then
    rm -rf "$OLD_APP"
    echo "  Removed $OLD_APP"
else
    echo "  Not found, skipping."
fi

# Step 4: Unload current plist if it exists (for reinstall)
echo "[4/6] Preparing deployment..."
if [ -f "$PLIST_DST" ]; then
    launchctl unload "$PLIST_DST" 2>/dev/null || true
fi

# Kill any running instance
pkill -f "PAI Pulse.app" 2>/dev/null || true
sleep 1

# Step 5: Deploy app bundle
echo "[5/6] Deploying to $APP_DIR..."
mkdir -p "$APP_DIR"
rm -rf "$APP_DEST"
cp -R "$SCRIPT_DIR/build/$APP_NAME.app" "$APP_DEST"
echo "  Installed $APP_DEST"

# Step 6: Install and load launchd plist
echo "[6/6] Installing LaunchAgent..."

# Substitute placeholders with resolved env-rooted paths
sed -e "s|__HOME__|$HOME_DIR|g" \
    -e "s|__CLAUDE_CONFIG_DIR__|$CLAUDE_CONFIG_DIR|g" \
    -e "s|__PAI_DIR__|$PAI_DIR|g" \
    -e "s|__PULSE_DIR__|$PAI_DIR/PULSE|g" \
    "$PLIST_SRC" > "$PLIST_DST"
echo "  Installed $PLIST_DST"

# Ensure logs directory exists
mkdir -p "$PAI_DIR/PULSE/logs"

launchctl load "$PLIST_DST"
echo "  Loaded $PLIST_LABEL"

echo ""
echo "=== Installation complete ==="
echo "PAI Pulse menu bar is now running."
echo "It will auto-start on login."
