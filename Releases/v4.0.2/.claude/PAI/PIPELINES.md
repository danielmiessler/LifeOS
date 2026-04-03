# Pipelines

> **PAI 4.0** — This system is under active development. APIs, configuration formats, and features may change without notice.

**Chaining Actions into Sequential Workflows**

Pipelines are the fourth primitive in the architecture. They chain Actions together into multi-step workflows using the pipe model.

> **Note:** Personal pipeline definitions are stored in `USER/PIPELINES/`. This document describes the framework.

---

## What Pipelines Are

Pipelines orchestrate **sequences of Actions** into cohesive workflows. They differ from Actions in a critical way: Actions are single-step workflow patterns, while Pipelines chain multiple Actions together in sequence using the pipe model (output of action N becomes input of action N+1).

**The Pipeline Pattern:**

```
Input → Action1 → Action2 → Action3 → Output
         (each action receives upstream output via passthrough)
```

**Real Example - Content Processing:**

```
RSS Item → A_PARSE → A_ENRICH → A_FORMAT → A_SEND_EMAIL → Delivered
```

**When Actions Run Alone vs In Pipelines:**

| Scenario | Use |
|----------|-----|
| Single task with clear input/output | **Action** |
| Multi-step workflow with dependencies | **Pipeline** |
| Parallel independent tasks | Multiple **Actions** |
| Sequential dependent tasks | **Pipeline** |

---

## Pipe Model

Pipelines use a Unix-style pipe model: the output of action N becomes the input of action N+1.

```
Input → Action1 → Action2 → Action3 → Output
           |            |            |
        transform     enrich      format
```

### Passthrough Pattern

Actions use the passthrough pattern (`...upstream`) to preserve metadata from previous actions while adding their own output. This ensures that context accumulates as data moves through the pipeline rather than being discarded at each step.

```typescript
// Action receives upstream data, adds its own, passes everything forward
return {
  ...upstream,        // preserve all prior action output
  myField: result,    // add this action's contribution
};
```

The final action in a pipeline has access to every field produced by every preceding action --- not just the immediately previous one.

---

## Pipeline Definition

### YAML Format (Arbol)

In the Arbol system, pipelines are defined as YAML files that declare an ordered list of actions:

```yaml
name: P_MY_PIPELINE
description: Processes items through enrichment and formatting
actions:
  - A_PARSE
  - A_ENRICH
  - A_FORMAT
```

The pipeline worker calls each action in sequence via service bindings, passing output forward via the pipe model.

### PIPELINE.md Format (Local)

Local pipeline definitions live in `~/.claude/PAI/PIPELINES/[Domain]_[Pipeline-Name]/PIPELINE.md`

```markdown
# [Pipeline_Name] Pipeline

**Purpose:** [One sentence describing what this pipeline achieves]
**Domain:** [e.g., Blog, Newsletter, Art, PAI]
**Version:** 1.0

---

## Pipeline Overview

| Step | Action | Purpose |
|------|--------|---------|
| 1 | [Action_Name] | [What this step accomplishes] |
| 2 | [Action_Name] | [What this step accomplishes] |
| 3 | [Action_Name] | [What this step accomplishes] |
```

### Naming Convention

```
~/.claude/PAI/PIPELINES/
├── Blog_Publish-Post/          # Domain_Action-Format
│   └── PIPELINE.md
├── Newsletter_Full-Cycle/
│   └── PIPELINE.md
└── PIPELINE-TEMPLATE.md        # Template for new pipelines (planned)
```

---

## Pipeline vs Action

### When to Use an Action

- Single discrete task
- Clear input/output contract
- No dependencies on other Actions
- Can run in isolation

**Examples:** `Blog_Deploy`, `Art_Create-Essay-Header`, `Newsletter_Send`

### When to Use a Pipeline

- Multiple dependent steps
- Sequential processing with data accumulation
- Complex workflow with ordered operations

