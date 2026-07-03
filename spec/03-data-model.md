# PAI v5.0 — Data Model

## DM-01: Core Entities [HIGH]

### User
- Fields: name, role, location, worldview, preferences, home_directory
- Stored as: `PAI/USER/PRINCIPAL_IDENTITY.md`
- Link: has_one DA, has_many Goals, has_many Projects

### Digital Assistant (DA)
- Fields: name, voice_id, personality, writing_style, communication_preferences
- Stored as: `PAI/USER/DA_IDENTITY.md`
- Link: belongs_to User, has_many Sessions

### ISA (Ideal State Artifact)
- Fields: id (UUID), title, status (active/archived/completed), effort_tier (E1-E5), mode (standard/loop/auto), phase (OBSERVE/THINK/PLAN/BUILD/EXECUTE/VERIFY/LEARN), progress, iteration, created, updated, completed_at, project (optional), parent_id (optional)
- Sections (invariant order): Problem, Vision, Out_of_Scope, Principles, Constraints, Goal, Criteria, Test_Strategy, Features, Decisions, Changelog, Verification
- Stored as: `MEMORY/WORK/{slug}/ISA.md` (task) or `{project-root}/ISA.md` (project)
- Link: has_many ISC, has_many Features, has_many Decisions, has_many Changelog_Entries

### ISC (Ideal State Criterion)
- Fields: id (stable, e.g., ISC-7), description, type (criterion/anti-criterion/antecedent), status (pending/verified/failed/superseded), evidence (nullable), tier_source
- Link: belongs_to ISA, may_split_into child_ISCs

### Feature
- Fields: id (stable, e.g., F-1), name, description, status (proposed/planned/in_progress/implemented/verified)
- satisfies: references ISC IDs
- depends_on: references Feature IDs
- parallelizable: boolean
- Link: belongs_to ISA, satisfies many ISCs, depends_on many Features

### Decision
- Fields: timestamp (ISO 8601), content, author (system/user), phase context
- Link: belongs_to ISA

### Changelog Entry
- Fields: conjecture, refuted_by, learned, criterion_now, timestamp
- Link: belongs_to ISA

### ISC Verification
- Fields: isc_id, type (manual/automated/binary), check_description, threshold, tool, evidence_path, status (pass/fail), timestamp
- Link: belongs_to ISC

### Skill
- Fields: name, description, category, version
- Fields (runtime): workflows (ordered list), dependencies (other skills), customization_path, execution_log
- Stored as: `{skill_dir}/SKILL.md` with YAML frontmatter

### Workflow
- Fields: name, skills (ordered list of steps), depends_on (skills), inputs, outputs
- Stored as: `{skill_dir}/Workflows/{Name}.md`

### Hook
- Fields: name, lifecycle_event, handler_path, enabled, priority
- The lifecycle events are: SessionStart, PreToolUse, PostToolUse, Stop, PreCompact, InstructionsLoaded, FileChanged, QuestionAnswered, ConfigAudited, IntegrityCheck

### Algorithm Session
- Fields: id (timestamp-slug), mode, effort_tier, classification, started_at, updated_at, completed_at
- Stored as: frontmatter in task ISA file
- Link: has_one ISA, has_many SkillInvocations, has_many HookFirings

### Session Registry
- Fields: session_id, mode, effort, status (active/completed/abandoned), started_at, updated_at
- Stored as: `MEMORY/STATE/work.json`

## DM-02: Memory Tiers [HIGH]

### WORK
- Purpose: Per-task artifacts for active Algorithm runs
- Structure: `{slug}/` subdirectory per task, containing ISA.md, feature files, notes, ephemeral views
- Lifecycle: Created at OBSERVE, archived after VERIFY+LEARN

### KNOWLEDGE
- Purpose: Curated, cross-referenced entities
- Structure: Subdirectories for People, Companies, Ideas, Research, Blogs
- Each entity is a markdown file with YAML frontmatter (type, related, tags, created, updated)
- Cross-references: wikilinks `[[Page Name]]`, frontmatter `related: [slug1, slug2]`, tags, computed backlinks
- Lifecycle: Long-lived, curated, promoted from other tiers

### LEARNING
- Purpose: Meta-patterns derived from satisfaction signals
- Structure: Pattern files with frontmatter
- Lifecycle: Appended from satisfaction signals during LEARN phase

## DM-03: Relationship Entity Types [MEDIUM]

Entity Types (typed graph nodes):
- People — individuals the user interacts with or references
- Companies — organizations, products, services
- Ideas — concepts, theories, frameworks, discoveries
- Research — papers, articles, investigations, studies
- Blogs — regular content sources

Link types between entities:
- wikilink `[[Page Name]]` — explicit cross-reference
- related: [slug] — frontmatter-declared relationship
- backlink — computed reverse index from wikilinks
- tag — tag-based group association
- directory hierarchy — path-based group inference

## DM-04: Containment Zones [HIGH]

| Zone | Content | Exportable? |
|------|---------|-------------|
| Z1 | User identity (name, location, worldview, goals, DA identity) | NEVER |
| Z2 | Private communications (Telegram chat, iMessage, email) | NEVER |
| Z3 | Authentication secrets (API keys, tokens, SSH keys) | NEVER |
| Z4 | Financial data (banking, invoices, metrics) | NEVER |
| Z5 | Curated knowledge (People, Companies, Ideas) | With review |
| Z6 | Public code, documentation, public reference material | Freely |

Cross-zone write policy: Writes from Z1-Z4 destinations into Z5-Z6 are blocked unless explicitly permitted by zone policy annotation.

## DM-05: Config & Environment Entities [HIGH]

### Pulse Config (PULSE.toml)
- Sections: [voice], [hooks], [observability], [cron], [telegram], [imessage], [da], [performance], [syslog], [pulse]
- Each section has: enabled (bool), port (int), and type-specific settings

### User Config
- `.env` file for secrets (API keys, tokens)
- `PAI/USER/pronunciations.json` for voice pronunciation rules

### Job Definition (cron)
- Fields: id, schedule (cron expression), type (script/claude/webhook), payload, dispatch_targets, max_consecutive_failures, timeout_seconds

### Agent Definition
- Fields: name, role/persona, model_provider, voice_id, tool_set, prompt_template
- Stored as: `agents/{Name}.md`
