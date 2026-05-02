#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  PAI Installer v5.0 — Bootstrap Script
#  Requirements: bash, curl
#  This script bootstraps the installer by ensuring Bun is
#  available, then hands off to the TypeScript installer.
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# ─── Path resolution (PAI may not exist yet — fallback bootstrap) ──────────
if [ -f "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/PAI/lib/paths.sh" ]; then
  # shellcheck source=PAI/lib/paths.sh
  . "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/PAI/lib/paths.sh"
else
  : "${CLAUDE_CONFIG_DIR:=$HOME/.claude}"
  : "${PAI_DIR:=$CLAUDE_CONFIG_DIR/PAI}"
  export CLAUDE_CONFIG_DIR PAI_DIR
fi

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

# ─── Resolve Script Directory + Algo Version (BEFORE banner — set -u) ──
# Banner displays Algo version read from LATEST; both must be defined first
# or `set -euo pipefail` aborts the script with "unbound variable" on line 46.
SOURCE_BANNER="${BASH_SOURCE[0]}"
while [ -L "$SOURCE_BANNER" ]; do
  DIR_BANNER="$(cd "$(dirname "$SOURCE_BANNER")" && pwd)"
  SOURCE_BANNER="$(readlink "$SOURCE_BANNER")"
  [[ "$SOURCE_BANNER" != /* ]] && SOURCE_BANNER="$DIR_BANNER/$SOURCE_BANNER"
done
SCRIPT_DIR_BANNER="$(cd "$(dirname "$SOURCE_BANNER")" && pwd)"
ALGO_VERSION_FILE="$SCRIPT_DIR_BANNER/PAI/ALGORITHM/LATEST"
if [ -f "$ALGO_VERSION_FILE" ]; then
  ALGO_VERSION_DISPLAY="v$(tr -d '[:space:]' < "$ALGO_VERSION_FILE" | sed 's/^v//')"
else
  ALGO_VERSION_DISPLAY="v?.?.?"
fi

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
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${GRAY}\"${RESET}${LIGHT_BLUE}Welcome — let's get you set up${RESET}${GRAY}...\"${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${BAR}"
echo -e "           ${NAVY}████${RESET}        ${NAVY}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${NAVY}⬢${RESET}  ${GRAY}PAI${RESET}       ${SILVER}v5.0.0${RESET}"
echo -e "           ${NAVY}████${RESET}        ${NAVY}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${NAVY}⚙${RESET}  ${GRAY}Algo${RESET}      ${SILVER}${ALGO_VERSION_DISPLAY}${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${LIGHT_BLUE}✦${RESET}  ${GRAY}Installer${RESET} ${SILVER}v5.0${RESET}"
echo -e "           ${NAVY}████████████████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${BAR}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}  ${YELLOW}⚠  Alpha — rough edges expected${RESET}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo -e "           ${NAVY}████${RESET}        ${BLUE}████${RESET}${LIGHT_BLUE}████${RESET}   ${SEP}"
echo ""
echo ""
echo -e "                       ${STEEL}→${RESET} ${BLUE}github.com/danielmiessler/PAI${RESET}"
echo ""
echo -e "${STEEL}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${RESET}"
echo ""

# ─── Reuse pre-banner script-dir resolution ─────────────
# SCRIPT_DIR was already resolved before the banner so ALGO_VERSION_DISPLAY
# could render. Alias to the canonical SCRIPT_DIR name the rest of this
# script uses without re-walking the symlink chain.
SCRIPT_DIR="$SCRIPT_DIR_BANNER"

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

# ─── Make bun reachable for non-interactive subprocess spawns ──────
# Critical for Claude Code hooks (`#!/usr/bin/env bun` shebang). The bun
# curl installer puts bun at ~/.bun/bin/bun and adds an export line to
# .zshrc — but .zshrc is only sourced for interactive shells. Hooks
# spawned by Claude Code inherit a non-interactive PATH where ~/.bun/bin
# is missing, so every .hook.ts silently fails to launch (voice doesn't
# fire, statusline can't run bun-based scripts, etc).
#
# Two-prong fix: (1) symlink to a system-wide location that's in every
# default PATH so /usr/bin/env can find it without any shell config,
# (2) add the export to .zshenv (which IS sourced for non-interactive zsh)
# and .zprofile (login shells).
if [ -x "$HOME/.bun/bin/bun" ]; then
  # System-wide symlink. Try writable target first; sudo only if needed.
  for target in /usr/local/bin /opt/homebrew/bin; do
    if [ -d "$target" ] && [ -w "$target" ] && [ ! -e "$target/bun" ]; then
      ln -sf "$HOME/.bun/bin/bun" "$target/bun" && success "Linked bun → $target/bun" && break
    fi
  done
  if ! command -v /usr/local/bin/bun &>/dev/null && ! command -v /opt/homebrew/bin/bun &>/dev/null; then
    # /usr/local/bin needs sudo — try non-fatally
    if sudo -n ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun 2>/dev/null; then
      success "Linked bun → /usr/local/bin/bun (via sudo)"
    else
      warn "Could not symlink bun system-wide. Hooks may fail in non-interactive shells."
      warn "  To fix manually: sudo ln -sf $HOME/.bun/bin/bun /usr/local/bin/bun"
    fi
  fi

  # Persist PATH to shell config files (idempotent).
  # .zshenv is sourced for ALL zsh invocations including non-interactive subshells.
  # .zprofile is sourced for login shells. .zshrc for interactive.
  # .bash_profile for bash login. We cover all four to be robust.
  BUN_EXPORT='export PATH="$HOME/.bun/bin:$PATH"'
  for rc in "$HOME/.zshenv" "$HOME/.zprofile" "$HOME/.zshrc" "$HOME/.bash_profile"; do
    # Create the file if it doesn't exist (touch is harmless).
    [ -f "$rc" ] || touch "$rc"
    if ! grep -q '\.bun/bin' "$rc" 2>/dev/null; then
      echo "" >> "$rc"
      echo "# Added by PAI installer — make bun reachable for hook subprocesses" >> "$rc"
      echo "$BUN_EXPORT" >> "$rc"
      success "Added bun PATH export to $(basename "$rc")"
    fi
  done
fi

# ─── Check Claude Code ───────────────────────────────────
if command -v claude &>/dev/null; then
  success "Claude Code found"
else
  warn "Claude Code not found — will install during setup"
fi

# ─── Launch Installer ────────────────────────────────────
# Resolve PAI-Install directory. Canonical location is $SCRIPT_DIR/PAI/PAI-Install
# (install.sh lives at ~/.claude/ root). Fallbacks cover legacy nested layouts
# in case install.sh is executed from inside PAI-Install/.
INSTALLER_DIR=""
if [ -d "$SCRIPT_DIR/PAI/PAI-Install" ]; then
  INSTALLER_DIR="$SCRIPT_DIR/PAI/PAI-Install"
elif [ -d "$SCRIPT_DIR/PAI-Install" ]; then
  INSTALLER_DIR="$SCRIPT_DIR/PAI-Install"
elif [ -f "$SCRIPT_DIR/main.ts" ]; then
  INSTALLER_DIR="$SCRIPT_DIR"
else
  error "Cannot find PAI-Install directory. Expected at: $SCRIPT_DIR/PAI/PAI-Install/"
  exit 1
fi

# DA identity setup is handled by the wizard (main.ts → CLI or GUI), not by
# this bootstrap script. Running it here would duplicate prompts the wizard
# already asks. The wizard knows install order: copy files first, then DA.
echo ""

info "Launching installer..."
echo ""

# Auto-detect environments where the GUI installer can't render and fall
# back to CLI. Three triggers, any of which forces --mode cli:
#   1. Linux/BSD with no $DISPLAY / $WAYLAND_DISPLAY → headless
#   2. Any SSH session ($SSH_CONNECTION / $SSH_TTY set) → no console GUI
#   3. PAI_TEST_AUTOMATED=1 → harness runs (Tart/CI/etc.)
# `${VAR:-}` form survives `set -u` when the env var is unset.
if [ -z "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ] && [ "$(uname)" != "Darwin" ]; then
    INSTALL_MODE="cli"
    info "Headless environment detected — using CLI installer."
elif [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_TTY:-}" ]; then
    INSTALL_MODE="cli"
    info "SSH session detected — using CLI installer."
elif [ "${PAI_TEST_AUTOMATED:-}" = "1" ]; then
    INSTALL_MODE="cli"
    info "Automated test mode — using CLI installer."
else
    INSTALL_MODE="gui"
fi

# Export the bundle directory so the wizard can install from local files
# instead of git-cloning the public repo. SCRIPT_DIR is the directory
# containing this install.sh — the root of the v5 release bundle.
export PAI_BUNDLE_DIR="$SCRIPT_DIR"

# Run the wizard. We deliberately do NOT exec here — once the wizard exits we
# need to hand off to the user's interactive shell with `pai` already running.
bun run "$INSTALLER_DIR/main.ts" --mode "$INSTALL_MODE"
INSTALL_EXIT=$?

# Post-wizard handoff. Two paths, in priority order:
#
# 1. Controlling terminal accessible (any path where the user can see/type:
#    direct `bash install.sh`, SSH session running `curl … | sh`, local
#    `curl … | sh` in Terminal): redirect stdin from /dev/tty and exec into
#    `zsh -i -c 'source ~/.zshrc && pai'`. The /dev/tty redirect is what
#    makes this work under `curl | sh` — stdin to the install.sh process is
#    the curl pipe (not a TTY), but /dev/tty still resolves to the user's
#    actual controlling terminal, so the new zsh + pai inherit a real TTY
#    and Claude Code can read keystrokes. Without the redirect, pai would
#    launch with a closed-pipe stdin and immediately fail or hang.
#
# 2. No controlling terminal (true headless: CI harness, daemon spawn): print
#    the explicit one-liner. We deliberately do NOT fall through to
#    `osascript … Terminal` here — on a remote/headless macOS box that
#    silently opens a window the user can't see, leaving them thinking
#    nothing happened (the bug Daniel hit on server.baylander.lan).
if [ "$INSTALL_EXIT" -eq 0 ]; then
  echo ""
  if [ -r /dev/tty ]; then
    info "Launching pai..."
    exec zsh -i -c 'source ~/.zshrc && pai' < /dev/tty
  else
    info "Install complete. To start pai, run:  ${BOLD}source ~/.zshrc && pai${RESET}"
  fi
fi
exit $INSTALL_EXIT
