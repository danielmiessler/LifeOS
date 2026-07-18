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

### 2.5 The install-location choice — default home or a custom directory

LifeOS normally installs into the harness's config root — right for a human who wants LifeOS in **every** session. But that makes LifeOS global: its `CLAUDE.md`, hooks, and settings load into *every* Claude Code session, including plain coding work. A human who also wants to use Claude Code **without** LifeOS should install it into a custom directory instead — LifeOS then loads only when launched against that root, and plain `claude` stays vanilla. The same mechanism gives you an **isolated second instance** (e.g. a project-scoped assistant in `~/MyProject/.claude`).

**Ask once.** If `LIFEOS_HOME` is not already set, offer your human the choice now, before anything is written:

> "Install LifeOS into the default location (`<configRoot from DetectEnv>`) so it's active in every session, or into a custom directory so you can keep using Claude Code without LifeOS and opt in per launch?"

Default answer → proceed unchanged; don't mention custom homes again. Custom answer → export the directory they name as `LIFEOS_HOME` for **every** subsequent step (and re-run `DetectEnv` to confirm the resolved `configRoot`/`configDir`). If `LIFEOS_HOME` is already set (e.g. by `install.sh --home`), skip the question and just confirm the target.

The override, settable up front instead:

```
export LIFEOS_HOME=~/MyProject/.claude        # or: bash install.sh --home ~/MyProject/.claude
```

What it changes, and what it doesn't:

- `LIFEOS_HOME` moves **only where LifeOS installs** (`configRoot`: `LIFEOS/`, `settings.json`, `hooks/`, `skills/`, `CLAUDE.md`). It is NOT `CLAUDE_CONFIG_DIR` — it doesn't relocate the harness's own config or disable merging with your global `~/.claude` at runtime.
- The private user-data home (`configDir`, symlink target of `<configRoot>/LIFEOS/USER`) follows the custom home to `<configRoot>/USER-data`, so two instances never share one USER tree. Override with `--config-dir` on `ScaffoldUser`/`LinkUser` if you want it elsewhere.
- The install tools retarget everything the harness reads literally — `settings.json` env values and permission globs, and every hook command — to the custom root. `DetectEnv` reports the resolved `configRoot`/`configDir`; verify the written `settings.json` contains no `~/.claude` references.

