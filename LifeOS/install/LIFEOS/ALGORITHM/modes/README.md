---
status: RETIRED 2026-07-11 — historical doctrine. Modes/tiers were abolished with Algorithm v8 and system prompt v3.0.0 (one adaptive format). Kept as record only; nothing routes here.
last_updated: 2026-05-13
last_updated_by: kai
convention: pai-freshness-v1
canonical: true
---

# Algorithm Modes — Canonical Reference

> **This is THE doc for "what modes exist."** Pulse's tab strip is the user-facing surface. This directory holds one file per mode. `LIFEOS/PULSE/Observability/src/app/agents/page.tsx` lines 23-30 is the runtime source of truth for tab labels and ordering.

---

## The Six Pulse Tabs

These are the six pills across the top of the Pulse Agents page. Categorization is intentionally mixed — four are Algorithm modes (set in ISA frontmatter `mode:`), one is a response-mode crossover (NATIVE), and one is an external project pipeline (Ladder).

| # | Pulse tab | ISA `mode:` value | Dashboard | Category | Per-mode doc | One-line |
|---|-----------|-------------------|-----------|----------|--------------|----------|
| 1 | **Iterate** | (unset) or `iterate` | `UnifiedWorkDashboard` | Algorithm mode (default) | [`iterate.md`](iterate.md) | Standard 7-phase Algorithm — current state → ideal state via ISCs |
| 2 | **Optimize** | `optimize` | `OptimizeDashboard` | Algorithm mode | [`optimize.md`](optimize.md) | Iterative refinement against eval/metric, with regression tolerance + early-stop |
| 3 | **Ideate** | `ideate` | `NoveltyDashboard` | Algorithm mode | [`ideate.md`](ideate.md) | 9-phase evolutionary ideation (CONSUME → DREAM → … → META-LEARN) |
| 4 | **Loop** | `loop` | `LoopDashboard` | Algorithm mode (continuation) | [`loop.md`](loop.md) | Goal-driven iteration with fresh-context substrate; Goal is absorbed (no peer "goal mode") |
| 5 | **Native** | `native` | `NativeDashboard` | Response-mode crossover | [`native.md`](native.md) | NATIVE-mode work — one-line-legible ideal state, no ISA |
| 6 | **Ladder** | n/a | `LadderPage` (`/ladder`) | External project | — | Improvement pipeline from `~/Projects/Ladder` (sources → ideas → … → results) |

**Right-side tab:** **Actions** (lightning bolt) — observability event timeline, not a mode. Routes to `ObservabilityDashboard`.

---

## The Compression That Made This Clean

Three doctrinal moves collapsed earlier redundancy into the structure above:

1. **Goal is not a mode** — it's a frontmatter property (`principal_stated_goal:`) on any Algorithm run. Captured automatically when the classifier detects GOAL_SIGNAL (v6.4.0). Every Loop run has one (mandatory). Most Iterate/Optimize/Ideate runs have one when the user states an explicit goal. Surfaced in Pulse via a filter pill (planned), not a separate tab.

2. **Loop absorbed Goal** — `/loop` and Claude Code's native `/goal` were two names for the same primitive: *"iterate toward a stated end-state."* Differences were vocabulary (target vs condition) and halt shape (count cap vs predicate) — both expressions of the same axis. The unified primitive lives in [`loop.md`](loop.md).

3. **Modes are skills are doctrine** — when they describe a cognitive pattern, the three surfaces (skill file, mode value, doctrine file) are different *views* of the same thing. Skills become thin router stubs; doctrine lives in this directory; mode frontmatter is the runtime marker. One source per layer.

---

## Layer 1 vs Layer 2 — Don't Confuse Them

LifeOS has two distinct "mode" concepts. They overlap at the Native tab.

| Layer | Concept | Where set | Values |
|-------|---------|-----------|--------|
| **Layer 1 — Response Mode** | Shape of the output template | `TheRouter.hook.ts` (retired 2026-07-11) at UserPromptSubmit | MINIMAL / NATIVE / ALGORITHM |
| **Layer 2 — Algorithm Mode** | Cognitive pattern the Algorithm runs | Algorithm at OBSERVE (writes ISA frontmatter `mode:`) | iterate / optimize / ideate / loop |

**Native is the only tab that crosses both layers** — it surfaces sessions classified as Layer 1 NATIVE for Pulse display, even though no Layer 2 mode (and no ISA) was created.

---

## How a Mode Gets Set

### Algorithm modes (Iterate / Optimize / Ideate / Loop)

Set at the **OBSERVE phase** of the Algorithm via deterministic trigger detection. The Algorithm reads the user's prompt and writes `mode: <name>` into ISA frontmatter.

| Mode | Trigger phrases (case-insensitive) | Hint |
|------|-----------------------------------|------|
| `iterate` | none — default for ALGORITHM response mode | — |
| `ideate` | `ideate`, `id8`, "generate ideas for", "dream up solutions for" | parameters auto-resolve from tone keywords |
| `optimize` | `optimize [target]` | parameters auto-resolve from `cautious` / `aggressive` keywords |
| `loop` | goal-shape + horizon language (auto-detected by classifier `LOOP_HINT`), OR explicit `/loop`, OR user opts in at OBSERVE density-gate question | mandatory `principal_stated_goal:` |

### Response-mode crossover (Native)

Set by `TheRouter.hook.ts` (retired 2026-07-11) at UserPromptSubmit. When the TheRouter classifier emits `MODE: NATIVE`, session metadata captures `mode: native` for Pulse display. No full ISA created.

### External pipeline (Ladder)

