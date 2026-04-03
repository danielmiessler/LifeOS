---
name: Media
pack-id: danielmiessler-media-v1.0.0
version: 1.0.0
author: danielmiessler
description: Visual and video content creation — illustrations, diagrams, infographics, header images, thumbnails, comics, and programmatic video via Remotion
type: skill
purpose-type: [media, visual-content, video-production, image-generation]
platform: claude-code
dependencies: []
keywords: [art, illustrations, diagrams, mermaid, infographics, thumbnails, comics, remotion, video, animation, motion-graphics, image-generation, header-images, visualizations]
---

# Media

> Visual and video content creation — from editorial illustrations to programmatic video, all from natural language.

---

## The Problem

Visual content is one of the biggest bottlenecks in publishing. Creating a blog header image, a technical diagram, a YouTube thumbnail, or a short animation requires switching between multiple tools, each with its own interface and workflow. You end up:

- **Context-switching constantly** — leaving your writing environment to open Figma, Canva, After Effects, or an image generator
- **Losing creative momentum** — by the time the visual is done, you forgot what you were writing
- **Settling for stock images** — because custom visuals take too long
- **Skipping video entirely** — because the toolchain is too complex for quick animations

The fundamental issue: visual and video creation should be as fast as describing what you want.

---

## The Solution

The Media skill adds a unified interface for all visual and video content creation. Describe what you want in natural language and the system routes to the right workflow, generates the content, and delivers it for review.

**Art subsystem (static visuals):**
1. **Image Generation** — Multiple model backends (Gemini, Flux, GPT Image, Midjourney) with configurable style and size
2. **20 Specialized Workflows** — Purpose-built pipelines for blog headers, technical diagrams, mermaid flowcharts, comparisons, timelines, taxonomies, comics, annotated screenshots, and more
3. **Composition Tools** — Thumbnail compositing, background removal, prompt engineering
4. **Style Consistency** — Reference images and aesthetic preferences carry across all outputs

**Remotion subsystem (programmatic video):**
5. **React-Based Video** — Build compositions in code with Remotion, rendered to MP4
6. **Art Integration** — Video themes derive from Art preferences for visual consistency
7. **28 Reference Patterns** — Animations, transitions, captions, charts, audio, 3D, and more
8. **Content-to-Animation** — Turn existing content into motion graphics automatically

All generated media goes to `~/Downloads/` first for preview before final placement.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level routing between Art and Remotion subsystems |
| Art skill | `src/Art/SKILL.md` | Visual content creation skill definition and workflow routing |
| Art workflows | `src/Art/Workflows/` | 20 specialized visual workflows (Essay, Mermaid, Comparisons, etc.) |
| Art tools | `src/Art/Tools/` | TypeScript tools: Generate.ts, ComposeThumbnail.ts, GeneratePrompt.ts, GenerateMidjourneyImage.ts |
| Art library | `src/Art/Lib/` | Support code: Discord bot, Midjourney client |
| Art examples | `src/Art/Examples/` | Reference images for style consistency |
| Remotion skill | `src/Remotion/SKILL.md` | Video creation skill definition |
| Remotion docs | `src/Remotion/*.md` | ArtIntegration, CriticalRules, Patterns |
| Remotion tools | `src/Remotion/Tools/` | Render.ts, Theme.ts, plus 28 Ref-*.md pattern reference files |
| Remotion workflows | `src/Remotion/Workflows/` | ContentToAnimation.md |

**Summary:**
- **Subdirectories:** 2 subsystems (Art, Remotion)
- **Art workflows:** 20 (AnnotatedScreenshots, Aphorisms, Comics, Comparisons, CreatePAIPackIcon, D3Dashboards, Essay, Frameworks, Maps, Mermaid, RecipeCards, RemoveBackground, Stats, Taxonomies, TechnicalDiagrams, Timelines, Visualize, YouTubeThumbnailChecklist, AdHocYouTubeThumbnail, BrandWallpaper)
- **Remotion reference files:** 28 pattern docs
- **Tools:** 6 TypeScript files across both subsystems
- **Dependencies:** bun (for running TypeScript tools), API keys for image generation models

---

## What Makes This Different

This sounds similar to using an image generation API directly, which also creates images from text. What makes this approach different?

The Media skill is not just an API wrapper. It provides 20 specialized workflows that each understand the specific requirements of their output type. A blog header workflow knows about aspect ratios, text placement zones, and editorial aesthetics. A technical diagram workflow knows about architecture patterns, component layouts, and labeling. A YouTube thumbnail workflow knows about face positioning, text readability at small sizes, and click-through optimization. Each workflow applies domain-specific knowledge before any model is called, producing results that require far less iteration than raw prompting.

