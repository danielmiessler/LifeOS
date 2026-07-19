---
last_updated: 2026-07-08T00:00:00Z
last_updated_by: kai
convention: pai-freshness-v1
version: 1.0.0
status: named-and-documented
---

# Amber — the LifeOS Idea Capture & Preservation System

> **Amber is how LifeOS catches a high-quality idea the moment it crosses the principal's attention, preserves it forever, grades it against what they are actually trying to do (TELOS), routes it to the right home, and lets them find it again.** Capture → **preserve (at capture, unconditionally)** → grade → route → resurface. It is the idea supply chain that feeds the newsletter, the blog, the Knowledge Archive, and the project queue.

**Why "Amber."** An insect caught in amber is preserved perfectly, permanently, exactly as it was the moment it was caught. That is the whole point of this system and the exact failure it fixes. Today ideas get caught but not kept — they land in a throwaway spreadsheet, feed one newsletter edition, and evaporate. Amber is the layer that makes capture permanent: every idea worth catching becomes a browsable, searchable, forever record.

> **Instance wiring lives elsewhere.** This is the release-safe SYSTEM description of the *feature*. The concrete instance map — exact hostnames, worker URLs, the newsletter sheet, the work repo, project paths — lives in the USER-zone ISA at `LIFEOS/MEMORY/WORK/20260708-amber-idea-capture-system/ISA.md`, per the System/User boundary (`LIFEOS/DOCUMENTATION/SystemUserBoundary.md`).

> **Status (2026-07):** capture and grading are **live** across the inputs below. **Phases 1 and 2 are built and deployed** — the append-only ledger (`amber` D1) + the Capture-Contract worker (`arbol-a-amber-ledger`, write-ahead + idempotent) + the `amber` CLI (Phase 1), and `amber route` auto-grading + routing to KNOWLEDGE notes / UL issues (Phase 2), all live-verified. The Pulse surface (Phase 4) and the remaining inputs (Phase 3) are **designed here and roadmapped — not yet built.** The lead above describes what Amber *is by design*; the roadmap says what's shipped vs. pending.

---

## Why Amber Exists

The principal has been hand-running an idea-capture pipeline for months. It works. The problem was never that it didn't work — it's that it had no name, so it was never treated as one thing, so nobody ever escalated it, so four gaps quietly persisted:

1. **Inputs grew ad hoc.** A browser capture hotkey here, a bookmark cron there, a voice marker on the wearable. No catalog. No shared shape. Adding a new input meant reinventing the wiring each time.
2. **History evaporates.** The summarize endpoint appends every capture to a spreadsheet. The principal builds the newsletter from that sheet, then it's stale. The idea itself — the actual valuable thing — is gone. There is no permanent, browsable store of everything ever caught. (The upstream reader is worse: it deletes its own items after five days.)
3. **Routing is manual.** When an idea comes in, the "where does this go?" decision — Knowledge note? blog seed? a work-queue issue? a potential project? — is made by hand, per item, or not at all. This exact gap is flagged `missing` in the current-state inventory: *"Harvested ideas don't auto-route to KNOWLEDGE notes, blog drafts, or work-system tasks."*
4. **It wasn't first-class.** No skill. No Pulse surface. No doc. No current→ideal tracking. The single most valuable capture system in LifeOS was invisible to LifeOS.

Amber is the fix for all four: name it, catalog it, give it a permanent memory, automate the routing, and put it on the dashboard.

This is a real Human-3.0 lever. The whole thesis is that value comes from creation, and creation runs on a steady supply of good raw ideas. Amber is the machine that never lets a good one get away.

---

## The One Loop

Every part of Amber is a stage in a single loop. **The order is load-bearing: preservation happens at capture, not at the end.** The failure being fixed is idea loss *before* routing — a rejected grade or a mishandled route today means the idea is gone. So the raw idea is written to an append-only ledger the instant it's caught, unconditionally, before any grader can reject it or any router can drop it. That's write-ahead-log semantics: nothing entering Amber is ever lost, even if everything downstream fails.

