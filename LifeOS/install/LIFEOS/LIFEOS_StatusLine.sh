#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# LifeOS Status Line — Responsive display with 4 modes by terminal width:
#   nano (<35), micro (35-54), mini (55-79), normal (80+)
# Normal output: LifeOS Header → Context → Usage → Git → Memory → Quote
# ═══════════════════════════════════════════════════════════════════════════════

set -o pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

LIFEOS_DIR="${LIFEOS_DIR:-$HOME/.claude/LIFEOS}"
# Claude Code injects settings.json env values without shell expansion (LifeOS#1404):
# a shipped value of "$HOME/.claude/LIFEOS" arrives literal. Expand it here.
LIFEOS_DIR="${LIFEOS_DIR/#\$HOME/$HOME}"
LIFEOS_DIR="${LIFEOS_DIR/#\$\{HOME\}/$HOME}"
LIFEOS_DIR="${LIFEOS_DIR/#\~\//$HOME/}"
CLAUDE_HOME="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"
RATINGS_FILE="$LIFEOS_DIR/MEMORY/LEARNING/SIGNALS/ratings.jsonl"
MODEL_CACHE="$LIFEOS_DIR/MEMORY/STATE/model-cache.txt"
QUOTES_FILE="$LIFEOS_DIR/USER/PRINCIPAL/Quotes.txt"
LOCATION_CACHE="$LIFEOS_DIR/MEMORY/STATE/location-cache.json"
WEATHER_CACHE="$LIFEOS_DIR/MEMORY/STATE/weather-cache.json"
USAGE_CACHE="/tmp/pai-usage-${USER:-anon}.json"
LEARNING_CACHE="$LIFEOS_DIR/MEMORY/STATE/learning-cache.sh"

