---
name: Knowledge
version: 1.0.13
description: "Manage the LifeOS Knowledge Archive — a curated, typed graph of People, Companies, Ideas, and Research notes with typed related: links; search, add, harvest, develop, ingest, and graph-navigate. USE WHEN knowledge, knowledge base, search knowledge, what do we know about, archive, harvest, knowledge status, develop note, add to knowledge, ingest, contradictions, knowledge graph, retrieve, mine conversations. NOT FOR session/ISA context recovery (use ContextSearch), published content semantic search across blog/newsletter/X/LinkedIn (use _CONTENTSEARCH), or one-shot URL/YouTube ingestion via the Arbol harvester pipeline (use _HARVEST)."
argument-hint: [search|add|harvest|develop|ingest|contradictions|graph|retrieve|mine|<query>]
effort: low
context: fork
background: false
---

# Knowledge Skill

## What It Does

Manage the LifeOS Knowledge Archive — a curated, typed graph of notes across four entity domains: People, Companies, Ideas, and Research. Operations cover search, add, harvest, develop, ingest, contradiction-finding, graph traversal, compressed retrieval, and mining recent conversations for memory candidates. Every note ships with typed `related:` cross-links, so the archive is a connected graph, not a pile of files.

## The Problem

Notes you save in isolation are notes you never find again. A flat folder of facts has no way to tell you that two notes contradict each other, that a new source updates an old claim, or that an idea connects to a person and a company you wrote up months ago. Knowledge dies when it can't be retrieved or related. This archive forces every note into a typed schema with mandatory cross-links and ripples updates through related notes on ingest, so the connections are built in at write time instead of being reconstructed by hand later.

## How It Works

Manage the LifeOS Knowledge Archive at `~/.claude/LIFEOS/MEMORY/KNOWLEDGE/`. Each operation routes through a subcommand below; notes follow the archive schema and ship with typed cross-links.

**Archive schema:** `~/.claude/LIFEOS/MEMORY/KNOWLEDGE/_schema.md`

## Workflow Routing

Workflows are inline command sections in this file (no Workflows/ dir); each row routes to the matching H2 section below.

| Trigger | Workflow | Action |
|---------|----------|--------|
| `/knowledge` (no args) | **status** | Health dashboard |
| `/knowledge <query>` | **search** | Search for notes matching query |
| `/knowledge search <query>` | **search** | Explicit search |
| `/knowledge add <type>` | **add** | Create a new note (People, Companies, or Ideas) |
| `/knowledge harvest` | **harvest** | Run KnowledgeHarvester on all sources |
| `/knowledge develop` | **develop** | Surface seedlings and enrich them |
| `/knowledge ingest <url-or-file>` | **ingest** | Read source, create note, ripple updates to related notes |
| `/knowledge contradictions` | **contradictions** | Find and review conflicting claims across notes |
| `/knowledge graph` | **graph** | Knowledge graph stats and navigation |
| `/knowledge graph <slug>` | **graph** | Traverse graph from a note |
| `/knowledge retrieve <query>` | **retrieve** | Compressed context retrieval |
| `/knowledge mine` | **mine** | Mine recent conversations for memory candidates |

If `$ARGUMENTS` doesn't match a subcommand, treat it as a search query.

---

## status (default, no args)

Run the harvester status command and display results:

```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeHarvester.ts status
```

Also show:
- Quick summary of domains with note counts
- Any orphan wikilinks
- Any stale seedlings
- Time since last harvest

Present in NATIVE mode.

---

## search <query>

Search the Knowledge Archive for notes matching `$ARGUMENTS`.

**Step 1 — Lexical search:**
```bash
rg -i "$ARGUMENTS" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l
```

**Step 2 — Frontmatter search (tags and titles):**
```bash
rg -i "title:.*$ARGUMENTS|tags:.*$ARGUMENTS" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l
```

**Step 3 — Wikilink search:**
```bash
rg "\[\[.*$ARGUMENTS.*\]\]" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l
```

Deduplicate results across all three. For each match, read the first 5 lines of frontmatter to show title, domain, status, tags.

Present results as a table:
```
| Note | Domain | Status | Tags | Relevance |
```

