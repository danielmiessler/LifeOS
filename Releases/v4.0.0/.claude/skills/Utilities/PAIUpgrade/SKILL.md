---
name: PAIUpgrade
description: Extract system improvements from content AND monitor external sources (Anthropic ecosystem, YouTube). USE WHEN upgrade, improve system, system upgrade, analyze for improvements, check Anthropic, Anthropic changes, new Claude features, check YouTube, new videos, algorithm upgrade, mine reflections, find sources, research upgrade, PAI upgrade.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the PAIUpgrade skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **PAIUpgrade** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# PAIUpgrade Skill

**Primary Purpose:** Generate prioritized upgrade recommendations for the user's existing PAI setup by understanding their context and discovering what's new in the ecosystem.

The skill runs **three parallel agent threads** that converge into personalized recommendations:

```
Thread 1: USER CONTEXT     Thread 2: SOURCE COLLECTION    Thread 3: INTERNAL REFLECTIONS
┌───────────────────┐     ┌───────────────────────┐      ┌───────────────────────┐
│ TELOS Analysis    │     │ Anthropic Sources     │      │ Algorithm Reflections │
│ Project Analysis  │     │ YouTube Channels      │      │ Q2: Algorithm fixes   │
│ Recent Work       │     │ Custom USER Sources   │      │ Q1: Execution errors  │
│ PAI System State  │     │ GitHub Trending       │      │ Sentiment weighting   │
│                   │     │ Community Updates     │      │                       │
└───────────────────┘     └───────────────────────┘      └───────────────────────┘
           │                         │                              │
           └─────────────┬───────────┴──────────────────────────────┘
                         ▼
           ┌─────────────────────────────┐
           │  PRIORITIZED RECOMMENDATIONS │
           │  (external + internal)       │
           └─────────────────────────────┘
```

---


## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Upgrade** | "check for upgrades", "check sources", "any updates", "check Anthropic", "check YouTube", "upgrade", "pai upgrade" | `Workflows/Upgrade.md` |
| **MineReflections** | "mine reflections", "check reflections", "what have we learned", "internal improvements", "reflection insights" | `Workflows/MineReflections.md` |
| **AlgorithmUpgrade** | "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "fix the algorithm" | `Workflows/AlgorithmUpgrade.md` |
| **ResearchUpgrade** | "research this upgrade", "deep dive on [feature]", "further research" | `Workflows/ResearchUpgrade.md` |
| **FindSources** | "find upgrade sources", "find new sources", "discover channels" | `Workflows/FindSources.md` |

**Default workflow:** If user says "upgrade" or "check for upgrades" without specifics, run the **Upgrade** workflow. The Upgrade workflow automatically includes internal reflection mining as Thread 3.

---

## Primary Output Format

**Discoveries first. Recommendations second. Technique details third.**

The output has THREE major sections:
1. **Discoveries** — Everything found, ranked by interestingness, showing source and PAI relevance at a glance
2. **Recommendations** — What to actually integrate, organized by priority tier
3. **Technique Details** — Full extraction with code examples and implementation steps

