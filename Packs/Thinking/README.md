---
name: Thinking
pack-id: danielmiessler-thinking-v1.0.0
version: 1.0.0
author: danielmiessler
description: Multi-mode analytical and creative thinking — first principles decomposition, iterative depth analysis, creative brainstorming, multi-agent council debates, adversarial red teaming, world threat modeling, and scientific hypothesis testing
type: skill
purpose-type: [thinking, analysis, creativity, decision-making, red-teaming]
platform: claude-code
dependencies: []
keywords: [first-principles, iterative-depth, creative, brainstorm, council, debate, red-team, adversarial, threat-model, science, hypothesis, tree-of-thoughts, mental-models]
---

# Thinking

> Seven distinct thinking modes in one unified skill -- from first principles decomposition to adversarial red teaming to scientific hypothesis testing, routed automatically based on what you need.

---

## The Problem

Complex problems require different kinds of thinking. A startup pivot needs first principles decomposition. A product decision needs multi-perspective council debate. A security architecture needs adversarial red teaming. A mysterious production bug needs scientific hypothesis testing. But when you bring these problems to an AI, you get a single mode of response -- helpful but generic, without the depth or structure that serious thinking demands. You end up:

- **Getting surface-level answers** -- the AI responds helpfully but never shifts into the right analytical gear for the problem type
- **Missing perspectives** -- no structured way to get adversarial views, creative alternatives, or multi-stakeholder debate
- **Skipping rigor** -- jumping to solutions without decomposing assumptions, testing hypotheses, or stress-testing conclusions
- **Reinventing frameworks** -- asking for "think about this differently" without a systematic methodology behind it
- **Mixing modes** -- wanting creative brainstorming but getting analytical critique, or wanting critique but getting brainstorming

The fundamental issue: thinking is not one skill. It is at least seven distinct cognitive modes, each with its own methodology, and an AI needs explicit structure to shift between them.

---

## The Solution

The Thinking skill provides seven distinct thinking modes, each with its own methodology, workflows, and output format:

1. **FirstPrinciples** -- Decompose problems to fundamental axioms, challenge inherited assumptions, and reconstruct solutions from verified truths. Three workflows: Deconstruct, Challenge, Reconstruct.

2. **IterativeDepth** -- Multi-angle deep exploration that examines a topic through multiple lenses (technical, economic, social, historical, etc.) with progressive depth. Grounded in scientific foundations for structured investigation.

3. **BeCreative** -- Divergent idea generation with six workflows ranging from standard creativity to maximum creativity to tree-of-thoughts exploration. Includes domain-specific creativity, technical creativity with Gemini integration, and research-backed creative principles.

4. **Council** -- Multi-agent collaborative-adversarial debate where distinct council members with different expertise and perspectives deliberate on a question. Visible transcripts show agents responding to each other. Two modes: full Debate and Quick consensus.

