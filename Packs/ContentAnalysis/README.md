---
name: ContentAnalysis
pack-id: danielmiessler-contentanalysis-v1.0.0
version: 1.0.0
author: danielmiessler
description: Content-adaptive wisdom extraction from videos, podcasts, articles, and YouTube -- dynamic sections built from what the content actually contains
type: skill
purpose-type: [content, extraction, analysis, wisdom]
platform: claude-code
dependencies: []
keywords: [content-analysis, extract-wisdom, youtube, podcast, video, article, insights, takeaways, wisdom, extraction]
---

# ContentAnalysis

> Content-adaptive wisdom extraction -- dynamic sections built from what the content actually contains, not static templates.

---

## The Problem

Traditional content extraction follows a fixed template: IDEAS, QUOTES, HABITS, FACTS, REFERENCES. Every piece of content gets the same headers regardless of what it actually contains. A programming interview gets a "HABITS" section. A geopolitical analysis gets "FACTS" that are really just opinions. The output feels mechanical and misses the real gems because the sections were decided before the content was even read.

- **Static sections miss domain-specific wisdom** -- a security talk has threat model insights, not generic "ideas"
- **Forced categories create padding** -- filling a HABITS section when the content has none
- **Uniform tone reads like a committee report** -- compressed info nuggets instead of genuine observations
- **No depth control** -- you get the same exhaustive output whether you want a quick hit or a deep dive

The fundamental issue: the extraction format should serve the content, not the other way around.

---

## The Solution

ContentAnalysis detects what wisdom domains actually exist in the content and builds custom sections around them. A programming interview gets "Programming Philosophy" and "Developer Workflow Tips." A business podcast gets "Contrarian Business Takes" and "Money Philosophy." A security talk gets "Threat Model Insights" and "Defense Strategies."

**Core capabilities:**

1. **Dynamic section detection** -- Reads the content first, identifies wisdom domains, then builds sections around what is actually there
2. **Five depth levels** -- From Instant (one killer section) to Comprehensive (10-15 sections with themes and connections)
3. **Conversational voice** -- Bullets that sound like someone telling a friend about it, not a book report
4. **Quality standards** -- Every bullet earns its place; no padding, no inventory lists, no committee language
5. **Closing sections** -- One-Sentence Takeaway, If You Only Have 2 Minutes, References and Rabbit Holes (depth-dependent)

**This is the next generation of extract_wisdom.** The sections adapt because the content dictates them.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill definition | `src/SKILL.md` | Main skill routing and workflow dispatch |
| ExtractWisdom sub-skill | `src/ExtractWisdom/SKILL.md` | Dynamic content extraction skill definition with full methodology |
| Extract workflow | `src/ExtractWisdom/Workflows/Extract.md` | Step-by-step extraction workflow |

**Summary:**
- **Directories:** 2 (ExtractWisdom, ExtractWisdom/Workflows)
- **Files:** 3
- **Hooks registered:** 0
- **Dependencies:** None (works standalone, enhanced by PAI voice and writing style configuration)

---

## What Makes This Different

This sounds similar to the original extract_wisdom which also pulls insights from content. What makes this approach different?

The original extract_wisdom uses static sections -- IDEAS, QUOTES, HABITS, FACTS, REFERENCES -- for every piece of content. ContentAnalysis reads the content first, figures out what wisdom domains are present, and builds sections around what it finds. A talk about AI agents gets "Self-Modifying Software" and "The Agent Spectrum" instead of generic IDEAS. The tone follows a specific voice standard (Level 3 conversational) that produces bullets people actually want to read, not compressed information nuggets. Depth levels let you choose between a 30-second skim and a comprehensive deep dive.