```markdown
# PAI Upgrade Report
**Generated:** [timestamp]
**Sources Processed:** [N] release notes parsed | [N] videos checked | [N] docs analyzed | [N] GitHub queries run
**Findings:** [N] techniques extracted | [N] content items skipped

---

## ✨ Discoveries

Everything interesting we found, ranked by how compelling it is for PAI. This is the "what's out there" overview.

| # | Discovery | Source | Why It's Interesting | PAI Relevance |
|---|-----------|--------|---------------------|---------------|
| 1 | [Name of thing found] | [GitHub release / YouTube video / Docs / Blog] | [1-2 sentences: what makes this cool or notable] | [1 sentence: how it maps to PAI] |
| 2 | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

**Ranking rule:** Sort by interestingness — the most "whoa, that's cool" discoveries go at the top. This is NOT the same as implementation priority (that's the Recommendations section below). A LOW-priority awareness item can still be the most interesting discovery.

---

## 🔥 Recommendations

What to actually DO with these discoveries, organized by urgency and impact.

### 🔴 CRITICAL — Integrate immediately

These fix gaps, security issues, or unlock capabilities that PAI should already have.

| # | Recommendation | PAI Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 1 | [Short action name] | [Why this matters for PAI — what gap it fills or what breaks without it] | [Low/Med/High] | `[file1]`, `[file2]` |

### 🟠 HIGH — Integrate this week

These significantly improve PAI's capabilities or efficiency.

| # | Recommendation | PAI Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 2 | [Short action name] | [Which PAI component improves and how] | [Low/Med/High] | `[file1]` |

### 🟡 MEDIUM — Integrate when convenient

These add useful capabilities or align PAI with ecosystem best practices.

| # | Recommendation | PAI Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 3 | [Short action name] | [What becomes possible for PAI] | [Low/Med/High] | `[file1]` |

### 🟢 LOW — Awareness / future reference

These are nice-to-know or will become relevant later.

| # | Recommendation | PAI Relevance | Effort | Files Affected |
|---|---------------|---------------|--------|----------------|
| 4 | [Short action name] | [Why to keep this on the radar] | [Low/Med/High] | `[file1]` |

---

## 🎯 Technique Details

Full extracted techniques for reference. Each recommendation above maps to one or more techniques below.

### From Release Notes

#### [N]. [Feature/Change Name]
**Source:** GitHub claude-code v2.1.16, commit abc123
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself - what it does, how it works, what capability it provides. Must be 16-32 words, concrete and specific.]

**How It Helps PAI (16-32 words):**
[Describe the specific benefit to our PAI system - which component improves, what gap it fills, what becomes possible. Must be 16-32 words.]

**The Technique:**
> [Exact code pattern, configuration, or approach - quoted or code-blocked]

**Applies To:** `hooks/SecurityValidator.hook.ts`, ISC verification
**Implementation:**
```typescript
// Before (what you have now)
[current pattern]

// After (with this technique)
[new pattern]
```

---

### From YouTube Videos

#### [N]. [Specific Technique Name]
**Source:** R Amjad - "Video Title" @ 12:34
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself]

**How It Helps PAI (16-32 words):**
[Describe the specific benefit]

**The Technique:**
> "[Exact quote or paraphrased technique from transcript]"

**Applies To:** Browser skill, delegation system
**Implementation:**
[Specific steps to apply this technique]

---

### From Documentation / Other Sources

#### [N]. [Specific Capability/Pattern]
**Source:** Claude Docs - Tool Use section, updated 2026-01-20
**Priority:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

**What It Is (16-32 words):**
[Describe the technique itself]

**How It Helps PAI (16-32 words):**
[Describe the specific benefit]

**The Technique:**
> [Exact documentation excerpt showing the capability]

**Applies To:** `PAI/SKILL.md`, agent spawning
**Implementation:**
[Specific changes needed]

---

## 📊 Summary

| # | Technique | Source | Priority | PAI Component | Effort |
|---|-----------|--------|----------|---------------|--------|
| 1 | [name] | [source] | 🔴/🟠/🟡/🟢 | [component] | Low/Med/High |

**Totals:** [N] Critical | [N] High | [N] Medium | [N] Low | [N] Skipped

---

## ⏭️ Skipped Content

| Content | Source | Why Skipped |
|---------|--------|-------------|
| [video/doc title] | [source] | [No extractable technique / Not relevant to PAI / Covers basics already implemented] |

---

## 🔍 Sources Processed

**Release Notes Parsed:**
- claude-code v2.1.14, v2.1.15, v2.1.16 → [N] techniques extracted
- MCP 2025-11-25 → [N] techniques extracted

**Videos Checked:**
- R Amjad: "Title" (23:45) → [N] techniques extracted
- AI Jason: "Title" (15:20) → 0 techniques (skipped: Gemini focus)

**Docs Analyzed:**
- Claude Tool Use docs → [N] techniques extracted
```

---

## Extraction Rules

**CRITICAL: Extract, don't summarize. Techniques, not recommendations.**

1. **Every output item must be a TECHNIQUE** - A specific pattern, code snippet, configuration, or approach
2. **Quote or code-block the actual content** - Show exactly what was said/written
3. **Map to PAI components** - Every technique must connect to a specific file, skill, workflow, or system component
4. **Two mandatory description fields (16-32 words each):**
   - **What It Is:** Describe the technique itself - what it does, how it works, what capability it provides
   - **How It Helps PAI:** Describe the specific benefit - which component improves, what gap it fills, what becomes possible
5. **Provide implementation** - Show before/after code or specific steps
6. **Skip, don't dilute** - If content has no extractable technique, put it in Skipped Content with reason

