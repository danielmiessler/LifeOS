<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./images/pai-logo-v7.png">
  <source media="(prefers-color-scheme: light)" srcset="./images/pai-logo-v7.png">
  <img alt="PAI Logo" src="./images/pai-logo-v7.png" width="300">
</picture>

<br/>
<br/>

# Personal AI Infrastructure

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=500&size=24&pause=1000&color=60A5FA&center=true&vCenter=true&width=600&lines=Everyone+needs+access+to+the+best+AI.;AI+should+magnify+everyone.;Your+personal+AI+stack.)](https://github.com/danielmiessler/PAI)

<br/>

<!-- Social Proof -->
![Stars](https://img.shields.io/github/stars/danielmiessler/PAI?style=social)
![Forks](https://img.shields.io/github/forks/danielmiessler/PAI?style=social)
![Watchers](https://img.shields.io/github/watchers/danielmiessler/PAI?style=social)

<!-- Project Health -->
![Release](https://img.shields.io/github/v/release/danielmiessler/PAI?style=flat&logo=github&color=8B5CF6)
![Last Commit](https://img.shields.io/github/last-commit/danielmiessler/PAI?style=flat&logo=git&color=22C55E)
![Open Issues](https://img.shields.io/github/issues/danielmiessler/PAI?style=flat&logo=github&color=F97316)
![Open PRs](https://img.shields.io/github/issues-pr/danielmiessler/PAI?style=flat&logo=github&color=EC4899)
![License](https://img.shields.io/github/license/danielmiessler/PAI?style=flat&color=60A5FA)

<!-- Metrics -->
![Discussions](https://img.shields.io/github/discussions/danielmiessler/PAI?style=flat&logo=github&label=Discussions&color=EAB308)
![Commit Activity](https://img.shields.io/github/commit-activity/m/danielmiessler/PAI?style=flat&logo=git&label=Commits%2Fmo&color=F59E0B)
![Repo Size](https://img.shields.io/github/repo-size/danielmiessler/PAI?style=flat&logo=database&label=Repo%20Size&color=D97706)

<!-- Content -->
[![Get Started](https://img.shields.io/badge/🚀_Get_Started-Install-22C55E?style=flat)](#-installation)
[![Release v2.5](https://img.shields.io/badge/📦_Release-v2.5-8B5CF6?style=flat)](Releases/v2.5/)
[![Packs](https://img.shields.io/badge/📦_Packs-23-8B5CF6?style=flat)](Packs/)
[![Bundles](https://img.shields.io/badge/🎁_Bundles-1-F97316?style=flat)](Bundles/)
[![Contributors](https://img.shields.io/github/contributors/danielmiessler/PAI?style=flat&logo=githubsponsors&logoColor=white&label=Contributors&color=EC4899)](https://github.com/danielmiessler/PAI/graphs/contributors)

<!-- Tech Stack -->
[![Built with Claude](https://img.shields.io/badge/Built_with-Claude-D4A574?style=flat&logo=anthropic&logoColor=white)](https://claude.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![UL Community](https://img.shields.io/badge/UL_Community-5865F2?style=flat&logo=discord&logoColor=white)](https://danielmiessler.com/upgrade)

<br/>

**Overview:** [Purpose](#the-purpose-of-this-project) · [What is PAI?](#what-is-pai) · [New to AI?](#new-to-this-start-here) · [Principles](#the-pai-principles) · [Primitives](#pai-primitives)

**Get Started:** [Installation](#-installation) · [Releases](Releases/) · [Packs](#-packs) · [Bundles](#-bundles)

**Resources:** [FAQ](#-faq) · [Roadmap](#-roadmap) · [Community](#-community) · [Contributing](#-contributing)

<br/>

[![PAI Overview Video](https://img.youtube.com/vi/Le0DLrn7ta0/maxresdefault.jpg)](https://youtu.be/Le0DLrn7ta0)

**[Watch the full PAI walkthrough](https://youtu.be/Le0DLrn7ta0)** | **[Read: The Real Internet of Things](https://danielmiessler.com/blog/real-internet-of-things)**

---

</div>

> [!IMPORTANT]
> **PAI v2.5.0 Released** — Think Deeper, Execute Faster: Two-Pass Capability Selection, Thinking Tools with Justify-Exclusion, and Parallel-by-Default Execution.
>
> **[Release notes →](Releases/v2.5/README.md)** | **[GitHub Release →](https://github.com/danielmiessler/PAI/releases/tag/v2.5.0)**

<div align="center">

# AI should magnify everyone—not just the top 1%.

</div>

## The Purpose of This Project

**PAI exists to solve what I believe is the [P0 problem](https://danielmiessler.com/telos) in the world:**

### Only a tiny fraction of humanity's creative potential is activated on Earth.

Most people don't believe they have valuable contributions to make. They think there are "special" people—and they aren't one of them. They've never asked who they are, what they're about, and have never articulated or written it down. This makes them catastrophically vulnerable to AI displacement. Without activation, there is no high-agency.

So our goal with PAI is to activate people.

**PAI's mission is twofold:**

1. **Activate as many people as possible** — Help people identify, articulate, and pursue their own purpose in life through AI-augmented self-discovery
2. **Make the best AI available in the world accessible to everyone** — Ensure this quality of AI infrastructure isn't reserved for just the rich or technical elite.

That's why this is an open-source project instead of private.

---

## New to This? Start Here

You've probably used ChatGPT or Claude. Type a question, get an answer. Simple.

You can think of AI systems as **three levels**:

<p align="center">
  <img src="./images/pai-eli5-diagram.png" alt="The AI Evolution - From chatbots to your personal AI system" width="800">
</p>

### Chatbots

ChatGPT, Claude, Gemini—you ask something, it answers, and then it forgets everything. Next conversation starts fresh. No memory of you, your preferences, or what you talked about yesterday.

**The pattern:** Ask → Answer → Forget

### Agentic Platforms

Tools like Claude Code, Cursor, and Windsurf. The AI can actually *do* things—write code, browse the web, edit files, run commands.

**The pattern:** Ask → Use tools → Get result

More capable, but it still doesn't know *you*—your goals, your preferences, your history.

### PAI (Personal AI Infrastructure)

Now your DA **learns and improves**:
- **Captures every signal** — Ratings, sentiment, verification outcomes
- **Learns from mistakes** — Failures get analyzed and fixed
- **Gets better over time** — Success patterns get reinforced
- **Upgrades itself** — Skills, workflows, even the core behavior evolves

Plus it knows:
- **Your goals** — What you're working toward
- **Your preferences** — How you like things done
- **Your history** — Past decisions and learnings

**The pattern:** Observe → Think → Plan → Execute → Verify → **Learn** → Improve

The key difference: **PAI learns from feedback**. Every interaction makes it better at helping *you* specifically.

---

## What is PAI?

PAI is a Personalized AI Platform designed to magnify your capabilities.

It's designed for humans most of all, but can be used by teams, companies, or Federations of Planets desiring to be better versions of themselves.

The scale of the entity doesn't matter: It's a system for understanding, articulating, and realizing its principal's goals using a full-featured Agentic AI Platform.

### Who is PAI for?

**Everyone, full stop.** It's the anti-gatekeeping AI project.

- **Small business owners** who aren't technical but want AI to handle invoicing, scheduling, customer follow-ups, and marketing
- **Companies** who want to understand their data, optimize operations, and make better decisions
- **Managers** who want to run their teams more effectively—tracking projects, preparing for reviews, and communicating clearly
- **Artists and creatives** who want to find local events, galleries, and opportunities to showcase their work
- **Everyday people** who want to improve their lives—better fitness routines, stronger social connections, personal finance, or just getting organized
- **Developers** using AI coding assistants who want persistent memory and custom workflows
- **Power users** who want their AI to know their goals, preferences, and context
- **Teams** building shared AI infrastructure with consistent capabilities
- **Experimenters** interested in AI system design and personal AI patterns

### What makes PAI different?

The first thing people ask is:

> How is this different from Claude Code, or any of the other agentic systems?

Most agentic systems are built around tools with the user being an afterthought. They are also mostly task-based instead of being goal-based using all the context available to them. PAI is the opposite.

**Three core differentiators:**

1. **Goal Orientation** — PAI's primary focus is on the human running it and what they're trying to do in the world, not the tech. This is built into how the system executes all tasks.

2. **Pursuit of Optimal Output** — The system's outer loop and everything it does is trying to produce the exact right output given the current situation and all the contexts around it.

3. **Continuous Learning** — The system constantly captures signals about what was done, what changes were made, what outputs were produced for each request, and then how you liked or disliked the results.

---

## The PAI Principles

These principles guide how PAI systems are designed and built. **[Full breakdown →](https://danielmiessler.com/blog/personal-ai-infrastructure)**

| # | Principle | Summary |
|---|-----------|---------|
| 1 | **User Centricity** | PAI is built around you, not tooling. Your goals, preferences, and context come first—the infrastructure exists to serve them. |
| 2 | **The Foundational Algorithm** | The scientific method as a universal problem-solving loop: Observe → Think → Plan → Build → Execute → Verify → Learn. Define the ideal state, iterate until you reach it. |
| 3 | **Clear Thinking First** | Good prompts come from clear thinking. Clarify the problem before writing the prompt. |
| 4 | **Scaffolding > Model** | System architecture matters more than which model you use. |
| 5 | **Deterministic Infrastructure** | AI is probabilistic; your infrastructure shouldn't be. Use templates and patterns. |
| 6 | **Code Before Prompts** | If you can solve it with a bash script, don't use AI. |
| 7 | **Spec / Test / Evals First** | Write specifications and tests before building. Measure if the system works. |
| 8 | **UNIX Philosophy** | Do one thing well. Make tools composable. Use text interfaces. |
| 9 | **ENG / SRE Principles** | Treat AI infrastructure like production software: version control, automation, monitoring. |
| 10 | **CLI as Interface** | Command-line interfaces are faster, more scriptable, and more reliable than GUIs. |
| 11 | **Goal → Code → CLI → Prompts → Agents** | The decision hierarchy: clarify goal, then code, then CLI, then prompts, then agents. |
| 12 | **Skill Management** | Modular capabilities that route intelligently based on context. |
| 13 | **Memory System** | Everything worth knowing gets captured. History feeds future context. |
| 14 | **Agent Personalities** | Different work needs different approaches. Specialized agents with unique voices. |
| 15 | **Science as Meta-Loop** | Hypothesis → Experiment → Measure → Iterate. |
| 16 | **Permission to Fail** | Explicit permission to say "I don't know" prevents hallucinations. |

---

## PAI Primitives

While the Principles describe the *philosophy* of PAI, the Primitives are the *architecture*—the core systems that make everything work.

<p align="center">
  <img src="./images/pai-unique-components-diagram.png" alt="PAI Primitives - A system that knows you, not a tool harness" width="800">
</p>

These primitives work together to create the experience of working with a system that understands and knows you—as opposed to a tool harness that just executes commands.

---

<p align="center">
  <img src="./images/pai-component-1-assistant-vs-agent.png" alt="Assistant vs Agent-Based Interaction" width="700">
</p>

### Assistant vs. Agent-Based AI Interaction

PAI treats AI as a [persistent assistant, friend, coach, and mentor](https://danielmiessler.com/blog/personal-ai-maturity-model) rather than a stateless agent that runs tasks. An assistant knows your goals, remembers your preferences, and improves over time. An agent executes commands and forgets.

---

<p align="center">
  <img src="./images/pai-primitive-telos.png" alt="TELOS - Deep Goal Understanding" width="700">
</p>

### TELOS (Deep Goal Understanding)

10 files that capture who you are: MISSION.md, GOALS.md, PROJECTS.md, BELIEFS.md, MODELS.md, STRATEGIES.md, NARRATIVES.md, LEARNED.md, CHALLENGES.md, IDEAS.md. Your DA knows what you're working toward because it's all documented.

---

<p align="center">
  <img src="./images/pai-primitive-user-system-separation.png" alt="User/System Separation" width="700">
</p>

### User/System Separation

Your customizations live in USER/. PAI infrastructure lives in SYSTEM/. When PAI upgrades, your files are untouched. Portable identity, upgrade-safe.

---

<p align="center">
  <img src="./images/pai-primitive-customization.png" alt="Granular Customization" width="700">
</p>

### Granular Customization

Six layers of customization: Identity (name, voice, personality), Preferences (tech stack, tools), Workflows (how skills execute), Skills (what capabilities exist), Hooks (how events are handled), and Memory (what gets captured). Start with defaults, customize when needed.

---

<p align="center">
  <img src="./images/pai-component-2-skill-system.png" alt="Skill System" width="700">
</p>

### Skill System

Highly focused on consistent results. It has a structure that puts *deterministic outcomes first* by going from CODE -> CLI-BASED-TOOL -> PROMPT -> SKILL instead of a haphazard structure.

---

<p align="center">
  <img src="./images/pai-component-3-memory-system.png" alt="Memory System" width="700">
</p>

### Memory System

Focused on continuous learning. Every interaction generates signals—ratings, sentiment, successes, failures—that feed back into improving the system. Three-tier architecture (hot/warm/cold) with phase-based learning directories.

---

<p align="center">
  <img src="./images/pai-component-6-hook-system.png" alt="Hook System" width="700">
</p>

### Hook System

Responds to lifecycle events—session start, tool use, task completion, and more. 8 event types enable voice notifications, automatic context loading, session capture, security validation, and observability.

---

<p align="center">
  <img src="./images/pai-component-5-security-system.png" alt="Security System" width="700">
</p>

### Security System

Defines system and user-level security policies by default. You don't have to run with `--dangerously-skip-permissions` to have an uninterrupted experience. PAI's security hooks validate commands before execution, blocking dangerous operations while allowing normal workflows to proceed smoothly.

---

<p align="center">
  <img src="./images/pai-component-4-ai-installation.png" alt="AI-Based Installation" width="700">
</p>

### AI-Based Installation

Your AI assistant reads the packs, understands your system, and installs everything for you. No manual configuration, no guessing—the AI handles it.

---

<p align="center">
  <img src="./images/pai-component-8-notification-system.png" alt="Notification System" width="700">
</p>

### Notification System

Keeps you informed without being intrusive. Push notifications via ntfy for mobile alerts, Discord integration for team updates, and duration-aware routing that escalates for long-running tasks. Fire-and-forget design means notifications never block your workflow.

---

<p align="center">
  <img src="./images/pai-component-9-voice-system.png" alt="Voice System" width="700">
</p>

### Voice System

Powered by ElevenLabs TTS. Hear task completions, session summaries, and important updates spoken aloud. Prosody enhancement makes speech sound natural. Your AI has a voice.

---

<p align="center">
  <img src="./images/pai-component-7-terminal-ui.png" alt="Terminal-Based UI" width="700">
</p>

### Terminal-Based UI

Rich tab titles and pane management. Dynamic status lines show learning signals, context usage, and current task state. Your terminal is a command center.

---

## 🚀 Installation

> [!CAUTION]
> **Project in Active Development** — PAI is evolving rapidly. Expect breaking changes, restructuring, and frequent updates. We are working on stable and development branches, but currently it's all combined.

### Which Install Path Should I Use?

```
┌─────────────────────────────────────────────────────────────────┐
│  Do you want a complete, working PAI system right now?          │
│                                                                 │
│     YES ──────────► Option 1: Full Release Install              │
│                     (Complete .claude/ directory, ~5 min)       │
│                                                                 │
│     NO, I want to customize or learn the system                 │
│         │                                                       │
│         ├──► Option 2: Bundle + Packs (Build it yourself)       │
│         │    (Skeleton structure, then install packs manually)  │
│         │                                                       │
│         └──► Option 3: Individual Packs (Cherry-pick)           │
│              (Install only specific capabilities you need)      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Option 1: Full Release Install (Recommended)

> **This is the fastest path to a working PAI system.** You get a complete, pre-configured `.claude/` directory with all infrastructure packs already installed.

```bash
# Clone the repo
git clone https://github.com/danielmiessler/PAI.git
cd PAI/Releases/v2.5

# Back up your existing Claude Code configuration (if any)
[ -d ~/.claude ] && mv ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# Copy the complete PAI installation
cp -r .claude ~/

# Run the configuration wizard
cd ~/.claude && bun run INSTALL.ts
```

**The wizard will:**
- Ask for your name, DA name, and timezone
- Configure environment variables (works with both bash and zsh)
- Set up voice preferences (optional)
- Verify the installation

**After installation:** Restart Claude Code to activate hooks.

[**Full Release documentation →**](Releases/v2.5/README.md)

---

### Option 2: Bundle + Manual Pack Installation

> **For users who want to understand the system** as they build it, or need a customized setup.

> [!WARNING]
> The Bundle wizard creates a **skeleton directory structure only**. You must then install each pack manually in the correct order for a working system.

```bash
# Clone the repo
git clone https://github.com/danielmiessler/PAI.git
cd PAI/Bundles/Official

# Run the interactive wizard (creates skeleton structure)
bun run install.ts
```

**After the wizard completes, you MUST install packs in this order:**

| Order | Pack | Command |
|-------|------|---------|
| 1 | pai-hook-system | "Install the pack at PAI/Packs/pai-hook-system/" |
| 2 | pai-core-install | "Install the pack at PAI/Packs/pai-core-install/" |
| 3 | pai-statusline | "Install the pack at PAI/Packs/pai-statusline/" |
| 4+ | Any skill packs | Install as needed |

[**Bundle documentation →**](Bundles/Official/README.md)

---

### Option 3: Individual Pack Installation

Install individual packs by giving them to your DA:

1. **Browse packs** - Find a pack you want in [Packs/](Packs/)
2. **Give it to your DA** - Provide the pack directory path
3. **Ask your DA to install it:**

```
Install this pack into my system. Use PAI_DIR="~/.claude"
and DA="MyAI". Set up the hooks, save the code, and verify it works.
```

### Option 4: Browse and Cherry-Pick

Packs are self-contained. You can:
- Read the code directly in the pack
- Copy specific functions or workflows
- Adapt the approach to your own system
- Use it as reference documentation

**No forced structure. No mandatory setup. Take what's useful, leave the rest.**

---

## 📦 Packs

PAI capabilities are distributed as **Packs**—self-contained, AI-installable modules that add specific capabilities to your system.

Each pack includes everything needed: code, workflows, installation instructions, and verification tests. Your DA reads the pack and installs it into your system—no manual copying required.

### Infrastructure Packs

| Pack | Description |
|------|-------------|
| [**pai-core-install**](Packs/pai-core-install/) | Core skills, identity, MEMORY system, Components/ build system, and response format. Deploys to `skills/CORE/` (the canonical skill directory). |
| [**pai-hook-system**](Packs/pai-hook-system/) | Event-driven automation and security validation |
| [**pai-voice-system**](Packs/pai-voice-system/) | Voice notifications with ElevenLabs TTS |
| [**pai-observability-server**](Packs/pai-observability-server/) | Real-time agent monitoring dashboard |
| [**pai-statusline**](Packs/pai-statusline/) | 4-mode responsive status line with learning signals |

### Skill Packs

| Pack | Description |
|------|-------------|
| [**pai-agents-skill**](Packs/pai-agents-skill/) | Dynamic agent composition with personality mapping |
| [**pai-algorithm-skill**](Packs/pai-algorithm-skill/) | ISC management, effort classification |
| [**pai-annualreports-skill**](Packs/pai-annualreports-skill/) | Annual security report aggregation |
| [**pai-art-skill**](Packs/pai-art-skill/) | Visual content generation |
| [**pai-brightdata-skill**](Packs/pai-brightdata-skill/) | Progressive URL scraping |
| [**pai-browser-skill**](Packs/pai-browser-skill/) | Browser automation with Playwright |
| [**pai-council-skill**](Packs/pai-council-skill/) | Multi-agent debate system |
| [**pai-createcli-skill**](Packs/pai-createcli-skill/) | Generate TypeScript CLI tools |
| [**pai-createskill-skill**](Packs/pai-createskill-skill/) | Create and validate PAI skills |
| [**pai-firstprinciples-skill**](Packs/pai-firstprinciples-skill/) | First principles analysis |
| [**pai-osint-skill**](Packs/pai-osint-skill/) | Open source intelligence gathering |
| [**pai-privateinvestigator-skill**](Packs/pai-privateinvestigator-skill/) | Ethical people-finding |
| [**pai-prompting-skill**](Packs/pai-prompting-skill/) | Meta-prompting system |
| [**pai-recon-skill**](Packs/pai-recon-skill/) | Security reconnaissance |
| [**pai-redteam-skill**](Packs/pai-redteam-skill/) | Adversarial analysis with 32 agents |
| [**pai-research-skill**](Packs/pai-research-skill/) | Multi-source research |
| [**pai-system-skill**](Packs/pai-system-skill/) | System maintenance and integrity checks |
| [**pai-telos-skill**](Packs/pai-telos-skill/) | Life OS and deep goal capture |

> **23 packs total** — 5 infrastructure + 18 skills. All extracted from production PAI systems.

### Pack Deployment Architecture

Packs deploy to `~/.claude/skills/<SkillName>/` via the `pai sync` command. Two critical architecture rules govern deployment:

**Rule 1: One Pack Per Skill Directory.** Only one pack may deploy to a given skill directory. If two packs target the same directory (e.g., both deploy to `skills/CORE/`), the second sync will overwrite the first due to rsync behavior. This causes data loss.

**Rule 2: Tier-Aware Sync.** The `pai sync` command uses different rsync strategies based on directory type, respecting the [User/System Separation](#usersystem-separation) principle:

| Directory | Strategy | Rationale |
|-----------|----------|-----------|
| `SYSTEM/`, `Workflows/`, `Components/` | `rsync --delete` | Upstream-owned. Safe to fully replace on sync. |
| `Tools/` | `rsync` (additive, no `--delete`) | May contain user-added tools alongside pack tools. |
| `USER/`, `WORK/` | `rsync --ignore-existing` | User-owned data. Only seed templates for new directories; never overwrite. |
| Root `.md` files | `rsync --update` | Only overwrite if pack source is newer. |

**CORE Skill Directory.** `skills/CORE/` is the canonical skill directory for PAI infrastructure. It contains:
- `SKILL.md` — Auto-generated from `Components/` via `Tools/CreateDynamicCore.ts`. Do not edit directly.
- `Components/` — Numbered `.md` files assembled into SKILL.md at build time.
- `SYSTEM/` — Architecture docs, steering rules, security policies (upstream-owned).
- `USER/` — Personal data: identity, contacts, goals, finances (user-owned, never synced upstream).
- `Tools/` — CLI tools for inference, transcript parsing, SKILL.md generation.

**Context Loading.** SKILL.md loads into Claude Code at session start via two mechanisms:
1. `@~/.claude/skills/CORE/SKILL.md` in `CLAUDE.md` — Registers in context % indicator.
2. `LoadContext.hook.ts` (SessionStart hook) — Injects via stdout for runtime availability.

### Forking for Private Skills

PAI is designed to be forked for private customizations. The recommended setup:

```
origin    → your-username/Personal_AI_Infrastructure  (private fork)
upstream  → danielmiessler/Personal_AI_Infrastructure  (public upstream)
```

**Private skill packs** (e.g., pentest workflows, internal tooling) live in your fork's `Packs/` directory alongside upstream packs. They deploy via `pai sync` just like upstream packs. Since your fork is private, proprietary skills never reach the public repository.

**Syncing upstream changes:**
```bash
git fetch upstream
git merge upstream/main
```

The tier-aware sync ensures upstream pack updates never overwrite your `USER/` or `WORK/` data.

---

## 📦 Bundles

**Bundles** are curated collections of packs designed to work together.

| Bundle | Description | Packs |
|--------|-------------|-------|
| [**PAI Bundle**](Bundles/Official/) | The official PAI bundle - complete personal AI infrastructure | 5 |

**Quick install:**
```bash
git clone https://github.com/danielmiessler/PAI.git
cd PAI/Bundles/Official && bun run install.ts
```

[**Learn more about bundles →**](Bundles/)

---

## ❓ FAQ

### How is PAI different from just using Claude Code?

PAI isn't a replacement for Claude Code—it's what you build *on top of it*. Claude Code gives you an AI that can read files, write code, and execute commands. But it's generic. It doesn't know your goals, your preferred workflows, your history, or your specific context.

PAI provides the scaffolding to make that generic AI *yours*:

- **Persistent memory** — Your DA remembers past sessions, decisions, and learnings
- **Custom skills** — Specialized capabilities for the things you do most
- **Your context** — Goals, contacts, preferences—all available without re-explaining
- **Intelligent routing** — Say "research this" and the right workflow triggers automatically
- **Self-improvement** — The system modifies itself based on what it learns

Think of it this way: Claude Code is the engine. PAI is everything else that makes it *your* car.

### Do I need to install everything?

No. PAI v2 is modular by design:

- **Packs are independent** — Install one, install ten, install none
- **Start small** — Begin with the Hook System, add more when you need it
- **No dependencies on the whole** — Each pack declares its dependencies explicitly
- **Incremental adoption** — Use PAI alongside your existing setup

The best way to start: pick ONE pack that solves a problem you have today.

### What's the difference between PAI and Anthropic's plugin system?

Anthropic's plugin system (Skills, slash commands, MCP servers) provides discrete functionality—individual tools your DA can use.

**Anthropic's plugins** = Individual pieces of functionality that don't understand overall context

**PAI** = A complete system where everything understands the context—your goals, your workflows, how pieces work together

The plugin system offers building blocks. PAI offers a complete system.

### Is PAI only for Claude Code?

No. PAI packs are designed to be platform-agnostic. While the examples use Claude Code, the packs work with OpenCode, Cursor, Windsurf, and custom systems. The code is TypeScript, Python, and Bash—the concepts are universal.

### How is this different from fabric?

[Fabric](https://github.com/danielmiessler/fabric) is a collection of AI prompts (patterns) for specific tasks. It's focused on *what to ask AI*.

PAI is infrastructure for *how your DA operates*—memory, skills, routing, context, self-improvement. They're complementary. Many PAI users integrate Fabric patterns into their skills.

### What if I break something?

The modular design makes recovery easy:

- **Packs are isolated** — Breaking one doesn't affect others
- **History is preserved** — Your DA's memory survives mistakes
- **Git-backed** — Version control everything, roll back when needed
- **DA can fix it** — Your DA helped build it, it can help repair it

---

## 🎯 Roadmap

| Feature | Description |
|---------|-------------|
| **Local Model Support** | Run PAI with local models (Ollama, llama.cpp) for privacy and cost control |
| **Granular Model Routing** | Route different tasks to different models based on complexity |
| **Remote Access** | Access your PAI from anywhere—mobile, web, other devices |
| **Outbound Phone Calling** | Voice capabilities for outbound calls |
| **External Notifications** | Robust notification system for Email, Discord, Telegram, Slack |

---

## 🌐 Community

**GitHub Discussions:** [Join the conversation](https://github.com/danielmiessler/PAI/discussions)

**UL Community Discord:** PAI is discussed in the [Unsupervised Learning community](https://danielmiessler.com/upgrade) along with other AI projects

**Twitter/X:** [@danielmiessler](https://twitter.com/danielmiessler)

**Blog:** [danielmiessler.com](https://danielmiessler.com)

### Star History

<a href="https://star-history.com/#danielmiessler/PAI&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=danielmiessler/PAI&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=danielmiessler/PAI&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=danielmiessler/PAI&type=Date" />
 </picture>
</a>

---

## 🤝 Contributing

### Submit a Pack

1. **Fork the repository**
2. **Create your pack** using [PAIPackTemplate.md](Tools/PAIPackTemplate.md)
3. **Test it** — Install in a fresh system with AI assistance
4. **Submit a PR** with examples and testing evidence

Packs are reviewed for completeness, code quality, security, and usefulness. Most packs reviewed within 7 days.

**Pack authors maintain their packs** — respond to issues, fix bugs, consider feature requests.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

**Anthropic and the Claude Code team** — First and foremost. You are moving AI further and faster than anyone right now. Claude Code is the foundation that makes all of this possible.

**[IndyDevDan](https://www.youtube.com/@indydevdan)** — For great videos on meta-prompting and custom agents that have inspired parts of PAI.

### Contributors

**[fayerman-source](https://github.com/fayerman-source)** — Google Cloud TTS provider integration and Linux audio support for the voice system.

**Matt Espinoza** — Extensive testing, ideas, and feedback for the PAI 2.3 release, plus roadmap contributions.

---

## 💜 Support This Project

<div align="center">

<a href="https://github.com/sponsors/danielmiessler"><img src="https://img.shields.io/badge/Sponsor-❤️-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" alt="Sponsor"></a>

**PAI is free and open-source forever. If you find it valuable, you can [sponsor the project](https://github.com/sponsors/danielmiessler).**

</div>

---

## 📚 Related Reading

- [The Real Internet of Things](https://danielmiessler.com/blog/real-internet-of-things) — The vision behind PAI
- [AI's Predictable Path: 7 Components](https://danielmiessler.com/blog/ai-predictable-path-7-components-2024) — Visual walkthrough of where AI is heading
- [Building a Personal AI Infrastructure](https://danielmiessler.com/blog/personal-ai-infrastructure) — Full PAI walkthrough with examples

---

<details>
<summary><strong>📜 Update History</strong></summary>

<br/>

**v2.5.0 (2026-01-30) — Think Deeper, Execute Faster**
- Two-Pass Capability Selection: Hook hints validated against ISC in THINK phase
- Thinking Tools with Justify-Exclusion: Opt-OUT, not opt-IN for Council, RedTeam, FirstPrinciples, etc.
- Parallel-by-Default Execution: Independent tasks run concurrently via parallel agent spawning
- 28 skills, 17 hooks, 356 workflows
- [Release Notes](Releases/v2.5/README.md)

**v2.4.0 (2026-01-23) — The Algorithm**
- Universal problem-solving system with ISC (Ideal State Criteria) tracking
- 29 skills, 15 hooks, 331 workflows
- Euphoric Surprise as the outcome metric
- Enhanced security with AllowList enforcement
- [Release Notes](Releases/v2.4/README.md)

**v2.3.0 (2026-01-15) — Full Releases Return**
- Complete `.claude/` directory releases with continuous learning
- Explicit and implicit rating capture
- Enhanced hook system with 14 production hooks
- Status line with learning signal display
- [Release Notes](Releases/v2.3/README.md)

**v2.1.1 (2026-01-09) — MEMORY System Migration**
- History system merged into pai-core-install as MEMORY System

**v2.1.0 (2025-12-31) — Directory-Based Pack Structure**
- All packs migrated from single files to directory structure
- Source code now in real files instead of embedded markdown

**v2.0.1 (2025-12-30) — Pack Expansion**
- Added Prompting and Agents skills
- Standardized authentication to single `.env` location

**v2.0.0 (2025-12-28) — PAI Packs System Launch**
- Transitioned from monolithic to modular pack architecture
- Platform-agnostic design

</details>

---

## ⭐ Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=danielmiessler/Personal_AI_Infrastructure&type=Date)](https://star-history.com/#danielmiessler/Personal_AI_Infrastructure&Date)

</div>

---

<div align="center">

**Built with ❤️ by [Daniel Miessler](https://danielmiessler.com) and the PAI community**

*Augment yourself.*

</div>
