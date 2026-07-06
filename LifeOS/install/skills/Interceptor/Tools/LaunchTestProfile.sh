#!/usr/bin/env bash
# LaunchTestProfile.sh — open Chrome's dedicated non-default profile in its own window.
#
# Why this exists: the operator's Default Chrome profile holds the tabs they're actively
# working in (and the tabs their DA has been driving). Routine live testing goes to a
# separate Chrome profile so the agent never disturbs that window — BUT the test profile
# is signed into the operator's accounts (Google, GitHub, Cloudflare, blog admin, etc.)
# so live testing of authenticated tooling actually works.
#
# Mechanism: --profile-directory tells the existing Chrome installation which profile
# sub-directory to use. Same Chrome process tree, same root certificates, same native
# messaging hosts — different cookies, different tabs, different window. The operator
# creates the profile once via Chrome's avatar menu (top-right corner) and signs it into
# whichever accounts the agent needs to test against.
#
# This is the correct isolation boundary: separate WINDOW + separate COOKIE JAR, not
# separate user-data-dir. A `--user-data-dir` would be a fully sandboxed Chrome with no
# sessions — useless for verifying authenticated tools.

set -euo pipefail

# Source per-machine USER customizations so INTERCEPTOR_TEST_CHROME_PROFILE
# resolves from the single canonical home (preferences.env), not a guessed
# default. The preflight sources this too; this script must not rely on the
# preflight having run first.
USER_PREFS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
if [ -f "$USER_PREFS" ]; then
    # shellcheck disable=SC1090
    . "$USER_PREFS"
fi

# NO default profile. Defaulting to any concrete profile name (e.g. "Profile 1")
# is a working-profile-leak vector — on this machine the test profile is a
# different index, and Profile 1 is a real working profile. Refuse rather than
# guess: opening the wrong --profile-directory drops a tab in the operator's
# monitoring window.
CHROME_PROFILE="${INTERCEPTOR_TEST_CHROME_PROFILE:-}"
BROWSER="${INTERCEPTOR_TEST_BROWSER:-Google Chrome}"
START_URL="${1:-about:blank}"

if [ -z "$CHROME_PROFILE" ]; then
    cat >&2 <<EOF
LaunchTestProfile.sh: FAIL — no test profile configured.

  INTERCEPTOR_TEST_CHROME_PROFILE is unset/empty. Set it in
    ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env
  to the dedicated Interceptor test profile's on-disk directory name (e.g.
  "Profile N" — map directory -> friendly name via
  ~/Library/Application Support/Google/Chrome/Local State, profile.info_cache).

  Refusing to launch: defaulting to any concrete profile could open the
  operator's working/monitoring profile by accident.
EOF
    exit 2
fi

case "$(uname -s)" in
    Darwin)
        # No -n flag here — we want to reuse the existing Chrome process so the new
        # window shares the user-data-dir lock with Default. Chrome handles
        # --profile-directory by opening a window for that profile in the existing
        # instance.
        exec open -a "$BROWSER" --args \
            --profile-directory="$CHROME_PROFILE" \
            --new-window \
            "$START_URL"
        ;;
    Linux)
        CHROME_BIN="${CHROME_BIN:-google-chrome}"
        exec "$CHROME_BIN" \
            --profile-directory="$CHROME_PROFILE" \
            --new-window \
            "$START_URL"
        ;;
    *)
        echo "LaunchTestProfile.sh: unsupported OS $(uname -s)" >&2
        exit 1
        ;;
esac
