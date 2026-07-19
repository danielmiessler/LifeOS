---
name: ArXiv
version: 1.0.7
description: "Search and retrieve arXiv academic papers by topic, category, or paper ID — with AlphaXiv-enriched AI-generated overviews. Uses arXiv Atom API across cs.AI/cs.LG/cs.CL/cs.CR/cs.MA/cs.SE/cs.IR. Three workflows: Latest, Search, Paper. USE WHEN arxiv, papers, latest papers, research papers, recent ML papers, paper lookup, summarize paper, latest LLM papers, AI safety papers, cs.AI latest. NOT FOR general research (Research), URL parsing (_PARSER), or annual reports (_ANNUALREPORTS)."
effort: low
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/ArXiv/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the ArXiv skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **ArXiv** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# ArXiv

## What It Does

Searches and retrieves arXiv academic papers by topic, category, or paper ID, and pulls AlphaXiv's AI-generated overviews when a paper has one. Covers the cs.AI / cs.LG / cs.CL / cs.CR / cs.MA / cs.SE / cs.IR categories. Three workflows: Latest, Search, Paper. No API keys needed.

## The Problem

arXiv ships thousands of papers a day and its native search is clunky — Atom XML, three-second rate limits, fields you have to know by name, and a `lastUpdatedDate` that quietly resurfaces old papers as if they were new. Reading a raw paper to decide whether it's worth your time is slow. This skill wraps the query mechanics, handles the XML, and layers AlphaXiv overviews on top so you can triage a paper in seconds instead of reading the whole PDF first.

## How It Works

Uses arXiv's Atom API for search and discovery, and AlphaXiv's markdown endpoint for enriched paper overviews. Search fields, boolean operators, sort order, and pagination are all handled for you; overviews are fetched per paper ID when available (a 404 just means no overview exists yet).

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "latest papers in X", "new papers on X", "what's new in AI research" | `Workflows/Latest.md` |
| "search arxiv for X", "find papers about X", "arxiv papers on X" | `Workflows/Search.md` |
| arxiv URL, paper ID like `2401.12345`, "explain this paper" | `Workflows/Paper.md` |

## Quick Reference

**arXiv API** (no auth):
- Base: `https://export.arxiv.org/api/query`
- Search fields: `ti:` (title), `au:` (author), `abs:` (abstract), `cat:` (category), `all:` (everything)
- Booleans: `AND`, `OR`, `ANDNOT`
- Sort: `sortBy=lastUpdatedDate&sortOrder=descending` for latest
- Pagination: `start=0&max_results=10` (max 2000 per call)
- Rate limit: 3s between calls

**AlphaXiv enrichment** (no auth):
- Overview: `curl -s "https://alphaxiv.org/overview/{PAPER_ID}.md"`
- Full text: `curl -s "https://alphaxiv.org/abs/{PAPER_ID}.md"` (fallback)
- Not all papers have overviews — 404 means analysis not yet generated

**Key categories for our work:**
- `cs.AI` — Artificial Intelligence
- `cs.LG` — Machine Learning
- `cs.CL` — Computation and Language (NLP/LLMs)
- `cs.CR` — Cryptography and Security
- `cs.SE` — Software Engineering
- `cs.MA` — Multi-Agent Systems
- `cs.IR` — Information Retrieval

## Examples

**Example 1: Latest papers in a category**
```
User: "what's new in AI safety papers this week"
→ Latest workflow: queries cat:cs.AI sorted by lastUpdatedDate, filters by <published> date
→ Returns titles, authors, abstracts, links
```

**Example 2: Topic search**
```
User: "search arxiv for prompt injection defenses"
→ Search workflow: all:"prompt injection" query with boolean refinement
→ Returns ranked matches with abstracts
```

**Example 3: Single paper lookup**
```
User: "explain this paper: 2401.12345"
→ Paper workflow: fetches metadata, pulls AlphaXiv overview (falls back to abstract on 404)
→ Returns summary plus link to PDF
```

## Gotchas

- arXiv API **requires HTTPS** and `-L` (follows redirects). HTTP 301s to HTTPS silently.
- arXiv API returns Atom XML, not JSON. Parse with text processing, not `jq`.
- `lastUpdatedDate` includes edits to old papers. For truly new submissions, check `<published>` dates.
- AlphaXiv overviews are AI-generated summaries. Great for quick understanding, but verify claims against the actual paper for anything you'd cite.
- arXiv API rate limit is 3 seconds between calls. Batch your queries.
- `max_results` caps at 2000. For broader sweeps, paginate with `start`.
- Category search (`cat:cs.AI`) returns papers with that as primary OR cross-listed category.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"ArXiv","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```
