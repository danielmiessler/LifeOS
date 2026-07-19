---
name: Research
version: 1.5.9
description: "Multi-agent web research with mandatory URL verification, confidence-tagged output, and four depth modes (quick to deep investigation). USE WHEN research, do research, quick research, extensive research, deep investigation, find information, investigate, extract alpha, analyze content, retrieve content, AI trends, enhance content, extract knowledge, web scraping, YouTube extraction, map landscape, competitive analysis, find it, find this, find this product, identify this, what is this, what's that thing, track down, locate, help me find, I can't find X online, can't find it online, source this — never substitute raw WebSearch/WebFetch for a multi-source find/identify/investigate request. NOT FOR people/company/entity deep background (use _OSINT), academic papers (use ArXiv), JSON entity extraction (use _PARSER), or content-adaptive wisdom extraction (use ExtractWisdom)."
effort: high
context: fork
---

## ⚠️ MANDATORY TRIGGER

**When user says "research" (in any form), ALWAYS invoke this skill.**

| User Says | Action |
|-----------|--------|
| "research" / "do research" / "research this" | → Standard mode (4 agents: Claude + Gemini + Grok + Perplexity + cross-check) |
| "quick research" / "minor research" | → Quick mode (1 Perplexity agent) |
| "extensive research" / "deep research" | → Extensive mode (7 explorers + 2 verifiers) |
| "deep investigation" / "investigate [topic]" / "map the [X] landscape" | → Deep Investigation (iterative + verification) |

**"Research" alone = Standard mode. No exceptions.**

**Deterministic alternative (EXPERIMENTAL — not yet run in the harness):** `Workflows/research.mjs` ports Standard + Extensive into a Workflow-tool script — fixed researcher roster, single batch URL-verify, cross-checked synthesis. It is parse-verified and contract-checked but has NOT yet had a live harness run, so the prose `StandardResearch.md` / `ExtensiveResearch.md` stay the default path. Do not route real research through the `.mjs` until one smoke run lands. To do that smoke run: `Workflow({ scriptPath: "skills/Research/Workflows/research.mjs", args: { question: "<trivial test>", depth: "standard" } })`. Once it runs clean, drop this experimental caveat.

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/Research/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the Research skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **Research** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# Research Skill

## What It Does

Researches a topic across multiple sources and verifies every claim before delivery. Four depth modes scale from a single fast lookup to a multi-session investigation: Quick (1 agent, ~10-15s), Standard (4 agents cross-checked, ~30-60s), Extensive (7 explorers + 2 independent verifiers, ~60-90s), and Deep Investigation (progressive iteration with a persistent vault, ~3-60min). Output is confidence-tagged: [HIGH] [MED] [LOW] [CONFLICT].

## The Problem

A single AI agent doing research has two failure modes that quietly wreck the result. It hallucinates URLs — confident links that go nowhere, which destroys trust in the whole report. And it answers from one angle, so it parrots whatever the first few search results said and misses conflicts, gaps, and what real people actually thought. Recap journalism is the worst offender: ask "what did fans think of X" and a lone agent hands back promoter copy dressed as consensus. This skill runs several agents in parallel, cross-checks and independently verifies their findings, checks every URL before it ships, and routes sentiment questions to community sources first.

## How It Works

Multiple agents work in parallel and their findings get reconciled. Verification runs in three layers at zero added latency: each agent self-verifies its own URLs, a synthesis step cross-checks for conflicts, and dedicated verifier agents (Extensive/Deep) check findings with no access to the explorers' reasoning. Step 0 of every workflow routes sentiment questions to community scrapers before web search, and every URL is verified before delivery — a hallucinated link is a catastrophic failure.

## MANDATORY: URL Verification

**READ:** `UrlVerificationProtocol.md` - Every URL must be verified before delivery.

Research agents hallucinate URLs. A single broken link is a catastrophic failure.

---

## MANDATORY: Source Routing (Step 0 of every workflow)

**READ:** `SourceRoutingProtocol.md` — sentiment-signal detection + scraper-first paths for Reddit / YouTube / X / TikTok.

