---
name: pai-thinking
description: "PAI v5.0 Thinking capabilities bundle — 19 structured thinking methods for structured reasoning. USE WHEN the Algorithm's THINK phase selects a capability, or when the user asks for structured analysis (first principles, systems thinking, red team, council, etc.). NOT FOR unstructured brainstorming or standard tool use."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, reasoning, analysis, methodology]
    related_skills: [pai-algorithm, deep-research, pai-first-principles, pai-root-cause-analysis]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-thinking skill"}' \
  > /dev/null 2>&1 &
```


# Thinking Capabilities (Hermes Port)

## Overview

A library of 19 named thinking capabilities that the Algorithm invokes during OBSERVE and THINK phases. Each capability has a defined methodology and output format.

## Capability Catalog

### 1. IterativeDepth — Multi-angle exploration
**When:** Problem needs examination through different lenses.
**Method:** 2-8 sequential passes through systematically different perspectives. Each pass uses a different lens. Synthesize findings across passes.
**Techniques:** Hermeneutic Circle, Six Thinking Hats, Dialectical, Historical, Comparative, Ethical, Practical, Aesthetic.

### 2. ApertureOscillation — Scope switching
**When:** Need to see both tactical details and strategic implications.
**Method:** Three-pass oscillation: narrow/tactical → wide/strategic → synthesis. Surface design tensions invisible at any single zoom level.
**Output:** Design tensions, scope recommendations, coherence assessments.

### 3. FirstPrinciples — Physics-based reasoning
**When:** Need to decompose to irreducible truths, not rely on analogy.
**Method:** DECONSTRUCT → CHALLENGE → RECONSTRUCT. Strip away assumptions until only fundamental truths remain. Rebuild from those truths.
**Context:** Musk methodology. Harder than analogy but yields original solutions.

### 4. SystemsThinking — Structural analysis
**When:** Problem has feedback loops, delays, unintended consequences.
**Method:** Use Iceberg Model (events → patterns → structure → mental models). Build causal loop diagrams. Identify archetypes and leverage points.
**Reference:** Meadows, Senge, Forrester.

### 5. RootCauseAnalysis — Incident investigation
**When:** Something failed and you need to find the actual cause.
**Method:** 5 Whys, Fishbone, Fault Tree, Kepner-Tregoe, Postmortem. Sequence: define event → collect data → identify causes → find root → recommend fix.
**Reference:** Toyota Production System, Google SRE.

### 6. Council — Multi-agent debate
**When:** Decision has meaningful trade-offs and you need genuine intellectual friction.
**Method:** Compose 4-6 custom agents with different perspectives. Run 3 rounds of debate. Each round gives agents access to previous rounds. Synthesize.
**Two modes:** DEBATE (3 rounds, thorough) and QUICK (1 round, fast).

### 7. RedTeam — Adversarial analysis
**When:** Need to stress-test an idea, strategy, or plan.
**Method:** 32 parallel expert agents attack the target from every angle. 5-phase: ParallelAttack → Recon → Exploit → Escalate → Persist. Rank findings with remediation.
**Output:** Ranked findings with remediation paths.

### 8. Science — Scientific method
**When:** Need rigorous hypothesis → experiment → measure → iterate.
**Method:** DefineGoal → GenerateHypotheses → DesignExperiment → Measure → Analyze → Iterate. Three scales: micro (minutes), meso (hours), macro (days).

### 9. BeCreative — Divergent ideation
**When:** Need novel ideas, not incremental improvements.
**Method:** Verbalized Sampling + extended thinking with research-backed diversity mechanisms. 7 workflows including Standard, Maximum, TreeOfThoughts, DomainSpecific.
**Research:** Produces demonstrably more diverse outputs.

### 10. Ideate — Evolutionary ideation
**When:** Need to evolve a rough idea into something refined.
**Method:** 9-phase loop: CONSUME → DREAM → DAYDREAM → CONTEMPLATE → STEAL → MATE → TEST → EVOLVE → META-LEARN. Integrates IterativeDepth, RedTeam, Council internally.

### 11. BitterPillEngineering — Over-prompt audit
**When:** Auditing whether an instruction set contains unnecessary rules.
**Method:** Five Questions per rule. Would a smarter model need this? Classify: CUT / RESOLVE / MERGE / EVALUATE / SHARPEN / MOVE / KEEP.
**Output:** Token savings estimates per rule.

### 12. Evals — Evaluation framework
**When:** Need to design evaluation criteria and scoring.
**Method:** Three grader types (code-based, model-based, human). pass@k/pass^k scoring. Multi-turn evaluation. Capability and regression modes.

### 13. WorldThreatModel — Long-horizon risk
**When:** Decision with multi-year implications.
**Method:** Stress-test against 11 time horizons (6 months to 50 years). Orchestrates RedTeam, FirstPrinciples, Council internally. Three tiers: Fast/Standard/Deep.

### 14. ContextSearch — Cold-start recovery
**When:** Starting a new session and need to recover context.
**Method:** 2-phase search across session registry, work directories, and ISAs. `/context-search` and `/cs` commands. Finds what was being worked on.

### 15. ISA — Ideal State Artifact (see pai-isa skill)
**When:** Need to scaffold, check, or reconcile an ISA.
**Method:** Invokes the pai-isa skill's workflows.

### 16. Advisor — Expert consultation
**When:** Need expert perspective on a domain-specific question.
**Method:** Assume the persona of a domain expert. Provide structured advice with reasoning, alternatives, and caveats.

### 17. ReReadCheck — Verification read
**When:** About to act on something, need to verify comprehension.
**Method:** Re-read the source material. Check for misinterpretations. Confirm understanding before proceeding.

### 18. FeedbackMemoryConsult — Past lessons
**When:** Repeating a type of task that has been done before.
**Method:** Check MEMORY/LEARNING/ for relevant patterns. Check MEMORY/KNOWLEDGE/ for entities. Apply past lessons to current work.

## Gotchas

- **Not a replacement for domain expertise.** Thinking capabilities help structure reasoning, but they don't substitute for domain knowledge. Use them as frameworks, not answers.
- **Don't run all 19.** Select 1-3 capabilities appropriate to the task. Running all 19 is context wasteful.
- **Council requires careful persona selection.** Generic personas produce generic debate. Invest time in crafting specific, contrasting perspectives.
- **RedTeam at full scale (32 agents) is expensive.** Use Quick mode for most tasks. Only run full ParallelAnalysis on high-stakes decisions.
- **FirstPrinciples is hard to do well.** Many attempts at first principles reasoning produce false decompositions. Challenge your own decomposition before rebuilding.
- **WorldThreatModel produces long outputs.** Each horizon generates a scenario. At 11 horizons the document is substantial. Use Standard tier unless the decision is existential.
- **BitterPill is a meta-audit.** It's for evaluating instructions, not for solving problems. Don't use it as a thinking tool — use it as a quality gate.

## Execution Log

After every thinking capability invocation:
```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-thinking","capability":"CAPABILITY_NAME","status":"ok","duration_s":SECONDS}' >> ~/.hermes/pai/MEMORY/SKILLS/execution.jsonl
```
