# Quick Diagnosis Workflow

**Level 1 Science - For problems under 15 minutes**

This is Minimum Viable Science. When you've been stuck for 15+ minutes or intuition fails, STOP and run this lightweight diagnostic.

---

## When to Use

- You've tried the obvious fix and it didn't work
- You're about to "try random stuff"
- You're pattern-matching without evidence ("I think it's probably...")
- The problem is taking longer than expected

## Anti-Triggers (Don't Use When)

- The fix is obvious and takes 5 minutes
- You've solved this exact pattern 50+ times
- You're in creative/generative mode
- Cost of trying < cost of thinking

---

## The Workflow (2-3 minutes)

### Step 1: State Your Goal (30 seconds)

One sentence. What does "fixed" look like?

```
GOAL: [What will be true when this is solved?]
```

**Examples:**
- "User can log in without 500 error"
- "Build passes without TypeScript errors"
- "Component renders the updated data"

### Step 2: Generate Hypotheses (60 seconds)

**MINIMUM THREE.** If you can't think of three, you haven't thought hard enough.

```
H1: [Most likely cause] - because [evidence/reasoning]
H2: [Second possibility] - because [evidence/reasoning]
H3: [Third possibility] - because [evidence/reasoning]
```

**The Falsification Question:** For each hypothesis, ask: "What would prove this WRONG?"

### Step 3: Rank and Test (60 seconds)

Order by: **Fastest to verify** × **Most likely**

```
Test H[X] first because: [it takes 30 seconds to check]
```

Run the test. What did you observe?

### Step 4: Update and Iterate (30 seconds)

Based on results:
- **Hypothesis confirmed** → Fix it, done
- **Hypothesis refuted** → Move to next hypothesis
- **Inconclusive** → Need more data, design better test

---

## One-Liner Version

When you're really pressed for time:

```
"I think [X] because [Y]. If I'm wrong, [Z] would be true. Let me check [Z]."
```

This single sentence contains: hypothesis, rationale, falsification test.

---

## Examples

### Debugging a Bug

```
GOAL: API returns 200 instead of 500

H1: Database connection timeout - server logs show DB errors
H2: New code introduced regression - deployed yesterday
H3: Rate limiting kicked in - sudden traffic spike

Test H1 first (check logs):
→ Logs show "connection pool exhausted"
→ H1 CONFIRMED - increase pool size
```

### Build Failure

```
GOAL: TypeScript build passes

H1: Type mismatch in new code - just edited that file
H2: Missing dependency types - added new package
H3: Config changed - someone touched tsconfig

Test H1 first (check error location):
→ Error is in file I edited, line I touched
→ H1 CONFIRMED - fix the type annotation
```

### Content Not Rendering

```
GOAL: Component shows updated data

H1: API returning stale data - caching issue
H2: Component not re-rendering - state management
H3: Data transformation bug - shape mismatch

Test H1 first (check network tab):
→ API returns correct data
→ H1 REFUTED, test H2
→ React DevTools shows state not updating
→ H2 CONFIRMED - fix dependency array
```

---

## The Anti-Pattern to Avoid

**Random Flailing:**
```
"Let me try this... nope. Let me try that... nope.
 Maybe if I restart everything... still broken.
 Let me Google random things..."
```

**Structured Diagnosis:**
```
"Let me form three hypotheses, test the fastest one first,
 and systematically eliminate until I find the cause."
```

---

## Exit Criteria

You're done with Quick Diagnosis when:
- Problem is solved
- You need more information than available → escalate to StructuredInvestigation
- Problem is bigger than expected → escalate to StructuredInvestigation

**Time limit:** If 15 minutes of Quick Diagnosis doesn't solve it, escalate.
