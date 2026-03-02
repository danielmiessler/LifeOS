# User Configuration

This directory contains your personal PAI configuration. Everything here is **yours** — PAI never overwrites user files during upgrades.

## Identity Files

Create these in this directory to personalize your PAI system:

| File | Purpose |
|------|---------|
| `ABOUTME.md` | Your background, expertise, interests, and goals |
| `AISTEERINGRULES.md` | Personal AI behavior rules (extends system rules) |
| `OPINIONS.md` | Your preferences and opinions (helps AI adapt to you) |
| `DAIDENTITY.md` | Your Digital Assistant's name, personality, voice |
| `WRITINGSTYLE.md` | Your writing style preferences and examples |

## Directories

| Directory | Purpose |
|-----------|---------|
| `ACTIONS/` | Reusable automation actions (extract, transform, format, etc.) |
| `BUSINESS/` | Business context — company info, media kits, templates |
| `FLOWS/` | Workflow orchestration definitions |
| `PIPELINES/` | Data processing pipeline configs (YAML) |
| `PROJECTS/` | Project registry and metadata |
| `SKILLCUSTOMIZATIONS/` | Per-skill preference overrides (see below) |
| `STATUSLINE/` | Status line display customization |
| `TELOS/` | Life OS — goals, beliefs, challenges, books, wisdom |
| `TERMINAL/` | Terminal configuration (kitty.conf, themes, etc.) |
| `WORK/` | Work tracking, consulting context, client resources |
| `Workflows/` | User-defined workflow files |

## Skill Customizations

Override any skill's default behavior by creating a matching directory:

```
SKILLCUSTOMIZATIONS/
├── Art/
│   └── PREFERENCES.md    # Your art style preferences
├── Research/
│   └── PREFERENCES.md    # Your research preferences
└── Agents/
    └── PREFERENCES.md    # Your agent composition preferences
```

Each skill checks for customizations before executing. See individual skill docs for customizable options.

## Getting Started

1. Start with `ABOUTME.md` — tell PAI who you are
2. Name your DA in `DAIDENTITY.md`
3. Add rules in `AISTEERINGRULES.md` as you discover preferences
4. Fill in directories as needed — they're all optional
