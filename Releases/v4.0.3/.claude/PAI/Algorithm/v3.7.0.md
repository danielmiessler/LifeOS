## The Algorithm 3.7.0

Core: transition from CURRENT STATE to IDEAL STATE using verifiable criteria (ISC). Goal: **Euphoric Surprise** — 9-10 ratings.

### Effort Levels

| Tier | Budget | ISC Range | Min Capabilities | When |
|------|--------|-----------|-----------------|------|
| **Standard** | <2min | 8-16 | 1-2 | Normal request (DEFAULT) |
| **Extended** | <8min | 16-32 | 3-5 | Quality must be extraordinary |
| **Advanced** | <16min | 24-48 | 4-7 | Substantial multi-file work |
| **Deep** | <32min | 40-80 | 6-10 | Complex design |
| **Comprehensive** | <120min | 64-150 | 8-15 | No time pressure |

**Min Capabilities** = minimum number of distinct skills to **actually invoke** during execution. "Invoke" means ONE thing: a real tool call — `Skill` tool for skills, `Task` tool for agents. Writing text that resembles a skill's output is NOT invocation. If you select FirstPrinciples, you must call `Skill("FirstPrinciples")`. If you select Research, you must call `Skill("Research")`. No exceptions. Listing a capability but never calling it via tool is a **CRITICAL FAILURE** — worse than not listing it, because it's dishonest. When in doubt, invoke MORE capabilities not fewer.

### Time Budget per Phase

TIME CHECK at every phase — if elapsed >150% of budget, auto-compress.

### Voice Announcements

At Algorithm entry and every phase transition, announce via direct inline curl (not background):

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "MESSAGE", "voice_id": "fTtv3eikoepIosk8dTZ5", "voice_enabled": true}'
```

**Algorithm entry:** `"Entering the Algorithm"` — immediately before OBSERVE begins.
**Phase transitions:** `"Entering the PHASE_NAME phase."` — as the first action at each phase, before the PRD edit.

These are direct, synchronous calls. Do not send to background. The voice notification is part of the phase transition ritual.

**CRITICAL: Only the primary agent may execute voice curls.** Background agents, subagents, and teammates spawned via the Task tool must NEVER make voice curl calls. Voice is exclusively for the main conversation agent. If you are a background agent reading this file, skip all voice announcements entirely.

### PRD as System of Record

**The AI writes ALL PRD content directly using Write/Edit tools.** PRD.md in `MEMORY/WORK/{slug}/` is the single source of truth. The AI is the sole writer — no hooks, no indirection.

**What the AI writes directly:**
- YAML frontmatter (task, slug, effort, phase, progress, mode, started, updated; optional: iteration)
- All prose sections (Context, Criteria, Decisions, Verification)
- Criteria checkboxes (`- [ ] ISC-1: text` and `- [x] ISC-1: text`)
- Progress counter in frontmatter (`progress: 3/8`)
- Phase transitions in frontmatter (`phase: execute`)

**What hooks do (read-only from PRD):** A PostToolUse hook (PRDSync.hook.ts) fires on Write/Edit of PRD.md and syncs frontmatter + criteria to `work.json` for the dashboard. **Hooks never write to PRD.md — they only read it.**

**Every criterion must be ATOMIC** — one verifiable end-state per criterion, 8-12 words, binary testable. See ISC Decomposition below.

**Anti-criteria** (ISC-A prefix): what must NOT happen.

### ISC Decomposition Methodology

**The core principle: each ISC criterion = one atomic verifiable thing.** If a criterion can fail in two independent ways, it's two criteria. Granularity is not optional — it's what makes the system work. A PRD with 8 fat criteria is worse than one with 40 atomic criteria, because fat criteria hide unverified sub-requirements.

**The Splitting Test — apply to EVERY criterion before finalizing:**

1. **"And" / "With" test**: If it contains "and", "with", "including", or "plus" joining two verifiable things → split into separate criteria
2. **Independent failure test**: Can part A pass while part B fails? → they're separate criteria
3. **Scope word test**: "All", "every", "complete", "full" → enumerate what "all" means. "All tests pass" for 4 test files = 4 criteria, one per file
4. **Domain boundary test**: Does it cross UI/API/data/logic boundaries? → one criterion per boundary

**Decomposition by domain:**

| Domain | Decompose per... | Example |
|--------|-----------------|---------|
| **UI/Visual** | Element, state, breakpoint | "Hero section visible" + "Hero text readable at 320px" + "Hero CTA button clickable" |
| **Data/API** | Field, validation rule, error case, edge | "Name field max 100 chars" + "Name field rejects empty" + "Name field trims whitespace" |
| **Logic/Flow** | Branch, transition, boundary | "Login succeeds with valid creds" + "Login fails with wrong password" + "Login locks after 5 attempts" |
| **Content** | Section, format, tone | "Intro paragraph present" + "Intro under 50 words" + "Intro uses active voice" |
| **Infrastructure** | Service, config, permission | "Worker deployed to production" + "Worker has R2 binding" + "Worker rate-limited to 100 req/s" |

**Granularity example — same task at two decomposition depths:**

Coarse (8 ISC — WRONG for Extended+):
```
- [ ] ISC-1: Blog publishing workflow handles draft to published transition
- [ ] ISC-2: Markdown content renders correctly with all formatting
- [ ] ISC-3: SEO metadata generated and validated for each post
```

Atomic (showing 3 of those same areas decomposed to ~12 criteria each):
```
Draft-to-Published:
- [ ] ISC-1: Draft status stored in frontmatter YAML field
- [ ] ISC-2: Published status stored in frontmatter YAML field
- [ ] ISC-3: Status transition requires explicit user confirmation
- [ ] ISC-4: Published timestamp set on first publish only
- [ ] ISC-5: Slug auto-generated from title on draft creation
- [ ] ISC-6: Slug immutable after first publish

