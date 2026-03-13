#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PAI Status Line
# ═══════════════════════════════════════════════════════════════════════════════
#
# Responsive status line with 4 display modes based on terminal width:
#   - nano   (<35 cols): Minimal single-line displays
#   - micro  (35-54):    Compact with key metrics
#   - mini   (55-79):    Balanced information density
#   - normal (80+):      Full display with sparklines
#
# Output order: Greeting → Wielding → Git → Learning → Signal → Context → Quote
#
# Context percentage scales to compaction threshold if configured in settings.json.
# When contextDisplay.compactionThreshold is set (e.g., 62), the bar shows 62% as 100%.
# Set threshold to 100 or remove the setting to show raw 0-100% from Claude Code.
# ═══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PAI_DIR="${PAI_DIR:-$HOME/.claude}"
SETTINGS_FILE="$PAI_DIR/settings.json"
RATINGS_FILE="$PAI_DIR/MEMORY/LEARNING/SIGNALS/ratings.jsonl"
TREND_CACHE="$PAI_DIR/MEMORY/STATE/trending-cache.json"
MODEL_CACHE="$PAI_DIR/MEMORY/STATE/model-cache.txt"
QUOTE_CACHE="$PAI_DIR/.quote-cache"
LOCATION_CACHE="$PAI_DIR/MEMORY/STATE/location-cache.json"
WEATHER_CACHE="$PAI_DIR/MEMORY/STATE/weather-cache.json"
USAGE_CACHE="$PAI_DIR/MEMORY/STATE/usage-cache.json"

# NOTE: context_window.used_percentage provides raw context usage from Claude Code.
# Scaling to compaction threshold is applied if configured in settings.json.

# Cache TTL in seconds
LOCATION_CACHE_TTL=3600  # 1 hour (IP rarely changes)
WEATHER_CACHE_TTL=900    # 15 minutes
GIT_CACHE_TTL=5          # 5 seconds (fast refresh, but avoids repeated scans)
COUNTS_CACHE_TTL=30      # 30 seconds (file counts rarely change mid-session)
USAGE_CACHE_TTL=60       # 60 seconds (API recommends ≤1 poll/minute)

# Additional cache files for expensive operations
GIT_CACHE="$PAI_DIR/MEMORY/STATE/git-status-cache.sh"
COUNTS_CACHE="$PAI_DIR/MEMORY/STATE/counts-cache.sh"

# Source .env for API keys
[ -f "${PAI_CONFIG_DIR:-$HOME/.config/PAI}/.env" ] && source "${PAI_CONFIG_DIR:-$HOME/.config/PAI}/.env"

# Cross-platform file mtime (seconds since epoch)
# macOS uses stat -f %m, Linux uses stat -c %Y
get_mtime() {
    stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0
}

# ─────────────────────────────────────────────────────────────────────────────
# PARSE INPUT (must happen before parallel block consumes stdin)
# ─────────────────────────────────────────────────────────────────────────────

input=$(cat)

# Get DA name from settings (single source of truth)
DA_NAME=$(jq -r '.daidentity.name // .daidentity.displayName // .env.DA // "Assistant"' "$SETTINGS_FILE" 2>/dev/null)
DA_NAME="${DA_NAME:-Assistant}"

# Get PAI version from settings
PAI_VERSION=$(jq -r '.pai.version // "—"' "$SETTINGS_FILE" 2>/dev/null)
PAI_VERSION="${PAI_VERSION:-—}"

# Get Algorithm version from LATEST file (single source of truth)
ALGO_LATEST_FILE="$PAI_DIR/skills/PAI/Components/Algorithm/LATEST"
if [ -f "$ALGO_LATEST_FILE" ]; then
    ALGO_VERSION=$(cat "$ALGO_LATEST_FILE" 2>/dev/null | tr -d '[:space:]' | sed 's/^v//i')
else
    ALGO_VERSION="—"
fi
ALGO_VERSION="${ALGO_VERSION:-—}"

