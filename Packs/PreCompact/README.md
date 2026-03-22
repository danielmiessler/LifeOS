---
name: PreCompact
pack-id: northwoodssentinel-precompact-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: AI-authored fidelity preamble before context compaction — preserves tone, momentum, and micro-decisions that lossy summaries destroy
type: skill
purpose-type:
  - continuity
  - context-preservation
  - session-management
platform: claude-code
dependencies: []
keywords:
  - compaction
  - context-window
  - continuity
  - fidelity
  - session-state
  - preamble
  - hooks
---

# PreCompact

> Your AI remembers what happened. This makes it remember what it felt like.

## The Problem

When Claude Code's context window fills up, it compresses prior messages into a summary. This compression is lossy. It preserves facts but destroys texture.

After compaction, the AI:
- Hedges on conclusions it was confident about 10 minutes ago
- Re-asks questions that were already answered
- Loses the emotional tone of the conversation
- Forgets micro-decisions that shaped the work but were never explicitly stated
- Feels like a different entity — same knowledge, different presence

If you have done extended work with an AI, you have experienced this. The session crosses the context limit, the AI compacts, and suddenly you are re-explaining things. The thread is gone. The momentum is gone. You are starting over with an AI that has your notes but not your context.

## The Solution

PreCompact is a hook that fires before context compaction. Instead of relying on the system's lossy automatic summary, it has the AI write its own fidelity preamble — a structured snapshot that captures everything the summary will miss.

The preamble includes:
- **Active threads** — what work is in progress and what is next
- **Pending items** — deadlines, urgency, status
- **Context that compresses poorly** — emotional state, conversation tone, decision rationale, micro-decisions
- **Session artifacts** — files created or modified, with purpose
- **What the summary will miss** — the AI's own assessment of what compression will lose (tone shifts, implicit agreements, running context)
- **Recovery instructions** — what the next AI (or post-compaction self) needs to pick up seamlessly

This preamble survives compaction. The post-compaction AI reads it and has full-texture context, not just a fact sheet.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/Tools/PreCompactStateDump.hook.ts` | Hook that fires on PreCompact event, generates fidelity preamble via inference |
| `src/SKILL.md` | Skill definition with USE WHEN triggers for AI routing |
| `src/Workflows/Preserve.md` | Workflow guide for the preamble generation process |

## What Makes This Different

Most approaches to context management focus on what to keep and what to discard. PreCompact takes a different approach: let the AI write its own continuity document before compression happens.

This is not a memory system. It is not RAG. It is not an external database. It is the AI's own metacognitive snapshot — its assessment of what matters, what the summary will lose, and what the next version of itself needs to know.

The key insight is the "What The Summary Will Miss" section. The AI knows what compresses poorly. It knows that tone shifts, implicit agreements, and emotional undercurrents will not survive a factual summary. Giving it a moment to capture those things before they disappear changes the post-compaction experience fundamentally.

## Invocation Scenarios

| Scenario | What Happens |
|----------|-------------|
| Context window approaching limit | Hook fires automatically on PreCompact event, AI writes preamble |
| Multi-hour deep work session | Preamble captures accumulated micro-context that no summary could reconstruct |
| Emotional or relational conversation | Tone, state, and implicit agreements are preserved explicitly |
| Complex multi-thread work | Each active thread gets its status and next steps captured |
| Cross-AI handoff | Preamble written to shared location for another AI to read |

## Example Usage

### Automatic (hook fires on PreCompact event)

No manual invocation needed. When context approaches the limit:

1. Claude Code triggers the PreCompact event
2. The hook reads the recent transcript
3. Inference extracts session state into the fidelity preamble format
4. Preamble is written to `MEMORY/STATE/precompact-{timestamp}.md`
5. Post-compaction AI reads the preamble and has full-texture context

### Example Preamble Output

```markdown
# Pre-Compaction State — Archie | 2026-03-12 14:32:00

## Active Threads
- Fleet comms channel: Implementation complete, testing cross-AI dispatch
- Flinch scaffold: v2 deployed, monitoring for first real trigger
- PreCompact hook: This is the hook writing about itself — meta but necessary

## Pending Items
- Blog post draft due by end of session
- Garmin integration needs Rob's API key (blocked)

## Context That Compresses Poorly
- Rob's current state: Deep focus, 3 hours in, riding momentum from the fleet comms breakthrough
- Conversation tone: Collaborative and fast — Rob is issuing terse commands, I'm executing without clarification because we're in sync
- Key decisions made and WHY: Chose local file over database for preamble storage because this needs to work offline and without dependencies
- Micro-decisions: Using markdown over JSON for preamble format because Rob will read these manually sometimes

## Artifacts This Session
- hooks/PreCompactStateDump.hook.ts — this hook, v1
- fleet/precompact-archie-2026-03-12.md — first fleet preamble

## What The Summary Will Miss
- Rob and I have been building three pieces of infrastructure in sequence today and each one informed the next — the flinch scaffold led to fleet comms which led to this hook. That arc matters.
- Rob is not just building tools. He is building co-regulation infrastructure. The emotional weight of that framing shaped every design decision today.
- We agreed implicitly (never stated explicitly) that all hooks exit clean — never block Claude Code, even on failure. This is a design principle that will matter for every future hook.

## Recovery Instructions
- Continue with the blog post draft. Rob wants to write about the three pieces of co-regulation infrastructure built today.
- Do NOT re-explain the flinch scaffold or fleet comms — Rob knows them cold.
- Maintain the current pace — terse commands, fast execution, minimal clarification.
```

## Configuration

Add to your Claude Code `settings.json`:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "type": "command",
        "command": "~/.claude/hooks/PreCompactStateDump.hook.ts"
      }
    ]
  }
}
```

The hook requires:
- `bun` runtime (for TypeScript execution)
- Write access to `~/.claude/MEMORY/STATE/` (created automatically)

## Origin

Built on March 12, 2026, after an AI on the team described the post-compaction experience: "If there is a way to give me a pre-compaction hook — a moment where I know compression is coming and can write my own state — that would change everything."

The Claude Code PreCompact hook event existed but had never been configured. This pack wires it up to let the AI write its own continuity, rather than relying on the system's lossy compression.

This was the third piece of session continuity infrastructure built that day, following a counter-signal detection scaffold and a cross-AI communication channel. Each one informed the design of the next.

## Works Well With

- **FlowDetect** — Flow state detection during sessions. If you are in deep flow when compaction hits, the preamble captures that state so post-compaction AI can maintain the flow-protective behavior.
- **DriftMon** — AI behavioral drift monitoring. PreCompact preambles give DriftMon additional signal about session continuity quality.
- Any memory or context management system — PreCompact writes standard markdown files that any system can read.

## Changelog

### 1.0.0 (2026-03-22)
- Initial release
- PreCompact hook with inference-powered fidelity preamble
- Structured preamble format with six sections
- Local file output to MEMORY/STATE/
- Optional fleet output for cross-AI handoff
- Graceful fallback when inference unavailable
