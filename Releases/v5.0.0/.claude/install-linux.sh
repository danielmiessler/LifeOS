#!/usr/bin/env bash
# PAI v5.0.0 Linux/headless installer wrapper.
# Use with: bash install-linux.sh
#
# This avoids the macOS/zsh-oriented post-install handoff in install.sh and
# applies Linux runtime repairs after the TypeScript wizard completes.

set -euo pipefail

info() { printf '[pai-linux-install] %s\n' "$*"; }
warn() { printf '[pai-linux-install] WARN: %s\n' "$*" >&2; }
fail() { printf '[pai-linux-install] ERROR: %s\n' "$*" >&2; exit 1; }

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd "$(dirname "$SOURCE")" && pwd)"

OS="$(uname -s)"
[[ "$OS" == "Linux" ]] || fail "install-linux.sh is intended for Linux; detected $OS"

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required. Install it with: sudo apt-get install -y curl"
fi

if ! command -v git >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    info "Installing git via apt-get..."
    sudo apt-get update && sudo apt-get install -y git
  else
    fail "git is required and no apt-get fallback is available"
  fi
fi

if ! command -v bun >/dev/null 2>&1; then
  info "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
command -v bun >/dev/null 2>&1 || fail "Bun installation failed or bun is not on PATH"

INSTALLER_DIR=""
if [ -d "$SCRIPT_DIR/PAI/PAI-Install" ]; then
  INSTALLER_DIR="$SCRIPT_DIR/PAI/PAI-Install"
elif [ -d "$SCRIPT_DIR/PAI-Install" ]; then
  INSTALLER_DIR="$SCRIPT_DIR/PAI-Install"
elif [ -f "$SCRIPT_DIR/main.ts" ]; then
  INSTALLER_DIR="$SCRIPT_DIR"
else
  fail "Cannot find PAI-Install directory under $SCRIPT_DIR"
fi

export PAI_BUNDLE_DIR="$SCRIPT_DIR"
export PATH="$HOME/.bun/bin:$PATH"

info "Launching PAI wizard in CLI mode..."
bun run "$INSTALLER_DIR/main.ts" --mode cli

HOTFIX="$SCRIPT_DIR/PAI/TOOLS/linux-hotfix.sh"
if [ -f "$HOTFIX" ]; then
  info "Applying Linux runtime hotfixes..."
  bash "$HOTFIX" || warn "linux-hotfix.sh reported non-fatal errors"
else
  warn "Linux hotfix script not found at $HOTFIX"
fi

info "Install complete. Start PAI with: pai"
info "Pulse manual test: cd ~/.claude/PAI/PULSE && bun run pulse.ts"
