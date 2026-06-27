#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# PAI Status Line — Responsive display with 4 modes by terminal width:
#   nano (<35), micro (35-54), mini (55-79), normal (80+)
# Normal output: PAI Header → Context → Usage → Git → Memory → Learning → Quote
# ═══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PAI_DIR="${PAI_DIR:-$HOME/.pai}"
CLAUDE_HOME="${HARNESS_HOME:-$HOME/.claude}"
SETTINGS_FILE="${PAI_SETTINGS_PATH:-$PAI_DIR/settings.json}"
if [ ! -f "$SETTINGS_FILE" ]; then
    SETTINGS_FILE="$CLAUDE_HOME/settings.json"
fi
RATINGS_FILE="$PAI_DIR/MEMORY/LEARNING/SIGNALS/ratings.jsonl"
MODEL_CACHE="$PAI_DIR/MEMORY/STATE/model-cache.txt"
QUOTE_CACHE="$PAI_DIR/.quote-cache"
LOCATION_CACHE="$PAI_DIR/MEMORY/STATE/location-cache.json"
WEATHER_CACHE="$PAI_DIR/MEMORY/STATE/weather-cache.json"
USAGE_CACHE="/tmp/pai-usage-${USER:-anon}.json"
LEARNING_CACHE="$PAI_DIR/MEMORY/STATE/learning-cache.sh"

# Settings values read once up front. Re-reading settings.json is measurable on
# a 1-second refresh loop, so we mtime-cache the jq extraction to /tmp.
# Cache file is refreshed only when settings.json is newer than the cache.
_SETTINGS_CACHE="/tmp/pai-statusline-settings-${USER:-anon}.sh"
if [ -f "$_SETTINGS_CACHE" ] && [ "$SETTINGS_FILE" -ot "$_SETTINGS_CACHE" ]; then
    # shellcheck disable=SC1090
    source "$_SETTINGS_CACHE"
