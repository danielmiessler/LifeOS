# Capture Workflow

How WorkCompletionLearning captures learning files at session end.

## Trigger

The hook fires on `SessionEnd`. It receives optional JSON on stdin containing `session_id`.

## Steps

### 1. Find Active Work State

The hook looks for the current work session state file:

1. Check for session-scoped state: `MEMORY/STATE/current-work-{session_id}.json`
2. Fall back to legacy state: `MEMORY/STATE/current-work.json`
3. If neither exists, exit silently (no active work)

### 2. Validate Session Ownership

If a `session_id` was provided, verify the state file belongs to this session. If the state file's `session_id` does not match, exit silently to avoid cross-session contamination.

### 3. Read Work Metadata

Look for work metadata in the work directory (`MEMORY/WORK/{session_dir}/`):

1. Check for `PRD.md` with YAML frontmatter (v4.0 format)
2. Fall back to `META.yaml` (legacy format)
3. If neither exists, exit silently

Parse the metadata to extract: id, title, created_at, completed_at, source, status, session_id, and lineage (tools_used, files_changed, agents_spawned).

### 4. Extract Ideal State Criteria

From `PRD.md`: Find the `## IDEAL STATE CRITERIA` section, count checked `[x]` vs unchecked `[ ]` items.

From `ISC.json` (legacy): Read criteria array and satisfaction counts.

### 5. Check Significant Work

A learning is only captured if at least one condition is true:

- Files were changed (`lineage.files_changed.length > 0`)
- Multiple work items exist (`task_count > 1`)
- Work was manually created (`source === 'MANUAL'`)

If none are true, log "Trivial work session" and exit.

### 6. Classify Category

The `getLearningCategory` utility classifies the work title:

- **ALGORITHM**: Matches process keywords (approach, method, strategy, reasoning, over-engineer, wrong direction)
- **SYSTEM**: Matches infrastructure keywords (hook, crash, tool, config, deploy, import, module)
- **Default**: ALGORITHM (most learnings are about task quality)

### 7. Write Learning File

Create the file at: `MEMORY/LEARNING/{category}/{YYYY-MM}/{date}_{time}_work_{slug}.md`

The file contains:
- Title, duration, category, session ID
- ISC satisfaction summary
- Files changed count, tools used list, agents spawned count
- Reflection prompts

If the file already exists (duplicate prevention), skip and log.

## Output

A markdown file in the appropriate category and month directory. The file is self-contained and human-readable.
