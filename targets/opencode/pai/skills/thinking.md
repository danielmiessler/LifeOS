# PAI Thinking Capabilities — Complete Reference

> Closed set of 19 named thinking capabilities that the Algorithm may invoke during OBSERVE and THINK phases. Each capability has a defined methodology, invocation triggers, and output format.
>
> **CRITICAL:** Only capabilities from this list may be invoked. Any phantom capability (anything outside this list) is a CRITICAL FAILURE.

---

## 1. IterativeDepth

**Purpose:** Multi-angle exploration of a problem by running 2-8 sequential passes from systematically different scientific lenses.

**Trigger:** Hard problems where a single pass may miss edge cases or requirements. Default thinking capability for E3+ tasks.

**Methodology:**
1. Select 2-8 distinct analytical lenses (economic, technical, user, security, business, ethical, operational, temporal)
2. Run one pass per lens, each exploring the problem from that perspective
3. Synthesize findings across all passes into consolidated requirements
4. Surface tensions and contradictions between lens perspectives

**Output:** Multi-perspective requirements document with cross-lens tension map.

---

## 2. ApertureOscillation

**Purpose:** 3-pass scope oscillation — holds the question constant while shifting tactical → strategic → synthesis envelopes.

**Trigger:** Design tensions invisible at any single zoom level. Architecture or product decisions before committing.

**Methodology:**
1. **Pass 1 — Tactical (narrow aperture):** What's the immediate detail? The specific implementation concern?
2. **Pass 2 — Strategic (wide aperture):** What's the broader context? The system-level implications?
3. **Pass 3 — Synthesis (oscillating aperture):** Where do tactical and strategic conflict? What's the resolution?

**Output:** Zoom-level analysis with cross-level conflict resolution.

---

## 3. FirstPrinciples

**Purpose:** Physics-style deconstruct → challenge → rebuild reasoning (Musk methodology). Breaking through analogical reasoning when a problem feels stuck.

**Trigger:** Problems where existing approaches feel stale or suboptimal. Breaking through precedent-based thinking.

**Methodology:**
1. **Deconstruct:** Strip the problem to its fundamental truths — what is known to be true, independent of existing solutions
2. **Challenge:** Question every assumption. "Is this actually a constraint or just convention?"
3. **Rebuild:** Reason upward from first principles to a novel solution

**Output:** First-principles decomposition with reconstructed solution.

---

## 4. SystemsThinking

**Purpose:** Structural analysis grounded in Donella Meadows, Senge, Forrester, Ackoff frameworks.

**Trigger:** When the same problem keeps recurring. Mapping feedback loops before changing a complex system.