```
             ┌───────────────────── RESURFACE ─────────────────────┐
             │          /amber search · Pulse tab · promote         │
             ▼                                                      │
  CAPTURE ─→ PRESERVE ─────→ GRADE ────→ ROUTE ──┬─→ KNOWLEDGE idea-note (promoted)
  (inputs)   raw ledger      score vs    where   ├─→ work issue Type:queue / Type:project
             D1: append-     TELOS       to?     ├─→ Newsletter (sheet → platform)
             only, dedup,                        ├─→ Blog seed
             never deleted                       └─→ Feed source registry

  inputs: summarize hotkey · bookmarks · voice markers · feed · reader extract · manual · gesture*
```

- **Capture** grabs the raw thing (a URL, a bookmark, a spoken thought, a feed item) with the least possible friction.
- **Preserve** writes it to the append-only ledger *immediately and unconditionally* — the "caught in amber, forever" guarantee, and the whole reason the system has a name. Everything downstream operates on a record that already exists.
- **Grade** summarizes and scores it — is this actually good, and good *for what the principal is doing* (TELOS)? In some components (`_A_HARVEST_CLASSIFY`) grade and route are **fused** into one call — the four/five-stage split is the conceptual model, not always a separate component, so don't go hunting for a standalone router that doesn't exist.
- **Route** answers the manual question that's been costing the most: where does this belong? It fans the idea to the destinations it earns.
- **Resurface** is the other half of preservation: an idea stuck in amber and never dug back out is a write-only archive — the name cuts both ways. Recall is part of the contract, not an accessory: `/amber search`, the Pulse surface, and promotion of the best ledger rows into curated KNOWLEDGE notes.

---

## Inputs (the capture surfaces)

Everything that can drop an idea into Amber. Each is real unless marked `roadmap`. Component names are LifeOS-internal; exact hosts/URLs are in the ISA.

| # | Input | Trigger | LifeOS component | Status |
|---|-------|---------|------------------|--------|
| 1 | **Summarize hotkey** | browser hotkey on any page | Arbol `arbol-a-summarize` (`LIFEOS/USER/CUSTOMIZATIONS/ARBOL/summarize/`) | live |
| 2 | **Bookmarks → idea-issues** | bookmark sweep (`tb`) | `skills/_X/Tools/bookmark-issue.ts` → `Type:queue` work issues | live |
| 3 | **Bookmarks → summarize (cloud)** | hourly cron | `ARBOL/Workers/_F_X_BOOKMARKS_SUMMARIZE` → summarize binding → sheet | live |
| 4 | **Harvest → Knowledge** | `/ha` on a URL/video/text | `skills/_HARVEST` → `_F_HARVEST` → `_A_HARVEST_CLASSIFY` → `HarvestExecutor.ts` | live |
| 5 | **Voice markers** | speaking "begin idea … end idea" on the wearable | `skills/_LIFELOG` → blogging | live (extract loop manual) |
| 6 | **Feed pipeline** | RSS/YouTube/social source polling | the Feed project (`feed-api`→poller→processor→Arbol label/rate→dispatcher) | live (rules engine designed) |
| 7 | **Reader extraction** | the reader curates + extracts `main_idea`/`supporting_ideas` | the reader app; read via `_SURFACE` skill `ideas` command | live (extraction sparse ~1/500) |
| 8 | **Report-only mine** | `/ha` for LifeOS-system usefulness | `skills/Harvest` (evaluates, writes nothing) | live (feeds decisions, not the store) |
| 9 | Reader upvote → capture | thumbs-up on a reader item | — | **roadmap** |
| 10 | Gesture / wearable ad-hoc trigger | a physical trigger from anywhere | — | **roadmap** |
| 11 | Email → capture (via assistant) | forward an email to a capture address | partial | **roadmap** |

