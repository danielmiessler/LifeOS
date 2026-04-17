# Custom Skill System

**The MANDATORY configuration system for ALL PAI skills.**

---

## THIS IS THE AUTHORITATIVE SOURCE

This document defines the **required structure** for every skill in the PAI system.

**ALL skill creation MUST follow this structure** - including skills created by the CreateSkill skill.

**"Canonicalize a skill"** = Restructure it to match this exact format, including TitleCase naming.

If a skill does not follow this structure, it is not properly configured and will not work correctly.

---

## TitleCase Naming Convention (MANDATORY)

**All naming in the skill system MUST use TitleCase (PascalCase).**

| Component | Wrong | Correct |
|-----------|-------|---------|
| Skill directory | `createskill`, `create-skill`, `CREATE_SKILL` | `Createskill` or `CreateSkill` |
| Workflow files | `create.md`, `update-info.md`, `SYNC_REPO.md` | `Create.md`, `UpdateInfo.md`, `SyncRepo.md` |
| Reference docs | `prosody-guide.md`, `API_REFERENCE.md` | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | `manage-server.ts`, `MANAGE_SERVER.ts` | `ManageServer.ts` |
| Help files | `manage-server.help.md` | `ManageServer.help.md` |
| YAML name | `name: create-skill` | `name: CreateSkill` |

**TitleCase Rules:**
- First letter of each word capitalized
- No hyphens, underscores, or spaces
- No ALL_CAPS or all_lowercase
- Single words: first letter capital (e.g., `Blogging`, `Daemon`)
- Multi-word: each word capitalized, no separator (e.g., `UpdateDaemonInfo`, `SyncRepo`)

**Exception:** `SKILL.md` is always uppercase (convention for the main skill file).

---

## Sub-Skill Frontmatter (MANDATORY)

**Every nested sub-skill `SKILL.md` MUST set `user-invocable: false`
in its YAML frontmatter.**

### Why

Claude Code auto-indexes every `SKILL.md` file in the `skills/` tree
and advertises each one as an invokable slash-command tip. PAI
organizes skills hierarchically — a top-level `SKILL.md` is
user-invokable, but sub-skills nested underneath are routed to by
the parent's Workflow Routing table and are NOT meant to be invoked
by the user directly. Without the `user-invocable: false` flag,
Claude Code advertises broken tips like `/annual-reports` that do
not work when the user tries them, eroding trust in every tip the
system emits.

The `user-invocable: false` frontmatter field is the spec-blessed
mechanism for this. From the Claude Code Skills documentation:

> `user-invocable` — Set to `false` to hide from the `/` menu. Use
> for background knowledge users shouldn't invoke directly.
> Default: `true`.

Reference: https://code.claude.com/docs/en/skills (Frontmatter
reference table).

### Correct frontmatter for a nested sub-skill

```yaml
---
name: AnnualReports
description: [...]. USE WHEN annual reports, security trends, [...].
user-invocable: false
---
```

### Rule

- **Top-level skills** (`skills/<Name>/SKILL.md`): no
  `user-invocable` field (defaults to `true`, user-invokable).
- **Nested sub-skills** (`skills/<Parent>/<SubSkill>/SKILL.md` and
  deeper): MUST include `user-invocable: false`.

Parent skill routing tables continue to reference sub-skill paths
as before — `user-invocable: false` hides the skill from the `/`
menu but does not prevent Claude from reading the file when
directed by the parent.

### Validator check

```bash
# Every nested SKILL.md must contain `user-invocable: false`
find ~/.claude/skills -mindepth 3 -name SKILL.md \
  -exec grep -L '^user-invocable: false$' {} +
# MUST return empty.
```

---

## Personal vs System Skills (CRITICAL)

**Skills are classified into two categories:**

### System Skills (Shareable via PAI Packs)
- Use **TitleCase** naming: `Browser`, `Research`, `Development`
- Contain NO personal data (contacts, API keys, team members)
- Reference `~/.claude/PAI/USER/` for any personalization
- Can be exported to the public PAI repository

### Personal Skills (Never Shared)
- Use **underscore + ALL CAPS** naming: `_MYSKILL`, `_METRICS`, `_PERSONAL`
- Contain personal configuration, API keys, business-specific workflows
- Will NEVER be pushed to public PAI
- The underscore prefix makes them sort first and visually distinct

**Personal Skills:** *(dynamically discovered)*

Personal skills are identified by their `_ALLCAPS` naming convention. To list current personal skills:
```bash
ls -1 ~/.claude/skills/ | grep "^_"
```