# Extract all data from JSON in single jq call
eval "$(echo "$input" | jq -r '
  "current_dir=" + (.workspace.current_dir // .cwd // "." | @sh) + "\n" +
  "session_id=" + (.session_id // "" | @sh) + "\n" +
  "model_name=" + (.model.display_name // "unknown" | @sh) + "\n" +
  "cc_version_json=" + (.version // "" | @sh) + "\n" +
  "duration_ms=" + (.cost.total_duration_ms // 0 | tostring) + "\n" +
  "context_max=" + (.context_window.context_window_size // 200000 | tostring) + "\n" +
  "context_pct=" + (.context_window.used_percentage // 0 | tostring) + "\n" +
  "context_remaining=" + (.context_window.remaining_percentage // 100 | tostring) + "\n" +
  "total_input=" + (.context_window.total_input_tokens // 0 | tostring) + "\n" +
  "total_output=" + (.context_window.total_output_tokens // 0 | tostring)
' 2>/dev/null)"

# Ensure defaults for critical numeric values
context_pct=${context_pct:-0}
context_max=${context_max:-200000}
context_remaining=${context_remaining:-100}
total_input=${total_input:-0}
total_output=${total_output:-0}

# If used_percentage is 0 but we have token data, calculate manually
# This handles cases where statusLine is called before percentage is populated
if [ "$context_pct" = "0" ] && [ "$total_input" -gt 0 ]; then
    total_tokens=$((total_input + total_output))
    context_pct=$((total_tokens * 100 / context_max))
fi

# Get Claude Code version
if [ -n "$cc_version_json" ] && [ "$cc_version_json" != "unknown" ]; then
    cc_version="$cc_version_json"
else
    cc_version=$(claude --version 2>/dev/null | head -1 | awk '{print $1}')
    cc_version="${cc_version:-unknown}"
fi

# Cache model name for other tools
mkdir -p "$(dirname "$MODEL_CACHE")" 2>/dev/null
echo "$model_name" > "$MODEL_CACHE" 2>/dev/null

dir_name=$(basename "$current_dir" 2>/dev/null || echo ".")

# Get session label — authoritative source: Claude Code's sessions-index.json customTitle
# Priority: customTitle (set by /rename) > session-names.json (auto-generated) > none
# NOTE: Claude Code uses lowercase "projects/" dir, PAI uses uppercase "Projects/".
SESSION_LABEL=""
SESSION_NAMES_FILE="$PAI_DIR/MEMORY/STATE/session-names.json"
SESSION_CACHE="$PAI_DIR/MEMORY/STATE/session-name-cache.sh"
if [ -n "$session_id" ]; then
    # Derive sessions-index path from current_dir (Claude Code uses lowercase "projects")
    project_slug=$(echo "$current_dir" | tr '/.' '-')
    SESSIONS_INDEX="$PAI_DIR/projects/${project_slug}/sessions-index.json"

    # Fast path: check shell cache, but invalidate if sessions-index changed (catches /rename)
    if [ -f "$SESSION_CACHE" ]; then
        source "$SESSION_CACHE" 2>/dev/null
        if [ "${cached_session_id:-}" = "$session_id" ] && [ -n "${cached_session_label:-}" ]; then
            cache_mtime=$(get_mtime "$SESSION_CACHE")
            idx_mtime=$(get_mtime "$SESSIONS_INDEX")
            names_mtime=$(get_mtime "$SESSION_NAMES_FILE")
            # Cache valid only if newer than BOTH sessions-index AND session-names.json
            # This catches /rename (updates index) and manual session-names.json edits
            max_source_mtime=$idx_mtime
            [ "$names_mtime" -gt "$max_source_mtime" ] && max_source_mtime=$names_mtime
            [ "$cache_mtime" -ge "$max_source_mtime" ] && SESSION_LABEL="${cached_session_label}"
        fi
    fi

    # Cache miss or stale: look up customTitle from sessions-index (authoritative)
    if [ -z "$SESSION_LABEL" ] && [ -f "$SESSIONS_INDEX" ]; then
        custom_title_line=$(grep -A10 "\"sessionId\": \"$session_id\"" "$SESSIONS_INDEX" 2>/dev/null | grep '"customTitle"' | head -1)
        if [ -n "$custom_title_line" ]; then
            SESSION_LABEL=$(echo "$custom_title_line" | sed 's/.*"customTitle": "//; s/".*//')
        fi
    fi

    # Fallback: session-names.json (auto-generated by SessionAutoName)
    if [ -z "$SESSION_LABEL" ] && [ -f "$SESSION_NAMES_FILE" ]; then
        SESSION_LABEL=$(jq -r --arg sid "$session_id" '.[$sid] // empty' "$SESSION_NAMES_FILE" 2>/dev/null)
    fi

    # Update cache with whatever we found
    if [ -n "$SESSION_LABEL" ]; then
        mkdir -p "$(dirname "$SESSION_CACHE")" 2>/dev/null
        printf "cached_session_id='%s'\ncached_session_label='%s'\n" "$session_id" "$SESSION_LABEL" > "$SESSION_CACHE"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL PREFETCH - Launch ALL expensive operations immediately
# ─────────────────────────────────────────────────────────────────────────────
# This section launches everything in parallel BEFORE any sequential work.
# Results are collected via temp files and sourced later.

_parallel_tmp="/tmp/pai-parallel-$$"
mkdir -p "$_parallel_tmp"

# --- PARALLEL BLOCK START ---
{
    # 1. Git status (if in git repo)
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git_root=$(git rev-parse --show-toplevel 2>/dev/null | tr '/' '_')
        GIT_REPO_CACHE="$PAI_DIR/MEMORY/STATE/git-cache${git_root}.sh"

        # Check cache validity
        if [ -f "$GIT_REPO_CACHE" ]; then
            git_cache_mtime=$(get_mtime "$GIT_REPO_CACHE")
            git_cache_age=$(($(date +%s) - git_cache_mtime))
            [ "$git_cache_age" -lt "$GIT_CACHE_TTL" ] && cp "$GIT_REPO_CACHE" "$_parallel_tmp/git.sh" && exit 0
        fi

        # Fresh git computation
        branch=$(git branch --show-current 2>/dev/null)
        [ -z "$branch" ] && branch="detached"
        stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
        [ -z "$stash_count" ] && stash_count=0
        sync_info=$(git rev-list --left-right --count HEAD...@{u} 2>/dev/null)
        last_commit_epoch=$(git log -1 --format='%ct' 2>/dev/null)
        status_output=$(git status --porcelain 2>/dev/null)

        # grep -c returns 1 on no match, so use || echo 0
        # tr -d removes any whitespace/newlines from count
        modified=$(echo "$status_output" | grep -c '^.[MDRC]' | tr -d '[:space:]' || echo 0)
        staged=$(echo "$status_output" | grep -c '^[MADRC]' | tr -d '[:space:]' || echo 0)
        untracked=$(echo "$status_output" | grep -c '^??' | tr -d '[:space:]' || echo 0)
        [ -z "$modified" ] && modified=0
        [ -z "$staged" ] && staged=0
        [ -z "$untracked" ] && untracked=0
        total_changed=$((modified + staged))

        if [ -n "$sync_info" ]; then
            ahead=$(echo "$sync_info" | awk '{print $1}')
            behind=$(echo "$sync_info" | awk '{print $2}')
        else
            ahead=0
            behind=0
        fi
        [ -z "$ahead" ] && ahead=0
        [ -z "$behind" ] && behind=0

        cat > "$_parallel_tmp/git.sh" << GITEOF
branch='$branch'
stash_count=${stash_count:-0}
modified=${modified:-0}
staged=${staged:-0}
untracked=${untracked:-0}
total_changed=${total_changed:-0}
ahead=${ahead:-0}
behind=${behind:-0}
last_commit_epoch=${last_commit_epoch:-0}
is_git_repo=true
GITEOF
        cp "$_parallel_tmp/git.sh" "$GIT_REPO_CACHE" 2>/dev/null
    else
        echo "is_git_repo=false" > "$_parallel_tmp/git.sh"
    fi
} &

{
    # 2. Location fetch (with caching)
    cache_age=999999
    [ -f "$LOCATION_CACHE" ] && cache_age=$(($(date +%s) - $(get_mtime "$LOCATION_CACHE")))

    if [ "$cache_age" -gt "$LOCATION_CACHE_TTL" ]; then
        loc_data=$(curl -s --max-time 2 "http://ip-api.com/json/?fields=city,regionName,country,lat,lon" 2>/dev/null)
        if [ -n "$loc_data" ] && echo "$loc_data" | jq -e '.city' >/dev/null 2>&1; then
            echo "$loc_data" > "$LOCATION_CACHE"
        fi
    fi

    if [ -f "$LOCATION_CACHE" ]; then
        jq -r '"location_city=" + (.city | @sh) + "\nlocation_state=" + (.regionName | @sh)' "$LOCATION_CACHE" > "$_parallel_tmp/location.sh" 2>/dev/null
    else
        echo -e "location_city='Unknown'\nlocation_state=''" > "$_parallel_tmp/location.sh"
    fi
} &

{
    # 3. Weather fetch (with caching)
    cache_age=999999
    [ -f "$WEATHER_CACHE" ] && cache_age=$(($(date +%s) - $(get_mtime "$WEATHER_CACHE")))

    if [ "$cache_age" -gt "$WEATHER_CACHE_TTL" ]; then
        lat="" lon=""
        if [ -f "$LOCATION_CACHE" ]; then
            lat=$(jq -r '.lat // empty' "$LOCATION_CACHE" 2>/dev/null)
            lon=$(jq -r '.lon // empty' "$LOCATION_CACHE" 2>/dev/null)
        fi
        lat="${lat:-37.7749}"
        lon="${lon:-122.4194}"

        weather_json=$(curl -s --max-time 3 "https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius" 2>/dev/null)
        if [ -n "$weather_json" ] && echo "$weather_json" | jq -e '.current' >/dev/null 2>&1; then
            temp=$(echo "$weather_json" | jq -r '.current.temperature_2m' 2>/dev/null)
            code=$(echo "$weather_json" | jq -r '.current.weather_code' 2>/dev/null)
            condition="Clear"
            case "$code" in
                0) condition="Clear" ;; 1|2|3) condition="Cloudy" ;; 45|48) condition="Foggy" ;;
                51|53|55|56|57) condition="Drizzle" ;; 61|63|65|66|67) condition="Rain" ;;
                71|73|75|77) condition="Snow" ;; 80|81|82) condition="Showers" ;;
                85|86) condition="Snow" ;; 95|96|99) condition="Storm" ;;
            esac
            echo "${temp}°C ${condition}" > "$WEATHER_CACHE"
        fi
    fi

    if [ -f "$WEATHER_CACHE" ]; then
        echo "weather_str='$(cat "$WEATHER_CACHE" 2>/dev/null)'" > "$_parallel_tmp/weather.sh"
    else
        echo "weather_str='—'" > "$_parallel_tmp/weather.sh"
    fi
} &

{
    # 4. All counts from settings.json (updated by StopOrchestrator → UpdateCounts)
    # Zero filesystem scanning — stop hook keeps settings.json fresh
    if jq -e '.counts' "$SETTINGS_FILE" >/dev/null 2>&1; then
        jq -r '
            "skills_count=" + (.counts.skills // 0 | tostring) + "\n" +
            "workflows_count=" + (.counts.workflows // 0 | tostring) + "\n" +
            "hooks_count=" + (.counts.hooks // 0 | tostring) + "\n" +
            "learnings_count=" + (.counts.signals // 0 | tostring) + "\n" +
            "files_count=" + (.counts.files // 0 | tostring) + "\n" +
            "work_count=" + (.counts.work // 0 | tostring) + "\n" +
            "sessions_count=" + (.counts.sessions // 0 | tostring) + "\n" +
            "research_count=" + (.counts.research // 0 | tostring) + "\n" +
            "ratings_count=" + (.counts.ratings // 0 | tostring)
        ' "$SETTINGS_FILE" > "$_parallel_tmp/counts.sh" 2>/dev/null
    else
        # First run before any stop hook has fired — seed with defaults
        cat > "$_parallel_tmp/counts.sh" << COUNTSEOF
skills_count=65
workflows_count=339
hooks_count=18
learnings_count=3000
files_count=172
work_count=0
sessions_count=0
research_count=0
ratings_count=0
COUNTSEOF
    fi
} &

{
    # 5. Usage data — refresh from Anthropic API if cache is stale
    cache_age=999999
    [ -f "$USAGE_CACHE" ] && cache_age=$(($(date +%s) - $(get_mtime "$USAGE_CACHE")))

    if [ "$cache_age" -gt "$USAGE_CACHE_TTL" ]; then
        # Extract OAuth token — macOS Keychain first, then Linux credentials file
        keychain_data=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
        token=$(echo "$keychain_data" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('accessToken',''))" 2>/dev/null)
        # Linux fallback: read directly from credentials JSON file
        if [ -z "$token" ]; then
            _creds="${PAI_DIR}/.credentials.json"
            [ -f "$_creds" ] && token=$(jq -r '.claudeAiOauth.accessToken // empty' "$_creds" 2>/dev/null)
        fi

        if [ -n "$token" ]; then
            usage_json=$(curl -s --max-time 3 \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -H "anthropic-beta: oauth-2025-04-20" \
                "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)

            if [ -n "$usage_json" ] && echo "$usage_json" | jq -e '.five_hour' >/dev/null 2>&1; then
                # Preserve workspace_cost from existing cache (admin API is slow, stop hook handles it)
                if [ -f "$USAGE_CACHE" ]; then
                    ws_cost=$(jq -r '.workspace_cost // empty' "$USAGE_CACHE" 2>/dev/null)
                    if [ -n "$ws_cost" ] && [ "$ws_cost" != "null" ]; then
                        usage_json=$(echo "$usage_json" | jq --argjson ws "$ws_cost" '. + {workspace_cost: $ws}' 2>/dev/null || echo "$usage_json")
                    fi
                fi
                echo "$usage_json" | jq '.' > "$USAGE_CACHE" 2>/dev/null
            fi
        fi
    fi

    # Read cache (freshly updated or existing)
    if [ -f "$USAGE_CACHE" ]; then
        jq -r '
            "usage_5h=" + (.five_hour.utilization // 0 | tostring) + "\n" +
            "usage_5h_reset=" + (.five_hour.resets_at // "" | @sh) + "\n" +
            "usage_7d=" + (.seven_day.utilization // 0 | tostring) + "\n" +
            "usage_7d_reset=" + (.seven_day.resets_at // "" | @sh) + "\n" +
            "usage_opus=" + (if .seven_day_opus then (.seven_day_opus.utilization // 0 | tostring) else "null" end) + "\n" +
            "usage_sonnet=" + (if .seven_day_sonnet then (.seven_day_sonnet.utilization // 0 | tostring) else "null" end) + "\n" +
            "usage_extra_enabled=" + (.extra_usage.is_enabled // false | tostring) + "\n" +
            "usage_extra_limit=" + (.extra_usage.monthly_limit // 0 | tostring) + "\n" +
            "usage_extra_used=" + (.extra_usage.used_credits // 0 | tostring) + "\n" +
            "usage_ws_cost_cents=" + (.workspace_cost.month_used_cents // 0 | tostring)
        ' "$USAGE_CACHE" > "$_parallel_tmp/usage.sh" 2>/dev/null
    else
        echo -e "usage_5h=0\nusage_7d=0\nusage_extra_enabled=false\nusage_ws_cost_cents=0" > "$_parallel_tmp/usage.sh"
    fi
} &

{
    # 6. Quote prefetch (was serial at the end — now parallel)
    quote_age=$(($(date +%s) - $(get_mtime "$QUOTE_CACHE")))
    if [ "$quote_age" -gt 300 ] || [ ! -f "$QUOTE_CACHE" ]; then
        if [ -n "${ZENQUOTES_API_KEY:-}" ]; then
            new_quote=$(curl -s --max-time 1 "https://zenquotes.io/api/random/${ZENQUOTES_API_KEY}" 2>/dev/null | \
                jq -r '.[0] | select(.q | length < 80) | .q + "|" + .a' 2>/dev/null)
            [ -n "$new_quote" ] && [ "$new_quote" != "null" ] && echo "$new_quote" > "$QUOTE_CACHE"
        fi
    fi
} &

# --- PARALLEL BLOCK END - wait for all to complete ---
wait

# Source all parallel results
[ -f "$_parallel_tmp/git.sh" ] && source "$_parallel_tmp/git.sh"
[ -f "$_parallel_tmp/location.sh" ] && source "$_parallel_tmp/location.sh"
[ -f "$_parallel_tmp/weather.sh" ] && source "$_parallel_tmp/weather.sh"
[ -f "$_parallel_tmp/counts.sh" ] && source "$_parallel_tmp/counts.sh"
[ -f "$_parallel_tmp/usage.sh" ] && source "$_parallel_tmp/usage.sh"
rm -rf "$_parallel_tmp" 2>/dev/null

learning_count="$learnings_count"

# ─────────────────────────────────────────────────────────────────────────────
# TERMINAL WIDTH DETECTION
# ─────────────────────────────────────────────────────────────────────────────
# Hooks don't inherit terminal context. Try multiple methods.

detect_terminal_width() {
    local width=""

    # Tier 1: Kitty IPC (most accurate for Kitty panes)
    if [ -n "$KITTY_WINDOW_ID" ] && command -v kitten >/dev/null 2>&1; then
        width=$(kitten @ ls 2>/dev/null | jq -r --argjson wid "$KITTY_WINDOW_ID" \
            '.[].tabs[].windows[] | select(.id == $wid) | .columns' 2>/dev/null)
    fi

    # Tier 2: Direct TTY query
    [ -z "$width" ] || [ "$width" = "0" ] || [ "$width" = "null" ] && \
        width=$(stty size </dev/tty 2>/dev/null | awk '{print $2}')

    # Tier 3: tput fallback
    [ -z "$width" ] || [ "$width" = "0" ] && width=$(tput cols 2>/dev/null)

    # Tier 4: Environment variable
    [ -z "$width" ] || [ "$width" = "0" ] && width=${COLUMNS:-80}

    echo "$width"
}

term_width=$(detect_terminal_width)

if [ "$term_width" -lt 35 ]; then
    MODE="nano"
elif [ "$term_width" -lt 55 ]; then
    MODE="micro"
elif [ "$term_width" -lt 80 ]; then
    MODE="mini"
else
    MODE="normal"
fi

# NOTE: DA_NAME, PAI_VERSION, input JSON, cc_version, model_name
# are all already parsed above (lines 59-113). No duplicate parsing needed.

dir_name=$(basename "$current_dir")

# ─────────────────────────────────────────────────────────────────────────────
# COLOR PALETTE
# ─────────────────────────────────────────────────────────────────────────────
# Tailwind-inspired colors organized by usage

RESET='\033[0m'

# Structural (chrome, labels, separators)
SLATE_300='\033[38;2;203;213;225m'     # Light text/values
SLATE_400='\033[38;2;148;163;184m'     # Labels
SLATE_500='\033[38;2;100;116;139m'     # Muted text
SLATE_600='\033[38;2;71;85;105m'       # Separators

# Semantic colors
EMERALD='\033[38;2;74;222;128m'        # Positive/success
ROSE='\033[38;2;251;113;133m'          # Error/negative

# Rating gradient (for get_rating_color)
RATING_10='\033[38;2;74;222;128m'      # 9-10: Emerald
RATING_8='\033[38;2;163;230;53m'       # 8: Lime
RATING_7='\033[38;2;250;204;21m'       # 7: Yellow
RATING_6='\033[38;2;251;191;36m'       # 6: Amber
RATING_5='\033[38;2;251;146;60m'       # 5: Orange
RATING_4='\033[38;2;248;113;113m'      # 4: Light red
RATING_LOW='\033[38;2;239;68;68m'      # 0-3: Red

# Line 1: Greeting (violet theme)
GREET_PRIMARY='\033[38;2;167;139;250m'
GREET_SECONDARY='\033[38;2;139;92;246m'
GREET_ACCENT='\033[38;2;196;181;253m'

# Line 2: Wielding (cyan/teal theme)
WIELD_PRIMARY='\033[38;2;34;211;238m'
WIELD_SECONDARY='\033[38;2;45;212;191m'
WIELD_ACCENT='\033[38;2;103;232;249m'
WIELD_WORKFLOWS='\033[38;2;94;234;212m'
WIELD_HOOKS='\033[38;2;6;182;212m'
WIELD_LEARNINGS='\033[38;2;20;184;166m'

# Line 3: Git (sky/blue theme)
GIT_PRIMARY='\033[38;2;56;189;248m'
GIT_VALUE='\033[38;2;186;230;253m'
GIT_DIR='\033[38;2;147;197;253m'
GIT_CLEAN='\033[38;2;125;211;252m'
GIT_MODIFIED='\033[38;2;96;165;250m'
GIT_ADDED='\033[38;2;59;130;246m'
GIT_STASH='\033[38;2;165;180;252m'
GIT_AGE_FRESH='\033[38;2;125;211;252m'
GIT_AGE_RECENT='\033[38;2;96;165;250m'
GIT_AGE_STALE='\033[38;2;59;130;246m'
GIT_AGE_OLD='\033[38;2;99;102;241m'

# Line 4: Learning (purple theme)
LEARN_PRIMARY='\033[38;2;167;139;250m'
LEARN_SECONDARY='\033[38;2;196;181;253m'
LEARN_WORK='\033[38;2;192;132;252m'
LEARN_SIGNALS='\033[38;2;139;92;246m'
LEARN_RESEARCH='\033[38;2;129;140;248m'
LEARN_SESSIONS='\033[38;2;99;102;241m'

# Line 5: Learning Signal (green theme for LEARNING label)
SIGNAL_LABEL='\033[38;2;56;189;248m'
SIGNAL_COLOR='\033[38;2;96;165;250m'
SIGNAL_PERIOD='\033[38;2;148;163;184m'
LEARN_LABEL='\033[38;2;21;128;61m'    # Dark green for LEARNING:

# Line 6: Context (indigo theme)
CTX_PRIMARY='\033[38;2;129;140;248m'
CTX_SECONDARY='\033[38;2;165;180;252m'
CTX_ACCENT='\033[38;2;139;92;246m'
CTX_BUCKET_EMPTY='\033[38;2;75;82;95m'

# Line: Usage (amber/orange theme)
USAGE_PRIMARY='\033[38;2;251;191;36m'     # Amber icon
USAGE_LABEL='\033[38;2;217;163;29m'       # Amber label
USAGE_VALUE='\033[38;2;253;224;71m'       # Yellow-gold values
USAGE_RESET='\033[38;2;148;163;184m'      # Slate for reset time
USAGE_EXTRA='\033[38;2;140;90;60m'         # Muted brown for EX

# Line 7: Quote (gold theme)
QUOTE_PRIMARY='\033[38;2;252;211;77m'
QUOTE_AUTHOR='\033[38;2;180;140;60m'

# PAI Branding (matches banner colors)
PAI_P='\033[38;2;30;58;138m'          # Navy
PAI_A='\033[38;2;59;130;246m'         # Medium blue
PAI_I='\033[38;2;147;197;253m'        # Light blue
PAI_LABEL='\033[38;2;100;116;139m'    # Slate for "status line"
PAI_CITY='\033[38;2;147;197;253m'     # Light blue for city
PAI_STATE='\033[38;2;100;116;139m'    # Slate for state
PAI_TIME='\033[38;2;96;165;250m'      # Medium-light blue for time
PAI_WEATHER='\033[38;2;135;206;235m'  # Sky blue for weather
PAI_SESSION='\033[38;2;120;135;160m'  # Muted blue-gray for session label

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

# Get color for rating value (handles "—" for no data)
get_rating_color() {
    local val="$1"
    [[ "$val" == "—" || -z "$val" ]] && { echo "$SLATE_400"; return; }
    local rating_int=${val%%.*}
    [[ ! "$rating_int" =~ ^[0-9]+$ ]] && { echo "$SLATE_400"; return; }

    if   [ "$rating_int" -ge 9 ]; then echo "$RATING_10"
    elif [ "$rating_int" -ge 8 ]; then echo "$RATING_8"
    elif [ "$rating_int" -ge 7 ]; then echo "$RATING_7"
    elif [ "$rating_int" -ge 6 ]; then echo "$RATING_6"
    elif [ "$rating_int" -ge 5 ]; then echo "$RATING_5"
    elif [ "$rating_int" -ge 4 ]; then echo "$RATING_4"
    else echo "$RATING_LOW"
    fi
}

# Get gradient color for context bar bucket
# Green(74,222,128) → Yellow(250,204,21) → Orange(251,146,60) → Red(239,68,68)
get_bucket_color() {
    local pos=$1 max=$2
    local pct=$((pos * 100 / max))
    local r g b

    if [ "$pct" -le 33 ]; then
        r=$((74 + (250 - 74) * pct / 33))
        g=$((222 + (204 - 222) * pct / 33))
        b=$((128 + (21 - 128) * pct / 33))
    elif [ "$pct" -le 66 ]; then
        local t=$((pct - 33))
        r=$((250 + (251 - 250) * t / 33))
        g=$((204 + (146 - 204) * t / 33))
        b=$((21 + (60 - 21) * t / 33))
    else
        local t=$((pct - 66))
        r=$((251 + (239 - 251) * t / 34))
        g=$((146 + (68 - 146) * t / 34))
        b=$((60 + (68 - 60) * t / 34))
    fi
    printf '\033[38;2;%d;%d;%dm' "$r" "$g" "$b"
}

# Get color for usage percentage (green→yellow→orange→red)
get_usage_color() {
    local pct="$1"
    local pct_int=${pct%%.*}
    [ -z "$pct_int" ] && pct_int=0
    if   [ "$pct_int" -ge 80 ]; then echo "$ROSE"
    elif [ "$pct_int" -ge 60 ]; then echo '\033[38;2;251;146;60m'    # Orange
    elif [ "$pct_int" -ge 40 ]; then echo '\033[38;2;251;191;36m'    # Amber
    else echo "$EMERALD"
    fi
}

# Calculate human-readable time until reset from ISO 8601 timestamp
# Uses TZ from settings.json (principal.timezone) for correct local time
time_until_reset() {
    local reset_ts="$1"
    [ -z "$reset_ts" ] && { echo "—"; return; }
    # Use python3 for reliable ISO 8601 parsing with timezone handling
    local diff=$(python3 -c "
from datetime import datetime, timezone
import sys
try:
    ts = '$reset_ts'
    # Parse ISO 8601 with timezone
    from datetime import datetime
    if '+' in ts[10:]:
        dt = datetime.fromisoformat(ts)
    elif ts.endswith('Z'):
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    else:
        dt = datetime.fromisoformat(ts + '+00:00')
    now = datetime.now(timezone.utc)
    diff = int((dt - now).total_seconds())
    print(max(diff, 0))
except:
    print(-1)
" 2>/dev/null)
    [ -z "$diff" ] || [ "$diff" = "-1" ] && { echo "—"; return; }
    [ "$diff" -le 0 ] && { echo "now"; return; }
    local hours=$((diff / 3600))
    local mins=$(((diff % 3600) / 60))
    if [ "$hours" -ge 24 ]; then
        local days=$((hours / 24))
        local rem_hours=$((hours % 24))
        [ "$rem_hours" -gt 0 ] && echo "${days}d${rem_hours}h" || echo "${days}d"
    elif [ "$hours" -gt 0 ]; then
        echo "${hours}h${mins}m"
    else
        echo "${mins}m"
    fi
}

# Calculate local clock time from ISO 8601 reset timestamp
# Returns format like "3:45p" for 5H or "Mon 3p" for weekly
reset_clock_time() {
    local reset_ts="$1" fmt="$2"
    [ -z "$reset_ts" ] && { echo ""; return; }
    local result=$(python3 -c "
from datetime import datetime, timezone, timedelta
import sys
try:
    ts = '$reset_ts'
    if '+' in ts[10:]:
        dt = datetime.fromisoformat(ts)
    elif ts.endswith('Z'):
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    else:
        dt = datetime.fromisoformat(ts + '+00:00')
    # Convert to Pacific
    from zoneinfo import ZoneInfo
    local_dt = dt.astimezone(ZoneInfo('America/Los_Angeles'))
    if '$fmt' == 'weekly':
        day = local_dt.strftime('%a')
        hour = local_dt.strftime('%H:%M')
        print(f'{day} {hour}')
    else:
        hour = local_dt.strftime('%H:%M')
        print(hour)
except:
    print('')
" 2>/dev/null)
    echo "$result"
}

# Render context bar - gradient progress bar using (potentially scaled) percentage
render_context_bar() {
    local width=$1 pct=$2
    local output="" last_color=""

    # Use percentage (may be scaled to compaction threshold)
    local filled=$((pct * width / 100))
    [ "$filled" -lt 0 ] && filled=0

    # Use spaced buckets only for small widths to improve readability
    local use_spacing=false
    [ "$width" -le 20 ] && use_spacing=true

    for i in $(seq 1 $width 2>/dev/null); do
        if [ "$i" -le "$filled" ]; then
            local color=$(get_bucket_color $i $width)
            last_color="$color"
            output="${output}${color}⛁${RESET}"
            [ "$use_spacing" = true ] && output="${output} "
        else
            output="${output}${CTX_BUCKET_EMPTY}⛁${RESET}"
            [ "$use_spacing" = true ] && output="${output} "
        fi
    done

    output="${output% }"
    echo "$output"
    LAST_BUCKET_COLOR="${last_color:-$EMERALD}"
}

# Calculate optimal bar width to match statusline content width (72 chars)
# Returns buckets that fill the same visual width as separator lines
calc_bar_width() {
    local mode=$1
    local content_width=72  # Matches the ──── separator line width
    local prefix_len suffix_len bucket_size available

    case "$mode" in
        nano)
            prefix_len=2    # "◉ "
            suffix_len=5    # " XX%"
            bucket_size=2   # char + space
            ;;
        micro)
            prefix_len=2    # "◉ "
            suffix_len=5    # " XX%"
            bucket_size=2
            ;;
        mini)
            prefix_len=12   # "◉ CONTEXT: "
            suffix_len=5    # " XXX%"
            bucket_size=2
            ;;
        normal)
            prefix_len=12   # "◉ CONTEXT: "
            suffix_len=5    # " XXX%"
            bucket_size=1   # no spacing for dense display
            ;;
    esac

    available=$((content_width - prefix_len - suffix_len))
    local buckets=$((available / bucket_size))

    # Minimum floor per mode
    [ "$mode" = "nano" ] && [ "$buckets" -lt 5 ] && buckets=5
    [ "$mode" = "micro" ] && [ "$buckets" -lt 6 ] && buckets=6
    [ "$mode" = "mini" ] && [ "$buckets" -lt 8 ] && buckets=8
    [ "$mode" = "normal" ] && [ "$buckets" -lt 16 ] && buckets=16

    echo "$buckets"
}

# ═══════════════════════════════════════════════════════════════════════════════
# OUTPUT: 4 lines — Location | Environment | Context | Quota
# ═══════════════════════════════════════════════════════════════════════════════

current_time=$(date +"%H:%M")

# ─── LINE 1: LOCATION ────────────────────────────────────────────────────────
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
case "$MODE" in
    nano)
        printf "${PAI_TIME}${current_time}${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        ;;
    micro)
        printf "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        ;;
    mini|normal)
        printf "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET}${SLATE_600},${RESET} ${PAI_STATE}${location_state}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        ;;
esac

# ─── LINE 2: ENVIRONMENT ─────────────────────────────────────────────────────
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
case "$MODE" in
    nano)
        printf "${SLATE_400}ENV:${RESET} ${SLATE_500}v${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}v${ALGO_VERSION}${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET}\n"
        ;;
    micro)
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}v${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET} ${SLATE_400}W:${SLATE_300}${workflows_count}${RESET} ${SLATE_400}H:${SLATE_300}${hooks_count}${RESET}\n"
        ;;
    mini)
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}v${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}SK:${RESET}${SLATE_300}${skills_count}${RESET} ${WIELD_WORKFLOWS}WF:${RESET}${SLATE_300}${workflows_count}${RESET} ${WIELD_HOOKS}Hooks:${RESET}${SLATE_300}${hooks_count}${RESET}\n"
        ;;
    normal)
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}v${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}v${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}SK:${RESET} ${SLATE_300}${skills_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_WORKFLOWS}WF:${RESET} ${SLATE_300}${workflows_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_HOOKS}Hooks:${RESET} ${SLATE_300}${hooks_count}${RESET}\n"
        ;;
esac

# ─── LINE 3: CONTEXT BAR ─────────────────────────────────────────────────────
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
context_max="${context_max:-200000}"

COMPACTION_THRESHOLD=$(jq -r '.contextDisplay.compactionThreshold // 100' "$SETTINGS_FILE" 2>/dev/null)
COMPACTION_THRESHOLD="${COMPACTION_THRESHOLD:-100}"

raw_pct="${context_pct%%.*}"
[ -z "$raw_pct" ] && raw_pct=0

if [ "$COMPACTION_THRESHOLD" -lt 100 ] && [ "$COMPACTION_THRESHOLD" -gt 0 ]; then
    display_pct=$((raw_pct * 100 / COMPACTION_THRESHOLD))
    [ "$display_pct" -gt 100 ] && display_pct=100
else
    display_pct="$raw_pct"
fi

if   [ "$display_pct" -ge 80 ]; then pct_color="$ROSE"
elif [ "$display_pct" -ge 60 ]; then pct_color='\033[38;2;251;146;60m'
elif [ "$display_pct" -ge 40 ]; then pct_color='\033[38;2;251;191;36m'
else                                  pct_color="$EMERALD"
fi

bar_width=$(calc_bar_width "$MODE")
bar=$(render_context_bar "$bar_width" "$display_pct")

case "$MODE" in
    nano|micro)
        printf "${CTX_PRIMARY}◉${RESET} ${bar} ${pct_color}${display_pct}%%${RESET}\n"
        ;;
    mini|normal)
        printf "${CTX_PRIMARY}◉${RESET} ${CTX_SECONDARY}CONTEXT:${RESET} ${bar} ${pct_color}${display_pct}%%${RESET}\n"
        ;;
esac

# ─── LINE 4: QUOTA / ACCOUNT USAGE ───────────────────────────────────────────
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

usage_5h_color=$(get_usage_color "$usage_5h_int")
usage_7d_color=$(get_usage_color "$usage_7d_int")

if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ]; then
    eval "$(python3 -c "
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
def parse_ts(ts):
    if not ts: return None
    try:
        if '+' in ts[10:]:
            return datetime.fromisoformat(ts)
        elif ts.endswith('Z'):
            return datetime.fromisoformat(ts.replace('Z', '+00:00'))
        else:
            return datetime.fromisoformat(ts + '+00:00')
    except: return None
def clock_time(ts, fmt):
    dt = parse_ts(ts)
    if not dt: return ''
    local_dt = dt.astimezone(ZoneInfo('Europe/London'))
    return local_dt.strftime('%a %H:%M') if fmt == 'weekly' else local_dt.strftime('%H:%M')
r5h = '$usage_5h_reset'
r7d = '$usage_7d_reset'
print(f\"clock_5h='{clock_time(r5h, 'hourly')}'\")
print(f\"clock_7d='{clock_time(r7d, 'weekly')}'\")
" 2>/dev/null)"
    reset_5h_time="${clock_5h:-—}"
    reset_7d_time="${clock_7d:-—}"

    case "$MODE" in
        nano)
            printf "${USAGE_PRIMARY}▰${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻ ${reset_5h_time}${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}/wk${RESET}\n"
            ;;
        micro)
            printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_RESET}5H:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻ ${reset_5h_time}${RESET} ${SLATE_600}│${RESET} ${USAGE_RESET}WK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}↻ ${reset_7d_time}${RESET}\n"
            ;;
        mini|normal)
            printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_LABEL}USAGE:${RESET} ${USAGE_RESET}5H:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻ ${SLATE_500}${reset_5h_time}${RESET} ${SLATE_600}│${RESET} ${USAGE_RESET}WK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}↻ ${SLATE_500}${reset_7d_time}${RESET}\n"
            ;;
    esac
else
    printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_LABEL}USAGE:${RESET} ${SLATE_500}add ANTHROPIC_API_KEY to ~/.config/pai/.env${RESET}\n"
fi
