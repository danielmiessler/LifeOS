# Verifying PreCompact Installation

## File Existence Checks

```bash
# Hook file exists and is executable
test -x ~/.claude/hooks/PreCompactStateDump.hook.ts && echo "PASS: Hook installed and executable" || echo "FAIL: Hook not found or not executable"

# Memory state directory exists
test -d ~/.claude/MEMORY/STATE && echo "PASS: Memory state directory exists" || echo "FAIL: Memory state directory missing"

# Settings.json contains PreCompact configuration
grep -q "PreCompact" ~/.claude/settings.json 2>/dev/null && echo "PASS: Hook configured in settings.json" || echo "FAIL: Hook not found in settings.json"
```

## Runtime Checks

```bash
# Verify bun can parse the hook without errors
bun check ~/.claude/hooks/PreCompactStateDump.hook.ts 2>&1 && echo "PASS: Hook parses cleanly" || echo "WARN: Parse check returned errors (may still work at runtime)"

# Verify the hook runs without crashing when given empty input
echo '{}' | bun run ~/.claude/hooks/PreCompactStateDump.hook.ts 2>&1 | head -5
# Expected: "[PreCompact] No input received, skipping" or similar graceful exit

# Check that previous preambles exist (only after the hook has fired at least once)
ls ~/.claude/MEMORY/STATE/precompact-*.md 2>/dev/null && echo "PASS: Preamble files found — hook has fired successfully" || echo "INFO: No preamble files yet — hook has not fired (this is normal on fresh install)"
```

## Expected Behavior

When working correctly:

1. **Before compaction:** You will see `[PreCompact] Context compaction detected -- writing fidelity preamble...` in the Claude Code stderr output
2. **After completion:** A file appears at `~/.claude/MEMORY/STATE/precompact-{timestamp}.md`
3. **Post-compaction:** The AI reads the preamble and maintains conversational continuity — it does not re-ask questions or hedge on prior conclusions

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Hook never fires | PreCompact not configured in settings.json | Add hook entry to settings.json hooks section |
| "No input received" every time | stdin not being passed to hook | Check Claude Code version supports PreCompact hook event |
| Inference failed, raw fallback | Inference module not found | Install PAI inference module or adapt hook to use your LLM API |
| Permission denied | Hook not executable | Run `chmod +x ~/.claude/hooks/PreCompactStateDump.hook.ts` |
| Preamble file is empty | Transcript parsing failed | Check that transcript_path in hook input points to valid JSONL |
