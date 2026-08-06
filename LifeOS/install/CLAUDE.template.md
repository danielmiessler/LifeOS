# LifeOS 7.28.3 — the Life Operating System

> **LifeOS is the AI harness that moves you from current state to ideal state — an intent engineering platform. The DA is the principal's AI assistant. Pulse is the Life Dashboard.**
> Canonical thesis: `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`. Everyone running LifeOS names their own DA. LifeOS targets AS3 on the LifeOS Maturity Model, with lineage from "The Real Internet of Things" (2016).

@LIFEOS/DOCUMENTATION/ARCHITECTURE_SUMMARY.md
# Identity @-imports below are activated by the agentic `/LifeOS setup` (via `skills/LifeOS/Tools/ActivateImports.ts`) once the principal scaffolds USER files.
# Claude Code does not follow transitive @-imports, so each must be listed here directly.
# @LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md
# @LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md
# @LIFEOS/USER/DIGITAL_ASSISTANT/DA_IDENTITY.md
# @LIFEOS/USER/PROJECTS.md
# @LIFEOS/USER/CONFIG/OPERATIONAL_RULES.md
# @LIFEOS/USER/CUSTOMIZATIONS/GLOBAL.md

## Constitutional layer

Constitutional rules, the unified response format, verification doctrine, hard prohibitions, security protocol, and operational rules all live in the system prompt: `LIFEOS/LIFEOS_SYSTEM_PROMPT.md`. When this file and the system prompt disagree, the system prompt wins.

This file is the **routing table** — it tells you where everything lives. The only mandatory startup `@`-import shipped with public LifeOS is `ARCHITECTURE_SUMMARY`. The five identity files (`PRINCIPAL_TELOS`, `PRINCIPAL_IDENTITY`, `DA_IDENTITY`, `PROJECTS`, `OPERATIONAL_RULES`) are commented out above — the agentic `/LifeOS setup` (via `skills/LifeOS/Tools/ActivateImports.ts`) uncomments them once the principal's USER scaffold is populated. Claude Code does not follow transitive `@`-imports from inside imported files, so each identity file must be listed here at top level. Everything below is **on-demand** lookup. Paths are relative to `~/.claude/` unless noted.

## LifeOS System (paths under `LIFEOS/DOCUMENTATION/` unless noted)

