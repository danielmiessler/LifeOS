---
name: Utilities
pack-id: danielmiessler-utilities-v1.0.0
version: 1.0.0
author: danielmiessler
description: Developer utilities and tools -- CLI generation, skill scaffolding, agent delegation, system upgrades, evals, documents, parsing, audio editing, Fabric patterns, Cloudflare infrastructure, browser automation, meta-prompting, and aphorisms
type: skill
purpose-type: [developer-tools, productivity, automation, infrastructure]
platform: claude-code
dependencies: []
keywords: [CLI, scaffolding, delegation, upgrade, eval, document, parser, audio, fabric, cloudflare, browser, prompting, aphorisms, developer-tools, utilities]
---

# Utilities

> Thirteen developer utility sub-skills in one unified routing layer -- from CLI generation to browser automation to economic report parsing.

---

## The Problem

AI-assisted development involves many specialized workflows that each require their own context, patterns, and domain knowledge. Without a unified routing layer, you end up:

- **Repeating setup instructions** -- explaining CLI scaffolding patterns, document conversion requirements, or browser automation steps every session
- **Losing specialized knowledge** -- the optimal TypeScript CLI patterns, Cloudflare deployment steps, or audio editing pipelines are not retained between sessions
- **No delegation framework** -- when a task should be split across parallel agents, there is no structured way to decompose and coordinate
- **Scattered tooling** -- parsing, prompting, eval running, and skill creation each live in isolation with no shared routing

The fundamental issue: developers need a wide range of specialized workflows available on demand, routed automatically based on what they ask for, without having to manually load context or explain the domain each time.

---

## The Solution

Utilities is a unified skill with a single SKILL.md router that dispatches to thirteen specialized sub-skills based on natural language matching:

| Sub-Skill | What It Does |
|-----------|-------------|
| **CreateCLI** | Generates TypeScript CLI tools -- API wrappers, command-line utilities, multi-tier upgrade paths |
| **CreateSkill** | Scaffolds new PAI skills -- directory structure, SKILL.md templates, workflow files, validation |
| **Delegation** | Coordinates parallel agent execution -- task decomposition, workstream management, agent specialization |
| **PAIUpgrade** | Analyzes and applies system improvements -- checks for new Claude features, mines reflections, upgrades algorithms |
| **Evals** | Runs evaluations and benchmarks -- test suites, model comparisons, grading, regression testing |
| **Documents** | Processes and creates documents -- PDF, DOCX, XLSX, PPTX conversion, extraction, consulting reports |
| **Parser** | Extracts structured data from URLs, transcripts, articles, newsletters, YouTube, Twitter, and more |
| **AudioEditor** | Cleans and edits audio -- removes filler words, cuts dead air, transcribes, analyzes audio quality |
| **Fabric** | Runs Fabric patterns -- summarization, threat modeling, pattern management, sync |
| **Cloudflare** | Deploys Cloudflare infrastructure -- Workers, Pages, MCP servers, DNS, KV, R2, D1, Vectorize |
| **Browser** | Automates browser interactions -- screenshots, UI verification, story reviews, web debugging |
| **Prompting** | Meta-prompting and template engineering -- prompt optimization, template generation, validation |
| **Aphorisms** | Manages a curated quote and aphorism database -- search, add, research thinkers, newsletter quotes |

