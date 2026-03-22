---
name: LandingProcedure
description: >
  Safe exit protocol for deep work and flow sessions. Runs a structured checklist
  that captures session state, flags time-sensitive items, and clears the user to
  stop without anxiety about losing context.
  USE WHEN the user says "stepping away", "landing", "I'm done", "shutting down",
  "taking a break", "need to stop", "that's enough", "I'm flat", "I'm done for today",
  or any language signaling session exit.
---

# LandingProcedure

A safe exit protocol. When the user signals they want to stop, run the landing checklist before they leave.

## Customization

**Trigger phrases** — Add or remove exit signals in the `USE WHEN` list above to match your language.

**Checklist sections** — The five sections (Fires, Open Threads, Session State, Time-Sensitive, Landing Confirmation) can be customized in `Workflows/Land.md`. Remove sections that don't apply to your workflow, or add new ones.

**Post-flow mode** — If the user says "flat" or "discharged," switch to minimal output. They're cognitively depleted. Don't make them read.

## Workflow Routing

| Signal | Workflow | Notes |
|--------|----------|-------|
| Exit language detected | `Workflows/Land.md` | Full five-part checklist |
| "flat" or "discharged" | `Workflows/Land.md` (minimal mode) | Abbreviated output only |

## Quick Reference

- Fires: meetings, deadlines, unsent messages
- Open Threads: paused / blocked / done status for each
- Session State: save highlights, log breadcrumbs
- Time-Sensitive: things that expire before next session
- Landing Confirmation: permission to stop, no re-engagement

## Examples

**Standard landing:**
```
User: "I think I'm done. Let me land."
AI: [runs full checklist, presents compact summary, ends with "Clear to land."]
```

**Post-flow landing:**
```
User: "I'm flat."
AI: [minimal output — no checklist detail, just confirmation]
    "Session saved. Nothing urgent. Clear to land."
```

**Mid-work landing with open items:**
```
User: "Need to step away for a few hours."
AI: [runs checklist, flags time-sensitive items]
    "FIRES: Vendor reply due by 3pm.
     OPEN: 2 threads paused, PR review pending.
     Clear to land. Handle vendor reply before next session."
```
