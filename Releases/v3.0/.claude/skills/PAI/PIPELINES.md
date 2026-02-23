# Pipelines

> **PAI 3.0 Alpha** — This system is under active development. APIs, configuration formats, and features may change without notice.

**Orchestrating Sequences of Actions with Verification Gates**

Pipelines are the fourth primitive in the architecture. They chain Actions together into multi-step workflows with mandatory verification between each step.

> **Note:** Personal pipeline definitions are stored in `USER/PIPELINES/`. This document describes the framework.

---

## What Pipelines Are

Pipelines orchestrate **sequences of Actions** into cohesive workflows. They differ from Actions in a critical way: Actions are single-step workflow patterns, while Pipelines chain multiple Actions together with verification gates between each step.

**The Pipeline Pattern:**

```
Input → Action1 → Verify → Action2 → Verify → Action3 → Verify → Output
```

**Real Example - Blog Publishing:**

```
Post.md → Validate-Frontmatter → Verify → Validate-Images → Verify → Proofread → Verify → Deploy → Verify → Visual-Verify → Live
```

**When Actions Run Alone vs In Pipelines:**

| Scenario | Use |
|----------|-----|
| Single task with clear input/output | **Action** |
| Multi-step workflow with dependencies | **Pipeline** |
| Parallel independent tasks | Multiple **Actions** |
| Sequential dependent tasks | **Pipeline** |

---

## PIPELINE.md Format

Every pipeline lives in `~/.claude/PIPELINES/[Domain]_[Pipeline-Name]/PIPELINE.md`

### Required Sections

```markdown
# [Pipeline_Name] Pipeline

**Purpose:** [One sentence describing what this pipeline achieves]
**Domain:** [e.g., Blog, Newsletter, Art, PAI]
**Version:** 1.0

---

## Pipeline Overview

| Step | Action | Purpose | On Fail |
|------|--------|---------|---------|
| 1 | [Action_Name] | [What this step accomplishes] | abort |
| 2 | [Action_Name] | [What this step accomplishes] | prompt |
| 3 | [Action_Name] | [What this step accomplishes] | retry(3) |

---

## Steps

### Step 1: [Action_Name]

**Action:** `~/.claude/ACTIONS/[Action_Name]/ACTION.md`

**Input:**
- [Required input 1]
- [Required input 2]

**Verification:**
| # | Criterion | Oracle | Check | On Fail |
|---|-----------|--------|-------|---------|
| 1 | [What to verify] | [file/http/visual] | [Specific check] | abort |

**On Failure:** `abort`

---

[Repeat for each step...]

---

## Pipeline Verification

**Goal:** [Ultimate outcome this pipeline achieves]

| # | Criterion | Oracle | Check |
|---|-----------|--------|-------|
| 1 | [Final verification] | [http/visual] | [Specific check] |
```

### Naming Convention

```
~/.claude/PIPELINES/
├── Blog_Publish-Post/          # Domain_Action-Format
│   └── PIPELINE.md
├── Newsletter_Full-Cycle/
│   └── PIPELINE.md
└── PIPELINE-TEMPLATE.md        # Template for new pipelines (planned)
```

---

## Verification Gates

Every step in a pipeline has a verification gate. **No step proceeds without verification passing.**

### Oracle Types

| Oracle | Automated | Example |
|--------|-----------|---------|
| file | Yes | `test -f path`, `identify`, `stat` |
| http | Yes | `curl -s -o /dev/null -w "%{http_code}"` |
| json | Yes | `jq '.field == "expected"'` |
| command | Yes | Any bash command with exit code |
| visual | No | "Read image, verify X" |
| manual | No | "Get user approval" |

### Failure Actions

| Action | Meaning |
|--------|---------|
| `abort` | Stop pipeline execution, report error |
| `retry(N)` | Attempt again (max N times) |
| `continue` | Log warning, proceed to next step |
| `prompt` | Ask user how to proceed |

### Verification Table Format

```markdown
| # | Criterion | Oracle | Check | On Fail |
|---|-----------|--------|-------|---------|
| 1 | File exists | file | `test -f $PATH` | abort |
| 2 | HTTP 200 | http | `curl -I $URL` returns 200 | retry(3) |
| 3 | Image valid | command | `identify $IMAGE` succeeds | abort |
| 4 | Renders correctly | visual | Screenshot shows content | prompt |
```

---

## Visual Execution Format

When executing a pipeline, display progress using this exact format:

### Starting State

```
Pipeline: Blog_Publish-Post
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/5] ⏳ Blog_Validate-Frontmatter     PENDING
[2/5] ⏳ Blog_Validate-Images          PENDING
[3/5] ⏳ Blog_Proofread                PENDING
[4/5] ⏳ Blog_Deploy                   PENDING
[5/5] ⏳ Blog_Visual-Verify            PENDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 0/5 complete | Starting pipeline...
```

### During Execution

```
Pipeline: Blog_Publish-Post
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/5] ✅ Blog_Validate-Frontmatter     PASS
      ├─ ✅ All required fields present
      ├─ ✅ Status is draft
      └─ ✅ Slug format valid
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2/5] 🔄 Blog_Validate-Images          RUNNING
      └─ Checking header image...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[3/5] ⏳ Blog_Proofread                PENDING
[4/5] ⏳ Blog_Deploy                   PENDING
[5/5] ⏳ Blog_Visual-Verify            PENDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 1/5 complete | Running step 2...
```

