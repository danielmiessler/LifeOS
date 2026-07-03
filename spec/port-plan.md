# PAI v5.0 — Port Plan

## Target Architecture Definitions

### Target 1: Hermes Agent (Python)
| Parameter | Definition |
|-----------|------------|
| Target | Hermes Agent via Hermes CLI |
| Runtime | Python 3.13 (user's environment) |
| Skill System | Hermes SKILL.md (Python skills) |
| Config | `~/.hermes/profiles/dev/` |
| Memory | `~/.hermes/profiles/dev/memories/` (persistent) |
| Cron | Hermes cronjob tool (built-in) |
| Tools | MCP tools, built-in tools (terminal, web, file) |
| Hooks | Hermes concept only — no lifecycle hook system |
| Deployment | User's Arch Linux workstation |
| Model Provider | openrouter/deepseek-v4-flash (user's preference) |

### Target 2: OpenCode (Codex CLI)
| Parameter | Definition |
|-----------|------------|
| Target | OpenAI Codex CLI |
| Runtime | Node.js 18+ |
| Skill System | Context files + directory structure (no native skill system) |
| Config | `~/.coderc` or project-level `.env` |
| Memory | Filesystem + `.codex/memory/` |
| Hooks | None — pre/post scripts only |
| Deployment | Developer workstation |

### Target 3: Pi-mono agent
| Parameter | Definition |
|-----------|------------|
| Target | Pi mono coding agent |
| Runtime | Node.js 18+ |
| Skill System | Native Pi extension system + SKILL.md |
| Config | `~/.config/PAI-pi/` |
| Memory | `~/.config/PAI-pi/memory/` |
| Hooks | None — extension event hooks |
| Deployment | Any workstation (model-agnostic) |

## Gap & Risk Analysis

### Core Components

| Component | Hermes Gap | OpenCode Gap | Pi Gap |
|-----------|-----------|-------------|--------|
| **Algorithm** | 🟢 MEDIUM — Can implement as skill | 🟢 LOW — Context file | 🟢 LOW — Already exists in Pi v1.0 |
| **ISA** | 🟢 MEDIUM — Can implement as skill + file template | 🟡 MEDIUM — File template | 🟢 MEDIUM — File template |
| **45+ Skills** | 🟡 MEDIUM — Each PAI skill → Hermes SKILL.md | 🔴 HIGH — No skill system | 🟡 MEDIUM — Most exist in Pi v1.0 |
| **Pulse Daemon** | 🔴 HIGH — No native daemon support | 🔴 HIGH — No daemon at all | 🔴 HIGH — Same gap |
| **Memory** | 🟢 LOW — Hermes persistent memory | 🟢 LOW — Filesystem | 🟢 LOW — Already exists |
| **Hooks** | 🔴 HIGH — No lifecycle event system | 🔴 HIGH — None | 🔴 HIGH — None |
| **Voice** | 🔴 HIGH — No voice pipeline | 🔴 HIGH — None | 🔴 HIGH — None |
| **Containment** | 🔴 HIGH — No enforcement mechanism | ⚫ CRITICAL — None | ⚫ CRITICAL — None |
| **Knowledge Graph** | 🟡 MEDIUM — Can build from files | 🟡 MEDIUM — Wikilinks in markdown | 🟡 MEDIUM — Wikilinks in markdown |
| **Cron** | 🟢 LOW — Built-in cronjob tool | 🔴 HIGH — No cron | 🔴 HIGH — No cron |
| **Telos** | 🟢 LOW — User profile system | 🟢 LOW — Markdown files | 🟢 LOW — Already exists |
| **DA** | 🟡 MEDIUM — Memory identity | 🟡 MEDIUM — Markdown files | 🟡 MEDIUM — Already exists |

### Risk Summary

| Risk Level | Count | Key Areas |
|-----------|-------|-----------|
| 🟢 LOW | 8 | Algorithm-as-context, memory, cron, Telos, DA identity |
| 🟡 MEDIUM | 8 | Skill ports, ISA, Knowledge Graph, cross-skill invocation |
| 🔴 HIGH | 6 | Pulse daemon, hooks, voice, containment zones |
| ⚫ CRITICAL | 2 | Containment (OpenCode/Pi) — no enforcement possible |

## Migration Strategy

The port follows the Strangler Fig pattern — we deliver each target independently, starting with the highest-value, lowest-gap components.

### Phase A: Hermes Agent Port (Highest Priority)
Foundation layer — deliver a working PAI-for-Hermes setup

### Phase B: Pi-mono Agent Upgrade
Upgrade existing Pi v1.0.0 scaffold to full v5.0.0 parity

### Phase C: OpenCode Port
Context-file-based port — no native skill system means a different approach

---

## Phase A: Hermes Agent Port Details

### A1: Algorithm Skill (hermes-pai-algorithm)

**Files to create:**
```
~/.hermes/profiles/dev/skills/
├── pai-algorithm/SKILL.md
├── pai-algorithm/workflows/
│   ├── observe.md
│   ├── think.md
│   ├── plan.md
│   ├── build.md
│   ├── execute.md
│   ├── verify.md
│   └── learn.md
├── pai-isa/SKILL.md
├── pai-isa/workflows/
│   ├── scaffold.md
│   ├── check-completeness.md
│   └── reconcile.md
└── pai-telos/SKILL.md
```

**Spec items:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-28, FR-29
**Risk:** 🟡 MEDIUM — Hermes skills use SKILL.md but with Python/TS tools, not markdown workflows
**Verification:** TC-01, TC-02, TC-03

### A2: Core Skill Packs (Top 10)

Port the 10 highest-value PAI v5.0 skills as Hermes skills:

| PAI Skill | Hermes Skill | Complexity |
|-----------|-------------|------------|
| ISA | pai-isa | 🟡 MEDIUM |
| Telos | pai-telos | 🟢 LOW |
| Interview | pai-interview | 🟢 LOW |
| Knowledge | pai-knowledge | 🟡 MEDIUM |
| Research | pai-research | 🟡 MEDIUM |
| Thinking | pai-thinking | 🟢 LOW |
| Council | pai-council | 🔴 HIGH (multi-agent) |
| Browser | pai-browser | 🟡 MEDIUM |
| Delegation | pai-delegation | 🔴 HIGH |
| ContextSearch | pai-context-search | 🟢 LOW |

**Spec items:** FR-06, FR-07, FR-15, FR-16, FR-29
**Risk:** 🟡 MEDIUM — Hermes SKILL.md format differs from PAI SKILL.md format
**Verification:** TC-04

### A3: Memory System

**Files to create under `~/.hermes/profiles/dev/pai/`:**
```
pai/
├── MEMORY/
│   ├── WORK/
│   ├── KNOWLEDGE/
│   │   ├── People/
│   │   ├── Companies/
│   │   └── Ideas/
│   ├── LEARNING/
│   ├── STATE/
│   │   └── work.json
│   └── SKILLS/
│       └── execution.jsonl
├── USER/
│   ├── PRINCIPAL_IDENTITY.md
│   ├── DA_IDENTITY.md
│   └── TELOS/
│       ├── MISSION.md
│       └── GOALS.md
├── ALGORITHM/
│   └── ALGORITHM.md
└── PAI_SYSTEM_PROMPT.md
```

**Spec items:** DM-02, FR-10, FR-11, FR-30
**Risk:** 🟢 LOW — Filesystem-based, directly portable
**Verification:** TC-05

### A4: Cron Integration

Map PAI's cron jobs to Hermes cronjob tool:
- `hermes cron create --schedule "0 9 * * *" --prompt "Morning briefing" --skills pai-life-morning-brief`
- State management via Hermes cronjob's built-in state.json

**Spec items:** FR-22
**Risk:** 🟢 LOW — Hermes has native cron support
**Verification:** TC-10

### A5: What Cannot Be Ported to Hermes

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Pulse daemon (port 31337) | Hermes has no HTTP daemon framework | Run Pulse as separate process or use MCP server |
| Voice pipeline | No TTS integration in Hermes | Defer — use desktop notifications |
| Hook lifecycle (37 hooks) | Hermes has no hook events | Implement key hooks as pre/post tool skills where possible |
| Containment zones | No filesystem interception in Hermes | Manual zone policy checks in tool use |
| 37+ hooks | Most are Claude Code-specific (tab state, setter) | Skip — only port essential security hooks |
| Telemetry JSONL | Hermes has its own observability | Adapt to Hermes observability patterns |

---

## Phase B: Pi-mono Agent Upgrade

### B1: Upgrade Existing Pi Scaffold

The existing Pi v1.0.0 at `Releases/Pi/` needs:

| File | Action | Spec Items |
|------|--------|------------|
| `config/SYSTEM.md` | Update to v5.0.0 Algorithm + mode classifier | FR-01, FR-02, FR-03 |
| `config/AGENTS.md` | Add mode classifier instructions | FR-03 |
| `extensions/pai-core/index.ts` | Add ISA scaffold, reconcile, CheckCompleteness | FR-04, FR-05 |
| `skills/` | Expand from 9 to 20+ skill categories | FR-06 |
| `memory/` | Add all 14+ memory compartments | DM-02 |
| New: `ALGORITHM.md` | Full algorithm spec in config | FR-01 |

**Risk:** 🟡 MEDIUM — Existing structure is good base, needs significant upgrade
**Verification:** All Algorithm and ISA tests

### B2: New Skills for Pi

Add skills that don't exist in Pi v1.0.0:
- Telos management (exists partially, needs full v5.0.0 structure)
- Interview (onboarding workflow)
- ISA (scaffold + reconcile)
- Knowledge (graph operations)
- ContextSearch
- Thinking bundle (exists, needs all 19 capabilities)

---

## Phase C: OpenCode (Codex CLI) Port

### C1: Context-File Approach

OpenCode has no skill system. Port is via context files that the agent reads:

```
~/.codex/
├── pai/
│   ├── SYSTEM.md               # Full Algorithm v6.3.0 as system context
│   ├── ALGORITHM.md            # 7-phase loop as agent instructions
│   ├── MEMORY/
│   │   ├── WORK/
│   │   ├── KNOWLEDGE/
│   │   └── LEARNING/
│   ├── USER/
│   │   ├── IDENTITY.md
│   │   └── TELOS/
│   └── SKILLS/
│       ├── thinking/           # Thinking skill prompts as reference files
│       ├── research/           # Research workflows
│       └── .../
```

**Spec items:** FR-01, FR-10 (subset)
**Risk:** 🟡 MEDIUM — Without a skill system, workflows are just instructions
**Verification:** Manual — agent follows Algorithm phases

### C2: Auto-Load Script

Create a bootstrap script for Codex:
```bash
# ~/.codex/init.sh — source this when starting Codex
export CODEX_CONTEXT_DIR="$HOME/.codex/pai"
# Tells Codex to load the PAI context
codex --context-dir "$CODEX_CONTEXT_DIR"
```

### C3: Skill Emulation

Each PAI skill becomes a reference document in `~/.codex/pai/skills/`. The agent reads the skill before performing the action. No routing, no automation — pure context-driven behavior.

---

## Execution Order

```
Week 1: Hermes A1 (Algorithm) + A3 (Memory)
Week 2: Hermes A2 (Top 10 skills)
Week 3: Hermes cron + remaining skills
Week 4: Pi-mono upgrade
Week 5: OpenCode port
Week 6: Verification & docs
```

## Rollback Plan

Each target is independent. Rollback for Hermes: `rm -rf ~/.hermes/profiles/dev/skills/pai-*`. Rollback for Pi: restore v1.0.0 from backup. Rollback for OpenCode: `rm -rf ~/.codex/pai/`.
