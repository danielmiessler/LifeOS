# AlgorithmUpgrade Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Algorithm Upgrade workflow to analyze and propose improvements to the PAI Algorithm"}' \
  > /dev/null 2>&1 &
```

Running the **AlgorithmUpgrade** workflow in the **PAIUpgrade** skill to propose Algorithm improvements...

**Dedicated self-improvement workflow for the PAI Algorithm.** Combines internal reflection mining with Algorithm spec analysis to produce concrete, section-targeted upgrade proposals.

**Trigger:** "algorithm upgrade", "upgrade algorithm", "improve the algorithm", "algorithm improvements", "what should we fix in the algorithm"

---

## Overview

This workflow closes the ultimate feedback loop: the Algorithm reflects on its own performance after every run, and this workflow mines those reflections to propose upgrades to the Algorithm itself.

```
Algorithm Reflections (JSONL)     Current Algorithm Spec
┌──────────────────────────┐     ┌──────────────────────────┐
│ Q1: Execution mistakes   │     │ Version + Changelog      │
│ Q2: Algorithm fixes      │     │ Phase definitions        │
│ Q3: Fundamental gaps     │     │ ISC requirements         │
│ Sentiment + budget data  │     │ Capability matrix        │
└──────────────────────────┘     │ Quality gates            │
           │                     │ PRD integration          │
           └──────────┬──────────┘
                      ▼
        ┌─────────────────────────────┐
        │  SECTION-TARGETED UPGRADES  │
        │  (specific diffs proposed)   │
        └─────────────────────────────┘
```

---

## Algorithm Section Map

Reflections map to Algorithm sections. This is the routing table for where fixes land:

| Theme Pattern | Algorithm Section | File Location |
|---------------|-------------------|---------------|
| ISC quality, criteria vague, wrong count | ISC Requirements, Quality Gate | `## Ideal State Criteria Requirements`, `## Ideal State Criteria Quality Gate` |
| Phase timing, budget, over-budget | Effort Level, Phase Budgets | `## RESPONSE DEPTH SELECTION`, phase budget tables |
| Capability selection, wrong tools | Capabilities Selection | `## CAPABILITIES SELECTION` |
| Agent overhead, wrong parallelization | Agent Instructions | `### Agent Instructions` |
| Context recovery, prior work missed | OBSERVE phase | `━━━ OBSERVE ━━━`, `**CONTEXT RECOVERY**` |
| Verification gaps, claims without proof | VERIFY phase | `━━━ VERIFY ━━━` |
| Plan mode, exploration depth | PLAN phase, Plan Mode | `━━━ PLAN ━━━`, `## Plan Mode Integration` |
| PRD issues, sync problems | PRD Integration | `## PRD Integration` |
| Phase merging, discrete violations | Phase Discipline | `## Discrete Phase Enforcement`, `## Phase Discipline Checklist` |
| Voice, notifications | Voice Announcements | `## Voice Phase Announcements` |
| Loop mode, iteration | Loop Mode, PRD Status | `### Multi-Iteration`, PRD status progression |
| Silent stalls, hanging | No Silent Stalls | `## No Silent Stalls` |

---

## Execution

### Step 1: Read Current Algorithm State

```
Read the current Algorithm version and spec:

1. Read PAI/Algorithm/LATEST to get current version
2. Read PAI/Algorithm/v{VERSION}.md (the full spec)
3. Extract section headers and key rules into a structured map

Report: "Current Algorithm: v{VERSION} — {N} sections, {M} rules"
```

### Step 2: Mine Reflections with Algorithm Focus

Spawn 1 agent:

