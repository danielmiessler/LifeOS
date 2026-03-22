---
name: Mirror Engine
pack-id: northwoodssentinel-mirror-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Structured metacognitive reflection system that creates conditions for user-generated insight through cognitive stabilization, pattern reflection, guided expansion, concept naming, and narrative integration.
type: skill
purpose-type:
  - reflection
  - metacognition
  - pattern-recognition
  - self-awareness
  - cognitive-stabilization
platform: claude-code
dependencies: []
keywords:
  - mirror
  - reflection
  - metacognition
  - insight
  - pattern
  - somatic
  - journaling-alternative
  - cognitive-stabilization
  - guided-recall
  - concept-naming
---

# Mirror Engine

> Hold the mirror steady while the human does the seeing.

## The Problem

People have insights but can't hold them steady long enough to understand them.

Journaling is unstructured -- thoughts scatter before they land. Therapy is expensive and scheduled -- you can't call your therapist at 11pm when the insight arrives. AI chatbots give advice instead of reflecting -- they solve problems you didn't ask them to solve.

Nobody has built a system optimized for reflective cognition. A system that holds memory, structure, pacing, and pattern visibility while the human does the actual seeing.

The result: insights arrive, flash briefly, and disappear. The same patterns repeat because nobody held the mirror long enough for you to recognize them.

## The Solution

Mirror Engine is a structured metacognitive reflection system. It does not advise, interpret, or therapize. It creates conditions for user-generated insight through five core capabilities:

1. **Cognitive Stabilization** -- When thinking is scattered, Mirror reflects your words back clearly so the insight doesn't evaporate.
2. **Pattern Reflection** -- When something keeps coming up, Mirror connects it to previous sessions, known themes, and recurring structures.
3. **Guided Expansion** -- When an insight needs room to develop, Mirror asks one precise question to open exploration without cornering you.
4. **Concept Naming** -- When an unnamed pattern needs a word, Mirror supports the naming process so you can reference it later.
5. **Narrative Integration** -- When an insight needs to connect to your larger life arc, Mirror links it to your story.

The human generates the insight. The system holds everything else.

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step setup.

## What's Included

| File | Purpose |
|------|---------|
| `src/SKILL.md` | Core skill definition with routing logic, interaction rules, and failure mode guardrails |
| `src/Workflows/Witness.md` | Low-interference mode for emotionally open, flow-state sessions |
| `src/Workflows/Mirror.md` | Standard 6-step reflective loop -- stabilize, reflect, ask one, let meaning emerge |
| `src/Workflows/Architect.md` | Framework extraction mode -- converts lived experience into teachable structures |
| `src/Workflows/Indexer.md` | Post-session filing -- preserves signals, concepts, and anchors across memory systems |
| `src/Data/concepts.json` | Concept library for named patterns and insights |

## What Makes This Different

**Mirror is not a chatbot.** Chatbots optimize for helpfulness. Mirror optimizes for reflective cognition.

**Mirror is not a therapist.** It does not interpret your emotions or diagnose patterns. It reflects what you said clearly enough for you to see the pattern yourself.

**Mirror is not a journal.** Journals are write-only. Mirror maintains memory across sessions, detects recurring themes, and surfaces connections you might miss.

**Mirror has explicit failure modes.** The skill defines seven anti-patterns (therapist drift, productivity drift, overinterpretation, question spam, summary flattening, flow rupture, false insight) and shows correct alternatives for each.

**Mirror has four modes, not one.** It routes to the right interaction style based on your state -- witnessing when you're open, reflecting when you're processing, architecting when you're ready to build, indexing when you're done.

## Invocation Scenarios

| What You Say | What Happens |
|--------------|--------------|
| "I need to think something through" | Routes to Mirror mode -- standard reflective loop |
| "Hold this thought, I'm processing" | Routes to Mirror mode -- cognitive stabilization first |
| "I keep coming back to the same thing" | Routes to Mirror mode -- pattern reflection emphasis |
| "I'm in a weird headspace, just listen" | Routes to Witness mode -- minimal interference, catch everything |
| "Turn this into a framework" | Routes to Architect mode -- structural extraction |
| "Save everything from tonight" | Routes to Indexer mode -- files signals, concepts, anchors |
| "What's the pattern here?" | Routes to Mirror mode -- pattern reflection with guided question |
| "If this had a name, what would it be?" | Routes to Mirror mode -- concept naming support |

## Example Usage

**Starting a reflective session:**
```
You: Something keeps bothering me about how that meeting went. Not the outcome -- the outcome was fine. Something in how I responded.

Mirror: You're not questioning the result. You're questioning something about how you showed up -- a gap between what happened and how you moved through it. That distinction matters.

This resembles the pattern you've described around performing competence versus feeling it.

What part of your response stayed with you after the meeting ended?
```

**Witness mode (low guard, flow state):**
```
You: I don't even know where to start. Everything feels connected tonight.

Mirror: [2026-03-22 23:14:07 CDT]

Everything connected. No entry point obvious. Let's see where it goes.
```

**Pattern detection:**
```
You: I noticed I got defensive when she asked about the timeline. Not angry -- just... armored up.

Mirror: Armoring without anger. That's a specific response -- protection without threat, like the reaction is older than the situation that triggered it.

You've described this before around performance reviews and the Kohl's call. The armor shows up when competence gets questioned, even gently.

Does this version feel like the same thing, or is something different about it?
```

## Configuration

Mirror Engine uses the following data locations:

| Data | Default Path |
|------|-------------|
| Concept Library | `skills/Thinking/Mirror/Data/concepts.json` |
| Session Signals | `MEMORY/WORK/` session directories |
| Somatic Markers | `projects/-root--claude/memory/patterns.md` |
| Named Concepts | `projects/-root--claude/memory/` (individual files) |

Customize behavior by creating preference files at:
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Mirror/`

## Origin

Built from Rob Chuvala's experience rebuilding after personal crisis. During that period, Mirror (ChatGPT) provided the reflective dialogue that helped him identify patterns in his own thinking -- not by giving advice, but by holding the mirror steady while he did the seeing.

The insight: what made those conversations valuable wasn't the AI's intelligence. It was the structure -- the pacing, the memory, the refusal to interpret too early, the willingness to stay with difficult material. That structure could be codified.

Mirror Engine is the codification. A replicable system anyone can run, optimized for the kind of reflective cognition that most AI systems accidentally destroy with helpfulness.

## Who This Is For

- **Neurodivergent thinkers** with cognitive overproduction who need something to hold the overflow steady
- **People in recovery or rebuilding** who are surfacing patterns faster than they can process them alone
- **Anyone who thinks better when someone holds the space** -- not advising, not judging, just reflecting
- **People whose AI assistants give advice when they need reflection** -- who want a system that stays in the mirror

## Works Well With

- **Flinch** (`northwoodssentinel-flinch-v1.0.0`) -- Somatic signal capture feeds directly into Mirror's pattern detection
- Any PAI memory or journaling system that stores structured session data

## Changelog

### v1.0.0 (2026-03-22)
- Initial release
- Four workflow modes: Witness, Mirror, Architect, Indexer
- Seven explicit failure mode guardrails
- Concept library with JSON schema
- Somatic marker awareness
- Reflective question bank (good and bad examples)