**The runtime half (don't skip):** installing into a custom home only places the files — the harness must also LOAD them. For Claude Code there are two ways:

1. **Project-scoped `.claude`** (recommended for a per-project assistant): install into `<project>/.claude` and launch Claude Code from `<project>` — it picks the directory's `.claude` up as project settings alongside your global config.
2. **Whole-config relocation:** launch with `CLAUDE_CONFIG_DIR=<configRoot> claude` — the harness then uses ONLY that config dir (no global merge). This is the right tool when the instance should be fully self-contained.

Wire the `lifeos` launch command (step 7) against the custom `<configRoot>` either way — that part is identical.

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

- **Claude Code** — run `bun Tools/InstallHooks.ts` (merges the hook set into `settings.json`, backing it up first) and `bun Tools/ActivateImports.ts` (turns on the identity context imports). This is what lights up the always-on behavior: the LifeOS response format, the memory loop, and per-turn context injection.

- **Any other harness (Cursor / Cline / Codex / Gemini / other)** — LifeOS's always-on behavior is enforced by Claude Code *hooks*, which are a Claude Code mechanism. They don't auto-wire on other harnesses **yet**. So instead:
  1. Write an `AGENTS.md` (or the harness's own context file — e.g. `.cursor/rules`) that points the harness at the LifeOS tree, so it loads the LifeOS context every session.
  2. Tell your human, plainly and honestly: *"On <harness>, the always-on hooks aren't wired yet. You get the skill, your USER data, Pulse, and context loading every session, and you run Setup and Interview on request. Full always-on behavior is on the roadmap for this harness."*
  3. **Do not** write Claude hook files or a Claude `settings.json` `hooks` block into a non-Claude harness — it would sit there inert and do nothing.

### 7. Wire the launch command — HOW LifeOS actually turns on (WITH PERMISSION)

This is the step that makes LifeOS *load*. The constitutional layer — the response format, verification doctrine, security protocol, the whole operating contract — lives in `install/LIFEOS/LIFEOS_SYSTEM_PROMPT.md` and is **NOT** loaded by a plain `claude` session. It loads only when the harness is launched with that file appended to its system prompt. So installed LifeOS needs its own launch command; running vanilla `claude` gives you CLAUDE.md but **not** the constitution.

The payload ships the launcher — `install/LIFEOS/TOOLS/lifeos.ts` — which spawns Claude with `--append-system-prompt-file <configRoot>/LIFEOS/LIFEOS_SYSTEM_PROMPT.md` (plus the banner and MCP-profile handling). Wire a `lifeos` command that calls it into your human's shell. **Show the exact line, back up the rc file first, wait for a yes.** Use the real `<configRoot>` from `DetectEnv` (e.g. `~/.claude`) — never hardcode a home path.

- **Claude Code (zsh / bash)** — append to `~/.zshrc` (or `~/.bashrc`):
  ```
  alias lifeos='bun <configRoot>/LIFEOS/TOOLS/lifeos.ts -s <configRoot>/LIFEOS/LIFEOS_SYSTEM_PROMPT.md'
  ```
  fish: `alias lifeos "bun <configRoot>/LIFEOS/TOOLS/lifeos.ts -s <configRoot>/LIFEOS/LIFEOS_SYSTEM_PROMPT.md"; funcsave lifeos`. After this, **`lifeos` launches Claude WITH the constitution**; plain `claude` stays vanilla (which is fine — the user opts in by launching `lifeos`).

- **Any other harness** — use that harness's own system-prompt flag against the same file. e.g. pi: `pi --append-system-prompt <configRoot>/LIFEOS/LIFEOS_SYSTEM_PROMPT.md`. If a harness has no system-prompt flag, load `LIFEOS_SYSTEM_PROMPT.md` through its context file (AGENTS.md / rules) as the closest equivalent, and tell your human plainly that the constitution is loading as context, not as a true system-prompt layer.

If your human declines the shell edit, give them the one-line launch command to run by hand so the constitution still loads:
```
bun <configRoot>/LIFEOS/TOOLS/lifeos.ts -s <configRoot>/LIFEOS/LIFEOS_SYSTEM_PROMPT.md
```

### 8. Choose the components — install all, or pick a subset (WITH PERMISSION)

LifeOS installs in **two layers**, and you present them that way.

**Core** (steps 4–7, always together) IS LifeOS: the skill + the full **skill library** + the LIFEOS runtime (Algorithm, docs, tools, statusline binary, version) + the USER tree + the system prompt and its `lifeos` launch command. One consent installs all of Core; declining means not installing LifeOS.

**Enhancements** are **à la carte** — offer them and let your human pick some, all, or none. Each is independently installed, idempotent, and reversible:

| Component | What it adds | Default |
|---|---|---|
| **hooks** | skill routing, the memory loop, voice, per-turn context injection — most behavior needs these (this is step 6) | **recommended** |
| **statusline** | the LifeOS status line in your prompt — set `preferences.temperatureUnit` in `settings.json` to match your human's locale (payload default is `celsius`; suggest `fahrenheit` for US locales/timezones) | optional |
| **tooltips** | custom Claude Code spinner tips | optional |
| **spinner verbs** | custom spinner verbs | optional |
| **agents** | the named agent library | optional |
| **Pulse** | the Life Dashboard — menu-bar app + `launchd` service on `:31337` | optional |
| **worksweep / derivedsync** | background `launchd` jobs (work capture, derived-file sync) | optional |

The `launchd` components (Pulse, worksweep, derivedsync) are macOS-only — skip them cleanly on Linux/Windows. Show your human this menu, take their picks, and deploy only those. The **Setup** workflow (step 9) drives the actual deployment of the chosen set and verifies each with real evidence (e.g. Pulse → `curl :31337/healthz` = 200). Everything ships in the payload; nothing activates without its matching yes.

### 8.5 Capability check — probe what doctrine assumes (Doctor)

LifeOS doctrine leans on a few **external tools** the core install does not ship: a cross-vendor audit CLI (`codex`), a real browser for web verification (Interceptor), Cloudflare/wrangler for scheduled cloud flows, ElevenLabs for voice. Nothing above installed them, and the features that depend on them must degrade *loudly*, not silently. After Core lands, run the doctor:

```
bun <configRoot>/LIFEOS/TOOLS/Doctor.ts
```

It prints one line per capability — live ✅, broken ❌ (each with its own copy-paste fix command), or off ⏸ — and writes an advisory manifest the runtime uses to flag degraded output. Then ask your human, per broken capability: **set it up now, later, or never?**

- **Now** → run the fix command shown, re-run Doctor. With their permission, add `--network` to verify auth end-to-end — network probes only ever touch capabilities they have already configured.
- **Later** → leave it. The runtime will surface it the moment a degraded capability is actually invoked, fix command included.
- **Never** → `bun <configRoot>/LIFEOS/TOOLS/Doctor.ts decline <name>`. Declined is a clean, permanent, silent OFF — no warnings, no red marks, no nagging, ever. Declining is a legitimate way to run LifeOS, not a defect.

Deeper walkthroughs per tool (what it's for, install, auth, verify it's live): `GETTING-STARTED.md`, shipped next to this file. Your human can re-run the doctor any time something feels off: `lifeos doctor` territory — it's the same command.

### 9. Run Setup, then Interview

Run the **Setup** workflow (`Workflows/Setup.md`) to finish integration and verify with real evidence, then the **Interview** workflow (`Workflows/Interview.md`): name the assistant, capture identity and TELOS (current state → ideal state), pull in any sources your human offers, and seed Pulse. By the end, the config tree is populated and Pulse shows real data.

---

## What you get on each setup (be honest about this)

| Harness / OS | Skill + USER data + Pulse | Always-on behavior (response format, memory loop, context injection) |
|---|---|---|
| **Claude Code — macOS / Linux** | ✅ | ✅ full (native hooks) |
| **Claude Code — Windows** | ✅ (copy fallback where symlinks need admin) | ✅ full |
| **Cursor / Cline / Codex / Gemini / other** | ✅ | ⚠️ context loads every session via `AGENTS.md`; workflows run on request; always-on hooks not wired yet (roadmap) |
| **Chat-only assistants (no files / no commands)** | ❌ | ❌ — install stops at the capability gate |

Full-doctrine features additionally depend on the external tools in step 8.5 (codex, browser, Cloudflare, ElevenLabs). Without one, the dependent feature runs degraded **and says so** — it never silently pretends. The Doctor table is the live source of truth for what's on.

## Rules you must follow

- **Additive, never clobbering.** Only add what's missing; never overwrite or delete a populated dir or a file you didn't create.
- **Permission before every mutation.** Show the exact change; back up `settings.json` before editing it; wait for a yes.
- **Never write a harness's config that it won't read.** Honest degrade beats an inert install.
- **The launch command loads the constitution — don't skip it.** A plain `claude` session gets CLAUDE.md but not `LIFEOS_SYSTEM_PROMPT.md`. The `lifeos` command (step 7), or the harness's system-prompt flag, is what turns the operating contract on. Wire it, or the install is missing its whole constitutional layer.
- **Refuse to run inside the LifeOS source repo** (detected via source-repo markers). Never mutate a maintainer's live system.
