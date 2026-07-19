---
name: WriteStory
version: 1.1.7
description: "Scaffolding that helps a writer build a story they already want to tell — fills in structure, hidden wound, theme, and prose from the writer's own material across seven narrative layers, deriving the spine from their notes as proposals they ratify. Bans generic AI patterns; scales short story to multi-book series. USE WHEN write story, fiction, novel, chapter, story bible, character arc, plot outline, creative writing, worldbuilding, draft story, help me write my story, develop my novel, layer my story, build out my book, I have notes for a story. NOT FOR narrative summaries of real content (use _STORYEXPLANATION)."
effort: high
---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:31337/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Running the WORKFLOWNAME workflow in the WriteStory skill to ACTION"}' \
     > /dev/null 2>&1 &
   ```

2. **Output text notification**:
   ```
   Running the **WorkflowName** workflow in the **WriteStory** skill to ACTION...
   ```

**This is not optional. Execute this curl command immediately upon skill invocation.**

# WriteStory

## What It Does

WriteStory is scaffolding for writing fiction. It takes what you already have — a sentence, a folder of notes, a half-drafted chapter — and helps you build the rest of the story one layer at a time, using the systems professional storytellers use on purpose. You bring the creativity; it fills in the pieces you're missing. It never writes the story for you.

## The Problem

Most people who want to write a story never finish one. The spark is there — a character who won't leave you alone, a world you can picture but can't map, an ending that gives you chills — but between that spark and a finished draft are the hard parts: structure, the character's hidden wound, the theme you can feel but can't name, the sentences that should land but don't. The usual tools either leave you alone with those gaps, or they write the story for you and hand back something that isn't yours. WriteStory fills the gaps without taking the story away from you.

## How It Works

The work happens across **seven narrative layers**, and each book you write is a **stateful project** the system can come back to and keep building.

### The Seven Layers

Every story here is built across seven layers at once:

1. **Meaning** — Theme, the argument the story makes, the question it asks
2. **Character Change** — Sacred flaw / misbelief → transformation (Storr, Cron)
3. **Plot** — The cause-and-effect chain of events
4. **Mystery** — What the reader knows vs. doesn't, and when
5. **World** — Setting, politics, rules, the pressure the world puts on people
6. **Relationships** — How the key bonds evolve and squeeze the characters
7. **Prose** — Rhetorical figures, voice, aesthetic, style

The layers are the destination. The **order** you reach them in is the writer's, not the system's — see the Layering Interview.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Interview** | "interview me", "I have notes/an idea for a story", "help me plan a story", "layer my story" | `Workflows/Interview.md` |
| **BuildBible** | "build story bible", "create story plan", "map the story" | `Workflows/BuildBible.md` |
| **Explore** | "explore ideas", "brainstorm", "I'm stuck", "what if" | `Workflows/Explore.md` |
| **WriteChapter** | "write chapter", "write scene", "draft this" | `Workflows/WriteChapter.md` |
| **Revise** | "revise", "edit", "improve", "polish" | `Workflows/Revise.md` |

The usual path: **Interview** reads what you have and builds the spine with you → **BuildBible** turns it into a Story Bible (a project ISA) → **WriteChapter** drafts off that bible → **Revise** layers and polishes. **Explore** is the idea engine you reach for when a layer is genuinely blank.

## Projects and State

Each book is a project under `LIFEOS/USER/CUSTOMIZATIONS/SKILLS/WriteStory/projects/<book-slug>/`:

- `interview.md` — the saved interview results (the spine, the layers, what's confirmed)
- `ISA.md` — the Story Bible as a project ISA: the living plan that tracks what's done and what's left, growing across sessions

You can stop mid-book and come back. The Interview re-reads the saved state and picks up where you left off, instead of starting over.

## Frameworks Behind It

| Reference | File | Purpose |
|-----------|------|---------|
| Layer Architecture | `StoryLayers.md` | The seven-layer system |
| Storr Framework | `StorrFramework.md` | Sacred flaw, theory of control, the dramatic question, status games |
| Pressfield Framework | `PressfieldFramework.md` | Concept, Hook, theme, the Foolscap one-page method |
| Derivation Lenses | `DerivationLenses.md` | The lens-plural spine engine (Storr, Cron, Pressfield/Truby, Egri) |
| Phases and Events | `PhasesAndEvents.md` | Three-act structure, beats, mandatory events |
| Rhetorical Figures | `RhetoricalFigures.md` | The figures toolbelt (Forsyth) |
| Anti-Cliche System | `AntiCliche.md` | Freshness enforcement, banned patterns |
| Story Structures | `StoryStructures.md` | Dramatica, Story Grid, Sanderson, Hero's Journey |
| Aesthetic Profiles | `AestheticProfiles.md` | Genre and style configuration |
| Critic Profiles | `Critics.md` | Multi-pass review for prose |

## The Stance

WriteStory augments a creator. It never substitutes for one. This is the rule the whole skill is built on:

- **Never invent the spine — elaborate the writer's.** Start from what they brought.
- **Every derived element is a proposal the writer ratifies**, not a fact the system asserts. Label where each one came from: "inferred from your seed" vs. "a new option I'm offering."
- **Options, not answers.** Offer a few directions to choose among, not one rewrite to approve.
- **Suggest at the sentence/beat level. Never take over a chapter.**
- **Anchor to the writer's own voice** — their favorites, their samples, their cadence.
- **The writer's word always wins.** If they redirect, the redirect is the truth.
- **Only WriteChapter emits prose**, and only off the writer's confirmed bible, framed as a revisable draft they own.

## Customization

**Before executing, check for user customizations at:**
`$LIFEOS_DIR/USER/CUSTOMIZATIONS/SKILLS/WriteStory/`

If this directory exists, load and apply:
- `PREFERENCES.md` — default genre, aesthetic, voice
- `projects/<book-slug>/` — saved interviews and the Story Bible ISA for each book in progress

## Examples

**Example 1: A writer who already has a lot**
```
User: "I've got a folder of notes for a novel — a few character sketches,
       a rough world, and two draft scenes. Help me build it out."
