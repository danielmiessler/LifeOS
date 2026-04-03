# Security Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Dependency checks are informational only.

---

## File Verification

### Check top-level SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Security/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Security/SKILL.md`.

### Check sub-domain SKILL.md files

```bash
CLAUDE_DIR="$HOME/.claude"
for subdir in Recon WebAssessment PromptInjection SECUpdates AnnualReports; do
  [ -f "$CLAUDE_DIR/skills/Security/$subdir/SKILL.md" ] && echo "OK $subdir/SKILL.md" || echo "MISSING $subdir/SKILL.md"
done
```

**Expected:** All five sub-domain SKILL.md files present.

### Check sub-domain directories exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Recon directories:"
[ -d "$CLAUDE_DIR/skills/Security/Recon/Tools" ] && echo "  OK Recon/Tools/" || echo "  MISSING Recon/Tools/"
[ -d "$CLAUDE_DIR/skills/Security/Recon/Workflows" ] && echo "  OK Recon/Workflows/" || echo "  MISSING Recon/Workflows/"
[ -d "$CLAUDE_DIR/skills/Security/Recon/Data" ] && echo "  OK Recon/Data/" || echo "  MISSING Recon/Data/"

echo "WebAssessment directories:"
[ -d "$CLAUDE_DIR/skills/Security/WebAssessment/Workflows" ] && echo "  OK WebAssessment/Workflows/" || echo "  MISSING WebAssessment/Workflows/"
[ -d "$CLAUDE_DIR/skills/Security/WebAssessment/BugBountyTool" ] && echo "  OK WebAssessment/BugBountyTool/" || echo "  MISSING WebAssessment/BugBountyTool/"
[ -d "$CLAUDE_DIR/skills/Security/WebAssessment/FfufResources" ] && echo "  OK WebAssessment/FfufResources/" || echo "  MISSING WebAssessment/FfufResources/"
[ -d "$CLAUDE_DIR/skills/Security/WebAssessment/OsintTools" ] && echo "  OK WebAssessment/OsintTools/" || echo "  MISSING WebAssessment/OsintTools/"

echo "PromptInjection directories:"
[ -d "$CLAUDE_DIR/skills/Security/PromptInjection/Workflows" ] && echo "  OK PromptInjection/Workflows/" || echo "  MISSING PromptInjection/Workflows/"

echo "SECUpdates directories:"
[ -d "$CLAUDE_DIR/skills/Security/SECUpdates/Workflows" ] && echo "  OK SECUpdates/Workflows/" || echo "  MISSING SECUpdates/Workflows/"
[ -d "$CLAUDE_DIR/skills/Security/SECUpdates/State" ] && echo "  OK SECUpdates/State/" || echo "  MISSING SECUpdates/State/"

echo "AnnualReports directories:"
[ -d "$CLAUDE_DIR/skills/Security/AnnualReports/Tools" ] && echo "  OK AnnualReports/Tools/" || echo "  MISSING AnnualReports/Tools/"
```

**Expected:** All directories present.

### Check frontmatter validity

```bash
CLAUDE_DIR="$HOME/.claude"
for skill_file in \
  "$CLAUDE_DIR/skills/Security/SKILL.md" \
  "$CLAUDE_DIR/skills/Security/Recon/SKILL.md" \
  "$CLAUDE_DIR/skills/Security/WebAssessment/SKILL.md" \
  "$CLAUDE_DIR/skills/Security/PromptInjection/SKILL.md" \
  "$CLAUDE_DIR/skills/Security/SECUpdates/SKILL.md" \
  "$CLAUDE_DIR/skills/Security/AnnualReports/SKILL.md"; do
  if [ -f "$skill_file" ]; then
    basename_dir=$(echo "$skill_file" | sed "s|$CLAUDE_DIR/skills/Security/||")
    head -1 "$skill_file" | grep -q "^---" && echo "OK $basename_dir frontmatter" || echo "ERROR $basename_dir missing frontmatter"
    grep -q "^name:" "$skill_file" && echo "OK $basename_dir has name field" || echo "ERROR $basename_dir missing name field"
    grep -q "^description:" "$skill_file" && echo "OK $basename_dir has description" || echo "ERROR $basename_dir missing description"
  fi
done
```

**Expected:** All six SKILL.md files have valid YAML frontmatter with `name` and `description` fields.

### Check key tool files exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Recon tools:"
for tool in SubdomainEnum.ts PortScan.ts DnsUtils.ts WhoisParser.ts CidrUtils.ts MassScan.ts EndpointDiscovery.ts PathDiscovery.ts; do
  [ -f "$CLAUDE_DIR/skills/Security/Recon/Tools/$tool" ] && echo "  OK $tool" || echo "  MISSING $tool"
done

echo "AnnualReports tools:"
for tool in FetchReport.ts ListSources.ts UpdateSources.ts; do
  [ -f "$CLAUDE_DIR/skills/Security/AnnualReports/Tools/$tool" ] && echo "  OK $tool" || echo "  MISSING $tool"
done
```

**Expected:** All tool files present.

---

## Informational Dependency Checks

These checks are NOT blocking -- the skill works without these, but functionality improves with them.

```bash
echo "External tool availability (informational):"
command -v nmap >/dev/null 2>&1 && echo "  AVAILABLE nmap (port scanning)" || echo "  UNAVAILABLE nmap (install for port scanning)"
command -v ffuf >/dev/null 2>&1 && echo "  AVAILABLE ffuf (web fuzzing)" || echo "  UNAVAILABLE ffuf (install for web fuzzing)"
command -v bun >/dev/null 2>&1 && echo "  AVAILABLE bun (TypeScript tool runtime)" || echo "  UNAVAILABLE bun (install for TypeScript tools)"
command -v python3 >/dev/null 2>&1 && echo "  AVAILABLE python3 (Python tools)" || echo "  UNAVAILABLE python3 (install for Python tools)"

echo ""
echo "PAI integration (informational):"
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/PAI" ] && echo "  AVAILABLE PAI infrastructure" || echo "  UNAVAILABLE PAI infrastructure (skill works standalone)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS" ] && echo "  AVAILABLE Skill customizations directory" || echo "  UNAVAILABLE Skill customizations (defaults will be used)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Security Skill Installation Verification

### Files
- [ ] Top-level SKILL.md installed at ~/.claude/skills/Security/SKILL.md
- [ ] Recon/SKILL.md installed with Tools/, Workflows/, Data/ directories
- [ ] WebAssessment/SKILL.md installed with Workflows/, BugBountyTool/, FfufResources/, OsintTools/
- [ ] PromptInjection/SKILL.md installed with Workflows/ directory
- [ ] SECUpdates/SKILL.md installed with Workflows/, State/ directories
- [ ] AnnualReports/SKILL.md installed with Tools/ directory
- [ ] All SKILL.md files have valid YAML frontmatter

### Functional (manual test)
- [ ] Saying "do recon on example.com" triggers the Recon sub-domain
- [ ] Saying "security updates" triggers the SECUpdates sub-domain
- [ ] Saying "test for prompt injection" triggers the PromptInjection sub-domain
```

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Security skill installation verified successfully"
2. **Recommend:** "Try it now: ask about recon, web testing, prompt injection, security news, or annual reports"
3. **Note:** "Restart Claude Code if the skill isn't recognized yet"