- **Life OS thesis** — `LifeOs/LifeOsThesis.md` (canonical source of truth)
- **Life OS schema** — `LifeOs/LifeOsSchema.md` (biography-flat, PascalCase, frontmatter contract)
- **System prompt** — `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` (loaded via `--append-system-prompt-file`; home of the constitutional rules and response format)
- **System architecture** — `LifeosSystemArchitecture.md` (master doc)
- **Architecture summary** — `ARCHITECTURE_SUMMARY.md` (loaded via @-import)
- **Core components** (canonical two-tier component map) — `CoreComponents.md`
- Algorithm (the unified thinking system) — `Algorithm/AlgorithmSystem.md`
- Cortex (the memory system) — `Memory/MemorySystem.md`
- Skills — `Skills/SkillSystem.md`
- Hooks — `Hooks/HookSystem.md`
- Agents — `Agents/AgentSystem.md`
- Delegation — `Delegation/DelegationSystem.md` (RETIRED — history only; agent orchestration is native harness surface: tool schemas + Algorithm §Spend election rules)
- Router — `Router/RouterSystem.md` (RETIRED — history only; mode/tier classification was abolished and model rungs now live in `LIFEOS/TOOLS/models.ts`)
- Security — `Security/README.md`
- Notifications — `Notifications/NotificationSystem.md`
- Observability — `Observability/ObservabilitySystem.md`
- Pulse — `Pulse/PulseSystem.md`
- Pulse metadata catalog (badges/strips/panels) — `Pulse/PulseMetadata.md`
- Pulse tooltips — `Pulse/Tooltips.md`
- DA subsystem (design) — `Pulse/DaSubsystem.md`
- Ledger (change tracking: versioning, update registry, integrity gate, deploy events) — `Ledger/LedgerSystem.md`
- Upgrades (the system-improvement queue) — `Upgrades/UpgradesSystem.md`
- Atlas (current state of everything you own; `atlas` CLI, Pulse `/atlas`) — `Atlas/AtlasSystem.md`
- Synapse (input router — capture → amber ledger → grade vs TELOS → route) — `Synapse/SynapseSystem.md`
- Conduit (sensory layer — local current-state capture, feeds memory + TELOS) — `Conduit/ConduitSystem.md`
- Work system (capture surfaces → private GitHub Issues as system of record) — `Work/WorkSystem.md`
- Background services (every recurring job + the one-shot installer) — `Services/BackgroundServices.md`
- Hermes sidecar (optional second front door — talk to your LifeOS as an agent) — `Hermes/HermesSidecar.md`
- Custom spinner verbs + tips — `Spinner/SpinnerSystem.md`
- Brand assets — `BrandAssets.md`
- CLI tools (Algorithm + Arbol) — `Tools/Cli.md`
- CLI-first architecture — `Tools/CliFirstArchitecture.md`
- Configuration — `Config/ConfigSystem.md`
- Containment policy — `Tools/Containment.md`
- Arbol (cloud execution) — `Arbol/ArbolSystem.md`
- Feed — `Feed/FeedSystem.md`
- Fabric — `Fabric/FabricSystem.md`
- Freshness convention (`pai-freshness-v1`) — `Freshness/FreshnessSystem.md`
- Terminal tabs — `Pulse/TerminalTabs.md`
- Tools reference — `Tools/Tools.md`
- ISA — `ISA/ISASystem.md`
- ISA format spec — `ISA/ISAFormat.md`
- Testing doctrine — `Testing/TestingDoctrine.md`
- System/user boundary — `SystemUserBoundary.md` (which files are SYSTEM, which are USER, how the boundary is enforced)
- AI writing patterns (system-level reference) — `Writing/AIWritingPatterns.md`
- Browser automation — `Skill("Interceptor")` (real Chrome, mandatory for verification)
- Claude Code knowledge — `Agent(subagent_type="claude-code-guide")`

## Principal — Identity & Voice (paths under `LIFEOS/USER/`)

Populated during `/LifeOS setup`. Typical layout:

- Principal identity — `PRINCIPAL/PRINCIPAL_IDENTITY.md` (canonical, @-imported)
- Career & resume — `PRINCIPAL/RESUME.md`
- Writing style — `PRINCIPAL/WRITINGSTYLE.md`
- Pronunciations — `PRINCIPAL/PRONUNCIATIONS.json` (TTS rules — Pulse VoiceServer reads this)
- Contacts — `CONTACTS.md`
- Definitions — `DEFINITIONS.md`
- Core content themes — `CANONICAL_CONTENT.md`

## Principal — Life Goals

- TELOS (single source of truth, unified H2 sections) — `LIFEOS/USER/TELOS/TELOS.md`
- Auto-generated derivative — `LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md`
- Dimension percentages — `LIFEOS/USER/TELOS/LIFEOS_STATE.json` (Pulse rings + statusline read from this)
- Freshness convention — see `LIFEOS/DOCUMENTATION/Freshness/FreshnessSystem.md`

## Principal — Work (paths under `LIFEOS/USER/`)

- Business — `BUSINESS/`
- Health — `HEALTH/`
- Finances — `FINANCES/`
- Integration configs — `INTEGRATIONS/*.yaml`
- Work system — `WORK/config.yaml`
- Secrets — `~/.claude/.env` (canonical; see OPERATIONAL_RULES.md)

## Project-Specific Rules

Drop project-scoped CLAUDE.md files alongside each project (e.g. `~/code/your-project/CLAUDE.md`) for rules that only apply inside that codebase. Claude Code merges them with this global file when sessions start in that directory. Use them for invariants that bite repeatedly — "always use the X helper, never bare Y" — so the rule lives next to the code it governs.
