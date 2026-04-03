---
name: Research
pack-id: danielmiessler-research-v1.0.0
version: 1.0.0
author: danielmiessler
description: Comprehensive research and content extraction — quick/standard/extensive/deep modes with multi-agent parallel research, content retrieval, AI trends analysis, and 242+ Fabric patterns
type: skill
purpose-type: [research, analysis, content-extraction, intelligence]
platform: claude-code
dependencies: []
keywords: [research, multi-agent, perplexity, deep-investigation, fabric, content-extraction, youtube, web-scraping, alpha-extraction, knowledge, interview-research, ai-trends]
---

# Research

> Comprehensive research and content extraction -- from a quick single-agent lookup to a 12-agent parallel deep dive, all from a single trigger word.

---

## The Problem

Research is the most common precursor to real work, but doing it well inside an AI session is painful. You either get shallow single-source answers or you spend time manually orchestrating multiple searches and cross-referencing results. The typical experience:

- **Shallow results** -- asking "research X" gets a single web search that barely scratches the surface
- **No depth control** -- you cannot easily say "go deeper" and have the system actually scale up its effort
- **Lost sources** -- research URLs are hallucinated or unverified, wasting time on dead links
- **No extraction pipeline** -- getting content out of YouTube videos, paywalled sites, or PDFs requires separate tools
- **No persistence** -- research done in one session disappears when the session ends

The fundamental issue: research needs to scale in depth based on the question, verify its sources, and persist its findings.

---

## The Solution

The Research skill provides four research modes that scale from a 10-second quick lookup to a multi-hour deep investigation, plus specialized workflows for content extraction, Fabric pattern processing, and knowledge enhancement.

**Research Modes (scalable depth):**
1. **Quick** -- Single Perplexity agent, one query, results in 10-15 seconds
2. **Standard** (default) -- Three parallel agents (Perplexity + Claude + Gemini), synthesized results in 15-30 seconds
3. **Extensive** -- 12 parallel agents across 4 research types, comprehensive coverage in 60-90 seconds
4. **Deep Investigation** -- Progressive iterative research that builds a persistent knowledge vault, runs 3-60+ minutes with domain-specific templates

**Content Extraction:**
5. **Content Retrieval** -- Handles CAPTCHA, bot detection, and site blocking
6. **YouTube Extraction** -- Pulls transcripts and metadata via Fabric
7. **Web Scraping** -- General-purpose content extraction

**Analysis and Enhancement:**
8. **Extract Alpha** -- Deep analysis for highest-value insights from content
9. **Extract Knowledge** -- Structured knowledge extraction
10. **Enhance** -- Content improvement and enrichment
11. **Fabric Patterns** -- 242+ specialized processing patterns
12. **AI Trends** -- Specialized AI landscape analysis
13. **Interview Research** -- Tyler Cowen-style interview preparation
14. **Claude Research** -- Free web search using Claude's built-in WebSearch (no API keys)

Every URL in every research output is verified before delivery. Research artifacts persist at `~/.claude/MEMORY/RESEARCH/` across sessions.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing, trigger words, research mode definitions |
| Quick reference | `src/QuickReference.md` | Mode comparison table and usage examples |
| URL verification | `src/UrlVerificationProtocol.md` | Mandatory URL verification rules for all research outputs |
| Migration notes | `src/MigrationNotes.md` | Notes for upgrading from prior versions |
| Quick research | `src/Workflows/QuickResearch.md` | Single-agent Perplexity workflow |
| Standard research | `src/Workflows/StandardResearch.md` | Three-agent parallel research (default) |
| Extensive research | `src/Workflows/ExtensiveResearch.md` | 12-agent comprehensive research |
| Deep investigation | `src/Workflows/DeepInvestigation.md` | Iterative progressive research with knowledge vault |
| Extract alpha | `src/Workflows/ExtractAlpha.md` | Deep content analysis for highest-value insights |
| Content retrieval | `src/Workflows/Retrieve.md` | Handles blocked/protected content access |
| YouTube extraction | `src/Workflows/YoutubeExtraction.md` | YouTube transcript and metadata extraction |
| Web scraping | `src/Workflows/WebScraping.md` | General-purpose web content extraction |
| Claude research | `src/Workflows/ClaudeResearch.md` | Free web search via Claude WebSearch |
| Interview research | `src/Workflows/InterviewResearch.md` | Tyler Cowen-style interview preparation |
| AI trends | `src/Workflows/AnalyzeAiTrends.md` | AI landscape and trends analysis |
| Fabric patterns | `src/Workflows/Fabric.md` | 242+ Fabric pattern processing |
| Enhance | `src/Workflows/Enhance.md` | Content improvement and enrichment |
| Extract knowledge | `src/Workflows/ExtractKnowledge.md` | Structured knowledge extraction |
| Market research template | `src/Templates/MarketResearch.md` | Deep investigation template: Companies, Products, People, Technologies, Trends, Investors |
| Threat landscape template | `src/Templates/ThreatLandscape.md` | Deep investigation template: Threat Actors, Campaigns, TTPs, Vulnerabilities, Tools, Defenders |

**Summary:**
- **Workflows:** 14 (4 research modes + 10 specialized workflows)
- **Templates:** 2 domain-specific deep investigation templates
- **Support files:** 3 (QuickReference, UrlVerificationProtocol, MigrationNotes)
- **Dependencies:** Perplexity API key (for quick/standard/extensive), Fabric CLI (for patterns and YouTube), Claude WebSearch (free, built-in)

---

## What Makes This Different

