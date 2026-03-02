---
name: WriteStory
description: Layered fiction writing system using Will Storr's storytelling science and rhetorical figures. USE WHEN write story, fiction, novel, short story, book, chapter, story bible, character arc, plot outline, creative writing, worldbuilding, narrative, mystery writing, dialogue, prose, series planning.
---

## 🚨 MANDATORY: Voice Notification (REQUIRED BEFORE ANY ACTION)

**You MUST send this notification BEFORE doing anything else when this skill is invoked.**

1. **Send voice notification**:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
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

Layered fiction writing system that constructs stories across seven simultaneous narrative dimensions, powered by Will Storr's *The Science of Storytelling* and Mark Forsyth's *The Elements of Eloquence*.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/WriteStory/`

If this directory exists, load and apply:
- `PREFERENCES.md` - User preferences, default genre, aesthetic, voice
- Additional files specific to the skill

## Workflow Routing

Route to the appropriate workflow based on the request.

**When executing a workflow, output this notification directly:**

```
Running the **WorkflowName** workflow in the **WriteStory** skill to ACTION...
```

| Workflow | Trigger | File |
|----------|---------|------|
| **Interview** | "interview me", "extract my story ideas", "help me plan a story" | `Workflows/Interview.md` |
| **BuildBible** | "build story bible", "create story plan", "map the story" | `Workflows/BuildBible.md` |
| **Explore** | "explore ideas", "brainstorm", "creative exploration", "what if" | `Workflows/Explore.md` |
| **WriteChapter** | "write chapter", "write scene", "write prose", "draft" | `Workflows/WriteChapter.md` |
| **Revise** | "revise", "edit", "improve", "polish", "rewrite" | `Workflows/Revise.md` |

## The Seven Story Layers

Every story in this system is constructed across seven simultaneous layers:

1. **Meaning** — Theme, philosophical argument, lesson
2. **Character Change** — Sacred flaw -> transformation arc (Storr)
3. **Plot** — Cause-and-effect chain of events
4. **Mystery** — Information management (reader knows vs. doesn't)
5. **World** — Setting, politics, physical environment, rules
6. **Relationships** — How key bonds evolve and pressure characters
7. **Prose** — Rhetorical figures, voice, aesthetic, style

## Core References

| Reference | File | Purpose |
|-----------|------|---------|
| Layer Architecture | `StoryLayers.md` | Seven-layer system definition |
| Storr Framework | `StorrFramework.md` | Character change, sacred flaw, mystery |
| Rhetorical Figures | `RhetoricalFigures.md` | Comprehensive rhetorical figures catalogue |
| Anti-Cliche System | `AntiCliche.md` | Freshness enforcement, banned patterns |
| Story Structures | `StoryStructures.md` | Save the Cat, Dramatica, Story Grid |
| Aesthetic Profiles | `AestheticProfiles.md` | Genre and style configuration |
| Critic Profiles | `Critics.md` | Multi-pass review system for prose refinement |

## Quick Reference

- **Theoretical Foundation:** Storr (character science) + Forsyth (rhetoric) + classical rhetoric
- **Story Bible:** PRD-based plan mapping all 7 layers start-to-finish
- **Scale:** Short story (100s of ISC) to multi-book series (10,000s of ISC)
- **Anti-Cliche:** Built-in freshness system bans generic AI patterns
- **Aesthetic:** Configurable per project (Adams, Tolkien, sparse sci-fi, etc.)

## Examples

**Example 1: Starting from scratch**
```
User: "I have an idea for a fantasy novel about an elven princess raised by orcs"
→ Invokes Interview workflow
→ Extracts character concepts, world details, themes
→ Maps ideas across seven story layers
→ Produces structured input for BuildBible
```

**Example 2: Building the full story plan**
```
User: "Build the story bible for my novel"
→ Invokes BuildBible workflow
→ Creates Story Bible PRD with all layers mapped start-to-finish
→ Identifies milestones, character transformations, mystery reveals
→ Outputs comprehensive layered narrative plan
```

**Example 3: Writing actual prose**
```
User: "Write chapter 3 based on the story bible"
→ Invokes WriteChapter workflow
→ Reads Story Bible PRD for chapter milestones across all layers
→ Deploys rhetorical figures for memorable dialogue
→ Produces fresh, anti-cliche prose in configured aesthetic
```
