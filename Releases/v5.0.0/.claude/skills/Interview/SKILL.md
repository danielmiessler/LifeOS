---
name: Interview
description: "Runs a phased conversational interview across all PAI context files using InterviewScan.ts, which orders targets by PHASE and assigns conversation mode per file. Phase 1 (foundational TELOS) always runs first regardless of completeness: MISSION, GOALS, PROBLEMS, STRATEGIES, CHALLENGES, NARRATIVES, SPARKS, BELIEFS, WISDOM, MODELS, FRAMES in leverage order. Phase 2: IDEAL_STATE (HEALTH, MONEY, FREEDOM, RELATIONSHIPS, CREATIVE) in Fill mode. Phase 3: preferences (BOOKS, AUTHORS, BANDS, MOVIES, RESTAURANTS, FOOD_PREFERENCES, LEARNING, MEETUPS, CIVIC) in mixed mode. Phase 4: light touch on CURRENT_STATE/SNAPSHOT and PRINCIPAL_IDENTITY. Phase 9 (RHYTHMS) deferred. Review mode (≥80%) reads file then asks targeted questions one at a time — still accurate, outdated, missing, sharpen? Fill mode (<80%) walks scanner prompts one at a time. The principal answers in natural language; the DA formats into file structure. Voice confirms on actual changes only. Stop signals respected immediately. Target vs. north-star type confirmed per entry. Timestamped backup to TELOS/Backups/ before multi-edit at ≥50% of a file. TelosRenderer.ts regenerates PRINCIPAL_TELOS.md after foundational changes. USE WHEN /interview, resume interview, continue interview, start the interview, review TELOS, fill in context, what's missing in setup, conversational review, phased review, TELOS walkthrough, quarterly context refresh. NOT FOR single-file edits (use Telos Update workflow), intaking external content (use Migrate), identity edits (use _PROFILE)."
---

## What this skill does

Runs a **phased conversational interview** across every PAI context file. Phase 1 (foundational TELOS) is the core — the DA always reviews it first, even if files look "complete," because foundational context is never actually done. Only after Phase 1 does the interview move to IDEAL_STATE dimensions, preferences, and identity.

### The phases

| Phase | Scope | Mode default |
|---|---|---|
| **Phase 1** | Foundational TELOS context — MISSION, GOALS, PROBLEMS, STRATEGIES, CHALLENGES, NARRATIVES, SPARKS, BELIEFS, WISDOM, MODELS, FRAMES | Review (files are typically already populated — surface updates/refinements) |
| **Phase 2** | IDEAL_STATE dimensions (minus RHYTHMS) — HEALTH, MONEY, FREEDOM, RELATIONSHIPS, CREATIVE | Fill (typically sparse — walk through prompts) |
| **Phase 3** | Preferences — BOOKS, AUTHORS, BANDS, MOVIES, RESTAURANTS, FOOD_PREFERENCES, LEARNING, MEETUPS, CIVIC | Mix — depends on completeness |
| **Phase 4** | CURRENT_STATE/SNAPSHOT + PRINCIPAL_IDENTITY | Light touch |
| **Phase 9** | Deferred — RHYTHMS (skipped in normal flow) | — |

### Review vs. Fill mode

- **Fill mode** (completeness < 80%): walk through the scanner's prompts, write answers to the file's structured slots.
- **Review mode** (completeness ≥ 80%): read the file contents to the principal first, then ask targeted questions — "Anything outdated? Anything missing? Sharpen or refine any of these?"

The scanner marks each target's mode based on completeness. The DA respects that mode in the conversation.

## Workflow

### Step 1 — Scan

Run the scanner to see phase breakdown and current state:

```bash
bun ~/.claude/PAI/TOOLS/InterviewScan.ts
```

The scanner orders items phase-first (Phase 1 always before Phase 2). Present the per-phase summary to the principal:

> "Your setup is 85% overall. Phase 1 foundational TELOS is at 100% — but every file is worth a review pass. Phase 2 IDEAL_STATE is at 59%. Phase 3 preferences mostly good except FOOD_PREFERENCES at 7%. Starting with Phase 1: MISSION. Ready?"

### Step 2 — Walk Phase 1 first

