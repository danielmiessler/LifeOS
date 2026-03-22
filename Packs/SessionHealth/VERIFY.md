# Verifying SessionHealth

Run these checks to confirm the pack is installed correctly.

---

## File Existence Checks

```bash
echo "=== File Checks ==="

[ -f ~/.claude/skills/SessionHealth/SKILL.md ] \
  && echo "PASS: SKILL.md exists" \
  || echo "FAIL: SKILL.md missing"

[ -f ~/.claude/skills/SessionHealth/Tools/SessionHealthCheck.hook.ts ] \
  && echo "PASS: SessionHealthCheck.hook.ts exists in skills" \
  || echo "FAIL: SessionHealthCheck.hook.ts missing from skills"

[ -f ~/.claude/skills/SessionHealth/Workflows/Monitor.md ] \
  && echo "PASS: Monitor.md exists" \
  || echo "FAIL: Monitor.md missing"

[ -f ~/.claude/hooks/SessionHealthCheck.hook.ts ] \
  && echo "PASS: Hook installed in hooks directory" \
  || echo "FAIL: Hook not installed in hooks directory"
```

---

## Runtime Checks

```bash
echo "=== Runtime Checks ==="

# Verify bun can parse the hook file
bun check ~/.claude/hooks/SessionHealthCheck.hook.ts 2>/dev/null \
  && echo "PASS: Hook file parses cleanly" \
  || echo "INFO: bun check not available — manual review recommended"

# Verify SKILL.md has YAML frontmatter
head -1 ~/.claude/skills/SessionHealth/SKILL.md | grep -q "^---" \
  && echo "PASS: SKILL.md has YAML frontmatter" \
  || echo "FAIL: SKILL.md missing YAML frontmatter"

# Check that bun can execute the hook (dry run with empty stdin)
echo '{}' | timeout 5 bun ~/.claude/hooks/SessionHealthCheck.hook.ts 2>/dev/null
EXIT_CODE=$?
[ $EXIT_CODE -eq 0 ] \
  && echo "PASS: Hook executes without error" \
  || echo "FAIL: Hook exited with code $EXIT_CODE"
```

---

## Functional Test

### Test 1: Turn counter works

```bash
# Write a fake session start (1 hour ago)
echo $(( $(date +%s%3N) - 3600000 )) > /tmp/pai-session-start.txt

# Run the hook with a session ID
echo '{"session_id":"verify-test"}' | bun ~/.claude/hooks/SessionHealthCheck.hook.ts 2>/tmp/shc-verify.log

# Check that turn counter was created
[ -f /tmp/pai-session-turns.json ] \
  && echo "PASS: Turn counter file created" \
  || echo "FAIL: Turn counter file not created"

# Check the count
cat /tmp/pai-session-turns.json

# Clean up test artifacts
rm -f /tmp/pai-session-turns.json /tmp/pai-session-start.txt /tmp/shc-verify.log
echo "Test artifacts cleaned up."
```

### Test 2: Warning fires at threshold

```bash
# Write a fake session start (13 hours ago)
echo $(( $(date +%s%3N) - 46800000 )) > /tmp/pai-session-start.txt

# Run the hook — should produce a critical warning
OUTPUT=$(echo '{"session_id":"verify-test-warn"}' | bun ~/.claude/hooks/SessionHealthCheck.hook.ts 2>/dev/null)
echo "$OUTPUT" | grep -q "CRITICAL" \
  && echo "PASS: Critical warning fires at 13h" \
  || echo "FAIL: No critical warning at 13h — check thresholds"

# Clean up
rm -f /tmp/pai-session-turns.json /tmp/pai-session-start.txt
echo "Test artifacts cleaned up."
```
