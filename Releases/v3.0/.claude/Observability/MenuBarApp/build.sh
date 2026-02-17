#!/bin/bash
# Build script for Observability menu bar app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Observability"
APP_BUNDLE="$SCRIPT_DIR/$APP_NAME.app"
INSTALL_PATH="/Applications/$APP_NAME.app"

echo "Building $APP_NAME..."

# Clean previous build
rm -rf "$APP_BUNDLE"

# Create app bundle structure
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy Info.plist
cp "$SCRIPT_DIR/Info.plist" "$APP_BUNDLE/Contents/"

# Compile Swift source
swiftc -O \
    -sdk $(xcrun --show-sdk-path) \
    -target arm64-apple-macosx12.0 \
    -o "$APP_BUNDLE/Contents/MacOS/$APP_NAME" \
    "$SCRIPT_DIR/ObservabilityApp.swift"

# Also compile for x86_64 and create universal binary (for Intel Macs)
swiftc -O \
    -sdk $(xcrun --show-sdk-path) \
    -target x86_64-apple-macosx12.0 \
    -o "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_x86" \
    "$SCRIPT_DIR/ObservabilityApp.swift" 2>/dev/null || true

# Create universal binary if x86 build succeeded
if [ -f "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_x86" ]; then
    lipo -create \
        "$APP_BUNDLE/Contents/MacOS/$APP_NAME" \
        "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_x86" \
        -output "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_universal"
    mv "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_universal" "$APP_BUNDLE/Contents/MacOS/$APP_NAME"
    rm "$APP_BUNDLE/Contents/MacOS/${APP_NAME}_x86"
fi

# Create PkgInfo
echo -n "APPL????" > "$APP_BUNDLE/Contents/PkgInfo"

echo "Build complete: $APP_BUNDLE"

# Optionally install to /Applications
read -p "Install to /Applications? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing to /Applications..."
    rm -rf "$INSTALL_PATH"
    cp -R "$APP_BUNDLE" "$INSTALL_PATH"
    echo "Installed to $INSTALL_PATH"
    echo ""
    echo "To start the app: open /Applications/$APP_NAME.app"
    echo "To enable launch at login: Use the menu bar icon -> 'Launch at Login'"
fi
