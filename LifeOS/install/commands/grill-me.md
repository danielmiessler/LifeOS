---
name: grill-me
description: Relentless checkpointed discovery interview that interrogates a half-formed idea until its shape is clear, then hands off to ISA Scaffold. Routes to the ISA skill's Grill workflow. USE WHEN /grill-me, grill me, discovery interview, figure out the shape, brainstorm before scaffolding an ISA. NOT FOR filling an existing ISA's thin sections (use ISA Interview).
argument-hint: <topic> [slug]
---

# grill-me — ISA Grill workflow

Invoke the ISA skill's **Grill** workflow on `$ARGUMENTS`:

```
Skill("ISA", "grill me on $ARGUMENTS")
```

If `$ARGUMENTS` is empty, ask what idea/plan/decision to grill, then proceed.

Grill walks the design tree one question at a time (recommending an answer each turn, exploring the codebase instead of asking when it can), checkpoints every turn to `MEMORY/WORK/{slug}/grill.md`, runs a pre-mortem→ISC pass, and hands off to `ISA Scaffold`. Full procedure: `~/.claude/skills/ISA/Workflows/Grill.md`.
