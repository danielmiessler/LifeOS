# PAI v5.0 for OpenCode (Codex CLI)

> PAI Life Operating System methodology as context files for OpenAI Codex CLI

## What This Is

OpenCode has no native skill system. This port delivers PAI v5.0 as read-only context files that the agent loads at session start. The agent follows these instructions manually — no automation, no routing, no hooks.

## What You Get

| File | Content |
|------|---------|
| `SYSTEM.md` | Full Algorithm v6.3.0 — prime directive, mode classifier, 5 effort tiers, all 7 phases, ISC rules, 19 thinking capabilities |
| `ISA.md` | Complete ISA template with all 12 sections, tier-gate requirements, ISC format, feature dependency patterns |
| `MEMORY/README.md` | Memory structure — WORK/KNOWLEDGE/LEARNING tiers, entity types, wikilinks, crossing references |
| `skills/thinking.md` | All 19 thinking capability methodologies with full procedures |
| `skills/research.md` | Multi-mode research workflow (Quick/Standard/Extensive/Deep) |
| `init.sh` | Bootstrap script to load PAI context into Codex |

## Quick Start

```bash
# Clone the fork
git clone https://github.com/iknowkungfubar/Open_Personal_AI_Infrastructure.git
cd Open_Personal_AI_Infrastructure/targets/opencode/pai

# Create Codex context directory
mkdir -p ~/.codex/pai
cp -r * ~/.codex/pai/

# Start Codex with PAI context
source ~/.codex/pai/init.sh
# or manually:
codex --context-dir ~/.codex/pai
```

## Usage

Once loaded, tell Codex to use the Algorithm:
```
"Run the Algorithm on this task. Start with OBSERVE phase."
```

Or use specific skills:
```
"Use FirstPrinciples to decompose this problem."
"Scaffold an ISA for this feature at tier E3."
```

## Limitations

- No native skill routing — the agent must be told which skill to use
- No hooks — no automated lifecycle event handling
- No cron — no recurring job scheduling
- No containment zones — no automatic privacy enforcement
- The agent follows instructions manually; quality depends on the model
