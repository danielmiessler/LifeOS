---
last_updated: 2026-07-14T22:45:00Z
last_updated_by: da
convention: lifeos-freshness-v1
version: 1.1.33
---

# Pulse Metadata Surface — Badges, Strips, Panels

> **The catalog of everything Pulse surfaces about a session, ISA, or Algorithm run.** Every badge, strip, and panel maps to specific frontmatter or session metadata. This doc tells you (1) what visual elements exist, (2) what data each consumes, (3) where the data is set, (4) implementation status.

> **Source of truth for visual layout:** `LIFEOS/PULSE/Observability/src/app/agents/page.tsx` (tab strip) and per-dashboard components in `LIFEOS/PULSE/Observability/src/components/activity/`.

---

## Core Principle — Surface the Journey

Every LifeOS primitive is **current state → ideal state, articulated as ISCs, pursued through verifiable iteration**. This is the Life OS loop (`LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`) rendered at session scale. The Pulse metadata surface exists to make that journey legible at every level:

- **Where are we?** (current state, current phase, progress)
- **Where are we going?** (ideal state, goal anchor, ISCs)
- **How did we get here?** (mode chosen, capabilities invoked, iterations completed)
- **What confidence do we have?** (cross-vendor audit verdict, divergence risk, density score)

The components below surface those four questions across the Pulse UI.

---

## Badge Catalog

Compact pills/chips that fit in session rows and headers. One badge = one piece of metadata.

| Badge | Data source (ISA frontmatter) | Component | Status |
|-------|------------------------------|-----------|--------|
| **EffortBadge** | `effort:` | — | REMOVED 2026-07-14 (effort tiers retired 2026-07-11) |
| **ModeBadge** | `mode:` | — | REMOVED 2026-07-14 (modes retired 2026-07-11) |
| **PresetBadge** | `algorithm_config.preset` | — | REMOVED 2026-07-14 (presets retired with modes) |
| **ResponseModeBadge** / **AlgorithmModeBadge** | `response_mode:` / `algorithm_mode:` | — | CANCELLED (mode system retired 2026-07-11, before build) |
| **Lifecycle pill** | derived (`src/lib/lifecycle.ts`: scoping/climbing/learning/done/session/idle) | `WorkBoard.tsx` | shipped 2026-07-14 |
| **Rework badge (×N)** | `iteration:` | `WorkBoard.tsx` | shipped 2026-07-14 |
| **GoalBadge** | presence of `principal_stated_goal:` (v6.4.0) | NOT YET BUILT | backlog |
| **DensityBadge** | `density_score:` + `divergence_risk:` (v6.5.0) | NOT YET BUILT | backlog |
| **CrossVendorAuditBadge** | Cross-vendor audit verdict (pass/concerns/fail) recorded in `## Verification` | NOT YET BUILT | planned next-ISA |
| **Unspanned Feature pill** | monitor snapshot `apps[].unspannedFeatures` (Feature has only glance leaves and no spanning criterion) | `app/bunker/page.tsx` bay card | shipped 2026-09-22 |

### Badge color conventions

Colors map to LifeOS dimensions (`var(--health)`, `var(--money)`, etc.) per the `--health`, `--money` and sibling dimension tokens in `LIFEOS/PULSE/Observability/src/app/globals.css` (the `dimColors` map in `src/app/assistant/page.tsx` is the reference use). Each tab's badges adopt that tab's color tint. Cross-tab badges (Effort, Density) use neutral colors with dimension-tinted backgrounds.

---

## Strip Catalog

Horizontal full-width visualizations that span the session card or dashboard row.

| Strip | Data source | Component | Status |
|-------|-------------|-----------|--------|
| **QuickPulseStrip** | live ratings (24h window; mood verdict muted below 3 ratings) | `QuickPulseStrip.tsx` | shipped |
| **ClimbChart** | `work-events.jsonl` progress/criteria transitions per slug (mini sparkline + full ascent) | `ClimbChart.tsx` | shipped 2026-07-14 |
| **PhaseProgressStrip** | `phase:` stations | — | CANCELLED (declared phases retired; the Climb replaces it) |
| **JourneyStrip** | `current_state:` → ISC progress → `ideal_state:` | NOT YET BUILT | backlog |
| **CapabilitiesStrip** | `capabilities_invoked:` array | NOT YET BUILT | backlog |
| **IterationHistoryStrip** | `## Iteration History` section | NOT YET BUILT | backlog |
| **IntensityBar** | tool-call rate over time | `IntensityBar.tsx` | shipped (Activity tab) |
| **FocusIndicator** | phase + ISA presence | — | REMOVED 2026-07-14 (dead code, zero importers) |
| **Bunker tier strip** | monitor snapshot `apps[].tiers` + `tierMovement` | `app/bunker/page.tsx` bay card | shipped 2026-09-22 |

### JourneyStrip — the headline new visualization

