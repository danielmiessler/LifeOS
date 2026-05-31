#!/usr/bin/env bash
#
# install.sh — Install Hermes Pulse as a systemd user service.
#
# Usage:
#   ./install.sh              # interactive
#   ./install.sh --yes        # non-interactive, accept defaults
#
# This script:
#   1. Copies pulse_mcp.py and requirements.txt to ~/.hermes/pulse/
#   2. Creates a systemd user service unit file
#   3. Shows instructions for enabling the service
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PULSE_DEST="${HOME}/.hermes/pulse"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
SERVICE_NAME="hermes-pulse"
SERVICE_FILE="${SYSTEMD_DIR}/${SERVICE_NAME}.service"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
NONINTERACTIVE=false
for arg in "$@"; do
    case "$arg" in
        --yes|-y) NONINTERACTIVE=true ;;
    esac
done

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# ---------------------------------------------------------------------------
# Step 1: Copy files to ~/.hermes/pulse/
# ---------------------------------------------------------------------------
info "Installing Hermes Pulse to ${PULSE_DEST}..."

mkdir -p "${PULSE_DEST}"

cp "${SCRIPT_DIR}/pulse_mcp.py"       "${PULSE_DEST}/pulse_mcp.py"
cp "${SCRIPT_DIR}/requirements.txt"   "${PULSE_DEST}/requirements.txt"
cp "${SCRIPT_DIR}/README.md"          "${PULSE_DEST}/README.md"

chmod 755 "${PULSE_DEST}/pulse_mcp.py"

ok "Files copied to ${PULSE_DEST}"

# ---------------------------------------------------------------------------
# Step 2: Create systemd user service
# ---------------------------------------------------------------------------
info "Creating systemd user service..."

mkdir -p "${SYSTEMD_DIR}"

cat > "${SERVICE_FILE}" <<- EOF
[Unit]
Description=Hermes Pulse — Notification & Health MCP Server
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
ExecStart=${HOME}/.local/bin/python3 ${PULSE_DEST}/pulse_mcp.py
Restart=on-failure
RestartSec=5
Environment=PULSE_HOST=127.0.0.1
Environment=PULSE_PORT=31337
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
PrivateTmp=yes

[Install]
WantedBy=default.target
EOF

ok "Service unit created: ${SERVICE_FILE}"

# ---------------------------------------------------------------------------
# Step 3: Reload systemd and show instructions
# ---------------------------------------------------------------------------
systemctl --user daemon-reload

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Hermes Pulse Installation Complete${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Files installed to:  ${PULSE_DEST}"
echo "  Service unit:        ${SERVICE_FILE}"
echo ""
echo "  Start the service:"
echo "    systemctl --user start ${SERVICE_NAME}"
echo ""
echo "  Enable on boot:"
echo "    systemctl --user enable ${SERVICE_NAME}"
echo ""
echo "  Start + enable:"
echo "    systemctl --user enable --now ${SERVICE_NAME}"
echo ""
echo "  Check status:"
echo "    systemctl --user status ${SERVICE_NAME}"
echo ""
echo "  View logs:"
echo "    journalctl --user -u ${SERVICE_NAME} -f"
echo ""
echo "  Stop:"
echo "    systemctl --user stop ${SERVICE_NAME}"
echo ""
echo "  Uninstall:"
echo "    systemctl --user stop --now ${SERVICE_NAME}"
echo "    systemctl --user disable ${SERVICE_NAME}"
echo "    rm -f ${SERVICE_FILE}"
echo "    rm -rf ${PULSE_DEST}"
echo "    systemctl --user daemon-reload"
echo ""
echo -e "${GREEN}============================================${NC}"

# ---------------------------------------------------------------------------
# Step 4: Offer to start now
# ---------------------------------------------------------------------------
if [ "${NONINTERACTIVE}" = false ]; then
    echo ""
    read -r -p "Start the service now? [Y/n] " START_NOW
    case "${START_NOW}" in
        n|N|no|NO) info "You can start it later with: systemctl --user start ${SERVICE_NAME}" ;;
        *) systemctl --user enable --now "${SERVICE_NAME}" 2>/dev/null || true
           ok "Service started and enabled!" ;;
    esac
fi
