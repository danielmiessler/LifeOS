# Context Search Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Data source checks are informational only.

---

## File Verification

### Check command files exist

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/commands/context-search.md" ] && echo "OK context-search.md" || echo "MISSING context-search.md"
[ -f "$CLAUDE_DIR/commands/cs.md" ] && echo "OK cs.md" || echo "MISSING cs.md"
```

**Expected:** At least one command file present (both if user chose "Both").

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"
for cmd in context-search.md cs.md; do
  if [ -f "$CLAUDE_DIR/commands/$cmd" ]; then
    head -1 "$CLAUDE_DIR/commands/$cmd" | grep -q "^---" && echo "OK $cmd frontmatter" || echo "ERROR $cmd missing frontmatter"
    grep -q "^name:" "$CLAUDE_DIR/commands/$cmd" && echo "OK $cmd has name field" || echo "ERROR $cmd missing name field"
    grep -q "^description:" "$CLAUDE_DIR/commands/$cmd" && echo "OK $cmd has description" || echo "ERROR $cmd missing description"
    grep -q "^argument-hint:" "$CLAUDE_DIR/commands/$cmd" && echo "OK $cmd has argument-hint" || echo "ERROR $cmd missing argument-hint"
  fi
done
```

**Expected:** All three frontmatter fields present in each installed file.

### Check command content is complete

```bash
CLAUDE_DIR="$HOME/.claude"
for cmd in context-search.md cs.md; do
  if [ -f "$CLAUDE_DIR/commands/$cmd" ]; then
    echo "Checking $cmd content..."
    grep -q "CONTEXT SEARCH" "$CLAUDE_DIR/commands/$cmd" && echo "  OK Has context search header" || echo "  ERROR Missing context search header"
    grep -q "work.json" "$CLAUDE_DIR/commands/$cmd" && echo "  OK References session registry" || echo "  ERROR Missing session registry search"
    grep -q "MEMORY/WORK" "$CLAUDE_DIR/commands/$cmd" && echo "  OK References work directories" || echo "  ERROR Missing work directory search"
    grep -q "git.*log" "$CLAUDE_DIR/commands/$cmd" && echo "  OK References git history" || echo "  ERROR Missing git history search"
    grep -q "session-names" "$CLAUDE_DIR/commands/$cmd" && echo "  OK References session names" || echo "  ERROR Missing session name search"
    grep -q "PRD.md" "$CLAUDE_DIR/commands/$cmd" && echo "  OK References PRD files" || echo "  ERROR Missing PRD search"
    echo "  All search sources present"
  fi
done
```

**Expected:** All search sources referenced in each command file.

---

## Data Source Availability (Informational)

These checks are NOT blocking — the command works without these, but results improve with them.

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Data sources:"
[ -f "$CLAUDE_DIR/MEMORY/STATE/work.json" ] && echo "  AVAILABLE work.json (session registry)" || echo "  UNAVAILABLE work.json (install PAI for this)"
[ -d "$CLAUDE_DIR/MEMORY/WORK" ] && echo "  AVAILABLE MEMORY/WORK (PRD directory)" || echo "  UNAVAILABLE MEMORY/WORK (install PAI for this)"
[ -f "$CLAUDE_DIR/MEMORY/STATE/session-names.json" ] && echo "  AVAILABLE session-names.json" || echo "  UNAVAILABLE session-names.json (install PAI for this)"
[ -d "$CLAUDE_DIR/.git" ] && echo "  AVAILABLE git history" || echo "  UNAVAILABLE git history"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Context Search Installation Verification

### Files
- [ ] At least one command file installed (context-search.md or cs.md)
- [ ] Command file(s) have valid YAML frontmatter
- [ ] Command file(s) contain all search source sections
- [ ] Command file(s) contain output format template
- [ ] Command file(s) contain dual-mode instructions (standalone and paired)

### Functional (manual test)
- [ ] Typing /context-search [topic] in Claude Code triggers the command
- [ ] Typing /cs [topic] in Claude Code triggers the command (if installed)
- [ ] Command returns structured output or "no matches found"
```

---

## Quick Functional Test

After installation, restart Claude Code and run:

```
/cs test
```

**Expected behavior:**
- The AI searches all available data sources for "test"
- Returns structured results (or "no prior work found on test")
- No errors or crashes

If the command isn't recognized, ensure you restarted Claude Code after installation.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Context Search installation verified successfully"
2. **Recommend:** "Try it now: `/cs` followed by any topic you've worked on"
3. **Note:** "Restart Claude Code if the commands aren't recognized yet"
