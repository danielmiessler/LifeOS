---
name: pai-research
description: Multi-mode parallel research with quick, standard, extensive, and deep modes using delegate_task for parallel research agents with cross-verification
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes_tags: [pai, research, web-search, parallel, cross-verification]
  related_skills: [pai-council, pai-isa, pai-context-search]
  requires: [delegate_task, web_search, web_extract, read_file, write_file]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-research skill"}' \
  > /dev/null 2>&1 &
```


# pai-research — Multi-Mode Research

## Overview

pai-research provides 4 research modes with increasing parallelism and depth.
Each mode uses `delegate_task` to spawn parallel research agents that
independently search and analyze. A cross-verification step reconciles findings
into a single coherent research report.

### Modes

| Mode | Agents | Time Estimate | Use Case |
|------|--------|---------------|----------|
| **quick** | 1 | ~10s | Single-question fact check |
| **standard** | 3 | ~30s | Getting up to speed on a topic |
| **extensive** | 6 | ~60s | Deep dive with multiple perspectives |
| **deep** | 12 | ~120s | Comprehensive literature review |

## When to Use

- Need structured research on an unfamiliar topic
- Need multiple perspectives on a controversial subject
- Need fact-checking with source verification
- Any task that feeds into pai-council or pai-isa as context

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-research quick "query"` | Single-agent, single-search |
| `pai-research standard "query"` | 3 parallel search agents |
| `pai-research extensive "query"` | 6 parallel agents with analysis |
| `pai-research deep "query" --sources N` | 12 agents, N sources each |
| `pai-research verify "report"` | Cross-verification pass on existing report |

## Procedure

### Step 1: Parse mode and query

1. Extract mode from arguments (quick/standard/extensive/deep).
2. Extract query text. Validate non-empty.
3. If `--sources` flag present with deep mode, use as per-agent source count.

### Step 2: Define research plan

Use `delegate_task` to create a research plan:

```json
{
  "type": "delegate_task",
  "agent": "pai-research-planner",
  "task": "Given the query '{query}' and mode '{mode}' ({n_agents} agents), produce a research plan: decompose the query into {n_agents} sub-questions, each answerable via web search. For each sub-question, write a specific search query.\n\nQuery: {query}\nMode: {mode}\nAgents: {n_agents}"
}
```

### Step 3: Spawn parallel research agents

Based on mode, spawn agents. Each agent searches independently:

```json
// Example for standard mode (3 agents)
[
  {
    "type": "delegate_task",
    "agent": "pai-researcher-1",
    "task": "Research sub-question: {sub_q1}\nSearch query: {search_q1}\n\nUse web_search to find 3 relevant sources, then web_extract to get the content. Synthesize findings into a 2-paragraph summary with citations.",
    "tools": ["web_search", "web_extract"]
  },
  {
    "type": "delegate_task",
    "agent": "pai-researcher-2",
    "task": "Research sub-question: {sub_q2}\nSearch query: {search_q2}\n\nUse web_search to find 3 relevant sources, then web_extract to get the content. Synthesize findings into a 2-paragraph summary with citations.",
    "tools": ["web_search", "web_extract"]
  },
  {
    "type": "delegate_task",
    "agent": "pai-researcher-3",
    "task": "Research sub-question: {sub_q3}\nSearch query: {search_q3}\n\nUse web_search to find 3 relevant sources, then web_extract to get the content. Synthesize findings into a 2-paragraph summary with citations.",
    "tools": ["web_search", "web_extract"]
  }
]
```

For **quick** mode: 1 agent, 1 task, no parallelism.
For **extensive** mode: 6 agents, each with 2 sub-questions (one primary + one
counterpoint/alternative perspective).
For **deep** mode: 12 agents, each with one narrow sub-question, each
searching `--sources` (default 5) sources.

### Step 4: Collect and merge agent outputs

1. Wait for all parallel `delegate_task` calls to complete.
2. Concatenate outputs into a `raw_research_collection` document.
3. Remove duplicate sources and conflicting claims (mark as "disputed").

### Step 5: Cross-verification

Run a dedicated verification pass:

```json
{
  "type": "delegate_task",
  "agent": "pai-research-verifier",
  "task": "Cross-verify the following research collection. For each claim:\n1. Mark as CONFIRMED if multiple independent sources agree\n2. Mark as DISPUTED if sources disagree\n3. Mark as UNCORROBORATED if only one source supports it\n\nIdentify gaps (questions the research didn't answer).\n\nRaw research:\n{raw_research_collection}"
}
```

### Step 6: Compile final report

```json
{
  "type": "delegate_task",
  "agent": "pai-research-editor",
  "task": "Compile a final research report from the verified research below. Structure:\n1. Executive Summary (3-5 bullet points)\n2. Key Findings (with confidence: high/medium/low)\n3. Confirmed Claims (with sources)\n4. Disputed Claims (both sides)\n5. Gaps (questions unanswered)\n6. Sources (deduplicated, formatted)\n\nVerified research:\n{verified_research}"
}
```

### Step 7: Save report

1. Write report to `~/.pai/research/reports/{slug}.md`.
2. Write raw collection to `~/.pai/research/raw/{slug}.json` (for audit).
3. Return report path and confidence summary.

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-research","message":"Extensive research complete: '"'"'quantum error correction 2026'"'"'","agents":6,"findings":12,"confidence":"high","status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 11:30:01] pai-research standard "RAG patterns for code generation"
[2026-05-30 11:30:02] → planning: 3 sub-questions generated
[2026-05-30 11:30:03] → spawning 3 research agents in parallel
[2026-05-30 11:30:13] ← agent 1 complete (3 sources)
[2026-05-30 11:30:15] ← agent 2 complete (2 sources)
[2026-05-30 11:30:18] ← agent 3 complete (4 sources)
[2026-05-30 11:30:19] → cross-verifying 9 claims
[2026-05-30 11:30:22] → compiling final report
[2026-05-30 11:30:25] ✓ research report at ~/.pai/research/reports/rag-patterns-code-gen.md
[2026-05-30 11:30:25]   confidence: high (7/9 claims confirmed, 2 disputed)
```

## Gotchas

- **Stale sources**: Web search returns whatever is indexed. If the topic
  changes rapidly, results may be outdated. Add date constraints to search
  queries when recency matters.
- **Agent hallucination**: Research agents may fabricate sources.
  Always verify URLs actually exist before citing. The verifier step catches
  some but not all of these.
- **Token explosion**: Deep mode with 12 agents × 5 sources × web_extract
  content can produce 50K+ tokens of raw material. Plan ahead for context
  window limits.
- **Parallel timeout**: For deep mode, total time is bounded by the slowest
  agent. Set generous timeout on delegate_task calls (120s+ for deep).
- **Cross-verification depth**: The verifier checks logical consistency, not
  semantic truth. For mission-critical research, add a human-in-the-loop step.
