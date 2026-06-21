# AlgorithmUpgrade Workflow

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
           │                     │ ISA integration          │
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
| ISA issues, sync problems | ISA Integration | `## ISA Integration` |
| Phase merging, discrete violations | Phase Discipline | `## Discrete Phase Enforcement`, `## Phase Discipline Checklist` |
| Notifications | System Notifications | `## System Notifications` |
| Loop mode, iteration | Loop Mode, ISA Status | `### Multi-Iteration`, ISA status progression |
| Silent stalls, hanging | No Silent Stalls | `## No Silent Stalls` |

---

## Execution

### Step 1: Read & Deeply Understand Current Algorithm

The algorithm changes frequently. Every upgrade analysis MUST start by reading and internalizing the current version — not from memory, not from assumptions.

```
1. Read PAI/ALGORITHM/LATEST to get current version string (e.g., "v3.7.0")
2. Read PAI/ALGORITHM/v{VERSION}.md — the FULL spec, every line
3. Produce a structured digest:

   ALGORITHM DIGEST: v{VERSION}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Phases: [list each phase with its key mandate]
   Quality Gates: [list each gate with its pass/fail criteria]
   ISC Rules: [summarize ISC construction and verification rules]
   Effort Levels: [list levels and their budget constraints]
   Capability System: [how capabilities are selected]
   Agent Rules: [when/how subagents are spawned]
   ISA Integration: [how ISAs are created and tracked]
   Notification: [notification rules]
   Loop Mode: [multi-iteration rules]
   Key Guardrails: [rules that constrain behavior — phase discipline, no silent stalls, etc.]

   DESIGN DECISIONS (important for upgrade analysis):
   - [List 5-10 deliberate design choices visible in the spec,
      e.g., "OBSERVE must complete before PLAN", "ISC requires anti-criteria",
      "Extended effort gets agent parallelization"]

This digest is the baseline. Every upgrade proposal must be compared against it
to avoid proposing changes that contradict existing design intent.
```

### Step 2: Gather All Learning Signals

The learning system captures signals across multiple sources. Read ALL of them — not just reflections.

#### 2a: Algorithm Reflections (primary)

```
Read ~/.claude/PAI/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
Parse each line as JSON. This is the richest source — Q1/Q2/Q3 self-reflection after each Algorithm run.
```

#### 2b: Rating Signals

```
Read ~/.claude/PAI/MEMORY/LEARNING/SIGNALS/ratings.jsonl
Focus on entries with rating <= 5. Extract the response_preview and sentiment_summary
to understand WHAT went wrong from the user's perspective (not just the algorithm's self-assessment).
```

#### 2c: Algorithm-Specific Learnings

```
Read all files in ~/.claude/PAI/MEMORY/LEARNING/ALGORITHM/ (latest month first, then previous month)
These are detailed learning captures from low-sentiment sessions — they contain root cause analysis
that reflections alone may miss.
```

#### 2d: Failure Patterns

```
Read ~/.claude/PAI/MEMORY/LEARNING/FAILURES/ (latest month, plus ROOT_CAUSE_ANALYSIS.md)
These capture recurring failure patterns. Cross-reference against the Algorithm digest from Step 1
to identify which Algorithm rules SHOULD have prevented these failures but didn't.
```

### Step 3: Classify All Signals Against Current Algorithm

Using the Algorithm digest from Step 1 and ALL learning data from Step 2, spawn 1 agent:

