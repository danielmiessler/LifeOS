---
name: CoreUpgrade
version: 1.0.0
description: "Scoped major-version upgrade for an existing LifeOS install — replaces only the SYSTEM entries the new payload ships (LIFEOS/, payload-shipped skills/commands/agents) while preserving USER, MEMORY, private skills/_*, custom commands/agents/skills, .env, settings, and harness state. Optional --split-claude-md extracts your CLAUDE.md customizations into an imported USER/CUSTOMIZATIONS/GLOBAL.md so the base CLAUDE.md can be pulled fresh every upgrade. Scoped backup + rollback, dry-run by default, --apply gated. USE WHEN upgrade lifeos, major version upgrade, move lifeos install to a new version, scoped core replacement, replace lifeos core, split claude.md customizations. NOT FOR fresh install or onboarding (use the LifeOS skill), system-improvement recommendations (use Upgrade), or external-content intake (use Migrate)."
disable-model-invocation: true
---

# CoreUpgrade — scoped major-version upgrade

## 🚨 MANDATORY: Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Planning the core upgrade. Dry-run first — nothing changes without apply."}' \
  > /dev/null 2>&1 &
```

## What It Does

CoreUpgrade moves an existing LifeOS install to a new major version. It clears only the SYSTEM entries the new payload actually ships — `LIFEOS/` subdirs, payload-shipped public skills, commands, and agents — then deploys the payload into the cleared slots. Everything user-owned survives untouched: `LIFEOS/USER/`, `LIFEOS/MEMORY/`, `.env*`, `settings*.json`, private `skills/_*`, and any command/agent/skill the payload does not ship.

## The Problem

The LifeOS installer is deliberately additive — `DeployCore` copies only missing files and never overwrites a populated target. That is the right behavior for a fresh install, but it means there is no path to *replace* the core across a major version: deploying a new payload over an old install leaves every old SYSTEM file in place, producing a broken hybrid. Hand-deleting the right directories is worse — one wrong `rm -rf` and user data is gone. CoreUpgrade is the missing primitive: a scoped, reversible clear-and-replace with the preserve boundary encoded as tested code, not operator care.

## How It Works

1. **Plan** — the clear-list is enumerated from the LIVE install and each entry is cleared only if it passes the preserve check AND the payload ships a replacement. A wrong or malicious payload can never inject a path or clear a preserved zone; an empty payload clears nothing.
2. **Backup** — exactly the to-be-cleared entries are copied to a backup dir (outside the install, enforced), verified per-entry, BEFORE any delete.
3. **Clear + deploy** — every delete goes through a guarded remove (preserve-check + path-escape, case-insensitive). The payload then fills the cleared slots.
4. **Rollback** — on ANY error, deploy-created artifacts are removed and cleared entries are restored from the backup, with partial failures named explicitly rather than reported as success.

Dry-run is the default; nothing mutates without the literal `--apply`.

## Usage

```bash
# Dry-run (DEFAULT — prints the exact plan, changes nothing):
bun skills/CoreUpgrade/Tools/LifeosUpgrade.ts --payload <new-version>/install

# Execute:
bun skills/CoreUpgrade/Tools/LifeosUpgrade.ts --payload <new-version>/install --apply

# Execute + split CLAUDE.md customizations into an imported overlay:
bun skills/CoreUpgrade/Tools/LifeosUpgrade.ts --payload <new-version>/install --apply --split-claude-md
```

Flags: `--payload <dir>` (required), `--apply`, `--config-root <dir>` (default `~/.claude`), `--backup-dir <dir>`, `--split-claude-md`, `--help`.

## The CLAUDE.md Split (`--split-claude-md`)

By default `CLAUDE.md` is preserved, which means it drifts: after an upgrade it still describes the OLD version until reconciled by hand. The split ends that cycle so future base updates can be pulled fresh:

- Your `CLAUDE.md` is diffed against the payload's `CLAUDE.template.md` — deterministic markdown block-diff, no model calls.
- **Pure additions** (blocks absent upstream) are auto-extracted to `LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md`, imported by the base via `@LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md`.
- **Modified base lines** are FLAGGED in the plan for manual placement — the tool never guesses which version you meant.
- The old `CLAUDE.md` is backed up and verified before replacement; an existing `GLOBAL.md` is never overwritten (re-checked at write time).
- The new base ships with all `@`-imports commented. **Run the payload's `ActivateImports.ts` immediately after apply** — identity/TELOS/GLOBAL context is dormant until then.

Review the dry-run's split report (additions / flagged modifications / matched / noise) before applying: a diff cannot distinguish *your customization* from *stale old-version content the new base supersedes* — that judgment is yours, and the full original is always in the backup.

## Safety Guarantees

- **Dry-run by default; `--apply` is the only mutating path.** No backup verified on disk → no delete happens.
- **Payload-aware clearing** — only entries the payload ships are ever cleared, so upstream deletions are honored and user content the payload doesn't know about survives.
- **Preserve denylist + path-escape guard on every delete**, case-insensitive (APFS), failing toward preservation.
- **Refuses dev trees** (won't mutate a LifeOS source checkout) and ambiguous targets (a bare dir with a stray `CLAUDE.md` is not an install).
- **Named-failure rollback** — anything that could not be auto-restored is listed with the backup path, never silently dropped.

## Post-Upgrade Steps (manual, printed by the tool)

1. `--split-claude-md` used → run the payload's `ActivateImports.ts` (imports ship commented).
2. Run the payload's `InstallHooks.ts` to wire new-version hooks.
3. Reconcile `settings*.json` against the payload templates.
4. Re-apply any custom edits you had made inside replaced SYSTEM dirs (from the backup; better: move them to `skills/_*` first, where they're preserved automatically).

## Verification

`Tools/LifeosUpgrade.test.ts` — 20 tests / 111 assertions, runnable standalone with `bun test`. Covers: preserve-zone protection (incl. case variants), payload-aware clearing, empty/wrong-payload no-op, dev-tree refusal, symlink-cycle safety, backup scoping, rollback (restore + new-artifact removal + named failures), split extraction (additions vs flagged modifications vs noise), split no-clobber (incl. write-time re-check), and full split+rollback composition under a simulated deploy failure.
