# PAI Installer v5.0

> Install [PAI (Personal AI Infrastructure)](https://github.com/danielmiessler/PAI) with a single command.

## Quick Start

```bash
bash PAI-Install/install.sh
```

That's it. The script handles everything:

1. Detects your operating system and installed tools
2. Installs **Bun** and **Git** if missing
3. Launches a guided Web UI installer
4. Walks you through identity, voice, and configuration
5. Validates the installation before finishing

### Requirements

- **bash** and **curl** — that's all you need to start
- macOS or Linux
- Internet connection

The installer can install Bun and Git. For Claude installs it can also install Claude Code; Codex installs expect Codex to already be available on the host.

---

## Installation Steps

The installer runs 8 steps in dependency order:

| # | Step | What It Does |
|---|------|-------------|
| 1 | **System Detection** | Detects OS, architecture, shell, installed tools (Bun, Git, Claude Code or Codex), timezone, and any existing PAI installation |
| 2 | **Prerequisites** | Installs missing tools: Git via Xcode CLT or package manager, Bun via official installer, and Claude Code when the Claude harness is selected |
| 3 | **API Keys** | Auto-completes — key collection happens during the Voice step |
| 4 | **Identity** | Prompts for your name, AI assistant name, timezone, and a personal catchphrase |
| 5 | **PAI Repository** | Installs the PAI core to `~/.pai/` by default, with harness files in `~/.claude/` or `~/.codex/` |
| 6 | **Configuration** | Generates PAI runtime config, harness-native config, `.env`, directory structure, `pai` shell alias, and patches version files |
| 7 | **DA Voice + Pulse** | Collects ElevenLabs API key, selects voice type (Female/Male/Custom), prompts to install Pulse (voice + Life Dashboard + observability on port 31337) and the Pulse menu bar app via launchd |
| 8 | **Validation** | Verifies directory structure, settings file, API keys, Pulse health on 31337, launchd plist, shell alias — reports pass/fail for each |

### Voice + Pulse Setup

The voice step handles Digital Assistant voice configuration **and** Pulse install in one cohesive step:

1. Collects or auto-discovers your ElevenLabs API key (checks `~/.pai/.env` and the selected harness `.env`; older PAI config can be imported only when you approve prior-config import)
2. Validates the key against the ElevenLabs API
3. **Asks (Y/n) to install Pulse** as a launchd service — Pulse is the unified PAI runtime that serves the Life Dashboard at `http://localhost:31337`, handles voice notifications (TTS via ElevenLabs), and runs observability + scheduled jobs. Installing as a launchd agent makes it auto-start on login.
4. Presents voice selection: **Female** (Rachel), **Male** (Adam), or **Custom Voice ID** with audio previews
5. **Asks (Y/n) to install the Pulse menu bar app** — adds a status icon to your macOS menu bar, second launchd plist, auto-starts on login
6. Tests TTS via Pulse with a personalized greeting using your name and AI name

In PAI 5.0 the standalone voice server was absorbed into Pulse: there is no separate process — Pulse on port 31337 embeds the voice module, the Life Dashboard, observability, and scheduled jobs in one launchd-managed runtime.

Voice + Pulse are optional. Skip the ElevenLabs key and the installer continues without voice. Skip the Pulse install and you can run it later: `bash ~/.pai/PULSE/manage.sh install`.

### Graceful Degradation

The installer is designed to recover from partial failures:

- No ElevenLabs key → voice features skipped, Pulse can still install for dashboard + observability
- No existing PAI → fresh install (vs. upgrade if detected)
- Pulse install declined or fails → configuration saved, voice notifications unavailable until Pulse is installed manually
- Menu bar install declined or fails → Pulse keeps running; menu bar can be installed later
- Claude Code not installed during a Claude install -> attempts installation, continues if it fails
- Codex not installed during a Codex install -> continues with PAI files installed; install or sign in to Codex before using the Codex harness
- Port conflicts → installer port configurable via `PAI_INSTALL_PORT` environment variable

---

## Architecture

### Two-Layer Design

1. **Bootstrap** (`install.sh`) — Pure bash. Only needs bash + curl. Installs Bun and Git, then hands off to the TypeScript installer.
2. **Engine + UI** (`engine/` + `web/` + `public/`) — TypeScript (Bun). All install logic, web server, and frontend.

### Launch Modes

The installer supports three modes via `main.ts`:

| Mode | Command | Description |
|------|---------|-------------|
| **GUI** (default) | `--mode gui` | Launches Electron window wrapping the web server. Audio autoplay works. This is what `install.sh` uses. |
| **Web** | `--mode web` | Starts the Bun HTTP/WebSocket server on port 1337. Open in any browser. |
| **CLI** | `--mode cli` | Terminal-only wizard with ANSI colors and progress bars. No browser needed. |

GUI mode auto-installs Electron dependencies on first run and clears macOS quarantine flags.

### Directory Structure

```
PAI-Install/
├── install.sh              # Bash bootstrap entry point
├── main.ts                 # Mode router (gui/web/cli)
├── generate-welcome.ts     # Welcome audio generator (build-time)
│
├── engine/                 # Core install logic (shared across all modes)
│   ├── types.ts            # TypeScript interfaces (InstallState, messages, events)
│   ├── detect.ts           # System detection (OS, tools, existing install)
│   ├── steps.ts            # Step definitions + dependency graph
│   ├── actions.ts          # Install action functions (clone, configure, voice, etc.)
│   ├── config-gen.ts       # Fallback settings.json generator
│   ├── validate.ts         # Post-install validation checks
│   ├── state.ts            # State persistence (resume interrupted installs)
│   └── index.ts            # Re-exports
│
├── web/                    # Web server (GUI and Web modes)
│   ├── server.ts           # Bun HTTP + WebSocket server (port 1337)
│   └── routes.ts           # WebSocket message handler + install orchestrator
│
├── cli/                    # CLI frontend
│   ├── index.ts            # CLI entry point
│   └── display.ts          # ANSI colors, progress bars, banners
│
├── public/                 # Static web assets
│   ├── index.html          # Single-page application shell
│   ├── styles.css          # Dark theme with glassmorphic effects
│   ├── app.js              # Frontend JavaScript (WebSocket client, UI rendering)
│   └── assets/             # Logos, fonts, welcome audio, voice previews
│
├── electron/               # Electron native wrapper
│   ├── main.js             # Spawns Bun server + opens BrowserWindow
│   └── package.json        # Electron dependency
│
└── README.md               # This file
```

---

## WebSocket Protocol

The Web UI communicates with the install engine over WebSocket. The server runs on `ws://localhost:1337/ws`.

### Client → Server

| Type | Payload | Description |
|------|---------|-------------|
| `client_ready` | — | Client connected and ready |
| `start_install` | — | User clicked "Begin Installation" |
| `user_input` | `{ requestId, value }` | Response to a text/password input prompt |
| `user_choice` | `{ requestId, value }` | Response to a multiple-choice prompt |

### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `connected` | — | Connection acknowledged |
| `step_update` | `{ step, status }` | Step status changed (pending/active/completed/skipped/failed) |
| `detection_result` | `{ data }` | System detection results (OS, tools, existing install) |
| `message` | `{ role, content, speak? }` | Chat message (assistant/system/error) |
| `input_request` | `{ id, prompt, inputType, placeholder }` | Request text/password input from user |
| `choice_request` | `{ id, prompt, choices[] }` | Request selection from options |
| `progress` | `{ step, percent, detail }` | Progress bar update for long operations |
| `validation_result` | `{ checks[] }` | Array of validation check results |
| `install_complete` | `{ summary }` | Installation finished with summary data |
| `error` | `{ message }` | Error message |

Messages include a `replayed` flag for reconnect replay — replayed messages skip animations and TTS.

### Message Flow Example

```
Client                          Server
  │                               │
  ├── client_ready ──────────────→│
  │←─────────────── connected ────┤
  │                               │
  ├── start_install ─────────────→│
  │←──────────── step_update ─────┤  (system-detect → active)
  │←──────── detection_result ────┤  (OS, tools, etc.)
  │←──────────── step_update ─────┤  (system-detect → completed)
  │                               │
  │←──────── input_request ───────┤  ("What is your name?")
  ├── user_input ────────────────→│
  │←──────────── message ─────────┤  ("Welcome, {{PRINCIPAL_NAME}}!")
  │                               │
  │←──────── choice_request ──────┤  ("Select voice type")
  ├── user_choice ───────────────→│
  │←──────────── progress ────────┤  (voice server install: 40%)
  │←──────────── step_update ─────┤  (voice → completed)
  │                               │
  │←──── validation_result ───────┤  (all checks)
  │←──── install_complete ────────┤  (summary card)
```

---

## Configuration

### Settings Merge Strategy

PAI ships a complete `settings.json` template in the release repository. For Codex installs this remains PAI runtime configuration under `PAI_DIR`; Codex-native configuration is generated separately. The template includes:

- **Hooks** — 20+ event hooks for session management, security, voice, etc.
- **Status line** — Terminal status bar configuration
- **Spinner verbs** — Activity indicator messages
- **Context files** — Files loaded into the selected harness context

The installer **does NOT generate hooks or status line config**. Instead, it:

1. Installs the PAI repository or bundled release (which includes the full `settings.json` template)
2. Merges only user-specific fields into the existing template:
   - `principal` — user name, timezone
   - `daidentity` — AI name, voice ID, personality
   - `env` — PAI_DIR, PROJECTS_DIR
   - `pai` — version info
3. Preserves all hooks, status line, spinner verbs, and context files from the template

This ensures fresh installs get the full PAI configuration without the installer needing to know about every hook.

### Generated Files

| File | Location | Contents |
|------|----------|----------|
| `settings.json` | Claude: `~/.claude/settings.json`; Codex: `~/.pai/settings.json` | Merged PAI runtime config (template + user fields) |
| Codex native config | `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.codex/AGENTS.md` | Codex feature flags, hooks, and startup instructions |
| `.env` | `~/.pai/.env`, linked from the selected harness `.env` | `ELEVENLABS_API_KEY=...` |
| `LATEST` | `~/.pai/ALGORITHM/LATEST` | Algorithm version (patched to current) |
| Shell alias | `~/.zshrc` | `pai` runs `~/.pai/TOOLS/pai.ts` with the selected harness environment |

### Directory Structure Created

```
~/.pai/
├── settings.json
├── ALGORITHM/
├── MEMORY/
├── PULSE/
├── TOOLS/
├── USER/
└── TELIOS/

~/.claude/ or ~/.codex/
├── PAI -> ~/.pai
├── hooks/
├── skills/
└── harness-native config files
```

### Banner and Counts

On first launch after installation, the PAI banner displays system statistics (skills, hooks, workflows, signals, files). These counts are:

1. **Calculated by the installer** during the Configuration step (initial values)
2. **Updated by the StopOrchestrator hook** at the end of each selected harness session

The Algorithm version displayed in the banner reads from `PAI/Algorithm/LATEST`.

---

## Web UI Features

- **Electron wrapper** — Opens in a controlled 1280x820 window with audio autoplay enabled
- **Dark theme** — Deep navy/black with PAI blue accents and glassmorphic card effects
- **Step sidebar** — All 8 steps with live status indicators (pending/active/completed/skipped/failed)
- **Progress bar** — Header shows overall completion percentage
- **Voice previews** — Listen to Female/Male voice samples before selecting
- **Welcome audio** — Pre-recorded MP3 plays on launch
- **Auto-reconnect** — WebSocket reconnects on disconnect with 2-second retry and full message replay
- **Input masking** — API keys are masked in the chat display (shows first 8 chars only)
- **Choice buttons** — Styled selection cards with descriptions and optional audio previews

---

## Post-Installation

After the installer completes, open a terminal and run:

```bash
source ~/.zshrc && pai
```

This reloads your shell config (activates the `pai` alias) and launches PAI for the first time.

### First-run: populate your personal context

Once PAI is running, kick off the phased interview to populate your TELOS, identity, preferences, and life dimensions:

```
/interview
```

The interview is conversational and resumable. It runs in 4 phases:

1. **Phase 1 — Foundational TELOS:** Mission, Goals, Problems, Strategies, Challenges, Narratives, Beliefs, Wisdom, Models, Frames
2. **Phase 2 — IDEAL_STATE:** Health, Money, Freedom, Relationships, Creative
3. **Phase 3 — Preferences:** Books, Authors, Bands, Movies, Restaurants, Food, Learning, Civic
4. **Phase 4 — Identity:** Light review of PRINCIPAL_IDENTITY and current state

Each section is skippable. If you have existing data (Obsidian, Notion, journals, prior PAI install), bring it in via the `Migrate` skill **before** running `/interview` — it intakes external content, classifies chunks against the PAI taxonomy, and writes them into the right files with provenance, so the interview only fills the genuine gaps.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `bun: command not found` | Run `curl -fsSL https://bun.sh/install \| bash` then restart terminal |
| Port 1337 in use | Set `PAI_INSTALL_PORT=8080` before running install.sh |
| ElevenLabs key invalid | Verify at elevenlabs.io — ensure no trailing spaces, key starts with `xi-` or `sk_` |
| Permission denied | Run `chmod -R 755 ~/.pai` and check selected harness permissions |
| `pai` command not found | Run `source ~/.zshrc` to reload shell config |
| Pulse / voice notifications not working | Check port 31337 is free: `lsof -ti:31337`. Restart Pulse: `bash ~/.pai/PULSE/manage.sh restart`. Check status: `bash ~/.pai/PULSE/manage.sh status`. |
| Pulse menu bar icon missing | Install or reinstall: `bash ~/.pai/PULSE/MenuBar/install.sh`. Verify launchd plist: `ls ~/Library/LaunchAgents/com.pai.pulse-menubar.plist`. |
| Banner shows wrong algorithm version | Check `~/.pai/ALGORITHM/LATEST` contains correct version |
| Banner counts all show 0 | Normal on first launch — counts populate after your first selected harness session ends |
| WebSocket "Connection lost" | The installer auto-reconnects. If persistent, check if another process is using port 1337 |
| Electron window blank | Try `--mode web` instead and open `http://localhost:1337` in your browser |

### Recovery

The installer saves state to disk. If interrupted, re-run `install.sh` — it will detect the existing installation and offer to resume or start fresh.

---

## Development

### Running Locally

```bash
# Web mode (development)
bun run PAI-Install/main.ts --mode web

# CLI mode
bun run PAI-Install/main.ts --mode cli

# GUI mode (Electron — installs deps on first run)
bun run PAI-Install/main.ts --mode gui
```

### Key Design Decisions

- **No framework dependencies** — Frontend is vanilla JavaScript. No React, no build step.
- **Bun-native server** — Uses `Bun.serve()` for HTTP and WebSocket in one process.
- **Async Pulse install** — Pulse install via `manage.sh install` uses async `spawn` (not `execSync`) to avoid blocking the event loop and killing WebSocket connections. PAI 5.0 absorbed the standalone voice server into Pulse on port 31337 — there is no separate voice-server process.
- **Safe process cleanup** — Port cleanup uses `lsof -sTCP:LISTEN` to kill only the listening process, not client connections.
- **Template-based settings** — Installer merges user fields into the release template rather than generating a complete settings.json from scratch.

---

## Known Limitations

- **macOS and Linux only** — Windows is not supported
- **Internet connection required** — Downloads tools, clones repository, validates API keys
- **Voice requires ElevenLabs** — Voice synthesis is optional but needs an ElevenLabs API key
- **Single-user** — Installs to `~/.pai/` and the selected harness home for the current user only
- **Electron optional** — If Electron fails to install, use `--mode web` as fallback

## License

Part of [PAI — Personal AI Infrastructure](https://github.com/danielmiessler/PAI).