# Config reads from settings.json. NO counts here — counts are computed live
# in the parallel block below via GetCounts.ts (no cache, no SessionEnd staleness).
eval "$(jq -r '
  "TEMP_UNIT=" + (.preferences.temperatureUnit // "fahrenheit" | @sh) + "\n" +
  "DA_NAME=" + (.daidentity.name // .daidentity.displayName // .env.DA // "Assistant" | @sh) + "\n" +
  "USER_TZ=" + (.principal.timezone // "" | @sh)
' "$SETTINGS_FILE" 2>/dev/null)"
TEMP_UNIT="${TEMP_UNIT:-fahrenheit}"
[ "$TEMP_UNIT" != "celsius" ] && TEMP_UNIT="fahrenheit"
DA_NAME="${DA_NAME:-Assistant}"

# Resolve USER_TZ in priority order: settings.principal.timezone → $TZ env →
# system zoneinfo symlink (macOS + most Linux) → /etc/timezone (Debian) → UTC.
# Falling back to UTC silently makes reset-time displays read N hours off on
# every install without an explicit timezone configured (a real bug {{PRINCIPAL_NAME}} hit).
if [ -z "${USER_TZ:-}" ] && [ -n "${TZ:-}" ]; then
    USER_TZ="$TZ"
fi
if [ -z "${USER_TZ:-}" ] && [ -L /etc/localtime ]; then
    USER_TZ="$(readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||')"
fi
if [ -z "${USER_TZ:-}" ] && [ -r /etc/timezone ]; then
    USER_TZ="$(tr -d '[:space:]' < /etc/timezone 2>/dev/null)"
fi
USER_TZ="${USER_TZ:-UTC}"

# LIFEOS_VERSION: read from PAI/VERSION (canonical, also read by install.sh,
# Banner.ts, _LIFEOS/Tools/UpdateLifeosVersion.ts, ShadowRelease.ts, install web
# server). Same multi-path pattern as ALGO_VERSION below to survive
# hook-spawn contexts where HOME/LIFEOS_DIR may not resolve.
LIFEOS_VERSION=""
for _pai_v_path in \
    "$LIFEOS_DIR/VERSION" \
    "$HOME/.claude/LIFEOS/VERSION" \
    "/Users/$(id -un 2>/dev/null)/.claude/LIFEOS/VERSION" \
    "$(eval echo ~"$(id -un 2>/dev/null)")/.claude/LIFEOS/VERSION"; do
    if [ -n "$_pai_v_path" ] && [ -f "$_pai_v_path" ]; then
        LIFEOS_VERSION="$(cat "$_pai_v_path" 2>/dev/null | tr -d '[:space:]')"
        [ -n "$LIFEOS_VERSION" ] && break
    fi
done
LIFEOS_VERSION="${LIFEOS_VERSION:-—}"
# v6.2.0+: LATEST is the single source of truth for the Algorithm version.
# Hardened against Claude Code's hook-spawn context where $HOME or $LIFEOS_DIR
# may not resolve as expected (subprocess spawn with non-default env). Try
# multiple candidate paths in order, keeping the first non-empty result.
ALGO_VERSION=""
for _algo_path in \
    "$LIFEOS_DIR/ALGORITHM/LATEST" \
    "$HOME/.claude/LIFEOS/ALGORITHM/LATEST" \
    "/Users/$(id -un 2>/dev/null)/.claude/LIFEOS/ALGORITHM/LATEST" \
    "$(eval echo ~"$(id -un 2>/dev/null)")/.claude/LIFEOS/ALGORITHM/LATEST"; do
    if [ -n "$_algo_path" ] && [ -f "$_algo_path" ]; then
        ALGO_VERSION="$(cat "$_algo_path" 2>/dev/null | tr -d '[:space:]')"
        [ -n "$ALGO_VERSION" ] && break
    fi
done
# Diagnostic log so we can see WHAT is happening in claude-code spawn context
{
    printf '[%s] ALGO_VERSION=%q HOME=%q LIFEOS_DIR=%q USER=%q paths_tried:' \
        "$(date '+%H:%M:%S')" "$ALGO_VERSION" "${HOME:-UNSET}" "${LIFEOS_DIR:-UNSET}" "${USER:-UNSET}"
    for _algo_path in \
        "$LIFEOS_DIR/ALGORITHM/LATEST" \
        "$HOME/.claude/LIFEOS/ALGORITHM/LATEST" \
        "/Users/$(id -un 2>/dev/null)/.claude/LIFEOS/ALGORITHM/LATEST"; do
        printf ' %s=%s' "$_algo_path" "$([ -f "$_algo_path" ] && echo OK || echo MISS)"
    done
    printf '\n'
} >> /tmp/pai-statusline-debug.log 2>/dev/null
ALGO_VERSION="${ALGO_VERSION:-—}"

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
# │ Quote           │   n/a  │ Curated corpus, deterministic 60s window         │
# │ Model           │ n/a    │ Written once per session, no TTL                 │
# │ Terminal width  │ n/a    │ Written once, read as fallback                   │
# └─────────────────┴────────┴──────────────────────────────────────────────────┘
LOCATION_CACHE_TTL=3600
WEATHER_CACHE_TTL=900
USAGE_CACHE_TTL=900      # 15 min: /api/oauth/usage has aggressive per-token rate limits (~5 req before 429)

# Source .env for API keys. Canonical location is $HOME/.claude/.env (which is
# typically a symlink to $HOME/.config/LIFEOS/.env). The historical $HOME/.claude/LIFEOS/.env
# path is wrong and has been removed everywhere else — do not reintroduce it.
[ -f "$HOME/.claude/.env" ] && source "$HOME/.claude/.env"

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
# [TEMP-DEBUG] capture real stdin payload to inspect effort/output_style fields
printf '%s' "$input" > "$LIFEOS_DIR/MEMORY/STATE/statusline-stdin-debug.json" 2>/dev/null

# Get DA name from settings (single source of truth)
DA_NAME="${DA_NAME:-Assistant}"

# Get user timezone from settings (for reset time display)
USER_TZ="${USER_TZ:-UTC}"

# LifeOS version was read from PAI/VERSION above; this is a defensive fallback.
LIFEOS_VERSION="${LIFEOS_VERSION:-—}"

# ALGO_VERSION is set above from LATEST (single source of truth, v6.2.0+).
ALGO_VERSION="${ALGO_VERSION:-—}"

# Extract all data from JSON in single jq call
eval "$(jq -r '
  "current_dir=" + (.workspace.current_dir // .cwd // "." | @sh) + "\n" +
  "session_id=" + (.session_id // "" | @sh) + "\n" +
  "model_name=" + (.model.display_name // "unknown" | @sh) + "\n" +
  "effort_level=" + (.effort.level // "" | @sh) + "\n" +
  "output_style=" + (.output_style.name // "" | @sh) + "\n" +
  "cc_version_json=" + (.version // "" | @sh) + "\n" +
  "harness_name_json=" + (.harness.name // "" | @sh) + "\n" +
  "harness_version_json=" + (.harness.version // "" | @sh) + "\n" +
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
        [ -f "$LIFEOS_DIR/LIFEOS_SYSTEM_PROMPT.md" ] && _est=$((_est + $(wc -c < "$LIFEOS_DIR/LIFEOS_SYSTEM_PROMPT.md") * 10 / 35))

        # loadAtStartup files (injected by LoadContext.hook.ts as system-reminders)
        while IFS= read -r _f; do
            [ -n "$_f" ] && [ -f "$LIFEOS_DIR/$_f" ] && _est=$((_est + $(wc -c < "$LIFEOS_DIR/$_f") * 10 / 35))
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
        _agent_user=("$LIFEOS_DIR"/agents/*.md)
        _agent_plugin=("$LIFEOS_DIR"/.plugins/*/agents/*.md)
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

# Get harness name and version from JSON input (set by pai-core extension).
# Defaults to "CC" (Claude Code) when not running under Pi or another harness.
harness_name="${harness_name_json:-}"
harness_version="${harness_version_json:-}"
if [ -z "$harness_name" ]; then
    # Not running under a known harness — treat as Claude Code direct
    harness_name="CC"
fi

# Get Claude Code version — mtime-cached value, fall back to forking
# `claude --version` (40-80ms, so cached for 24h).
_CC_VERSION_CACHE="$LIFEOS_DIR/MEMORY/STATE/cc-version-cache.txt"
if [ -f "$_CC_VERSION_CACHE" ] && [ -z "$(find "$_CC_VERSION_CACHE" -mtime +1 2>/dev/null)" ]; then
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
# NOTE: Claude Code uses lowercase "projects/" dir, LifeOS uses uppercase "Projects/".
SESSION_LABEL=""
SESSION_NAMES_FILE="$LIFEOS_DIR/MEMORY/STATE/session-names.json"
SESSION_CACHE="$LIFEOS_DIR/MEMORY/STATE/session-name-cache.sh"
if [ -n "$session_id" ]; then
    # Derive sessions-index path from current_dir (Claude Code uses lowercase "projects")
    project_slug="${current_dir//[\/.]/-}"
    SESSIONS_INDEX="$LIFEOS_DIR/projects/${project_slug}/sessions-index.json"

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
# Quote line renders directly from $QUOTES_FILE at the bottom of the script —
# no cache, no network, no parallel block, just one awk call.
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

# ─────────────────────────────────────────────────────────────────────────────
# Location & weather — stale-while-revalidate (SWR)
# ─────────────────────────────────────────────────────────────────────────────
# Render path reads cache only — sub-millisecond, no network. Refresh runs as
# a fully detached background subshell, so a stale or missing cache never
# blocks the statusline render. An mkdir-based lockfile prevents concurrent
# refreshes from piling up if the statusline ticks during a slow fetch.
#
# This replaces the original synchronous design that did `curl --max-time 3`
# on the render path during cache expiry — that's what killed the perf and
# got the feature ripped out on 2026-05-08.

# 2a. Location: synchronous cache read for render
{
    if [ -f "$LOCATION_CACHE" ]; then
        eval "$(jq -r '
            "_lc_city=" + (.city // "" | @sh) + "\n" +
            "_lc_region=" + (.region // .regionName // "" | @sh) + "\n" +
            "_lc_cc=" + (.countryCode // "" | @sh)
        ' "$LOCATION_CACHE" 2>/dev/null)"
        _lc_city_upper=$(echo "${_lc_city:-}" | tr '[:lower:]' '[:upper:]')
        _lc_region_upper=$(echo "${_lc_region:-}" | tr '[:lower:]' '[:upper:]')
        # Country code → flag emoji. Each regional indicator symbol is
        # U+1F1E6 + (letter - 'A'), UTF-8: F0 9F 87 (A6..BF). Built via raw
        # byte escapes so we don't need bash 4+ \U.
        _lc_flag=""
        if [ -n "${_lc_cc:-}" ] && [ ${#_lc_cc} -eq 2 ]; then
            _cc_up=$(echo "$_lc_cc" | tr '[:lower:]' '[:upper:]')
            _c1=$(printf '%d' "'${_cc_up:0:1}")
            _c2=$(printf '%d' "'${_cc_up:1:1}")
            if [ "$_c1" -ge 65 ] && [ "$_c1" -le 90 ] && [ "$_c2" -ge 65 ] && [ "$_c2" -le 90 ]; then
                _b1=$(printf '%02x' $(( 0xA6 + _c1 - 65 )))
                _b2=$(printf '%02x' $(( 0xA6 + _c2 - 65 )))
                _lc_flag=$(printf '%b' "\xf0\x9f\x87\x${_b1}\xf0\x9f\x87\x${_b2}")
            fi
        fi
        {
            printf "location_city=%q\n" "$_lc_city_upper"
            printf "location_state=%q\n" "$_lc_region_upper"
            printf "location_flag=%q\n" "$_lc_flag"
        } > "$_parallel_tmp/location.sh"
    else
        echo -e "location_city='UNKNOWN'\nlocation_state=''\nlocation_flag='🌐'" > "$_parallel_tmp/location.sh"
    fi
} &

# 2b. Weather: synchronous cache read for render
{
    if [ -f "$WEATHER_CACHE" ]; then
        echo "weather_str='$(cat "$WEATHER_CACHE" 2>/dev/null)'" > "$_parallel_tmp/weather.sh"
    else
        echo "weather_str='—'" > "$_parallel_tmp/weather.sh"
    fi
} &

# 2c. Detached SWR refresh — runs ONLY if cache is stale or missing.
# mkdir-based lock (atomic) prevents concurrent statusline ticks from
# spawning parallel curls. Stale lock (>30s) is auto-recovered.
# Subshell is fully detached so the render path doesn't wait on it.
_loc_age=999999
[ -f "$LOCATION_CACHE" ] && _loc_age=$((NOW_EPOCH - $(get_mtime "$LOCATION_CACHE")))
_wx_age=999999
[ -f "$WEATHER_CACHE" ] && _wx_age=$((NOW_EPOCH - $(get_mtime "$WEATHER_CACHE")))

if [ "$_loc_age" -gt "$LOCATION_CACHE_TTL" ] || [ "$_wx_age" -gt "$WEATHER_CACHE_TTL" ]; then
    (
        _lock_dir="/tmp/pai-locwx-refresh.lock"
        if ! mkdir "$_lock_dir" 2>/dev/null; then
            # Lock held — clear if stale (>30s), else exit
            if [ -d "$_lock_dir" ]; then
                _lock_age=$((NOW_EPOCH - $(get_mtime "$_lock_dir")))
                if [ "$_lock_age" -gt 30 ]; then
                    rmdir "$_lock_dir" 2>/dev/null
                    mkdir "$_lock_dir" 2>/dev/null || exit 0
                else
                    exit 0
                fi
            else
                exit 0
            fi
        fi
        trap 'rmdir "$_lock_dir" 2>/dev/null' EXIT

        # Refresh location if stale
        if [ "$_loc_age" -gt "$LOCATION_CACHE_TTL" ]; then
            _loc_data=$(curl -s --max-time 3 "http://ip-api.com/json/?fields=city,region,regionName,country,countryCode,lat,lon" 2>/dev/null)
            if [ -n "$_loc_data" ] && echo "$_loc_data" | jq -e '.city' >/dev/null 2>&1; then
                echo "$_loc_data" > "$LOCATION_CACHE"
            fi
        fi

        # Refresh weather if stale (depends on fresh-enough location)
        if [ "$_wx_age" -gt "$WEATHER_CACHE_TTL" ] && [ -f "$LOCATION_CACHE" ]; then
            eval "$(jq -r '"_lat=\(.lat // empty)\n_lon=\(.lon // empty)"' "$LOCATION_CACHE" 2>/dev/null)"
            if [ -n "${_lat:-}" ] && [ -n "${_lon:-}" ]; then
                _wx_json=$(curl -s --max-time 4 "https://api.open-meteo.com/v1/forecast?latitude=${_lat}&longitude=${_lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${TEMP_UNIT}" 2>/dev/null)
                if [ -n "$_wx_json" ] && echo "$_wx_json" | jq -e '.current' >/dev/null 2>&1; then
                    eval "$(echo "$_wx_json" | jq -r '.current | "_t=\(.temperature_2m)\n_wc=\(.weather_code)\n_id=\(.is_day)"' 2>/dev/null)"
                    _t_int="${_t%%.*}"
                    # open-meteo WMO weather_code → emoji
                    case "$_wc" in
                        0)                                _icon=$([ "$_id" = "1" ] && echo "☀️" || echo "🌙") ;;
                        1|2)                              _icon=$([ "$_id" = "1" ] && echo "🌤️" || echo "☁️") ;;
                        3)                                _icon="☁️" ;;
                        45|48)                            _icon="🌫️" ;;
                        51|53|55|56|57|61|63|65|66|67|80|81|82) _icon="🌧️" ;;
                        71|73|75|77|85|86)                _icon="🌨️" ;;
                        95|96|99)                         _icon="⛈️" ;;
                        *)                                _icon="🌡️" ;;
                    esac
                    if [ "$TEMP_UNIT" = "celsius" ]; then
                        echo "${_icon} ${_t_int}°C" > "$WEATHER_CACHE"
                    else
                        echo "${_icon} ${_t_int}°F" > "$WEATHER_CACHE"
                    fi
                fi
            fi
        fi
    ) </dev/null >/dev/null 2>&1 &
    disown 2>/dev/null || true
fi

if [ "$MODE" != "nano" ]; then
{
    # 4. Counts — bash globs for filesystem-only metrics (skills, work, ratings),
    # GetCounts.ts --single for settings-derived metrics (hooks). The previous
    # full `bun GetCounts.ts` walked LIFEOS/USER/, MEMORY/LEARNING/, MEMORY/WORK/,
    # MEMORY/RESEARCH/, skills/ on every tick (~2.2s warm) — too slow. We now
    # use --single mode (~20ms, short-circuits all other walks) only where the
    # canonical formula matters (hooks needs dedupe). Filesystem walks where
    # bash and TS would compute identically stay as bash globs for speed.
    shopt -s nullglob
    _skill_files=("$CLAUDE_HOME"/skills/*/SKILL.md)
    _private_skill_files=("$CLAUDE_HOME"/skills/_*/SKILL.md)
    _live_skills=${#_skill_files[@]}
    _private_skills=${#_private_skill_files[@]}
    _work_dirs=("$LIFEOS_DIR"/MEMORY/WORK/*/)
    _work_cnt=${#_work_dirs[@]}
    shopt -u nullglob
    _public_skills=$(( _live_skills - _private_skills ))

    # Hook count flows through GetCounts.ts — same source banner uses. --single hooks
    # short-circuits all other walks (~20ms). Don't reintroduce inline jq here.
    _hooks_cnt=$(bun "$HOME/.claude/LIFEOS/TOOLS/GetCounts.ts" --single hooks 2>/dev/null || echo 0)

    _ratings_cnt=0
    [ -f "$RATINGS_FILE" ] && _ratings_cnt=$(wc -l < "$RATINGS_FILE" 2>/dev/null | tr -d ' ')

    cat > "$_parallel_tmp/counts.sh" << COUNTSEOF
hooks_count=${_hooks_cnt:-0}
work_count=${_work_cnt:-0}
ratings_count=${_ratings_cnt:-0}
sessions_count=0
skills_count=${_live_skills}
private_skills=${_private_skills}
public_skills=${_public_skills}
workflows_count=0
signals_count=0
learnings_count=0
files_count=0
research_count=0
COUNTSEOF
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

# Quote line restored 2026-05-12 — replaced the dead ZenQuotes API path with a
# curated 1024-line corpus at $LIFEOS_DIR/USER/PRINCIPAL/Quotes.txt. Selection is a
# deterministic function of wall-clock time: (epoch / 60) % count. No network,
# no cache, no refresh logic. Renderer lives at the bottom of the script.

# --- PARALLEL BLOCK END - wait for all to complete ---
wait

# Source all parallel results
[ -f "$_parallel_tmp/git.sh" ] && source "$_parallel_tmp/git.sh"
[ -f "$_parallel_tmp/counts.sh" ] && source "$_parallel_tmp/counts.sh"
[ -f "$_parallel_tmp/usage.sh" ] && source "$_parallel_tmp/usage.sh"
[ -f "$_parallel_tmp/location.sh" ] && source "$_parallel_tmp/location.sh"
[ -f "$_parallel_tmp/weather.sh" ] && source "$_parallel_tmp/weather.sh"
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

# NOTE: DA_NAME, LIFEOS_VERSION, input JSON, harness_name, harness_version, cc_version, model_name, dir_name
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

# LifeOS Branding
LIFEOS_P='\033[38;2;37;99;235m'          # Blue-600 (was navy 30;58;138 — too dark on navy bg)
LIFEOS_A='\033[38;2;59;130;246m'         # Medium blue
LIFEOS_I='\033[38;2;147;197;253m'        # Light blue
LIFEOS_LOGO=$'\xef\x91\xa9'  # Pulse waveform (FA heartbeat) — U+F469 in Hack Nerd Font
LIFEOS_LABEL='\033[38;2;100;116;139m'    # Slate for "status line"
LIFEOS_CITY='\033[38;2;37;99;235m'       # Blue-600 — darker, saturated city blue
LIFEOS_STATE='\033[38;2;125;211;252m'    # Sky-300 — lighter blue, paired with city
LIFEOS_TIME='\033[38;2;96;165;250m'      # Medium-light blue for time
LIFEOS_WEATHER='\033[38;2;135;206;235m'  # Sky blue for weather
LIFEOS_SESSION='\033[38;2;120;135;160m'  # Muted blue-gray for session label

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
# LINE 0: LifeOS BRANDING (location, time, weather)
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
            printf "${LIFEOS_A}${LIFEOS_LOGO}${RESET}  ${LIFEOS_P}LI${LIFEOS_A}FE${LIFEOS_I}OS${RESET} ${CTX_PRIMARY}◉${RESET}${_pct_color}${_raw_pct}%%${RESET}
"
            # Line 2: git + learning
            [ "$is_git_repo" = "true" ] && printf "${GIT_PRIMARY}◈${RESET}${GIT_VALUE}${branch}${RESET} "
            printf "${LEARN_LABEL}✿${RESET}${_learn_color}${_learn_score}${_learn_trend}${RESET}
"
            ;;
        micro)
            # Line 1: branding + context
            printf "${LIFEOS_A}${LIFEOS_LOGO}${RESET}  ${LIFEOS_P}LI${LIFEOS_A}FE${LIFEOS_I}OS${RESET} ${CTX_PRIMARY}◉${RESET}${_pct_color}${_raw_pct}%%${RESET}
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
            printf "${SLATE_600}──${RESET} ${LIFEOS_A}${LIFEOS_LOGO}${RESET}  ${LIFEOS_P}LI${LIFEOS_A}FE${LIFEOS_I}OS${RESET} ${SLATE_600}──${RESET} ${LIFEOS_CITY}${location_city}${RESET} ${SLATE_600}│${RESET} ${LIFEOS_TIME}${current_time}${RESET} ${SLATE_600}│${RESET} ${LIFEOS_WEATHER}${weather_str}${RESET}
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

# Output LifeOS branding line: LifeOS │ CITY, STATE 🇺🇸  HH:MM  ☁️ temp [│ session]
# City + state arrive uppercased from the location prefetch; flag is rendered there too.
_hdr_loc=""
if [ -n "$location_city" ]; then
    [ -n "$location_flag" ] && _hdr_loc="${location_flag} "
    _hdr_loc="${_hdr_loc}${LIFEOS_CITY}${location_city}${RESET}"
    [ -n "$location_state" ] && _hdr_loc="${_hdr_loc}${SLATE_600}, ${RESET}${LIFEOS_STATE}${location_state}${RESET}"
fi
# Plain-text twin for width math.
_hdr_loc_plain=""
[ -n "$location_flag" ] && _hdr_loc_plain="${location_flag} "
_hdr_loc_plain="${_hdr_loc_plain}${location_city}"
[ -n "$location_state" ] && _hdr_loc_plain="${_hdr_loc_plain}, ${location_state}"
[ -z "$_hdr_loc_plain" ] && _hdr_loc_plain="—"
if [ -n "$session_display" ]; then
    printf "${LIFEOS_P}LI${LIFEOS_A}FE${LIFEOS_I}OS${RESET} ${SLATE_600}│${RESET} ${_hdr_loc}  ${LIFEOS_TIME}${current_time}${RESET}  ${LIFEOS_WEATHER}${weather_str}${RESET} ${SLATE_600}│${RESET} ${LIFEOS_SESSION}${session_display}${RESET}\n"
else
    _hdr_left="LIFEOS │ ${_hdr_loc_plain}  ${current_time}  ${weather_str} "
    _hdr_fill=$((content_width - ${#_hdr_left}))
    [ "$_hdr_fill" -lt 2 ] && _hdr_fill=2
    _hdr_dashes=$(_repeat_chars "$_hdr_fill" "─")
    printf "${LIFEOS_P}LI${LIFEOS_A}FE${LIFEOS_I}OS${RESET} ${SLATE_600}│${RESET} ${_hdr_loc}  ${LIFEOS_TIME}${current_time}${RESET}  ${LIFEOS_WEATHER}${weather_str}${RESET} ${SLATE_600}${_hdr_dashes}${RESET}\n"
fi
printf "${SLATE_600}%s${RESET}\n" "$SEP_DASHED"

# ═══════════════════════════════════════════════════════════════════════════════
# LINE: STATE METER — dimension meters toward Ideal State
# Reads LIFEOS/USER/TELOS/LIFEOS_STATE.json (written by ComputeGap.ts on a schedule).
# Falls back to placeholder values if the state file is missing.
# Format: STATE: HEALTH 68%│CREATIVITY 31%│FREEDOM 78%│RELS 84%│FIN 42%
# ═══════════════════════════════════════════════════════════════════════════════

_dim_color() {
    # Blue-family gradient — navy → light blue across the five Human-3.0 dims.
    case "$1" in
        health)        printf '\033[38;2;56;189;248m' ;;   # sky — bright cyan-blue
        creative)      printf '\033[38;2;165;180;252m' ;;  # indigo-light
        freedom)       printf '\033[38;2;147;197;253m' ;;  # light blue
        relationships) printf '\033[38;2;96;165;250m' ;;   # medium-light
        finances)      printf '\033[38;2;37;99;235m' ;;    # royal blue
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

_LIFEOS_STATE_JSON="$LIFEOS_DIR/USER/TELOS/LIFEOS_STATE.json"
# Five Human-3.0 surface dimensions. creative + freedom render as separate
# columns (CREATIVITY, FREEDOM) — unabridged words. finances reads from
# .dimensions.finances first, falling back to .dimensions.money for back-compat
# with existing TELOS files.
_dims=(health creative freedom relationships finances)
_labels=(HEALTH CREATIVITY FREEDOM RELS FIN)
# Fresh installs have no TELOS data yet — show N/A so the line reads "no signal"
# instead of misleadingly looking like real numbers. ComputeGap.ts populates
# LIFEOS_STATE.json once the user runs /interview and rates dimensions.
declare -a _pcts=(N/A N/A N/A N/A N/A)

if [ -f "$_LIFEOS_STATE_JSON" ]; then
    IFS=$'\t' read -r _state_health _state_creative _state_freedom _state_relationships _state_finances _state_money <<< "$(
        jq -r '[.dimensions.health.pct // "", .dimensions.creative.pct // "", .dimensions.freedom.pct // "", .dimensions.relationships.pct // "", .dimensions.finances.pct // "", .dimensions.money.pct // ""] | @tsv' "$_LIFEOS_STATE_JSON" 2>/dev/null
    )"
    # Health
    [ -n "$_state_health" ] && [ "$_state_health" != "null" ] && _pcts[0]="${_state_health%%.*}"
    # Creativity (was averaged with freedom; now its own cell)
    [ -n "$_state_creative" ] && [ "$_state_creative" != "null" ] && _pcts[1]="${_state_creative%%.*}"
    # Freedom (was averaged with creative; now its own cell)
    [ -n "$_state_freedom" ] && [ "$_state_freedom" != "null" ] && _pcts[2]="${_state_freedom%%.*}"
    # Relationships
    [ -n "$_state_relationships" ] && [ "$_state_relationships" != "null" ] && _pcts[3]="${_state_relationships%%.*}"
    # Finances — prefer .dimensions.finances, fall back to .dimensions.money
    if [ -n "$_state_finances" ] && [ "$_state_finances" != "null" ]; then
        _pcts[4]="${_state_finances%%.*}"
    elif [ -n "$_state_money" ] && [ "$_state_money" != "null" ]; then
        _pcts[4]="${_state_money%%.*}"
    fi
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

# ═══════════════════════════════════════════════════════════════════════════════
# MODE — current session's LifeOS mode + four-level intelligence level.
# Renders directly below STATE, above MEMORY. Sources (read-only, every tick):
#   1. work.json .sessions[] row matching this session_id (sessionUUID equality,
#      latest updatedAt wins) → currentMode (minimal|native|algorithm) + effort (E1-E5)
#   2. effort-router.jsonl (classifier telemetry) → tier fallback for the window
#      between classification and the ISA scaffold writing `effort`
# Level is ROUTING-derived per the Four-Level Model (OPERATIONAL_RULES.md):
#   ALGORITHM E4/E5 → MAX; ALGORITHM E1–E3, NATIVE, MINIMAL → HIGH.
# (Not main-loop-model-derived — the MODEL line already shows the literal model.)
# No row / no data → "NA" with level "—".
# ═══════════════════════════════════════════════════════════════════════════════

_pm_work_json="$LIFEOS_DIR/MEMORY/STATE/work.json"
_pm_router_log="$LIFEOS_DIR/MEMORY/OBSERVABILITY/effort-router.jsonl"
_pai_mode="NA"; _pai_tier=""; _pai_level="—"

if [ -n "$session_id" ] && [ -f "$_pm_work_json" ]; then
    # updatedAt arrives in two formats — UTC "...Z" (most writers) and local
    # "...-07:00" (legacy SessionCleanup stamps). Raw string sort across the
    # two picks stale rows (a Z-format algorithm row lexically beats a newer
    # offset-format native row), lighting ALGORITHM during NATIVE sessions.
    # Parse to epoch before sorting, and prefer live (non-complete) rows.
    IFS=$'\t' read -r _pm_mode _pm_effort <<< "$(jq -r --arg sid "$session_id" '
        def toepoch:
          if . == null or . == "" then 0
          else
            (capture("(?<d>\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2})(\\.\\d+)?(?<tz>Z|[+-]\\d{2}:\\d{2})?") // null) as $m
            | if $m == null then 0
              else
                ($m.d + "Z" | fromdateiso8601) as $base
                | (if ($m.tz // "Z") == "Z" then 0
                   else
                     ($m.tz[0:3] | tonumber) as $h
                     | ($m.tz[4:6] | tonumber) as $mm
                     | ($h * 3600) + ((if $m.tz[0:1] == "-" then -1 else 1 end) * $mm * 60)
                   end) as $off
                | $base - $off
              end
          end;
        .sessions // {} | to_entries | map(.value)
        | map(select(.sessionUUID == $sid))
        | (map(select((.phase // "") != "complete"))) as $live
        | (if ($live | length) > 0 then $live else . end)
        | sort_by(.updatedAt // "" | toepoch) | last
        | if . == null then "" else [(.currentMode // ""), (.effort // "")] | @tsv end
    ' "$_pm_work_json" 2>/dev/null)"
    case "${_pm_mode:-}" in
        algorithm)
            _pai_mode="ALGORITHM"
            case "${_pm_effort:-}" in
                E[1-5]) _pai_tier="$_pm_effort" ;;
                *)
                    # Tier not yet in work.json (pre-ISA window) — fall back to the
                    # classifier's last telemetry entry for this session.
                    if [ -f "$_pm_router_log" ]; then
                        _pm_rt=$(tail -200 "$_pm_router_log" 2>/dev/null | \
                            jq -r --arg sid "$session_id" 'select(.session_id == $sid) | .tier // empty' 2>/dev/null | tail -1)
                        case "${_pm_rt:-}" in
                            [1-5]) _pai_tier="E${_pm_rt}" ;;
                        esac
                    fi
                    ;;
            esac
            ;;
        native)  _pai_mode="NATIVE" ;;
        minimal) _pai_mode="MINIMAL" ;;
    esac
fi

# MINIMAL maps to NA — the principal's enumeration is NA/Native/Algorithm;
# minimal turns have no ideal state in play, so no mode is "active".
[ "$_pai_mode" = "MINIMAL" ] && _pai_mode="NA"

# LEVEL reflects the harness's LIVE reasoning effort, straight from the
# statusline stdin `effort.level` field (low|medium|high|xhigh|max) — it tracks
# mid-session `/effort` changes. Ultracode is NOT a distinct effort value: the
# harness reports it as `xhigh`, so we detect it via output_style and promote to
# ULTRA. When the model doesn't report effort (field absent), fall back to the old
# LifeOS-mode-derived level so nothing regresses on unsupported models.
case "$(printf '%s' "${effort_level:-}" | tr '[:upper:]' '[:lower:]')" in
    low)    _pai_level="LOW" ;;
    medium) _pai_level="MEDIUM" ;;
    high)   _pai_level="HIGH" ;;
    xhigh)  _pai_level="XHIGH" ;;
    max)    _pai_level="MAX" ;;
    *)
        # No live effort value — derive from LifeOS mode (legacy behavior).
        case "$_pai_mode" in
            ALGORITHM)
                case "$_pai_tier" in
                    E4|E5) _pai_level="MAX" ;;
                    *)     _pai_level="HIGH" ;;
                esac
                ;;
            NATIVE) _pai_level="HIGH" ;;
            *)      _pai_level="" ;;
        esac
        ;;
esac
# Ultracode promotion: reports as xhigh in effort.level, but the active output
# style names it. Promote XHIGH → ULTRA when ultracode is the live output style.
case "$(printf '%s' "${output_style:-}" | tr '[:upper:]' '[:lower:]')" in
    *ultracode*) _pai_level="ULTRA" ;;
esac

# Active colors per token; inactive tokens render in muted SLATE_600.
# Tier digits and levels use intensity ramps within one family —
# brighter = higher tier / higher level.
_pm_dim="$SLATE_600"
_pm_na_c="$SLATE_400"                       # N/A active — grey
_pm_native_c="$EMERALD"                     # NATIVE active — emerald (distinct from algorithm violet)
_pm_algo_c="$LEARN_PRIMARY"                 # ALGORITHM word active — violet
# Algorithm tier digit ramp: violet-600 → violet-200 (1 dimmest, 5 brightest)
_pm_tier_c() {
    case "$1" in
        1) printf '\033[38;2;124;58;237m' ;;
        2) printf '\033[38;2;139;92;246m' ;;
        3) printf '\033[38;2;167;139;250m' ;;
        4) printf '\033[38;2;196;181;253m' ;;
        5) printf '\033[38;2;221;214;254m' ;;
    esac
}
# Intelligence level ramp: heat scale — green → yellow → orange → red, then
# purple apex for ULTRA (LOW coolest; XHIGH sits between HIGH and MAX; ULTRA the apex)
_pm_level_c() {
    case "$1" in
        LOW)    printf '\033[38;2;74;222;128m' ;;
        MEDIUM) printf '\033[38;2;250;204;21m' ;;
        HIGH)   printf '\033[38;2;251;146;60m' ;;
        XHIGH)  printf '\033[38;2;249;115;22m' ;;
        MAX)    printf '\033[38;2;239;68;68m' ;;
        ULTRA)  printf '\033[38;2;168;85;247m' ;;
    esac
}

# Dotted divider between STATE and MODE.
printf "${SLATE_600}%s${RESET}\n" "$SEP_DOT"

# Build the enumerated line: every option listed, only the active one colored.
# Icon-only label: ⚙️ leads the work/mode/level line (principal directive
# 2026-06-11 — the previous 🎛️ rendered as a grid fallback glyph in his font).
_pm_line="⚙️  "
if [ "$_pai_mode" = "NA" ]; then _pm_line+="${_pm_na_c}N/A${RESET}"; else _pm_line+="${_pm_dim}N/A${RESET}"; fi
_pm_line+=" "
if [ "$_pai_mode" = "NATIVE" ]; then _pm_line+="${_pm_native_c}NATIVE${RESET}"; else _pm_line+="${_pm_dim}NATIVE${RESET}"; fi
_pm_line+=" "
if [ "$_pai_mode" = "ALGORITHM" ]; then _pm_line+="${_pm_algo_c}ALGORITHM${RESET}"; else _pm_line+="${_pm_dim}ALGORITHM${RESET}"; fi
for _pm_d in 1 2 3 4 5; do
    _pm_line+=" "
    if [ "$_pai_mode" = "ALGORITHM" ] && [ "$_pai_tier" = "E${_pm_d}" ]; then
        _pm_line+="$(_pm_tier_c "$_pm_d")${_pm_d}${RESET}"
    else
        _pm_line+="${_pm_dim}${_pm_d}${RESET}"
    fi
done
# ⚙️ gear on the work-level segment (principal directive — 🎚️ renders as a
# fallback box in his terminal font; the brain icon belongs to MEMORY below).
_pm_line+=" ${SLATE_600}│${RESET} ⚡ ${RESET}"
# Resolve the active level → model name via EFFORT_MODEL in models.ts
# (single source of truth for the level→model lineup; lineup edits show up
# here automatically). Rendered as a ·suffix on the lit token: HIGH·OPUS.
_pm_level_model=""
_pm_models_ts="$LIFEOS_DIR/TOOLS/models.ts"
if [ -n "$_pai_level" ] && [ -f "$_pm_models_ts" ]; then
    _pm_lvl_lc=$(printf '%s' "$_pai_level" | tr '[:upper:]' '[:lower:]')
    _pm_level_model=$(sed -n '/export const EFFORT_MODEL/,/^}/p' "$_pm_models_ts" 2>/dev/null | \
        sed -n "s/^[[:space:]]*${_pm_lvl_lc}:[[:space:]]*\"\([a-z0-9-]*\)\".*/\1/p" | head -1 | tr '[:lower:]' '[:upper:]')
fi
# ── Effort↔tier nudge target (2026-06-29; in-place 2026-06-30) ─────────────────
# Claude Code forbids hooks from SETTING reasoning effort (it's /effort, settings
# effortLevel, --effort, or CLAUDE_CODE_EFFORT_LEVEL only). So the Algorithm tier
# can't auto-apply its target effort — instead make the gap VISIBLE. When the live
# main-loop effort is below the tier's target, mark the target level token IN PLACE
# with an amber ↑ prefix. We do NOT append a second token after the scale: that
# duplicated a label already in the list (e.g. a 2nd XHIGH after ULTRA) and read as
# two active levels at once. Fixed 2026-06-30, principal. Main-loop target map:
# E1 low · E2 medium · E3 high · E4 xhigh · E5 xhigh (xhigh not max — the nudge
# points only at a PERSISTABLE level; `max` is interactive-only). Gated on a real
# stdin effort.level + ALGORITHM mode; ULTRA/MAX are ceiling (no nudge when all-out).
_effort_rank() {
    case "$1" in
        LOW) echo 1 ;; MEDIUM) echo 2 ;; HIGH) echo 3 ;;
        XHIGH) echo 4 ;; MAX) echo 5 ;; ULTRA) echo 5 ;; *) echo 0 ;;
    esac
}
_tgt_level=""
if [ -n "${effort_level:-}" ] && [ "$_pai_mode" = "ALGORITHM" ]; then
    case "$_pai_tier" in
        E1) _tgt_level="LOW" ;;
        E2) _tgt_level="MEDIUM" ;;
        E3) _tgt_level="HIGH" ;;
        E4) _tgt_level="XHIGH" ;;
        E5) _tgt_level="XHIGH" ;;
    esac
    if [ -n "$_tgt_level" ]; then
        _live_rank=$(_effort_rank "$_pai_level")
        _tgt_rank=$(_effort_rank "$_tgt_level")
        # Only a genuine under-power gap lights the target; otherwise clear it so
        # the scale shows exactly one active token (the current level).
        if ! { [ "$_live_rank" -gt 0 ] && [ "$_tgt_rank" -gt "$_live_rank" ]; }; then
            _tgt_level=""
        fi
    fi
fi
_pm_nudge_c=$(printf '\033[38;2;251;191;36m')   # amber-400 — "under-powered, bump up"
for _pm_l in LOW MEDIUM HIGH XHIGH MAX ULTRA; do
    _pm_line+=" "
    if [ "$_pai_level" = "$_pm_l" ]; then
        _pm_line+="$(_pm_level_c "$_pm_l")${_pm_l}${RESET}"        # current effort — solid heat color
    elif [ -n "$_tgt_level" ] && [ "$_tgt_level" = "$_pm_l" ]; then
        _pm_line+="${_pm_nudge_c}↑${_pm_l}${RESET}"               # tier target to type — amber arrow, in place
    else
        _pm_line+="${_pm_dim}${_pm_l}${RESET}"
    fi
done

printf "%b\n" "$_pm_line"

# ═══════════════════════════════════════════════════════════════════════════════
# MEMORY — one line directly under STATE: autonomic-loop health + hot-layer fill.
# Rendered every 1s tick straight from state files (zero model involvement).
# ═══════════════════════════════════════════════════════════════════════════════

_review_state_file="$LIFEOS_DIR/MEMORY/OBSERVABILITY/review-state.json"
_memory_health_file="$LIFEOS_DIR/MEMORY/OBSERVABILITY/memory-health.jsonl"
_memory_config_file="$LIFEOS_DIR/USER/CONFIG/memory-review.json"
_reviewer_runs_file="$LIFEOS_DIR/MEMORY/OBSERVABILITY/reviewer-runs.jsonl"
_principal_memory_file="$LIFEOS_DIR/USER/PRINCIPAL/PRINCIPAL_MEMORY.md"
_da_memory_file="$LIFEOS_DIR/USER/DIGITAL_ASSISTANT/DA_MEMORY.md"

# Short age from epoch-seconds-ago: Nm / Nh / Nd. Empty/negative -> em-dash.
_recency_str() {
    local s="$1" m h d
    { [ -z "$s" ] || [ "$s" -lt 0 ] 2>/dev/null; } && { echo "—"; return; }
    m=$((s / 60)); h=$((m / 60)); d=$((h / 24))
    if   [ "$d" -ge 1 ]; then echo "${d}d"
    elif [ "$h" -ge 1 ]; then echo "${h}h"
    else echo "${m}m"; fi
}

if [ "$MODE" = "normal" ] && [ -f "$_review_state_file" ]; then
    _mem_turns=$(jq -r '.turn_count_since_last_review // 0' "$_review_state_file" 2>/dev/null)
    _mem_pending=$(jq -r '.pending_review // false' "$_review_state_file" 2>/dev/null)
    _mem_last_review=$(jq -r '.last_review_at // ""' "$_review_state_file" 2>/dev/null)
    _mem_threshold=$(jq -r '.turn_threshold // 8' "$_memory_config_file" 2>/dev/null)
    { [ -z "$_mem_threshold" ] || [ "$_mem_threshold" = "null" ]; } && _mem_threshold=8

    # Last-review age
    _mem_age="never"; _mem_age_sec=999999999
    if [ -n "$_mem_last_review" ] && [ "$_mem_last_review" != "null" ]; then
        _then_epoch=$(date -u -j -f "%Y-%m-%dT%H:%M:%S" "${_mem_last_review%.*}" +%s 2>/dev/null || echo "$NOW_EPOCH")
        _mem_age_sec=$((NOW_EPOCH - _then_epoch))
        [ "$_mem_age_sec" -lt 0 ] 2>/dev/null && _mem_age_sec=0
        _mem_age=$(_recency_str "$_mem_age_sec")
    fi

    # Health snapshot
    _mem_health="ok"; _mem_health_detail=""
    if [ -f "$_memory_health_file" ]; then
        _h_row=$(tail -1 "$_memory_health_file" 2>/dev/null)
        if [ -n "$_h_row" ]; then
            _mem_health=$(echo "$_h_row" | jq -r '.overall // "ok"' 2>/dev/null)
            [ -z "$_mem_health" ] && _mem_health="ok"
            _mem_health_detail=$(echo "$_h_row" | jq -r '(.findings[0].message // "")' 2>/dev/null)
        fi
    fi

    # Last reviewer dispatch (for the "just captured" state)
    _mem_dispatched=0; _mem_dispatch_types=""
    if [ -f "$_reviewer_runs_file" ]; then
        _r_row=$(tail -1 "$_reviewer_runs_file" 2>/dev/null)
        if [ -n "$_r_row" ] && [ "$(echo "$_r_row" | jq -r '.ok // false' 2>/dev/null)" = "true" ]; then
            _mem_dispatched=$(echo "$_r_row" | jq -r '.dispatch_summary.succeeded // 0' 2>/dev/null)
            _mem_dispatch_types=$(echo "$_r_row" | jq -r '(.dispatch_summary.by_type // {}) | to_entries | map(.key) | join("+")' 2>/dev/null)
        fi
    fi

    # Capacity % across both _MEMORY.md hot-layer files
    _mem_pct=0
    if [ -f "$_principal_memory_file" ] && [ -f "$_da_memory_file" ]; then
        _p_chars=$(awk '/^---$/{c++; next} c==2 && NF>0 && !/^<!--/ && !/^-->/ {print}' "$_principal_memory_file" 2>/dev/null | wc -c | tr -d ' ')
        _d_chars=$(awk '/^---$/{c++; next} c==2 && NF>0 && !/^<!--/ && !/^-->/ {print}' "$_da_memory_file" 2>/dev/null | wc -c | tr -d ' ')
        _used=$((${_p_chars:-0} + ${_d_chars:-0}))
        _mem_pct=$((_used * 100 / 24576))
    fi

    # ── ONE line, plain English, sage green (2026-06-10 redesign) ──
    # The old two-line display spoke in reviewer internals ("BUILDING ·
    # 3/8 TURNS") that read as noise. New contract: one sentence a human
    # parses cold — what the memory loop is doing and when it acts next.
    # Sage for all healthy states; red/amber kept ONLY for problem states
    # because an alert that doesn't pop isn't an alert.
    _mem_sage='\033[38;2;167;184;148m'
    _mem_color="$_mem_sage"; _mem_line=""
    if [ "$_mem_health" = "critical" ]; then
        _mem_color='\033[38;2;239;68;68m'
        _mem_line="PROBLEM · ${_mem_health_detail:-RUN MEMORYHEALTHCHECK}"
    elif [ "$_mem_health" = "warn" ]; then
        _mem_color='\033[38;2;251;191;36m'
        _mem_line="NEEDS ATTENTION · ${_mem_health_detail:-RUN MEMORYHEALTHCHECK}"
    elif [ "$_mem_age" != "never" ] && [ "$_mem_age_sec" -le 30 ] && [ "$_mem_dispatched" -gt 0 ]; then
        _mem_line="SAVED ${_mem_dispatched} NEW MEMORIES JUST NOW · ${_mem_pct}% FULL"
    elif [ "$_mem_pending" = "true" ]; then
        _mem_line="REVIEW QUEUED, RUNS AT NEXT PAUSE · LAST REVIEW ${_mem_age} AGO"
    elif [ "$_mem_turns" -ge "$_mem_threshold" ]; then
        _mem_line="REVIEW DUE, WAITING FOR A QUIET MOMENT · LAST ${_mem_age} AGO"
    elif [ "$_mem_age" = "never" ]; then
        _mem_line="NO REVIEWS YET · FIRST ONE AFTER ${_mem_threshold} TURNS"
    else
        _mem_line="OK · REVIEWED ${_mem_age} AGO · NEXT IN $((_mem_threshold - _mem_turns)) TURNS · ${_mem_pct}% FULL"
    fi
    _mem_line=$(printf '%s' "$_mem_line" | tr '[:lower:]' '[:upper:]')
    [ ${#_mem_line} -gt 68 ] && _mem_line="${_mem_line:0:67}…"
    # %s passes the text so a literal "%" (e.g. "26% FULL") isn't eaten by printf.
    # Icon-only label (2026-06-11): 🧠 alone, no "MEMORY" text — brain icon per
    # principal preference; the line content carries the meaning.
    printf "🧠  ${_mem_color}%s${RESET}\n" "$_mem_line"
fi

# (Constitutional-file review-grade FRESHNESS line removed 2026-05-28. It graded
# manual `last_reviewed:` recency of SYS/TELOS/PROJ/PRI/DAI/ARCH as A-F letters —
# the wrong signal for "is memory fresh" and illegible to read. Memory health
# now renders as the single 🧠 MEMORY line directly under STATE above; doc-review
# cadence lives in Pulse and `kai insights`.)

sep
# Build harness display: "HAR: Pi 0.73.1" (Pi harness with its own version) or
# "HAR: CC 2.1.150" (running under Claude Code directly — fold cc_version into HAR).
_har_display="${harness_name}"
if [ -n "$harness_version" ] && [ "$harness_version" != "unknown" ]; then
    _har_display="${_har_display} ${harness_version}"
elif [ -n "$cc_version" ] && [ "$cc_version" != "unknown" ]; then
    _har_display="${_har_display} ${cc_version}"
fi
# MODEL shows the ACTIVE model — the one the session's intelligence level
# resolves to via EFFORT_MODEL (computed in the MODE/LEVEL block above:
# HIGH→Opus, MAX→Opus, ...). Falls back to the harness main-loop model
# name when no level is active (N/A session) or models.ts is unreadable.
_model_display="${model_name// context/}"
if [ -n "${_pm_level_model:-}" ]; then
    _model_display="$(printf '%s' "$_pm_level_model" | cut -c1)$(printf '%s' "$_pm_level_model" | cut -c2- | tr '[:upper:]' '[:lower:]')"
fi
printf "${SLATE_400}HARN:${RESET} ${LIFEOS_A}${_har_display}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}MODEL:${RESET} ${LIFEOS_A}${_model_display}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}LIFEOS:${RESET} ${LIFEOS_A}${LIFEOS_VERSION}${RESET} ${SLATE_600}│${RESET} ${SLATE_400}ALGO:${RESET} ${LIFEOS_A}${ALGO_VERSION}${RESET}\n"

# ── AGENTS roster — which model the ROUTER assigns delegated agents at the current
# mode/tier (persistent; "not only the default model, but the models the agents run
# on"). This is the BASE routing posture; the ▸ LIVE line below is the corrector for
# actual dispatches (incl. Core-System Override, which forces max at any tier).
# Distinct from MODEL above (the main-loop orchestrator).
#
# Model LABELS are READ from EFFORT_MODEL/CROSS_VENDOR in models.ts (single source of
# truth) — a lineup flip (e.g. max→opus) re-labels the roster automatically, no edit
# here. Only the tier→level POLICY lives in-script (Algorithm doctrine, not lineup):
# NATIVE/E1–E3 → high; E4/E5 → max; SONNET/HAIKU are the medium/low utility rungs at
# any tier; Forge (cross-vendor) binds at E3+. Keyed off _pai_mode/_pai_tier.
#
# _pm_roster_states: pure, unit-testable. Echoes 5 rung states in fixed rung order
#   "max high medium low forge"  —  2 = primary here   1 = utility rung   0 = off
_pm_roster_states() {
    local mode="$1" tier="$2"
    local maxs=0 highs=0 meds=1 lows=1 forge=0
    case "$mode" in
        ALGORITHM)
            case "$tier" in
                E4|E5) maxs=2;  forge=2 ;;
                E3)    highs=2; forge=2 ;;
                *)     highs=2 ;;                # E1/E2 (or pre-ISA unknown tier)
            esac ;;
        NATIVE) highs=2 ;;
        *)      : ;;                             # NA / MINIMAL — utility rungs only
    esac
    printf '%s %s %s %s %s' "$maxs" "$highs" "$meds" "$lows" "$forge"
}