**Methodology:**
1. **Iceberg Model:** Events → Patterns → Structures → Mental Models
2. **Causal Loop Diagrams:** Identify reinforcing and balancing feedback loops
3. **Leverage Points:** Find where small changes produce large effects (Meadows' 12 places to intervene)

**Output:** Systems model with causal loops and identified leverage points.

---

## 5. RootCauseAnalysis

**Purpose:** Five workflows grounded in TPS, Ishikawa, James Reason, Apollo, Google SRE methodologies.

**Trigger:** Incident postmortems, recurring failures, structured retrospectives.

**Methodologies (5 choices):**
- **5 Whys (TPS):** Iterative "why" questioning until root cause emerges
- **Fishbone (Ishikawa):** Category-based cause mapping (People, Process, Technology, etc.)
- **Apollo:** Systematic cause-and-effect tree with evidence nodes
- **Swiss Cheese (James Reason):** Layered failure analysis — how did defenses fail?
- **Blameless Postmortem (Google SRE):** Incident timeline + contributing factors + action items

**Output:** Root cause statement with evidence chain and corrective actions.

---

## 6. Council

**Purpose:** Multi-agent collaborative debate with visible round-by-round transcripts and genuine intellectual friction.

**Trigger:** Decisions that benefit from disagreement made visible — not consensus, but multiple expert lenses arguing it out. E4/E5 tasks.

**Methodology:**
1. Define the question or proposition
2. Assign 3-5 expert personas with distinct perspectives (e.g., Architect, Engineer, User, Security, Business)
3. Each persona argues their position in sequence
4. Round 2: Personas respond to each other's arguments
5. Round 3: Synthesis — identify points of agreement, disagreement, and unresolved tensions

**Output:** Round-by-round debate transcript with synthesis of agreements, disagreements, and open questions.

---

## 7. RedTeam

**Purpose:** Adversarial stress-testing of ideas, strategies, plans using multiple attacker/opposition perspectives.

**Trigger:** Pre-mortem on a strategy or product launch. Finding failure modes before users do. E4+ tasks.

**Methodology:**
1. Define the target (plan, design, architecture, strategy)
2. Assume 32 parallel expert adversarial personas (engineers, pentesters, users, competitors)
3. Each adversarial perspective probes for failure modes
4. Categorize findings by severity and likelihood
5. Generate mitigation recommendations for each identified risk

**Output:** Adversarial assessment with ranked failure modes and mitigations.

---

## 8. Science

**Purpose:** The scientific method as universal problem-solving framework.

**Trigger:** Forcing hypothesis-plurality on hard problems. Designing falsifiable tests instead of confirming intuitions.

**Methodology:**
1. **DefineGoal:** What question are we answering?
2. **GenerateHypotheses:** ≥3 alternative hypotheses (never fewer than 3)
3. **DesignExperiment:** For each hypothesis, define a falsifiable test
4. **MeasureResults:** Run the test and measure outcome
5. **Conclude:** Which hypotheses survived? Which were falsified?

**Output:** Multi-hypothesis analysis with experiment design and falsification results.

---

## 9. BeCreative

**Purpose:** Verbalized Sampling + extended thinking for divergent ideation; expands seed corpora into diverse N-example datasets.

**Trigger:** When a single answer feels too predictable. Generating internally-diverse candidates.

**Methodology:**
1. Take the seed input (prompt, corpus, constraint set)
2. Generate N diverse candidates with explicit variation dimensions
3. Each candidate must be internally distinct from others (not superficial variation)
4. Optional: Rate candidates along defined axes (novelty, feasibility, impact)

**Output:** N internally-diverse candidates with differentiation rationale.

---

## 10. Ideate

**Purpose:** 9-phase evolutionary idea generation for long-form ideation.

**Trigger:** Long-form idea generation when single-pass ideation runs dry. Producing genuinely novel angles.

**Methodology (9 phases):**
1. **Consume:** Absorb the domain input
2. **Dream:** Unconstrained wish-list ideas
3. **Daydream:** Connect dream ideas to reality
4. **Contemplate:** Deep reflection on daydream connections
5. **Steal:** Cross-domain analogies and borrowed concepts
6. **Mate:** Combine stolen concepts into hybrids
7. **Test:** Stress-test hybrids against constraints
8. **Evolve:** Refine survivors
9. **Meta-Learn:** What did the process reveal?

**Output:** Evolved idea set with provenance trail across all 9 phases.

---

## 11. BitterPillEngineering

**Purpose:** Audits any AI instruction set for over-prompting using the test: "Would a smarter model make this rule unnecessary?"

**Trigger:** Trimming SKILL.md, agent prompts, and system instructions before release. Catching ceremony bloat.

**Methodology:**
1. Examine every prescriptive instruction in the target
2. For each instruction, ask: "Would a sufficiently intelligent model infer this naturally from context?"
3. If yes → remove the instruction (it's ceremony, not guidance)
4. If no → keep it (it carries unique system knowledge)
5. Repeat until no more instructions can be removed

**Output:** Reduced instruction set with removed items cataloged and rationale documented.

---

## 12. Evals

**Purpose:** AI agent evaluation framework with code/model/human graders and pass@k / pass^k scoring.

**Trigger:** Testing whether a skill, agent, or prompt actually works. Building eval suites.

**Methodology:**
1. Define evaluation rubric (pass/fail criteria, scoring dimensions)
2. Build or select test cases
3. Run the target against test cases with N attempts
4. Score using code graders, LLM-as-judge, or human review
5. Compute pass@k (at least one success in k attempts) and pass^k (all k must succeed)

**Output:** Evaluation report with scores, failure analysis, and improvement recommendations.

---

## 13. WorldThreatModel

**Purpose:** Persistent world-model harness stress-testing ideas against 11 time horizons (6 months to 50 years).

**Trigger:** Strategy decisions with long tails. Investment thinking. Resilience planning.

**Methodology:**
1. Define the idea/strategy/decision being tested
2. Project across 11 time horizons: 6mo, 1yr, 2yr, 3yr, 5yr, 7yr, 10yr, 15yr, 25yr, 35yr, 50yr
3. For each horizon, identify: geopolitical shifts, technology changes, economic changes, social changes
4. For each shift, assess: does it strengthen, weaken, or invalidate the idea?
5. Synthesize into resilience profile

**Output:** Multi-horizon threat/resilience profile with decision recommendations.

---

## 14. Fabric Patterns

**Purpose:** Execute specialized prompt patterns from the Fabric library for structured analysis.

**Trigger:** Specific analysis needs — wisdom extraction, summarization, threat modeling, pattern recognition.

**Methodology:**
1. Select the appropriate Fabric pattern for the task (extract_wisdom, summarize, create_threat_model, etc.)
2. Apply the pattern's methodology to the input material
3. Produce structured output in the pattern's prescribed format

**Key patterns referenced:**
- `extract_wisdom` — Deep insight extraction from content
- `summarize` — Concise summary generation
- `create_5_sentence_summary` — Ultra-concise summary
- `create_threat_model` — Structured threat analysis

**Output:** Pattern-specific structured output.

---

## 15. ContextSearch

**Purpose:** 2-phase parallel scan of the session registry, work directories, ISAs, and session names.

**Trigger:** Cold-starting a new session on existing work. Resuming a paused project. "What was I doing on X?"

**Methodology:**
1. **Phase 1 — Parallel scan:** Search MEMORY/WORK/ for recent/scoped ISAs, MEMORY/STATE/work.json for active sessions, MEMORY/KNOWLEDGE/ for related entities
2. **Phase 2 — Targeted retrieval:** Based on Phase 1 results, load the most relevant files into context

**Output:** Context summary with active sessions, related work, and relevant knowledge.

---

## 16. ISA (Ideal State Artifact)

**Purpose:** Owns the ISA primitive — scaffolding, completeness checking, and reconciliation.

**Trigger:** Every ALGORITHM-mode task. Building or editing an Ideal State Artifact.

**Methodology:**
1. **Scaffold:** Generate ISA from user prompt at specified tier, producing tier-appropriate sections with initial ISCs
2. **CheckCompleteness:** Verify ISA has required sections for its tier, minimum ISC count, Anti-ISC present
3. **Reconcile:** Merge derived ISA views back into master ISA using stable ISC IDs (latest timestamp wins)

**Output:** Scaffold → complete ISA. CheckCompleteness → gap report. Reconcile → merged ISA.

See `ISA.md` for the complete template.

---

## 17. Advisor

**Purpose:** Expert consultation capability — invoke a domain expert persona for targeted advice.

**Trigger:** When specialized domain expertise is needed. Commitment-boundary validation.

**Methodology:**
1. Identify the domain expertise needed
2. Define the specific question or decision point
3. Consult with the expert persona, providing full context
4. Capture recommendation, rationale, and confidence level
5. Surface conflicts if advisor recommendation contradicts empirical evidence

**Output:** Expert recommendation with rationale and confidence assessment.

---

## 18. ReReadCheck

**Purpose:** Re-read and verify content for accuracy, completeness, and errors before finalization.

**Trigger:** Before declaring any user-facing artifact complete. Last-chance verification.

**Methodology:**
1. Take a fresh pass over the content as if seeing it for the first time
2. Check for: factual errors, logical gaps, missing edge cases, unclear language
3. Verify against all ISCs that the content is meant to satisfy
4. Flag any issues found

**Output:** Verification report — either "clean" or list of issues requiring correction.

---

## 19. FeedbackMemoryConsult

**Purpose:** Consult past feedback, satisfaction signals, and learning patterns before starting related work.

**Trigger:** Starting a task similar to previous work. Checking if past patterns apply.

**Methodology:**
1. Search LEARNING/ for patterns matching the current task domain
2. Search KNOWLEDGE/ for relevant entities and past work
3. Identify applicable lessons, warnings, and recommendations from past experience
4. Summarize what to repeat and what to avoid

**Output:** Past-experience briefing with applicable patterns and warnings.

---

## Using Thinking Capabilities

### Selection Guide

| Scenario | Recommended Capabilities |
|----------|-------------------------|
| Understanding a hard problem | IterativeDepth, FirstPrinciples, ContextSearch |
| Strategy or architecture | ApertureOscillation, SystemsThinking, Council |
| Finding root cause | RootCauseAnalysis, Science |
| Generating novel ideas | BeCreative, Ideate |
| Validating before committing | RedTeam, Council, Advisor |
| Checking completeness | ReReadCheck, BitterPillEngineering |
| Learning from past | FeedbackMemoryConsult |
| Evaluating quality | Evals |
| Long-range planning | WorldThreatModel |
| Structured analysis | Fabric Patterns |
| Defining "done" | ISA |

### Invocation Pattern

When invoking a thinking capability during OBSERVE or THINK phase:

```
Invoke: <Capability Name>
Input: <the question, problem, or artifact to analyze>
Context: <relevant ISCs, constraints, principles from ISA>
Output: <produce the capability's specified output format>
```

### Tier Requirements

| Tier | Minimum Thinking Capabilities |
|------|------------------------------|
| E1 | None |
| E2 | Optional |
| E3 | ≥2 |
| E4 | ≥4 |
| E5 | ≥6 |