```
Use Task tool with subagent_type=general-purpose:

"Mine algorithm reflections specifically for Algorithm improvement patterns.

Read MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
Parse each line as JSON.

For EACH entry, analyze Q2 (algorithm improvements) and classify the theme using this routing table:

SECTION ROUTING:
- ISC quality/criteria issues → 'ISC'
- Phase timing/budget issues → 'EFFORT_LEVELS'
- Capability selection issues → 'CAPABILITIES'
- Agent/parallelization issues → 'AGENTS'
- Context recovery issues → 'OBSERVE'
- Verification gaps → 'VERIFY'
- Plan mode issues → 'PLAN'
- PRD/sync issues → 'PRD'
- Phase discipline issues → 'PHASE_DISCIPLINE'
- Voice/notification issues → 'VOICE'
- Loop/iteration issues → 'LOOP'
- Silent stall issues → 'NO_STALLS'
- Other → 'OTHER'

Weight by signal:
- implied_sentiment <= 5 → HIGH signal
- within_budget: false → BOOST
- criteria_failed > 0 → BOOST

Return format:
{
  'entries_analyzed': N,
  'date_range': '[earliest] to [latest]',
  'section_hits': {
    'ISC': { 'count': N, 'quotes': ['...'], 'signal': 'HIGH/MED/LOW' },
    'CAPABILITIES': { 'count': N, 'quotes': ['...'], 'signal': '...' },
    ...
  },
  'top_themes': [
    {
      'section': 'ISC',
      'theme': '[specific issue]',
      'frequency': N,
      'signal': 'HIGH',
      'root_cause': '[why this keeps happening]',
      'quotes': ['[Q2 excerpts with timestamps]']
    }
  ],
  'q3_insights': ['[fundamental improvement ideas from Q3]']
}

If file doesn't exist or is empty, return { 'entries_analyzed': 0 }

EFFORT LEVEL: Return within 60 seconds."
```

### Step 3: Cross-Reference Reflections Against Spec

For each theme from Step 2:

1. **Locate the section** in the Algorithm spec using the routing table
2. **Read the current text** of that section
3. **Identify the gap** between what the spec says and what reflections say goes wrong
4. **Draft the fix** — specific text changes to the Algorithm spec

### Step 4: Generate Upgrade Proposals

For each theme with 2+ occurrences (or 1 if HIGH signal):

```
ALGORITHM UPGRADE PROPOSAL #{N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section: [Algorithm section name]
Priority: [CRITICAL / HIGH / MEDIUM / LOW]
Signal: [N reflections, {HIGH/MED/LOW} average signal]

Problem: [What keeps going wrong, in 1-2 sentences]

Current spec says:
> [Quote the relevant current Algorithm text]

Proposed change:
> [New text that would fix the issue]

Why this helps:
[1-2 sentences explaining how this change prevents the recurring issue]

Evidence:
- [{timestamp}] {task} — "{Q2 quote}"
- [{timestamp}] {task} — "{Q2 quote}"
```

### Step 5: Version Bump Assessment

Based on upgrade proposals:

| Change Type | Version Bump | Threshold |
|-------------|-------------|-----------|
| New phase rules, new sections | Minor (0.X.0) | 3+ CRITICAL proposals |
| Clarifications, guardrails, wording | Patch (0.X.Y) | Any proposals |
| No actionable proposals | None | Reflections too few or all positive |

---

## Output Format

```markdown
# Algorithm Self-Upgrade Report

**Current Version:** v{VERSION}
**Reflections Analyzed:** {N} entries spanning {date range}
**High-Signal Entries:** {N}
**Upgrade Proposals:** {N} ({N} critical, {N} high, {N} medium, {N} low)
**Recommended Version Bump:** v{NEW_VERSION} ({patch/minor/none})

---

## Section Heat Map

Which Algorithm sections have the most recurring issues:

| Section | Hits | Signal | Top Theme |
|---------|------|--------|-----------|
| [Section] | [N] | [HIGH/MED/LOW] | [Theme] |

---

## Upgrade Proposals

[Proposals from Step 4, sorted by priority then frequency]

---

## Aspirational Insights (from Q3)

Ideas that require fundamental changes, not just spec edits:
- [Q3 pattern with frequency]

---

## Next Steps

- [ ] Review proposals
- [ ] Apply approved changes to Algorithm spec
- [ ] Bump version if warranted
- [ ] Run `bun PAI/Tools/RebuildPAI.ts` to rebuild
```

---

## Integration Notes

- **Standalone:** User says "algorithm upgrade" or "improve the algorithm"
- **From MineReflections:** If MineReflections finds Algorithm-related themes, it can suggest running this workflow for deeper analysis
- **From Upgrade:** The main Upgrade workflow's Thread 3 provides a summary; this workflow goes deeper with section-level mapping
