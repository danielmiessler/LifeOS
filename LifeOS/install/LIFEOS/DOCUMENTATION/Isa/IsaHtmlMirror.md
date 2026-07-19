---
last_updated: 2026-05-13T22:35:00Z
last_updated_by: kai
convention: pai-freshness-v1
version: 1.0.15
---

# ISA HTML Mirror

The ISA is the canonical articulation of "done" for any Algorithm run. It lives as `ISA.md` markdown in a working directory the principal does not normally look at. The **HTML Mirror** is a deterministic, zero-token, branded sibling — `ISA.html` next to every `ISA.md` — produced by a fast CLI on completion events and refreshed in-place by Interceptor.

## Canonical Theme — UL Technical v1.0.0 (2026-05-13)

**The UL Technical theme is the official HTML format for every ISA in the system going forward.** Tokyo-Night-Storm-derived dark navy ground (`--ul-bg-base: #0d1325`), JetBrains Mono throughout, lavender-white type, calm cyan/violet accents, status-pill ISC rows that read "OPEN / DONE / WIP / ANTI / ANTE" at a glance. Lives at `{{LIFEOS_DIR}}/TOOLS/ISARender/template.css`.

**Lineage.** The theme was specified by the Pulse-side parent design at `MEMORY/WORK/20260513-pulse-ul-theme-2-hackery-dark-blue/ISA.md` (token palette, naming convention, dimension preservation rules) and applied to the ISA mirror surface by `MEMORY/WORK/20260513-isa-html-mirror-redesign-dark-hackery/ISA.md` plus the status-clarity refinement at `MEMORY/WORK/20260513-isa-template-status-clarity-canonize-backfill/ISA.md`.

**Replaces.** The prior `UL Engineering Register v2.1.0` (sepia/parchment, EB Garamond) shipped 2026-05-12 and was deprecated 2026-05-13. Every existing `MEMORY/WORK/*/ISA.html` has been backfilled to the new theme; no UL Engineering Register renders remain on disk.

**Status visual contract.** Every ISC row leads with a status pill:

| Status × Kind | Pill | Color | Meaning |
|---|---|---|---|
| pending normal | `○ OPEN` | muted gray on dark | Default — work not yet done |
| passed normal | `✓ DONE` | solid green, navy text, glow | Verified complete |
| deferred normal | `◐ WIP` | amber on amber | Marked complete pending follow-up |
| pending anti | `✕ ANTI` | danger red on red | Anti-criterion not yet verified |
| passed anti | `✓ DONE` | solid green | Anti-criterion verified — bad thing did NOT happen |
| pending antecedent | `◆ ANTE` | purple on purple | Precondition not yet established |
| passed antecedent | `✓ DONE` | solid green | Precondition established |
| any tombstone | `✕ DROP` | muted | Criterion was withdrawn |

The kind classes (`anti`, `antecedent`, `tombstone`) also drive the row's left border and ID-chip color independently of status — kind is structural and persists through the status lifecycle.

## Why

Without a mirror, reading the ISA structure (phases, ISCs, anti-criteria, decisions, antecedents, verification) requires opening raw markdown in an editor. Prior tooling (`PreviewMarkdown.ts`) opens a new tab on every invocation, lacks LifeOS branding, loads `marked.js` from a CDN, and ignores ISA-specific semantics like ISC status tinting or phase progression.

The Mirror reuses the McKinsey-styled branded template family already proven in `_ULHORMOZI/_CONSULTINGTEMPLATES/`. ISAs structurally are "spec documents with verification rows" — they belong in that family.

## The trigger doctrine

Three trigger primitives. None of them fire during in-flight authoring. The user-stated constraint is operative:

> "I think it has to be when the ISA is actually completed, because there's going to be lots of phase changes as it's being written. We don't want to be constantly remaking the HTML file."