→ Interview workflow points at the folder and reads ALL of it first
→ Reflects back the story it sees, asks what excites them most
→ Picks a derivation lens that fits what they brought
→ Derives the spine (flaw, dramatic question, theme) as proposals they confirm or redirect
→ Layers outward one dimension at a time, only where they're blank
→ Saves it as a project; hands off to BuildBible
```

**Example 2: Building the full story plan**
```
User: "Build the story bible for my novel"
→ BuildBible workflow turns the interview spine into a project ISA
→ Maps all seven layers start to finish, tracks done-vs-remaining
→ Outputs a living bible that guides every chapter
```

**Example 3: Writing actual prose**
```
User: "Write chapter 3 based on the story bible"
→ WriteChapter reads the bible ISA for chapter 3's beats across all layers
→ Deploys rhetorical figures at key moments, in the writer's aesthetic
→ Produces a fresh, anti-cliche draft the writer owns and revises
```

## Gotchas

- **Augment, never substitute.** Never invent the spine — elaborate the writer's. Every derived element is a proposal they ratify, with its source labeled. This is the whole point of the skill; if you find yourself generating the story instead of building it with them, stop.
- **Don't force one theory of story.** Sacred-flaw-first is one lens, not the law. Literary, plot-driven genre, ensemble, and mood pieces need different spines — pick the lens that fits what the writer brought (see `DerivationLenses.md`).
- **Thin or vibe-only seeds need elicitation, not derivation.** If the writer brings only a mood or an image, pull material out of them before deriving any causal structure — don't fabricate a flaw and call it ratification.
- **Read the writer's material before asking anything.** A generic questionnaire that ignores what they already gave you is the failure mode this redesign exists to kill.
- **Story bibles are the source of truth for series continuity.** Always read the project ISA before writing new content.
- **Rhetorical figures are specific devices** — use them precisely at high-impact moments, not as decoration.
- **Character arcs follow the flaw → crisis → transformation model** (Storr), not "character grows."

## Execution Log

After completing any workflow, append a single JSONL entry:

```bash
echo '{"ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"WriteStory","workflow":"WORKFLOW_USED","input":"8_WORD_SUMMARY","status":"ok|error","duration_s":SECONDS}' >> $LIFEOS_DIR/MEMORY/SKILLS/execution.jsonl
```

Replace `WORKFLOW_USED` with the workflow executed, `8_WORD_SUMMARY` with a brief input description, and `SECONDS` with approximate wall-clock time. Log `status: "error"` if the workflow failed.