**The rule:** web search answers "what was published about X." Community scrapers answer "what people said about X." If the question is about fan sentiment, ratings, reactions, opinions, or what real people thought — route to Reddit (JSON API first, Apify fallback), YouTube comments, and X **before** spawning Perplexity/Claude/Gemini/Grok web-search agents. Recap journalism is the secondary source, not the primary one.

**Sentiment signal triggers** (run at Step 0 of Quick / Standard / Extensive):

- "what did fans / people / the community think (of|about)"
- "ratings of" / "fan ratings" / "best | worst | favorite (sets | episodes | moments)"
- "reactions to" / "what people are saying"
- "is X any good" / "consensus on"
- Event name + ("last night" | "last weekend" | recent date)

Detection fires → sentiment-mode routing per `SourceRoutingProtocol.md`. Detection does not fire → standard routing.

---

## Sufficiency Check (Algorithm v6.7.0 Step 0)

Before executing any workflow, verify context sufficiency: do I have what I need to produce a hard-to-vary research artifact, or am I about to speculate? If the question shape and target sources are clear, proceed. If speculating, emit a one-line ambiguity flag and ship best-effort. If clearly insufficient, emit ≤3 questions with `proceed` override.

---

## Workflow Routing

**CRITICAL:** For due diligence, company/person background checks, or vetting -> **INVOKE OSINT SKILL INSTEAD**

| Workflow | Trigger | File |
|----------|---------|------|
| QuickResearch | Quick/minor research; Perplexity API research (1 Perplexity agent, 1 query) | `Workflows/QuickResearch.md` |
| StandardResearch | Standard research — DEFAULT (4 agents: Claude + Gemini + Grok + Perplexity, cross-checked) | `Workflows/StandardResearch.md` |
| ExtensiveResearch | Extensive research (7 explorers + 2 verifiers = 9 agents) | `Workflows/ExtensiveResearch.md` |
| DeepInvestigation | Deep investigation / iterative research / map the [X] landscape (progressive deepening, loop-compatible) | `Workflows/DeepInvestigation.md` |
| DeepVerifiedResearch | Deep verified / fact-checked research — slowest tier, claim-level adversarial verification (see notes below) | `Workflows/DeepVerifiedResearch.mjs` |
| research.mjs | EXPERIMENTAL deterministic port of Standard + Extensive — do NOT route real research here until a smoke run lands (see Mandatory Trigger note) | `Workflows/research.mjs` |
| Verify | Verify research findings / cross-check claims / confidence scoring | `Workflows/Verify.md` |
| ExtractAlpha | Extract alpha / deep analysis / highest-alpha insights | `Workflows/ExtractAlpha.md` |
| Retrieve | Difficulty accessing content (CAPTCHA, bot detection, blocking) | `Workflows/Retrieve.md` |
| YoutubeExtraction | YouTube URL extraction (use `fabric -y URL` immediately) | `Workflows/YoutubeExtraction.md` |
| WebScraping | Web scraping | `Workflows/WebScraping.md` |
| ClaudeResearch | Claude WebSearch only (free, no API keys) | `Workflows/ClaudeResearch.md` |
| InterviewResearch | Interview preparation (Tyler Cowen style) | `Workflows/InterviewResearch.md` |
| AnalyzeAiTrends | AI trends analysis | `Workflows/AnalyzeAiTrends.md` |
| Fabric | Use Fabric patterns (242+ specialized prompts) | `Workflows/Fabric.md` |
| Enhance | Enhance/improve content | `Workflows/Enhance.md` |
| ExtractKnowledge | Extract knowledge from content | `Workflows/ExtractKnowledge.md` |

**DeepVerifiedResearch notes:** run via `Workflow({scriptPath: 'skills/Research/Workflows/DeepVerifiedResearch.mjs', args: {question: '...'}})` (pass `args` as an OBJECT, never a JSON string). **Does NOT replace Extensive — it sits below it.** Measured ~150-190s vs Extensive's ~60-90s, because claim-level verification needs one extra serial hop (you can't vote on claims until they're extracted). Reach for it only when claims must be bulletproof: each extracted claim is attacked by three skeptics from different lenses (quote-support, contradiction, source-strength), survives only on a quorum of non-refuting votes (all-abstain never survives), then a written synthesis frames the survivors with [HIGH]/[MED]/[LOW]/[CONFLICT] tags and refuted-claim transparency. Dedup, ranking, vote-counting, and the abstention guard run deterministically in the script. `research.mjs` is the faster sibling and the place multi-vendor diversity lives (Standard/Extensive rosters + URL verify).