| Trigger | Hook | Fires When |
|---|---|---|
| **Initial completion** | `ISASync.hook.ts` (PostToolUse Edit/Write) | Frontmatter `phase:` transitions to the literal string `complete`. The render produces the sibling `ISA.html` for the first time. |
| **Post-completion update batch** | `ISARenderOnStop.hook.ts` (Stop event) | The assistant's turn ends, and at least one ISA was edited during the turn, AND that ISA has **reached completion at least once**. The fast signal is an existing `<dir-of-ISA.md>/ISA.html`; the cold-path signal (html missing) reads the frontmatter directly — `phase: complete`, `iteration > 1`, or a `resumed_from_phase` marker. Pre-completion edits on a brand-new iteration-1 ISA never fire. |
| **Manual** | direct CLI / `/render-isa` slash command | The operator invokes `bun "${LIFEOS_DIR}/TOOLS/ISARender.ts" <slug-or-path>` from any shell. Bypasses the completion gate. Always works. |

The completion gate is the doctrinal centerpiece — "has this ISA ever been completed?", with `ISA.html` existence as the fast proxy and the frontmatter as the cold-path backstop. It means:
- During the FIRST authoring pass (iteration 1, never completed), the ISA churns; no render fires.
- The first time `phase: complete` lands, `ISA.html` is born.
- From that point forward, end-of-turn edit batches refresh the mirror — including across a `resume`-into-new-iteration, where the html-exists proxy alone used to miss (a pre-convention or never-rendered ISA resumed into iteration 2 now renders off its `iteration`/`resumed_from_phase` frontmatter).
- The Stop hook never opens a new render in the pre-completion window of a first-iteration ISA — by design.

## The engine

`{{LIFEOS_DIR}}/TOOLS/ISARender.ts` — single Bun script, ~470 LOC, hand-rolled ISA-aware markdown parser. No external dependencies; no `marked`, no Handlebars, no Bun install side effects.

| Surface | Behavior |
|---|---|
| Invocation | `bun "${LIFEOS_DIR}/TOOLS/ISARender.ts" <slug-or-path>` |
| Slug resolution | path → resolved directly; slug → looked up via `MEMORY/STATE/work.json`, or by scanning `MEMORY/WORK/` for a matching directory name |
| Output | `<dir-of-ISA.md>/ISA.html`, atomically written via `tmp + rename` |
| Cold render | ~25ms wall-clock on a typical E4 ISA |
| Warm render | ~20ms — short-circuits via mtime-equality between `ISA.html` and `ISA.md` |
| Token cost | zero. No LLM subprocess in the call graph. |
| CLI flags | `--no-refresh`, `--output <path>`, `--stdout` |

## The template

| File | Purpose |
|---|---|
| `LIFEOS/TOOLS/ISARender/template.html` | Single HTML scaffold with named placeholders (`{{TITLE}}`, `{{CSS}}`, `{{HERO_CALLOUT}}`, `{{PHASE_BAR}}`, `{{SECTIONS}}`, etc.). Interpolation via plain `String.replaceAll`. |
| `LIFEOS/TOOLS/ISARender/template.css` | Branded stylesheet inlined into the rendered HTML. Extracted from `_ULHORMOZI/_CONSULTINGTEMPLATES/test-mckinsey-refined-v2.html` with cover-page and network-visual selectors stripped, ISA-specific selectors added. |

ISA-specific selectors:

- `.hero-callout` — quoted-literal hero block pulling `principal_stated_goal` byte-for-byte.
- `.phase-bar` / `.phase-slot` — seven-slot horizontal progression bar (OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN, COMPLETE). Active slot styled distinctly; passed slots dimmed.
- `.isc.pending` / `.isc.passed` / `.isc.deferred` / `.isc.anti` / `.isc.antecedent` / `.isc.tombstone` — status-tinted ISC rows. Each gets a glyph, left border color, and background tint mapped to the criterion's semantic role.
- `.section.section-<slug>` — per-section left-border accent (problem=red, vision=violet, criteria=green, etc.) and matching `h2` color.
- `table.data` — branded table styling for Test Strategy, Features, Decisions rows.
- `.warning-callout` — yellow ribbon at the top when resilient parsing surfaces issues (missing frontmatter, malformed tables).

