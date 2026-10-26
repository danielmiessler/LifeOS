#!/bin/bash
# LifeOS Pulse — Process Management
# Usage: manage.sh {start|stop|restart|status|install|uninstall|repoint}

PULSE_DIR="$HOME/.claude/LIFEOS/PULSE"
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

# Resolve the configured Pulse port: PULSE_PORT env -> first `port =` line in
# PULSE.toml -> 31337. Mirrors the TS resolver in endpoint.ts (single knob,
# #2392) so scripts, verification, and the daemon all agree on one port.
pulse_port() {
  if [ -n "${PULSE_PORT:-}" ]; then echo "$PULSE_PORT"; return; fi
  local p
  p=$(grep -m1 -E '^port[[:space:]]*=[[:space:]]*[0-9]+' "$PULSE_DIR/PULSE.toml" 2>/dev/null | grep -oE '[0-9]+' || true)
  echo "${p:-31337}"
}
PULSE_PORT_NOW="$(pulse_port)"

case "$1" in
  start)
    if [ "$OS" = "Linux" ]; then
      systemctl --user start "$PLIST_NAME"
      echo "LifeOS Pulse started"
    else
      if [ ! -f "$PLIST_DST" ]; then
        # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
        # no-op on plists that already have literal paths.
        sed -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
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
      # is alive with open fds but never bound the Pulse port.
      systemctl --user stop "$PLIST_NAME" 2>/dev/null || true
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1
      # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
      # no-op on service files that already have literal paths.
      sed -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$SERVICE_SRC" > "$SERVICE_DST"
      # Ensure user services survive logout/reboot (no-op if already enabled)
      loginctl enable-linger "$USER" 2>/dev/null || true
      systemctl --user daemon-reload
      systemctl --user enable "$PLIST_NAME"
      systemctl --user start "$PLIST_NAME"
    else
      # Cleanup any prior pulse before installing fresh — prevents the stale-PID
      # / unbound-port half-dead state where a previous launchd-managed pulse is
      # alive with open fds but never bound the Pulse port.
      if [ -f "$PLIST_DST" ]; then
        launchctl unload "$PLIST_DST" 2>/dev/null || true
      fi
      pkill -9 -f "bun.*pulse.ts" 2>/dev/null || true
      sleep 1

      # Substitute __HOME__ + __BUN_PATH__ placeholders (public template);
      # no-op on plists that already have literal paths.
      sed -e "s|__HOME__|$HOME|g" -e "s|__BUN_PATH__|$BUN_PATH|g" "$PLIST_SRC" > "$PLIST_DST"
      launchctl load "$PLIST_DST"
    fi

    # Verify pulse actually binds the configured port within 10s. Fail loud if not — prior
    # behavior was silent success even when the daemon never came up.
    for _ in $(seq 1 20); do
      sleep 0.5
      if curl -sS --max-time 1 -o /dev/null -X POST "http://localhost:$PULSE_PORT_NOW/notify" \
           -H "Content-Type: application/json" \
           -d '{"message":"","voice_enabled":false}' 2>/dev/null; then
        echo "LifeOS Pulse installed and verified on port $PULSE_PORT_NOW (bun: $BUN_PATH)"
        exit 0
      fi
    done

    echo "ERROR: LifeOS Pulse installed but port $PULSE_PORT_NOW did not bind within 10s." >&2
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

  repoint)
    # Move this install to a different Pulse port in one shot: PULSE.toml +
    # settings.json hook URLs + Hermes guard policy + restart + verify.
    # No source edits — the TS resolver (endpoint.ts) reads PULSE.toml. #2392
    NEW_PORT="${2:-}"
    DRY_RUN=""
    [ "${3:-}" = "--dry-run" ] && DRY_RUN=1
    OLD_PORT="$PULSE_PORT_NOW"
    if ! [[ "$NEW_PORT" =~ ^[0-9]+$ ]] || [ "$NEW_PORT" -lt 1 ] || [ "$NEW_PORT" -gt 65535 ]; then
      echo "Usage: $0 repoint <port> [--dry-run]" >&2
      exit 2
    fi
    if [ "$NEW_PORT" = "$OLD_PORT" ]; then
      echo "Already on port $OLD_PORT — nothing to do."
      exit 0
    fi
    if ss -tln 2>/dev/null | grep -qE "[:.]$NEW_PORT[[:space:]]"; then
      echo "ERROR: port $NEW_PORT is already in use (possibly another install) — pick a free port." >&2
      exit 1
    fi
    if [ -n "$DRY_RUN" ]; then echo "Repointing LifeOS Pulse: $OLD_PORT -> $NEW_PORT (dry-run)"; else echo "Repointing LifeOS Pulse: $OLD_PORT -> $NEW_PORT"; fi
    if [ "$DRY_RUN" = "1" ]; then
      echo "  1. PULSE.toml: first 'port = ' line -> $NEW_PORT (daemon bind + resolver)"
      echo "  2. settings.json: hook URLs localhost:$OLD_PORT -> localhost:$NEW_PORT"
      echo "  3. hermes policy.json: re-emit deny-globs with port $NEW_PORT"
      echo "  4. restart $PLIST_NAME and verify the new bind"
      exit 0
    fi

    # 1. PULSE.toml — first `port =` line (awk: portable first-match replacement)
    TMP_TOML="$(mktemp)"
    awk -v p="$NEW_PORT" 'BEGIN{done=0} !done && /^port[ \t]*=[ \t]*[0-9]+/ { sub(/^port[ \t]*=[ \t]*[0-9]+/, "port = " p); done=1 } { print }' \
      "$PULSE_DIR/PULSE.toml" > "$TMP_TOML" && mv "$TMP_TOML" "$PULSE_DIR/PULSE.toml"

    # 2. settings.json — skill/agent-guard hook URLs
    sed -i.bak "s|localhost:$OLD_PORT/hooks/|localhost:$NEW_PORT/hooks/|g" "$HOME/.claude/settings.json" && rm -f "$HOME/.claude/settings.json.bak"

    # 3. Hermes guard — canonical remount: Mount.ts owns BOTH the plugin
    #    policy.json and the config.yaml approvals.deny list (single owner,
    #    so the deny globs can never drift apart).
    bun "$HOME/.claude/LIFEOS/HERMES/Mount.ts" || { echo "ERROR: hermes remount failed — PULSE.toml/settings.json updated but the guard may still name port $OLD_PORT." >&2; exit 1; }

    # 4. Restart + verify the new bind (same 10s probe as install)
    bash "$PULSE_DIR/manage.sh" restart
    OK=0
    for _ in $(seq 1 20); do
      sleep 0.5
      if curl -sS --max-time 1 -o /dev/null -X POST "http://localhost:$NEW_PORT/notify" \
           -H "Content-Type: application/json" \
           -d '{"message":"","voice_enabled":false}' 2>/dev/null; then OK=1; break; fi
    done
    if [ "$OK" = "1" ]; then
      echo "LifeOS Pulse repointed and verified on port $NEW_PORT"
    else
      echo "ERROR: port $NEW_PORT did not bind within 10s." >&2
      tail -5 "$PULSE_DIR/logs/pulse-stderr.log" >&2
      exit 1
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|install|uninstall|repoint}"
    exit 1
    ;;
esac
