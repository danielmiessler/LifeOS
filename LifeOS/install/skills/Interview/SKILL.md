---
name: Interview
version: 1.1.7
description: "Reads seven constitutional files (TELOS, DA_IDENTITY, PRINCIPAL_IDENTITY, PROJECTS, system prompt, PRINCIPAL_TELOS, ARCHITECTURE_SUMMARY) via TelosFreshness, surfaces stalest items, drives contextual peer conversation. Routes to ContextCheckin; falls back to Phase0Setup on fresh install. ContextAudit surfaces TBD markers. USE WHEN /interview, resume interview, context check-in, telos check-in, what's stale, freshness check, fresh LifeOS install, configure DA name, review TELOS, quarterly context refresh. NOT FOR single edits (Telos), bulk intake (Migrate), identity-only (_PROFILE)."
disable-model-invocation: true
---

# Interview — constitutional-context peer conversation

## What It Does

Interview reads your constitutional files — TELOS, identity, projects, system prompt, architecture — checks their freshness, surfaces the stalest items, and drives a contextual peer conversation to refresh them. On a populated system it runs a context check-in; on a fresh install it falls back to first-time setup.

## The Problem

The files that define who you are and what you're working toward drift out of date the moment you stop looking at them. A goal you set in January may be done, dead, or still right — but nobody re-reads the whole TELOS to find out, so the context the system runs on slowly rots. The usual fix is a blank "what's your mission?" prompt, which ignores everything already on file and makes you repeat yourself. This skill reads what's there first, flags only what's gone stale, and asks "still right?" instead of starting from zero.

## How It Works

The skill reads the constitutional files via the freshness tooling, scores each section's staleness, and routes to the right workflow — a check-in on a populated system, or first-time setup on a fresh one. Staleness is a priority signal, not a failure flag.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **ContextCheckin** | default `/interview` on a populated system; "context check-in", "telos check-in", "what's stale", "how are we doing on…", "still on…", "review context" | `Workflows/ContextCheckin.md` |
| **Phase0Setup** | fresh install; DA name still reads "LifeOS"; PRINCIPAL_IDENTITY still reads "User"; PROJECTS sample-row only; `.env` missing required keys | `Workflows/Phase0Setup.md` |
| **TelosCheckin** *(deprecated stub)* | back-compat for explicit "telos checkin" routing | `Workflows/TelosCheckin.md` (redirects to ContextCheckin) |

**Routing decision (run before either workflow):**

```bash
bun $LIFEOS_DIR/TOOLS/InterviewScan.ts --json | jq '[.targets[] | select(.phase == 0 and .completeness_score < 80)] | length'
```

- `> 0` → run **Phase0Setup** first, then ContextCheckin.
- `0` → run **ContextCheckin** directly.

## Quick Reference

- The TELOS is on file. **Read it before asking.** Generic "what's your mission?" prompts are forbidden when TELOS is populated.
- Staleness is **information, not failure** — a 95-day-old Goals section might still be right; the prompt is "still right?", not "you're behind."
- **Per-entry on typed-ID sections** (G3, M0, P2…), **section-level on prose** (Current State, Sparks).
- **Bump on every approved edit:** `bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts --bump <slug>`. Without this the staleness signal degrades to noise.
- **Stop signals are sacred.** "Enough" / "stop" / "later" exits gracefully. State persists in the file itself.
- **ID-stability rule:** G3 stays G3 even when edited or dropped; new entries get the next sequential ID.

## Gotchas

- **Migration must run once before TelosCheckin works.** A TELOS without YAML frontmatter (no `last_updated:`) returns `fileUpdated: null` and every section reads as stale. Run `bun $LIFEOS_DIR/TOOLS/MigrateTelosFreshness.ts` once; idempotent and content-preserving (verifies sha256 of stripped content).
- **The slug is normalized:** "Current State" → `current_state`, "Wrong (Things I've been wrong about)" → `wrong`, "2036 — A Day in the Life…" → `2036`. Always run heading text through `sectionSlug()` from `TelosFreshness.ts`.
- **Pulse caches freshness for 60s.** After bumping, the next `/api/telos/freshness/summary` call returns the cached value until invalidation. Send `/reload` (POST) to invalidate the cache immediately, or wait 60s.
- **TelosRenderer (`GenerateTelosSummary.ts`) preserves the markers.** It splits by `^## ` headings; the per-section HTML comments live inside the section body and are not re-emitted in `PRINCIPAL_TELOS.md`. Safe to run after edits.
- **The scanner shares the freshness reader.** `InterviewScan.ts` calls `readTelosFreshness()` once at startup and adds `age_days`, `threshold_days`, `stale` to every Phase 1+ target row. Stale sections get a +200 priority bump so they naturally rise in `--next` output.
- **Voice notifications are "only on actual writes."** Don't voice-confirm every prompt — only after a real Edit lands. The voice channel is a low-frequency signal; preserving that is what makes it land when it matters.

## Examples

- "/interview" on a populated system → routing probe via `InterviewScan.ts`, then ContextCheckin walking the stalest sections first ("G2 is 95 days old — still right?").
- "what's stale?" → freshness summary from TelosFreshness, prioritized list, no edits unless approved.
- Fresh install (DA name still "LifeOS", PROJECTS sample-row only) → Phase0Setup first, then ContextCheckin.

## Related

- `/Telos` — edit a single TELOS section directly (without the conversational walk).
- `/Migrate` — intake content from other sources (one-shot classification, not an interview).
- `/_PROFILE` — manage PRINCIPAL_IDENTITY directly.
- `Skill("ISA")` — interview an ISA (different artifact, different workflow).
