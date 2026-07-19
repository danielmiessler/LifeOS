# Deep Investigation Workflow

**Mode:** Iterative progressive research | **Single-run or Loop mode**

## 🚨 CRITICAL: URL Verification Required

**BEFORE delivering any research results with URLs:**
1. Verify EVERY URL using WebFetch or curl
2. Confirm the content matches what you're citing
3. NEVER include unverified URLs - research agents HALLUCINATE URLs

See `SKILL.md` for full URL Verification Protocol.

---

## When to Use

- User says "deep investigation", "investigate [topic]", "deep research on [market/landscape/domain]"
- Competitive analysis, market mapping, threat landscape, technology survey
- Any research that benefits from **iterative deepening** — broad discovery first, then progressively deeper dives on the most important entities
- User explicitly requests loop mode research

## How It Works

This workflow implements a **progressive narrowing funnel**:

```
Iteration 1: Broad landscape → discover entities → score them → deep-dive the top one
Iteration 2: Read previous artifacts → pick next highest-value entity → deep-dive
Iteration 3+: Continue until coverage gates pass
```

**Single-run mode:** Completes one full cycle (landscape through first deep dive).
**Loop mode:** The Algorithm's loop mechanism drives iterations. Each iteration reads previous artifacts and deepens coverage. The workflow is stateless — all state lives in artifacts on disk.

---

## Vault Location

All artifacts persist at:
```
{{LIFEOS_DIR}}/MEMORY/RESEARCH/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}/
```


---

## Workflow

### Step 0: Detect Iteration State

```
READ vault directory for existing artifacts:
  - LANDSCAPE.md exists? → This is a CONTINUATION (skip to Step 3 or 4)
  - ENTITIES.md exists? → This is a CONTINUATION (skip to Step 3 or 4)
  - Neither exists? → This is FIRST ITERATION (start at Step 1)

IF continuation:
  READ ENTITIES.md → check for PENDING entities with CRITICAL/HIGH value
  IF PENDING CRITICAL/HIGH exist → skip to Step 4 (Investigate)
  IF all CRITICAL/HIGH done but categories incomplete → skip to Step 3 (Discover)
  IF all gates pass → EXIT (report completion)
```

**This is the key to loop mode.** The Algorithm re-runs the full workflow each iteration, but the workflow itself checks what's already done and jumps to the right phase. No loop control logic here — just artifact-aware resumption.

---

### Step 1: Landscape (Broad — First Iteration Only)

**Goal:** Understand the full landscape. This is the EXPENSIVE phase — do it once, reference it cheaply in all later iterations.

**Select domain template pack:** Read `Templates/{domain}.md` based on user's topic. If no exact match, use the closest template or create entity categories dynamically.

**Launch Extensive Research (7 explorers + 2 verifiers = 9 agents):**

```
Use the Extensive Research pattern (7 explorers + 2 verifiers):

Angles should cover:
- Market/domain overview and structure
- Key players and competitive dynamics
- Recent developments and trends
- Historical context and evolution
- Adjacent domains and cross-cutting themes
- Contrarian views and underappreciated dynamics
```

**Produce LANDSCAPE.md:**

```markdown
# {Topic} Landscape

## Overview
[2-3 paragraph synthesis of the domain]

## Market/Domain Structure
[Segmentation, categories, size if applicable]

## Key Dynamics
[What forces shape this domain? What's changing?]

## Entity Categories
[From domain template pack or discovered dynamically]
- Category 1: [description, estimated entity count]
- Category 2: [description, estimated entity count]
- ...

## Initial Entity Discoveries
[Entities found during landscape research — transfer to ENTITIES.md]

## Sources
[Verified URLs only]
```

**Produce ENTITIES.md:**

```markdown
# Entity Catalog

## Status Legend
- **PENDING** — Discovered, not yet researched
- **RESEARCHED** — Full profile created in vault
- **SKIP** — Evaluated as not worth deep research

## Value Legend
- **CRITICAL** — Defines the domain. Must research.
- **HIGH** — Major player. Research if time allows.
- **MEDIUM** — Notable. Research in later iterations.
- **LOW** — Minor. Skip unless specifically relevant.

## Effort Legend
- **EASY** — Abundant public information
- **MODERATE** — Good web presence, some digging needed
- **HARD** — Limited public info, requires deep searching

---

| Entity | Category | Status | Value | Effort | Profile |
|--------|----------|--------|-------|--------|---------|
| [name] | [category] | PENDING | — | — | — |
```

