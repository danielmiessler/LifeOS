#!/bin/bash
# PAI Pulse — Process Management
# Usage: manage.sh {start|stop|restart|status|install|uninstall}
#
# macOS: launchd via com.pai.pulse.plist + ~/Library/LaunchAgents.
# Linux: systemd --user via pai-pulse.service + ~/.config/systemd/user.

PULSE_DIR="$HOME/.claude/PAI/PULSE"

# launchd (macOS) artifacts
PLIST_NAME="com.pai.pulse"
PLIST_SRC="$PULSE_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

# systemd (Linux) artifacts
SERVICE_NAME="pai-pulse.service"
SERVICE_SRC="$PULSE_DIR/$SERVICE_NAME"
SERVICE_DST="$HOME/.config/systemd/user/$SERVICE_NAME"

PID_FILE="$PULSE_DIR/state/pulse.pid"
STATE_FILE="$PULSE_DIR/state/state.json"

OS="$(uname -s)"

# Resolve bun's actual location for the service unit. Templates ship with
# `__BUN_PATH__` so the job works for both brew users
# (/opt/homebrew/bin/bun) and curl-installer users (~/.bun/bin/bun).
#
# Order matters. `command -v bun` can resolve to a temporary helper shim
# inside `/private/tmp/bun-node-*/bun` when this script runs inside `bun
# install` (the child shell has its own PATH). That path is ephemeral and
# the launchd / systemd job would fail on next boot. Prefer the canonical
# install locations and fall back to `command -v bun` only if neither exists.
if [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
elif [ -x "/opt/homebrew/bin/bun" ]; then
  BUN_PATH="/opt/homebrew/bin/bun"
elif [ -x "/usr/local/bin/bun" ]; then
  BUN_PATH="/usr/local/bin/bun"
else
  BUN_PATH="$(command -v bun || echo "$HOME/.bun/bin/bun")"
fi

# Substitute __HOME__ + __BUN_PATH__ placeholders into the destination path.
render_template() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  sed -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$src" > "$dst"
}

# ── Per-OS lifecycle helpers ──────────────────────────────────

service_start() {
  case "$OS" in
    Darwin)
      [ -f "$PLIST_DST" ] || render_template "$PLIST_SRC" "$PLIST_DST"
      launchctl load "$PLIST_DST" 2>/dev/null
      ;;
    Linux)
      if [ ! -f "$SERVICE_DST" ]; then
        render_template "$SERVICE_SRC" "$SERVICE_DST"
        systemctl --user daemon-reload
      fi
      systemctl --user start "$SERVICE_NAME"
      ;;
    *)
      echo "ERROR: unsupported OS '$OS' — supported: Darwin, Linux" >&2
      exit 1
      ;;
  esac
}

service_stop() {
  case "$OS" in
    Darwin) launchctl unload "$PLIST_DST" 2>/dev/null ;;
    Linux)  systemctl --user stop "$SERVICE_NAME" 2>/dev/null ;;
  esac
}

service_install() {
  case "$OS" in
    Darwin)
      if [ -f "$PLIST_DST" ]; then
        launchctl unload "$PLIST_DST" 2>/dev/null || true
      fi
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1
      render_template "$PLIST_SRC" "$PLIST_DST"
      launchctl load "$PLIST_DST"
      ;;
    Linux)
      systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1
      render_template "$SERVICE_SRC" "$SERVICE_DST"
      systemctl --user daemon-reload
      systemctl --user enable --now "$SERVICE_NAME"
      # Hint about linger so the service keeps running after logout.
      if ! loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=yes"; then
        echo "Hint: 'sudo loginctl enable-linger $USER' to keep Pulse running after logout." >&2
      fi
      ;;
    *)
      echo "ERROR: unsupported OS '$OS' — supported: Darwin, Linux" >&2
      exit 1
      ;;
  esac
}

service_uninstall() {
  case "$OS" in
    Darwin)
      launchctl unload "$PLIST_DST" 2>/dev/null
      rm -f "$PLIST_DST"
      ;;
    Linux)
      systemctl --user disable --now "$SERVICE_NAME" 2>/dev/null
      rm -f "$SERVICE_DST"
      systemctl --user daemon-reload
      ;;
  esac
}

# ── Commands ──────────────────────────────────────────────────

case "$1" in
  start)
    service_start
    echo "PAI Pulse started"
    ;;

  stop)
    service_stop
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
    # / unbound-port half-dead state where a previous service-managed pulse is
    # alive with open fds but never bound :31337.
    service_install

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

    echo "ERROR: PAI Pulse service installed but port 31337 did not bind within 10s." >&2
    echo "  Check: tail -50 $PULSE_DIR/logs/pulse-stderr.log" >&2
    if [ "$OS" = "Linux" ]; then
      echo "  Or:    journalctl --user -u $SERVICE_NAME -n 50 --no-pager" >&2
    fi
    exit 1
    ;;

  uninstall)
    service_uninstall
    echo "PAI Pulse uninstalled"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|install|uninstall}"
    exit 1
    ;;
esac
