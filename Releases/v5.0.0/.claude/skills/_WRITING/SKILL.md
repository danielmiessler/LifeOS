---
name: _WRITING
description: "Two-mode AI writing pattern tool that uses AI_WRITING_PATTERNS.md as its rule source. rewrite mode: strips AI-isms from a given text (P0 credibility killers removed silently, P1/P2 surfaced as candidates with brief reason). detect mode: audits text and returns a scored list of pattern hits (P-level, pattern, excerpt, suggested fix). Invoke as: /writing rewrite <text or @file> or /writing detect <text or @file>. User-instantiated skill — extend with patterns from your own AI_WRITING_PATTERNS.md P2 section. USE WHEN: polish text for AI tells, rewrite AI-generated prose, detect AI writing patterns, scrub AI-isms, check writing for AI smell, writing audit, writing cleanup."
---

# _WRITING — AI Writing Pattern Cleaner

Reads `~/.claude/PAI/USER/AI_WRITING_PATTERNS.md` as its rule source and operates in two modes.

## Modes

### `rewrite` — strip AI patterns from text

**Input**: raw text (inline or via `@file`)

**Workflow**:
1. Load patterns from `AI_WRITING_PATTERNS.md` (P0, P1, P2 sections).
2. Apply P0 (credibility killers) silently — remove without comment.
3. For P1/P2 hits, propose the rewrite and state the pattern triggered.
4. Output the cleaned text followed by a brief change log.

**Output format**:
```
[Rewritten text]

---
Changes made:
- Removed "Let me know if..." (P0)
- Replaced "Here's the thing..." → "[rewritten phrase]" (P1)
```

### `detect` — audit text for AI tells

**Input**: raw text (inline or via `@file`)

**Workflow**:
1. Load patterns from `AI_WRITING_PATTERNS.md`.
2. Scan the text for each pattern by P-level.
3. Return a scored hit list.

**Output format**:
```
Pattern audit — 3 hits

P0  "Let me know if you need anything else."  → Remove entirely
P1  "Here's the thing:"                       → Cut or recast
P2  [user-defined pattern]                    → [user-defined guidance]

Overall AI-smell score: HIGH / MEDIUM / LOW / CLEAN
```

## Usage

```
/writing rewrite <text>
/writing rewrite @path/to/file.md
/writing detect <text>
/writing detect @path/to/file.md
```

## Customization

Add your own patterns to the **P2 section** of `~/.claude/PAI/USER/AI_WRITING_PATTERNS.md`. This skill reads that file on every invocation, so changes take effect immediately without restarting.

The `_` prefix means this skill is user-instantiated — it ships as a starting point. Extend the P2 section with patterns specific to your voice and writing style.
