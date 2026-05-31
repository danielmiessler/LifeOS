# ISA Template — Ideal State Artifact

> The ISA is the universal primitive for defining "done." A structured document with 12 fixed sections. The ISA collapses PRD, test harness, build verification, done condition, and system of record into one document.

---

## ISA Template

### Problem

_What's broken or missing. What is the current state? Why does this need to exist?_

_[Three to five sentences describing the problem space. Include pain points, triggers, and consequences of inaction.]_

### Vision

_What good looks like. Describe the ideal outcome in enough detail that someone reading this understands the destination._

_[Two to three paragraphs. Concrete, specific, vivid. Not aspirational — declarative.]_

### Out of Scope

_What is explicitly NOT included in this ISA. Prevents scope creep and expectation mismanagement._

_- [ ] Item 1_
_- [ ] Item 2_
_- [ ] Item 3_

### Principles

_Substrate-independent truths that guide every decision. These don't change based on technology or approach._

_- **Principle 1:** Description_
_- **Principle 2:** Description_
_- **Principle 3:** Description_

### Constraints

_Immovable boundaries that the solution must respect. Technology constraints, resource limits, time constraints, compatibility requirements._

_- Constraint 1_
_- Constraint 2_
_- Constraint 3_

### Goal

_The single, verifiable "done" condition. A binary statement that is either true or false when all criteria are met._

_> **Goal:** [One sentence. Binary. Verifiable.]_

### Criteria

_Atomic, individually testable ISCs (Ideal State Criteria). Each ISC is a binary pass/fail test. ID format is stable — never re-numbered on edit._

| ID | Description | Type | Verification Method |
|----|-------------|------|-------------------|
| ISC-1 | | criterion | |
| ISC-2 | | criterion | |
| ISC-3 | | anti-criterion | |
| ISC-4 | | antecedent | |
| ... | | | |

**Required:** At minimum one Anti-ISC (proves the task is NOT done).  
**If experiential goal:** At minimum one Antecedent ISC (anchored to prior work).

### Test Strategy

_How each criterion is verified. Maps ISC IDs to specific verification methods, tools, and pass/fail thresholds._

| ISC | Method | Tool | Evidence Path | Pass Threshold |
|-----|--------|------|---------------|----------------|
| ISC-1 | Command | [tool] | [path] | [condition] |
| ISC-2 | File check | [tool] | [path] | [condition] |

### Features

_Work breakdown with dependencies. Features are the "how" — the implementation units that satisfy criteria._

**Feature Dependency Graph:**

```
F-1: [Name]
  Depends on: —
  Satisfies: ISC-1, ISC-3
  Parallelizable: yes/no

F-2: [Name]
  Depends on: F-1
  Satisfies: ISC-2, ISC-4
  Parallelizable: yes/no

F-3: [Name]
  Depends on: F-2
  Satisfies: ISC-5
  Parallelizable: yes/no
```

### Decisions

_Timestamped decision log. Entries are never deleted — only superseded._

| Timestamp | Decision | Author | Rationale | Phase Context |
|-----------|----------|--------|-----------|---------------|
| 2026-05-30T10:00Z | | system/user | | OBSERVE/THINK/PLAN |

### Changelog

_Error-correction trail. Every entry uses the four-piece format: conjecture → refuted-by → learned → criterion-now._

> **Conjecture:** _What was believed_  
> **Refuted by:** _What disproved it_  
> **Learned:** _What is now understood_  
> **Criterion now:** _How the ISA changed_

### Verification

_Evidence that criteria passed. Filled in during VERIFY phase._

| ISC | Status | Evidence | Timestamp |
|-----|--------|----------|-----------|
| ISC-1 | ✅ pass / ❌ fail | [concrete evidence — command output, file content, API response] | |
| ISC-2 | ✅ pass / ❌ fail | | |

---

## Effort Tier Gate Requirements

| Tier | Sections Required | ISCs Required | Notes |
|------|-------------------|---------------|-------|
| **E1** | Goal + Criteria | ≥1 | Quick tasks |
| **E2** | Problem + Goal + Criteria + Test Strategy | ≥16 | Standard tasks |
| **E3** | Problem + Vision + Out of Scope + Principles + Constraints + Goal + Criteria + Test Strategy | ≥32 | Thinking skills required |
| **E4** | All 12 sections | ≥128 | Cross-vendor audit required |
| **E5** | All 12 sections | ≥256 | Interview workflow + cross-vendor audit |

---

## ISA Location Conventions

- **Task ISAs:** `MEMORY/WORK/{slug}/ISA.md` — for one-shot tasks within an Algorithm run
- **Project ISAs:** `{project-root}/ISA.md` — for persistent projects with their own identity
- **Only task ISAs go through the 7-phase Algorithm loop.** Project ISAs are permanent artifacts exempt from the full lifecycle.
