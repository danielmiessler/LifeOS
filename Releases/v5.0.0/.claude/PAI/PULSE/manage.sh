#!/bin/bash
# PAI Pulse — Process Management
# Usage: manage.sh {start|stop|restart|status|install|uninstall}

# shellcheck source=PAI/lib/paths.sh
. "${CLAUDE_CONFIG_DIR:-${HOME:?HOME unset}/.claude}/PAI/lib/paths.sh"
PULSE_DIR="$PAI_DIR/PULSE"
PLIST_NAME="com.pai.pulse"
PLIST_SRC="$PULSE_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
PID_FILE="$PULSE_DIR/state/pulse.pid"
STATE_FILE="$PULSE_DIR/state/state.json"

# Resolve bun's actual location for the launchd job. The public plist
# template ships with `__BUN_PATH__` so the job works for both brew users
# (/opt/homebrew/bin/bun) and curl-installer users (~/.bun/bin/bun).
#
# Order matters. `command -v bun` can resolve to a temporary helper shim
# inside `/private/tmp/bun-node-*/bun` when this script runs inside `bun
# install` (the child shell has its own PATH). That path is ephemeral and
# the launchd job would fail on next boot. Prefer the canonical install
# locations and fall back to `command -v bun` only if neither exists.
if [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
elif [ -x "/opt/homebrew/bin/bun" ]; then
  BUN_PATH="/opt/homebrew/bin/bun"
elif [ -x "/usr/local/bin/bun" ]; then
  BUN_PATH="/usr/local/bin/bun"
else
  BUN_PATH="$(command -v bun || echo "$HOME/.bun/bin/bun")"
fi

# Substitute public-template placeholders into the launchd plist. No-op
# on plists that already have literal paths.
render_plist() {
  sed -e "s|__HOME__|$HOME|g" \
      -e "s|__BUN_PATH__|$BUN_PATH|g" \
      -e "s|__CLAUDE_CONFIG_DIR__|$CLAUDE_CONFIG_DIR|g" \
      -e "s|__PAI_DIR__|$PAI_DIR|g" \
      -e "s|__PULSE_DIR__|$PULSE_DIR|g" \
      "$PLIST_SRC" > "$PLIST_DST"
}

case "$1" in
  start)
    [ -f "$PLIST_DST" ] || render_plist
    launchctl load "$PLIST_DST" 2>/dev/null
    echo "PAI Pulse started"
    ;;

  stop)
    launchctl unload "$PLIST_DST" 2>/dev/null
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      kill "$PID" 2>/dev/null
      echo "PAI Pulse stopped (PID $PID)"
    else
      echo "PAI Pulse stopped"
    fi
    ;;

  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;

  status)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        UPTIME=$(ps -p "$PID" -o etime= | xargs)
        echo "PAI Pulse: RUNNING (PID $PID, uptime $UPTIME)"
      else
        echo "PAI Pulse: DEAD (stale PID $PID)"
      fi
    else
      echo "PAI Pulse: NOT RUNNING (no PID file)"
    fi

    if [ -f "$STATE_FILE" ]; then
      echo ""
      echo "Last job runs:"
      bun -e "
        const state = JSON.parse(require('fs').readFileSync('$STATE_FILE', 'utf-8'));
        for (const [name, info] of Object.entries(state.jobs)) {
          const ago = Math.round((Date.now() - info.lastRun) / 60000);
          const status = info.consecutiveFailures > 0 ? ' [FAILING x' + info.consecutiveFailures + ']' : '';
          console.log('  ' + name + ': ' + ago + ' min ago (' + info.lastResult + ')' + status);
        }
      " 2>/dev/null
    fi
    ;;

  install)
    mkdir -p "$PULSE_DIR/state" "$PULSE_DIR/logs"

    # Cleanup any prior pulse before installing fresh — prevents the stale-PID
    # / unbound-port half-dead state where a previous launchd-managed pulse is
    # alive with open fds but never bound :31337.
    if [ -f "$PLIST_DST" ]; then
      launchctl unload "$PLIST_DST" 2>/dev/null || true
    fi
    pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
    sleep 1

    # Build the dashboard with the user's resolved paths baked in. Next.js
    # inlines NEXT_PUBLIC_* literals at build time, so React display strings
    # reflect this install's CLAUDE_CONFIG_DIR / PAI_DIR — not the
    # maintainer's defaults. Tildify with bash prefix-substitution.
    PAI_TILDE="${PAI_DIR/#$HOME/~}"
    CLAUDE_TILDE="${CLAUDE_CONFIG_DIR/#$HOME/~}"
    (
      set -e
      cd "$PULSE_DIR/Observability"
      "$BUN_PATH" install --silent
      NEXT_PUBLIC_PAI_DIR="$PAI_TILDE" \
      NEXT_PUBLIC_PAI_USER_DIR="$PAI_TILDE/USER" \
      NEXT_PUBLIC_PAI_MEMORY_DIR="$PAI_TILDE/MEMORY" \
      NEXT_PUBLIC_PAI_KNOWLEDGE_DIR="$PAI_TILDE/MEMORY/KNOWLEDGE" \
      NEXT_PUBLIC_PAI_TOOLS_DIR="$PAI_TILDE/TOOLS" \
      NEXT_PUBLIC_CLAUDE_DIR="$CLAUDE_TILDE" \
      NEXT_PUBLIC_CLAUDE_PLANS_DIR="$CLAUDE_TILDE/plans" \
        "$BUN_PATH" run build
    ) || { echo "ERROR: Pulse dashboard build failed." >&2; exit 1; }

    render_plist
    launchctl load "$PLIST_DST"

    # Verify pulse actually binds :31337 within 10s. Fail loud if not — prior
    # behavior was silent success even when the daemon never came up.
    for _ in $(seq 1 20); do
      sleep 0.5
      if curl -sS --max-time 1 -o /dev/null -X POST http://localhost:31337/notify \
           -H "Content-Type: application/json" \
           -d '{"message":"","voice_enabled":false}' 2>/dev/null; then
        echo "PAI Pulse installed and verified on port 31337 (bun: $BUN_PATH)"
        exit 0
      fi
    done

    echo "ERROR: PAI Pulse plist installed but port 31337 did not bind within 10s." >&2
    echo "  Check: tail -50 $PULSE_DIR/logs/pulse-stderr.log" >&2
    exit 1
    ;;

  uninstall)
    launchctl unload "$PLIST_DST" 2>/dev/null
    rm -f "$PLIST_DST"
    echo "PAI Pulse uninstalled"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|install|uninstall}"
    exit 1
    ;;
esac
