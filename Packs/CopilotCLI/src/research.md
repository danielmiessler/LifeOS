---
name: Research
description: Comprehensive research and content extraction — quick/standard/extensive/deep modes with multi-agent parallel research, content retrieval, AI trends analysis, and 242+ Fabric patterns. USE WHEN: research, do research, quick research, extensive research, deep investigation, find information, investigate, extract alpha, analyze content, retrieve content, use fabric, AI trends, enhance content, extract knowledge, interview research, web scraping, YouTube extraction, standard research.
---

## ⚠️ TRIGGER CONDITIONS

**When the user says "research" (in any form), ALWAYS invoke this skill.**

| User Says | Action |
|-----------|--------|
| "research" / "do research" / "research this" | → Standard mode (2 agents) |
| "quick research" / "minor research" | → Quick mode (1 agent) |
| "extensive research" / "deep research" | → Extensive mode (9 agents) |
| "deep investigation" / "investigate [topic]" / "map the [X] landscape" | → Deep Investigation (iterative) |

**"Research" alone = Standard mode. No exceptions.**

---

## Workflow Routing

Route to the appropriate workflow based on the request.

**CRITICAL:** For due diligence, company/person background checks, or vetting → **use OSINT skill instead**.

### Research Modes (Primary)
- Quick/minor research (1 agent, 1 query) → [Quick Research](#quick-research-workflow)
- Standard research — DEFAULT (2 agents in parallel) → [Standard Research](#standard-research-workflow)
- Extensive research (3 types × 3 threads = 9 agents) → [Extensive Research](#extensive-research-workflow)
- Deep investigation / iterative research (progressive deepening) → [Deep Investigation](#deep-investigation-workflow)

### Deep Content Analysis
- Extract alpha / deep analysis / highest-alpha insights → [Extract Alpha](#extract-alpha-workflow)

### Content Retrieval
- Difficulty accessing content (CAPTCHA, bot detection, blocking) → [Retrieve](#retrieve-workflow)
- YouTube URL extraction (use `fabric -y URL` immediately) → [YouTube Extraction](#youtube-extraction-workflow)
- Web scraping → [Web Scraping](#web-scraping-workflow)

### Specific Research Types
- Web search only (no API keys) → [Web Research](#web-research-workflow)
- Interview preparation (Tyler Cowen style) → [Interview Research](#interview-research-workflow)
- AI trends analysis → [AI Trends Analysis](#ai-trends-analysis-workflow)

### Fabric Pattern Processing
- Use Fabric patterns (242+ specialized prompts) → [Fabric](#fabric-workflow)

### Content Enhancement
- Enhance/improve content → [Enhance](#enhance-workflow)
- Extract knowledge from content → [Extract Knowledge](#extract-knowledge-workflow)

---

## Quick Reference

| Trigger | Mode | Agents | Speed |
|---------|------|--------|-------|
| "quick research" | 1 agent, 1 query | explore | ~10–15s |
| "do research" | 2 agents (default) | general-purpose × 2 | ~15–30s |
| "extensive research" | 9 agents | general-purpose × 9 | ~60–90s |
| "deep investigation" | Progressive iteration | general-purpose (multi-round) | ~3–60min |

---

## MANDATORY: URL Verification

**Every URL must be verified before delivery.**

Research agents hallucinate URLs. A single broken link is a catastrophic failure.

For every URL in results:
1. Use `web_fetch` to confirm the URL loads and content matches what you're citing
2. If URL fails → remove it, find an alternative via search, verify the replacement
3. **NEVER include unverified URLs**

---

# Quick Research Workflow

**Mode:** Single researcher agent, 1 query | **Target:** ~10–15 seconds

## When to Use

- User says "quick research" or "minor research"
- Simple, straightforward queries
- Time-sensitive requests

## Workflow

### Step 1: Launch Single Explore Agent

```
task(
  agent_type="explore",
  mode="background",
  description="[topic] quick lookup",
  prompt="Do ONE web search for: [query]. Use web_fetch to look up the most relevant source.
          Return the key findings immediately. Keep it brief and factual."
)
```

### Step 2: Return Results

```markdown
📋 SUMMARY: Quick research on [topic]
🔍 ANALYSIS: [Key findings]
⚡ ACTIONS: 1 agent, 1 query
✅ RESULTS: [Answer]
📊 STATUS: Quick mode — 1 agent, 1 query
➡️ NEXT: [Suggest standard research if more depth needed]
📖 STORY EXPLANATION: [3–5 numbered points — keep brief]
🎯 COMPLETED: Quick answer on [topic]
```

---

# Standard Research Workflow

**Mode:** 2 parallel researcher agents, 1 query each | **Target:** ~15–30 seconds

## When to Use

- Default mode for most research requests
- User says "do research" or "research this"
- Need multiple perspectives quickly

## Workflow

### Step 1: Craft Two Complementary Queries

Create ONE focused query per agent, optimized for different angles:
- **Agent 1**: Academic depth, detailed analysis, scholarly sources
- **Agent 2**: Multi-perspective synthesis, cross-domain connections, recent developments

### Step 2: Launch 2 Agents in Parallel

Issue both `task()` calls **in the same response turn**:

```
task(
  agent_type="general-purpose",
  mode="background",
  name="research-depth",
  description="[topic] depth analysis",
  prompt="Research this topic for depth and analysis: [query optimized for depth].
          Use web_fetch to retrieve and verify sources.
          Do ONE focused search. Return findings with any verified URLs."
)

task(
  agent_type="general-purpose",
  mode="background",
  name="research-breadth",
  description="[topic] breadth and perspectives",
  prompt="Research this topic for breadth and multiple perspectives: [query optimized for breadth].
          Use web_fetch to retrieve and verify sources.
          Do ONE focused search. Return findings with any verified URLs."
)
```

### Step 3: Synthesize

Combine the two perspectives:
- Note where they agree (high confidence)
- Note unique contributions from each
- Flag any conflicts

### Step 4: Verify All URLs (MANDATORY)

Use `web_fetch` for every URL returned by agents before including in results.

### Step 5: Return Results

```markdown
📋 SUMMARY: Research on [topic]
🔍 ANALYSIS: [Key findings from 2 perspectives]
⚡ ACTIONS: 2 researchers × 1 query each
✅ RESULTS: [Synthesized answer]
📊 STATUS: Standard mode — 2 agents, 1 query each
➡️ NEXT: [Suggest extensive if more depth needed]
📖 STORY EXPLANATION: [5–8 numbered points]
🎯 COMPLETED: Research on [topic] complete
```

---

# Extensive Research Workflow

**Mode:** 3 angle categories × 3 threads = 9 parallel agents | **Timeout:** 5 minutes

## When to Use

- User says "extensive research" or "do extensive research"
- Deep-dive analysis needed
- Comprehensive multi-domain coverage required

## Workflow

### Step 0: Generate 9 Creative Research Angles

Think deeply about the topic before dispatching agents:
- Explore multiple unusual perspectives and domains
- Question assumptions about what's relevant
- Make unexpected connections across fields
- Consider edge cases, controversies, emerging trends

Generate 3 angles per category (9 total):
- **Category A** (depth/analysis): academic, historical, technical
- **Category B** (breadth/synthesis): cross-domain, comparative, contextual
- **Category C** (contrarian/current): contrarian views, recent developments, underappreciated dynamics

### Step 1: Launch All 9 Agents in Parallel

Issue **all 9 `task()` calls in one response turn**:

```
// Category A — Depth/Analysis (3 threads)
task(agent_type="general-purpose", mode="background", name="research-a1",
     description="[topic] angle 1", prompt="Use web_fetch to research: [angle 1]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-a2",
     description="[topic] angle 2", prompt="Use web_fetch to research: [angle 2]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-a3",
     description="[topic] angle 3", prompt="Use web_fetch to research: [angle 3]. Return findings.")

// Category B — Breadth/Synthesis (3 threads)
task(agent_type="general-purpose", mode="background", name="research-b1",
     description="[topic] angle 4", prompt="Use web_fetch to research: [angle 4]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-b2",
     description="[topic] angle 5", prompt="Use web_fetch to research: [angle 5]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-b3",
     description="[topic] angle 6", prompt="Use web_fetch to research: [angle 6]. Return findings.")

// Category C — Contrarian/Current (3 threads)
task(agent_type="general-purpose", mode="background", name="research-c1",
     description="[topic] angle 7", prompt="Use web_fetch to research: [angle 7]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-c2",
     description="[topic] angle 8", prompt="Use web_fetch to research: [angle 8]. Return findings.")
task(agent_type="general-purpose", mode="background", name="research-c3",
     description="[topic] angle 9", prompt="Use web_fetch to research: [angle 9]. Return findings.")
```

Each agent: ONE focused angle, 1–2 searches max, returns as soon as it has findings.

### Step 2: Collect Results (5 MINUTE HARD TIMEOUT)

Proceed with whatever has returned after 5 minutes. Note non-responsive agents.

### Step 3: Comprehensive Synthesis

```markdown
## Executive Summary
[2–3 sentence overview]

## Key Findings
### [Theme 1]
- Finding (confirmed by: multiple angles)
- Finding (single source — lower confidence)

### [Theme 2]
...

## Unique Insights by Angle Category
- **Depth/Analysis**: [analytical depth findings]
- **Breadth/Synthesis**: [cross-domain connections]
- **Contrarian/Current**: [contrarian perspectives, recent developments]

## Conflicts & Uncertainties
[Note disagreements across sources]
```

### Step 4: Verify All URLs (MANDATORY)

Use `web_fetch` to verify every URL. Extensive mode generates many URLs — allocate time for this.

### Step 5: Return Results

```markdown
📋 SUMMARY: Extensive research on [topic]
🔍 ANALYSIS: [Comprehensive findings by theme]
⚡ ACTIONS: 3 angle categories × 3 threads = 9 parallel agents
✅ RESULTS: [Full synthesized report]
📊 STATUS: Extensive mode — 9 agents, 5 min timeout
📈 RESEARCH METRICS:
  - Total Agents: 9
  - Angle Categories: Depth, Breadth, Contrarian/Current
  - Confidence Level: [based on cross-validation]
➡️ NEXT: [Follow-up recommendations]
🎯 COMPLETED: Extensive research on [topic] complete
```

---

# Deep Investigation Workflow

**Mode:** Iterative progressive research | **Single-run or Loop mode**

## When to Use

- User says "deep investigation", "investigate [topic]", "map the [X] landscape"
- Competitive analysis, market mapping, threat landscape, technology survey
- Research that benefits from iterative deepening — broad discovery first, then progressively deeper dives

## How It Works

Progressive narrowing funnel:

```
Iteration 1: Broad landscape → discover entities → score them → deep-dive the top one
Iteration 2: Read previous artifacts → pick next highest-value entity → deep-dive
Iteration 3+: Continue until coverage gates pass
```

**Single-run mode:** One full cycle (landscape through first deep dive).  
**Loop mode:** Each iteration reads previous artifacts and deepens coverage. All state lives in artifacts on disk.

## Vault Location

All artifacts persist at:
```
{cwd}/research/{YYYY-MM}/{YYYY-MM-DD}_{topic-slug}/
```

---

## Workflow

### Step 0: Detect Iteration State

```
READ vault directory for existing artifacts:
  - LANDSCAPE.md exists? → CONTINUATION (skip to Step 3 or 4)
  - ENTITIES.md exists?  → CONTINUATION (skip to Step 3 or 4)
  - Neither exists?      → FIRST ITERATION (start at Step 1)

IF continuation:
  READ ENTITIES.md → check for PENDING entities with CRITICAL/HIGH value
  IF PENDING CRITICAL/HIGH exist → skip to Step 4 (Investigate)
  IF all CRITICAL/HIGH done but categories incomplete → skip to Step 3 (Discover)
  IF all gates pass → EXIT (produce SUMMARY.md and report completion)
```

---

### Step 1: Landscape (Broad — First Iteration Only)

**Goal:** Understand the full landscape. Do it once, reference it cheaply in all later iterations.

**Select domain template:** Use `MarketResearch` or `ThreatLandscape` template (see Domain Templates below) or create entity categories dynamically.

**Launch 9 agents using the Extensive Research pattern:**

Angles should cover:
- Market/domain overview and structure
- Key players and competitive dynamics
- Recent developments and trends
- Historical context and evolution
- Adjacent domains and cross-cutting themes
- Contrarian views and underappreciated dynamics

**Produce LANDSCAPE.md:**

```markdown
# {Topic} Landscape

## Overview
[2–3 paragraph synthesis of the domain]

## Market/Domain Structure
[Segmentation, categories, size if applicable]

## Key Dynamics
[What forces shape this domain? What's changing?]

## Entity Categories
[From domain template or discovered dynamically]
- Category 1: [description, estimated entity count]
- Category 2: [description, estimated entity count]

## Initial Entity Discoveries
[Entities found during landscape research — transfer to ENTITIES.md]

## Sources
[Verified URLs only]
```

**Produce ENTITIES.md:**

```markdown
# Entity Catalog

## Status: PENDING | RESEARCHED | SKIP
## Value:  CRITICAL | HIGH | MEDIUM | LOW
## Effort: EASY | MODERATE | HARD

| Entity | Category | Status | Value | Effort | Profile |
|--------|----------|--------|-------|--------|---------|
| [name] | [cat]    | PENDING | —    | —      | —       |
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

## Coverage
- Categories: 0/{N} complete
- Entities: 0 RESEARCHED / {N} total
- CRITICAL/HIGH: 0 RESEARCHED / {N} pending
```

---

### Step 2: Evaluate (Score Entities)

For each PENDING entity without a VALUE score, assess:

**VALUE:**
- **CRITICAL** — Market leaders, category definers, essential to understanding the domain
- **HIGH** — Major players, significantly influence the domain
- **MEDIUM** — Notable contributors with specialized focus
- **LOW** — Minor players, marginal impact

**EFFORT:**
- **EASY** — Public companies, abundant documentation, press coverage
- **MODERATE** — Good web presence, some proprietary info
- **HARD** — Limited public info, stealth-mode, minimal coverage

**Priority Order for Investigation:**
1. CRITICAL + EASY (highest ROI)
2. CRITICAL + HARD (must-have despite difficulty)
3. HIGH + EASY (good ROI)
4. HIGH + HARD (worthwhile if time allows)
5. MEDIUM+ only after all CRITICAL/HIGH done

---

### Step 3: Discover (Expand Coverage)

For each category with fewer than 3 entities, launch 2–3 targeted agents:

```
task(
  agent_type="general-purpose",
  mode="background",
  name="discover-[category]",
  description="Discover [category] entities in [domain]",
  prompt="Find 3–5 notable {entity_category} in the {domain} space.
          For each: name, one-line description, why they matter.
          Already known: {list existing entities in this category}.
          Find NEW ones not in that list.
          Use web_fetch to verify each entity exists and is relevant."
)
```

Add discoveries to ENTITIES.md, then run Step 2 (Evaluate) on them.

---

### Step 4: Investigate (Deep Dive — One Entity)

**Goal:** Comprehensive profile of ONE entity. Quality over quantity.

**Select highest-priority PENDING entity:** Sort by VALUE (CRITICAL first), then EFFORT (EASY first).

**Launch 3 focused research agents in parallel:**

```
task(
  agent_type="general-purpose",
  mode="background",
  name="entity-depth",
  description="{entity_name} depth research",
  prompt="Deep research on {entity_name} in the context of {domain}.
          Focus on: {template_fields_for_this_category}
          Context: {1-paragraph from LANDSCAPE.md about this entity's category}
          Use web_fetch to retrieve and verify all sources.
          Return comprehensive findings organized by the template fields."
)

task(
  agent_type="general-purpose",
  mode="background",
  name="entity-recent",
  description="{entity_name} recent developments",
  prompt="Find recent information about {entity_name}:
          latest news, funding, product launches, key hires, partnerships.
          Focus on developments in the last 12 months.
          Use web_fetch to verify all claims and sources."
)

task(
  agent_type="general-purpose",
  mode="background",
  name="entity-competitive",
  description="{entity_name} competitive analysis",
  prompt="Research {entity_name}: competitive position, strengths, weaknesses,
          how they compare to {list 2–3 related entities from ENTITIES.md}.
          What makes them distinctive in the {domain} landscape?
          Use web_fetch to verify claims."
)
```

**Save entity profile** to: `vault/{Category}/{entity-slug}.md`

**Update ENTITIES.md:** Mark entity as RESEARCHED, add profile link.  
**Update INDEX.md:** Add profile to navigation.

---

### Step 5: Progress Check (Loop Gate)

**Two gates must BOTH pass to exit:**

**Breadth Gate:** Every entity category defined in Step 1 has ≥ 3 entities with status != SKIP.

**Depth Gate:** All entities with VALUE = CRITICAL or HIGH have status = RESEARCHED or SKIP.

**If both pass:**
- Produce SUMMARY.md (executive synthesis of all findings)
- Update INDEX.md with final statistics
- Report completion

**If either fails:**
- Report: "Coverage incomplete — [which gate failed and why]"
- In loop mode: re-enter at Step 0 on next iteration

---

## Single-Run vs Loop Mode

| Aspect | Single-Run | Loop Mode |
|--------|-----------|-----------|
| Iterations | 1 | Driven by progress gates (N turns) |
| Coverage | Landscape + first deep dive | Full breadth + depth gates |
| Exit | After Step 4 completes | After Step 5 gates pass |
| Best for | Quick overview + top entity | Comprehensive investigation |
| Time | 3–5 minutes | 15–60 minutes (varies by domain) |

---

## Domain Template Packs

### MarketResearch Template
**Entity categories:** Companies, Products, People, Technologies, Trends, Investors

**Profile fields per category:**
- **Company:** Founded, HQ, funding, team size, products/services, customers, differentiators, partnerships, recent news
- **Product:** Vendor, category, pricing, target market, key features, competitors
- **Person:** Role, background, influence, notable work, public positions
- **Technology:** Maturity, adoption, key players, use cases, limitations

### ThreatLandscape Template
**Entity categories:** Threat Actors, Campaigns, TTPs, Vulnerabilities, Tools, Defenders

**Profile fields per category:**
- **Threat Actor:** Origin, motivation, targets, TTPs, notable campaigns, attribution confidence
- **Campaign:** Timeframe, actor, targets, methods, impact, status
- **Vulnerability:** CVE, CVSS, affected systems, exploitation status, mitigations

**No template match?** Create entity categories dynamically from the landscape research in Step 1.

---

## Output Vault Structure

```
{vault}/
  INDEX.md              — Navigation hub with coverage stats
  LANDSCAPE.md          — Broad domain analysis (created once)
  ENTITIES.md           — Master catalog with status tracking
  SUMMARY.md            — Executive synthesis (created on completion)
  Companies/            — Entity profiles by category
    company-a.md
    company-b.md
  Products/
    product-x.md
  People/
    person-y.md
```

All profiles are cross-linked. The vault is self-contained and readable as a standalone knowledge base.

---

# Extract Alpha Workflow

Extract the highest-alpha ideas from content using deep analysis.

Finds the most surprising, insightful, and novel ideas through systematic deep reasoning. Based on Claude Shannon's information theory: **real information is what's different, not what's the same.**

## When to Use

- Analyzing YouTube videos, podcasts, interviews, essays, articles
- Deep content analysis where missing insights is unacceptable
- User says "extract the most important ideas", "extract alpha", or "deep analysis"

## Five-Step Process

### Step 1: Content Extraction

**For YouTube videos:**
```bash
fabric -y "YOUTUBE_URL"
```

**For articles/URLs:**
```
web_fetch(url="URL", prompt="Extract the full article text")
```

**For files:** Read directly from disk.

### Step 2: Deep Thinking Analysis

Before extracting anything, reason extensively through all 10 dimensions:

```
DEEP ANALYSIS MODE — think through all of these before extracting:

1. SURFACE SCAN — What are the obvious main points?
2. DEPTH PROBE — What implications aren't explicitly stated?
3. CONNECTION MAP — What unusual connections exist between ideas?
   - WONDER TRIGGER: What makes you stop and think "wait, how does THAT work?"
   - CROSS-DOMAIN PATTERNS: What seemingly different things share the same underlying principle?
   - AHA MOMENTS: What connections make you see familiar things differently?
4. ASSUMPTION CHALLENGE — What conventional wisdom is being questioned?
5. NOVELTY DETECTION — What's genuinely new or surprising here?
6. FRAMEWORK EXTRACTION — What mental models or frameworks emerge?
7. SUBTLE INSIGHTS — What quiet observations carry profound weight?
8. CONTRARIAN ANGLES — What goes against common thinking?
9. FUTURE IMPLICATIONS — What does this suggest about what's coming?
10. SYNTHESIS — What are the highest-alpha ideas across all dimensions?

Allow thinking to wander and make unexpected connections.
Prioritize novelty and surprise over comprehensiveness.
```

### Step 3: Extract Insights

Generate 24–30 highest-alpha ideas:
- Write in 8–12 word bullets (Paul Graham approachable style)
- Prioritize: novel frameworks, cross-domain patterns, counterintuitive observations, things that make you pause
- Avoid: obvious takeaways, common knowledge, surface-level observations

### Step 4: Save Output

Save to a dated research directory:
```
research/YYYY-MM-DD_{topic}/
  extract_alpha.md       — Final 24–30 insights
  deep-analysis.md       — Full 10-dimension analysis
  README.md              — Source info and session notes
```

### Step 5: Output Format

```markdown
# EXTRACT ALPHA

- First high-alpha insight in approachable style

- Second surprising idea that challenges assumptions

- Novel framework or mental model discovered

- Non-obvious connection between concepts

[... 24–30 items total, blank line between each ...]
```

**Quality over quantity:** If content only has 15 truly novel insights, extract 15. Don't pad.

---

# Retrieve Workflow

**USE ONLY when the user indicates difficulty accessing content.** For simple "read this page" requests, use `web_fetch` directly.

## When to Activate

User signals difficulty:
- "I can't get this content" / "site is blocking me"
- "CloudFlare protected" / "keeps giving CAPTCHA"
- "Bot detection blocking me" / "rate limited"
- "Tried to fetch but failed"

**Do NOT activate for:** "read this page", "get content from URL", "fetch this article" — just use `web_fetch`.

## 3-Layer Retrieval Strategy

```
Layer 1: web_fetch (Fast, simple)
  ↓ (If blocked/fails)
Layer 2: BrightData MCP (CAPTCHA bypass, advanced scraping) [if available]
  ↓ (If specialized scraping needed)
Layer 3: Apify MCP (RAG browser, Actor ecosystem) [if available]
```

### Layer 1: web_fetch

```
web_fetch(url="https://example.com/article", prompt="Extract main article content")
```

**Escalate to Layer 2 if:** HTTP 403/429/503, CAPTCHA detected, empty/broken content.

### Layer 2: BrightData MCP (if available)

```
mcp__Brightdata__scrape_as_markdown(url="https://protected-site.com/article")
```

For batch scraping (up to 10 URLs):
```
mcp__Brightdata__scrape_batch(urls=["url1", "url2", "url3"])
```

**Escalate to Layer 3 if:** Scraping fails after retries, specialized extraction needed.

### Layer 3: Apify MCP (if available)

```
mcp__Apify__apify-slash-rag-web-browser(
  query="https://target-site.com/page",
  maxResults=1,
  outputFormats=["markdown"]
)
```

Then retrieve full output:
```
mcp__Apify__get-actor-output(datasetId="[from previous response]")
```

**If all layers exhausted:** Report to the user that the site cannot be retrieved and explain why.

---

# YouTube Extraction Workflow

Extract content from YouTube videos using Fabric CLI.

## Command

```bash
fabric -y "YOUTUBE_URL"
```

## With Pattern Processing

```bash
fabric -y "YOUTUBE_URL" -p extract_wisdom
fabric -y "YOUTUBE_URL" -p summarize
fabric -y "YOUTUBE_URL" -p youtube_summary
```

## Critical Facts

- **NEVER** use yt-dlp, youtube-dl, or transcription APIs directly
- **Fabric handles everything**: download, transcription, text extraction
- After extraction, feed the text to Extract Alpha for deep analysis

---

# Web Scraping Workflow

## Decision Tree

1. **Simple public page** → `web_fetch` directly
2. **CAPTCHA / blocking** → BrightData MCP (`mcp__brightdata__*`) if available
3. **Social media** → Apify MCP if available

## Best Practices

✅ Check robots.txt before scraping  
✅ Add delays between bulk requests  
✅ Handle errors gracefully  
✅ Cache results when possible  
❌ Don't scrape too fast — respect rate limits  
❌ Don't scrape personal data without permission  

---

# Web Research Workflow

Intelligent multi-query web research using only `web_fetch` (no API keys needed).

## When to Use

- Simple web search capability is sufficient
- User says "Claude research only" or wants no external APIs

## Workflow

### Step 1: Decompose Query into 4–8 Sub-Queries

For a research question, generate targeted sub-queries:
- Original question verbatim
- Background/context query
- Recent developments (`{question} latest news {year}`)
- Technical details (`{question} technical details explained`)
- Comparison/alternatives (`{question} comparison alternatives`)
- Expert analysis (`{question} expert analysis`)
- Implications (`{question} implications impact`)
- Contrarian view (`{question} criticism counterargument`)

### Step 2: Execute Searches via web_fetch

Use `web_fetch` to retrieve top sources for each sub-query. Run in parallel where possible.

### Step 3: Synthesize and Verify

- Synthesize findings across all sub-queries
- Verify all URLs with `web_fetch` before including
- Return structured results

---

# Interview Research Workflow

Research a company to prepare Tyler Cowen-style interview questions.

## Research Protocol

Research the following about **the company** using parallel `task()` agents:

1. **Recent Activity** (last 6 months): product launches, funding, press releases, conference talks
2. **Technical Innovation**: core technology, patents/papers, technical blog posts, open source
3. **Social Media & Thought Leadership**: CEO/founder activity, company blog, podcast appearances
4. **Competitive Landscape**: direct competitors, market positioning, unique differentiators
5. **Future Direction**: roadmap hints, job postings, partnerships, expansion signals

Launch these as parallel `task(agent_type="general-purpose", mode="background")` agents.

## Output Format

### COMPANY SUMMARY (2–3 paragraphs)
- What they're building and why it matters
- Recent momentum and achievements
- Key differentiators from competition

### INTERVIEW QUESTIONS (10 total)

Questions must:
- Maximize surprise and information content (Shannon principle)
- Use Tyler Cowen's style: unexpected angles, implicit assumptions challenged
- Avoid obvious or boring questions
- Elicit stories and mental models, not just facts

**Required themes** (reframed in novel ways):
1. Problem definition and origin story
2. Competitive differentiation and strategy
3. Future vision and industry evolution

**Additional themes:** failed experiments, hiring philosophy, customer surprises, technical trade-offs, contrarian industry beliefs, "why now" timing.

### Question Format
For each question:
- **Q[number]:** The actual question
- **Why:** What surprising insight this might reveal
- **Follow-up angle:** One potential follow-up based on likely answers

## Tyler Cowen Principles
- **Oblique approach**: Ask about adjacent topics to reveal core insights
- **Production function**: "What inputs create your outputs?"
- **Status quo challenge**: "What does everyone else get wrong?"
- **Edge cases**: "When does your approach fail?"
- **Second-order effects**: "What happens when you succeed?"

## Example Question Transformations

❌ "What problem are you solving?"  
✅ "What problem did you initially *think* you were solving, and when did you realize you were actually solving something completely different?"

❌ "How are you different from competitors?"  
✅ "If your top competitor called you for advice on what they should build next, what would you tell them — and what would you deliberately leave out?"

---

# AI Trends Analysis Workflow

Perform deep trend analysis across historical AI research logs.

## Workflow

### Step 1: Load Historical Data

Read all files from your research history directory (filter for AI news/research files). Sort chronologically.

### Step 2: Analyze with a Research Agent

```
task(
  agent_type="general-purpose",
  mode="background",
  name="ai-trends-analysis",
  description="AI industry trend analysis",
  prompt="Analyze these historical AI news/research logs chronologically.
          Identify:
          - EVOLVING TRENDS: What patterns are emerging, strengthening, or weakening?
          - RECURRING THEMES: Topics, companies, technologies that keep appearing
          - TRAJECTORY: Where is the industry heading?
          - PARADIGM SHIFTS: Major inflection points
          - COMPETITIVE LANDSCAPE: How are models/tools/approaches competing?
          - INNOVATION VELOCITY: Is the pace accelerating, stabilizing, or slowing?
          - EMERGING WINNERS: Which models/tools are gaining momentum?
          - DECLINING AREAS: What's becoming less relevant?
          - SURPRISING PATTERNS: Unexpected trends or correlations
          - FUTURE PREDICTIONS: What's likely to happen next?

          [LOGS CONTENT HERE]"
)
```

### Step 3: Present Report

```markdown
📊 AI INDUSTRY TREND ANALYSIS

📅 Analysis Period: [First Date] to [Latest Date]
📁 Sources Analyzed: [Number] research digests

🔥 EVOLVING TRENDS
[Detailed analysis of how trends are changing]

🔄 RECURRING THEMES
- [Theme 1]: [Frequency and significance]

📈 TRAJECTORY ANALYSIS
[Where the industry is heading]

💫 PARADIGM SHIFTS
- [Shift 1]: [What changed and when]

⚔️ COMPETITIVE LANDSCAPE
[Analysis of competition between models, tools, companies]

⚡ INNOVATION VELOCITY
[Analysis of pace of change]

🏆 EMERGING WINNERS
- [Winner 1]: [Why they're succeeding]

📉 DECLINING AREAS
- [Area 1]: [Why it's declining]

🎯 SURPRISING PATTERNS
- [Pattern 1]: [Why it's unexpected]

🔮 FUTURE PREDICTIONS
- [Prediction 1]: [Based on which trends]

📌 KEY INSIGHTS
1. [Most important insight]
2. [Second most important]
3. [Third most important]

💡 ACTIONABLE RECOMMENDATIONS
- [Action 1]: [Based on trend analysis]
```

---

# Fabric Workflow

Intelligent pattern selection for Fabric CLI. Automatically selects the right pattern from 242+ specialized prompts.

## Pattern Selection Strategy

### Identify Intent Category

**Threat Modeling & Security:**
`create_threat_model`, `create_stride_threat_model`, `create_threat_scenarios`, `analyze_threat_report`, `analyze_risk`, `create_sigma_rules`, `write_nuclei_template_rule`

**Summarization:**
`summarize`, `create_5_sentence_summary`, `create_micro_summary`, `summarize_meeting`, `summarize_paper`, `youtube_summary`, `summarize_newsletter`, `summarize_git_diff`

**Wisdom Extraction:**
`extract_wisdom`, `extract_article_wisdom`, `extract_insights`, `extract_main_idea`, `extract_recommendations`, `extract_controversial_ideas`, `extract_book_ideas`

**Analysis:**
`analyze_claims`, `analyze_malware`, `analyze_code`, `analyze_paper`, `analyze_logs`, `analyze_debate`, `analyze_incident`, `analyze_product_feedback`, `analyze_risk`, `analyze_presentation`

**Content Creation:**
`create_prd`, `create_design_document`, `create_user_story`, `create_mermaid_visualization`, `create_markmap_visualization`, `write_essay`, `create_report_finding`, `create_newsletter_entry`, `create_keynote`

**Improvement:**
`improve_writing`, `improve_academic_writing`, `improve_prompt`, `review_code`, `humanize`, `enrich_blog_post`, `clean_text`

**Rating/Evaluation:**
`rate_ai_response`, `rate_content`, `rate_value`, `judge_output`, `label_and_rate`

## Execute Pattern

```bash
# From URL
fabric -u "URL" -p [pattern]

# From YouTube
fabric -y "YOUTUBE_URL" -p [pattern]

# From file
cat file.txt | fabric -p [pattern]

# Direct text
fabric "your text here" -p [pattern]
```

## Quick Decision Matrix

| User Request Contains | Recommended Pattern |
|----------------------|---------------------|
| "threat model" | `create_threat_model` or `create_stride_threat_model` |
| "summarize", "summary" | `summarize` or `create_5_sentence_summary` |
| "extract wisdom", "insights" | `extract_wisdom`, `extract_insights` |
| "analyze [X]" | `analyze_[X]` (match X to pattern name) |
| "improve", "enhance writing" | `improve_writing`, `improve_prompt` |
| "create visualization" | `create_mermaid_visualization` |
| "rate", "judge", "evaluate" | `rate_content`, `judge_output` |
| "main idea", "core message" | `extract_main_idea`, `extract_core_message` |

**The skill's value is selecting the RIGHT pattern.** Don't ask "which pattern?" — pick the best one and execute immediately.

To see all available patterns:
```bash
fabric --list
```

---

# Enhance Workflow

Comprehensive content enhancement for documents and blog posts.

## Features

- **Link Enhancement**: Identify key terms and add authoritative hyperlinks (body text only, never headers); verify all links with `web_fetch` before including
- **Image Enhancement**: Ensure all images have width/height, make clickable, add captions
- **Code Block Enhancement**: Add language syntax highlighting
- **Content Structure**: Wrap insights in `<aside>`, important info in `<callout>`, technical tips in `<tutorial>`
- **Other**: Convert natural language content hints to proper formatting, maintain frontmatter integrity

## Process

1. Read the content
2. Identify enhancement opportunities in each category
3. Research and verify links with `web_fetch` before adding
4. Apply enhancements
5. Return enhanced content

**NEVER CREATE DEAD LINKS** — always verify links exist before including them.

---

# Extract Knowledge Workflow

Intelligently extract knowledge and signal points from any input source.

## Usage

```
extract-knowledge <source> [--focus=security|business|research|wisdom|general]
```

## Step 1: Detect Source Type and Fetch Content

**YouTube:** `fabric -y "<url>"`  
**Web URL:** `web_fetch(url="<url>", prompt="Extract full article text")`  
**PDF/File:** Read directly  
**Research Papers:** Treat as web content, mark as research domain  

## Step 2: Auto-Detect Domain Focus (if not specified)

- **Security**: vulnerability, hack, exploit, cybersecurity, attack, defense
- **Business**: money, revenue, profit, market, strategy
- **Research**: study, experiment, methodology, findings, academic
- **Wisdom**: philosophy, principle, life, wisdom, insight, experience
- **General**: everything else

## Step 3: Extract by Domain

| Domain | Focus Areas |
|--------|-------------|
| Security | Attack vectors, vulnerabilities, defensive measures, tools |
| Business | Revenue opportunities, market insights, growth strategies |
| Research | Key findings, methodology, contributions, future work |
| Wisdom | Life principles, philosophical insights, practical wisdom, memorable quotes |
| General | Key concepts, important facts, learning opportunities |

## Step 4: Output Structure

```
🎯 KNOWLEDGE EXTRACTION RESULTS
══════════════════════════════════════════════
📍 Source: <source>
🔍 Type: <detected_type>
🎯 Domain: <detected_domain>
⭐ Quality Rating: <1-10>/10

📋 CONTENT SUMMARY:
<2–3 sentence summary>

💡 KEY INSIGHTS:
• <insight 1>
• <insight 2>
• <insight 3>

📡 SIGNAL POINTS:
• <signal point 1>
• <signal point 2>

⚡ ACTIONABLE RECOMMENDATIONS:
✅ <recommendation 1>
✅ <recommendation 2>

🔗 RELATED CONCEPTS:
<comma-separated key terms>

[Optional based on domain:]
🧠 EXTRACTED WISDOM: (wisdom content)
🛠️ TECHNICAL DETAILS: (security/research content)
══════════════════════════════════════════════
```

---

## Integration

### Research Feeds Into
- **blogging** — Research for blog posts
- **newsletter** — Research for newsletters
- **xpost** — Create posts from research

### Research Uses
- **OSINT** — MANDATORY for company/people comprehensive background checks
- **web_fetch** — Primary tool for content retrieval and URL verification
- **fabric CLI** — YouTube extraction and 242+ content transformation patterns
- **BrightData MCP** — CAPTCHA solving, advanced scraping (if available)
- **Apify MCP** — RAG browser, specialized site scrapers (if available)
