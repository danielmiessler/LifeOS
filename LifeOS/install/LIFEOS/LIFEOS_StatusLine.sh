#!/bin/bash
# LifeOS status line. The renderer is LIFEOS/STATUSLINE/Render.ts, one Bun process (see LIFEOS/STATUSLINE/README.md);
# this file stays the entry point settings, the installer and the tests call. Shared data is refreshed by the
# statusline-refresh Workflow, so a render only reads caches. The pre-port bash renderer is in git at d4b212f2f.
# A Windows statusLine.command may hold a backslash path. The pattern *\\* does not match one in Git Bash (MSYS), a quoted variable does.
bs='\'
case "$0" in */*) dir="${0%/*}" ;; *"$bs"*) dir="${0%"$bs"*}" ;; *) dir=. ;; esac
bun="$(command -v bun 2>/dev/null)"
if [ -z "$bun" ]; then
    for b in /opt/homebrew/bin/bun /usr/local/bin/bun "$HOME/.bun/bin/bun" /usr/bin/bun; do
        [ -x "$b" ] && bun="$b" && break
    done
fi
# statusline-fast (STATUSLINE/fast, Rust) replays an unchanged frame without starting Bun and hands every other run to
# Render.ts. It runs only while its proof stamp is newer than the binary and every file in fast/sources; the refresher
# (producers/FastProof.ts) rebuilds and re-proves it after any change. Missing, stale or unproven, Bun renders every run.
fast="$dir/STATUSLINE/fast/target/release/statusline-fast"
if [ -n "$bun" ] && [ -x "$fast" ] && [ "$fast.proven" -nt "$fast" ] && [ -f "$dir/STATUSLINE/fast/sources" ]; then
    proven=1
    while IFS= read -r f || [ -n "$f" ]; do
        [ -n "$f" ] && ! [ "$fast.proven" -nt "$dir/STATUSLINE/$f" ] && proven= && break
    done < "$dir/STATUSLINE/fast/sources"
    [ -n "$proven" ] && exec "$fast" "$bun" "$dir/STATUSLINE/Render.ts"
fi
[ -n "$bun" ] && exec "$bun" "$dir/STATUSLINE/Render.ts"
cat > /dev/null
echo "LifeOS"
