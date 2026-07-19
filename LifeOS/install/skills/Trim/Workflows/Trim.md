# Trim Workflow

**Goal:** get one always-on context file back under its byte budget without dropping a single directive. Safest cuts first; the human approves every judgment call.

## Step 0 — Resolve the target

- Arg given (`/trim OPERATIONAL_RULES`): match it against `path` basenames in `LIFEOS/TOOLS/context-budgets.json`.
- No arg: `bun LIFEOS/TOOLS/BudgetCheck.ts --json` → pick the row with the highest `pct` (or the first `over`).
- Confirm the resolved absolute path before touching anything.

## Step 1 — Show the state (grounding, not a claim)

```bash
bun LIFEOS/TOOLS/BudgetCheck.ts --json | jq '.rows[] | select(.path|test("<NAME>"))'
```

Report: `<file> — <bytes>/<cap> (<pct>% FULL)`. State how many bytes must come out to clear the cap (with a little headroom, e.g. target ≤85%). That number is the goal for this run.

## Step 2 — Deterministic wins first (zero-risk, run before any judgment call)

```bash
bun LIFEOS/TOOLS/ProposalGC.ts            # dry-run — shows superseded / exact-dup / absorbed
```

If it finds removals, show them, then on approval:

```bash
bun LIFEOS/TOOLS/ProposalGC.ts --apply
```

These are provably-redundant (self-marked `[SUPERSEDED]`, exact duplicates, entries already absorbed into the file body) — safe to remove without judgment. Re-check BudgetCheck. Often this alone clears enough that Step 3 is unnecessary — stop here if the file is back under cap.

## Step 3 — Semantic reductions (human-gated; the judgment part)

Read the file. Build a RANKED list of candidate trims — each with the exact target text and estimated bytes saved. Three moves, in decreasing safety:

- **RELOCATE** (safest): rarely-referenced detail (long mechanism explanations, enumerations, examples) → an on-demand reference doc under `LIFEOS/DOCUMENTATION/…`, leaving a one-line stub + pointer. Pattern already used for ISA hierarchy → `LIFEOS/DOCUMENTATION/Isa/IsaHierarchy.md`. Nothing is lost; it just stops loading every turn.
- **TIGHTEN**: a verbose multi-sentence rule → one plain-language sentence carrying the same directive. Kill throat-clearing, dated war-story prose, and intensifier-only restatements — never the instruction itself.
- **MERGE**: two or more rules that say overlapping things in different words → one rule that carries every distinct directive from all of them.

Rank by `bytes_saved × safety` (relocate/tighten above merge). Present the list; the human picks which to apply (or "all safe ones"). Apply one at a time.

## Step 4 — Safety gate (runs before every semantic write — non-negotiable)

A trim edits live doctrine. Before writing any merge/tighten:

1. **Coverage check** — enumerate every proper noun, file path, tool/command name, env-var name, and imperative verb in the ORIGINAL text. Confirm each survives in the replacement. A missing one = the edit drops a directive → **abort this edit, keep the original.**
2. **Re-read** the replacement as the file's reader: does it still compel the same behavior? If weaker, it's a bad trim.
3. Relocate edits: confirm the moved content landed verbatim in the reference AND the stub points to it before deleting from the source.

Deterministic GC (Step 2) skips this gate — it only removes provably-redundant entries. Only Step-3 semantic edits need it.

## Step 5 — Commit (correct repo) and re-verify

- **USER files** (`LIFEOS/USER/**`: OPERATIONAL_RULES, PROJECTS, PRINCIPAL_IDENTITY, DA_IDENTITY) commit to the USER_DATA repo:
  ```bash
  git -C ~/.config/LIFEOS/USER add <relpath> && git -C ~/.config/LIFEOS/USER commit -q -m "trim: <file> <oldpct>%→<newpct>% (<what>)"
  ```
  Stage ONLY the trimmed file — the USER_DATA repo carries unrelated live memory-loop changes; never sweep them in.
- **System files** (system prompt, CLAUDE.md, ALGORITHM, skills) commit to `$LIFEOS_ROOT` (`git -C $LIFEOS_ROOT …`), directly to `main`.
- Re-run `bun LIFEOS/TOOLS/BudgetCheck.ts` and report the new `NN% FULL`. If still over cap, name how much remains and offer to continue.

## Output shape

Lead with the before→after: `OPERATIONAL_RULES 99% → 87% (−7.1K)`. Then a short list of what was removed/merged/relocated, and the commit SHA. If any candidate was declined by the safety gate, say which and why. Never claim the file was trimmed without the re-run BudgetCheck number as evidence.
