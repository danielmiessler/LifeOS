---
name: SessionHealth
pack-id: northwoodssentinel-sessionhealth-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: A watchdog hook that monitors session age and turn count, warning at graduated thresholds to prevent context degradation from overlong AI sessions.
type: skill
purpose-type:
  - session-management
  - quality-assurance
  - burnout-prevention
platform: claude-code
dependencies: []
keywords:
  - session-health
  - context-degradation
  - turn-count
  - watchdog
  - deep-work
  - hyperfocus
  - session-age
---

# SessionHealth

> Your AI session doesn't know it's dying. This hook does.

## The Problem

AI session context degrades over time. After 8+ hours and hundreds of turns, the AI starts hedging more, losing thread coherence, and producing lower-quality output. But you don't notice because the degradation is gradual. The AI doesn't tell you it's struggling — it just gets quietly worse.

By the time you realize something's off, you've already shipped subpar work.

**The incident:** March 17, 2026. A 28-hour session, 1,372 turns. No warnings fired. The behavioral drift detector was dark. High-stakes client documents were produced during the degraded tail of the session. The quality gap wasn't caught until after delivery.

The session didn't fail dramatically. It failed slowly, invisibly, over hours.

## The Solution

SessionHealth is a watchdog hook that fires on every user prompt. It tracks two metrics:

- **Session age** (hours since session start)
- **Turn count** (number of user prompts in this session)

At graduated thresholds, it injects warnings into the AI's context:

| Metric | Warning | Critical |
|--------|---------|----------|
| Session age | 8 hours | 12 hours |
| Turn count | 500 turns | 800 turns |

**Warning (yellow):** "Consider wrapping up and starting a fresh session soon."

**Critical (red):** "This session MUST be closed. Context degradation is occurring."

The hook is non-blocking, fast (<20ms), and never fails the session. It reads two files and writes one. That's it.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Skill definition with monitoring behavior |
| `src/Tools/SessionHealthCheck.hook.ts` | The watchdog hook (fires on UserPromptSubmit) |
| `src/Workflows/Monitor.md` | How the monitoring system works |
| `INSTALL.md` | Installation guide |
| `VERIFY.md` | Verification tests |

## What Makes This Different

Most AI tools optimize for the beginning of a session — better prompts, better context loading, better warm-up. Nobody optimizes for the end, when the session is old and the context is fraying.

SessionHealth treats session age as a first-class quality signal. It doesn't try to fix degradation — it tells you to stop before it matters.

Key design decisions:
- **Non-blocking:** Never slows down your work. The hook runs in under 20ms.
- **Graduated warnings:** Gentle at 8 hours, urgent at 12. Not a single cliff edge.
- **Dual metrics:** Time alone isn't enough. A 10-hour session with 50 turns is different from one with 800 turns. Both matter.
- **Fail-safe:** All errors are caught and logged. The hook never crashes your session.

## Invocation Scenarios

| Scenario | What Happens |
|----------|--------------|
| Session under 8hrs, under 500 turns | Nothing. Silent. No output. |
| Session hits 8hrs or 500 turns | Yellow warning injected into AI context |
| Session hits 12hrs or 800 turns | Red critical warning — AI told to advise closing session |
| Every 100 turns (healthy session) | Status logged to stderr only (not visible to AI) |
| Hook encounters an error | Error logged to stderr, session unaffected |

## Example Usage

You won't "use" this pack directly. Once installed, the hook fires automatically on every prompt. You'll see its effect when warnings appear:

**At 8 hours:**
```
[Yellow] SESSION AGE WARNING: 8h 12m (warning at 8h, limit: 12h).
Consider wrapping up and starting a fresh session soon.
```

**At 12 hours:**
```
[Red] SESSION AGE CRITICAL: 12h 34m (limit: 12h).
This session MUST be closed. Context degradation is occurring.
```

**At 500 turns:**
```
[Yellow] TURN COUNT WARNING: 500 turns (warning at 500, limit: 800).
Context load is building. Consider a fresh session for complex work.
```

## Configuration

Thresholds are defined as constants at the top of `SessionHealthCheck.hook.ts`:

```typescript
const AGE_WARN_HOURS = 8;       // Yellow warning
const AGE_HARD_WARN_HOURS = 12; // Red critical
const TURN_WARN = 500;          // Yellow warning
const TURN_HARD_WARN = 800;     // Red critical
```

Edit these values to match your work patterns. If you regularly do productive 10-hour sessions, raise the age threshold. If your sessions degrade after 4 hours, lower it.

**File paths** (also configurable):
```typescript
const SESSION_START_FILE = '/tmp/pai-session-start.txt';
const TURN_COUNTER_FILE = '/tmp/pai-session-turns.json';
```

## Origin

Built by Rob Chuvala after the March 17, 2026 incident — a 28-hour, 1,372-turn session where context degradation went undetected during high-stakes document work. The system that should have caught it (DriftMon) was dark. SessionHealth ensures there's always a baseline watchdog running, even when other monitoring fails.

Part of the PAI (Personal AI) infrastructure: tools built by someone who uses AI 8+ hours a day and knows what invisible degradation looks like.

## Works Well With

- **LandingProcedure** — When SessionHealth tells you to stop, LandingProcedure helps you actually do it cleanly. They're companion tools: one says "it's time," the other says "here's how."
- Any session start hook that writes a timestamp to `/tmp/pai-session-start.txt`.

## Changelog

### 1.0.0 (2026-03-22)
- Initial public release
- Dual-metric monitoring (session age + turn count)
- Graduated warning thresholds (yellow at 8h/500t, red at 12h/800t)
- Non-blocking execution (<20ms)
- Fail-safe error handling
