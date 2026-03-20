---
name: pai-upgrade
description: "Extract system improvements from content AND monitor external sources (Anthropic ecosystem, YouTube). USE WHEN upgrade, improve system, system upgrade, analyze for improvements, check Anthropic, new Claude features, check YouTube, algorithm upgrade, mine reflections, find sources, research upgrade, PAI upgrade."
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# PAIUpgrade Skill

**Purpose:** Generate prioritized upgrade recommendations by understanding user context and discovering ecosystem changes. Runs three parallel threads: User Context, Source Collection, and Internal Reflections — converging into personalized recommendations.

---

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Upgrade** | "check for upgrades", "check sources", "any updates", "check Anthropic", "upgrade", "pai upgrade" | `Workflows/Upgrade.md` |
| **MineReflections** | "mine reflections", "check reflections", "internal improvements", "reflection insights" | `Workflows/MineReflections.md` |
| **AlgorithmUpgrade** | "algorithm upgrade", "improve the algorithm", "algorithm improvements" | `Workflows/AlgorithmUpgrade.md` |
| **ResearchUpgrade** | "research this upgrade", "deep dive on [feature]", "further research" | `Workflows/ResearchUpgrade.md` |
| **FindSources** | "find upgrade sources", "find new sources", "discover channels" | `Workflows/FindSources.md` |

**Default:** "upgrade" or "check for upgrades" without specifics → **Upgrade** workflow (includes reflection mining as Thread 3).

---

## Process Flow

### Step 1: Launch Parallel Threads

Using BACKGROUNDDELEGATION, spawn simultaneously:

**Thread 1 — User Context (4 agents):**
- TELOS Agent: goals, challenges, focus from `PAI/USER/TELOS/*.md`
- Project Agent: active projects, tech stacks from TELOS/PROJECTS.md
- History Agent: recent work patterns from `MEMORY/WORK/`, `MEMORY/STATE/current-work.json`
- PAI State Agent: installed skills, hooks, gaps from `skills/`, `hooks/`, `settings.json`

**Thread 2 — Source Collection (3 agents):**
- Anthropic Agent: run `bun ~/.claude/skills/Utilities/PAIUpgrade/Tools/Anthropic.ts`
- YouTube Agent: check configured channels for new videos
- Custom Source Agent: check USER-defined sources + GitHub trending

**Thread 3 — Internal Reflections:**
- Mine algorithm reflections for self-improvement opportunities

### Step 2: Synthesize

1. Merge user context into unified profile
2. Filter discoveries by user's stack/focus
3. Score relevance against TELOS and projects
4. Prioritize by (relevance x impact x ease)

**Validation checkpoint:** Verify each discovery maps to a specific PAI file/component before including.

### Step 3: Generate Report

For each passing discovery: personalize why it matters, map to projects/goals, provide implementation steps.

---

## Output Format

**Structure: Discoveries → Recommendations → Technique Details**

```markdown
# PAI Upgrade Report
**Generated:** [timestamp]
**Sources Processed:** [N] release notes | [N] videos | [N] docs | [N] GitHub queries
**Findings:** [N] techniques extracted | [N] items skipped

## Discoveries
| # | Discovery | Source | Why Interesting | PAI Relevance |
|---|-----------|--------|-----------------|---------------|
| 1 | [Name] | [Source type] | [1-2 sentences] | [1 sentence] |

## Recommendations

### CRITICAL — Integrate immediately
| # | Recommendation | PAI Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|

### HIGH — Integrate this week
(same table format)

### MEDIUM — Integrate when convenient
(same table format)

### LOW — Awareness / future reference
(same table format)

## Technique Details

### [N]. [Feature/Change Name]
**Source:** [specific version/video/doc]
**Priority:** CRITICAL | HIGH | MEDIUM | LOW
**What It Is (16-32 words):** [concrete description]
**How It Helps PAI (16-32 words):** [specific benefit]
**The Technique:** [exact code/config/approach — quoted or code-blocked]
**Applies To:** [specific files]
**Implementation:** [before/after code]

## Summary
| # | Technique | Source | Priority | PAI Component | Effort |
|---|-----------|--------|----------|---------------|--------|

## Skipped Content
| Content | Source | Why Skipped |
|---------|--------|-------------|

## Sources Processed
[List of all sources checked with technique counts]
```

**Validation checkpoint:** Every technique must have both "What It Is" and "How It Helps PAI" at 16-32 words each.

---

## Extraction Rules

1. Every output item must be a **TECHNIQUE** — a specific pattern, code snippet, config, or approach
2. **Quote or code-block** the actual content
3. **Map to PAI components** — connect to specific files/skills/workflows
4. Two mandatory fields: **What It Is** and **How It Helps PAI** (16-32 words each)
5. Provide **before/after implementation**
6. **Skip, don't dilute** — no-technique items go in Skipped Content

**Anti-pattern checklist (any of these = failure):**
- [ ] Pointing to content instead of extracting it
- [ ] Vague summaries without specific techniques
- [ ] Recommendations without extracted code/config
- [ ] "What It Is" or "How It Helps PAI" outside 16-32 word range
- [ ] Missing priority tiers in recommendations
- [ ] Recommendations buried after technique dump (they go FIRST)

---

## Configuration

| File | Purpose |
|------|---------|
| `sources.json` | Anthropic sources config (30+ sources) |
| `youtube-channels.json` | Base YouTube channels |
| `State/last-check.json` | Anthropic state |
| `State/youtube-videos.json` | YouTube state |
| `State/github-trending.json` | GitHub trending state |
| `Tools/Anthropic.ts` | Check Anthropic sources for updates |

**User Customizations** (`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`):
- `EXTEND.yaml` — Extension manifest
- `youtube-channels.json` — Personal YouTube channels
- Additional source definitions

---

## Key Principles

1. **Extract, Don't Summarize** — Pull specific techniques, never just link
2. **Quote the Source** — Show actual code, docs, or transcript excerpts
3. **PAI-Contextualized** — Every technique maps to a specific PAI component
4. **TELOS-Connected** — Reference user's goals when explaining relevance
5. **Implementation-Ready** — Provide actual code changes, not vague recommendations
6. **Skip Boldly** — No extractable technique = skip entirely