if [ "$MODE" = "normal" ]; then
    # Resolve rung → model NAME from models.ts (same source the MODEL line + the
    # AgentInvocation hook read). Fallbacks keep the line honest if models.ts is
    # unreadable in a hook-spawn context.
    _pm_models_ts="$LIFEOS_DIR/TOOLS/models.ts"
    _em_block=$(sed -n '/export const EFFORT_MODEL/,/^}/p' "$_pm_models_ts" 2>/dev/null)
    _em_lookup() { printf '%s' "$_em_block" | sed -n "s/^[[:space:]]*$1:[[:space:]]*\"\([a-z0-9-]*\)\".*/\1/p" | head -1 | tr '[:lower:]' '[:upper:]'; }
    _lbl_max=$(_em_lookup max);    _lbl_max="${_lbl_max:-FABLE}"
    _lbl_high=$(_em_lookup high);  _lbl_high="${_lbl_high:-OPUS}"
    _lbl_med=$(_em_lookup medium); _lbl_med="${_lbl_med:-SONNET}"
    _lbl_low=$(_em_lookup low);    _lbl_low="${_lbl_low:-HAIKU}"
    _lbl_forge=$(sed -n '/export const CROSS_VENDOR/,/^}/p' "$_pm_models_ts" 2>/dev/null | sed -n 's/^[[:space:]]*forge:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1 | tr '[:lower:]' '[:upper:]')
    _lbl_forge="${_lbl_forge:-GPT-5.5}"

    read -r _rs_max _rs_high _rs_med _rs_low _rs_forge \
        <<< "$(_pm_roster_states "$_pai_mode" "$_pai_tier")"
    # Colors denote the RUNG (max=violet apex, high=blue, med/low=utility grey,
    # forge=cyan cross-vendor); the label under each is what models.ts binds there.
    _arc_max=$(printf '\033[38;2;192;132;252m')     # violet — apex rung (max)
    _arc_high=$(printf '\033[38;2;59;130;246m')     # blue — high / default rung
    _arc_forge=$(printf '\033[38;2;103;232;249m')   # cyan — cross-vendor (Forge)
    _ar_util="$SLATE_500"                           # muted-legible — utility rungs
    _ar_off="$SLATE_600"                            # dim — not dispatched here
    _ar_tok() {  # $1=state $2=active-color $3=label
        case "$1" in
            2) printf "%b%s${RESET}" "$2" "$3" ;;
            1) printf "%b%s${RESET}" "$_ar_util" "$3" ;;
            *) printf "%b%s${RESET}" "$_ar_off" "$3" ;;
        esac
    }
    _ar_line="${SLATE_400}🤖 AGENTS:${RESET} "
    _ar_line+="$(_ar_tok "$_rs_max"   "$_arc_max"   "$_lbl_max") "
    _ar_line+="$(_ar_tok "$_rs_high"  "$_arc_high"  "$_lbl_high") "
    _ar_line+="$(_ar_tok "$_rs_med"   "$_ar_util"   "$_lbl_med") "
    _ar_line+="$(_ar_tok "$_rs_low"   "$_ar_util"   "$_lbl_low")"
    # Divider: the Claude rungs above are ONE mutually-exclusive ladder (exactly one
    # lit). GPT-5.5 (Forge) is a separate VENDOR running alongside, not a rung — so it
    # sits behind a divider as a "+cross-vendor" add-on, lit only when Forge binds (E3+).
    _ar_line+=" ${SLATE_600}│${RESET} "
    _ar_line+="$(_ar_tok "$_rs_forge" "$_arc_forge" "+$_lbl_forge")"
    printf "%b\n" "$_ar_line"
