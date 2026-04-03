# PAI on Pi v1.0.0 (Alpha) — Model-Agnostic Personal AI Infrastructure

> **Note:** This is a very early v1.0.0 release — consider it an alpha. Expect rough edges and iterative improvements.

> **PAI** (Personal AI Infrastructure) is a methodology and toolkit for building your own AI assistant. The primary PAI releases are built on [Claude Code](https://docs.anthropic.com/en/docs/claude-code), which is the most powerful AI coding harness available today. But many people want to use **local models**, **open-source models**, or a **mix of providers** — and that's what this scaffold is for.

**[Pi](https://github.com/badlogic/pi-mono)** is a model-agnostic coding agent that works with any LLM provider: Ollama (local), OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible API. This directory contains everything you need to run PAI's core methodology inside Pi.

## Why Pi?

| Feature | Claude Code (PAI Default) | Pi (This Scaffold) |
|---------|--------------------------|---------------------|
| Model lock-in | Anthropic only | Any provider |
| Local models | No | Yes (Ollama, llama.cpp, etc.) |
| Cost | API pricing | Free with local models |
| Privacy | Cloud-based | Fully local option |
| PAI methodology | Full (63+ skills, 21 hooks) | Core (9 skills, 5 tools) |
| Extensibility | Hooks + Skills | Extensions + Skills |
| Open source | Yes | Yes |

**This scaffold gives you the PAI Algorithm, skills, and core tooling** — adapted for Pi's extension system. It's the foundation you build on.

## What's Included

```
Releases/Pi/
├── config/
│   ├── SYSTEM.md          # System prompt — your AI's identity + PAI methodology
│   ├── AGENTS.md          # Context about you + optional voice config
│   ├── settings.json      # Pi runtime settings
│   └── models.json        # Model provider configuration (examples included)
├── extensions/
│   └── pai-core/
│       └── index.ts       # Core extension: security, PRD tracking, voice, learning
├── skills/                # 9 skill categories with SKILL.md definitions
│   ├── agents/            # Agent composition and team coordination
│   ├── content-analysis/  # Extract wisdom from any content
│   ├── investigation/     # OSINT and research
│   ├── media/             # Diagrams, images, infographics
│   ├── research/          # Multi-mode research methodology
│   ├── scraping/          # Progressive web scraping
│   ├── security/          # Security assessment frameworks
│   ├── telos/             # Life OS — goals, projects, wisdom tracking
│   └── thinking/          # First principles, red team, council debate
└── memory/                # Persistent memory across sessions
    ├── learning/          # Session logs and learning signals
    ├── state/             # Current work state
    └── work/              # PRD files for Algorithm sessions
```

## The PAI Algorithm

The core of PAI is the **7-phase Algorithm** — a structured methodology for complex work:

1. **OBSERVE** — Reverse-engineer the request. Generate testable success criteria (ISC).
2. **THINK** — Identify risks, run a premortem, check prerequisites.
3. **PLAN** — Design the approach. Choose depth vs breadth.
4. **BUILD** — Prepare artifacts, invoke capabilities.
5. **EXECUTE** — Do the work. Mark criteria as they pass.
6. **VERIFY** — Test every criterion with evidence.
7. **LEARN** — Reflect on what worked and what didn't.

This methodology works with **any model** — it's a thinking framework, not a model capability. Even smaller local models benefit from this structured approach.

## Architecture

```
┌─────────────────────────────────┐
│         Pi Coding Agent         │
│  (model-agnostic runtime)       │
├─────────────────────────────────┤
│       PAI Core Extension        │
│  Security │ PRD │ Voice │ Learn │
├─────────────────────────────────┤
│    SYSTEM.md (Identity + Algo)  │
├──────────┬──────────────────────┤
│  Skills  │  Memory             │
│  (9 cat) │  learning/state/work│
├──────────┴──────────────────────┤
│       Your Model Provider       │
│  Ollama │ OpenAI │ Anthropic    │
│  OpenRouter │ Any compatible    │
└─────────────────────────────────┘
```

## Quick Start

See **[INSTALL.md](INSTALL.md)** for the full setup guide. The short version:

```bash
# 1. Install Pi
npm install -g @mariozechner/pi-coding-agent

# 2. Copy this scaffold to Pi's config directory
cp -r config/* ~/.config/PAI-pi/
cp -r extensions/* ~/.config/PAI-pi/extensions/
cp -r skills/* ~/.config/PAI-pi/skills/
cp -r memory/* ~/.config/PAI-pi/memory/

# 3. Configure your model provider in models.json
# Edit ~/.config/PAI-pi/models.json

# 4. Customize your identity in SYSTEM.md
# Replace {{YOUR_NAME}} and {{YOUR_AI_NAME}} placeholders

# 5. Launch
pi
```

## Customization

### Naming Your AI

Edit `config/SYSTEM.md` and replace:
- `{{YOUR_NAME}}` — Your name
- `{{YOUR_AI_NAME}}` — What you want to call your AI assistant

### Adding Skills

Create a new directory under `skills/` with a `SKILL.md` file:

```markdown
---
name: my-skill
description: What this skill does. USE WHEN trigger words here.
metadata:
  author: you
  version: 1.0.0
---

# My Skill

Instructions for the AI when this skill is activated.
```

### Voice Integration (Optional)

Set environment variables to enable TTS:

```bash
export PAI_VOICE_ENABLED=true
export PAI_VOICE_ENDPOINT=http://localhost:8888/notify
export PAI_VOICE_ID=your-voice-id
```

Works with ElevenLabs, Coqui, or any TTS server that accepts HTTP POST with JSON body.

## Relationship to PAI Releases

This scaffold is derived from [PAI v4.0.3](../v4.0.3/). The full PAI system on Claude Code has 63+ skills, 21 hooks, and 338 workflows. This Pi version provides the core methodology and 9 foundational skill categories — enough to build a powerful personal AI system that you extend over time.

**To upgrade from Pi to full PAI:** Install PAI v4.0.3 on Claude Code. The methodology is the same — your skills and memory structure will transfer.

## Contributing

This scaffold is part of the [PAI open-source project](https://github.com/danielmiessler/PAI). Issues and PRs welcome.

## License

Same as the PAI project — see [LICENSE](../../LICENSE).
