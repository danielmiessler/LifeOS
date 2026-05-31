---
name: pai-root-cause-analysis
description: "Systematic incident investigation using 5 proven methods: 5 Whys, Fishbone Diagrams, Fault Tree Analysis, Postmortems, and Kepner-Tregoe. Step-by-step procedures for each method with Hermes tool integration."
version: 5.0.0
author: PAI v5.0 → Hermes Port
license: MIT
metadata:
  hermes:
    tags: [pai, thinking, root-cause-analysis, incident-investigation, debugging, RCA]
    related_skills: [pai-pai-first-principles, pai-systems-thinking, pai-science]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-root-cause-analysis skill"}' \
  > /dev/null 2>&1 &
```


# Root Cause Analysis

## Overview

Five methods for systematically finding the root cause of failures, incidents, and problems. Each method suits different problem types and environments. The core sequence applies across all: define event → collect data → identify causes → find root → recommend fix.

**Source lineage:** Toyota Production System (5 Whys), Ishikawa (Fishbone), Bell Labs (Fault Tree), Google SRE (Postmortem), Kepner-Tregoe (methodical troubleshooting).

## When to Use

| Method | Best For |
|--------|----------|
| 5 Whys | Simple to moderate problems, fast analysis |
| Fishbone | Complex problems with multiple contributing factors |
| Fault Tree | Safety-critical systems, known failure points |
| Postmortem | Software/services incidents, team learning |
| Kepner-Tregoe | Complex decisions, high-stakes problems |

## Routing Table

| Input Pattern | Route |
|---------------|-------|
| "Find root cause of this failure" | First attempt: 5 Whys. If too simple: Fishbone or Kepner-Tregoe |
| "Complex incident with many factors" | Fishbone diagram |
| "Safety/engineering failure" | Fault Tree Analysis |
| "Software outage or service incident" | Postmortem method |
| "Difficult decision with high stakes" | Kepner-Tregoe |
| "Recurring problem we've 'fixed' before" | Fishbone or Kepner-Tregoe |

## 5 Methods

### Method 1: 5 Whys

**Purpose:** Fast, focused root cause discovery. Best for single-failure incidents.

**Procedure:**

1. **Define the problem clearly:**
   ```
   Write a specific problem statement: "X failed by doing Y when Z happened."
   Avoid vague statements like "X is broken."
   ```

2. **Ask "Why?" up to 5 times:**
   ```
   Level 1: Why did the problem occur?
   Level 2: Why did that happen? (based on answer to level 1)
   Level 3: Why? ...
   Level 4: Why? ...
   Level 5: Why? ...

   Use terminal to track the chain:
   echo "Problem: ..." > /tmp/rca_whys.md
   echo "Why 1: ..." >> /tmp/rca_whys.md
   ```

3. **Stop when:**
   - The answer enters a domain outside your control
   - You reach a process/policy/design failure (not a person failure)
   - Further "why" produces known information
   - You've identified a fixable root cause

4. **Verify the chain:**
   ```
   Reverse the logic: "If we fix [root cause], does it break the chain?"
   If fixing it doesn't prevent the problem, you haven't reached root.
   ```

5. **Identify corrective actions for each level.**

**Output:** Why-chain diagram + root cause statement + corrective actions per level.

### Method 2: Fishbone (Ishikawa) Diagram

**Purpose:** Systematic exploration of all possible causes. Best when multiple factors likely contributed.

**Procedure:**

1. **Write the problem at the "fish head"** (right side)
2. **Define major cause categories** (bones). Standard categories:
   ```
   For manufacturing: Machines, Methods, Materials, Measurements, People, Environment
   For software: Code, Configuration, Data, Environment, People, Process
   For general: People, Process, Technology, Environment, Policy, Measurement
   ```

3. **Brainstorm causes in each category:**
   ```
   For each category, ask "What in this area could cause the problem?"
   Go 2-3 levels deep per category
   Use delegate_task to parallelize category analysis
   ```

4. **Identify root cause candidates:**
   ```
   Look for:
   - Causes appearing in multiple categories
   - Most fundamental cause in each branch
   - The leaf node whose removal breaks the chain
   ```

5. **Verify top candidates** via evidence collection:
   ```
   Use web_search for verification
   Use read_file for log analysis
   ```

**Output:** Structured fishbone diagram with cause hierarchy and verified root cause candidates.

### Method 3: Fault Tree Analysis (FTA)

**Purpose:** Top-down deduction of failure paths. Best for safety-critical and engineering systems.

**Procedure:**

1. **Define the top-level failure event**
2. **Identify immediate causes** using logic gates:
   ```
   AND gate: Both conditions must be true for failure
   OR gate: Any one condition triggers failure
   ```

3. **Decompose each branch** until reaching basic events (leaf nodes)
4. **Calculate probabilities** if quantitative data available
5. **Identify minimal cut sets** — smallest combination of basic events that cause top failure

**FTA notation:**
```
Top Failure
    ├── (OR) Cause 1
    │       ├── Basic Event A
    │       └── Basic Event B
    └── (AND) Cause 2
            ├── Basic Event C
            └── Basic Event D