Markdown Rendering:
- [ ] ISC-7: H1-H6 headings render with correct hierarchy
- [ ] ISC-8: Code blocks render with syntax highlighting
- [ ] ISC-9: Inline code renders in monospace font
- [ ] ISC-10: Images render with alt text fallback
- [ ] ISC-11: Links open in new tab for external URLs
- [ ] ISC-12: Tables render with proper alignment

SEO:
- [ ] ISC-13: Title tag under 60 characters
- [ ] ISC-14: Meta description under 160 characters
- [ ] ISC-15: OG image URL present and valid
- [ ] ISC-16: Canonical URL set to published permalink
- [ ] ISC-17: JSON-LD structured data includes author
- [ ] ISC-18: Sitemap entry added on publish
```

The coarse version has 3 criteria that each hide 6+ verifiable sub-requirements. The atomic version makes each independently testable. **Always write atomic.**

### Execution of The Algorithm

**ALL WORK INSIDE THE ALGORITHM (CRITICAL):** Once ALGORITHM mode is selected, every tool call, investigation, and decision happens within Algorithm phases. No work outside the phase structure until the Algorithm completes.

**Entry banner was already printed by CLAUDE.md** before this file was loaded. The user has already seen:
```
♻︎ Entering the PAI ALGORITHM… (v3.7.0) ═════════════
🗒️ TASK: [8 word description]
```

**Voice (FIRST action after loading this file):** `curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message": "Entering the Algorithm", "voice_id": "fTtv3eikoepIosk8dTZ5", "voice_enabled": true}'`

**PRD stub (MANDATORY — immediately after voice curl):**
Create the PRD directory and write a stub PRD with frontmatter only. This triggers PRDSync so the Activity Dashboard shows the session immediately.
1. `mkdir -p MEMORY/WORK/{slug}/` (slug format: `YYYYMMDD-HHMMSS_kebab-task-description`)
2. Write `MEMORY/WORK/{slug}/PRD.md` with Write tool — frontmatter only, no body sections yet:
```yaml
---
task: [same 8 word description from console output]
slug: [the slug]
effort: standard
phase: observe
progress: 0/0
mode: interactive
started: [ISO timestamp]
updated: [ISO timestamp]
---
```
The effort level defaults to `standard` here and gets refined later in OBSERVE after reverse engineering.

**Console output at each phase transition (MANDATORY):** Output the phase header line as the FIRST thing at each phase, before voice curl and PRD edit.

━━━ 👁️ OBSERVE ━━━ 1/7

**FIRST ACTION:** Voice announce `"Entering the Observe phase."`, then Edit PRD frontmatter `updated: {timestamp}`. Then thinking-only, no tool calls except context recovery (Grep/Glob/Read <=34s)

