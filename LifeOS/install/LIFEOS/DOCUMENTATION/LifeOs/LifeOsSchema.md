---
version: 1.0.4
---

# Life OS Schema

> **The canonical shape of the USER directory in LifeOS.**
>
> Everything your DA knows about you lives in one flat, biography-style tree. This spec defines the rules every LifeOS user follows — so the same Pulse dashboard, the same Interview skill, the same Daemon aggregator, and the same skills work for everyone out of the box.

**Status:** Draft v1.0 · 2026-04-16
**Applies to:** `LIFEOS/USER/` in every LifeOS installation
**Companion docs:** `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md` (the why), `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md` (the dashboard), `skills/_LIFEOS/RELEASE_TEMPLATES/USER/` (the starter scaffold)

---

## 1. The One Rule

> **Single concept → single file at `USER/` root. Multi-file concept → capitalized directory at root, with `README.md` as the narrative entry.**

That is the whole organizing principle. No other nesting justification counts. If a concept can live in one file, it does, at root. If it genuinely needs many files (labs, customer folders, contract templates), it becomes a directory.

The USER/ root should read like a biography — not a filing cabinet. Walking into it should reveal the person, not the taxonomy.

## 2. Naming Convention

| Rule | Example |
|---|---|
| **PascalCase, always.** No underscores, no ALL_CAPS, no kebab-case. | `PrincipalIdentity.md`, not `PRINCIPAL_IDENTITY.md` or `principal-identity.md` |
| **Multi-word → single joined word, camel caps.** | `WritingStyle.md`, `AssetManagement.md`, `CoreContent.md` |
| **Directories follow the same rule.** | `Health/`, `Business/`, `SkillCustomizations/` |
| **Semantic names, not generic.** | `Music.md` (not `Bands.md`), `Food.md` (not `FoodPreferences.md`) |

## 3. Frontmatter Contract

Every `.md` file in USER/ (root files and files inside directories) carries YAML frontmatter. This is the API between the file and every consumer (Pulse, Daemon, Interview, skills).

```yaml
---
category: taste                # identity | voice | mind | taste | shape | ops | domain
kind: collection               # collection | narrative | reference | index
publish: daemon                # false | daemon-summary | daemon | public
review_cadence: 180d           # 30d | 90d | 180d | 365d | never
interview_phase: 3             # 1 | 2 | 3 | 4 — used by Interview skill
last_updated: 2026-04-16
---
```

| Field | Required | Purpose |
|---|---|---|
| `category` | yes | Pulse grouping. Determines dashboard section. |
| `kind` | yes | Render contract. Picks which Pulse component displays the file. |
| `publish` | yes | Daemon broadcast flag. Default `false`. |
| `review_cadence` | yes | Staleness timer. Pulse/Interview surface re-review when exceeded. |
| `interview_phase` | no | Interview skill ordering. Omit = auto-detect from category. |
| `last_updated` | yes | ISO date. Maintained by writer (human or DA). |

## 4. Categories (the 7)

Root files are grouped by `category:`. The first six are single-file concepts; the seventh is multi-file domains (directories).

| Category | Meaning | Example files |
|---|---|---|
| `identity` | Who you are — the irreducible "this is me" | `PrincipalIdentity.md`, `DaIdentity.md`, `OurStory.md`, `Opinions.md`, `Resume.md`, `Contacts.md` |
| `voice` | How you communicate | `WritingStyle.md`, `RhetoricalStyle.md`, `DaWritingStyle.md`, `AiWritingPatterns.md`, `Pronunciations.md` |
| `mind` | How you think | `Beliefs.md`, `Wisdom.md`, `Models.md`, `Frames.md`, `Narratives.md`, `Definitions.md`, `Ideas.md`, `Learned.md`, `Wrong.md` |
| `taste` | What you love | `Books.md`, `Authors.md`, `Movies.md`, `Music.md`, `Artists.md`, `Restaurants.md`, `Food.md`, `Podcasts.md`, `Coffee.md` |
| `shape` | How your life runs | `Rhythms.md`, `Sparks.md`, `Creative.md`, `Civic.md`, `Meetups.md`, `Predictions.md`, `Traumas.md`, `Current.md`, `Ideal.md` |
| `ops` | Infrastructure of self | `Productivity.md`, `AssetManagement.md`, `Feed.md`, `Architecture.md` |
| `domain` | Multi-file life domains (directories) | `Telos/`, `Health/`, `Finances/`, `Business/`, `Work/`, `Relationships/`, `Security/`, `Daemon/` |

Users may define their own category values. Pulse auto-groups by category string; adding `category: travel` creates a new section.

## 5. Kinds (the 4 Render Contracts)

Pulse has one React component per `kind:`. Four components render the entire USER/ tree.