This ensures documentation never drifts from reality. The underscore prefix ensures:
- They sort first in directory listings
- They are visually distinct from system skills
- They are automatically excluded from PAI pack exports

**Pattern for Personalization in System Skills:**
System skills should reference PAI/USER files for personal data:
```markdown
## Configuration
Personal configuration loaded from:
- `~/.claude/PAI/USER/CONTACTS.md` - Contact information
- `~/.claude/PAI/USER/TECHSTACKPREFERENCES.md` - Tech preferences
```

**NEVER hardcode personal data in system skills.**

---

## Skill Customization System

**System skills (TitleCase) check for user customizations before executing.**

**Personal skills (_ALLCAPS) do NOT use this system** - they already contain personal data directly and are never shared.

### The Pattern

All skills include this standard instruction block after the YAML frontmatter:

```markdown
## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/{SkillName}/`

If this directory exists, load and apply:
- `PREFERENCES.md` - User preferences and configuration
- Additional files specific to the skill

These define user-specific preferences. If the directory does not exist, proceed with skill defaults.
```

### Directory Structure

```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/
├── README.md                    # Documentation for this system
├── Art/                         # Art skill customizations
│   ├── EXTEND.yaml              # Extension manifest
│   ├── PREFERENCES.md           # Aesthetic preferences
│   ├── CharacterSpecs.md        # Character design specs
│   └── SceneConstruction.md     # Scene building guidelines
├── Agents/                      # Agents skill customizations
│   ├── EXTEND.yaml              # Extension manifest
│   ├── PREFERENCES.md           # Named agent summary
│   └── VoiceConfig.json         # ElevenLabs voice mappings
├── FrontendDesign/              # FrontendDesign customizations
│   ├── EXTEND.yaml              # Extension manifest
│   └── PREFERENCES.md           # Design tokens, palette
└── [SkillName]/                 # Any skill can have customizations
    ├── EXTEND.yaml              # Required manifest
    └── [config-files]           # Skill-specific configs
```

### EXTEND.yaml Manifest

Every customization directory requires an EXTEND.yaml manifest:

```yaml
# EXTEND.yaml - Extension manifest
---
skill: SkillName                   # Must match skill name exactly
extends:
  - PREFERENCES.md                 # Files to load
  - OtherConfig.md
merge_strategy: override           # append | override | deep_merge
enabled: true                      # Toggle customizations on/off
description: "What this customization adds"
```

### Merge Strategies

| Strategy | Behavior |
|----------|----------|
| `append` | Add items to existing config (default) |
| `override` | Replace default behavior entirely |
| `deep_merge` | Recursive merge of objects |

### What Goes Where

| Content Type | Location | Example |
|--------------|----------|---------|
| User preferences | `SKILLCUSTOMIZATIONS/{Skill}/PREFERENCES.md` | Art style, color palette |
| Named configurations | `SKILLCUSTOMIZATIONS/{Skill}/[name].md` | Character specs, voice configs |
| Skill logic | `skills/{Skill}/SKILL.md` | Generic, shareable skill code |

### Creating a Customization

1. **Create directory**: `mkdir -p ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/SkillName`
2. **Create EXTEND.yaml**: Define what files to load and merge strategy
3. **Create PREFERENCES.md**: User preferences for this skill
4. **Add additional files**: Any skill-specific configurations

### Benefits

- **Shareable Skills**: Skill files contain no personal data
- **Centralized Preferences**: All customizations in one location
- **Discoverable**: Easy to see which skills have customizations
- **Toggleable**: Set `enabled: false` to disable customizations temporarily

---

## The Required Structure

Every SKILL.md has two parts:

### 1. YAML Frontmatter (Single-Line Description)

```yaml
---
name: SkillName
description: [What it does]. USE WHEN [intent triggers using OR]. [Additional capabilities].
implements: Science              # Optional: declares Science Protocol compliance
science_cycle_time: meso         # Optional: micro | meso | macro
---
```

**Rules:**
- `name` uses **TitleCase**
- `description` is a **single line** (not multi-line with `|`)
- `USE WHEN` keyword is **MANDATORY** (Claude Code parses this for skill activation)
- Use intent-based triggers with `OR` for multiple conditions
- Max 1024 characters (Anthropic hard limit)
- **NO separate `triggers:` or `workflows:` arrays in YAML**

### Science Protocol Compliance (Optional)

Skills that involve systematic investigation, iteration, or evidence-based improvement can declare Science Protocol compliance:

```yaml
implements: Science
science_cycle_time: meso
```

**What This Means:**
- The skill embodies the scientific method: Goal → Observe → Hypothesize → Experiment → Measure → Analyze → Iterate
- This is documentation of the mapping, not runtime coupling
- Skills implement Science like classes implement interfaces—they follow the pattern independently

**Cycle Time Options:**
| Level | Cycle Time | Formality | Example Skills |
|-------|------------|-----------|----------------|
| `micro` | Seconds-Minutes | Implicit (internalized) | Most skills |
| `meso` | Hours-Days | Explicit when stuck | Evals, Research, Development |
| `macro` | Weeks-Months | Formal documentation | Major architecture work |

**Skills That Implement Science:**
- **Development** - TDD is Science (test = goal, code = experiment, pass/fail = analysis)
- **Evals** - Prompt optimization through systematic experimentation
- **Research** - Investigation through hypotheses and evidence gathering
- **Council** - Debate as parallel hypothesis testing

**See:** `~/.claude/skills/Science/Protocol.md` for the full protocol interface

### 2. Markdown Body (Workflow Routing + Examples + Documentation)

```markdown
# SkillName

