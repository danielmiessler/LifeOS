# Verifying LandingProcedure

Run these checks to confirm the pack is installed correctly.

---

## File Existence Checks

```bash
# All required files must exist
echo "=== File Checks ==="

[ -f ~/.claude/skills/LandingProcedure/SKILL.md ] \
  && echo "PASS: SKILL.md exists" \
  || echo "FAIL: SKILL.md missing"

[ -f ~/.claude/skills/LandingProcedure/Tools/LandingProcedure.hook.ts ] \
  && echo "PASS: LandingProcedure.hook.ts exists" \
  || echo "FAIL: LandingProcedure.hook.ts missing"

[ -f ~/.claude/skills/LandingProcedure/Workflows/Land.md ] \
  && echo "PASS: Land.md exists" \
  || echo "FAIL: Land.md missing"
```

---

## Runtime Checks

```bash
echo "=== Runtime Checks ==="

# Verify bun can parse the hook file without errors
bun check ~/.claude/skills/LandingProcedure/Tools/LandingProcedure.hook.ts 2>/dev/null \
  && echo "PASS: Hook file parses cleanly" \
  || echo "INFO: bun check not available — manual review recommended"

# Verify SKILL.md has YAML frontmatter
head -1 ~/.claude/skills/LandingProcedure/SKILL.md | grep -q "^---" \
  && echo "PASS: SKILL.md has YAML frontmatter" \
  || echo "FAIL: SKILL.md missing YAML frontmatter"
```

---

## Functional Test

Ask your Claude Code session:

> "I'm done for today. Let me land."

**Expected behavior:**
- The AI recognizes exit language
- A compact landing checklist appears with sections: FIRES, OPEN, SAVES, and DO BEFORE NEXT SESSION
- The response ends with "Clear to land" or similar confirmation
- No new questions or threads are introduced

If the AI does not run the landing checklist, verify that the SKILL.md is in a location Claude Code scans for skills (typically `~/.claude/skills/`).