The "more inputs" the principal wants are rows 9–11 plus anything new — and the point of naming Amber is that adding input #12 now means "wire it to the Amber capture contract," not "invent a new pipeline."

---

## The Capture Contract (what "more inputs" plugs into)

This is the piece that makes "a lot more inputs" cheap instead of costly, and it's the thing that was missing. Today each input reinvents its own wiring, which is why adding one is real work. Amber's fix is a single contract every input conforms to — so adding an input becomes writing a small adapter, not building a new pipeline.

**Every capture, from any input, is one record:**

| Field | Required | Meaning |
|-------|----------|---------|
| `source` | yes | which input produced it (`summarize-hotkey`, `x-bookmark`, `lifelog`, `feed`, …) |
| `external_id` | yes | the input's own id for the item (tweet id, feed item id, url hash) — half the dedup key |
| `url` | url **or** content | normalized source URL |
| `content` | url **or** content | raw text/transcript when there's no URL (voice markers, pasted notes) |
| `captured_at` | yes | when it entered Amber (not when it was published) |
| `content_kind` | yes | `article` \| `video` \| `tweet` \| `paper` \| `note` \| `tool` \| … |
| `title` / `author` | no | when the input knows them |
| `privacy_class` | yes | `public` \| `personal` — gates the local→cloud flow |

**Contract behavior (non-negotiable):**

- **Write-ahead.** The record hits the append-only ledger *first*, unconditionally, before grading. Nothing is lost if grading or routing fails.
- **Idempotent.** Dedup identity = normalized `url` + content hash (falling back to `source`+`external_id`). The same item arriving via three inputs is one ledger row; a retry never duplicates.
- **Async downstream.** Grade and route run after the write, off the capture path, so capture is always fast and never blocks on a model call.
- **Privacy-gated.** A `personal` record never crosses to cloud storage without an explicit rule — the local→cloud analog of the `{{LIFEOS_ROOT}}`→public boundary.

**Adding an input = implement this contract.** A new source — a Slack star, an email forward, a Kindle highlight — writes one adapter that emits this record shape and hands it to Amber. It inherits preservation, dedup, grading, routing, and resurfacing for free. That is the entire payoff of naming the system: the contract is the thing "more inputs" plug into.

---

## Grade (scoring the signal)

Four graders exist today. They all do the same job — turn raw content into a summary + a score — with different models and rubrics. Amber's job is to make them speak a common grade shape, not to replace them.

| Grader | What it scores | Model | Home |
|--------|----------------|-------|------|
| **summarize scorer** | category (PAPER/ESSAY/ARTICLE/…) + `SCORE:` + extracted URLs | `gpt-5.4-mini` | `ARBOL/summarize/src/prompt.ts` |
| **TELOS classifier** | 10-way classification + confidence, grounded in MISSION/GOALS/PROBLEMS/STRATEGIES | `claude-haiku-4-5` | `ARBOL/Workers/_A_HARVEST_CLASSIFY/` |
| **reader label+rate** | quality tier + `main_idea`/`supporting_ideas` | label_and_rate | the reader / Arbol `_A_SURFACE` |
| **Feed label+rate** | `quality_score` 1–100 + labels | `_A_LABEL_AND_RATE` / `_A_QUALITY_FILTER` | the Feed project + Arbol |

The TELOS classifier is the important one for routing — it's the only grader that asks *"good for what the principal is trying to do,"* not just *"good."*

---

## Route (the "where does this go?" decision)

This is the manual step Amber is built to automate. The machinery already exists — `_A_HARVEST_CLASSIFY` grades every harvested item into exactly one of ten routes, each carrying `routed_actions`:

```
knowledge | learning | help_understand | project_integration | tech_upgrade |
telos_modification | work_item | reminder | blog_seed | none
```

