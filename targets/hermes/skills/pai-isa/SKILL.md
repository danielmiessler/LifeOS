---
name: pai-isa
description: Intelligence Stack Architecture — tier-gated ISA scaffolding, completeness checking, and ephemeral-to-master reconciliation
version: 5.0.0
author: PAI v5.0 → Hermes Port
metadata:
  hermes_tags: [pai, isa, architecture, scaffolding, governance]
  related_skills: [pai-council, pai-evals, pai-loop]
  requires: [delegate_task, read_file, write_file, web_search, terminal]
workflows:
  scaffold: workflows/scaffold.md
  check-completeness: workflows/check-completeness.md
  reconcile: workflows/reconcile.md
---

<!-- Voice notification — fire-and-forget on invocation -->
```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the pai-isa skill"}' \
  > /dev/null 2>&1 &
```


# pai-isa — Intelligence Stack Architecture

## Overview

pai-isa is the architectural backbone of PAI. It scaffolds Intelligence Stack
Architecture documents from natural-language prompts at a specified tier,
checks an ISA for completeness against tier-specific gates, and deterministically
merges ephemeral (working) ISA changes into the master ISA.

An ISA is a tiered specification document:
- **Tier 0**: Intent / problem statement
- **Tier 1**: System architecture (components, data flow, interfaces)
- **Tier 2**: Module design (detailed API contracts, data models)
- **Tier 3**: Implementation plan (files, functions, tests, order of work)

ISA documents are stored at `~/.pai/isa/master/` and `~/.pai/isa/ephemeral/`.

## When to Use

- **scaffold**: Start of a new project or feature — generate a structured ISA
- **check-completeness**: Before implementation — ensure the ISA is gate-ready
- **reconcile**: After implementation or iteration — merge ephemeral changes
  back to master deterministically

## Workflow Routing

| Trigger | Workflow | Description |
|---|---|---|
| `pai-isa scaffold "prompt" [tier]` | `workflows/scaffold.md` | Generate ISA from prompt |
| `pai-isa check <isa-path>` | `workflows/check-completeness.md` | Score ISA against tier gate |
| `pai-isa reconcile <ephemeral> <master>` | `workflows/reconcile.md` | Merge ephemeral → master |

## Procedure

### Scaffold (bridge to workflow)

1. Confirm tier (0-3). Defaults to 0 if not specified.
2. Load `workflows/scaffold.md` via `read_file`.
3. Execute scaffold workflow steps.
4. Save ISA to `~/.pai/isa/ephemeral/<name>.isa.md`.
5. Voice notification: success with path and tier.

### Check Completeness (bridge to workflow)

1. Resolve ISA path (master or ephemeral).
2. Detect tier from ISA header metadata.
3. Load `workflows/check-completeness.md`.
4. Execute gate checks for the detected tier.
5. Output score (0.0–1.0) and missing-requirements list.

### Reconcile (bridge to workflow)

1. Read ephemeral ISA and master ISA.
2. Load `workflows/reconcile.md`.
3. Execute deterministic merge:
   - Sections in ephemeral but not master → appended.
   - Sections in master but not ephemeral → preserved.
   - Sections in both → fields merged field-by-field; ephemeral wins on conflict.
4. Write merged result to master path.
5. Archive ephemeral to `~/.pai/isa/archive/<name>.<timestamp>.isa.md`.

## Voice Notification

```bash
curl -s -X POST https://api.nousresearch.com/hermes/voice \
  -H "Content-Type: application/json" \
  -d '{"type":"pai-isa","message":"ISA scaffolded at tier 2 for project nexus","path":"~/.pai/isa/ephemeral/nexus.isa.md","status":"ok"}'
```

## Execution Log Pattern

```
[2026-05-30 10:15:01] pai-isa scaffold "nexus auth module" tier=2
[2026-05-30 10:15:02] → loading scaffold workflow
[2026-05-30 10:15:03] → tier 2 scaffolding: architecture + module design
[2026-05-30 10:15:08] → saving to ~/.pai/isa/ephemeral/nexus.isa.md
[2026-05-30 10:15:08] ✓ scaffold complete (tier 2, 47 sections)
[2026-05-30 10:16:00] pai-isa check ~/.pai/isa/ephemeral/nexus.isa.md
[2026-05-30 10:16:02] → detected tier 2, running completeness gate
[2026-05-30 10:16:05] → score: 0.82 (missing: api-contracts, error-codes)
[2026-05-30 10:16:05] ⚠ gate requires 0.85 — add missing sections
[2026-05-30 10:20:00] pai-isa reconcile ~/.pai/isa/ephemeral/nexus.isa.md ~/.pai/isa/master/nexus.isa.md
[2026-05-30 10:20:03] → deterministic merge: 12 sections added, 4 updated, 0 removed
[2026-05-30 10:20:04] ✓ reconcile complete, ephemeral archived
```

## Gotchas

- **Tier detection**: ISA header must contain `tier: N` in YAML frontmatter or
  a `# Tier N` heading. Plain-text ISAs without this default to tier 0.
- **Determinism guarantee**: Reconciliation is deterministic given the same
  two inputs. No fuzzy matching on section names — exact header comparison only.
- **Completeness thresholds**: Tier gates are configurable in
  `~/.pai/isa/gates.yaml`. Default thresholds: T0=0.5, T1=0.7, T2=0.85, T3=0.95.
- **Ephemeral archiving**: After reconcile, the ephemeral is moved to archive,
  not deleted. This enables rollback via reverse reconcile.
- **Workflow files**: Must be present in the `workflows/` subdirectory. Missing
  workflow files cause the skill to fall back to inline generation.
