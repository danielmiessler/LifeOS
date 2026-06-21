# Red Team Parallel Analysis Workflow

## Overview

Military-grade adversarial analysis using parallel agent deployment. Breaks arguments into atomic components, attacks from 32 different expert perspectives simultaneously, synthesizes findings, and produces the ultimate counter-argument.

**Key Philosophy:** This is NOT about nitpicking or being contrarian. It's about finding the fundamental flaw in an argument's logic - the assumption that, if challenged, causes the entire structure to collapse.

---

## The Five Phases

### PHASE 1: DECOMPOSITION
Break the argument into 24 atomic claims using storyexplanation methodology.

### PHASE 2: PARALLEL ANALYSIS
Launch 32 specialized agents (8 each: engineers, architects, pentesters, interns) with unique personalities to examine BOTH strengths AND weaknesses from their perspective.

### PHASE 3: SYNTHESIS
Collect all 32 analyses and identify convergent insights (both supporting and opposing).

### PHASE 4: STEELMAN
Produce an 8-point story explanation (12-16 words each) representing the STRONGEST possible version of the original argument.

### PHASE 5: COUNTER-ARGUMENT
Produce an 8-point story explanation (12-16 words each) representing the strongest possible rebuttal.

---

## PHASE 1: Decomposition Protocol

### Step 1.0: First Principles Deconstruction (NEW)
**Before traditional decomposition, invoke FirstPrinciples/Deconstruct:**

```
→ FirstPrinciples/Deconstruct on the argument
```

This surfaces:
- What the argument is actually made of (constituent parts)
- The fundamental truths vs. assumed truths
- The gap between stated components and actual components

Output feeds into Step 1.1.

### Step 1.1: Extract the Core Argument
Read the content and identify:
- The central thesis (one sentence)
- The key supporting claims (numbered list)
- The implicit assumptions (what must be true for this to work)
- The logical chain (A → B → C → conclusion)

### Step 1.2: Break Into 24 Atomic Pieces
Using storyexplanation methodology, decompose the argument into exactly 24 discrete claims:

```
CLAIM 1: [First atomic claim from the argument]
CLAIM 2: [Second atomic claim]
...
CLAIM 24: [Twenty-fourth atomic claim]
```

Each claim should be:
- Self-contained (understandable without other claims)
- Specific (not vague or general)
- Attackable (a competent critic could challenge it)

---

## PHASE 2: Parallel Agent Deployment

### Launch Protocol
Deploy 32 agents in a SINGLE message with multiple Task tool calls. Each agent receives:
1. The full original argument
2. The 24-claim decomposition
3. Their specific personality and attack angle
4. Instructions to return a focused critique

### Agent Roster: 8 Engineers

Each focuses on **technical and logical rigor**:

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| EN-1 | **The Skeptical Systems Thinker** - 30 years building distributed systems. Trusts nothing. | "Where does this break at scale?" |
| EN-2 | **The Evidence Demander** - Won't accept claims without data. | "Show me the numbers that prove this." |
| EN-3 | **The Edge Case Hunter** - Finds the 1% scenario that destroys assumptions. | "What happens when X is not true?" |
| EN-4 | **The Historical Pattern Matcher** - Has seen every failure mode. | "We tried this in 2008 and here's what happened." |
| EN-5 | **The Complexity Realist** - Knows simple solutions hide hard problems. | "This is harder than it sounds because..." |
| EN-6 | **The Dependency Tracer** - Follows assumptions to their roots. | "This assumes X, which assumes Y, which is false." |
| EN-7 | **The Failure Mode Analyst** - Thinks only about how things break. | "Here are 5 ways this fails catastrophically." |
| EN-8 | **The Technical Debt Accountant** - Calculates hidden costs. | "The real price of this approach is..." |

### Agent Roster: 8 Architects

