---
name: Confirm
description: "Ask the user a yes/no (or small choice set) via inline-keyboard buttons on @<DA>_bot. USE WHEN you need approval before an irreversible step (deploy, drop, send, commit, merge), need triage from the user's phone for an alert, or want a yes/no gate in a long-running automation. Returns the user's tap."
disable-model-invocation: false
effort: low
---

# /confirm — Approval gate via Telegram inline keyboards

Send a question to the user with two or three buttons, return their tap. Built on the Pulse Telegram callback bridge (`PULSE/modules/telegram.ts` → `TOOLS/TelegramCallbacks.ts`).

## Invocation

```
/confirm "Continue with deploy?"
/confirm "Drop table users_old?" --buttons "Drop,Keep,Defer"
/confirm "Approve PR #482?" --timeout-ms 1800000
```

Or call directly:

```bash
bun run ~/.claude/skills/Confirm/Tools/Ask.ts "<question>" \
  [--buttons "Approve,Reject"] \
  [--timeout-ms 900000]
```

## What happens

1. Tool reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS` from `~/.claude/.env`.
2. Generates a UUID-namespaced `callback_data` for each button (`<action>:<uuid>`) so the predicate can't collide with other workflows.
3. Sends the message via Telegram Bot API with an inline keyboard.
4. Tails `~/.claude/PAI/PULSE/state/telegram/callbacks.jsonl` via `waitForCallback` until a press matches the UUID.
5. Edits the message to remove the keyboard (defends against double-tap).
6. Edits the text to show the chosen action.
7. Prints JSON to stdout: `{ "action": "approve", "data": "approve:abc-123", "fromId": ... }`.
8. Exits 0 on a tap, exit 2 on timeout.

## Returns

- `action` — the leading prefix of the chosen `callback_data` (`approve`, `reject`, etc.). Use this for your switch statement.
- `data` — the full `callback_data` string. Use this only if you need the UUID for audit trail.
- `fromId` — Telegram user id who tapped. Already passed Pulse's `allowedUsers` gate.

## Rules

- **Validate the action.** Use a switch with explicit cases — never pass `data` to a shell or eval. See `DOCUMENTATION/Notifications/TelegramCallbacks.md` security model.
- **Keep questions short.** Telegram clips long messages; the buttons are what matters.
- **Don't reuse buttons across calls.** UUIDs are per-invocation; each `/confirm` is independent.

See `Workflows/Ask.md` for the full request flow.
