# PAI v5.0 Port — Target Systems

This directory contains installable, ready-to-use ports of the **PAI v5.0 Life Operating System** for three open-source agentic systems.

## Quick Comparison

| Target | Install Method | Skills | Memory | Automation | Best For |
|--------|---------------|--------|--------|------------|----------|
| **[Hermes Agent](hermes/)** | `bash install.sh` | 38 skill packs | ✅ Persistent | ✅ Full | Users who want the most complete PAI experience |
| **[Pi-mono](pi-mono/)** | `cp -r * ~/.config/PAI-pi/` | 27 skill packs | ✅ Filesystem | ⚠️ Extension only | Users who want model-agnostic PAI |
| **[OpenCode](opencode/)** | `cp -r * ~/.codex/pai/` | Context files only | ⚠️ Manual | ❌ Manual | Users who want PAI methodology as reference |

## How to Choose

- **Use Hermes** if you run Hermes Agent — installable with one command, 38 skill packs, full Algorithm
- **Use Pi-mono** if you want model-agnostic PAI that works with any LLM provider (Ollama, OpenAI, Anthropic, OpenRouter)
- **Use OpenCode** if you use Codex CLI and want PAI methodology as agent context files

## Common Features (All Targets)

- **Algorithm v6.3.0** — 7-phase execution loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN)
- **ISA** — Ideal State Artifact with all 12 sections
- **ISC** — Atomic, testable verification criteria
- **Memory** — WORK/KNOWLEDGE/LEARNING tiers
- **Telos** — Life OS mission, goals, beliefs, wisdom
- **19 thinking capabilities** — FirstPrinciples, Council, RedTeam, SystemsThinking, etc.
- **Effort tiers** — E1 through E5 with tier-gated requirements
