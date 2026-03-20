---
name: research
description: "Comprehensive research and content extraction — quick/standard/extensive/deep modes with multi-agent parallel research, content retrieval, AI trends analysis, and 242+ Fabric patterns. USE WHEN research, do research, quick research, extensive research, deep investigation, find information, investigate, extract alpha, analyze content, retrieve content, use fabric, AI trends, Claude research, enhance content, extract knowledge, interview research, web scraping, YouTube extraction, standard research."
---

## Trigger Mapping

| User Says | Mode |
|-----------|------|
| "research" / "do research" / "research this" | Standard (3 agents: Perplexity + Claude + Gemini) |
| "quick research" / "minor research" | Quick (1 Perplexity agent) |
| "extensive research" / "deep research" | Extensive (12 agents) |
| "deep investigation" / "investigate [topic]" | Deep Investigation (iterative) |

**"Research" alone = Standard mode. No exceptions.**

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Research/` — load and apply if present, otherwise use defaults.

## Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the WORKFLOWNAME workflow in the Research skill to ACTION"}' \
  > /dev/null 2>&1 &
```

Output: `Running the **WorkflowName** workflow in the **Research** skill to ACTION...`

# Research Skill

**MANDATORY:** Read `UrlVerificationProtocol.md` — every URL must be verified before delivery. Research agents hallucinate URLs.

**CRITICAL:** For due diligence, company/person background checks, or vetting → **INVOKE OSINT SKILL INSTEAD**

## Workflow Routing

### Research Modes

| Trigger | Workflow | Speed |
|---------|----------|-------|
| "quick research" | `Workflows/QuickResearch.md` | ~10-15s |
| "do research" (default) | `Workflows/StandardResearch.md` | ~15-30s |
| "extensive research" | `Workflows/ExtensiveResearch.md` | ~60-90s |
| "deep investigation" | `Workflows/DeepInvestigation.md` | ~3-60min |

### Content Analysis & Retrieval

| Trigger | Workflow |
|---------|----------|
| "extract alpha", deep analysis | `Workflows/ExtractAlpha.md` |
| CAPTCHA/bot detection/blocking | `Workflows/Retrieve.md` |
| YouTube URL extraction | `Workflows/YoutubeExtraction.md` |
| Web scraping | `Workflows/WebScraping.md` |
| Claude WebSearch only (free) | `Workflows/ClaudeResearch.md` |
| Interview preparation | `Workflows/InterviewResearch.md` |
| AI trends analysis | `Workflows/AnalyzeAiTrends.md` |
| Fabric patterns (242+) | `Workflows/Fabric.md` |
| Enhance/improve content | `Workflows/Enhance.md` |
| Extract knowledge | `Workflows/ExtractKnowledge.md` |

**Validation checkpoint:** Verify all URLs via `UrlVerificationProtocol.md` before including in output. See `QuickReference.md` for detailed examples.

---

## Deep Investigation Mode

Progressive iterative research building a persistent knowledge vault. Broad landscape → discover entities → score importance/effort → deep-dive one at a time → loop until coverage complete.

**Domain templates:** `Templates/MarketResearch.md` (Companies, Products, People, Technologies), `Templates/ThreatLandscape.md` (Threat Actors, TTPs, Vulnerabilities). Without a template, entity categories are created dynamically.

```
"Do a deep investigation of the AI agent market"
→ Loads MarketResearch.md template → broad landscape → entity scoring → iterative deep-dives
→ Exit when all CRITICAL/HIGH entities researched + all categories covered
```

**Artifacts persist** at `~/.claude/MEMORY/RESEARCH/{date}_{topic}/`

## Integration

**Feeds into:** blogging, newsletter, xpost
**Uses:** be-creative (extract alpha), OSINT (company/people research), BrightData MCP, Apify MCP

## File Organization

- **Working files:** `~/.claude/MEMORY/WORK/{current_work}/` (read `~/.claude/MEMORY/STATE/current-work.json` for `work_dir`)
- **History:** `~/.claude/History/research/YYYY-MM/YYYY-MM-DD_[topic]/`
