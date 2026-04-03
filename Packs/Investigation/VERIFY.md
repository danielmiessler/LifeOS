# Investigation Skill Verification

> **FOR AI AGENTS:** Complete this checklist AFTER installation. Every file check must pass before declaring the pack installed. Enhancement checks are informational only. OSINT and PrivateInvestigator checks are conditional on which sub-skills the user chose to install.

---

## File Verification

### Check SKILL.md exists

```bash
CLAUDE_DIR="$HOME/.claude"
[ -f "$CLAUDE_DIR/skills/Investigation/SKILL.md" ] && echo "OK SKILL.md" || echo "MISSING SKILL.md"
```

**Expected:** SKILL.md present at `~/.claude/skills/Investigation/SKILL.md`.

### Check OSINT sub-skill directories

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/Investigation/OSINT" ] && echo "OK OSINT/" || echo "MISSING OSINT/"
[ -d "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows" ] && echo "OK OSINT/Workflows/" || echo "MISSING OSINT/Workflows/"
```

**Expected:** Both directories present (if OSINT was selected for installation).

### Check PrivateInvestigator sub-skill directories

```bash
CLAUDE_DIR="$HOME/.claude"
[ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator" ] && echo "OK PrivateInvestigator/" || echo "MISSING PrivateInvestigator/"
[ -d "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows" ] && echo "OK PrivateInvestigator/Workflows/" || echo "MISSING PrivateInvestigator/Workflows/"
```

**Expected:** Both directories present (if PrivateInvestigator was selected for installation).

### Check OSINT files exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "OSINT core files..."
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" ] && echo "OK OSINT/SKILL.md" || echo "MISSING OSINT/SKILL.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SOURCES.JSON" ] && echo "OK SOURCES.JSON" || echo "MISSING SOURCES.JSON"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SOURCES.md" ] && echo "OK SOURCES.md" || echo "MISSING SOURCES.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/EthicalFramework.md" ] && echo "OK EthicalFramework.md" || echo "MISSING EthicalFramework.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Methodology.md" ] && echo "OK Methodology.md" || echo "MISSING Methodology.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/PeopleTools.md" ] && echo "OK PeopleTools.md" || echo "MISSING PeopleTools.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/CompanyTools.md" ] && echo "OK CompanyTools.md" || echo "MISSING CompanyTools.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/EntityTools.md" ] && echo "OK EntityTools.md" || echo "MISSING EntityTools.md"

echo "OSINT workflows..."
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/PeopleLookup.md" ] && echo "OK PeopleLookup.md" || echo "MISSING PeopleLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/CompanyLookup.md" ] && echo "OK CompanyLookup.md" || echo "MISSING CompanyLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/CompanyDueDiligence.md" ] && echo "OK CompanyDueDiligence.md" || echo "MISSING CompanyDueDiligence.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/EntityLookup.md" ] && echo "OK EntityLookup.md" || echo "MISSING EntityLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/DomainLookup.md" ] && echo "OK DomainLookup.md" || echo "MISSING DomainLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/OrganizationLookup.md" ] && echo "OK OrganizationLookup.md" || echo "MISSING OrganizationLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/OSINT/Workflows/DiscoverOSINTSources.md" ] && echo "OK DiscoverOSINTSources.md" || echo "MISSING DiscoverOSINTSources.md"
```

**Expected:** All 15 OSINT files present (if OSINT was selected).

### Check PrivateInvestigator files exist

```bash
CLAUDE_DIR="$HOME/.claude"

echo "PrivateInvestigator core files..."
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" ] && echo "OK PI/SKILL.md" || echo "MISSING PI/SKILL.md"

echo "PrivateInvestigator workflows..."
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/FindPerson.md" ] && echo "OK FindPerson.md" || echo "MISSING FindPerson.md"
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/SocialMediaSearch.md" ] && echo "OK SocialMediaSearch.md" || echo "MISSING SocialMediaSearch.md"
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/PublicRecordsSearch.md" ] && echo "OK PublicRecordsSearch.md" || echo "MISSING PublicRecordsSearch.md"
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/ReverseLookup.md" ] && echo "OK ReverseLookup.md" || echo "MISSING ReverseLookup.md"
[ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/Workflows/VerifyIdentity.md" ] && echo "OK VerifyIdentity.md" || echo "MISSING VerifyIdentity.md"
```

**Expected:** All 6 PrivateInvestigator files present (if PrivateInvestigator was selected).

### Check frontmatter is valid

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Checking top-level SKILL.md..."
if [ -f "$CLAUDE_DIR/skills/Investigation/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/Investigation/SKILL.md" | grep -q "^---" && echo "OK Has frontmatter opener" || echo "ERROR Missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/Investigation/SKILL.md" && echo "OK Has name field" || echo "ERROR Missing name field"
  grep -q "^description:" "$CLAUDE_DIR/skills/Investigation/SKILL.md" && echo "OK Has description field" || echo "ERROR Missing description"
fi

echo "Checking OSINT SKILL.md..."
if [ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" | grep -q "^---" && echo "OK Has frontmatter opener" || echo "ERROR Missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" && echo "OK Has name field" || echo "ERROR Missing name field"
fi

echo "Checking PrivateInvestigator SKILL.md..."
if [ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" ]; then
  head -1 "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" | grep -q "^---" && echo "OK Has frontmatter opener" || echo "ERROR Missing frontmatter"
  grep -q "^name:" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" && echo "OK Has name field" || echo "ERROR Missing name field"
fi
```

**Expected:** All installed SKILL.md files have frontmatter with name fields.

### Check skill content is complete

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Checking top-level routing..."
if [ -f "$CLAUDE_DIR/skills/Investigation/SKILL.md" ]; then
  grep -q "Workflow Routing" "$CLAUDE_DIR/skills/Investigation/SKILL.md" && echo "  OK Has workflow routing" || echo "  ERROR Missing workflow routing"
  grep -q "OSINT" "$CLAUDE_DIR/skills/Investigation/SKILL.md" && echo "  OK References OSINT" || echo "  ERROR Missing OSINT reference"
  grep -q "PrivateInvestigator" "$CLAUDE_DIR/skills/Investigation/SKILL.md" && echo "  OK References PrivateInvestigator" || echo "  ERROR Missing PrivateInvestigator reference"
fi

echo "Checking OSINT content..."
if [ -f "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" ]; then
  grep -q "Workflow Routing" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" && echo "  OK Has workflow routing" || echo "  ERROR Missing workflow routing"
  grep -q "SOURCES.JSON" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" && echo "  OK References SOURCES.JSON" || echo "  ERROR Missing SOURCES.JSON reference"
  grep -q "Authorization" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" && echo "  OK Has authorization requirements" || echo "  ERROR Missing authorization"
  grep -q "EthicalFramework" "$CLAUDE_DIR/skills/Investigation/OSINT/SKILL.md" && echo "  OK References EthicalFramework" || echo "  ERROR Missing EthicalFramework reference"
fi

echo "Checking PrivateInvestigator content..."
if [ -f "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" ]; then
  grep -q "PUBLIC DATA ONLY" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" && echo "  OK Has public data requirement" || echo "  ERROR Missing public data requirement"
  grep -q "FindPerson" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" && echo "  OK References FindPerson workflow" || echo "  ERROR Missing workflow reference"
  grep -q "Confidence Scoring" "$CLAUDE_DIR/skills/Investigation/PrivateInvestigator/SKILL.md" && echo "  OK Has confidence scoring" || echo "  ERROR Missing confidence scoring"
fi
```

**Expected:** All content sections present in installed files.

---

## Enhancement Availability (Informational)

These checks are NOT blocking -- the skill works without these, but investigation capability improves with them.

```bash
CLAUDE_DIR="$HOME/.claude"

echo "Enhancements:"
[ -d "$CLAUDE_DIR/skills/Research" ] && echo "  AVAILABLE Research skill (parallel agent deployment)" || echo "  UNAVAILABLE Research skill (investigations still work, fewer parallel threads)"
[ -d "$CLAUDE_DIR/skills/Agents" ] && echo "  AVAILABLE Agents skill (custom agent composition)" || echo "  UNAVAILABLE Agents skill (uses default agent types)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/OSINT" ] && echo "  AVAILABLE OSINT user customizations" || echo "  INFO No OSINT customizations (optional)"
[ -d "$CLAUDE_DIR/PAI/USER/SKILLCUSTOMIZATIONS/PrivateInvestigator" ] && echo "  AVAILABLE PI user customizations" || echo "  INFO No PI customizations (optional)"
```

---

## Installation Checklist

Mark each item as complete:

```markdown
## Investigation Skill Installation Verification

### Core Files
- [ ] SKILL.md installed at ~/.claude/skills/Investigation/SKILL.md
- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] SKILL.md contains routing for both OSINT and PrivateInvestigator

### OSINT Sub-Skill (if installed)
- [ ] OSINT/SKILL.md installed with workflow routing
- [ ] OSINT/SOURCES.JSON installed (279 sources)
- [ ] OSINT/SOURCES.md installed (readable reference)
- [ ] OSINT/EthicalFramework.md installed
- [ ] OSINT/Methodology.md installed
- [ ] Three tool reference files installed (People, Company, Entity)
- [ ] Seven workflow files installed in OSINT/Workflows/

### PrivateInvestigator Sub-Skill (if installed)
- [ ] PrivateInvestigator/SKILL.md installed
- [ ] Five workflow files installed in PrivateInvestigator/Workflows/

### Functional (manual test)
- [ ] "do OSINT on [target]" triggers the Investigation skill
- [ ] "find [person]" routes to PrivateInvestigator
- [ ] Ethical authorization check fires before investigation begins
```

---

## Quick Functional Test

After installation, test with a simple request:

```
do OSINT on [any well-known company]
```

**Expected behavior:**
- The AI loads the Investigation skill
- Routes to OSINT CompanyLookup workflow
- Requests authorization confirmation before proceeding
- References SOURCES.JSON for available data sources
- Deploys research agents for parallel data collection
- Returns structured company intelligence report

If the skill is not recognized, ensure `~/.claude/skills/Investigation/SKILL.md` exists with valid frontmatter.

---

## Verification Complete

When all file checks pass:

1. **Confirm to user:** "Investigation skill installation verified successfully"
2. **Recommend:** "Try it now: 'do OSINT on [company]' or 'find [person name] from [context]'"
3. **Note:** "All investigations require ethical authorization -- the skill will ask before proceeding"
