# ContextCheckin — full constitutional-context peer conversation

**Purpose:** Open `/interview` by reading the freshness signal across every constitutional context file (TELOS plus the six other files that load at session start), surface the most-stale items as one of the most important things to look at, and drive a contextual peer conversation grounded in what's actually written. This is the default workflow on a populated system.

For fresh installs (DA name still "LifeOS", placeholder identity, sample-row PROJECTS), route to **Phase0Setup** instead.

> Renamed from `TelosCheckin.md` — the original file is now a one-line redirect stub that points here. The workflow generalized when freshness extended from TELOS-only to all constitutional files.

---

## Voice notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Reading constitutional context to drive the check-in."}' \
  > /dev/null 2>&1 &
```

---

## Step 1 — Read freshness BEFORE asking anything

Two readers. Both at the start. The constitutional context is on file; we ground every prompt in what's there, never in what we'd ask if we had no idea.

```bash
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts --json          # per-section TELOS
bun -e "import { readContextFreshness } from '$LIFEOS_DIR/TOOLS/TelosFreshness'; console.log(JSON.stringify(readContextFreshness(), null, 2))"
```

Or via Pulse (single round-trip):

```bash
curl -s http://localhost:31337/api/freshness | jq      # multi-file constitutional
curl -s http://localhost:31337/api/telos/freshness | jq # per-section TELOS
```

Parse and combine into a single sorted list of stale items — TELOS sections AND constitutional files share the same conceptual surface from the principal's view. Sort most-stale-first by days-over-threshold.

If `readContextFreshness()` reports a file with `why: "no frontmatter"`, the migration hasn't been run on that file. Stop and prompt: *"<file> doesn't have the freshness convention yet. Want me to run `bun $LIFEOS_DIR/TOOLS/MigrateContextFreshness.ts` first?"*

If `readContextFreshness()` reports a file with `why: "source missing"`, the file's `derived_from:` source doesn't have a freshness signal — the derivative can't inherit one. Surface this to the principal: *"<file> derives from <source> which has no freshness frontmatter. Want me to add it?"*

---

## Step 2 — Open with the most-stale item as the lead

Staleness is **one of the most important things to surface** — but it's a peer check-in, not scolding.

Pick the highest-priority stale item across both axes (constitutional files + TELOS sections). Read its actual content via `Read` before asking. For derived files (PRINCIPAL_TELOS, ARCHITECTURE_SUMMARY), Read the SOURCE file instead — that's where the review actually lands.

Opening shape (adapt to voice):

> "I read your context. **<File or section>** hasn't been touched in **{N}d** (threshold {T}d). It says: *'{first 80–120 chars}'*. Still right? Want to update it?"

If multiple stale items, surface the top 2-3 and let the principal pick:

> "Three things to look at: PROJECTS.md (47d/30d), system prompt (112d/90d), Goals (38d/30d). PROJECTS first?"

If everything is fresh:

> "All seven constitutional files within thresholds. Anything you want to revisit anyway, or pick a section to deepen?"

**Forbidden when context is populated:** generic prompts like "What's your mission?" or "Tell me about your goals." The files are on disk. Reference them.

---

## Step 3 — The contextual conversation loop

For each stale (or principal-selected) item:

### 3a. Read the file or section content

Always `Read` the file's actual content (or the source for derived files) before asking. **Asking without reading first is the failure mode this workflow exists to fix.**

For TELOS sections: pass the line range — start at `section.line + 2` (skip heading + marker), continue until the next `## ` heading.

For constitutional files: read the full file (most are <300 lines).

For derived files: read the SOURCE — `PRINCIPAL_TELOS` review goes to `TELOS.md`, `ARCHITECTURE_SUMMARY` review goes to `LifeosSystemArchitecture.md`. Update the source; the derivative regenerates.

### 3b. Pick the right register based on file/section type

**TELOS sections with typed-ID entries** (Goals → G0+, Problems → P0+, Mission → M0+, Beliefs → B0+, Models → MO0+, Frames → FR0+, Narratives → N0+, Challenges → C0+, Traumas → TR0+) — get **per-entry contextual prompts**:

