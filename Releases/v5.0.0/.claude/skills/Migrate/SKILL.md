---
name: Migrate
description: "Intakes existing content from external sources, classifies each chunk against the PAI destination taxonomy, and commits approved chunks with provenance. Sources: .md/.markdown/.txt, stdin, PAI TELOS/MEMORY/KNOWLEDGE dirs, CLAUDE.md/.cursorrules/OpenAI Custom Instructions, Obsidian/Notion/Apple Notes exports, journal dumps. MigrateScan.ts chunks and classifies, producing a routing table with per-target counts and confidence %. MigrateApprove.ts approval loop: --approve-all, --approve-target, --review, --dry-run. UNCLEAR never bulk-approved. Phase 6 delivers summary and /interview recommendation for sparse areas. Confidence: ≥70% auto-approve; 40-70% confirm; <40% walk-through. Destinations: TELOS (MISSION/GOALS/PROBLEMS/STRATEGIES/CHALLENGES/BELIEFS/WISDOM/MODELS/FRAMES/NARRATIVES/SPARKS), IDEAL_STATE (per-dimension explicit call), preferences (BOOKS/AUTHORS/MOVIES/BANDS/RESTAURANTS/FOOD_PREFERENCES/LEARNING/MEETUPS/CIVIC), Identity (PRINCIPAL_IDENTITY.md — always prompts), Knowledge (MEMORY/KNOWLEDGE/{Ideas,People,Companies,Research}), AI rules (memory/feedback_*.md — new file per chunk), UNCLEAR. Provenance HTML comment on every commit. Dedup via substring match. USE WHEN /migrate, migrate content, import from other PAI, bring in old notes, import Cursor rules, import CLAUDE.md, import Custom Instructions, bulk import, Obsidian/Notion/Apple Notes import. NOT FOR single-file edits (use Telos Update), conversational interviews (use Interview), Knowledge Archive (use Knowledge), identity edits (use _PROFILE)."
---

# Migrate — external-content intake and classification

## What this skill does

Migrates content into the PAI structure from external sources. Unlike `/interview` (which asks the user questions to fill gaps), `/migrate` **already has the content** — it just needs to classify each chunk and route it to the right PAI destination.

### Sources supported in V1

- **Files:** `.md`, `.markdown`, `.txt` (single file or directory recursion)
- **Stdin:** piped content or pasted directly
- **Other PAI installs:** point at their `USER/TELOS/` or `MEMORY/KNOWLEDGE/` directories
- **Agent-harness rule files:** `CLAUDE.md`, `.cursorrules`, OpenAI Custom Instructions export
- **Exports:** Obsidian vaults (markdown), Notion exports (markdown), Apple Notes exports (.txt), raw journal dumps

### What it classifies chunks into

| Category | Destinations |
|---|---|
| **Foundational TELOS** | MISSION, GOALS, PROBLEMS, STRATEGIES, CHALLENGES, BELIEFS, WISDOM, MODELS, FRAMES, NARRATIVES, SPARKS |
| **IDEAL_STATE dimensions** | HEALTH, MONEY, FREEDOM, RELATIONSHIPS, CREATIVE, RHYTHMS |
| **Preference files** | BOOKS, AUTHORS, MOVIES, BANDS, RESTAURANTS, FOOD_PREFERENCES, LEARNING, MEETUPS, CIVIC |
| **Identity** | USER/PRINCIPAL_IDENTITY.md |
| **Knowledge** | MEMORY/KNOWLEDGE/{Ideas,People,Companies,Research} |
| **AI collaboration rules** | `memory/feedback_*.md` (for "always do X", "never Y" patterns) |
| **Unclear** | Flagged for the user's manual routing |

## Workflow

### Phase 1 — Identify the source

Ask the user what he wants to migrate:

- "Paste the content here and I'll work from stdin"
- "Point me at a file path"
- "Point me at a directory and I'll scan everything inside"
- "I have a Cursor rules file at ~/Projects/X/.cursorrules"
- "My old PAI install has TELOS at ~/old-claude/TELOS/"

Collect the source path. If content is pasted, write it to a temp file first.

### Phase 2 — Scan

Run the scanner:

```bash
bun ~/.claude/PAI/TOOLS/MigrateScan.ts --source <path>
# or
echo "$CONTENT" | bun ~/.claude/PAI/TOOLS/MigrateScan.ts --stdin
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
  🧠 memory/feedback              4 chunks  (85% avg confidence)
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
bun ~/.claude/PAI/TOOLS/MigrateApprove.ts --approve-all
```
Commits everything non-UNCLEAR. Then walk through UNCLEAR chunks conversationally.

**Category path** (he says "approve goals and wisdom, skip knowledge"):
```bash
bun ~/.claude/PAI/TOOLS/MigrateApprove.ts --approve-target TELOS/GOALS.md
bun ~/.claude/PAI/TOOLS/MigrateApprove.ts --approve-target TELOS/WISDOM.md
```

**Walk-through path** (he wants careful review):
```bash
bun ~/.claude/PAI/TOOLS/MigrateApprove.ts --review
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
- **Feedback memories get new files.** Each `memory/feedback` chunk becomes its own `feedback_migrated_<slug>_<id>.md` file — not appended to an existing memory.
- **Knowledge gets new files too.** Each `MEMORY/KNOWLEDGE/*` chunk becomes a new typed note with source metadata.

## Examples

### User: `/migrate ~/old-claude/TELOS/`

the DA scans the old TELOS directory, classifies every chunk, presents the routing summary, offers fast-path vs. walk-through approval.

### User: `/migrate` (then pastes CLAUDE.md content)

the DA reads from stdin, classifies the rules as `memory/feedback` (most) plus maybe PRINCIPAL_IDENTITY (if identity lines are mixed in), walks through approval.

### User: "migrate my Cursor rules at ~/.cursor/rules"

the DA scans the rules dir, surfaces likely-feedback classifications, walks through with extra care (Cursor rules often have tool-specific stuff that doesn't translate to PAI).

### User: "import the stuff I dumped in /tmp/journal.md"

the DA scans the journal, expects a lot of UNCLEAR + WISDOM, walks through each section.

## Related

- `/interview` — fills gaps by asking questions (not by intaking existing content)
- `/Telos` Update workflow — edit a single TELOS file directly
- `/Knowledge` — manage the Knowledge Archive
- `/_PROFILE` — manage PRINCIPAL_IDENTITY

## Troubleshooting

- **Low average confidence (<40%):** the source is probably genre-mismatched (e.g., code comments, logs, raw data). Consider pre-filtering to remove non-prose chunks before scanning.
- **Everything goes to UNCLEAR:** the source probably has no recognizable PAI-taxonomy patterns. Either add the content manually via `/Telos` or write it as general Knowledge notes.
- **Duplicate content warnings:** the scanner doesn't dedupe against existing files yet. Run `--dry-run` first to preview before committing.