- Dynamic sections adapted to each piece of content, not static templates
- Five depth levels from Instant to Comprehensive
- Conversational tone that reads like someone telling you about it
- Every bullet passes the "Would I tweet this?" test
- Section names read like magazine headlines, not category labels

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "extract wisdom from [URL]" | Full-depth extraction with 5-12 dynamic sections |
| "analyze this video" | Content scan, section detection, extraction with closing sections |
| "extract wisdom (fast)" | Fast-depth extraction: 3 sections, 3 bullets each, no closing sections |
| "extract wisdom at comprehensive level" | Maximum depth: 10-15 sections plus Themes and Connections |
| "key takeaways from this podcast" | Full extraction with emphasis on actionable insights |
| "what did I miss in this article" | Full extraction focused on non-obvious insights |

The skill auto-routes all content analysis requests to the ExtractWisdom workflow.

---

## Example Usage

### Full Extraction (Default)

```
User: "extract wisdom from [YouTube URL about AI agents]"

AI responds:
# EXTRACT WISDOM: Building AI Agents That Actually Work
> A deep dive into agent engineering with [speaker] -- from self-modifying
> software to the economics of building with AI

---

## The Death of 80% of Apps

- He wasn't trying to build self-modifying software. He just let the agent
  see its own source code and it started fixing itself.
- Most apps are just a UI on a database. Agents can generate those on the fly.
  The app store as we know it is already dead.
- ...

## Money Stops Mattering

- Past a certain point, money stops mattering. A cheeseburger is a cheeseburger
  no matter how rich you are.
- Every VC is offering hundreds of millions. He genuinely doesn't care.
- ...

[... more dynamic sections ...]

---

## One-Sentence Takeaway

The best agents aren't programmed -- they're given access to their own source
code and a reason to improve.

## If You Only Have 2 Minutes

- Self-modifying software happened by accident, not design
- 80% of current apps will be replaced by agent-generated UIs
- ...

## References & Rabbit Holes

- **Claude Code** -- The agent framework he built everything on
- **MCP protocol** -- The tool integration layer that makes agents practical
```

### Fast Extraction

```
User: "extract wisdom (fast) from this podcast episode"

AI responds:
# EXTRACT WISDOM: [Title]
> [One-line description]

## [Dynamic Section 1]
- [3 tight bullets]

## [Dynamic Section 2]
- [3 tight bullets]

## [Dynamic Section 3]
- [3 tight bullets]
```

---

## Configuration

### Base Configuration

No configuration required. The skill works out of the box with sensible defaults (Full depth level).

### Optional Voice Configuration

If PAI is installed, the extraction voice is calibrated from:
- `~/.claude/PAI/USER/WRITINGSTYLE.md` -- Canonical voice definition
- `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/` -- Skill-specific preferences

Without these files, the skill uses its built-in Level 3 conversational voice standards.

---

## Customization

### Recommended Customization

No customization needed -- the skill adapts dynamically to each piece of content.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Voice/tone preferences | `USER/SKILLCUSTOMIZATIONS/ExtractWisdom/PREFERENCES.md` | Adjusts bullet voice and style |
| Default depth level | `USER/SKILLCUSTOMIZATIONS/ExtractWisdom/PREFERENCES.md` | Changes default from Full to another level |
| Section preferences | `USER/SKILLCUSTOMIZATIONS/ExtractWisdom/PREFERENCES.md` | Always-include or always-exclude section types |

Create the customization directory at:
```
~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/ExtractWisdom/
```

---

## Credits

- **Original concept:** Daniel Miessler -- developed as the next generation of [extract_wisdom](https://github.com/danielmiessler/fabric) within the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The limitations of static content extraction templates

---

## Related Work

- **Fabric extract_wisdom** -- The original static-section content extractor that inspired this dynamic approach
- **PAI Writing Style** -- Voice definition that calibrates extraction tone

---

## Works Well With

- **Agents Pack** -- Multi-perspective content analysis using parallel agents
- **Investigation Pack** -- Research workflows that produce content needing extraction
- **PAI Voice Infrastructure** -- Audio narration of extraction results

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Dynamic section detection based on content analysis
- Five depth levels: Instant, Fast, Basic, Full, Comprehensive
- Level 3 conversational voice standard
- Closing sections: One-Sentence Takeaway, If You Only Have 2 Minutes, References and Rabbit Holes
- Comprehensive-level Themes and Connections synthesis
