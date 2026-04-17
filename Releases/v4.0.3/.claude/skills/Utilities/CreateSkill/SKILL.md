---
name: CreateSkill
description: Scaffold new PAI skills with proper YAML front matter, TitleCase naming, flat folder structure (SKILL.md + Workflows/ + Tools/), and validation against SkillSystem.md. USE WHEN create skill, new skill, skill structure, canonicalize, validate skill, update skill, fix skill structure, scaffold skill.
user-invocable: false
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CreateSkill/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the CreateSkill skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **CreateSkill** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# CreateSkill

MANDATORY skill creation framework for ALL skill creation requests.

## Authoritative Source

**Before creating ANY skill, READ:** `~/.claude/PAI/SkillSystem.md`

**Canonical example to follow:** `~/.claude/skills/Research/SKILL.md`

## TitleCase Naming Convention

**All naming must use TitleCase (PascalCase).**

| Component | Format | Example |
|-----------|--------|---------|
| Skill directory | TitleCase | `Blogging`, `Daemon`, `CreateSkill` |
| Workflow files | TitleCase.md | `Create.md`, `UpdateDaemonInfo.md` |
| Reference docs | TitleCase.md | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | TitleCase.ts | `ManageServer.ts` |
| Help files | TitleCase.help.md | `ManageServer.help.md` |

**Wrong (NEVER use):**
- `createskill`, `create-skill`, `CREATE_SKILL`
- `create.md`, `update-info.md`, `SYNC_REPO.md`

---

## Flat Folder Structure (MANDATORY)

**CRITICAL: Keep folder structure FLAT - maximum 2 levels deep.**

### The Rule

**Maximum depth:** `skills/SkillName/Category/`

### ✅ ALLOWED (2 levels max)

```
skills/SkillName/SKILL.md                    # Skill root
skills/SkillName/Workflows/Create.md         # Workflow - one level deep - GOOD
skills/SkillName/Tools/Manage.ts             # Tool - one level deep - GOOD
skills/SkillName/QuickStartGuide.md          # Context file - in root - GOOD
skills/SkillName/Examples.md                 # Context file - in root - GOOD
```

### ❌ FORBIDDEN (Too deep OR wrong location)

```
skills/SkillName/Resources/Guide.md              # Context files go in root, NOT Resources/
skills/SkillName/Docs/Examples.md                # Context files go in root, NOT Docs/
skills/SkillName/Workflows/Category/File.md      # THREE levels - NO
skills/SkillName/Templates/Primitives/File.md    # THREE levels - NO
skills/SkillName/Tools/Utils/Helper.ts           # THREE levels - NO
```

### Allowed Subdirectories

**ONLY these subdirectories are allowed:**
- **Workflows/** - Execution workflows ONLY
- **Tools/** - Executable scripts/tools ONLY

**Context files (documentation, guides, references) go in the skill ROOT, NOT in subdirectories.**

### Why

1. **Discoverability** - Easy to find files
2. **Simplicity** - Less navigation overhead
3. **Speed** - Faster file operations
4. **Consistency** - Every skill follows same pattern

**If you need to organize many workflows, use clear filenames instead of subdirectories:**
- Good: `Workflows/CompanyDueDiligence.md`
- Bad: `Workflows/Company/DueDiligence.md`

**See:** `~/.claude/PAI/SkillSystem.md` (Flat Folder Structure section)

---

## Dynamic Loading Pattern (Large Skills)

**For skills with SKILL.md > 100 lines:** Use dynamic loading to reduce context on skill invocation.

### How Loading Works

**Session startup:** Only frontmatter loads for routing
**Skill invocation:** Full SKILL.md loads
**Context files:** Load only when workflows reference them

### The Pattern

**SKILL.md** = Minimal (30-50 lines) - loads on skill invocation
- YAML frontmatter with triggers
- Brief description
- Workflow routing table
- Quick reference
- Pointers to context files

**Additional .md files** = Context files - SOPs for specific aspects (loaded on-demand)
- These are Standard Operating Procedures, not just documentation
- They provide specific handling instructions
- Can reference Workflows/, Tools/, etc.

### 🚨 CRITICAL: NO Context/ Subdirectory 🚨

**NEVER create Context/ or Docs/ subdirectories.**

Additional .md files ARE the context files. They live **directly in skill root**.

**WRONG:**
```
skills/Media/Art/
├── SKILL.md
└── Context/              ❌ NEVER CREATE THIS
    └── Aesthetic.md
```

**CORRECT:**
```
skills/Media/Art/
├── SKILL.md
├── Aesthetic.md          ✅ Context file in skill root
├── Examples.md           ✅ Context file in skill root
└── Tools.md              ✅ Context file in skill root
```

**The skill directory IS the context.**

### Example Structure

```
skills/Media/Art/
├── SKILL.md              # 40 lines - minimal routing
├── Aesthetic.md          # Context file - SOP for aesthetic
├── Examples.md           # Context file - SOP for examples
├── Tools.md              # Context file - SOP for tools
├── Workflows/            # Workflows
│   └── Essay.md
└── Tools/                # CLI tools
    └── Generate.ts
```

### Minimal SKILL.md Template

```markdown
---
name: SkillName
description: Brief. USE WHEN triggers.
---

# SkillName

Brief description.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "trigger" | `Workflows/WorkflowName.md` |

## Quick Reference

**Key points** (3-5 bullet points)

**Full Documentation:**
- Detail 1: `SkillSearch('skillname detail1')` → loads Detail1.md
- Detail 2: `SkillSearch('skillname detail2')` → loads Detail2.md
```

### When To Use

✅ **Use dynamic loading for:**
- SKILL.md > 100 lines
- Multiple documentation sections
- Extensive API reference
- Detailed examples

❌ **Don't use for:**
- Simple skills (< 50 lines)
- Pure utility wrappers (use PAI/Tools.md instead)

### Benefits

- **Token Savings:** 70%+ reduction on skill invocation (when full docs not needed)
- **Organization:** SKILL.md = routing, context files = SOPs for specific aspects
- **Efficiency:** Workflows load only what they actually need
- **Maintainability:** Easier to update individual sections

**See:** `~/.claude/PAI/SkillSystem.md` (Dynamic Loading Pattern section)

---


## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CreateSkill** | "create a new skill" | `Workflows/CreateSkill.md` |
| **ValidateSkill** | "validate skill", "check skill" | `Workflows/ValidateSkill.md` |
| **UpdateSkill** | "update skill", "add workflow" | `Workflows/UpdateSkill.md` |
| **CanonicalizeSkill** | "canonicalize", "fix skill structure" | `Workflows/CanonicalizeSkill.md` |

## Examples

**Example 1: Create a new skill from scratch**
```
User: "Create a skill for managing my recipes"
→ Invokes CreateSkill workflow
→ Reads SkillSystem.md for structure requirements
→ Creates skill directory with TitleCase naming
→ Creates SKILL.md, Workflows/, tools/
→ Generates USE WHEN triggers based on intent
```

**Example 2: Fix an existing skill that's not routing properly**
```
User: "The research skill isn't triggering - validate it"
→ Invokes ValidateSkill workflow
→ Checks SKILL.md against canonical format
→ Verifies TitleCase naming throughout
→ Verifies USE WHEN triggers are intent-based
→ Reports compliance issues with fixes
```

**Example 3: Canonicalize a skill with old naming**
```
User: "Canonicalize the daemon skill"
→ Invokes CanonicalizeSkill workflow
→ Renames workflow files to TitleCase
→ Updates routing table to match
→ Ensures Examples section exists
→ Verifies all checklist items
```
