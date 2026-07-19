---
name: IterativeDepth
version: 1.1.15
description: "Structured multi-angle exploration running 2-8 sequential passes over the same problem, each through a different scientific lens, to surface hidden requirements and edge cases invisible from one angle; each pass yields new ISC criteria. USE WHEN iterative depth, explore deeper, multi-angle analysis, surface hidden requirements, blind spot check, what am I missing. NOT FOR scope/zoom analysis (use ApertureOscillation)."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`{{LIFEOS_DIR}}/USER/CUSTOMIZATIONS/SKILLS/IterativeDepth/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# IterativeDepth

## What It Does

IterativeDepth examines one problem through several structurally different lenses — literal, stakeholder, failure, temporal, and more — merging what each angle surfaces into ISC criteria a single pass misses. Grounded in 20 established techniques across cognitive science, AI/ML, requirements engineering, and design thinking (see `ScientificFoundation.md`).

## The Deliverable

A done run produces:

- **A deduplicated ISC set** — each criterion binary-testable, 8-12 words, phrased as a state not an action. No two criteria restate each other.
- **Refinements** to existing criteria, each noting what changed and why.
- **Anti-criteria** — failure modes that must NOT happen.
- **At least one surprising cross-angle finding** — a requirement that only appeared because two lenses collided. A run that surfaces nothing a single pass would have missed added no value.

Passes stop when a new lens repeats what earlier lenses already found. Non-redundant angles are what matter; more angles for their own sake are not.

## The Lenses

`TheLenses.md` is a catalog of eight exploration angles. Draw from it — pick the lenses the problem calls for, in whatever order, as many as earn their keep. No fixed count, no prescribed sequence: a security problem leans on the failure and adversary angles, a UX problem on the experiential one. Let the problem select the lenses.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| Explore | "iterative depth", "explore deeper", "multi-angle" | `Workflows/Explore.md` |

## Reference

- Lens catalog: `TheLenses.md`
- Scientific grounding: `ScientificFoundation.md`

## Gotchas

- **2-8 lens passes, not infinite.** Diminishing returns after ~5 passes for most topics.
- **Each pass should surface genuinely NEW requirements, not restate previous findings.** If passes start repeating, stop early.
- **This is a BPE-fragile skill.** Monitor whether smarter models make it unnecessary. Quarterly test recommended.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"IterativeDepth","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> "${LIFEOS_DIR}/MEMORY/SKILLS/execution.jsonl"
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
