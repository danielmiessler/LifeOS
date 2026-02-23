# BuildBible Workflow

Construct the comprehensive Story Bible — a PRD-based plan that maps the entire story across all seven layers from start to finish.

## Purpose

The Story Bible is the central artifact of the WriteStory system. It IS the ISC for the story — a comprehensive, layered plan that becomes the verification criteria for every chapter written. This is what transforms scattered ideas into a structured, writable narrative.

## Prerequisites

- Structured input from Interview workflow (or equivalent user-provided content)
- Read `StoryLayers.md` for layer definitions
- Read `StorrFramework.md` for character construction protocol
- Read `StoryStructures.md` for structural scaffolding

## Procedure

### Step 1: Establish Story Parameters

From the Interview output or user input, confirm:
- **Scope:** Short story / Novella / Novel / Series
- **Genre:** Primary + secondary genres
- **Aesthetic Profile:** From AestheticProfiles.md
- **POV:** First person / Third limited / Third omniscient / Second / Multiple POV
- **Tense:** Past / Present

### Step 2: Build Character Architecture

For EACH major character, follow the Storr Character Construction Protocol (from StorrFramework.md):

1. Define the sacred flaw
2. Establish the origin wound
3. Set the external want
4. Set the internal need (inverse of flaw)
5. Define the philosophical purpose (how they connect to theme)
6. Map the crisis point
7. Choose arc direction (positive/negative/flat)
8. Design status dynamics
9. Plant mystery hooks
10. Connect to theme

Create ISC criteria for each major character's arc:
```
TaskCreate: "ISC-CHAR-[Name]: [Character] transforms from [flaw state] to [new state]"
TaskCreate: "ISC-CHAR-[Name]: Sacred flaw [flaw] is established through behavior by [beat]"
TaskCreate: "ISC-CHAR-[Name]: Crisis forces choice between [flaw] and [need] at [beat]"
```

### Step 3: Map the Plot Skeleton

Using Save the Cat beats as scaffolding, map the plot:

For EACH of the 15 beats:
1. What event occurs?
2. What causes it? (causal chain from previous beat)
3. What does it cause? (leads to next beat)
4. Which character decisions drive it?

Create ISC criteria for major plot beats:
```
TaskCreate: "ISC-PLOT: Catalyst event [event] disrupts [character]'s world at ~10%"
TaskCreate: "ISC-PLOT: Midpoint [false victory/defeat] raises stakes at ~50%"
TaskCreate: "ISC-PLOT: All Is Lost moment exposes [character]'s sacred flaw at ~75%"
```

### Step 4: Design the Mystery Architecture

Map information management across the narrative:

1. **Primary mystery:** What central question drives the whole story?
2. **Mystery timeline:** When is each piece of information revealed?
3. **Clue plants:** What must be planted early for later payoff?
4. **Red herrings:** What false trails maintain uncertainty?
5. **Reveal cascade:** How do revelations build on each other?

For each mystery element, track:
- Plant point (when/where it's introduced)
- Development points (when it gets complicated/redirected)
- Resolution point (when it's answered)
- Reader state (what the reader believes at each point)

Create ISC criteria:
```
TaskCreate: "ISC-MYSTERY: Primary mystery [question] introduced by [beat]"
TaskCreate: "ISC-MYSTERY: [N] clues planted before reveal at [beat]"
TaskCreate: "ISC-MYSTERY: At least [N] micro-mysteries active at any point"
```

### Step 5: Build the World Framework

Map world elements needed for the story:

1. Physical geography (only what the story visits/references)
2. Political/power structures (only what affects characters)
3. Rules/magic systems (if applicable — apply Sanderson's Laws)
4. Cultural details (only what drives character behavior or conflict)
5. History (only what matters to the present story)

**Rule:** Every world element must serve the story. If you can remove it and nothing changes, remove it.

### Step 6: Map Relationship Arcs

For each key relationship:

1. Initial state (how they meet, first dynamic)
2. Tension points (disagreements, challenges)
3. Deepening moments (vulnerability, shared experience)
4. Crisis point (relationship tested)
5. Resolution (new equilibrium)

Special attention to the **Influence Character** relationship — this is the relationship that most directly challenges the protagonist's sacred flaw.

### Step 7: Define Prose Strategy

Based on the Aesthetic Profile:

1. Which rhetorical figures to use at key moments
2. Sentence length and complexity patterns
3. POV consistency rules
4. Dialogue voice guidelines per character
5. Description density by scene type

### Step 8: Assemble the Full Beat Map

Now create the FULL beat map — every major story beat with ALL seven layers mapped:

```markdown
## Beat Map

### Beat 1: Opening Image (0-1%)
- **MEANING:** [thematic element present]
- **CHARACTER:** [sacred flaw visible through behavior]
- **PLOT:** [establishing event]
- **MYSTERY:** [first question planted]
- **WORLD:** [initial setting established]
- **RELATIONSHIP:** [key bond introduced]
- **PROSE:** [register, tone, key figures planned]

### Beat 2: Setup / Theme Stated (1-10%)
[same structure]

### Beat 3: Catalyst (10%)
[same structure]

... [continue for all 15 beats]

### Beat 15: Final Image (99-100%)
[same structure]
```

### Step 9: Create the Story Bible PRD

Write the Story Bible as a PRD file:

**Location:** Project directory `.prd/` or `~/.claude/plans/`

```markdown
---
prd: true
id: PRD-{YYYYMMDD}-{story-slug}
status: IN_PROGRESS
created: {date}
updated: {date}
iteration: 1
scope: [short-story | novella | novel | series]
genre: [primary genre]
aesthetic: [profile name]
parent: null
children: []
---

# Story Bible: [Title]

> [One sentence: what this story is about thematically]

## STATUS
| What | State |
|------|-------|
| Progress | 0/{N} criteria passing |
| Scope | [scope] |
| Next action | [first writing action] |

## CHARACTERS
[Full character profiles with sacred flaws, wants, needs]

## BEAT MAP
[Full 15-beat map with all 7 layers per beat]

## MYSTERY ARCHITECTURE
[Information management timeline]

## WORLD FRAMEWORK
[Essential world elements]

## RELATIONSHIP ARCS
[Key relationship timelines]

## PROSE STRATEGY
[Aesthetic profile, figure deployment plan]

## CRITERIA
- [ ] C1: [First story criterion]
- [ ] C2: [Second story criterion]
... [all ISC criteria from steps 2-7]

## LOG
[Session entries]
```

### Step 10: Scale for Series (if applicable)

For multi-book series:
1. Create a PARENT PRD for the series
2. Create CHILD PRDs for each book
3. Map cross-book arcs (character change that spans books)
4. Track series-level mysteries and their per-book development
5. Ensure each book works as a satisfying standalone AND advances the series

```
Parent: PRD-{date}-{series-slug}.md
Children:
  - PRD-{date}-{series-slug}--book-1.md
  - PRD-{date}-{series-slug}--book-2.md
  - PRD-{date}-{series-slug}--book-3.md
```

### Step 11: Output and Next Steps

Present the Story Bible to the writer with:
1. Summary of what's been mapped
2. Any gaps or decisions still needed
3. Recommendations for which chapters to write first
4. Option to run **Explore** workflow for any layer that needs creative development
5. Option to jump directly to **WriteChapter** for the strongest section

The Story Bible is now the living document that guides all writing.
