---
name: pai-create-skill
description: "PAI skill development lifecycle manager. Guides scaffold → validate → evaluate workflow for creating new Hermes skills that follow PAI v5 standards."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "You need to create, validate, or evaluate a new Hermes skill following the PAI v5 convention — including SKILL.md frontmatter, workflow routing, procedures, gotchas, and execution logs."
not_for: "Modifying existing skills outside the scaffold/validate/evaluate workflow; non-Hermes skill systems."
tags: [skill, scaffolding, validation, evaluation, development, pai]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-create-skill skill"}' \
  > /dev/null 2>&1 &
```


# pai-create-skill: PAI Skill Development Lifecycle

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User wants a new skill | Scaffold → directory structure → SKILL.md template → validate |
| User wants to validate a skill | Read SKILL.md → check structure → check fields → report issues |
| User wants to evaluate a skill | Execute test scenarios → measure quality → score → report |
| User wants to iterate | Evaluate → identify gaps → scaffold improvements → re-validate |
| User wants batch creation | Multi-scaffold → validate all → evaluate sampled |

## Step-by-Step Procedures

### 1. Scaffold Workflow
```
1. Accept skill metadata from user:
   - name: kebab-case skill name (e.g., pai-my-skill)
   - description: one-line summary
   - use_when: trigger conditions
   - not_for: anti-triggers
   - tags: [comma-separated]
2. Create directory: mkdir -p skills/<name>/
3. Create SKILL.md with template:
   ---
   name: <name>
   description: "<description>"
   version: 5.0.0
   author: PAI v5 Hermes Port
   use_when: "<use_when>"
   not_for: "<not_for>"
   tags: [<tags>]
   ---

   # <name>: <Title>

   ## Workflow Routing

   | Trigger | Route |
   |---------|-------|

   ## Step-by-Step Procedures

   ## Gotchas

   ## Execution Log Pattern

4. Fill in Workflow Routing table (4-6 trigger/route pairs)
5. Fill in 1-3 step-by-step procedures with tool calls
6. Fill in Gotchas section (8-12 items)
7. Fill in Execution Log Pattern (5-7 lines)
8. Report scaffolded skill path and structure
```

### 2. Validate Workflow
```
1. Read SKILL.md from skill directory
2. Check required fields in frontmatter:
   - [REQUIRED] name (string, kebab-case)
   - [REQUIRED] description (string, <200 chars)
   - [REQUIRED] version (semver)
   - [REQUIRED] author (string)
   - [REQUIRED] use_when (string, actionable)
   - [REQUIRED] not_for (string, specific)
   - [REQUIRED] tags (array, 3-6 items)
3. Check required sections:
   - [REQUIRED] # <name> header matches frontmatter name
   - [REQUIRED] ## Workflow Routing table exists
   - [REQUIRED] ## Step-by-Step Procedures exists
   - [REQUIRED] ## Gotchas exists (≥8 items)
   - [REQUIRED] ## Execution Log Pattern exists
4. Validate Workflow Routing:
   - Each row has a Trigger and Route
   - Triggers are user-facing scenarios
   - Routes describe tool-use paths
   - 4-6 rows minimum
5. Validate Step-by-Step Procedures:
   - Numbered steps (1., 2., 3., etc.)
   - References to available tools
   - Clear sub-steps with indentation
   - Each procedure has a clear goal
6. Validate Gotchas:
   - Each is a genuine pitfall, not a feature
   - At least 8 items
   - Specific to this skill, not generic
7. Validate Execution Log Pattern:
   - Lines start with [SKILL-NAME] tag
   - Shows tool calls with arrows
   - Shows completion with timing
   - 5-7 lines
8. Return validation report:
   - ✓ or ✗ per check
   - List of issues with line numbers
   - Severity: error/warning/info
```

### 3. Evaluate Workflow
```
1. Define evaluation criteria:
   a. Completeness: all required fields present
   b. Clarity: can an agent follow procedures without ambiguity
   c. Correctness: tool references are valid
   d. Coverage: edge cases and gotchas covered
   e. Consistency: naming, style, format uniformity
2. Score each criterion 1-5:
   1: Missing or completely broken
   2: Present but insufficient
   3: Adequate
   4: Good
   5: Excellent
3. Run simulated execution:
   a. Agent picks trigger from Workflow Routing
   b. Simulates executing the procedure
   c. Identifies any ambiguous steps
   d. Checks if gotchas would be hit
4. Generate evaluation report:
   - Overall score: XX/25
   - Per-criterion scores
   - "What works well" section
   - "What needs improvement" section
   - Specific recommendations
```

### 4. Iteration Loop
```
1. Evaluate current skill → get improvement list
2. For each improvement:
   a. Patch SKILL.md
   b. Re-validate
   c. If validation passes → next improvement
   d. If validation fails → fix → re-validate
3. Final re-evaluation
4. Report: before/after scores
```

### 5. Batch Scaffold
```
1. Accept list of skill definitions (name + description)
2. For each skill in list:
   a. Scaffold directory + SKILL.md
   b. Auto-generate basic Workflow Routing from description
   c. Auto-generate basic procedures
   d. Auto-generate gotchas
3. Validate all generated skills
4. Report: created N skills with M validation issues
```

## SKILL.md Template Reference

```markdown
---
name: example-name
description: "Short description of what this skill does."
version: 5.0.0
author: PAI v5.0 → Hermes Port
use_when: "When you need to accomplish a specific task using available tools."
not_for: "Tasks that don't match this skill's domain or capabilities."
tags: [tag1, tag2, tag3]
---

# example-name: Description

## Workflow Routing

| Trigger | Route |
|---------|-------|
| User asks a question | Step A → Step B → Step C |

## Step-by-Step Procedures

### 1. Procedure Name
```
1. Step one
2. Step two
```

## Gotchas

- Warning about common issue #1
- Warning about common issue #2

## Execution Log Pattern

```
[TAG] Starting procedure
[STEP] Action taken
[COMPLETE] Finished in X.Xs
```
```

## Gotchas

- name must be kebab-case only (no spaces, underscores, or special chars)
- description must be ≤200 characters
- use_when must describe specific trigger conditions
- not_for must describe what this skill explicitly should NOT be used for
- Workflow Routing must have at least 4 rows
- Gotchas must have at least 8 items that are actual pitfalls
- Execution Log Pattern must use [SKILL-NAME] tag format
- Validation errors block evaluation; fix them first
- Auto-generated content from batch scaffold always needs human review
- Scoring is relative to PAI v5 standards, not absolute

## Execution Log Pattern

```
[PAI-CREATE-SKILL] Scaffolding: pai-my-new-skill
[DIR] Created skills/pai-my-new-skill/
[SKILL] SKILL.md generated with template structure
[VALID] Checking required fields... all pass (7/7)
[VALID] Checking required sections... all pass (5/5)
[VALID] Workflow Routing: 5 rows ✓
[VALID] Gotchas: 10 items ✓
[EVAL] Score: 21/25 (Completeness:5 Clarity:4 Correctness:4 Coverage:4 Consistency:4)
[COMPLETE] Skill ready for use
```
