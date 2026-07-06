#!/usr/bin/env bash
# Capture.sh — the ONLY sanctioned way to take an Interceptor screenshot.
#
# Contract:
#   - Resolves the pinned test context from preferences.env and REFUSES to run
#     against any other context. Never falls back to Default. Never uses
#     screencapture/osascript.
#   - DOM-render first (the engineered-robust default; needs no foreground),
#     --pixel fallback only on DOM-render failure.
#   - Self-heals a wedged daemon (one respawn + retry) and, for macos_* paths
#     only, a loaded-but-dead bridge. Detects a stale extension and surfaces the
#     reload instruction.
#   - On success prints EXACTLY one line — the absolute path of the saved image —
#     to stdout, exit 0. On failure: structured remediation to stderr, distinct
#     non-zero exit per failure class. Never narrates.
#
# Usage:
#   Tools/Capture.sh <url|--current> [--full] [--out <path>]
#   Tools/Capture.sh --help
#
# Exit codes: 0 ok; 2 bad args; 3 preflight failed (propagated); 7 target denied
# (Default/working profile); 8 test-context unset; 9 capture failed after recovery;
# 10 stale extension (operator must reload); 11 empty/missing image after capture.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_PREFS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"

usage() {
    cat <<EOF
Capture.sh — sanctioned Interceptor screenshot wrapper.

Usage:
  Capture.sh <url>          Navigate the pinned test context to <url>, capture.
  Capture.sh --current      Capture the pinned test context's current page.
  Capture.sh ... --full     Full-page capture (default is viewport).
  Capture.sh ... --out PATH  Write to PATH (default: ~/Downloads/interceptor-capture-*.png).
  Capture.sh --help

Always targets only INTERCEPTOR_TEST_CONTEXT_ID from preferences.env. Refuses
Default / working profiles. Prints only the saved file path on success.
EOF
}

# --- arg parse ---
TARGET_URL=""
USE_CURRENT=0
FULL=0
OUT=""

if [ "$#" -eq 0 ]; then
    usage >&2
    exit 2
fi

while [ "$#" -gt 0 ]; do
    case "$1" in
        --help|-h)
            usage
            exit 0
            ;;
        --current)
            USE_CURRENT=1
            shift
            ;;
        --full)
            FULL=1
            shift
            ;;
        --out)
            OUT="${2:-}"
            if [ -z "$OUT" ]; then
                echo "Capture.sh: --out requires a path" >&2
                exit 2
            fi
            shift 2
            ;;
        --*)
            echo "Capture.sh: unknown flag $1" >&2
            usage >&2
            exit 2
            ;;
        *)
            if [ -n "$TARGET_URL" ]; then
                echo "Capture.sh: multiple URLs given ($TARGET_URL, $1)" >&2
                exit 2
            fi
            TARGET_URL="$1"
            shift
            ;;
    esac
done

if [ "$USE_CURRENT" -eq 0 ] && [ -z "$TARGET_URL" ]; then
    echo "Capture.sh: provide a <url> or --current" >&2
    exit 2
fi
if [ "$USE_CURRENT" -eq 1 ] && [ -n "$TARGET_URL" ]; then
    echo "Capture.sh: --current and a <url> are mutually exclusive" >&2
    exit 2
fi

# --- 1. resolve pinned target ---
if [ -f "$USER_PREFS" ]; then
    # shellcheck disable=SC1090
    . "$USER_PREFS"
fi
CTX="${INTERCEPTOR_TEST_CONTEXT_ID:-}"
WORKING_PROFILE_IDS="${INTERCEPTOR_WORKING_PROFILE_IDS:-}"

if [ -z "$CTX" ]; then
    echo "Capture.sh: INTERCEPTOR_TEST_CONTEXT_ID unset in preferences.env — refusing (no default-to-Default)." >&2
    exit 8
fi

# --- 2. hardened preflight gate (propagate its exit + stderr verbatim) ---
if ! bash "$SCRIPT_DIR/PreflightIsolation.sh" >&2; then
    # Preflight already printed structured remediation. Do not try anyway.
    exit 3
fi

# --- 3. target-deny re-check (defense in depth; state can change post-preflight) ---
target_denied() {
    local id="$1"
    # "Default" name is always denied.
    if printf '%s\n' "$id" | grep -qiE '(^|[^a-z])default([^a-z]|$)'; then
        return 0
    fi
    if [ -n "$WORKING_PROFILE_IDS" ]; then
        local _d
        IFS=',' read -ra _arr <<< "$WORKING_PROFILE_IDS"
        for _d in "${_arr[@]}"; do
            _d="$(printf '%s' "$_d" | sed 's/^[ \t]*//;s/[ \t]*$//')"
            [ -z "$_d" ] && continue
            [ "$_d" = "$id" ] && return 0
        done
    fi
    return 1
}

if target_denied "$CTX"; then
    echo "Capture.sh: pinned target $CTX is a denied Default/working profile — refusing." >&2
    exit 7
fi

# Confirm the pinned context is actually in the live connected set (exact match).
contexts_now="$(interceptor contexts 2>&1 || true)"
if ! printf '%s\n' "$contexts_now" \
    | grep -v '→ contexts' \
    | awk -v want="$CTX" '{ gsub(/^[ \t]+|[ \t]+$/, "", $0) } $0 == want { f=1 } END { exit(f?0:1) }'; then
    echo "Capture.sh: pinned context $CTX not in live connected set (rot?). Re-run preflight remediation." >&2
    printf '%s\n' "$contexts_now" | sed 's/^/  /' >&2
    exit 3
fi

