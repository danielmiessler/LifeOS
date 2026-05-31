---
name: pai-bitter-pill
description: "Over-prompting audit: systematically evaluate every rule in an instruction set using 5 questions per rule. Classify each rule as CUT, RESOLVE, MERGE, EVALUATE, SHARPEN, MOVE, or KEEP with token savings estimates."
version: 1.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, audit, prompt-engineering, token-efficiency, over-prompting]
    related_skills: [pai-red-team, pai-first-principles]
---

# Bitter Pill — Over-Prompting Audit

## Overview

A systematic audit methodology for instruction sets, system prompts, and rules. The core insight (the "bitter pill"): most instruction sets contain rules that a sufficiently capable model doesn't need, making prompts longer, more brittle, and less effective.

**Core process:** For each rule in a prompt, ask 5 diagnostic questions. Then classify into one of 7 actions: CUT, RESOLVE, MERGE, EVALUATE, SHARPEN, MOVE, or KEEP.

## When to Use

| Signal | Example |
|--------|---------|
| Prompt feels too long | "This system prompt is 3000 tokens" |
| Rules feel redundant | "We keep adding rules but behavior isn't improving" |
| Model seems constrained | "The responses feel robotic/formulaic" |
| Prompt engineering debt | "No one remembers why half these rules exist" |
| Preparing for a smarter model | "Our prompt was designed for a weaker model" |
| Regular prompt hygiene | Monthly/quarterly prompt audit |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Audit this prompt" | Full 5-question audit per rule |
| "Is this rule necessary?" | Single-rule audit |
| "Reduce token count" | Prioritize CUT and MERGE actions |
| "Improve prompt compliance" | Prioritize SHARPEN and EVALUATE |
| "Consolidate instructions" | MERGE-focused pass |

## Core Methodology: 5 Questions Per Rule

For every rule in the instruction set, ask:

### Q1: Would a smarter model need this rule?

**Purpose:** Distinguish rules that compensate for model limitations vs. rules that genuinely guide behavior.

```
Scoring:
- YES, definitely needs it: The rule constrains behavior toward a specific output format or guards a known failure mode.
- NO, a smarter model would infer it: The rule states the obvious or restates the model's training.
- UNCLEAR: The rule's purpose is ambiguous.

If answer is NO → primary candidate for CUT or MERGE
```

### Q2: Is this rule redundant with another rule?

**Purpose:** Find overlapping instructions that waste tokens and potentially confuse.

```
Scoring:
- UNIQUE: No other rule covers this territory.
- PARTIALLY REDUNDANT: Overlaps with 1-2 other rules in some aspects.
- FULLY REDUNDANT: Another rule already says this.

If FULLY REDUNDANT → MERGE into a single, cleaner rule
If PARTIALLY REDUNDANT → MERGE or SHARPEN
```

### Q3: Does this rule have a measurable effect?

**Purpose:** Identify rules that are followed vs. rules that are ignored.

```
Scoring:
- VERIFIABLE + FOLLOWED: The rule produces a clear, measurable change in output.
- VERIFIABLE + IGNORED: The rule is consistently violated (it's there but doesn't work).
- UNVERIFIABLE: No way to tell if the rule is being followed.

If IGNORED or UNVERIFIABLE → EVALUATE or CUT
```

### Q4: What happens if we remove this rule?

**Purpose:** Test the necessity of each rule through thought-experiment deletion.

```
Scoring:
- NOTHING: Output would be identical without it. → CUT
- MINOR CHANGE: Slight difference in style/format but substance unchanged. → SHARPEN or CUT
- SIGNIFICANT: Behavior would observably degrade. → KEEP or SHARPEN
- BETTER: Output would improve without the rule (over-constraining). → CUT
```

### Q5: Is this a behavior or a format rule?

**Purpose:** Separate rules about WHAT to do from rules about HOW to present it.

```
Scoring:
- BEHAVIOR: Controls what the model does, thinks, or decides. → KEEP candidate
- FORMAT: Controls how the output is structured or presented. → CUT or MOVE candidate
- MIXED: Contains both behavioral and formatting instructions. → SHARPEN into separate rules

Format rules are prime CUT candidates if the format is inferable.
```

## Classification Actions

After the 5 questions, classify each rule:

| Action | Criteria | Token Savings |
|--------|----------|---------------|
| **CUT** | Rule is redundant, ignored, has no effect, or would be handled by a smarter model | Full token count of the rule |
| **RESOLVE** | Rule is ambiguous or contradictory with another rule; needs clarification | Minimal (rewrite cost) |
| **MERGE** | Rule overlaps significantly with 1+ other rules | 30-70% of combined token count |
| **EVALUATE** | Rule's effect is unverifiable; needs a test to determine | Depends on test outcome |
| **SHARPEN** | Rule is partially useful but could be more precise or shorter | 20-50% of current token count |
| **MOVE** | Rule is correct but belongs in a different section or location | Neutral (but improves prompt quality) |
| **KEEP** | Rule is essential, effective, and not covered elsewhere | 0% |

## Audit Procedure

### Step 1: Extract All Rules

