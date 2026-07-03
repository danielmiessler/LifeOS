---
name: pai-migrate
description: "Intakes existing content from external sources — Obsidian, Notion, Apple Notes, CLAUDE.md, .cursorrules, raw markdown — and classifies each chunk against the PAI destination taxonomy, then commits approved chunks with provenance. Two-phase workflow: MigrateScan (chunks and classifies content, producing a routing table with per-target counts and confidence %) and MigrateApprove (approval loop with modes: --approve-all, --approve-target <category>, --review, --dry-run). UNCLEAR chunks never bulk-approved. Confidence thresholds: >=70% auto-approve eligible; 40-70% confirm with user; <40% walk-through required. Destinations include: TELOS (MISSION/GOALS/PROBLEMS/STRATEGIES/CHALLENGES/BELIEFS/WISDOM/MODELS/FRAMES/NARRATIVES/SPARKS), IDEAL_STATE (per-dimension), preferences (BOOKS/AUTHORS/MOVIES/BANDS/RESTAURANTS/FOOD_PREFERENCES/LEARNING/MEETUPS/CIVIC), Identity (PRINCIPAL_IDENTITY.md — always prompts), Knowledge (MEMORY/KNOWLEDGE/{Ideas,People,Companies,Research}), AI rules (memory/feedback_*.md), and UNCLEAR. Provenance HTML comment on every commit. Dedup via substring match. USE WHEN importing content from external tools into the PAI knowledge system. NOT FOR general file management."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes_tags: [pai, migrate, import, obsidian, notion, classification, taxonomy]
  related_skills: [pai-interview, pai-telos, pai-knowledge]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-migrate skill"}' \
  > /dev/null 2>&1 &
```


# pai-migrate — External-Content Intake and Classification

## Overview

Migrates content into the PAI structure from external sources. Unlike `/interview`
(which asks the user questions to fill gaps), `/migrate` **already has the content**
— it just needs to classify each chunk and route it to the right PAI destination.

### Supported Sources

| Source | Format | Notes |
|--------|--------|-------|
| Local files | .md, .markdown, .txt | Single file or directory recursion |
| Stdin | Piped content | Paste directly or pipe from another command |
| Other PAI installs | USER/TELOS/, MEMORY/KNOWLEDGE/ | Point at old install directories |
| Agent rule files | CLAUDE.md, .cursorrules | Extracts collaboration patterns |
| OpenAI Custom Instructions | Plain text | Exports of custom instructions |
| Obsidian vaults | Markdown | Standard markdown export format |
| Notion exports | Markdown | Notion's .md export format |
| Apple Notes exports | .txt | Plain text export |
| Journal dumps | .md/.txt | Raw unstructured notes |

### Classification Destinations

| Category | Destinations |
|----------|-------------|
| **Foundational TELOS** | MISSION, GOALS, PROBLEMS, STRATEGIES, CHALLENGES, BELIEFS, WISDOM, MODELS, FRAMES, NARRATIVES, SPARKS |
| **IDEAL_STATE dimensions** | HEALTH, MONEY, FREEDOM, RELATIONSHIPS, CREATIVE, RHYTHMS |
| **Preference files** | BOOKS, AUTHORS, MOVIES, BANDS, RESTAURANTS, FOOD_PREFERENCES, LEARNING, MEETUPS, CIVIC |
| **Identity** | PRINCIPAL_IDENTITY.md (always prompts for approval) |
| **Knowledge** | MEMORY/KNOWLEDGE/{Ideas, People, Companies, Research} |
| **AI collaboration rules** | memory/feedback_*.md (one file per chunk) |
| **Unclear** | Flagged for manual routing |

## Workflow: Scan → Classify → Approve → Commit

### Phase 1 — Identify the Source

Ask the user what they want to migrate:
- "Paste the content here and I'll work from stdin"
- "Point me at a file path"
- "Point me at a directory and I'll scan everything inside"
- "I have a Cursor rules file at ~/Projects/X/.cursorrules"
- "My old PAI install has TELOS at ~/old-claude/TELOS/"

Collect the source path. If content is pasted, write it to a temp file first.

### Phase 2 — Scan & Classify

Run the scanner to chunk and classify content:

```bash
bun ~/.hermes/pai/TOOLS/MigrateScan.ts --source <path>
# or
echo "$CONTENT" | bun ~/.hermes/pai/TOOLS/MigrateScan.ts --stdin
```

**Scanner output:**
- Total chunks found
- Proposed routing table (how many chunks per target)
- Average classification confidence
- Count of UNCLEAR chunks
- Count of low-confidence (<40%) chunks

### Phase 3 — Present Routing Summary

Show the user the routing proposal:

```
Found 47 chunks from 3 files. Proposed routing:

  TELOS/GOALS.md               12 chunks  (78% avg confidence)
  TELOS/WISDOM.md               8 chunks  (65% avg confidence)
  TELOS/BELIEFS.md              6 chunks  (71% avg confidence)
  MEMORY/KNOWLEDGE/Ideas       15 chunks  (52% avg confidence)
  memory/feedback               4 chunks  (85% avg confidence)
  UNCLEAR                       2 chunks  (needs your call)

