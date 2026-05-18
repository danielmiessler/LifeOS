# Workflow — Draft (Apple Mail)

> `apple-mail draft` saves an outgoing message to the **Drafts** folder. It NEVER sends. Use this when the user says "draft <X>", "queue a message to <Y>", "let me look at it before sending" — and especially when Timmy is working autonomously in the background and shouldn't even attempt the approval flow.

## Basic draft

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts draft \
  --to "kollege@fwu.de" \
  --subject "AIS.chat Rollout — Status für Q3" \
  --body-stdin <<'EOF'
Hi,

kurzer Stand zum Rollout in den Schulen…

Beste Grüße,
Jan
EOF
```

Output: `{"draftId": "...", "status": "drafted"}`. The draft now sits in the relevant account's Drafts folder, ready for the user to review in Mail.app and either send manually or feed back into `apple-mail send` with the approval gate.

## With a body file

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts draft \
  --to "team@german-uds.de" \
  --cc "leitung@german-uds.de" \
  --subject "Bewerbungs-Pipeline — Vorschlag" \
  --body-file /tmp/draft-pitch.md
```

## HTML drafts

Add `--html` and the body is treated as HTML (uses Mail.app's HTML content slot):

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts draft \
  --to "press@example.com" \
  --subject "Pressemitteilung Q4" \
  --html \
  --body-file /tmp/press-release.html
```

## Choosing the sender account

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts draft \
  --account "FWU" \
  --to "..." --subject "..." --body-stdin <<< "..."
```

Pass the email address of the sending identity, not the account display name (AppleScript's `sender` property expects the address, e.g. `jan.renz@fwu.de`).

## Why drafts matter for safety

Drafts are the **escape hatch** when the approval flow would be too heavy:

- Timmy is mid-conversation drafting many candidates and only ONE will ship — write all candidates as drafts, gate only the chosen one through `send`.
- A scheduled/cron task assembles a daily summary email but Jan reviews it before sending — write the draft from the cron, send it manually or via approval-token re-run.
- Jan wants to dictate the body, then tweak in Mail.app's UI before sending — `draft` puts the body exactly where Mail.app expects it.

## What `draft` does NOT do

- It does **not** call Arthur or write a pending file. There's no token. There's no notify ping. It's a pure local action.
- It does **not** prevent the user from manually clicking Send in Mail.app afterwards — that's the user's hand, not the tool's.
- It does **not** support attachments yet — for attachments, compose in Mail.app's UI or use `osascript` directly. Future work.