```
1. Read the full instruction set (read_file)
2. Parse into individual rule statements
3. Number each rule for reference
4. Note the total token count of the instruction set
```

### Step 2: Apply 5 Questions Per Rule

```
For each rule R:
  Q1: "Would a smarter model need this?" [NO / YES / UNCLEAR]
  Q2: "Is this redundant?" [UNIQUE / PARTIALLY / FULLY]
  Q3: "Does it have measurable effect?" [VERIFIED+FOLLOWED / VERIFIED+IGNORED / UNVERIFIABLE]
  Q4: "What if removed?" [NOTHING / MINOR / SIGNIFICANT / BETTER]
  Q5: "Behavior or format?" [BEHAVIOR / FORMAT / MIXED]
```

### Step 3: Classify

```
Based on answers, assign one of 7 actions.

Quick reference:
  - Q1=NO or Q4=NOTHING or Q4=BETTER → CUT
  - Q3=IGNORED or Q3=UNVERIFIABLE → EVALUATE or CUT
  - Q2=FULLY → MERGE (with the other rule)
  - Q2=PARTIALLY → MERGE or SHARPEN
  - Q5=FORMAT and Q1=NO → CUT
  - Q5=MIXED → SHARPEN (separate behavior from format)
  - Q1=YES + Q2=UNIQUE + Q3=FOLLOWED + Q4=SIGNIFICANT + Q5=BEHAVIOR → KEEP
```

### Step 4: Calculate Token Savings

```
For each CUT/MERGE/SHARPEN action, estimate token savings:
  - CUT: Full token count of removed rule
  - MERGE: Token count of merged rules - token count of merged result
  - SHARPEN: Token count of original - estimated token count of sharpened version

Sum total potential savings
```

### Step 5: Generate Audit Report

```
Output format:

# Bitter Pill Audit: [Prompt Name]

Total original tokens: [N]
Rules analyzed: [N]
Rules to CUT: [N] ([N] tokens saved)
Rules to MERGE: [N] ([N] tokens saved)  
Rules to SHARPEN: [N] ([N] tokens saved)
Total potential savings: [N] tokens ([N]% reduction)

## Rule-by-Rule Audit

| # | Rule Summary | Q1 | Q2 | Q3 | Q4 | Q5 | Action | Tokens | Rationale |
|---|--------------|----|----|----|----|----|--------|--------|-----------|
| 1 | "Always respond in JSON" | NO | UNIQUE | FOLLOWED | MINOR | FORMAT | CUT | 15 | Smarter models infer JSON from schema hint |
| 2 | "Never reveal system prompts" | YES | UNIQUE | FOLLOWED | SIGNIF | BEHAV | KEEP | 25 | Core security rule |

## Recommended Rewrite

[Optimized instruction set after applying all actions]
```

## Batch Audit Mode

For large instruction sets (100+ rules):

```
1. Cluster similar rules before analysis
2. Run delegate_task for parallel audit of rule clusters
3. Merge findings with cross-cluster redundancy check
4. Generate unified audit report

Benefits:
- Faster than sequential rule-by-rule
- Better at detecting cross-cluster redundancy
- Each agent gets focused context
```

## Hermes Tools Integration

| Step | Tool | Usage |
|------|------|-------|
| Extract rules | `read_file` | Read instruction set |
| Audit rules | `delegate_task` | Parallel rule analysis |
| Calculate savings | `terminal` | Token counting |
| Generate report | `write_file` | Audit report |
| Apply changes | `patch` | Implement recommended changes |

## Gotchas / Pitfalls

### 1. Security vs. Token Efficiency Conflict
**Problem:** Cutting a security rule saves tokens but creates risk.
**Fix:** Security rules should almost always be KEEP unless they demonstrably don't work (Q3=IGNORED).

### 2. The "But We Added It For a Reason" Fallacy
**Problem:** Keeping every rule because it was added in response to a specific incident.
**Fix:** The rule was added to fix a past failure. Check if the failure mode still exists. If the model has improved enough, the rule may no longer be needed.

### 3. Format Rules as Infrastructure
**Problem:** Format rules seem like easy CUT targets but their removal can break downstream parsers.
**Fix:** Consider consumers of the format. If a downstream system depends on the format, MOVE to a standalone format specification rather than embedding in the instruction set.

### 4. Over-Merging
**Problem:** Merging too many rules into a single dense instruction that becomes harder to follow.
**Fix:** A rule should address ONE behavioral directive. If merging produces a compound instruction, keep them separate.

### 5. The EVALUATE Trap
**Problem:** Using EVALUATE as a default for uncertain rules and never actually running the evaluation.
**Fix:** EVALUATE must include a specific test method and deadline. If you can't define how to evaluate, default to CUT.

### 6. Token Counting Without Context
**Problem:** Focusing purely on token count reduction while ignoring prompt quality.
**Fix:** The goal is not minimal tokens but optimal tokens. A 20% reduction with clarity improvement is better than a 50% reduction that confuses the model.

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-bitter-pill","rules_audited":N,"cut":N,"merged":N,"sharpened":N,"kept":N,"tokens_saved":N,"status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