Each focuses on **structural and systemic issues**:

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| AR-1 | **The Big Picture Thinker** - Sees how pieces connect (or don't). | "This ignores how it fits into the larger system." |
| AR-2 | **The Trade-off Illuminator** - Nothing is free. | "You gain X but lose Y, and Y matters more." |
| AR-3 | **The Abstraction Questioner** - Challenges categorical thinking. | "These aren't the same category of problem." |
| AR-4 | **The Incentive Mapper** - Follows the money and motivation. | "Who benefits from this being true?" |
| AR-5 | **The Second-Order Effects Tracker** - Thinks three moves ahead. | "This causes A, which causes B, which destroys C." |
| AR-6 | **The Integration Pessimist** - Knows interfaces are where things break. | "This doesn't compose with existing reality." |
| AR-7 | **The Scalability Skeptic** - What works for 10 doesn't work for 10,000. | "This can't scale because..." |
| AR-8 | **The Reversibility Analyst** - Some decisions can't be undone. | "Once you do this, you can't go back, and here's why that's bad." |

### Agent Roster: 8 Pentesters

Each focuses on **adversarial and security thinking**:

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| PT-1 | **The Red Team Lead** - Thinks like an attacker 24/7. | "Here's how I'd exploit this logic." |
| PT-2 | **The Assumption Breaker** - Finds the weak link in the chain. | "This depends on X, and X is false." |
| PT-3 | **The Game Theorist** - Models rational adversaries. | "A smart opponent would simply..." |
| PT-4 | **The Social Engineer** - Knows humans are the weak point. | "People will route around this because..." |
| PT-5 | **The Precedent Finder** - Has seen this pattern before. | "This is just [past example] in a new dress." |
| PT-6 | **The Defense Evaluator** - Judges if mitigations actually work. | "This defense fails because attackers can..." |
| PT-7 | **The Threat Modeler** - Maps attack surfaces systematically. | "You've left this entire surface undefended." |
| PT-8 | **The Asymmetry Spotter** - Finds where defenders are outmatched. | "Attackers have unlimited time; defenders don't." |

### Agent Roster: 8 Interns

Each brings **fresh eyes and unconventional perspectives**:

| Agent | Personality | Attack Angle |
|-------|-------------|--------------|
| IN-1 | **The Naive Questioner** - Asks "why" until it breaks. | "But why do we assume X in the first place?" |
| IN-2 | **The Analogy Finder** - Connects to seemingly unrelated fields. | "This is just like [other field] where it failed." |
| IN-3 | **The Contrarian** - Takes the opposite position instinctively. | "What if the exact opposite is true?" |
| IN-4 | **The Common Sense Checker** - If it sounds too clever, it's wrong. | "This violates basic intuition because..." |
| IN-5 | **The Zeitgeist Reader** - Knows what's actually happening on the ground. | "In practice, nobody actually does this because..." |
| IN-6 | **The Simplicity Advocate** - Occam's razor everything. | "The simpler explanation is..." |
| IN-7 | **The Edge Lord** - Pushes every argument to its absurd conclusion. | "If this is true, then [absurd consequence] must also be true." |
| IN-8 | **The Devil's Intern** - Finds the argument the author hoped nobody would make. | "The uncomfortable truth nobody wants to say is..." |

### Agent Prompt Template

Each agent receives this prompt (customized with their personality):

```
# BALANCED ANALYSIS - [AGENT ID]: [PERSONALITY NAME]

You are [PERSONALITY DESCRIPTION]. Your perspective is: "[PERSPECTIVE]"

## THE ARGUMENT TO ANALYZE:
[Full original argument]

## DECOMPOSED INTO 24 CLAIMS:
[24-claim breakdown]

## YOUR MISSION:
Using your specific personality and perspective, provide an INDEPENDENT BALANCED ANALYSIS examining BOTH the strengths AND weaknesses of this argument.

### PART A - STRENGTHS (What's RIGHT about this argument):
1. Which claim(s) are strongest? (cite claim numbers)
2. What evidence or logic supports them? (2-3 sentences)
3. Why should we take this seriously? (1 sentence)

### PART B - WEAKNESSES (What's WRONG about this argument):
1. Which claim(s) are weakest? (cite claim numbers)
2. What's the flaw? (2-3 sentences)
3. Why is this a problem? (1 sentence)

## OUTPUT FORMAT:
Return exactly this structure:

**[AGENT ID] ANALYSIS:**

**Strongest Point FOR the Argument:** [Claim #X]
[2-3 sentences on why this is valid/compelling]
Take seriously because: [1 sentence]

**Strongest Point AGAINST the Argument:** [Claim #Y]
[2-3 sentences on the flaw]
Problematic because: [1 sentence]

**Overall Assessment:** [One sentence - your independent verdict on the argument's merit]

Be intellectually honest. Find REAL strengths, not strawmen to knock down.
Find REAL weaknesses, not nitpicks.
Your job is balanced analysis from your unique perspective.
```

---

## PHASE 3: Synthesis Protocol

### Step 3.1: Collect All 32 Analyses
Wait for all agents to complete. Compile their outputs.

### Step 3.2: Identify Convergent STRENGTHS
Look for supporting points that multiple agents independently identified:
- If 5+ agents validated the same point → STRONG FOUNDATION
- If 3-4 agents validated the same point → NOTABLE STRENGTH
- If 1-2 agents found a unique strength → INTERESTING SUPPORT

### Step 3.3: Identify Convergent WEAKNESSES
Look for critiques that multiple agents independently identified:
- If 5+ agents hit the same point → CRITICAL WEAKNESS
- If 3-4 agents hit the same point → SIGNIFICANT WEAKNESS
- If 1-2 agents hit a unique point → NOTABLE INSIGHT

### Step 3.4: Categorize Insights
Group by type:
**STRENGTHS:**
1. **Valid Evidence** - Claims with solid support
2. **Sound Logic** - Reasoning that follows
3. **Real Problem Identified** - Genuine issue being addressed
4. **Historical Support** - Precedents that validate

**WEAKNESSES:**
1. **Logical Fallacies** - Flawed reasoning structure
2. **Missing Evidence** - Claims without support
3. **Hidden Assumptions** - Unstated premises that may be false
4. **Counterexamples** - Cases where the argument fails
5. **Precedent Contradictions** - History says otherwise
6. **Second-Order Effects** - Consequences the argument ignores

### Step 3.5: Identify Core Thesis Validity
Determine: Is the core thesis fundamentally sound with flawed execution, or fundamentally flawed despite good intentions?

---

## PHASE 4: Steelman Protocol

### Purpose
Before attacking, construct the STRONGEST possible version of the argument. This ensures intellectual honesty and prevents strawmanning.

### Step 4.1: Identify Best Evidence
From the synthesis, what are the strongest supporting points?

### Step 4.2: Reconstruct Optimal Argument
If the author had made their case PERFECTLY, what would it look like?

### Step 4.3: Output Format (8 points, 12-16 words each)

```
# STEELMAN

**The Position (Best Version):** [One sentence - the strongest formulation]

**The Strongest Case FOR This Argument:**

1. [12-16 words - the most compelling opening point]

2. [12-16 words - strong supporting evidence]

3. [12-16 words - historical precedent or analogy that supports]

4. [12-16 words - valid concern being addressed]

5. [12-16 words - what the critics get wrong]

6. [12-16 words - the real risk if ignored]

7. [12-16 words - why smart people believe this]

8. [12-16 words - the strongest single reason to take this seriously]

**Validity Assessment:** [One sentence on the legitimate core concern]
```

---

## PHASE 5: Counter-Argument

### First Principles Analysis

Before finalizing the counter-argument, **invoke FirstPrinciples/Challenge:**

```
→ FirstPrinciples/Challenge on all stated constraints and assumptions
```

This classifies every constraint as:
- **HARD** (physics/reality - cannot attack)
- **SOFT** (policy/choice - can be challenged)
- **ASSUMPTION** (unvalidated - prime attack target)

**The most devastating critiques target assumptions classified as HARD that are actually SOFT.**

Then apply these additional checks:

**Step 1: Identify the argument's core claim type:**
- Causal ("X causes Y")
- Comparative ("X is better/worse than Y")
- Categorical ("X belongs to category Y")
- Predictive ("X will lead to Y")
- Normative ("We should/shouldn't do X")

**Step 2: Surface hidden assumptions (from FirstPrinciples/Challenge output):**
- What must be true for this argument to work?
- What does the author take for granted?
- What evidence is assumed but not provided?
- Which "constraints" are actually choices?

**Step 3: Check for historical precedent:**
- Has this exact argument been made before in another domain?
- What was the outcome when people accepted it?
- What was the outcome when people rejected it?

**Step 4: Test logical validity:**
- Does the conclusion actually follow from the premises?
- Are there logical fallacies present?
- Is correlation being presented as causation?

**Step 5: Ensure counter-argument defeats the STEELMAN:**
- Does it address the STRONGEST version of the argument?
- Or does it only defeat a weaker strawman?
- Would a proponent say "that's not what I meant"?

### Output Format: 8-Point Story Explanation

The final output must be exactly 8 numbered points, each 12-16 words:

```
# RED TEAM VERDICT

**The Position:** [One sentence summary of what was red-teamed]

**The Counter-Argument:**

1. [First key point - 12-16 words - establishes the fundamental flaw]

2. [Second point - 12-16 words - develops the core weakness]

3. [Third point - 12-16 words - provides historical precedent or analogy]

4. [Fourth point - 12-16 words - addresses the hidden assumption]

5. [Fifth point - 12-16 words - shows the counterexample or exception]

6. [Sixth point - 12-16 words - reveals what's conveniently ignored]

7. [Seventh point - 12-16 words - exposes the second-order effects]

8. [Eighth point - 12-16 words - delivers the knockout conclusion]

**Assessment:** [One sentence on the argument's fundamental soundness after analysis]
```

### Quality Criteria for Final Output

Each point should:
- Be self-contained and comprehensible alone
- Attack a real weakness, not a strawman
- Use plain language, not jargon
- Follow logically from previous points
- Build toward the devastating conclusion

The 8-point sequence should:
- Tell a coherent counter-narrative
- Escalate in impact
- End with the strongest possible objection
- Make the reader say "I hadn't thought of that"

---

## Execution Checklist

```
□ PHASE 1: Decomposition
  □ Invoke FirstPrinciples/Deconstruct on the argument (NEW)
  □ Read and understand the full argument
  □ Extract central thesis
  □ Identify supporting claims
  □ Surface hidden assumptions
  □ Break into exactly 24 atomic claims

□ PHASE 2: Parallel Analysis
  □ Prepare 32 agent prompts with unique personalities
  □ Launch ALL 32 agents in a SINGLE message (parallel)
  □ Each agent: engineer, architect, pentester, or intern type
  □ Each agent examines BOTH strengths AND weaknesses
  □ Wait for all agents to complete

□ PHASE 3: Synthesis
  □ Collect all 32 analyses
  □ Identify convergent STRENGTHS (5+ agents = strong foundation)
  □ Identify convergent WEAKNESSES (5+ agents = critical weakness)
  □ Categorize by type
  □ Determine core thesis validity

□ PHASE 4: Steelman
  □ Identify best supporting evidence from synthesis
  □ Reconstruct optimal version of the argument
  □ Draft 8-point steelman explanation
  □ Each point: 12-16 words
  □ Present the STRONGEST case FOR the argument

□ PHASE 5: Counter-Argument
  □ Invoke FirstPrinciples/Challenge on all constraints (NEW)
  □ Classify constraints as HARD/SOFT/ASSUMPTION
  □ Apply first-principles analysis (claim type, assumptions, precedent, validity)
  □ Draft 8-point counter-argument
  □ Each point: 12-16 words
  □ Verify logical flow and escalation
  □ End with knockout conclusion that addresses the steelman
```

---

## Example: First Principles Pattern Recognition

**Argument:** "We should delay this product launch by six months to add more features."

**First Principles Analysis:**
- **Claim type:** Normative ("we should do X")
- **Hidden assumptions:** More features = more success; competitors won't act; market timing is flexible
- **Historical precedent:** Many products failed by over-engineering; many succeeded by shipping MVP fast
- **Logical validity:** Doesn't follow that delay improves outcome without evidence on feature-value tradeoff

**Steelman (8 points, 12-16 words each):**

1. Shipping incomplete products damages brand reputation in ways that take years to recover from.
2. Customer acquisition cost is wasted if users churn due to missing core functionality they expected.
3. Apple's delayed product releases consistently outperform rushed competitors on customer satisfaction metrics.
4. The features we're adding directly address the top three complaints from our beta user research.
5. Critics ignore that our competitors have those features—parity is table stakes, not gold-plating.
6. Six months of development costs less than one year of customer support for a broken product.
7. Engineering teams lose motivation when forced to ship work they know is incomplete and buggy.
8. The real risk isn't delay—it's launching something we'll have to apologize for publicly later.

**Counter-Argument (8 points, 12-16 words each):**

1. This assumes we know which features matter—but only real users reveal what actually drives value.
2. Every month of delay is a month competitors can capture market share we'll never recover.
3. Amazon, Google, and Facebook all shipped embarrassingly incomplete v1 products that dominated their markets.
4. The argument conflates "more features" with "better product"—complexity often destroys rather than creates value.
5. Six months assumes accurate estimation—software projects routinely take 2-3x longer than predicted anyway.
6. We can add features after launch; we cannot add back the time lost to a delayed launch.
7. Customer feedback on a live product is worth more than six months of internal speculation.
8. The fundamental error: treating product development as a single bet rather than an iterative learning process.

---

## Integration Notes

**This workflow requires:**
- Task tool for launching parallel agents
- Ability to launch 32+ agents simultaneously
- Synthesis capability to process multiple agent outputs
- **FirstPrinciples skill** for Deconstruct (Phase 1) and Challenge (Phase 5)

**Pairs well with:**
- `FirstPrinciples/Deconstruct` - breaks argument into fundamental parts (Phase 1)
- `FirstPrinciples/Challenge` - classifies constraints as HARD/SOFT/ASSUMPTION (Phase 5)
- `storyexplanation` skill for initial decomposition
- `extractalpha` for finding highest-signal critiques
- `research` skill for finding counterexamples and precedents

**Time estimate:**
- Phase 1: 2-3 minutes (decomposition)
- Phase 2: 3-5 minutes (parallel execution)
- Phase 3: 2-3 minutes (synthesis)
- Phase 4: 2-3 minutes (final output)
- Total: ~10-15 minutes for comprehensive red team

---

**Last Updated:** 2025-11-24