---

## Quick Reference

**READ:** `QuickReference.md` for detailed examples and mode comparison.

| Trigger | Mode | Speed |
|---------|------|-------|
| "quick research" | 1 Perplexity agent | ~10-15s |
| "do research" | 4 agents + cross-check | ~30-60s |
| "extensive research" | 7 explorers + 2 verifiers | ~60-90s |
| "deep investigation" | Progressive iteration + verification | ~3-60min |

## Verification Architecture

Inspired by Nomad (arXiv:2603.29353). Three layers of verification, zero added latency:

| Layer | What | Where | Cost |
|-------|------|-------|------|
| **Self-Verification** | Each agent verifies own URLs and tags confidence before returning | All agents | 0s (inside parallel window) |
| **Cross-Check** | Synthesis step detects conflicts and cross-references findings | Standard, Extensive, Deep | 2-3s (within synthesis) |
| **Independent Verification** | Dedicated verifier agents with no access to explorer reasoning | Extensive, Deep only | 0s (parallel with explorers) |

**Confidence tags in output:** `[HIGH]` `[MED]` `[LOW]` `[CONFLICT]`

See `Workflows/Verify.md` for full verification protocol.

---

## Integration

### Feeds Into
- **blogging** - Research for blog posts
- **newsletter** - Research for newsletters
- **xpost** - Create posts from research

### Uses
- **be-creative** - deep thinking for extract alpha
- **OSINT** - MANDATORY for company/people comprehensive research
- **BrightData MCP** - CAPTCHA solving, advanced scraping
- **Apify MCP** - RAG browser, specialized site scrapers

---

## Deep Investigation Mode

**Progressive iterative research** that builds a persistent knowledge vault. Works in both single-run (one cycle) and loop mode (Algorithm-driven iterations).

**Concept:** Broad landscape → discover entities → score importance/effort → deep-dive one at a time → loop until coverage complete.

**Domain template packs** customize the investigation for specific domains:
- `Templates/MarketResearch.md` — Companies, Products, People, Technologies, Trends, Investors
- `Templates/ThreatLandscape.md` — Threat Actors, Campaigns, TTPs, Vulnerabilities, Tools, Defenders
- No template? The workflow creates entity categories dynamically from the landscape research.

**Example invocation:**
```
"Do a deep investigation of the AI agent market"
→ Loads MarketResearch.md template
→ Iteration 1: Broad landscape + first entity deep-dive
→ Loop mode: Each iteration deep-dives the next highest-priority entity
→ Exit: When all CRITICAL/HIGH entities researched + all categories covered
```

**Artifacts persist** at `$LIFEOS_DIR/MEMORY/RESEARCH/{date}_{topic}/` — the vault survives across sessions.

See `Workflows/DeepInvestigation.md` for full workflow details.

---

## File Organization

**Working files (temporary work artifacts):** `$LIFEOS_DIR/MEMORY/WORK/{current_work}/`
- Read `~/.claude/` to get the `work_dir` value
- All iterative work artifacts go in the current work item directory
- This ties research artifacts to the work item for learning and context

**History (permanent):** `$LIFEOS_ROOT/History/research/YYYY-MM/YYYY-MM-DD_[topic]/`

## Gotchas

