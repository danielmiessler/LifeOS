---
name: CreateSkill
description: "Complete PAI skill development lifecycle across two tracks. Structure track: scaffold new skills (TitleCase dirs, flat 2-level max, Workflows/ + Tools/ + References/ only), validate against canonical format, canonicalize existing skills. Effectiveness track (Anthropic methodology): TestSkill spawns with-skill vs baseline agents in parallel and compares outputs, ImproveSkill diagnoses root causes and rewrites instructions with reasoning over rigid constraints, OptimizeDescription generates 20 should/shouldn't-trigger test queries and rewrites for accuracy. Guides from Thariq Shihipar (Mar 2026): Gotchas section mandatory, BPE check before finalizing, progressive disclosure (frontmatter → SKILL.md body → reference files), on-demand hooks. USE WHEN create skill, new skill, validate skill, test skill, improve skill, optimize description, skill not triggering, skill overtriggering, canonicalize, scaffold skill, skill quality. NOT FOR TypeScript CLI generation (use CreateCLI)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/CreateSkill/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# CreateSkill

Complete skill development lifecycle: **structure** (create, validate, canonicalize) + **effectiveness** (test, improve, optimize triggers). Structural workflows ensure skills follow PAI conventions. Effectiveness workflows — inspired by Anthropic's skill-creator — ensure skills actually work and trigger reliably.

## Authoritative Source

**Before creating ANY skill, READ:** `~/.claude/PAI/DOCUMENTATION/Skills/SkillSystem.md`

**Canonical example to follow:** any well-formed public skill in `~/.claude/skills/` (e.g. `Research/SKILL.md`, `Daemon/SKILL.md`, `CreateSkill/SKILL.md` itself).

## Naming Convention — Public vs Private

**Skill name encodes its public/private status. There are exactly two valid forms.**

| Skill type | Directory format | Example | Allowed content |
|------------|------------------|---------|-----------------|
| **Public** | `TitleCase` | `Blogging`, `Daemon`, `CreateSkill` | Templated, safe, generic, ready for public release |
| **Private** | `_ALLCAPS` (underscore prefix, all uppercase) | `<your-release-skill>`, `_INBOX`, `_BROADCAST`, `_DOTFILES` | Anything personal, sensitive, identity-bound, customer-bound, or environment-specific |

**The leading underscore is the public-release boundary.** Release tooling skips `_*` skills entirely — they never leave `~/.claude`. Public skills (no underscore) are mirrored into the PAI public release and MUST contain only generic, templated content.

**Sub-file naming (both public and private skills):**

| Component | Format | Example |
|-----------|--------|---------|
| Workflow files | `TitleCase.md` | `Create.md`, `UpdateDaemonInfo.md` |
| Reference docs | `TitleCase.md` | `ProsodyGuide.md`, `ApiReference.md` |
| Tool files | `TitleCase.ts` | `ManageServer.ts` |
| Help files | `TitleCase.help.md` | `ManageServer.help.md` |

**Wrong (NEVER use):**
- Skill dirs: `createskill`, `create-skill`, `CREATE_SKILL` (no underscore + caps for public; no kebab/snake for private)
- Files: `create.md`, `update-info.md`, `SYNC_REPO.md`

### Choosing public vs private — the decision rule

Ask: **"Could this skill be dropped, as-is, into a stranger's `~/.claude/skills/` and just work?"**

- **Yes** → public skill (`TitleCase`). Body must be generic; user-specific config layers in via `PAI/USER/SKILLCUSTOMIZATIONS/<SkillName>/`.
- **No, because it references my identity, my contacts, my business, my customer, my paid API, my private infra, my domain, my private repo, my partner, or my financial/health/security data** → private skill (`_ALLCAPS`).

**When in doubt, build it private first (`_ALLCAPS`). Promoting `_FOO` → `Foo` later is easy. Discovering a public skill leaks your life is permanent.**

---

## Public Release Readiness (MANDATORY)

**Public skills (`TitleCase`) ship to the world. Private skills (`_ALLCAPS`) never leave the local repo.** Sensitivity is decided by skill name, not by per-file scrubbing at share-time.

### The Bright Line

**Public skill (`TitleCase`) — content rule:**

ONLY templated, safe, public, ready content. Period.

