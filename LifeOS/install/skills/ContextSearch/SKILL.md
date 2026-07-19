---
name: ContextSearch
version: 1.1.6
description: "Find prior LifeOS work — sessions, ISAs, conversations — by topic or date phrase; searches the work registry, titles, dir names, ISA bodies, and conversation logs, ranked by relevance. USE WHEN context search, prior work, browse sessions, recall, remember, previous sessions, context recovery, what did we do, find session, search history, what was that project, pick up where we left off, resume, look up old work, cold start, yesterday's work, last week, find that session, the one about. NOT FOR searching published content like blog posts/newsletters/tweets (use _CONTENTSEARCH) or the typed-graph Knowledge Archive (use Knowledge)."
argument-hint: [topic]
effort: low
---

# ContextSearch

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/ContextSearch/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## What It Does

Finds prior LifeOS work — sessions, ISAs, conversations — by topic, partial words, or date phrases like "yesterday" or "last week". A deterministic Bun CLI searches five sources in parallel, scores by token-overlap times recency, applies date filters, and returns ranked results with snippets.

## The Problem

Work spreads across sessions, ISAs, and conversation logs, and a week later you can't remember where a project lived or what it was called. Substring search misses it because you remember the gist, not the exact title. You need to recall half-remembered work fast — by a few words, or by "the thing I did yesterday" — and pick up where you left off without rereading everything by hand.

## How It Works

Search prior work for: **$ARGUMENTS**

The skill body delegates to a deterministic Bun CLI. The tool searches five sources in parallel, scores by token-overlap × recency, applies date filters, and returns ranked results.

## Workflow Routing

Single-tool skill — no `Workflows/` directory. Every invocation routes to the one CLI:

| Workflow | Trigger | File |
|----------|---------|------|
| Search (inline) | context search, /cs, prior work, recall, find session, resume, date phrases | `Tools/ContextSearch.ts` |

## Run the search

```bash
bun run "${CLAUDE_SKILL_DIR}/Tools/ContextSearch.ts" "$ARGUMENTS" --pretty --limit 10
```

The tool auto-detects TTY for output mode; explicit `--pretty` keeps the human-readable block when the skill is invoked from inside a Claude Code session (where stdout is not a true TTY). Pipe to `--json` for structured output to jq.

## Useful flag patterns

```bash
# Limit results
bun run "${CLAUDE_SKILL_DIR}/Tools/ContextSearch.ts" "$ARGUMENTS" --limit 5

# Constrain by date
bun run "${CLAUDE_SKILL_DIR}/Tools/ContextSearch.ts" "$ARGUMENTS" --since 2026-05-01

# JSON for programmatic use
bun run "${CLAUDE_SKILL_DIR}/Tools/ContextSearch.ts" "$ARGUMENTS" --json | jq '.results[0]'
```

The tool also parses date phrases inline: `"yesterday markdown"` becomes a bounded since/until of yesterday only, plus token search for `markdown`.

## Usage Modes

1. **Standalone** — Run the search, present the pretty block, say: "Context loaded on [topic]. Most recent: [X]. What would you like to do?"
2. **Paired with request** — Run the search first, then execute the request informed by found context. If a result's `path` looks promising, Read it for full detail.

## Output shape

The pretty block:

```
═══ CONTEXT: <query> ═══════════════════════

📋 RESULTS (N, newest+best first):
  • <slug>
    task: ... | phase: ... | progress: ... | effort: ... | <recency>d ago | score: ... | sources: ...
    ↳ "<snippet from matched source>"
    <path to ISA or jsonl>

Searched: work.json=N, names=N, dirs=N, isa=N, jsonl=N
════════════════════════════════════════════════
```

JSON: `{ query, cleaned_query, tokens, since, until, stats, results: [{ source[], slug, sessionUuid, name, task, phase, progress, effort, score, recencyDays, snippet, path }] }`

## Gotchas

- **Token-overlap scoring, not substring matching.** Queries like `markdown extended` find sessions named `Research Type Markdown Extended Images` even though "markdown extended" is not a substring of that name. The query is tokenized (lowercase, `[^a-z0-9]+` split, stopwords removed) and any candidate that shares ≥1 non-stopword token gets scored.
- **Date phrases are first-class.** `today`, `yesterday`, `day before yesterday`, `last week`, `last month`, `N days ago`, and `YYYY-MM-DD` parse out of the query as bounded date filters; the remaining tokens still score against content. `yesterday` and `today` use single-day windows (since AND until); `last week` uses a 7-day rolling window.
- **JSONL-source date is the first user-message timestamp, not file mtime.** Conversation jsonl files get touched whenever Claude Code re-reads them, so mtime drifts. The tool parses the first `type:"user"` line's `timestamp` to recover the actual session start date — that's what date filters compare against.
- **Search is restricted to the `~/.claude` project's own conversation directory under `~/.claude/Projects/` for jsonl content** (dir name derived from `$HOME` at runtime — path with `/` and `.` mapped to `-`). Other Claude project directories on the same machine are out of scope by design.
- **No persistent index.** Every query rescans from disk. ripgrep over ~9k jsonl files completes in ~1s; total query latency is typically 1–2s, well within interactive perception. If a future scale change makes that unworkable, an opt-in cached index (e.g., per-jsonl first-user-timestamp + word-frequency map) is the v2.
- **Standalone vs paired.** When the user invokes ContextSearch alone (`/cs <topic>`), present results and ask what they want to do. When invoked as a paired primer to an unrelated request, run the search silently and use the top results to anchor the answer — don't dump the search block into the response unless the user asked.
- **Session-names.json date is jsonl mtime (best-available fallback).** Some session UUIDs don't appear in work.json or as `MEMORY/WORK/` directories — they're conversation-only sessions whose only structural trace is the auto-generated name. For those, the tool uses jsonl mtime for recency. If the file's been re-read recently the date will skew newer than the actual conversation.

## After Results

**Standalone:** "Context loaded on [topic]. Most recent: [X]. What would you like to do?"

**Paired:** Proceed with the user's request, anchored by the top result's context. If deeper detail is needed, Read the specific path the tool returned.

## Examples

**Example 1: Resume work on a specific topic**
```
User: "what did we do with the Telegram bot?"
→ bun run Tools/ContextSearch.ts "telegram bot"
→ Tokens [telegram, bot] hit work.json + ISA bodies + jsonl
→ Returns telegram-monitor-revival, fix-telegram-channels-plugin-broken, ranked by recency
```

**Example 2: Find half-remembered session**
```
User: "open up that test extended markdown document that you made yesterday"
→ bun run Tools/ContextSearch.ts "test extended markdown document yesterday"
→ Date phrase 'yesterday' parses out → since/until = 2026-05-07 only
→ Tokens [test, extended, markdown, document] hit jsonl content
→ Returns "Research Type Markdown Extended Images" session in top-3 with snippet
```

**Example 3: Date-only browsing**
```
User: "what did I work on last week?"
→ bun run Tools/ContextSearch.ts "last week"
→ Date phrase parses to since=7d-ago, no token filter
→ Returns all sessions from the past 7 days, newest first
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"ContextSearch","workflow":"Search","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```
