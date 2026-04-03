---
name: Context Search
pack-id: danielmiessler-context-search-v1.1.0
version: 1.1.0
author: danielmiessler
description: Search prior work to add context to any request — search PRDs, git history, session names, and work directories with a single slash command, standalone or paired with a task
type: skill
purpose-type: [productivity, workflow, context-recovery]
platform: claude-code
dependencies: []
keywords: [context-search, session-search, context-recovery, PRD, slash-command, resume-work, prior-work, session-history, commands]
---

# Context Search

> Search prior work to add context to any request — never lose context between sessions again.

---

## The Problem

AI agents are powerful but amnesiac. Each session starts fresh with no memory of prior work. When you've built features, debugged issues, or done research in past sessions, that context is gone. You end up:

- **Re-explaining context** — "We already worked on this last week..."
- **Losing decisions** — "Why did we choose that approach? I don't remember."
- **Duplicating effort** — Starting from scratch on problems you've already solved
- **Missing connections** — Not realizing that today's task relates to prior work

The fundamental issue: your AI infrastructure generates valuable work artifacts (PRDs, git commits, session summaries), but there's no fast way to search and recall them by topic.

---

## The Solution

Context Search adds two slash commands (`/context-search` and `/cs`) that automatically detect your environment and search the right data sources.

The command supports two usage modes:

1. **Standalone** — Search and browse previous work on a topic, then wait for a request. Use this to familiarize yourself before asking.
2. **Paired with a request** — Search first, load the context, then execute an accompanying task informed by that context. Use this to ground a request in prior work.

**Any Claude Code install (vanilla):**
1. **Conversation History** (`history.jsonl`) — Every prior prompt you've sent, with timestamps and project context
2. **Git History** — Commit messages in the current project mentioning the topic
3. **Project Memory** — Auto-memory files saved across all your projects

**PAI-enhanced installs (additional sources):**
4. **Session Registry** (`work.json`) — Structured metadata for all tracked sessions
5. **Work Directories** (`MEMORY/WORK/`) — Full PRD files with context, criteria, decisions
6. **Session Names** — Human-readable session name cache
7. **PRD Content** — Full-text search across all PRD bodies
8. **PAI Git History** — Commits in the PAI infrastructure repo

The command synthesizes results into an actionable summary sorted by recency, then loads the most relevant context so your AI can immediately continue where you left off.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | File | Purpose |
|-----------|------|---------|
| Primary command | `src/commands/context-search.md` | `/context-search` slash command — full name for discoverability |
| Shortcut command | `src/commands/cs.md` | `/cs` slash command — short form for quick access |

**Summary:**
- **Files created:** 2
- **Hooks registered:** 0
- **Dependencies:** None (works standalone, enhanced by PAI MEMORY structure)

---

## What Makes This Different

This sounds similar to `git log --grep` which also searches past work. What makes this approach different?

Context Search searches up to eight data sources simultaneously — conversation history, git commits, project memory, session metadata, PRD content, session names, and work directories. A git grep only finds commit messages. Context Search finds everything: what you asked, what was decided, what the criteria were, and where it left off. It works on any Claude Code install out of the box, and gets richer if you have PAI installed.

- Works on vanilla Claude Code — no PAI required
- Auto-detects environment and searches available sources
- Output is structured for instant AI context loading
- PAI users get additional PRD and session registry search
- Two modes: standalone browsing or paired with a task request

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| `/context-search authentication` | Searches all sources for "authentication", presents structured results, waits for a request |
| `/cs authentication` | Same search using the shortcut |
| `/cs deploy` then ask a question | Finds all sessions related to deployment, loads context, then answers the question informed by that context |
| `/context-search helios` | Finds project-specific sessions by name |
| `/cs dashboard` + "now refactor the sidebar" | Paired mode: loads dashboard context, then executes the refactor request |

The command accepts any topic as a free-text argument. Matching is case-insensitive and partial — searching "auth" will match "authentication", "auth-middleware", etc.

---

## Example Usage

### Standalone Mode (Search + Wait)

