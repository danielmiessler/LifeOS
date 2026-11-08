---
last_updated: 2026-11-08T00:00:00Z
last_updated_by: da
convention: lifeos-freshness-v1
version: 1.0.0
---

# Pending — what is still open across all ISAs

> The hill-climb is only legible if you can see the remaining distance. Every ISA already states its open criteria; `Pending.ts` adds them up across ISAs, so "what is still open?" has one deterministic answer instead of a manual walk through folders.

## What it is

`LIFEOS/TOOLS/Pending.ts` reads the ISAs Pursuit reads and reports, per ISA: open, closed and dropped criteria, unchecked `## Remaining Work` items, phase, last-updated age, and a group label. It runs only when called (no hook, no SessionStart wiring, no schedule) and is read-only: it never writes an ISA.

An ISA's backlog is the union of its open criteria and its unchecked `## Remaining Work` items (ISAFormat.md v2.19.0). Pending reports the two separately (`open` and `remaining`) and treats either as open work for anomalies.

**Relation to existing tools.** `IsaFrontier.ts` (`status`, `frontier`) answers "what can I take next?" for one ISA. Pursuit (`LIFEOS/IDEALSTATE/Pursuit.ts`) reads each ISA's phase and `serves:` to say what is moving each ideal-state target. Pending answers "how many criteria are still open?" across all ISAs; nothing else counts them across ISAs.

## What it reuses

Pending carries no parser or phase list of its own:

| What | From |
|---|---|
| Criteria | `parseClaims` in `LIFEOS/TOOLS/IsaFrontier.ts` |
| Default roots | `isaDirs()` in `LIFEOS/IDEALSTATE/Pursuit.ts`: `MEMORY/WORK` plus the `LIFEOS` directory for system ISAs, or `IDEALSTATE_ISA_DIR` when set |
| Which phases are closed | `isaClosed()` in `Pursuit.ts`: the `cairn` bracket from `LIFEOS/TOOLS/ascent.ts` (`complete`, `learn`) plus Pursuit's stopped phases (`abandoned`, `closed`, `cancelled`, `dropped`, `archived`) |
| ISA discovery | `<root>/<child>/ISA.md`, one level deep, the same shape as Pursuit's `liveIsas()` |

Frontmatter is read with the `isa-utils` rule (trailing YAML comments stripped, `#` inside quotes kept), written out locally so the CLI stays off the hook graph, as `IsaFrontier.ts` does.

## How criteria are counted

Everything here is `parseClaims` behaviour; the tests in `Pending.test.ts` pin each line.

- Criteria are read from every criteria section: `## Criteria`, `## ISC Criteria`, `## Claims` (legacy), `## IDEAL STATE CRITERIA`, `### Criteria`, `## Features`, `## Bridge Criteria`, and `## Anti-criteria` (or legacy `## Anti-claims`). Each section ends at the next `#` or `##` heading or a `---` line; `###` subheadings (feature blocks) do not end it. Other sections are not read.
- A line counts when it carries a criterion ID: a checkbox or plain bullet, or a table row. Checkboxes inside code fences are not criteria.
- A parent with nested children (such as `ISC-1` over `ISC-1.1` and `ISC-1.2`, or a `[container]`) is verified through them, so only the leaves are counted, as in `lib/IsaClaims.ts`. `parseClaims` returns the parents too, for dependency edges; Pending keeps the leaves.
- **Closed** = checked (`- [x]`, or a table status cell `passed`, `closed`, `complete`, `done`, `[x]`, `✅`) and not dropped. **Open** = not closed and not dropped; `[DEFERRED-VERIFY]` and partial `[~]` criteria are open.
- **Dropped** = the description contains `[DROPPED`; dropped criteria are neither open nor closed, checked or not.
- CRLF and CR line endings are normalised to LF first.
- Age is the `updated` frontmatter field, falling back to the file's mtime. Only top-level frontmatter keys are read.
- `## Remaining Work` items follow the same section and fence rules: unchecked `- [ ]` lines until the next `#`/`##` heading or `---`, fenced lines skipped.