- ✅ Generic instructions any PAI user could follow
- ✅ Templated patterns with placeholders for user-specific values
- ✅ Public API references and dependencies on public tools
- ❌ Real names (people, products, companies, customers)
- ❌ Real domains, hostnames, IPs, internal URLs
- ❌ API keys, tokens, credentials, session cookies, OAuth secrets — even example-looking ones
- ❌ Private repo paths or references (`github.com/<org>/<private-repo>`)
- ❌ Customer data, customer-specific workflows, customer engagement context
- ❌ First-person war stories tied to a specific incident, project, or person
- ❌ User-specific filesystem paths (`/Users/<name>/...`, `/home/<name>/...`)
- ❌ Identity-bound preferences (DA name, principal name, partner name, pet name, financial figures, health data)

**Private skill (`_ALLCAPS`) — content rule:**

Anything goes. Real names, real domains, real customers, real credentials-by-reference (env var names, never values), real war stories, real internal infra. The underscore IS the safety boundary. These skills are excluded from release tooling.

### The Decision Test

When you find yourself wanting to write any of the following into a skill body, that skill MUST be `_ALLCAPS`:

| If the skill mentions… | Skill must be |
|------------------------|---------------|
| A specific person's name (yours, your partner's, your team's, a customer's) | `_ALLCAPS` |
| A specific product name you own or sell | `_ALLCAPS` |
| A specific customer or client | `_ALLCAPS` |
| A specific paid API account, billing realm, or subscription | `_ALLCAPS` |
| A specific private domain, hostname, internal IP, or VPN | `_ALLCAPS` |
| A specific private repo, dotfile location, or local infra | `_ALLCAPS` |
| A specific business process tied to your company | `_ALLCAPS` |
| A specific financial, health, security, or legal context | `_ALLCAPS` |
| A specific incident or one-off war story | `_ALLCAPS` |
| Anything that would be wrong, embarrassing, or unsafe in someone else's `~/.claude/` | `_ALLCAPS` |

If none of the above apply and the skill is fully generic — it can be `TitleCase` (public).

### Where Personal Layering Goes for Public Skills

A public skill can be made user-specific at runtime via `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/<SkillName>/PREFERENCES.md`. The skill body stays generic; the user's customization file overlays per-instance context. Use this when a skill is fundamentally generic but benefits from per-user tweaks (preferred voice, default formats, personal taste).

**Do not use SKILLCUSTOMIZATIONS to smuggle private content into a public skill.** If the skill *requires* private context to function (real customer name, real API account, real internal infra), it is a private skill — name it `_ALLCAPS` and stop.

### Allowed in Public Skills

- Generic `~/` paths (`~/.claude/skills/`, `~/Projects/<tool>/`) — resolve per-user
- Public repo URLs for tools the skill depends on
- Public API endpoints that are conventions, not secrets (e.g., `localhost:31337/notify`)
- Example values clearly marked as placeholders (`<url>`, `<SESSION_ID>`, `test@example.com`)
- Generic env var *names* (never values): `STRIPE_API_KEY`, `OPENAI_API_KEY`

### Pre-Flight Grep (Public Skills Only)

Before shipping or modifying any `TitleCase` skill, run:
```bash
rg -i "<your-name>|<your-org>|<your-product>|<your-domain>|/Users/[a-z]+/" ~/.claude/skills/<SkillName>/
```

Zero matches = ready for public release. Any match = either scrub it, move it to SKILLCUSTOMIZATIONS, or rename the skill to `_ALLCAPS` and stop pretending it's public. **`_ALLCAPS` skills are exempt from this grep — they are private by design.**

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

