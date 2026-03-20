---
name: iterative-depth
description: 2-8 scientific lens passes to surface hidden requirements single-pass analysis misses. USE WHEN iterative depth, deep exploration, multi-angle analysis, multiple perspectives, examine from angles, surface hidden requirements.
---

## Customization

Check for user customizations at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/IterativeDepth/` — if present, load and apply overrides before proceeding.

# IterativeDepth

Run 2-8 structured passes through the same problem, each from a systematically different **lens** (Hermeneutic Circle, Triangulation, Six Thinking Hats, Causal Layered Analysis, etc.). Each pass surfaces requirements, edge cases, and ISC criteria invisible from other angles.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "iterative depth", "explore deeper", "multi-angle" | `Workflows/Explore.md` |
| "quick depth", "fast angles" | `Workflows/Explore.md` (Fast mode: 2 lenses) |

## Quick Reference

- **8 Lenses** available, scaled by SLA (2-8) — definitions in `TheLenses.md`
- **Output**: New/refined ISC criteria per pass
- Scientific grounding: `ScientificFoundation.md`

## Validation

After completing all passes, verify:
1. Each lens produced at least one unique ISC criterion not found by other lenses
2. No duplicate criteria across passes
3. Edge cases from each lens are captured in final output
