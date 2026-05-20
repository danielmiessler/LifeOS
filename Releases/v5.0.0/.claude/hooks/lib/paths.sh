#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Centralized Path Resolution — bash mirror of hooks/lib/paths.ts
#
# Two root directories:
# - Claude home (~/.claude or $CLAUDE_CONFIG_DIR) — Claude Code: settings,
#   skills, hooks, commands, agents
# - PAI_DIR (subpath inside Claude home, default 'PAI') — PAI data: MEMORY,
#   Algorithm, Tools, USER
#
# Sourcing (single form, used everywhere — including inside hooks/):
#   . "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hooks/lib/paths.sh"
# The bootstrap line IS the resolution it implements: same CLAUDE_CONFIG_DIR
# fallback contract, so multi-account configs keep working at source time.
#
# Functions return paths via stdout. assert_absolute prints to stderr and
# returns 1 on failure; callers decide whether to exit.
# ─────────────────────────────────────────────────────────────────────────────

# Idempotent sourcing guard
[ -n "${_PAI_PATHS_SH_LOADED:-}" ] && return 0
_PAI_PATHS_SH_LOADED=1

# expand_path: expand leading $HOME / ${HOME} / ~ to actual $HOME.
# settings.json env values are stored literally; bash callers must expand.
expand_path() {
    local p="$1"
    p="${p/#\$\{HOME\}/$HOME}"
    p="${p/#\$HOME/$HOME}"
    p="${p/#\~/$HOME}"
    printf '%s\n' "$p"
}

# assert_absolute: enforce that a resolved directory is absolute.
# Mirrors paths.ts assertAbsolute(). Prints to stderr and returns 1 on fail.
assert_absolute() {
    local dir="$1" source="$2"
    if [ "${dir#/}" = "${dir}" ]; then
        printf '[paths.sh] %s resolved to a non-absolute path: "%s" (env value likely unexpanded). cwd=%s\n' \
            "$source" "$dir" "$PWD" >&2
        return 1
    fi
    printf '%s\n' "$dir"
}

# get_claude_dir: CLAUDE_CONFIG_DIR (expanded) → $HOME/.claude
get_claude_dir() {
    local dir
    if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then
        dir="$(expand_path "$CLAUDE_CONFIG_DIR")"
    else
        dir="$HOME/.claude"
    fi
    assert_absolute "$dir" "get_claude_dir"
}

# get_pai_dir: PAI_DIR is a SUBPATH relative to Claude home, never absolute.
# join(get_claude_dir(), PAI_DIR ?? 'PAI'). Mirrors paths.ts getPaiDir().
get_pai_dir() {
    local sub="${PAI_DIR:-PAI}"
    # Treat whitespace-only as default
    [ -z "${sub// /}" ] && sub="PAI"
    local claude_dir
    claude_dir="$(get_claude_dir)" || return 1
    assert_absolute "${claude_dir}/${sub}" "get_pai_dir"
}

# get_projects_dir: PROJECTS_DIR (expanded) → $HOME/Projects
get_projects_dir() {
    local dir
    if [ -n "${PROJECTS_DIR:-}" ]; then
        dir="$(expand_path "$PROJECTS_DIR")"
    else
        dir="$HOME/Projects"
    fi
    assert_absolute "$dir" "get_projects_dir"
}

# get_settings_path: settings.json lives in Claude home
get_settings_path() {
    local claude_dir
    claude_dir="$(get_claude_dir)" || return 1
    printf '%s/settings.json\n' "$claude_dir"
}

# get_env_path: authoritative .env at Claude home root
get_env_path() {
    local claude_dir
    claude_dir="$(get_claude_dir)" || return 1
    printf '%s/.env\n' "$claude_dir"
}

# pai_path: join args under PAI_DIR. pai_path "MEMORY" "STATE" → $PAI/MEMORY/STATE
pai_path() {
    local base
    base="$(get_pai_dir)" || return 1
    local out="$base"
    local seg
    for seg in "$@"; do
        out="${out}/${seg}"
    done
    printf '%s\n' "$out"
}

# get_hooks_dir / get_skills_dir / get_memory_dir
get_hooks_dir() {
    local claude_dir
    claude_dir="$(get_claude_dir)" || return 1
    printf '%s/hooks\n' "$claude_dir"
}

get_skills_dir() {
    local claude_dir
    claude_dir="$(get_claude_dir)" || return 1
    printf '%s/skills\n' "$claude_dir"
}

get_memory_dir() {
    pai_path "MEMORY"
}
