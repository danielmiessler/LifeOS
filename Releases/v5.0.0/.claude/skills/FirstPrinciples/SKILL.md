---
name: FirstPrinciples
description: "Physics-based reasoning framework (Musk/Elon methodology) that deconstructs problems to irreducible fundamental truths rather than reasoning by analogy. Three-step structure: DECONSTRUCT (break to constituent parts and actual values), CHALLENGE (classify every element as hard constraint / soft constraint / unvalidated assumption — only physics is truly immutable), RECONSTRUCT (build optimal solution from fundamentals alone, ignoring inherited form). Outputs: constituent-parts breakdown, constraint classification table, and reconstructed solution with key insight. Three workflows: Deconstruct.md, Challenge.md, Reconstruct.md. Integrates with RedTeam (attack assumptions before deploying adversarial agents), Security (decompose threat model), Architecture (challenge design constraints), and Pentesters (decompose assumed security boundaries). Other skills invoke via: Challenge on all stated constraints → classify as hard/soft/assumption. Cross-domain synthesis: solutions from unrelated fields often apply once the fundamental truths are exposed. NOT FOR incident investigation and causal chains (use RootCauseAnalysis). NOT FOR structural feedback loops (use SystemsThinking). USE WHEN first principles, fundamental truths, challenge assumptions, is this a real constraint, rebuild from scratch, what are we actually paying for, what is this really made of, start over, physics first, question everything, reasoning by analogy, is this really necessary."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/FirstPrinciples/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# FirstPrinciples Skill

Foundational reasoning methodology based on Elon Musk's physics-based thinking framework. Deconstructs problems to fundamental truths rather than reasoning by analogy.

## Core Concept

**Reasoning by Analogy** (default, often wrong):
- "How did we solve something similar?"
- "What do others do?"
- Copies existing solutions with slight variations

**Reasoning from First Principles** (this skill):
- "What are the fundamental truths here?"
- "What is this actually made of?"
- Rebuilds solutions from irreducible facts

## When to Use

- **Architects**: Challenge "is this actually a constraint or just how we've always done it?"
- **Pentesters**: Identify actual attack surfaces vs. assumed security boundaries
- **RedTeam**: Sharpen adversarial analysis by deconstructing assumptions
- **Engineers**: When stuck, rebuild from fundamentals
- **Any skill**: When inherited assumptions may be limiting the solution space

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **FirstPrinciples** skill to ACTION...
```

  - Break problem into fundamental parts → `Workflows/Deconstruct.md`
  - Challenge assumptions systematically → `Workflows/Challenge.md`
  - Rebuild solution from fundamentals → `Workflows/Reconstruct.md`

## The 3-Step Framework

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

## Key Questions

### Deconstruction Questions
- What is this actually made of?
- What are the constituent parts?
- What is the actual cost/value of each part?
- What would a physicist say about this?

### Challenge Questions
- Is this a hard constraint (physics/reality) or soft constraint (policy/choice)?
- What if we removed this constraint entirely?
- Who decided this was a constraint and why?
- What evidence supports this assumption?

### Reconstruction Questions
- If we started from scratch with only the fundamental truths, what would we build?
- What field has solved an analogous problem differently?
- Are we optimizing function or form?
- What's the simplest solution that satisfies only the hard constraints?

## Constraint Classification

When analyzing any system, classify constraints:

| Type | Definition | Example | Can Change? |
|------|------------|---------|-------------|
| **Hard** | Physics/reality | "Data can't travel faster than light" | No |
| **Soft** | Policy/choice | "We always use REST APIs" | Yes |
| **Assumption** | Unvalidated belief | "Users won't accept that UX" | Maybe false |

**Rule**: Only hard constraints are truly immutable. Soft constraints and assumptions should be challenged.

## Integration Pattern

Other skills invoke FirstPrinciples like this:

```markdown
## Before Analysis
→ Use FirstPrinciples/Challenge on all stated constraints
→ Classify each as hard/soft/assumption

## When Stuck
→ Use FirstPrinciples/Deconstruct to break down the problem
→ Use FirstPrinciples/Reconstruct to rebuild from fundamentals

## For Adversarial Analysis
→ RedTeam uses FirstPrinciples/Challenge to attack assumptions
→ Pentester uses FirstPrinciples/Deconstruct on security model
```

## Examples

### Example 1: Architecture Decision
**Problem**: "We need microservices because that's how modern apps are built"

**First Principles Analysis**:
1. **Deconstruct**: What does this app actually need? (team size, scale, complexity)
2. **Challenge**: Is "microservices" a hard constraint? No - it's reasoning by analogy
3. **Reconstruct**: Given our 3-person team and moderate scale, a modular monolith optimizes for our actual constraints

### Example 2: Security Assessment
**Problem**: "The firewall protects the internal network"

**First Principles Analysis**:
1. **Deconstruct**: What is the firewall actually doing? (packet filtering on specific ports)
2. **Challenge**: Does packet filtering = protection? What about authorized ports? Insider threats?
3. **Reconstruct**: Protection requires defense in depth - firewall is one layer, not "the" protection

### Example 3: Cost Optimization
**Problem**: "Cloud hosting costs $10,000/month - that's just what it costs"

**First Principles Analysis**:
1. **Deconstruct**: What are we actually paying for? (compute, storage, bandwidth, managed services)
2. **Challenge**: Is managed Kubernetes a hard requirement? Is this region required?
3. **Reconstruct**: Actual compute needs = $2,000. The other $8,000 is convenience we're choosing to pay for

## Output Format

When using FirstPrinciples, output should include:

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

## Principles

1. **Physics First** - Real constraints come from physics/reality, not convention
2. **Function Over Form** - Optimize what you're trying to accomplish, not how it's traditionally done
3. **Question Everything** - Every assumption is guilty until proven innocent
4. **Cross-Domain Synthesis** - Solutions from unrelated fields often apply
5. **Rebuild, Don't Patch** - When assumptions are wrong, start fresh rather than fixing

## Anti-Patterns to Avoid

- **Reasoning by Analogy**: "Company X does it this way, so should we"
- **Accepting Market Prices**: "Batteries cost $600/kWh" without checking material costs
- **Form Fixation**: Improving the suitcase instead of inventing wheels
- **Soft Constraint Worship**: Treating policies as physics
- **Premature Optimization**: Optimizing before understanding fundamentals

---

**Attribution**: Framework derived from Elon Musk's first principles methodology as documented by James Clear, Mayo Oshin, and public interviews.

## Gotchas

- **Decompose to AXIOMS — fundamental truths, not just simpler components.** The value is in finding the irreducible elements.
- **Challenge INHERITED assumptions specifically.** What does everyone assume that might be wrong?
- **This is analysis/reasoning, not implementation.** "Analyze" = FirstPrinciples. "Fix" = do the work directly.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"FirstPrinciples","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> ~/.claude/PAI/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
