#!/usr/bin/env bats
# Path resolution semantics — regression tests for two-domain config (shell).
#
# Architecture reference: PAI/DOCUMENTATION/PAISystemArchitecture.md L18-34
# Plan reference: ~/.claude-vanilla/plans/kind-questing-kernighan.md
#
# Run: bats PAI/lib/paths.bats
#
# Each test runs in a hermetic subshell via `env -u` to guarantee no env
# leakage between tests. Helper is sourced fresh per test. No fixtures.

# shellcheck disable=SC2034  # vars used implicitly by Bats

HELPER="${BATS_TEST_DIRNAME}/paths.sh"

# Run the helper in a clean subshell with the given env, print resolved values.
# Usage: resolve <CLAUDE_CONFIG_DIR_assignment> <PAI_DIR_assignment>
# Each arg is a full assignment like 'CLAUDE_CONFIG_DIR=/opt/claude' or '' to unset.
resolve() {
  env -u CLAUDE_CONFIG_DIR -u PAI_DIR bash -c '
    [ -n "$1" ] && export "$1"
    [ -n "$2" ] && export "$2"
    # shellcheck disable=SC1090
    . "$3" >/dev/null 2>&1 || { echo "SOURCE_FAILED"; exit 99; }
    printf "%s|%s|%s|%s|%s|%s|%s\n" \
      "$CLAUDE_CONFIG_DIR" "$PAI_DIR" "$CLAUDE_SETTINGS_FILE" \
      "$CLAUDE_HOOKS_DIR" "$CLAUDE_SKILLS_DIR" "$PAI_MEMORY_DIR" "$PAI_STATE_DIR"
  ' _ "$1" "$2" "$HELPER"
}

# Run the helper expecting it to fail (relative path validation).
resolve_expect_fail() {
  env -u CLAUDE_CONFIG_DIR -u PAI_DIR bash -c '
    [ -n "$1" ] && export "$1"
    [ -n "$2" ] && export "$2"
    # shellcheck disable=SC1090
    . "$3" >/dev/null 2>&1
  ' _ "$1" "$2" "$HELPER"
}

@test "helper exists at PAI/lib/paths.sh" {
  [ -f "$HELPER" ]
}

@test "both unset → ~/.claude and ~/.claude/PAI" {
  result=$(resolve '' '')
  [ "$result" = "$HOME/.claude|$HOME/.claude/PAI|$HOME/.claude/settings.json|$HOME/.claude/hooks|$HOME/.claude/skills|$HOME/.claude/PAI/MEMORY|$HOME/.claude/PAI/MEMORY/STATE" ]
}

@test "CLAUDE_CONFIG_DIR=/opt/claude, PAI_DIR unset → /opt/claude + /opt/claude/PAI" {
  result=$(resolve 'CLAUDE_CONFIG_DIR=/opt/claude' '')
  [ "$result" = "/opt/claude|/opt/claude/PAI|/opt/claude/settings.json|/opt/claude/hooks|/opt/claude/skills|/opt/claude/PAI/MEMORY|/opt/claude/PAI/MEMORY/STATE" ]
}

@test "CLAUDE_CONFIG_DIR=/b/.claude → no double .claude" {
  result=$(resolve 'CLAUDE_CONFIG_DIR=/b/.claude' '')
  case "$result" in
    /b/.claude/.claude/*) printf 'BUG: double .claude in: %s\n' "$result" >&2; return 1 ;;
  esac
  [ "$(printf '%s\n' "$result" | cut -d'|' -f1)" = "/b/.claude" ]
  [ "$(printf '%s\n' "$result" | cut -d'|' -f2)" = "/b/.claude/PAI" ]
}

@test "PAI_DIR=/data/pai → /data/pai (PAI_DIR wins)" {
  result=$(resolve '' 'PAI_DIR=/data/pai')
  [ "$(printf '%s\n' "$result" | cut -d'|' -f2)" = "/data/pai" ]
  [ "$(printf '%s\n' "$result" | cut -d'|' -f6)" = "/data/pai/MEMORY" ]
}

@test "cross-domain split: CLAUDE_CONFIG_DIR=/b/.claude, PAI_DIR=/a/PAI" {
  result=$(resolve 'CLAUDE_CONFIG_DIR=/b/.claude' 'PAI_DIR=/a/PAI')
  [ "$(printf '%s\n' "$result" | cut -d'|' -f1)" = "/b/.claude" ]
  [ "$(printf '%s\n' "$result" | cut -d'|' -f2)" = "/a/PAI" ]
  [ "$(printf '%s\n' "$result" | cut -d'|' -f3)" = "/b/.claude/settings.json" ]
  [ "$(printf '%s\n' "$result" | cut -d'|' -f6)" = "/a/PAI/MEMORY" ]
}

@test "PAI_DIR=relative/path → helper exits non-zero" {
  run resolve_expect_fail 'CLAUDE_CONFIG_DIR=/opt/claude' 'PAI_DIR=relative/path'
  [ "$status" -ne 0 ]
}

@test "CLAUDE_CONFIG_DIR=relative/path → helper exits non-zero" {
  run resolve_expect_fail 'CLAUDE_CONFIG_DIR=relative/path' ''
  [ "$status" -ne 0 ]
}

@test "PAI_DIR='' (empty) treated as unset → fallback to CLAUDE_CONFIG_DIR/PAI" {
  result=$(resolve 'CLAUDE_CONFIG_DIR=/opt/claude' 'PAI_DIR=')
  [ "$(printf '%s\n' "$result" | cut -d'|' -f2)" = "/opt/claude/PAI" ]
}

@test "PAI_DIR='   ' (whitespace) treated as unset → fallback to CLAUDE_CONFIG_DIR/PAI" {
  result=$(resolve 'CLAUDE_CONFIG_DIR=/opt/claude' 'PAI_DIR=   ')
  [ "$(printf '%s\n' "$result" | cut -d'|' -f2)" = "/opt/claude/PAI" ]
}

@test "version pin exported" {
  ver=$(env -u CLAUDE_CONFIG_DIR -u PAI_DIR bash -c '
    # shellcheck disable=SC1090
    . "$1" >/dev/null 2>&1 || exit 99
    printf "%s" "${PAI_PATHS_LIB_VERSION:-MISSING}"
  ' _ "$HELPER")
  [ "$ver" = "1" ]
}

@test "idempotent: sourcing twice produces same result" {
  result=$(env -u CLAUDE_CONFIG_DIR -u PAI_DIR bash -c '
    export CLAUDE_CONFIG_DIR=/opt/claude
    # shellcheck disable=SC1090
    . "$1" >/dev/null 2>&1
    first="$PAI_DIR"
    # shellcheck disable=SC1090
    . "$1" >/dev/null 2>&1
    second="$PAI_DIR"
    [ "$first" = "$second" ] && printf OK || printf MISMATCH
  ' _ "$HELPER")
  [ "$result" = "OK" ]
}