[Brief description of what the skill does]

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the SKILLNAME skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **SkillName** skill to ACTION...
   ```

**Full documentation:** `~/.claude/PAI/THENOTIFICATIONSYSTEM.md`

## Workflow Routing

The notification announces workflow execution. The routing table tells Claude which workflow to execute:

| Workflow | Trigger | File |
|----------|---------|------|
| **WorkflowOne** | "trigger phrase" | `Workflows/WorkflowOne.md` |
| **WorkflowTwo** | "another trigger" | `Workflows/WorkflowTwo.md` |

## Examples

**Example 1: [Common use case]**
```
User: "[Typical user request]"
→ Invokes WorkflowOne workflow
→ [What skill does]
→ [What user gets back]
```

**Example 2: [Another use case]**
```
User: "[Another typical request]"
→ [Process]
→ [Output]
```

## [Additional Sections]

[Documentation, quick reference, critical paths, etc.]
```

**Workflow routing format:** Table with Workflow, Trigger, File columns
- Workflow names in **TitleCase** matching file names
- Simple trigger description
- File path in backticks

**When to show the workflow message:**
- ONLY output the message when actually loading and executing a workflow file
- If the skill handles the request directly without calling a workflow, do NOT show the message
- The message indicates "I'm reading and following instructions from a workflow file"

---

## Dynamic Loading Pattern (Recommended for Large Skills)

**Purpose:** Reduce context on skill invocation by keeping SKILL.md minimal and loading additional context files only when needed.

### How Loading Works

**Session Startup:**
- Only frontmatter (YAML) loads from all SKILL.md files for routing

**Skill Invocation:**
- Full SKILL.md body loads when skill is invoked
- Additional .md context files load when referenced by workflows or called directly

**Benefit:** Most skill invocations don't need all documentation - load only what workflows actually use.

### The Pattern

**SKILL.md** = Minimal routing + quick reference (30-50 lines)
**Additional .md files** = Context files - SOPs for specific aspects (loaded on-demand)

### Structure

```
skills/SkillName/
├── SKILL.md                    # Minimal routing - loads on invocation
├── Aesthetic.md                # Context file - SOP for aesthetic handling
├── Examples.md                 # Context file - SOP for examples
├── ApiReference.md             # Context file - SOP for API usage
├── Tools.md                    # Context file - SOP for tool usage
├── Workflows/                  # Workflow execution files
│   ├── Create.md
│   └── Update.md
└── Tools/                      # Actual CLI tools
    └── Generate.ts
```

### 🚨 CRITICAL: NO Context/ Subdirectory 🚨

**NEVER create a Context/ or Docs/ subdirectory.**

The additional .md files ARE the context files. They live **directly in the skill root directory** alongside SKILL.md.

**WRONG (DO NOT DO THIS):**
```
skills/SkillName/
├── SKILL.md
└── Context/              ❌ NEVER CREATE THIS DIRECTORY
    ├── Aesthetic.md
    └── Examples.md
```

**CORRECT:**
```
skills/SkillName/
├── SKILL.md
├── Aesthetic.md          ✅ Context file in skill root
└── Examples.md           ✅ Context file in skill root
```

**The skill directory itself IS the context.** Additional .md files are context files that provide SOPs for specific aspects of the skill's operation.

### What Goes In SKILL.md (Minimal)

Keep only these in SKILL.md:
- ✅ YAML frontmatter with triggers
- ✅ Brief description (1-2 lines)
- ✅ Workflow routing table
- ✅ Quick reference (3-5 bullet points)
- ✅ Pointers to detailed docs via SkillSearch

