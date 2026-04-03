# USMetrics Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/USMetrics/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/USMetrics/SKILL.md`.

### Check subdirectories exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/USMetrics/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/USMetrics/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"
```

**Expected:** Both Tools/ and Workflows/ directories present.

### Check tool files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/UpdateSubstrateMetrics.ts" ] && echo "OK UpdateSubstrateMetrics.ts" || echo "MISSING UpdateSubstrateMetrics.ts"
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/FetchFredSeries.ts" ] && echo "OK FetchFredSeries.ts" || echo "MISSING FetchFredSeries.ts"
[ -f "$CLAUDE_DIR/skills/USMetrics/Tools/GenerateAnalysis.ts" ] && echo "OK GenerateAnalysis.ts" || echo "MISSING GenerateAnalysis.ts"
```

**Expected:** All three TypeScript tool files present.

### Check workflow files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/USMetrics/Workflows/UpdateData.md" ] && echo "OK UpdateData.md" || echo "MISSING UpdateData.md"
[ -f "$CLAUDE_DIR/skills/USMetrics/Workflows/GetCurrentState.md" ] && echo "OK GetCurrentState.md" || echo "MISSING GetCurrentState.md"
```

**Expected:** Both workflow files present.

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
if [ -f "$CLAUDE_DIR/skills/USMetrics/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/USMetrics/SKILL.md" | grep -q "^---" && echo "OK SKILL.md frontmatter" || echo "ERROR SKILL.md missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/USMetrics/SKILL.md" && echo "OK SKILL.md has name field" || echo "ERROR SKILL.md missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/USMetrics/SKILL.md" && echo "OK SKILL.md has description" || echo "ERROR SKILL.md missing description"
fi
```

**Expected:** Frontmatter block with name and description fields present.

---

## Dependency Availability (Informational)

These checks are NOT blocking -- the skill installs without these, but workflows require them to function.

```bash
echo "Dependencies:"
command -v bun &>/dev/null && echo "  AVAILABLE bun runtime ($(bun --version))" || echo "  UNAVAILABLE bun runtime (install: curl -fsSL https://bun.sh/install | bash)"
[ -n "$FRED_API_KEY" ] && echo "  AVAILABLE FRED_API_KEY" || echo "  UNAVAILABLE FRED_API_KEY (get key: https://fred.stlouisfed.org/docs/api/api_key.html)"
[ -n "$EIA_API_KEY" ] && echo "  AVAILABLE EIA_API_KEY" || echo "  UNAVAILABLE EIA_API_KEY (get key: https://www.eia.gov/opendata/register.php)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## USMetrics Installation Verification

### Files
- [ ] SKILL.md installed at ~/.claude/skills/USMetrics/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Tools/ directory exists with 3 TypeScript files
- [ ] Workflows/ directory exists with 2 workflow files
- [ ] UpdateSubstrateMetrics.ts present and non-empty
- [ ] FetchFredSeries.ts present and non-empty
- [ ] GenerateAnalysis.ts present and non-empty
- [ ] UpdateData.md present and non-empty
- [ ] GetCurrentState.md present and non-empty

### Dependencies (informational)
- [ ] bun runtime available
- [ ] FRED_API_KEY environment variable set
- [ ] EIA_API_KEY environment variable set

### Functional (manual test)
- [ ] "Update the US metrics" triggers the UpdateData workflow
- [ ] "How is the US economy doing?" triggers the GetCurrentState workflow
- [ ] UpdateData workflow fetches data without errors (requires API keys)
```

---

## Quick Functional Test

After installation, restart Claude Code and try:

```
How is the US economy doing?
```

**Expected behavior:**
- The AI recognizes the USMetrics skill and routes to GetCurrentState
- Analysis is generated from available data
- No errors or crashes

If the skill is not recognized, ensure you restarted Claude Code after installation.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "USMetrics installation verified successfully"
2. **Recommend:** "Try 'How is the US economy doing?' or 'Update the US metrics'"
3. **Note:** "Ensure FRED_API_KEY and EIA_API_KEY are set for live data fetching"