```
Use Agent tool with subagent_type=general-purpose:

"Analyze all learning signals against the current Algorithm spec.

You have four data sources to analyze:

SOURCE 1: algorithm-reflections.jsonl (Step 2a)
Read ~/.claude/PAI/MEMORY/LEARNING/REFLECTIONS/algorithm-reflections.jsonl
Parse each line as JSON.
For EACH entry, analyze Q2 (algorithm improvements).

SOURCE 2: Low-rated sessions from ratings.jsonl (Step 2b)
Read ~/.claude/PAI/MEMORY/LEARNING/SIGNALS/ratings.jsonl
Filter to rating <= 5. For each, extract what went wrong.

SOURCE 3: Algorithm learning files (Step 2c)
Read files in ~/.claude/PAI/MEMORY/LEARNING/ALGORITHM/ (2026-03/ then 2026-02/)

SOURCE 4: Failure patterns (Step 2d)
Read ~/.claude/PAI/MEMORY/LEARNING/FAILURES/ latest month + ROOT_CAUSE_ANALYSIS.md

For EACH signal across ALL sources, classify the theme using this routing table:

SECTION ROUTING:
- ISC quality/criteria issues → 'ISC'
- Phase timing/budget issues → 'EFFORT_LEVELS'
- Capability selection issues → 'CAPABILITIES'
- Agent/parallelization issues → 'AGENTS'
- Context recovery issues → 'OBSERVE'
- Verification gaps → 'VERIFY'
- Plan mode issues → 'PLAN'
- ISA/sync issues → 'ISA'
- Phase discipline issues → 'PHASE_DISCIPLINE'
- Notification issues → 'NOTIFICATIONS'
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

### Step 3.5: Claude Code Freshness Validation

Before proposing Algorithm changes, verify that the Algorithm's Claude Code references (Platform Capabilities table, agent types, hook events, slash commands) are current:

```
Use Agent tool with subagent_type=claude-code-guide:

"The PAI Algorithm has a Platform Capabilities table referencing Claude Code features.
Read the current Algorithm spec at ~/.claude/PAI/ALGORITHM/v{VERSION}.md (get version from ~/.claude/PAI/ALGORITHM/LATEST).

Verify that:
1. All subagent_type values in the table are valid current types
2. All slash commands referenced (e.g., /simplify, /batch, /debug) still exist
3. Hook event types referenced match the current Claude Code hook API
4. Any Claude Code features mentioned are current (not deprecated or renamed)
5. Any MISSING Claude Code features that should be in the Algorithm's awareness

Return:
{
  'stale_references': [{'reference': '...', 'current_state': '...', 'fix': '...'}],
  'missing_features': [{'feature': '...', 'why_relevant': '...', 'proposed_entry': '...'}],
  'confirmed_current': ['list of references that are still accurate']
}

EFFORT LEVEL: Return within 60 seconds."
```

Include any stale references or missing features as additional upgrade proposals in Step 5, tagged with source `claude-code-guide` and priority based on staleness impact.

### Step 4: Cross-Reference Signals Against Current Algorithm Spec

For each theme from Step 3, using the Algorithm digest from Step 1:

1. **Locate the section** in the current Algorithm spec (v{VERSION}.md) using the routing table
2. **Read the current text** of that section — quote it exactly
3. **Compare against the digest's Design Decisions** — is this a known design choice being violated, or a genuine gap?
4. **Identify the gap** — what does the spec say vs. what actually goes wrong? Is the rule missing, too weak, ambiguous, or just not enforced?
5. **Draft the fix** — specific text changes to the Algorithm spec, with before/after

IMPORTANT: Do not propose changes that contradict existing design decisions
unless the learning data shows those decisions are fundamentally wrong.
A rule that exists but isn't followed needs enforcement, not removal.

### Step 5: Generate Upgrade Proposals

For each theme with 2+ occurrences across ALL sources (or 1 if HIGH signal):

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

### Step 6: Version Bump Assessment

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
- [ ] `PAI_ARCHITECTURE_SUMMARY.md` auto-regenerates via DocIntegrity on Stop; no manual rebuild
```

---

## Integration Notes

- **Standalone:** User says "algorithm upgrade" or "improve the algorithm"
- **From MineReflections:** If MineReflections finds Algorithm-related themes, it can suggest running this workflow for deeper analysis
- **From Upgrade:** The main Upgrade workflow's Thread 3 provides a summary; this workflow goes deeper with section-level mapping
