# PAI Memory System — Structure Reference

> Memory is structured by purpose, not by chronology. All memory is plain text (Markdown preferred, JSONL for structured logs). The filesystem IS the index — no RAG, no vector embeddings. Fast filesystem search (ripgrep) replaces embedding-based retrieval.

---

## Three Primary Tiers

```
MEMORY/
├── WORK/                    # Per-task artifacts for active Algorithm runs
│   └── {slug}/              # One subdirectory per task
│       ├── ISA.md           # The task's Ideal State Artifact
│       ├── features/        # Feature-scoped ephemeral files
│       ├── notes.md         # Working notes
│       └── verification/    # Evidence collection
│
├── KNOWLEDGE/               # Curated, cross-referenced entities
│   ├── People/              # Individuals the user interacts with
│   ├── Companies/           # Organizations, products, services
│   ├── Ideas/               # Concepts, theories, frameworks
│   ├── Research/            # Papers, articles, investigations
│   └── Blogs/               # Regular content sources
│
└── LEARNING/                # Meta-patterns derived from satisfaction signals
    ├── patterns/            # Reusable pattern files
    ├── signals/             # Satisfaction, sentiment, rating data
    └── reflections/         # Algorithm retrospectives
```

### WORK Tier

- **Lifecycle:** Created at OBSERVE phase, archived after VERIFY+LEARN completes
- **Content:** Task ISAs with full criteria, feature breakdown, and evidence
- **Cleanup:** Completed work ISAs move to `WORK/archived/{slug}/` or are removed
- **Structure:** Each task gets a slug derived from the user request (e.g., `fix-login-bug`)

### KNOWLEDGE Tier

- **Lifecycle:** Long-lived, curated, promoted from other tiers
- **Entities:** Markdown files with YAML frontmatter
- **Frontmatter fields:** `type`, `related: [slug1, slug2]`, `tags: [tag1, tag2]`, `created`, `updated`
- **Cross-references:**
  - Wikilinks: `[[Page Name]]` — explicit cross-reference between pages
  - Frontmatter: `related: [slug1, slug2]` — declared relationships
  - Backlinks: Computed reverse index from wikilinks (use `rg` to find)
  - Tags: Tag-based group associations
  - Directory hierarchy: Path-based group inference

### LEARNING Tier

- **Lifecycle:** Appended during LEARN phase from satisfaction signals
- **Content:** What worked, what didn't, patterns observed, wisdom extracted
- **Format:** Pattern files with structured frontmatter
- **Usage:** Consulted during OBSERVE phase for relevant past experience

---

## Auxiliary Compartments

```
MEMORY/
├── RELATIONSHIP/            # DA-Principal relationship notes (private)
├── OBSERVABILITY/           # Telemetry data
│   ├── tool-calls.jsonl     # Every tool call
│   ├── hook-firings.jsonl   # Every hook firing
│   └── satisfaction.jsonl   # Satisfaction signals
├── STATE/
│   └── work.json            # Session registry (active sessions, status)
├── SKILLS/
│   └── execution.jsonl      # Cross-skill audit trail
├── PROJECT/                 # Per-project memory compartments
│   └── {project-name}/      # Scoped to project context
├── RESEARCH/                # Active research (non-permanent)
├── DATA/                    # Reference data, datasets
├── REFERENCE/               # Reference material, docs
├── BOOKMARKS/               # Saved URLs, reference links
├── RAW/                     # Raw ingested content (pre-classification)
├── VERIFICATION/            # Verification evidence artifacts
├── WISDOM/                  # Extracted wisdom, life lessons
├── SCRATCHPAD/              # Ephemeral, deletable at any time
├── AUTO/                    # Self-improvement, skill-tuning
└── PAISYSTEMUPDATES/        # System upgrade records
```

---

## User Identity Files

These are separate from MEMORY and live alongside it:

```
USER/
├── PRINCIPAL_IDENTITY.md    # Who the user is — name, role, location, worldview
├── DA_IDENTITY.md           # Who the DA is — name, voice, personality, style
└── TELOS/                   # Mission, goals, beliefs, wisdom, challenges
    ├── MISSION.md
    ├── GOALS.md
    ├── BELIEFS.md
    ├── WISDOM.md
    ├── CHALLENGES.md
    ├── MENTAL_MODELS.md
    └── NARRATIVES.md
```

---

## Memory Rules

1. **Append-mostly:** Prefer adding new entries over editing/deleting past artifacts. Use superseding entries to correct. Exception: SCRATCHPAD is fully ephemeral.
2. **Cross-reference integrity:** All wikilinks in KNOWLEDGE should resolve to existing pages. Flag unresolved links for cleanup.
3. **Execution log:** Every skill invocation appends to `SKILLS/execution.jsonl`:
   ```jsonl
   {"ts":"2026-05-30T10:00:00Z","skill":"research","workflow":"deep-investigation","input":"climate policy","status":"ok","duration":120}
   ```
4. **Progressive loading:** Load memory progressively — current task context first, then referenced entities, then meta-patterns on demand.