Example routed actions it already emits: `create_knowledge_idea_entry`, `open_github_issue:project=…,priority=P2`. What's missing is that this routing runs for the Harvest path only — the hotkey and bookmark-summarize paths still dead-end in the spreadsheet. Amber's Phase-2 job is to run every input through this same routing brain.

**Routing rules (Phase 2 spec).** An idea opens a `Type:queue` work issue when its score clears a threshold (tunable; start ~`SCORE ≥ 7/10` or classifier confidence ≥ 0.7) *and* the classification is action-shaped (`work_item`, `project_integration`, `blog_seed`). It opens `Type:project` instead when the route is `project_integration` or the item is tagged multi-day/multi-week. Issues dedup on the idea identity (normalized URL + content hash) so one idea never spawns duplicate issues, and every `routed_action` is logged to the ledger for audit. Below threshold, an idea still lives forever in the ledger — it just hasn't earned a destination yet.

---

## Destinations

Where a graded, routed idea lands. An idea can hit several.

| Destination | What it's for | Home |
|-------------|---------------|------|
| **KNOWLEDGE `idea` note** | **the curated history layer** — the best ideas, *promoted from the ledger*, browsable & searchable, aging `inbox → seedling → budding → evergreen` | `MEMORY/KNOWLEDGE/Ideas/<slug>.md` (kb-v3 schema, typed `related:` links) |
| **work issue `Type:queue`** | "Captured idea — needs triage and prioritization" | the work repo (resolved via `LIFEOS/USER/WORK/work_repo.json`) |
| **work issue `Type:project`** | "Multi-day or multi-week initiative" — an idea big enough to build | same repo |
| **Newsletter** | the IDEAS + DISCOVERY sections of the edition | capture sheet → newsletter platform (manual today) |
| **Blog seed** | an idea worth writing up | `_BLOGGING` drafts |
| **Feed source registry** | the idea's *source* becomes a monitored feed | `feed-api` (auto-upserted by summarize) |

The **append-only ledger** (the Preserve stage) is the raw permanent history of *every* capture, including the ones that never earn a destination. The rows above are what an idea earns *on top of* that guaranteed record — not competing stores of history. The ledger is the source of truth; KNOWLEDGE notes are its curated view.

The two the principal called out explicitly — "capturing these things in our knowledge base" and "adding them to the work issues list as potential cool ideas or potential projects" — map exactly to the KNOWLEDGE-note and work-issue rows. The labels already exist. The bridges don't yet.

---

## What Amber Is NOT (the boundary)

Amber gets confused with four neighbors because they all touch content. The distinction is crisp:

| System | Job | Relationship to Amber |
|--------|-----|-----------------------|
| **The reader** (Surface) | curates the incoming stream so the principal sees signal; *deletes its items after ~5 days* | an **input** to Amber, not Amber — and its 5-day deletion is the case-in-chief for Amber's permanence |
| **Feed** | the *plumbing* that polls sources and runs label/rate | an **input + grader**, not the identity layer |
| **Harvest skill** (`/ha`) | *report-only* — mines one piece of content for LifeOS-system upgrades | a **decision tool**, writes nothing to the store |
| **`_HARVEST` skill** | ingests *one* signal into a *single* Knowledge note | one **capture→route path** inside Amber, not the whole system |

Amber is the **identity and orchestration layer** that names the whole loop and makes these pieces one system. It doesn't replace any of them. It's the frame that was missing.

---

## First-Class Escalation

Amber is a primary feature — a first-class citizen alongside Memory, Router, Work, and Pulse. Concretely, that means four manifestations. The doc + routing + TELOS entry ship at naming time; the skill and Pulse surface are specified here and built on the roadmap.

### 1. Named skill (`/amber`) — *specified, roadmap Phase 4*

A driveable skill so capture, review, and routing work from the CLI the way `_ULWORK` and `Knowledge` do:

- `amber capture <url|text>` — send anything into the loop from the terminal.
- `amber list [--since 1w] [--status inbox|seedling|…] [--min-score N]` — everything caught, newest first.
- `amber search <query>` — search the permanent store.
- `amber route <id>` — run (or re-run) the TELOS classifier and fan to destinations.
- `amber pending` — ideas caught but not yet routed (the triage queue).
- `amber stats` — count over time, by source, by destination.

### 2. Pulse dashboard surface — ✅ SHIPPED 2026-07-09

**`/amber` is live on Pulse, in the top-level nav.** Backed by `PULSE/modules/amber.ts` (`GET /api/amber` — composes the ledger worker `/stats`+`/captures` (limit 50), a KNOWLEDGE `created:` scan (counts + last-30d recent notes), the SEEN_BOOKMARKS KV key count via the CF API, and local `_X/State` bookmark files (counts + last-30d issues); 60s cache; secrets server-side only). Rebuilt 2026-07-11 as a **three-tab, stream-first page** (hash deep-links `#stats`/`#system`):

- **STREAM (default)** — unified reverse-chron feed of new content from all sources: ledger captures, Knowledge notes, and X-bookmark work issues, merged with kind badges, origin filter chips, scores, routed markers, and 60s auto-refresh. Promoted notes are deduped onto their capture row.
- **STATS** — the live numbers: tiles (preserved, routed/waiting, KNOWLEDGE 7d/30d, spreadsheet per-path, X bookmarks), knowledge by-type table, ledger by source, spreadsheet sends per path (hotkey path honestly labeled un-instrumented), plus the "what each number is" explainer.
- **SYSTEM** — the documentation: what Amber is, the capture→preserve→grade→route→resurface loop with live counts, the 11-input catalog, and how the page gets its numbers.

Still-open refinements: the seedbed (top `seedling`/`budding` ideas) as a stream lens.

### 3. Canonical doc + routing — *ships at naming time*

This doc, plus a `CLAUDE.md` routing-table entry so Amber sits in the subsystem index next to the other named systems.

### 4. TELOS current → ideal — *ships at naming time*

Amber is promoted from scattered `partial`/`missing` lines in the current-state inventory to a named subsystem with an explicit gap between where it is and where it's going, so its buildout is on the hill-climb like everything else.

- **Current state:** capture works (hotkey, bookmarks, harvest, voice markers); grading works; but history dead-ends in a throwaway sheet, routing is manual for most inputs, and there's no skill/dashboard.
- **Ideal state:** every input runs the full capture→**preserve**→grade→route→resurface loop; every idea lands in the permanent ledger the moment it's caught, and the best get promoted to KNOWLEDGE notes; the good ones auto-open `Type:queue`/`Type:project` issues; the flow is visible on Pulse and driveable via `/amber`.

---

## Roadmap (the missing bridges)

Phased so each phase is independently valuable and shippable. Nothing here is built at naming time — this is the plan the doc exists to make obvious.

**Phase 0 — Name & document.** ✅ Amber named, this doc written, CLAUDE.md routing added, TELOS current-state entry added.

**Phase 1 — Permanent history (✅ SHIPPED 2026-07-08).** The append-only ledger is live: the `amber` D1 + the `arbol-a-amber-ledger` Capture-Contract worker (write-ahead, idempotent dedup on normalized-URL + content-hash, grade-versioned, privacy-classed) + an `amber capture|list|stats` CLI. Verified live — a URL, its exact re-POST, and a `?utm_*`/`fbclid` variant all collapse to one row. Every capture now persists the instant it's caught, before grading, independent of the newsletter. The five schema decisions below were all built in:
- **System of record (no ambiguity).** The D1 ledger is the append-only source of truth — *every* capture, including grade-rejects. KNOWLEDGE `idea` notes are a **curated promotion layer built FROM the ledger**, never a parallel history. Two co-equal "histories" diverge and rot; don't build that.
- **Dedup key.** The same URL arrives via hotkey, bookmark cron, and Feed. Canonical idea identity = normalized URL + content hash, so the ledger doesn't fill with dupes and grading doesn't needlessly re-run.
- **Grade versioning.** Store the grader/TELOS version next to each score, or historical scores become uninterpretable once TELOS evolves.
- **Privacy boundary.** Voice markers and personal captures flowing to cloud D1 cross a local→cloud line — the adjacent case to the `{{LIFEOS_ROOT}}`→public constitutional rule. Specify which content classes are ledger-eligible before wiring the personal inputs.
- **Backfill-ready.** Design the schema to accept the existing sheet's rows (timestamp, source attribution) so the Phase-5 migration is lossless.