Options:
  - Approve everything trusted (confidence >=60%)?
  - Walk through the low-confidence and UNCLEAR chunks?
  - Review specific categories?
  - Review everything?
```

### Phase 4 — Approval Loop

**Fast path** (user says "approve all trusted"):
```bash
bun ~/.hermes/pai/TOOLS/MigrateApprove.ts --approve-all
```
Commits everything non-UNCLEAR. Then walk through UNCLEAR chunks conversationally.

**Category path** (user says "approve goals and wisdom, skip knowledge"):
```bash
bun ~/.hermes/pai/TOOLS/MigrateApprove.ts --approve-target TELOS/GOALS.md
bun ~/.hermes/pai/TOOLS/MigrateApprove.ts --approve-target TELOS/WISDOM.md
```

**Walk-through path** (user wants careful review):
```bash
bun ~/.hermes/pai/TOOLS/MigrateApprove.ts --review
```
For each chunk: show preview + proposed target + confidence + alternatives.
Ask: approve / modify target / reject. Commit decision.

**Dry-run:**
```bash
bun ~/.hermes/pai/TOOLS/MigrateApprove.ts --dry-run
```

### Phase 5 — Handle UNCLEAR Chunks

UNCLEAR chunks are where no classification rule matched strongly. For each:
- Display full content (not just preview)
- Ask the user: "This one's unclear — what is it? Could be X, Y, Z, or maybe Knowledge/Ideas?"
- User chooses → commit via `--modify <id> --target <chosen>`
- **Never bulk-approve UNCLEAR.** Those require explicit user routing.

### Phase 6 — Completion Summary

After approval pass:
- Report total chunks committed, per-target count
- Flag any remaining UNCLEAR
- Recommend next step: run `/interview` to interview around anything left sparse

## Rules

- **Every commit carries provenance.** The committed content includes an HTML comment noting source file + section + timestamp. Nothing gets dropped without attribution.
- **Never bulk-approve UNCLEAR.** Those require the user's explicit routing.
- **Confidence thresholds:** >=70% = trusted (auto-approve eligible). 40-70% = medium (show for confirmation). <40% = low (walk-through required).
- **Ask before touching identity.** PRINCIPAL_IDENTITY.md commits always prompt — that file is load-bearing.
- **Don't duplicate.** If the same content already exists in the target (substring match), flag it and ask before appending.
- **Respect private paths.** Never migrate content into IDEAL_STATE/ without the user's per-dimension explicit call (Decision #3: IDEAL_STATE is fully private and curated).
- **Feedback memories get new files.** Each memory/feedback chunk becomes its own `feedback_migrated_<slug>_<id>.md` file — not appended to an existing memory.
- **Knowledge gets new files too.** Each MEMORY/KNOWLEDGE/* chunk becomes a new typed note with source metadata.

## Gotchas

- **Low average confidence (<40%):** The source is probably genre-mismatched (code comments, logs, raw data). Consider pre-filtering to remove non-prose chunks before scanning.
- **Everything goes to UNCLEAR:** The source probably has no recognizable PAI-taxonomy patterns. Either add content manually via Telos/ or write it as general Knowledge notes.
- **Duplicate content warnings:** The scanner doesn't dedupe against existing files. Run `--dry-run` first to preview before committing.
- **Identity always prompts:** PRINCIPAL_IDENTITY.md commits always ask for confirmation — that file is foundational and should never be modified without the user's explicit approval.

## Related Skills

- `/interview` — Fills gaps by asking questions (not by intaking existing content)
- Telos Update — Edit a single TELOS file directly
- Knowledge — Manage the Knowledge Archive
- _PROFILE — Manage PRINCIPAL_IDENTITY

## Execution Log Pattern

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-migrate","workflow":"WORKFLOW","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
