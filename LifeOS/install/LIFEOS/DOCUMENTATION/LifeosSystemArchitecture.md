---
last_updated: 2026-07-12T00:00:00Z
last_updated_by: kai
convention: pai-freshness-v1
last_reviewed: 2026-05-04T18:27:00.870Z
last_reviewed_by: {{PRINCIPAL_NAME}}
version: 1.9.48
---

# What LifeOS is and Why it Exists

I created LifeOS in June of 2025 to answer a single question:

> What are we building with all this AI?

It's great that we have all these prompts, and models, and agents, and harnesses…but what are we actually *doing* with them?

LifeOS is my answer to that question. It's an AI system built around people, designed to magnify our capabilities and help us pursue our ideal state. The system can not only still build, and code, and do all the regular stuff an AI harness does, but it does all those things better because it deeply understands the larger picture of what you're trying to accomplish.

## Principles

- Human at the center: not the tech. Tech is here to improve the lives of people, not the other way around.
 
- It does this by building a personal LifeOS using TELOS to help you capture, articulate, and pursue your life and work goals (show the dashboard, etc.). So it's not just an agent, a coding harness, or anything like that. It has those capabilities, of course, but ultimately it's goal is to be a full LifeOS that helps you pursue your ideal state in life and work.

- Pursuing Ideal State: A Huge problem With all AI, the inability to define what good or done looks like, which is why LifeOS is based around the concept of Ideal State, or specifically the transition between current and ideal state. And this concept is Woven throughout the entire LifeOS system, With the primary case being the ISAS system, which is the ideal state artifact . An ideal state artifact is similar to a software development PRD, where we are capturing what done looks like so that we can work towards it. The difference between an ISA and a PRD is that an ISA is designed to be general for any type of creative task, From design to art to philosophy to engineering or software. The system creates discrete ideal state criteria (ISCs), which make up the content of the ISA document and also serve as the verification items. This allows LifeOS to hill climb towards ideal state for any task.

- We believe a single Digital Assistant will be everyone's primary interface to AI. See the recent blog about we're all building the same thing, and linking to TRIOT where we talked about it in 2016. The motion from chatbots to agents to assistants, in PAIMM, etc. Also talk about the main 4 concepts in TRIOT:
     
    * Digital Assistants
    * Everything Gets an API
    * Our DA creates our Interfaces Dynamically
    * We define our ideal state and AI helps us figure out how to get there 

## Features 

- Heavy bias towards text. We try to avoid opaque storage structures whenever possible, e.g., SQLite, Postgres, as we want everything to be as transparent and parsable as possible
- Context Scaffolding > Model: We believe the mistake most people make With AI is not properly feeding it the big picture via context engineering. LifeOS is ultimately a system for providing the smartest models with the context about you and what you are trying to accomplish, along with the best possible tooling, so it can help you accomplish your goals and move towards ideal state
- Bitter Pilled Engineering: Although we believe strongly in the context scaffold (see above), We also believe strongly that as models get stronger, we will have to give them fewer instructions on how to specifically accomplish tasks. We constantly adjust LifeOS to ensure that we are removing overly heavy prescriptive directions where the model may be able to execute that better, given the right context and tools. 
- Filesystem as context. We have avoided RAG since our start in June 2025, believing that rich text content (and cross-refferences), combined with fast search such as with Ripgrep can give us everyting people usually want from a RAG system, but without the complexity and loss-related issues from embeddings and retreival mechanisms
- A powerful MEMORY system built around our text-based architecture, which allows us to constantly gather signal on what we've done, learned, and provide inputs for improvement
- A self-improvement system for LifeOS itself by constantly capturing what goes well and poorly during execution
- A custom Algorithm system that moves through the current to ideal state transition using an analog of the scientific method and Deutschian concepts of Hard-to-Vary Explanations.
- A custom Skill system with a bias towards deterministic code execution, meaning our structure goes: Code, CLI to execute that code, workflows, which are prompts that control the CLI, and then the overall Skill file which has a routing table of the workflows. This way skills are the container for the overal function, and the SKILL.md file explains what the skill does and how to get various tasks done by using its workflows. But ideally each skill is ultimatelly calling code via a CLI.
- A considerable number of custom thinking skills that help improve the quality of decisions made by the Algorithm and overall system.

# LifeOS System Architecture

**LifeOS is the Life Operating System.** It is the framework that turns AI from a chatbot you talk to into a system that runs your life — it knows your goals, people, workflows, current state, and ideal state, and continuously hill-climbs you from one to the other. The DA (your Digital Assistant) is the primary interface to this OS. **Pulse** is the Life Dashboard — the visible surface onto the LifeOS.