```
User: /cs authentication

AI responds:
=== CONTEXT SEARCH: authentication ====================

MATCHING SESSIONS (sorted by most recent first):

  * 20260312-143000_fix-auth-middleware — Fix authentication middleware race condition
    Phase: complete | Progress: 8/8 | Effort: standard
    Started: 2026-03-12 | Last updated: 2026-03-12
    Key context: Fixed race condition in auth token refresh causing 401 errors
    Criteria status: 8 passed / 8 total

  * 20260310-091500_add-oauth-flow — Add OAuth2 login flow
    Phase: complete | Progress: 12/12 | Effort: extended
    Started: 2026-03-10 | Last updated: 2026-03-10
    Key context: Implemented OAuth2 PKCE flow with Google and GitHub providers
    Criteria status: 12 passed / 12 total

RELATED COMMITS (last 20):
  * a1b2c3d Fix auth middleware race condition (2026-03-12)
  * d4e5f6g Add OAuth2 PKCE flow (2026-03-10)

WORK DIRECTORIES:
  * 20260312-143000_fix-auth-middleware/
  * 20260310-091500_add-oauth-flow/

---------------------------------------------------

"I've loaded context on authentication. The most recent session fixed a race
condition in auth middleware. What would you like to do?"
```

### Paired Mode (Search + Execute)

```
User: /cs authentication
      Now add rate limiting to the auth endpoints

AI responds:
=== CONTEXT SEARCH: authentication ====================
[same structured results as above]
---------------------------------------------------

"I've loaded context on authentication. Based on the prior work — especially
the OAuth2 PKCE flow and the auth middleware fix — I'll now add rate limiting
to the auth endpoints..."

[proceeds to execute the task with full context]
```

### No Results

```
User: /cs quantum-computing

AI responds:
=== CONTEXT SEARCH: quantum-computing ====================

MATCHING SESSIONS: None found

RELATED COMMITS: None found

WORK DIRECTORIES: None found

---------------------------------------------------

"No prior work found on quantum-computing. What would you like to do?"
```

---

## Configuration

No configuration required.

The command searches these paths by default:
- `~/.claude/MEMORY/STATE/work.json`
- `~/.claude/MEMORY/WORK/`
- `~/.claude/MEMORY/STATE/session-names.json`
- `~/.claude/` (git history)

If these paths don't exist (e.g., PAI's MEMORY system isn't installed), the command gracefully returns "no matches found" for those sources. No errors, no crashes.

---

## Customization

### Recommended Customization

No customization needed — the command works as-is.

### Optional Customization

If you use a different directory structure for your work tracking, you can edit the command files to point to your paths:

| Customization | File | Impact |
|--------------|------|--------|
| Change work registry path | `context-search.md` / `cs.md` | Searches your custom work.json location |
| Change work directory path | `context-search.md` / `cs.md` | Searches your custom PRD directory |
| Add additional search sources | `context-search.md` / `cs.md` | Extends search to cover more data |

---

## Credits

- **Original concept:** Daniel Miessler — developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The frustration of losing context between AI sessions

---

## Related Work

- **PAI MEMORY System** — The work tracking infrastructure that generates the data this command searches
- **PAI Algorithm** — The system that creates PRDs with structured criteria, decisions, and verification

---

## Works Well With

- **PAI Core Install** — Provides the MEMORY directory structure for full functionality
- **PAI Algorithm Skill** — Generates the PRDs that Context Search searches

---

## Changelog

### 1.1.0 - 2026-03-15
- Renamed from Work Command to Context Search
- Commands changed from `/w` and `/work` to `/context-search` and `/cs`
- Added dual-mode usage: standalone (search + wait) and paired (search + execute request)
- Output header changed from "WORK RECALL" to "CONTEXT SEARCH"
- Shortcut `/cs` added for quick access

### 1.0.0 - 2026-03-13
- Initial release as Work Command
- Two commands: `/w` (short) and `/work` (descriptive)
- Five parallel search sources
- Structured output format with recency sorting
- Graceful degradation when data sources are missing
