# Reconcile Workflow

Deterministic merge of an ephemeral feature-file excerpt back into the master ISA, keyed on stable ISC IDs. The cornerstone of the Ralph Loop / Maestro pattern — without this, ephemeral feature work drifts from master and creates the same "code drifts from spec" problem the ISA is meant to solve.

## When to invoke

- A feature-context agent (Ralph Loop instance, Maestro worker, parallel coding-agent instance) finishes work on an ephemeral feature file.
- The Algorithm at LEARN: `Skill("ISA", "reconcile <ephemeral-path> → <master-path>")`
- User directly: `Skill("ISA", "reconcile <ephemeral-path> → <master-path>")`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| ephemeral_path | yes | Path to the ephemeral feature file (`MEMORY/WORK/{slug}/_ephemeral/<feature>.md`) |
| master_path | yes | Path to the master ISA the ephemeral was derived from |
| dry_run | no | Default false. If true, report planned changes without writing. |

## Output

```yaml
status: applied | dry_run | aborted
ephemeral: <path>
master: <path>
applied:
  iscs_checked: [ISC-12, ISC-13, ISC-14, ISC-15, ISC-31]   # ISCs flipped to [x]
  verification_added: 5                                     # Verification entries appended
  decisions_added: 2                                        # Decisions entries appended
  changelog_added: 1                                        # Changelog entries appended
archived_to: MEMORY/WORK/.../_ephemeral/.archive/AuthSystem-2026-04-15.md
errors:
  - isc: ISC-99
    reason: not present in master — ephemeral references unknown ID
```

## Procedure

### Step 2 — Read both files

Load ephemeral and master. Confirm ephemeral has the canonical header marker (`<!-- EPHEMERAL FEATURE FILE — derived from ... -->`); abort if not (refusing to merge anything that didn't come from Scaffold's ephemeral mode).

### Step 3 — Build the ISC ID merge plan

For each ISC in the ephemeral file:
- If `[x]` in ephemeral and `[ ]` in master: stage flip in master.
- If `[x]` in both: no-op.
- If `[ ]` in ephemeral: no-op (ephemeral hasn't completed it).
- If ID exists in ephemeral but not in master: ERROR — ID-stability violation.
- If ID was renumbered (sequence gap, tombstone shifted): ERROR — ID-stability violation.

### Step 4 — Stage Verification entries

Each ISC flipped in step 3 must have a corresponding entry in the ephemeral's `## Verification` section. Stage these entries to be appended to master's `## Verification`. Preserve quoted command output / file content / screenshot paths verbatim.

### Step 5 — Stage Decisions entries

Append the ephemeral's `## Decisions` entries to master's `## Decisions`, prefixed with `[from <feature>]:` for traceability. Preserve timestamps.

### Step 6 — Stage Changelog entries

If the ephemeral has any new `## Changelog` entries (conjecture/refutation/learning format), append them to master's `## Changelog` with a feature-context note: `[surfaced in <feature>]:`.

### Step 7 — Update master frontmatter

- `progress: M/N` recomputed from the new `[x]` count.
- `updated: <ISO-8601>` set to now.
- `phase`: leave alone unless every ISC is `[x]`, in which case set to `verify` (LEARN/complete is the user's transition, not Reconcile's).

### Step 8 — Apply or dry-run

If `dry_run: true`, emit the YAML output and stop.

If `dry_run: false`, apply all staged changes via Edit/Write tools. Order:
1. Edit master ISA frontmatter.
2. Edit master `## Criteria` ISC checkmarks.
3. Edit master `## Verification` (append).
4. Edit master `## Decisions` (append).
5. Edit master `## Changelog` (append).

### Step 9 — Archive the ephemeral file

`mv <ephemeral_path> <ephemeral_dir>/.archive/<feature>-<YYYY-MM-DD>.md`. The archive is permanent — useful for forensics, never deleted.

### Step 10 — Emit the report

Output the YAML report. Algorithm LEARN consumes this to know the merge happened.

## Conflict resolution

Reconcile is **deterministic** — there are no conflicts to resolve. Either an ISC ID exists in master and the merge is mechanical, or it doesn't and the merge aborts with an error.

If the ephemeral made structural ISC changes (split ISC-7 into ISC-7.1 / ISC-7.2), those changes belong in master via a separate Edit by the user before Reconcile runs. Reconcile does not invent IDs; it only flips checkmarks on existing ones.

If the ephemeral and master have diverged structurally (ephemeral is stale relative to master), abort and surface the divergence. The user must decide whether to re-extract a fresh ephemeral or back-port master changes manually.

## Failure modes

- **ID-stability violation:** ephemeral references ISC-N that doesn't exist in master. Abort. Do not silently drop the entry. Master is the source of truth; ephemeral cannot mint IDs.
- **Missing canonical header on ephemeral:** abort. Reconcile only operates on files Scaffold produced.
- **Verification entry missing for a flipped ISC:** soft warning. The flip is valid (ephemeral worker decided to mark it done), but the absence of evidence violates Verification Doctrine Rule 1. Surface in the report; let the Algorithm's VERIFY phase catch it.
- **Master ISA modified during the merge:** Reconcile is single-threaded by design. If concurrent edits happen, the second Reconcile sees a different state and may report "ISC already checked" — that's correct behavior.

## Idempotency

Reconcile is idempotent by design. Running it twice on the same ephemeral against the same master produces no further changes after the first run, and emits a report showing zero applied changes. Safe to retry.
