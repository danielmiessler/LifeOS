# Workflow — Send with Approval (Apple Mail)

> The gated outbound flow. **No mail leaves the machine without explicit Jan approval.** This is the contract for `send`, `reply`, and `forward` — three subcommands, one gate.

## The flow

```
Timmy builds envelope ──► apple-mail send ──► Arthur.evaluate("apple_mail_send")
                                                       │
                                                       │ verdict = CONFIRM
                                                       ▼
                                    Token generated (16 random bytes hex)
                                    Pending file: STATE/apple-mail-pending/<tok>.json
                                                       │
                  ┌────────────────────────┬───────────┴────────────┐
                  ▼                        ▼                        ▼
            In-Claude session         Pulse notification      Telegram message
            (preview printed)         (visual ping)           (/approve-mail TOK)
                  │                        │                        │
                  └────────────┬───────────┴────────────┬───────────┘
                               ▼                        ▼
                Jan reads draft, decides   Jan taps approve in Pulse
                Re-runs: send              OR sends /approve-mail TOK in Telegram
                  --approval-token TOK     (writes outcome.json with decision:approve)
                               │                        │
                               ▼                        ▼
                       Pending + outcome files validated
                       AppleScript ships the mail
                       Both files deleted
                       audit log: apple_mail_sent
```

## Issuing a send

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts send \
  --to "team@fwu.de" \
  --subject "Roadmap-Update" \
  --body-stdin <<'EOF'
Hi team,

…body…
EOF
```

The tool prints a preview block:

```
━━━ MAIL DRAFT — APPROVAL REQUIRED ━━━
To: team@fwu.de
Subject: Roadmap-Update
───
Hi team,

…body…
───
Approval token: a3f9e1c2…
Approve from any channel:
  - In Claude:  apple-mail send --approval-token a3f9e1c2…
  - In Pulse:   click the pending notification
  - Telegram:   /approve-mail a3f9e1c2…
Expires: 2026-05-17 23:50:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

…and exits with code 2 + a JSON status line: `{"status":"awaiting_approval","token":"a3f9e1c2…","channels":["session","pulse","telegram"]}`. Nothing has been sent.

## Approving — three equivalent paths

**Path 1: In Claude session.** Jan types `approve <tok>` or just "ship it"; Timmy runs:

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts send --approval-token a3f9e1c2…
```

But this still requires the outcome file. Timmy creates it inline:

```bash
echo '{"decision":"approve","approver":"jan@session","decided":"'$(date -Iseconds)'"}' \
  > ~/.claude/PAI/MEMORY/STATE/apple-mail-pending/a3f9e1c2…outcome.json
bun ~/.claude/PAI/TOOLS/apple-mail.ts send --approval-token a3f9e1c2…
```

(The outcome file is the source-of-truth signal — same shape for all three channels.)

**Path 2: Pulse.** The Pulse notification handler writes the outcome file when Jan clicks ✅. Then Pulse runs the same `apple-mail send --approval-token` command. (Phase-2 work: Pulse needs an approval-panel UI; for v1, Pulse only displays the pending message — Jan still completes the approve via session or Telegram.)

**Path 3: Telegram.** Jan replies in the Telegram chat with the bot:

```
/approve-mail a3f9e1c2…
```

The bot-command handler (separate task in `Pulse/modules/telegram.ts`) writes:

```json
{"decision": "approve", "approver": "telegram:<chat_id>", "decided": "2026-05-17T23:51:00Z"}
```

to `STATE/apple-mail-pending/<tok>.outcome.json`, then invokes the tool with the token. The mail ships, files are cleaned up, audit entry written.

## Reply / Forward

Same gate, different envelope source:

```bash
# Reply to message 12345
bun ~/.claude/PAI/TOOLS/apple-mail.ts reply 12345 --body-stdin <<< "Danke für die Info!"

# Reply-all
bun ~/.claude/PAI/TOOLS/apple-mail.ts reply 12345 --reply-all --body-file /tmp/reply.txt

# Forward
bun ~/.claude/PAI/TOOLS/apple-mail.ts forward 12345 --to "kollege@fwu.de" --body-stdin <<< "FYI"
```

Each one stages through the same token + 3-channel approval as `send`.

## When approval is REJECTED

Outcome file with `{"decision":"reject","approver":"…"}`. Re-running with the token returns exit 2 + `{"error":"draft rejected by approver","code":"rejected"}`. Pending files cleaned up; mail is NOT sent. The audit log records `apple_mail_rejected`.

## Expiry

Tokens live for **30 minutes**. After that, the next any-command invocation of `apple-mail` deletes stale pending files. A re-run with an expired token returns `token_expired`. Re-issue from the original `send` command if you still want to ship it.

## Anti-bypass — what Timmy MUST NOT do

- Do not `echo '{"decision":"approve"}' >` the outcome file when the user hasn't said "approve". The outcome file is the proxy for human consent; forging it forges consent.
- Do not invent a `--force` flag, set a magic env var, or shell-out to `osascript` directly to bypass the gate. The tool is the gate.
- Do not auto-approve "obvious" mails (e.g. "reply just says thanks"). Every send goes through the gate. Even one-word replies.
- If the user explicitly says "just send it, skip the gate" — Timmy declines and explains why. The user can manually set `PAI_ARTHUR_OVERRIDE=1` (in Arthur.ts, separate concern) if they really want to disable the gate machine-wide — that's a deliberate hand on the safety switch.

## Operating without Telegram

If `PAI_TELEGRAM_BOT_TOKEN` and `PAI_TELEGRAM_CHAT_ID` env vars are missing, the tool logs:

```
[apple-mail] Telegram approval channel not configured (set PAI_TELEGRAM_BOT_TOKEN + PAI_TELEGRAM_CHAT_ID); using session + Pulse only
```

…and continues with the two remaining channels. The send still gates correctly — only the Telegram surface goes silent.