5. **RedTeam** -- Adversarial validation that stress-tests ideas, plans, and architectures. Two workflows: AdversarialValidation (devil's advocate attack) and ParallelAnalysis (simultaneous multi-angle critique). Distinct from Council in being purely adversarial rather than collaborative.

6. **WorldThreatModelHarness** -- World model and threat analysis for testing ideas against reality. Three workflows: TestIdea (validate an investment, strategy, or belief against world models), UpdateModels (revise world models based on new information), ViewModels (inspect current world model state). Operates across configurable time horizons.

7. **Science** -- Hypothesis-test-analyze cycles for systematic problem-solving. Nine workflows covering the full scientific method: DefineGoal, GenerateHypotheses, DesignExperiment, MeasureResults, AnalyzeResults, Iterate, FullCycle, QuickDiagnosis, and StructuredInvestigation. The meta-skill that governs all others.

The top-level SKILL.md routes requests to the right thinking mode based on keyword matching. Each mode has its own SKILL.md, workflows, and supporting documents.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level routing to thinking modes based on request pattern |
| FirstPrinciples skill | `src/FirstPrinciples/SKILL.md` | First principles decomposition and reconstruction |
| FirstPrinciples workflows | `src/FirstPrinciples/Workflows/` | 3 workflows: Deconstruct, Challenge, Reconstruct |
| IterativeDepth skill | `src/IterativeDepth/SKILL.md` | Multi-angle deep exploration through progressive lenses |
| IterativeDepth workflows | `src/IterativeDepth/Workflows/` | 1 workflow: Explore |
| IterativeDepth references | `src/IterativeDepth/` | Scientific foundation and lens definitions |
| BeCreative skill | `src/BeCreative/SKILL.md` | Divergent creative thinking and idea generation |
| BeCreative workflows | `src/BeCreative/Workflows/` | 6 workflows: StandardCreativity, MaximumCreativity, TreeOfThoughts, IdeaGeneration, DomainSpecific, TechnicalCreativityGemini3 |
| BeCreative resources | `src/BeCreative/` | Principles, examples, templates, research foundation, and asset templates |
| Council skill | `src/Council/SKILL.md` | Multi-agent debate with visible transcripts |
| Council workflows | `src/Council/Workflows/` | 2 workflows: Debate, Quick |
| Council references | `src/Council/` | Council member definitions, output format, round structure |
| RedTeam skill | `src/RedTeam/SKILL.md` | Adversarial validation and stress testing |
| RedTeam workflows | `src/RedTeam/Workflows/` | 2 workflows: AdversarialValidation, ParallelAnalysis |
| RedTeam references | `src/RedTeam/` | Philosophy and integration guides |
| WorldThreatModelHarness skill | `src/WorldThreatModelHarness/SKILL.md` | World model and threat analysis |
| WorldThreatModelHarness workflows | `src/WorldThreatModelHarness/Workflows/` | 3 workflows: TestIdea, UpdateModels, ViewModels |
| WorldThreatModelHarness references | `src/WorldThreatModelHarness/` | Model template and output format |
| Science skill | `src/Science/SKILL.md` | Hypothesis-test-analyze cycles |
| Science workflows | `src/Science/Workflows/` | 9 workflows: DefineGoal, GenerateHypotheses, DesignExperiment, MeasureResults, AnalyzeResults, Iterate, FullCycle, QuickDiagnosis, StructuredInvestigation |
| Science references | `src/Science/` | Methodology, protocol, examples, and templates |

**Summary:**
- **Thinking modes:** 7 (FirstPrinciples, IterativeDepth, BeCreative, Council, RedTeam, WorldThreatModelHarness, Science)
- **Workflows:** 26 across all modes
- **Supporting documents:** 15+ reference files (principles, methodology, templates, examples)
- **Dependencies:** None (works standalone)

---

## What Makes This Different

This sounds similar to prompt engineering techniques like "think step by step" or "consider multiple perspectives." What makes this approach different?

The Thinking skill is not a collection of prompt tricks -- it is seven complete cognitive methodologies, each with structured workflows, defined output formats, and supporting reference documents. When you ask for a council debate, the skill instantiates distinct council members with different expertise, runs multiple rounds where members respond to each other's arguments, and produces a visible transcript with a synthesized verdict. When you ask for scientific investigation, you get nine discrete workflow stages from hypothesis generation through experiment design to result analysis. The difference is depth and structure, not just instruction.

- Seven distinct modes, not one generic "think harder" approach
- Each mode has its own workflows, not just a single prompt
- Council debates produce actual multi-agent transcripts with cross-reference
- RedTeam is purely adversarial; Council is collaborative-adversarial -- they serve different purposes
- Science mode covers the full scientific method in nine discrete stages
- Automatic routing: describe what you need and the right mode activates

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "decompose this problem from first principles" | Routes to FirstPrinciples -- runs Deconstruct workflow to identify axioms |
| "challenge the assumptions in this plan" | Routes to FirstPrinciples -- runs Challenge workflow |
| "explore this topic in depth" | Routes to IterativeDepth -- runs Explore with progressive lens analysis |
| "be creative about solving this" | Routes to BeCreative -- runs StandardCreativity or MaximumCreativity workflow |
| "brainstorm 20 ideas for this" | Routes to BeCreative -- runs IdeaGeneration workflow |
| "tree of thoughts on this decision" | Routes to BeCreative -- runs TreeOfThoughts workflow |
| "council debate on whether we should pivot" | Routes to Council -- runs Debate with multiple council members |
| "quick consensus on this approach" | Routes to Council -- runs Quick workflow for fast multi-perspective check |
| "red team this architecture" | Routes to RedTeam -- runs AdversarialValidation workflow |
| "stress test this business plan" | Routes to RedTeam -- runs ParallelAnalysis workflow |
| "test this investment idea against my world model" | Routes to WorldThreatModelHarness -- runs TestIdea workflow |
| "update my world models with this new information" | Routes to WorldThreatModelHarness -- runs UpdateModels workflow |
| "figure out why the tests are failing" | Routes to Science -- runs QuickDiagnosis workflow |
| "design an experiment to test this hypothesis" | Routes to Science -- runs DesignExperiment workflow |
| "full scientific investigation of this problem" | Routes to Science -- runs FullCycle workflow |

---

## Example Usage

### First Principles Decomposition

```
User: decompose the problem of remote team productivity from first principles

AI responds:
Running the Deconstruct workflow in the FirstPrinciples skill...

[Identifies claimed truths about remote productivity]
[Traces each claim to its fundamental axioms]
[Separates verified truths from inherited assumptions]
[Lists axioms, assumptions, and reconstruction opportunities]

Axioms identified: 7
Assumptions challenged: 4
Key finding: "Synchronous communication is necessary for collaboration"
is an inherited assumption, not an axiom...
```

### Council Debate

```
User: council debate on whether we should build vs buy for authentication

AI responds:
Running the Debate workflow in the Council skill...

Round 1:
  [Security Expert]: Build gives control over auth flows...
  [Engineering Lead]: Buy saves 6 months of development...
  [Product Manager]: Users don't care about auth implementation...
  [CTO]: Technical debt from custom auth compounds over years...

Round 2 (responses to each other):
  [Security Expert, responding to Engineering Lead]: The 6 months saved
  assumes no integration issues with the vendor...
  ...

Synthesis: 3-1 in favor of buy, with strong caveat on vendor lock-in.
Recommended: Buy with abstraction layer for future portability.
```

### Scientific Diagnosis

```
User: figure out why our API latency spiked after the deploy

AI responds:
Running the QuickDiagnosis workflow in the Science skill...

Hypothesis 1: New database query introduced in the deploy
Hypothesis 2: Connection pool exhaustion under load
Hypothesis 3: External service dependency degradation

Experiment: Compare query execution times before/after deploy
Result: Query execution normal, but connection wait times 10x higher

Diagnosis: Connection pool sized for old traffic patterns.
New endpoint increased concurrent connections beyond pool capacity.
Fix: Increase pool size from 20 to 50, add connection timeout monitoring.
```

---

## Configuration

No configuration required.

The Thinking skill is purely analytical -- it does not read or write persistent state, connect to external services, or require API keys. All seven modes work immediately after installation.

Optional configuration:

| Configuration | Location | Purpose |
|--------------|----------|---------|
| Skill customizations | `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/{ModeName}/` | Per-user preferences and overrides for each thinking mode |
| World models | Managed by WorldThreatModelHarness | Persistent world model state for TestIdea and UpdateModels workflows |

---

## Customization

### Recommended Customization

No customization needed -- all seven thinking modes work as-is with sensible defaults.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Council member definitions | `Council/CouncilMembers.md` | Change expertise and perspectives of debate participants |
| Council round structure | `Council/RoundStructure.md` | Modify how many rounds and what structure debates follow |
| Creative principles | `BeCreative/Principles.md` | Adjust creativity guidelines and constraints |
| Creative templates | `BeCreative/Templates.md` | Modify idea generation output formats |
| Red team philosophy | `RedTeam/Philosophy.md` | Adjust adversarial validation approach |
| Science methodology | `Science/METHODOLOGY.md` | Modify scientific method stages |
| World model template | `WorldThreatModelHarness/ModelTemplate.md` | Change world model structure |
| Iterative depth lenses | `IterativeDepth/TheLenses.md` | Add or modify analysis lenses |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The recognition that thinking is not one skill but many distinct cognitive modes, each deserving its own structured methodology

---

## Related Work

- **PAI Algorithm** -- The structured workflow system that can invoke Thinking modes during complex multi-phase work
- **PAI Agents Skill** -- Custom agent composition that can leverage Thinking modes for specialized analysis

---

## Works Well With

- **Security Pack** -- Red Team and World Threat Model modes naturally complement security assessment workflows
- **Telos Pack** -- First Principles and Council modes enhance TELOS project analysis and decision-making

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Seven thinking modes: FirstPrinciples, IterativeDepth, BeCreative, Council, RedTeam, WorldThreatModelHarness, Science
- Unified routing from top-level SKILL.md
- 26 workflows across all modes
- 15+ supporting reference documents (principles, methodology, templates, examples)
- Council debates with visible multi-agent transcripts
- Science mode covering full scientific method in nine stages
- Tree-of-thoughts and maximum creativity workflows
- Adversarial validation distinct from collaborative debate
- World model management with time horizon analysis
