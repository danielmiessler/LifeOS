# TELOS — Your Life Operating Goals

> 🎯 SAMPLE TEMPLATES — Every `.md` file in this directory ships as a SAMPLE with placeholder entries marked `(sample)`. They show the SHAPE of populated TELOS data so you can see what to aim for. Run `/interview` (or talk to your DA) to replace the samples with your real mission, goals, beliefs, etc. Pulse will display populated entries here once you run the interview.

TELOS is your personal "why." These files describe what you're trying to do
with your life, what's getting in the way, and how you plan to handle it.
LifeOS reads them at every session start so the DA understands the context
behind any work you ask for.

## Files

| File | What goes in it |
|------|------------------|
| `TELOS.md` | **The single source of truth.** Unified H2 sections — Current State, Ideal State, Mission, Problems, Goals, Challenges, Strategies, Projects, Narratives, Wisdom. Edit this file directly (or run `/interview`); `GenerateTelosSummary.ts` reads it. |
| `BOOKS.md` | Books that shaped you. Standalone — not part of the unified `TELOS.md` schema. Useful when the DA picks recommendations or framings. |
| `PRINCIPAL_TELOS.md` | **Auto-generated summary** of `TELOS.md`. Loaded into every session via CLAUDE.md. Do not edit manually — regenerate with `GenerateTelosSummary.ts` after editing `TELOS.md`. |

## Subdirectories

| Dir | Purpose |
|-----|---------|
| `CURRENT_STATE/` | Where you are right now across the dimensions of your life — health, finances, relationships, work, learning. The DA uses this as the starting point for any "how do I get from here to there" question. Sample scaffolds inside. |
| `IDEAL_STATE/` | Where you want to be — the vision you're aiming at across the same dimensions. Sample scaffolds inside. |
| `Backups/` | Versioned snapshots of your TELOS files. Tools that bulk-edit TELOS write a backup here before changing anything. Empty until something is backed up. |
| `Archive/2026-05-01/` | Pre-unification per-topic files (`MISSION.md`, `GOALS.md`, `PROBLEMS.md`, `STRATEGIES.md`, `CHALLENGES.md`, `NARRATIVES.md`, `BELIEFS.md`, `WISDOM.md`). `TELOS.md` superseded these on 2026-05-01 — kept only for reference. `GenerateTelosSummary.ts` will read a file here as a legacy override **only if you restore it to the top level**; leave this directory alone otherwise. |

## How to fill these in

**Easiest:** run `/interview` after install. It walks you through `TELOS.md`
section by section, asks the right questions, and writes your answers to
disk — replacing every `(sample)` entry with content that's actually yours.

**By hand:** open `TELOS.md`. The bootstrap content shows the shape — delete
the placeholders and write your real answers under each H2 section. Keep
entries short and high-signal; the DA reads this file at session start.
Regenerate the summary afterward (see below).

**From existing data:** if you already have goals/missions in Obsidian,
Notion, journal entries, or a Telos repo, run the **Migrate** skill before
`/interview` to import what you have. The interview will then fill gaps
instead of asking you to re-type things.

## Regenerate the summary

Whenever you edit a file in this directory, regenerate the summary so
session-start context stays in sync:

```bash
bun ~/.claude/LIFEOS/TOOLS/GenerateTelosSummary.ts
```

(`/interview` calls this automatically when it finishes a phase.)

## Privacy

This directory ships only as a bootstrap scaffold of samples. Anything you
write here stays on your machine and never reaches a public LifeOS release.
The release builder strips `LIFEOS/USER/**` and overlays a fresh sample
scaffold for each new installer.