## Run

```bash
bun ~/.claude/LIFEOS/TOOLS/Pending.ts                      # human-readable
bun ~/.claude/LIFEOS/TOOLS/Pending.ts --json               # stable machine shape
bun ~/.claude/LIFEOS/TOOLS/Pending.ts --root ~/Projects --group-field team --idle-days 30
```

`--help` / `-h` prints usage and exits 0. A completed scan exits 0 (anomalies are findings, not failures). A bad argument (unknown flag, `--root` / `--group-field` / `--idle-days` without a value, or a non-positive or non-numeric `--idle-days`) prints a message to stderr and exits 2.

## Config

Follows the standard config path (`Config/ConfigSystem.md`): an optional `pending` object in `settings.json`, merged from `settings.system.json` plus the USER overlay. Flags override settings; settings override defaults.

| Key | Flag | Default | Meaning |
|---|---|---|---|
| `roots` | `--root` (repeatable) | Pursuit's `isaDirs()` | Directories whose `<child>/ISA.md` files are read. `~` and `$HOME` expand. A `roots` array in the USER overlay **replaces** the default, so list the defaults too when extending. |
| `groupField` | `--group-field` | `project` | Frontmatter field used as the group label. A missing or empty field puts the ISA in the literal group `unlabeled`. |
| `idleDays` | `--idle-days` | `14` | Open ISAs not updated for more than this many days are flagged idle. |

## Anomalies

Generic only; anything domain-specific belongs in a wrapper.

| `kind` | Raised when |
|---|---|
| `closed_with_open_criteria` | the phase is closed (`isaClosed`) but at least one criterion or Remaining Work item is still open |
| `idle_with_open_criteria` | the phase is not closed, criteria or Remaining Work items are open, and age exceeds `idleDays` |
| `unreadable` | the file exists but cannot be read |
| `no_frontmatter` | the ISA has no YAML frontmatter block (it is still counted; phase is `unknown`) |

A nonexistent root is not an anomaly of an ISA; it is listed in `missingRoots` and the scan continues.

## JSON shape

```json
{
  "generatedAt": "ISO-8601",
  "config": { "roots": ["..."], "groupField": "project", "idleDays": 14 },
  "missingRoots": ["..."],
  "totals": { "isas": 0, "open": 0, "closed": 0, "remaining": 0 },
  "groups": [{ "group": "unlabeled", "isas": 0, "open": 0, "closed": 0, "remaining": 0 }],
  "isas": [{ "path": "...", "group": "...", "phase": "build", "open": 0, "closed": 0, "dropped": 0, "updated": "ISO-8601", "ageDays": 0, "remaining": 0 }],
  "anomalies": [{ "path": "...", "kind": "idle_with_open_criteria", "detail": "..." }]
}
```

`open`, `closed` and `dropped` count criteria. Groups are sorted by open plus remaining count (descending), then name. Keys are additive-only; existing keys keep their meaning.

## Tests

`LIFEOS/TOOLS/Pending.test.ts` (`bun test LIFEOS/TOOLS/Pending.test.ts`), every fixture a synthetic ISA in a temp dir:

- **Pending**: counts, each anomaly, every closed phase through `isaClosed`, `unlabeled` and a configurable group field, no-frontmatter, unreadable file, missing root, JSON key order, settings loading and Pursuit's default roots.
- **Pending criteria parsing (parseClaims)**: heading variants, parents counted through their leaves, `[DEFERRED-VERIFY]`, Anti-criteria and Bridge Criteria, code fences, table rows, sections outside the criteria sections, checked-and-dropped, frontmatter comments and nesting, CRLF, `## Remaining Work` with fences and section ends.
- **Pending traversal and output**: one-level discovery, one ISA through two roots or a symlink, human-readable output.
- **Pending CLI**: spawns the CLI for `--help`/`-h`, a `--json` scan, the default roots, and exit code 2 with a stderr message for each bad argument.
