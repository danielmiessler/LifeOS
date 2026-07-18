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
#   Tools/Capture.sh <url|--current> [--full] [--selector <css>] [--region X,Y,W,H] [--out <path>]
#   Tools/Capture.sh --help
#
# Exit codes: 0 ok; 2 bad args; 3 preflight failed (propagated); 7 target denied
# (Default/working profile); 8 test-context unset; 9 capture failed after recovery;
# 10 stale extension (operator must reload); 11 empty/missing image after capture;
# 12 BLANK/DEGENERATE capture — image landed but is near-uniform (the black-frame
#    failure: page unhydrated or mid entrance-animation). A blank frame is NEVER a
#    successful capture — it is a wedged verifier, so it fails hard (defer, never
#    treat a black frame as evidence);
# 13 destination dir unwritable — the wrapper NEVER falls back to CWD; ask the
#    operator where the capture should go.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_PREFS="${HOME}/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"

usage() {
    cat <<EOF
Capture.sh — sanctioned Interceptor screenshot wrapper.

Usage:
  Capture.sh <url>          Navigate the pinned test context to <url>, capture.
  Capture.sh --current      Capture the pinned test context's current page.
  Capture.sh ... --full     Full-page capture (default is viewport).
  Capture.sh ... --pixel    Skip DOM-render, capture the real compositor frame
                            directly (use on dark/animated pages that DOM-render
                            snaps blank before hydration). Needs the tab foreground.
  Capture.sh ... --selector CSS   Capture only the element matching CSS.
  Capture.sh ... --region X,Y,W,H Capture a page region.
  Capture.sh ... --out PATH  Write to PATH (default: \$LIFEOS_DOWNLOADS_DIR/
                            interceptor-capture-*.png; fallback ~/Downloads.
                            Set LIFEOS_DOWNLOADS_DIR in settings.json env).
  Capture.sh --help

Always targets only INTERCEPTOR_TEST_CONTEXT_ID from preferences.env. Refuses
Default / working profiles. Prints only the saved file path on success. A blank /
near-uniform capture is rejected (exit 12), never returned as success.
EOF
}

# --- arg parse ---
TARGET_URL=""
USE_CURRENT=0
FULL=0
FORCE_PIXEL=0
SELECTOR=""
REGION=""
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
        --pixel)
            FORCE_PIXEL=1
            shift
            ;;
        --selector)
            SELECTOR="${2:-}"
            if [ -z "$SELECTOR" ]; then
                echo "Capture.sh: --selector requires a CSS selector" >&2
                exit 2
            fi
            shift 2
            ;;
        --region)
            REGION="${2:-}"
            if [ -z "$REGION" ]; then
                echo "Capture.sh: --region requires X,Y,W,H" >&2
                exit 2
            fi
            shift 2
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

# --- 4. resolve output path. Default dir comes from LIFEOS_DOWNLOADS_DIR (the
# global artifact-output knob, set in settings.json's env block); fallback is
# ~/Downloads. An unwritable destination is a hard failure (exit 13) — NEVER
# fall back to CWD. ---
if [ -z "$OUT" ]; then
    ts="$(date +%Y%m%d-%H%M%S)"
    rand="$$"
    OUT="${LIFEOS_DOWNLOADS_DIR:-${HOME}/Downloads}/interceptor-capture-${ts}-${rand}.png"
fi
OUT_DIR="$(dirname "$OUT")"
if ! mkdir -p "$OUT_DIR" 2>/dev/null || [ ! -w "$OUT_DIR" ]; then
    echo "Capture.sh: destination dir $OUT_DIR is not writable (exit 13). Pass a writable --out; if none is known, ask the operator where the capture should go. Never falling back to CWD." >&2
    exit 13
fi

# --- staging dir: the CLI has NO output-path flag — `--save` always writes
# interceptor-screenshot-<epoch>.<ext> into the CLI process CWD. Every capture
# runs `cd`-ed into this private stage so that write can never land in the
# caller's CWD; resolve_saved() then MOVES the result to $OUT. ---
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/interceptor-capture-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

# Build common flag arrays. (No --out here: the CLI silently swallows unknown
# flags, which is how strays used to leak — see 2026-07-18 root-cause.)
SS_FLAGS=(--context "$CTX" --save)
[ "$FULL" -eq 1 ] && SS_FLAGS+=(--full)
[ -n "$SELECTOR" ] && SS_FLAGS+=(--selector "$SELECTOR")
[ -n "$REGION" ] && SS_FLAGS+=(--region "$REGION")

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

# --- degeneracy guard ---------------------------------------------------------
# A capture that LANDED but is near-uniform (all-black / blank) is NOT a
# successful capture — it is the framer-motion-before-hydration failure, where
# every animated element sits at opacity:0 and the DOM-render snaps a black
# rectangle. Existence of a non-empty PNG proved nothing about content; this is
# the guard that makes "a file landed" insufficient. std-dev via ImageMagick was
# the widest-margin separator of the metrics measured (maxima/range/unique-colors
# all overlap — a blank frame with one stray bright pixel hits maxima 1.0):
# observed blank frames cluster at 0.008-0.012, real content at >=0.022 (a very
# dark dim-text page) up to 0.24 (bright content). Default 0.017 sits at the
# midpoint, ~0.005 margin each side. The failure direction is deliberately SAFE:
# a borderline-dark legit page just under the line is conservatively REJECTED
# (exit 12), forcing a --pixel + a human look, never a false "verified". If
# ImageMagick is absent the probe cannot run — warn, but PASS (UNKNOWN != MISSING:
# never block on our own blind spot). Override with INTERCEPTOR_MIN_STDDEV.
MIN_STDDEV="${INTERCEPTOR_MIN_STDDEV:-0.017}"