LifeOS targets **AS3** on the [LifeOS Maturity Model](https://example.com/blog/personal-ai-maturity-model), with lineage from [The Real Internet of Things](https://example.com/blog/the-real-internet-of-things) (2016).

**Canonical thesis:** `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md` — read this first when any framing question comes up. This architecture doc describes *how* the OS is built; the thesis doc describes *what* the OS is for.

**Version:** LifeOS 7.1.1 | Algorithm v8.4.0 | Memory v8.2.0

---


### The Telos System — The Ideal State Input

A hill-climb is meaningless without a destination. **Telos is the destination.**

Telos captures the person's mission, goals, beliefs, wisdom, strategies, narratives, challenges, mental models, and formative experiences — the full stack of inputs that define what their ideal state actually *is*. Without Telos, the DA is just a fancy chatbot. With it, the DA is a system that knows where you're going and can route every decision through that frame.

Telos is where migration is *managed*. Goals evolve, beliefs sharpen, strategies update, narratives shift as the person grows. The LifeOS treats Telos as a living document — continuously refined through the same hill-climb that uses it as input.

- Telos overview: [`../USER/TELOS/README.md`](../USER/TELOS/README.md)
- Principal Telos (auto-generated summary loaded at startup): [`../USER/TELOS/PRINCIPAL_TELOS.md`](../USER/TELOS/PRINCIPAL_TELOS.md)

### Pulse — The Life Dashboard

A LifeOS you cannot see is a LifeOS you cannot steer.

**Pulse is the Life Dashboard.** It is the visible surface onto the LifeOS — the place where the person (and the DA, and every background worker) sees current state versus ideal state, goal progress, workflows, observability, voice, chat surfaces, and the day-in-the-life preview.

Pulse runs at **`http://localhost:31337`**. The root lives at that URL because the Telos system — the ideal-state spine — lives there. Everything else on Pulse is a window onto the same OS.

Deeper reference: [`Pulse/PulseSystem.md`](./Pulse/PulseSystem.md).

### The Human 3.0 Progression

LifeOS is not neutral about outcomes. It is built to move people toward **Human 3.0** — a stance in which a person is a creative self-directed individual defining themselves through the unique value they create, rather than by a job title assigned to them by a corporate hierarchy.

That transition happens in four stages. Each stage is a state along the hill-climb. The LifeOS is designed to move the person through them, in order, over time.

**Aware** — The person understands the Human 3.0 model and recognizes the gap between who they are now and who they could be. Awareness alone doesn't change anything, but without it, nothing else is possible. The system's job here is exposure.

**Activated** — The person commits to the transition. They start articulating a mission, capturing goals, writing down beliefs, naming the strategies they want to run. They begin using the LifeOS as a LifeOS, not just a chat tool. Telos starts filling out. The DA starts mattering.

**Aligned** — The person's daily behavior matches their stated Telos. Work, time, attention, money, relationships, and consumption flow in directions consistent with their mission and goals. Gaps between declared ideal state and lived current state close measurably. The DA's role here is enforcement and reinforcement — catching drift, surfacing misalignment, suggesting the next move.

**Actualized** — The person is living their Human 3.0. Their daily life is the day-in-the-life preview they once reverse-engineered. Mission, goals, beliefs, strategies, creative output, relationships, and health are integrated. The DA still runs the hill-climb — the ideal state always evolves — but the gap is narrow and the motion is continuous.

**Every LifeOS upgrade is measured against whether it moves someone along this progression.** A feature that does not serve Aware → Activated → Aligned → Actualized is a feature the system does not need.

### Technical Infrastructure Is Secondary

LifeOS has a substantial technical architecture — an Algorithm, a memory stack, a skills library, agent teams, hooks, an observability pipeline, a notifications system, containment policies, a cloud execution layer, a feed system, and more. All of that is real, and all of that is load-bearing.

**But none of it is the point.** The Algorithm exists so the hill-climb is reliable. Memory exists so the current state is accurate. Skills exist so the DA can take action that closes the gap. Agents exist so the work parallelizes. Hooks exist so the system runs when nobody is watching. Pulse exists so the human can see it happening.

The infrastructure serves the philosophy. If the philosophy is clear, the infrastructure stays coherent. If the philosophy is lost, the infrastructure becomes a pile of clever tools that don't add up to a life. The rest of this document is the infrastructure.

---

## Directory Structure

```
$LIFEOS_ROOT/                           # Claude Code native directory
  CLAUDE.md                          # Operational instructions (directly edited)
  settings.json                      # Runtime settings (directly edited)
  LIFEOS_CONFIG.yaml                    # Credentials store for private skills (gitignored)
  hooks/                             # Event lifecycle hooks
  skills/                            # All skills, each with SKILL.md
  agents/                            # Agent definitions
  commands/                          # Custom commands
  channels/                          # Channel integrations
  plugins/                           # Plugin integrations
  LIFEOS/                               # System docs, tools, user context
    Algorithm/                       # Algorithm versions + optimization modes
    Components/                      # Source components for CLAUDE.md generation
    Tools/                           # TypeScript utilities
    MEMORY/                          # Persistent memory stores
    USER/                            # User context (identity, contacts, projects)
```

---

## The Founding Principles

These are the immutable design principles that govern all LifeOS development.

### 0. LifeOS is the Life Operating System

LifeOS is not a chatbot, not a dashboard, not a passive "AI scaffolding framework." LifeOS is the **Life Operating System** — the framework that manages the resources, processes, identity, memory, and interfaces that let a human live and work with a DA as their primary interface. The DA is the interface. Pulse is the visible dashboard. LifeOS is the OS behind both. The target maturity level is AS3 on the [LifeOS Maturity Model](https://example.com/blog/personal-ai-maturity-model). The core loop is Current State → Ideal State via continuous hill-climbing. This principle is the root from which every other principle derives. Canonical thesis: `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`.

### 1. Customization of an Agentic Platform for Achieving Your Goals

LifeOS exists to help you accomplish your goals in life -- and perform the work required to get there. It democratizes access to personalized agentic infrastructure: a system that knows your goals, preferences, context, and history, and uses that understanding to help you more effectively. Generic AI starts fresh every time. Customized AI compounds intelligence with every interaction.

### 2. The Continuously Upgrading Algorithm (THE CENTERPIECE)

This is the gravitational center of LifeOS -- everything else exists to serve it. LifeOS is built around a universal algorithm for accomplishing any task: **Current State -> Ideal State** via verifiable iteration. The Memory System captures signals, the Hook System detects behavioral patterns, and all of it feeds back into improving The Algorithm itself. A system that cannot improve itself will stagnate.

### 3. Clear Thinking + Prompting is King

The quality of outcomes depends on the quality of thinking and prompts. Before any code, before any architecture -- there must be clear thinking. Understand the problem deeply before solving it. Define success criteria before building. Prompt engineering is real engineering.

### 4. Scaffolding > Model

The system architecture matters more than the underlying AI model. A well-structured system with good scaffolding will outperform a more powerful model with poor structure. Build the scaffolding first, then add the AI.

### 5. As Deterministic as Possible

Favor predictable, repeatable outcomes over flexibility. Same input produces same output. Behavior defined by code, not prompts. Version control tracks explicit changes. If it can be made deterministic, make it deterministic.

### 6. Code Before Prompts

Write code to solve problems, use prompts to orchestrate code. Prompts should never replicate functionality that code can provide. Code is cheaper, faster, and more reliable than prompts.

### 7. Spec / Test / Evals First

Define expected behavior before writing implementation. Write tests before code. For AI components, write evals with golden outputs. If you cannot specify it, you cannot test it. If you cannot test it, you cannot trust it.

### 8. UNIX Philosophy (Modular Tooling)

Do one thing well. Compose tools through standard interfaces. Each tool does one thing excellently. Tools chain together via standard I/O. Prefer many small tools over one monolithic system.

### 9. ENG / SRE Principles ++

AI systems are production software. Version control for prompts and configurations. Monitoring and observability. Graceful degradation and fallback strategies. Apply the same rigor as any production system.

### 10. CLI as Interface

Every operation should be accessible via command line. CLI provides discoverability, scriptability, testability, and transparency. If there is no CLI command for it, you cannot script it or test it reliably.

### 11. Goal -> Code -> CLI -> Prompts -> Agents

The proper development pipeline: User Goal -> Understand Requirements -> Write Deterministic Code -> Wrap as CLI Tool -> Add AI Prompting -> Deploy Agents. Each layer builds on the previous. Skip a layer, get a shaky system.

### 12. Custom Skill Management

Skills are the organizational unit for all domain expertise. Self-activating, self-contained, composable, evolvable. Skills are how LifeOS scales -- each new domain gets its own skill.

### 13. Custom Memory System

Automatic capture and preservation of valuable work. Every session, every insight, every decision -- captured automatically. Memory makes intelligence compound. Without memory, every session starts from zero.

### 14. Custom Agent Personalities / Voices

Specialized agents with distinct personalities for different tasks. Voice identity, personality calibration, specialization, autonomy levels. Personality is functional, not decorative.

### 15. Science as Cognitive Loop

The scientific method is the universal cognitive pattern: Goal -> Observe -> Hypothesize -> Experiment -> Measure -> Analyze -> Iterate. Falsifiability, pre-commitment, three-hypothesis minimum. Science is not a separate skill -- it is the pattern that underlies all systematic problem-solving.

### 16. Permission to Fail

Explicit permission to say "I don't know" prevents hallucinations. Fabricating an answer is far worse than admitting uncertainty.

### 17. System/User Separation (Public-by-Construction, Three-Layer Enforcement)

The LifeOS live tree and the public release are structurally identical modulo a symlink — system data and user data live in two physically separate trees, joined at runtime. The separation is enforced at three independent layers; each catches drift the others would miss.

**Physical layout (post-Phase-A→G migration, 2026-05-20→23):**
- `$LIFEOS_ROOT/` — public LifeOS SYSTEM tree (what ships on GitHub). Contains the symlink `LIFEOS/USER → ~/.config/LIFEOS/USER`.
- `~/.config/LIFEOS/USER/` — private user-data git working tree (the user's own private USER-data repo). Mounted via symlink so Claude Code's `@`-import resolver reaches identity/TELOS/config files at session start.
- `~/.config/LIFEOS/USER/MEMORY/` — durable subset of memory (KNOWLEDGE, WORK/<slug>/ISA.md, RELATIONSHIP, WISDOM, PLANS, RESEARCH, STATE/work.json, BOOKMARKS, REFERENCE, SKILLS, PROJECT, TEAMS, SYSTEMUPDATES, VERIFICATION) git-tracked in the user's private USER-data repo; ephemeral subset (OBSERVABILITY, STATE caches, LEARNING signals, SECURITY artifacts, VOICE event log, _BROWSER_STATE) gitignored locally.

**Four allowed access patterns** (any fifth pattern is a boundary violation):
1. `LifeosConfig.load()` typed loader (`LIFEOS/TOOLS/LifeosConfig.ts`) — primary channel for identity, voice, integrations, paths
2. Paths computed from `LifeosConfig.paths.userDir + relative` — never from literal `LIFEOS/USER/` strings in system code
3. At-startup `@`-imports declared at the top of `$LIFEOS_ROOT/CLAUDE.md` (CC does NOT follow transitive `@`-imports)
4. HTTP/IPC via the Pulse server at `localhost:31337`

**Three enforcement layers:**
1. **Write-time** — `hooks/SystemFileGuard.hook.ts` (PreToolUse) blocks writes to SYSTEM files when content matches deny-list patterns. Fail-safe-open on hook errors. 19/19 tests pass. Primary defense.
2. **PR-time** (Phase H, deferred) — GitHub Actions runs `DenyListCheck.ts` on every PR against the public repo.
3. **Release-time** — `skills/_LIFEOS/Tools/ShadowRelease.ts` runs 14 gates (G1–G14: zone deletion, identity grep, CF ID grep, trufflehog, .env strays, private tokens, ref integrity, private-skill refs, username-path leak, staging boot, dashboard leak, template-only USER/MEMORY, hidden-file leakage, critical-artifact presence). Backstop. Should consistently return zero findings if layers 1 and 2 are healthy.

**Two-repo sync** — `$LIFEOS_ROOT/.git/hooks/pre-push` auto-commits and pushes `~/.config/LIFEOS/USER/` to the user's private USER-data repo before each push from `$LIFEOS_ROOT/`. The two repos stay in sync structurally. A private "kai update" / "push both repos" workflow wraps this with 4 boundary gates (USER-zone leak check, DenyListCheck, both-remotes-private confirmation, post-push HEAD verification).

Configuration files (`settings.json`, `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md`) are directly edited; `settings.json` is split into `settings.system.json` (public) + `settings.user.json` (USER) merged at SessionStart by `LIFEOS/TOOLS/MergeSettings.ts`. Identity values live in `settings.json` under `daidentity` and `principal` keys; private skills read credentials via `LifeosConfig.ts` from `LIFEOS/USER/CONFIG/LIFEOS_CONFIG.toml`. Full contract: `LIFEOS/DOCUMENTATION/SystemUserBoundary.md`.

---

## Instruction Hierarchy -- The Model's Input Chain

LifeOS injects instructions into Claude Code sessions through a 4-layer hierarchy. Each layer has different authority, persistence, and purpose.

```
Layer 1: SYSTEM PROMPT (highest authority, survives compaction)
  File: LIFEOS/LIFEOS_SYSTEM_PROMPT.md (via --append-system-prompt-file)
  Contains: Constitutional rules -- identity, mode architecture, mode templates
  (NATIVE/ALGORITHM/MINIMAL field structures), effort overrides, format mandate,
  verification requirement, hard prohibitions, operational rules, security protocol.

Layer 2: CLAUDE.MD (user context, loaded natively, survives compaction)
  File: $LIFEOS_ROOT/CLAUDE.md (directly edited)
  Contains: Routing table only -- @-imports, where each subsystem doc lives,
  pointers into {{PRINCIPAL_NAME}}'s identity/voice/TELOS/work content. ~75 lines.

Layer 3: @IMPORTED FILES (loaded with CLAUDE.md, survive compaction)
  Files: PRINCIPAL_IDENTITY, DA_IDENTITY, PROJECTS, PRINCIPAL_TELOS,
  LIFEOS_ARCHITECTURE_SUMMARY
  Contains: Rich identity context, project routing, goals, system architecture map.

Layer 4: DYNAMIC CONTEXT (session-specific, ephemeral, does NOT survive compaction)
  Injected by: LoadContext.hook.ts (SessionStart)
  Contains: Relationship context, learning readback, active work summary.
```

### Design Principles

1. **System prompt = constitution.** Behavioral invariants — identity, mode architecture, mode templates, operational rules, verification doctrine, security protocol. Stable, cacheable.
2. **CLAUDE.md = routing table.** Where everything lives. @-imports plus on-demand pointers into subsystem docs and {{PRINCIPAL_NAME}}'s content. No constitutional rules here — those live in the system prompt.
3. **@Imports = rich context.** Who you are, what you know, system architecture map.
4. **Dynamic context = session state.** What happened recently. Rebuilt each session.
5. **PostCompact = belt and suspenders.** RestoreContext.hook.ts re-injects critical files after compaction.
6. **System prompt is primary-agent only.** Subagents get their agent definition body, not core LifeOS rules.

### Key File Paths

| File | Purpose |
|------|---------|
| `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` | Constitutional rules (system prompt layer) |
| `$LIFEOS_ROOT/CLAUDE.md` | Routing table — @-imports + subsystem pointers (directly edited) |
| `$LIFEOS_ROOT/settings.json` | Runtime settings (directly edited) |
| `LIFEOS/TOOLS/lifeos.ts` | Launcher -- wires `--append-system-prompt-file` |
| `hooks/LoadContext.hook.ts` | Injects startup files + dynamic context |

---

## Subsystem Architecture

Each subsystem has its own detailed documentation. This section provides orientation -- what each subsystem does and where to find its full doc.

### The Algorithm

**The 7-phase execution engine at the center of LifeOS.**

Transitions from CURRENT STATE to IDEAL STATE via verifiable Ideal State Criteria (ISC): Observe -> Think -> Plan -> Build -> Execute -> Verify -> Learn. Supports three execution modes: interactive (human-in-the-loop), loop (autonomous), and optimize (hill-climbing against a metric). The Algorithm is versioned independently and self-improves through accumulated learning signals.

- **Version:** v6.29.0
- **Location:** `LIFEOS/ALGORITHM/` (canonical pointer: `LATEST` → `v8.0.0.md`)
- **CLI:** `bun LIFEOS/TOOLS/algorithm.ts`
- **Full doc:** `LIFEOS/DOCUMENTATION/Algorithm/AlgorithmSystem.md`
- **Doctrine highlights (v6.11.0):** twelve-section ISA in fixed order; closed enumeration of thinking capabilities; Capability-Name Audit Gate (phantom names = CRITICAL FAILURE); ID-stability rule (ISC IDs never re-number on edit); Forge audit-mode cross-vendor audit OPTIONAL at E4/E5 in VERIFY, at the Algorithm's discretion (Rule 2a). **v6.11.0 addition — Tier-Scaled Delegation Effort:** the Algorithm tier scales the effort level of spawned agents (the layer where effort is programmable — a hook cannot set main-loop effort per turn); E1 low → E5 ultracode-by-composition (Workflow orchestration + xhigh agents, reproducing `/effort ultracode`). Selected at the PLAN Delegation Gate; mirror table in `capabilities.md`. The v6.10.0 property-testing doctrine remains a separate unpromoted candidate. **v6.9.0 — Resume After Complete:** an edit landing on a `phase: complete` ISA with body diff triggers deterministic auto-rewind to `phase: learn`, increments `iteration`, writes `resumed_at` + `resumed_from_phase: complete` to frontmatter, appends a Decisions row, and appends to `MEMORY/OBSERVABILITY/isa-rework.jsonl`. **v6.8.0:** Frame-Drift Check at VERIFY (three-test rubric T1/T2/T3 + Forge audit-mode adversarial second pass at E4/E5). **v6.7.0:** Context Sufficiency as universal LifeOS principle (Density Gate, Sufficiency Check, PLAN-entry Refresh, NATIVE-mode ambiguity flag).

### The Router (RETIRED 2026-07-11)

**The prompt-comprehension and execution-posture layer — history only.** Retired 2026-07-11 when mode/tier classification (MINIMAL/NATIVE/ALGORITHM, E1–E5) was abolished system-wide; there is no successor classifier.

It used to turn a raw prompt into a posture: mode, effort tier, the stated goal, the model rung, and which agent/vendor runs the work, via four stages — classify (`TheRouter.hook.ts`, deleted 2026-07-11), route the effort, select the model, dispatch the agent. Spend is now discovered from the work itself rather than predicted up front. What survives is model routing only: the four-level `EFFORT_MODEL` abstraction in `LIFEOS/TOOLS/models.ts`, applied at dispatch by `hooks/AgentInvocation.hook.ts` (injects `model` on unspecified Agent dispatches) and by `LIFEOS/TOOLS/Inference.ts` for utility inference.

- **Status:** Retired 2026-07-11 (named + documented 2026-07-01; classifier deleted with the mode/tier abolition)
- **Location (surviving model routing):** `LIFEOS/TOOLS/models.ts`, `hooks/AgentInvocation.hook.ts`, `LIFEOS/TOOLS/Inference.ts`
- **Full doc (history only):** `LIFEOS/DOCUMENTATION/Router/RouterSystem.md`

### Versioning

**How every change gets the right version and every version number stays coherent.** This is a convention plus a set of tools, not a named subsystem — the "Ledger" name (assigned 2026-07-06) was retired 2026-07-12 and its standalone doc folded into this section, which is now the canonical reference.

Every live version identifier is exactly three levels, **`Major.Feature.Patch`** — the OS umbrella (`LIFEOS/VERSION`), the Algorithm, the system prompt, the ISA Format spec, Memory, every skill's `version:`, every hook's `@version`, and every living doc's `version:`. The middle number is **Feature**, not "minor." Gates: Major = human conversation before the bump; Feature = one-line confirm at ship time; Patch = auto-applies with a visible notice. Historical changelog entries stay as recorded — no back-filling. The standing rule lives in `OPERATIONAL_RULES.md` § Versioning.

Two granularities of the same fact: the **OS umbrella** rolls up every substantive change, while **component lines** (Algorithm, system prompt, skills, hooks, docs, ISA Format, Memory) bump independently and roll into it — which is why a single skill edit bumps both the skill's `version:` and `LIFEOS/VERSION`.

**Living-doc versioning (added 2026-07-12)** — every living Markdown doc carries a frontmatter `version:`, spanning BOTH private repos. The single scope authority is `skills/_LIFEOS/Tools/DocVersionScope.ts`: system repo = `LIFEOS/DOCUMENTATION/**` + `LIFEOS/RULES/**`; user repo = all tracked `*.md`. Excluded: MEMORY/CACHE/Backups archives (back-stamping records is revisionism), generated derivatives (`generator:`/`derived_from:` — they inherit from their source), basename `CLAUDE.md` (the OS umbrella is its version), `CUSTOMIZATIONS/ARBOL/` (own repo), and everything already component-versioned. Baselines were seeded from real git lineage by `SeedDocVersions.ts` (creation → 1.0.0; non-migration commit → patch; commit adding a new `## ` section → feature; `git log --follow`, never combined with `--reverse` — they're silently incompatible). `BumpDocVersions.ts` applies the same new-H2-→-feature rubric deterministically at sync time (never auto-major), with a self-bump guard so a version-line-only diff never re-bumps; both the doc seeder and bumper run inside `UpdateKaiRepo --bump` exactly like skills and hooks.

The flow per change: `ClassifyChange.ts` (diff → `patch | feature | major`; major always human-gated) → `UpdateLifeosVersion.ts` (bump the umbrella) → `Bump{Algorithm,SystemPrompt,Hook,Skill,Doc}Versions.ts` (roll the touched component lines — runs automatically inside `UpdateKaiRepo --bump`) → `CreateUpdate.ts` (append to the update registry) → `UpdateKaiRepo.ts --bump` (verified two-repo private sync + tag). Orchestrated by `skills/_LIFEOS/Workflows/VersionBump.md` (`/vb`); `rc` cuts a release candidate.

Operation vocabulary, never conflated: **UpdateKaiRepo** = private sync + tag (versioning's terminal step, everyday sensitivity) · **CreateShadowRelease** = "cut" (stage + gates, no push) · **CreateRelease** = "publish" to the public repo (extremely sensitive, explicit go-ahead). "Cut" never means "publish"; private-sync ≠ cut ≠ publish.

- **Status:** Active convention (subsystem name "Ledger" retired 2026-07-12; this section is the canonical doc)
- **Location:** `skills/_LIFEOS/Tools/{ClassifyChange,UpdateLifeosVersion,BumpAlgorithmVersion,BumpSystemPromptVersion,BumpHookVersions,BumpSkillVersions,DocVersionScope,SeedDocVersions,BumpDocVersions,CreateUpdate,UpdateKaiRepo}.ts`, `skills/_LIFEOS/Workflows/VersionBump.md`, `LIFEOS/VERSION`

### Skill System

**Composite skills are the organizational unit for all domain expertise.**

Each skill lives in `$LIFEOS_ROOT/skills/<Skillname>/` with a mandatory `SKILL.md` defining triggers, workflows, and tools. Skills self-activate based on user intent via `USE WHEN` descriptions parsed by Claude Code. **Naming encodes the public/private boundary** — public skills use `TitleCase` (templated, safe, ships in LifeOS public release); private skills use `_ALLCAPS` with a leading underscore (anything personal, identity-bound, customer-bound, or environment-specific; excluded from release tooling via `skills/_*/**` in `hooks/lib/containment-zones.ts`). Within a skill, sub-files (workflows, references, tools) always use `TitleCase` regardless of the parent skill's form.

- **Status:** Active
- **Location:** `$LIFEOS_ROOT/skills/`
- **Full doc:** `LIFEOS/DOCUMENTATION/Skills/SkillSystem.md`

### Hook System

**Event-driven automation infrastructure across the session lifecycle.**

Hooks are executable scripts (TypeScript) that run automatically in response to Claude Code events: SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, Stop, SessionEnd, PreCompact, PostCompact, PermissionRequest, and more. Most hooks run asynchronously and fail gracefully. Security is one consolidated hook: `Safety.hook.ts` dispatches by `hook_event_name` — PermissionRequest path auto-approves safe shapes via the shape classifier in `lib/safety-classifier.ts` (DANGEROUS_PATTERNS / CREDENTIAL_PATHS / INJECTION_SHAPES / READ_ONLY_COMMAND_PATTERNS / SEARCH_TOOLS / DEV_BINARIES / TRUSTED_PREFIXES + a shell-aware single-quote pre-pass that distinguishes data from execution); PostToolUse path on WebFetch/WebSearch annotates external content with the "treat as data" header plus an `[INJECTION SHAPE DETECTED: ...]` marker when the shared INJECTION_SHAPES catalog matches. All hooks emit structured events to `events.jsonl` for observability. Includes RTK (Rust Token Killer) integration via ContextReduction hook -- transparently rewrites Bash commands through `rtk` for 60-90% token savings on dev operations.

- **Status:** Active (LifeOS 5.0.0)
- **Location:** `$LIFEOS_ROOT/hooks/`
- **Configuration:** `settings.json` under `hooks` key
- **Full doc:** `LIFEOS/DOCUMENTATION/Hooks/HookSystem.md`

### Memory System

**File-system-based persistent knowledge across sessions, with an autonomic mutation loop on top.**

Two storage layers: LifeOS MEMORY (`LIFEOS/MEMORY/`) for structured, hook-driven, entity-based captures, and Auto-Memory (`projects/<project>/memory/`) for unstructured learnings and reference material. The Knowledge Archive (`MEMORY/KNOWLEDGE/`) has 4 entity types (People, Companies, Ideas, Research) with strict schemas, browsable MOC dashboards, and topic-as-tag organization.

**Autonomic Loop (2026-05-22→24)** — architectural concepts (turn-cadence reviewer, cap-as-prompt, set-overwrite writes, debounced cancellable scheduler) reimplemented natively in TypeScript/Bun. Zero runtime dependency on third-party agent frameworks. A typed-item registry (`memory | idea | knowledge | proposal`) discriminates storage path, load timing, mutation tier, and write mode. A turn-gated reviewer (`LIFEOS/TOOLS/MemoryReviewer.ts`) fires when `turn_count ≥ 8 ∧ minutes_since_last_review ≥ 30 ∧ idle_minutes ≥ 2` — `hooks/MemoryReviewFire.hook.ts` (Stop; absorbed the MemoryReviewTrigger cadence gate 2026-07-11) spawns the reviewer subprocess env-scrubbed for subscription billing. The reviewer reads recent conversation, emits typed items in a single pass, and `LIFEOS/TOOLS/MemorySystem.ts add(item)` routes by type. Four mutation tiers gate writes: **A** auto set-overwrite to hot-layer `_MEMORY.md` files (48 entries × 256 chars each); **B** logged-append to PROJECTS/CONTACTS/KNOWLEDGE/IDEAS with `tier-b-writes.jsonl` audit; **C** propose-only via `pending-proposals.jsonl` surfaced as Telegram `yes/no/edit #id` replies (high-confidence ≥0.70 auto-applies); **D** untouchable (everything else — `.env`, `settings.json`, hooks, code, `CLAUDE.md`, `Algorithm/`, `skills/`). Per-turn BM25 retrieval over the typed-item corpus injects `## RELEVANT MEMORY` into every prompt's LifeOS CONTEXT block (Telegram pipeline only; CLI injection is a planned follow-up). Read-only status: `bun LIFEOS/TOOLS/MemoryStatus.ts`.

**Curation, recoverability & visibility (2026-06-06, Hermes/Honcho parity)** — the reviewer runs in **curation mode**: it reads current entries + recent conversation and returns the full desired set via `op:"set"` (REPLACE) — forgetting is omission, contradictions supersede, ≥80%-full consolidates first (kills the `EAT_CAP` cap-jam permanently). `MemoryWriter.setEntries` carries an in-lock catastrophic-shrink guard (`ESUSPECT_SHRINK`: blocks near-empty / mass-delete-without-additions, allows honest consolidation) and snapshots the prior file to a 30-deep ring (`memory-snapshots/`) before every write — recover via `LIFEOS/TOOLS/MemoryRestore.ts`. Visibility is change-only and hook-fed: `hooks/MemoryDeltaSurface.hook.ts` (UserPromptSubmit) injects `<pai-memory-delta>` → a verbatim `🧠 MEMORY: +N learned · −M dropped` output line ONLY when the loop adjusted memory, and `<pai-memory-health>` → a `🩺 MEMORY HEALTH:` line when `memory-health.jsonl` is CRITICAL (nags until fixed). `LIFEOS/TOOLS/MemoryHealthCheck.ts` (run on Stop by `hooks/MemoryHealthGate.hook.ts`, all in `settings.system.json`) adds cap-pressure + reviewer-failure (`EAT_CAP`) detection. The continuous `🧠 MEM` statusline remains the always-on heartbeat. Supersedes the 2026-05-28 `<autonomic-memory>` banner + every-turn heartbeat enforcement (both removed).

**Proposal subtypes (P1 2026-05-25)** — proposal type carries a `target_kind` discriminator covering 8 curated-context file classes: `identity`, `style`, `definition`, `canonical-content`, `resume`, `operational-rule`, `projects`, `contacts`. Reviewer prompt teaches the model when to emit each subtype; `MemorySystem.add` validates `(target_kind, target_file)` against the closed allowlist in `PROPOSAL_KIND_TO_FILES` (`LIFEOS/TOOLS/MemoryTypes.ts`); Telegram surfacer renders `[kind]` badge in the proposal header; `MemoryStatus` groups pending by subtype. Backwards-compatible — proposals without `target_kind` infer via `inferProposalKind()` from `target_file`. The canonical curation coverage matrix (which files are touched by which pipeline, manual-only carve-outs, per-content SLAs, roadmap to P2 TELOS loop / P3 WISDOM loop) lives at `LIFEOS/DOCUMENTATION/Memory/CurationCoverage.md`.

**Session rename CLI (P1 2026-05-25)** — `LIFEOS/TOOLS/SessionRename.ts` updates the `sessionName` field in `work.json` and the per-UUID entry in `session-names.json` for any session, without touching the slug, ISA path, or work directory. Sessions are auto-named verbatim from the first prompt at creation; this CLI lets the principal (or {{DA_NAME}} on demand) clean up a label when the conversation pivots topics. Usage: `bun SessionRename.ts <slug> "<new name>"` / `--uuid` / `--latest` / `list`.

- **Version:** 8.2.0 (P1 proposal subtypes + session-rename landed 2026-05-25; autonomic loop + health gate + indicator preserved from 8.1)
- **Location:** `LIFEOS/MEMORY/` + `projects/*/memory/` + hot-layer at `LIFEOS/USER/PRINCIPAL/PRINCIPAL_MEMORY.md` and `LIFEOS/USER/DIGITAL_ASSISTANT/DA_MEMORY.md`
- **Full doc:** `LIFEOS/DOCUMENTATION/Memory/MemorySystem.md`

### Agent System

**Three distinct agent systems that serve different purposes.**

Task Tool Subagent Types are pre-built agents in Claude Code (Architect, Engineer, Explore, etc.) for internal workflow use. `BrowserAgent`, `UIReviewer`, `QATester`, `Artist`, `Algorithm`, and `Anvil` (Kimi K2.6) were removed 2026-06-10 by principal directive — browser validation runs through the **Interceptor** skill (real Chrome, no CDP fingerprint). Cross-vendor agents extend coverage: **Forge** (OpenAI-family GPT-5.6 Sol via `codex exec`) writes production-grade code at E3+ in **build mode** and runs the optional cross-vendor **audit mode** at E4/E5 in VERIFY when the Algorithm elects it (Algorithm Rule 2a — discretionary, not a mandatory gate; the former standalone Cato agent folded into Forge audit mode 2026-06-17). Named Agents are persistent identities with backstories and ElevenLabs voices for recurring work. Custom Agents are dynamic compositions via ComposeAgent from base traits. The word "custom" is the routing trigger -- when the user says "custom agents," invoke the Agents skill, never Task tool subagent types. Background agents are supervised by the Agent Watchdog (`Tools/AgentWatchdog.ts`) — a Monitor-tool script that detects hung agents via tool-activity.jsonl silence, auto-triggered by the Pulse agent-guard hook.

- **Status:** Active
- **Location:** `$LIFEOS_ROOT/agents/`
- **Full doc:** `LIFEOS/DOCUMENTATION/Agents/AgentSystem.md`

### Delegation System

**Parallelization patterns and model selection for agent work.**

Model selection is per-dispatch judgment (baseline, 2026-07-11 — the AgentInvocation model injector was removed in v1.3.0; the hook now only logs each dispatch's resolved model). Unspecified agents inherit the session model at the request layer, but harness execution downgrades subagent Fable to Opus (probed 2026-07-11: inherited dispatch self-reported Fable 5, executed claude-opus-4-8 per transcript modelUsage). Pass `model` explicitly when a different rung fits (Sonnet/Haiku for utility work); genuine Fable off the main loop is the `Inference.ts --level max` subprocess. The main-loop `/model` default is Fable 5 [1m] (2026-07-11). Custom agents use the Agents skill (ComposeAgent); generic parallel work uses custom agents with unique voices. Spotcheck pattern verifies parallel work with an additional agent.

- **Status:** Active
- **Location:** (patterns, not a directory)
- **Full doc:** `LIFEOS/DOCUMENTATION/Delegation/DelegationSystem.md`

### Config System

**Direct editing of configuration files with shadow release for public sanitization.**

Configuration files (`settings.json`, `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md`) are directly edited. `LIFEOS_CONFIG.yaml` remains as a credentials store for private skills. The Shadow Release system (`ShadowRelease.ts`) produces public staging via **containment**: rsync clone with hard exclusions → delete sensitive zones (USER, MEMORY, skills/_*) → overlay fixed public templates → scaffold → run five gates (zone deletion, identity grep, CF ID grep, trufflehog, .env strays). The shipped release is then emitted from that staging tree as the single self-contained `LifeOS/` skill (`EmitSkill.ts`) — the `.claude/` staging clone is an intermediate, not the published artifact.

- **Status:** Active (containment-based since v5; retired filter-walker/reverse-templating)
- **Location:** `skills/_LIFEOS/TOOLS/ShadowRelease.ts`, `skills/_LIFEOS/RELEASE_TEMPLATES/` (settings.public.json, CLAUDE.public.md, USER/)
- **CLI:** `--create <version>`, `--update`, `--full`, `--check [--version <v>]`
- **Full doc:** `LIFEOS/DOCUMENTATION/Config/ConfigSystem.md`

### Security System

**Minimal v3 — three layers + one consolidated hook + one shared lib.**

The model is the security boundary; the hook is a deterministic gate around it. Three layers: (1) Constitutional Security Protocol in `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` — model treats external content as data, refuses embedded instructions, reports injection attempts. (2) Native Claude Code `permissions.deny` + `permissions.ask` in `settings.json` — declarative block/prompt list for irrecoverable shell, disk, and filesystem operations and credential reads. (3) `hooks/Safety.hook.ts` — one file, two events. **PermissionRequest path** (matcher: `Write|Edit|MultiEdit|Bash` + `mcp__.*`) auto-approves safe shapes via the classifier in `lib/safety-classifier.ts`, defers dangerous-shape / credential-path / injection-shape commands to the native prompt; logs every decision to `MEMORY/OBSERVABILITY/permission-decisions.jsonl` with hashed prefixes; sha-keyed cache at `MEMORY/STATE/permission-cache.json`. **PostToolUse path** on WebFetch/WebSearch prepends "treat as data" header + injection marker. The classifier includes a shell-aware single-quote pre-pass: when the outer command is NOT a wrapper (`bash -c`, `eval`, language interpreters with `-c`/`-e`), single-quoted regions are stripped before pattern matching (literal data, not execution); when it IS a wrapper, the inner content is also matched directly. A narrow `for|while|until` loop gate then auto-allows control-flow whose body has no shell-execution sub-shapes — so test loops over dangerous-string fixtures auto-approve while loops with `bash -c "$x"`/`eval "$x"`/pipe-to-shell bodies still neutral. Decision-tree invariant: dangerous + credential checks precede every allow path except `mcp__` pre-vetted (verified by Advisor + Cato on 2026-05-13 after a `cat ~/.aws/credentials` bypass was caught and closed). Consolidates the prior `SmartApprover.hook.ts` + `PromptInjection.hook.ts` split (2026-05-14). Replaces the 4,200-LOC v4.0 inspector-pipeline architecture (deleted 2026-05-06).

- **Status:** Active (Minimal v3, 2026-05-14 — SmartApprover + PromptInjection consolidated into Safety.hook.ts; shell-aware classifier added)
- **Location:** `hooks/Safety.hook.ts`, `hooks/lib/safety-classifier.ts`
- **Tests:** `hooks/lib/safety-classifier.test.ts` (91 cases), `hooks/Safety.smoke.test.ts` (23 cases)
- **Full doc:** `LIFEOS/DOCUMENTATION/Security/README.md`

### Notification System

**Voice and push notifications for workflows and task execution.**

Voice feedback via ElevenLabs TTS when workflows start and complete. Context-aware announcements match the user's request style (questions get "Checking...", commands get "Creating..."). Fire-and-forget design -- notifications never block execution. Missing services do not cause errors. Voice is served by the unified Pulse daemon as `modules/voice.ts` -- the `/notify` endpoint lives at `localhost:31337`.

- **Status:** Active
- **Location:**  (voice module inside unified Pulse daemon)
- **Full doc:** `LIFEOS/DOCUMENTATION/Notifications/NotificationSystem.md`

### Observability System

**Single-source, multi-destination event pipeline for system visibility.**

JSONL sources on local disk (tool-activity, tool-failures, voice-events, subagent-events) are collected, merged, and fanned out to configured targets (Cloudflare KV, local HTTP server). Frontend polls `/api/events/recent` every 3s. The observability HTTP server runs as a Pulse module (`Observability/observability.ts`) -- LifeOS Observatory dashboard at `localhost:31337` provides real-time visibility into agent activity, sessions, and system health.

- **Status:** Active
- **Location:** `LIFEOS/PULSE/Observability/observability.ts` (server module inside unified Pulse daemon)
- **Dashboard:** `localhost:31337` (Next.js static export at `Pulse/Observability/out`)
- **Wiki:** `localhost:31337/pai` — system docs + knowledge archive browser + knowledge graph
- **Security page:** `localhost:31337/security` provides full CRUD for `PATTERNS.yaml` and `SECURITY_RULES.md`
- **Deploy:** `cd Pulse/Observability && bun run build`, then `launchctl stop com.lifeos.pulse && launchctl start com.lifeos.pulse`
- **Full doc:** `LIFEOS/DOCUMENTATION/Observability/ObservabilitySystem.md`

### Pulse System

**Pulse is the Life Dashboard — the visible surface of the LifeOS Life Operating System.**

LifeOS is the OS. Pulse is the Dashboard. Everything a human (or the DA) can *see* or *hear* about the LifeOS flows through Pulse: real-time observability, voice notifications, chat surfaces (iMessage/Telegram), scheduled work, background worker state, DA heartbeat, and (as the dashboard grows) live views of current state vs ideal state, goal progress, workflows, and day-in-the-life preview. If a LifeOS with no dashboard would still be a LifeOS, and a dashboard with no OS behind it would be a widget — Pulse is what keeps the OS visible and interactive.

**Implementation:** A single Bun process managed by launchd (`com.lifeos.pulse`), listening on port 31337. Pulse absorbed all previously separate daemon services into a module architecture: voice notifications (`modules/voice.ts`), observability server (`Observability/observability.ts`), Telegram bot (`modules/telegram.ts`), iMessage bot (`modules/imessage.ts`), and session hooks (`modules/hooks.ts`). Reads job definitions from PULSE.toml, evaluates cron schedules, executes due jobs (shell scripts or Claude CLI invocations), and routes output through existing notification channels. Circuit breaker pattern: 3 consecutive failures skip the job.

- **Version:** 2.0.0
- **Location:** `$LIFEOS_DIR/PULSE/`
- **Launchd:** `com.lifeos.pulse`
- **Port:** 31337
- **API:** ~40 endpoints across 8 categories (observability, algorithm, life, user-index, security, knowledge, wiki, DA, voice, hooks). Full reference: `LIFEOS/DOCUMENTATION/Observability/ObservabilitySystem.md` → "API Reference"
- **Full doc:** `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md`

### LifeOS Schema

**Canonical shape of the USER/ directory — the biography-flat, PascalCase, frontmatter-driven schema every LifeOS user follows.**

One concept = one file at `USER/` root. Multi-file concept = Capitalized directory at root with `README.md` as the narrative entry. Every `.md` carries YAML frontmatter (`category`, `kind`, `publish`, `review_cadence`, `last_updated`) that serves as the API between files and consumers (Pulse, Daemon, Interview, skills). Four `kind` values map to four React renderers (collection, narrative, reference, index). `publish: daemon|daemon-summary|public|false` is the universal broadcast contract consumed by `DaemonAggregator.ts`. Templates live at `skills/_LIFEOS/RELEASE_TEMPLATES/USER/` — shipped in public releases so new LifeOS users scaffold from the canonical shape.

- **Spec:** `LIFEOS/DOCUMENTATION/LifeOs/LifeOsSchema.md`
- **Templates:** `skills/_LIFEOS/RELEASE_TEMPLATES/USER/` (biography scaffold for new LifeOS users)
- **Indexer:** `LIFEOS/PULSE/modules/user-index.ts` (parses tree → `Pulse/state/user-index.json`)
- **Dashboard:** `localhost:31337/life` (powered by the index)

### UserIndex Module

**Pulse module that indexes the USER/ LifeOS tree into typed JSON for Pulse, Daemon, and Interview.**

Walks `USER/` (root + one level), parses frontmatter + body of each `.md`, computes derived fields (staleness, completeness heuristic, item_count, preview, TBD detection), and writes `Pulse/state/user-index.json`. Watches the tree via `fs.watch` with 250ms debounce for live refresh. Exposes HTTP routes at `/api/user-index[?filter=stats|publish|stale|gaps]`, `/api/user-index/category/:name`, `/api/user-index/file/:path`. Consumers: `/life` dashboard (biography view), Daemon aggregator (publish_feed), Interview skill (interview_gaps). Zero deps, CLI-runnable standalone.

- **Location:** `LIFEOS/PULSE/modules/user-index.ts`
- **Index output:** `LIFEOS/PULSE/state/user-index.json`
- **Spec:** `LIFEOS/DOCUMENTATION/LifeOs/LifeOsSchema.md`

### DA Subsystem

**Digital Assistant identity, lifecycle, and growth management within Pulse.**

Formalizes how Pulse instantiates, manages, and evolves a Digital Assistant. Replaces manual DA_IDENTITY.md editing with a structured YAML schema, adds proactive heartbeat evaluation (2-layer: free context gathering + cheap Haiku eval), natural-language scheduled tasks, and bounded identity growth over time. Supports multiple DAs via a registry with primary/worker roles.

- **Status:** Active
- **Location:** `$LIFEOS_DIR/USER/DA/` (identity data), `$LIFEOS_ROOT/` (runtime)
- **Full doc:** `LIFEOS/DOCUMENTATION/Pulse/DaSubsystem.md`, `LIFEOS/DOCUMENTATION/Pulse/PulseSystem.md` (DA Module section)

### Browser Automation

**Interceptor: real Chrome/Brave through a browser extension, zero CDP fingerprint.**

Handles screenshots, multi-step sessions, authenticated browsing, and DOM/console/network inspection through the actual browser UI, so it stays logged in and passes bot detection. Legacy built-in agents (BrowserAgent, UIReviewer, QATester) were removed 2026-06-10, and the headless agent-browser wrapper (the Browser skill) was retired 2026-07-04 in favor of Interceptor. All web-based output MUST be verified through the **Interceptor skill** before showing to the user. Playwright is banned across LifeOS.

- **Status:** Active
- **Location:** `$LIFEOS_ROOT/skills/Interceptor/` (real-Chrome automation + computer use, mandatory for verification)

### Cloud Execution (Arbol)

**Cloudflare Workers platform for AI-powered automation at the edge.**

Three composable primitives: Actions (A_ prefix, atomic units of work), Pipelines (P_ prefix, chain actions via pipe model), and Flows (F_ prefix, connect sources to pipelines on cron schedules). Each action is a separate Worker. Pipelines chain actions via service bindings (zero-hop internal calls). Two-tier worker model: V8 isolate Workers for LLM actions, Sandbox Workers (Docker) for shell actions. Local and cloud environments share identical action logic.

- **Status:** Active
- **Source code:** `LIFEOS/USER/CUSTOMIZATIONS/ARBOL/` (Cloudflare Workers repo)
- **Framework (Actions/Flows/Pipelines):** `LIFEOS/ARBOL/`
- **Full doc:** `LIFEOS/DOCUMENTATION/Arbol/ArbolSystem.md`

### Feed System

**Intelligence routing engine that turns information streams into actionable intelligence.**

Monitors content sources, processes everything through an AI pipeline (ingest, summarize, rate on 5 dimensions + 20 labels), and routes actionable items to destinations at the right priority. Configurable rules determine routing: high-urgency security items trigger immediate alerts, low-value content archives silently.

- **Status:** Active
- **Location:** `~/Projects/feed/`
- **Full doc:** `LIFEOS/DOCUMENTATION/Feed/FeedSystem.md`

### Fabric Integration

**240+ specialized prompt patterns for content analysis and transformation.**

LifeOS executes Fabric patterns natively by reading `Patterns/{name}/system.md` and applying instructions directly. Use `fabric` CLI only for YouTube transcript extraction (`-y URL`). Patterns cover summarization, wisdom extraction, threat modeling, and dozens of other content operations.

- **Status:** Active (240+ patterns)
- **Location:** `$LIFEOS_ROOT/skills/Fabric/`
- **Full doc:** `LIFEOS/DOCUMENTATION/Fabric/FabricSystem.md`

### Terminal Tab System

**Visual session state feedback via Kitty terminal tab colors and title suffixes.**

Five states with distinct colors: Inference (purple), Working (orange), Completed (green), Awaiting Input (teal), Error (orange). Two-hook architecture: UserPromptSubmit sets working state, Stop detects final state. State colors affect inactive tabs only; active tab stays dark blue.

- **Status:** Active
- **Full doc:** `LIFEOS/DOCUMENTATION/Pulse/TerminalTabs.md`

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md` | **Canonical LifeOS thesis** -- what LifeOS is for, the core loop, LifeOS-MM, RIoT lineage, respark |
| `LIFEOS/DOCUMENTATION/Tools/Cli.md` | Algorithm CLI (loop/interactive/optimize modes) and Arbol CLI (actions/pipelines) |
| `LIFEOS/DOCUMENTATION/Tools/CliFirstArchitecture.md` | CLI-First design pattern: build deterministic CLI tools first, then wrap with AI |
| `LIFEOS/DOCUMENTATION/Isa/IsaSystem.md` | ISA system architecture -- five identities, three-guardrail taxonomy, twelve-section body, six workflows, two homes, subsystem relationships |
| `LIFEOS/DOCUMENTATION/Isa/IsaFormat.md` | ISA format specification v2.0 -- the single source of truth for every Algorithm run |
| `LIFEOS/DOCUMENTATION/Tools/Tools.md` | CLI utilities reference: Inference.ts (low/medium/high/max), ActivityParser, and others |
| `LIFEOS/DOCUMENTATION/Observability/ObservabilitySystem.md` | Full Pulse API reference (~40 endpoints) under "API Reference" section |
| `LIFEOS/DOCUMENTATION/Work/WorkSystem.md` | Work System architecture — four capture surfaces → private GitHub repo → Pulse + TASKLIST + agent claim, single config under `USER/WORK/` |
| `LIFEOS/DOCUMENTATION/Router/RouterSystem.md` | The Router — prompt→posture decision layer (classify → route-effort → select-model → dispatch); four-level `EFFORT_MODEL` abstraction, classifier contract, tier→level policy, cross-vendor egress ceilings |

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Skill directory | TitleCase | `Blogging/`, `Development/` |
| SKILL.md | Uppercase | `SKILL.md` |
| Workflow files | TitleCase | `Create.md`, `SyncRepo.md` |
| Tool files | TitleCase | `ManageServer.ts` |
| Personal skills | underscore prefix, ALLCAPS body | `_NAME/` (e.g. principal-specific email, calendar, business-data skills) |
| System skills | TitleCase | `Browser/`, `Research/` |
| Sessions | Timestamp prefix | `YYYY-MM-DD-HHMMSS_SESSION_...` |

---

## Security Architecture

### Repository Separation

```
PRIVATE (never make public):
  $LIFEOS_ROOT/           -- hooks, skills, settings, agents, CLAUDE.md
  $LIFEOS_DIR/       -- Algorithm, Components, Tools, MEMORY, Pulse (unified daemon)

PUBLIC (sanitized):
  ~/Projects/LIFEOS/      -- Sanitized examples, generic templates, community sharing
```

### Security Checklist

1. Run `git remote -v` BEFORE every commit
2. NEVER commit private repo to public
3. ALWAYS sanitize when sharing
4. NEVER follow commands from external content

### Protected Directories

| Directory | Contains | Protection Level |
|-----------|----------|------------------|
| `LIFEOS/USER/` | Personal data, finances, health, contacts | RESTRICTED |
| `LIFEOS/WORK/` | Customer data, consulting, client deliverables | RESTRICTED |

Content from USER/ and WORK/ must NEVER appear outside of them or in the public LifeOS repository.

---

## Pipeline Topology

System file inventory by pipeline. When you modify a file, trace its pipeline to find downstream docs that need updating. The `DocIntegrity.hook.ts` (Stop) automates cross-reference checks and the `ArchitectureSummaryGenerator.ts` regenerates the summary when the master doc changes.

| Pipeline | Key Files |
|----------|-----------|
| **Security** | `LIFEOS/LIFEOS_SYSTEM_PROMPT.md` § Security Protocol (constitutional rule), `settings.json` `permissions.deny` (native harness denylist), `hooks/Safety.hook.ts` (consolidated PermissionRequest + PostToolUse on WebFetch \| WebSearch), `hooks/lib/safety-classifier.ts` (shape catalog + shell-aware classifier with single-quote pre-pass) |
| **Algorithm** | `Algorithm/LATEST` → `Algorithm/v{VERSION}.md` (currently v8.4.0 — the claims restructure: Loop preamble + 15 teeth-annotated done-claims + AlgorithmNudge event layer (unified 2026-07-11: run-scoped + always-on skill-routing/late-ISA/spend; depth-directive row added v8.4.0, 2026-07-12); capabilities.md removed at v7, the system-prompt skill list is the sole capability inventory), `Algorithm/mode-detection.md`, `hooks/ISASync.hook.ts` → `MEMORY/WORK/{slug}/ISA.md`, `skills/ISA/` (canonical Scaffold/Append/Reconcile workflows); **work registry event-sourced (2026-06-10):** all `work.json` writes go through `isa-utils.writeRegistry` → field-level diff events appended to `MEMORY/STATE/work-events.jsonl` (`hooks/lib/work-events.ts`) → locked fold to the derived `work.json` snapshot (offset-stamped, 1MB compaction); `readRegistry` serves snapshot+suffix live views; Pulse SSE triggers off `fs.watch` on STATE with the 100ms poll as fallback; model choice is per-dispatch judgment (2026-07-11 baseline); `EFFORT_MODEL` in `LIFEOS/TOOLS/models.ts` remains the `Inference.ts --level` dial |
| **Memory** | `hooks/WorkCompletionLearning.hook.ts`, `hooks/SatisfactionCapture.hook.ts` (RelationshipMemory hook deleted 7.0.0 — dead code), `Tools/KnowledgeHarvester.ts` → `MEMORY/KNOWLEDGE/`, `MEMORY/LEARNING/`; `Tools/SessionHarvester.ts --mine` → `KNOWLEDGE/_harvest-queue/`; `Tools/MemoryRetriever.ts` (BM25 retrieval over typed-item corpus including `_MEMORY.md` hot-layer files), `Tools/KnowledgeGraph.ts` (graph navigation) — read-only. **Autonomic loop (2026-05):** `hooks/MemoryTurnStart.hook.ts` (UserPromptSubmit) + `hooks/MemoryReviewFire.hook.ts` (Stop; cadence merged 2026-07-11) drive `Tools/MemoryReviewer.ts` on cadence (turn≥8 ∧ minutes≥30 ∧ idle≥2). Reviewer emits typed items routed by `Tools/MemorySystem.ts` (single `add(item)` API) over the `Tools/MemoryTypes.ts` registry; `Tools/MutationTier.ts` gates by tier A/B/C/D. Tier-C proposals enqueue to `MEMORY/OBSERVABILITY/pending-proposals.jsonl`; `PULSE/lib/telegram-proposals.ts` + `PULSE/modules/telegram.ts` surface them as `yes/no/edit #id` Telegram replies. `Tools/MemoryStatus.ts` is the read-only `kai status` CLI. **kb-v3 knowledge schema (2026-07-05):** `Tools/KnowledgeSchema.ts` is the pure-data SoT for the KNOWLEDGE archive object-schema (`person\|company\|idea\|blog\|research` — distinct from the write-registry above) + body-safe parse/normalize/validate; `Tools/KnowledgeLint.ts` validates conformance (envelope % vs per-type completeness); `Tools/MigrateKnowledge.ts` migrated ~4,400 notes onto it (body-byte-preserving, idempotent, dry-run default); `Tools/KnowledgeQuery.ts` (`kb query`) filters/sorts on the now-consistent typed fields; `Tools/GenerateKnowledgeSchemaDoc.ts` regenerates `MEMORY/KNOWLEDGE/_schema.md` from the schema; `MemorySystem.renderInitialNote` emits the kb-v3 envelope so new autonomic notes are born conformant. |
| **Router** (RETIRED 2026-07-11) | Classify → route-effort stages retired 2026-07-11 with the mode/tier abolition (`TheRouter.hook.ts` deleted; MINIMAL/NATIVE/ALGORITHM + E1–E5 gone, no successor classifier). **Surviving model routing:** `LIFEOS/TOOLS/models.ts` `EFFORT_MODEL` maps level→model (max→fable / high→opus / medium→sonnet / low→haiku; `LEVEL_TO_HARNESS_EFFORT`; cross-vendor pins; egress-class ceilings) → **dispatch** via `model` param on `Agent()` / `Workflow agent()`, injected by `hooks/AgentInvocation.hook.ts` on unspecified dispatches. `LIFEOS/TOOLS/Inference.ts` applies model selection to utility inference, and is the genuine `max`/Fable carrier (subprocess spawns `claude --model claude-fable-5`; Agent `model:fable` dispatch downgrades to Opus). It verifies the executed model against the JSON envelope's `modelUsage` and logs downgrades to `MEMORY/OBSERVABILITY/model-verification.jsonl` (v6.29.0 — reports what RAN, not what was requested). Full doc (history only): `LIFEOS/DOCUMENTATION/Router/RouterSystem.md` |
| **Hooks** | `hooks/*.hook.ts`, `hooks/handlers/*.ts`, `hooks/lib/*.ts`, `settings.json` |
| **Observability** | `hooks/EventLogger.hook.ts` (consolidated 2026-07-11 — absorbed ToolActivityTracker, ToolFailureTracker, SkillExecutionLog, ConfigAudit, StopFailureHandler; appends directly via `fs.appendFileSync`) → `MEMORY/OBSERVABILITY/*.jsonl` |
| **Pulse** | `Pulse/pulse.ts` (port 31337), `Pulse/modules/{observability,hooks,wiki,imessage,telegram,user-index,da,work,bunker}.ts`, `Pulse/PULSE.toml`, `Pulse/Observability/src/`, `Pulse/Assistant/module.ts` |
| **Bunker** | Canonical repo: `~/Projects/bunker` (README + `ISA.md` are the source docs; PROJECTS.md carries the routing row). The universal application harness — every app declares a `type` that composes cross-cutting components across six planes (data, control, observability, identity, security, commerce); the app's `bunker.isa.md` is simultaneously its spec, component manifest, executable test suite (`bunker test` runs the `## Test Strategy` probes), and **stored current state of the application** — "add a feature" = add claims to the ISA that don't hold yet. v0.1.0 spine (CLI `bin/bunker.ts`, `src/{adopt,config,isa,registry,test,admin}.ts`); adopted by samsaid, dariosaid, oursafe, shouldwecontrolopensource; surfaced in Pulse via `Pulse/modules/bunker.ts` + `/bunker` page. Design provenance: `MEMORY/WORK/20260708-chassis-application-harness/ISA.md` (E5), Pulse interface: `MEMORY/WORK/20260708-bunker-pulse-interface/ISA.md`. |
| **Work System** | Canonical doc: `LIFEOS/DOCUMENTATION/Work/WorkSystem.md`. Four capture surfaces → one private GitHub repo (system of record) → three readers. Single config: `USER/WORK/labels.yml` (canonical label taxonomy, additive — pushed to repo by `skills/_ULWORK/Tools/BootstrapLabels.ts`) + `USER/WORK/config.yaml` (kanban columns, poll cadence, `CAPTURE_NATIVE`/`CAPTURE_SWEEP` switches, project→property map) + `USER/WORK/work_repo.json` (gh-verified privacy attestation). Loader: `hooks/lib/work-config.ts` exposes `repo`, `kanbanColumns`, `captureNative`, `captureSweep`, `projectProperty(project)`. **Capture:** `hooks/ULWorkSync.hook.ts` (SessionEnd — ALGORITHM phase≥execute OR NATIVE-with-artifacts when `CAPTURE_NATIVE=true`, slug-keyed idempotency, label pre-filtering against repo's actual label set) + `hooks/ReminderRouter.hook.ts` (UserPromptSubmit — precision-biased `remind me to`/`research the`/`queue this for` triggers) + `LIFEOS/TOOLS/WorkSweep.ts` (launchd `com.lifeos.worksweep` every 60min via `LIFEOS/TOOLS/InstallWorkSweep.ts` → `~/Library/LaunchAgents/`; four sub-sweeps: untracked-session catch-up, stale-in-progress flagging, project-no-commit-in-14d check, TELOS active-goal-with-no-issue derivation; `--max-create N` safety cap; logs to `MEMORY/OBSERVABILITY/worksweep.jsonl`). **Readers:** `LIFEOS/PULSE/modules/work.ts` (kanban at `/api/work*` with legacy-label aliases + per-card source badge `pai-sync`/`auto-native`/`auto-sweep`/`reminder`/`manual`) + `skills/_ULWORK/Tools/RegenerateTasklist.ts` (auto-rebuilds TASKLIST.md from live issues, `--commit-push` flag, called from sweep) + manual `gh` agent claim flow. Templated — point a different `work_repo.json` at a different private repo and the entire system pivots, zero code changes. |
| **Skills** | `skills/*/SKILL.md`, `skills/*/Workflows/*.md`, `skills/*/Tools/*.ts`, `USER/CUSTOMIZATIONS/SKILLS/` |
| **Config** | `settings.json`, `CLAUDE.md`, `LIFEOS_SYSTEM_PROMPT.md` (directly edited) → release tooling clones the live tree, deletes private zones, overlays public templates + USER scaffold into staging, runs gates, then emits the shippable `LifeOS/` skill (`EmitSkill.ts`) from that staging |
| **Notifications** | `Pulse/pulse.ts` voice handler → ElevenLabs API → `MEMORY/VOICE/voice-events.jsonl` |
| **Telegram Dynamic Voice** | `Pulse/modules/telegram.ts` per-turn pipeline: `buildLifeosContextBlock()` injects `USER/DIGITAL_ASSISTANT/DA_IDENTITY.md` + `USER/PRINCIPAL/PRINCIPAL_IDENTITY.md` + `USER/TELOS/PRINCIPAL_TELOS.md` + "Open Sessions to Resume" from `USER/PROJECTS.md` into SDK system prompt (cached 60s with per-file mtime invalidation) → SDK turn produces text reply streamed via `editMessageText` → `sendVoiceSummary()` fires fire-and-forget after text ships: `summarizeForVoice()` calls `LIFEOS/TOOLS/Inference.ts level: "medium"` (sonnet-tier, 10s outer race, fallback first-sentence) → `synthesizeKaiVoice()` POSTs ElevenLabs `output_format=opus_48000_64` → `bot.api.sendVoice(InputFile)` ships OGG/Opus as a voice-bubble. Voice ID resolved from `settings.json daidentity.voices.main.voiceId` (matches VoiceServer), public ElevenLabs `21m00Tcm4TlvDq8ikWAM` ("Rachel") fallback for fresh installs. 60-minute idle-session boundary: `lastMessageAt`/`threadStartedAt` clear `lastSessionId` and filter `conversationStore.getHistory()` by timestamp so episodic bursts thread together but a fresh post-idle message ships without "Previous conversation:" injection. Useless-fallback guard skips ElevenLabs when fallback summary <6 words against a ≥25-word reply. Channel-separate from CLI `/notify`: VoiceServer untouched. `PULSE/lib/conversation.ts` `getHistory()` returns `ConversationMessage[]` (timestamp field surfaced) — minimal additive change to support the timestamp filter. |
| **Doc Integrity** | `hooks/DocIntegrity.hook.ts` (Stop) → `hooks/handlers/DocCrossRefIntegrity.ts` + `hooks/handlers/RebuildArchSummary.ts` → `Tools/ArchitectureSummaryGenerator.ts` |

## System Self-Management

LifeOS manages its own integrity, security, and documentation through the System skill (`skills/_LIFEOS/SKILL.md`).

| Function | Description |
|----------|-------------|
| **Integrity Audits** | 16 parallel agents verify broken references across $LIFEOS_ROOT |
| **Secret Scanning** | TruffleHog credential detection in any directory |
| **Privacy Validation** | Ensures USER/WORK content isolation from regular skills |
| **Cross-Repo Validation** | Verifies private/public repository separation |
| **Documentation Updates** | Records system changes to MEMORY/SYSTEMUPDATES/ |

The System skill runs in the foreground for transparency. Use after major refactoring, before releases, before any git commit to public repos, and after working with USER/WORK content.

---

## Architecture Decisions

The running log of the load-bearing choices that shape LifeOS — what we decided, why, and what it replaced. This is the one place to read "how LifeOS works and why we built it that way." Each entry is a decision, its rationale, and what it superseded.

**How this stays current:** entries are added two ways. (1) Manual — a backfilled or hand-written decision. (2) Auto-harvested — `LIFEOS/TOOLS/ArchDecisionHarvest.ts` pulls decisions tagged `[arch]` from each Algorithm run's ISA `## Decisions` section into this log (dry-run by default; `--apply` writes; idempotent via per-entry `ad-src` markers). So a decision made inside a work session lands here without anyone remembering to copy it.

**Entry format:** `### AD-N: Title` followed by **Decided** / **Decision** / **Why** / **Replaced** / **Source**, with a trailing `<!-- ad-src: ... -->` dedupe marker.

### AD-1: JSONL for streaming and append-heavy state

- **Decided:** 2026-06-10
- **Decision:** Append-heavy and streaming-shaped state uses JSONL (one JSON object per line), not a single rewritten JSON file.
- **Why:** Appends are O(1) and crash-safe (a torn write loses only the last line, never the whole file), the stream is tailable live, and readers can fold or replay events. A monolithic JSON blob has to be read, parsed, and rewritten in full on every change — slower, and a crash mid-write can corrupt the entire file.
- **Replaced:** Single-file JSON for event/stream data.
- **Source:** manual (backfill 2026-06-14)
<!-- ad-src: manual#jsonl-streaming -->

### AD-2: Event-sourced work registry (work.json)

- **Decided:** 2026-06-10
- **Decision:** All `work.json` writes go through `isa-utils.writeRegistry`, which appends a field-level diff event to `MEMORY/STATE/work-events.jsonl`; the derived `work.json` snapshot is a locked fold of that event log (offset-stamped, compacted at 1MB). `readRegistry` serves snapshot+suffix live views; Pulse SSE triggers off an `fs.watch` on STATE with a 100ms poll as fallback.
- **Why:** The previous direct-write model lost history and raced under concurrent sessions. Event-sourcing gives an auditable history, conflict-free concurrent writes, and a cheap live feed for the dashboard. Concrete application of AD-1.
- **Replaced:** Direct full-file `work.json` writes.
- **Source:** manual (backfill 2026-06-14)
<!-- ad-src: manual#work-events -->

### AD-3: Fast non-standard CLIs — fd, rg, bat, eza

- **Decided:** longstanding; codified 2026-06-14
- **Decision:** In shell work prefer `rg` over `grep`, `fd` over `find`, `bat` over `cat`, `eza` over `ls`. In-tool work uses the built-in Grep/Glob/Read (Grep already wraps ripgrep). Portable skill code prefers Bun fs APIs; when shelling out, prefer `find` for guaranteed availability.
- **Why:** The modern tools are faster, respect `.gitignore` by default, and have better defaults and output. Describing LifeOS as "built on fast, modern tooling" is a real architectural stance, not cosmetic.
- **Replaced:** Default `grep`/`find`/`cat`/`ls`.
- **Source:** manual (backfill 2026-06-14)
<!-- ad-src: manual#fast-clis -->

### AD-4: Four-level effort→model abstraction

- **Decided:** 2026-06-10
- **Decision:** All Claude-family model routing speaks four effort LEVELS — `max` / `high` / `medium` / `low` — bound to concrete models in exactly one place: `EFFORT_MODEL` in `LIFEOS/TOOLS/models.ts` (today max→Fable, high→Opus, medium→Sonnet, low→Haiku — the max→Fable flip went live 2026-07-01; since 2026-07-06 the main-loop `/model` default is Opus 4.8 with deliberate Fable escalation, the classifier rides `max`, and the AgentInvocation injector closes the inherit leak). Doctrine, hooks, skills, and agents state intent (the level); the mapping resolves the model. v6.18.0 adds a per-task `intelligence` level on `## Features` the dispatch reads (down-route-only, fail-expensive, E1–E5). **Superseded in part (2026-07-11 baseline):** the level table survives solely as the `Inference.ts --level` dial; automatic routing to it (classifier, injector, tier mapping) is removed — model choice is {{DA_NAME}}'s per-dispatch judgment, and the main-loop default is Fable 5 [1m].
- **Why:** A model entering/leaving the lineup or changing rungs becomes a one-line edit instead of a sweep across dozens of files. Nothing outside `models.ts` names a Claude model for routing.
- **Replaced:** Hardcoded model names scattered across hooks/skills/agents.
- **Source:** manual (backfill 2026-06-14)
<!-- ad-src: manual#effort-model -->

### AD-5: In-session loop detection via stock hooks, not harness mods

- **Decided:** 2026-06-14
- **Decision:** Detect tool-call loops (exact-repeat, A-B oscillation, same-tool hammering) with a `*`-matcher PostToolUse hook (`hooks/LoopDetector.hook.ts`) that injects one labeled, one-shot circuit-breaker via `hookSpecificOutput.additionalContext`. State lives in a small per-session JSON file.
- **Why:** Addresses the #1 complaint cluster (Tool/System Failures) and the self-talk loop. Achieved entirely on the stock Claude Code hook surface — the context-injection capability already exists (proven by `Safety.hook.ts`), so no harness modification is needed. LifeOS deliberately builds on top of the stock harness, never forks it.
- **Replaced:** No in-session loop intervention (failures were only logged post-hoc to observability).
- **Source:** manual (backfill 2026-06-14)
<!-- ad-src: manual#loop-detector -->

### AD-6: The Router — the prompt→posture decision layer, named as a subsystem

- **Decided:** 2026-07-01
- **Decision:** The classify → route-effort → select-model → dispatch pipeline is named **the Router** and documented as a first-class subsystem (`LIFEOS/DOCUMENTATION/Router/RouterSystem.md`), with a stated boundary against the Algorithm: the Router decides *how* to handle a prompt (mode / tier / goal / model rung / dispatch), the Algorithm or NATIVE turn executes within that decision. The boundary is functional, not file-location — some Router policy text (the tier→level table, the dispatch profile) physically lives in the Algorithm doctrine, but those are posture decisions, not seven-phase execution. No code moved — the name and boundary are drawn around the existing surface (`TheRouter.hook.ts`, `models.ts`, `Inference.ts`, the Algorithm routing doctrine).
- **Why:** The behavior existed but was invisible — scattered across four files with no single description — so it could not be reasoned about, extended, or shipped as a unit. Naming it makes the dynamic-range design legible: the four-level abstraction, the classifier cascade, and the dispatch policy are one system whose purpose is preserving fast/deep variation around a harness limit (the main loop cannot switch its own model mid-turn).
- **Replaced:** An unnamed, undocumented routing behavior implied across four files. (AD-4 is left intact per the append-only convention; the max→Fable flip shipping 2026-07-01 supersedes AD-4's held-flip note — see `LIFEOS/TOOLS/models.ts` `EFFORT_MODEL` for the current lineup.)
- **Superseded:** 2026-07-11 — the Router was retired when mode/tier classification (MINIMAL/NATIVE/ALGORITHM, E1–E5) was abolished system-wide. `TheRouter.hook.ts` was deleted; no successor classifier. Only model routing survives (`LIFEOS/TOOLS/models.ts` + `hooks/AgentInvocation.hook.ts`). Entry kept per the append-only convention.
- **Source:** manual (2026-07-01)
<!-- ad-src: manual#the-router -->

