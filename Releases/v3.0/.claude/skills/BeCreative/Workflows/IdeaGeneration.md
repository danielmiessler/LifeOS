# IdeaGeneration Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the IdeaGeneration workflow in the BeCreative skill to brainstorm solutions"}' \
  > /dev/null 2>&1 &
```

Running **IdeaGeneration** in **BeCreative**...

---

**When to use:** Brainstorming, problem-solving, innovation

---

## Template

```markdown
## Instructions

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

## Problem

[Problem or challenge description]
```

---

## Best For

- Strategic planning
- Business innovation
- Technical problem-solving
- Product development
- Process improvement

---

## Process

1. **Receive problem/challenge** from user
2. **Apply idea generation template**
3. **Generate 5 diverse solutions** in thinking blocks
4. **Question assumptions** underlying each approach
5. **Cross-pollinate** ideas from different industries
6. **Select breakthrough solution** with highest potential
7. **Present with reasoning** about why it's innovative