### What Goes In Additional .md Context Files (Loaded On-Demand)

These are **additional SOPs** (Standard Operating Procedures) for specific aspects. They live in skill root and can reference Workflows/, Tools/, etc.

Move these to separate context files in skill root:
- ❌ Extended documentation → `Documentation.md`
- ❌ API reference → `ApiReference.md`
- ❌ Detailed examples → `Examples.md`
- ❌ Tool documentation → `Tools.md`
- ❌ Aesthetic guides → `Aesthetic.md`
- ❌ Configuration details → `Configuration.md`

**These are SOPs, not just docs.** They provide specific handling instructions for workflows to reference.

### Example: Minimal SKILL.md

```markdown
---
name: Art
description: Visual content system. USE WHEN art, header images, visualizations, diagrams.
---

# Art Skill

Complete visual content system using **charcoal architectural sketch** aesthetic.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| Blog header/editorial | `Workflows/Essay.md` |
| Technical diagram | `Workflows/TechnicalDiagrams.md` |
| Mermaid flowchart | `Workflows/Mermaid.md` |

## Quick Reference

**Aesthetic:** Charcoal architectural sketch
**Model:** nano-banana-pro
**Output:** Always ~/Downloads/ first

**Full Documentation:**
- Aesthetic guide: `SkillSearch('art aesthetic')` → loads Aesthetic.md
- Examples: `SkillSearch('art examples')` → loads Examples.md
- Tools: `SkillSearch('art tools')` → loads Tools.md
```

### Loading Additional Context Files

Workflows call SkillSearch to load context files as needed:

```bash
# In workflow files or SKILL.md
SkillSearch('art aesthetic')    # Loads Aesthetic.md from skill root
SkillSearch('art examples')     # Loads Examples.md from skill root
SkillSearch('art tools')        # Loads Tools.md from skill root
```

Or reference them directly:
```bash
# Read specific context file
Read ~/.claude/skills/Media/Art/Aesthetic.md
```

Context files can reference workflows and tools:
```markdown
# Aesthetic.md (context file)

Use the Essay workflow for blog headers: `Workflows/Essay.md`
Generate images with: `bun Tools/Generate.ts`
```

### Benefits

**Token Savings on Skill Invocation:**
- Before: 150+ lines load when skill invoked
- After: 40-50 lines load when skill invoked
- Additional context loads only if workflows need it
- Reduction: 70%+ token savings per invocation (when full docs not needed)

**Improved Organization:**
- SKILL.md = clean routing layer
- Context files = SOPs for specific aspects
- Workflows load only what they need
- Easier to maintain and update

### When To Use

Use dynamic loading for skills with:
- ✅ SKILL.md > 100 lines
- ✅ Multiple documentation sections
- ✅ Extensive API reference
- ✅ Detailed examples
- ✅ Tool documentation

Don't bother for:
- ❌ Simple skills (< 50 lines total)
- ❌ Pure utility wrappers (use PAI/TOOLS.md instead)
- ❌ Skills that are already minimal

---

## Canonicalization

**"Canonicalize a skill"** means restructuring it to match this document exactly.

### When to Canonicalize

- Skill has old YAML format (separate `triggers:` or `workflows:` arrays)
- Skill uses non-TitleCase naming
- Skill is missing `USE WHEN` in description
- Skill lacks `## Examples` section
- Skill has `backups/` inside its directory
- Workflow routing uses old format

### Canonicalization Checklist

#### Naming (TitleCase)
- [ ] Skill directory uses TitleCase
- [ ] All workflow files use TitleCase
- [ ] All reference docs use TitleCase
- [ ] All tool files use TitleCase
- [ ] Routing table names match file names exactly
- [ ] YAML `name:` uses TitleCase

#### YAML Frontmatter
- [ ] Single-line `description` with embedded `USE WHEN`
- [ ] No separate `triggers:` or `workflows:` arrays
- [ ] Description uses intent-based language
- [ ] Description under 1024 characters

#### Markdown Body
- [ ] `## Workflow Routing` section with table format
- [ ] All workflow files have routing entries
- [ ] `## Examples` section with 2-3 concrete patterns

#### Structure
- [ ] `tools/` directory exists (even if empty)
- [ ] No `backups/` directory inside skill
- [ ] Reference docs at skill root (not in Workflows/)
- [ ] Workflows contain ONLY execution procedures

### How to Canonicalize