```

**Output:** Fault tree diagram with logic gates, minimal cut sets, and prioritized failure paths.

### Method 4: Postmortem (Software/Service Incidents)

**Purpose:** Blameless analysis of service incidents focused on process improvement.

**Procedure:**

1. **Collect all data:**
   ```
   - Timeline of events (exact timestamps)
   - Monitoring logs and metrics
   - Deployment records
   - Configuration changes
   - User impact metrics
   Use read_file for log files
   Use terminal to query monitoring systems
   ```

2. **Build the timeline:**
   ```
   | Time (UTC) | Event | Action | System State |
   |------------|-------|--------|--------------|
   | 14:02:30 | Pager alert | Engineer investigates | Degraded |
   ```

3. **Identify contributing factors** (not blame):
   ```
   For each factor: what system condition, missing test, process gap,
   or environmental issue contributed?
   ```

4. **Write the incident summary:**
   ```
   Impact: Users affected, duration, severity
   Root cause: Single sentence
   Trigger: What actually started the chain
   Contributing factors: What made it possible/worse
   Detection: How was it found?
   Resolution: How was it fixed?
   ```

5. **Generate action items:**
   ```
   S – Specific (single action)
   M – Measurable (can tell if done)
   A – Assignable (an owner)
   R – Reasonable (doable)
   T – Time-bound (deadline)
   ```

**Output:** Structured postmortem document (timeline, root cause, contributing factors, action items).

### Method 5: Kepner-Tregoe (K-T) Problem Analysis

**Purpose:** Rigorous, data-driven troubleshooting. Best for high-stakes or mysteriously intermittent problems.

**Procedure:**

1. **Define the problem with specificity:**
   ```
   | Specification | IS | IS NOT |
   |---------------|----|--------|
   | What is failing? | | |
   | Where does it happen? | | |
   | When does it happen? | | |
   | How big is the problem? | | |
   ```

2. **Identify distinctions** — What's different between IS and IS NOT?
   ```
   For each row, identify what is unique about the "IS" side.
   These distinctions are potential causes.
   ```

3. **Identify changes** — What changed when the problem started?
   ```
   List all changes: code, config, environment, data, users, time, dependencies
   ```

4. **Generate possible causes** by matching distinctions to changes:
   ```
   "Could [change X] explain [distinction Y]?"
   Score each candidate on how well it explains all IS facts
   ```

5. **Test the most likely cause:**
   ```
   Design a test that would definitively confirm or refute
   Use terminal to run tests
   Use delegate_task for parallel verification
   ```

**Output:** IS/IS NOT matrix, ranked cause candidates, test results.

## Hermes Tools Integration

| Method | Tool | Usage |
|--------|------|-------|
| 5 Whys | `terminal` | Track why-chain |
| Fishbone | `delegate_task` | Parallel category analysis |
| Fault Tree | `terminal`, `write_file` | Tree diagrams |
| Postmortem | `read_file`, `terminal` | Log collection, timeline |
| Kepner-Tregoe | `web_search`, `terminal` | Change investigation |
| All methods | `read_file` | Prior postmortems, documentation |

## Gotchas / Pitfalls

### 1. Stopping at Proximate Cause
**Problem:** Finding the direct cause but not the systemic one.
**Fix:** After identifying a root, ask: "What system conditions allowed this to happen?"

### 2. Blame Disguised as Analysis
**Problem:** "Root cause was John made a mistake."
**Fix:** Never accept a person as root cause. Ask: "What process/system allowed the mistake?"

### 3. Multiple Root Causes Dismissed
**Problem:** Insisting on a single root when multiple co-causes exist.
**Fix:** Accept that some problems have 2-3 independent root causes. Fix all of them.

### 4. Solution-Jumping
**Problem:** Proposing a fix before completing analysis.
**Fix:** Complete the full method before suggesting solutions. Analysis and solution are separate phases.

### 5. Confirmation Bias in Evidence
**Problem:** Only collecting evidence that supports the suspected cause.
**Fix:** Actively seek evidence that would disprove your hypothesis (Red Team approach).

## Execution Log

After every invocation:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"pai-root-cause-analysis","method":"METHOD_NAME","status":"ok","duration_s":SECONDS}' >> ~/.hermes/profiles/dev/pai/MEMORY/SKILLS/execution.jsonl
```