**Phase 2 — Auto-routing (✅ SHIPPED 2026-07-08).** `amber route` grades every unrouted ledger capture against TELOS (the 10-way taxonomy via `Inference.ts`) and fans it: `knowledge`/`blog_seed`/`help_understand` → a KNOWLEDGE `idea`-note, `work_item` → `Type:queue`, `project_integration` → `Type:project` — then marks the row `routed` via the worker's enrichment endpoint (raw capture stays immutable). Dry-run-first (`--dry-run` writes nothing); GH issues gated behind `--commit-issues`. Live-verified end to end, idempotent (routed rows skip). The manual "where does this go?" step is gone. Refinements pending: typed-`related`-link backfill on the notes; a launchd schedule so routing runs unattended.

**Phase 3 — More inputs.** Wire the roadmap inputs to the Amber capture contract: reader upvote → capture, a gesture/wearable trigger, email → capture via the assistant. Each is now "conform to the contract," not "build a pipeline." Ordering note: more inputs land AFTER history on purpose — adding inputs before the ledger exists just pours more into a leaky pipe. (This is the one place the plan runs behind the literal "a lot more inputs" ask, and it's deliberate.)

**Phase 4 — Skill + Pulse.** Build `/amber` and the Pulse tab against the Phase-1 store. This is what makes it *feel* first-class day to day.

**Phase 5 — Close the newsletter loop.** The newsletter reads FROM the permanent store instead of the throwaway sheet — the sheet becomes a generated view, not the system of record. Retires the ephemeral spreadsheet the principal flagged as temporary.

### Resolved: the history store is both, with clear roles
The D1 ledger is the append-only **source of truth** — catches everything, cheaply, forever, including grade-rejects. KNOWLEDGE `idea` notes are the **curated human layer**, promoted from the ledger (browsable, typed `related:` links, aging `inbox→seedling→budding→evergreen`). They are not co-equal: the ledger is authoritative, the notes are a view of its best rows. This resolves the "one store or two" question that would otherwise stall Phase 1.

---

## Cross-References

- Capture endpoint: `LIFEOS/USER/CUSTOMIZATIONS/ARBOL/summarize/` (`arbol-a-summarize`)
- TELOS-graded routing: `ARBOL/Workers/_F_HARVEST/` + `_A_HARVEST_CLASSIFY/`, writer `LIFEOS/TOOLS/HarvestExecutor.ts`
- Bookmark → idea-issue: `skills/_X/Tools/bookmark-issue.ts`
- Knowledge Archive schema: `LIFEOS/MEMORY/KNOWLEDGE/_schema.md` (kb-v3, `idea` note type)
- Work labels: `LIFEOS/USER/WORK/labels.yml` (`Type:queue`, `Type:project`, `source:*`)
- Work System: `LIFEOS/DOCUMENTATION/Work/WorkSystem.md`
- Current-state inventory: `LIFEOS/USER/TELOS/CURRENT_STATE/INFRASTRUCTURE.md`
- Feed: `LIFEOS/DOCUMENTATION/Feed/FeedSystem.md`; reader skill: `skills/_SURFACE/`
- Instance map (USER zone): `LIFEOS/MEMORY/WORK/20260708-amber-idea-capture-system/ISA.md`