If no results found, say so and suggest checking the full MEMORY/ system or running a harvest.

---

## add <type>

Create a new note manually in the specified entity type.

1. Validate type is one of: People, Companies, Ideas, Research
2. Ask for a title (or use remaining args after type)
3. Generate kebab-case filename from title
4. **MANDATORY: Find 2-3 related notes first.** Before writing the new note, grep existing Knowledge for related entities by topic/tags/name. This becomes the `related:` frontmatter array. No Knowledge note ships without typed links. See Canonical Linking Requirement below.
5. Create the note with proper frontmatter from `_schema.md` — schemas require: `title`, `type`, `tags` (min 1), `created`, `updated`, `quality` (0-10), plus type-specific body sections.
6. Write the file to `KNOWLEDGE/<Type>/<kebab-case-title>.md` — slug max 60 chars
7. Verify every slug in `related:` exists in the archive before saving
8. Regenerate the type's MOC:
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeHarvester.ts index
```

**Topic is a tag, not a type.** A security insight is an Idea with a `security` tag. A security company is a Company with a `security` tag. The entity type determines the schema; the tag determines the topic.

## Canonical Linking Requirement (MANDATORY)

**Every new Knowledge note must ship with typed cross-links.** This is not optional. The architecture is defined in `MEMORY/KNOWLEDGE/Ideas/pai-knowledge-linking-architecture.md` (quality 9) and the schema in `_schema.md`.

**Every write must include:**

1. **`related:` frontmatter array** — 2-4 typed entries linking to other Knowledge entries (any domain: People, Companies, Ideas, Research)
2. **Body wikilinks** — 1-3 `[[slug]]` references woven into the prose where natural (Implications, Evidence, or Context sections)

**8 relationship types** (pick the most accurate, prefer specific over generic):

| Type | Meaning |
|------|---------|
| `related` | Generic association (default only if no better fit) |
| `supports` | Provides evidence for the linked note |
| `contradicts` | Conflicts with the linked note |
| `extends` | Builds upon the linked note |
| `part-of` | Component of a larger whole |
| `instance-of` | Example of a pattern |
| `caused-by` | Result of the linked note |
| `preceded-by` | Came before temporally |

**Frontmatter format:**
```yaml
related:
  - slug: other-note-slug
    type: extends
  - slug: another-note-slug
    type: supports
```

**How to find related notes before writing:**
```bash
# By topic/keyword
rg -l "TOPIC" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md

# By tag overlap
rg "^tags:.*TAG" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l

# For People/Companies — grep by name
rg -l "Person Name" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/
```

**Enforcement:**
- Writes that skip `related:` are incomplete and must be fixed before the skill/workflow returns success
- The `ingest` workflow runs this as part of the ripple pass
- The Algorithm LEARN phase includes this in its knowledge capture step
- All agents writing Knowledge entries must follow this rule — it is part of the schema, not an optional enhancement

---

## harvest

Run the KnowledgeHarvester to pull new knowledge from all LifeOS sources:

```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeHarvester.ts harvest
```

Display results. If nothing was harvested, explain that sources are already up to date.

Optionally accept `--source` filter: `/knowledge harvest work` or `/knowledge harvest memory`.

---

## develop

The weekly gardening workflow. Surface seedling notes that are ready for enrichment.

**Step 1 — Find seedlings:**
```bash
rg "^status: seedling" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l
```

**Step 2 — For each seedling:**
- Read the note
- Read related notes (follow wikilinks, search for same tags)
- Check if newer WORK/ ISAs or auto-memory entries have relevant context
- Enrich the note: add context, suggest wikilinks, flesh out content

**Step 3 — Present the diff to the user for approval.**

**Step 4 — If approved:**
- Write the updated note
- Promote status from `seedling` to `budding` (or `evergreen` if comprehensive)
- Update the `updated` date
- Regenerate affected MOCs

If no seedlings exist, report archive is clean.

---

## ingest <url-or-file>

Ingest a source into the Knowledge Archive. This is the key Karpathy-inspired upgrade: reading a source doesn't just create one note — it **ripples updates through existing related notes**.

**If no argument provided:** Show usage: `/knowledge ingest <url-or-file-path>`

### Step 1 — Fetch the source

- **URL:** Use WebFetch to retrieve and read the content. If WebFetch fails, try `curl -sL` via Bash.
- **File path:** Use Read tool to read the local file.

Summarize the source in 2-3 sentences. Identify key entities, claims, and insights.

### Step 2 — Classify and create primary note

Determine entity type (People, Companies, Ideas, or Research) using the classification rules in `_schema.md`. Most ingested sources become Ideas.

Create the primary note using the schema for that type:
- Generate kebab-case slug from title (max 60 chars)
- Write to `KNOWLEDGE/<Type>/<slug>.md` with proper frontmatter
- Include `source_url:` or `source_path:` in frontmatter
- **MANDATORY: Include `related:` array with 2-4 typed links** — the ripple pass (Step 3) identifies these, and they must be baked into the frontmatter of the primary note at creation time, not added after

### Step 3 — Ripple pass (the key innovation)

Search for existing notes that relate to this new content:

```bash
# Search by extracted tags
rg -i "TAG1|TAG2|TAG3" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l --glob '!_*'