| `kind:` | Renderer | What the file contains |
|---|---|---|
| `collection` | `<CollectionView>` — sortable list, item cards | Enumerated items with optional ratings/notes. `Books.md`, `Movies.md`, `Music.md`, `Restaurants.md`, `Podcasts.md`, `Meetups.md` |
| `narrative` | `<NarrativeView>` — prose card, section nav, pull-quotes | Essays, beliefs, story-shaped content. `Beliefs.md`, `Wisdom.md`, `OurStory.md`, `Rhythms.md`, `WritingStyle.md` |
| `reference` | `<ReferenceView>` — key/value table, monospace | Lookup tables, definitions, mappings. `Contacts.md`, `Pronunciations.md`, `Definitions.md`, `Architecture.md` |
| `index` | `<IndexView>` — tile grid linking to children | Directory entry points. `Health/README.md`, `Business/README.md`, `Telos/README.md` |

## 6. Collection Item Format

Every file with `kind: collection` uses the same human-readable item shape. Markdown list, one item per line:

```
- **{name}** — {creator} · ★{rating} · {notes}
```

All parts after `name` are optional. The parser is permissive — anything not matching becomes `notes`. Examples:

```markdown
- **Meditations** — Marcus Aurelius · ★10 · stoic operating system
- **Antifragile** — Taleb · ★9 · systems that gain from disorder
- **Deep Work** — Newport · ★8
- **Thinking, Fast and Slow** — Kahneman
- **Shōgun** — James Clavell
```

No schema file needed. No registration. Drop the file, Pulse parses it.

## 7. The Publish Model (Daemon Broadcast)

The `publish:` frontmatter field is the universal broadcast contract. `DaemonAggregator.ts` scans USER/ and publishes anything above `false`.

| Value | Behavior |
|---|---|
| `false` | Stays private. Never leaves the machine. **Default.** |
| `daemon-summary` | Daemon gets count + last-updated only. "Currently reading 3 books" — no titles. |
| `daemon` | Full file content published to daemon.{yourdomain}.com. |
| `public` | Published to daemon AND exposed via LifeOS public API (for DA-to-DA protocols). |

**Per-item override:** Inside a `kind: collection` file, prefix an item with `(private)` to exclude it from publish even when the file is `publish: daemon`:

```markdown
- **The Dark Forest** — Liu Cixin · ★9
- (private) **Some embarrassing book** — Author · ★3
```

**Classification inheritance:** Files inside a `domain` directory inherit the directory README's `publish:` unless they set their own. Always private by default for domain files (health, finances, work, business).

## 8. Directory Anatomy (Multi-File Domains)

When a concept genuinely needs many files, it becomes a capitalized directory at USER/ root. The shape inside is:

```
Health/
  README.md        # kind: index — narrative entry, links to children
  Metrics.md       # kind: collection or reference
  Providers.md     # kind: reference
  Medications.md   # kind: collection
  Conditions.md    # kind: narrative
  Fitness.md       # kind: narrative
  Nutrition.md     # kind: narrative
  Labs/            # subdirectory for time-series artifacts
    2026-01.md
    2025-09.md
```

**Rules inside a directory:**
- `README.md` is always `kind: index`
- One more level of nesting is permitted (`Labs/` inside `Health/`) for time-series or per-entity isolation (customer folders inside `Work/Customers/`)
- No deeper nesting without explicit justification in the domain README

## 9. Pulse Render Contract

Pulse reads `Pulse/state/user-index.json` — a typed JSON produced by `Pulse/modules/user-index.ts`. The indexer:

1. Walks USER/ — root files (non-recursive) + one-level into each directory
2. Parses frontmatter + body for each `.md`
3. Computes derived fields (`completeness`, `staleness_days`, `overdue_review`, `item_count`, `preview`)
4. Writes index
5. Watches USER/ via `fs.watch` — re-parses changed files and broadcasts SSE `user.file.updated` events

**Pulse routes:**

```
/life                   — biography overview, all categories
/life/c/:category       — category filter (taste, mind, …)
/life/:filename         — single root file drilldown
/<domain>               — directory page (/health, /finances, /business, /work, /relationships, /telos, /daemon, /security)
/interview              — interview gaps + launcher
```

Routing is data-driven. New files and new categories appear automatically; no code changes.

## 10. Daemon Integration

`DaemonAggregator.ts` replaces its hardcoded file list with a scan:

```typescript
// Every file with publish != "false" becomes a daemon entry
const entries = userIndex.publish_feed;
const daemonData = {
  entries: entries.map(e => ({
    title: e.title,
    category: e.category,
    kind: e.kind,
    publish: e.publish,
    content: e.publish === "daemon-summary" ? summary(e) : full(e),
    items: e.kind === "collection" ? e.items : null,
    last_updated: e.last_updated,
  })),
};
writeFileSync("daemon-data.json", JSON.stringify(daemonData));
```

No per-file selector logic. Frontmatter IS the contract.

## 11. Interview Integration