fi

# Live IN-FLIGHT dispatches — written by AgentInvocation.hook.ts at PreToolUse:Agent
# (level + model resolved through EFFORT_MODEL / CROSS_VENDOR / frontmatter pin),
# removed at PostToolUse. Entries older than 2h are orphans from killed agents — hidden.
# Renders only while at least one agent is in flight; label kept distinct from the
# persistent 🤖 AGENTS roster above (which is the router assignment, never a live claim).
_AGENT_STARTS="$LIFEOS_DIR/MEMORY/OBSERVABILITY/agent-starts.json"
if [ -f "$_AGENT_STARTS" ]; then
    _agents_line=$(jq -r --argjson cutoff "$(( (NOW_EPOCH - 7200) * 1000 ))" '
        [to_entries[] | .value | select(.epoch > $cutoff)
         | .subagent_type + ":" + (.level // "?") + "→" + (.model // "inherited")]
        | unique | join("  ")
    ' "$_AGENT_STARTS" 2>/dev/null)
    if [ -n "$_agents_line" ] && [ "$_agents_line" != "null" ]; then
        printf "${SLATE_400}▸ LIVE:${RESET} ${WIELD_ACCENT}%s${RESET}\n" "$_agents_line"
    fi
fi
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

# Context files line — system prompt (loaded via --append-system-prompt-file)
# plus @imports from CLAUDE.md (v5.0: static files loaded via @imports, not loadAtStartup).
# Each entry annotated with its on-disk size as a percentage of the context window.
# DISPLAY ONLY — only `wc -c` runs against files; content is not re-read or re-loaded.
# Files are sorted by size, largest first.
_ctx_files=()        # plain "name (X.X%)" — used for line-wrap width math
_ctx_files_color=()  # ANSI-colored variant — used for actual output

# Color the percentage value by its size relative to context window.
# Argument is the percentage * 10 (tenths). Spec: <4% green, 4–6% orange, >6% red.
CTX_PCT_GREEN='\033[38;2;22;163;74m'   # emerald-600 — darker than RATING_10
_size_pct_color() {
    local _x10="$1"
    if   [ "$_x10" -gt 60 ]; then echo "$RATING_LOW"      # > 6%  red
    elif [ "$_x10" -ge 40 ]; then echo "$RATING_5"        # 4–6%  orange
    else                          echo "$CTX_PCT_GREEN"   # < 4%  green
    fi
}

# Collect (bytes \t name) pairs so we can sort by bytes before formatting.
_ctx_data=()

_collect_ctx_file() {
    local _f="$1"
    local _name="$2"
    [ -f "$_f" ] || return
    local _b
    _b=$(wc -c < "$_f" 2>/dev/null || echo 0)
    _ctx_data+=("$_b"$'\t'"$_name")
}

# System prompt — loaded once via --append-system-prompt-file at session start.
# Counted here for visibility only; not re-read into context.
_collect_ctx_file "$LIFEOS_DIR/LIFEOS_SYSTEM_PROMPT.md" "LIFEOS_SYSTEM_PROMPT.md"

# CLAUDE.md — auto-loaded by the harness at session start. Display-only so the
# routing table itself shows in FILES alongside its @-imports; not re-read.
_collect_ctx_file "$CLAUDE_HOME/CLAUDE.md" "CLAUDE.md"

# @-imports from CLAUDE.md (paths relative to ~/.claude/)
while IFS= read -r _cf; do
    if [ -n "$_cf" ]; then
        _collect_ctx_file "$CLAUDE_HOME/$_cf" "${_cf##*/}"
    fi
done < <(sed -n 's/^@//p' "$CLAUDE_HOME/CLAUDE.md" 2>/dev/null)

# Sort by bytes descending so largest files lead the list.
_sorted_ctx_data=()
if [ "${#_ctx_data[@]}" -gt 0 ]; then
    while IFS= read -r _line; do
        _sorted_ctx_data+=("$_line")
    done < <(printf '%s\n' "${_ctx_data[@]}" | sort -rn -t$'\t' -k1,1)
fi

# Format each entry with one-decimal percentage of context window, colored by size.
# Track total bytes so we can append a combined-total cell at the end of the line.
_ctx_total_bytes=0
for _entry in "${_sorted_ctx_data[@]}"; do
    _b="${_entry%%$'\t'*}"
    _name="${_entry#*$'\t'}"
    _ctx_total_bytes=$((_ctx_total_bytes + _b))
    # Token approximation: ~4 chars/token for English markdown. Conservative for display.
    _tokens=$((_b / 4))
    # 1-decimal percentage: pct_x10 / 10 = X.X%
    if [ "$context_max" -gt 0 ] 2>/dev/null; then
        _pct_x10=$((_tokens * 1000 / context_max))
    else
        _pct_x10=0
    fi
    _pct_w=$((_pct_x10 / 10))
    _pct_f=$((_pct_x10 % 10))
    _pct_str=$(printf '%d.%d%%' "$_pct_w" "$_pct_f")
    _pct_clr=$(_size_pct_color "$_pct_x10")
    _ctx_files+=("${_name}(${_pct_str})")
    _ctx_files_color+=("${CTX_SECONDARY}${_name}(${RESET}${_pct_clr}${_pct_str}${RESET}${CTX_SECONDARY})${RESET}")
done

# Skills description budget — sum of injected skill description sizes vs the
# Claude Code skill-listing budget (settings.json `skillListingBudgetFraction`,
# default 0.15 = 15% of context window). Single awk pass, session-cached.
# Format: skills(X.X% of budget) — prepended to FILES list at front.
_SKILLS_SIZE_CACHE="/tmp/pai-skills-size-${session_id:-nosess}.sh"
if [ -f "$_SKILLS_SIZE_CACHE" ]; then
    # shellcheck disable=SC1090
    source "$_SKILLS_SIZE_CACHE"
else
    # nullglob: unmatched .plugins glob would otherwise pass as a literal path
    # to awk, which silently emits nothing and zeros the total.
    shopt -s nullglob 2>/dev/null
    _skill_md_files=("$CLAUDE_HOME"/skills/*/SKILL.md "$CLAUDE_HOME"/.plugins/*/skills/*/SKILL.md)
    shopt -u nullglob 2>/dev/null
    if [ "${#_skill_md_files[@]}" -gt 0 ]; then
        _skills_total_bytes=$(awk '
            FNR == 1 { done = 0 }
            /^description:/ && !done {
                line = $0
                sub(/^description:[[:space:]]*"?/, "", line)
                sub(/"[[:space:]]*$/, "", line)
                n = split(FILENAME, parts, "/")
                sname = parts[n-1]
                total += 4 + length(sname) + length(line)
                done = 1
            }
            END { print total + 0 }
        ' "${_skill_md_files[@]}" 2>/dev/null)
    fi
    _skills_total_bytes=${_skills_total_bytes:-0}
    echo "_skills_total_bytes=$_skills_total_bytes" > "$_SKILLS_SIZE_CACHE" 2>/dev/null
fi

# Skills percentage of context window — same denominator as other FILES entries
# and as `/context`'s "Skills" row, so the numbers reconcile across surfaces.
# (The skill-listing budget — settings.json `skillListingBudgetFraction`, default
# 0.15 — is Claude Code's truncation cap; here we report raw context-window
# share to stay legible against /context.)
_skills_tokens=$((_skills_total_bytes / 4))
if [ "$context_max" -gt 0 ] 2>/dev/null; then
    _skills_pct_x10=$((_skills_tokens * 1000 / context_max))
else
    _skills_pct_x10=0
fi
_skills_pct_w=$((_skills_pct_x10 / 10))
_skills_pct_f=$((_skills_pct_x10 % 10))
_skills_pct_str=$(printf '%d.%d%%' "$_skills_pct_w" "$_skills_pct_f")
_skills_pct_clr=$(_size_pct_color "$_skills_pct_x10")

# Prepend SKILLS cell so it leads the FILES list (independent of size sort).
_ctx_files=("SKILLS(${_skills_pct_str})" "${_ctx_files[@]}")
_ctx_files_color=("${CTX_SECONDARY}SKILLS(${RESET}${_skills_pct_clr}${_skills_pct_str}${RESET}${CTX_SECONDARY})${RESET}" "${_ctx_files_color[@]}")

# Skills bytes count toward the FILES total (it IS injected context).
_ctx_total_bytes=$((_ctx_total_bytes + _skills_total_bytes))

# Total cell — combined percentage of all listed files, colored by the same tiers.
_ctx_total_tokens=$((_ctx_total_bytes / 4))
if [ "$context_max" -gt 0 ] 2>/dev/null; then
    _ctx_total_x10=$((_ctx_total_tokens * 1000 / context_max))
else
    _ctx_total_x10=0
fi
_ctx_total_w=$((_ctx_total_x10 / 10))
_ctx_total_f=$((_ctx_total_x10 % 10))
_ctx_total_str=$(printf '%d.%d%%' "$_ctx_total_w" "$_ctx_total_f")
_ctx_total_clr=$(_size_pct_color "$_ctx_total_x10")

_ctx_count=${#_ctx_files[@]}
if [ "$_ctx_count" -gt 0 ]; then
    # No "FILES(N):" label — entries lead directly; their position under the
    # CONTEXT bar makes the category obvious.
    _prefix="  "
    _prefix_len=${#_prefix}
    _indent=$(printf '%*s' "$_prefix_len" '')
    _line_len=$_prefix_len
    _first_file=true
    _output=""

    _idx=0
    for _ct in "${_ctx_files[@]}"; do
        _ct_len=${#_ct}
        _ct_color="${_ctx_files_color[$_idx]}"
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
            _output="${_output}${_ct_color}"
            _first_file=false
        else
            _output="${_output}${SLATE_600},${RESET} ${_ct_color}"
        fi
        _line_len=$((_line_len + _needed))
        _idx=$((_idx + 1))
    done

    # Append total cell: " | (X.X%)" — wrap to next line if it would overflow.
    _total_plain=" | (${_ctx_total_str})"
    _total_color=" ${SLATE_600}|${RESET} ${CTX_SECONDARY}(${RESET}${_ctx_total_clr}${_ctx_total_str}${RESET}${CTX_SECONDARY})${RESET}"
    _total_len=${#_total_plain}
    if [ $((_line_len + _total_len)) -gt "$content_width" ]; then
        _output="${_output}\n${_indent}"
    fi
    _output="${_output}${_total_color}"

    printf "  "
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
# LINE 7: QUOTE (normal mode only)
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$MODE" = "normal" ] && [ -f "$QUOTES_FILE" ]; then
    # Curated corpus, deterministic time-based selection — same quote for each
    # 60-second window, no cache, no network.
    quote_count=$(wc -l < "$QUOTES_FILE" 2>/dev/null | tr -d ' ')
    if [ "${quote_count:-0}" -gt 0 ]; then
        quote_idx=$(( ($(date +%s) / 60) % quote_count + 1 ))
        quote_line=$(awk -v n="$quote_idx" 'NR==n {print; exit}' "$QUOTES_FILE")
        quote_text="${quote_line%%|*}"
        quote_author="${quote_line#*|}"
        if [ -n "$quote_text" ] && [ -n "$quote_author" ] && [ "$quote_text" != "$quote_line" ]; then
            # Byte overhead: opening " + closing " + space + em-dash (3 UTF-8 bytes) = 6
            full_len=$((${#quote_text} + ${#quote_author} + 6))

            if [ "$full_len" -le "$content_width" ]; then
                # Happy path: fits on one line
                printf "${SLATE_400}\"${quote_text}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
            else
                # Multi-line: width-aware wrap at word boundaries.
                # Each wrapped line is bounded by content_width - 2 (room for opening
                # quote on line 1 OR 2-space indent on continuation lines).
                fold_w=$((content_width - 2))
                [ "$fold_w" -lt 20 ] && fold_w=20

                _wrapped=$(printf '%s' "$quote_text" | fold -s -w "$fold_w")

                # Split wrapped output into an array (bash 3.2 compatible)
                _old_ifs="$IFS"
                IFS=$'\n'
                set -f
                _lines=($_wrapped)
                set +f
                IFS="$_old_ifs"
                _n=${#_lines[@]}

                # Print every line except the last; last gets author handling
                _i=0
                while [ "$_i" -lt $((_n - 1)) ]; do
                    _line="${_lines[$_i]% }"  # fold -s leaves a trailing space at breaks
                    if [ "$_i" -eq 0 ]; then
                        printf "${SLATE_400}\"${_line}${RESET}\n"
                    else
                        printf "  ${SLATE_400}${_line}${RESET}\n"
                    fi
                    _i=$((_i + 1))
                done

                # Last line: open quote only if it's also the first line
                _last="${_lines[$((_n - 1))]% }"
                if [ "$_n" -eq 1 ]; then
                    _last_prefix="${SLATE_400}\""
                    _last_indent=""
                    _last_open_len=1
                else
                    _last_prefix="  ${SLATE_400}"
                    _last_indent="  "
                    _last_open_len=0
                fi

                # Length if author sits on same line as last text line:
                # indent(2 or 0) + open_quote(1 or 0) + last + close_quote(1) + space(1) + em-dash(3) + author
                _shared_len=$((${#_last_indent} + _last_open_len + ${#_last} + 1 + 1 + 3 + ${#quote_author}))

                if [ "$_shared_len" -le "$content_width" ]; then
                    # Author fits — share line with last text line
                    printf "${_last_prefix}${_last}\"${RESET} ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
                else
                    # Author would overflow — push to its own indented line
                    printf "${_last_prefix}${_last}\"${RESET}\n"
                    printf "  ${QUOTE_AUTHOR}—${quote_author}${RESET}\n"
                fi
            fi
        fi
    fi
fi
