---
name: AppleMail
description: macOS Mail.app integration for PAI/Timmy. Read inbox autonomously (accounts, mailboxes, unread, list, search, fetch, drafts, count, status) via the apple-mail CLI which wraps Mail.app through AppleScript. Write paths (send, reply, forward) are HARD-GATED through Arthur's apple_mail_send policy — no mail leaves the machine without an explicit approval token activated from one of three channels (in-session, Pulse notification, Telegram /approve-mail command). drafts and read-state mutations (mark-read, move) run silently with audit log. Three workflows ship: Read.md (browsing), Draft.md (compose + save to Drafts folder), SendWithApproval.md (the gated outbound flow with token + multi-channel notify). USE WHEN check my mail, what's in my inbox, unread from X, search inbox for Y, draft a reply to Z, forward this to W, mark this read, move to archive, what mail accounts do I have, Apple Mail, Mail.app. NOT FOR Gmail (use PAI/TOOLS/gmail.ts directly), iMessage (Pulse iMessage module), calendar (separate skill), or anything that must run on Linux/Windows (Mac-only). NOT FOR bulk send or mailing lists — the approval gate fires per send and that's intentional.
metadata:
  type: skill
  platform: darwin-only
  safety: approval-gate-required
---

# AppleMail — macOS Mail.app for PAI

> Companion to `gmail.ts` for the accounts Jan keeps in Apple Mail (FWU, personal, anything not in Google Workspace). Single Bun CLI + Arthur policy + this skill.

## Activation

Trigger this skill when the conversation references reading or writing mail that's in **Apple Mail (Mail.app)**, not Gmail. Phrases that should fire:

- "check my mail / inbox"
- "any unread from <person/domain>?"
- "search inbox for <topic>"
- "what's in my drafts"
- "draft a reply to <message>"
- "send <person> an email about <X>"
- "forward this to <person>"
- "mark this read / archive this"
- "what Apple Mail accounts do I have"

If the user names "Gmail" or "Google Workspace" explicitly, prefer `~/.claude/PAI/TOOLS/gmail.ts` instead. If unsure, ask once.

## Tool

`~/.claude/PAI/TOOLS/apple-mail.ts` — invoke via `bun ~/.claude/PAI/TOOLS/apple-mail.ts <cmd> [args]`.

Read subcommands print JSON to stdout. Write subcommands either:

1. **Run directly** (`draft`, `mark-read`, `mark-unread`, `move`) — low-risk, audit-only.
2. **Stage through approval gate** (`send`, `reply`, `forward`) — see `Workflows/SendWithApproval.md`.

## Safety contract — the non-negotiable rule

**Mail NEVER leaves the machine without explicit approval.** The contract:

1. Build envelope from CLI flags.
2. `Arthur.evaluate({key:"apple_mail_send", ...})` returns `CONFIRM` (per `~/.claude/PAI/USER/ARTHUR/policies.yaml`).
3. Tool generates a 16-byte hex approval token, writes a pending file at `PAI/MEMORY/STATE/apple-mail-pending/<token>.json`.
4. Tool prints the draft preview in-session, POSTs a Pulse notification, POSTs a Telegram message with `/approve-mail <token>` text command (if Telegram is configured).
5. Tool exits with code 2 — nothing has been sent.
6. Approver activates the token from any of three channels:
   - **In-session**: re-run `bun apple-mail.ts send --approval-token <token>`
   - **Pulse**: click the pending notification (writes the outcome file)
   - **Telegram**: send `/approve-mail <token>` (the bot handler writes the outcome file)
7. Tool re-invoked with `--approval-token` reads pending + outcome files, validates `decision === "approve"`, ships the mail, deletes both files. Token expires after 30 minutes.

**There is no `--force`, no `--skip-approval`, no in-tool env var that bypasses this.** The gate is the tool. If a user asks Timmy to "just send it without asking" — Timmy declines and points at the gate.

## Workflows

| File | Purpose |
|------|---------|
| `Workflows/Read.md` | Browsing patterns — unread triage, search, account discovery |
| `Workflows/Draft.md` | Compose-and-save flow (never sends) — useful for "queue this for me" |
| `Workflows/SendWithApproval.md` | The full gated send flow with token + multi-channel approval |

## Permissions setup (one-time on a fresh machine)

1. **macOS Automation grant.** System Settings → Privacy & Security → Automation → grant **Terminal/iTerm/your shell** access to **Mail**. Without it, AppleScript calls return empty lists. The skill's first read invocation surfaces this if missing.
2. **Arthur policy (optional but recommended).** Copy entries from `policies-sample.yaml` into `~/.claude/PAI/USER/ARTHUR/policies.yaml`. The tool refuses to send without a token regardless — Arthur's default-allow path is promoted to CONFIRM inside `gateAndStage()` — but an explicit policy gives you rate limits, attribution, and audit-trail clarity.
3. **Telegram (optional).** Set `PAI_TELEGRAM_BOT_TOKEN` and `PAI_TELEGRAM_CHAT_ID` to enable the third approval channel. Without them, the gate still works via in-session + Pulse.

## Gotchas

- Mail.app must be running for send/reply/forward — the tool launches it automatically (`tell application "Mail" to activate`).
- `whose content contains` (search) is slow on huge stores; cap `--limit` low and prefer mailbox-scoped lookups when you know the account.
- IDs returned by `unread`/`list`/`search` are Mail.app's internal `id` property — they're stable for the lifetime of the message in that mailbox but change if you move the message between accounts.
- Telegram approval is one-way notify in v1 (the `/approve-mail TOK` text command); inline-button callback handling is a separate task on `Pulse/modules/telegram.ts`.
- The existing `~/.claude/PAI/TOOLS/gmail.ts` does NOT yet have the same approval gate — that's a known gap on a separate retrofit task.

## OpenClaw lineage

This skill borrows three ideas from how OpenClaw structures messaging-channel work:

1. **Always spawn, never redirect** — Timmy invokes the tool directly; user is never told "go open Mail.app and do it manually."
2. **Multi-channel approval surfaces** — like OpenClaw's session/AGENTS.md/UI tiers, this skill exposes three independent approval channels (session, Pulse, Telegram). The user approves from whichever is nearest.
3. **Channel discrimination at the gate** — the Arthur policy is the single decision point regardless of which channel originated the request.