> "**G3** says: *'{first sentence}'*. Where are we on this?"
> "**M0** is the north-star — *'{first sentence}'*. Still the right framing, or has it shifted?"

**TELOS sections without typed IDs** (Current State, Status, Sparks, Wisdom, preferences) — section-level prompts:

> "Current State says: *'{first three lines}'*. What's actually true today?"

**Constitutional files** — file-level review prompts targeted to the file's purpose:

- **DA_IDENTITY.md** — voice, personality, autonomy boundaries: *"You're 47d into the DA identity threshold. Still seeing peers, not commander/executor? Anything new about the working dynamic that should land here?"*
- **PRINCIPAL_IDENTITY.md** — name, role, focus, online presence: *"Identity hasn't been touched in {N}d. Quick Reference says you're at {role}. Still right?"*
- **PROJECTS.md** — project registry + routing aliases: *"PROJECTS at {N}d. Any new projects to add, or finished projects to retire? Routing aliases still match how you refer to things?"*
- **LIFEOS_SYSTEM_PROMPT.md** — constitutional rules: *"System prompt at {N}d. Want to review the operational rules section, or is anything constitutional pending?"* (for this file especially, default to surfacing rather than editing — this is the most load-bearing file in the system).
- **PRINCIPAL_TELOS.md / ARCHITECTURE_SUMMARY.md** (auto-generated) — never edit directly. Route to the source file: *"PRINCIPAL_TELOS derives from TELOS.md — going there. TELOS.md last touched {N}d ago."*

### 3c. Listen, then write

The principal answers in natural language. The DA formats the answer into the file's structure:

- For typed-ID entries: preserve the ID, edit the entry text, never re-number.
- For prose sections / files: edit in place, preserve heading + marker line + frontmatter.
- For new entries: append at the next sequential ID.
- For deletions: leave a tombstone (`- [ ] G3: [DROPPED — see Decisions YYYY-MM-DD]`).
- For constitutional files: surgical edits only; backup first if rewriting ≥50% of any section.

Use the `Edit` tool with precise `old_string`/`new_string`.

### 3d. Bump the review marker on every approved edit

`last_reviewed:` is the freshness clock — explicitly distinct from `last_updated:`,
which migrations and auto-generators also bump. The statusline FRESH line and the
A-F grade in `/api/freshness/summary` are computed from `last_reviewed:`. Only this
workflow (and equivalent principal-driven review flows) should call it.

```bash
# TELOS section — section-level marker
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts --bump <slug>

# Constitutional file — review marker (NOT bumpContextTimestamp; that's for writes)
bun -e "import { bumpReviewedTimestamp } from '$LIFEOS_DIR/TOOLS/TelosFreshness'; console.log(bumpReviewedTimestamp('<absolute-path>', 'user'))"
```

Without this, files stay at grade F forever because no other path sets `last_reviewed:`.

### 3e. Voice-confirm the change (only on actual writes)

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Updated <FILE-OR-SECTION> — captured the change.", "voice_enabled": true}' \
  > /dev/null 2>&1 &
