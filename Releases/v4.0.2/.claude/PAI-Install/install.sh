#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  PAI Installer v4.0 — Bootstrap Script
#  Requirements: bash, curl
#  This script bootstraps the installer by ensuring Bun is
#  available, then hands off to the TypeScript installer.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────
BLUE='\033[38;2;59;130;246m'
LIGHT_BLUE='\033[38;2;147;197;253m'
NAVY='\033[38;2;30;58;138m'
GREEN='\033[38;2;34;197;94m'
YELLOW='\033[38;2;234;179;8m'
RED='\033[38;2;239;68;68m'
GRAY='\033[38;2;100;116;139m'
STEEL='\033[38;2;51;65;85m'
SILVER='\033[38;2;203;213;225m'
RESET='\033[0m'
BOLD='\033[1m'
ITALIC='\033[3m'

# ─── Helpers ──────────────────────────────────────────────
info()    { echo -e "  ${BLUE}ℹ${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET} $1"; }
error()   { echo -e "  ${RED}✗${RESET} $1"; }

# ─── Banner ───────────────────────────────────────────────
B='█'
SEP="${STEEL}│${RESET}"
BAR="${STEEL}────────────────────────${RESET}"

echo ""
echo -e "${STEEL}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${RESET}"
echo ""
echo -e "                      ${NAVY}P${RESET}${BLUE}A${RESET}${LIGHT_BLUE}I${RESET} ${STEEL}|${RESET} ${GRAY}Personal AI Infrastructure${RESET}"
echo ""
echo -e "                     ${ITALIC}${LIGHT_BLUE}\"Magnifying human capabilities...\"${RESET}"
echo ""
echo ""
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${GRAY}\"${RESET}${LIGHT_BLUE}Lean and Mean${RESET}${GRAY}\"${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${BAR}"
echo -e "           ${NAVY}████${RESET}        ${NAVY}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${NAVY}⬢${RESET}  ${GRAY}PAI${RESET}       ${SILVER}v4.0${RESET}"
echo -e "           ${NAVY}████${RESET}        ${NAVY}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${NAVY}⚙${RESET}  ${GRAY}Algo${RESET}      ${SILVER}v3.5.0${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${LIGHT_BLUE}✦${RESET}  ${GRAY}Installer${RESET} ${SILVER}v4.0${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${BAR}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${LIGHT_BLUE}✦  Lean and Mean${RESET}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo ""
echo ""
echo -e "                       ${STEEL}→${RESET} ${BLUE}github.com/danielmiessler/PAI${RESET}"
echo ""
echo -e "${STEEL}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${RESET}"
echo ""

# ─── Resolve Script Directory ─────────────────────────────
# Follow symlinks so install.sh works from ~/.claude/ symlink
SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd "$(dirname "$SOURCE")" && pwd)"

# ─── OS Detection ─────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) info "Platform: macOS ($ARCH)" ;;
  Linux)  info "Platform: Linux ($ARCH)" ;;
  *)      error "Unsupported platform: $OS"; exit 1 ;;
esac

# ─── Check curl ───────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  error "curl is required but not found."
  echo "  Please install curl and try again."
  exit 1
fi
success "curl found"

# ─── Check/Install Git ───────────────────────────────────
if command -v git &>/dev/null; then
  success "Git found: $(git --version 2>&1 | head -1)"
else
  warn "Git not found — attempting to install..."
  if [[ "$OS" == "Darwin" ]]; then
    if command -v brew &>/dev/null; then
      brew install git 2>/dev/null || warn "Could not install Git via Homebrew"
    else
      info "Installing Xcode Command Line Tools (includes Git)..."
      xcode-select --install 2>/dev/null || true
      echo "  Please complete the Xcode installation and re-run this script."
      exit 1
    fi
  elif [[ "$OS" == "Linux" ]]; then
    if command -v apt-get &>/dev/null; then
      sudo apt-get install -y git 2>/dev/null || warn "Could not install Git"
    elif command -v yum &>/dev/null; then
      sudo yum install -y git 2>/dev/null || warn "Could not install Git"
    fi
  fi

  if command -v git &>/dev/null; then
    success "Git installed: $(git --version 2>&1 | head -1)"
  else
    warn "Git could not be installed automatically. Please install it manually."
  fi
fi

# ─── Check/Install Bun ───────────────────────────────────
if command -v bun &>/dev/null; then
  success "Bun found: v$(bun --version 2>/dev/null || echo 'unknown')"
else
  info "Installing Bun runtime..."
  curl -fsSL https://bun.sh/install | bash 2>/dev/null

  # Add to PATH for this session
  export PATH="$HOME/.bun/bin:$PATH"

  if command -v bun &>/dev/null; then
    success "Bun installed: v$(bun --version 2>/dev/null || echo 'unknown')"
  else
    error "Failed to install Bun. Please install manually: https://bun.sh"
    exit 1
  fi
fi

# ─── Check Claude Code ───────────────────────────────────
if command -v claude &>/dev/null; then
  success "Claude Code found"
else
  warn "Claude Code not found — will install during setup"
fi

# ─── Launch Installer ────────────────────────────────────
# Resolve PAI-Install directory (may be sibling or child of script location)
INSTALLER_DIR=""
if [ -d "$SCRIPT_DIR/PAI-Install" ]; then
  INSTALLER_DIR="$SCRIPT_DIR/PAI-Install"
elif [ -f "$SCRIPT_DIR/main.ts" ]; then
  INSTALLER_DIR="$SCRIPT_DIR"
else
  error "Cannot find PAI-Install directory. Expected at: $SCRIPT_DIR/PAI-Install/"
  exit 1
fi

info "Launching installer..."
echo ""

# Auto-detect headless/SSH environments and fall back to CLI mode
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ] && [ "$(uname)" != "Darwin" ]; then
    INSTALL_MODE="cli"
    info "Headless environment detected — using CLI installer."
else
    INSTALL_MODE="gui"
fi

exec bun run "$INSTALLER_DIR/main.ts" --mode "$INSTALL_MODE"
