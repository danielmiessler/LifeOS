# PAI v5.0 for Hermes Agent

> Run the PAI Life Operating System inside Hermes Agent

## What You Get

- **Algorithm v6.3.0** — 7-phase execution loop (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN)
- **ISA** — Ideal State Artifact primitive for defining "done" on any task
- **41 skill packs** — Thinking, research, engineering, creative, productivity, data scraping
- **Memory** — Persistent WORK/KNOWLEDGE/LEARNING tiers
- **Telos** — Life OS mission, goals, beliefs, wisdom management
- **Council** — Multi-agent collaborative debate
- **Delegation** — 6 parallelization patterns
- **Thinking capabilities** — 19 structured thinking methods
- And more — Interview, ContextSearch, Evals, Loop, Browser, Fabric, etc.

## Quick Install

```bash
# Clone the fork
git clone https://github.com/iknowkungfubar/Open_Personal_AI_Infrastructure.git
cd Open_Personal_AI_Infrastructure/targets/hermes

# Install for your Hermes profile (default: dev)
bash install.sh

# Or for a specific profile
HERMES_PROFILE=default bash install.sh
```

This copies all PAI skill packs to `~/.hermes/profiles/dev/skills/software-development/pai-*/`
and creates the memory infrastructure at `~/.hermes/profiles/dev/pai/`.

## Usage

### Full Algorithm

```bash
hermes -s pai-algorithm "build a CLI tool that scrapes Hacker News"
```

This runs mode classification → ISA scaffolding → 7-phase execution.

### Scaffold an ISA

```bash
hermes -s pai-isa "scaffold from prompt: rebuild auth system at tier E3"
```

### Multi-Agent Council Debate

```bash
hermes -s pai-council "Should we use PostgreSQL or SQLite for a desktop app?"
```

Launches 4 parallel agents with different personas, 3 rounds of debate.

### Parallel Research

```bash
hermes -s pai-research "extensive: current state of Rust GUI frameworks"
```

Spawns 6 parallel research agents, cross-verifies findings.

### Knowledge Management

```bash
hermes -s pai-knowledge "search knowledge: Cargo crate patterns"
hermes -s pai-knowledge "add entity: Company: Astral"
```

## Architecture

```
Hermes CLI
├── PAI Skills (45+ packs)
│   ├── pai-algorithm    — 7-phase execution loop
│   ├── pai-isa          — Ideal State Artifact
│   ├── pai-telos        — Life OS management
│   ├── pai-thinking     — 19 thinking capabilities
│   ├── pai-knowledge    — Typed knowledge graph
│   ├── pai-council      — Multi-agent debate
│   ├── pai-research     — Parallel research
│   ├── pai-delegation   — Work parallelization
│   └── ... 35+ more
├── PAI Memory (~/.hermes/.../pai/MEMORY/)
│   ├── WORK/            — Task ISAs
│   ├── KNOWLEDGE/       — Curated entities
│   └── LEARNING/        — Meta-patterns
└── PAI Identity (~/.hermes/.../pai/USER/)
    ├── PRINCIPAL_IDENTITY.md
    ├── DA_IDENTITY.md
    └── TELOS/
```

## Skill List

| Skill | Purpose |
|-------|---------|
| `pai-algorithm` | 7-phase execution loop, mode classifier, effort tiers |
| `pai-isa` | Ideal State Artifact — scaffold, reconcile, check-completeness |
| `pai-telos` | Life OS — mission, goals, beliefs, wisdom |
| `pai-knowledge` | Typed knowledge graph — People, Companies, Ideas |
| `pai-thinking` | 19 structured thinking capabilities |
| `pai-council` | Multi-agent collaborative debate (4 agents, 3 rounds) |
| `pai-research` | Multi-agent parallel research (4 depth modes) |
| `pai-delegation` | 6 parallelization patterns |
| `pai-interview` | Phased onboarding for DA identity |
| `pai-context-search` | Session recovery across transcripts |
| `pai-evals` | Evaluation framework (pass@k scoring) |
| `pai-loop` | Iterative improvement — wrap Algorithm in cycles |
| `pai-first-principles` | Physics-based reasoning |
| `pai-systems-thinking` | Causal loop, archetype, leverage point analysis |
| `pai-root-cause-analysis` | 5 methods — 5Whys, Fishbone, Fault Tree, Postmortem, KT |
| `pai-red-team` | Adversarial stress-testing with 32 agents |
| `pai-science` | Scientific method — hypothesis → experiment → measure |
| `pai-iterative-depth` | Multi-lens sequential exploration |
| `pai-aperture-oscillation` | Tactical ↔ strategic scope switching |
| `pai-ideate` | 9-phase evolutionary ideation engine |
| `pai-be-creative` | Divergent ideation via Verbalized Sampling |
| `pai-world-threat-model` | 11-horizon risk assessment |
| `pai-bitter-pill` | Over-prompting audit |
| `pai-browser` | Headless browser automation |
| `pai-fabric` | 240+ Fabric prompt patterns |
| `pai-arxiv` | Academic paper search and retrieval |
| `pai-extract-wisdom` | Content-adaptive wisdom extraction |
| `pai-us-metrics` | 68 US economic indicators |
| `pai-private-investigator` | Ethical OSINT and identity verification |
| `pai-create-cli` | TypeScript CLI generation templates |
| `pai-create-skill` | PAI skill development lifecycle |
| `pai-security` | Security assessment frameworks |
| `pai-apify` | Social media scraping via Apify |
| `pai-brightdata` | Progressive web scraping |
| `pai-interceptor` | Real Chrome automation |
| `pai-media` | Visual content generation |
| `pai-webdesign` | Web/UI design pipeline |
| `pai-writing` | Fiction and content writing |
| `pai-prompting` | Meta-prompting standard library |
| `pai-aphorisms` | Curated aphorism collection with CRUD |
| `pai-migrate` | External content intake pipeline |
| `pulse` | MCP server for notifications + Life Dashboard |
| `pai-documentation` | System documentation management |

## Prerequisites

- [Hermes Agent](https://hermes-agent.nousresearch.com) installed
- Python 3.10+
- For some skills: `curl`, `jq`, Python packages (installed by install.sh)