Use the Createskill skill's CanonicalizeSkill workflow:
```
~/.claude/skills/Createskill/Workflows/CanonicalizeSkill.md
```

Or manually:
1. Rename files to TitleCase
2. Update YAML frontmatter to single-line description
3. Add `## Workflow Routing` table
4. Add `## Examples` section
5. Move backups to `~/.claude/MEMORY/Backups/`
6. Verify against checklist

---

## Examples Section (REQUIRED)

**Every skill MUST have an `## Examples` section** showing 2-3 concrete usage patterns.

**Why Examples Matter:**
- Anthropic research shows examples improve tool selection accuracy from 72% to 90%
- Descriptions tell Claude WHEN to activate; examples show HOW the skill works
- Claude learns the full input→behavior→output pattern, not just trigger keywords

**Example Format:**
```markdown
## Examples

**Example 1: [Use case name]**
```
User: "[Actual user request]"
→ Invokes WorkflowName workflow
→ [What the skill does - action 1]
→ [What user receives back]
```

**Example 2: [Another use case]**
```
User: "[Different request pattern]"
→ [Process steps]
→ [Output/result]
```
```

**Guidelines:**
- Use 2-3 examples per skill (not more)
- Show realistic user requests (natural language)
- Include the workflow or action taken (TitleCase)
- Show what output/result the user gets
- Cover the most common use cases

---

## Intent Matching, Not String Matching

We use **intent matching**, not exact phrase matching.

**Example description:**
```yaml
description: Complete blog workflow. USE WHEN user mentions doing anything with their blog, website, site, including things like update, proofread, write, edit, publish, preview, blog posts, articles, headers, or website pages, etc.
```

**Key Principles:**
- Use intent language: "user mentions", "user wants to", "including things like"
- Don't list exact phrases in quotes
- Cover the domain conceptually
- Use `OR` to combine multiple trigger conditions

---

## Complete Canonical Example: Blogging Skill

**Reference:** `~/.claude/skills/_PERSONAL/_MYSKILL/SKILL.md`

```yaml
---
name: Blogging
description: Complete blog workflow. USE WHEN user mentions doing anything with their blog, website, site, including things like update, proofread, write, edit, publish, preview, blog posts, articles, headers, or website pages, etc.
---

# Blogging

Complete blog workflow.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running WORKFLOWNAME in Blogging"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Blogging** skill to ACTION...
   ```

**Full documentation:** `~/.claude/PAI/THENOTIFICATIONSYSTEM.md`

## Core Paths

- **Blog posts:** `${PROJECTS_DIR}/YourWebsite/blog/`
- **CMS root:** `${PROJECTS_DIR}/YourWebsite/`
- **Images:** `${PROJECTS_DIR}/YourWebsite/public/images/`

## Workflow Routing

**When executing a workflow, also output this text:**

```
Running the **WorkflowName** workflow in the **Blogging** skill to ACTION...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **Create** | "write a post", "new article" | `Workflows/Create.md` |
| **Rewrite** | "rewrite this post" | `Workflows/Rewrite.md` |
| **Publish** | "publish", "deploy" | `Workflows/Publish.md` |
| **Open** | "preview", "open in browser" | `Workflows/Open.md` |
| **Header** | "create header image" | `Workflows/Header.md` |

## Examples

**Example 1: Write new content**
```
User: "Write a post about AI agents for the blog"
→ Invokes Create workflow
→ Drafts content in scratchpad/
→ Opens dev server preview at localhost:5173
```

**Example 2: Publish**
```
User: "Publish the AI agents post"
→ Invokes Publish workflow
→ Runs build validation
→ Deploys to Cloudflare Pages
```

## Quick Reference

- **Tech Stack:** VitePress + bun + Cloudflare Pages
- **Package Manager:** bun (NEVER npm)
- **Dev Server:** `http://localhost:5173`
- **Live Site:** `https://example.com`
```

---

## Directory Structure

Every skill follows this structure:

```
SkillName/                    # TitleCase directory name
├── SKILL.md                  # Main skill file (always uppercase)
├── QuickStartGuide.md        # Context/reference files in root (TitleCase)
├── DefenseMechanisms.md      # Context/reference files in root (TitleCase)
├── Examples.md               # Context/reference files in root (TitleCase)
├── Tools/                    # CLI tools (ALWAYS present, even if empty)
│   ├── ToolName.ts           # TypeScript CLI tool (TitleCase)
│   └── ToolName.help.md      # Tool documentation (TitleCase)
└── Workflows/                # Work execution workflows (TitleCase)
    ├── Create.md             # Workflow file
    ├── UpdateInfo.md         # Workflow file
    └── SyncRepo.md           # Workflow file
