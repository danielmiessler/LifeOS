---
name: Trim
version: 1.0.1
description: "Reduces an always-on LifeOS context file that is over its byte budget via a human-gated pass — deterministic GC of stale entries first, then semantic merges and relocations — never dropping a directive and committing every change reversibly. USE WHEN /trim, trim the context, trim OPERATIONAL_RULES, this file is too big, reduce a doctrine file, context file over budget, file is NN% full, statusline file went red, prune an always-loaded file, shrink CLAUDE.md or DA_IDENTITY. NOT FOR general code refactoring, trimming video/audio (use Video/AudioEditor), or removing AI writing patterns from prose (use _WRITING)."
---

# Trim

Reduce an always-on context file back under its byte budget. This is what you DO when the statusline shows a file at `NN% FULL` in red: `/trim <file>` walks the reduction, safest cuts first, never dropping a rule.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| `/trim <file>`, "trim OPERATIONAL_RULES", "this file is too big", "file went red", "reduce a doctrine file" | `Workflows/Trim.md` |

## Quick Reference

- **Target resolution:** a bare name (`OPERATIONAL_RULES`) resolves against `LIFEOS/TOOLS/context-budgets.json`. No arg → trim whichever file is worst (`bun LIFEOS/TOOLS/BudgetCheck.ts --json` → highest %).
- **Order is safest-first:** (1) show state, (2) deterministic GC (zero-risk), (3) semantic trims (human-gated), (4) safety gate, (5) re-check budget. Full steps: `Workflows/Trim.md`.
- **Two tools it orchestrates — never reimplement:** `LIFEOS/TOOLS/BudgetCheck.ts` (bytes/cap/%), `LIFEOS/TOOLS/ProposalGC.ts` (removes superseded/duplicate/absorbed entries).
- **Three semantic moves:** MERGE overlapping rules, TIGHTEN verbose ones, RELOCATE rarely-used detail to an on-demand reference (leave a stub + pointer).
- **The invariant:** a trim never drops a distinct directive. If a merge would, keep the original.

## Gotchas

- **USER files commit to the USER_DATA repo, not `~/.claude`.** `LIFEOS/USER/**` (OPERATIONAL_RULES, PROJECTS, the identity files) is a symlink into a separate private repo. Commit with `git -C ~/.config/LIFEOS/USER …`. A `~/.claude` commit captures nothing under `LIFEOS/USER/` — a false safety net.
- **The file can change mid-edit.** The autonomic memory loop appends proposals to these files while you work. If a Write/Edit reports "modified since read", RE-READ before writing — a concurrent correction may have landed (this is how a real deploy-command fix was nearly reverted). Never write from a stale read.
- **Semantic merges must never drop a directive.** Before applying any merge/tighten, confirm every proper noun, path, tool name, and imperative from the originals survives in the result. If one is missing, the merge is wrong — keep the original. Deterministic GC (superseded/dup/absorbed) is always safe; semantic edits are the risky class.
- **`bun`/`bunx` only, never `npm`/`npx`.**
- **Deterministic first, always.** Run ProposalGC before proposing any semantic edit — the free, zero-risk removals often clear enough that no judgment-call edit is needed.

## Examples

```
/trim OPERATIONAL_RULES
# → shows 53.8K/54K (99% FULL) → ProposalGC dry-run (0 removable) → ranks semantic
#   trims (merge 3 overlapping ship-it rules, relocate CF-token doctrine to a reference)
#   → applies approved ones behind the safety gate → commits to USER_DATA → re-checks: 47K/54K (87%)

/trim
# → no arg: BudgetCheck picks the worst file, then the same walkthrough
```

## Execution Log

After completing the workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"Trim","workflow":"Trim","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```
