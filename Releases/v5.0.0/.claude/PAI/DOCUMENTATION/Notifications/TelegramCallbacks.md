# Telegram Callback Bridge

**Inline-keyboard buttons on `@<DA>_bot` for any PAI worker.**

> **Infrastructure:** The Pulse Telegram daemon (`~/.claude/PAI/PULSE/modules/telegram.ts`) is the only consumer of `getUpdates` for the user's bot token. To let other workers receive `callback_query` presses without fighting Pulse for the long-poll connection, the daemon forwards every press to a JSONL side-channel that any process can tail.

---

## Why this exists

Without a bridge, two pollers on one bot token earn `Conflict: terminated by other getUpdates request` from Telegram. Pulse holds the only connection, but its handler is `bot.on("message:text", …)` — `callback_query` updates are drained and discarded.

This module fixes that with the smallest viable change: Pulse keeps the long-poll, and adds one extra handler that appends each press to a local file. Any worker (cron-driven poller, batch job, approval gate) can now ask the user a yes/no via inline-keyboard buttons.

Use cases:
- Long-running tasks that need human approval before a destructive step
- Cron-triggered alerts where the user wants to triage from their phone
- Booking-style flows that find candidates and need a "book it / skip" decision
- Multi-stage workflows that pause for a "continue / abort" gate

---

## How it works

```
┌──────────────────────────┐
│  Worker (e.g. cron job)  │
│  1. POST sendMessage     │── inline_keyboard ──▶  Telegram
│     with reply_markup    │
│                          │
│  2. waitForCallback(...) │◀── tails JSONL ──┐
└──────────────────────────┘                  │
                                              │
┌──────────────────────────┐                  │
│  Pulse Telegram daemon   │                  │
│  bot.on("callback_query")│── appends ───────┘
│  → callbacks.jsonl       │
│  → answerCallbackQuery() │── ack ──▶ Telegram (clears spinner)
└──────────────────────────┘
```

1. The worker sends a message to the user with an inline keyboard via the Telegram Bot API directly.
2. The user taps a button. Telegram delivers a `callback_query` update.
3. Pulse's `getUpdates` loop receives the update, the `callback_query:data` handler runs, the press is appended to `callbacks.jsonl`, and Telegram is acked (clears the loading spinner on the user's button).
4. The worker (running in a different process) tails the JSONL via `waitForCallback` and acts on the press.

---

## JSONL contract

**Path:** `~/.claude/PAI/PULSE/state/telegram/callbacks.jsonl`
**Mode:** `0600` (file), inside `STATE_DIR` (Pulse-managed)
**Atomicity:** entries are appended in single `O_APPEND` writes ≤ 4 KB — POSIX atomicity for concurrent appends.

**Schema** (one JSON object per line):

