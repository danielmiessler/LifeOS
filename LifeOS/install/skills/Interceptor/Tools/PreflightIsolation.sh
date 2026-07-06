#!/usr/bin/env bash
# PreflightIsolation.sh — hard gate before any browser command lands in Chrome.
#
# Guarantees, enforced in code, that an interceptor browser verb cannot route to
# the operator's Default Chrome window or any working/monitoring profile:
#
#   1. Binary present + version >= MIN_VERSION. Older builds silently ignore
#      --context, so the daemon falls back to whatever Chrome it can find. Hard fail.
#
#   2. Pinned test context is connected — exact whole-field match on the UUID
#      (or friendly name) from preferences.env. A substring/header collision can't
#      false-pass. Hard fail if absent.
#
#   3. Target-deny: the resolved target is NOT Default and NOT in the
#      INTERCEPTOR_WORKING_PROFILE_IDS deny-list, and its name does not match a
#      Default/working pattern. This is the new guarantee — "connected" was the
#      old check; "target is provably not a working profile" is the contract now.
#
#   4. Extension freshness (graceful): compare the pinned Extension copy's
#      PINNED_FROM.txt against the upstream dist IF present. Mismatch → fail with
#      re-pin remediation. Upstream absent → WARN and continue (do not hard-fail
#      on a missing reference).
#
# There is NO fallback path. A missing/stale pinned context is a hard stop with
# remediation, never an auto-route to Default. The old "fall back to the first
# available / Default context" behavior is DELETED and must never be re-derived.
#
# Every browser workflow's first step. Source from a workflow:
#
#   if ! bash ~/.claude/skills/Interceptor/Tools/PreflightIsolation.sh; then
#     exit 1   # surface to operator; do NOT fall back
#   fi
#
# Exit codes: 0 cleared; 2 binary missing; 3 version-parse fail; 4 version too low;
# 5 no contexts connected; 6 pinned context not connected (UUID rot); 7 target is a
# Default/working profile (deny); 8 test-context unset in preferences.

set -euo pipefail

# Source per-machine USER customizations if present (Chrome profile dir name,
# pinned context ID, working-profile deny-list). Lives outside the public skill
# body so the skill stays generic.
USER_PREFS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
if [ -f "$USER_PREFS" ]; then
    # shellcheck disable=SC1090
    . "$USER_PREFS"
fi

MIN_VERSION="0.16.9"

# The pinned test context. No friendly default — an unset value is a hard stop,
# never a fall-through to a default name that might resolve to the wrong profile.
REQUIRED_CONTEXT="${INTERCEPTOR_TEST_CONTEXT_ID:-}"

if [ -z "$REQUIRED_CONTEXT" ]; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: INTERCEPTOR_TEST_CONTEXT_ID is not set.

REMEDIATION:
  Set INTERCEPTOR_TEST_CONTEXT_ID in
    ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
  to the pinned Interceptor test context (raw UUID today; durable fix is the
  friendly name "interceptor-test" set once in the extension popup). There is
  no default — running without an explicit pinned context could route a tab to
  the operator's working profile.
EOF
    exit 8
fi

# Comma-separated Default/working-profile context IDs to hard-deny. Machine-specific,
# kept in preferences.env. "Default" is always denied regardless of this list.
WORKING_PROFILE_IDS="${INTERCEPTOR_WORKING_PROFILE_IDS:-}"

# --- 1. Binary present + version >= MIN_VERSION ---

if ! command -v interceptor >/dev/null 2>&1; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: interceptor not found on PATH.

REMEDIATION:
  Build and install per Workflows/Update.md, then verify with:
    interceptor --version
EOF
    exit 2
fi

raw_version="$(interceptor --version 2>&1 | head -1)"
# Expected shape: "interceptor 0.16.9 (sha, date)"
current_version="$(printf '%s\n' "$raw_version" | awk '{print $2}')"

if [ -z "$current_version" ]; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: could not parse interceptor version.
  raw output: $raw_version

