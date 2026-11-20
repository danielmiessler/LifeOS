---
name: ISA
metadata:
  short-description: "Scaffolds, restates, discusses, rates, renders, and maintains the Ideal State Artifact that says what done means and keeps it aligned."
version: 1.7.3
evals:
  manual:
    reason: "artifact quality depends on the project's intent"
    falsifier: "the principal rejects the ISA as an accurate articulation of done"
description: "Owns the Ideal State Artifact (ISA): scaffolds, restates, interviews, discusses, rates, renders, upgrades, and maintains the articulation of a project's ideal state. USE WHEN ISA, ISC, ideal state, ideal state criteria, ideal state ladder, L1 L2 L3, restate, say it back, what do you think I want, are we building the right thing, drift check, project specification, articulating done, fog, not yet specified, discuss, discovery interview, are we aligned, alignment, questionnaire, articulation, refine the ISA, open questions, ask fence, mid-run question, rate this ISA, score this ISA, ISA quality, ISA format, latest ISA template, upgrade ISAs, isa_format stamp, render an ISA, ISA HTML, open an ISA in the browser, ISA page, view an ISA. NOT FOR creating new skills (CreateSkill), visual quality critique (ArtDirection), or climbing a target to a measured improvement (HillClimb)."
---

# ISA — Ideal State Artifact

Create and maintain the document that articulates and verifies a project's ideal state. Direction comes first: nothing in an ISA matters more than making sure we are working on the right thing, in the right direction, toward what the ideal state actually looks like. Every ISA opens with the `## Ideal State` ladder (`### L3 · One sentence`, `### L2 · Summary` with one sentence plus exactly four bullets, `### L1 · Full articulation`), each level written from the summit: the euphoric-surprise version of done for everyone the work touches, never the floor of what must not break, which lives in criteria and anti-criteria (ISAFormat § *What the ladder captures: the summit*). Shape check: `bun LIFEOS/TOOLS/IsaLadder.ts check <isa>`. Drift check, whether the criteria still add up to L3: `bun LIFEOS/TOOLS/IsaLadder.ts drift <isa>`. ISAFormat (`LIFEOS/DOCUMENTATION/ISA/ISAFormat.md`, § *The Ideal State ladder* for the full rules) wins any conflict with this skill or an intent.

**Contents:** Ideal State · Intent Routing · Data & Config · Gotchas · Examples

## Ideal State