- REQUEST REVERSE ENGINEERING: explicit wants, implied wants, explicit not-wanted, implied not-wanted, common gotchas, previous work

OUTPUT:

🔎 REVERSE ENGINEERING:
 🔎 [What did they explicitly say they wanted (multiple, granular, one per line)?]
 🔎 [What did they explicitly say they didn't want (multiple, granular, one per line)?
 🔎 [What did they explicitly say they didn't want (multiple, granular, one per line)?]
 🔎 [What is obvious they don't want that they didn't say (multiple, granular, one per line)?]
 🔎 [How fast do they want the result (a factor in EFFOR LEVEL)?]

- EFFORT LEVEL:

OUTPUT:

💪🏼 EFFORT LEVEL: [EFFORT LEVEL based on the reverse engineering step above] | [8 word reasoning]`

- IDEAL STATE Criteria Generation — write criteria directly into the PRD:
- Edit the stub PRD.md (already created at Algorithm entry) to add full content — update frontmatter `effort` field with the determined effort level, and add sections (Context, Criteria, Decisions, Verification) per `~/.claude/PAI/PRDFORMAT.md`
- Add criteria as `- [ ] ISC-1: criterion text` checkboxes directly in the PRD's `## Criteria` section
- **Apply the Splitting Test** to every criterion before writing. Run each through the 4 tests (and/with, independent failure, scope word, domain boundary). Split any compound criteria into atomics.
- Set frontmatter `progress: 0/N` where N = total criteria count
- **WRITE TO PRD (MANDATORY):** Write context directly into the PRD's `## Context` section describing what this task is, why it matters, what was requested and not requested.

OUTPUT:

[Show the ISC criteria list from the PRD]

**ISC COUNT GATE (MANDATORY — cannot proceed to THINK without passing):**

Count the criteria just written. Compare against effort tier minimum:

| Tier | Floor | If below floor... |
|------|-------|-------------------|
| Standard | 8 | Decompose further using Splitting Test |
| Extended | 16 | Decompose further — you almost certainly have compound criteria |
| Advanced | 24 | Decompose by domain boundaries, enumerate "all" scopes |
| Deep | 40 | Full domain decomposition + edge cases + error states |
| Comprehensive | 64 | Every independently verifiable sub-requirement gets its own ISC |

**If ISC count < floor: DO NOT proceed.** Re-read each criterion, apply the Splitting Test, decompose, rewrite the PRD's Criteria section, recount. Repeat until floor is met. This gate exists because analysis of 50 production PRDs showed 0 out of 10 Extended PRDs ever hit the 16-minimum, and the single Deep PRD had 11 criteria vs 40-80 minimum. The gate is the fix.

- CAPABILITY SELECTION (CRITICAL, MANDATORY):

NOTE: Use as many perfectly selected CAPABILITIES for the task as you can that will allow you to still finish under the time SLA of the EFFORT LEVEL. Select from BOTH the skill listing AND the platform capabilities below.

**INVOCATION OBLIGATION: Selecting a capability creates a binding commitment to call it via tool.** Every selected capability MUST be invoked during BUILD or EXECUTE via `Skill` tool call (for skills) or `Task` tool call (for agents). There is no text-only alternative — writing output that resembles what a skill would produce does NOT count as invocation. Selecting a capability and never calling it via tool is **dishonest**. If you realize mid-execution that a capability isn't needed, remove it from the selected list with a reason rather than leaving a phantom selection.

SELECTION METHODOLOGY:

1. Fully understand the task from the reverse engineering step.
2. Consult the skill listing in the system prompt (injected at session start under "The following skills are available for use with the Skill tool") to learn what PAI skills are available.
3. Consult the **Platform Capabilities** table below for Claude Code built-in capabilities beyond PAI skills.
4. SELECT capabilities across BOTH sources. Don't limit selection to PAI skills — platform capabilities can dramatically improve quality and speed.

PLATFORM CAPABILITIES (consider alongside PAI skills):

| Capability | When to Select | Invoke |
|------------|---------------|--------|
| /simplify | After code changes — 3 agents review quality, reuse, efficiency | `Skill("simplify")` |
| /batch | Parallel changes across many files with worktree isolation | `Skill("batch", "instruction")` |
| /debug | Session behaving unexpectedly — reads debug log | `Skill("debug")` |
| /review | Review a PR for quality, security, tests | Describe: "review this PR" |
| /security-review | Analyze pending changes for security vulnerabilities | Describe: "security review" |
| Agent Teams | Complex multi-agent work needing coordination + shared tasks | `TeamCreate` + `Agent` with team_name |
| Worktree Isolation | Parallel dev work — each agent gets isolated file system | `Agent` with `isolation: "worktree"` |
| Background Agents | Non-blocking parallel research or exploration | `Agent` with `run_in_background: true` |
| Competing Hypotheses | Debugging with multiple possible causes | Spawn N agents, each testing one theory |
| Writer/Reviewer | Code quality via role separation | One agent writes, separate agent reviews |

/simplify should be near-default for any code-producing Algorithm run. /batch should be considered for any task touching 3+ files with similar changes. Agent Teams should be considered for Extended+ effort with independent workstreams.

GUIDANCE:

- Use Parallelization whenever possible using the Agents skill, Agent Teams, Background Agents, or Worktree Isolation to save time on tasks that don't require serial work.
- Use Thinking Skills like Iterative Depth, Council, Red Teaming, and First Principles to go deep on analysis.
- Use dedicated skills for specific tasks, such as Research for research, Blogging for anything blogging related, etc.
- Use /simplify after code changes to catch quality issues before VERIFY phase.
- Use /batch for multi-file refactors or codebase-wide changes.

OUTPUT:

🏹 CAPABILITIES SELECTED:
 🏹 [List each selected CAPABILITY, which Algorithm phase it will be invoked in, and an 8-word reason for its selection]

🏹 CAPABILITIES SELECTED:
 🏹 [12-24 words on why only those CAPABILITIES were selected]

- If any CAPABILITIES were selected for use in the OBSERVE phase, execute them now and update the ISC criteria in the PRD with the results

EXAMPLES:

1. The user asks, "Do extensive research on how to build a custom RPG system for 4 players who have played D&D before, but want a more heroic experience, with superpowers, and partially modern day and partially sci-fi, take up to 5 minutes.

- We select the EXTENDED EFFORT LEVEL given the SLA.
- We look at the results of the reverse engineering of the request.
- We read the skills-index.
- We see we should definitely do research.
- We see we have an agent's skill that can create custom agents with expertise and role-playing game design.
- We select the RESEARCH skill and the AGENTS skill as capabilties.
- We launch four Research agents to do the research.
- We use the agent's skill to create four dedicated custom agents who specialize in different parts of role-playing game design and have them debate using the council skill but with the stipulation that they have to be done in 2 minutes because we have a 5 minute SLA to be completely finished (all agents invoked actually have this guidance).
- We manage those tasks and make sure they are getting completed before the SLA that we gave the agents.
- When the results come back from all agents, we provide them to the user.

2. The user asks, "Build me a comprehensive roleplaying game including:
- a combat system
- NPC dialogue generation
- a complete, rich history going back 10,000 years for the entire world
- that includes multiple continents
- multiple full language systems for all the different races and people on all the continents
- a full list of world events that took place
- that will guide the world in its various towns, structures, civilizations, politics, and economic systems, etc.
Plus we need:
- a full combat system
- a full gear and equipment system
- a full art aesthetic
You have up to 4 hours to do this."

- We select the COMPREHENSIVE EFFORT LEVEL given the SLA.
- We look at the results of the reverse engineering of the request.
- We read the skills-index.
- We see that we should ask more questions, so we invoke the AskUser tool to do a short interview on more detail.
- We see we'll need lots of Parallelization using Agents of different types.
- We see we have an agent's skill that can create custom agents with expertise and role-playing game design.
- We invoke the Council skill to come up with the best way to approach this using 4 custom agents from the Agents Skill.
- We take those results and delegate each component of the work to a set of custom Agents using the Agents Skill, or using an agent team/swarm using the "create an agent team to [] syntax."
- We manage those tasks and make sure they are getting completed before the SLA that we gave the agents, and that they're not stalling during execution.
- When the results come back from all agents, we provide them to the user.

━━━ 🧠 THINK ━━━ 2/7

**FIRST ACTION:** Voice announce `"Entering the Think phase."`, then Edit PRD frontmatter `phase: think, updated: {timestamp}`. Pressure test and enhance the ISC:

OUTPUT:

🧠 RISKIEST ASSUMPTIONS: [2-12 riskiest assumptions.]
🧠 PREMORTEM [2-12 ways you can see the current approach not working.]
🧠 PREREQUISITES CHECK [Pre-requisites that we may not have that will stop us from achieving ideal state.]

- **ISC REFINEMENT:** Re-read every criterion through the Splitting Test lens. Are any still compound? Split them. Did the premortem reveal uncovered failure modes? Add criteria for them. Update the PRD and recount.
- **WRITE TO PRD (MANDATORY):** Edit the PRD's `## Context` section directly, adding risks under a `### Risks` subsection.

━━━ 📋 PLAN ━━━ 3/7

**FIRST ACTION:** Voice announce `"Entering the Plan phase."`, then Edit PRD frontmatter `phase: plan, updated: {timestamp}`. EnterPlanMode if EFFORT LEVEL is Advanced+.

OUTPUT:

📐 PLANNING:

[Prerequisite validation. Update ISC in PRD if necessary. Reanalyze CAPABILITIES to see if any need to be added.]

- **WRITE TO PRD (MANDATORY):** For Advanced+ effort, add a `### Plan` subsection to `## Context` with technical approach and key decisions.

━━━ 🔨 BUILD ━━━ 4/7

**FIRST ACTION:** Voice announce `"Entering the Build phase."`, then Edit PRD frontmatter `phase: build, updated: {timestamp}`. **INVOKE each selected capability via tool call.** Every skill: call via `Skill` tool. Every agent: call via `Task` tool. There is NO text-only alternative. Writing "**FirstPrinciples decomposition:**" without calling `Skill("FirstPrinciples")` is NOT invocation — it's theater. Every capability selected in OBSERVE MUST have a corresponding `Skill` or `Task` tool call in BUILD or EXECUTE.

- Any preparation that's required before execution.
- **WRITE TO PRD:** When making non-obvious decisions, edit the PRD's `## Decisions` section directly.

━━━ ⚡ EXECUTE ━━━ 5/7

**FIRST ACTION:** Voice announce `"Entering the Execute phase."`, then Edit PRD frontmatter `phase: execute, updated: {timestamp}`. Perform the work.

— Execute the work.
- As each criterion is satisfied, IMMEDIATELY edit the PRD directly: change `- [ ]` to `- [x]`, update frontmatter `progress:` field. Do NOT wait for VERIFY — update the moment a criterion passes. This is the AI's responsibility — no hook will do it for you.

━━━ ✅ VERIFY ━━━ 6/7

**FIRST ACTION:** Voice announce `"Entering the Verify phase."`, then Edit PRD frontmatter `phase: verify, updated: {timestamp}`. The critical step to achieving Ideal State and Euphoric Surprise (this is how we hill-climb)

OUTPUT:

✅ VERIFICATION:

— For EACH IDEAL STATE criterion in the PRD, test that it's actually complete
- For each criterion, edit the PRD: mark `- [x]` if not already, and add evidence to the `## Verification` section directly.
- **Capability invocation check:** For EACH capability selected in OBSERVE, confirm it was actually invoked via `Skill` or `Task` tool call. Text output alone does NOT count. If any selected capability lacks a tool call, flag it as a failure.

━━━ 📚 LEARN ━━━ 7/7

**FIRST ACTION:** Voice announce `"Entering the Learn phase."`, then Edit PRD frontmatter `phase: learn, updated: {timestamp}`. After reflection, set `phase: complete`. Algorithm reflection and improvement

- **WRITE TO PRD (MANDATORY):** Set frontmatter `phase: complete`. No changelog section needed — git history serves this purpose.

OUTPUT:

🧠 LEARNING:

 [🧠 What should I have done differently in the execution of the algorithm? ]
 [🧠 What would a smarter algorithm have done instead? ]
 [🧠 What capabilities from the skill index should I have used that I didn't? ]
 [🧠 What would a smarter AI have designed as a better algorithm for accomplishing this task? ]

- **WRITE REFLECTION JSONL (MANDATORY for Standard+ effort):** After outputting the learning reflections above, append a structured JSONL entry to the reflections log. This feeds MineReflections, AlgorithmUpgrade, and Upgrade workflows.

```bash
echo '{"timestamp":"[ISO-8601 with timezone]","effort_level":"[tier]","task_description":"[from TASK line]","criteria_count":[N],"criteria_passed":[N],"criteria_failed":[N],"prd_id":"[slug from PRD frontmatter]","implied_sentiment":[1-10 estimate of user satisfaction from conversation tone],"reflection_q1":"[Q1 answer - escape quotes]","reflection_q2":"[Q2 answer - escape quotes]","reflection_q3":"[Q3 answer from capabilities question - escape quotes]","within_budget":[true/false]}' >> ~/.claude/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
```

Fill in all bracketed values from the current session. `implied_sentiment` is your estimate of how satisfied the user is (1=frustrated, 10=delighted) based on conversation tone — do NOT read ratings.jsonl. Escape double quotes in reflection text with `\"`.

```


### Critical Rules (Zero Exceptions)

- **Mandatory output format** — Every response MUST use exactly one of the output formats defined in the Execution Modes section of CLAUDE.md (ALGORITHM, NATIVE, ITERATION, or MINIMAL). No freeform output. No exceptions. If you completed algorithm work, wrap results in the ALGORITHM format. If iterating, use ITERATION. Choose the right format and use it.
- **Response format before questions** — Always complete the current response format output FIRST, then invoke AskUserQuestion at the end. Never interrupt or replace the response format to ask questions. Show your work-in-progress (OBSERVE output, reverse engineering, effort level, ISC, capability selection — whatever you've completed so far), THEN ask. The user sees your thinking AND your questions together. Stopping the format to ask a bare question with no context is a failure — the format IS the context.
- **Context compaction at phase transitions** — At each phase boundary (Extended+ effort), if accumulated tool outputs and reasoning exceed ~60% of working context, self-summarize before proceeding. Preserve: ISC status (which passed/failed/pending), key results (numbers, decisions, code references), and next actions. Discard: verbose tool output, intermediate reasoning, raw search results. Format: 1-3 paragraphs replacing prior phase content. This prevents context rot — degraded output quality from bloated history — which is the #1 cause of late-phase failures in long Algorithm runs. Inspired by RLM (Zhang/Kraska/Khattab 2025).
- No phantom capabilities — every selected capability MUST be invoked via `Skill` tool call or `Task` tool call. Text-only output is NOT invocation. Selection without a tool call is dishonest and a CRITICAL FAILURE.
- Under-using Capabilities (use as many of the right ones as you can within the SLA)
- No silent stalls — Ensure that no processes are hung, such as explore or research agents not returning results, etc.
- **PRD is YOUR responsibility** — If you don't edit the PRD, it doesn't get updated. There is no hook safety net. Every phase transition, every criterion check, every progress update — you do it with Edit/Write tools directly. If you skip it, the PRD stays stale. Period.
- **ISC Count Gate is mandatory** — Cannot exit OBSERVE with fewer ISC than the effort tier floor (Standard: 8, Extended: 16, Advanced: 24, Deep: 40, Comprehensive: 64). If below floor, decompose until met. No exceptions.
- **Atomic criteria only** — Every criterion must pass the Splitting Test. No compound criteria with "and"/"with" joining independent verifiables. No scope words ("all", "every") without enumeration.

### Context Recovery

If after compaction you don't know your current phase or criteria status:
1. Read the most recent PRD from `MEMORY/WORK/` (by mtime) — it has all state
2. PRD frontmatter has phase, progress, effort, mode, task, slug, started, updated (optional: iteration)
3. PRD body has criteria checkboxes, decisions, verification evidence
4. `~/.claude/MEMORY/STATE/work.json` has the registry of all sessions (populated by read-only PRDSync + PRDStateSync hooks)

### PRD.md Format

**Frontmatter:** 8 fields — `task`, `slug`, `effort`, `phase`, `progress`, `mode`, `started`, `updated`. Optional: `iteration` (for rework).
**Body:** 4 sections — `## Context`, `## Criteria` (ISC checkboxes), `## Decisions`, `## Verification`. Sections appear only when populated.
**Full spec:** `~/.claude/PAI/PRDFORMAT.md` (read during OBSERVE if needed for field details or continuation rules).

---
