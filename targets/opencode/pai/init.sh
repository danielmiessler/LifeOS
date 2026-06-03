#!/usr/bin/env bash
# PAI for OpenCode (Codex CLI) — Bootstrap Script
# Usage:   source ./init.sh   (run from pai/ directory)
# Usage:   bash ./init.sh     (same, but won't set env in current shell)
#
# This script loads PAI context into the environment so Codex CLI
# agents can reference Algorithm, ISA, Memory, and Skills files.
#
# Idempotent — safe to source multiple times. Uses PAI_ACTIVE guard.

# ───────────────────────────────────────────────────────────────
# Idempotency guard: skip if already initialized
# ───────────────────────────────────────────────────────────────
if [ "${PAI_ACTIVE:-0}" = "1" ]; then
    echo "[PAI] Already active (PAI_ACTIVE=1). Skipping re-init."
    return 0 2>/dev/null || exit 0
fi

# ───────────────────────────────────────────────────────────────
# Setup
# ───────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAI_CONTEXT_DIR="${SCRIPT_DIR}"

# ───────────────────────────────────────────────────────────────
# Banner
# ───────────────────────────────────────────────────────────────
printf "\n"
printf "\e[1;36m╔══════════════════════════════════════════════════════════╗\e[0m\n"
printf "\e[1;36m║   PAI v5.0 — Life Operating System for OpenCode        ║\e[0m\n"
printf "\e[1;36m║   Algorithm v6.3.0 | Context-based port                ║\e[0m\n"
printf "\e[1;36m╚══════════════════════════════════════════════════════════╝\e[0m\n"
printf "\n"

# ───────────────────────────────────────────────────────────────
# Step 1: Validate required files and directories exist
# ───────────────────────────────────────────────────────────────
printf "\e[1m[1/4] Validating PAI structure…\e[0m\n"

# Check two files and two directories
declare -A ITEMS
ITEMS["SYSTEM.md"]="file"
ITEMS["ISA.md"]="file"
ITEMS["MEMORY"]="dir"
ITEMS["skills"]="dir"

missing=0
missing_list=""

for item in "${!ITEMS[@]}"; do
    full_path="${PAI_CONTEXT_DIR}/${item}"
    expected="${ITEMS[$item]}"

    if [ "$expected" = "file" ] && [ -f "$full_path" ]; then
        printf "  \e[1;32m✓\e[0m  %-20s  (%s)\n" "${item}" "${full_path}"
    elif [ "$expected" = "dir" ] && [ -d "$full_path" ]; then
        printf "  \e[1;32m✓\e[0m  %-20s  (%s/)\n" "${item}" "${full_path}"
    else
        printf "  \e[1;31m✗\e[0m  %-20s  MISSING at: %s\n" "${item}" "${full_path}"
        missing=$((missing + 1))
        missing_list="${missing_list}  • ${item}  →  ${full_path}\n"
    fi
done

printf "\n"

if [ "$missing" -gt 0 ]; then
    printf "\e[1;31m═══════════════════════════════════════════════════════\e[0m\n"
    printf "\e[1;31m  INITIALIZATION FAILED — %d required item(s) missing\e[0m\n" "$missing"
    printf "\e[1;31m═══════════════════════════════════════════════════════\e[0m\n"
    printf "\n"
    printf "Missing items:\n"
    printf "%s" "$missing_list"
    printf "\n"
    printf "Your PAI installation appears incomplete.\n"
    printf "Expected root: %s\n" "${PAI_CONTEXT_DIR}"
    printf "\n"
    printf "Possible fixes:\n"
    printf "  1. Ensure you are in the correct directory:\n"
    printf "     cd ~/projects/pai-v5/targets/opencode/pai\n"
    printf "  2. Re-clone the repository if files are missing:\n"
    printf "     git clone <repo-url> ~/projects/pai-v5\n"
    printf "  3. Run from the pai/ directory:\n"
    printf "     source ./init.sh\n"
    exit 1
fi

# ───────────────────────────────────────────────────────────────
# Step 2: Set environment variables
# ───────────────────────────────────────────────────────────────
printf "\e[1m[2/4] Setting environment variables…\e[0m\n"

export PAI_ACTIVE=1
export PAI_CONTEXT_DIR="${PAI_CONTEXT_DIR}"
export PAI_ALGORITHM_VERSION="6.3.0"

printf "  \e[1;32mPAI_ACTIVE=1\e[0m\n"
printf "  PAI_CONTEXT_DIR=%s\n" "${PAI_CONTEXT_DIR}"
printf "  PAI_ALGORITHM_VERSION=6.3.0\n"
printf "\n"

# ───────────────────────────────────────────────────────────────
# Step 3: Check Codex CLI availability
# ───────────────────────────────────────────────────────────────
printf "\e[1m[3/4] Checking Codex CLI availability…\e[0m\n"

codex_found=0
codex_path=""
codex_version=""

# Search order: PATH lookup, then common fallback locations
for candidate in "codex" "codex-cli"; do
    if command -v "$candidate" &>/dev/null; then
        codex_path="$(command -v "$candidate")"
        codex_found=1
        break
    fi
done

# Fallback: common install locations not in PATH
if [ "$codex_found" -eq 0 ]; then
    for fallback in "$HOME/.local/bin/codex" "$HOME/bin/codex" "/usr/local/bin/codex" "/opt/codex/bin/codex"; do
        if [ -x "$fallback" ]; then
            codex_path="$fallback"
            codex_found=1
            printf "  \e[33m?\e[0m  codex found at %s (not in PATH)\n" "$codex_path"
            break
        fi
    done
fi

if [ "$codex_found" -eq 1 ]; then
    printf "  \e[1;32m✓\e[0m  codex      → %s\n" "$codex_path"
    # Try version detection
    codex_version="$(codex --version 2>/dev/null || codex version 2>/dev/null || echo "")"
    if [ -n "$codex_version" ]; then
        printf "     Version:  %s\n" "$codex_version"
    fi
else
    printf "  \e[1;33m!\e[0m  codex not found in PATH or common locations\n"
    printf "     Install Codex CLI: npm install -g @openai/codex\n"
    printf "     Or visit:          https://github.com/openai/codex\n"
fi
printf "\n"

# ───────────────────────────────────────────────────────────────
# Step 4: Show final context summary
# ───────────────────────────────────────────────────────────────
printf "\e[1m[4/4] PAI context summary\e[0m\n"
printf "\n"
printf "  \e[1;36mSYSTEM.md\e[0m         — Algorithm v6.3.0 (7 phases, modes, tiers)\n"
printf "  \e[1;36mISA.md\e[0m            — Ideal State Artifact template (12 sections)\n"
printf "  \e[1;36mMEMORY/\e[0m            — Memory system (tiered structure)\n"
printf "  \e[1;36mskills/\e[0m            — Thinking & Research capabilities\n"

if [ "$codex_found" -eq 1 ]; then
    printf "\n"
    printf "\e[1mTo launch Codex CLI with this context:\e[0m\n"
    printf "  codex --context-dir \"%s\"\n" "${PAI_CONTEXT_DIR}"
    printf "\n"
    printf "Or set the environment variable and launch:\n"
    printf "  export CODEX_CONTEXT_DIR=\"%s\"\n" "${PAI_CONTEXT_DIR}"
    printf "  codex\n"
fi

printf "\n"
printf "\e[1;32m═══════════════════════════════════════════════════════════\e[0m\n"
printf "\e[1;32m  PAI context ready — agent has full system reference\e[0m\n"
printf "\e[1;32m═══════════════════════════════════════════════════════════\e[0m\n"
printf "\n"