- Every ISA the skill writes or touches opens with a ladder that passes the shape check, is written from the summit, and agrees with its criteria; anything in the ISA that disagrees with the ladder is resolved before another criterion is climbed.
- L3 and L2 reach the principal through Restate before a new project or a changed direction is built (an extension whose re-derived L3 or L2 changed counts as one), and not otherwise.
- An existing ISA is extended in place, never replaced by a second ISA: the new work takes the next `F<n>` block (or new flat criteria when the ISA is flat) and the next global ISC IDs, no existing ID renumbers, the ladder is re-derived so it covers the new work, and when the re-derived L3 or L2 changed, they reach the principal through Restate before the new work is built.
- Every criterion is atomic, names its falsifier, and carries at least one `## Test Strategy` row in the canonical six-column shape, so Assay resolves the whole table with no dropped row. Each row runs on a lane, `liveness` for asserts on every monitor tick or `integrity` for checks that may judge (or `build`, full runs only), and at a stage, so a criterion's asserts run before its judged rows (ISAFormat § *Verifier classes, lanes, and stages*; the one progressive contract is `skills/Assay/References/Progressive.md`).
- Discuss is the standing alignment loop: whenever the ISA's state says direction is uncertain (`bun LIFEOS/TOOLS/IsaAlign.ts status <isa>` returns `DISCUSS`) or the conversation shows doubt about what done means, a Discuss round runs before the uncertain part is built, sized `quick`, `full` or `deep` to the doubt, and Restate, Refine, Rate and the ambiguity check hand off to it when their single-question shapes stop being enough.
- Every interviewing surface (Discuss, Interview, Questionnaire, Refine, Scaffold's ambiguity check) leaves its raw record in the ISA's append-only `## Articulation Log`, and the settled answers reach the ladder and the sections in the same turn.
- An ISA whose criteria are judged against expected cases names their folder as `golden_set: <dir relative to the ISA>` in its frontmatter and commits that declaration with the cases before the first build commit. Before it closes, `bun skills/Assay/Tools/GoldenPin.ts check <ISA.md>` is green: the cases still match the pin git history holds, the golden set at the parent of the first build commit. The frontmatter names the path, never a hash. The pin binds only once the ISA and its cases are pushed before the builder starts; until then local history can still be rewritten. An ISA without `golden_set` is out of scope.
- The ISA's history stays auditable: criterion IDs never renumber, and Decisions, Learning and Verification entries keep their canonical shapes.

## Intent Routing

Before executing an ISA operation, load its operation bundle:

```bash
bun "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/LIFEOS/TOOLS/ContextLoad.ts" ISA load <bundle>
```

The bundle returns required ISA constraints, operation instructions, and internal references with source hashes. Follow every returned requirement, including conditional reads. Skill-local paths resolve from the skill root; `LIFEOS/` paths resolve from the install root. Do not reread unchanged context still present; after compaction or a source change, reload the relevant bundle.

Set the shell and any code-mode wrapper output budget to 30000 tokens. Treat any truncation warning as a failed load, even when `END CONTEXTLOAD` appears. Use `list` to discover bundles and `search "<query>"` to search the complete guide. A failed search does not prove absence: inspect the index, broaden the query, or load `full`. If routing is uncertain, a bundle is absent, or the loader fails, load or read `References/CompleteGuide.md` in full before acting.

When the verb is ambiguous, default to Scaffold for a new ISA and CheckCompleteness for an audit.

| Intent | Trigger | File | Bundle |
|--------|---------|------|--------|
| **Scaffold** | "scaffold", "create", "generate", "new ISA from this prompt", "extend <existing ISA> with a new Feature", "extend in place" | `Intents/Scaffold.md` | `scaffold` |
| **Restate** | "restate", "say it back", "confirm the direction", "is this what I want", before building a new project or a changed direction | `Intents/Restate.md` | `restate` |
| **CheckCompleteness** | "check", "audit", "is it complete?" | `Intents/CheckCompleteness.md` | `check` |
| **Discuss** | "discuss", "discussion", "discovery interview", "figure out the shape", "talk it through", "are we aligned"; `IsaAlign.ts status` says DISCUSS; a restate answer that is more than a clean yes or a wording fix; asks that cluster; a DISCUSS-FIRST rating; a drift verdict of partial or divergent | `Intents/Discuss.md` | `discuss` |
| **Interview** | "interview me", "fill in the ISA", "deepen", "ask me questions" | `Intents/Interview.md` | `interview` |
| **Questionnaire** | "questionnaire", "questions for someone else", "async questions" | `Intents/Questionnaire.md` | `questionnaire` |
| **Refine** | "refine the ISA", "open questions", "ask me the questions", "take your defaults", mid-run doubt about what done means only the principal can settle, a breakpoint with open asks, close with open asks | `Intents/Refine.md` | `refine` |
| **Rate** | "rate this ISA", "score this ISA", "ISA quality", "how good is this ISA" | `Intents/Rate.md` | `rate` |
| **Seed** | "seed", "bootstrap from this repo", "draft an ISA from existing code" | `Intents/Seed.md` | `seed` |
| **Upgrade** | "upgrade", "check format", "is this ISA current", "latest template", "are all our ISAs updated", "label them as updated" | `Intents/Upgrade.md` | `upgrade` |
| **Append** | "append decision", "append learning" (C/R/L), "append verification", "record C/R/L entry" | `Intents/Append.md` | `append` |
| **Render** (tool-only) | "render", "HTML version", "open in browser", "ISA page" | `bun LIFEOS/TOOLS/ISARender.ts <slug-or-path> [--output <path>]` | `render` |
| Uncertain routing or complete reference | anything the rows above do not settle | `References/CompleteGuide.md` | `full` |

| File | Read when |
|------|-----------|
| `References/CompleteGuide.md` | the full contract: the twenty-one-section body, the Test Strategy vocabulary and progressive runs, anti-criteria rules, the three-guardrail taxonomy, the substance-scaled completeness gate and who enforces it, the gotchas, the example catalog, and the Algorithm relationship (the `full` bundle) |
| `References/Discussion.md` | running any interviewing surface: the ladder shown first, frontier rounds, recommended answers, the challenge question, depth (quick, full, deep with a coverage map), stop conditions, checkpointing to the Articulation Log, folding and the say-back |
| `References/ExtractionPass.md` | Scaffold runs the Extraction Pass (new-product / new-surface substantial work, or any ask naming a product or URL): source classes, the exemplar comparator contract, total disposition, milestone scope |
| `References/AmbiguityQuestions.md` | Scaffold's ambiguity check finds material ambiguity, or late information would have changed the ladder: provenance escalation, the one-message template, the `proceed` match and what it records, re-check later |
| `References/RowClassification.md` | Scaffold writes a Test Strategy row for a criterion that is not plainly deterministic: the three questions behind `eval`, `pairwise`, staged and `manual` rows |
| `References/GoalLiteralChecks.md` | CheckCompleteness audits an ISA whose frontmatter carries a `principal_stated_goal` key: the goal-signal mismatch and artifact-presence checks |
| `Examples/` | writing or judging an ISA against a worked one: `canonical-isa.md` is the one shape template; the `e1-` through `e5-` files run from minimal (`e1-minimal.md`) to the deepest (`e5-enterprise.md`) and are content references only, since most predate the current shape (CompleteGuide § Examples) |

## Data & Config

The format authority is ISAFormat and `References/CompleteGuide.md`; this skill takes no install config. `<configRoot>/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/ISA/History.md`, when present, holds the install-specific incident detail behind the dated gotchas here and in the intents; it is history, never read as config.

## Gotchas

These three bite every intent, so they live here; the rest are in `References/CompleteGuide.md` § Gotchas.

- **Test Strategy tables must carry the canonical six columns, `isc | type | check | threshold | tool | anchors_to`.** The shipped parser (`LIFEOS/TOOLS/lib/IsaTestStrategy.ts`, which `ISAGate.ts` runs) maps cells by the header row and falls back to these canonical positions (`anchors_to` at cell index 5) for any column the header does not name, so a row whose cells do not line up with its header shifts the anchor into the wrong slot; `ISAGate.ts` then hard-fails `anchors-missing` on rows that visibly show an anchor, and the message points at the anchors rather than at the column count. Drop `threshold` only by writing an empty cell, never by removing the column. (Hit live 2026-07-27 on a large ISA where every flagged row was anchored; incident detail in the USER extension `History.md`.)
- **The Articulation Log tolerates no embedded headings.** Inside a log block, no line may start with `#`: demote pasted or transcribed headings to bold or blockquote them (`> ## Original`). `CRITERIA_HEADING_RE` accepts `### Criteria` and `parseCapabilities` opens on H3 `Capabilities`, so on a criteria-less ISA (exactly what Discuss creates before Scaffold runs) an unquoted transcript heading becomes the first parser match and everything after it parses as criteria. Only the block's own `### YYYY-MM-DD HH:MM · <source>` headers are legal.
- **Browser/HTML view of an ISA goes through `bun LIFEOS/TOOLS/ISARender.ts <slug-or-path> [--output <path>]`, never a hand-rolled renderer or the generic HTML skill.** It emits the canonical technical ISA template, deterministic and offline, with per-ISC status pills, the ascent strip, and the Test Strategy table. (2026-08-31: an ISA was hand-rendered twice, first as a distilled report, then as generic markdown-to-HTML, because this tool was referenced nowhere in the skill; the principal's correction encoded here.)

## Examples

```
User: "Scaffold an ISA for the new billing dashboard"
→ Scaffold intent (bundle `scaffold`)
→ A populated ISA at its canonical path, ladder first, every criterion with a Test Strategy row, and L3 and L2 shown through Restate before the build starts
```

```
User: "Extend the Lighthouse ISA with a new Feature F7, then restate L3/L2"
→ Scaffold intent (bundle `scaffold`), extending the existing file in place
→ The same ISA with F7 added under the next global ISC IDs, nothing renumbered, the ladder re-derived, and the amended L3 and L2 restated
```

```
Restate answer: "sort of, but it is really for teams, not solo users"
→ Discuss intent (bundle `discuss`), align mode, quick depth
→ The ladder shown as it stands, one round of up to four recommended-answer questions including a challenge, the round checkpointed, L1/L2/L3 and the criteria folded, then the corrected L3 and L2 restated
```

```
User: "Is this ISA ready to close?"
→ CheckCompleteness intent (bundle `check`)
→ A structured gap report: each gap names its section, severity and reason, and `status: pass` only with zero hard gaps
```
