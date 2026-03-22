# BreadcrumbMining Verification

> **FOR AI AGENTS:** Complete after installation. All file checks must pass.

---

## File Verification

```bash
CLAUDE_DIR="$HOME/.claude"

[ -f "$CLAUDE_DIR/skills/BreadcrumbMining/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
[ -f "$CLAUDE_DIR/skills/BreadcrumbMining/Methodology.md" ] && echo "OK Methodology.md" || echo "MISSING Methodology.md"
[ -d "$CLAUDE_DIR/skills/BreadcrumbMining/Tools" ] && echo "OK Tools/" || echo "MISSING Tools/"
[ -d "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows" ] && echo "OK Workflows/" || echo "MISSING Workflows/"

for tool in breadcrumb-mine.ts breadcrumb-tag.ts; do
  if [ -f "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/$tool" ]; then
    [ -x "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/$tool" ] && echo "OK $tool (executable)" || echo "WARNING $tool not executable"
  else
    echo "MISSING $tool"
  fi
done

for wf in Mine.md Tag.md Review.md; do
  [ -f "$CLAUDE_DIR/skills/BreadcrumbMining/Workflows/$wf" ] && echo "OK $wf" || echo "MISSING $wf"
done
```

## Runtime Verification

```bash
CLAUDE_DIR="$HOME/.claude"
bun "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-mine.ts" 2>&1 | head -3
echo "---"
bun "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts" 2>&1 | head -3
```

**Expected:** Each tool prints usage help, not a crash.

## Functional Test

```bash
# Tag a test breadcrumb
bun "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts" "test breadcrumb - installation verified"
# Review it
bun "$CLAUDE_DIR/skills/BreadcrumbMining/Tools/breadcrumb-tag.ts" --review --last 1
```

**Expected:** Tag is captured and visible in review.
