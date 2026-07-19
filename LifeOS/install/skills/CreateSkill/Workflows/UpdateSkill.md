# UpdateSkill Workflow

**Purpose:** Add workflows or modify an existing skill while maintaining canonical structure and TitleCase naming.

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the UpdateSkill workflow in the CreateSkill skill to modify existing skill"}' \
  > /dev/null 2>&1 &
```

Running the **UpdateSkill** workflow in the **CreateSkill** skill to modify existing skill...

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
$LIFEOS_DIR/SkillSystem.md
```

---

## Step 2: Read the Current Skill

```bash
$LIFEOS_ROOT/skills/[SkillName]/SKILL.md
```

Understand the current:
- Description (single-line with USE WHEN)
- Workflow routing (in markdown body)
- Existing TitleCase naming

---

## Step 3: Understand the Update

What needs to change?
- Adding a new workflow?
- Modifying the description/triggers?
- Updating documentation?

---

## Step 4: Make Changes

### To Add a New Workflow:

1. **Determine TitleCase name:**
   - ✓ `Create.md`, `UpdateDaemonInfo.md`, `SyncRepo.md`
   - ✗ `create.md`, `update-daemon-info.md`, `SYNC_REPO.md`

2. **Create the workflow file:**
```bash
touch $LIFEOS_ROOT/skills/[SkillName]/Workflows/[WorkflowName].md
```

Example:
```bash
touch $LIFEOS_ROOT/skills/_DAEMON/Workflows/UpdatePublicRepo.md
```

3. **Add entry to `## Workflow Routing` section in SKILL.md:**
```markdown
## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **ExistingWorkflow** | "existing trigger" | `Workflows/ExistingWorkflow.md` |
| **NewWorkflow** | "new trigger" | `Workflows/NewWorkflow.md` |
```

4. **Write the workflow content**

### To Update Triggers:

Modify the single-line `description` in YAML frontmatter:
```yaml
description: [What it does]. USE WHEN [updated intent triggers using OR]. [Capabilities].
```

### To Add a Tool:

1. **Create TitleCase tool file:**
```bash
touch $LIFEOS_ROOT/skills/[SkillName]/Tools/ToolName.ts
touch $LIFEOS_ROOT/skills/[SkillName]/Tools/ToolName.help.md
```

2. **Ensure Tools/ directory exists:**
```bash
mkdir -p $LIFEOS_ROOT/skills/[SkillName]/Tools
```

---

## Step 5: Verify TitleCase

After making changes, verify naming:

```bash
ls $LIFEOS_ROOT/skills/[SkillName]/Workflows/
ls $LIFEOS_ROOT/skills/[SkillName]/Tools/
```

All files must use TitleCase:
- ✓ `WorkflowName.md`
- ✓ `ToolName.ts`, `ToolName.help.md`
- ✗ `workflow-name.md`, `tool_name.ts`

---

## Step 6: Final Checklist

### Naming
- [ ] New workflow files use TitleCase
- [ ] New tool files use TitleCase
- [ ] Routing table names match file names exactly

### Structure
- [ ] YAML still has single-line description with USE WHEN
- [ ] No separate `triggers:` or `workflows:` arrays in YAML
- [ ] Markdown body has `## Workflow Routing` section
- [ ] All routes point to existing files
- [ ] New workflow files have routing entries

---

## Step 7: Version Awareness

Classify this change (patch / feature / major — see `## Versioning` in SKILL.md). Both the skill's own `version:` and the OS roll-up are applied at private-sync time by the `<your-release-skill>` `UpdateKaiRepo` ship flow (per-skill via `BumpSkillVersions.ts`) — do NOT hand-bump `version:` here, and CreateSkill never edits `LIFEOS/VERSION` directly. A rename or a removed/broken workflow is a **major** change — stop and confirm first.

## Done

Skill updated while maintaining canonical structure and TitleCase naming.
