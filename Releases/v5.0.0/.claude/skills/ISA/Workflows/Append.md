# Append Workflow

Canonical writer for the three append-only sections of an ISA: `## Decisions`, `## Changelog`, `## Verification`. The Deutsch conjecture/refutation/learning Changelog format is novel and easy to mangle with free-form editing — this workflow owns the canonical entry shape so it doesn't degrade across projects.

## When to invoke

- Algorithm at any phase when a non-obvious decision is made: `Skill("ISA", "append decision to <isa-path>: <text>")`
- Algorithm at LEARN when understanding evolved: `Skill("ISA", "append changelog to <isa-path>: <conjecture> / <refutation> / <learning>")`
- Algorithm at EXECUTE/VERIFY when an ISC passes: `Skill("ISA", "append verification to <isa-path>: <ISC-N> <evidence>")`
- User directly when adding an entry by hand.

## Entry types

### Type 1 — Decision

Timestamped log line. Use the `refined:` prefix when the decision changes the Goal or restructures the ISC set.

**Schema:**

```
- YYYY-MM-DD HH:MM: <decision text>
- YYYY-MM-DD HH:MM: refined: <what was refined and why>
- YYYY-MM-DD HH:MM: ❌ DEAD END: Tried <X> — failed because <Y> (don't retry)
```

**Inputs:** `text` (required), `kind` (optional: `decision` | `refined` | `dead-end`)

### Type 2 — Changelog (the Deutsch C/R/L entry)

Structured entry capturing how thinking evolved.

**Schema:**

```
- YYYY-MM-DD | conjectured: <what we believed>
  refuted by: <evidence that broke the belief>
  learned: <what the evidence taught us>
  criterion now: <which ISC was added/changed/dropped as a result>
```

**Inputs:** All four fields required (`conjectured`, `refuted_by`, `learned`, `criterion_now`).

**Format invariant:** The four-line shape is non-negotiable. If any of the four pieces is missing, this is a Decision entry, not a Changelog entry. Refuse to write a partial C/R/L; surface the missing piece and ask.

### Type 3 — Verification

ISC-keyed evidence line. Used at VERIFY phase to record how each ISC was probed.

**Schema:**

```
- ISC-N: <probe type> — <one-line evidence, quoted command output or file content>
```

**Inputs:** `isc_id` (required, must exist in master), `probe_type` (required), `evidence` (required, quoted verbatim from tool output).

## Procedure

### Step 2 — Resolve target ISA and section

Read the ISA at `isa_path`. Find the target section (`## Decisions` | `## Changelog` | `## Verification`). If the section doesn't exist, create it in the canonical position (after `## Features` for Decisions, after Decisions for Changelog, last for Verification).

### Step 3 — Validate the entry shape

| Type | Required pieces | Refuse if... |
|------|-----------------|--------------|
| Decision | text + timestamp | text is empty |
| Changelog | conjectured + refuted_by + learned + criterion_now + date | any of the four C/R/L pieces is missing |
| Verification | isc_id + probe_type + evidence | isc_id doesn't exist in `## Criteria`, or evidence is empty |

**Refuse mode:** If validation fails, do not write. Surface the missing piece. The whole point of Append is to keep these sections clean — silently writing partial entries defeats it.

### Step 4 — Format the entry

Use the schemas above verbatim. Prefer single-line entries over multi-line where the schema permits. For Changelog entries, use the four-line indented form exactly.

### Step 5 — Append to the section

Edit the ISA: append the entry to the end of the target section, preserving prior entries. Update frontmatter `updated: <ISO-8601>`.

### Step 6 — Update progress (Verification only)

When appending a Verification entry that corresponds to a previously-`[ ]` ISC, also flip that ISC to `[x]` in `## Criteria` and recompute `progress: M/N` in frontmatter.

### Step 7 — Return the appended block

Output the exact text that was appended, plus the path. Caller can re-emit for confirmation.

## Why this workflow exists

The Deutsch C/R/L Changelog format is the most opinionated piece of the v6.2.0 doctrine and the easiest to dilute. Three failure modes if there's no canonical writer:

1. **Free-form prose creep:** "we changed our minds about X" instead of the four-piece structure.
2. **Half-entries:** `conjectured` + `criterion now` without the refutation evidence in between.
3. **Format drift:** different projects evolve different conventions, breaking cross-project search and tooling.

Append is the gate. Every C/R/L entry passes through here. Every Verification entry passes through here. Every Decisions entry passes through here. The skill that owns the artifact owns the canonical way to extend it.

## Interaction with Reconcile

The Reconcile workflow (merging an ephemeral feature file back to master) calls Append internally for each Decisions, Changelog, and Verification entry it stages. This means Reconcile's output passes the same shape validation as direct Append calls — the merge cannot smuggle in malformed entries.

## Failure modes

- **Concurrent edits:** Append reads the ISA, decides where to insert, then writes. If the file is edited mid-flight, the second write may insert at a stale offset. Treat Append as best-effort under contention; structural edits to ISAs should be serialized.
- **Section header missing:** Append creates the section if absent, in canonical position. If the canonical position is ambiguous (file is malformed), abort and surface the structural problem.
- **ISC ID mismatch on Verification:** the ISC must exist. Refuse to write Verification for an ID that isn't in `## Criteria` — this is the same ID-stability contract Reconcile relies on.