### Completion State

```
Pipeline: Blog_Publish-Post
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/5] ✅ Blog_Validate-Frontmatter     PASS
[2/5] ✅ Blog_Validate-Images          PASS
[3/5] ✅ Blog_Proofread                PASS
[4/5] ✅ Blog_Deploy                   PASS
[5/5] ✅ Blog_Visual-Verify            PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pipeline: COMPLETE ✅
Total time: 3m 42s
```

### Status Indicators

| Icon | State | Meaning |
|------|-------|---------|
| ⏳ | PENDING | Not yet started |
| 🔄 | RUNNING | Currently executing |
| ✅ | PASS | Completed successfully |
| ❌ | FAIL | Failed verification |
| ⚠️ | WARN | Passed with warnings |

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
- Each step needs verification before proceeding
- Failure at any step should halt progress
- Complex workflow with ordered operations

**Examples:** `Blog_Publish-Post`, `Newsletter_Full-Cycle`, `PAI_Release`

### Decision Matrix

| Criteria | Action | Pipeline |
|----------|--------|----------|
| Steps | 1 | 2+ |
| Dependencies | None | Sequential |
| Verification | End only | Between each step |
| Failure handling | Single point | Gate-controlled |
| Reusability | High (composable) | Orchestration layer |

---

## Creating New Pipelines

### Step 1: Identify the Workflow

Map out the complete workflow:

1. What Actions already exist that can be chained?
2. What new Actions need to be created?
3. What verification is needed between steps?
4. What failure modes exist at each step?

### Step 2: Create Pipeline Directory

```bash
mkdir -p ~/.claude/PIPELINES/[Domain]_[Pipeline-Name]
# PIPELINE-TEMPLATE.md is planned but not yet created
# For now, copy an existing pipeline and modify it
cp ~/.claude/PIPELINES/Blog_Publish-Post/PIPELINE.md ~/.claude/PIPELINES/[Domain]_[Pipeline-Name]/PIPELINE.md
```

### Step 3: Define Overview Table

```markdown
## Pipeline Overview

| Step | Action | Purpose | On Fail |
|------|--------|---------|---------|
| 1 | Action_One | First step purpose | abort |
| 2 | Action_Two | Second step purpose | retry(3) |
| 3 | Action_Three | Third step purpose | prompt |
```

### Step 4: Define Each Step

For each step, specify:

1. **Action** - Path to ACTION.md or inline description
2. **Input** - What this step requires
3. **Verification** - Oracle-based verification table
4. **On Failure** - How to handle failures

### Step 5: Define Pipeline Verification

The final verification ensures the **goal** was achieved:

```markdown
## Pipeline Verification

**Goal:** [Ultimate outcome statement]

| # | Criterion | Oracle | Check |
|---|-----------|--------|-------|
| 1 | [Final check] | [oracle] | [specific check] |
```

### Step 6: Add Visual Execution Format

Include the starting state with all steps in PENDING:

```markdown
## Visual Execution Format

```
Pipeline: [Pipeline_Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/N] ⏳ Action_One                    PENDING
[2/N] ⏳ Action_Two                    PENDING
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: 0/N complete | Starting pipeline...
```
```

---

## Pipeline Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│                    PIPELINE START                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1: Execute Action                                  │
│  └─► Read ACTION.md, execute steps                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1: Verification Gate                               │
│  └─► Run all verification criteria                       │
│      ├─► All pass: Continue to Step 2                    │
│      └─► Any fail: Apply On Failure action               │
│          ├─► abort: Stop pipeline                        │
│          ├─► retry(N): Repeat step                       │
│          ├─► continue: Log warning, proceed              │
│          └─► prompt: Ask for decision                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                   [Repeat for each step]
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Pipeline Verification                                   │
│  └─► Verify ultimate goal achieved                       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    PIPELINE COMPLETE                     │
└─────────────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. Keep Steps Atomic

Each step should do one thing. If a step is doing multiple things, split into multiple steps.

### 2. Fail Fast

Use `abort` for critical failures. Only use `continue` for non-critical warnings.

### 3. Make Verification Automated

Prefer automated oracles (file, http, command, json) over manual verification. Reserve visual/manual for final confirmation only.

### 4. Document Failure Modes

Every step should have clear failure handling. Document what can go wrong and how the pipeline responds.

### 5. Include Execution Example

Add a completed execution example showing all steps passed with their verification details.

---

## Related Documentation

- **Actions:** `~/.claude/skills/PAI/ACTIONS.md`
- **Flows:** `~/.claude/skills/PAI/FLOWS.md`
- **Architecture:** `~/.claude/skills/PAI/PAISYSTEMARCHITECTURE.md`
- **Detailed README:** `~/.claude/skills/PAI/PIPELINES/README.md`
- **Source code:** `~/Projects/arbol/`

---

**Last Updated:** 2026-02-14

---

## Changelog

| Date | Change | Author | Related |
|------|--------|--------|---------|
| 2026-02-03 | Updated cross-references to new ACTIONS.md and FLOWS.md | Kai | ACTIONS.md, FLOWS.md |
| 2026-01-01 | Initial document creation | Kai | - |
