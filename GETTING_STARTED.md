# Getting Started with PAI v5.0 Port

> Which target should you use? This guide helps you decide.

## Quick Decision Tree

```
You want to use PAI with...
│
├── Hermes Agent ──────────→ targets/hermes/ — Most complete port
│                             38 skills, install script, persistent memory
│
├── Pi-mono (pi-coding-agent) → Releases/Pi/ — Model-agnostic port
│                             27 skills, works with any LLM provider
│                             (Ollama, OpenAI, Anthropic, OpenRouter)
│
├── OpenCode (Codex CLI) ──→ targets/opencode/ — Context-file port
│                             Files the agent reads at session start
│                             (no native skill system)
│
└── I just want the spec ──→ spec/ — Technology-agnostic specification
                               36 FRs, 33 BRs, data model, flow maps
```

---

## Hermes Agent (Recommended)

**If you have Hermes Agent installed**, this is the most complete port.

```bash
# Clone the fork
git clone https://github.com/iknowkungfubar/Open_Personal_AI_Infrastructure.git
cd Open_Personal_AI_Infrastructure/targets/hermes

# Install (installs 38 skills + memory infrastructure)
bash install.sh

# Verify
hermes skills list | grep pai-

# Use
hermes -s pai-algorithm "your task here"
```

**Prerequisites:** [Hermes Agent](https://hermes-agent.nousresearch.com) installed (Python 3.10+)

**What you get:** 38 skill packs including:
- Algorithm v6.3.0 — 7-phase execution loop
- ISA — Ideal State Artifact for defining "done"
- Multi-agent Council debate (4 agents, 3 rounds)
- Parallel Research (4 depth modes)
- 19 structured thinking capabilities
- Telos — Life OS management
- Knowledge graph — People, Companies, Ideas
- Memory — WORK, KNOWLEDGE, LEARNING tiers
- + 30 more skills across all categories

---

## Pi-mono Agent

**If you want model-agnostic PAI** (works with Ollama, OpenAI, Anthropic, OpenRouter, or any LLM).

```bash
# 1. Install Pi
npm install -g @mariozechner/pi-coding-agent

# 2. Clone and copy the scaffold
git clone https://github.com/iknowkungfubar/Open_Personal_AI_Infrastructure.git
cd Open_Personal_AI_Infrastructure/Releases/Pi

# 3. Copy everything to Pi's config directory
cp -r config/* ~/.config/PAI-pi/
cp -r extensions/* ~/.config/PAI-pi/extensions/
cp -r skills/* ~/.config/PAI-pi/skills/
cp -r memory/* ~/.config/PAI-pi/memory/

# 4. Configure your model in models.json
```

**Prerequisites:** Node.js 18+, Pi agent `npm install -g @mariozechner/pi-coding-agent`

**What you get:** 27 skill packs with full Algorithm v6.3.0, ISA scaffold extension (820 lines), and model-agnostic methodology.

---

## OpenCode (Codex CLI)

**If you use OpenAI Codex CLI**, this port provides PAI as context files.

```bash
# Clone and copy
git clone https://github.com/iknowkungfubar/Open_Personal_AI_Infrastructure.git
cd Open_Personal_AI_Infrastructure/targets/opencode/pai
cp -r * ~/.codex/pai/

# Start Codex with PAI context
cd ~/.codex/pai && source init.sh

# Or manually:
codex --context-dir ~/.codex/pai

# Then tell the agent:
# "Use the Algorithm on this task. Start with OBSERVE phase."
```

**Prerequisites:** Codex CLI (`pip install codex-cli` or via npm)

**What you get:** Full Algorithm v6.3.0 as agent instructions, ISA template, 19 thinking capability methodologies, memory structure reference.

---

## Specification Only

**If you just want to read the spec**, start here:

- [spec/index.md](spec/index.md) — System overview
- [spec/01-functional-requirements.md](spec/01-functional-requirements.md) — 36 requirements
- [spec/02-business-rules.md](spec/02-business-rules.md) — 33 business rules  
- [spec/05-flow-maps.md](spec/05-flow-maps.md) — 10 Mermaid diagrams
- [spec/port-plan.md](spec/port-plan.md) — Full migration strategy

---

## What's Included

| Feature | Hermes | Pi-mono | OpenCode |
|---------|--------|---------|----------|
| Algorithm v6.3.0 | ✅ 38 skills | ✅ 27 skills | ✅ Context files |
| ISA scaffold | ✅ pai-isa skill | ✅ pai-core extension | ✅ ISA.md template |
| Multi-agent Council | ✅ pai-council | ⚠️ Thinking skill | ❌ Manual |
| Parallel Research | ✅ pai-research | ✅ Research skill | ✅ research.md |
| 19 Thinking capabilities | ✅ pai-thinking + 11 individual | ✅ Thinking skill | ✅ thinking.md |
| Telos/Life OS | ✅ pai-telos | ✅ Telos skill | ✅ SYSTEM.md ref |
| Knowledge Graph | ✅ pai-knowledge | ✅ Knowledge skill | ✅ MEMORY/README.md |
| Voice notifications | ✅ All 38 skills | ✅ Listed in docs | ❌ N/A |
| Install script | ✅ bash install.sh | ⚠️ Manual copy | ⚠️ Manual copy |
| Memory persistence | ✅ Auto-created | ✅ Filesystem | ⚠️ Manual |
