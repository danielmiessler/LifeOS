# PAI: Getting started

PAI (Personal AI Infrastructure) is an open-source layer on top of Claude Code that adds structured thinking, persistent memory, specialized skills, security guardrails, and voice feedback. Think of it as Claude Code on steroids: same CLI, same model, but with a system around it that makes every interaction more capable.

Created by [Daniel Miessler](https://github.com/danielmiessler/Personal_AI_Infrastructure). Free and open source.

## Install

macOS or Linux. Takes about 2 minutes.

```bash
# 1. Clone the repo
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git

# 2. Copy the latest release into your home directory
cd Personal_AI_Infrastructure/Releases/v4.0.3
cp -r .claude ~/

# 3. Run the installer
cd ~/.claude && bash install.sh
```

The installer detects your OS, installs prerequisites it can't find (Bun, Git), and launches a setup wizard. It asks for your name, your AI assistant's name, timezone, and temperature preference. That's it.

After it finishes:

```bash
source ~/.zshrc   # or restart your terminal
claude            # launch Claude Code — PAI loads automatically or run pai
```

**Prerequisites the installer handles for you:** Bun runtime, Git. You need curl and a working Claude Code subscription. The installer will prompt you to install Claude Code if it's missing.

## What you'll notice immediately

The first time you type a prompt, PAI responds differently from stock Claude Code.

Every response gets classified into one of three modes:

| Mode | When it fires | What it looks like |
|------|---------------|-------------------|
| Minimal | Greetings, ratings, short acknowledgments | A compact block with change and verify bullets |
| Native | Simple tasks (under ~2 minutes of work) | A task label, the work, then change/verify bullets |
| Algorithm | Anything complex or multi-step | A structured 7-phase process with progress tracking |

You'll see formatted output with section markers instead of freeform text. This is intentional. PAI forces structure on every response so nothing gets lost and you can track what happened.

## Try something

Open Claude Code and try these. Each one shows a different side of PAI.

**A simple task (Native mode):**
```
Summarize the last 3 commits in this repo
```
You'll see PAI classify this as Native mode, do the work, and show you verification bullets confirming what it did.

**A thinking task:**
```
Do first principles analysis on whether we should migrate our API from REST to GraphQL
```
PAI will enter the Algorithm: observe your request, define success criteria, think through risks, plan an approach, execute, verify each criterion, then reflect on what it learned.

**Research:**
```
Do quick research on the current state of WebAssembly for server-side applications
```
PAI's Research skill launches parallel agents that query multiple sources, then synthesizes the results.

## How the Algorithm works

When you give PAI a complex task, it doesn't just start typing. It runs a 7-phase loop:

```
OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN
```

**Observe** reverse-engineers your request. What did you ask for? What didn't you ask for but probably want? What should it avoid? It writes concrete success criteria (called ISC, Ideal State Criteria) and picks an effort level.

**Think** pressure-tests those criteria. What could go wrong? What assumptions might be wrong?

**Plan** maps out the technical approach.

**Build** and **Execute** do the work, checking off criteria in real time.

**Verify** tests every criterion and adds evidence.

**Learn** reflects on what could have been done better, and writes that reflection to a structured log.

The whole process is tracked in a PRD (Product Requirements Document) file that PAI writes to disk. You can read it afterward to see exactly what it thought, decided, and verified.

Effort levels scale the process:

| Level | Time budget | When |
|-------|------------|------|
| Standard | Under 2 min | Normal requests |
| Extended | Under 8 min | High-quality work |
| Advanced | Under 16 min | Multi-file changes |
| Deep | Under 32 min | Complex design |
| Comprehensive | Under 2 hours | No time pressure, maximum quality |

More on the Algorithm: see [`PAI/Algorithm/v3.7.0.md`](https://github.com/danielmiessler/Personal_AI_Infrastructure/blob/main/Releases/v4.0.3/.claude/PAI/Algorithm/v3.7.0.md) in the repo.

## What can PAI do?

PAI ships with 11 skill categories. Each skill is a markdown file that tells Claude Code how to handle a specific type of work. You trigger them through natural language, not slash commands (though those work too).

**Research** (multi-mode: quick, standard, extensive, deep). Launches parallel research agents that query different sources and synthesize findings. Ask for "quick research on X" or "do deep research on Y."

**Thinking** covers first-principles decomposition, council debates (multiple perspectives argue a question), red-teaming (adversarial stress-testing of an idea), and brainstorming. Try: "Red team my plan to migrate to microservices."

**Agents** lets you compose custom agents from personality traits, voices, and specializations. You can spin up a council of domain experts who debate a topic, each with their own perspective and voice.

**Security** handles network reconnaissance, web app security testing, prompt injection testing, and security news monitoring. Built by a security professional (Miessler's background is 20+ years in cybersecurity, ex-Apple, ex-Robinhood).

**Investigation** does OSINT: company intel, domain lookups, due diligence, people search across public records.

**Media** generates images (via Flux, Nano Banana, GPT-Image-1), diagrams, infographics, mermaid flowcharts, comics, and programmatic video via Remotion.

**Content analysis** extracts structured insights from videos, podcasts, articles, and YouTube links.

**Telos** is a life operating system: goals, beliefs, project dashboards, dependencies. It starts with an interview process that maps out who you are and what you're working toward.

**US Metrics** pulls from 68 economic indicators (FRED, EIA, Treasury, BLS, Census) with trend analysis.

**Scraping** does web scraping with progressive escalation (direct fetch, then proxy, then headless browser) and social media platform extraction via Apify.

**Utilities** covers CLI generation, skill scaffolding, Fabric pattern integration, Cloudflare infrastructure, and browser automation.

You don't need to memorize any of this. PAI routes your request to the right skill automatically about 95% of the time. If you say "research X," Research fires. If you say "analyze this website's security," Security fires.

## Voice: your AI talks back

PAI can speak to you. Each agent (Architect, Engineer, Designer, QA Tester, Researcher, etc.) has its own distinct voice through ElevenLabs.

This is optional but useful when running parallel tasks. Instead of watching terminal output scroll by, you hear different voices report back what they've accomplished.

**Setup:**
1. Get an [ElevenLabs](https://elevenlabs.io) API key (free tier available)
2. Add `ELEVENLABS_API_KEY=your_key` to `~/.env`
3. Run the voice server installer: `cd ~/.claude/VoiceServer && bash install.sh`

The voice server runs locally at `localhost:8888` and auto-starts with your machine.

Without ElevenLabs, PAI works identically. You just don't hear it.

More on the voice system: [How to give your Claude Code agents custom ElevenLabs voices](https://youtu.be/JrtSQNTvKNk)

## Memory: PAI learns over time

PAI uses a file-system-based memory architecture. No third-party memory services, no cloud storage. Everything stays in `~/.claude/MEMORY/`.

The memory system has three temperature tiers:

**Hot memory** (loaded at session start): your identity, active work context, recent learnings. This is what makes PAI feel like it knows you.

**Warm memory** (loaded on demand): past session summaries, project history, research archives. Accessed when you reference prior work.

**Cold memory** (long-term archive): complete session transcripts, old PRDs, historical decisions. Searchable but not loaded by default.

PAI also tracks its own performance. A sentiment analysis hook monitors how well it's doing, and a learning system captures what worked and what didn't after every Algorithm run. This feedback loop means PAI gets better at working with you specifically over time.

## Security: built-in guardrails

PAI has 20 lifecycle hooks. Several are security-focused.

**SecurityValidator** fires before every Bash command, file edit, file write, and file read. It checks against a pattern library:

- Blocked operations (always prevented): `rm -rf /`, disk formatting, etc.
- Confirm operations (requires your approval): `git push --force`, destructive git commands
- Alert operations (logged but allowed): `sudo` usage
- Zero-access paths (never readable or writable): `~/.ssh`, credential files
- Read-only paths, no-delete paths, confirm-write paths

**AgentExecutionGuard** validates agent spawning. **SkillGuard** prevents erroneous skill invocations. **IntegrityCheck** detects unauthorized changes to PAI's own files.

All security decisions are logged to `MEMORY/SECURITY/` for audit.

This matters because Claude Code with `--dangerously-skip-permissions` is a loaded gun. PAI adds defense-in-depth so you can give the AI more autonomy without losing control. Miessler estimates the layered defenses are [85-95% effective against prompt injection](https://youtu.be/Le0DLrn7ta0?t=2226), with the main principle being separation between agents that touch the internet and agents with local execution permissions.

## Native Claude Code vs PAI: trade-offs

PAI is not a pure upgrade. It's a trade-off.

| | Native Claude Code | Claude Code + PAI |
|---|---|---|
| Setup | Zero config | 2-minute installer |
| Response speed | Fastest possible | Slightly slower (mode classification, hook execution) |
| Token consumption | Baseline | Higher. PAI loads ~5,000-15,000 tokens of context at startup, hooks fire on every tool call, the Algorithm adds structured overhead |
| Response structure | Freeform | Forced structure (modes, verification bullets) |
| Memory across sessions | Limited (CLAUDE.md only) | Three-tier memory system with learning |
| Security | Anthropic's built-in safety | Anthropic's safety + 20 hooks + pattern-based validation |
| Complex task handling | Whatever you prompt for | Structured Algorithm with criteria, verification, and reflection |
| Research | Single-threaded | Parallel multi-agent, multi-source |
| Skill library | Whatever you build | 63+ pre-built skills across 11 categories |
| Voice feedback | None | Optional per-agent voice via ElevenLabs |
| Self-improvement | None | Upgrade skill monitors releases and suggests improvements |
| Prompt quality | Depends on you | PAI reverse-engineers your intent, adds criteria you didn't think of |
| Portability | Tied to Claude Code | All markdown files, portable to other agentic platforms in principle |

**When to use native Claude Code:** Quick one-off questions, simple edits, when speed matters more than thoroughness. Low-context tasks where structure adds overhead without value.

**When to use PAI:** Research, analysis, multi-step builds, security work, anything you'd want a second pass on. Tasks where "did I actually verify this?" matters. Work that benefits from persistent memory of past sessions.

The token cost increase is real. PAI front-loads context so the AI starts every interaction with a full picture of who you are, what tools it has, and how to behave. On a Claude Code Max subscription ($200/month), this is absorbed. On API billing, monitor your usage for the first week.

## The philosophy (for those who want it)

You don't need to read this section to use PAI. But if you're curious about why it works the way it does:

**Scaffolding over models.** The architecture around an AI matters more than which model it runs. A well-structured system with a year-old model outperforms a new model with no scaffolding. PAI is the scaffolding. ([Source: Miessler's talk at 25:06](https://youtu.be/Le0DLrn7ta0?t=1506))

**Code before prompts.** Anything that can be solved deterministically should be solved in code, not in a prompt. PAI's target ratio is ~80% deterministic code, ~20% AI prompting. The AI wraps the code, not the other way around. ([Source: 27:00](https://youtu.be/Le0DLrn7ta0?t=1620))

**Unix philosophy.** Each skill does one thing well and calls other skills. A red-team skill calls first-principles decomposition. A research skill spawns parallel agents. Composability over monolithic prompts.

**File system over RAG.** Structured file-based memory is fast, cheap, and inspectable. You can `cat` any memory file. No vector database, no embedding pipeline, no black box.

**Self-improvement.** PAI has an upgrade skill that monitors Anthropic's releases, YouTube channels, and engineering blogs, then suggests improvements to its own configuration. When Anthropic shipped the `use-when` frontmatter feature, PAI detected it and auto-applied it across all 63+ skills.

These ideas are laid out in more detail in Miessler's 2016 book [The Real Internet of Things](https://danielmiessler.com/blog/the-real-internet-of-things), which predicted much of what PAI now implements.

## Customize PAI for yourself

PAI separates system files (upgraded by the project) from user files (yours to customize).

**Your files** live in `~/.claude/PAI/USER/`. This is where you put your goals, projects, business context, and personal preferences. Upgrades never touch this directory.

**The Telos system** is the structured way to do this. Run a Telos session and it interviews you about your goals, beliefs, problems, and workflows, then stores the results in a format PAI can use to personalize every interaction.

**Forking for private use:** Clone PAI into a private repo. Keep your customizations in USER/. Periodically pull upstream updates. The separation between system and user directories makes this straightforward.

## Go deeper

**The repo:** [github.com/danielmiessler/Personal_AI_Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure)

**Video walkthroughs:**
- [How and Why I Built PAI](https://youtu.be/vvXC7sqso4w) (with Nathan Labenz, Cognitive Revolution) -- philosophy, architecture, live demos
- [Deep dive on PAI v2.0](https://youtu.be/Le0DLrn7ta0) -- engineering principles, art skill demo, costs, security Q&A
- [Building Your Own Unified AI Assistant](https://youtu.be/iKwRWwabkEc) -- file-system context, MCP integration, real products built with PAI
- [Custom ElevenLabs voices for agents](https://youtu.be/JrtSQNTvKNk) -- voice setup walkthrough

**Costs:** PAI itself is free. You pay for your Claude Code subscription (or API usage) and optionally ElevenLabs (~$20/month) for voice. Total with Claude Code Max: ~$220/month.

**Updating PAI:**
```bash
# Back up first
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# Pull latest
cd /path/to/Personal_AI_Infrastructure && git pull

# Copy new release and re-run installer
cd Releases/v4.0.3
cp -r .claude ~/
cd ~/.claude && bash install.sh
```

**Platform support:** macOS (primary), Linux (tested on Ubuntu/Debian). Windows is not supported.