REMEDIATION:
  Run \`interceptor --version\` manually and confirm output shape
  matches "interceptor X.Y.Z (sha, date)". If not, rebuild per Workflows/Update.md.
EOF
    exit 3
fi

# Compare semver-style (major.minor.patch) by sorting.
lowest="$(printf '%s\n%s\n' "$current_version" "$MIN_VERSION" | sort -V | head -1)"
if [ "$lowest" != "$MIN_VERSION" ] && [ "$current_version" != "$MIN_VERSION" ]; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: interceptor $current_version is below required $MIN_VERSION.

WHY THIS MATTERS:
  Builds before $MIN_VERSION silently ignore the --context flag. The daemon
  then falls back to whatever Chrome connection it can find — which is
  usually the operator's Default profile. A tab opens in the wrong window.

REMEDIATION:
  Upgrade via Workflows/Update.md, then:
    interceptor --version          # confirm >= $MIN_VERSION
EOF
    exit 4
fi

# --- 2. Pinned test context is connected (exact whole-field match) ---

# `interceptor contexts` exits 0 even when no contexts are connected, emitting
# "no browser contexts connected" to stdout. Capture and inspect.
contexts_output="$(interceptor contexts 2>&1 || true)"

if printf '%s\n' "$contexts_output" | grep -qi "no browser contexts connected"; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: no browser contexts connected.

WHY THIS MATTERS:
  The Interceptor extension is not currently loaded in any Chrome profile, or
  the daemon was restarted after Chrome (so the extension hasn't re-handshaked).
  Without a connection, browser commands fail or hang.

REMEDIATION (operator action — no auto-launch):
  1. Open the dedicated Interceptor test profile window.
  2. In that profile, open chrome://extensions/. If the Interceptor card is
     missing or shows an error: Load Unpacked
       -> ~/.claude/skills/Interceptor/Extension/
     and accept any new permissions.
  3. Click the Interceptor toolbar icon, set Context ID to the friendly name
     "interceptor-test", Save. Friendly names survive extension reloads; raw
     UUIDs rot on every reload (see preferences.env header).
  4. Set INTERCEPTOR_TEST_CONTEXT_ID in preferences.env to match, then re-run.
EOF
    exit 5
fi

# Whole-field exact match: strip the "[id] → contexts" header line, trim each row,
# and require an exact equality against REQUIRED_CONTEXT. A substring match (old
# behavior) could false-pass on a header or a partial-UUID collision.
if ! printf '%s\n' "$contexts_output" \
    | grep -v '→ contexts' \
    | awk -v want="$REQUIRED_CONTEXT" '
        { gsub(/^[ \t]+|[ \t]+$/, "", $0) }
        $0 == want { found = 1 }
        END { exit(found ? 0 : 1) }
    '; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: required context "$REQUIRED_CONTEXT" is not connected.

CURRENT CONTEXTS:
$(printf '%s\n' "$contexts_output" | sed 's/^/  /')

WHY THIS MATTERS:
  The whole point of the pinned test context is to give browser commands a known
  target that is NEVER the operator's working window. Without it connected, a
  command could land in the wrong profile or fail ambiguously. There is no
  fallback — this is a hard stop.

LIKELY CAUSE: UUID rotation. When Chrome's Interceptor extension reloads
(manifest version bump, "Load Unpacked" again, fresh profile), the auto-assigned
UUID changes and preferences.env still holds the OLD one. The live context in
CURRENT CONTEXTS above is the NEW one.

REMEDIATION (UUID rot — most common):
  1. Compare the UUID(s) above against INTERCEPTOR_TEST_CONTEXT_ID in
       ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
  2. If the live UUID is the same test profile under a new value, copy it into
     preferences.env and re-run this preflight.

DURABLE FIX (end UUID rot):
  Set the friendly name "interceptor-test" in the extension popup once and pin
  that string in preferences.env. Friendly names survive reloads; raw UUIDs do not.
EOF
    exit 6
fi

# --- 3. Target-deny: pinned target must NOT be Default or a working profile ---

# Defense in depth. REQUIRED_CONTEXT is what every command will target; refuse if
# it is, or resolves to, a Default/working profile. "Default" is always denied.
deny_hit=""
if printf '%s\n' "$REQUIRED_CONTEXT" | grep -qiE '(^|[^a-z])default([^a-z]|$)'; then
    deny_hit="name matches Default"
fi
if [ -z "$deny_hit" ] && [ -n "$WORKING_PROFILE_IDS" ]; then
    IFS=',' read -ra _deny_ids <<< "$WORKING_PROFILE_IDS"
    for _id in "${_deny_ids[@]}"; do
        _id="$(printf '%s' "$_id" | sed 's/^[ \t]*//;s/[ \t]*$//')"
        [ -z "$_id" ] && continue
        if [ "$_id" = "$REQUIRED_CONTEXT" ]; then
            deny_hit="matches working-profile deny-list entry ($_id)"
            break
        fi
    done
fi

if [ -n "$deny_hit" ]; then
    cat >&2 <<EOF
[PreflightIsolation] FAIL: pinned target "$REQUIRED_CONTEXT" is a denied profile ($deny_hit).

WHY THIS MATTERS:
  The pinned test context must never be the operator's Default or any
  working/monitoring profile. This is the isolation contract — a denied target
  is a hard stop, never a "proceed anyway."

REMEDIATION:
  Repin INTERCEPTOR_TEST_CONTEXT_ID in preferences.env to the dedicated
  Interceptor test context, and confirm INTERCEPTOR_WORKING_PROFILE_IDS lists
  every Default/working-profile context ID to keep them denied.
EOF
    exit 7
fi

# --- 4. Extension freshness (graceful — warn if upstream reference is absent) ---

EXT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Extension"
PINNED_FROM="$EXT_DIR/PINNED_FROM.txt"
UPSTREAM_DIST="${INTERCEPTOR_SRC:-$HOME/Projects/interceptor}/extension/dist"
UPSTREAM_MANIFEST="$UPSTREAM_DIST/manifest.json"

if [ -f "$PINNED_FROM" ] && [ -f "$UPSTREAM_MANIFEST" ]; then
    pinned_version="$(grep -i '^Manifest version:' "$PINNED_FROM" | sed -E 's/.*: *//' | tr -d ' ')"
    upstream_version="$(grep '"version"' "$UPSTREAM_MANIFEST" | head -1 | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')"
    if [ -n "$pinned_version" ] && [ -n "$upstream_version" ] && [ "$pinned_version" != "$upstream_version" ]; then
        cat >&2 <<EOF
[PreflightIsolation] FAIL: pinned Extension (manifest $pinned_version) is stale vs upstream ($upstream_version).

WHY THIS MATTERS:
  Chrome disables unpacked extensions on every manifest bump, and a stale loaded
  extension whose bundled screenshot-runner.js doesn't match the daemon produces
  "screenshot-runner.js could not load" failures.

REMEDIATION:
  1. Re-pin via the Update workflow (runs Tools/Pin.sh).
  2. In the test profile: chrome://extensions/ -> Interceptor -> Load Unpacked
       from ~/.claude/skills/Interceptor/Extension/ (or reload if already loaded).
  3. Re-run this preflight.
EOF
        exit 6
    fi
else
    # Upstream dist absent (currently true on this machine) — cannot compare.
    # Warn, do not hard-fail on a missing reference.
    printf '[PreflightIsolation] WARN: cannot verify extension freshness ' >&2
    printf '(upstream dist %s absent or PINNED_FROM.txt missing). Proceeding.\n' \
        "${UPSTREAM_DIST/#$HOME/~}" >&2
fi

# --- All checks passed ---
printf '[PreflightIsolation] OK — interceptor %s, pinned context "%s" connected and not denied.\n' \
    "$current_version" "$REQUIRED_CONTEXT"
exit 0