```

- **SKILL.md** - Contains single-line description in YAML, workflow routing and documentation in body
- **Context files (in root)** - Documentation, guides, reference materials live in skill root, NOT in subdirectories (TitleCase names)
- **Tools/** - CLI tools for automation (ALWAYS present directory, even if empty)
- **Workflows/** - Contains work execution workflows ONLY (TitleCase names)
- **NO Resources/ or Docs/ subdirectories** - Context files go in skill root

---

## Flat Folder Structure (MANDATORY)

**CRITICAL: Keep folder structure FLAT - maximum 2 levels deep.**

### The Rule

Skills use a **flat hierarchy** - no deep nesting of subdirectories.

**Maximum depth:** `skills/SkillName/Category/`

### ✅ ALLOWED (2 levels max)

```
skills/OSINT/SKILL.md                           # Skill root
skills/OSINT/Workflows/CompanyDueDiligence.md   # Workflow - one level deep
skills/OSINT/Tools/Analyze.ts                   # Tool - one level deep
skills/OSINT/CompanyTools.md                    # Context file - in root
skills/OSINT/Examples.md                        # Context file - in root
skills/Utilities/Prompting/BeCreative.md                  # Templates in Prompting root
skills/Utilities/Prompting/StoryExplanation.md            # Templates in Prompting root
skills/PromptInjection/DefenseMechanisms.md     # Context file - in root
skills/PromptInjection/QuickStartGuide.md       # Context file - in root
```

### ❌ FORBIDDEN (Too deep OR wrong location)

```
skills/OSINT/Resources/Examples.md              # Context files go in root, NOT Resources/
skills/OSINT/Docs/CompanyTools.md               # Context files go in root, NOT Docs/
skills/OSINT/Templates/Primitives/Extract.md    # THREE levels - NO
skills/OSINT/Workflows/Company/DueDiligence.md  # THREE levels - NO (use CompanyDueDiligence.md instead)
skills/Utilities/Prompting/Templates/BeCreative.md        # Templates in root, NOT Templates/ subdirectory
skills/Research/Workflows/Analysis/Deep.md      # THREE levels - NO
```

### Why Flat Structure

1. **Discoverability** - Easy to find files with simple `ls` or `grep`
2. **Simplicity** - Less cognitive overhead navigating directories
3. **Speed** - Faster file operations without deep traversal
4. **Maintainability** - Harder to create organizational complexity
5. **Consistency** - Every skill follows same simple pattern

### Allowed Subdirectories

**ONLY these subdirectories are allowed:**

1. **Workflows/** - Execution workflows ONLY
   - All workflows go directly in `Workflows/`, NO subcategories
   - Correct: `Workflows/CompanyDueDiligence.md`
   - Wrong: `Workflows/Company/DueDiligence.md`

2. **Tools/** - Executable scripts/tools ONLY
   - CLI tools, automation scripts
   - Correct: `Tools/Analyze.ts`
   - Wrong: `Tools/Analysis/Analyze.ts`

**Templates (Prompting skill only):**
- Templates live in `skills/Utilities/Prompting/` root, NOT nested
- Correct: `skills/Utilities/Prompting/BeCreative.md`
- Wrong: `skills/Utilities/Prompting/Templates/BeCreative.md`

### Context/Resource Files Go in Skill Root

**CRITICAL RULE: Documentation, guides, reference materials, and context files live in the skill ROOT directory, NOT in subdirectories.**

❌ **WRONG** - Don't create subdirectories for context files:
```
skills/SkillName/Resources/Guide.md          # NO - no Resources/ subdirectory
skills/SkillName/Docs/Reference.md           # NO - no Docs/ subdirectory
skills/SkillName/Guides/QuickStart.md        # NO - no Guides/ subdirectory
```

✅ **CORRECT** - Put context files directly in skill root:
```
skills/SkillName/Guide.md                    # YES - in root
skills/SkillName/Reference.md                # YES - in root
skills/SkillName/QuickStart.md               # YES - in root
skills/SkillName/DefenseMechanisms.md        # YES - in root
skills/SkillName/ApiDocumentation.md         # YES - in root
```

**Exceptions:** Workflows/ and Tools/ subdirectories only. Everything else goes in the root.

### Migration Rule

If you encounter nested structures deeper than 2 levels:
1. Flatten immediately
2. Move files up to proper level
3. Rename files for clarity if needed (e.g., `CompanyDueDiligence.md` instead of `Company/DueDiligence.md`)
4. Update all references

---

## Workflow-to-Tool Integration

**Workflows should map user intent to tool flags, not hardcode single invocation patterns.**

When a workflow calls a CLI tool, it should:
1. **Interpret user intent** from the request
2. **Consult flag mapping tables** to determine appropriate flags
3. **Construct the CLI command** with selected flags
4. **Execute and handle results**

### Intent-to-Flag Mapping Tables

Workflows should include tables that map natural language intent to CLI flags:

```markdown
## Model Selection