The CSS includes `@media print` for paper output and `@media (prefers-color-scheme: dark)` for dark-mode browsers.

## Interceptor refresh

After a successful render, the engine looks for any Chrome tab whose URL matches `file://<isa-dir>/ISA.html` via `interceptor tabs --json`. For each matching tab, it sends a reload keystroke (`Meta+r` on macOS, `Control+r` elsewhere) — switching to the tab first when the match is not the active tab.

Key behavior:
- **Never opens a new tab.** If no matching tab exists, the refresh is a no-op.
- **Multiple matches → all refreshed.**
- **Failure is non-fatal.** If the Interceptor bridge is unresponsive or the extension service worker is asleep, the render itself still succeeds; the refresh emits a JSON `refresh_warning` and the operator can reload manually.
- **Per-command timeout is 1.5s.** Fast-fail when the bridge is degraded; the operator does not wait on browser glue.

## Anti-criteria (asserted in tests)

| Anti-criterion | Why |
|---|---|
| Never modifies source `ISA.md` | One-way relationship; the mirror is derived |
| Never writes outside the ISA's own directory | Avoids surprise side effects |
| Zero LLM/API calls per render | Deterministic, zero-token by construction |
| Never opens a new browser tab | Tabs are precious — refresh-in-place only |
| No CDN / no `<script src=https>` / no `<link rel=stylesheet>` | Offline-first, instant first paint |
| Stop hook never fires render before first completion | The pre-completion gate prevents in-flight flicker |
| Stop hook never fires render when no ISA was edited | Zero false-positive renders |
| Hook failures never block the Stop event | Hook isolation discipline |

## File layout

```
{{LIFEOS_ROOT}}/
├── LIFEOS/TOOLS/
│   ├── ISARender.ts                          # CLI entry point
│   └── ISARender/
│       ├── template.html                     # branded scaffold with placeholders
│       └── template.css                      # inlined CSS (McKinsey-derived + ISA selectors)
├── hooks/
│   ├── ISASync.hook.ts                       # extended: detects phase: complete, fires render
│   └── ISARenderOnStop.hook.ts               # new: end-of-turn batched render
├── LIFEOS/MEMORY/STATE/
│   └── isa-render-debounce/<session>.json    # per-session edit tracking
└── LIFEOS/MEMORY/WORK/{slug}/
    ├── ISA.md                                # the source
    └── ISA.html                              # the sister mirror (created on phase: complete)
```

## Operator customization (forward-compatible)

A future expansion allows per-ISA CSS overrides: drop a `<dir-of-ISA.md>/ISA.html.css` file and the engine will layer it on top of the base template. Not implemented in v1 but the template hook is reserved.

## Failure modes

- **Missing frontmatter.** The render emits a yellow warning callout at the top listing missing required fields (`task`, `slug`, `effort`, `phase`) and otherwise proceeds with whatever can be parsed.
- **Malformed tables.** The render emits a parse warning and falls back to monospace code blocks for affected tables.
- **Stub ISAs (<500 bytes).** The render produces a minimal "ISA in scaffold state" page with whatever frontmatter is present.
- **Interceptor unresponsive.** The render writes `ISA.html` successfully and emits `refresh_warning` in the JSON. Operator reloads manually.
- **Stop hook race with phase-change render.** Both triggers compete cleanly: the warm-skip path in ISARender.ts means whichever runs second is a fast no-op.

## Related doctrine

- `LIFEOS/DOCUMENTATION/Isa/IsaSystem.md` — twelve-section body, five identities, three-guardrail taxonomy
- `LIFEOS/DOCUMENTATION/Isa/IsaFormat.md` — file-shape contract (frontmatter spec, locked section order)
- `LIFEOS/ALGORITHM/v8.4.0.md` — the algorithm that produces ISAs, phase progression source
- `LIFEOS/MEMORY/WORK/20260512-isa-html-mirror-system/ISA.md` — the ISA that designed this system
