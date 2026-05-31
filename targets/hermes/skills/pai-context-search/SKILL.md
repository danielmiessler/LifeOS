---
name: pai-context-search
description: Two-phase session recovery — session registry search followed by work directory content search, using hermes session_search tool
version: 5.0.0
author: PAI v5.0 → Hermes Port
metadata:
  hermes_tags: [pai, context, search, session, recovery]
  related_skills: [pai-research, pai-interview, pai-isa]
  requires: [read_file, write_file, search_files, terminal]
  hermes_tools: [session_search]
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-context-search skill"}' \
  > /dev/null 2>&1 &
```


# pai-context-search — Session Recovery & Context Search

## Overview

pai-context-search recovers lost or interrupted context by performing a
2-phase search. When a user returns after a gap (hours, days, weeks), this
skill rebuilds the working context:

**Phase 1 — Session Registry**: Search the Hermes session registry using
`sessions_search` to find recent sessions, their topics, and outputs.

**Phase 2 — Work Directories**: Search active work directories for files
modified around the session timestamps.

Together, these phases reconstruct "what was I working on, and where did I
leave off?"

## When to Use

- Starting a new Hermes session after a long break
- Juggling multiple projects and need to re-contextualize
- Recovery after a crash or unexpected session termination
- Onboarding to an existing project with partial progress

## Workflow Routing

| Trigger | Description |
|---|---|
| `pai-context-search` | Full 2-phase context recovery |
| `pai-context-search --quick` | Phase 1 only (session registry) |
| `pai-context-search --dirs <paths>` | Phase 2 only on specific directories |
| `pai-context-search --since <time>` | Limit search to sessions since a timestamp |
| `pai-context-search status` | Show last known context snapshot |

## Procedure

### Step 1: Determine search scope

1. Parse arguments. Default: full 2-phase search.
2. If `--since` provided, use as temporal filter.
3. If `--quick`, skip Phase 2.
4. If `--dirs`, skip Phase 1 and search only those directories.

### Step 2: Phase 1 — Session Registry Search

Use the Hermes `session_search` tool (available as a built-in):

```
Call: session_search(query="", max_results=20)
```

Or, if `session_search` is not directly exposed, use:

```json
{
  "type": "delegate_task",
  "agent": "pai-context-searcher",
  "task": "Search the Hermes session registry for recent session data. Look at ~/.hermes/sessions/ or wherever Hermes stores session history. List: session_id, timestamp, task description, status, output paths.\n\nFilter: {filters}",
  "context": {"phase": "registry", "since": since_param, "max": 20}
}
```

Results include:
- Session ID and timestamp
- Task description / query
- Status (completed, interrupted, in-progress)
- Output file paths created during session
- Last N lines of session log

### Step 3: Phase 2 — Work Directory Search

For each active work directory (default: `~/projects/`, `~/repo/`,
or directories matching patterns from session results):

```python
# Search for recently modified files
results = search_files(
    pattern="*",
    path=work_dir,
    target="files",
    limit=50
)

# Filter to files modified after the user's last session
# (use terminal `find` with -newer for precise filtering)
terminal(command=f"find {work_dir} -type f -newer {last_session_timestamp} -not -path '*/.git/*' 2>/dev/null | head -60")
```

### Step 4: Cross-reference and correlate

Match session registry entries with work directory files:

```json
{
  "type": "delegate_task",
  "agent": "pai-context-correlator",
  "task": "Cross-reference the session registry data and work directory files below. For each session:\n1. Identify the project/context it was working on\n2. Note the last known state (completed, in-progress, blocked)\n3. Find corresponding modified files\n4. Flag anything that looks stale or inconsistent\n\nSession data:\n{session_results}\n\nWork directory findings:\n{workdir_results}",
  "context": {"phase": "correlation"}
}
```

### Step 5: Build context snapshot

Write a context recovery document:

```
~/.pai/context/snapshots/{timestamp}.context.md
```

Contains:
```yaml
# Context Snapshot — {timestamp}
# Recovered from session registry + workdir scan

recent_sessions:
  - id: sess_abc123
    time: "2026-05-29 15:30:00"
    task: "Refactor auth middleware"
    status: interrupted
    output: [src/middleware/auth.py, tests/test_auth.py]
    last_log: "→ implementing rate limiter…"

active_projects:
  - name: hermes-auth
    dir: ~/projects/hermes-auth
    modified_files: [src/middleware/auth.py, src/middleware/ratelimit.py]
    branch: feature/rate-limiting

recommendation: >
  Resume work on auth middleware. The rate limiter implementation
  was in progress. Run tests before continuing:
  cd ~/projects/hermes-auth && pytest tests/test_auth.py -x
```

### Step 6: Return context summary

Output to user:
```
=== Context Recovery ===
Found 3 recent sessions (last 48h)
2 sessions completed, 1 interrupted
Active project: hermes-auth (branch: feature/rate-limiting)
Last work: auth middleware — rate limiter implementation (~80% done)
10 files modified since last session
Recommendation: resume at src/middleware/auth.py line 142
```

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-context-search","message":"Context recovered: 3 sessions, 1 active project","sessions":3,"projects":1,"status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 14:00:01] pai-context-search
[2026-05-30 14:00:02] → Phase 1: scanning session registry
[2026-05-30 14:00:04] → found 4 sessions (last 48h)
[2026-05-30 14:00:04] → Phase 2: scanning work directories
[2026-05-30 14:00:06] → found 15 modified files across 2 projects
[2026-05-30 14:00:07] → correlating sessions with file changes
[2026-05-30 14:00:09] → building context snapshot
[2026-05-30 14:00:10] ✓ context snapshot at ~/.pai/context/snapshots/20260530_140010.context.md
```

## Gotchas

- **Session registry access**: Requires Hermes `session_search` tool to be
  available. If not, falls back to scanning `~/.hermes/sessions/*.json` directly.
- **Git-tracked vs untracked files**: Work directory search finds all modified
  files, but only git-tracked files have meaningful diff context. Untracked
  files may be temporary artifacts — flag them as such.
- **Stale directories**: Projects with no activity in 30+ days are excluded
  from Phase 2 by default. Use `--since all` to include them.
- **Multiple concurrent projects**: If the user switches projects between
  sessions, correlation may misassign files. Cross-reference by git branch
  and commit messages for accuracy.
- **Large repositories**: `find` with `-newer` on massive repos (monorepos)
  may take time. If Phase 2 is slow, narrow scope with `--dirs`.
