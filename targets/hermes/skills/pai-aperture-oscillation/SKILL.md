---
name: pai-aperture-oscillation
description: "3-pass scope switching methodology: narrow/tactical → wide/strategic → synthesis. Oscillates between zoom levels to reveal design tensions and coherence issues invisible at any single scope."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, aperture, scope, zoom, synthesis, tactical, strategic]
    related_skills: [pai-iterative-depth, pai-systems-thinking, pai-ideate]
---

# Aperture Oscillation — Scope Switching

## Overview

A disciplined three-pass method that forces systematic scope switching. Start narrow (tactical details), zoom wide (strategic implications), then synthesize. Reveals design tensions, coherence problems, and blind spots that are invisible when working at a single zoom level.

**Core insight:** Problems look different at different scales. A decision that makes sense tactically may be strategically incoherent, and vice versa. The oscillation reveals the gap.

## When to Use

| Signal | Example |
|--------|---------|
| Deep in details, lost the big picture | "I've been heads-down for too long" |
| Big strategy, no execution plan | "Great vision but how do we build it?" |
| Decision with multi-level impact | "This affects the team, the department, and the company" |
| Solution that worked locally broke globally | "Fixed one issue, created another" |
| Need to align different stakeholders | "Engineering sees this differently than leadership" |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Zoom in and out on this problem" | Full 3-pass aperture oscillation |
| "Too deep in details" | Pass 2 immediately (strategic) |
| "Too abstract/vague" | Pass 1 immediately (tactical grounding) |
| "Check if this is coherent" | Synthesis pass (after running both zooms) |
| "Quick alignment check" | Compressed oscillation (1 pass per level, fast) |

## Core Procedure: 3-Pass Oscillation

### Pass 1: Narrow / Tactical

**Scope:** The immediate details, implementation specifics, and local considerations.

**Objective:** Ground the analysis in concrete specifics.

**Procedure:**

1. **Identify the immediate decision/action:**
   ```
   What exactly are we deciding or building?
   What are the specific parameters, constraints, and requirements?
   ```

2. **Examine implementation details:**
   ```
   What does this look like day-to-day?
   What code/config/content needs to change?
   Who needs to do what, when, and how?
   What are the concrete costs and timelines?
   ```

3. **Surface local issues:**
   ```
   What could go wrong in execution?
   What dependencies exist at this level?
   What technical or operational constraints apply?
   ```

**Output:** Tactical assessment with specific details, costs, timelines, and local risk factors.

### Pass 2: Wide / Strategic

**Scope:** The broad context, long-term implications, and systemic relationships.

**Objective:** Place the problem in its broader context and evaluate strategic fit.

**Procedure:**

1. **Identify the broader system:**
   ```
   What larger system does this fit into?
   What are the 2nd and 3rd order effects?
   Who are the indirect stakeholders?
   ```

2. **Examine strategic alignment:**
   ```
   Does this align with stated goals and principles?
   What trade-offs are being made at this level?
   What strategic alternatives exist?
   ```

3. **Consider temporal dynamics:**
   ```
   How will this look in 6 months, 2 years, 5 years?
   What future options does this enable or foreclose?
   What precedent does this set?
   ```

4. **Scan for emergent properties:**
   ```
   What patterns emerge when looking across multiple instances?
   What system-level effects (unintended consequences)?
   What's the network effect on other initiatives?
   ```

**Output:** Strategic assessment with system context, alignment analysis, and long-term implications.

### Pass 3: Synthesis

**Scope:** The intersection and tension between tactical and strategic views.

**Objective:** Generate integrated understanding that resolves or productively manages the tensions between levels.

**Procedure:**

1. **Map tensions between Pass 1 and Pass 2:**
   ```
   Where do tactical and strategic views agree?
   Where do they conflict?
   What's efficient locally but suboptimal globally?
   What's strategically ideal but tactically infeasible?
   ```

2. **Identify coherence gaps:**
   ```
   Does the strategy support good tactics?
   Do the tactics serve the strategy?
   Are there contradictions between stated principles and actual decisions?
   ```

3. **Generate scope recommendations:**
   ```
   What should be decided at the tactical level?
   What needs strategic escalation?
   What needs coordination across both levels?
   ```

4. **Produce integrated action plan:**
   ```
   For each action item, specify:
   - What it is
   - Which scope level it addresses
   - Feasibility (tactical) + Alignment (strategic)
   - Priority based on both assessments
   ```

**Output:** Tension map, coherence assessment, scope recommendations, and integrated action plan.

## Compressed Mode (Quick)

For faster application when time is limited:

```
Pass 1: 3 tactical questions only
  1. What specifically needs to happen?
  2. What are the top 3 blockers?
  3. What's the cost/timeline?

Pass 2: 3 strategic questions only
  1. How does this fit the bigger picture?
  2. What are the top 3 unintended consequences?
  3. What future options does this affect?

Pass 3: Synthesis
  1. What's the most critical tension?
  2. Which recommendation satisfies both levels?
```

## Examples

### Example: Feature Decision

| Dimension | Pass 1 (Tactical) | Pass 2 (Strategic) | Synthesis |
|-----------|-------------------|--------------------|-----------|
| **Scope** | This specific feature | Product roadmap & vision | Feature serves roadmap but creates technical debt |
| **Time** | 2 weeks development | 6-month product cycle | Worth the debt if it accelerates later features |
| **Cost** | $20K engineering | Opportunity cost of other features | Proceed with 2-week sprint, plan refactor |
| **Risk** | Technical complexity medium | Strategic alignment high | Low overall risk, proceed |

## Hermes Tools Integration

| Pass | Tool | Usage |
|------|------|-------|
| Tactical | `read_file`, `terminal` | Implementation specifics, code review |
| Strategic | `web_search`, `delegate_task` | Market context, strategic research |
| Synthesis | `write_file`, `terminal` | Tension map, integrated plan |
| All passes | `delegate_task` | Parallel tactical/strategic analysis |
| Validation | `read_file` | Cross-reference with ISAs and principles |

## Gotchas / Pitfalls

### 1. Stuck in One Scope
**Problem:** Staying comfortable in tactical or strategic mode and producing shallow analysis in the other.
**Fix:** If you fill Pass 1 quickly but struggle with Pass 2, that's the signal you need Pass 2 the most. The struggle is the point.

### 2. False Resolution
**Problem:** Forcing agreement between levels when there's genuine tension.
**Fix:** Not all tensions can be resolved. Productive management means acknowledging the tension and making it explicit, not pretending it doesn't exist.

### 3. Skipping Synthesis
**Problem:** Running both zooms but never integrating them.
**Fix:** Synthesis is not optional. If you only do Pass 1 and Pass 2, you have two disconnected analyses, not a coherent understanding.

### 4. Over-Abstraction at Strategic Level
**Problem:** Strategic pass is so abstract it says nothing useful.
**Fix:** Force specific, concrete answers. "Align with vision" is not a finding. "This enables X but conflicts with Y" is.

### 5. Miscounting the Passes
**Problem:** Doing 4+ micro-scope switches instead of 3 clean passes.
**Fix:** There are exactly 3 passes. If you find yourself oscillating more, you're noodling, not analyzing. Stick to the structure.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-aperture-oscillation","mode":"standard|compressed","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