**Anti-patterns to AVOID:**
- ❌ "Check out this video for more"
- ❌ "This release has improvements"
- ❌ "Consider looking into this"
- ❌ Vague summaries without specific techniques
- ❌ Links without extracted content

**Source Type Labels:**
| Label | Meaning |
|-------|---------|
| `GitHub: claude-code vX.Y.Z` | Specific version release notes |
| `YouTube: Creator @ MM:SS` | Video with timestamp |
| `Docs: Section Name` | Documentation section |
| `Blog: Post Title` | Blog post |

---

## The Two-Thread Architecture

### Thread 1: User Context Analysis

**Purpose:** Deeply understand the user to personalize recommendations.

Launch **parallel agents** to analyze:

| Agent | Focus | Sources |
|-------|-------|---------|
| **TELOS Agent** | User's goals, challenges, current focus | `PAI/USER/TELOS/*.md` |
| **Project Agent** | Active projects, tech stacks, dependencies | TELOS/PROJECTS.md, recent work context |
| **History Agent** | Recent work patterns, what's been done | `MEMORY/WORK/`, `MEMORY/STATE/current-work.json` |
| **PAI State Agent** | System capabilities, installed skills, gaps | `skills/`, `hooks/`, `settings.json` |

**Output:** A context object that includes:
- User's current focus areas and priorities
- Active projects and their tech stacks
- Recent work patterns and themes
- PAI system state and existing capabilities

### Thread 2: Source Collection

**Purpose:** Discover what's new in the ecosystem.

Launch **parallel agents** to check:

| Agent | Focus | Sources |
|-------|-------|---------|
| **Anthropic Agent** | Official Anthropic updates | `Tools/Anthropic.ts` (30+ sources) |
| **YouTube Agent** | Configured channels for new videos | USER customization channels |
| **Custom Source Agent** | Any USER-defined additional sources | USER/SKILLCUSTOMIZATIONS/PAIUpgrade/ |
| **GitHub Trending Agent** | Trending projects for PAI inspiration | `gh api search/repositories` via user-sources.json queries |

**Output:** A collection of discoveries:
- New features, releases, changes from Anthropic
- New videos with transcripts and key insights
- Updates from custom sources

---

## Process Flow

### Step 1: Launch Both Threads in Parallel

Using BACKGROUNDDELEGATION, spawn both analysis threads simultaneously:

```markdown
## Thread 1: User Context (4 parallel agents)

### Agent 1: TELOS Analysis
Read and analyze:
- ~/.claude/PAI/USER/TELOS/TELOS.md
- ~/.claude/PAI/USER/TELOS/GOALS.md
- ~/.claude/PAI/USER/TELOS/PROJECTS.md
- ~/.claude/PAI/USER/TELOS/CHALLENGES.md
- ~/.claude/PAI/USER/TELOS/STATUS.md

Extract: Current focus, priorities, active goals, project themes

### Agent 2: Recent Work Analysis
Read and analyze:
- ~/.claude/MEMORY/STATE/current-work.json
- Recent MEMORY/WORK/ directories

Extract: What user has been working on, patterns, open tasks

### Agent 3: PAI System State
Analyze:
- ~/.claude/skills/ (installed skills)
- ~/.claude/hooks/ (active hooks)
- ~/.claude/settings.json (configuration)

Extract: Current capabilities, potential gaps, system health

### Agent 4: Tech Stack Context
From PROJECTS and recent work, identify:
- Languages and frameworks in use
- Deployment targets
- Integration points

---

## Thread 2: Source Collection (3 parallel agents)

### Agent 1: Anthropic Sources
Run: bun ~/.claude/skills/Utilities/PAIUpgrade/Tools/Anthropic.ts
Check all 30+ official sources for updates

### Agent 2: YouTube Channels
Check configured channels for new videos
Extract transcripts from new content

### Agent 3: Custom Sources
Check any USER-defined additional sources
```

### Step 2: Synthesize Results

Once both threads complete:

1. **Merge context:** Combine user analysis into unified context object
2. **Filter discoveries:** Remove items that don't apply to user's stack/focus
3. **Score relevance:** Rate each discovery against user's TELOS and projects
4. **Prioritize:** Sort by (relevance to user × impact × ease)

### Step 3: Generate Recommendations

For each discovery that passes relevance filtering:

