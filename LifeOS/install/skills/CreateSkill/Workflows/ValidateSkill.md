# ValidateSkill Workflow

**Purpose:** Check if an existing skill follows the canonical structure with proper TitleCase naming.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ValidateSkill workflow in the CreateSkill skill to validate skill structure"}' \
  > /dev/null 2>&1 &
```

Running the **ValidateSkill** workflow in the **CreateSkill** skill to validate skill structure...

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
{{LIFEOS_DIR}}/DOCUMENTATION/Skills/SkillSystem.md
```

---

## Step 2: Read the Target Skill

```bash
"${LIFEOS_ROOT}/skills/[SkillName]/SKILL.md"
```

---

## Step 3: Check TitleCase Naming

### Skill Directory
```bash
ls "${LIFEOS_ROOT}/skills/" | grep -i [skillname]
```

Verify TitleCase:
- ✓ `Blogging`, `Daemon`, `CreateSkill`
- ✗ `createskill`, `create-skill`, `CREATE_SKILL`

### Workflow Files
```bash
ls "${LIFEOS_ROOT}/skills/[SkillName]/Workflows/"
```

Verify TitleCase:
- ✓ `Create.md`, `UpdateDaemonInfo.md`, `SyncRepo.md`
- ✗ `create.md`, `update-daemon-info.md`, `SYNC_REPO.md`

### Tool Files
```bash
ls "${LIFEOS_ROOT}/skills/[SkillName]/Tools/"
```

Verify TitleCase:
- ✓ `ManageServer.ts`, `ManageServer.help.md`
- ✗ `manage-server.ts`, `MANAGE_SERVER.ts`

---

## Step 4: Check YAML Frontmatter

Verify the YAML has:

### Single-Line Description with USE WHEN
```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
---
```

**Check for violations:**
- Multi-line description using `|` (WRONG)
- Missing `USE WHEN` keyword (WRONG)
- Separate `triggers:` array in YAML (OLD FORMAT - WRONG)
- Separate `workflows:` array in YAML (OLD FORMAT - WRONG)
- `name:` not in TitleCase (WRONG)

---

## Step 5: Check Markdown Body

Verify the body has:

### Workflow Routing Section
```markdown
## Workflow Routing

**When executing a workflow, output this notification:**

```
Running **WorkflowName** in **SkillName**...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase" | `Workflows/WorkflowOne.md` |
```

**Check for violations:**
- Missing `## Workflow Routing` section
- Workflow names not in TitleCase
- File paths not matching actual file names

### Examples Section
```markdown
## Examples

**Example 1: [Use case]**
```
User: "[Request]"
→ [Action]
→ [Result]
```
```

**Check:** Examples section required (WRONG if missing)

### Gotchas Section
```markdown
## Gotchas

[Known failure modes, API quirks, common mistakes]
```

**Check:** Gotchas section required (WRONG if missing). This is the highest information density in any skill — Anthropic's internal best practice.

### Negative Triggers (for skills with confusable neighbors)

**Check:** If the skill shares vocabulary with other skills, description should include `NOT FOR` clause:
```yaml
description: ... USE WHEN [triggers]. NOT FOR [what this ISN'T for (use SkillName instead)].
```

Common confusable pairs to check: research-style skills (Research vs investigation skills), security-style skills (assessment vs reconnaissance), publishing-style skills (blog vs newsletter)

---

## Step 5a-prelude: Public Release Readiness Check

Every skill ships with the LifeOS public release. Verify the skill is clean of personal/sensitive content:

```bash
rg -i "danielmiessler|unsupervised|ULAdmin|thesurface|human3|ul\.live|/Users/[a-z]+/" "${LIFEOS_ROOT}/skills/[SkillName]/"
```

**Check for violations:**
- Hardcoded secrets, API keys, tokens, bearer credentials (zero tolerance)
- Author name or first-person war stories ("the user reports", "the YYYY-MM bug we hit...")
- Specific project names baked into prose (<product>, <subproduct>, <brand>, etc.) — these belong in `SKILLCUSTOMIZATIONS/`
- User-specific absolute paths (`/Users/<name>/...`) — use `~/` instead
- Personal domain names (<author>.example, <product>.example, <brand>.example) — unless the skill is specifically about operating that domain

