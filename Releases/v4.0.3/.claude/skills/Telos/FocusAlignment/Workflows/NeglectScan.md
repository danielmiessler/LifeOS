# NeglectScan Workflow

Scan {PRINCIPAL.NAME}'s TELOS goals to find neglected areas.

## Process

1. **Load TELOS context:**
   - Read `~/.claude/PAI/USER/TELOS/GOALS.md` — all goal areas
   - Read `~/.claude/PAI/USER/TELOS/PROJECTS.md` — what's actively being worked on
   - Read `~/.claude/PAI/USER/TELOS/CHALLENGES.md` — what's blocking progress

2. **Map activity to goals:**
   - For each goal area, check: Are there active projects serving it?
   - Are there recent updates or progress?
   - Is this area mentioned in challenges?

3. **Identify neglected areas:**
   - Goal areas with no active projects
   - Goal areas with no recent attention
   - Goal areas where challenges are piling up without action

4. **Recommend next steps:**
   - Rank neglected areas by importance (from MISSION.md context)
   - Suggest one small action per neglected area
   - Don't overwhelm — focus on the top 2-3 most neglected

## Output

For each goal area:
```
| Goal Area | Active Projects | Recent Attention | Status |
|-----------|----------------|------------------|--------|
| [area] | [count/names] | [yes/no] | ✅ Active / ⚠️ Neglected / 🔴 Abandoned |
```

Plus specific recommendations for neglected areas.
