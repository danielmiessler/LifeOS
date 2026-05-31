#!/usr/bin/env bash
# PAI for OpenCode (Codex CLI) — Bootstrap Script
# Usage: source ./init.sh   (run from pai/ directory)
# Or:    CODEX_CONTEXT_DIR="$HOME/pai" codex --context-dir "$CODEX_CONTEXT_DIR"
#
# This script loads PAI context files into OpenCode's session context
# so the agent has access to the Algorithm, ISA, Memory, and Skills.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAI_CONTEXT_DIR="${SCRIPT_DIR}"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   PAI v5.0 — Life Operating System for OpenCode      ║"
echo "║   Algorithm v6.3.0 | Context-based port               ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Verify expected structure
required_files=(
    "SYSTEM.md"
    "ISA.md"
    "MEMORY/README.md"
    "skills/thinking.md"
    "skills/research.md"
)

missing=0
for f in "${required_files[@]}"; do
    if [ ! -f "${PAI_CONTEXT_DIR}/${f}" ]; then
        echo "  ⚠ MISSING: ${f}"
        missing=$((missing + 1))
    else
        echo "  ✓ FOUND: ${f}"
    fi
done

echo ""

if [ "$missing" -gt 0 ]; then
    echo "ERROR: ${missing} required context file(s) missing."
    echo "PAI context is incomplete. Run from the pai/ directory."
    exit 1
fi

echo "PAI context loaded. Agent has access to:"
echo ""
echo "  SYSTEM.md              — Algorithm v6.3.0 (7 phases, modes, tiers)"
echo "  ISA.md                — Ideal State Artifact template (12 sections)"
echo "  MEMORY/README.md      — Memory system structure (3 tiers + aux)"
echo "  skills/thinking.md    — 19 thinking capabilities reference"
echo "  skills/research.md    — Research workflow (4 depth modes)"
echo ""
echo "Ready. The agent will reference these files as instructions."
echo ""

# Optional: set an environment variable so the agent knows PAI is available
export PAI_ACTIVE=true
export PAI_ALGORITHM_VERSION="6.3.0"
export PAI_CONTEXT_DIR="${PAI_CONTEXT_DIR}"

# If running as Codex CLI entry point, launch with context
if command -v codex &>/dev/null; then
    echo "Starting Codex CLI with PAI context..."
    echo "  codex --context-dir \"${PAI_CONTEXT_DIR}\""
    echo ""
    exec codex --context-dir "${PAI_CONTEXT_DIR}" "$@"
fi
