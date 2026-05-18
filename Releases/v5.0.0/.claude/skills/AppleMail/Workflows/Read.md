# Workflow — Read (Apple Mail)

> Use the `apple-mail` CLI to inspect mail without sending anything. All read commands print JSON to stdout — pipe to `jq` for slicing.

## Discovering accounts

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts accounts
```

Returns `[{name, email}]`. Note the `name` value — most other commands accept `--account NAME` to scope.

## Quick triage — what's unread right now?

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts unread --limit 10
```

Returns up to 10 unread messages across all accounts: `{id, account, mailbox, from, subject, dateReceived, snippet}`. Scope to one account:

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts unread --account "FWU" --limit 20
```

## Listing a specific mailbox

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts list "INBOX" --account "FWU" --limit 30
bun ~/.claude/PAI/TOOLS/apple-mail.ts list "Archive" --account "Personal"
```

Common mailbox names: `INBOX`, `Sent Messages`, `Drafts`, `Archive`, `Junk`. Mailbox names are case-sensitive and per-account.

## Search

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts search "kindergarten" --limit 10
bun ~/.claude/PAI/TOOLS/apple-mail.ts search "AIS.chat" --account "FWU" --limit 5
```

Searches message body (`whose content contains`). Slow on large stores — keep `--limit` low. Quote the query; use single quotes around the whole command if the query contains shell metacharacters.

## Reading a single message

```bash
# Just headers + snippet
bun ~/.claude/PAI/TOOLS/apple-mail.ts fetch 12345

# Full body
bun ~/.claude/PAI/TOOLS/apple-mail.ts fetch 12345 --full
```

## Counts

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts count "INBOX" --unread-only
bun ~/.claude/PAI/TOOLS/apple-mail.ts count "INBOX" --account "FWU"
```

## Status check (am I even connected?)

```bash
bun ~/.claude/PAI/TOOLS/apple-mail.ts status
```

Returns `{running, accountCount, totalUnread}`. Use this at the top of any longer-running flow to verify Mail.app is alive.

## Composing JSON pipelines

```bash
# Unread from any FWU domain sender today
bun ~/.claude/PAI/TOOLS/apple-mail.ts unread --limit 50 \
  | jq '[.[] | select(.from | contains("fwu.de"))]'

# Just the IDs and subjects
bun ~/.claude/PAI/TOOLS/apple-mail.ts unread --limit 50 \
  | jq '.[] | {id, subject}'
```

## When Timmy uses Read

If the user asks "any new mail from <X>?" Timmy:

1. Runs `apple-mail unread --limit 20` (or scoped to the account if obvious).
2. Filters the JSON locally (jq or just summarizes).
3. Reports a short prose summary, optionally pulls full body via `fetch <id> --full` if the user wants depth.

Timmy NEVER runs read commands and stops there — always synthesizes into a useful answer in voice.