Not a LifeOS mode. The `/ladder` Pulse page reads pipeline state from the Ladder project at `~/Projects/Ladder` and renders six-stage flow (sources → ideas → hypotheses → experiments → algorithms → results).

---

## Parameter Presets (Ideate & Optimize)

Both modes accept tunable parameters resolved via preset, focus value, individual overrides, or tone inference. Parameters are stored in ISA `algorithm_config:` frontmatter.

| Preset | Mode | Tone keywords |
|--------|------|---------------|
| `dream` | ideate | wild, dream, free-form, surprise me, hallucinate |
| `explore` | ideate | explore, broad, brainstorm |
| `directed` | ideate | focused, practical, actionable |
| `surgical` | ideate | precise, surgical, optimal |
| `cautious` | optimize | careful, safe, production |
| `standard-optimize` | optimize | default |
| `aggressive` | optimize | bold, aggressive, fast |

Full schema and resolution order: [`../parameter-schema.md`](../parameter-schema.md).

---

## Effort Override (orthogonal to mode)

**Triggers:** `/e[1-5]` or `E[1-5]` as standalone token (case-insensitive).

**Mapping:** E1=Standard, E2=Extended, E3=Advanced, E4=Deep, E5=Comprehensive.

E-level sets the tier; mode sets the execution pattern. Both can be set simultaneously and are independent axes. E1 additionally forces fast-path compression (OBSERVE→EXECUTE→VERIFY) within Iterate when whitelist conditions hold (see [`iterate.md`](iterate.md) § Fast-Path).

---

## Cross-references

- Pulse tab source of truth: `LIFEOS/PULSE/Observability/src/app/agents/page.tsx` lines 23-30
- Dashboard components: `LIFEOS/PULSE/Observability/src/components/activity/{UnifiedWorkDashboard,OptimizeDashboard,LoopDashboard,NativeDashboard,NoveltyDashboard}.tsx`
- Ladder page: `LIFEOS/PULSE/Observability/src/app/ladder/page.tsx`
- Loop skill: `$LIFEOS_ROOT/skills/Loop/SKILL.md`
- Ideate skill (router stub): `$LIFEOS_ROOT/skills/Ideate/SKILL.md`
- Parameter schema: `../parameter-schema.md`
- Capabilities: the system-prompt skill list is the sole inventory (capabilities.md removed at v7.0.0)
- Target types: `../target-types.md`
- Eval-mode guide: `../eval-guide.md`
- Algorithm system doc: `LIFEOS/DOCUMENTATION/Algorithm/AlgorithmSystem.md`
- Current Algorithm doctrine: `../v6.5.0.md` (or follow `../LATEST`)
- Changelog: `../changelog.md`

---

## Metadata Surfacing per Mode

Each mode populates a known set of optional ISA frontmatter fields that Pulse surfaces as badges, strips, and panels. The canonical catalog is at [`../../DOCUMENTATION/Pulse/PulseMetadata.md`](../../DOCUMENTATION/Pulse/PulseMetadata.md); the per-mode summary:

| Field | iterate | optimize | ideate | loop | native |
|-------|---------|----------|--------|------|--------|
| `response_mode` (v2.10) | algorithm | algorithm | algorithm | algorithm | native |
| `algorithm_mode` (v2.10) | iterate | optimize | ideate | loop | n/a |
| `current_state` / `ideal_state` (v2.10) | recommended | recommended | optional | **mandatory** | n/a (no ISA) |
| `principal_stated_goal:` (v6.4.0) | when detected | when detected | when detected | **mandatory** | n/a |
| `algorithm_config.preset` | n/a | required | required | optional | n/a |
| `algorithm_config.params` | n/a | required | required | optional | n/a |
| `eval_mode` (`metric` / `eval`) | n/a | required | n/a | optional | n/a |
| `density_score` (v6.5.0) | E3+ | E3+ | E3+ | E3+ | n/a |
| `interview_invoked` (v6.5.0) | E3+ | E3+ | E3+ | E3+ | n/a |
| `capabilities_invoked` (v2.10) | populated | populated | populated | populated | n/a |
| `iteration` | optional (rework) | per experiment | per cycle | **per Loop iteration** | n/a |
| `loop_config` | n/a | n/a | n/a | **required** | n/a |
| `loop_state` (running/halted/completed) | n/a | n/a | n/a | **required** | n/a |

The "current → ideal state" framing is especially load-bearing for Loop mode (the journey is multi-iteration) and naturally fits iterate / optimize / ideate runs that have a non-trivial scope.

---

## History

- Pre-2026-05-13: mode-detection.md was the sole reference; ideate-loop.md and optimize-loop.md held per-mode doctrine. Three scattered files with overlapping content.
- 2026-05-13 (this reorg): reorganized into this `modes/` directory with one file per mode. mode-detection.md, ideate-loop.md, optimize-loop.md retained as thin redirect pointers for backwards-compat. Loop mode added with absorbed Goal semantics. See [`loop.md`](loop.md) for the absorbed-Goal doctrine; runtime LoopRunner.ts ships in next ISA.
- 2026-05-13 (later same day): IsaFormat.md v2.10 adds `response_mode`, `algorithm_mode`, `current_state`, `ideal_state`, `capabilities_invoked` optional frontmatter fields. Pulse metadata catalog created at [`../../DOCUMENTATION/Pulse/PulseMetadata.md`](../../DOCUMENTATION/Pulse/PulseMetadata.md). Badge/strip React components are next-ISA build paired with the v6.6.0 doctrine bump and LoopRunner.ts ship.
