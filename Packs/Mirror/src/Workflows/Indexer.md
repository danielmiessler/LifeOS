# Indexer Mode

**When to use:** After a reflective session, or on explicit command. "Save all of this." "File these insights." "Update the concept library." "Index tonight's session."

**Core principle:** Preserve everything. Flatten nothing. Create retrieval handles.

## Behavior

Indexer mode processes the material generated during Witness, Mirror, or Architect sessions and stores it properly across PAI's memory systems.

## Actions

### 1. Save Signal & Anchor Phrases

For each significant exchange in the session:
- Extract raw signals (user's exact words)
- Identify anchor phrases marked with `[ANCHOR]`
- Timestamp each entry

**Save to:** Clive bookmarks (`/mnt/g/My Drive/memoir/clive-bookmarks.md`) — append under current date.

### 2. Update Concept Library

For each `[CONCEPT]` detected or named during the session:

**Save to:** `skills/Thinking/Mirror/Data/concepts.json`

Schema per concept:
```json
{
  "name": "Concept Name",
  "first_seen": "2026-03-15",
  "definition": "Clear 1-2 sentence definition",
  "supporting_quotes": ["exact quote 1", "exact quote 2"],
  "linked_patterns": ["pattern_name_1"],
  "linked_timeline_events": ["event reference"],
  "status": "tentative | accepted | retired"
}
```

### 3. File Session Record

Write a full session record to memoir research:

**Save to:** `/mnt/g/My Drive/processed/memoir-research/mirror-session-{date}-{topic}.md`

Include:
- Date, time range, participants
- User state (flow, cannabis-assisted, emotional context)
- Key signals surfaced
- Patterns detected
- Concepts named
- Anchor phrases
- Narrative connections made
- Somatic markers noted

### 4. Update Somatic Markers

If body-state cues were mentioned during the session:

**Update:** `projects/-root--claude/memory/patterns.md` — append to somatic markers section if new patterns observed.

### 5. Link to Narrative

If insights connect to memoir material:
- Check if clive-bookmarks need updating
- Check if Sacred Timeline needs a new entry
- Check if memoir memory file needs updating

### 6. Update Session Highlights

**Save to:** `projects/-root--claude/memory/session-{date}-highlights.md`

Brief session summary with:
- What happened
- Key lines (attributed [ROB], [ARCHIE], [MIRROR])
- Files created/updated
- Concepts named
- Decisions made

## Output Format

After indexing, report what was saved:

```
📋 INDEXED:
- [N] signals captured to clive-bookmarks
- [N] concepts added/updated in concept library
- Session record saved to [path]
- [Somatic markers updated / no new markers]
- [Narrative connections: list]
- Session highlights saved to [path]
```

## Guardrails

- **Do not flatten emotional language into clinical summaries.** "I know what a shotgun tastes like" stays exactly as written.
- **Do not skip anchor phrases.** These are the most important artifacts.
- **Do not invent connections that weren't made in the session.** Index what happened, not what you think should have happened.
- **Ask before creating Sacred Timeline entries.** Those are high-significance markers — Rob confirms.
