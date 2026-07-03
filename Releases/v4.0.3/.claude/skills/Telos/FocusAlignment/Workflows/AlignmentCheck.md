# AlignmentCheck Workflow

Check new proposals or commitments against {PRINCIPAL.NAME}'s TELOS goals.

## Trigger

When {PRINCIPAL.NAME} proposes something new — a project, commitment, opportunity, or initiative.

## Process

1. **Load TELOS context:**
   - Read `~/.claude/PAI/USER/TELOS/GOALS.md` — extract goal categories
   - Read `~/.claude/PAI/USER/TELOS/MISSION.md` — understand purpose
   - Read `~/.claude/PAI/USER/TELOS/PROJECTS.md` — current commitments

2. **Map the proposal to goals:**
   - Which goal area(s) does this serve?
   - How directly does it serve them? (primary vs. tangential)

3. **Check for conflicts:**
   - Does it compete with higher-priority goals?
   - Does it duplicate existing projects?
   - What's the time/energy cost?

4. **Honest assessment:**
   - Clear statement of which goals it serves
   - Clear statement of what it costs
   - If it doesn't serve any goals, say so directly
   - If {PRINCIPAL.NAME} already has too many commitments, flag it

## Output

```
PROPOSAL: [what was proposed]
SERVES: [goal areas it advances]
COSTS: [what it takes away from]
CONFLICTS: [competing priorities]
ASSESSMENT: [honest recommendation]
```