**Produce INDEX.md:**

```markdown
# {Topic} Research Vault

**Created:** {date}
**Domain Template:** {template name}
**Status:** IN PROGRESS

## Navigation
- [Landscape](LANDSCAPE.md)
- [Entity Catalog](ENTITIES.md)

## Profiles
[Updated as profiles are created]

## Coverage
- Categories: 0/{N} complete
- Entities: 0 RESEARCHED / {N} total
- CRITICAL/HIGH: 0 RESEARCHED / {N} pending
```

---

### Step 2: Evaluate (Score Entities)

**For each PENDING entity without a VALUE score:**

Assess on two dimensions:

**VALUE (Market/Domain Impact):**
- **CRITICAL** — Market leaders, category definers, essential to understanding the domain
- **HIGH** — Major players, significantly influence the domain
- **MEDIUM** — Notable contributors with specialized focus
- **LOW** — Minor players, marginal impact

**EFFORT (Information Accessibility):**
- **EASY** — Public companies, abundant documentation, press coverage
- **MODERATE** — Good web presence, some proprietary info
- **HARD** — Limited public info, stealth-mode, minimal coverage

**Priority Order for Investigation:**
1. CRITICAL + EASY (highest ROI)
2. CRITICAL + HARD (must-have despite difficulty)
3. HIGH + EASY (good ROI)
4. HIGH + HARD (worthwhile if time allows)
5. MEDIUM+ only after all CRITICAL/HIGH done

**Update ENTITIES.md** with VALUE and EFFORT scores.

---

### Step 3: Discover (Expand Coverage)

**Goal:** Find entities in undercovered categories.

Check ENTITIES.md for categories with fewer than 3 entities. For each thin category:

**Launch 2-3 targeted researcher agents:**
```
Task({
  subagent_type: "PerplexityResearcher",
  prompt: "Find 3-5 notable {entity_category} in the {domain} space.
           For each: name, one-line description, why they matter.
           Already known: {list existing entities in this category}.
           Find NEW ones not in that list."
})
```

**Add discoveries to ENTITIES.md** with status PENDING, then run Step 2 (Evaluate) on them.

---

### Step 4: Investigate (Deep Dive — One Entity)

**Goal:** Create a comprehensive profile of ONE entity. Quality over quantity.

**Select the highest-priority PENDING entity:**
1. Sort by VALUE (CRITICAL first), then EFFORT (EASY first)
2. Pick the top one

**Load the profile template** from the domain template pack for this entity's category.

**Launch focused research (3 agents, entity-specific):**

```
Task({
  subagent_type: "ClaudeResearcher",
  prompt: "Deep research on {entity_name} in the context of {domain}.
           Focus on: {template_fields_for_this_category}
           Context: {1-paragraph from LANDSCAPE.md about this entity's category}
           Tag each finding with confidence: [HIGH], [MED], or [LOW].
           Return comprehensive findings organized by the template fields."
})

Task({
  subagent_type: "PerplexityResearcher",
  prompt: "Find recent information about {entity_name}:
           latest news, funding, product launches, key hires, partnerships.
           Focus on developments in the last 12 months.
           Tag each finding with confidence: [HIGH], [MED], or [LOW]."
})

Task({
  subagent_type: "GeminiResearcher",
  prompt: "Research {entity_name}: competitive position, strengths, weaknesses,
           how they compare to {list 2-3 related entities from ENTITIES.md}.
           What makes them distinctive in the {domain} landscape?
           Tag each finding with confidence: [HIGH], [MED], or [LOW]."
})
```

**Produce entity profile** using the domain template:

Save to: `vault/{Category}/{entity-slug}.md`

**Add cross-links:** Reference related entities discovered during research using `Entity Name` links.

**Update ENTITIES.md:** Mark entity as RESEARCHED, add profile link.

