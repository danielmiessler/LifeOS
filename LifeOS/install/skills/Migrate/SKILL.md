---
name: Migrate
version: 1.0.10
description: "Intakes external content, classifies chunks against LifeOS taxonomy, commits with provenance. Sources: .md/.txt, stdin, LifeOS dirs, CLAUDE.md/Cursor/OpenAI Custom Instructions, Obsidian/Notion/Apple Notes exports. MigrateScan classifies → routing table. MigrateApprove with --approve-all/--approve-target/--review/--dry-run. Confidence ≥70% auto, 40-70% confirm, <40% walk-through. USE WHEN /migrate, migrate content, import from other LifeOS, bring in old notes, import Cursor rules, import CLAUDE.md, bulk import, Obsidian/Notion/Apple Notes import. NOT FOR single-file edits, conversational interviews, identity edits."
disable-model-invocation: true
---

# Migrate — external-content intake and classification

## 🚨 MANDATORY: Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Starting the migration. Scanning source and classifying chunks."}' \
  > /dev/null 2>&1 &
```

## What It Does

Migrate intakes external content, classifies each chunk against the LifeOS taxonomy, and commits it to the right destination with provenance. Sources include `.md`/`.txt` files, stdin, other LifeOS installs, agent-harness rule files (CLAUDE.md, Cursor rules, OpenAI Custom Instructions), and Obsidian/Notion/Apple Notes exports. Classification confidence drives the flow: high-confidence chunks auto-approve, medium ones ask for confirmation, low ones get a walk-through.

## The Problem

When you adopt LifeOS you usually arrive with years of accumulated notes — a CLAUDE.md, a vault of markdown, journal dumps, rules from another tool — and none of it maps cleanly onto LifeOS's structure. Sorting hundreds of chunks into TELOS sections, knowledge notes, and operational rules by hand is the kind of tedious work that never gets done, so the old material just sits there unused. Migrate does the sorting: it reads the content you already have, proposes a destination for every chunk with a confidence score, and lets you approve in bulk or review the uncertain ones, attaching provenance so nothing lands in TELOS without attribution.

## How It Works

Migrates content into the LifeOS structure from external sources. Unlike `/interview` (which asks the user questions to fill gaps), `/migrate` **already has the content** — it just needs to classify each chunk and route it to the right LifeOS destination. MigrateScan classifies into a routing table; MigrateApprove commits per the user's chosen path.

### Sources supported in V1

- **Files:** `.md`, `.markdown`, `.txt` (single file or directory recursion)
- **Stdin:** piped content or pasted directly
- **Other LifeOS installs:** point at their `USER/TELOS/` or `MEMORY/KNOWLEDGE/` directories
- **Agent-harness rule files:** `CLAUDE.md`, `.cursorrules`, OpenAI Custom Instructions export
- **Exports:** Obsidian vaults (markdown), Notion exports (markdown), Apple Notes exports (.txt), raw journal dumps

### What it classifies chunks into

| Category | Destinations |
|---|---|
| **Foundational TELOS** | MISSION, GOALS, PROBLEMS, STRATEGIES, CHALLENGES, BELIEFS, WISDOM, MODELS, FRAMES, NARRATIVES, SPARKS |
| **IDEAL_STATE dimensions** | HEALTH, MONEY, FREEDOM, RELATIONSHIPS, CREATIVE, RHYTHMS |
| **Preference files** | BOOKS, AUTHORS, MOVIES, BANDS, RESTAURANTS, FOOD_PREFERENCES, LEARNING, MEETUPS, CIVIC |
| **Identity** | USER/PRINCIPAL/PRINCIPAL_IDENTITY.md |
| **Knowledge** | MEMORY/KNOWLEDGE/{Ideas,People,Companies,Research} |
| **AI collaboration rules** | Walk-through to a constitutional surface — CLAUDE.md operational rules, a hook, `settings.json`, or the relevant skill's Gotchas ("always do X" / "never Y" patterns are system patches, never harness `memory/feedback_*.md` memos) |
| **Unclear** | Flagged for the user's manual routing |

## Workflow Routing

No `Workflows/` directory — the single migration procedure runs inline through Phases 1–6 below, backed by two tools in `LIFEOS/TOOLS/`.

| Trigger | Workflow | File |
|---------|----------|------|
| /migrate, migrate content, bulk import, import from other LifeOS, import CLAUDE.md / Cursor rules / Obsidian / Notion / Apple Notes export, bring in old notes | Inline Phases 1–6 (identify → scan → route → approve → UNCLEAR → summary) | `LIFEOS/TOOLS/MigrateScan.ts` + `LIFEOS/TOOLS/MigrateApprove.ts` |

## Workflow

### Phase 1 — Identify the source

Ask the user what he wants to migrate:

- "Paste the content here and I'll work from stdin"
- "Point me at a file path"
- "Point me at a directory and I'll scan everything inside"
- "I have a Cursor rules file at ~/Projects/X/.cursorrules"
- "My old LifeOS install has TELOS at ~/old-claude/TELOS/"

Collect the source path. If content is pasted, write it to a temp file first.

### Phase 2 — Scan

Run the scanner:

```bash
bun $LIFEOS_DIR/TOOLS/MigrateScan.ts --source <path>
# or
echo "$CONTENT" | bun $LIFEOS_DIR/TOOLS/MigrateScan.ts --stdin
```

Scanner output includes:
- Total chunks found
- Proposed routing table (how many chunks per target)
- Average classification confidence
- Count of UNCLEAR chunks
- Count of low-confidence (<40%) chunks

### Phase 3 — Present routing summary

Show the user the routing proposal in a scannable format:

```
Found 47 chunks from 3 files. Proposed routing:

  📂 TELOS/GOALS.md              12 chunks  (78% avg confidence)
  📂 TELOS/WISDOM.md              8 chunks  (65% avg confidence)
  📂 TELOS/BELIEFS.md             6 chunks  (71% avg confidence)
  📂 MEMORY/KNOWLEDGE/Ideas      15 chunks  (52% avg confidence)
  🧠 AI collaboration rules       4 chunks  (walk-through: CLAUDE.md / hook / skill)
  ❓ UNCLEAR                      2 chunks  (needs your call)

