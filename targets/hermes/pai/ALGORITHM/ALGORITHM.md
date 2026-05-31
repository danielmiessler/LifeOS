# PAI Algorithm v6.3.0 — Specification

## Overview

The Algorithm is a 7-phase universal execution loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) that drives every non-trivial task. It is modeled on the scientific method and uses hard-to-vary explanations as the standard for "good."

## Mode Classification

Every user request is classified into one of three modes:

| Mode | When | What Happens |
|------|------|-------------|
| **MINIMAL** | Simple Q&A, one-liner, direct "do X" | Answer directly, no phases |
| **NATIVE** | Standard tool use, moderate complexity | Use tools, no Algorithm |
| **ALGORITHM** | Complex multi-step, criteria-driven, risky | Full 7-phase execution |

The classifier reasons about the request — it does not regex-match keywords.

## The 7 Phases

### OBSERVE
**Entry:** User request received, mode classified as ALGORITHM.  
**Work:** Reverse-engineer request. Load context. Classify effort tier (E1-E5). Scaffold ISA. Define ISCs.  
**Exit:** ISA exists with all ISCs for the tier. Frontmatter populated.

### THINK
**Entry:** ISA scaffolded, ISCs defined.  
**Work:** Select thinking capabilities. Run premortem. Check prerequisites. Identify risks and unknowns.  
**Exit:** Risk register populated, capabilities selected.

### PLAN
**Entry:** Risks identified, approach selected.  
**Work:** Design approach. Define features with dependencies. Identify parallel workstreams. Check feasibility.  
**Exit:** Feature breakdown with dependency graph.

### BUILD
**Entry:** Plan ready.  
**Work:** Prepare artifacts. Invoke capabilities. Create test harness.  
**Exit:** Prerequisites ready.

### EXECUTE
**Entry:** Prerequisites ready.  
**Work:** Execute features in dependency order. Mark ISCs as they pass. Revise ISA if stuck.  
**Exit:** Features executed, ISCs marked pass/fail.

### VERIFY
**Entry:** All features attempted.  
**Work:** Test every ISC with concrete evidence. Cross-vendor audit at E4/E5. If fail → revise and re-execute.  
**Exit:** Every ISC verified pass/fail with evidence.

### LEARN
**Entry:** All ISCs verified.  
**Work:** Record changelog entry (conjecture → refuted-by → learned → criterion-now). Capture satisfaction. Persist learnings. Reconcile ephemeral files.  
**Exit:** Learning recorded, ISA finalized.

## Effort Tiers

| Tier | Budget | Sections | Min ISCs | Thinking | Audit |
|------|--------|----------|----------|----------|-------|
| E1 | <90s | Goal + Criteria | 0 | — | — |
| E2 | <15min | 4 core sections | ≥16 | Optional | — |
| E3 | <60min | 8 core sections | ≥32 | Required | — |
| E4 | <2h | All 12 | ≥128 | Required | Cross-vendor |
| E5 | <2h+ | All 12 + Interview | ≥256 | Required | Cross-vendor |