`InterviewScan.ts` reads `user-index.json` instead of scanning files directly. Each file's `interview_phase` (or auto-derived from `category`) places it in the ordering:

| Phase | Target files |
|---|---|
| P1 — Foundational TELOS | `Telos/Mission.md`, `Telos/Goals.md`, `Telos/Problems.md`, `Telos/Strategies.md`, `Telos/Challenges.md` |
| P2 — Ideal state dimensions | `Ideal.md`, `Current.md`, `Rhythms.md`, `Sparks.md`, plus domain Ideals |
| P3 — Taste and preferences | All `category: taste` files (`Books.md`, `Movies.md`, `Music.md`, `Restaurants.md`, `Food.md`, ...) |
| P4 — Identity, voice, mind | All `category: identity|voice|mind` files |

Adding a new file with `interview_phase: 3` auto-includes it in the P3 conversation.

## 12. Extension — How Users Add New Concepts

**The extension contract, in full:**

1. **Drop a new `.md` file at USER/ root with valid frontmatter.** That's it.
2. Pulse's `fs.watch` detects the new file → indexer parses it → dashboard renders a new tile.
3. Daemon's aggregator picks it up if `publish:` is set.
4. Interview's scan picks it up on next run.

Examples of user extensions:

```
USER/Podcasts.md          # new taste file
USER/Gratitude.md         # new mind file
USER/Travel.md            # new shape file with category: travel (novel category — auto-grouped)
USER/BoardGames.md        # new taste file
```

**Zero code changes required in Pulse, Daemon, or Interview for any extension.**

## 13. Forbidden Patterns

| Don't | Why |
|---|---|
| Nest preferences inside `Preferences/` wrapper | Single-concept files belong at root, not grouped |
| Put time-series files at USER/ root (`lab_results_Jan2026.md`) | Goes inside the domain directory under a time-series subdir (`Health/Labs/`) |
| Mix content-kind on a single file | One `kind:` per file. Split instead. |
| Edit `PrincipalTelos.md` or other auto-generated files | Marked with `generated: true` in frontmatter. Write to sources; the generator rebuilds. |
| Use `publish: true` / `publish: yes` | Use the enum values (`false | daemon-summary | daemon | public`) |

## 14. Public Release Story

- **Private content lives in `USER/`.** Never committed to the public LifeOS repo.
- **Templates live in `skills/_LIFEOS/RELEASE_TEMPLATES/USER/`.** Shipped with every LifeOS release. This is the scaffold a new LifeOS user starts with.
- **This spec (`LIFEOSSCHEMA.md`) is the contract.** Public. Referenced by templates, Pulse renderer docs, Interview prompts.
- **`ShadowRelease.ts` never reads USER/.** It reads `skills/_LIFEOS/RELEASE_TEMPLATES/USER/` + this spec.

New LifeOS user experience:
1. Install LifeOS the platform-agnostic, AI-native way: hand the installer (`skills/LifeOS/install/install.sh`, or the install doc) to your own AI/harness, which installs the `LifeOS/` skill and scaffolds `USER/` from the release templates (`skills/_LIFEOS/RELEASE_TEMPLATES/USER/`). No `git clone` into `$LIFEOS_ROOT`.
2. Run `Interview` skill → conversation walks them through filling in files, phase by phase
3. Pulse dashboard lights up as files gain content
4. Daemon publishes nothing until the user sets `publish:` flags

## 15. File Inventory (Reference)

The canonical expected root file list for a fully-populated USER/. Not every user will have every file; the shape is reference.

```
USER/
  # identity
  PrincipalIdentity.md  DaIdentity.md  OurStory.md  Opinions.md  Resume.md  Contacts.md
  # voice
  WritingStyle.md  RhetoricalStyle.md  DaWritingStyle.md  AiWritingPatterns.md  Pronunciations.md
  # mind
  Beliefs.md  Wisdom.md  Models.md  Frames.md  Narratives.md  Definitions.md  CoreContent.md
  Ideas.md  Learned.md  Wrong.md
  # taste
  Books.md  Authors.md  Literature.md  Movies.md  Music.md  Artists.md
  Restaurants.md  Food.md  Podcasts.md  Coffee.md
  # shape
  Rhythms.md  Sparks.md  Creative.md  Civic.md  Meetups.md
  Predictions.md  Traumas.md  Current.md  Ideal.md
  # ops
  Productivity.md  AssetManagement.md  Feed.md  Architecture.md
  # domain directories
  Telos/  Health/  Finances/  Business/  Work/  Relationships/  Daemon/  Security/
  # infrastructure directories (system-operational, not life content)
  Config/  Credentials/  SkillCustomizations/  Terminal/  Workflows/
  Actions/  Flows/  Pipelines/  Arbol/  BrowserState/
```

## 16. Changelog

- **v1.0 (2026-04-16)** — Initial draft. Companion to `LIFEOSTHESIS.md`. Supersedes the ad-hoc USER/ structure.
