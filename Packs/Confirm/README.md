---
name: Confirm
pack-id: pai-confirm-v1.0.0
version: 1.0.0
author: danielmiessler
description: Ask the user a yes/no via inline-keyboard buttons on @<DA>_bot, return their tap. Generic approval gate any worker can call.
type: skill
platform: claude-code
source: PAI v5.0.0
---

# Confirm

Ask the user a yes/no (or any small set of choices) via inline-keyboard buttons on `@<DA>_bot`. Returns the user's tap.

Built on the Pulse Telegram callback bridge (`PULSE/modules/telegram.ts` → `TOOLS/TelegramCallbacks.ts`). Useful as an approval gate before any irreversible step: "deploy now? approve / reject / defer". Works from anywhere — cron jobs, batch scripts, slash commands, long-running agents.

## Installation

This pack is designed for AI-assisted installation. Point your AI at this directory and ask it to install using `INSTALL.md`.

```
"Install the Confirm pack from PAI/Packs/Confirm/"
```

Your AI walks through a 5-phase wizard: system analysis, user questions, backup, installation, verification.

## What's Included

```
  SKILL.md
  Workflows/
    Ask.md
  Tools/
    Ask.ts
```

## Prerequisites

- Pulse Telegram daemon running with the callback bridge (PAI v5.0.0+).
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS` set in `~/.claude/.env`.
- `PAI/TOOLS/TelegramCallbacks.ts` available (ships with PAI v5.0.0+).

## What it solves

Any automation that needs human approval before an irreversible step. Without a primitive like this, every worker reinvents Telegram send/receive plumbing.
