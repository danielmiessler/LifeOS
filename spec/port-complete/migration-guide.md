# PAI v5.0 — Migration Guide

## How to Use Each Port

### Hermes Agent (Current Environment)

The Hermes port is installed and ready to use. Five PAI skills are available:

```
pai-algorithm  — 7-phase execution loop
pai-isa        — Ideal State Artifact
pai-thinking   — 19 thinking capabilities
pai-telos      — Life OS mission/goals
pai-knowledge  — Typed knowledge graph
```

**To use the Algorithm:**
1. Invoke `pai-algorithm` skill with your task
2. The skill guides through mode classification → ISA scaffolding → 7-phase execution

**To scaffold an ISA:**
1. Invoke `pai-isa` skill with "scaffold at tier E2"
2. Write to `~/.hermes/profiles/dev/pai/MEMORY/WORK/{slug}/ISA.md`

### Pi-mono Agent

1. Ensure Pi is installed: `npm install -g @mariozechner/pi-coding-agent`
2. Copy the upgraded scaffold: `cp -r Releases/Pi/* ~/.config/PAI-pi/`
3. The `pai-core` extension provides: ISA scaffold, reconcile, CheckCompleteness, execution log, changelog append
4. `config/SYSTEM.md` provides the Algorithm v6.3.0 as system prompt

### OpenCode (Codex CLI)

1. Copy context files: `cp -r targets/opencode/pai ~/.codex/pai/`
2. Run: `source ~/.codex/pai/init.sh` before starting Codex
3. This loads all PAI context files as agent instructions
4. No native automation — the agent follows the SYSTEM.md instructions manually

## Known Differences from Source

| Area | Source (PAI v5.0) | Hermes Port | Impact |
|------|-------------------|-------------|--------|
| Hook system | 37 lifecycle hooks | Not ported | No automatic lifecycle event handling |
| Pulse daemon | Bun process, port 31337 | Not ported | No Life Dashboard, no voice, no wiki API |
| Voice pipeline | ElevenLabs TTS | Not ported | No voice notifications |
| Containment zones | Filesystem write enforcement | Not ported | No automatic privacy enforcement |
| 45 skills → 5 ported | Full skill ecosystem | Core methodology only | Need to port more skills for feature parity |
| Agents | 18 custom agents | Not ported | No pre-built agent personas |
| External channels | Telegram, iMessage | Not ported | No messaging integration |
| Observability | JSONL telemetry + dashboard | Basic directory structure only | No data collection or visualization |

## Operations Runbook

### Hermes PAI Skills

**Algorithm starts automatically** when you invoke `pai-algorithm` with a task description. The skill:
1. Classifies the mode (MINIMAL/NATIVE/ALGORITHM)
2. Scaffolds an ISA if ALGORITHM mode
3. Guides through all 7 phases
4. Logs execution to `MEMORY/SKILLS/execution.jsonl`

**Memory is persistent** across sessions. USER/ identity files and KNOWLEDGE/ entities survive Hermes restarts.

**To add a new skill:** Port additional PAI packs by creating Hermes SKILL.md files in `~/.hermes/profiles/dev/skills/software-development/`.

### Pi-mono Agent

The upgraded extension adds three new tools:
- `isa_scaffold` — call with prompt + effort tier
- `isa_reconcile` — call with ephemeral path + master path
- `isa_check_completeness` — call with ISA path + tier

### OpenCode

- `SYSTEM.md` is the master context — read it at session start
- `ISA.md` is the template to use when defining work
- `skills/thinking.md` has all 19 thinking capability methodologies
- No automated tools — all workflows are manual agent-followed instructions

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Algorithm skill not found | Skill not installed | `hermes skill install pai-algorithm` |
| ISA not generated | Effort tier too low | Try E2+ which requires scaffolding |
| Memory files missing | Not initialized | Run pai-telos to set up USER/ files |
| Execution log empty | No invocations yet | Run any pai-* skill to verify |
| Pi extension not loaded | Wrong config path | Check `~/.config/PAI-pi/extensions/pai-core/index.ts` exists |
