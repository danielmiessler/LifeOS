#!/usr/bin/env bash
# EnsureTestProfile.sh — make the Interceptor test context available, auto-launching
# the CONFIGURED test profile window if it isn't connected. Sanctioned auto-recovery
# for the "context not connected" preflight failures (exit 5 / 6) ONLY.
#
# WHY THIS IS SAFE (the invariant that reverses the old "never auto-launch" rule):
#   We ONLY ever succeed (exit 0) after PreflightIsolation.sh itself exits 0, which
#   whole-field-matches the connected context against INTERCEPTOR_TEST_CONTEXT_ID and
#   hard-denies Default/working profiles. So launching the WRONG window can never cause
#   the agent to drive it — preflight would still fail and this script would still stop.
#   The safety comes from the post-launch RE-VERIFICATION loop, not from trusting the
#   --profile-directory argument. Exit 7 (resolved target IS Default/working) and exit 8
#   (test context unset) NEVER trigger a launch.
#
# Contract: prints "READY" to stdout + exits 0 when the pinned test context is connected
# and safe. On any non-recoverable condition, surfaces the preflight remediation to
# stderr and exits with preflight's own code. Never falls back to Default. Never narrates.
#
# Usage:  bash Tools/EnsureTestProfile.sh        # ensure ready, auto-launch if needed
#         EnsureTestProfile.sh && interceptor open <url> --context "$INTERCEPTOR_TEST_CONTEXT_ID"

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFS="${LIFEOS_DIR:-$HOME/.claude/LIFEOS}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
# shellcheck disable=SC1090
[ -f "$PREFS" ] && . "$PREFS"

PREFLIGHT="$DIR/PreflightIsolation.sh"
LAUNCH="$DIR/LaunchTestProfile.sh"
TMP="$(mktemp -t interceptor-ensure.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

# Run the isolation gate; capture its output + exit code.
run_preflight() { bash "$PREFLIGHT" >"$TMP" 2>&1; return $?; }

run_preflight; rc=$?

if [ "$rc" -eq 0 ]; then
    cat "$TMP" >&2
    echo "READY"
    exit 0
fi

# Only "context not connected" conditions are auto-launchable.
#   5 = no contexts connected at all   6 = pinned test context not connected
# Everything else (7 target-deny, 8 unset config, 2/3/4 binary/version) surfaces + stops.
if [ "$rc" -ne 5 ] && [ "$rc" -ne 6 ]; then
    echo "[EnsureTestProfile] preflight exit $rc is not a launchable condition — surfacing, not launching." >&2
    cat "$TMP" >&2
    exit "$rc"
fi

PROFILE="${INTERCEPTOR_TEST_CHROME_PROFILE:-}"
if [ -z "$PROFILE" ]; then
    echo "[EnsureTestProfile] test context not connected (exit $rc) AND INTERCEPTOR_TEST_CHROME_PROFILE is unset —" >&2
    echo "  cannot auto-launch. Set it in $PREFS to the test profile's on-disk dir (e.g. \"Profile 4\")." >&2
    cat "$TMP" >&2
    exit "$rc"
fi

echo "[EnsureTestProfile] test context not connected (exit $rc) — launching test profile \"$PROFILE\" and waiting for it to connect…" >&2
# LaunchTestProfile.sh opens ONLY the configured profile and refuses to guess a default.
bash "$LAUNCH" "about:blank" >/dev/null 2>&1 || {
    echo "[EnsureTestProfile] LaunchTestProfile.sh failed to launch \"$PROFILE\" — surfacing." >&2
    exit "$rc"
}

# Poll for the PINNED test context to connect. A closed-but-not-reloaded profile keeps its
# stable chrome.storage.local UUID, so it reconnects as the same context and preflight passes.
for i in $(seq 1 18); do
    sleep 1
    if run_preflight; then
        cat "$TMP" >&2
        echo "READY (auto-launched after ${i}s)"
        exit 0
    fi
done

# Launched, but the pinned context never connected within the window. Almost always UUID rot
# (the extension was reloaded → a NEW context UUID). Do NOT proceed on an unverified context.
cat "$TMP" >&2
echo "[EnsureTestProfile] launched \"$PROFILE\" but the pinned test context did not connect within 18s." >&2
echo "  Most likely UUID rot: the Interceptor extension reloaded and the test profile now has a NEW context UUID." >&2
echo "  Durable fix (do this once, it survives future reloads):" >&2
echo "    1. In the test-profile window, click the Interceptor toolbar icon." >&2
echo "    2. Set Context ID = \"interceptor-test\" → Save." >&2
echo "    3. Set INTERCEPTOR_TEST_CONTEXT_ID=\"interceptor-test\" in $PREFS." >&2
echo "  Not proceeding — never drive an unverified context (it could be the operator's window)." >&2
exit 6
