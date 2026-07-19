---
name: ApertureOscillation
version: 1.0.8
description: "3-pass scope oscillation that holds a question constant while shifting zoom — narrow/tactical, wide/strategic, then synthesis — to surface design tensions, scope recommendations, and coherence assessments invisible at any single zoom level. USE WHEN aperture oscillation, oscillate scope, zoom in and out, tactical vs strategic, scope framing, design tension, system coherence check, local vs global design, wrong scope, scope negotiation. NOT FOR lens rotation across angles (use IterativeDepth)."
effort: medium
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/ApertureOscillation/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


# ApertureOscillation

## What It Does

Runs a question through 3 passes at different zoom levels — narrow/tactical, wide/strategic, then synthesis — while holding the question itself constant. The first pass captures what a component wants to be on its own. The second captures what the system needs it to be. The third finds where those two views disagree, and that gap is the output: design tensions, scope recommendations, coherence checks.

## The Problem

A component designed in isolation gets its own clean logic. The same component designed inside a stated system vision inherits different constraints. Pick one zoom level and you miss the other — you ship something that works perfectly on its own but fights the system, or something that serves the system but ignores the component's natural shape. The most expensive rework comes from exactly this mismatch, discovered mid-build. Holding the question constant while varying the scope surfaces the mismatch before you commit.

## How It Works

Grounded in the observation that LLMs (and humans) produce different outputs depending on the scope of the framing context. A component designed in isolation has its own logic. The same component designed within a stated system vision inherits different constraints. The delta between these two framings is where the insight lives.

Instead of rotating analytical lenses (IterativeDepth) or generating divergent ideas (BeCreative), ApertureOscillation holds the question constant but shifts the **scope envelope** around it across 3 structured passes:

1. **Narrow Aperture (Tactical-first):** The specific thing is primary. Big-picture context is background. This captures what the component naturally wants to be — its own internal logic and shape.

2. **Wide Aperture (Strategic-first):** The vision/system goal is primary. The specific thing is derived from it. This captures what the system needs the component to be — coherence, alignment, constraints you'd miss thinking locally.

3. **Oscillation (Synthesis):** Feed both outputs. Ask where the tactical and strategic views diverge. The tensions, gaps, and surprises between the two framings are the output — the things neither pass alone would surface.

## How It Differs from IterativeDepth

| Dimension | IterativeDepth | ApertureOscillation |
|-----------|---------------|---------------------|
| **What varies** | Analytical lens (failure, stakeholder, temporal...) | Scope/zoom level (narrow, wide, synthesized) |
| **Pass count** | 2-8 | 3 (fixed) |
| **Input** | Single problem statement | Two inputs: tactical target + strategic context |
| **Output** | Richer requirements from multiple angles | Design tensions between local and system-level views |
| **Best for** | Requirement discovery, blind spot elimination | Architecture decisions, feature design, system coherence |
| **When to combine** | Use IterativeDepth first (understand the problem), then ApertureOscillation (understand where the solution fits) |

## Use / Win

**When to use:** Any time you're building something specific within a larger system and need to ensure the local design serves the global vision — without losing the component's own logic.

Concrete triggers:
- **Architecture decisions** — "Should this be a service, a library, or inline?" depends entirely on whether you're zoomed into the component or zoomed out to the system.
- **Feature design** — The feature a user asks for vs. the feature the product needs are often subtly different. Oscillation surfaces the gap.
- **System coherence checks** — When adding to existing infrastructure, the new piece must serve both its own purpose and the system's. Single-scope framing misses one or the other.
- **Design reviews** — Before committing to an approach, oscillate scope to check that the tactical plan and the strategic vision agree.
- **Scope negotiation** — When the user says "build X" and X could be simple or complex depending on context, oscillation reveals which scope is appropriate.

**What you win:**
- **Design tensions surfaced before they become mid-build surprises.** The most expensive rework comes from a component that works perfectly on its own but doesn't serve the system.
- **Scope clarity.** Seeing the same question at narrow and wide aperture often reveals that the obvious scope is wrong.
- **Coherence confidence.** When tactical and strategic views align, you can build with conviction. When they diverge, you know exactly where to make tradeoffs.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| Oscillate | "aperture oscillation", "oscillate scope", "zoom in/out", "tactical vs strategic" | `Workflows/Oscillate.md` |
| Oscillate | Algorithm OBSERVE/THINK selects ApertureOscillation capability | `Workflows/Oscillate.md` |

## Quick Reference

- **3 passes** — always 3 (narrow, wide, synthesis)
- **2 inputs** — tactical target (what you're building) + strategic context (why, the bigger picture)
- **Output** — design tensions, scope recommendations, coherence assessment
- **Integration point** — OBSERVE (before ISC) or THINK (before approach commitment)

## Gotchas

- **Requires two distinct inputs.** If the tactical target and strategic context are the same thing, ApertureOscillation adds no value — use IterativeDepth instead.
- **3 passes is the right number.** Unlike IterativeDepth (2-8), the narrow/wide/synthesis structure is complete at 3. Adding passes would just be lens rotation, which is IterativeDepth's job.
- **The synthesis pass is where the value lives.** Passes 1 and 2 are setup. If the synthesis finds no divergence, that's a valid (and valuable) finding — it means the tactical and strategic views are already aligned.
- **This is a BPE-fragile skill.** Monitor whether smarter models naturally oscillate scope without being prompted. Quarterly test recommended.

## Examples

**Example 1: Feature design within a system**
```
Tactical target: "Build a caching layer for session data"
Strategic context: "LifeOS is a Life OS that needs responsive, session-spanning AI assistance"

Pass 1 (Narrow): Redis with TTL, standard session cache patterns
Pass 2 (Wide): Cache must survive session boundaries, integrate with memory system, serve the Life OS vision
Pass 3 (Synthesis): Tension — standard session cache expires data that the Life OS needs to persist. Resolution: hybrid cache with session-scoped fast layer + memory-backed persistent layer.
```

**Example 2: Architecture decision**
```
Tactical target: "Add webhook support to the Feed system"
Strategic context: "Feed is one pipeline in Arbol, which processes content for Surface"

Pass 1 (Narrow): Standard webhook receiver, queue, retry logic
Pass 2 (Wide): Webhooks must flow through Arbol's action/function pattern, integrate with existing queue infrastructure
Pass 3 (Synthesis): Tension — standalone webhook service vs. Arbol action. Resolution: implement as Arbol action, not standalone service, because the strategic context demands pipeline coherence over component independence.
```

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"ApertureOscillation","workflow":"Oscillate","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
