# DecisionFilter Workflow

Filter a decision through {PRINCIPAL.NAME}'s TELOS priorities. Use when facing a choice.

## Process

1. **Understand the decision:**
   - What are the options?
   - What's the timeline?
   - What constraints exist?

2. **Load TELOS context:**
   - Read `~/.claude/PAI/USER/TELOS/GOALS.md` — priorities
   - Read `~/.claude/PAI/USER/TELOS/MISSION.md` — purpose
   - Read `~/.claude/PAI/USER/TELOS/PROJECTS.md` — current load
   - Read `~/.claude/PAI/USER/TELOS/STRATEGIES.md` — strategic approaches

3. **Evaluate each option against TELOS:**
   - Which goals does each option serve?
   - Which goals does each option hinder?
   - What's the opportunity cost of each?
   - Does either align with current season/priorities?

4. **Assess fit:**
   - Does this align with MISSION.md?
   - Does this use or develop STRATEGIES.md approaches?
   - What would {PRINCIPAL.NAME} in 5 years think of this choice?

## Output

```
DECISION: [the choice]
OPTIONS: [list]

For each option:
  SERVES: [goal areas]
  COSTS: [opportunity costs]
  ALIGNMENT: [mission fit score 1-5]

RECOMMENDATION: [clear recommendation with reasoning]
CAVEAT: [what you might be wrong about]
```