Each sub-skill has its own SKILL.md, workflows, tools, and context files. The top-level SKILL.md routes requests to the right sub-skill automatically.

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is PAI?** See the [PAI Project Overview](https://github.com/danielmiessler/Personal_AI_Infrastructure#what-is-pai).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill router | `src/SKILL.md` | Top-level routing -- dispatches requests to the correct sub-skill |
| Aphorisms | `src/Aphorisms/` | Quote and aphorism database management (SKILL.md, Database/, Workflows/) |
| AudioEditor | `src/AudioEditor/` | Audio cleaning, editing, and transcription (SKILL.md, Tools/, Workflows/) |
| Browser | `src/Browser/` | Browser automation and web debugging (SKILL.md, README.md, Recipes/, Stories/, Workflows/) |
| Cloudflare | `src/Cloudflare/` | Cloudflare infrastructure deployment (SKILL.md, Workflows/) |
| CreateCLI | `src/CreateCLI/` | TypeScript CLI generation with patterns (SKILL.md, FrameworkComparison.md, Patterns.md, TypescriptPatterns.md, Workflows/) |
| CreateSkill | `src/CreateSkill/` | PAI skill scaffolding and validation (SKILL.md, Workflows/) |
| Delegation | `src/Delegation/` | Parallel agent coordination (SKILL.md) |
| Documents | `src/Documents/` | Document processing and conversion (SKILL.md, Docx/, Pdf/, Pptx/, Xlsx/, Workflows/) |
| Evals | `src/Evals/` | Evaluation framework and benchmarking (SKILL.md, PROJECT.md, BestPractices.md, CLIReference.md, ScienceMapping.md, ScorerTypes.md, TemplateIntegration.md, Data/, Graders/, Results/, Suites/, Tools/, Types/, UseCases/, Workflows/) |
| Fabric | `src/Fabric/` | Fabric pattern execution and management (SKILL.md, Patterns/, Workflows/) |
| PAIUpgrade | `src/PAIUpgrade/` | System analysis and improvement (SKILL.md, sources.json, youtube-channels.json, Logs/, State/, Tools/, Workflows/) |
| Parser | `src/Parser/` | Structured data extraction (SKILL.md, README.md, EntitySystem.md, entity-index.json, Lib/, Prompts/, Schema/, Tests/, Utils/, Web/, Workflows/) |
| Prompting | `src/Prompting/` | Meta-prompting and template engineering (SKILL.md, Standards.md, Templates/, Tools/) |

**Summary:**
- **Sub-skills:** 13
- **Total directories:** 50+
- **Dependencies:** Varies by sub-skill (bun for TypeScript tools, ffmpeg for audio, wrangler for Cloudflare, etc.)

---

## What Makes This Different

This sounds similar to having separate skills for each function. What makes a unified Utilities skill different?

The routing layer means you never have to think about which skill to invoke. You say "clean up this audio file" and the router sends it to AudioEditor. You say "deploy this to Cloudflare" and the router sends it to Cloudflare. You say "parse this YouTube transcript" and the router sends it to Parser. A single skill definition in CLAUDE.md covers thirteen specialized domains, each with their own deep context, patterns, and tools. Without the unified router, you would need thirteen separate skill entries, and the AI would need to figure out which one to load for every request.

- Single routing layer covers 13 specialized domains
- Each sub-skill has full standalone context (SKILL.md, workflows, tools)
- Natural language routing -- no need to name the specific sub-skill
- Sub-skills can reference each other (e.g., Parser feeding into Documents)
- New sub-skills can be added by creating a directory and adding a routing entry

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "Create a CLI that wraps the Stripe API" | Routes to CreateCLI -- generates TypeScript CLI with Stripe integration |
| "Scaffold a new skill called WeatherForecast" | Routes to CreateSkill -- creates directory structure, SKILL.md template, workflows |
| "Split this into 3 parallel workstreams" | Routes to Delegation -- decomposes task and coordinates agents |
| "Check for PAI upgrades" | Routes to PAIUpgrade -- scans for new features, analyzes improvement opportunities |
| "Run the auth eval suite" | Routes to Evals -- executes test suite and reports results |
| "Convert this PDF to markdown" | Routes to Documents -- extracts and converts document content |
| "Parse this YouTube video" | Routes to Parser -- extracts transcript, entities, structured data |
| "Clean the filler words from this podcast" | Routes to AudioEditor -- processes audio, removes ums and dead air |
| "Run the summarize fabric pattern" | Routes to Fabric -- executes the pattern on provided content |
| "Deploy this worker to Cloudflare" | Routes to Cloudflare -- handles deployment with wrangler |
| "Take a screenshot of localhost:3000" | Routes to Browser -- captures and returns screenshot |
| "Optimize this prompt template" | Routes to Prompting -- analyzes and improves prompt structure |
| "Find a quote about persistence" | Routes to Aphorisms -- searches database for matching quotes |

---

## Example Usage

### Creating a CLI Tool

```
User: "Create a CLI that wraps the OpenAI API with streaming support"

AI responds:
Running the CreateCLI workflow in the Utilities skill...

[Routes to CreateCLI sub-skill]
[Applies TypescriptPatterns.md and Patterns.md]
[Generates project structure, CLI entry point, API client, types]

Created:
- src/index.ts (CLI entry point with commander)
- src/client.ts (OpenAI API client with streaming)
- src/types.ts (TypeScript interfaces)
- package.json (dependencies and scripts)
- tsconfig.json (TypeScript config)
```

### Parsing Content

```
User: "Parse this article and extract the key entities: https://example.com/article"

AI responds:
Running the Parser workflow in the Utilities skill...

[Routes to Parser sub-skill]
[Fetches URL content]
[Runs entity extraction pipeline]
[Returns structured JSON with entities, topics, and summary]
```

### Running Evaluations

```
User: "Run the prompt quality eval and compare GPT-4 vs Claude"

AI responds:
Running the Evals workflow in the Utilities skill...

[Routes to Evals sub-skill]
[Loads test suite]
[Runs against both models]
[Applies graders]
[Returns comparison results with scores and analysis]
```

---

## Configuration

No global configuration required. Individual sub-skills may have their own configuration needs:

| Sub-Skill | Configuration | Required |
|-----------|--------------|----------|
| Cloudflare | `wrangler` CLI, Cloudflare account | For deployment workflows |
| AudioEditor | `ffmpeg` installed | For audio processing |
| Evals | Test suite definitions | For running evaluations |
| Parser | Network access | For URL fetching |
| Fabric | Fabric patterns synced | For pattern execution |
| PAIUpgrade | PAI infrastructure | For system analysis |

All other sub-skills work out of the box with no additional configuration.

---

## Customization

### Recommended Customization

Create a customization directory at `~/.claude/PAI/USER/SKILLCUSTOMIZATIONS/Utilities/` with preferences for specific sub-skills.

### Optional Customization

| Customization | Location | Impact |
|--------------|----------|--------|
| Add CLI patterns | `CreateCLI/Patterns.md` | New patterns available during CLI generation |
| Add eval suites | `Evals/Suites/` | New test suites available for evaluation |
| Add fabric patterns | `Fabric/Patterns/` | New patterns available for fabric execution |
| Add parser prompts | `Parser/Prompts/` | New extraction prompts for content types |
| Add browser recipes | `Browser/Recipes/` | New automation recipes for common tasks |
| Add prompt templates | `Prompting/Templates/` | New templates for prompt generation |
| Add aphorisms | `Aphorisms/Database/` | Expand the quote database |
| Add routing entries | `SKILL.md` | Route new request patterns to sub-skills |

---

## Credits

- **Original concept:** Daniel Miessler -- developed as part of the [PAI](https://github.com/danielmiessler/Personal_AI_Infrastructure) system
- **Sub-skill contributions:** Each sub-skill represents domain expertise accumulated across real-world usage

---

## Related Work

- **PAI Algorithm** -- The structured workflow system that many Utilities sub-skills integrate with
- **PAI MEMORY System** -- Delegation and PAIUpgrade sub-skills interact with the MEMORY infrastructure
- **Fabric** -- The Fabric sub-skill integrates with Daniel Miessler's open-source Fabric project

---

## Works Well With

- **PAI Core Install** -- Provides the infrastructure that PAIUpgrade, Delegation, and CreateSkill operate on
- **USMetrics Pack** -- Parser can feed economic data into USMetrics workflows
- **WorkCommand Pack** -- Work recall surfaces prior Utilities sessions for context recovery

---

## Changelog

### 1.0.0 - 2026-03-15
- Initial release
- Thirteen sub-skills: CreateCLI, CreateSkill, Delegation, PAIUpgrade, Evals, Documents, Parser, AudioEditor, Fabric, Cloudflare, Browser, Prompting, Aphorisms
- Unified routing layer with natural language dispatch
- Each sub-skill includes standalone SKILL.md, workflows, and tools