1. **Personalize:** Explain why this matters for THIS user specifically
2. **Contextualize:** Map to their projects, goals, and challenges
3. **Actionize:** Provide concrete implementation steps
4. **Estimate:** Rate effort relative to their experience level

### Step 4: Output Report

Generate the prioritized recommendations report (see format above).

---

## Configuration

**Skill Files:**
- `sources.json` - Anthropic sources config (30+ sources)
- `youtube-channels.json` - Base YouTube channels (empty by default)
- `State/last-check.json` - Anthropic state
- `State/youtube-videos.json` - YouTube state
- `State/github-trending.json` - GitHub trending state (seen repos)

**User Customizations** (`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/PAIUpgrade/`):
- `EXTEND.yaml` - Extension manifest
- `youtube-channels.json` - User's personal YouTube channels
- Additional source definitions

---

## Tool Reference

| Tool | Purpose |
|------|---------|
| `Tools/Anthropic.ts` | Check Anthropic sources for updates |

---

## Key Principles

1. **Extract, Don't Summarize:** Pull specific techniques from content, never just link to sources
2. **Quote the Source:** Show actual code, documentation quotes, or transcript excerpts
3. **PAI-Contextualized:** Every technique maps to a specific PAI file, skill, or component
4. **Explain "Why You":** Use phrases like "This helps because your [X] currently [Y]"
5. **TELOS-Connected:** Reference user's goals and challenges when explaining relevance
6. **Skip Boldly:** If content has no extractable technique, skip it entirely
7. **Implementation-Ready:** Provide actual code changes, not vague recommendations

---

## Examples

**Example 1: Standard upgrade check**
```
User: "check for upgrades"
→ Launch Thread 1 (4 agents analyzing user context)
→ Launch Thread 2 (3 agents checking sources)
→ Wait for both threads
→ Synthesize into prioritized recommendations
→ Output personalized upgrade report
```

**Example 2: Quick Anthropic-only check**
```
User: "check Anthropic only"
→ Run Anthropic.ts tool directly
→ Use cached user context from recent session
→ Quick-match against user focus areas
→ Output filtered recommendations
```

---

## Workflows

- **Upgrade.md** - Primary workflow: full two-thread analysis with prioritized recommendations
- **ResearchUpgrade.md** - Deep dive on a specific upgrade opportunity
- **FindSources.md** - Discover and evaluate new sources to monitor

---

---

## Anti-Patterns (What NOT to Output)

These output patterns are **FAILURES**. If you produce these, you have not completed the skill correctly:

| ❌ Bad Output | Why It's Wrong | ✅ Correct Output |
|---------------|----------------|-------------------|
| "Check out R Amjad's video on Claude Code" | Points to content instead of extracting it | "@ 5:42, R Amjad shows this technique: [quote]" |
| "v2.1.16 has task management improvements" | Vague summary, no technique | "v2.1.16 adds `addBlockedBy` parameter: [code example]" |
| "Consider looking into MCP updates" | Recommendation without extraction | "MCP now supports [specific feature]: [docs quote]" |
| "This could be useful for your workflows" | Vague relevance | "This improves your Browser skill because [specific gap it fills]" |
| "Several videos covered AI agents" | Count without content | "[N] videos skipped - no extractable techniques" |
| "This helps because it improves things" | Vague benefit, no word count | "How It Helps PAI (16-32 words): Our SecurityValidator currently only blocks commands. This technique enables injecting reasoning context before tool execution, making security decisions more nuanced." |
| "A new hook feature" | No description of what it IS | "What It Is (16-32 words): PreToolUse hooks can return additionalContext that gets injected into the model's context before execution, enabling reasoning-based decisions rather than binary blocks." |
| "Top 3 Actions" or flat recommendation list | No priority tiers — everything looks equally important | Recommendations section with 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW tiers, each with PAI Relevance column |
| Recommendations at the bottom of the report | Actionable items buried after technique dump | 🔥 Recommendations section appears FIRST, technique details are reference material below |

**The test:** If you can say "show me the technique" and there's nothing to show, you've failed.

**Word count test:** Each "What It Is" and "How It Helps PAI" field MUST be 16-32 words. Count them. If under 16, add specificity. If over 32, condense.

---

**This skill embodies PAI's commitment to continuous, personalized improvement - understanding YOU first, then discovering what's new, then EXTRACTING the actual techniques that matter to your system.**
