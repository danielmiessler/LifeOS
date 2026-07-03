---
name: LifeOS
description: Install and onboard a user into LifeOS — the Life Operating System (current state → ideal state via TELOS + the Algorithm). The agentic installer detects your OS + harness, wires hooks with permission, scaffolds your USER tree, pulls in sources you provide, and runs the TELOS / current→ideal interview that seeds your Pulse dashboard. USE WHEN install LifeOS, set up LifeOS, lifeos setup, lifeos-setup, lifeos interview, onboard me, run the interview, integrate LifeOS into my harness, update LifeOS, uninstall LifeOS, first-time setup. NOT FOR building or cutting a LifeOS release (private release tooling), editing TELOS after onboarding (use Telos / Interview), or LifeOS system maintenance (use the private maintenance skill).
argument-hint: "[setup|interview|update|uninstall]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# LifeOS

The install + onboarding surface for **LifeOS** — the Life Operating System (formerly LifeOS). One command takes a stranger on any harness from nothing to a working, personalized install whose Pulse dashboard already shows their current state vs ideal state — without making them adopt a whole new harness.

## How it ships

LifeOS is distributed as **one self-contained skill** — the `LifeOS/` directory is the *entire* distribution. Everything ships inside it: the orchestrator (`SKILL.md`, `Workflows/`, `Tools/`), the whole-system payload under `install/`, and the one-line bootstrap at `install/install.sh`. **Nothing ships outside the skill** — no release-root `install.sh`, no `.claude/` clone.

**The primary install is AI-native: give `INSTALL.md` (served at `ourlifeos.ai/install`) to your AI and say "install this."** LifeOS is AI-native, so the install is too — you hand the doc (or its link) to whatever harness you already use, and your AI installs LifeOS on your OS and harness, with permission at each step. It's the same document a human can read and follow. `INSTALL.md` opens with a capability gate, drives the install Tools (which run under `bun` on any OS, not a shell), wires integration per-harness (honest about what each gets), then runs Setup → Interview.

A terminal shortcut stays for Claude Code on macOS/Linux:

```
curl -fsSL https://ourlifeos.ai/install.sh | bash
```

Both are served from the skill's own single sources of truth — `INSTALL.md` at the skill root, `install/install.sh` for the shell path (which hands off to the agentic `/lifeos-setup`). The skill carries no version field (Claude Code ignores one); **versioning lives at the distribution layer** — the GitHub release tag and the `LIFEOS_RELEASES/<version>/` parent dir. The payload (skills, hooks, system prompt, Algorithm, docs, runtime tools) rides along under `install/` and is placed during setup, with permission.

## Workflow Routing

| Trigger | Workflow |
|---------|----------|
| `setup`, `/lifeos-setup`, "install LifeOS", "integrate into my harness" | `Workflows/Setup.md` |
| `interview`, "onboard me", "run the interview", TELOS capture | `Workflows/Interview.md` |
| `update`, "update LifeOS", after a version bump | `Workflows/Update.md` |
| `uninstall`, "remove LifeOS" | `Workflows/Uninstall.md` |

Default flow (`/lifeos-setup`): **Setup phase** (system integration) → transitions into **Interview phase** (life onboarding). One continuous experience, two clearly-marked phases — setup is logistics, interview is meaning. Setup ALWAYS runs first; hooks must be wired before the interview seeds anything.

## The two phases

**Setup (logistics, first).** Detect OS + harness → scan for conflicts and surface them → install prerequisites → overlay the system templates → scaffold the USER tree + link it → **trust-gated hook install** (show the exact change, back up `settings.json`, wait for yes) → activate the identity imports → verify with two evidence classes. Adapts to OS (macOS/Linux/Windows) and harness (Claude Code / Hermes / Cursor / OpenClaw).

**Interview (meaning, second).** Name the DA → principal identity → TELOS current state → TELOS ideal state → **pull in external sources the user provides** (existing notes, configs, exports) to enrich USER context → seed Pulse. By the end, the config tree is populated and Pulse shows real data, not empty scaffolding.

## Hard rules

- **Setup before Interview, always.** Hooks/integration land before any onboarding write.
- **Additive, never clobbering.** `install.sh` touches only the LifeOS skill dir; setup writes are `existsSync`-guarded. Never overwrite or `rm` a populated dir or a foreign file.
- **Permission before mutation.** Hook install shows the exact change (file count + settings entries) and backs up `settings.json` first. Nothing changes without an explicit yes.
- **Config root keeps its canonical name.** The user tree lives under the config dir and is linked into the harness tree; "LifeOS" is the brand, the resolved config path does not rename (renaming it breaks the identity `@`-imports).
- **Dev-tree refusal.** The hook install refuses to run inside the LifeOS source repo (detected via dev-tree markers — the private maintenance skill present, or a recognized source-repo git remote). Never mutate the author's live system.

## Gotchas

- **No `version:` in SKILL.md.** Claude Code ignores it. Version lives in the release (tag + `LIFEOS_RELEASES/<version>/` + the `install.sh` fetch), not in the skill.
- **`install.sh` is non-destructive by design.** It installs only the LifeOS skill and backs up only a prior LifeOS skill — never the user's other skills, hooks, or config. The whole point is "bolt on, don't take over."
- **Hooks are installed imperatively, with permission.** A bare skill cannot auto-wire hooks; the setup workflow writes them into the user's harness explicitly, after showing what changes.
- **Config is `.toml`, never `.yaml`.** `PaiConfig.ts` reads TOML; the legacy `.yaml` template was retired 2026-06-19.
- **Cross-platform is solved at setup time, not statically.** The setup conversation detects the OS + harness and tailors hook commands and paths — don't assume macOS.

## Examples

- "install LifeOS" → `install.sh` drops the skill, then `/lifeos-setup` runs: detect env, surface conflicts, wire hooks with permission, scaffold the USER tree, then roll into the interview.
- "run the lifeos interview" → Interview workflow: capture TELOS + current/ideal state, pull in the user's sources, seed Pulse.
- "update LifeOS" → Update workflow: idempotent re-overlay after a version bump, non-destructive.
