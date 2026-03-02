# PAI — Personal AI Infrastructure

PAI is a general problem-solving system that magnifies human capabilities. It runs inside Claude Code as an interconnected set of skills, hooks, tools, memory, and configuration — all orchestrated by The Algorithm.

## How It Works

**CLAUDE.md** is the master config — generated from `CLAUDE.md.template` via `BuildCLAUDE.ts`. It defines execution modes, The Algorithm, and the context routing table. Claude Code loads it natively every session. A SessionStart hook keeps it fresh automatically.

**This directory (`PAI/`)** contains all system documentation, tools, user context, and the SKILL.md that defines PAI as a skill. The rest of the system lives alongside it under `~/.claude/` (hooks, skills, settings, memory).

## Directory Structure

```
~/.claude/
  CLAUDE.md                    # Master config (generated from template)
  CLAUDE.md.template           # Source template with variables
  settings.json                # Single source of truth for all configuration
  hooks/                       # Event lifecycle hooks (21+)
  skills/                      # 12 categories, 49 skills — each with SKILL.md
  MEMORY/                      # Persistent memory (work, learning, relationship, state)
  PAI/                         # This directory — system docs + tools + user context
    Algorithm/                 # Versioned algorithm files + LATEST pointer
```

## Core Subsystems

### The Algorithm (`PAI/Algorithm/`)
The 7-phase execution engine: Observe, Think, Plan, Build, Execute, Verify, Learn. Transitions from CURRENT STATE to IDEAL STATE via verifiable criteria (ISC). Current version: v3.5.0.

### Skills (`SKILLSYSTEM.md`)
12 hierarchical categories with 49 total skills in `~/.claude/skills/`, each with a `SKILL.md` defining triggers, workflows, and tools. Skills are the primary capability unit.

### Hooks (`THEHOOKSYSTEM.md`)
21+ event hooks across the session lifecycle: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop, SessionEnd. Defined in `settings.json`, implemented in `~/.claude/hooks/`.

### Memory (`MEMORYSYSTEM.md`)
Persistent storage across sessions:
- **WORK/** — Session artifacts, PRDs, transcripts
- **LEARNING/** — Failure patterns, algorithm reflections, signals
- **RELATIONSHIP/** — Daily interaction patterns, preferences
- **STATE/** — Session names, algorithm state, caches
- **WISDOM/** — Domain knowledge frames that compound over time

### Tools (`Tools/`)
TypeScript utilities in `PAI/Tools/`: `BuildCLAUDE.ts` (generate CLAUDE.md from template), `Inference.ts` (AI calls), `GenerateSkillIndex.ts`, `SessionProgress.ts`, `Banner.ts`, and more.

### Agents (`PAIAGENTSYSTEM.md`)
14 specialized agent types (Algorithm, Engineer, Architect, Designer, Researcher variants). Custom agents via the Agents skill. Agent teams for coordinated multi-agent work.

### Security
Hook-based security: `SecurityValidator.hook.ts` guards Bash, Edit, Write, Read. Path validation, command injection prevention, secret scanning.

### Notifications (`THENOTIFICATIONSYSTEM.md`)
Multi-channel: ntfy, Discord, Twilio. Voice announcements via ElevenLabs at localhost:8888.

### Configuration (`settings.json`)
Single source of truth: identity (daidentity, principal), environment, permissions, hooks, notifications, status line, spinner verbs, counts, startup file loading (`loadAtStartup`), dynamic context toggles (`dynamicContext`).

## User Context (`USER/`)

Personal data directory. See `USER/README.md` for full index:
- **Identity:** `ABOUTME.md`, `DAIDENTITY.md`, `WRITINGSTYLE.md`
- **Rules:** `AISTEERINGRULES.md` (personal overrides)
- **Projects:** `PROJECTS/`
- **Life Goals:** `TELOS/` (via Telos skill)
- **Work:** `WORK/`, `BUSINESS/`
- **Skill Overrides:** `SKILLCUSTOMIZATIONS/`

## Startup & Context Loading

At session start, three things happen:
1. **CLAUDE.md** loads natively (identity, algorithm, routing table)
2. **`loadAtStartup` files** from `settings.json` are force-loaded by `LoadContext.hook.ts`
3. **Dynamic context** injected by `LoadContext.hook.ts`: relationship context, learning readback, active work summary (each toggleable in `settings.json → dynamicContext`)

All other documentation loads on-demand based on the routing table in CLAUDE.md.

## Build System

| Target | Source | Builder | Trigger |
|--------|--------|---------|---------|
| `CLAUDE.md` | `CLAUDE.md.template` + `settings.json` + `PAI/Algorithm/LATEST` | `bun PAI/Tools/BuildCLAUDE.ts` | SessionStart hook + manual |

## Extending PAI

- **Add a skill:** Use the CreateSkill skill under Utilities
- **Add a hook:** Create handler in `~/.claude/hooks/handlers/`, register in `settings.json`
- **Add startup files:** Append to `settings.json → loadAtStartup.files`
- **Add user context:** Create files in `PAI/USER/`