**Zero matches = PASS.** Any match = FAIL, recommend moving to `{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/<SkillName>/` or rewriting in generic language.

---

## Step 5a: BPE Compliance Check

Apply the bitter lesson test to the skill's instructions:

- [ ] Each instruction provides knowledge Claude can't derive on its own
- [ ] No instructions compensating for model limitations (format enforcement, CoT scaffolding)
- [ ] Deterministic scripts used where possible instead of prompt-based workarounds
- [ ] SKILL.md is under 500 lines (large skills should use References/ or root context files)

---

## Step 6: Check Workflow Files

```bash
ls "${LIFEOS_ROOT}/skills/[SkillName]/Workflows/"
```

Verify:
- Every file uses TitleCase naming
- Every file has a corresponding entry in `## Workflow Routing` section
- Every routing entry points to an existing file
- Routing table names match file names exactly

---

## Step 7: Check Structure

```bash
ls -la "${LIFEOS_ROOT}/skills/[SkillName]/"
```

Verify:
- `tools/` directory exists (even if empty)
- No `backups/` directory inside skill
- Reference docs at skill root (not in Workflows/)

---

## Step 7a: Check CLI-First Integration (for skills with CLI tools)

**If the skill has CLI tools in `tools/`:**

### CLI Tool Configuration Flags

Check each tool for flag-based configuration:
```bash
bun "${LIFEOS_ROOT}/skills/[SkillName]/Tools/[ToolName].ts" --help
```

Verify the tool exposes behavioral configuration via flags:
- Mode flags (--fast, --thorough, --dry-run) where applicable
- Output flags (--format, --quiet, --verbose)
- Resource flags (--model, etc.) if applicable
- Post-processing flags if applicable

### Workflow Intent-to-Flag Mapping

For workflows that call CLI tools, check for intent-to-flag mapping tables:

```bash
grep -l "Intent-to-Flag" "${LIFEOS_ROOT}/skills/[SkillName]/Workflows/"*.md
```

**Required pattern in workflows with CLI tools:**
```markdown
## Intent-to-Flag Mapping

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast" | `--model haiku` | Speed priority |
| (default) | `--model sonnet` | Balanced |
```

**Reference:** `{{LIFEOS_DIR}}/DOCUMENTATION/Tools/CliFirstArchitecture.md`

---

## Step 8: Report Results

**COMPLIANT** if all checks pass:

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase
- [ ] All workflow files use TitleCase
- [ ] All reference docs use TitleCase
- [ ] All tool files use TitleCase
- [ ] Routing table names match file names

### YAML Frontmatter
- [ ] `name:` uses TitleCase
- [ ] `description:` is single-line with `USE WHEN`
- [ ] No separate `triggers:` or `workflows:` arrays
- [ ] Description under 1024 characters

### Markdown Body
- [ ] `## Workflow Routing` section present
- [ ] `## Gotchas` section present with known failure modes
- [ ] `## Examples` section with 2-3 patterns
- [ ] All workflows have routing entries
- [ ] SKILL.md under 500 lines

### Content Quality (Anthropic Best Practices)
- [ ] Description includes `NOT FOR` clause if confusable with other skills
- [ ] Instructions focus on what breaks Claude's defaults (not stating the obvious)
- [ ] No instructions compensating for model limitations (BPE check)
- [ ] Appropriate degrees of freedom (specific for fragile tasks, flexible for safe ones)

### Public Release Readiness
- [ ] No sensitive content (API keys, tokens, credentials, private URLs)
- [ ] No personal references (author name, project names, personal domains, user-specific absolute paths)
- [ ] Pre-flight grep for personal refs returns zero matches
- [ ] Personal/user-specific content (if any) lives in `SKILLCUSTOMIZATIONS/`, not the skill body

### Structure
- [ ] `Tools/` directory exists
- [ ] No `backups/` inside skill
- [ ] `References/` used appropriately for large skills

### CLI-First Integration (for skills with CLI tools)
- [ ] CLI tools expose configuration via flags (not hardcoded)
- [ ] Workflows that call CLI tools have intent-to-flag mapping tables
- [ ] Flag mappings cover mode, output, and resource selection where applicable

**NON-COMPLIANT** if any check fails. Recommend using CanonicalizeSkill workflow.