| User Says | Flag | Use Case |
|-----------|------|----------|
| "fast", "quick" | `--model haiku` | Speed priority |
| "best", "highest quality" | `--model opus` | Quality priority |
| (default) | `--model sonnet` | Balanced default |

## Output Options

| User Says | Flag | Effect |
|-----------|------|--------|
| "JSON output" | `--format json` | Machine-readable |
| "detailed" | `--verbose` | Extra information |
| "just the result" | `--quiet` | Minimal output |
```

### Command Construction Pattern

```markdown
## Execute Tool

Based on the user's request, construct the CLI command:

\`\`\`bash
bun ToolName.ts \
  [FLAGS_FROM_INTENT_MAPPING] \
  --required-param "value" \
  --output /path/to/output
\`\`\`
```

**See:** `~/.claude/PAI/CLIFIRSTARCHITECTURE.md` (Workflow-to-Tool Integration section)

---

## Workflows vs Reference Documentation

**CRITICAL DISTINCTION:**

### Workflows (`Workflows/` directory)
Workflows are **work execution procedures** - step-by-step instructions for DOING something.

**Workflows ARE:**
- Operational procedures (create, update, delete, deploy, sync)
- Step-by-step execution instructions
- Actions that change state or produce output
- Things you "run" or "execute"

**Workflows are NOT:**
- Reference guides
- Documentation
- Specifications
- Context or background information

**Workflow naming:** TitleCase verbs (e.g., `Create.md`, `SyncRepo.md`, `UpdateDaemonInfo.md`)

### Reference Documentation (skill root)
Reference docs are **information to read** - context, guides, specifications.

**Reference docs ARE:**
- Guides and how-to documentation
- Specifications and schemas
- Background context
- Information you "read" or "reference"

**Reference docs are NOT:**
- Executable procedures
- Step-by-step workflows
- Things you "run"

**Reference naming:** TitleCase descriptive (e.g., `ProsodyGuide.md`, `SchemaSpec.md`, `ApiReference.md`)

---

## CLI Tools (`tools/` directory)

**Every skill MUST have a `tools/` directory**, even if empty. CLI tools automate repetitive tasks and manage stateful resources.

### When to Create a CLI Tool

Create CLI tools for:
- **Server management** - start, stop, restart, status
- **State queries** - check if running, get configuration
- **Repeated operations** - tasks executed frequently by workflows
- **Complex automation** - multi-step processes that benefit from encapsulation

### Tool Requirements

Every CLI tool must:
1. **Be TypeScript** - Use `#!/usr/bin/env bun` shebang
2. **Use TitleCase naming** - `ToolName.ts`, not `tool-name.ts`
3. **Have a help file** - `ToolName.help.md` with full documentation
4. **Support `--help`** - Display usage information
5. **Use colored output** - ANSI colors for terminal feedback
6. **Handle errors gracefully** - Clear error messages, appropriate exit codes
7. **Expose configuration via flags** - Enable behavioral control (see below)

### Configuration Flags Standard

**Tools should expose configuration through CLI flags, not hardcoded values.**

