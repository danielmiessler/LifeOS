# shellcheck shell=bash
# shellcheck disable=SC2034  # vars used by sourcing scripts
#
# PAI Path Helper — single source of truth for shell scripts.
#
# Architecture L18-34 (PAI/DOCUMENTATION/PAISystemArchitecture.md):
#   CLAUDE_CONFIG_DIR (~/.claude)     — Claude Code: settings, hooks, skills
#   PAI_DIR           (~/.claude/PAI) — PAI data: MEMORY, ALGORITHM, USER
#
# Resolution semantics:
#   CLAUDE_CONFIG_DIR: env (must be absolute) → $HOME/.claude
#   PAI_DIR:           env (must be absolute) → $CLAUDE_CONFIG_DIR/PAI
#
# Empty / whitespace-only env vars are treated as unset.
# Relative paths cause this script to exit non-zero (sourced scripts must
# detect the failure via the `.` / `source` return code).
#
# The two domains are orthogonal once both resolved. PAI_DIR may live
# outside CLAUDE_CONFIG_DIR; the chain above is only the fallback default.
#
# Usage (top of every consuming shell script):
#   . "${CLAUDE_CONFIG_DIR:-${HOME:?HOME unset}/.claude}/PAI/lib/paths.sh"
#
# Idempotent — safe to source multiple times.

PAI_PATHS_LIB_VERSION=1

# --- Trim leading/trailing whitespace; treat result as unset if empty. -----
__pai_paths_trim() {
  local s="$1"
  # Strip leading and trailing whitespace.
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# --- Expand leading $HOME / ${HOME} / ~ -----------------------------------
__pai_paths_expand() {
  local p="$1"
  # shellcheck disable=SC2088,SC2016  # case patterns match literal ~/$HOME/${HOME} prefixes; quoting is intentional
  case "$p" in
    '~'|'~/'*)             printf '%s' "${HOME:?HOME unset}${p#'~'}" ;;
    '$HOME'|'$HOME/'*)     printf '%s' "${HOME:?HOME unset}${p#'$HOME'}" ;;
    '${HOME}'|'${HOME}/'*) printf '%s' "${HOME:?HOME unset}${p#'${HOME}'}" ;;
    *) printf '%s' "$p" ;;
  esac
}

# --- Validate absolute; print error to stderr and return non-zero if not. -
__pai_paths_assert_absolute() {
  local p="$1" name="$2"
  case "$p" in
    /*) return 0 ;;
    *)  printf '%s must be an absolute path, got: %s\n' "$name" "$p" >&2
        return 1 ;;
  esac
}

# --- Resolve CLAUDE_CONFIG_DIR --------------------------------------------
__pai_paths_resolve_claude() {
  local raw trimmed expanded
  raw="${CLAUDE_CONFIG_DIR-}"
  trimmed=$(__pai_paths_trim "$raw")
  if [ -n "$trimmed" ]; then
    expanded=$(__pai_paths_expand "$trimmed")
    __pai_paths_assert_absolute "$expanded" CLAUDE_CONFIG_DIR || return 1
    CLAUDE_CONFIG_DIR="$expanded"
  else
    CLAUDE_CONFIG_DIR="${HOME:?HOME unset}/.claude"
  fi
}

# --- Resolve PAI_DIR ------------------------------------------------------
__pai_paths_resolve_pai() {
  local raw trimmed expanded
  raw="${PAI_DIR-}"
  trimmed=$(__pai_paths_trim "$raw")
  if [ -n "$trimmed" ]; then
    expanded=$(__pai_paths_expand "$trimmed")
    __pai_paths_assert_absolute "$expanded" PAI_DIR || return 1
    PAI_DIR="$expanded"
  else
    PAI_DIR="$CLAUDE_CONFIG_DIR/PAI"
  fi
}

__pai_paths_resolve_claude || return 1 2>/dev/null || exit 1
__pai_paths_resolve_pai    || return 1 2>/dev/null || exit 1

# --- Derived absolutes (computed once; recompute by re-sourcing) ----------
CLAUDE_HOOKS_DIR="$CLAUDE_CONFIG_DIR/hooks"
CLAUDE_SKILLS_DIR="$CLAUDE_CONFIG_DIR/skills"
CLAUDE_SETTINGS_FILE="$CLAUDE_CONFIG_DIR/settings.json"

PAI_MEMORY_DIR="$PAI_DIR/MEMORY"
PAI_STATE_DIR="$PAI_DIR/MEMORY/STATE"
PAI_LEARNING_DIR="$PAI_DIR/MEMORY/LEARNING"
PAI_ALGORITHM_DIR="$PAI_DIR/ALGORITHM"

export CLAUDE_CONFIG_DIR PAI_DIR \
       CLAUDE_HOOKS_DIR CLAUDE_SKILLS_DIR CLAUDE_SETTINGS_FILE \
       PAI_MEMORY_DIR PAI_STATE_DIR PAI_LEARNING_DIR PAI_ALGORITHM_DIR \
       PAI_PATHS_LIB_VERSION
