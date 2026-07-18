#!/bin/bash
# LifeOS Pulse — Process Management
# Usage: manage.sh {start|stop|restart|status|install|uninstall}

# Resolve PULSE_DIR from this script's OWN location — not a hardcoded ~/.claude.
# manage.sh always ships alongside the PULSE tree it manages, so this is correct for
# both the default install (~/.claude/LIFEOS/PULSE) and a custom LifeOS home
# (LIFEOS_HOME install, e.g. ~/Project/.claude/LIFEOS/PULSE). __LIFEOS_DIR__ in the
# plist/service template is substituted with the derived <configRoot>/LIFEOS below.
PULSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIFEOS_DIR_RESOLVED="$(dirname "$PULSE_DIR")"
PLIST_NAME="com.lifeos.pulse"
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

# OS detection — Linux uses systemd --user, macOS uses launchctl.
OS=$(uname -s)
SERVICE_SRC="$PULSE_DIR/$PLIST_NAME.service"
SYSTEMD_SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_DST="$SYSTEMD_SERVICE_DIR/$PLIST_NAME.service"

case "$1" in
  start)
    if [ "$OS" = "Linux" ]; then
      systemctl --user start "$PLIST_NAME"
      echo "LifeOS Pulse started"
    else
      if [ ! -f "$PLIST_DST" ]; then
        # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
        # no-op on plists that already have literal paths.
        sed -e "s|__LIFEOS_DIR__|$LIFEOS_DIR_RESOLVED|g" -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
      fi
      launchctl load "$PLIST_DST" 2>/dev/null
      echo "LifeOS Pulse started"
    fi
    ;;

  stop)
    if [ "$OS" = "Linux" ]; then
      systemctl --user stop "$PLIST_NAME" 2>/dev/null
    else
      launchctl unload "$PLIST_DST" 2>/dev/null
    fi
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      kill "$PID" 2>/dev/null
      echo "LifeOS Pulse stopped (PID $PID)"
    else
      echo "LifeOS Pulse stopped"
    fi
    ;;

  restart)
    # Use the resolved script path, not bare "$0" — when invoked as `bash manage.sh
    # restart` (no leading path) "$0" is just `manage.sh` and the self-reinvoke fails
    # with "command not found".
    bash "$PULSE_DIR/manage.sh" stop
    sleep 2
    bash "$PULSE_DIR/manage.sh" start
    ;;

  status)
    if [ "$OS" = "Linux" ]; then
      systemctl --user status "$PLIST_NAME"
    else
      if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
          UPTIME=$(ps -p "$PID" -o etime= | xargs)
          echo "LifeOS Pulse: RUNNING (PID $PID, uptime $UPTIME)"
        else
          echo "LifeOS Pulse: DEAD (stale PID $PID)"
        fi
      else
        echo "LifeOS Pulse: NOT RUNNING (no PID file)"
      fi
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

    if [ "$OS" = "Linux" ]; then
      mkdir -p "$SYSTEMD_SERVICE_DIR"
      # Kill any prior pulse before installing fresh — prevents the stale-PID
      # / unbound-port half-dead state where a previous service-managed pulse
      # is alive with open fds but never bound :31337.
      systemctl --user stop "$PLIST_NAME" 2>/dev/null || true
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1
      # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
      # no-op on service files that already have literal paths.
      sed -e "s|__LIFEOS_DIR__|$LIFEOS_DIR_RESOLVED|g" -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$SERVICE_SRC" > "$SERVICE_DST"
      # Ensure user services survive logout/reboot (no-op if already enabled)
      loginctl enable-linger "$USER" 2>/dev/null || true
      systemctl --user daemon-reload
      systemctl --user enable "$PLIST_NAME"
      systemctl --user start "$PLIST_NAME"
    else
      # Cleanup any prior pulse before installing fresh — prevents the stale-PID
      # / unbound-port half-dead state where a previous launchd-managed pulse is
      # alive with open fds but never bound :31337.
      if [ -f "$PLIST_DST" ]; then
        launchctl unload "$PLIST_DST" 2>/dev/null || true
      fi
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1

      # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
      # no-op on plists that already have literal paths.
      sed -e "s|__LIFEOS_DIR__|$LIFEOS_DIR_RESOLVED|g" -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
      launchctl load "$PLIST_DST"
    fi

    # Verify pulse actually binds :31337 within 10s. Fail loud if not — prior
    # behavior was silent success even when the daemon never came up.
    for _ in $(seq 1 20); do
      sleep 0.5
      if curl -sS --max-time 1 -o /dev/null -X POST http://localhost:31337/notify \
           -H "Content-Type: application/json" \
           -d '{"message":"","voice_enabled":false}' 2>/dev/null; then
        echo "LifeOS Pulse installed and verified on port 31337 (bun: $BUN_PATH)"
        exit 0
      fi
    done

    echo "ERROR: LifeOS Pulse installed but port 31337 did not bind within 10s." >&2
    echo "  Check: tail -50 $PULSE_DIR/logs/pulse-stderr.log" >&2
    exit 1
    ;;

  uninstall)
    if [ "$OS" = "Linux" ]; then
      systemctl --user disable --now "$PLIST_NAME" 2>/dev/null
      rm -f "$SERVICE_DST"
    else
      launchctl unload "$PLIST_DST" 2>/dev/null
      rm -f "$PLIST_DST"
    fi
    echo "LifeOS Pulse uninstalled"
    ;;

  render)
    # Dry-run: print the substituted launchd plist (macOS) or systemd unit (Linux)
    # to stdout WITHOUT loading it. Lets you inspect the wiring — and the install
    # integration test assert it targets the resolved (custom) home, not ~/.claude.
    if [ "$OS" = "Linux" ]; then SRC="$SERVICE_SRC"; else SRC="$PLIST_SRC"; fi
    sed -e "s|__LIFEOS_DIR__|$LIFEOS_DIR_RESOLVED|g" -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$SRC"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|install|uninstall|render}"
    exit 1
    ;;
esac
