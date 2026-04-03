# PAI PRD Format Specification v2.0

The PRD (Product Requirements Document) is the single source of truth for every Algorithm run.
The AI writes all PRD content directly using Write/Edit tools. Hooks only read PRDs to sync state.

## Frontmatter (YAML)

Eight required fields, one optional:

```yaml
---
task: "8 word task description"           # What this work is
slug: YYYYMMDD-HHMMSS_kebab-task          # Unique ID, directory name
effort: standard                          # standard|extended|advanced|deep|comprehensive
phase: observe                            # observe|think|plan|build|execute|verify|learn|complete
progress: 0/8                             # checked criteria / total criteria
mode: interactive                         # interactive|loop
started: 2026-02-24T02:00:00Z            # Creation timestamp (ISO 8601)
updated: 2026-02-24T02:00:00Z            # Last modification timestamp (ISO 8601)
---
```

Optional field (added on rework/continuation):

```yaml
iteration: 2                              # Incremented when revisiting a completed task
```

### Field Rules

- `task`: Imperative mood, max 60 chars. Describes the deliverable, not the process.
- `slug`: Format `YYYYMMDD-HHMMSS_kebab-description`. Used as directory name under `MEMORY/WORK/`.
- `effort`: Determines ISC count range and time budget. See Algorithm for tier definitions.
- `phase`: Updated at the START of each Algorithm phase. Set to `complete` when done.
- `progress`: Format `M/N` where M = checked ISC criteria, N = total ISC criteria. Updated immediately when a criterion passes (don't wait for VERIFY).
- `mode`: `interactive` (single Algorithm run) or `loop` (multiple iterations toward ideal state). Determines whether `iteration` tracking is active.
- `started`: Set once at creation. Never modified.
- `updated`: Set on every Edit/Write. Use current ISO 8601 timestamp.
- `iteration`: Omitted on first run. Set to `2` on first continuation, incremented thereafter.

## Body Sections

Four sections. Each appears only when populated — never create empty placeholder sections.

### ## Context

Written during OBSERVE. Captures:
- What was explicitly requested and not requested
- Why this task matters
- Key constraints and dependencies
- Risks and riskiest assumptions (merged here, no separate Risks section)

For Advanced+ effort, a `### Plan` subsection may be added with technical approach details.

### ## Criteria

ISC (Ideal State Criteria) checkboxes. Written during OBSERVE, checked during EXECUTE/VERIFY.

```markdown
- [ ] ISC-1: Criterion text (8-12 words, binary testable, state not action)
- [ ] ISC-2: Another criterion
- [ ] ISC-A-1: Anti: What must NOT happen
```

**Rules:**
- Each criterion: 8-12 words, describes an end state (not an action)
- Binary testable: either true or false, no judgment required
- **Atomic**: one verifiable thing per criterion — no compound statements
- Anti-criteria prefixed `ISC-A-`: things that must NOT be true
- ID format: `ISC-N` for criteria, `ISC-A-N` for anti-criteria
- Check (`- [x]`) immediately when satisfied — don't batch at VERIFY
- Update frontmatter `progress` on every check change

**Atomicity — the Splitting Test (apply to every criterion):**
- Contains "and"/"with"/"including" joining two verifiable things? → split
- Can part A pass while part B fails independently? → split
- Contains "all"/"every"/"complete"? → enumerate what that means
- Crosses domain boundaries (UI/API/data/logic)? → one per boundary

**Count enforcement:** Total ISC must meet effort tier floor (Standard: 8, Extended: 16, Advanced: 24, Deep: 40, Comprehensive: 64). If below floor after first pass, decompose compound criteria until met.

### ## Decisions

Timestamped decision log. Written during any phase when non-obvious choices are made.

```markdown
- 2026-02-24 02:00: Chose X over Y because Z
- 2026-02-24 02:15: Rejected approach A due to performance concern
```

### ## Verification

Evidence for each criterion. Written during VERIFY phase.

```markdown
- ISC-1: Screenshot confirms layout renders correctly
- ISC-2: `bun test` passes, 14/14 tests green
- ISC-A-1: Confirmed no PII in output via grep
```

## File Location

```
~/.claude/MEMORY/WORK/{slug}/PRD.md
```

Directory created with `mkdir -p MEMORY/WORK/{slug}/` during OBSERVE.

## Continuation / Rework

When a follow-up prompt continues the same task:

1. AI detects recent PRD matching the task context
2. Edit existing PRD: reset `phase: observe`, add/increment `iteration`, update `updated`
3. Re-enter Algorithm phases as needed
4. Phase history in work.json tracks re-entry (COMPLETE → OBSERVE)

When it's a genuinely new task: create a new PRD with a new slug.

## Sync Pipeline

PRD is read-only from hooks' perspective:

1. **AI writes PRD** via Write/Edit tools
2. **PRDSync hook** fires on PostToolUse, reads frontmatter + criteria
3. **work.json** updated with session state (keyed by slug)
4. **API route** serves work.json to dashboard
5. **Dashboard** polls API every 2 seconds

The AI is the sole writer. Hooks only read. work.json is derived state.

## Design Rationale

This format is informed by research across Kiro (AWS), spec-kit (GitHub), OpenSpec, BMAD,
Google Design Docs, Amazon 6-pagers, Shape Up pitches, and 48 production PAI PRDs.

Key design choices:
- **8 fields, not 15**: Only fields consumed by the sync pipeline. Dead fields waste tokens.
- **4 sections, not 7**: Risks merged into Context. Plan merged into Context. Changelog dropped (git serves this purpose).
- **Checkboxes over EARS/BDD**: Simpler to parse, write, and verify. ISC pattern proven over 48 PRDs.
- **YAML frontmatter over JSON**: Universal standard (Jekyll, Hugo, Astro, Kiro, spec-kit all use it).
- **Convention-based sections**: Sections appear when needed, not as empty boilerplate.
- **Reference file pattern**: This spec lives at `~/.claude/PAI/PRDFORMAT.md`, not inline in CLAUDE.md. Saves ~2,500 tokens/response.
