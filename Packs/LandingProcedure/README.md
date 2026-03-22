---
name: LandingProcedure
pack-id: northwoodssentinel-landingprocedure-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: A safe exit protocol for deep work and flow sessions. Captures state, saves open threads, and clears you to walk away without losing context.
type: skill
purpose-type:
  - session-management
  - flow-state
  - context-preservation
platform: claude-code
dependencies: []
keywords:
  - landing
  - flow
  - session-exit
  - deep-work
  - context-capture
  - hyperfocus
  - burnout-prevention
---

# LandingProcedure

> Stop working without losing the thread.

## The Problem

You're four hours into a deep AI session. The work is good. You should stop. But you can't — because stopping feels like losing. The context, the momentum, the half-formed ideas sitting in your working memory. What if you forget where you were? What if the next session can't pick it up?

So you push past exhaustion. You make mistakes. Your output degrades and you don't notice because the decline is gradual.

This isn't a discipline problem. It's a tooling problem. There's no "save game" button for deep work sessions.

**The incident that started this:** March 17, 2026. A 28-hour AI session, 1,372 turns. The behavioral drift detector went dark. Output quality degraded during high-stakes client documents — and nobody caught it until after delivery. The session didn't end because someone decided to stop. It ended because there was nothing left.

## The Solution

LandingProcedure gives your AI a structured exit checklist. When you signal that you're done — "stepping away," "I'm done," "landing," "taking a break" — the AI runs a five-part checklist:

1. **Fires** — Anything time-sensitive that can't wait?
2. **Open Threads** — What's paused, blocked, or done?
3. **Session State** — Insights worth saving, breadcrumbs captured
4. **Time-Sensitive** — Deadlines, commitments, things that expire
5. **Landing Confirmation** — Permission to stop. No re-engagement. Clean exit.

The output is compact. You're already leaving — this isn't a document to read, it's a preflight checklist in reverse.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Skill definition with triggers and routing |
| `src/Tools/LandingProcedure.hook.ts` | The landing checklist logic |
| `src/Workflows/Land.md` | Step-by-step landing workflow |
| `INSTALL.md` | Installation guide |
| `VERIFY.md` | Verification tests |

## What Makes This Different

Most session management tools focus on starting well. This one focuses on stopping well. It treats "ending a session" as a first-class operation — not an afterthought, not just closing a tab.

The checklist is deliberately minimal. When someone is post-flow, they're cognitively depleted. A wall of text doesn't help. A five-line summary does.

The protocol also has emotional intelligence built in:
- If you say "flat" or "discharged," it knows you're post-flow and goes minimal.
- It never says "one more thing" or "while you're here."
- The landing procedure exists to release, not to capture.

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "I'm stepping away" | Full landing checklist runs |
| "Landing" | Full landing checklist runs |
| "I'm done for today" | Full landing checklist runs |
| "Taking a break" | Full landing checklist runs |
| "I'm flat" | Minimal output — user is post-flow depleted |
| "Need to stop" | Full landing checklist runs |

## Example Usage

**You say:** "I think I'm done. Let me land."

**AI responds:**

```
LANDING CHECKLIST
=================
FIRES: None. Calendar clear next 2hrs.
OPEN: 3 threads paused, 2 done, 1 waiting on client reply.
SAVES: Session highlights captured. Two breadcrumbs logged.
DO BEFORE NEXT SESSION: Reply to vendor email. Review PR #47.

Clear to land.
```

## Configuration

The skill works out of the box with no configuration. The trigger phrases are built into the skill definition. To add custom trigger phrases, edit the `USE WHEN` section in `SKILL.md`.

Optional: If you use a handoff file location other than the default, update the save path in `Land.md`.

## Origin

Built by Rob Chuvala after a 28-hour AI session broke his output quality on client deliverables. The system that was supposed to detect behavioral drift was dark. The landing procedure ensures that "I need to stop" is a supported operation — not a failure mode.

Part of the PAI (Personal AI) infrastructure: tools built by someone who uses AI 8+ hours a day and learned the hard way what happens when you don't.

## Works Well With

- **SessionHealth** — Monitors session age and turn count, warns before degradation hits. If SessionHealth tells you it's time to stop, LandingProcedure helps you actually do it.
- Any drift detection or session monitoring tool.

## Changelog

### 1.0.0 (2026-03-22)
- Initial public release
- Five-part landing checklist (Fires, Open Threads, Session State, Time-Sensitive, Confirmation)
- Post-flow minimal mode for depleted users
- Compact output format optimized for cognitive fatigue
