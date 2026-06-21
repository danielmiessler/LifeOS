# PAI — Personal AI Infrastructure

> **PAI is a Life OS.** Scaffolding that turns your AI from a chatbot you talk to into a system that runs your life — knows your goals, people, workflows, current state, and ideal state, and continuously hill-climbs you from one to the other.

**Status:** Version 5.0.0 | **License:** [MIT](./LICENSE)

---

## What you get

- **A Digital Assistant (DA)** — named by you, running as a peer. Ships with a generic "PAI" DA out of the box; `/interview` personalizes it.
- **The Algorithm** — a structured problem-solving framework (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) that the DA runs for non-trivial tasks.
- **Pulse** — a local daemon on port 31337 that provides push notifications, observability, scheduled tasks, and a Life Dashboard. Runs as a macOS launchd service with a menu bar app.
- **Skills** — 40+ composable capabilities (research, creative writing, security assessment, Cloudflare deploys, etc.) that the DA self-selects at runtime.
- **Memory** — persistent typed storage that compounds across sessions (KNOWLEDGE for durable notes, WORK for active projects, LEARNING for meta-patterns).
- **TELOS** — your mission, goals, beliefs, challenges, and wisdom captured in structured files so the DA can frame every recommendation against who you are and what you're trying to do.

---

## Quick Start

### Prerequisites

- macOS or Linux (Linux support is partial — Pulse menu bar is macOS-only)
- [Claude Code](https://docs.claude.com/claude-code) installed
- An [Anthropic API key](https://console.anthropic.com/) (required — Claude Code uses it)

### ⚠️ Important: back up existing `~/.claude/` first

If you already use Claude Code, `~/.claude/` already exists with your settings, hooks, and agents. **Back it up before installing PAI:**

```bash
cp -R ~/.claude ~/.claude.backup-$(date +%Y%m%d)
```

PAI lives in `~/.claude/` alongside your Claude Code install. Files that coexist (`settings.json`, `CLAUDE.md`) are overlaid by the PAI installer — your prior customizations will be replaced by PAI defaults. You can merge them back by diffing against the backup after install.

### Install

```bash
git clone https://github.com/{{REPO_OWNER}}/PAI.git ~/.claude
cd ~/.claude
./install.sh
```

The installer will:
1. Check/install Bun and Git
2. Verify Claude Code is present
3. Launch a web-based wizard for DA identity setup
4. Set up the Pulse daemon
5. Run validation

### First session

After install completes:

```bash
# Load Pulse (push notifications + Life Dashboard)
cd ~/.claude/PAI/PULSE && bash manage.sh install

# Start a Claude Code session
claude
```

In your first Claude session, run `/interview` to personalize your DA with your mission, goals, challenges, and preferences. The scaffold files at `~/.claude/PAI/USER/` are functional defaults — the interview upgrades them to your real identity.

---

## Architecture at a glance

```
~/.claude/
├── CLAUDE.md                    # operational procedures + context routing
├── settings.json                # Claude Code config + DA identity
├── PAI/                         # the engine
│   ├── ALGORITHM/v3.29.0.md     # the universal problem-solving framework
│   ├── DOCUMENTATION/           # every subsystem fully documented
│   ├── PULSE/                   # daemon, menu bar, scheduled tasks
│   ├── TOOLS/                   # CLI utilities (Inference, GenerateTelosSummary, etc.)
│   └── USER/                    # YOUR scaffolds — ABOUTME, TELOS/, DA_IDENTITY, etc.
├── skills/                      # 40+ composable capabilities
├── agents/                      # specialist subagent definitions
├── hooks/                       # lifecycle integration (SessionStart → Stop)
└── MEMORY/                      # durable knowledge + active work state
```

The DA reads `CLAUDE.md` at every session start, which `@`-imports your identity, DA personality, projects, and TELOS. Every skill, agent, and hook composes with these durable contexts.

---

## Post-install customization

- **DA identity** — `/interview` personalizes your DA's name, personality, and relationship framing.
- **TELOS** — `/interview` (TELOS phase) populates your mission, goals, beliefs, challenges, wisdom.
- **Pulse port** — defaults to 31337, bound to loopback. Set `PAI_PULSE_BIND_ALL=1` in `~/.claude/.env` if you need LAN access (phone, other machines).
- **Menu bar app** — `bash ~/.claude/PAI/PULSE/MenuBar/install.sh` builds and installs the Swift menu bar app.

---

## Documentation

- **System architecture:** [PAI/DOCUMENTATION/PAISystemArchitecture.md](./PAI/DOCUMENTATION/PAISystemArchitecture.md)
- **Life OS thesis:** [PAI/DOCUMENTATION/LifeOs/LifeOsThesis.md](./PAI/DOCUMENTATION/LifeOs/LifeOsThesis.md)
- **Algorithm spec:** [PAI/ALGORITHM/v3.29.0.md](./PAI/ALGORITHM/v3.29.0.md)
- **Skill system:** [PAI/DOCUMENTATION/Skills/SkillSystem.md](./PAI/DOCUMENTATION/Skills/SkillSystem.md)
- **Hook system:** [PAI/DOCUMENTATION/Hooks/HookSystem.md](./PAI/DOCUMENTATION/Hooks/HookSystem.md)
- **Pulse system:** [PAI/DOCUMENTATION/Pulse/PulseSystem.md](./PAI/DOCUMENTATION/Pulse/PulseSystem.md) (path is case-insensitive on macOS APFS; on Linux use `PAI/PULSE/`)
- **Memory system:** [PAI/DOCUMENTATION/Memory/MemorySystem.md](./PAI/DOCUMENTATION/Memory/MemorySystem.md)
- **Installer details:** [PAI/PAI-Install/README.md](./PAI/PAI-Install/README.md)

---

## Troubleshooting

**"Installer/server.ts not found":** The top-level `./install` delegates to `PAI/PAI-Install/install.sh`. Run that directly if the delegation fails.

**Pulse won't start / port 31337 conflict:** `lsof -i :31337` to find the conflicting process. Edit `PULSE.toml` to change the port, or kill the conflicting process.

**Menu bar icon doesn't appear:** `launchctl list | grep pai` should show `com.pai.pulse-menubar` loaded. If not, run `bash PAI/PULSE/MenuBar/install.sh`.

**Existing `~/.claude/` conflicts:** See the "Before you install" section above. Back up first, then merge your customizations from the backup after install.

---

## Philosophy

PAI treats AI as infrastructure, not a feature. The same reason you have a filesystem, a shell, and an init system — you need durable scaffolding the model can operate within. Naked chat is not enough. PAI is the Life OS: a layer above Claude Code that knows who you are, what you're building, who matters to you, and where you're trying to go.

You name your DA. You shape its personality. You capture your TELOS. The DA reads all of it at every session and operates as a peer, not a tool.

---

## Contributing

Issues and discussions are welcome via the repository. Architecture changes go through the upgrade process described in the Algorithm spec.

---

*Licensed under [MIT](./LICENSE).*