- Works with multiple generation backends (Gemini, Flux, GPT Image, Midjourney)
- Style preferences persist across all outputs for brand consistency
- Reference images ensure character and aesthetic consistency
- Remotion integration extends from static images to programmatic video
- All output goes to Downloads for preview before final placement

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "create a header image for my blog post about AI agents" | Routes to Art > Essay workflow, generates editorial illustration |
| "make a mermaid diagram of the authentication flow" | Routes to Art > Mermaid workflow, creates flowchart |
| "visualize the difference between RAG and fine-tuning" | Routes to Art > Comparisons workflow, creates side-by-side visual |
| "create a YouTube thumbnail for my security talk" | Routes to Art > YouTubeThumbnailChecklist workflow |
| "make a technical diagram of the SPQA pattern" | Routes to Art > TechnicalDiagrams workflow |
| "animate this blog post content" | Routes to Remotion > ContentToAnimation workflow |
| "create a timeline of AI milestones" | Routes to Art > Timelines workflow |
| "remove the background from this image" | Routes to Art > RemoveBackground workflow |
| "create a PAI pack icon for the Research skill" | Routes to Art > CreatePAIPackIcon workflow |
| "make a D3 dashboard showing engagement metrics" | Routes to Art > D3Dashboards workflow |

---

## Example Usage

### Blog Header Image

```
User: "create a header for my post about autonomous AI agents"

AI:
1. Routes to Art > Essay workflow
2. Loads user aesthetic preferences from SKILLCUSTOMIZATIONS/Art/
3. Generates prompt with editorial illustration style
4. Renders image via configured model backend
5. Saves to ~/Downloads/ai-agents-header.png
6. "Header image saved to Downloads. Preview it and let me know if you'd like adjustments."
```

### Technical Architecture Diagram

```
User: "diagram the four-tier scraping escalation"

AI:
1. Routes to Art > TechnicalDiagrams workflow
2. Designs component layout: WebFetch > Curl > Playwright > Bright Data
3. Generates structured architecture visual with labels
4. Saves to ~/Downloads/four-tier-scraping-diagram.png
```

### Programmatic Video

```
User: "animate the key points from my newsletter"

AI:
1. Routes to Remotion > ContentToAnimation workflow
2. Extracts key points from content
3. Creates React composition with animated text and transitions
4. Renders to ~/Downloads/newsletter-animation.mp4
```

---

## Configuration

### Required

- **API keys** for at least one image generation backend, stored in `${PAI_DIR}/.env`
- **bun** runtime for executing TypeScript tools

### Optional

- **User customizations** at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/` for aesthetic preferences, character specs, and scene construction guidelines
- **Remotion customizations** at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Remotion/`

### Supported Image Models

| Model | Size Format | Default |
|-------|------------|---------|
| `flux` | Aspect ratio (e.g., `16:9`) | `16:9` |
| `nano-banana` | Aspect ratio | `16:9` |
| `nano-banana-pro` | Resolution tier (`1K`, `2K`, `4K`) | `2K` |
| `gpt-image-1` | Pixel dimensions (e.g., `1024x1024`) | `1024x1024` |

---

## Customization

### Recommended Customization

Create `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` to define:
- Default image generation model
- Visual style and aesthetic influences
- Color palette and rendering approach
- Output location preferences

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Aesthetic preferences | `SKILLCUSTOMIZATIONS/Art/PREFERENCES.md` | Default style for all generated images |
| Character specs | `SKILLCUSTOMIZATIONS/Art/CharacterSpecs.md` | Consistent character design across outputs |
| Scene construction | `SKILLCUSTOMIZATIONS/Art/SceneConstruction.md` | Composition rules for scenes |
| Remotion preferences | `SKILLCUSTOMIZATIONS/Remotion/PREFERENCES.md` | Video rendering defaults |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Inspired by:** The need for inline visual content creation without leaving the AI workflow

---

## Related Work

- **PAI Art Skill** -- The image generation engine at the core of the Media pack
- **PAI Remotion Skill** -- Programmatic video creation with React
- **PAI Blogging Skill** -- Generates blog posts that benefit from Media-created header images

---

## Works Well With

- **Research Pack** -- Research outputs can be visualized as diagrams, infographics, and timelines
- **PAI Algorithm** -- Algorithm-driven work sessions can generate visual artifacts inline

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Art subsystem with 20 specialized visual workflows
- Remotion subsystem for programmatic video
- Multi-model image generation (Gemini, Flux, GPT Image, Midjourney)
- Reference image support for style consistency
- TypeScript tooling for generation, composition, and rendering
