#!/usr/bin/env bash
# PAI v5.0.0 Linux/headless hotfix
# Idempotently repairs the release issues that macOS case-insensitive filesystems hide.

set -euo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
PAI_DIR="${PAI_DIR:-$CLAUDE_HOME/PAI}"
PULSE_DIR="$PAI_DIR/PULSE"

log() { printf '[pai-linux-hotfix] %s\n' "$*"; }
warn() { printf '[pai-linux-hotfix] WARN: %s\n' "$*" >&2; }

if [[ ! -d "$PAI_DIR" ]]; then
  printf '[pai-linux-hotfix] ERROR: PAI directory not found: %s\n' "$PAI_DIR" >&2
  exit 1
fi

log "Using CLAUDE_HOME=$CLAUDE_HOME"
log "Using PAI_DIR=$PAI_DIR"

# 1. Case-compat symlinks for Linux filesystems.
#    The v5.0.0 bundle ships ALL_CAPS directories while several code/docs paths use mixed case.
for pair in PULSE:Pulse TOOLS:Tools MEMORY:Memory ALGORITHM:Algorithm DOCUMENTATION:Documentation TEMPLATES:Templates; do
  upper="${pair%%:*}"
  mixed="${pair##*:}"
  if [[ -d "$PAI_DIR/$upper" && ! -e "$PAI_DIR/$mixed" ]]; then
    ln -s "$upper" "$PAI_DIR/$mixed"
    log "Created $PAI_DIR/$mixed -> $upper"
  fi
done

# 2. Fix known hard-coded PAI/Pulse reference in run-job.ts.
if [[ -f "$PULSE_DIR/run-job.ts" ]]; then
  perl -0pi -e 's/"\.claude",\s*"PAI",\s*"Pulse"/".claude", "PAI", "PULSE"/g' "$PULSE_DIR/run-job.ts"
  log "Patched PULSE/run-job.ts path casing"
fi

# 3. Ensure root runtime dependencies exist for hooks that import bare npm packages.
if [[ ! -f "$CLAUDE_HOME/package.json" ]]; then
  cat > "$CLAUDE_HOME/package.json" <<'JSON'
{
  "name": "pai-runtime",
  "version": "5.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "grammy": "^1.30.0",
    "minisearch": "^7.1.0",
    "smol-toml": "^1.3.0",
    "yaml": "^2.7.0"
  }
}
JSON
  log "Created $CLAUDE_HOME/package.json"
fi

# 4. Ensure Pulse-local package.json exists for `cd PAI/PULSE && bun ...` workflows.
if [[ -d "$PULSE_DIR" && ! -f "$PULSE_DIR/package.json" ]]; then
  cat > "$PULSE_DIR/package.json" <<'JSON'
{
  "name": "pai-pulse",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun run pulse.ts"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "grammy": "^1.30.0",
    "minisearch": "^7.1.0",
    "smol-toml": "^1.3.0",
    "yaml": "^2.7.0"
  }
}
JSON
  log "Created $PULSE_DIR/package.json"
fi

# 5. Remove known self-referential symlink that can crash Bun's watcher with ELOOP.
BROKEN_RULE="$PULSE_DIR/Observability/.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc"
if [[ -L "$BROKEN_RULE" ]]; then
  target="$(readlink "$BROKEN_RULE" || true)"
  if [[ "$target" == "use-bun-instead-of-node-vite-npm-pnpm.mdc" || "$target" == "$BROKEN_RULE" ]]; then
    rm -f "$BROKEN_RULE"
    log "Removed self-referential Observability .cursor rule symlink"
  fi
fi

# 6. Fix shell aliases that point at mixed-case Tools.
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
  [[ -f "$rc" ]] || continue
  perl -0pi -e 's#PAI/Tools/#PAI/TOOLS/#g; s#PAI/Pulse/#PAI/PULSE/#g' "$rc"
  if ! grep -q "alias pai=.*PAI/TOOLS/pai.ts" "$rc" 2>/dev/null; then
    printf "\nalias pai='bun %q'\n" "$PAI_DIR/TOOLS/pai.ts" >> "$rc"
    log "Added pai alias to $rc"
  else
    log "Verified pai alias in $rc"
  fi
done

# 7. Expand literal HOME tokens in settings.json env values when jq is available.
SETTINGS="$CLAUDE_HOME/settings.json"
if [[ -f "$SETTINGS" ]] && command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --arg home "$HOME" '
    if .env then
      .env |= with_entries(.value |= (if type == "string" then gsub("\\$\\{HOME\\}|\\$HOME"; $home) else . end))
    else . end
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  log "Expanded literal HOME tokens in settings.json env values"
fi

# 8. Install dependencies when Bun is available. This is intentionally non-fatal for offline systems.
if command -v bun >/dev/null 2>&1; then
  (cd "$CLAUDE_HOME" && bun install) || warn "bun install failed in $CLAUDE_HOME"
  if [[ -d "$PULSE_DIR" ]]; then
    (cd "$PULSE_DIR" && bun install) || warn "bun install failed in $PULSE_DIR"
  fi
else
  warn "bun not found; dependency installation skipped"
fi

log "Done. Restart Pulse or start it manually with: cd '$PULSE_DIR' && bun run pulse.ts"
