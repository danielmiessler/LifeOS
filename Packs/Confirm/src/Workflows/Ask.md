# Ask — round-trip a yes/no via @<DA>_bot

The single workflow this skill exposes.

## Inputs

- `question` (required, string) — what to ask. Keep it short.
- `buttons` (optional, comma-list) — choice labels. Default: `Approve,Reject,Defer`.
- `timeoutMs` (optional, number) — how long to wait for a tap. Default: 15 minutes (`900000`).

## Output

JSON to stdout:

```json
{
  "action": "approve",
  "data": "approve:c1f2e3a4-...",
  "fromId": 85664591,
  "timestamp": 1730819400123
}
```

Exit codes:
- `0` — user tapped a button.
- `2` — timeout (no tap within `timeoutMs`).
- `1` — error (missing env, network failure, etc).

## How it works

1. Read `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS` from `~/.claude/.env`. First user id is the destination chat.
2. Generate a UUID. Build `callback_data` per button as `<labelLower>:<uuid>`. (e.g. `approve:c1f2-3a4b`).
3. POST `sendMessage` with `reply_markup.inline_keyboard`.
4. Save returned `message_id`.
5. `waitForCallback` with a predicate that matches `endsWith(":" + uuid)`. Returns either the matched entry or null on timeout.
6. On match: POST `editMessageText` to update the message body to `"<question>\n\n→ <action> tapped"`, with `reply_markup: { inline_keyboard: [] }` to remove the buttons.
7. On timeout: POST `editMessageText` to `"<question>\n\n⏱ Timeout — no response."` and exit 2.

## Caller-side patterns

```bash
# Deploy gate
RESULT=$(bun run ~/.claude/skills/Confirm/Tools/Ask.ts "Promote staging→prod?")
ACTION=$(echo "$RESULT" | jq -r .action)
case "$ACTION" in
  approve) ./bin/deploy prod ;;
  reject)  echo "Rejected." ;;
  defer)   echo "Defer — will re-ask in 1h." ;;
esac
```

```ts
// TypeScript caller
import { spawn } from "child_process";
const { stdout } = await Bun.spawn([
  "bun", "run", "~/.claude/skills/Confirm/Tools/Ask.ts",
  "Drop migrations 0001_init?", "--buttons", "Drop,Keep",
]).then((p) => p.exited.then(() => p));
const { action } = JSON.parse(stdout.toString());
```

## When NOT to use

- For high-frequency events (every CI run, every alert). Telegram rate-limits and you'll burn the user's attention budget.
- For confirmations that should block on a desktop UI dialog instead.
- For multi-step interactive flows (this is yes/no, not a chat).