# Search by key entities/concepts mentioned
rg -i "ENTITY1|ENTITY2" ~/.claude/LIFEOS/MEMORY/KNOWLEDGE/ --type md -l --glob '!_*'
```

For each related note found (up to 10):
1. Read the note
2. Determine if the new source adds information, context, or contradicts existing claims
3. If yes, propose the specific update (add wikilink, add evidence, note contradiction)

**Present the ripple plan to the user:**
```
📥 INGEST RIPPLE PLAN:
  PRIMARY: Ideas/new-note-slug — "Title" (created)
  PRIMARY related: frontmatter links (MANDATORY):
    → Ideas/existing-note-1 — type: extends
    → Ideas/existing-note-2 — type: supports
    → People/person-slug — type: related
  RIPPLE (reverse-direction updates to existing notes):
    → Ideas/existing-note-1 — add body [[new-note-slug]] wikilink + add to its related: array (type: extends)
    → Ideas/existing-note-2 — update Evidence section with new data point + add to related:
    → Ideas/existing-note-3 — ⚠️ CONTRADICTION: new source says X, note says Y — type: contradicts
  NO CHANGE: Ideas/tangentially-related — mentioned same tag but no substantive connection
```

### Step 4 — Execute ripple updates

After the user approves (or you determine updates are low-risk cross-references):
- **Primary note**: ensure `related:` frontmatter array has 2-4 typed entries — this is mandatory, not optional
- **Related notes**: add reverse-direction `related:` entries to their frontmatter with appropriate types
- **Body wikilinks**: add `[[wikilinks]]` in existing prose where natural (not forced)
- Update `updated:` date on modified notes
- For contradictions: add a `> ⚠️ **Contradiction:** [note] claims X — see [[new-note]] for counter-evidence` callout, AND add `type: contradicts` in related: arrays

### Step 5 — Log and index

Append to `KNOWLEDGE/_log.md`:
```
## [YYYY-MM-DD] ingest | Title
- Source: <url or path>
- Primary: <Type>/<slug>
- Ripple: N notes updated, N contradictions flagged
```

Regenerate MOCs:
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeHarvester.ts index
```

Present in NATIVE mode.

---

## contradictions

Find and review conflicting claims across Knowledge notes.

### Step 1 — Get contradiction candidates

Run the KnowledgeHarvester contradiction finder:
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeHarvester.ts contradictions
```

This outputs pairs of notes with high tag overlap (2+ shared tags), ranked by overlap count.

### Step 2 — Semantic review

For each pair (up to 10 highest-overlap pairs):
1. Read both notes
2. Extract key claims from each (Thesis, Evidence, Key Facts sections)
3. Check for:
   - **Direct contradictions** — Note A says X, Note B says not-X
   - **Temporal supersession** — Note A's claim is outdated by Note B's newer evidence
   - **Scope conflicts** — Both claim authority on the same topic but reach different conclusions

### Step 3 — Report

Present findings:
```
🔍 CONTRADICTION SCAN:
  Pairs checked: N
  Contradictions found: N
  Superseded claims: N

  ⚠️ CONTRADICTION:
    [[note-a]] claims: "X"
    [[note-b]] claims: "Y"
    Resolution: [suggest which is correct, or flag for the user]

  📅 SUPERSEDED:
    [[older-note]] (2026-01-15): "X was true"
    [[newer-note]] (2026-03-20): "X is no longer true because Y"
    Action: Update older note with correction
