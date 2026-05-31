---
name: pai-delegation
description: 6 parallelization patterns — built-in agents, worktrees, background tasks, custom agents, teams, and parallel dispatch
version: 1.0.0
metadata:
  hermes_tags: [pai, delegation, parallel, dispatch, agents, worktrees]
  related_skills: [pai-research, pai-council, pai-loop]
  requires: [delegate_task, terminal, read_file, write_file, process]
---

# pai-delegation — 6 Parallelization Patterns

## Overview

pai-delegation provides 6 distinct patterns for parallelizing work in Hermes
Agent. Each pattern is suited to different workloads — from simple parallel
calls to full team orchestration with background task management.

### The 6 Patterns

| # | Pattern | Mechanism | Best For |
|---|---------|-----------|----------|
| 1 | **Built-in Agents** | `delegate_task` with predefined agent IDs | Standard parallel subtasks |
| 2 | **Worktrees** | `terminal(git worktree)` isolated checkouts | Parallel git branches with isolated filesystems |
| 3 | **Background Tasks** | `terminal(background=true)` + `process` | Long-running operations (builds, deploys) |
| 4 | **Custom Agents** | `delegate_task` with custom `agent` string + `tools` | Flexible agents with specific tool access |
| 5 | **Teams** | Nested `delegate_task` → each team member spawns sub-agents | Hierarchical task decomposition |
| 6 | **Parallel Dispatch** | Batch `delegate_task` array with merge/reduce | Map-reduce style identical operations |

## When to Use

- Any workload that can be decomposed into independent subtasks
- Exploratory tasks where parallelism reduces wall-clock time
- CI/CD pipelines with independent stages
- Research / analysis with multiple angles or sources

## Workflow Routing

| Trigger | Pattern | Description |
|---|---|---|
| `pai-delegate built-in "task"` | 1 | Use preset Hermes agent types |
| `pai-delegate worktree "branch"` | 2 | Create parallel git worktree |
| `pai-delegate bg "command"` | 3 | Run background process |
| `pai-delegate custom "agent-spec"` | 4 | Custom agent with tool list |
| `pai-delegate team "hierarchy"` | 5 | Nested team delegation |
| `pai-delegate dispatch "batch"` | 6 | Map-reduce parallel dispatch |

## Procedure

### Pattern 1: Built-in Agents

Use `delegate_task` with a predefined agent name known to Hermes:

```json
[
  {
    "type": "delegate_task",
    "agent": "pai-researcher",
    "task": "Research {subtopic_a}",
    "context": {"type": "builtin", "pattern": "agent"}
  },
  {
    "type": "delegate_task",
    "agent": "pai-coder",
    "task": "Generate boilerplate for {component_b}",
    "context": {"type": "builtin", "pattern": "agent"}
  }
]
```

### Pattern 2: Worktrees

Create isolated git worktrees for parallel branch work:

```bash
# Create worktree
git worktree add ~/projects/repo-wt-feature feature-branch
```

Then operate in the worktree directory: `terminal(workdir=~/projects/repo-wt-feature, command=...)`.
Each worktree is fully independent — different branch, different state.
Clean up with `git worktree remove`.

### Pattern 3: Background Tasks

Run long operations without blocking:

```python
result = terminal(command="make build", background=True, notify_on_complete=True)
session_id = result["session_id"]
# Continue working...
process(action="wait", session_id=session_id, timeout=300)
log = process(action="log", session_id=session_id)
```

### Pattern 4: Custom Agents

Define a custom agent with specific tools and a detailed persona:

```json
{
  "type": "delegate_task",
  "agent": "pai-custom-security-auditor",
  "task": "Audit the codebase at {path} for security vulnerabilities. Check for: SQL injection, XSS, hardcoded secrets, insecure deserialization.",
  "tools": ["read_file", "search_files", "terminal"],
  "context": {
    "type": "custom",
    "pattern": "agent",
    "persona": "senior security engineer with 15 years experience"
  }
}
```

The `tools` array restricts which tools the custom agent may use.

### Pattern 5: Teams

Hierarchical delegation — a team lead delegates to sub-agents:

```json
{
  "type": "delegate_task",
  "agent": "pai-team-lead",
  "task": "You are the Team Lead for a {project_name} implementation. You have 3 team members available. Delegate to them via nested delegate_task:\n1. {agent_a}: {subtask_a}\n2. {agent_b}: {subtask_b}\n3. {agent_c}: {subtask_c}\n\nAggregate their outputs into a cohesive result.",
  "tools": ["delegate_task"],
  "context": {
    "type": "team",
    "pattern": "hierarchical",
    "members": [
      {"name": agent_a, "role": "backend"},
      {"name": agent_b, "role": "frontend"},
      {"name": agent_c, "role": "database"}
    ]
  }
}
```

### Pattern 6: Parallel Dispatch

Batch identical operations with different data:

```json
{
  "type": "delegate_task",
  "agent": "pai-dispatch",
  "task": "Process the following {n_items} items in parallel. For each item, call delegate_task with the same analysis prompt but different input data.\n\nItems: {items_array}\n\nAfter all complete, merge results into a single report grouped by category.",
  "context": {
    "type": "dispatch",
    "pattern": "map-reduce",
    "items": items,
    "operation": "process_item",
    "merge_strategy": "group_by_category"
  }
}
```

## Session Persistence

Each delegation pattern gets a session entry:

```
~/.pai/delegation/sessions/{session_id}.json
```

Contains:
- Pattern type
- Timestamps (start, end, each subtask)
- Agent responses (truncated)
- Error states per subtask

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-delegation","message":"Parallel dispatch complete: 8/8 items processed","pattern":"dispatch","tasks":8,"status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 12:00:01] pai-delegate built-in "refactor auth module"
[2026-05-30 12:00:02] → pattern: built-in agents (3 parallel)
[2026-05-30 12:00:10] ← all 3 agents complete
[2026-05-30 12:00:11] ✓ built-in delegation: 3 results merged
[2026-05-30 12:05:01] pai-delegate worktree "feature/integration-tests"
[2026-05-30 12:05:02] → git worktree add ../repo-wt-feature
[2026-05-30 12:05:03] ✓ worktree ready at ~/projects/repo-wt-feature
[2026-05-30 12:10:01] pai-delegate bg "docker build -t app:latest ."
[2026-05-30 12:10:02] → background session bg_42 started
[2026-05-30 12:15:00] ← bg_42 complete (exit 0)
```

## Gotchas

- **Worktree cleanup**: `git worktree remove` must be run explicitly.
  Orphaned worktrees take up disk space and cause git confusion.
- **Background process limits**: Max 16 concurrent background sessions.
  Beyond that, `terminal(background=true)` blocks until a slot frees.
- **Custom agent tool leaks**: If a custom agent has `terminal` access, it
  can escape its sandbox. Restrict tools to `read_file`/`write_file` when possible.
- **Team depth limit**: Nested delegation beyond 3 levels may hit context
  window limits on the team lead agent.
- **Dispatch ordering**: Parallel dispatch results are unordered. If ordering
  matters, include sequence numbers in each subtask's output.
