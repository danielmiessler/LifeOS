# TreeOfThoughts Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the TreeOfThoughts workflow in the BeCreative skill to explore solution paths"}' \
  > /dev/null 2>&1 &
```

Running **TreeOfThoughts** in **BeCreative**...

---

**When to use:** Complex creative problem-solving requiring exploration of multiple paths

---

## Template

```markdown
## Instructions

DEEP THINKING + TREE OF THOUGHTS

### Step 1: Deep Analysis

Think deeply about this complex problem before exploring solutions:
- What are the key constraints and opportunities?
- What paradigms or frameworks might apply?
- What unexpected connections can be made?
- What would a breakthrough solution look like?

### Step 2: Branching Exploration

1. Identify 3-5 fundamentally different approaches
2. For the most promising approaches, explore variations and sub-approaches
3. At each branch point, apply deep thinking to explore implications
4. Evaluate all paths considering both creativity and viability
5. Synthesize the most innovative yet practical solution

### Step 3: Synthesis

Combine insights from your exploration into the optimal creative solution.

## Challenge

[Complex creative challenge]
```

---

## Best For

- Complex strategic decisions
- Multi-constraint optimization problems
- High-stakes innovation challenges
- When multiple factors must be balanced

---

## Process

1. **Receive complex challenge** from user
2. **Deep analysis phase** - understand constraints and opportunities
3. **Branch exploration** - identify 3-5 fundamentally different approaches
4. **Evaluate each branch** - consider implications and viability
5. **Cross-pollinate** - combine insights from multiple branches
6. **Synthesize solution** - integrate best elements into optimal approach
