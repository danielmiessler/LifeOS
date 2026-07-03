# Install LifeOS

**The primary way to install LifeOS is to give this document to your AI and say "install this."**

LifeOS is AI-native, so the install is too. You hand this file (or its link) to whatever AI assistant you already use, and it does the whole install for you — on your OS, on your harness, with your permission at every step. You can also read it yourself and follow along; it's the same document either way.

---

## For you (the human) — 10 seconds

Paste this to your AI — Claude Code, Cursor, Cline, Codex, Gemini CLI, or any coding assistant that can read files and run commands:

> **Read https://ourlifeos.ai/install and install LifeOS for me.**

That's the primary path. Your AI reads the rest of this page and installs LifeOS for you.

Prefer a terminal? There's a shell shortcut for Claude Code on macOS/Linux:

```
curl -fsSL https://ourlifeos.ai/install.sh | bash
```

Everything below is written for the AI doing the install.

---

## For the AI assistant — read this fully before you touch anything

You are installing LifeOS for your human. The install is **additive**: you touch only LifeOS's own files until they explicitly say yes to an integration step. Work through the phases in order. Before any change that modifies their machine, show exactly what will change and wait for a yes.

### 0. Capability gate — stop here if you fail it

You need to be able to (1) read and write files on this machine, and (2) run shell commands. If you cannot do both — for example you're a chat-only assistant with no filesystem or command execution — **stop now** and tell your human:

> "I can't install LifeOS from here — I don't have file and command access on your machine. Run this from a coding harness like Claude Code, Cursor, Cline, Codex, or Gemini CLI, or use the terminal shortcut on the install page."

Do not begin a partial install you can't finish.

### 1. Prerequisites

- **bun** runs the install tools (they're TypeScript). Check `bun --version`. If it's missing, install it and re-check:
  - macOS / Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows: `powershell -c "irm bun.sh/install.ps1 | iex"`
- **git** and a network connection, to fetch the release. (Or use a local release directory if your human already has one.)

### 2. Get the release and detect the environment

Fetch the pinned LifeOS release for the repo and version on the install page (the tag tarball over HTTPS, no auth), or use a local release directory if given one. Then, from the LifeOS skill directory, run:

```
bun Tools/DetectEnv.ts
```

Read its output. It reports the OS (macOS / Linux / Windows), the harness (Claude Code / Cursor / Cline / Codex / Gemini / other), the config root, and whether LifeOS is already present. **Every path below comes from this — don't assume `~/.claude` or any single harness.**

### 3. Scan for conflicts (read-only)

```
bun Tools/ScanConflicts.ts
```

Surfaces anything already sitting in the target directories. Show your human. Nothing has changed yet.

### 4. Drop the skill and runtime (additive)

```
bun Tools/DeployCore.ts
```

Copies the LifeOS skill and runtime into the harness's config tree. Existing files are never overwritten — only missing ones are added.

### 5. Scaffold the personal (USER) tree

```
bun Tools/ScaffoldUser.ts
bun Tools/LinkUser.ts
```

Creates the personal config tree from templates and links it in. This is empty structure — no personal content yet. That comes in the interview.

### 6. Wire the integration — HARNESS-SPECIFIC, WITH PERMISSION

This is the one place harnesses genuinely differ. Show the exact change and get a yes.

- **Claude Code** — run `bun Tools/InstallHooks.ts` (merges the hook set into `settings.json`, backing it up first) and `bun Tools/ActivateImports.ts` (turns on the identity context imports). This is what lights up the always-on behavior: the mode banner, the memory loop, and per-turn context injection.

- **Any other harness (Cursor / Cline / Codex / Gemini / other)** — LifeOS's always-on behavior is enforced by Claude Code *hooks*, which are a Claude Code mechanism. They don't auto-wire on other harnesses **yet**. So instead:
  1. Write an `AGENTS.md` (or the harness's own context file — e.g. `.cursor/rules`) that points the harness at the LifeOS tree, so it loads the LifeOS context every session.
  2. Tell your human, plainly and honestly: *"On <harness>, the always-on hooks aren't wired yet. You get the skill, your USER data, Pulse, and context loading every session, and you run Setup and Interview on request. Full always-on behavior is on the roadmap for this harness."*
  3. **Do not** write Claude hook files or a Claude `settings.json` `hooks` block into a non-Claude harness — it would sit there inert and do nothing.

### 7. Optional components (macOS, with permission)

The Pulse dashboard and background services install as macOS `launchd` jobs. Offer them. Skip cleanly on Linux/Windows, or if your human declines.

### 8. Run Setup, then Interview

Run the **Setup** workflow (`Workflows/Setup.md`) to finish integration and verify with real evidence, then the **Interview** workflow (`Workflows/Interview.md`): name the assistant, capture identity and TELOS (current state → ideal state), pull in any sources your human offers, and seed Pulse. By the end, the config tree is populated and Pulse shows real data.

---

## What you get on each setup (be honest about this)

| Harness / OS | Skill + USER data + Pulse | Always-on behavior (mode banner, memory loop, context injection) |
|---|---|---|
| **Claude Code — macOS / Linux** | ✅ | ✅ full (native hooks) |
| **Claude Code — Windows** | ✅ (copy fallback where symlinks need admin) | ✅ full |
| **Cursor / Cline / Codex / Gemini / other** | ✅ | ⚠️ context loads every session via `AGENTS.md`; workflows run on request; always-on hooks not wired yet (roadmap) |
| **Chat-only assistants (no files / no commands)** | ❌ | ❌ — install stops at the capability gate |

## Rules you must follow

- **Additive, never clobbering.** Only add what's missing; never overwrite or delete a populated dir or a file you didn't create.
- **Permission before every mutation.** Show the exact change; back up `settings.json` before editing it; wait for a yes.
- **Never write a harness's config that it won't read.** Honest degrade beats an inert install.
- **Refuse to run inside the LifeOS source repo** (detected via source-repo markers). Never mutate a maintainer's live system.
