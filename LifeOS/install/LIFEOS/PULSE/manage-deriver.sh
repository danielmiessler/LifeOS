#!/usr/bin/env bash
# manage-deriver.sh — install / control the proactive deriver loop launchd agent.
#
# The deriver runs nightly via LearningPatternSynthesis.ts --hypothesize,
# scanning recent LEARNING/SIGNALS and WORK/*/ISA.md for emergent patterns
# and emitting up to 3 hypothesis notes per run to
# MEMORY/WISDOM/FRAMES/_hypotheses/. The Pulse /hypotheses tab renders them
# for review (graduate / reject / age out at 30d).
#
# This script mirrors manage.sh's __HOME__/__BUN_PATH__ substitution pattern.
# It is intentionally separate from manage.sh: the deriver is a sibling
# launchd agent, not part of the Pulse runtime.

set -euo pipefail

PULSE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/PULSE"
PLIST_NAME="com.lifeos.deriver"
PLIST_SRC="$PULSE_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
OBSERVABILITY_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/MEMORY/OBSERVABILITY"

if [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
elif [ -x "/opt/homebrew/bin/bun" ]; then
  BUN_PATH="/opt/homebrew/bin/bun"
elif [ -x "/usr/local/bin/bun" ]; then
  BUN_PATH="/usr/local/bin/bun"
else
  BUN_PATH="$(command -v bun || echo "$HOME/.bun/bin/bun")"
fi

OS=$(uname -s)

# Linux/systemd analog is intentionally not implemented — the deriver is a
# nice-to-have on Linux and can be wired by hand via systemd timers if
# needed. Pulse menu bar is already macOS-only; same scope.

case "${1:-}" in
  install)
    if [ "$OS" != "Darwin" ]; then
      echo "manage-deriver.sh: macOS only. Skipping (OS=$OS)."
      exit 0
    fi
    if [ ! -f "$PLIST_SRC" ]; then
      echo "ERROR: plist template missing at $PLIST_SRC" >&2
      exit 1
    fi
    mkdir -p "$OBSERVABILITY_DIR"
    if [ -f "$PLIST_DST" ]; then
      launchctl unload "$PLIST_DST" 2>/dev/null || true
    fi
    sed -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
    launchctl load "$PLIST_DST"
    echo "LifeOS deriver installed (bun: $BUN_PATH, schedule: daily 03:00)"
    ;;

  uninstall)
    if [ "$OS" != "Darwin" ]; then
      echo "manage-deriver.sh: macOS only. Skipping (OS=$OS)."
      exit 0
    fi
    if [ -f "$PLIST_DST" ]; then
      launchctl unload "$PLIST_DST" 2>/dev/null || true
      rm -f "$PLIST_DST"
    fi
    echo "LifeOS deriver uninstalled"
    ;;

  status)
    if [ "$OS" != "Darwin" ]; then
      echo "manage-deriver.sh: macOS only."
      exit 0
    fi
    if launchctl list | grep -q "$PLIST_NAME"; then
      echo "LifeOS deriver: REGISTERED"
      launchctl list | grep "$PLIST_NAME"
    else
      echo "LifeOS deriver: NOT REGISTERED"
    fi
    ;;

  run-now)
    # One-shot manual invocation for testing / first-run priming.
    exec "$BUN_PATH" run "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/TOOLS/LearningPatternSynthesis.ts" --hypothesize
    ;;

  *)
    echo "Usage: $0 {install|uninstall|status|run-now}"
    exit 1
    ;;
esac