# --- 4. resolve output path (review artifacts go to ~/Downloads per OPERATIONAL_RULES) ---
if [ -z "$OUT" ]; then
    ts="$(date +%Y%m%d-%H%M%S)"
    rand="$$"
    OUT="${HOME}/Downloads/interceptor-capture-${ts}-${rand}.png"
fi
mkdir -p "$(dirname "$OUT")"

# Build common flag arrays.
SS_FLAGS=(--context "$CTX" --save --out "$OUT")
[ "$FULL" -eq 1 ] && SS_FLAGS+=(--full)

# --- helpers ---
navigate_if_needed() {
    if [ -n "$TARGET_URL" ]; then
        interceptor open --context "$CTX" "$TARGET_URL" >/dev/null 2>&1 || return 1
    fi
    return 0
}

image_landed() {
    [ -s "$OUT" ]
}

# interceptor screenshot prints JSON including "filePath" — the path it ACTUALLY
# wrote. The --pixel path (captureVisibleTab) ignores --out and saves to a
# daemon-chosen temp path, so after every capture we reconcile: if $OUT wasn't
# populated, lift the real file from filePath into $OUT. This is what makes the
# working pixel fallback actually satisfy the wrapper's contract.
resolve_saved() {
    local out_text="$1" fp
    [ -s "$OUT" ] && return 0
    fp="$(printf '%s\n' "$out_text" | grep -oE '"filePath"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:[[:space:]]*"([^"]+)".*/\1/')"
    if [ -n "$fp" ] && [ -s "$fp" ]; then
        cp -f "$fp" "$OUT" 2>/dev/null && return 0
    fi
    return 1
}

# Returns 0 if stderr text signals a stale-extension / runner.js load failure.
is_stale_extension() {
    printf '%s' "$1" | grep -qiE 'screenshot-runner\.js|html-to-image library not loaded|could not load file'
}

# Heal a loaded-but-dead macOS bridge (the "native port disconnected" cause).
heal_bridge() {
    [ -x "$SCRIPT_DIR/HealBridge.sh" ] && bash "$SCRIPT_DIR/HealBridge.sh" >/dev/null 2>&1 || true
}

dom_capture() {
    interceptor screenshot "${SS_FLAGS[@]}" 2>&1
}

pixel_capture() {
    interceptor screenshot "${SS_FLAGS[@]}" --pixel 2>&1
}

# --- 5/6/7. capture with bounded recovery (hard cap = 2 capture attempts total) ---
attempt=0
err=""

# The interceptor CLI exits 0 even on "native port disconnected", so success is
# decided by an image actually landing (after path reconciliation), NOT exit code.
run_one() {
    # $1 = path: "dom" or "pixel"
    rm -f "$OUT" 2>/dev/null || true
    if ! navigate_if_needed; then
        err="navigation to $TARGET_URL failed"
        return 1
    fi
    local out_text
    if [ "$1" = "pixel" ]; then
        out_text="$(pixel_capture)"
    else
        out_text="$(dom_capture)"
    fi
    if resolve_saved "$out_text"; then
        return 0
    fi
    err="$out_text"
    return 1
}

# Attempt 1 — DOM-render first (engineered-robust default, needs no foreground).
attempt=1
if run_one dom; then
    printf '%s\n' "$OUT"
    exit 0
fi

# Classify failure and pick the single recovery move (cap = 2 attempts).
if is_stale_extension "$err"; then
    cat >&2 <<EOF
Capture.sh: stale/unloaded extension — screenshot-runner.js failed to load.

REMEDIATION (operator):
  In the test profile: chrome://extensions/ -> Interceptor -> Reload (or
  Load Unpacked from ~/.claude/skills/Interceptor/Extension/). If you just
  upgraded the binary, re-pin via the Update workflow first.
EOF
    exit 10
fi

# Wedge signatures: timeout / native port disconnected → try the OTHER capture
# path (different WS message type often unwedges), else one daemon respawn.
attempt=2
if printf '%s' "$err" | grep -qiE 'timeout|timed out|native port disconnected|not reachable'; then
    # "native port disconnected" IS the dead/wedged bridge — heal it first, then
    # swap to --pixel (captureVisibleTab; different path that survives a bridge wedge).
    heal_bridge
    if run_one pixel; then
        printf '%s\n' "$OUT"
        exit 0
    fi
    # Recovery B: single daemon respawn + one retry on the working pixel path.
    pkill -f interceptor-daemon >/dev/null 2>&1 || true
    sleep 0.5
    if run_one pixel || run_one dom; then
        printf '%s\n' "$OUT"
        exit 0
    fi
    if is_stale_extension "$err"; then
        cat >&2 <<EOF
Capture.sh: stale/unloaded extension after daemon respawn.
REMEDIATION: reload the Interceptor extension (Load Unpacked from
  ~/.claude/skills/Interceptor/Extension/), then retry.
EOF
        exit 10
    fi
else
    # Non-wedge DOM-render failure (e.g. page disallows injection: chrome://,
    # Web Store, PDF). Try --pixel once as the documented fallback.
    if run_one pixel; then
        printf '%s\n' "$OUT"
        exit 0
    fi
fi

# Final guard: nothing landed.
if image_landed; then
    printf '%s\n' "$OUT"
    exit 0
fi

cat >&2 <<EOF
Capture.sh: FAIL — capture did not succeed after recovery.
  last error: $err
REMEDIATION:
  1. interceptor status            # daemon + bridge health
  2. If browser verbs hang but status/contexts answer: reload the extension.
  3. Re-run Tools/PreflightIsolation.sh and resolve any UUID-rot remediation.
  Never fall back to screencapture/osascript.
EOF
exit 9
