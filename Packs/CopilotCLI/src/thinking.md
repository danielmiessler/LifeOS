# Thinking — Multi-Mode Analytical & Creative Reasoning

**Trigger conditions:** first principles, decompose, deconstruct, reconstruct, challenge assumptions,
iterative depth, multi-angle, deep exploration, be creative, brainstorm, divergent ideas, tree of thoughts,
maximum creativity, idea generation, technical creativity, council, debate, perspectives, red team, critique,
stress test, adversarial validation, devil's advocate, think about, figure out, experiment, iterate, science,
hypothesis, define goal, design experiment, quick diagnosis, structured investigation, full cycle.

---

## Workflow Routing

| Request Pattern | Section |
|---|---|
| First principles, decompose, challenge assumptions, rebuild from scratch | [FirstPrinciples](#firstprinciples) |
| Iterative depth, deep exploration, multi-angle, multiple perspectives | [IterativeDepth](#iterativedepth) |
| Be creative, brainstorm, divergent ideas, tree of thoughts | [BeCreative](#becreative) |
| Council, debate, weigh options, multiple viewpoints | [Council](#council) |
| Red team, attack idea, critique, stress test, devil's advocate | [RedTeam](#redteam) |
| Think about, experiment, iterate, hypothesis, structured investigation | [Science](#science) |

---

## FirstPrinciples

Foundational reasoning methodology based on Elon Musk's physics-based thinking framework. Deconstructs
problems to fundamental truths rather than reasoning by analogy.

**Reasoning by Analogy** (default, often wrong):
- "How did we solve something similar?" / "What do others do?"
- Copies existing solutions with slight variations

**Reasoning from First Principles** (this approach):
- "What are the fundamental truths here?" / "What is this actually made of?"
- Rebuilds solutions from irreducible facts

### The 3-Step Framework

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: DECONSTRUCT                                    │
│  "What is this really made of?"                         │
│  Break down to constituent parts and fundamental truths │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 2: CHALLENGE                                      │
│  "Is this a real constraint or an assumption?"          │
│  Classify each element as hard/soft constraint          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  STEP 3: RECONSTRUCT                                    │
│  "Given only the truths, what's optimal?"               │
│  Build new solution from fundamentals, ignoring form    │
└─────────────────────────────────────────────────────────┘
```

### Key Questions

**Deconstruction:**
- What is this actually made of? What are the constituent parts?
- What is the actual cost/value of each part?
- What would a physicist say about this?

**Challenge:**
- Is this a hard constraint (physics/reality) or soft constraint (policy/choice)?
- What if we removed this constraint entirely?
- Who decided this was a constraint and why?
- What evidence supports this assumption?

**Reconstruction:**
- If we started from scratch with only the fundamental truths, what would we build?
- What field has solved an analogous problem differently?
- Are we optimizing function or form?
- What's the simplest solution that satisfies only the hard constraints?

### Constraint Classification

| Type | Definition | Example | Can Change? |
|------|------------|---------|-------------|
| **Hard** | Physics/reality | "Data can't travel faster than light" | No |
| **Soft** | Policy/choice | "We always use REST APIs" | Yes |
| **Assumption** | Unvalidated belief | "Users won't accept that UX" | Maybe false |

**Rule**: Only hard constraints are truly immutable. Soft constraints and assumptions should be challenged.

### Output Format

```markdown
## First Principles Analysis: [Topic]

### Deconstruction
- **Constituent Parts**: [List fundamental elements]
- **Actual Values**: [Real costs/metrics, not market prices]

### Constraint Classification
| Constraint | Type | Evidence | Challenge |
|------------|------|----------|-----------|
| [X] | Hard/Soft/Assumption | [Why] | [What if removed?] |

### Reconstruction
- **Fundamental Truths**: [Only the hard constraints]
- **Optimal Solution**: [Built from fundamentals]
- **Form vs Function**: [Are we optimizing the right thing?]

### Key Insight
[One sentence: what assumption was limiting us?]
```

### Examples

**Architecture Decision:** "We need microservices because that's how modern apps are built"
1. Deconstruct: What does this app actually need? (team size, scale, complexity)
2. Challenge: Is "microservices" a hard constraint? No — it's reasoning by analogy
3. Reconstruct: Given a 3-person team and moderate scale, a modular monolith optimizes for actual constraints

**Cost Optimization:** "Cloud hosting costs $10,000/month — that's just what it costs"
1. Deconstruct: What are we actually paying for? (compute, storage, bandwidth, managed services)
2. Challenge: Is managed Kubernetes a hard requirement? Is this region required?
3. Reconstruct: Actual compute needs = $2,000. The other $8,000 is convenience we're choosing to pay for

### Principles

1. **Physics First** — Real constraints come from physics/reality, not convention
2. **Function Over Form** — Optimize what you're trying to accomplish, not how it's traditionally done
3. **Question Everything** — Every assumption is guilty until proven innocent
4. **Cross-Domain Synthesis** — Solutions from unrelated fields often apply
5. **Rebuild, Don't Patch** — When assumptions are wrong, start fresh rather than fixing

### Anti-Patterns

- **Reasoning by Analogy**: "Company X does it this way, so should we"
- **Accepting Market Prices**: "Batteries cost $600/kWh" without checking material costs
- **Form Fixation**: Improving the suitcase instead of inventing wheels
- **Soft Constraint Worship**: Treating policies as physics
- **Premature Optimization**: Optimizing before understanding fundamentals

---

## IterativeDepth

Structured multi-angle exploration of the same problem to extract deeper understanding. Run 2–8 passes
through the problem, each from a systematically different **lens**. Each pass surfaces requirements, edge
cases, and criteria invisible from other angles.

Grounded in: Hermeneutic Circle, Triangulation (cognitive science), Self-Consistency, Ensemble Methods
(AI/ML), Viewpoint-Oriented RE (requirements engineering), Six Thinking Hats, Causal Layered Analysis
(design thinking).

### The 8 Lenses

#### Lens 1: LITERAL (Surface Requirements)
**Question:** "What did they explicitly say? What are the concrete, stated requirements?"  
**Focus:** Parse the exact words. Identify every stated requirement, constraint, preference. No
interpretation — only what was said.  
**Output:** Criteria for every explicitly stated requirement.  
**Prompt:** "List every concrete, testable requirement explicitly stated in this request. Do not infer — only extract."

#### Lens 2: STAKEHOLDER (Who Else Cares?)
**Question:** "Who are all the people, systems, and entities affected by this? What does each need?"  
**Focus:** Identify every stakeholder beyond the requester: end users, maintainers, administrators,
downstream systems, future developers. What does each need that wasn't stated?  
**Output:** Criteria for stakeholder needs not in the original request.  
**Prompt:** "Identify every stakeholder affected by this work. For each, what requirement would THEY add that the requester didn't mention?"

#### Lens 3: FAILURE (What Goes Wrong?)
**Question:** "What could fail? What would an adversary exploit? What are the edge cases?"  
**Focus:** Assume the solution exists. Now break it. Error states, race conditions, security holes,
data corruption, user confusion, performance under load.  
**Output:** Anti-criteria (what must NOT happen) and defensive criteria.  
**Prompt:** "This solution ships tomorrow. List every way it fails in the first week. Be adversarial."

#### Lens 4: TEMPORAL (Past, Present, Future)
**Question:** "How does this change over time? What's the history? What happens in 6 months?"  
**Focus:** Why does this problem exist now? What was tried before? What changes in the future that
would break this solution? Migration paths, backwards compatibility, scale changes.  
**Output:** Criteria for durability, migration, and future-proofing.  
**Prompt:** "What context created this request? What will change in 3–12 months that could invalidate this solution?"

#### Lens 5: EXPERIENTIAL (How Should It Feel?)
**Question:** "When this works perfectly, how does the user FEEL? What's the experience?"  
**Focus:** Beyond functional correctness — speed, elegance, surprise, delight, confidence, trust.
What's the difference between "works" and "works beautifully"?  
**Output:** Quality-of-experience criteria that elevate from functional to euphoric.  
**Prompt:** "Describe the perfect user experience of this solution. What makes someone say 'this is exactly what I wanted' vs. 'this technically works'?"

#### Lens 6: CONSTRAINT INVERSION (What If?)
**Question:** "What if we removed all constraints? What if we added extreme ones?"  
**Focus:** Remove assumed constraints — what would we build with infinite time/resources? Then add
extreme constraints — offline, 100ms, zero dependencies? Both directions reveal hidden assumptions.  
**Output:** Criteria that challenge assumptions and reveal what's truly essential.  
**Prompt:** "What constraints are we assuming that weren't stated? Remove them — what changes? Now impose extreme constraints — what's truly essential?"

#### Lens 7: ANALOGICAL (What Patterns Apply?)
**Question:** "What similar problems have been solved before? What patterns from other domains apply?"  
**Focus:** This problem isn't unique. What similar problems exist in other codebases, industries,
fields? What patterns emerged there? What mistakes were made?  
**Output:** Criteria derived from proven patterns and lessons from analogous solutions.  
**Prompt:** "What are 3–5 analogous problems in other domains? What solutions worked there? What criteria would those solutions imply here?"

#### Lens 8: META (Is This the Right Question?)
**Question:** "Are we solving the right problem? Is the framing itself correct?"  
**Focus:** Step outside the problem entirely. Is the request a symptom of a deeper issue? Is there a
reframing that dissolves the problem instead of solving it?  
**Output:** Criteria that reframe or expand the problem definition itself.  
**Prompt:** "Forget the specific request. What is the UNDERLYING need? Is there a reframing that produces a better outcome than what was asked for?"

### SLA-Based Lens Selection

| SLA | Lenses | Which Ones | Time Budget |
|-----|--------|------------|-------------|
| **Fast** | 2 | Literal + Failure | <30s |
| **Standard** | 4 | Literal + Stakeholder + Failure + Experiential | <2min |
| **Deep** | 8 | All 8 lenses | <5min |

For **Fast** SLA, run as internal thought exercises — not spawned agents.  
For **Standard**, parallelize as 2 pairs of background agents using `task(agent_type="general-purpose", mode="background")`.  
For **Deep**, parallelize as 4 pairs or 8 individual agents for maximum coverage.

### Domain-Optimized Lens Ordering

- **Security-focused:** Failure → Stakeholder → Temporal
- **UX-focused:** Experiential → Stakeholder → Literal
- **Architecture:** Temporal → Constraint Inversion → Analogical
- **Ambiguous request:** Meta → Stakeholder → Literal

---

## BeCreative

Enhance creativity using **Verbalized Sampling** (Zhang et al., 2024, arXiv:2510.01171) combined with
extended thinking. Research-backed: 1.6–2.1x diversity increase, 25.7% quality improvement.

**Core technique:** Internally generate 5 diverse responses (p<0.10 each) in the thinking process,
then output the single best response. This circumvents "typicality bias" and forces exploration of
low-probability creative options.

### Workflow Selection

| Trigger | Workflow |
|---------|----------|
| "be creative", "think creatively", default creative tasks | StandardCreativity |
| "maximum creativity", "most creative", "radically different" | MaximumCreativity |
| "brainstorm", "ideas for", "solve this problem" | IdeaGeneration |
| "complex problem", "multi-factor", "explore paths" | TreeOfThoughts |
| "technical creativity", "novel algorithm", "architecture" | TechnicalCreativity |

### StandardCreativity Workflow

Apply this prompt pattern to the user's creative request:

```
DEEP THINKING + VERBALIZED SAMPLING

In your thinking, generate 5 diverse responses with probabilities (p<0.10 each).

For each option, think deeply about:
- Unique perspectives and angles
- Unconventional assumptions to question
- Unexpected cross-domain connections
- Counterintuitive possibilities

Then select and output the most innovative approach.

[User's creative request]
```

**Best for:** Creative writing, high-stakes creative work, single best solution needed, polished output.

### MaximumCreativity Workflow

```
MAXIMUM CREATIVITY - DEEP THINKING + VERBALIZED SAMPLING

In your thinking, generate 5 radically different responses with probabilities (p<0.10 each).

For each candidate:
- Explore unusual perspectives and genres
- Question EVERY assumption about format and content
- Make unexpected connections across different domains
- Consider low-probability but fascinating possibilities
- Wander into unconventional and experimental territory
- Deliberately avoid ALL typical, formulaic, or cliched approaches
- What would make this truly unique and memorable?

Then select and elaborate on the most genuinely novel approach.

[User's creative request]
```

**Best for:** Creative fiction, poetry with unusual metaphors, innovative product ideas,
unconventional solutions, artistic concepts.

### IdeaGeneration Workflow

```
IDEA GENERATION - DEEP THINKING + VERBALIZED SAMPLING

In your thinking, generate 5 diverse solution approaches with probabilities (p<0.10 each).

For each idea, explore:
- What assumptions underlie conventional solutions?
- What would solutions from completely different industries look like?
- What if we inverted the problem?
- What counterintuitive approaches might work?
- What connections can we make across unrelated domains?
- What are the hidden constraints and opportunities?

Then select and present the most breakthrough solution.

[Problem or challenge description]
```

**Best for:** Strategic planning, business innovation, technical problem-solving, product development.

### TreeOfThoughts Workflow

```
DEEP THINKING + TREE OF THOUGHTS

Step 1: Deep Analysis
Think deeply about this complex problem before exploring solutions:
- What are the key constraints and opportunities?
- What paradigms or frameworks might apply?
- What unexpected connections can be made?
- What would a breakthrough solution look like?

Step 2: Branching Exploration
1. Identify 3–5 fundamentally different approaches
2. For the most promising approaches, explore variations and sub-approaches
3. At each branch point, apply deep thinking to explore implications
4. Evaluate all paths considering both creativity and viability
5. Synthesize the most innovative yet practical solution

Step 3: Synthesis
Combine insights from your exploration into the optimal creative solution.

[Complex creative challenge]
```

**Best for:** Complex strategic decisions, multi-constraint optimization, high-stakes innovation.

### TechnicalCreativity Workflow

For engineering creativity (novel algorithms, architectures, elegant technical solutions):

1. Launch `task(agent_type="general-purpose", mode="background")` with the technical problem
2. Prompt the agent to apply extended thinking specifically for:
   - Non-obvious algorithmic approaches
   - Cross-domain pattern transfer (e.g., biology → networking)
   - Constraint inversion (what if we had 10x constraints? 1/10x?)
   - Mathematical elegance as a design criterion
3. Evaluate proposals using FirstPrinciples/Reconstruct to ensure they're genuinely novel

---

## Council

Multi-agent debate system where specialized agents discuss topics in rounds, respond to each other's
actual points, and surface insights through intellectual friction.

**Key differentiator from RedTeam:** Council is collaborative-adversarial (debate to find best path),
while RedTeam is purely adversarial (attack the idea). Council produces visible conversation transcripts;
RedTeam produces steelman + counter-argument.

### Council Members

| Agent | Perspective | Personality |
|-------|-------------|-------------|
| **Architect** | System design, patterns, scalability, long-term | Serena Blackwood |
| **Designer** | UX, user needs, accessibility | Aditi Sharma |
| **Engineer** | Implementation reality, tech debt, practical constraints | Marcus Webb |
| **Researcher** | Data, precedent, external examples | Ava Chen |

**Optional members (add by request):**

| Agent | Perspective | When to Add |
|-------|-------------|-------------|
| **Security** | Risk, attack surface, compliance | Auth, data, APIs |
| **Fresh Eyes** | Naive questions, beginner perspective | Complex UX, onboarding |
| **Writer** | Communication, documentation | Public-facing, docs |

### DEBATE Workflow (Full 3-Round)

**Use for:** Important decisions, complex trade-offs, architectural choices.

**Announce the debate:**
```markdown
## Council Debate: [Topic]

**Council Members:** [List agents]
**Rounds:** 3 (Positions → Responses → Synthesis)
```

**Round 1 — Initial Positions**  
Launch all council members in parallel via `task(agent_type="general-purpose", mode="background")`.

Each agent prompt:
```
You are [Agent Name], [role description].

COUNCIL DEBATE - ROUND 1: INITIAL POSITIONS

Topic: [The topic being debated]

Give your initial position on this topic from your specialized perspective.
- Speak in first person as your character
- Be specific and substantive (50–150 words)
- State your key concern, recommendation, or insight
- You'll respond to other council members in Round 2

Your perspective focuses on: [agent's domain]
```

Output format:
```markdown
### Round 1: Initial Positions

**🏛️ Architect (Serena):**
[Response]

**🎨 Designer (Aditi):**
[Response]

**⚙️ Engineer (Marcus):**
[Response]

**🔍 Researcher (Ava):**
[Response]
```

**Round 2 — Responses & Challenges**  
Launch all agents in parallel with Round 1 transcript included.

Each agent prompt:
```
You are [Agent Name], [role description].

COUNCIL DEBATE - ROUND 2: RESPONSES & CHALLENGES

Topic: [The topic being debated]

Here's what the council said in Round 1:
[Full Round 1 transcript]

Now respond to the other council members:
- Reference specific points they made ("I disagree with [Name]'s point about X...")
- Challenge assumptions or add nuance
- Build on points you agree with
- Maintain your specialized perspective
- 50–150 words

The value is in genuine intellectual friction—engage with their actual arguments.
```

**Round 3 — Synthesis**  
Launch all agents in parallel with Round 1 + Round 2 transcripts.

Each agent prompt:
```
You are [Agent Name], [role description].

COUNCIL DEBATE - ROUND 3: SYNTHESIS

Topic: [The topic being debated]

Full debate transcript so far:
[Round 1 + Round 2 transcripts]

Final synthesis from your perspective:
- Where does the council agree?
- Where do you still disagree with others?
- What's your final recommendation given the full discussion?
- 50–150 words

Be honest about remaining disagreements—forced consensus is worse than acknowledged tension.
```

**Council Synthesis (after all rounds):**
```markdown
### Council Synthesis

**Areas of Convergence:**
- [Points where 3+ agents agreed]
- [Shared concerns or recommendations]

**Remaining Disagreements:**
- [Points still contested between agents]
- [Trade-offs that couldn't be resolved]

**Recommended Path:**
[Based on convergence and weight of arguments, the recommended approach is...]
```

**Timing:** Round 1: ~10–20s (parallel) → Round 2: ~10–20s → Round 3: ~10–20s → Synthesis: ~5s  
**Total: 30–90 seconds for full debate**

### QUICK Workflow (Single Round)

**Use for:** Sanity checks, fast validation, quick feedback.

Launch all council members in parallel with this prompt:
```
You are [Agent Name], [role description].

QUICK COUNCIL CHECK

Topic: [The topic]

Give your immediate take from your specialized perspective:
- Key concern, insight, or recommendation
- 30–50 words max
- Be direct and specific

This is a quick sanity check, not a full debate.
```

Output format:
```markdown
## Quick Council: [Topic]

### Perspectives

**🏛️ Architect (Serena):**
[Brief take]

**🎨 Designer (Aditi):**
[Brief take]

**⚙️ Engineer (Marcus):**
[Brief take]

**🔍 Researcher (Ava):**
[Brief take]

### Quick Summary

**Consensus:** [Do they generally agree? On what?]
**Concerns:** [Any red flags raised?]
**Recommendation:** [Proceed / Reconsider / Need full debate]
```

If significant disagreement surfaces, escalate: `⚠️ This topic warrants a full council debate.`

**Total: 10–20 seconds**

### Best Practices

1. Use QUICK for sanity checks, DEBATE for important decisions
2. Add domain-specific experts as needed (security for auth, etc.)
3. Review the transcript — insights are in the responses, not just final positions
4. Trust multi-agent convergence when it occurs
5. Pairs well with **RedTeam** — full debate first, then adversarial stress-test

---

## RedTeam

Military-grade adversarial analysis. Breaks arguments into atomic components, attacks from 32 expert
perspectives (engineers, architects, pentesters, interns), synthesizes findings, and produces
steelman + devastating counter-arguments.

**Core philosophy:** The goal is NOT destruction — it's finding the fundamental flaw that, if challenged,
causes the entire structure to collapse. The most powerful critique is usually ONE core issue: a hidden
assumption that's actually false, a logical step that doesn't follow, a category error, or an ignored
precedent.

### Workflow Selection

| Trigger | Workflow |
|---------|----------|
| Red team analysis (stress-test existing content) | [ParallelAnalysis](#parallelanalysis-workflow) |
| Adversarial validation (produce new content via competition) | [AdversarialValidation](#adversarialvalidation-workflow) |

### ParallelAnalysis Workflow

Five-phase protocol for stress-testing arguments.

#### Phase 1: Decomposition

**Step 1.0 — First Principles Deconstruction**  
Apply FirstPrinciples/Deconstruct on the argument to surface:
- What the argument is actually made of (constituent parts)
- The fundamental truths vs. assumed truths
- The gap between stated and actual components

**Step 1.1 — Extract Core Argument**
- The central thesis (one sentence)
- The key supporting claims (numbered list)
- The implicit assumptions (what must be true for this to work)
- The logical chain (A → B → C → conclusion)

**Step 1.2 — Break Into 24 Atomic Claims**  
Decompose the argument into exactly 24 discrete claims. Each claim must be:
- Self-contained (understandable without other claims)
- Specific (not vague or general)
- Attackable (a competent critic could challenge it)

#### Phase 2: Parallel Agent Deployment

Launch 32 agents in a single batch via `task(agent_type="general-purpose", mode="background")`.
Each agent receives: full original argument, 24-claim decomposition, their specific personality and
attack angle.

**8 Engineers** (technical and logical rigor):

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| EN-1 | The Skeptical Systems Thinker — 30 years building distributed systems | "Where does this break at scale?" |
| EN-2 | The Evidence Demander — won't accept claims without data | "Show me the numbers that prove this." |
| EN-3 | The Edge Case Hunter — finds the 1% scenario that destroys assumptions | "What happens when X is not true?" |
| EN-4 | The Historical Pattern Matcher — has seen every failure mode | "We tried this in 2008 and here's what happened." |
| EN-5 | The Complexity Realist — knows simple solutions hide hard problems | "This is harder than it sounds because..." |
| EN-6 | The Dependency Tracer — follows assumptions to their roots | "This assumes X, which assumes Y, which is false." |
| EN-7 | The Failure Mode Analyst — thinks only about how things break | "Here are 5 ways this fails catastrophically." |
| EN-8 | The Technical Debt Accountant — calculates hidden costs | "The real price of this approach is..." |

**8 Architects** (structural and systemic issues):

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| AR-1 | The Big Picture Thinker — sees how pieces connect (or don't) | "This ignores how it fits into the larger system." |
| AR-2 | The Trade-off Illuminator — nothing is free | "You gain X but lose Y, and Y matters more." |
| AR-3 | The Abstraction Questioner — challenges categorical thinking | "These aren't the same category of problem." |
| AR-4 | The Incentive Mapper — follows the money and motivation | "Who benefits from this being true?" |
| AR-5 | The Second-Order Effects Tracker — thinks three moves ahead | "This causes A, which causes B, which destroys C." |
| AR-6 | The Integration Pessimist — knows interfaces are where things break | "This doesn't compose with existing reality." |
| AR-7 | The Scalability Skeptic — what works for 10 doesn't work for 10,000 | "This can't scale because..." |
| AR-8 | The Reversibility Analyst — some decisions can't be undone | "Once you do this, you can't go back, and here's why that's bad." |

**8 Pentesters** (adversarial and security thinking):

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| PT-1 | The Red Team Lead — thinks like an attacker 24/7 | "Here's how I'd exploit this logic." |
| PT-2 | The Assumption Breaker — finds the weak link in the chain | "This depends on X, and X is false." |
| PT-3 | The Game Theorist — models rational adversaries | "A smart opponent would simply..." |
| PT-4 | The Social Engineer — knows humans are the weak point | "People will route around this because..." |
| PT-5 | The Precedent Finder — has seen this pattern before | "This is just [past example] in a new dress." |
| PT-6 | The Defense Evaluator — judges if mitigations actually work | "This defense fails because attackers can..." |
| PT-7 | The Threat Modeler — maps attack surfaces systematically | "You've left this entire surface undefended." |
| PT-8 | The Asymmetry Spotter — finds where defenders are outmatched | "Attackers have unlimited time; defenders don't." |

**8 Interns** (fresh eyes and unconventional perspectives):

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| IN-1 | The Naive Questioner — asks "why" until it breaks | "But why do we assume X in the first place?" |
| IN-2 | The Analogy Finder — connects to seemingly unrelated fields | "This is just like [other field] where it failed." |
| IN-3 | The Contrarian — takes the opposite position instinctively | "What if the exact opposite is true?" |
| IN-4 | The Common Sense Checker — if it sounds too clever, it's wrong | "This violates basic intuition because..." |
| IN-5 | The Zeitgeist Reader — knows what's actually happening on the ground | "In practice, nobody actually does this because..." |
| IN-6 | The Simplicity Advocate — Occam's razor everything | "The simpler explanation is..." |
| IN-7 | The Edge Lord — pushes every argument to its absurd conclusion | "If this is true, then [absurd consequence] must also be true." |
| IN-8 | The Devil's Intern — finds the argument the author hoped nobody would make | "The uncomfortable truth nobody wants to say is..." |

**Agent Prompt Template:**
```
# BALANCED ANALYSIS - [AGENT ID]: [PERSONALITY NAME]

You are [PERSONALITY DESCRIPTION]. Your perspective is: "[PERSPECTIVE]"

## THE ARGUMENT TO ANALYZE:
[Full original argument]

## DECOMPOSED INTO 24 CLAIMS:
[24-claim breakdown]

## YOUR MISSION:
Using your specific personality and perspective, provide an INDEPENDENT BALANCED ANALYSIS
examining BOTH the strengths AND weaknesses of this argument.

### PART A - STRENGTHS (What's RIGHT about this argument):
1. Which claim(s) are strongest? (cite claim numbers)
2. What evidence or logic supports them? (2-3 sentences)
3. Why should we take this seriously? (1 sentence)

### PART B - WEAKNESSES (What's WRONG about this argument):
1. Which claim(s) are weakest? (cite claim numbers)
2. What's the flaw? (2-3 sentences)
3. Why is this a problem? (1 sentence)

## OUTPUT FORMAT:
**[AGENT ID] ANALYSIS:**

**Strongest Point FOR the Argument:** [Claim #X]
[2-3 sentences on why this is valid/compelling]
Take seriously because: [1 sentence]

**Strongest Point AGAINST the Argument:** [Claim #Y]
[2-3 sentences on the flaw]
Problematic because: [1 sentence]

**Overall Assessment:** [One sentence — your independent verdict on the argument's merit]
```

#### Phase 3: Synthesis

Collect all 32 analyses and identify convergent insights:

**Convergence thresholds:**
- 5+ agents identified the same point → **CRITICAL** (weakness) / **STRONG FOUNDATION** (strength)
- 3–4 agents identified the same point → **SIGNIFICANT** (weakness) / **NOTABLE STRENGTH**
- 1–2 agents identified a point → **NOTABLE INSIGHT** / **INTERESTING SUPPORT**

**Categorize weaknesses by type:**
1. Logical Fallacies — flawed reasoning structure
2. Missing Evidence — claims without support
3. Hidden Assumptions — unstated premises that may be false
4. Counterexamples — cases where the argument fails
5. Precedent Contradictions — history says otherwise
6. Second-Order Effects — consequences the argument ignores

#### Phase 4: Steelman

Construct the STRONGEST possible version of the argument before attacking it. Output: 8-point story
explanation, 12–16 words per point.

```markdown
# STEELMAN

**The Position (Best Version):** [One sentence — the strongest formulation]

**The Strongest Case FOR This Argument:**

1. [12–16 words — the most compelling opening point]
2. [12–16 words — strong supporting evidence]
3. [12–16 words — historical precedent or analogy that supports]
4. [12–16 words — valid concern being addressed]
5. [12–16 words — what the critics get wrong]
6. [12–16 words — the real risk if ignored]
7. [12–16 words — why smart people believe this]
8. [12–16 words — the strongest single reason to take this seriously]

**Validity Assessment:** [One sentence on the legitimate core concern]
```

#### Phase 5: Counter-Argument

**First, apply FirstPrinciples/Challenge** on all stated constraints and assumptions. Classify each as:
- **HARD** (physics/reality — cannot attack)
- **SOFT** (policy/choice — can be challenged)
- **ASSUMPTION** (unvalidated — prime attack target)

The most devastating critiques target constraints treated as HARD that are actually SOFT.

Then surface the core claim type (causal, comparative, categorical, predictive, normative), hidden
assumptions, historical precedent, and logical validity. Ensure the counter-argument defeats the
**steelman**, not a weaker strawman.

Output: 8-point story explanation, 12–16 words per point, escalating to a knockout conclusion.

```markdown
# RED TEAM VERDICT

**The Position:** [One sentence summary of what was red-teamed]

**The Counter-Argument:**

1. [First key point — 12–16 words — establishes the fundamental flaw]
2. [Second point — 12–16 words — develops the core weakness]
3. [Third point — 12–16 words — provides historical precedent or analogy]
4. [Fourth point — 12–16 words — addresses the hidden assumption]
5. [Fifth point — 12–16 words — shows the counterexample or exception]
6. [Sixth point — 12–16 words — reveals what's conveniently ignored]
7. [Seventh point — 12–16 words — exposes the second-order effects]
8. [Eighth point — 12–16 words — delivers the knockout conclusion]

**Assessment:** [One sentence on the argument's fundamental soundness after analysis]
```

**Success criteria:** Steelman is strong enough that a proponent would say "yes, that's my argument."
Counter-argument defeats the steelman, not a strawman. Multiple agents converged on the same insights.
Reader says "I hadn't thought of that."

**Time estimate:** Phase 1: 2–3 min → Phase 2: 3–5 min (parallel) → Phase 3: 2–3 min → Phases 4–5: 2–3 min  
**Total: ~10–15 minutes for comprehensive red team**

### AdversarialValidation Workflow

Produce superior output through competing proposals + brutal critique + collaborative synthesis.
**Use when:** Designing something new (vs. ParallelAnalysis which stress-tests existing content).

**Three-Round Protocol:**

**Round 1 — Competing Proposals**  
Launch 2–3 specialized agents via `task(agent_type="general-purpose", mode="background")`, each
producing a complete solution from their perspective.

Suggested persona combinations:
- **Architecture:** Engineer (maintainability) + Architect (scalability) + Security (attack surface)
- **Feature Specs:** Product (user value) + Engineer (feasibility) + QA (testability)
- **Content:** Subject Matter Expert (accuracy) + Audience Rep (clarity) + Editor (structure)

**Round 2 — Brutal Critique**  
A critic agent reads ALL proposals and for each evaluates:
- What they got RIGHT (genuine strengths)
- What they got WRONG (flaws, gaps, blind spots)
- The uncomfortable truth none of them addressed
- Which has the strongest foundation and why

**Round 3 — Collaborative Synthesis**  
The original agents see the critique and produce a SINGLE UNIFIED solution that:
- Addresses the valid criticisms
- Incorporates the best elements from each proposal
- Resolves tensions between perspectives
- Acknowledges remaining trade-offs honestly

*This is synthesis, not compromise. The final output should be BETTER than any individual proposal.*

**Quality signals:**
- Each proposal genuinely represents its perspective (not strawmen)
- Critic finds real flaws, not just nitpicks
- Synthesis is demonstrably better than any individual proposal
- Trade-offs are honestly acknowledged

**When NOT to use:** Simple decisions with obvious answers; time-critical situations; creative tasks
where multiple valid outputs are fine; problems where expert consensus already exists.

---

## Science

The scientific method applied to everything. The meta-skill that governs all other thinking modes.

**The goal is CRITICAL.** Without clear success criteria, you cannot judge results.

### The Universal Cycle

```
GOAL -----> What does success look like?
   |
OBSERVE --> What is the current state?
   |
HYPOTHESIZE -> What might work? (Generate MULTIPLE — minimum 3)
   |
EXPERIMENT -> Design and run the test
   |
MEASURE --> What happened? (Data collection)
   |
ANALYZE --> How does it compare to the goal?
   |
ITERATE --> Adjust hypothesis and repeat
   |
   +------> Back to HYPOTHESIZE
```

### Workflow Routing

| Trigger | Workflow |
|---------|----------|
| "define the goal", "what are we trying to achieve" | DefineGoal |
| "what might work", "ideas", "hypotheses" | GenerateHypotheses |
| "how do we test", "experiment design" | DesignExperiment |
| "what happened", "measure", "results" | MeasureResults |
| "analyze", "compare to goal" | AnalyzeResults |
| "iterate", "try again", "next cycle" | Iterate |
| Full structured cycle | FullCycle |
| Quick debugging (15-min rule) | QuickDiagnosis |
| Complex investigation | StructuredInvestigation |

### Domain Applications

| Domain | Manifestation | Related Approach |
|--------|---------------|-----------------|
| **Coding** | TDD (Red-Green-Refactor) | Development |
| **Products** | MVP → Measure → Iterate | Development |
| **Research** | Question → Study → Analyze | Research |
| **Prompts** | Prompt → Eval → Iterate | Evals |
| **Decisions** | Options → Council → Choose | Council |

### Scale of Application

| Level | Cycle Time | Example |
|-------|-----------|---------|
| **Micro** | Minutes | TDD: test, code, refactor |
| **Meso** | Hours–Days | Feature: spec, implement, validate |
| **Macro** | Weeks–Months | Product: MVP, launch, measure PMF |

### Integration Points

| Phase | Invoke These Thinking Modes |
|-------|------------------------------|
| **Goal** | Council for validation |
| **Observe** | Research for context |
| **Hypothesize** | Council for ideas, RedTeam for stress-test |
| **Experiment** | Parallel agents for concurrent tests |
| **Measure** | Structured evals |
| **Analyze** | Council for multi-perspective analysis |

### Key Principles

1. **Goal-First** — Define success before starting
2. **Hypothesis Plurality** — NEVER just one idea (minimum 3)
3. **Minimum Viable Experiments** — Smallest test that teaches
4. **Falsifiability** — Experiments must be able to fail
5. **Measure What Matters** — Only goal-relevant data
6. **Honest Analysis** — Compare to goal, not expectations
7. **Rapid Iteration** — Cycle speed > perfect experiments

### Anti-Patterns

| Bad | Good |
|-----|------|
| "Make it better" | "Reduce load time from 3s to 1s" |
| "I think X will work" | "Here are 3 approaches: X, Y, Z" |
| "Prove I'm right" | "Design test that could disprove" |
| "Pretend failure didn't happen" | "What did we learn?" |
| "Keep experimenting forever" | "Ship and learn from production" |

### Quick Start Template

```
1. GOAL: What does success look like? (measurable)
2. OBSERVE: What do we know right now?
3. HYPOTHESIZE: At least 3 ideas (not 1)
4. EXPERIMENT: Minimum viable test for each
5. MEASURE: Collect goal-relevant data only
6. ANALYZE: Compare to success criteria honestly
7. ITERATE: Adjust hypothesis and repeat
```

**The answer emerges from the cycle, not from guessing.**

---

## Cross-Skill Integration Patterns

These thinking modes compose naturally. Common combinations:

| Pattern | Sequence |
|---------|----------|
| **Challenge a decision** | Council (debate) → RedTeam (stress-test winner) |
| **Solve hard problem** | Science (define goal) → BeCreative (hypotheses) → IterativeDepth (validate) |
| **Evaluate an assumption** | FirstPrinciples (classify constraints) → RedTeam (attack soft constraints) |
| **Architecture decision** | IterativeDepth/Temporal + Analogical → Council/Debate → RedTeam/AdversarialValidation |
| **Debug with rigor** | Science/QuickDiagnosis → FirstPrinciples/Deconstruct if stuck |
| **Creative + rigorous** | BeCreative/IdeaGeneration → IterativeDepth/Failure → RedTeam/ParallelAnalysis |