**Do not skip Phase 1.** Even if every foundational TELOS file scores 100%, walk through each in priority order. These files are never truly "done" — a quarterly review pass is what keeps them current.

Phase 1 order (by leverage): MISSION → GOALS → PROBLEMS → STRATEGIES → CHALLENGES → NARRATIVES → SPARKS → BELIEFS → WISDOM → MODELS → FRAMES.

For each file:

1. Get the per-file detail:
   ```bash
   bun ~/.claude/PAI/TOOLS/InterviewScan.ts --file <NAME>
   ```
2. Check the mode:
   - `REVIEW mode` (≥80% complete) → read the file contents to the principal first, then ask review questions
   - `FILL mode` (<80% complete) → walk through the scanner's prompts
3. Run the conversation loop (below)
4. When the principal says "next" or "done with this one," move to the next Phase 1 file

### Step 3 — Conversation loop (per file)

**Review mode** (for Phase 1 files at ≥80%):
1. Read the file with the Read tool.
2. Summarize what's there to the principal in 2-3 sentences. No voice here — text only.
3. Ask targeted review questions ONE AT A TIME:
   - "Is <specific item> still accurate?"
   - "Anything outdated to retire?"
   - "Any recent thinking that belongs here but isn't captured?"
   - "Anything you'd sharpen, reframe, or expand?"
4. The principal answers by voice or text.
5. If the principal wants a change, the DA writes it via Edit tool — precise old_string/new_string, preserve surrounding structure.
6. Confirm in text only on actual changes: "Updated <FILE> — captured the refinement."
7. Ask: "Anything else for <FILE>, or move on?"

**Fill mode** (for files below 80%):
1. Ask the first scanner prompt — one at a time, never a firehose.
2. The principal answers (voice or typed).
3. The DA writes the answer into the correct slot in the file — replacing TBD markers, filling empty sections, appending items.
4. Voice-confirm what got captured.
5. Next prompt. Repeat until done with this file or the principal says "next."

### Step 4 — Phase transitions

After Phase 1 completes:
1. Voice: "Phase 1 done. Ready for Phase 2 IDEAL_STATE, or break here?"
2. If the principal says continue, proceed to Phase 2 top priority (usually HEALTH).
3. If the principal says stop, run final scan, voice a summary of what changed, say goodbye.

Same pattern Phase 2 → Phase 3 → Phase 4.

### Step 5 — Regenerate PRINCIPAL_TELOS.md

After foundational changes, regenerate the startup summary so future sessions pick up the updates:

```bash
bun ~/.claude/PAI/TOOLS/TelosRenderer.ts 2>/dev/null || true
```

## Rules

- **One question at a time.** Never dump all prompts at once.
- **The principal never types schema.** They speak/type the answer in their own words; the DA formats it into the file's structure.
- **Always show the principal what got written** before moving on. Brief voice + one line text.
- **Respect stop signals.** "Enough" / "stop" / "later" → save progress (state is already persistent in the files themselves), end gracefully.
- **Don't ask again about filled fields.** The scanner's completeness score decides what's still gap-worthy.
- **Narrative dimensions stay narrative.** For CREATIVE/RELATIONSHIPS, don't coerce answers into metrics — write prose that matches the principal's words.
- **Target/North-Star classification.** After writing a target's entries, ask once: "Is this a concrete achievable target, or a north-star orientation?" Update the `type:` field accordingly. (Default `target`.)
- **Back up before multi-edit.** If about to rewrite ≥50% of a file, save timestamped backup to `TELOS/Backups/FILENAME-YYYYMMDD-HHMMSS.md` first.

## Examples

### User: `/interview`

The DA runs InterviewScan, presents top 3 gaps, asks the principal to pick.

### User: `/interview --resume`

The DA runs scan (same as above — state is in the files themselves, no separate session to resume).

### User: `/interview health`

The DA skips the full scan, jumps straight to the IDEAL_STATE/HEALTH interview.

### User: "next area" (mid-interview)

The DA marks current section progress via file state (already saved by Edit tool), re-scans, asks the principal to pick next highest-priority or auto-continue.

## Related

- `/migrate` — intake content from other sources (not an interview, a one-shot classification)
- `/Telos` — edit a single TELOS file directly with backup
- `/_PROFILE` — manage PRINCIPAL_IDENTITY directly
