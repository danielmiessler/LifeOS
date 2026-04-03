<div align="center">

<img src="pai-packs-icon.png" alt="PAI Packs" width="256">

# PAI Packs

</div>

Standalone, AI-installable capabilities for Claude Code and other AI agent systems.

Each pack is a directory containing everything needed for an AI agent to install it autonomously:

```
PackName/
├── README.md    # What it does, why it exists, how it works
├── INSTALL.md   # Step-by-step wizard for AI-assisted installation
├── VERIFY.md    # Post-install verification checklist
└── src/         # Source files to copy
```

## How to Install a Pack

Point your AI to the pack directory:

```
"Install the ContextSearch pack from PAI/Packs/ContextSearch/"
```

Your AI reads `INSTALL.md` and walks through a 5-phase wizard: system analysis, user questions, backup, installation, verification.

Or manually: read `INSTALL.md`, copy files from `src/` to the specified locations, run `VERIFY.md` checks.

## Available Packs

### Commands

| Pack | Description |
|------|-------------|
| [ContextSearch](ContextSearch/) | `/context-search` and `/cs` — search prior work to add context |

### Skills

| Pack | Description |
|------|-------------|
| [Agents](Agents/) | Custom agent composition from traits, voices, and personalities |
| [ContentAnalysis](ContentAnalysis/) | Content extraction and wisdom from videos, podcasts, articles, and YouTube |
| [Investigation](Investigation/) | OSINT and investigation — company intel, people search, domain lookup |
| [Media](Media/) | Visual and video content — illustrations, diagrams, infographics, Remotion video |
| [Research](Research/) | Multi-agent research with quick/standard/extensive/deep modes and 242+ Fabric patterns |
| [Scraping](Scraping/) | Web scraping via Bright Data proxy escalation and Apify social media actors |
| [Security](Security/) | Security assessment — recon, web app testing, prompt injection, security news |
| [Telos](Telos/) | Life OS and project analysis — goals, beliefs, wisdom, dashboards, McKinsey reports |
| [Thinking](Thinking/) | Analytical thinking — first principles, council debates, red team, brainstorming, science |
| [USMetrics](USMetrics/) | 68 US economic indicators from FRED, EIA, Treasury, BLS, Census APIs |
| [Utilities](Utilities/) | Developer tools — CLI generation, skill scaffolding, Fabric, Cloudflare, browser automation |

## Creating a Pack

See [PAIPackTemplate.md](../Tools/PAIPackTemplate.md) for the full specification.
