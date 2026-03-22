---
name: SessionHealth
description: >
  Watchdog hook that monitors session age (hours) and turn count during AI work
  sessions. Injects graduated warnings into AI context when thresholds are exceeded
  to prevent context degradation from overlong sessions.
  USE WHEN this hook is installed — it fires automatically on every UserPromptSubmit.
  No manual invocation needed. The AI should respect warnings when they appear
  and advise the user to start a fresh session.
---

# SessionHealth

Automatic session health monitoring. Fires on every user prompt submission. No manual invocation required.

## Customization

**Warning thresholds** — Edit the constants at the top of `SessionHealthCheck.hook.ts`:

| Constant | Default | Purpose |
|----------|---------|---------|
| `AGE_WARN_HOURS` | 8 | Yellow warning threshold (hours) |
| `AGE_HARD_WARN_HOURS` | 12 | Red critical threshold (hours) |
| `TURN_WARN` | 500 | Yellow warning threshold (turns) |
| `TURN_HARD_WARN` | 800 | Red critical threshold (turns) |

**Session start file** — The hook reads `/tmp/pai-session-start.txt` for the session start timestamp (Unix ms). Your session-start hook or script must write this file.

**Turn counter file** — Stored at `/tmp/pai-session-turns.json`, keyed by session ID. Resets automatically when the session ID changes.

## Workflow Routing

| Event | Workflow | Notes |
|-------|----------|-------|
| UserPromptSubmit (healthy) | `Workflows/Monitor.md` | Silent — no output |
| UserPromptSubmit (warning threshold) | `Workflows/Monitor.md` | Yellow warning injected |
| UserPromptSubmit (critical threshold) | `Workflows/Monitor.md` | Red warning — AI should advise session close |

## Quick Reference

- Hook trigger: `UserPromptSubmit`
- Execution time: <20ms
- Blocking: yes (but fast enough to be invisible)
- Failure mode: silent — never blocks or crashes the session
- Output: `<system-reminder>` blocks injected into AI context
- Logging: status and errors to stderr

## Examples

**Healthy session (no output):**
```
[Hook fires silently. No warnings. Every 100 turns, a status line goes to stderr.]
```

**Warning at 8 hours:**
```
<system-reminder>
SESSION AGE WARNING: 8h 12m (warning at 8h, limit: 12h).
Consider wrapping up and starting a fresh session soon.
</system-reminder>
```

**Critical at 12 hours + 800 turns:**
```
<system-reminder>
SESSION AGE CRITICAL: 12h 34m (limit: 12h).
This session MUST be closed. Context degradation is occurring.
TURN COUNT CRITICAL: 823 turns (limit: 800).
High context load. Close this session and start fresh.
</system-reminder>
```