| Field | Type | Source |
|---|---|---|
| `update_id` | number | Telegram update id (monotonic per bot). Use for cross-run dedup. |
| `ts` | number | Epoch ms when Pulse logged the press. |
| `callback_query_id` | string | Telegram callback id (already acked by Pulse). |
| `from_id` | number | Telegram user id of the presser (already passed Pulse's allowedUsers gate). |
| `from_username` | string \| null | Optional Telegram username. |
| `message_id` | number \| null | The message that owned the keyboard. |
| `chat_id` | number \| null | The chat the message was in. |
| `data` | string | Raw `callback_data` from the button. **UNTRUSTED** — see security model below. |

Example line:

```json
{"update_id":1234,"ts":1730819400123,"callback_query_id":"abcd","from_id":85664591,"from_username":"alice","message_id":42,"chat_id":85664591,"data":"approve:c1f2-3a4b"}
```

---

## Producer (sender)

The bridge does NOT provide a sender — `Pulse/modules/telegram.ts` already handles outbound for DA chats, and workers have unique enough send needs that a shared helper would over-fit. Just call the Telegram Bot API directly:

```bash
TOKEN="$TELEGRAM_BOT_TOKEN"   # from .env
CHAT_ID="$TELEGRAM_ALLOWED_USERS"  # comma-list; first id is fine
CANDIDATE_ID="$(uuidgen)"

curl -s "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "content-type: application/json" \
  -d "$(cat <<JSON
{
  "chat_id": ${CHAT_ID},
  "text": "Continue with deploy?",
  "reply_markup": {
    "inline_keyboard": [[
      {"text": "✅ Approve", "callback_data": "approve:${CANDIDATE_ID}"},
      {"text": "🚫 Reject",  "callback_data": "reject:${CANDIDATE_ID}"}
    ]]
  }
}
JSON
)"
```

In TypeScript:

```ts
const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text: "Continue with deploy?",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Approve", callback_data: `approve:${candidateId}` },
        { text: "🚫 Reject",  callback_data: `reject:${candidateId}` },
      ]],
    },
  }),
});
const sent = (await res.json()).result; // { message_id, chat: { id }, ... }
```

---

## Consumer (waiter)

Use `TOOLS/TelegramCallbacks.ts`. Single export: `waitForCallback`.

```ts
import { waitForCallback } from "PAI/TOOLS/TelegramCallbacks";

const cb = await waitForCallback({
  timeoutMs: 15 * 60 * 1000,                     // 15 min hard ceiling
  predicate: (e) => e.data.endsWith(`:${candidateId}`),
});

if (!cb) {
  // timeout — the user didn't tap. Edit the original message accordingly.
} else {
  const [action] = cb.data.split(":");
  // act on `action`, NEVER pass `data` to a shell or eval.
}
```

### Key behaviors

- **Default offset is end-of-file.** A fresh `waitForCallback` call ignores any pre-existing entries — no stale-press replay.
- **`sinceUpdateId` enables cross-run resume.** Persist the matched entry's `updateId` in your worker's state file; pass it back next run to replay anything newer that arrived while you were down. Together with the EOF default, this gives you "exactly-once intent" for the workers that need it (and "at-most-once" for the ones that don't).
- **No double-ack.** Pulse already calls `answerCallbackQuery` on receive — don't ack again from the consumer.
- **Schema validation.** Malformed lines are skipped (logged to stderr); the helper never throws on bad input.

---

## Security model

The bridge ships with a deliberately minimal trust contract. Workers must respect it.

### What the bridge guarantees

- **Auth.** Only Telegram users on Pulse's `allowedUsers` list can produce JSONL entries. The `bot.use(allowedUsers)` middleware runs before `bot.on("callback_query")`; grammY guarantees middleware ordering.
- **Local-only delivery.** The JSONL file is mode `0600` inside Pulse's `STATE_DIR`. Telegram's API is the *only* way an entry lands there.
- **Bounded entries.** Pulse drops any callback whose serialized JSONL line would exceed 4 KB. Matches POSIX `O_APPEND` atomicity guarantee for concurrent writes.

### What the bridge does NOT guarantee

- **No signing.** A local process running as the user can append fake entries. This is the same trust boundary as everything else under `~/.claude/PAI/`. If your threat model includes hostile local processes, you have bigger problems.
- **No replay protection across consumers.** Two workers tailing the same file will both see every entry. Make `callback_data` namespaced and unique per workflow (`<workflow>:<uuid>:<action>`) so each worker's predicate matches only its own presses.
- **No commit semantics.** Pulse acks "I received your tap" — not "the action you intended is done." The consumer is responsible for everything after.

### Required consumer patterns

1. **Validate `data` before acting.**
   ```ts
   // GOOD — explicit allowlist
   switch (action) {
     case "approve": return runApprove(...);
     case "reject":  return runReject(...);
     default:        return; // unknown / spoofed
   }

   // BAD — never do this
   exec(`./tools/run-${action}.sh`)
   ```

2. **Disable buttons after acting.** Telegram doesn't auto-disable inline keyboards on press. Without this, the user can tap the same button twice and trigger two consumer runs. Edit `reply_markup` to an empty keyboard right after you ack:

   ```ts
   await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
     method: "POST",
     headers: { "content-type": "application/json" },
     body: JSON.stringify({ chat_id, message_id, reply_markup: { inline_keyboard: [] } }),
   });
   ```

3. **Namespace your `callback_data`.** Format: `<workflow>:<uuid>:<action>`. Use `crypto.randomUUID()` for the UUID. This defends against confused-deputy collisions across workflows.

4. **Use a throwaway bot for testing.** Never paste your production bot token into a fork's `.env`. Create a test bot via @BotFather, use its token for verification, revoke it via `/revoke` when done.

---

## Verifying the bridge

After installing or upgrading PAI:

1. Confirm Pulse has the handler:
   ```sh
   grep -n 'callback_query:data' ~/.claude/PAI/PULSE/modules/telegram.ts
   ```

2. Send a test message with buttons (substitute your token + chat id):
   ```sh
   curl -s "https://api.telegram.org/bot$TOKEN/sendMessage" \
     -H "content-type: application/json" \
     -d '{"chat_id":'"$CHAT_ID"',"text":"bridge test","reply_markup":{"inline_keyboard":[[{"text":"OK","callback_data":"t:1"}]]}}'
   ```

3. Tap "OK" on your phone, then check the JSONL grew:
   ```sh
   tail -1 ~/.claude/PAI/PULSE/state/telegram/callbacks.jsonl
   # → {"update_id":...,"data":"t:1",...}
   ```

4. Run the helper tests:
   ```sh
   bun test ./Releases/v5.0.0/.claude/PAI/TOOLS/TelegramCallbacks.test.ts
   ```

---

## Out of scope (future work)

- **Log rotation.** `callbacks.jsonl` grows unbounded. Entries are tiny (~250 B), so the practical cap is months of presses, but a future opt-in rotation hook in Pulse could trim by date or size.
- **Signed entries.** A symmetric MAC over each line, keyed by a per-user secret in STATE_DIR, would defeat local spoofing. Not added because the threat model is already single-user.
- **Other update types.** The same pattern (additive `bot.on(...)` → JSONL → consumer helper) extends to `inline_query`, `chat_member`, etc. Ship the one with proven demand first.
