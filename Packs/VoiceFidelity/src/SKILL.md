---
name: VoiceFidelity
description: Voice fidelity scoring for AI-assisted writing — extract voice profiles, score documents, detect indexical grounding failures. USE WHEN voice fidelity, voice profile, extract voice, score voice, does this sound like me, prufrock, indexical grounding, voice check, voice audit, voice extract, voice score, check my writing, sound like me.
---

## Customization

**Before executing, check for user customizations at:**
`~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/VoiceFidelity/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# VoiceFidelity

Voice fidelity scoring and indexical grounding detection for AI-assisted writing. Three tools: extract your voice profile, score documents against it, audit for grounding failures.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Extract** | "extract voice", "build voice profile", "ingest corpus" | `Workflows/Extract.md` |
| **Score** | "score this", "voice check", "does this sound like me" | `Workflows/Score.md` |
| **Audit** | "run prufrock", "grounding audit", "full voice audit" | `Workflows/Audit.md` |

## Quick Reference

| Tool | Command | What It Does |
|------|---------|-------------|
| voice-extract | `bun Tools/voice-extract.ts --corpus ~/writing/` | Corpus → JSON voice profile |
| voice-score | `bun Tools/voice-score.ts document.md` | Score document against profile (9 checks, pass at 70) |
| prufrock | `bun Tools/prufrock.ts document.md` | 10-layer indexical grounding audit |

**Full documentation:**
- Detection framework: `IndexicalGroundingFramework.md`
- Voice card format: `VoiceCardTemplate.md`

## Examples

**Example 1: Extract a voice profile**
```
User: "extract my voice profile from my blog posts"
→ Invokes Extract workflow
→ Runs voice-extract on specified corpus
→ Returns JSON profile with scoring thresholds
```

**Example 2: Score a document**
```
User: "does this deliverable sound like me?"
→ Invokes Score workflow
→ Runs voice-score against default profile
→ Returns 9-check breakdown with pass/fail
```

**Example 3: Full audit before publishing**
```
User: "run prufrock on this before I send it"
→ Invokes Audit workflow
→ Runs prufrock (5 automated + 5 manual layers)
→ Returns grounding score + manual checklist
```
