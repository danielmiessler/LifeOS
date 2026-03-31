# Statusline User Extensions

Add custom sections to the PAI statusline without modifying `statusline-command.sh`.

## How It Works

Create `PAI/USER/STATUSLINE/extensions.sh` with two functions:

| Function | Called When | Purpose |
|----------|-----------|---------|
| `user_statusline_prefetch $tmp_dir` | Inside the parallel prefetch block | Fetch data, write variables to `$tmp_dir/user-ext.sh` |
| `user_statusline_display` | After all prefetch results are sourced | Render your custom statusline section |

The main statusline script sources your file, calls your functions at the right points, and sources your prefetch output — all without you touching the core script.

## Available Environment

Your extensions run inside the main statusline context. These variables and functions are available:

| Variable/Function | Type | Description |
|-------------------|------|-------------|
| `$MODE` | var | Terminal width mode: `nano`, `micro`, `mini`, `normal` |
| `$USER_TZ` | var | User timezone from settings.json |
| `$PAI_DIR` | var | PAI root directory |
| `$SETTINGS_FILE` | var | Path to settings.json |
| `$RESET` | var | ANSI reset code |
| `$SLATE_500`, `$SLATE_600` | var | Tailwind-inspired color codes |
| `$USAGE_RESET` | var | Muted label color |
| `get_usage_color $pct` | func | Returns ANSI color for 0-100% (green/yellow/red) |
| `get_mtime $file` | func | Cross-platform file modification time (epoch seconds) |

All variables from other prefetch blocks (usage_*, location_*, etc.) are also available in the display function.

## Minimal Example

```bash
#!/bin/bash
# PAI/USER/STATUSLINE/extensions.sh

MY_ICON='\033[38;2;100;200;150m'
MY_LABEL='\033[38;2;130;210;170m'

user_statusline_prefetch() {
    local tmp_dir="$1"
    # Write any variables your display function needs
    echo "my_value=42" > "$tmp_dir/user-ext.sh"
}

user_statusline_display() {
    local val=${my_value:-0}
    [ "$val" -eq 0 ] && return

    case "$MODE" in
        nano)   printf "${MY_ICON}*${RESET} ${val}\n" ;;
        *)      printf "${MY_ICON}*${RESET} ${MY_LABEL}CUSTOM:${RESET} ${val}\n" ;;
    esac
    printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
}
```

## Real-World Example: ElevenLabs Voice Quota

Show remaining ElevenLabs TTS characters in the statusline. Only displays when `ELEVENLABS_API_KEY` is set in your `.env`:

```bash
#!/bin/bash
# PAI/USER/STATUSLINE/extensions.sh — ElevenLabs voice usage

ELEVENLABS_CACHE="$PAI_DIR/MEMORY/STATE/elevenlabs-cache.json"
ELEVENLABS_CACHE_TTL=300  # 5 minutes

EL_ICON='\033[38;2;130;100;255m'       # Purple
EL_LABEL='\033[38;2;160;130;255m'
EL_VALUE='\033[38;2;200;180;255m'

user_statusline_prefetch() {
    local tmp_dir="$1"

    # Skip entirely if no API key
    if [ -z "${ELEVENLABS_API_KEY:-}" ]; then
        echo -e "el_char_used=0\nel_char_limit=0\nel_reset_unix=0" > "$tmp_dir/user-ext.sh"
        return
    fi

    local el_cache_age=999999
    [ -f "$ELEVENLABS_CACHE" ] && el_cache_age=$(($(date +%s) - $(get_mtime "$ELEVENLABS_CACHE")))

    if [ "$el_cache_age" -gt "$ELEVENLABS_CACHE_TTL" ]; then
        local el_json
        el_json=$(curl -s --max-time 3 \
            -H "xi-api-key: $ELEVENLABS_API_KEY" \
            "https://api.elevenlabs.io/v1/user/subscription" 2>/dev/null)

        if [ -n "$el_json" ] && echo "$el_json" | jq -e '.character_limit' >/dev/null 2>&1; then
            echo "$el_json" | jq '.' > "$ELEVENLABS_CACHE" 2>/dev/null
        fi
    fi

    if [ -f "$ELEVENLABS_CACHE" ]; then
        jq -r '
            "el_char_used=" + (.character_count // 0 | tostring) + "\n" +
            "el_char_limit=" + (.character_limit // 0 | tostring) + "\n" +
            "el_reset_unix=" + (.next_character_count_reset_unix // 0 | tostring)
        ' "$ELEVENLABS_CACHE" > "$tmp_dir/user-ext.sh" 2>/dev/null
    else
        echo -e "el_char_used=0\nel_char_limit=0\nel_reset_unix=0" > "$tmp_dir/user-ext.sh"
    fi
}

user_statusline_display() {
    el_char_used=${el_char_used:-0}
    el_char_limit=${el_char_limit:-0}
    [ "$el_char_limit" -le 0 ] && return

    local el_pct=$((el_char_used * 100 / el_char_limit))
    local el_remaining=$((el_char_limit - el_char_used))
    local el_pct_color
    el_pct_color=$(get_usage_color "$el_pct")

    local el_remaining_fmt
    if [ "$el_remaining" -ge 1000 ]; then
        el_remaining_fmt="$(( el_remaining / 1000 )).$(( (el_remaining % 1000) / 100 ))K"
    else
        el_remaining_fmt="$el_remaining"
    fi

    case "$MODE" in
        nano)
            printf "${EL_ICON}♪${RESET} ${el_pct_color}${el_pct}%%${RESET}\n"
            ;;
        micro)
            printf "${EL_ICON}♪${RESET} ${EL_LABEL}VOICE:${RESET} ${el_pct_color}${el_pct}%%${RESET} ${EL_VALUE}${el_remaining_fmt} left${RESET}\n"
            ;;
        mini|normal)
            printf "${EL_ICON}♪${RESET} ${EL_LABEL}VOICE:${RESET} ${el_pct_color}${el_pct}%%${RESET} ${SLATE_600}│${RESET} ${EL_VALUE}${el_char_used}/${el_char_limit} chars${RESET} ${SLATE_600}│${RESET} ${EL_VALUE}${el_remaining_fmt} left${RESET}\n"
            ;;
    esac
    printf "${SLATE_600}────────────────────────────────────────────────────────────────────────${RESET}\n"
}
```

**Output (normal mode):**
```
♪ VOICE: 10% │ 1000/10000 chars │ 9.0K left
────────────────────────────────────────────────────────────────────────
```

## Upgrade Safety

A `SessionStart` hook (`StatuslineExtensions.hook.ts`) automatically checks that the extension wiring is present in `statusline-command.sh`. If an upgrade overwrites the script, the hook re-injects the source line, prefetch call, and display call on next session start. Your `extensions.sh` in `PAI/USER/` is never touched by upgrades.

## Guidelines

- **Gate on missing data.** If your prefetch has no data (missing API key, service down), write zeroed defaults and return early. Your display function should check and produce no output.
- **Respect terminal width.** Use `$MODE` to scale your output. `nano` = minimal, `normal` = full.
- **Cache expensive calls.** Use file-based caching with TTL (see the ElevenLabs example). The prefetch runs on every statusline render.
- **Use the color system.** `get_usage_color` gives consistent green/yellow/red for percentages. Use the existing `$SLATE_*` variables for separators and labels.
- **End with a separator.** Print the `────` line after your section for visual consistency.