```

### Step 4 — Fix (with approval)

If the user approves resolutions:
- Update contradicted notes with correction callouts
- Update superseded notes with `> 📅 **Updated:** See [[newer-note]] for current information`
- Update `updated:` dates
- Regenerate MOCs

Present in NATIVE mode.

---

## graph [slug]

Navigate the Knowledge Archive as a graph.

**No argument — stats overview:**
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts stats
```

Show node count, edge count, top clusters, most connected hubs, and isolated nodes.

**With slug — traverse from a note:**
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts traverse <slug> --hops 2
```

Show all notes connected within 2 hops via tags, wikilinks, and typed relationships. Useful for exploring how knowledge connects across domains.

**Related notes only:**
```bash
bun ~/.claude/LIFEOS/TOOLS/KnowledgeGraph.ts related <slug>
```

Present in NATIVE mode.

---

## retrieve <query>

Compressed context retrieval over the Knowledge Archive using BM25-lite scoring.

```bash
bun ~/.claude/LIFEOS/TOOLS/MemoryRetriever.ts "<query>" --top 5
```

Returns the top matching notes with compressed summaries, ranked by title match, tag overlap, and content frequency. Useful for loading relevant knowledge context without reading full files.

For raw excerpts without LLM compression:
```bash
bun ~/.claude/LIFEOS/TOOLS/MemoryRetriever.ts "<query>" --raw
```

Present in NATIVE mode.

---

## mine

Mine recent conversations for memory candidates (decisions, preferences, milestones, problems).

```bash
bun ~/.claude/LIFEOS/TOOLS/SessionHarvester.ts --mine --recent 10
```

Candidates are written to `KNOWLEDGE/_harvest-queue/` for review — never directly to KNOWLEDGE/. Use `/knowledge harvest` to process the queue.

For dry run (preview only):
```bash
bun ~/.claude/LIFEOS/TOOLS/SessionHarvester.ts --mine --recent 10 --dry-run
```

Present in NATIVE mode.

---

## Gotchas

- **4 entity types now.** People (human beings), Companies (organizations), Ideas (insights/theses/analyses), Research (multi-source investigations with methodology). If it doesn't fit one of these, it's not knowledge — it belongs in WORK/ or LEARNING/.
- **Topic = tag, not domain.** A security insight is an Idea with a `security` tag. Never create topic-based folders.
- **The lookup test.** "Would the user look this up by name?" — if not, it's not knowledge.
- **Schema enforcement.** Each entity type has required fields defined in `_schema.md`. Always read the schema before writing.
- **Algorithm LEARN phase writes directly.** The LEARN phase has the best context — it writes to KNOWLEDGE/ with proper schemas. Harvester reflections are disabled.
- **Never delete notes without asking.** Pruning is automatic (90-day seedling expiry via harvester). Manual deletion requires the user's approval.
- **Wikilinks use strict kebab-case.** `[[prompt-injection]]` not `[[Prompt Injection]]`.
- **All harvested notes start as seedlings.** Only `/knowledge develop` promotes them.
- **Temporal validity is optional.** Notes can have `valid_from`/`valid_until` frontmatter fields to track when facts were true. The contradiction detector uses these to skip non-overlapping time windows.

## Examples

**Example 1: Search the archive**
```
User: "what do we know about prompt injection?"
→ Routes to search — 3-pass (lexical + frontmatter + wikilink) over MEMORY/KNOWLEDGE/
→ Returns table of matching notes with domain, status, tags
```

**Example 2: Ingest a source**
```
User: "/knowledge ingest https://example.com/article"
→ Fetches the source, classifies entity type, creates primary note with typed related: links
→ Ripple pass proposes updates to existing related notes; user approves; MOCs regenerated
```

**Example 3: Status check**
```
User: "knowledge status"
→ Runs KnowledgeHarvester.ts status
→ Shows domain note counts, orphan wikilinks, stale seedlings, time since last harvest
```
