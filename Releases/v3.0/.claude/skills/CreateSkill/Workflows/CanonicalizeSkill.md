# CanonicalizeSkill Workflow

**Purpose:** Restructure an existing skill to match the canonical format with proper naming conventions.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CanonicalizeSkill workflow in the CreateSkill skill to restructure skill"}' \
  > /dev/null 2>&1 &
```

Running the **CanonicalizeSkill** workflow in the **CreateSkill** skill to restructure skill...

---

## Step 1: Read the Authoritative Source

**REQUIRED FIRST:** Read the canonical structure:

```
~/.claude/skills/PAI/SkillSystem.md
```

This defines exactly what "canonicalize" means.

---

## Step 2: Read the Current Skill

```bash
~/.claude/skills/[skill-name]/SKILL.md
```

Identify what's wrong:
- Multi-line description using `|`?
- Separate `triggers:` array in YAML? (OLD FORMAT)
- Separate `workflows:` array in YAML? (OLD FORMAT)
- Missing `USE WHEN` in description?
- Workflow routing missing from markdown body?
- **Workflow files not using TitleCase?**
- **Skill directory not using TitleCase?**

---

## Step 3: Backup

```bash
cp -r ~/.claude/skills/[skill-name]/ ~/.claude/History/Backups/[skill-name]-backup-$(date +%Y%m%d)/
```

**Note:** Backups go to `~/.claude/History/Backups/`, NEVER inside skill directories.

---

## Step 4: Enforce TitleCase Naming

**CRITICAL: All naming must use TitleCase (PascalCase).**

### Skill Directory Name
```
✗ WRONG: createskill, create-skill, create_skill, CREATESKILL
✓ CORRECT: Createskill (or CreateSkill for multi-word)
```

### Workflow File Names
```
✗ WRONG: create.md, CREATE.md, create-skill.md, create_skill.md
✓ CORRECT: Create.md, UpdateDaemonInfo.md, SyncRepo.md
```

### Reference Doc Names
```
✗ WRONG: prosody-guide.md, PROSODY_GUIDE.md
✓ CORRECT: ProsodyGuide.md, SchemaSpec.md, ApiReference.md
```

### Tool Names
```
✗ WRONG: manage-server.ts, MANAGE_SERVER.ts
✓ CORRECT: ManageServer.ts (with ManageServer.help.md)
```

**Rename files if needed:**
```bash
# Example: rename workflow files
cd ~/.claude/skills/[SkillName]/Workflows/
mv create.md Create.md
mv update-info.md UpdateInfo.md
mv sync_repo.md SyncRepo.md
```

---

## Step 5: Enforce Flat Folder Structure

**CRITICAL: Maximum 2 levels deep - `skills/SkillName/Category/`**

### Check for Nested Folders

Scan for folders deeper than 2 levels:

```bash
# Find any folders 3+ levels deep (FORBIDDEN)
find ~/.claude/skills/[SkillName]/ -type d -mindepth 2 -maxdepth 3
```

### ❌ Common Violations to Fix

**Nested Workflows:**
```
✗ WRONG: Workflows/Company/DueDiligence.md
✓ FIX: Workflows/CompanyDueDiligence.md
```

**Nested Templates:**
```
✗ WRONG: Templates/Primitives/Extract.md
✓ FIX: Move to skills/Prompting/Extract.md (templates belong in Prompting)
```

**Nested Tools:**
```
✗ WRONG: Tools/Utils/Helper.ts
✓ FIX: Tools/Helper.ts (or delete if not needed)
```

### Flatten Procedure

1. **Identify nested files**: Find any file 3+ levels deep
2. **Rename for clarity**: `Category/File.md` → `CategoryFile.md`
3. **Move to parent**: Move up one level to proper location
4. **Update references**: Search for old paths and update

**Example:**
```bash
# Before (3 levels - WRONG)
skills/OSINT/Workflows/Company/DueDiligence.md