**Update INDEX.md:** Add profile to navigation.

---

### Step 4.5: Verify Entity Profile (Loop Mode Only)

**In loop mode**, before the Progress Check, spot-check the entity profile for quantitative claims:

1. Scan the profile for numbers, dates, and percentages
2. Pick the 2-3 most important quantitative claims
3. Verify each via a quick WebSearch or WebFetch
4. Tag verified claims `[HIGH]`, unverifiable claims `[LOW]`
5. Note any `[CONFLICT]` items where agents disagreed

**In single-run mode**, skip this step — verification happens at the end when reviewing the full vault.

**This adds ~10-15s per iteration but catches errors before they propagate into cross-linked profiles.**

---

### Step 5: Progress Check (Loop Gate)

**Two gates must BOTH pass to exit:**

**Breadth Gate:**
```
For each entity category defined in Step 1:
  Count entities with status != SKIP
  PASS if count >= 3 for ALL categories
  FAIL if any category has < 3 entities
```

**Depth Gate:**
```
For all entities with VALUE = CRITICAL or HIGH:
  Count with status = RESEARCHED or SKIP
  PASS if ALL are RESEARCHED or SKIP
  FAIL if any are still PENDING
```

**Gate Results:**

```
IF both gates PASS:
  → Produce SUMMARY.md (executive synthesis of all findings)
  → Update INDEX.md with final statistics
  → Report completion to Algorithm's VERIFY phase

IF either gate FAILS:
  → Report to Algorithm's VERIFY phase: "Coverage incomplete"
  → The Algorithm's loop mode will trigger next iteration
  → Next iteration re-enters this workflow at Step 0 (which detects continuation)
```

**The workflow does NOT control the loop.** It reports pass/fail. The Algorithm decides whether to iterate.

---

## Single-Run vs Loop Mode

| Aspect | Single-Run | Loop Mode |
|--------|-----------|-----------|
| Iterations | 1 | Algorithm-controlled (N turns) |
| Coverage | Landscape + first deep dive | Full breadth + depth gates |
| Exit | After Step 4 completes | After Step 5 gates pass |
| Best for | Quick overview + top entity | Comprehensive investigation |
| Time | 3-5 minutes | 15-60 minutes (varies by domain) |

**In single-run mode:** Complete Steps 1-4 (landscape through one deep dive), then report what was accomplished and what remains PENDING for a future loop-mode run.

**In loop mode:** The Algorithm iterates. Each iteration enters at Step 0, detects state, and does the next unit of work. Typical iteration pattern:
- Iteration 1: Steps 1-4 (landscape, discover, evaluate, first deep dive)
- Iteration 2-N: Steps 0→4 (detect state, maybe discover more, evaluate, deep dive next)
- Final iteration: Step 0→5 (detect state, gates pass, produce summary)

---

## Domain Template Packs

Templates live at `{{LIFEOS_ROOT}}/skills/Research/Templates/{DomainName}.md`

Each template pack defines:
1. **Entity categories** for this domain (what types of things to discover)
2. **Profile templates** per category (what fields to research for each type)
3. **Evaluation criteria** (what makes something CRITICAL vs LOW in this domain)
4. **Search strategies** (domain-specific search tips for researchers)

**Available packs:**
- `MarketResearch.md` — Companies, Products, People, Technologies, Trends
- `ThreatLandscape.md` — Threat Actors, Campaigns, TTPs, Vulnerabilities

**No template match?** The workflow dynamically creates entity categories based on the landscape research in Step 1. Templates improve quality but aren't required.

---

## Output Artifacts

After a complete investigation, the vault contains:

```
{vault}/
  INDEX.md                  — Navigation hub with coverage stats
  LANDSCAPE.md              — Broad domain analysis (created once, referenced often)
  ENTITIES.md               — Master catalog with status tracking
  SUMMARY.md                — Executive synthesis (created on completion)
  Companies/                — Entity profiles by category
    company-a.md
    company-b.md
  Products/
    product-x.md
  People/
    person-y.md
  ...
```

All profiles are cross-linked. The vault is self-contained and readable as a standalone knowledge base.
