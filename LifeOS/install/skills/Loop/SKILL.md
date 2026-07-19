---
name: Loop
version: 1.0.7
description: "Iterative improvement loop — refine a target across multiple Algorithm cycles toward ideal state. USE WHEN loop, iterate, refine, multiple passes, keep improving, revisit, rework."
disable-model-invocation: true
effort: medium
---

# /loop — Iterative Improvement

## What It Does

`/loop` runs the Algorithm in `mode: loop` — multiple full Algorithm cycles on the same target, each iteration building on the last. By default a human reviews and redirects between iterations. Unlike `/optimize` (an autonomous mutation loop), `/loop` runs full Algorithm passes with that human review in the seam.

## The Problem

Some work doesn't finish in one pass. A skill, a prompt, a diagram, a piece of writing gets meaningfully better each time you run a full cycle on it — but only if each cycle remembers what the last one learned and what it already tried. Run the cycles by hand and you lose that thread: you re-explore dead ends, forget which approaches got rejected, and have no record of whether the score actually moved. `/loop` carries ISC criteria and a dead-ends ledger across iterations so each pass starts from where the last one ended.

## How It Works

Each iteration is a full Algorithm cycle (OBSERVE → LEARN). The LEARN phase of one cycle feeds the OBSERVE phase of the next, the ISA tracks iteration count and cumulative improvements, and a human approves or redirects between iterations unless autoresearch mode is enabled.

## Invocation

```
/loop --target "path/to/target" --iterations 5
/loop --target "{{LIFEOS_ROOT}}/skills/Art/Workflows/TechnicalDiagrams.md" --goal "make diagrams more consistent"
/loop --resume       # Resume a previous loop
/loop --status       # Show iteration history
```

## What Happens

Each iteration is a full Algorithm cycle (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) with:
- ISC criteria that evolve between iterations
- Each cycle's LEARN phase informs the next cycle's OBSERVE
- ISA tracks iteration count and cumulative improvements
- Human approves/redirects between iterations

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--target PATH` | yes | | What to improve (file, directory, skill) |
| `--goal TEXT` | | inferred | What "better" means for this target |
| `--iterations N` | | 3 | Maximum number of Algorithm cycles |
| `--resume` | | | Resume a previous loop |
| `--status` | | | Show iteration history |
| `--autoresearch` | | off | Opt-in autonomous mode — see below |

## Algorithm Integration

Sets `mode: loop` in ISA frontmatter. The `iteration` field tracks cycle count. Each cycle re-enters the Algorithm with accumulated context from prior iterations.

## Autoresearch Mode (opt-in)

`--autoresearch` switches /loop from supervised multi-pass improvement to autonomous iteration, borrowing three patterns from pi-autoresearch (davebcn87, MIT):

1. **No human review between cycles** — each iteration's LEARN feeds directly into the next OBSERVE. Cycle continues until `--iterations` reached, target met, or explicit interrupt.
2. **Dead-ends ledger** — ISA maintains a `## Dead Ends` section. Every failed iteration appends one line with the rejected approach and reason. Resumes read this to avoid retrying rejected paths.
3. **MAD confidence on iteration score** — if the target has a measurable score, compute `|delta|/MAD(iteration_scores)` per cycle. Flag red (<1.0×) iterations as noise-floor and log `marginal`; do not update baseline. See `LIFEOS/ALGORITHM/optimize-loop.md` → Confidence Gating.

Invocation:
```
/loop --target "path" --goal "X" --iterations 20 --autoresearch
```

Default /loop behavior is unchanged — autoresearch is opt-in only. Intended for overnight runs on targets where human-in-the-loop review between cycles is too slow.

## Examples

```
/loop --target "{{LIFEOS_ROOT}}/skills/Research" --goal "improve output quality" --iterations 5
/loop --target "prompts/summarize.md" --goal "more concise, less filler"
```

## Gotchas

- **Loop runs multiple full Algorithm cycles.** Each cycle is a complete OBSERVE→LEARN pass. This is expensive in time and tokens.
- **Set a clear exit condition.** Without one, loops can run indefinitely.
- **Human review happens between cycles.** Don't skip the review step — it's the feedback mechanism.
