# PAI v5.0 — Configuration & Deployment

## CD-01: Config Sources [HIGH]
Configuration is loaded from multiple sources with the following precedence (highest wins):

1. **Environment variables** — runtime overrides for secrets and port bindings
2. **PULSE.toml** — structured config for the Pulse daemon
3. **.env file** — secrets (API keys, tokens) never checked into version control
4. **PAI/USER/** — user identity, DA identity, pronunciation rules
5. **ALGORITHM/v6.3.0.md** — Algorithm specification
6. **SKILL.md files** — per-skill configuration
7. **USER/SKILLCUSTOMIZATIONS/<Skill>/** — user skill overrides

## CD-02: Essential Environment Variables [HIGH]
| Variable | Purpose | Required? |
|----------|---------|-----------|
| ANTHROPIC_API_KEY | Primary AI provider key | Yes (for Anthropic provider) |
| ELEVENLABS_API_KEY | Voice TTS | No (voice falls back to desktop notifications) |
| TELEGRAM_BOT_TOKEN | Telegram integration | No |
| OPENAI_API_KEY | Secondary provider (cross-vendor audit) | No |
| PULSE_PORT | Dashboard port override (default: 31337) | No |
| PAI_PULSE_BIND_ALL | Bind to 0.0.0.0 (default: 127.0.0.1) | No |

## CD-03: File System Layout [HIGH]
```
~/.claude/                      # Root of the PAI installation
├── CLAUDE.md                   # Master context / system prompt
├── install.sh                  # Installation script
├── PAI/
│   ├── ALGORITHM/              # Algorithm specification (v6.3.0)
│   ├── bin/                    # CLI tools
│   ├── DOCUMENTATION/          # System documentation
│   ├── MEMORY/                 # Memory system (see DM-02)
│   ├── PAI-Install/            # Installation assets
│   ├── PAI_SYSTEM_PROMPT.md    # Constitutional layer (highest priority)
│   ├── PULSE/                  # Life Dashboard daemon
│   ├── TEMPLATES/              # Templates
│   ├── TOOLS/                  # Utility scripts
│   └── USER/                   # User and DA identity
│       ├── PRINCIPAL_IDENTITY.md
│       ├── DA_IDENTITY.md
│       ├── TELOS/
│       ├── pronunciations.json
│       └── SKILLCUSTOMIZATIONS/
├── agents/                     # Agent definitions (18+)
├── commands/                   # Slash command definitions
├── hooks/                      # 37+ lifecycle hooks
├── skills/                     # 45+ skills
└── test-results/               # Test output
```

## CD-04: Pulse Daemon Process Layout [HIGH]
```
Single process — single threaded, async I/O
├── HTTP server (Bun.serve, port 31337)
├── Signal handlers (SIGTERM → graceful shutdown, SIGINT → graceful shutdown)
├── Module loader (lazy, conditional on config)
│   ├── Voice server
│   ├── Hook server (skill-guard, agent-guard endpoints)
│   ├── Wiki module
│   ├── Observability (Next.js static app + API routes)
│   ├── Performance module
│   ├── Telegram module (grammY polling)
│   ├── iMessage module (SQLite polling)
│   ├── Syslog module (UDP listener)
│   └── Assistant (DA) module
├── Cron heartbeat loop (async, continuous)
└── Supervisor (restarts crashed subsystems)
```

## CD-05: Installation Requirements [HIGH]
| Resource | Requirement |
|----------|-------------|
| Runtime | Bun (JavaScript runtime) |
| AI Provider | Anthropic Claude (primary), others optional |
| Voice | ElevenLabs API key (optional) |
| Storage | ~100MB for the PAI installation itself |
| Memory | Varies by AI model provider usage |
| Network | Internet access for API calls |
| Dashboard | Modern web browser (for Pulse dashboard) |

## CD-06: Platform Compatibility [HIGH]
| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ Primary | launchd, afplay, osascript, Messages chat.db |
| Linux | ✅ Supported | systemd user service, ALSA/PulseAudio, community-maintained |
| Windows | ❌ Unsupported | No plans for Windows support |

## CD-07: Security Model [HIGH]
- **Containment zones** — Filesystem partition into 6 zones (Z1-Z6) with cross-zone write enforcement
- **Secret handling** — API keys stripped from environment before subprocess/sdk operations
- **Release gates** — 12+ automated security checks on every public release artifact
- **Two-stage release** — Stage → Human Review → Publish (never auto-chain)
- **Input sanitization** — Voice notification inputs stripped of shell metacharacters, script tags, path traversal
- **Message authentication** — Telegram/iMessage sender whitelist, unauthorized messages silently dropped

## CD-08: Self-Healing [LOW]
- **PID file** — Written at startup for process management
- **launchd/systemd keep-alive** — Process auto-restarts on crash (30s throttle)
- **State persistence** — Atomic writes (tmp + rename) prevent corruption
- **Session cache** — Rolling window of last 40 messages persisted
- **Observability-driven** — Tool failures, cost spikes, and hook errors are logged and surfaced on the dashboard