# After (2 levels - CORRECT)
skills/OSINT/Workflows/CompanyDueDiligence.md
```

**Rule:** If you need to organize many files, use clear filenames NOT subdirectories.

---

## Step 6: Convert YAML Frontmatter

**From old format (WRONG):**
```yaml
---
name: skill-name
description: |
  What the skill does.

triggers:
  - USE WHEN user mentions X
  - USE WHEN user wants to Y

workflows:
  - USE WHEN user wants to A: Workflows/a.md
  - USE WHEN user wants to B: Workflows/b.md
---
```

**To new format (CORRECT):**
```yaml
---
name: SkillName
description: What the skill does. USE WHEN user mentions X OR user wants to Y. Additional capabilities.
---
```

**Key changes:**
- Skill name in TitleCase
- Combine description + triggers into single-line `description` with `USE WHEN`
- Remove `triggers:` array entirely
- Remove `workflows:` array from YAML (moves to body)

---

## Step 6: Add Workflow Routing to Body

Add `## Workflow Routing` section in markdown body:

```markdown
# SkillName

[Description]

## Workflow Routing

**When executing a workflow, output this notification:**

```
Running **WorkflowName** in **SkillName**...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase one" | `Workflows/WorkflowOne.md` |
| **WorkflowTwo** | "trigger phrase two" | `Workflows/WorkflowTwo.md` |

## Examples

[Required examples section]

## [Rest of documentation]
```

**Note:** Workflow names in routing table must match file names exactly (TitleCase).

---

## Step 7: Remove Redundant Routing

If the markdown body already had routing information in a different format, consolidate it into the standard `## Workflow Routing` section. Delete any duplicate routing tables or sections.

---

## Step 8: Ensure All Workflows Are Routed

List workflow files:
```bash
ls ~/.claude/skills/[SkillName]/Workflows/
```

For EACH file:
1. Verify TitleCase naming (rename if needed)
2. Ensure there's a routing entry in `## Workflow Routing`
3. Verify routing entry matches exact file name

---

## Step 9: Add Examples Section

**REQUIRED:** Every skill needs an `## Examples` section with 2-3 concrete usage patterns.

```markdown
## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes WorkflowName workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Different request]"
→ [Process]
→ [Output]
```
```

Place the Examples section after Workflow Routing.

---

## Step 10: Verify

Run checklist:

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase (e.g., `Blogging`, `Createskill`)
- [ ] All workflow files use TitleCase (e.g., `Create.md`, `UpdateInfo.md`)
- [ ] All reference docs use TitleCase (e.g., `ProsodyGuide.md`)
- [ ] All tool files use TitleCase (e.g., `ManageServer.ts`)
- [ ] Routing table workflow names match file names exactly

### YAML Frontmatter
- [ ] `name:` uses TitleCase
- [ ] `description:` is single-line with embedded `USE WHEN` clause
- [ ] No separate `triggers:` or `workflows:` arrays in YAML
- [ ] Description uses intent-based language
- [ ] Description is under 1024 characters

### Markdown Body
- [ ] `## Workflow Routing` section present
- [ ] Routing uses table format with Workflow, Trigger, File columns
- [ ] All workflow files have routing entries
- [ ] `## Examples` section with 2-3 concrete usage patterns

### Structure
- [ ] `tools/` directory exists (even if empty)
- [ ] Workflows contain ONLY work execution procedures
- [ ] Reference docs live at skill root (not in Workflows/)
- [ ] No `backups/` directory inside skill

---

## TitleCase Reference

| Type | Wrong | Correct |
|------|-------|---------|
| Skill directory | `createskill`, `create-skill` | `Createskill` |
| Multi-word skill | `create_skill`, `CREATE_SKILL` | `CreateSkill` |
| Workflow file | `create.md`, `CREATE.md` | `Create.md` |
| Multi-word workflow | `update-info.md`, `UPDATE_INFO.md` | `UpdateInfo.md` |
| Reference doc | `api-reference.md` | `ApiReference.md` |
| Tool file | `manage-server.ts` | `ManageServer.ts` |

---

## Done

Skill now matches the canonical structure from SkillSystem.md with proper TitleCase naming throughout.
