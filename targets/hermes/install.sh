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

echo "=== PAI v5.0 for Hermes Agent ==="
echo "Profile: $HERMES_PROFILE"
echo "Target:  $HERMES_HOME"
echo ""

# Check Hermes is installed
if ! command -v hermes &>/dev/null; then
  echo "ERROR: Hermes CLI not found. Install it first:"
  echo "  pip install hermes-agent"
  exit 1
fi

# Create PAI directory structure
echo "Creating PAI memory infrastructure..."
mkdir -p "$HERMES_HOME/pai/MEMORY"/{WORK,KNOWLEDGE/{People,Companies,Ideas,Research,Blogs},LEARNING,STATE,SKILLS,RELATIONSHIP,OBSERVABILITY,PROJECT,SCRATCHPAD,WISDOM,VERIFICATION,AUTO,RAW}
mkdir -p "$HERMES_HOME/pai/USER/TELOS"
mkdir -p "$HERMES_HOME/pai/ALGORITHM"

# Initialize state
echo '{"version":1,"active_sessions":[],"completed_sessions":[]}' > "$HERMES_HOME/pai/MEMORY/STATE/work.json"

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
echo "PAI memory root: $HERMES_HOME/pai/"