**Examples:** `Blog_Publish-Post`, `Newsletter_Full-Cycle`, `PAI_Release`

### Decision Matrix

| Criteria | Action | Pipeline |
|----------|--------|----------|
| Steps | 1 | 2+ |
| Dependencies | None | Sequential |
| Data model | Single input/output | Passthrough accumulation |
| Reusability | High (composable) | Orchestration layer |

---

## Creating New Pipelines

### Step 1: Identify the Workflow

Map out the complete workflow:

1. What Actions already exist that can be chained?
2. What new Actions need to be created?
3. What data needs to pass between steps via the passthrough pattern?

### Step 2: Create Pipeline Directory

```bash
mkdir -p ~/.claude/PAI/PIPELINES/[Domain]_[Pipeline-Name]
# PIPELINE-TEMPLATE.md is planned but not yet created
# For now, copy an existing pipeline and modify it
cp ~/.claude/PAI/PIPELINES/Blog_Publish-Post/PIPELINE.md ~/.claude/PAI/PIPELINES/[Domain]_[Pipeline-Name]/PIPELINE.md
```

### Step 3: Define Overview Table

```markdown
## Pipeline Overview

| Step | Action | Purpose |
|------|--------|---------|
| 1 | Action_One | First step purpose |
| 2 | Action_Two | Second step purpose |
| 3 | Action_Three | Third step purpose |
```

### Step 4: Define Each Step

For each step, specify:

1. **Action** - Path to ACTION.md or Arbol action name (A_NAME)
2. **Input** - What this step requires (from upstream passthrough or initial input)
3. **Output** - What fields this step adds to the passthrough object

---

## Pipeline Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│                    PIPELINE START                        │
│                    (receives input)                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Action 1: Execute                                       │
│  └─► Receives input, returns { ...upstream, ownFields }  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Action 2: Execute                                       │
│  └─► Receives Action 1 output, adds its own fields      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                   [Repeat for each action]
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Final Action: Execute                                   │
│  └─► Has access to ALL upstream fields                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    PIPELINE COMPLETE                     │
│              (returns accumulated output)                │
└─────────────────────────────────────────────────────────┘
```

**Note on iteration:** Pipelines always run once. If iteration is needed, the calling Flow handles it via the Loop Gate pattern (see `FLOWS.md`).

---

## Best Practices

### 1. Keep Steps Atomic

Each step should do one thing. If a step is doing multiple things, split into multiple steps.

### 2. Use the Passthrough Pattern

Always spread upstream data (`...upstream`) so downstream actions have access to all prior fields. Never discard upstream context.

### 3. Document Data Flow

For each action in the pipeline, document what fields it reads from upstream and what fields it adds. This makes the data contract explicit.

### 4. Keep Actions Reusable

Actions should not be tightly coupled to a specific pipeline. Design them to work with any upstream data shape via the passthrough pattern.

---

## Related Documentation

- **Actions:** `~/.claude/PAI/ACTIONS.md`
- **Flows:** `~/.claude/PAI/FLOWS.md`
- **Architecture:** `~/.claude/PAI/PAISYSTEMARCHITECTURE.md`
- **Detailed README:** `~/.claude/PAI/PIPELINES/README.md`
- **Source code:** `~/Projects/arbol/`

---

**Last Updated:** 2026-02-22

---

## Changelog

| Date | Change | Author | Related |
|------|--------|--------|---------|
| 2026-02-22 | Removed unimplemented verification gate system, added pipe model docs, aligned with actual Arbol codebase | {DAIDENTITY.NAME} | ARBOLSYSTEM.md, FLOWS.md |
| 2026-02-03 | Updated cross-references to new ACTIONS.md and FLOWS.md | {DAIDENTITY.NAME} | ACTIONS.md, FLOWS.md |
| 2026-01-01 | Initial document creation | {DAIDENTITY.NAME} | - |
