#!/usr/bin/env bash
# PAI v5.0.0 install doctor.
# Checks known release-contract failures without mutating the installation.

set -euo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
PAI_DIR="${PAI_DIR:-$CLAUDE_HOME/PAI}"
FAILURES=0
WARNINGS=0

ok() { printf '✓ %s\n' "$*"; }
warn() { WARNINGS=$((WARNINGS + 1)); printf '⚠ %s\n' "$*"; }
fail() { FAILURES=$((FAILURES + 1)); printf '✗ %s\n' "$*"; }

check_path() {
  local path="$1" label="$2"
  if [ -e "$path" ]; then ok "$label"; else fail "$label missing: $path"; fi
}

printf 'PAI v5 doctor\n'
printf 'CLAUDE_HOME=%s\n' "$CLAUDE_HOME"
printf 'PAI_DIR=%s\n\n' "$PAI_DIR"

check_path "$CLAUDE_HOME/settings.json" "settings.json"
check_path "$PAI_DIR" "PAI directory"
check_path "$PAI_DIR/PULSE" "PULSE directory"
check_path "$PAI_DIR/TOOLS" "TOOLS directory"
check_path "$PAI_DIR/ALGORITHM/LATEST" "Algorithm LATEST"
check_path "$PAI_DIR/PULSE/PULSE.toml" "Pulse config"
check_path "$PAI_DIR/PULSE/run-job.ts" "Pulse run-job"
check_path "$PAI_DIR/PULSE/package.json" "Pulse package.json"
check_path "$CLAUDE_HOME/package.json" "root package.json"

for pair in PULSE:Pulse TOOLS:Tools MEMORY:Memory ALGORITHM:Algorithm DOCUMENTATION:Documentation TEMPLATES:Templates; do
  upper="${pair%%:*}"
  mixed="${pair##*:}"
  if [ -d "$PAI_DIR/$upper" ] && [ ! -e "$PAI_DIR/$mixed" ]; then
    warn "missing compatibility symlink: $PAI_DIR/$mixed -> $upper"
  fi
done

if [ -f "$PAI_DIR/PULSE/run-job.ts" ]; then
  if grep -q '"PAI", "Pulse"' "$PAI_DIR/PULSE/run-job.ts"; then
    fail "run-job.ts still references mixed-case PAI/Pulse"
  else
    ok "run-job.ts uses case-safe Pulse path"
  fi
fi

if [ -f "$PAI_DIR/PULSE/PULSE.toml" ]; then
  for job in assistant-heartbeat assistant-tasks assistant-diary assistant-growth; do
    block=$(awk -v job="$job" '
      $0 == "[[job]]" { printing=0 }
      $0 == "name = \"" job "\"" { printing=1 }
      printing { print }
    ' "$PAI_DIR/PULSE/PULSE.toml")
    if printf '%s\n' "$block" | grep -q 'enabled = true'; then
      warn "$job is enabled; verify Assistant/checks/*.ts exists before running Pulse"
    else
      ok "$job is disabled or absent"
    fi
  done
fi

if [ -f "$CLAUDE_HOME/settings.json" ]; then
  if grep -q '\${HOME}\|\$HOME' "$CLAUDE_HOME/settings.json"; then
    warn "settings.json contains literal HOME tokens; run linux-hotfix.sh to expand env values"
  else
    ok "settings.json has no literal HOME tokens"
  fi
  if grep -q 'PAI/Tools\|PAI/Pulse' "$CLAUDE_HOME/settings.json"; then
    fail "settings.json contains mixed-case PAI paths"
  else
    ok "settings.json has no known mixed-case PAI paths"
  fi
fi

if command -v bun >/dev/null 2>&1; then
  ok "bun is on PATH: $(command -v bun)"
else
  fail "bun is not on PATH"
fi

if command -v jq >/dev/null 2>&1; then
  ok "jq is on PATH"
else
  warn "jq is not installed; some settings normalization checks are limited"
fi

printf '\nSummary: %s failure(s), %s warning(s)\n' "$FAILURES" "$WARNINGS"
[ "$FAILURES" -eq 0 ]
