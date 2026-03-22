# Mirror Engine -- Verification

Run these checks to confirm Mirror Engine is installed correctly.

---

## File Existence Checks

```bash
echo "=== Mirror Engine Verification ==="
echo ""

# Core skill file
test -f ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: SKILL.md exists" || echo "FAIL: SKILL.md missing"

# Workflow files
test -f ~/.claude/skills/Thinking/Mirror/src/Workflows/Witness.md && echo "PASS: Witness.md exists" || echo "FAIL: Witness.md missing"
test -f ~/.claude/skills/Thinking/Mirror/src/Workflows/Mirror.md && echo "PASS: Mirror.md exists" || echo "FAIL: Mirror.md missing"
test -f ~/.claude/skills/Thinking/Mirror/src/Workflows/Architect.md && echo "PASS: Architect.md exists" || echo "FAIL: Architect.md missing"
test -f ~/.claude/skills/Thinking/Mirror/src/Workflows/Indexer.md && echo "PASS: Indexer.md exists" || echo "FAIL: Indexer.md missing"

# Data files
test -f ~/.claude/skills/Thinking/Mirror/src/Data/concepts.json && echo "PASS: concepts.json exists" || echo "FAIL: concepts.json missing"
```

---

## Content Checks

```bash
# Verify SKILL.md has required frontmatter
grep -q "^name: Mirror" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: SKILL.md has correct name" || echo "FAIL: SKILL.md missing name field"

# Verify SKILL.md has workflow routing table
grep -q "Workflow Routing" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Workflow routing table present" || echo "FAIL: Workflow routing table missing"

# Verify all four modes are referenced
grep -q "Witness" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Witness mode referenced" || echo "FAIL: Witness mode not found"
grep -q "Mirror" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Mirror mode referenced" || echo "FAIL: Mirror mode not found"
grep -q "Architect" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Architect mode referenced" || echo "FAIL: Architect mode not found"
grep -q "Indexer" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Indexer mode referenced" || echo "FAIL: Indexer mode not found"

# Verify concepts.json is valid JSON
python3 -c "import json; json.load(open('$HOME/.claude/skills/Thinking/Mirror/src/Data/concepts.json'))" 2>/dev/null && echo "PASS: concepts.json is valid JSON" || echo "FAIL: concepts.json is not valid JSON"
```

---

## Functional Test

```bash
# Verify the skill can be discovered by checking USE WHEN triggers in SKILL.md
grep -c "USE WHEN" ~/.claude/skills/Thinking/Mirror/src/SKILL.md | xargs -I{} echo "PASS: {} USE WHEN trigger block(s) found in SKILL.md"

# Verify failure modes are documented
FAIL_MODES=$(grep -c "DRIFT\|OVERINTERPRETATION\|QUESTION SPAM\|SUMMARY FLATTENING\|FLOW RUPTURE\|FALSE INSIGHT" ~/.claude/skills/Thinking/Mirror/src/SKILL.md)
echo "PASS: $FAIL_MODES failure mode references found in SKILL.md"

# Verify interaction loop is defined
grep -q "Mirror Interaction Loop" ~/.claude/skills/Thinking/Mirror/src/SKILL.md && echo "PASS: Core interaction loop defined" || echo "FAIL: Interaction loop missing"

echo ""
echo "=== Verification Complete ==="
```