This pattern (inspired by indydevdan's variable-centric approach) enables workflows to adapt tool behavior based on user intent without code changes.

**Standard Flag Categories:**

| Category | Examples | Purpose |
|----------|----------|---------|
| **Mode flags** | `--fast`, `--thorough`, `--dry-run` | Execution behavior |
| **Output flags** | `--format json`, `--quiet`, `--verbose` | Output control |
| **Resource flags** | `--model haiku`, `--model opus` | Model/resource selection |
| **Post-process flags** | `--thumbnail`, `--remove-bg` | Additional processing |

**Example: Well-Configured Tool**

```bash
# Minimal invocation (sensible defaults)
bun Generate.ts --prompt "..." --output /tmp/image.png

# Full configuration
bun Generate.ts \
  --model nano-banana-pro \    # Resource selection
  --prompt "..." \
  --size 2K \                  # Output configuration
  --aspect-ratio 16:9 \
  --thumbnail \                # Post-processing
  --remove-bg \
  --output /tmp/header.png
```

**Flag Design Principles:**
1. **Defaults first**: Tool works without flags for common case
2. **Explicit overrides**: Flags modify default behavior
3. **Boolean flags**: `--flag` enables (no `--no-flag` needed)
4. **Value flags**: `--flag <value>` for choices
5. **Composable**: Flags should combine logically

**See:** `~/.claude/PAI/CLIFIRSTARCHITECTURE.md` (Configuration Flags section) for full documentation

### Tool Structure

```typescript
#!/usr/bin/env bun
/**
 * ToolName.ts - Brief description
 *
 * Usage:
 *   bun ~/.claude/skills/SkillName/Tools/ToolName.ts <command> [options]
 *
 * Commands:
 *   start     Start the thing
 *   stop      Stop the thing
 *   status    Check status
 *
 * @author PAI System
 * @version 1.0.0
 */
```

**Principle:** Workflows call tools; tools encapsulate complexity. This keeps workflows simple and tools reusable.

---

## How It Works

1. **Skill Activation**: Claude Code reads skill descriptions at startup. The `USE WHEN` clause in the description determines when the skill activates based on user intent.

2. **Workflow Routing**: Once the skill is active, the `## Workflow Routing` section determines which workflow file to execute.

3. **Workflow Execution**: Follow the workflow file instructions step-by-step.

---

## Skills Are Scripts to Follow

When a skill is invoked, follow the SKILL.md instructions step-by-step rather than analyzing the skill structure.

**The pattern:**
1. Execute voice notification (if present)
2. Use the routing table to find the right workflow
3. Follow the workflow instructions in order
4. Your behavior should match the Examples section

Think of SKILL.md as a script - it already encodes "how to do X" so you can follow it directly.

---

## Output Requirements (Recommended Section)

**For skills with variable output quality, add explicit output specifications:**

```markdown
## Output Requirements

- **Format:** [markdown list | JSON | prose | code | table]
- **Length:** [under X words | exactly N items | concise | comprehensive]
- **Tone:** [professional | casual | technical | friendly]
- **Must Include:** [specific required elements]
- **Must Avoid:** [corporate fluff | hedging language | filler]
```

**Why This Matters:**
Explicit output specs reduce variability and increase actionability.

**When to Add Output Requirements:**
- Content generation skills (blogging, xpost, newsletter)
- Analysis skills (research, upgrade, OSINT)
- Code generation skills (development, createcli)
- Any skill where output format matters

---

## Complete Checklist

Before a skill is complete:

### Naming (TitleCase)
- [ ] Skill directory uses TitleCase (e.g., `Blogging`, `Daemon`)
- [ ] YAML `name:` uses TitleCase
- [ ] All workflow files use TitleCase (e.g., `Create.md`, `UpdateInfo.md`)
- [ ] All reference docs use TitleCase (e.g., `ProsodyGuide.md`)
- [ ] All tool files use TitleCase (e.g., `ManageServer.ts`)
- [ ] Routing table workflow names match file names exactly

### YAML Frontmatter
- [ ] Single-line `description` with embedded `USE WHEN` clause
- [ ] No separate `triggers:` or `workflows:` arrays
- [ ] Description uses intent-based language
- [ ] Description under 1024 characters

### Markdown Body
- [ ] `## Workflow Routing` section with table format
- [ ] All workflow files have routing entries
- [ ] **`## Examples` section with 2-3 concrete usage patterns** (REQUIRED)

### Structure
- [ ] `tools/` directory exists (even if empty)
- [ ] No `backups/` directory inside skill
- [ ] Workflows contain ONLY work execution procedures
- [ ] Reference docs live at skill root (not in Workflows/)
- [ ] Each CLI tool has a corresponding `.help.md` documentation file
- [ ] (Recommended) Output Requirements section for variable-output skills

---

## Summary

| Component | Purpose | Naming |
|-----------|---------|--------|
| **Skill directory** | Contains all skill files | TitleCase (e.g., `Blogging`) |
| **SKILL.md** | Main skill file | Always uppercase |
| **Workflow files** | Execution procedures | TitleCase (e.g., `Create.md`) |
| **Reference docs** | Information to read | TitleCase (e.g., `ApiReference.md`) |
| **Tool files** | CLI automation | TitleCase (e.g., `ManageServer.ts`) |

This system ensures:
1. Skills invoke properly based on intent (USE WHEN in description)
2. Specific functionality executes accurately (Workflow Routing in body)
3. All skills have consistent, predictable structure
4. **All naming follows TitleCase convention**
