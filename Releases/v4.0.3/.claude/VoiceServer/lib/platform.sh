#!/usr/bin/env bash
# PAI VoiceServer — shared platform detection and path helpers.
#
# Designed to be sourced by sibling scripts (install.sh, start.sh, stop.sh,
# status.sh, uninstall.sh, menubar/pai-voice.5s.sh). POSIX-leaning bash: no
# associative arrays, no process substitution in function bodies, works under
# `bash` on macOS and Linux/WSL2.
#
# Exports three helpers:
#   pai_is_wsl           — returns 0 iff running inside WSL (any version)
#   pai_log_path         — prints the platform-appropriate log file path
#   pai_port_pids PORT   — prints PIDs listening on PORT (lsof > ss > netstat)
#
# Platform matrix:
#   macOS (darwin): log path = $HOME/Library/Logs/pai-voice-server.log
#                    (byte-identical to pre-refactor literal)
#   Linux + WSL2:   log path = ${XDG_DATA_HOME:-$HOME/.local/share}/pai/logs/pai-voice-server.log
#
# This file is intentionally side-effect free on source — no echo, no exit,
# no directory creation. Callers decide when to mkdir the log directory.

# --------------------------------------------------------------------------
# OS detection
# --------------------------------------------------------------------------

pai_uname_s() {
    uname -s 2>/dev/null || echo "Unknown"
}

pai_is_darwin() {
    [ "$(pai_uname_s)" = "Darwin" ]
}

pai_is_linux() {
    [ "$(pai_uname_s)" = "Linux" ]
}

# pai_is_wsl — true iff /proc/version mentions Microsoft (WSL1 or WSL2).
# Case-insensitive match catches both "Microsoft" (WSL1) and "microsoft" (WSL2).
pai_is_wsl() {
    if ! pai_is_linux; then
        return 1
    fi
    if [ ! -r /proc/version ]; then
        return 1
    fi
    if grep -qi 'microsoft' /proc/version; then
        return 0
    fi
    return 1
}

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

# pai_log_path — prints the absolute log file path for pai-voice-server.
# On macOS preserves the historical ~/Library/Logs location (byte-identical
# to the pre-refactor literal) so the Darwin flow stays untouched.
# On Linux/WSL uses XDG_DATA_HOME with a sane fallback.
pai_log_path() {
    if pai_is_darwin; then
        printf '%s\n' "$HOME/Library/Logs/pai-voice-server.log"
        return 0
    fi
    # Linux or WSL — XDG Base Directory spec.
    local base="${XDG_DATA_HOME:-$HOME/.local/share}"
    printf '%s\n' "$base/pai/logs/pai-voice-server.log"
}

# --------------------------------------------------------------------------
# Port helpers
# --------------------------------------------------------------------------

# pai_port_pids PORT — prints one PID per line that is listening on PORT.
# Tries lsof first (historic behavior on macOS), then ss (iproute2, ubiquitous
# on modern Linux/WSL), then netstat as a last resort. Prints nothing and
# returns 1 if none are available or nothing is listening.
pai_port_pids() {
    local port="$1"
    if [ -z "$port" ]; then
        return 2
    fi

    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids=$(lsof -ti ":${port}" 2>/dev/null)
        if [ -n "$pids" ]; then
            printf '%s\n' "$pids"
            return 0
        fi
    fi

    if command -v ss >/dev/null 2>&1; then
        # ss -H -ltnp sport = :PORT — machine-readable, one line per socket.
        # Extract pid=NNN from users:(("name",pid=NNN,fd=N)).
        local out
        out=$(ss -H -ltnp "sport = :${port}" 2>/dev/null \
              | grep -oE 'pid=[0-9]+' \
              | cut -d= -f2 \
              | sort -u)
        if [ -n "$out" ]; then
            printf '%s\n' "$out"
            return 0
        fi
    fi

    if command -v netstat >/dev/null 2>&1; then
        # netstat -ltnp, extract "PID/program" from the last column.
        local out
        out=$(netstat -ltnp 2>/dev/null \
              | awk -v p=":${port}" '$4 ~ p"$" {print $7}' \
              | cut -d/ -f1 \
              | grep -E '^[0-9]+$' \
              | sort -u)
        if [ -n "$out" ]; then
            printf '%s\n' "$out"
            return 0
        fi
    fi

    return 1
}

# pai_port_in_use PORT — 0 iff something is listening on PORT.
pai_port_in_use() {
    local pids
    pids=$(pai_port_pids "$1") || return 1
    [ -n "$pids" ]
}
