---
name: IterativeDepth
description: 2-8 scientific lens passes to surface hidden requirements single-pass analysis misses. USE WHEN iterative depth, deep exploration, multi-angle analysis, multiple perspectives, examine from angles, surface hidden requirements.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/IterativeDepth/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# IterativeDepth

**Structured multi-angle exploration of the same problem to extract deeper understanding and richer ISC criteria.**

Grounded in 20 established scientific techniques across cognitive science (Hermeneutic Circle, Triangulation), AI/ML (Self-Consistency, Ensemble Methods), requirements engineering (Viewpoint-Oriented RE), and design thinking (Six Thinking Hats, Causal Layered Analysis).

## Core Concept

Instead of analyzing a problem once, run 2-8 structured passes through the same problem, each from a systematically different **lens**. Each pass surfaces requirements, edge cases, and criteria invisible from other angles. The combination yields ISC criteria that no single-pass analysis could produce.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "iterative depth", "explore deeper", "multi-angle" | `Workflows/Explore.md` |
| "quick depth", "fast angles" | `Workflows/Explore.md` (Fast mode: 2 lenses) |

## Quick Reference

- **8 Lenses** available, scaled by SLA (2-8)
- **Each lens** is a structurally different exploration angle
- **Output** is new/refined ISC criteria per pass
- **Integration** point: Deeper understanding through structured multi-angle analysis

**Full Documentation:**
- Scientific grounding: `ScientificFoundation.md`
- Lens definitions: `TheLenses.md`
