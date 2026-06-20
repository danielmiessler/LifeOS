#!/usr/bin/env bash
# Regression test for SatisfactionCapture.hook.ts inference-failure handling.
#
# Asserts: when the satisfaction classifier fails (here forced by making the
# `claude` executable unavailable so Inference's spawn returns failure), the
# hook writes NO row to ratings.jsonl and logs that it skipped the signal.
#
# Before the fix, the failure branch wrote a placeholder {"rating":5,...} row;
# those accumulate and flatten every running average. This test guards against
# that regression.
#
# Safe by construction: all writes go to a throwaway PAI_DIR under a temp dir;
# the real ~/.claude tree is never touched.
#
# Usage:  bash SatisfactionCapture.failure-path.test.sh   (exit 0 = PASS)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../SatisfactionCapture.hook.ts"
BUN="$(command -v bun || true)"
[ -z "$BUN" ] && { echo "SKIP: bun not found on PATH"; exit 0; }
[ -f "$HOOK" ] && : || { echo "FAIL: hook not found at $HOOK"; exit 1; }

TMP="$(mktemp -d)"
PAIDIR="$TMP/PAI"
RATINGS="$PAIDIR/MEMORY/LEARNING/SIGNALS/ratings.jsonl"
mkdir -p "$PAIDIR"
trap 'rm -rf "$TMP"' EXIT

# Long, non-praise, non-explicit-rating prompt → reaches the inference path.
STDIN='{"prompt":"this is still broken and not what I asked for at all","session_id":"test-failure-path","transcript_path":"/nonexistent-transcript"}'

# env -i with a PATH that excludes the `claude` binary → spawn() fails ENOENT
# → Inference returns success:false → exercises the failure branch deterministically.
printf '%s' "$STDIN" | env -i HOME="$HOME" PATH="/usr/bin:/bin" PAI_DIR="$PAIDIR" "$BUN" "$HOOK" >"$TMP/stdout.log" 2>"$TMP/stderr.log"

ROWS=0
[ -f "$RATINGS" ] && ROWS="$(wc -l < "$RATINGS" | tr -d ' ')"

echo "rows written on inference failure: $ROWS"
echo "stderr:"; grep -i "inference" "$TMP/stderr.log" | sed 's/^/  /' || true

if [ "$ROWS" = "0" ] && grep -q "skipping signal" "$TMP/stderr.log"; then
  echo "PASS — failure path wrote no rating and logged skip."
  exit 0
else
  echo "FAIL — expected 0 rows + a 'skipping signal' log; got rows=$ROWS"
  [ -f "$RATINGS" ] && { echo "unexpected row:"; sed 's/^/  /' "$RATINGS"; }
  exit 1
fi