else
    jq -r '
      "TEMP_UNIT=" + (.preferences.temperatureUnit // "fahrenheit" | @sh) + "\n" +
      "DA_NAME=" + (.daidentity.name // .daidentity.displayName // .env.DA // "Assistant" | @sh) + "\n" +
      "USER_TZ=" + (.principal.timezone // "UTC" | @sh) + "\n" +
      "PAI_VERSION=" + (.pai.version // "—" | @sh) + "\n" +
      "settings_has_counts=" + (has("counts") | tostring) + "\n" +
      "workflows_count=" + (.counts.workflows // 0 | tostring) + "\n" +
      "hooks_count=" + (.counts.hooks // 0 | tostring) + "\n" +
      "learnings_count=" + (.counts.signals // 0 | tostring) + "\n" +
      "files_count=" + (.counts.files // 0 | tostring) + "\n" +
      "work_count=" + (.counts.work // 0 | tostring) + "\n" +
      "sessions_count=" + (.counts.sessions // 0 | tostring) + "\n" +
      "research_count=" + (.counts.research // 0 | tostring) + "\n" +
      "ratings_count=" + (.counts.ratings // 0 | tostring)
    ' "$SETTINGS_FILE" 2>/dev/null > "$_SETTINGS_CACHE"
    # shellcheck disable=SC1090
    source "$_SETTINGS_CACHE"
fi
TEMP_UNIT="${TEMP_UNIT:-fahrenheit}"
[ "$TEMP_UNIT" != "celsius" ] && TEMP_UNIT="fahrenheit"
DA_NAME="${DA_NAME:-Assistant}"
USER_TZ="${USER_TZ:-UTC}"
PAI_VERSION="${PAI_VERSION:-—}"
# v6.2.0+: LATEST is the single source of truth for the Algorithm version.
# Hardened against Claude Code's hook-spawn context where $HOME or $PAI_DIR
# may not resolve as expected (subprocess spawn with non-default env). Try
# multiple candidate paths in order, keeping the first non-empty result.
ALGO_VERSION=""
for _algo_path in \
    "$PAI_DIR/ALGORITHM/LATEST" \
    "$HOME/.pai/ALGORITHM/LATEST" \
    "/Users/$(id -un 2>/dev/null)/.pai/ALGORITHM/LATEST" \
    "$(eval echo ~"$(id -un 2>/dev/null)")/.pai/ALGORITHM/LATEST"; do
    if [ -n "$_algo_path" ] && [ -f "$_algo_path" ]; then
        ALGO_VERSION="$(cat "$_algo_path" 2>/dev/null | tr -d '[:space:]')"
        [ -n "$ALGO_VERSION" ] && break
    fi
done
# Diagnostic log so we can see WHAT is happening in claude-code spawn context
{
    printf '[%s] ALGO_VERSION=%q HOME=%q PAI_DIR=%q USER=%q paths_tried:' \
        "$(date '+%H:%M:%S')" "$ALGO_VERSION" "${HOME:-UNSET}" "${PAI_DIR:-UNSET}" "${USER:-UNSET}"
    for _algo_path in \
        "$PAI_DIR/ALGORITHM/LATEST" \
        "$HOME/.pai/ALGORITHM/LATEST" \
        "/Users/$(id -un 2>/dev/null)/.pai/ALGORITHM/LATEST"; do
        printf ' %s=%s' "$_algo_path" "$([ -f "$_algo_path" ] && echo OK || echo MISS)"
    done
    printf '\n'
} >> /tmp/pai-statusline-debug.log 2>/dev/null
ALGO_VERSION="${ALGO_VERSION:-—}"
settings_has_counts="${settings_has_counts:-false}"

# Cache TTL in seconds — rationale documented for each
# ┌─────────────────┬────────┬──────────────────────────────────────────────────┐
# │ Cache           │ TTL    │ Rationale                                        │
# ├─────────────────┼────────┼──────────────────────────────────────────────────┤
# │ Location        │ 3600s  │ IP/geo rarely changes; external API              │
# │ Weather         │  900s  │ 15 min: weather changes slowly                   │
# │ Counts          │ n/a    │ Read directly from settings.json (stop hook)     │
# │ Usage           │  900s  │ 15 min: /api/oauth/usage has aggressive 429 limits│
# │ Learning        │   30s  │ Ratings change infrequently mid-session          │
# │ Session name    │ mtime  │ Invalidated when source files change             │
# │ Quote           │   60s  │ 1 min: keyed ZenQuotes is effectively unlimited  │
# │ Model           │ n/a    │ Written once per session, no TTL                 │
# │ Terminal width  │ n/a    │ Written once, read as fallback                   │
# └─────────────────┴────────┴──────────────────────────────────────────────────┘
LOCATION_CACHE_TTL=3600
WEATHER_CACHE_TTL=900
USAGE_CACHE_TTL=900      # 15 min: /api/oauth/usage has aggressive per-token rate limits (~5 req before 429)

# Source .env for API keys
[ -f "${PAI_CONFIG_DIR:-$PAI_DIR}/.env" ] && source "${PAI_CONFIG_DIR:-$PAI_DIR}/.env"

# Cross-platform file mtime (seconds since epoch). Detect stat flavor once;
# probing both variants on every mtime check is expensive on macOS.
if _stat_probe=$(stat -f %m "$0" 2>/dev/null) && [[ "$_stat_probe" =~ ^[0-9]+$ ]]; then
    STAT_FLAVOR="bsd"
else
    STAT_FLAVOR="gnu"
fi
unset _stat_probe

get_mtime() {
    if [ "$STAT_FLAVOR" = "bsd" ]; then
        stat -f %m "$1" 2>/dev/null || echo 0
    else
        stat -c %Y "$1" 2>/dev/null || echo 0
    fi
}

if date --version >/dev/null 2>&1; then
    DATE_FLAVOR="gnu"
else
    DATE_FLAVOR="bsd"
fi

# Parse timestamp to epoch seconds — handles both Unix epoch integers
# (from Claude Code native rate_limits) and ISO 8601 strings (from OAuth API)
parse_iso_epoch() {
    local ts="$1"
    [ -z "$ts" ] && echo 0 && return
    # If it's already a plain integer (epoch seconds), return directly
    if [[ "$ts" =~ ^[0-9]+$ ]]; then
        echo "$ts"
        return
    fi
    local clean="$ts"
    if [[ "$clean" =~ ^(.*)\.[0-9]+(Z|[+-][0-9][0-9]:[0-9][0-9])$ ]]; then
        clean="${BASH_REMATCH[1]}${BASH_REMATCH[2]}"
    elif [[ "$clean" =~ ^(.*)\.[0-9]+$ ]]; then
        clean="${BASH_REMATCH[1]}"
    fi
    if [[ "$clean" =~ ^(.*)([+-][0-9][0-9]):([0-9][0-9])$ ]]; then
        clean="${BASH_REMATCH[1]}${BASH_REMATCH[2]}${BASH_REMATCH[3]}"
    elif [[ "$clean" =~ Z$ ]]; then
        clean="${clean%Z}+0000"
    else
        clean="${clean}+0000"
    fi
    if [ "$DATE_FLAVOR" = "gnu" ]; then
        date -d "$ts" +%s 2>/dev/null || echo 0
    else
        date -jf "%Y-%m-%dT%H:%M:%S%z" "$clean" +%s 2>/dev/null || echo 0
    fi
}

# Format epoch as absolute reset time (e.g., "today@1500", "Thu@0900")
reset_time_str() {
    local epoch="$1"
    [ -z "$epoch" ] || [ "$epoch" -le 0 ] 2>/dev/null && echo "now" && return
    local now_epoch="${NOW_EPOCH:-$(date +%s)}"
    [ "$epoch" -le "$now_epoch" ] 2>/dev/null && echo "now" && return
    local reset_day reset_time today_day reset_dow dow
    if [ "$DATE_FLAVOR" = "gnu" ]; then
        # GNU date
        read -r reset_day reset_time reset_dow <<< "$(TZ="$USER_TZ" date -d "@$epoch" "+%Y-%m-%d %H%M %w")"
        today_day=$(TZ="$USER_TZ" date +%Y-%m-%d)
    else
        # macOS/BSD date
        read -r reset_day reset_time reset_dow <<< "$(TZ="$USER_TZ" date -r "$epoch" "+%Y-%m-%d %H%M %w")"
        today_day=$(TZ="$USER_TZ" date +%Y-%m-%d)
    fi
    if [ "$reset_day" = "$today_day" ]; then
        echo "TODAY@${reset_time}"
    else
        case "$reset_dow" in
            0) dow="SUN" ;; 1) dow="MON" ;; 2) dow="TUE" ;; 3) dow="WED" ;;
            4) dow="THU" ;; 5) dow="FRI" ;; 6) dow="SAT" ;; *) dow="NOW" ;;
        esac
        echo "${dow}@${reset_time}"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PARSE INPUT (must happen before parallel block consumes stdin)
# ─────────────────────────────────────────────────────────────────────────────

input=$(cat)

# Get DA name from settings (single source of truth)
DA_NAME="${DA_NAME:-Assistant}"

# Get user timezone from settings (for reset time display)
USER_TZ="${USER_TZ:-UTC}"

# Get PAI version from settings
PAI_VERSION="${PAI_VERSION:-—}"

# ALGO_VERSION is set above from LATEST (single source of truth, v6.2.0+).
ALGO_VERSION="${ALGO_VERSION:-—}"

# Extract all data from JSON in single jq call
eval "$(jq -r '
  "current_dir=" + (.workspace.current_dir // .cwd // "." | @sh) + "\n" +
  "session_id=" + (.session_id // "" | @sh) + "\n" +
  "model_name=" + (.model.display_name // "unknown" | @sh) + "\n" +
  "cc_version_json=" + (.version // "" | @sh) + "\n" +
  "context_max=" + (.context_window.context_window_size // 200000 | tostring) + "\n" +
  "context_pct=" + (.context_window.used_percentage // 0 | tostring) + "\n" +
  "total_input=" + (.context_window.total_input_tokens // 0 | tostring) + "\n" +
  "has_native_rate_limits=" + ((.rate_limits != null) | tostring) + "\n" +
  "native_usage_5h=" + (.rate_limits.five_hour.used_percentage // .rate_limits.five_hour.utilization // 0 | tostring) + "\n" +
  "native_usage_5h_reset=" + (.rate_limits.five_hour.resets_at // "" | @sh) + "\n" +
  "native_usage_7d=" + (.rate_limits.seven_day.used_percentage // .rate_limits.seven_day.utilization // 0 | tostring) + "\n" +
  "native_usage_7d_reset=" + (.rate_limits.seven_day.resets_at // "" | @sh) + "\n" +
  "native_usage_opus=" + (if .rate_limits.seven_day_opus then (.rate_limits.seven_day_opus.used_percentage // .rate_limits.seven_day_opus.utilization // 0 | tostring) else "null" end) + "\n" +
  "native_usage_sonnet=" + (if .rate_limits.seven_day_sonnet then (.rate_limits.seven_day_sonnet.used_percentage // .rate_limits.seven_day_sonnet.utilization // 0 | tostring) else "null" end) + "\n" +
  "native_usage_extra_enabled=" + (.rate_limits.extra_usage.is_enabled // false | tostring) + "\n" +
  "native_usage_extra_limit=" + (.rate_limits.extra_usage.monthly_limit // 0 | tostring) + "\n" +
  "native_usage_extra_used=" + (.rate_limits.extra_usage.used_credits // 0 | tostring)
' 2>/dev/null <<< "$input")"

# Ensure defaults for critical numeric values
context_pct=${context_pct:-0}
context_max=${context_max:-200000}
total_input=${total_input:-0}
has_native_rate_limits="${has_native_rate_limits:-false}"

# Claude Code reserves ~16.5% of context for compaction overhead.
# Usable context = 83.5% of window. Scale displayed % so it matches reality.
# Without this: 83% raw looks fine but means ~1% usable remaining.
COMPACTION_USABLE=835  # 83.5% × 10 for integer math precision

# ── Startup context estimate (fresh calculation, no cross-session caching) ─
# Before the first API call, Claude Code provides no token data. We estimate
# from measured file sizes + per-item token costs.
# Token ratio: ~3.5 chars/token for text content (bytes * 10 / 35).
# ───────────────────────────────────────────────────────────────────────────
startup_estimate=false
if [ "$context_pct" = "0" ] && [ "$total_input" -eq 0 ] 2>/dev/null; then
    startup_estimate=true

    # Cache estimate per session — the inputs (CLAUDE.md, system prompt,
    # skill count, etc.) don't change mid-session, so recomputing on every
    # 1-second tick while total_input=0 is pure waste. ~8-12 subprocess
    # spawns (wc, jq, fd, git) eliminated per tick once cached.
    _STARTUP_EST_CACHE="/tmp/pai-startup-estimate-${session_id:-nosess}.sh"
    if [ -f "$_STARTUP_EST_CACHE" ]; then
        # shellcheck disable=SC1090
        source "$_STARTUP_EST_CACHE"
    else
        # Claude Code system prompt (~5k tokens — includes base instructions, mode rules,
        # permission model, output format, etc.)
        _est=5000

        # Claude Code tool definitions (~12k tokens — Agent tool alone is ~4k with all
        # subagent descriptions; Bash, Read, Edit, Write, Glob, Grep, Skill, ToolSearch
        # each 200-500 tokens; deferred tool names list ~500 tokens)
        _est=$((_est + 12000))

        # CLAUDE.md (loaded natively by Claude Code, ~3.5 chars/token)
        [ -f "$CLAUDE_HOME/CLAUDE.md" ] && _est=$((_est + $(wc -c < "$CLAUDE_HOME/CLAUDE.md") * 10 / 35))

        # System prompt (loaded via --append-system-prompt-file, ~3.5 chars/token)
        [ -f "$PAI_DIR/PAI_SYSTEM_PROMPT.md" ] && _est=$((_est + $(wc -c < "$PAI_DIR/PAI_SYSTEM_PROMPT.md") * 10 / 35))

        # loadAtStartup files (injected by LoadContext.hook.ts as system-reminders)
        while IFS= read -r _f; do
            [ -n "$_f" ] && [ -f "$PAI_DIR/$_f" ] && _est=$((_est + $(wc -c < "$PAI_DIR/$_f") * 10 / 35))
        done < <(jq -r '.loadAtStartup.files[]? // empty' "$SETTINGS_FILE" 2>/dev/null)

        # Project memory files (CC native memory at ~/.claude/projects/*/memory/)
        for _f in "$HOME"/.claude/projects/*/memory/MEMORY.md; do
            [ -f "$_f" ] && _est=$((_est + $(wc -c < "$_f") * 10 / 35))
        done

        # Skill trigger descriptions (~150 tokens each — name, trigger phrases, examples)
        _sk=$(jq -r '.counts.skills // 22' "$SETTINGS_FILE" 2>/dev/null || echo 22)
        _est=$((_est + _sk * 150))

        # Custom agent descriptions (~200 tokens each — includes both user and plugin agents)
        # Use bash globs — ~10-20ms faster than `fd` forks.
        shopt -s nullglob 2>/dev/null
        _agent_user=("$PAI_DIR"/agents/*.md)
        _agent_plugin=("$PAI_DIR"/.plugins/*/agents/*.md)
        _ag=${#_agent_user[@]}
        _pag=${#_agent_plugin[@]}
        shopt -u nullglob 2>/dev/null
        _est=$((_est + (_ag + _pag) * 200))

        # Git status block (injected by Claude Code — branch, status, recent commits)
        _git_bytes=$(timeout 1 git -C "$current_dir" status --porcelain 2>/dev/null | wc -c | tr -d ' ')
        _est=$((_est + ${_git_bytes:-0} * 10 / 35 + 500))  # +500 for commit log, branch info

        # Dynamic context from LoadContext.hook.ts (relationship notes, learning signals,
        # active work tracker, performance data, failure patterns, wisdom frames)
        _est=$((_est + 3500))

        # Initial user message + startup hook system-reminders (currentDate, fast_mode_info,
        # gitStatus header, settings-based reminders)
        _est=$((_est + 3000))

        context_pct=$((_est * 100 / context_max))
        startup_tokens=$_est

        # Persist for this session's remaining pre-first-API ticks
        {
            echo "_est=$_est"
            echo "context_pct=$context_pct"
            echo "startup_tokens=$startup_tokens"
        } > "$_STARTUP_EST_CACHE" 2>/dev/null
    fi
fi

# Get Claude Code version — prefer JSON input, then mtime-cached value,
# fall back to forking `claude --version` (40-80ms, so cached for 24h).
_CC_VERSION_CACHE="$PAI_DIR/MEMORY/STATE/cc-version-cache.txt"
if [ -n "$cc_version_json" ] && [ "$cc_version_json" != "unknown" ]; then
    cc_version="$cc_version_json"
elif [ -f "$_CC_VERSION_CACHE" ] && [ -z "$(find "$_CC_VERSION_CACHE" -mtime +1 2>/dev/null)" ]; then
    cc_version=$(cat "$_CC_VERSION_CACHE" 2>/dev/null)
fi
if [ -z "$cc_version" ] || [ "$cc_version" = "unknown" ]; then
    cc_version=$(claude --version 2>/dev/null | head -1 | awk '{print $1}')
    cc_version="${cc_version:-unknown}"
    [ "$cc_version" != "unknown" ] && echo "$cc_version" > "$_CC_VERSION_CACHE" 2>/dev/null
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
    project_slug="${current_dir//[\/.]/-}"
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
# TERMINAL WIDTH DETECTION
# ─────────────────────────────────────────────────────────────────────────────
# Hooks don't inherit terminal context. Try multiple methods. Width is detected
# before prefetch so narrow modes can skip work they never render.

_width_cache="/tmp/pai-term-width-${KITTY_WINDOW_ID:-default}"

detect_terminal_width() {
    local width=""

    # Tier 1: Kitty IPC (most accurate for Kitty panes)
    if [ -n "$KITTY_WINDOW_ID" ] && command -v kitten >/dev/null 2>&1; then
        width=$(kitten @ ls 2>/dev/null | jq -r --argjson wid "$KITTY_WINDOW_ID" \
            '.[].tabs[].windows[] | select(.id == $wid) | .columns' 2>/dev/null)
    fi

    # Tier 2: Direct TTY query
    [ -z "$width" ] || [ "$width" = "0" ] || [ "$width" = "null" ] && \
        width=$({ stty size </dev/tty; } 2>/dev/null | awk '{print $2}')

    # Tier 3: tput fallback
    [ -z "$width" ] || [ "$width" = "0" ] && width=$(tput cols 2>/dev/null)

    # If we got a real width, cache it for subprocess re-renders
    if [ -n "$width" ] && [ "$width" != "0" ] && [ "$width" -gt 0 ] 2>/dev/null; then
        echo "$width" > "$_width_cache" 2>/dev/null
        echo "$width"
        return
    fi

    # Tier 4: Read cached width from previous successful detection
    if [ -f "$_width_cache" ]; then
        local cached
        cached=$(cat "$_width_cache" 2>/dev/null)
        if [ "$cached" -gt 0 ] 2>/dev/null; then
            echo "$cached"
            return
        fi
    fi

    # Tier 5: Environment variable / default
    # Treat $COLUMNS=0 (and any non-positive value) as unset. Some hook
    # spawn contexts (Claude Code's statusline subprocess on a headless
    # server, no TTY, no Kitty IPC, no /dev/tty) export COLUMNS=0, which
    # would otherwise pass `${COLUMNS:-80}` straight through and force
    # MODE=nano — silently dropping CC/PAI/ALG/SK/WF/HK from the render.
    if [ -n "${COLUMNS:-}" ] && [ "$COLUMNS" -gt 0 ] 2>/dev/null; then
        echo "$COLUMNS"
    else
        echo "80"
    fi
}

term_width=$(detect_terminal_width)

# Final guard: if everything fell through and we still have an invalid
# width, force normal mode rather than degrading to nano. ALG/PAI/CC
# version visibility matters more than format compactness here.
if [ -z "$term_width" ] || [ "$term_width" -le 0 ] 2>/dev/null; then
    term_width=80
fi

if [ "$term_width" -lt 35 ]; then
    MODE="nano"
elif [ "$term_width" -lt 55 ]; then
    MODE="micro"
elif [ "$term_width" -lt 80 ]; then
    MODE="mini"
else
    MODE="normal"
fi

# Content width: cap at 72 so wide terminals don't stretch, but narrow ones fit
content_width=$term_width
[ "$content_width" -gt 72 ] && content_width=72
[ "$content_width" -lt 10 ] && content_width=10

_repeat_chars() {
    local n="$1" ch="$2" s
    printf -v s '%*s' "$n" ''
    printf '%s' "${s// /$ch}"
}

SEP_SOLID=$(_repeat_chars "$content_width" "─")
SEP_DASHED=$(_repeat_chars "$content_width" "┄")
SEP_DOT=$(_repeat_chars "$content_width" "·")

# Separator line helper — generates ─ repeated to content_width
sep() {
    printf "${SLATE_600}%s${RESET}\n" "$SEP_SOLID"
}

# ─────────────────────────────────────────────────────────────────────────────
# PARALLEL PREFETCH - Launch expensive operations needed by current width mode
# ─────────────────────────────────────────────────────────────────────────────
# Blocks write to $_parallel_tmp/{name}.sh and are skipped when the active
# width mode never renders that data.
#   git.sh      — Branch, stash, sync, last commit (all modes)
#   location.sh — City/state from ip-api.com (mini/normal)
#   weather.sh  — Temperature/conditions from open-meteo.com (mini/normal)
#   counts.sh   — File/skill/hook counts from settings.json + live skill count
#   usage.sh    — Anthropic API rate limits 5H/WK (normal)
#   quote       — ZenQuotes API cache refresh (normal)
# Results are sourced after `wait` at the end of the block.

_parallel_tmp="/tmp/pai-parallel-$$"
mkdir -p "$_parallel_tmp"
NOW_EPOCH=$(date +%s)

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
            read -r ahead behind <<< "$sync_info"
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

if [ "$MODE" = "mini" ] || [ "$MODE" = "normal" ]; then
{
    # 2. Location fetch (with caching)
    cache_age=999999
    [ -f "$LOCATION_CACHE" ] && cache_age=$((NOW_EPOCH - $(get_mtime "$LOCATION_CACHE")))

    if [ "$cache_age" -gt "$LOCATION_CACHE_TTL" ]; then
        loc_data=$(curl -s --max-time 2 "http://ip-api.com/json/?fields=city,region,regionName,country,countryCode,lat,lon" 2>/dev/null)
        if [ -n "$loc_data" ] && echo "$loc_data" | jq -e '.city' >/dev/null 2>&1; then
            echo "$loc_data" > "$LOCATION_CACHE"
        fi
    fi

    # Convert ISO 3166-1 alpha-2 country code → flag emoji (regional indicator pair).
    # Bash 3.2 has no \U escape, so build the 4-byte UTF-8 sequence manually:
    # U+1F1E6 ('A') = F0 9F 87 A6, +1 per letter through U+1F1FF ('Z').
    cc_to_flag() {
        local code="${1:-}"
        [ "${#code}" -ne 2 ] && { printf '🌐'; return; }
        local c1 c2 b1 b2
        c1=$(printf '%d' "'${code:0:1}")
        c2=$(printf '%d' "'${code:1:1}")
        [ "$c1" -lt 65 ] || [ "$c1" -gt 90 ] || [ "$c2" -lt 65 ] || [ "$c2" -gt 90 ] && { printf '🌐'; return; }
        b1=$(printf '%02x' $((0xA6 + c1 - 65)))
        b2=$(printf '%02x' $((0xA6 + c2 - 65)))
        printf "\xF0\x9F\x87\x${b1}\xF0\x9F\x87\x${b2}"
    }

    if [ -f "$LOCATION_CACHE" ]; then
        eval "$(jq -r '"_lc_city=" + (.city // "" | @sh) + "\n_lc_region=" + (.region // .regionName // "" | @sh) + "\n_lc_cc=" + (.countryCode // "" | @sh)' "$LOCATION_CACHE" 2>/dev/null)"
        _lc_flag=$(cc_to_flag "$_lc_cc")
        # Uppercase city and state for header display.
        _lc_city_upper=$(printf '%s' "$_lc_city" | tr '[:lower:]' '[:upper:]')
        _lc_region_upper=$(printf '%s' "$_lc_region" | tr '[:lower:]' '[:upper:]')
        {
            printf "location_city=%q\n" "$_lc_city_upper"
            printf "location_state=%q\n" "$_lc_region_upper"
            printf "location_flag=%q\n" "$_lc_flag"
        } > "$_parallel_tmp/location.sh"
    else
        echo -e "location_city='UNKNOWN'\nlocation_state=''\nlocation_flag='🌐'" > "$_parallel_tmp/location.sh"
    fi
} &
fi

if [ "$MODE" = "mini" ] || [ "$MODE" = "normal" ]; then
{
    # 3. Weather fetch (with caching)
    cache_age=999999
    [ -f "$WEATHER_CACHE" ] && cache_age=$((NOW_EPOCH - $(get_mtime "$WEATHER_CACHE")))

    if [ "$cache_age" -gt "$WEATHER_CACHE_TTL" ]; then
        lat="" lon=""
        if [ -f "$LOCATION_CACHE" ]; then
            eval "$(jq -r '"lat=\(.lat // empty)\nlon=\(.lon // empty)"' "$LOCATION_CACHE" 2>/dev/null)"
        fi
        lat="${lat:-37.7749}"
        lon="${lon:-122.4194}"

        weather_json=$(curl -s --max-time 3 "https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${TEMP_UNIT}" 2>/dev/null)
        if [ -n "$weather_json" ] && echo "$weather_json" | jq -e '.current' >/dev/null 2>&1; then
            eval "$(echo "$weather_json" | jq -r '.current | "temp=\(.temperature_2m)\ncode=\(.weather_code)\nis_day=\(.is_day)"' 2>/dev/null)"
            # Map open-meteo weather_code → single emoji glyph (clear/cloudy/fog/rain/snow/storm)
            # Day vs. night uses the is_day flag to pick sun ☀ vs. moon 🌙 for clear conditions.
            case "$code" in
                0)              [ "${is_day:-1}" = "0" ] && icon="🌙" || icon="☀️" ;;
                1)              [ "${is_day:-1}" = "0" ] && icon="🌙" || icon="🌤️" ;;
                2)              icon="⛅" ;;
                3)              icon="☁️" ;;
                45|48)          icon="🌫️" ;;
                51|53|55|56|57) icon="🌦️" ;;
                61|63|65|66|67) icon="🌧️" ;;
                80|81|82)       icon="🌧️" ;;
                71|73|75|77|85|86) icon="🌨️" ;;
                95|96|99)       icon="⛈️" ;;
                *)              icon="🌡️" ;;
            esac
            temp_int=$(printf '%.0f' "$temp")
            if [ "$TEMP_UNIT" = "celsius" ]; then
                echo "${icon} ${temp_int}°C" > "$WEATHER_CACHE"
            else
                echo "${icon} ${temp_int}°F" > "$WEATHER_CACHE"
            fi
        fi
    fi

    if [ -f "$WEATHER_CACHE" ]; then
        echo "weather_str='$(cat "$WEATHER_CACHE" 2>/dev/null)'" > "$_parallel_tmp/weather.sh"
    else
        echo "weather_str='—'" > "$_parallel_tmp/weather.sh"
    fi
} &
fi

if [ "$MODE" != "nano" ]; then
{
    # 4. Counts — skills always live from filesystem; rest from settings.json cache
    # Skills count is dynamic (dirs with SKILL.md) — never stale after skill changes
    # Private skills start with _ prefix, public skills don't
    shopt -s nullglob
    _skill_files=("$CLAUDE_HOME"/skills/*/SKILL.md)
    _private_skill_files=("$CLAUDE_HOME"/skills/_*/SKILL.md)
    _live_skills=${#_skill_files[@]}
    _private_skills=${#_private_skill_files[@]}
    shopt -u nullglob
    _public_skills=$(( _live_skills - _private_skills ))
    if [ "$settings_has_counts" = "true" ]; then
        cat > "$_parallel_tmp/counts.sh" << COUNTSEOF
workflows_count=${workflows_count:-0}
hooks_count=${hooks_count:-0}
learnings_count=${learnings_count:-0}
files_count=${files_count:-0}
work_count=${work_count:-0}
sessions_count=${sessions_count:-0}
research_count=${research_count:-0}
ratings_count=${ratings_count:-0}
COUNTSEOF
        echo "skills_count=${_live_skills}" >> "$_parallel_tmp/counts.sh"
        echo "private_skills=${_private_skills}" >> "$_parallel_tmp/counts.sh"
        echo "public_skills=${_public_skills}" >> "$_parallel_tmp/counts.sh"
    else
        cat > "$_parallel_tmp/counts.sh" << COUNTSEOF
skills_count=${_live_skills}
private_skills=${_private_skills}
public_skills=${_public_skills}
workflows_count=0
hooks_count=0
learnings_count=0
files_count=0
work_count=0
sessions_count=0
research_count=0
ratings_count=0
COUNTSEOF
    fi
} &
fi

if [ "$MODE" = "normal" ]; then
{
    # 5. Usage data — prefer native rate_limits from statusline JSON input (v2.1.80+),
    #    fall back to OAuth API fetch. Native field eliminates 429 risk entirely.
    #    TTL: 900s (15 min). On failure, use cache if <30min old, else show "—".
    _usage_now=$NOW_EPOCH

    if [ "$has_native_rate_limits" = "true" ]; then
        # Native rate_limits available — use directly, skip OAuth API entirely
        cat > "$_parallel_tmp/usage.sh" << USAGEEOF
usage_5h=${native_usage_5h:-0}
usage_5h_reset=${native_usage_5h_reset:-''}
usage_7d=${native_usage_7d:-0}
usage_7d_reset=${native_usage_7d_reset:-''}
usage_opus=${native_usage_opus:-null}
usage_sonnet=${native_usage_sonnet:-null}
usage_extra_enabled=${native_usage_extra_enabled:-false}
usage_extra_limit=${native_usage_extra_limit:-0}
usage_extra_used=${native_usage_extra_used:-0}
usage_ws_cost_cents=0
USAGEEOF
    else
        # Fallback: fetch from OAuth API (pre-v2.1.80 or non-Claude.ai auth)
        cache_age=999999
        [ -f "$USAGE_CACHE" ] && cache_age=$((_usage_now - $(get_mtime "$USAGE_CACHE")))

        if [ "$cache_age" -gt "$USAGE_CACHE_TTL" ]; then
            # Extract OAuth token — macOS Keychain or Linux credentials file
            if [ "$(uname -s)" = "Darwin" ]; then
                cred_json=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
            else
                cred_json=$(cat "${HOME}/.claude/.credentials.json" 2>/dev/null)
            fi
            token=$(echo "$cred_json" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)

            if [ -n "$token" ]; then
                usage_json=$(curl -s --max-time 3 \
                    -H "Authorization: Bearer $token" \
                    -H "Content-Type: application/json" \
                    -H "anthropic-beta: oauth-2025-04-20" \
                    "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)

                if [ -n "$usage_json" ] && echo "$usage_json" | jq -e '.five_hour' >/dev/null 2>&1; then
                    echo "$usage_json" | jq '.' > "$USAGE_CACHE" 2>/dev/null
                fi
            fi
        fi

        # Read cache if it exists and is <30min old. Otherwise no data.
        _usage_age=999999
        [ -f "$USAGE_CACHE" ] && _usage_age=$((_usage_now - $(get_mtime "$USAGE_CACHE")))

        if [ -f "$USAGE_CACHE" ] && [ "$_usage_age" -lt 1800 ]; then
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
                "usage_ws_cost_cents=0"
            ' "$USAGE_CACHE" > "$_parallel_tmp/usage.sh" 2>/dev/null
        else
            rm -f "$USAGE_CACHE" 2>/dev/null
            echo -e "usage_5h=0\nusage_7d=0\nusage_extra_enabled=false\nusage_ws_cost_cents=0\nusage_no_data=true" > "$_parallel_tmp/usage.sh"
        fi
    fi
} &
fi

if [ "$MODE" = "normal" ]; then
{
    # 6. Quote prefetch (was serial at the end — now parallel)
    # Refresh every 60s. Keyed ZenQuotes is effectively unlimited; keyless endpoint
    # falls back if env var missing (5 req / 30s — will hit limits at 60s cadence).
    # Rate-limit / system messages come back with a == "zenquotes.io" — filter those
    # so a transient 429 never clobbers a real cached quote.
    quote_age=$((NOW_EPOCH - $(get_mtime "$QUOTE_CACHE")))
    if [ "$quote_age" -gt 60 ] || [ ! -f "$QUOTE_CACHE" ]; then
        if [ -n "${ZENQUOTES_API_KEY:-}" ]; then
            _quote_url="https://zenquotes.io/api/random/${ZENQUOTES_API_KEY}"
        else
            _quote_url="https://zenquotes.io/api/random"
        fi
        new_quote=$(curl -s --max-time 2 "$_quote_url" 2>/dev/null | \
            jq -r '.[0] | select(.q | length < 80) | select(.a != "zenquotes.io") | .q + "|" + .a' 2>/dev/null)
        [ -n "$new_quote" ] && [ "$new_quote" != "null" ] && echo "$new_quote" > "$QUOTE_CACHE"
    fi
} &
fi

# --- PARALLEL BLOCK END - wait for all to complete ---
wait

# Source all parallel results
[ -f "$_parallel_tmp/git.sh" ] && source "$_parallel_tmp/git.sh"
[ -f "$_parallel_tmp/location.sh" ] && source "$_parallel_tmp/location.sh"
[ -f "$_parallel_tmp/weather.sh" ] && source "$_parallel_tmp/weather.sh"
[ -f "$_parallel_tmp/counts.sh" ] && source "$_parallel_tmp/counts.sh"
[ -f "$_parallel_tmp/usage.sh" ] && source "$_parallel_tmp/usage.sh"
rm -rf "$_parallel_tmp" 2>/dev/null

# Supplement missing reset timestamps from OAuth cache when native rate_limits
# omits resets_at (happens in some Claude Code sessions)
if [ "$MODE" = "normal" ] && { [ -z "${usage_5h_reset:-}" ] || [ -z "${usage_7d_reset:-}" ]; } && [ -f "$USAGE_CACHE" ]; then
    eval "$(jq -r '
        "_cache_usage_5h_reset=" + (.five_hour.resets_at // "" | @sh) + "\n" +
        "_cache_usage_7d_reset=" + (.seven_day.resets_at // "" | @sh)
    ' "$USAGE_CACHE" 2>/dev/null)"
    [ -z "${usage_5h_reset:-}" ] && usage_5h_reset="${_cache_usage_5h_reset:-}"
    [ -z "${usage_7d_reset:-}" ] && usage_7d_reset="${_cache_usage_7d_reset:-}"
fi

# NOTE: DA_NAME, PAI_VERSION, input JSON, cc_version, model_name, dir_name
# are all already parsed above (lines 59-113). No duplicate parsing needed.

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

# Wielding (cyan/teal)
WIELD_ACCENT='\033[38;2;103;232;249m'
WIELD_WORKFLOWS='\033[38;2;94;234;212m'
WIELD_HOOKS='\033[38;2;6;182;212m'

# Git (sky/blue)
GIT_PRIMARY='\033[38;2;56;189;248m'
GIT_VALUE='\033[38;2;186;230;253m'
GIT_DIR='\033[38;2;147;197;253m'
GIT_CLEAN='\033[38;2;125;211;252m'
GIT_STASH='\033[38;2;165;180;252m'
GIT_AGE_FRESH='\033[38;2;125;211;252m'
GIT_AGE_RECENT='\033[38;2;96;165;250m'
GIT_AGE_STALE='\033[38;2;59;130;246m'
GIT_AGE_OLD='\033[38;2;99;102;241m'

# Memory/Learning (purple)
LEARN_PRIMARY='\033[38;2;167;139;250m'
LEARN_SECONDARY='\033[38;2;196;181;253m'
LEARN_WORK='\033[38;2;192;132;252m'
LEARN_SIGNALS='\033[38;2;139;92;246m'
LEARN_RESEARCH='\033[38;2;129;140;248m'
LEARN_SESSIONS='\033[38;2;99;102;241m'
SIGNAL_PERIOD='\033[38;2;148;163;184m'
LEARN_LABEL='\033[38;2;21;128;61m'

# Context (indigo)
CTX_PRIMARY='\033[38;2;129;140;248m'
CTX_SECONDARY='\033[38;2;165;180;252m'
CTX_BUCKET_EMPTY='\033[38;2;75;82;95m'

# Usage (subtle brown/orange)
USAGE_PRIMARY='\033[38;2;194;139;62m'
USAGE_LABEL='\033[38;2;168;113;50m'
USAGE_RESET='\033[38;2;148;163;184m'
USAGE_EXTRA='\033[38;2;140;90;60m'
USAGE_STALE='\033[38;2;120;113;108m'   # Warm gray for stale labels (not values)

# Quote (gold)
QUOTE_PRIMARY='\033[38;2;252;211;77m'
QUOTE_AUTHOR='\033[38;2;180;140;60m'

# PAI Branding
PAI_P='\033[38;2;37;99;235m'          # Blue-600 (was navy 30;58;138 — too dark on navy bg)
PAI_A='\033[38;2;59;130;246m'         # Medium blue
PAI_I='\033[38;2;147;197;253m'        # Light blue
PAI_LOGO=$'\xef\x91\xa9'  # Pulse waveform (FA heartbeat) — U+F469 in Hack Nerd Font
PAI_LABEL='\033[38;2;100;116;139m'    # Slate for "status line"
PAI_CITY='\033[38;2;37;99;235m'       # Blue-600 — darker, saturated city blue
PAI_STATE='\033[38;2;125;211;252m'    # Sky-300 — lighter blue, paired with city
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

# Render context bar - gradient progress bar using (potentially scaled) percentage
render_context_bar() {
    local width=$1 pct=$2
    local output="" last_color="" color=""

    # Use percentage (may be scaled to compaction threshold)
    local filled=$((pct * width / 100))
    [ "$filled" -lt 0 ] && filled=0

    # Use spaced buckets only for small widths to improve readability
    local use_spacing=false
    [ "$width" -le 20 ] && use_spacing=true

    # Two threshold markers split the bar into three equal thirds.
    # Variable names kept for diff readability.
    local pos_20=$((width / 3))          # first warning  — orange marker at 1/3
    local pos_60=$((2 * width / 3))      # final warning  — dark-red marker at 2/3

    # Three discrete bands keyed to the two markers — no gradient.
    # Filled buckets read off the color of the next marker the user is heading toward:
    #   green   before pos_20  (orange marker)   — safe, no action needed
    #   orange  pos_20..pos_60 (dark-red marker) — compact now
    #   d.red   after pos_60                     — context degraded, compact immediately
    for ((i=1; i<=width; i++)); do
        # Marker positions render their threshold glyph regardless of fill.
        if [ "$i" -eq "$pos_20" ]; then
            output="${output}\033[38;2;251;146;60m⛁${RESET}"    # orange marker
        elif [ "$i" -eq "$pos_60" ]; then
            output="${output}\033[38;2;180;40;40m⛁${RESET}"     # dark-red marker
        elif [ "$i" -le "$filled" ]; then
            if [ "$i" -lt "$pos_20" ]; then
                color='\033[38;2;74;222;128m'    # green band
            elif [ "$i" -lt "$pos_60" ]; then
                color='\033[38;2;251;146;60m'    # orange band
            else
                color='\033[38;2;180;40;40m'     # dark-red band
            fi
            last_color="$color"
            output="${output}${color}⛁${RESET}"
        else
            output="${output}${CTX_BUCKET_EMPTY}⛁${RESET}"
        fi
        [ "$use_spacing" = true ] && output="${output} "
    done

    output="${output% }"
    printf '%s\n' "$output"
    LAST_BUCKET_COLOR="${last_color:-$EMERALD}"
}

# Calculate optimal bar width to match statusline content width
# Returns buckets that fill the same visual width as separator lines
calc_bar_width() {
    local mode=$1
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
            prefix_len=11   # "◉ CONTEXT: " (◉=1 + space + CONTEXT: + space)
            suffix_len=5    # " XXX%" (space + up to 3 digits + %)
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

# ═══════════════════════════════════════════════════════════════════════════════
# COMPACT CARD OUTPUT (nano/micro/mini modes)
# ═══════════════════════════════════════════════════════════════════════════════
# For narrow panes: all essential metrics in a dense, bordered card.
# No click-to-expand — everything visible in default view.

if [ "$MODE" != "normal" ]; then
    # ── Compute values needed for card ──

    # Context percentage — raw, matches /context command
    _raw_pct="${context_pct%%.*}"
    [ -z "$_raw_pct" ] && _raw_pct=0
    _pct_color=$(get_usage_color "$_raw_pct")

    # Git age
    _age=""
    if [ "$is_git_repo" = "true" ] && [ -n "$last_commit_epoch" ]; then
        _now=$NOW_EPOCH
        _age_s=$((_now - last_commit_epoch))
        _age_m=$((_age_s / 60)); _age_h=$((_age_s / 3600)); _age_d=$((_age_s / 86400))
        if   [ "$_age_m" -lt 1 ];  then _age="now"
        elif [ "$_age_h" -lt 1 ];  then _age="${_age_m}m"
        elif [ "$_age_h" -lt 24 ]; then _age="${_age_h}h"
        else _age="${_age_d}d"
        fi
    fi

    # Learning: load from cache
    _learn_score="—"; _learn_trend="→"
    if [ -f "$LEARNING_CACHE" ]; then
        source "$LEARNING_CACHE"
        if [ -n "$today_avg" ] && [ "$today_avg" != "—" ]; then
            _learn_score="$today_avg"
        elif [ -n "$week_avg" ] && [ "$week_avg" != "—" ]; then
            _learn_score="$week_avg"
        fi
        case "$trend" in
            up)   _learn_trend="↗" ;;
            down) _learn_trend="↘" ;;
            *)    _learn_trend="→" ;;
        esac
    fi
    _learn_color=$(get_rating_color "$_learn_score")

    # ── Compact modes: same sections as normal, horizontally compressed ──
    case "$MODE" in
        nano)
            # Line 1: branding + context
            printf "${PAI_A}${PAI_LOGO}${RESET}  ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${CTX_PRIMARY}◉${RESET}${_pct_color}${_raw_pct}%%${RESET}
"
            # Line 2: git + learning
            [ "$is_git_repo" = "true" ] && printf "${GIT_PRIMARY}◈${RESET}${GIT_VALUE}${branch}${RESET} "
            printf "${LEARN_LABEL}✿${RESET}${_learn_color}${_learn_score}${_learn_trend}${RESET}
"
            ;;
        micro)
            # Line 1: branding + context
            printf "${PAI_A}${PAI_LOGO}${RESET}  ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${CTX_PRIMARY}◉${RESET}${_pct_color}${_raw_pct}%%${RESET}
"
            # Line 2: git + learning
            printf "${GIT_PRIMARY}◈${RESET}${GIT_VALUE}${branch:-—}${RESET}"
            [ -n "$_age" ] && printf " ${GIT_AGE_RECENT}${_age}${RESET}"
            printf " ${SLATE_600}│${RESET} ${LEARN_LABEL}✿${RESET}${_learn_color}${_learn_score}${_learn_trend}${RESET}
"
            # Line 3: memory counts
            printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} ${LEARN_SESSIONS}⊕${RESET}${SLATE_300}${sessions_count}${RESET}
"
            ;;
        mini)
            # Line 1: branding + location/time
            printf "${SLATE_600}──${RESET} ${PAI_A}${PAI_LOGO}${RESET}  ${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${SLATE_600}──${RESET} ${PAI_CITY}${location_city}${RESET} ${SLATE_600}│${RESET} ${PAI_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${PAI_WEATHER}${weather_str}${RESET}
"
            # Line 2: context bar (compact)
            _bar_w=20
            _bar=$(render_context_bar $_bar_w $_raw_pct)
            printf "${CTX_PRIMARY}◉${RESET} ${_bar} ${_pct_color}${_raw_pct}%%${RESET}
"
            # Line 4: git
            printf "${GIT_PRIMARY}◈${RESET} ${GIT_VALUE}${branch:-—}${RESET}"
            [ -n "$_age" ] && printf " ${age_color:-$GIT_AGE_RECENT}${_age}${RESET}"
            [ "${stash_count:-0}" -gt 0 ] && printf " ${GIT_STASH}⊡${stash_count}${RESET}"
            printf "
"
            # Line 5: memory + learning
            printf "${LEARN_PRIMARY}◎${RESET} ${LEARN_WORK}📁${RESET}${SLATE_300}${work_count}${RESET} ${LEARN_SIGNALS}✦${RESET}${SLATE_300}${ratings_count}${RESET} ${SLATE_600}│${RESET} ${LEARN_LABEL}✿${RESET}${_learn_color}${_learn_score}${_learn_trend}${RESET}
"
            ;;
    esac
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# NORMAL MODE: Full multi-line output (80+ columns)
# ═══════════════════════════════════════════════════════════════════════════════

# Output PAI branding line: PAI │ CITY, STATE 🇺🇸  HH:MM  ☁️ temp [│ session]
# City + state arrive uppercased from the location prefetch; flag is rendered there too.
_hdr_loc=""
if [ -n "$location_city" ]; then
    [ -n "$location_flag" ] && _hdr_loc="${location_flag} "
    _hdr_loc="${_hdr_loc}${PAI_CITY}${location_city}${RESET}"
    [ -n "$location_state" ] && _hdr_loc="${_hdr_loc}${SLATE_600}, ${RESET}${PAI_STATE}${location_state}${RESET}"
fi
# Plain-text twin for width math.
_hdr_loc_plain=""
[ -n "$location_flag" ] && _hdr_loc_plain="${location_flag} "
_hdr_loc_plain="${_hdr_loc_plain}${location_city}"
[ -n "$location_state" ] && _hdr_loc_plain="${_hdr_loc_plain}, ${location_state}"
[ -z "$_hdr_loc_plain" ] && _hdr_loc_plain="—"
if [ -n "$session_display" ]; then
    printf "${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${SLATE_600}│${RESET} ${_hdr_loc}  ${PAI_TIME}${current_time}${RESET}  ${PAI_WEATHER}${weather_str}${RESET} ${SLATE_600}│${RESET} ${PAI_SESSION}${session_display}${RESET}\n"
else
    _hdr_left="PAI │ ${_hdr_loc_plain}  ${current_time}  ${weather_str} "
    _hdr_fill=$((content_width - ${#_hdr_left}))
    [ "$_hdr_fill" -lt 2 ] && _hdr_fill=2
    _hdr_dashes=$(_repeat_chars "$_hdr_fill" "─")
    printf "${PAI_P}P${PAI_A}A${PAI_I}I${RESET} ${SLATE_600}│${RESET} ${_hdr_loc}  ${PAI_TIME}${current_time}${RESET}  ${PAI_WEATHER}${weather_str}${RESET} ${SLATE_600}${_hdr_dashes}${RESET}\n"
fi
printf "${SLATE_600}%s${RESET}\n" "$SEP_DASHED"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE: STATE METER — dimension meters toward Ideal State
# Reads PAI/USER/TELOS/PAI_STATE.json (written by ComputeGap.ts on a schedule).
# Falls back to placeholder values if the state file is missing.
# Format: STATE: HEALTH 68%│CREATIVE 31%│FREEDOM 78%│RELATIONSHIPS 84%│FINANCIAL 42%
# ═══════════════════════════════════════════════════════════════════════════════

_dim_color() {
    # Blue-family gradient — navy → light blue across dimensions
    case "$1" in
        health)        printf '\033[38;2;56;189;248m' ;;   # sky — bright cyan-blue
        money)         printf '\033[38;2;37;99;235m' ;;    # royal blue
        freedom)       printf '\033[38;2;59;130;246m' ;;   # blue
        relationships) printf '\033[38;2;96;165;250m' ;;   # medium-light
        creative)      printf '\033[38;2;147;197;253m' ;;  # light blue
        *)             printf '%b' "$SLATE_400" ;;
    esac
}
_tier_color() {
    # Tier signal via blue intensity — brighter = closer to ideal.
    # Non-numeric values (e.g. "N/A" before the user has populated TELOS) get
    # the muted slate to read as "no signal yet" rather than "low score".
    local pct="${1%%.*}"
    case "$pct" in
        ''|*[!0-9]*) printf '\033[38;2;100;116;139m'; return ;;  # muted — not a number
    esac
    if   [ "$pct" -ge 75 ]; then printf '\033[38;2;219;234;254m'  # brightest (near-ideal)
    elif [ "$pct" -ge 50 ]; then printf '\033[38;2;96;165;250m'   # medium blue
    else                         printf '\033[38;2;100;116;139m'  # muted slate-blue (far from ideal)
    fi
}

_PAI_STATE_JSON="$PAI_DIR/USER/TELOS/PAI_STATE.json"
_dims=(health creative freedom relationships money)
_labels=(HEALTH CREATIVE FREEDOM RELATIONS FIN)
# Fresh installs have no TELOS data yet — show N/A so the line reads "no signal"
# instead of misleadingly looking like real numbers. ComputeGap.ts populates
# PAI_STATE.json once the user runs /interview and rates dimensions.
declare -a _pcts=(N/A N/A N/A N/A N/A)

if [ -f "$_PAI_STATE_JSON" ]; then
    IFS=$'\t' read -r _state_health _state_creative _state_freedom _state_relationships _state_money <<< "$(
        jq -r '[.dimensions.health.pct // "", .dimensions.creative.pct // "", .dimensions.freedom.pct // "", .dimensions.relationships.pct // "", .dimensions.money.pct // ""] | @tsv' "$_PAI_STATE_JSON" 2>/dev/null
    )"
    [ -n "$_state_health" ] && [ "$_state_health" != "null" ] && _pcts[0]="${_state_health%%.*}"
    [ -n "$_state_creative" ] && [ "$_state_creative" != "null" ] && _pcts[1]="${_state_creative%%.*}"
    [ -n "$_state_freedom" ] && [ "$_state_freedom" != "null" ] && _pcts[2]="${_state_freedom%%.*}"
    [ -n "$_state_relationships" ] && [ "$_state_relationships" != "null" ] && _pcts[3]="${_state_relationships%%.*}"
    [ -n "$_state_money" ] && [ "$_state_money" != "null" ] && _pcts[4]="${_state_money%%.*}"
fi

printf "${SLATE_500}STATE:${RESET} "
for _i in "${!_dims[@]}"; do
    _dc=$(_dim_color "${_dims[$_i]}")
    _tc=$(_tier_color "${_pcts[$_i]}")
    # Append "%" only for numeric values; N/A renders bare so it reads as "no data".
    _val="${_pcts[$_i]}"
    case "$_val" in
        ''|*[!0-9]*) _suffix="" ;;
        *)           _suffix="%" ;;
    esac
    printf "%b%s${RESET} %b%s%s${RESET}" "$_dc" "${_labels[$_i]}" "$_tc" "$_val" "$_suffix"
    [ "$_i" -lt $((${#_dims[@]} - 1)) ] && printf " ${SLATE_600}│${RESET} "
done
printf "\n"
sep
printf "${SLATE_400}CC:${RESET} ${PAI_A}${cc_version}${RESET} ${SLATE_600}│${RESET} ${SLATE_500}PAI:${PAI_A}${PAI_VERSION}${RESET} ${SLATE_400}ALG:${PAI_A}${ALGO_VERSION}${RESET} ${SLATE_600}│${RESET} ${WIELD_ACCENT}SK:${RESET} ${SLATE_300}${public_skills}${RESET}${SLATE_600}🌐${RESET} ${SLATE_500}${private_skills}${RESET}${SLATE_600}🏠${RESET} ${SLATE_600}│${RESET} ${WIELD_WORKFLOWS}WF:${RESET} ${SLATE_300}${workflows_count}${RESET} ${SLATE_600}│${RESET} ${WIELD_HOOKS}HK:${RESET} ${SLATE_300}${hooks_count}${RESET}\n"
sep

# ═══════════════════════════════════════════════════════════════════════════════
# LINE 1: CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

# Context display — show percentage and bar (no token counts)
context_max="${context_max:-200000}"

# Use raw percentage directly — matches /context command output
raw_pct="${context_pct%%.*}"  # Remove decimals
[ -z "$raw_pct" ] && raw_pct=0
display_pct="$raw_pct"

# Color based on percentage (reuse get_usage_color for consistent thresholds)
pct_color=$(get_usage_color "$display_pct")

# Calculate bar width dynamically from actual prefix/suffix lengths
# Prefix: "◉ CONTEXT: " = 11 visible chars
# Suffix: " " + display_pct + "%" = 1 + len(display_pct) + 1
_ctx_suffix_len=$(( 1 + ${#display_pct} + 1 ))
bar_width=$(( content_width - 11 - _ctx_suffix_len ))
[ "$bar_width" -lt 16 ] && bar_width=16

bar=$(render_context_bar $bar_width $display_pct)
printf "${CTX_SECONDARY}CONTEXT:${RESET} ${bar} ${pct_color}${display_pct}%%${RESET}\n"

# Thin separator between context bar and files
printf "${SLATE_600}%s${RESET}\n" "$SEP_DOT"

# Context files line — parse @imports from CLAUDE.md (v5.0: static files loaded via @imports, not loadAtStartup)
_ctx_files=()
while IFS= read -r _cf; do
    [ -n "$_cf" ] && _ctx_files+=("${_cf##*/}")
done < <(sed -n 's/^@//p' "$CLAUDE_HOME/CLAUDE.md" 2>/dev/null)
_ctx_count=${#_ctx_files[@]}
if [ "$_ctx_count" -gt 0 ]; then
    _prefix="  FILES(${_ctx_count}): "
    _prefix_len=${#_prefix}
    _indent=$(printf '%*s' "$_prefix_len" '')
    _line_len=$_prefix_len
    _first_file=true
    _output=""

    for _ct in "${_ctx_files[@]}"; do
        _ct_len=${#_ct}
        # Account for ", " separator (2 chars) except on first file per line
        if [ "$_first_file" = true ]; then
            _needed=$_ct_len
        else
            _needed=$((_ct_len + 2))
        fi

        # Wrap to next line if this file would exceed content_width
        if [ $((_line_len + _needed)) -gt "$content_width" ] && [ "$_first_file" != true ]; then
            _output="${_output}\n${_indent}"
            _line_len=$_prefix_len
            _first_file=true
            _needed=$_ct_len
        fi

        if [ "$_first_file" = true ]; then
            _output="${_output}${CTX_SECONDARY}${_ct}${RESET}"
            _first_file=false
        else
            _output="${_output}${SLATE_600},${RESET} ${CTX_SECONDARY}${_ct}${RESET}"
        fi
        _line_len=$((_line_len + _needed))
    done

    printf "  ${SLATE_500}FILES(${_ctx_count}):${RESET} "
    printf '%b\n' "${_output}"
fi
sep

# ═══════════════════════════════════════════════════════════════════════════════
# LINE: ACCOUNT USAGE (Claude API rate limits — 5H and 7D windows)
# ═══════════════════════════════════════════════════════════════════════════════
# NOTE: usage_5h, usage_7d, usage_5h_reset, usage_7d_reset populated by PARALLEL PREFETCH

usage_5h_int=${usage_5h%%.*}
usage_7d_int=${usage_7d%%.*}
[ -z "$usage_5h_int" ] && usage_5h_int=0
[ -z "$usage_7d_int" ] && usage_7d_int=0

# Only show usage line if we have data (token was valid, cache fresh)
if [ "${usage_no_data:-false}" != "true" ] && { [ "$usage_5h_int" -gt 0 ] || [ "$usage_7d_int" -gt 0 ] || [ -f "$USAGE_CACHE" ]; }; then
    usage_5h_color=$(get_usage_color "$usage_5h_int")
    usage_7d_color=$(get_usage_color "$usage_7d_int")

    # Parse reset timestamps and show absolute reset times (e.g., "TODAY@1500", "THU@0900")
    # Split into day/time parts for two-tone amber coloring
    reset_5h_day="—"; reset_5h_time=""; reset_7d_day="—"; reset_7d_time=""
    if [ -n "${usage_5h_reset:-}" ]; then
        _r5h_epoch=$(parse_iso_epoch "$usage_5h_reset")
        if [ "$_r5h_epoch" -gt 0 ] 2>/dev/null; then
            _r5h_str=$(reset_time_str "$_r5h_epoch")
            reset_5h_day="${_r5h_str%%@*}"
            reset_5h_time="${_r5h_str#*@}"
        fi
    fi
    if [ -n "${usage_7d_reset:-}" ]; then
        _r7d_epoch=$(parse_iso_epoch "$usage_7d_reset")
        if [ "$_r7d_epoch" -gt 0 ] 2>/dev/null; then
            _r7d_str=$(reset_time_str "$_r7d_epoch")
            reset_7d_day="${_r7d_str%%@*}"
            reset_7d_time="${_r7d_str#*@}"
        fi
    fi

    # Extra usage display (Max plan overage credits — values in cents)
    extra_display=""
    if [ "${usage_extra_enabled:-false}" = "true" ]; then
        extra_limit_dollars=$((${usage_extra_limit:-0} / 100))
        extra_used_dollars=$((${usage_extra_used%%.*} / 100))
        if [ "$extra_limit_dollars" -ge 1000 ]; then
            extra_limit_fmt="\$$(( extra_limit_dollars / 1000 ))K"
        else
            extra_limit_fmt="\$${extra_limit_dollars}"
        fi
        extra_display="E:\$${extra_used_dollars:-0}/${extra_limit_fmt}"
    fi

    # Staleness indicator: dim labels/timestamps only, NEVER dim data values
    _usage_cache_age=0
    [ -f "$USAGE_CACHE" ] && _usage_cache_age=$(( NOW_EPOCH - $(get_mtime "$USAGE_CACHE") ))
    _usage_is_stale=false
    stale_suffix=""
    if [ "$_usage_cache_age" -gt 600 ]; then
        _usage_is_stale=true
        stale_min=$((_usage_cache_age / 60))
        if [ "$stale_min" -ge 60 ]; then
            stale_suffix=" ${USAGE_STALE}($((stale_min / 60))h)${RESET}"
        else
            stale_suffix=" ${USAGE_STALE}(${stale_min}m)${RESET}"
        fi
    fi

    # Format colored reset display: day in USAGE_LABEL amber, time in USAGE_PRIMARY bright amber
    # When stale, labels/timestamps shift to warm gray; data values are NEVER affected
    if [ "$_usage_is_stale" = true ]; then
        _label_color="$USAGE_STALE"
        _reset_color="$USAGE_STALE"
    else
        _label_color="$USAGE_LABEL"
        _reset_color="$USAGE_RESET"
    fi
    _fmt_reset() {
        local day="$1" time="$2"
        if [ -n "$time" ]; then
            printf "${_label_color}${day}${RESET}${SLATE_600}@${RESET}${_label_color}${time}${RESET}"
        else
            printf "${_label_color}${day}${RESET}"
        fi
    }
    _reset_5h_fmt=$(_fmt_reset "$reset_5h_day" "$reset_5h_time")
    _reset_7d_fmt=$(_fmt_reset "$reset_7d_day" "$reset_7d_time")
    # Billing mode indicator — colored = active, slate-dim = inactive.
    # This block only renders when subscription OAuth usage data is present,
    # so SUB is always active here. API colored only if no usage data (pure API mode).
    if [ "${usage_no_data:-false}" = "true" ]; then
        _sub_color="$SLATE_600"; _api_color="$USAGE_PRIMARY"
    else
        _sub_color="$USAGE_PRIMARY"; _api_color="$SLATE_600"
    fi
    printf "${_label_color}USE:${RESET} ${_reset_color}5HR:${RESET} ${usage_5h_color}${usage_5h_int}%%${RESET} ${_reset_color}↻${RESET}${_reset_5h_fmt} ${SLATE_600}│${RESET} ${_reset_color}WEEK:${RESET} ${usage_7d_color}${usage_7d_int}%%${RESET} ${_reset_color}↻${RESET}${_reset_7d_fmt} ${SLATE_600}(${RESET}${_sub_color}SUB${RESET}${SLATE_600}/${RESET}${_api_color}API${RESET}${SLATE_600})${RESET}"
    [ -n "$extra_display" ] && printf " ${SLATE_600}│${RESET} ${USAGE_EXTRA}${extra_display}${RESET}"
    [ -n "$stale_suffix" ] && printf "${stale_suffix}"
    printf "\n"
    sep
fi

# ═══════════════════════════════════════════════════════════════════════════════
# LINE: LEARNING (with sparklines in normal mode)
# ═══════════════════════════════════════════════════════════════════════════════

LEARNING_CACHE_TTL=30  # seconds

if [ -f "$RATINGS_FILE" ] && [ -s "$RATINGS_FILE" ]; then
    now=$NOW_EPOCH

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
        _sparkline_w=$((content_width - 10))  # prefix "   ├─ 15m:  " ~12 cols, -10 to fill edge
        [ "$_sparkline_w" -lt 20 ] && _sparkline_w=20
        eval "$(grep '^{' "$RATINGS_FILE" | jq -Rc 'try fromjson catch empty' | jq -rs --argjson now "$now" --argjson spark_w "$_sparkline_w" '
      # Parse ISO timestamp to epoch (handles timezone offsets)
      def to_epoch:
        (capture("(?<sign>[-+])(?<h>[0-9]{2}):(?<m>[0-9]{2})$") // {sign: "+", h: "00", m: "00"}) as $tz |
        gsub("[-+][0-9]{2}:[0-9]{2}$"; "Z") | gsub("\\.[0-9]+"; "") | fromdateiso8601 |
        . + (if $tz.sign == "-" then 1 else -1 end) * (($tz.h | tonumber) * 3600 + ($tz.m | tonumber) * 60);

      # Filter valid ratings, add epoch, sort by time (enables pre-filtering)
      [.[] | select(.rating != null) | . + {epoch: (.timestamp | to_epoch)}] | sort_by(.epoch) |

      # Time boundaries
      ($now - 900) as $q15_start | ($now - 3600) as $hour_start | ($now - 86400) as $today_start |
      ($now - 604800) as $week_start | ($now - 2592000) as $month_start |

      # Pre-filter each period ONCE (avoids scanning all 2600+ ratings per bucket)
      [.[] | select(.epoch >= $q15_start)] as $q15_data |
      [.[] | select(.epoch >= $hour_start)] as $hour_data |
      [.[] | select(.epoch >= $today_start)] as $day_data |
      [.[] | select(.epoch >= $week_start)] as $week_data |
      [.[] | select(.epoch >= $month_start)] as $month_data |

      # Calculate averages from pre-filtered data
      def avg: if length > 0 then (add / length | . * 10 | floor / 10 | tostring) else "—" end;
      ($q15_data | map(.rating) | avg) as $q15_avg |
      ($hour_data | map(.rating) | avg) as $hour_avg |
      ($day_data | map(.rating) | avg) as $today_avg |
      ($week_data | map(.rating) | avg) as $week_avg |
      ($month_data | map(.rating) | avg) as $month_avg |
      (map(.rating) | avg) as $all_avg |

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

      # Sparkline from PRE-FILTERED data (not all ratings)
      def make_sparkline($data; $period_start):
        ($now - $period_start) as $dur | ($dur / $spark_w) as $sz |
        [range($spark_w) | . as $i | ($period_start + ($i * $sz)) as $s | ($s + $sz) as $e |
          [$data[] | select(.epoch >= $s and .epoch < $e) | .rating] |
          if length == 0 then "\u001b[38;2;45;50;60m \u001b[0m" else (add / length) | to_bar end
        ] | join("");

      (make_sparkline($q15_data; $q15_start)) as $q15_sparkline |
      (make_sparkline($hour_data; $hour_start)) as $hour_sparkline |
      (make_sparkline($day_data; $today_start)) as $day_sparkline |
      (make_sparkline($week_data; $week_start)) as $week_sparkline |
      (make_sparkline($month_data; $month_start)) as $month_sparkline |

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

      # Trends from pre-filtered data (no re-scan)
      ($hour_data | map(.rating)) as $hour_ratings |
      ($day_data | map(.rating)) as $day_ratings |
      (calc_trend($hour_ratings)) as $hour_trend |
      (calc_trend($day_ratings)) as $day_trend |

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
        # Get rating colors for each period
        LATEST_COLOR=$(get_rating_color "${latest:-5}")
        Q15_COLOR=$(get_rating_color "${q15_avg:-5}")
        HOUR_COLOR=$(get_rating_color "${hour_avg:-5}")
        TODAY_COLOR=$(get_rating_color "${today_avg:-5}")
        WEEK_COLOR=$(get_rating_color "${week_avg:-5}")
        MONTH_COLOR=$(get_rating_color "${month_avg:-5}")

        [ "$latest_source" = "explicit" ] && src_label="EXP" || src_label="IMP"

        printf "${LEARN_LABEL}LEARNING:${RESET} ${SLATE_600}│${RESET} "
        printf "${LATEST_COLOR}${latest}${RESET}${SLATE_500}${src_label}${RESET} ${SLATE_600}│${RESET} "
        printf "${SIGNAL_PERIOD}60m:${RESET} ${HOUR_COLOR}${hour_avg}${RESET} "
        printf "${SIGNAL_PERIOD}1d:${RESET} ${TODAY_COLOR}${today_avg}${RESET} "
        printf "${SIGNAL_PERIOD}1mo:${RESET} ${MONTH_COLOR}${month_avg}${RESET}\n"

        # Sparklines (condensed, no blank lines — 60m + 1d + 1mo)
        printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "60m:" "$hour_sparkline"
        printf "   ${SLATE_600}├─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "1d:" "$day_sparkline"
        printf "   ${SLATE_600}└─${RESET} ${SIGNAL_PERIOD}%-5s${RESET} %s\n" "1mo:" "$month_sparkline"
    else
        printf "${LEARN_LABEL}LEARNING:${RESET}\n"
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
    sep

    # Quote was prefetched in parallel block — just read the cache
    if [ -f "$QUOTE_CACHE" ]; then
        IFS='|' read -r quote_text quote_author < "$QUOTE_CACHE"
        full_len=$((${#quote_text} + ${#quote_author} + 6))  # ✦ "text" —author

        if [ "$full_len" -le "$content_width" ]; then
            printf "${SLATE_400}\"${quote_text}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
        else
            # Word-wrap: find last space before column 60
            wrap_at=60
            [ "$wrap_at" -gt "${#quote_text}" ] && wrap_at=${#quote_text}
            while [ "$wrap_at" -gt 10 ] && [ "${quote_text:$wrap_at:1}" != " " ]; do wrap_at=$((wrap_at - 1)); done
            printf "${SLATE_400}\"${quote_text:0:$wrap_at}${RESET}\n"
            printf "  ${SLATE_400}${quote_text:$((wrap_at + 1))}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
        fi
    fi
fi