**These subdirectories are allowed:**
- **Workflows/** - Execution workflows ONLY
- **Tools/** - Executable scripts/tools ONLY
- **References/** - Extended reference material for large skills (API docs, detailed guides)

**Context files (documentation, guides, references) go in the skill ROOT or in References/.**

**When to use References/:** When SKILL.md exceeds ~500 lines and has substantial reference content (API signatures, detailed examples, troubleshooting guides). Keep SKILL.md as a routing guide; move encyclopedic content to References/.

### Why

1. **Discoverability** - Easy to find files
2. **Simplicity** - Less navigation overhead
3. **Speed** - Faster file operations
4. **Consistency** - Every skill follows same pattern

**If you need to organize many workflows, use clear filenames instead of subdirectories:**

**See:** `~/.claude/PAI/DOCUMENTATION/Skills/SkillSystem.md` (Flat Folder Structure section)

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
skills/Art/
├── SKILL.md
└── Context/              ❌ NEVER CREATE THIS
    └── Aesthetic.md
```

**CORRECT:**
```
skills/Art/
├── SKILL.md
├── Aesthetic.md          ✅ Context file in skill root
├── Examples.md           ✅ Context file in skill root
└── Tools.md              ✅ Context file in skill root
```

**The skill directory IS the context.**

### Example Structure

```
skills/Art/
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
description: Create, test, and optimize PAI skills — scaffolding, effectiveness testing, description optimization. USE WHEN create skill, new skill, validate skill, test skill, improve skill, optimize description.
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
- Pure utility wrappers (use PAI/TOOLS.md instead)

### Benefits

- **Token Savings:** 70%+ reduction on skill invocation (when full docs not needed)
- **Organization:** SKILL.md = routing, context files = SOPs for specific aspects
- **Efficiency:** Workflows load only what they actually need
- **Maintainability:** Easier to update individual sections

**See:** `~/.claude/PAI/DOCUMENTATION/Skills/SkillSystem.md` (Dynamic Loading Pattern section)

---


## Workflow Routing

### Structure Workflows (scaffolding and conventions)

| Workflow | Trigger | File |
|----------|---------|------|
| **CreateSkill** | "create a new skill" | `Workflows/CreateSkill.md` |
| **ValidateSkill** | "validate skill", "check skill" | `Workflows/ValidateSkill.md` |
| **UpdateSkill** | "update skill", "add workflow" | `Workflows/UpdateSkill.md` |
| **CanonicalizeSkill** | "canonicalize", "fix skill structure" | `Workflows/CanonicalizeSkill.md` |

### Effectiveness Workflows (testing and optimization)

| Workflow | Trigger | File |
|----------|---------|------|
| **TestSkill** | "test skill", "does this skill work", "skill not working" | `Workflows/TestSkill.md` |
| **ImproveSkill** | "improve skill", "skill quality", "fix skill instructions" | `Workflows/ImproveSkill.md` |
| **OptimizeDescription** | "optimize description", "skill not triggering", "trigger accuracy" | `Workflows/OptimizeDescription.md` |

## Skill Types (Choose Before Building)

Before creating any skill, identify which of the 9 types it is (from Anthropic's internal skill taxonomy, Thariq Shihipar, Mar 2026). The type shapes structure and testing decisions.

| Type | Focus | Key Structure | Example |
|------|-------|---------------|---------|
| 1. Library/API Reference | Gotchas, edge cases Claude gets wrong | Lightweight, gotchas-heavy, reference snippets | HonoReference, D1Reference |
| 2. Product Validation | Test/verify code works | State assertions, browser automation, output recording | Browser |
| 3. Data Fetching | Connect to data systems | Credential refs, query patterns, dashboard pointers | USMetrics, _METRICS |
| 4. Business Process | Automate repetitive workflows | Execution logs, consistency tracking | _CLICKUP, _BROADCAST |
| 5. Code Scaffolding | Generate framework boilerplate | Template files, project-aware scripts | CreateCLI, CreateSkill |
| 6. Code Quality | Enforce standards, review | Deterministic scripts, hook integration | /simplify, /code-review |
| 7. CI/CD & Deployment | Deploy with safety patterns | Pre-deploy checks, smoke tests, rollback | (gap — needs Deploy skill) |
| 8. Operations Runbooks | Map phenomena to diagnostics | Phenomenon → tool → query → report | _HEALTHCHECK |
| 9. Infrastructure Ops | Maintenance with safety guardrails | Safety gates, audit logging, orphan detection | _PAI, _DOTFILES |

## Skill Writing Guidance

When writing or improving skill instructions, follow these principles from Anthropic's skill-creator methodology and Thariq Shihipar's "Lessons from Building Claude Code" (Mar 2026):

### Core Principles

- **Don't state the obvious.** Claude is competent at programming and knows codebases. Focus on information that **breaks Claude's default patterns** — things it gets wrong without guidance. Test: "Would Claude do this wrong without being told?" If not, remove it.
- **Explain the why, not just the what.** Models with good theory of mind + clear reasoning outperform models with rigid constraints. Instead of "ALWAYS use 3 bullets", explain why bullets matter for the audience.
- **Keep it lean.** The context window is a public good. Remove instructions that don't improve output. If test transcripts show the agent wasting time on unproductive steps, cut them. SKILL.md should be under 500 lines.
- **Generalize, don't overfit.** Fix underlying patterns, not specific test failures. The skill will be used on many prompts beyond your test set.
- **Bundle repeated work.** If test agents all independently wrote similar helper scripts, add that script to Tools/ so every future invocation benefits.
- **Set appropriate degrees of freedom.** Match specificity to task fragility. Database migrations need exact commands; code reviews need general direction.
- **Don't over-constrain.** Skills are reused heavily. Avoid overly specific instructions. Provide needed information but leave flexibility for different contexts.

### Description Best Practices

- **Descriptions are for models, not humans.** The description is injected into the system prompt. Claude reads it to decide whether to invoke the skill.
- **Descriptions should be slightly pushy.** Models tend to undertrigger. Name specific scenarios even if the user might not explicitly mention the skill.
- **Include negative triggers for confusable skills.** Add "NOT FOR" clauses when skills share vocabulary: `"NOT FOR web pentesting (use WebAssessment)"`.
- **Undertriggering signals:** Skill doesn't load when it should, users manually invoking it.
- **Overtriggering signals:** Skill loads for irrelevant queries, users disabling it.

### Gotchas Section (MANDATORY)

Every skill MUST have a `## Gotchas` section after the workflow routing table. Thariq: "The highest information density in any Skill comes from gotchas sections."

Populate with:
- API quirks Claude doesn't know about
- Common mistakes observed during usage
- Ordering/sequencing requirements that aren't obvious
- Edge cases that cause silent failures

**Gotchas accumulate over time.** After every skill failure, add the lesson.

### BPE (Bitter-Pilled Engineering) Check

Before finalizing any skill, ask: **"Would a smarter model make this skill unnecessary?"**

- **Anti-fragile (keep):** Verification harnesses, data pipelines, tool wrappers, accumulated gotchas, deterministic scripts
- **Fragile (question):** CoT orchestrators, format parsers, retry cascades, elaborate reasoning scaffolding

Focus skills on knowledge Claude can't derive (failure modes, API quirks), tools Claude can't replicate (API calls, automation), and workflows that benefit from consistency.

### Progressive Disclosure (from Anthropic)

Three levels of information loading — use this to manage large skills:
1. **Level 1 (YAML frontmatter):** Always in system prompt. Triggering info only.
2. **Level 2 (SKILL.md body):** Loaded when skill is invoked. Routing + key guidance.
3. **Level 3 (Reference files):** Root-level `.md` files or `References/` subdirectory loaded on demand.

Tell Claude what files exist; it will read them when appropriate. SKILL.md should be under 500 lines — if over, extract detailed content to reference files.

### Testing Best Practices (from Anthropic)

Three testing levels for skills:
1. **Manual testing** — Run queries and observe behavior
2. **Scripted testing** — Automate test cases (use TestSkill workflow)
3. **Programmatic testing** — Build evaluation suites (use Evals skill)

**Evaluation-driven development:** Define what "this skill working" looks like before building the skill. Iterate on a single challenging task until Claude succeeds, then extract the winning approach.

### On-Demand Hook Pattern (from Anthropic)

Skills can include hooks that activate only when invoked, remaining effective for the session:
- `/careful` — Intercept dangerous commands (rm -rf, DROP TABLE, force-push)
- `/freeze` — Block edits outside specific directories
- `/audit` — Log all tool calls for session review

*All guidance above derived from Thariq Shihipar's "Lessons from Building Claude Code" (Mar 2026), Anthropic's official skill guide, and platform documentation.*

## Examples

**Example 1: Create a new skill from scratch**
```
User: "Create a skill for managing my recipes"
→ Invokes CreateSkill workflow
→ Reads SkillSystem.md for structure requirements
→ Creates skill directory with TitleCase naming
→ Creates SKILL.md, Workflows/, Tools/
→ Suggests running TestSkill to verify effectiveness
```

**Example 2: Fix an existing skill that's not routing properly**
```
User: "The research skill isn't triggering - validate it"
→ Invokes ValidateSkill workflow
→ Checks SKILL.md against canonical format
→ Verifies TitleCase naming and USE WHEN triggers
→ Reports compliance issues with fixes
```

**Example 3: Test if a skill actually helps**
```
User: "Test the Blogging skill to see if it's effective"
→ Invokes TestSkill workflow
→ Generates 3 realistic test prompts
→ Spawns with-skill and baseline agents in parallel
→ Compares outputs, presents results
→ Iterates with ImproveSkill based on feedback
```

**Example 4: Skill isn't triggering on relevant prompts**
```
User: "The Security skill doesn't trigger when I ask about pentesting"
→ Invokes OptimizeDescription workflow
→ Generates 20 should/shouldn't-trigger queries
→ Tests description accuracy via subagents
→ Rewrites description, re-tests, reports improvement
```

**Example 5: Improve a skill that produces weak output**
```
User: "The research skill output is too verbose — improve it"
→ Invokes ImproveSkill workflow
→ Reads skill + user feedback
→ Diagnoses root cause (over-specified instructions)
→ Rewrites with reasoning instead of rigid MUSTs
→ Suggests TestSkill to verify improvement
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"CreateSkill","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