The Journey Strip is the visual embodiment of LifeOS's core "current → ideal state" primitive. Layout sketch:

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT STATE                                       IDEAL STATE │
│  "47 type errors blocking deploy"      "Zero errors, CI passing" │
│                                                                   │
│  ● ━━━ ● ━━━ ● ━━━ ○ ━━━ ○ ━━━ ○ ━━━ ○ ━━━ ○ ━━━ ○ ━━━ ○        │
│  ISC-1   ISC-2   ISC-3   ISC-4   ...           ...   ISC-11      │
│         (passed)                                                  │
│                                                                   │
│  3 of 11 ISCs verified  ·  phase: execute  ·  iter 1             │
└─────────────────────────────────────────────────────────────────┘
```

- Left endpoint: `current_state:` one-liner from frontmatter
- Right endpoint: `ideal_state:` one-liner (aligned with `principal_stated_goal:` when set)
- Dots: ISCs in order, filled when passed, hollow when open
- Bottom row: progress count, current phase, iteration (Loop only)

Fallback when `current_state` / `ideal_state` absent: render just the ISC dot progression with the task description as endpoint labels.

---

## Panel Catalog

Multi-line expandable detail views shown on session click.

| Panel | Data source | Component | Status |
|-------|-------------|-----------|--------|
| **PhaseDetailPanel** | full phase history with timing | — | REMOVED 2026-07-14 (phase ceremony retired; expanded WorkBoard rows show criteria + evidence + Climb instead) |
| **GoalPanel** | `principal_stated_goal:` + signal type + locked timestamp | NOT YET BUILT | planned next-ISA |
| **DecisionsPanel** | `## Decisions` section | NOT YET BUILT | planned next-ISA |
| **ChangelogPanel** | `## Changelog` section (Deutsch format entries) | NOT YET BUILT | planned next-ISA |
| **VerificationPanel** | `## Verification` section + cross-vendor audit results | NOT YET BUILT | planned next-ISA |

---

## Tab-Level Surfaces (agents page — 2026-07-14 redesign)

The per-mode tabs died with the mode system. Two surfaces remain:

| Tab | Dashboard component | Surfaces |
|-----|---------------------|----------|
| **Work** | `WorkBoard` | tracked runs as Climbs (criteria closed over time from `work-events.jsonl`), untracked live sessions, resumable, done-last-24h; derived lifecycle pills |
| **Activity** | `ObservabilityDashboard` | live hook/tool/agent event stream, pulse chart, swim lanes |

---

## Cross-cutting Metadata Sources

| Source | Where it lives | What it provides |
|--------|----------------|------------------|
| **ISA frontmatter** | `LIFEOS/MEMORY/WORK/{slug}/ISA.md` or `<project>/ISA.md` | core fields (task, effort, phase, mode, progress, started, updated) + v6.4.0 goal fields + v6.5.0 density fields + v2.10 response/journey fields |
| **session metadata** | `MEMORY/STATE/work.json` | session registry, used for NATIVE sessions without ISAs |
| **ISA body sections** | same ISA file, body | `## Decisions`, `## Changelog`, `## Verification`, `## Iteration History` (Loop only) |
| **TheRouter additionalContext** _(RETIRED 2026-07-11)_ | `TheRouter.hook.ts` (deleted) | Historical: response mode, tier, goal signal, density gate eligibility — set per-prompt. Mode/tier classification was abolished 2026-07-11; no successor emits this. |
| **work-events.jsonl** | `hooks/lib/work-events.ts` (event-sourced diffs) | per-slug progress/criteria transitions with timestamps — drives ClimbChart |

---

## Implementation Status — What Ships When

| Wave | Items | Trigger |
|------|-------|---------|
| **Already shipped** | Lifecycle pill, Rework badge, ClimbChart, QuickPulseStrip, IntensityBar, two-tab Work/Activity UI (2026-07-14 redesign; mode/effort/preset badges and phase panels removed) | current Pulse |
| **Next ISA (paired with v6.6.0 doctrine bump)** | GoalBadge, DensityBadge, JourneyStrip, CapabilitiesStrip, GoalPanel, DecisionsPanel, ChangelogPanel, VerificationPanel | requires v2.10 frontmatter fields population by ISA skill + ISASync hook |
| **Paired with LoopRunner.ts ship** | IterationBadge, IterationHistoryStrip, IterationHistoryPanel | requires LoopRunner.ts populating `## Iteration History` section |
| **Lower priority** | CatoBadge (verdict surfacing), Goal filter pill on Agents page | small additions |

---

## Cross-references

- ISA Format Spec: `LIFEOS/DOCUMENTATION/ISA/ISAFormat.md`
- Algorithm Modes: `LIFEOS/ALGORITHM/archive/modes/README.md`
- Pulse System overview: `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md`
- DA subsystem (design): `LIFEOS/DOCUMENTATION/Pulse/DaSubsystem.md`
- Terminal tabs (kitty integration): `LIFEOS/DOCUMENTATION/Pulse/TerminalTabs.md`
- Current Algorithm doctrine: `LIFEOS/ALGORITHM/v8.46.0.md`