Options:
  - Approve everything trusted (confidence ≥60%)?
  - Walk through the low-confidence and UNCLEAR chunks one by one?
  - Review specific categories?
  - Review everything?
```

### Phase 4 — Approval loop

Based on the user's preference:

**Fast path** (he says "approve all trusted"):
```bash
bun $LIFEOS_DIR/TOOLS/MigrateApprove.ts --approve-all
```
Commits everything non-UNCLEAR. Then walk through UNCLEAR chunks conversationally.

**Category path** (he says "approve goals and wisdom, skip knowledge"):
```bash
bun $LIFEOS_DIR/TOOLS/MigrateApprove.ts --approve-target TELOS/GOALS.md
bun $LIFEOS_DIR/TOOLS/MigrateApprove.ts --approve-target TELOS/WISDOM.md
```

**Walk-through path** (he wants careful review):
```bash
bun $LIFEOS_DIR/TOOLS/MigrateApprove.ts --review
```
Show each pending chunk. For each:
- Show preview + proposed target + confidence + alternatives
- Ask: approve / modify target / reject
- Commit decision

### Phase 5 — Handle UNCLEAR chunks

UNCLEAR chunks are ones where no classification rule matched strongly. For each:
- Display full content (not just preview)
- Ask the user: "This one's unclear — what is it? Could be X, Y, Z, or maybe Knowledge/Ideas as a catch-all?"
- the user chooses → commit via `--modify <id> --target <chosen>`

### Phase 6 — Completion summary

After approval pass:
- Report total chunks committed, per-target count
- Flag any remaining UNCLEAR
- Recommend next step: run `/interview` to interview around anything the migration left sparse

## Rules

- **Every commit carries provenance.** The committed content includes an HTML comment noting source file + section + timestamp. Nothing gets dropped into TELOS without attribution.
- **Never bulk-approve UNCLEAR.** Those require the user's explicit routing.
- **Confidence thresholds:** ≥70% = trusted (auto-approve eligible). 40-70% = medium (show for confirmation). <40% = low (walk-through required).
- **Ask before touching identity.** PRINCIPAL_IDENTITY.md commits always prompt — that file is load-bearing.
- **Don't duplicate.** If the same content already exists in the target (substring match), flag it and ask before appending.
- **Respect private paths.** Never migrate content into IDEAL_STATE/ without the user's per-dimension call (Decision #3: IDEAL_STATE is fully private and curated).
- **Rules never go to harness memory.** AI collaboration rule chunks are always walked through one by one and routed to a constitutional surface: an operational rule in CLAUDE.md, a hook, a `settings.json` permission, or the relevant skill's Gotchas. Writing them to the harness `memory/feedback_*.md` directory is forbidden — every feedback memo is a missed system patch (see the system prompt's "Override of harness auto-memory").
- **Knowledge gets new files too.** Each `MEMORY/KNOWLEDGE/*` chunk becomes a new typed note with source metadata.

## Examples

### User: `/migrate ~/old-claude/TELOS/`

the DA scans the old TELOS directory, classifies every chunk, presents the routing summary, offers fast-path vs. walk-through approval.

### User: `/migrate` (then pastes CLAUDE.md content)

the DA reads from stdin, classifies most chunks as AI collaboration rules (walked through to CLAUDE.md / hooks / skill Gotchas) plus maybe PRINCIPAL_IDENTITY (if identity lines are mixed in), walks through approval.

### User: "migrate my Cursor rules at ~/.cursor/rules"

the DA scans the rules dir, surfaces likely rule classifications, walks each through to its constitutional destination with extra care (Cursor rules often have tool-specific stuff that doesn't translate to LifeOS).

### User: "import the stuff I dumped in /tmp/journal.md"

the DA scans the journal, expects a lot of UNCLEAR + WISDOM, walks through each section.

## Related

- `/interview` — fills gaps by asking questions (not by intaking existing content)
- `/Telos` Update workflow — edit a single TELOS file directly
- `/Knowledge` — manage the Knowledge Archive
- `/_PROFILE` — manage PRINCIPAL_IDENTITY

## Gotchas

- **Low average confidence (<40%):** the source is probably genre-mismatched (e.g., code comments, logs, raw data). Consider pre-filtering to remove non-prose chunks before scanning.
- **Everything goes to UNCLEAR:** the source probably has no recognizable LifeOS-taxonomy patterns. Either add the content manually via `/Telos` or write it as general Knowledge notes.
- **Duplicate content warnings:** the scanner doesn't dedupe against existing files yet. Run `--dry-run` first to preview before committing.
