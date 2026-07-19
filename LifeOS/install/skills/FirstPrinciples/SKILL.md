---
name: FirstPrinciples
version: 1.1.14
description: "Physics-based reasoning framework (Musk methodology) that deconstructs a problem to irreducible fundamental truths, classifies every element as hard constraint, soft constraint, or assumption, then reconstructs the optimal solution from fundamentals alone. USE WHEN first principles, fundamental truths, challenge assumptions, real constraint, rebuild from scratch, start over, physics first, question everything, reasoning by analogy. NOT FOR structural feedback loops (use SystemsThinking)."
effort: high
---

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/FirstPrinciples/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the FirstPrinciples skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **FirstPrinciples** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# FirstPrinciples Skill

## What It Does

Breaks a problem down to its fundamental truths and rebuilds the solution from there, instead of copying what already exists. Three steps: DECONSTRUCT (break it into constituent parts and real values), CHALLENGE (classify every element as hard constraint, soft constraint, or unvalidated assumption — only physics is truly immutable), and RECONSTRUCT (build the optimal solution from the fundamentals alone). Outputs a parts breakdown, a constraint table, and a reconstructed solution.

## The Core Distinction

Most reasoning is reasoning by analogy — "how did we solve something similar," "what do others do" — then copy it with tweaks. That inherits everyone else's assumptions and treats policy and convention as if they were laws of physics, so you optimize the suitcase instead of inventing wheels. First principles forces the split between what's actually immutable and what's merely inherited, then rebuilds from only the parts that can't change.

- **Reasoning by analogy** (default, often wrong): copies existing solutions with slight variations.
- **Reasoning from first principles** (this skill): asks "what is this actually made of?" and rebuilds from irreducible facts.

Invoked directly, or by other skills when inherited assumptions may be limiting the solution space — Architects challenging "constraint or convention?", RedTeam and pentesters attacking assumed boundaries, engineers escaping local maxima.


## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **FirstPrinciples** skill to ACTION...
```

  - Break problem into fundamental parts → `Workflows/Deconstruct.md`
  - Challenge assumptions systematically → `Workflows/Challenge.md`
  - Rebuild solution from fundamentals → `Workflows/Reconstruct.md`

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

## Example

**Problem**: "Cloud hosting costs $10,000/month — that's just what it costs."

- **Deconstruct**: What are we actually paying for? (compute, storage, bandwidth, managed services)
- **Challenge**: Is managed Kubernetes a hard requirement? Is this region required? The $10K is a market price, not a fundamental cost.
- **Reconstruct**: Actual compute need = $2,000. The other $8,000 is convenience we're choosing to pay for.

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

## The Load-Bearing Rules

- **Market prices and industry best-practices are NOT fundamental truths.** "Batteries cost $600/kWh" or "hosting costs $10K/mo" are convention, not physics — deconstruct to material/compute cost before accepting them.
- **Optimize function over form** — what you're trying to accomplish, not how it's traditionally done (improve the wheel, don't polish the suitcase).
- **Rebuild, don't patch** — when the assumptions are wrong, start from the hard constraints rather than fixing the inherited form. Cross-domain solutions from unrelated fields often apply.

---

**Attribution**: Framework derived from Elon Musk's first principles methodology as documented by James Clear, Mayo Oshin, and public interviews.

## Gotchas

- **Decompose to AXIOMS — fundamental truths, not just simpler components.** The value is in finding the irreducible elements.
- **Challenge INHERITED assumptions specifically.** What does everyone assume that might be wrong?
- **This is analysis/reasoning, not implementation.** "Analyze" = FirstPrinciples. "Fix" = do the work directly.

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"FirstPrinciples","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
