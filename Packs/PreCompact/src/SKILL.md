---
name: PreCompact
description: >
  USE WHEN context is about to compact, session is long-running, context window
  is filling up, user has been working for extended period, or continuity after
  compaction matters. USE WHEN the AI needs to preserve tone, momentum,
  micro-decisions, and emotional context that lossy summaries destroy.
---

# PreCompact Skill

## Workflow Routing

| Situation | Workflow | File |
|-----------|----------|------|
| Context compaction is imminent | Preserve | `Workflows/Preserve.md` |
| Post-compaction recovery | Preserve (read phase) | `Workflows/Preserve.md` |
| Multi-hour session continuity | Preserve | `Workflows/Preserve.md` |
| Cross-AI handoff needed | Preserve (fleet output) | `Workflows/Preserve.md` |

## Quick Reference

- **Trigger:** Automatic on PreCompact hook event
- **Output:** Markdown preamble at `MEMORY/STATE/precompact-{timestamp}.md`
- **Sections:** Active Threads, Pending Items, Context That Compresses Poorly, Artifacts, What The Summary Will Miss, Recovery Instructions
- **Fallback:** If inference fails, writes raw state dump with transcript path reference
- **Exit behavior:** Always exits clean (code 0) -- never blocks Claude Code

## Examples

**Long debugging session approaching context limit:**
- Hook fires, captures: the bug hypothesis being tested, which files were examined, what was ruled out, the user's frustration level, implicit agreement to try approach X next
- Post-compaction AI reads preamble, continues debugging without re-examining ruled-out paths

**Collaborative design session:**
- Hook fires, captures: design decisions made and their rationale, aesthetic preferences expressed, trade-offs discussed and resolved, which options were rejected and why
- Post-compaction AI maintains design direction without revisiting closed decisions

**Emotional or personal conversation:**
- Hook fires, captures: conversation tone, trust level, topics that are sensitive, things the user said that matter beyond their factual content
- Post-compaction AI maintains relational continuity, does not reset to formal/cautious defaults
