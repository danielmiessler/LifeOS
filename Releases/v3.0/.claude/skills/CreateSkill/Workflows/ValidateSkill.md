# ValidateSkill Workflow

**Purpose:** Check if an existing skill follows the canonical structure with proper TitleCase naming.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the ValidateSkill workflow in the CreateSkill skill to validate skill structure"}' \
  > /dev/null 2>&1 &
```

Running the **ValidateSkill** workflow in the **CreateSkill** skill to validate skill structure...

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
~/.claude/skills/PAI/SkillSystem.md
```

---

## Step 2: Read the Target Skill

```bash
~/.claude/skills/[SkillName]/SKILL.md
```

---

## Step 3: Check TitleCase Naming

### Skill Directory
```bash
ls ~/.claude/skills/ | grep -i [skillname]
```

Verify TitleCase:
- ✓ `Blogging`, `Daemon`, `CreateSkill`
- ✗ `createskill`, `create-skill`, `CREATE_SKILL`

### Workflow Files
```bash
ls ~/.claude/skills/[SkillName]/Workflows/
```

Verify TitleCase:
- ✓ `Create.md`, `UpdateDaemonInfo.md`, `SyncRepo.md`
- ✗ `create.md`, `update-daemon-info.md`, `SYNC_REPO.md`

### Tool Files
```bash
ls ~/.claude/skills/[SkillName]/Tools/
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

---

## Step 6: Check Workflow Files

```bash
ls ~/.claude/skills/[SkillName]/Workflows/
```

Verify:
- Every file uses TitleCase naming
- Every file has a corresponding entry in `## Workflow Routing` section
- Every routing entry points to an existing file
- Routing table names match file names exactly

---

## Step 7: Check Structure

```bash
ls -la ~/.claude/skills/[SkillName]/
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
bun ~/.claude/skills/[SkillName]/Tools/[ToolName].ts --help
```

Verify the tool exposes behavioral configuration via flags:
- Mode flags (--fast, --thorough, --dry-run) where applicable
- Output flags (--format, --quiet, --verbose)
- Resource flags (--model, etc.) if applicable
- Post-processing flags if applicable

### Workflow Intent-to-Flag Mapping

For workflows that call CLI tools, check for intent-to-flag mapping tables:

```bash
grep -l "Intent-to-Flag" ~/.claude/skills/[SkillName]/Workflows/*.md
```

**Required pattern in workflows with CLI tools:**
```markdown
## Intent-to-Flag Mapping

| User Says | Flag | When to Use |
|-----------|------|-------------|
| "fast" | `--model haiku` | Speed priority |
| (default) | `--model sonnet` | Balanced |
```

**Reference:** `~/.claude/skills/PAI/CliFirstArchitecture.md`

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
- [ ] `## Examples` section with 2-3 patterns
- [ ] All workflows have routing entries

### Structure
- [ ] `tools/` directory exists
- [ ] No `backups/` inside skill

### CLI-First Integration (for skills with CLI tools)
- [ ] CLI tools expose configuration via flags (not hardcoded)
- [ ] Workflows that call CLI tools have intent-to-flag mapping tables
- [ ] Flag mappings cover mode, output, and resource selection where applicable

**NON-COMPLIANT** if any check fails. Recommend using CanonicalizeSkill workflow.