This sounds similar to asking an AI to "search the web," which also does research. What makes this approach different?

The Research skill is not a single web search. It is a multi-agent orchestration system that dispatches parallel research agents with different methodologies and synthesizes their findings. Standard mode runs three agents simultaneously (Perplexity for web search, Claude for reasoning, Gemini for breadth). Extensive mode runs twelve. Deep investigation mode iterates progressively, building a persistent knowledge vault with entity scoring and coverage tracking. Every single URL in every output is verified before delivery -- no hallucinated links. And all research artifacts persist to disk so they survive across sessions.

- Four depth levels from 10-second lookups to multi-hour investigations
- Multi-agent parallel execution for comprehensive coverage
- Mandatory URL verification eliminates hallucinated sources
- Domain-specific templates for market research and threat landscape analysis
- Persistent knowledge vault for deep investigations
- Feeds directly into blogging, newsletter, and social media skills

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "research quantum computing" | Standard mode: 3 agents in parallel, synthesized in 15-30s |
| "quick research on RISC-V adoption" | Quick mode: 1 Perplexity agent, results in 10-15s |
| "extensive research on the AI agent market" | Extensive mode: 12 agents across 4 types, 60-90s |
| "deep investigation of the cybersecurity landscape" | Deep mode: iterative progressive research, builds knowledge vault |
| "extract alpha from this article" | ExtractAlpha workflow: deep analysis for highest-value insights |
| "get the transcript from this YouTube video" | YouTube extraction via Fabric |
| "use fabric extract_wisdom on this content" | Fabric pattern processing (242+ patterns) |
| "research this person for an interview" | Interview research: Tyler Cowen-style preparation |
| "analyze current AI trends" | AI trends analysis workflow |
| "retrieve content from [blocked URL]" | Content retrieval with CAPTCHA/bot-detection handling |

---

## Example Usage

### Standard Research (Default)

```
User: "research the current state of AI code generation"

AI:
1. Dispatches 3 agents in parallel:
   - Perplexity: web search for recent articles, benchmarks, announcements
   - Claude: reasoning about trends, implications, key players
   - Gemini: broad coverage of adjacent topics, academic papers
2. Synthesizes findings into unified report
3. Verifies all URLs
4. Delivers structured output with sources
5. Total time: ~20 seconds
```

### Deep Investigation

```
User: "deep investigation of the AI agent market"

AI:
1. Loads MarketResearch.md template (Companies, Products, People, Technologies, Trends, Investors)
2. Iteration 1: Broad landscape scan + first entity deep-dive
3. Scores all discovered entities by importance and effort
4. Each subsequent iteration deep-dives the next highest-priority entity
5. Builds persistent vault at ~/.claude/MEMORY/RESEARCH/2026-03-15_ai-agent-market/
6. Exits when all CRITICAL/HIGH entities researched + all categories covered
```

### Extract Alpha

```
User: "extract alpha from this 5000-word essay on consciousness"

AI:
1. Routes to ExtractAlpha workflow
2. Applies deep analysis framework
3. Identifies highest-value non-obvious insights
4. Returns structured alpha with source attribution
```

---

## Configuration

### Required for Full Functionality

- **Perplexity API key** -- for Quick, Standard, and Extensive research modes
- **Fabric CLI** -- for Fabric pattern processing and YouTube extraction (`brew install fabric` or see Fabric docs)

### Free Without API Keys

- **Claude Research** -- uses Claude's built-in WebSearch, no API key needed
- **Extract Alpha / Extract Knowledge / Enhance** -- analysis workflows that operate on provided content

### Research Output Locations

- **Working files:** `~/.claude/MEMORY/WORK/{current_work}/` (tied to active work item)
- **Permanent history:** `~/.claude/History/research/YYYY-MM/YYYY-MM-DD_[topic]/`
- **Deep investigation vaults:** `~/.claude/MEMORY/RESEARCH/{date}_{topic}/`

---

## Customization

### Recommended Customization

Create `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Research/PREFERENCES.md` to define:
- Default research mode
- Preferred sources or domains to prioritize
- Output format preferences
- Topics of ongoing interest

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Research preferences | `SKILLCUSTOMIZATIONS/Research/PREFERENCES.md` | Default behavior for all research modes |
| Custom investigation templates | `Templates/` directory | Add domain-specific templates for deep investigation |
| URL verification rules | `UrlVerificationProtocol.md` | Adjust verification strictness |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Fabric integration:** Daniel Miessler -- creator of [Fabric](https://github.com/danielmiessler/fabric), the 242+ pattern library
- **Inspired by:** The gap between asking a question and getting genuinely thorough, verified research

---

## Related Work

- **PAI OSINT Skill** -- For company/person background checks and due diligence (Research routes to OSINT for these)
- **PAI Scraping Skill** -- For advanced web scraping when Research's content retrieval needs escalation
- **Fabric** -- The open-source pattern library that powers the Fabric workflow

---

## Works Well With

- **Scraping Pack** -- Research routes to Scraping for CAPTCHA-protected or bot-detected content
- **Media Pack** -- Research outputs can be visualized as diagrams, infographics, and timelines
- **PAI Blogging Skill** -- Research feeds directly into blog post creation
- **PAI Newsletter Skill** -- Research feeds into newsletter content

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Four research modes: Quick, Standard, Extensive, Deep Investigation
- 14 specialized workflows
- 2 domain templates (MarketResearch, ThreatLandscape)
- Mandatory URL verification protocol
- Persistent knowledge vault for deep investigations
- Integration with Fabric 242+ patterns
