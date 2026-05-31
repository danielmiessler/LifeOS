---
name: pai-loop
description: Iterative improvement agent that wraps an Algorithm across multiple cycles with a Dead End ledger to avoid retrying rejected paths
version: 5.0.0
author: PAI v5.0 → Hermes Port
metadata:
  hermes_tags: [pai, loop, iterative, improvement, optimization, dead-end]
  related_skills: [pai-isa, pai-evals, pai-council, pai-delegation]
  requires: [delegate_task, read_file, write_file, terminal, web_search]
---

# pai-loop — Iterative Improvement Loop

## Overview

pai-loop wraps any Algorithm (a well-defined process with .md spec) in an
iterative improvement cycle. Each cycle runs the Algorithm, evaluates the
output, and decides: accept, retry with modifications, or mark as Dead End.

### Core Innovation: The Dead End Ledger

The Dead End Ledger (`~/.pai/loop/ledger.yaml`) records approaches that have
been tried and rejected. Before any cycle begins, the ledger is checked —
if the proposed approach matches a known dead end, it is skipped with a
reference to the previous attempt. This prevents infinite loops and wasted
compute on paths already known to fail.

### Cycle

```
        ┌─────────────────────────────────────┐
        │          pai-loop                    │
        │                                     │
   ┌────┴────┐   ┌──────────┐   ┌─────────┐   │
   │ Propose │──>│ Execute  │──>│ Evaluate │──>│──→ Accept (done)
   │ Approach│   │Algorithm │   │ Output   │   │
   └────┬────┘   └──────────┘   └────┬─────┘   │
        │                            │         │
        │ Check Dead End Ledger      │ Retry   │
        │ before proposing           │──────┘  │
        └────────────────────────────┘         │
                ↑                              │
                └──────────────────────────────┘
                   Mark as Dead End if failed
```

## When to Use

- Tasks requiring refinement across multiple iterations (code generation,
  design drafting, prompt optimization)
- Any Algorithm that has a well-defined completion criteria
- Tasks where the first attempt rarely succeeds and iteration is expected
- Avoiding the "try the same thing twice" problem in autonomous loops

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-loop start <algorithm>` | Start iterative loop for an Algorithm |
| `pai-loop resume <session>` | Resume an interrupted loop session |
| `pai-loop status` | Show active loop sessions and dead end count |
| `pai-loop ledger` | View the Dead End Ledger |
| `pai-loop prune` | Prune stale dead ends (age > 30 days) |

## Procedure

### Step 1: Initialize loop

```python
loop_dir = "~/.pai/loop"
algorithm_path = f"~/.pai/loop/algorithms/{algorithm_name}.md"

# Load algorithm spec
algorithm_spec = read_file(path=algorithm_path)

# Create session
session_id = f"loop_{int(time.time())}"
session = {
    "session_id": session_id,
    "algorithm": algorithm_name,
    "created_at": timestamp,
    "cycle": 0,
    "max_cycles": algorithm_spec.get("max_cycles", 10),
    "cycle_history": [],
    "status": "active"
}
write_file(path=f"{loop_dir}/sessions/{session_id}.yaml", content=yaml.dump(session))
```

### Step 2: Load Dead End Ledger

```python
ledger_path = f"{loop_dir}/ledger.yaml"
try:
    ledger = read_file(path=ledger_path)
    ledger_data = yaml.safe_load(ledger) or {"dead_ends": []}
except FileNotFoundError:
    ledger_data = {"dead_ends": []}
```

### Step 3: Propose approach (with dead end check)

```python
proposal = delegate_task(
    agent="pai-loop-planner",
    task=f"Given the Algorithm '{algorithm_name}', propose a specific approach for Cycle {cycle+1}. Be concrete: what files to modify, what strategy to use.\n\nAlgorithm:\n{algorithm_spec}\n\nCycle history:\n{cycle_history}\n\nDead Ends (DO NOT propose these):\n{dead_end_approaches}"
)

# Check ledger for match
for dead_end in ledger_data["dead_ends"]:
    if approaches_match(proposal, dead_end["approach"]):
        print(f"⚠ Approach matches dead end '{dead_end['id']}' from {dead_end['timestamp']}")
        print(f"  Reason: {dead_end['reason']}")
        # Propose a different approach (modify strategy)
        proposal = modify_approach(proposal, dead_end)
```

### Step 4: Execute Algorithm

Run the Algorithm:

```python
if "code" in algorithm_spec.get("type", ""):
    result = terminal(command=proposal["command"], timeout=300)
elif "delegate" in algorithm_spec.get("type", ""):
    result = delegate_task(
        agent=algorithm_spec.get("agent", "pai-coder"),
        task=proposal["task"],
        context={"cycle": cycle, "approach": proposal}
    )
elif "multi" in algorithm_spec.get("type", ""):
    # Multi-step execution
    for step in algorithm_spec["steps"]:
        result = execute_step(step, proposal, context)
