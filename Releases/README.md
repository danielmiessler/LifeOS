<div align="center">

<img src="release-icon-v2.png" alt="PAI Releases" width="256">

# PAI Releases

</div>

---

## What Are Releases?

Releases are **complete `.claude/` directories** ready to drop into your home folder. Each release contains everything you need: skills, hooks, workflows, memory structure, and configuration.

This is the fastest way to get PAI running. Copy the directory, run the wizard, restart Claude Code.

> **Note:** The `.claude` directory is hidden by default on macOS/Linux. Use `ls -la` to see it.

---

## Available Releases

### v4.0.2 — Bug Fix Patch (Current)

13 surgical fixes — no new features, no breaking changes.

- Linux compatibility: cross-platform OAuth token extraction, GNU coreutils `tr` fix
- Installer: correct alias path, shell detection (bash/fish/zsh), headless CLI fallback
- Statusline: width cache, algorithmVersion field, cross-platform OAuth
- Hooks: inference guard (~15s savings), lineage tracking, dead code removal, exit codes, voice config

**[Get v4.0.2 →](v4.0.2/)**

---

### v4.0.1 — Upgrade Path & Preferences

Patch release addressing community feedback on upgrade difficulties and missing preferences.

- Upgrade path documentation with backup, merge, and post-upgrade checklist
- Configurable temperature unit (Fahrenheit/Celsius) in statusline
- Installer prompts for temperature preference during setup
- Statusline fixes: dynamic timezone, context fallback, startup estimate, f-string syntax (PRs #762, #780, #806)
- FAQ fixes (removed stale Python reference, improved recovery guidance)

**[Get v4.0.1 →](v4.0.1/)**

---

### v4.0.0 — Lean and Mean

38 flat skill directories compressed into 12 hierarchical categories. Dead systems removed. Context footprint cut in half.

- 63 Skills, 21 Hooks, 180 Workflows
- Algorithm v3.5.0
- CLAUDE.md template system with BuildCLAUDE.ts + SessionStart hook
- Comprehensive security sanitization (33+ files cleaned)
- ~19% context at startup (down from ~38%)

**[Get v4.0.0 →](v4.0.0/)**

---

### v3.0.0 — The Algorithm Matures

The Algorithm reaches v1.4.0 with constraint extraction, build drift prevention, persistent PRDs, and parallel loop execution.

- 38 Skills, 20 Hooks, 162 Workflows
- Algorithm v1.4.0
- Full installer with GUI wizard
- 10 new skills
- Agent teams/swarm
- Voice personality system
- PRD system

**[Get v3.0 →](v3.0/)**

---

### v2.5.0 — Think Deeper, Execute Faster

The Algorithm learns metacognition—thinking about how it thinks—and parallel execution.

- 28 Skills, 17 Hooks, 356 Workflows
- Two-pass capability selection with ISC validation
- Thinking tools with justify-exclusion principle
- Parallel-by-default execution for independent tasks
- 7 named composition patterns for capability orchestration

**[Get v2.5 →](v2.5/)**

---

### v2.4.0 — The Algorithm

Our first attempt at a general problem solver built into PAI to pursue Euphoric Surprise.

- 29 Skills, 15 Hooks, 331 Workflows
- 7-phase problem-solving with ISC tracking
- Improved installation wizard
- Voice notifications via ElevenLabs

**[Get v2.4 →](v2.4/)**

---

### v2.3.0 — Continuous Learning

The release that introduced persistent learning and sentiment capture.

- 20 Skills, session continuity
- Implicit/explicit rating capture
- Memory system with WORK, STATE, LEARNING directories

**[Get v2.3 →](v2.3/)**

---

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/danielmiessler/Personal_AI_Infrastructure.git
cd Personal_AI_Infrastructure/Releases/v4.0.2

# 2. Copy the release and run the installer
cp -r .claude ~/ && cd ~/.claude && bash install.sh
```

The wizard asks for your name, AI name, timezone, temperature unit, and optional voice preferences.

See the [main README](../README.md#upgrading-from-a-previous-version) for upgrade instructions.

---

## Troubleshooting

**Can't see .claude directory?** It's hidden. Use `ls -la ~/` or press `Cmd+Shift+.` in Finder.

**Hooks not firing?** Restart Claude Code after installation.

---

**Questions?** See the main [PAI README](../README.md).
