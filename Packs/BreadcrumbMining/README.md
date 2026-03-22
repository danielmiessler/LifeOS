---
name: BreadcrumbMining
pack-id: northwoodssentinel-breadcrumbmining-v1.0.0
version: 1.0.0
author: NorthwoodsSentinel
description: Mine tagged insights from AI conversation history — your natural breakthrough language is already a retrieval index. Extract it, categorize it, use it.
type: skill
purpose-type: [self-knowledge, insight-mining, conversation-analysis, metacognition]
platform: claude-code
dependencies: []
keywords: [breadcrumbs, mining, insights, conversation-history, chatgpt, claude, tagging, eureka, self-knowledge, metacognition, breakthrough, reflection]
---

# BreadcrumbMining

> Your AI conversations are the richest record of your own thinking that has ever existed. This pack mines them.

---

## The Problem

You've had hundreds of conversations with AI. Some of them contained genuine breakthroughs — moments where something clicked, where you saw a pattern for the first time, where you realized you'd been wrong about something important. You said "holy shit" or "I just realized" or "remember this" and then moved on to the next conversation.

Those insights are gone. Not deleted — just buried. Scattered across hundreds of conversation files with no index, no search, no way to find them again. You're rediscovering things you already discovered. You're losing insights that took real cognitive work to produce.

The fundamental issue: AI conversations are treated as disposable transactions, but the best ones contain irreplaceable records of your own thinking.

---

## The Solution

BreadcrumbMining provides two tools:

**breadcrumb-mine** — Scans your exported AI conversation history (ChatGPT JSON, Claude JSONL, or plain text) for breakthrough language. Searches for 25+ default tag patterns — both explicit ("remember this," "eureka," "bookmark this") and natural ("holy shit," "I just realized," "something just clicked," "why didn't I see this"). Extracts the surrounding context, auto-categorizes by theme (healing, flow, identity, product-idea, career, etc.), and outputs a searchable index sorted by significance.

**breadcrumb-tag** — Quick-capture during a live session. Say "remember this" or run `breadcrumb-tag "your insight"` and it's logged with timestamp, auto-detected tag type, and category. Designed for speed — capture in the 30 seconds before the insight fades.

Together they create a loop: tag while you work, mine later, discover what you forgot you knew.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Skill routing and trigger words |
| Methodology | `src/Methodology.md` | How breadcrumb mining works and what the patterns reveal |
| breadcrumb-mine | `src/Tools/breadcrumb-mine.ts` | Scan conversation exports for tagged insights |
| breadcrumb-tag | `src/Tools/breadcrumb-tag.ts` | Quick-capture insights in real time |
| Mine workflow | `src/Workflows/Mine.md` | Guide for running conversation mining |
| Tag workflow | `src/Workflows/Tag.md` | Guide for capturing live insights |
| Review workflow | `src/Workflows/Review.md` | Guide for reviewing recent breadcrumbs |

**Summary:**
- **Tools:** 2 TypeScript/bun CLI tools
- **Workflows:** 3 (mine, tag, review)
- **Default tag patterns:** 25+ (explicit + natural breakthrough language)
- **Auto-categories:** 10 (healing, flow, somatic, identity, product, career, relationship, AI, sacred-timeline, insight)
- **Supported formats:** ChatGPT JSON, Claude JSONL, Markdown/text
- **Dependencies:** bun runtime (no external APIs)

---

## What Makes This Different

This sounds like grep with extra steps. What makes it different?

Grep finds strings. BreadcrumbMining finds meaning. It knows that "holy shit" in a conversation about healing is a different kind of insight than "holy shit" in a conversation about a product idea. It understands that "I just realized" is a higher-weight signal than "I was thinking about." It auto-categorizes hits into themes and shows you the distribution of your own attention.

The distribution itself is the insight. When you mine 683 conversations and discover that 19% of your tagged moments are about healing and only 2% are about relationships, that tells you something no individual conversation could. You discover not just what you thought, but how you think.

And the tagging is natural. You don't learn a new system. You use the words you already use when something clicks. The tool finds the system in your existing language.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "mine my ChatGPT history" | Scans exported conversations for breadcrumbs |
| "remember this" or "eureka" | Tags the current insight with timestamp |
| "show my breadcrumbs" | Reviews recent tagged insights |
| "mine my conversations for patterns" | Full mining + category analysis |
| "breadcrumb-tag 'the moat is the corpus'" | Direct CLI capture |

---

## Example Usage

### Mining ChatGPT History

```
User: "mine my ChatGPT conversations"

AI:
1. Locates conversation export directory
2. Scans 683 JSON files for 25+ tag patterns
3. Finds 322 breadcrumbs across 10 categories

Output:
  Breadcrumbs found: 322
  Files processed:   683
  Categories:        10

    insight                140
    flow-protocol          34
    somatic-observation    30
    healing                29
    ai-insight             26
    career                 20
    product-idea           14
    relationship           10
    identity               10
    sacred-timeline        9

  Index saved: breadcrumb-index.md
```

### Live Tagging

```
User: "eureka: voice profiles are the moat, not the scoring algorithm"

AI:
  Tagged: [eureka] product-idea
  "eureka: voice profiles are the moat, not the scoring algorithm"
  Saved to: ~/.claude/breadcrumbs.md
```

### Reviewing Recent Breadcrumbs

```
User: "show me this week's breadcrumbs"

AI:
  Recent breadcrumbs (last 7 days):
  ─────────────────────────────────
  **2026-03-22 17:45** | [eureka] | ai-insight
  eureka: the pack system IS the collaboration model
  ---
  **2026-03-22 16:30** | [realization] | product-idea
  I just realized it's a service, not software
  ---
```

---

## Configuration

### No API Keys Required

Both tools run locally with zero external dependencies. They parse files and match patterns. No cloud calls.

### Custom Tags

Add your own breakthrough language:
```bash
breadcrumb-mine --dir ~/chats/ --tags "oh wow,wait what,no way"
```

### Supported Export Formats

| Platform | Format | How to Export |
|----------|--------|--------------|
| ChatGPT | JSON | Settings → Data Controls → Export data |
| Claude | JSONL | Session exports |
| Any | Markdown/text | Copy conversations to .md files |

### Output Locations

- **Mined index:** defaults to `breadcrumb-index.md` in current directory
- **Live tags:** defaults to `~/.claude/breadcrumbs.md`
- **Both customizable** with `--out` and `--file` flags

---

## Origin

Built after mining 62 tagged insights from 683 ChatGPT conversations that had accumulated over 10 months. The user had been unconsciously tagging breakthrough moments with phrases like "holy shit," "eureka," and "remember this" — natural language that turned out to be a searchable retrieval index. One afternoon of mining recovered flow laws, a sacred timeline, and an integration protocol that had been discovered and forgotten.

The insight: your AI conversations already contain a tagging system. You just haven't extracted it yet.

---

## Works Well With

- **Telos Pack** — Mined breadcrumbs populate goals, beliefs, wisdom, and project context
- **Thinking Pack** — Breadcrumb patterns can seed first-principles analysis or council debates
- **VoiceFidelity Pack** — Breadcrumbs reveal how you naturally express insights (voice patterns)

---

## Changelog

### 1.0.0 - 2026-03-22
- Initial release
- breadcrumb-mine: conversation history scanner with 25+ tag patterns
- breadcrumb-tag: real-time insight capture with auto-categorization
- 10 auto-categories with pattern-based inference
- ChatGPT JSON, Claude JSONL, and Markdown/text support
- Methodology document explaining the breadcrumb mining discovery
