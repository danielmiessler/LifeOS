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
COUNTS_CACHE_TTL=30      # 30 seconds (file counts rarely change mid-session)
USAGE_CACHE_TTL=60       # 60 seconds (API recommends ≤1 poll/minute)

# Additional cache files
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

# Get Algorithm version from settings.json (single source of truth)
ALGO_VERSION=$(jq -r '.pai.algorithmVersion // "—"' "$SETTINGS_FILE" 2>/dev/null)
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

# ── Self-calibrating startup estimate ──────────────────────────────────────
# Before the first API call, Claude Code provides no token data. We estimate
# by splitting context into: base (system prompt + tools + startup messages)
# + dynamic additions (CLAUDE.md, memory, skills, agents).
#
# The base is calibrated from real data: after the first API response, we
# derive window tokens from used_percentage, subtract dynamic additions,
# and cache the result. Next session uses the cached base instead of guessing.
# ───────────────────────────────────────────────────────────────────────────
_base_cache="${PAI_DIR}/MEMORY/STATE/context-base-tokens.txt"

# Helper: calculate dynamic additions (CLAUDE.md + memory + skills + agents)
_calc_dynamic() {
    local _dyn=0
    [ -f "$PAI_DIR/CLAUDE.md" ] && _dyn=$((_dyn + $(wc -c < "$PAI_DIR/CLAUDE.md") / 4))
    for _f in "$PAI_DIR"/projects/*/memory/MEMORY.md; do
        [ -f "$_f" ] && _dyn=$((_dyn + $(wc -c < "$_f") / 4))
    done
    local _sk; _sk=$(jq -r '.counts.skills // 75' "$SETTINGS_FILE" 2>/dev/null || echo 75)
    _dyn=$((_dyn + _sk * 60))
    local _ag; _ag=$(ls "$PAI_DIR"/agents/*.md 2>/dev/null | wc -l | tr -d ' ')
    _dyn=$((_dyn + ${_ag:-0} * 60))
    echo "$_dyn"
}

# Estimate initial context (no API calls yet)
if [ "$context_pct" = "0" ] && [ "$total_input" -eq 0 ] 2>/dev/null; then
    # Read cached base from previous session, fall back to 30k default
    _est=30000
    if [ -f "$_base_cache" ]; then
        _cached=$(cat "$_base_cache" 2>/dev/null)
        [ "$_cached" -gt 10000 ] 2>/dev/null && [ "$_cached" -lt 80000 ] 2>/dev/null && _est=$_cached
    fi
    _est=$((_est + $(_calc_dynamic)))
    context_pct=$((_est * 100 / context_max))
fi

# Calibrate base for future sessions (once per session, on first real data)
# Guard: total_input > 0 ensures Claude Code returned real data (not our estimate).
# We use used_percentage * context_max for the calculation (total_input is billing
# tokens and doesn't reflect context window size).
if [ "$total_input" -gt 0 ] && [ -n "$session_id" ] && [ ! -f "/tmp/.cc-ctx-cal-${session_id}" ]; then
    touch "/tmp/.cc-ctx-cal-${session_id}"
    _raw_ctx_pct="${context_pct%%.*}"
    _window_tokens=$((_raw_ctx_pct * context_max / 100))
    _measured_base=$((_window_tokens - $(_calc_dynamic)))
    if [ "$_measured_base" -gt 10000 ] 2>/dev/null && [ "$_measured_base" -lt 80000 ] 2>/dev/null; then
        echo "$_measured_base" > "$_base_cache"
    fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# SESSION COST ESTIMATION (real-time from token counts — no API lag)
# Pricing: platform.claude.com/docs/en/about-claude/pricing
# Note: 1M context >200K tokens bills at 2x input ($6) and 1.5x output ($22.50)
#        We use base rates here as a floor estimate.
# ─────────────────────────────────────────────────────────────────────────────
session_cost_str=""
if [ "$total_input" -gt 0 ] || [ "$total_output" -gt 0 ]; then
    case "$model_name" in
        *"Opus 4"*|*"opus-4"*)   input_mtok="15.00"; output_mtok="75.00" ;;
        *"Sonnet 4"*)             input_mtok="3.00";  output_mtok="15.00" ;;
        *"Haiku 4"*|*"haiku-4"*) input_mtok="0.80";  output_mtok="4.00"  ;;
        *)                        input_mtok="3.00";  output_mtok="15.00" ;;
    esac
    session_cost_str=$(python3 -c "
cost = ($total_input * $input_mtok + $total_output * $output_mtok) / 1_000_000
if cost < 0.01:
    print(f'\${cost:.4f}')
elif cost < 1.00:
    print(f'\${cost:.3f}')
else:
    print(f'\${cost:.2f}')
" 2>/dev/null)
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
    # 1. Git — FAST INDEX-ONLY ops (<50ms total, no working tree scan)
    #    No git status, no git diff, no file counts. Those scan 76K+ tracked files = 4-7s.
    if git rev-parse --git-dir > /dev/null 2>&1; then
        branch=$(git branch --show-current 2>/dev/null)
        [ -z "$branch" ] && branch="detached"
        stash_count=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
        [ -z "$stash_count" ] && stash_count=0
        sync_info=$(git rev-list --left-right --count HEAD...@{u} 2>/dev/null)
        last_commit_epoch=$(git log -1 --format='%ct' 2>/dev/null)

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
ahead=${ahead:-0}
behind=${behind:-0}
last_commit_epoch=${last_commit_epoch:-0}
is_git_repo=true
GITEOF
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
        # Extract OAuth token from macOS Keychain
        keychain_data=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
        token=$(echo "$keychain_data" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('claudeAiOauth',{}).get('accessToken',''))" 2>/dev/null)

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
# LINE 0: PAI BRANDING (location, time, weather)
# ═══════════════════════════════════════════════════════════════════════════════
# NOTE: location_city, location_state, weather_str are populated by PARALLEL PREFETCH

current_time=$(date +"%H:%M")

# Session label: uppercase 2-word label
session_display=""
if [ -n "$SESSION_LABEL" ]; then
    session_display=$(echo "$SESSION_LABEL" | tr '[:lower:]' '[:upper:]')
fi

# Output PAI branding line
case "$MODE" in
    nano)
        printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${SLATE_600}│ ────────────${RESET}\n"
        printf "${PAI_TIME}${current_time}${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        printf "${SLATE_400}ENV:${RESET} ${SLATE_500}${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}${ALGO_VERSION}${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET}\n"
        ;;
    micro)
        if [ -n "$session_display" ]; then
            local_left="── │ PAI STATUSLINE │"
            local_right="${session_display}"
            local_left_len=${#local_left}
            local_right_len=${#session_display}
            local_fill=$((72 - local_left_len - local_right_len))
            [ "$local_fill" -lt 2 ] && local_fill=2
            local_dashes=$(printf '%*s' "$local_fill" '' | tr ' ' '─')
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ${local_dashes}${RESET} ${PAI_SESSION}${session_display}${RESET}\n"
        else
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ──────────────────${RESET}\n"
        fi
        printf "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}S:${SLATE_300}${skills_count}${RESET} ${SLATE_400}W:${SLATE_300}${workflows_count}${RESET} ${SLATE_400}H:${SLATE_300}${hooks_count}${RESET}\n"
        ;;
    mini)
        if [ -n "$session_display" ]; then
            local_left="── │ PAI STATUSLINE │"
            local_right="${session_display}"
            local_left_len=${#local_left}
            local_right_len=${#session_display}
            local_fill=$((72 - local_left_len - local_right_len))
            [ "$local_fill" -lt 2 ] && local_fill=2
            local_dashes=$(printf '%*s' "$local_fill" '' | tr ' ' '─')
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ${local_dashes}${RESET} ${PAI_SESSION}${session_display}${RESET}\n"
        else
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ────────────────────────────────────────${RESET}\n"
        fi
        printf "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET}${SLATE_600},${RESET} ${PAI_STATE}${location_state}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}SK:${RESET}${SLATE_300}${skills_count}${RESET} ${WIELD_WORKFLOWS}WF:${RESET}${SLATE_300}${workflows_count}${RESET} ${WIELD_HOOKS}Hooks:${RESET}${SLATE_300}${hooks_count}${RESET}\n"
        ;;
    normal)
        if [ -n "$session_display" ]; then
            local_left="── │ PAI STATUSLINE │"
            local_right="${session_display}"
            local_left_len=${#local_left}
            local_right_len=${#session_display}
            local_fill=$((72 - local_left_len - local_right_len))
            [ "$local_fill" -lt 2 ] && local_fill=2
            local_dashes=$(printf '%*s' "$local_fill" '' | tr ' ' '─')
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ${local_dashes}${RESET} ${PAI_SESSION}${session_display}${RESET}\n"
        else
            printf "${SLATE_600}── │${RESET} ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${PAI_A}STATUSLINE${RESET} ${SLATE_600}│ ──────────────────────────────────────────────────${RESET}\n"
        fi
        printf "${PAI_LABEL}LOC:${RESET} ${PAI_CITY}${location_city}${RESET}${SLATE_600},${RESET} ${PAI_STATE}${location_state}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}\n"
        printf "${SLATE_400}ENV:${RESET} ${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}SK:${RESET} ${SLATE_300}${skills_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_WORKFLOWS}WF:${RESET} ${SLATE_300}${workflows_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_HOOKS}Hooks:${RESET} ${SLATE_300}${hooks_count}${RESET}\n"
        ;;
esac
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 1: CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

# Format duration
duration_sec=$((duration_ms / 1000))
if   [ "$duration_sec" -ge 3600 ]; then time_display="$((duration_sec / 3600))h$((duration_sec % 3600 / 60))m"
elif [ "$duration_sec" -ge 60 ];   then time_display="$((duration_sec / 60))m$((duration_sec % 60))s"
else time_display="${duration_sec}s"
fi

# Context display - scale to compaction threshold if configured
context_max="${context_max:-200000}"
max_k=$((context_max / 1000))

# Read compaction threshold from settings (default 100 = no scaling)
COMPACTION_THRESHOLD=$(jq -r '.contextDisplay.compactionThreshold // 100' "$SETTINGS_FILE" 2>/dev/null)
COMPACTION_THRESHOLD="${COMPACTION_THRESHOLD:-100}"

# Get raw percentage from Claude Code
raw_pct="${context_pct%%.*}"  # Remove decimals
[ -z "$raw_pct" ] && raw_pct=0

# Scale percentage: if threshold is 62, then 62% raw = 100% displayed
# Formula: display_pct = (raw_pct * 100) / threshold
if [ "$COMPACTION_THRESHOLD" -lt 100 ] && [ "$COMPACTION_THRESHOLD" -gt 0 ]; then
    display_pct=$((raw_pct * 100 / COMPACTION_THRESHOLD))
    # Cap at 100% (could exceed if past compaction point)
    [ "$display_pct" -gt 100 ] && display_pct=100
else
    display_pct="$raw_pct"
fi

# Color based on scaled percentage (same thresholds work for scaled 0-100%)
if [ "$display_pct" -ge 80 ]; then
    pct_color="$ROSE"                  # Red: 80%+ - getting full
elif [ "$display_pct" -ge 60 ]; then
    pct_color='\033[38;2;251;146;60m'  # Orange: 60-80%
elif [ "$display_pct" -ge 40 ]; then
    pct_color='\033[38;2;251;191;36m'  # Yellow: 40-60%
else
    pct_color="$EMERALD"               # Green: <40%
fi

# Calculate bar width to match statusline content width (72 chars)
bar_width=$(calc_bar_width "$MODE")

case "$MODE" in
    nano)
        bar=$(render_context_bar $bar_width $display_pct)
        printf "${CTX_PRIMARY}◉${RESET} ${bar} ${pct_color}${raw_pct}%%${RESET}\n"
        ;;
    micro)
        bar=$(render_context_bar $bar_width $display_pct)
        printf "${CTX_PRIMARY}◉${RESET} ${bar} ${pct_color}${raw_pct}%%${RESET}\n"
        ;;
    mini)
        bar=$(render_context_bar $bar_width $display_pct)
        printf "${CTX_PRIMARY}◉${RESET} ${CTX_SECONDARY}CONTEXT:${RESET} ${bar} ${pct_color}${raw_pct}%%${RESET}\n"
        ;;
    normal)
        bar=$(render_context_bar $bar_width $display_pct)
        printf "${CTX_PRIMARY}◉${RESET} ${CTX_SECONDARY}CONTEXT:${RESET} ${bar} ${pct_color}${raw_pct}%%${RESET}\n"
        ;;
esac
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE: ACCOUNT USAGE (Claude API limits)
# ═══════════════════════════════════════════════════════════════════════════════
# NOTE: usage_5h, usage_7d, usage_5h_reset, usage_7d_reset populated by PARALLEL PREFETCH

usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

# Only show usage line if we have data (token was valid)
if [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ] || [ -f "$USAGE_CACHE" ]; then
    usage_5h_color=$(get_usage_color "$usage_5h_int")
    usage_7d_color=$(get_usage_color "$usage_7d_int")

    # Batch all 4 python3 calls into one process (saves ~150ms)
    eval "$(python3 -c "
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import sys

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

def time_until(ts):
    dt = parse_ts(ts)
    if not dt: return '—'
    diff = int((dt - datetime.now(timezone.utc)).total_seconds())
    if diff <= 0: return 'now'
    h, m = diff // 3600, (diff % 3600) // 60
    if h >= 24:
        d, rh = h // 24, h % 24
        return f'{d}d{rh}h' if rh > 0 else f'{d}d'
    return f'{h}h{m}m' if h > 0 else f'{m}m'

def clock_time(ts, fmt):
    dt = parse_ts(ts)
    if not dt: return ''
    local_dt = dt.astimezone(ZoneInfo('America/Los_Angeles'))
    if fmt == 'weekly':
        return local_dt.strftime('%a %H:%M')
    return local_dt.strftime('%H:%M')

r5h = '$usage_5h_reset'
r7d = '$usage_7d_reset'
print(f\"reset_5h='{time_until(r5h)}'\")
print(f\"reset_7d='{time_until(r7d)}'\")
print(f\"clock_5h='{clock_time(r5h, \"hourly\")}'\")
print(f\"clock_7d='{clock_time(r7d, \"weekly\")}'\")
" 2>/dev/null)"
    reset_5h="${reset_5h:-—}"
    reset_7d="${reset_7d:-—}"

    # Extra usage display: Max plan overage credits (both monthly_limit and used_credits are in cents)
    extra_display=""
    if [ "$usage_extra_enabled" = "true" ]; then
        extra_limit_dollars=$((${usage_extra_limit:-0} / 100))
        extra_used_dollars=$((${usage_extra_used%%.*} / 100))
        extra_used_int=${extra_used_dollars:-0}
        [ -z "$extra_used_int" ] && extra_used_int=0
        # Format limit nicely
        if [ "$extra_limit_dollars" -ge 1000 ]; then
            extra_limit_fmt="\$$(( extra_limit_dollars / 1000 ))K"
        else
            extra_limit_fmt="\$${extra_limit_dollars}"
        fi
        extra_display="E:\$${extra_used_int}/${extra_limit_fmt}"
    fi

    # API workspace cost display (always show, even if $0)
    ws_cost_cents_int=${usage_ws_cost_cents%%.*}
    [ -z "$ws_cost_cents_int" ] && ws_cost_cents_int=0
    ws_cost_dollars=$((ws_cost_cents_int / 100))
    ws_display="A:\$${ws_cost_dollars}"

    # Reset times: just use clock time directly (no countdown, no parens)
    reset_5h_time="${clock_5h:-${reset_5h}}"
    reset_7d_time="${clock_7d:-${reset_7d}}"

    case "$MODE" in
        nano)
            printf "${USAGE_PRIMARY}▰${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET}${USAGE_RESET}↻${reset_5h_time}${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET}${USAGE_RESET}/wk${RESET}"
            [ -n "$session_cost_str" ] && printf " ${USAGE_VALUE}${session_cost_str}${RESET}"
            printf "\n"
            ;;
        micro)
            printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_RESET}5H:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻${reset_5h_time}${RESET} ${SLATE_600}│${RESET} ${USAGE_RESET}WK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}↻${reset_7d_time}${RESET}"
            [ -n "$session_cost_str" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}S:${session_cost_str}${RESET}"
            printf "\n"
            ;;
        mini)
            printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_LABEL}USE:${RESET} ${USAGE_RESET}5H:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻${SLATE_500}${reset_5h_time}${RESET} ${SLATE_600}│${RESET} ${USAGE_RESET}WK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}↻${SLATE_500}${reset_7d_time}${RESET}"
            [ -n "$extra_display" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}${extra_display}${RESET}"
            [ -n "$ws_display" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}${ws_display}${RESET}"
            [ -n "$session_cost_str" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}S:${session_cost_str}${RESET}"
            printf "\n"
            ;;
        normal)
            printf "${USAGE_PRIMARY}▰${RESET} ${USAGE_LABEL}USE:${RESET} ${USAGE_RESET}5H:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${USAGE_RESET}↻${SLATE_500}${reset_5h_time}${RESET} ${SLATE_600}│${RESET} ${USAGE_RESET}WK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${USAGE_RESET}↻${SLATE_500}${reset_7d_time}${RESET}"
            [ -n "$extra_display" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}${extra_display}${RESET}"
            [ -n "$ws_display" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}${ws_display}${RESET}"
            [ -n "$session_cost_str" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}S:${session_cost_str}${RESET}"
            printf "\n"
            ;;
    esac
    printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 4: PWD & GIT (index-only: branch, age, stash, sync — no file status)
# ═══════════════════════════════════════════════════════════════════════════════

# Calculate age display from prefetched last_commit_epoch
if [ "$is_git_repo" = "true" ] && [ -n "$last_commit_epoch" ]; then
    now_epoch=$(date +%s)
    age_seconds=$((now_epoch - last_commit_epoch))
    age_minutes=$((age_seconds / 60))
    age_hours=$((age_seconds / 3600))
    age_days=$((age_seconds / 86400))

    if   [ "$age_minutes" -lt 1 ];  then age_display="now";         age_color="$GIT_AGE_FRESH"
    elif [ "$age_hours" -lt 1 ];    then age_display="${age_minutes}m"; age_color="$GIT_AGE_FRESH"
    elif [ "$age_hours" -lt 24 ];   then age_display="${age_hours}h";   age_color="$GIT_AGE_RECENT"
    elif [ "$age_days" -lt 7 ];     then age_display="${age_days}d";    age_color="$GIT_AGE_STALE"
    else age_display="${age_days}d"; age_color="$GIT_AGE_OLD"
    fi
fi

case "$MODE" in
    nano)
        printf "${GIT_PRIMARY}◈${RESET} ${GIT_DIR}${dir_name}${RESET}"
        [ "$is_git_repo" = true ] && printf " ${GIT_VALUE}${branch}${RESET}"
        printf "\n"
        ;;
    micro)
        printf "${GIT_PRIMARY}◈${RESET} ${GIT_DIR}${dir_name}${RESET}"
        if [ "$is_git_repo" = true ]; then
            printf " ${GIT_VALUE}${branch}${RESET}"
            [ -n "$age_display" ] && printf " ${age_color}${age_display}${RESET}"
        fi
        printf "\n"
        ;;
    mini)
        printf "${GIT_PRIMARY}◈${RESET} ${GIT_DIR}${dir_name}${RESET}"
        if [ "$is_git_repo" = true ]; then
            printf " ${SLATE_600}│${RESET} ${GIT_VALUE}${branch}${RESET}"
            [ -n "$age_display" ] && printf " ${SLATE_600}│${RESET} ${age_color}${age_display}${RESET}"
        fi
        printf "\n"
        ;;
    normal)
        printf "${GIT_PRIMARY}◈${RESET} ${GIT_PRIMARY}PWD:${RESET} ${GIT_DIR}${dir_name}${RESET}"
        if [ "$is_git_repo" = true ]; then
            printf " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Branch:${RESET} ${GIT_VALUE}${branch}${RESET}"
            [ -n "$age_display" ] && printf " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Age:${RESET} ${age_color}${age_display}${RESET}"
            [ "$stash_count" -gt 0 ] && printf " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Stash:${RESET} ${GIT_STASH}${stash_count}${RESET}"
            if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
                printf " ${SLATE_600}│${RESET} ${GIT_PRIMARY}Sync:${RESET} "
                [ "$ahead" -gt 0 ] && printf "${GIT_CLEAN}↑${ahead}${RESET}"
                [ "$behind" -gt 0 ] && printf "${GIT_STASH}↓${behind}${RESET}"
            fi
        fi
        printf "\n"
        ;;
esac
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 5: MEMORY
# ═══════════════════════════════════════════════════════════════════════════════

case "$MODE" in
    nano)
        printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SESSIONS}⊕${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_RESEARCH}◇${RESET}${SLATE_300}${research_count}${RESET}\n"
        ;;
    micro)
        printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SESSIONS}⊕${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_RESEARCH}◇${RESET}${SLATE_300}${research_count}${RESET}\n"
        ;;
    mini)
        printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_SECONDARY}MEMORY:${RESET} "
        printf "${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_SESSIONS}⊕${RESET}${SLATE_300}${sessions_count}${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_RESEARCH}◇${RESET}${SLATE_300}${research_count}${RESET}\n"
        ;;
    normal)
        printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_SECONDARY}MEMORY:${RESET} "
        printf "${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_WORK}Work${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SIGNALS}Ratings${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_SESSIONS}⊕${RESET}${SLATE_300}${sessions_count}${RESET} ${LEARN_SESSIONS}Sessions${RESET} "
        printf "${SLATE_600}│${RESET} ${LEARN_RESEARCH}◇${RESET}${SLATE_300}${research_count}${RESET} ${LEARN_RESEARCH}Research${RESET}\n"
        ;;
esac
printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 6: LEARNING (with sparklines in normal mode)
# ═══════════════════════════════════════════════════════════════════════════════

LEARNING_CACHE="$PAI_DIR/MEMORY/STATE/learning-cache.sh"
LEARNING_CACHE_TTL=30  # seconds

if [ -f "$RATINGS_FILE" ] && [ -s "$RATINGS_FILE" ]; then
    now=$(date +%s)

    # Check cache validity (by mtime and ratings file mtime)
    cache_valid=false
    if [ -f "$LEARNING_CACHE" ]; then
        cache_mtime=$(get_mtime "$LEARNING_CACHE")
        ratings_mtime=$(get_mtime "$RATINGS_FILE")
        cache_age=$((now - cache_mtime))
        # Cache valid if: cache newer than ratings AND cache age < TTL
        if [ "$cache_mtime" -gt "$ratings_mtime" ] && [ "$cache_age" -lt "$LEARNING_CACHE_TTL" ]; then
            cache_valid=true
        fi
    fi

    if [ "$cache_valid" = true ]; then
        # Use cached values
        source "$LEARNING_CACHE"
    else
        # Compute fresh and cache
        eval "$(grep '^{' "$RATINGS_FILE" | jq -rs --argjson now "$now" '
      # Parse ISO timestamp to epoch (handles timezone offsets)
      def to_epoch:
        (capture("(?<sign>[-+])(?<h>[0-9]{2}):(?<m>[0-9]{2})$") // {sign: "+", h: "00", m: "00"}) as $tz |
        gsub("[-+][0-9]{2}:[0-9]{2}$"; "Z") | gsub("\\.[0-9]+"; "") | fromdateiso8601 |
        . + (if $tz.sign == "-" then 1 else -1 end) * (($tz.h | tonumber) * 3600 + ($tz.m | tonumber) * 60);

      # Filter valid ratings and add epoch
      [.[] | select(.rating != null) | . + {epoch: (.timestamp | to_epoch)}] |

      # Time boundaries
      ($now - 900) as $q15_start | ($now - 3600) as $hour_start | ($now - 86400) as $today_start |
      ($now - 604800) as $week_start | ($now - 2592000) as $month_start |

      # Calculate averages
      (map(select(.epoch >= $q15_start) | .rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $q15_avg |
      (map(select(.epoch >= $hour_start) | .rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $hour_avg |
      (map(select(.epoch >= $today_start) | .rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $today_avg |
      (map(select(.epoch >= $week_start) | .rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $week_avg |
      (map(select(.epoch >= $month_start) | .rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $month_avg |
      (map(.rating) | if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end) as $all_avg |

      # Sparkline: diverging from 5, symmetric heights, color = direction
      def to_bar:
        floor |
        if . >= 10 then "\u001b[38;2;34;197;94m▅\u001b[0m"      # brightest green
        elif . >= 9 then "\u001b[38;2;74;222;128m▅\u001b[0m"    # green
        elif . >= 8 then "\u001b[38;2;134;239;172m▄\u001b[0m"   # light green
        elif . >= 7 then "\u001b[38;2;59;130;246m▃\u001b[0m"    # dark blue
        elif . >= 6 then "\u001b[38;2;96;165;250m▂\u001b[0m"    # blue
        elif . >= 5 then "\u001b[38;2;253;224;71m▁\u001b[0m"    # yellow baseline
        elif . >= 4 then "\u001b[38;2;253;186;116m▂\u001b[0m"   # light orange
        elif . >= 3 then "\u001b[38;2;251;146;60m▃\u001b[0m"    # orange
        elif . >= 2 then "\u001b[38;2;248;113;113m▄\u001b[0m"   # light red
        else "\u001b[38;2;239;68;68m▅\u001b[0m" end;            # red

      def make_sparkline($period_start):
        . as $all | ($now - $period_start) as $dur | ($dur / 58) as $sz |
        [range(58) | . as $i | ($period_start + ($i * $sz)) as $s | ($s + $sz) as $e |
          [$all[] | select(.epoch >= $s and .epoch < $e) | .rating] |
          if length == 0 then "\u001b[38;2;45;50;60m \u001b[0m" else (add / length) | to_bar end
        ] | join("");

      (make_sparkline($q15_start)) as $q15_sparkline |
      (make_sparkline($hour_start)) as $hour_sparkline |
      (make_sparkline($today_start)) as $day_sparkline |
      (make_sparkline($week_start)) as $week_sparkline |
      (make_sparkline($month_start)) as $month_sparkline |

      # Trend calculation helper
      def calc_trend($data):
        if ($data | length) >= 2 then
          (($data | length) / 2 | floor) as $half |
          ($data[-$half:] | add / length) as $recent |
          ($data[:$half] | add / length) as $older |
          ($recent - $older) | if . > 0.5 then "up" elif . < -0.5 then "down" else "stable" end
        else "stable" end;

      # Friendly summary helper (8 words max)
      def friendly_summary($avg; $trend; $period):
        if $avg == "—" then "No data yet for \($period)"
        elif ($avg | tonumber) >= 8 then
          if $trend == "up" then "Excellent and improving" elif $trend == "down" then "Great but cooling slightly" else "Smooth sailing, all good" end
        elif ($avg | tonumber) >= 6 then
          if $trend == "up" then "Good and getting better" elif $trend == "down" then "Okay but trending down" else "Solid, steady performance" end
        elif ($avg | tonumber) >= 4 then
          if $trend == "up" then "Recovering, headed right direction" elif $trend == "down" then "Needs attention, declining" else "Mixed results, room to improve" end
        else
          if $trend == "up" then "Rough but improving now" elif $trend == "down" then "Struggling, needs focus" else "Challenging period, stay sharp" end
        end;

      # Hour and day trends
      ([.[] | select(.epoch >= $hour_start) | .rating]) as $hour_data |
      ([.[] | select(.epoch >= $today_start) | .rating]) as $day_data |
      (calc_trend($hour_data)) as $hour_trend |
      (calc_trend($day_data)) as $day_trend |

      # Generate friendly summaries
      (friendly_summary($hour_avg; $hour_trend; "hour")) as $hour_summary |
      (friendly_summary($today_avg; $day_trend; "day")) as $day_summary |

      # Overall trend
      length as $total |
      (if $total >= 4 then
        (($total / 2) | floor) as $half |
        (.[- $half:] | map(.rating) | add / length) as $recent |
        (.[:$half] | map(.rating) | add / length) as $older |
        ($recent - $older) | if . > 0.3 then "up" elif . < -0.3 then "down" else "stable" end
      else "stable" end) as $trend |

      (last | .rating | tostring) as $latest |
      (last | .source // "explicit") as $latest_source |

      "latest=\($latest | @sh)\nlatest_source=\($latest_source | @sh)\n" +
      "q15_avg=\($q15_avg | @sh)\nhour_avg=\($hour_avg | @sh)\ntoday_avg=\($today_avg | @sh)\n" +
      "week_avg=\($week_avg | @sh)\nmonth_avg=\($month_avg | @sh)\nall_avg=\($all_avg | @sh)\n" +
      "q15_sparkline=\($q15_sparkline | @sh)\nhour_sparkline=\($hour_sparkline | @sh)\nday_sparkline=\($day_sparkline | @sh)\n" +
      "week_sparkline=\($week_sparkline | @sh)\nmonth_sparkline=\($month_sparkline | @sh)\n" +
      "hour_trend=\($hour_trend | @sh)\nday_trend=\($day_trend | @sh)\n" +
      "hour_summary=\($hour_summary | @sh)\nday_summary=\($day_summary | @sh)\n" +
      "trend=\($trend | @sh)\ntotal_count=\($total)"
    ' 2>/dev/null)"

        # Save to cache for next time
        cat > "$LEARNING_CACHE" << CACHE_EOF
latest='$latest'
latest_source='$latest_source'
q15_avg='$q15_avg'
hour_avg='$hour_avg'
today_avg='$today_avg'
week_avg='$week_avg'
month_avg='$month_avg'
all_avg='$all_avg'
q15_sparkline='$q15_sparkline'
hour_sparkline='$hour_sparkline'
day_sparkline='$day_sparkline'
week_sparkline='$week_sparkline'
month_sparkline='$month_sparkline'
hour_trend='$hour_trend'
day_trend='$day_trend'
hour_summary='$hour_summary'
day_summary='$day_summary'
trend='$trend'
total_count=$total_count
CACHE_EOF
    fi  # end cache computation

    if [ "$total_count" -gt 0 ] 2>/dev/null; then
        # Trend icon/color
        case "$trend" in
            up)   trend_icon="↗"; trend_color="$EMERALD" ;;
            down) trend_icon="↘"; trend_color="$ROSE" ;;
            *)    trend_icon="→"; trend_color="$SLATE_400" ;;
        esac

        # Get colors
        [ "$q15_avg" != "—" ] && pulse_base="$q15_avg" || { [ "$hour_avg" != "—" ] && pulse_base="$hour_avg" || { [ "$today_avg" != "—" ] && pulse_base="$today_avg" || pulse_base="$all_avg"; }; }
        PULSE_COLOR=$(get_rating_color "$pulse_base")
        LATEST_COLOR=$(get_rating_color "${latest:-5}")
        Q15_COLOR=$(get_rating_color "${q15_avg:-5}")
        HOUR_COLOR=$(get_rating_color "${hour_avg:-5}")
        TODAY_COLOR=$(get_rating_color "${today_avg:-5}")
        WEEK_COLOR=$(get_rating_color "${week_avg:-5}")
        MONTH_COLOR=$(get_rating_color "${month_avg:-5}")
        ALL_COLOR=$(get_rating_color "$all_avg")

        [ "$latest_source" = "explicit" ] && src_label="EXP" || src_label="IMP"

        case "$MODE" in
            nano)
                printf "${LEARN_LABEL}✿${RESET} ${LATEST_COLOR}${latest}${RESET} ${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET}\n"
                ;;
            micro)
                printf "${LEARN_LABEL}✿${RESET} ${LATEST_COLOR}${latest}${RESET} ${SIGNAL_PERIOD}1h:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} ${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} ${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET}\n"
                ;;
            mini)
                printf "${LEARN_LABEL}✿${RESET} ${LEARN_LABEL}LEARNING:${RESET} ${SLATE_600}│${RESET} "
                printf "${LATEST_COLOR}${latest}${RESET} "
                printf "${SIGNAL_PERIOD}1h:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} "
                printf "${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} "
                printf "${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET}\n"
                ;;
            normal)
                printf "${LEARN_LABEL}✿${RESET} ${LEARN_LABEL}LEARNING:${RESET} ${SLATE_600}│${RESET} "
                printf "${LATEST_COLOR}${latest}${RESET}${SLATE_500}${src_label}${RESET} ${SLATE_600}│${RESET} "
                printf "${SIGNAL_PERIOD}15m:${RESET} ${Q15_COLOR}${q15_avg}${RESET} "
                printf "${SIGNAL_PERIOD}60m:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} "
                printf "${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} "
                printf "${SIGNAL_PERIOD}1w:${RESET} ${WEEK_COLOR}${week_avg}${RESET} "
                printf "${SIGNAL_PERIOD}1mo:${RESET} ${MONTH_COLOR}${month_avg}${RESET}\n"

                # Sparklines (condensed, no blank lines)
                printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "15m:" "$q15_sparkline"
                printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "60m:" "$hour_sparkline"
                printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "1d:" "$day_sparkline"
                printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "1w:" "$week_sparkline"
                printf "   ${SLATE_600}└─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "1mo:" "$month_sparkline"
                ;;
        esac
    else
        printf "${LEARN_LABEL}✿${RESET} ${LEARN_LABEL}LEARNING:${RESET}\n"
        printf "  ${SLATE_500}No ratings yet${RESET}\n"
    fi
else
    printf "${LEARN_LABEL}✿${RESET} ${LEARN_LABEL}LEARNING:${RESET}\n"
    printf "  ${SLATE_500}No ratings yet${RESET}\n"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 7: QUOTE (normal mode only)
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$MODE" = "normal" ]; then
    printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"

    # Quote was prefetched in parallel block — just read the cache
    if [ -f "$QUOTE_CACHE" ]; then
        IFS='|' read -r quote_text quote_author < "$QUOTE_CACHE"
        author_suffix="\" —${quote_author}"
        author_len=${#author_suffix}
        quote_len=${#quote_text}
        max_line=72

        # Full display: ✦ "quote text" —Author
        full_len=$((quote_len + author_len + 4))  # 4 for ✦ "

        if [ "$full_len" -le "$max_line" ]; then
            # Fits on one line
            printf "${QUOTE_PRIMARY}✦${RESET} ${SLATE_400}\"${quote_text}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
        else
            # Need to wrap - target ~10 words (55-60 chars) on first line
            # Line 1 gets: "✦ \"" (4) + text
            line1_text_max=60  # ~10 words worth

            # Only wrap if there's substantial content left for line 2
            min_line2=12

            # Target: put ~60 chars on line 1
            target_line1=$line1_text_max
            [ "$target_line1" -gt "$quote_len" ] && target_line1=$((quote_len - min_line2))

            # Find word boundary near target
            first_part="${quote_text:0:$target_line1}"
            remaining="${quote_text:$target_line1}"

            # If we're not at a space, find the last space in first_part
            if [ -n "$remaining" ] && [ "${remaining:0:1}" != " " ]; then
                # Find last space position
                temp="$first_part"
                last_space_pos=0
                pos=0
                while [ $pos -lt ${#temp} ]; do
                    [ "${temp:$pos:1}" = " " ] && last_space_pos=$pos
                    pos=$((pos + 1))
                done
                if [ $last_space_pos -gt 10 ]; then
                    first_part="${quote_text:0:$last_space_pos}"
                fi
            fi

            second_part="${quote_text:${#first_part}}"
            second_part="${second_part# }"  # trim leading space

            # Only wrap if second part is substantial (more than just a few words)
            if [ ${#second_part} -lt 10 ]; then
                # Too little for line 2, just print on one line (may overflow slightly)
                printf "${QUOTE_PRIMARY}✦${RESET} ${SLATE_400}\"${quote_text}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
            else
                printf "${QUOTE_PRIMARY}✦${RESET} ${SLATE_400}\"${first_part}${RESET}\n"
                printf "  ${SLATE_400}${second_part}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
            fi
        fi
    fi
fi