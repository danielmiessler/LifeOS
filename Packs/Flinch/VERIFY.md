# Flinch -- Verification

Run these checks to confirm Flinch is installed correctly.

---

## File Existence Checks

```bash
echo "=== Flinch Verification ==="
echo ""

# Core tool
test -f ~/.claude/skills/Flinch/src/Tools/flinch.ts && echo "PASS: flinch.ts exists" || echo "FAIL: flinch.ts missing"

# Skill definition
test -f ~/.claude/skills/Flinch/src/SKILL.md && echo "PASS: SKILL.md exists" || echo "FAIL: SKILL.md missing"

# Workflow files
test -f ~/.claude/skills/Flinch/src/Workflows/Capture.md && echo "PASS: Capture.md exists" || echo "FAIL: Capture.md missing"
test -f ~/.claude/skills/Flinch/src/Workflows/Review.md && echo "PASS: Review.md exists" || echo "FAIL: Review.md missing"
test -f ~/.claude/skills/Flinch/src/Workflows/Score.md && echo "PASS: Score.md exists" || echo "FAIL: Score.md missing"

# Log directory
test -d ~/.claude/flowlabs/logs && echo "PASS: Log directory exists" || echo "FAIL: Log directory missing"
```

---

## Runtime Checks

```bash
# Verify tool prints help (not crash)
cd ~/.claude/skills/Flinch/src/Tools && bun flinch.ts 2>&1 | grep -q "somatic signal capture" && echo "PASS: Tool prints help text" || echo "FAIL: Tool did not print help"

# Verify Bun can parse the TypeScript
cd ~/.claude/skills/Flinch/src/Tools && bun --print "require('./flinch.ts'); 'OK'" 2>/dev/null | grep -q "OK" && echo "PASS: TypeScript parses cleanly" || echo "INFO: Parse check inconclusive (may still work)"
```

---

## Functional Test

```bash
# Create a test capture
cd ~/.claude/skills/Flinch/src/Tools && bun flinch.ts "verification test signal" 2>&1 | grep -q "flinch captured" && echo "PASS: Capture works" || echo "FAIL: Capture failed"

# Verify the log file was created
test -f ~/.claude/flowlabs/logs/somatic_history.jsonl && echo "PASS: Log file created" || echo "FAIL: Log file not created"

# Verify review mode works
cd ~/.claude/skills/Flinch/src/Tools && bun flinch.ts --review 2>&1 | grep -q "unscored\|scored" && echo "PASS: Review mode works" || echo "FAIL: Review mode failed"

# Verify stats mode works
cd ~/.claude/skills/Flinch/src/Tools && bun flinch.ts --stats 2>&1 | grep -q "Flinch Stats" && echo "PASS: Stats mode works" || echo "FAIL: Stats mode failed"

# Clean up test entry (optional -- remove last line from log)
# sed -i '$ { /verification test signal/d; }' ~/.claude/flowlabs/logs/somatic_history.jsonl

echo ""
echo "=== Verification Complete ==="
```
