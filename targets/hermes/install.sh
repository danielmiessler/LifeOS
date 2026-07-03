#!/usr/bin/env bash
set -euo pipefail

# PAI for Hermes Agent — Installer
# Usage: bash install.sh [--profile dev|default]
# Installs PAI v5.0 skills and memory infrastructure for Hermes Agent

HERMES_PROFILE="${HERMES_PROFILE:-dev}"
PAI_SOURCE="$(cd "$(dirname "$0")" && pwd)"

# Resolve Hermes profile directory
if [ "$HERMES_PROFILE" = "default" ]; then
  HERMES_HOME="$HOME/.hermes"
else
  HERMES_HOME="$HOME/.hermes/profiles/$HERMES_PROFILE"
fi

# PAI root — created at the Hermes root so it works across profiles
# A cross-profile symlink ensures dev/default both resolve
PAI_ROOT="$HOME/.hermes/pai"

echo "=== PAI v5.0 for Hermes Agent ==="
echo "Profile: $HERMES_PROFILE"
echo "Target:  $HERMES_HOME"
echo "PAI root: $PAI_ROOT"
echo ""

# Check Hermes is installed
if ! command -v hermes &>/dev/null; then
  echo "ERROR: Hermes CLI not found. Install it first:"
  echo "  pip install hermes-agent"
  exit 1
fi

# Create PAI directory structure at the canonical root
echo "Creating PAI memory infrastructure..."
mkdir -p "$PAI_ROOT/MEMORY"/{WORK,KNOWLEDGE/{People,Companies,Ideas,Research,Blogs},LEARNING,STATE,SKILLS,RELATIONSHIP,OBSERVABILITY,PROJECT,SCRATCHPAD,WISDOM,VERIFICATION,AUTO,RAW}
mkdir -p "$PAI_ROOT/USER/TELOS"
mkdir -p "$PAI_ROOT/ALGORITHM"

# Initialize state
echo '{"version":1,"active_sessions":[],"completed_sessions":[]}' > "$PAI_ROOT/MEMORY/STATE/work.json"

# Copy template USER files
cp "$PAI_SOURCE/pai/USER/PRINCIPAL_IDENTITY.md" "$PAI_ROOT/USER/" 2>/dev/null || true
cp "$PAI_SOURCE/pai/USER/DA_IDENTITY.md" "$PAI_ROOT/USER/" 2>/dev/null || true
cp "$PAI_SOURCE/pai/ALGORITHM/ALGORITHM.md" "$PAI_ROOT/ALGORITHM/" 2>/dev/null || true
cp "$PAI_SOURCE/pai/PAI_SYSTEM_PROMPT.md" "$PAI_ROOT/" 2>/dev/null || true

# Create cross-profile symlink so dev/default both resolve
mkdir -p "$HERMES_HOME"
if [ ! -L "$HERMES_HOME/pai" ] && [ ! -d "$HERMES_HOME/pai" ]; then
  ln -sf "$PAI_ROOT" "$HERMES_HOME/pai"
  echo "  ✅ Symlink: $HERMES_HOME/pai -> $PAI_ROOT"
fi

# Install skill packs
echo "Installing PAI skill packs..."
SKILL_COUNT=0
for skill_dir in "$PAI_SOURCE/skills"/*/; do
  skill_name="$(basename "$skill_dir")"
  target="$HERMES_HOME/skills/software-development/$skill_name"
  mkdir -p "$target"
  cp -r "$skill_dir"/* "$target/"
  SKILL_COUNT=$((SKILL_COUNT + 1))
  echo "  ✅ $skill_name"
done

echo ""
echo "=== Installation Complete ==="
echo "Skills installed: $SKILL_COUNT"
echo ""
echo "To verify:"
echo "  hermes skills list | grep pai-"
echo ""
echo "To start using:"
echo "  hermes -s pai-algorithm \"your task description\""
echo ""
echo "PAI memory root: $PAI_ROOT"
echo "Execution log:   $PAI_ROOT/MEMORY/SKILLS/execution.jsonl"
