---
name: FocusAlignment
description: TELOS-powered goal alignment checking — verify proposals against life goals, surface neglected areas, assess balance, filter decisions through priorities. USE WHEN focus alignment, alignment check, neglected, life balance, should I do this, opportunity cost, what am I neglecting, focus balance, priority check.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/FocusAlignment/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.


## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the FocusAlignment skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **FocusAlignment** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# FocusAlignment Skill

TELOS-powered goal alignment checking for {PRINCIPAL.NAME}'s life focus areas. Unlike static focus trackers, this skill dynamically reads TELOS files (GOALS.md, MISSION.md, PROJECTS.md, CHALLENGES.md) to discover and assess focus areas at runtime — every user's priorities are different.


## Context Detection

**How the skill discovers focus areas:**

This skill does NOT use hardcoded focus areas. On every invocation:

1. Read `~/.claude/PAI/USER/TELOS/GOALS.md` — extract goal categories as focus areas
2. Read `~/.claude/PAI/USER/TELOS/MISSION.md` — understand overarching purpose
3. Read `~/.claude/PAI/USER/TELOS/PROJECTS.md` — map active projects to goal areas
4. Read `~/.claude/PAI/USER/TELOS/CHALLENGES.md` — identify current obstacles

The intersection of goals, projects, and challenges defines the current focus landscape.


## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **FocusAlignment** skill to ACTION...
```

| Trigger | Workflow |
|---------|----------|
| New proposal, "should I do this?", check alignment | `Workflows/AlignmentCheck.md` |
| "What am I neglecting?", find gaps, neglect scan | `Workflows/NeglectScan.md` |
| Balance assessment, rate investment, review period | `Workflows/BalanceAssessment.md` |
| Decision filter, evaluate choice, opportunity cost | `Workflows/DecisionFilter.md` |

## Quick Reference

| Workflow | Purpose | Input | Output |
|----------|---------|-------|--------|
| **AlignmentCheck** | Verify proposal against TELOS goals | New project/commitment | Alignment score + honest assessment |
| **NeglectScan** | Find neglected goal areas | None (reads TELOS) | Neglected areas + recommendations |
| **BalanceAssessment** | Rate investment across goals | None (reads TELOS + activity) | Balance matrix + insights |
| **DecisionFilter** | Filter decision through priorities | A choice to evaluate | Clear recommendation with reasoning |

## Examples

```
"I'm thinking of starting a podcast — should I?"
-> Invokes AlignmentCheck -> Evaluates against TELOS goals

"What areas of my life am I neglecting?"
-> Invokes NeglectScan -> Scans TELOS for gaps

"How balanced is my focus right now?"
-> Invokes BalanceAssessment -> Rates investment across goal areas

"Should I take this job offer or stay?"
-> Invokes DecisionFilter -> Filters through TELOS priorities
```

## Integration

**Works well with:**
- **Telos** — Reads all TELOS context files for goal discovery
- **BrainDump** — When dumps touch goals/direction, BrainDump suggests running alignment check
- **Research** — Gather context before making alignment decisions

## Principles

1. **Brutal honesty** — Call out when something doesn't serve any goal area
2. **Opportunity cost** — Everything you say yes to means no to something else
3. **Seasons matter** — Some periods emphasize certain areas — that's okay
4. **Progress not perfection** — All areas don't need equal attention always

---

**Last Updated:** 2026-03-02