```

### Step 5: Evaluate output

```json
{
  "type": "delegate_task",
  "agent": "pai-loop-evaluator",
  "task": "Evaluate the following output against the Algorithm's completion criteria. Decide one of:\n1. ACCEPT — output meets criteria, loop ends\n2. RETRY — output has issues, specify what to change\n3. DEAD_END — this approach fundamentally doesn't work\n\nAlgorithm completion criteria:\n{algorithm_criteria}\n\nOutput:\n{output}\n\nPrevious attempts in this cycle:\n{cycle_history}",
  "context": {"cycle": cycle, "algorithm": algorithm_name}
}
```

### Step 6: Handle result

**ACCEPT**: Mark session as complete. Write final output.

**RETRY**: Record in cycle history, increment cycle, loop back to Step 3.
If `cycle >= max_cycles`, force-terminate with "Max cycles reached."

**DEAD END**: Add to Dead End Ledger:

```yaml
# ~/.pai/loop/ledger.yaml
dead_ends:
  - id: dead_end_{timestamp}
    algorithm: {algorithm_name}
    approach: {proposal_description}
    reason: {failure_reason}
    attempted_at: {timestamp}
    evidence: {path_to_evidence}
    cycle: {cycle}
```

Then loop back to Step 3 with a different approach (modified to avoid
the newly-recorded dead end).

### Step 7: Save iteration artifacts

Each cycle produces:
- `~/.pai/loop/artifacts/{session_id}/cycle_{N}/approach.md` — what was tried
- `~/.pai/loop/artifacts/{session_id}/cycle_{N}/output.md` — raw output
- `~/.pai/loop/artifacts/{session_id}/cycle_{N}/eval.md` — evaluation result

## Dead End Ledger Schema

```yaml
dead_ends:
  - id: dead_end_auth_001
    algorithm: "implement-auth-middleware"
    approach: "Using JWT with RSA256 and redis-backed blacklist"
    reason: "Redis dependency too heavy for single-server deployment"
    attempted_at: "2026-05-29T15:30:00Z"
    evidence: "~/.pai/loop/artifacts/loop_171234/cycle_3/eval.md"
    cycle: 3
    tags: [over-engineered, dependency-heavy]
    context: "User specified minimal deps in TELOS constraints"
```

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-loop","message":"Iteration complete: auth middleware accepted","cycles":4,"dead_ends_avoided":2,"status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 16:00:01] pai-loop start implement-auth-middleware
[2026-05-30 16:00:02] → Cycle 1: proposing approach
[2026-05-30 16:00:03] → Dead End check: 0 matches
[2026-05-30 16:00:04] → executing: JWT + blacklist approach
[2026-05-30 16:00:30] → evaluating output
[2026-05-30 16:00:33] ← RETRY: blacklist too slow (p95 > 200ms)
[2026-05-30 16:00:34] → Cycle 2: proposing approach
[2026-05-30 16:00:35] → Dead End check: 0 matches
[2026-05-30 16:00:36] → executing: JWT + session cache approach
[2026-05-30 16:01:00] → evaluating output
[2026-05-30 16:01:03] ← RETRY: session cache not thread-safe
[2026-05-30 16:01:04] → Cycle 3: proposing approach
[2026-05-30 16:01:05] → Dead End check: 1 match (blacklist) — avoided
[2026-05-30 16:01:06] → executing: stateless JWT with short expiry + refresh tokens
[2026-05-30 16:01:30] → evaluating output
[2026-05-30 16:01:33] ← ACCEPT: all criteria met
[2026-05-30 16:01:34] ✓ Loop complete: 3 cycles, 1 dead end recorded
```

## Gotchas

- **Approach matching**: The Dead End Ledger uses semantic similarity to match
  proposed approaches against recorded dead ends. The matcher is fuzzy — it
  may miss subtle differences. Always include distinct details in the
  `approach` field to improve matching.
- **Ledger bloat**: Over time the ledger grows. Use `pai-loop prune` to
  remove entries older than 30 days, or `pai-loop ledger --tag <tag>` to
  filter by topic.
- **Cycle limits**: Default max_cycles is 10. For complex Algorithms, this
  may not be enough. Algorithms can set their own `max_cycles` in their .md spec.
- **Side effects**: Each cycle may create files, modify state, or trigger
  external services. If a cycle is marked as Dead End, its side effects are
  NOT automatically rolled back. Use git or snapshots for rollback.
- **Algorithm dependency**: pai-loop requires the target Algorithm to have
  clear completion criteria in its .md spec. Without explicit criteria, the
  evaluator may never accept and the loop runs to max_cycles.
- **Cost accumulation**: Each cycle costs tokens. A 10-cycle loop with
  model-based evaluation can be expensive. Set conservative max_cycles and
  consider early termination if consecutive outputs show no improvement.