# Loudly record a skipped guard so "the blank-frame check didn't run" is
# discoverable, never silent (cross-vendor audit 2026-07-07: the fail-open path
# reproduced the original bug invisibly on any magick-less host).
guard_skipped() {
    local reason="$1"
    echo "Capture.sh: ⚠️  BLANK-FRAME GUARD SKIPPED ($reason) — this capture is NOT checked for a black/blank frame; do not treat it as pixel-verified without looking. Install ImageMagick (brew install imagemagick) to enable." >&2
    local log="${HOME}/.claude/LIFEOS/MEMORY/OBSERVABILITY/capture-guard.jsonl"
    mkdir -p "$(dirname "$log")" 2>/dev/null || true
    printf '{"ts":"%s","event":"guard-skipped","reason":"%s","out":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$reason" "$OUT" >> "$log" 2>/dev/null || true
}

content_ok() {
    [ -s "$OUT" ] || return 1
    if ! command -v magick >/dev/null 2>&1; then
        guard_skipped "imagemagick-absent"
        return 0
    fi
    local sd
    sd="$(magick "$OUT" -format '%[fx:standard_deviation]' info: 2>/dev/null)"
    if [ -z "$sd" ]; then
        guard_skipped "stddev-probe-empty"
        return 0
    fi
    # ok (return 0) iff sd >= MIN_STDDEV
    awk -v s="$sd" -v t="$MIN_STDDEV" 'BEGIN{ exit !((s+0) >= (t+0)) }'
}

# interceptor screenshot prints JSON including "filePath" — the path it ACTUALLY
# wrote (CLI CWD = our stage for DOM-render; a daemon-chosen temp path for
# --pixel). After every capture we reconcile by MOVING that file into $OUT —
# move, not copy: the source living anywhere else IS the stray-file bug this
# wrapper exists to prevent. Relative filePath resolves against the stage; if
# filePath is unparseable, fall back to the newest capture file in the stage.
resolve_saved() {
    local out_text="$1" fp
    [ -s "$OUT" ] && return 0
    fp="$(printf '%s\n' "$out_text" | grep -oE '"filePath"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*:[[:space:]]*"([^"]+)".*/\1/')"
    case "$fp" in
        ""|/*) : ;;
        *) fp="$STAGE/$fp" ;;
    esac
    if [ -n "$fp" ] && [ -s "$fp" ]; then
        mv -f "$fp" "$OUT" && return 0
    fi
    # The stage is private to this run, so ANY file in it is our capture —
    # don't couple the fallback to the CLI's current filename convention.
    fp="$(ls -t "$STAGE"/* 2>/dev/null | head -1)"
    if [ -n "$fp" ] && [ -s "$fp" ]; then
        mv -f "$fp" "$OUT" && return 0
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
    ( cd "$STAGE" && interceptor screenshot "${SS_FLAGS[@]}" 2>&1 )
}

pixel_capture() {
    ( cd "$STAGE" && interceptor screenshot "${SS_FLAGS[@]}" --pixel 2>&1 )
}

# --- 5/6/7. capture with bounded recovery. DOM-first, then a single classified
# recovery move. NOTE: the wedge path (heal_bridge → pixel → daemon respawn →
# pixel-or-dom) can issue up to ~4 run_one calls total; non-wedge paths issue 2.
# A degenerate DOM frame is treated as a failure so it escalates to --pixel. ---
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
        # Landing is necessary but NOT sufficient — a blank/degenerate frame is a
        # failed capture, not a success. Reject it so the DOM path escalates to
        # --pixel and a genuinely-blank final frame fails hard (exit 12).
        if content_ok; then
            return 0
        fi
        err="degenerate/blank image on $1 capture (std-dev < ${MIN_STDDEV}) — page unhydrated or mid entrance-animation"
        return 1
    fi
    err="$out_text"
    return 1
}

# Attempt 1. --pixel forces the real compositor frame (known dark/animated pages);
# otherwise DOM-render first (engineered-robust default, needs no foreground).
attempt=1
if [ "$FORCE_PIXEL" -eq 1 ]; then
    if run_one pixel; then
        printf '%s\n' "$OUT"
        exit 0
    fi
elif run_one dom; then
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

# Final guard: distinguish nothing-landed (exit 9) from landed-but-blank (exit 12).
if image_landed; then
    if content_ok; then
        printf '%s\n' "$OUT"
        exit 0
    fi
    cat >&2 <<EOF
Capture.sh: BLANK/DEGENERATE capture (exit 12) — an image landed but is near-uniform
(std-dev < ${MIN_STDDEV}). This is NOT a verified capture. The page most likely has not
hydrated, or uses entrance animations (elements start at opacity:0), so DOM-render
snapped a blank frame. DO NOT treat a blank frame as evidence — this is a wedged
verifier, so defer.
REMEDIATION:
  1. Foreground the tab, then re-run with --pixel (real compositor capture):
       interceptor open <url> --reuse --activate --context <ctx>
       Capture.sh --current --pixel
  2. Or wait for hydration and re-capture.
  last error: $err
EOF
    exit 12
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