- **SKIP-gate (check before anything else): if the request contains an x.com/twitter.com URL → STOP, route to `_X`.** Machine-checkable precheck: scan the prompt for `x\.com|twitter\.com` (e.g. `rg -q 'x\.com|twitter\.com'` on the request text) BEFORE spawning any research agents. X blocks WebFetch and generic scraping; the `_X` skill's `read.ts` is the only working path. When this gate fires, announce the skip and why in the response ("Skipping Research — X/Twitter URL routes to _X") — a silent skip is a failure.
- **Research agents hallucinate URLs.** EVERY URL must be verified before delivery. A single broken link is a catastrophic failure.
- **Recap journalism is not fan sentiment.** When the question is "what did fans think of X" — press articles invent consensus, fabricate timestamps, and parrot promoter copy. Route to Reddit JSON API + X (via `_X` skill) + YouTube first per `SourceRoutingProtocol.md`. Recap web search is the *secondary* source for community-sentiment questions, not the primary one. Quick mode can return recap-only and miss the actual fan data — pull Reddit directly rather than waiting to be asked again. Do not repeat.
- **API first, scraper second, web search last. Never invert.** For every platform: try the official API path (Reddit JSON, X API v2 via `_X`, YouTube Data API v3 if `YOUTUBE_API_KEY` is set) before reaching for Apify or BrightData. Scrapers are fallback for when the API path is unavailable, rate-limited, or doesn't expose the data shape needed (e.g., YouTube transcripts — use `fabric -y` even when the Data API key is set). The cascade inversion is the recurring failure mode. See `SourceRoutingProtocol.md` Cascade Priority section for the per-platform table.
- **Reddit JSON API is free and unauth'd — it IS the Tier-1 path for Reddit.** Append `.json` to any thread or listing URL. Set `User-Agent: LifeOS-Research/1.0` or Reddit rate-limits the default UA. Apify Reddit scraper is Tier 2 (fallback), not Tier 1.
- **"research" alone = Standard mode (4 agents + cross-check). Never default to Quick.** Users saying "research this" expect thorough results.
- **Due diligence, background checks, people lookup → OSINT skill, NOT Research.** Research handles general investigation; OSINT handles entity-specific deep investigation.
- **Don't spawn redundant research agents when you already have the answer in context.** If prior work in the session already covers the topic, skip agent spawning.
- **"extract alpha" routes to ExtractAlpha workflow — not the ExtractWisdom skill.** Different things.
- **YouTube extraction uses `fabric -y URL` directly** — don't try to scrape YouTube pages with WebFetch.
- **The inverse signal is signal.** When pulling fan sentiment, what people hated is as informative as what they loved. Always include a "disappointments" / "Tier C" section.
- **`DeepVerifiedResearch.mjs` is a Workflow-tool script, not a markdown workflow.** Invoke it with the `Workflow` tool (`scriptPath`), never by reading it and "doing the steps" — the whole point is that dedup, fetch-budget, vote-counting, and the abstention guard run deterministically in code. Running it spawns many agents + live web calls, so it is opt-in multi-agent: confirm with the principal (or use `args.test: true` for a small smoke run) rather than firing a full ~30–95-agent run unprompted.
- **Deep-verified voters are native Claude, diverse by lens — NOT by vendor.** A 2026-06-02 smoke test proved the external-API LifeOS researchers (Grok/Gemini/Perplexity) do NOT honor the Workflow structured-output contract: schema-forced, they complete without emitting a verdict, so cross-vendor voters all abstained and every claim died 0-0. The fix: voters are native workflow agents (reliable StructuredOutput), made diverse by attack lens (quote-support / contradiction / source-strength). Same lesson applies to the search and fetch stages — keep schema-gated phases on native agents. Multi-vendor diversity belongs in `research.mjs` (text-returning researchers), not in the schema-gated verification engine. A claim only survives a quorum of *valid* votes with fewer than the kill threshold refuting; all-abstain does NOT survive (guards the false-survive bug).

## Examples

**Example 1: Quick lookup**
```
User: "quick research on Hono SSR middleware patterns"
→ Invokes QuickResearch workflow (1 Claude agent)
→ Returns summary with key patterns and links
→ ~10-15 seconds
```

**Example 2: Standard multi-source research**
```
User: "research the current state of AI agent frameworks"
→ Invokes StandardResearch workflow (4 agents: Claude + Gemini + Grok + Perplexity, cross-checked)
→ Cross-references findings, confidence-tags, verifies URLs
→ Returns synthesized report with citations
→ ~30-60 seconds
```

**Example 3: Deep investigation**
```
User: "do a deep investigation of the AI agent market"
→ Invokes DeepInvestigation workflow
→ Broad landscape scan → entity discovery → priority scoring → deep-dives
→ Builds persistent knowledge vault in MEMORY/RESEARCH/
→ Loop-compatible for multi-session investigation
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Research","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