```

### 3f. Move on, respect stop signals

> "Anything else for {file/section}, or move to {next stale item}?"

The principal can say "next", "skip", "enough", "stop", "later" at any prompt. Honor it immediately. State persists in the files themselves; there's no separate session to save.

---

## Step 4 — Wrap with a freshness summary

When the principal says enough:

```bash
bun $LIFEOS_DIR/TOOLS/TelosFreshness.ts        # final TELOS state
bun $LIFEOS_DIR/TOOLS/ContextAudit.ts          # content quality findings (read-only)
```

Voice-summarize:

> "Reviewed {N} items, edited {M}. {K} things still stale — top one is {name} at {age}d. {audit findings count} content-quality findings in AUDIT.md. Pick that one up next time, or call it done."

Regenerate the auto-derived files so future sessions pick up source changes:

```bash
bun $LIFEOS_DIR/TOOLS/GenerateTelosSummary.ts 2>/dev/null || true
bun $LIFEOS_DIR/TOOLS/ArchitectureSummaryGenerator.ts generate 2>/dev/null || true
```

Send a Pulse `/reload` so the freshness cache invalidates:

```bash
curl -s -X POST http://localhost:31337/reload > /dev/null 2>&1 &
```

---

## Rules

- **Read context before asking. No exceptions.** Generic "what's your mission?" / "describe your projects" prompts are forbidden when files are populated.
- **Per-entry on typed-ID TELOS sections, file-level on constitutional files, source-targeted on derived files.**
- **Staleness is information, not failure.** A 95-day-old file might still be right. The prompt is "still right?", not "you're behind."
- **One question at a time.** Never dump three prompts in one turn.
- **Bump on every approved edit.** Use `bumpTelosTimestamp` for TELOS sections and `bumpReviewedTimestamp` for constitutional files — they update the per-section marker and the `last_reviewed:` field that drives the A-F grade. `bumpContextTimestamp` is for file writes (auto-generators, migrations) and does NOT count as review.
- **Stop signals are sacred.** "Enough" / "stop" / "later" exits gracefully. State is the file.
- **ID-stability rule.** G3 stays G3 even when edited or dropped. New entries get the next sequential ID.
- **Constitutional files: surgical edits only.** Never rewrite identity, system prompt, or projects unilaterally — surface findings via ContextAudit, edit only with explicit per-edit approval.
- **Auto-generated files are never edited directly.** Route every review of PRINCIPAL_TELOS to TELOS.md; route ARCHITECTURE_SUMMARY review to LifeosSystemArchitecture.md.

---

## Examples

### Opening on a system with stale system prompt

```
read freshness ⇒ pai_system_prompt 112d/90d (most stale across both surfaces)
Read LIFEOS/LIFEOS_SYSTEM_PROMPT.md fully
```

> "I read your context. **LIFEOS_SYSTEM_PROMPT** hasn't been touched in **112d** (threshold 90d). The Hard Prohibitions section says: *'Never self-rate responses or add unsolicited ratings. Never modify working features unprompted. Analysis means read-only…'* Still want all three of those, or has anything changed in how you want me to operate?"

### Opening when everything is fresh except an audit finding

```
read freshness ⇒ all 7 fresh
read AUDIT.md ⇒ critical: PROJECTS.md at 82 lines exceeds declared 45-line budget
```

> "Everything within freshness thresholds. One audit finding: PROJECTS.md is 82 lines, which is 82% over its declared 45-line budget. Want to trim, raise the budget, or split active state into a load-on-demand file?"

### Per-entry conversation on Goals

```
G3 stale (38d/30d)
Read TELOS.md lines 252-296
```

> "**G3** says: *'Get the newsletter to 50K subscribers by EOY.'* Where are we?"

Principal: "27K right now, growing about 1.2K/month. On track but tight."

```
Edit G3 with current-state context
bun TelosFreshness.ts --bump goals
voice-confirm
```

> "Updated G3 with the 27K state. **G7** is *'Ship Fabric v2.'* — that one moved at all, or still in design?"

---

## Failure modes

- **Migration not run yet.** First call to `readContextFreshness()` returns one or more files with `why: "no frontmatter"`. Run `bun $LIFEOS_DIR/TOOLS/MigrateContextFreshness.ts` once before continuing.
- **Pulse not running.** Voice notifications fail silently; HTTP routes return connection errors. Conversation continues using the lib directly.
- **Source missing for a derived file.** `architecture_summary` may show `why: "source missing"` if `LifeosSystemArchitecture.md` has no `last_updated` frontmatter. Surface to the principal; offer to add it.
- **Slug not found by bumpTelosTimestamp.** Returns `sectionFound: false`. Re-check `sectionSlug(headingText)`.
- **Principal goes silent mid-section.** Treat the same as "stop" — wrap with the freshness summary and exit.
