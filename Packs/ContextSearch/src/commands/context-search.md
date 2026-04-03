---
name: Context Search
description: Search prior work to add context to a request, or browse previous sessions on a topic. Use before/after a request to ground it in past work, or standalone to recall and familiarize before asking.
argument-hint: [topic]
---

# Context Search

Search all prior work for: **$ARGUMENTS**

## Your Task

You are searching prior work on the topic "$ARGUMENTS". Search across ALL available sources, synthesize what you find, and present a context summary.

**Two usage modes:**

1. **Standalone (no accompanying request):** Search, present findings, familiarize yourself with the context, then wait for a request. Say: "I've loaded context on [topic]. What would you like to do?"

2. **Paired with a request (context search used before or after a task request):** Search first, load the context, then execute the accompanying request informed by that context. Do NOT start the request until context search is complete.

## Step 1: Detect Environment

Check which data sources exist. This determines whether you're on a vanilla Claude Code install or a PAI-enhanced one.

```
PAI detected if: ~/.claude/MEMORY/WORK/ directory exists
```

## Step 2: Search (execute available searches in parallel)

### Always Available (any Claude Code install)

**A. Conversation History**
Search `~/.claude/history.jsonl` for lines where the `display` field matches "$ARGUMENTS" (case-insensitive, partial match). Each line is JSON with fields: `display`, `timestamp`, `project`, `sessionId`. Extract the most recent 10 matching entries with their timestamps and project paths.

**B. Current Project Git History**
Run: `git log --oneline --all --grep="$ARGUMENTS" -i -20` to find commits in the current project mentioning this topic.

**C. Project Memory Files**
Use Glob to find `~/.claude/projects/*/memory/*.md` files, then Grep across them for "$ARGUMENTS" to find any saved context from prior projects.

### PAI-Enhanced (only if ~/.claude/MEMORY/WORK/ exists)

**D. Session Registry**
Read `~/.claude/MEMORY/STATE/work.json` and find all sessions where the `task` field, slug key, or `sessionName` field matches "$ARGUMENTS" (case-insensitive, partial match). Extract: task, phase, progress, effort, started, criteria summary.

**E. Work Directories**
Search `~/.claude/MEMORY/WORK/` for matching directory names (case-insensitive, partial match). For each match, read the PRD.md frontmatter and `## Context` section.

**F. PAI Git History**
Run: `git -C ~/.claude log --oneline --all --grep="$ARGUMENTS" -i -20` to find commits in the PAI repo mentioning this topic.

**G. Session Names**
Read `~/.claude/MEMORY/STATE/session-names.json` and find entries where the session name matches "$ARGUMENTS" (case-insensitive, partial match).

**H. PRD Content Search**
Use Grep to search for "$ARGUMENTS" in `~/.claude/MEMORY/WORK/` across PRD files (limit to `**/PRD.md` glob) for deeper context matches.

## Output Format

Present your findings as:

```
═══ CONTEXT SEARCH: $ARGUMENTS ══════════════════

📋 MATCHING SESSIONS (sorted by most recent first):

  For each match:
  • [session slug or sessionId] — [task description or user prompt]
    Phase: [phase] | Progress: [progress] | Effort: [effort]
    Started: [date] | Last updated: [date]
    Key context: [1-2 sentence summary]
    Criteria status: [X passed / Y total] (if PAI PRD available)

🔗 RELATED COMMITS (last 20):
  • [commit hash] [message] ([date])

💬 CONVERSATION HISTORY (recent matching prompts):
  • [timestamp] [project] — [user prompt excerpt]

📂 WORK DIRECTORIES:
  • [list of matching directory names]

───────────────────────────────────────────────
```

Omit any section that has no results. Only show sections with actual matches.

## After Presenting Results

**Mode 1 — Standalone (no accompanying request):**
1. If matches found: Read the most recent matching PRD (if PAI) or summarize the most recent conversation context. Then say: "I've loaded context on [topic]. The most recent session was [X]. What would you like to do?"
2. If no matches found: Say: "No prior work found on [topic]. What would you like to do?"

**Mode 2 — Paired with a request:**
1. If matches found: Read the most recent matching PRD (if PAI) or summarize the most recent conversation context. Then proceed to execute the accompanying request, fully informed by the recovered context.
2. If no matches found: Proceed with the request anyway, noting that no prior context was found.

## Important

- Sort everything by recency (newest first)
- If PAI PRDs found, read the top 3 in full for context
- Be concise but thorough — the goal is instant context recovery
- If there are more than 10 matches in any section, show the 10 most recent and mention the total count
- The conversation history search (history.jsonl) can be large — limit to 10 most recent matches
