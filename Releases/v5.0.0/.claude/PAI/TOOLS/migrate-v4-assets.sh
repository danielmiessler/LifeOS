#!/usr/bin/env bash
# PAI v4 -> v5 asset migration helper.
# Safely copies common user-owned assets missed by the v5 migration path.

set -euo pipefail

SRC_CLAUDE="${SRC_CLAUDE:-$HOME/.claude.backup}"
DST_CLAUDE="${DST_CLAUDE:-$HOME/.claude}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf '[pai-v4-migrate] %s\n' "$*"; }
warn() { printf '[pai-v4-migrate] WARN: %s\n' "$*" >&2; }
run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[pai-v4-migrate] DRY RUN: %s\n' "$*"
  else
    "$@"
  fi
}

usage() {
  cat <<'EOF'
Usage:
  SRC_CLAUDE=/path/to/old/.claude DST_CLAUDE=$HOME/.claude bash migrate-v4-assets.sh

Defaults:
  SRC_CLAUDE=$HOME/.claude.backup
  DST_CLAUDE=$HOME/.claude

Set DRY_RUN=1 to print actions without copying.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

[ -d "$SRC_CLAUDE" ] || { warn "source not found: $SRC_CLAUDE"; usage; exit 1; }
[ -d "$DST_CLAUDE" ] || { warn "destination not found: $DST_CLAUDE"; usage; exit 1; }

log "SRC_CLAUDE=$SRC_CLAUDE"
log "DST_CLAUDE=$DST_CLAUDE"

# 1. Custom skills: preserve user-created skill directories without overwriting v5 skills.
if [ -d "$SRC_CLAUDE/skills" ]; then
  run mkdir -p "$DST_CLAUDE/skills"
  while IFS= read -r -d '' skill_dir; do
    name="$(basename "$skill_dir")"
    if [ -e "$DST_CLAUDE/skills/$name" ]; then
      warn "skill exists in destination, skipping: $name"
    else
      log "copying skill: $name"
      run cp -a "$skill_dir" "$DST_CLAUDE/skills/$name"
    fi
  done < <(find "$SRC_CLAUDE/skills" -mindepth 1 -maxdepth 1 -type d -print0)
else
  warn "no old skills directory found at $SRC_CLAUDE/skills"
fi

# 2. Telegram credentials: v4 kept them under channels/telegram/.env; v5 reads ~/.claude/.env.
OLD_TG_ENV="$SRC_CLAUDE/channels/telegram/.env"
NEW_ENV="$DST_CLAUDE/.env"
if [ -f "$OLD_TG_ENV" ]; then
  run touch "$NEW_ENV"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      TELEGRAM_*|BOT_TOKEN=*|CHAT_ID=*)
        key="${line%%=*}"
        if grep -q "^${key}=" "$NEW_ENV" 2>/dev/null; then
          warn "destination .env already has $key, leaving existing value"
        else
          log "migrating Telegram env key: $key"
          if [ "$DRY_RUN" = "1" ]; then
            printf '[pai-v4-migrate] DRY RUN: append %s to %s\n' "$key" "$NEW_ENV"
          else
            printf '%s\n' "$line" >> "$NEW_ENV"
          fi
        fi
        ;;
    esac
  done < "$OLD_TG_ENV"
else
  warn "no old Telegram .env found at $OLD_TG_ENV"
fi

log "Done. Review $DST_CLAUDE/.env and restart Pulse if Telegram is enabled."
