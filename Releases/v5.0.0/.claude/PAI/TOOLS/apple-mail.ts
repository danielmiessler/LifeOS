#!/usr/bin/env bun
// Apple Mail CLI — wraps macOS Mail.app via AppleScript (osascript).
//
// Read commands (autonomous, no approval gate):
//   apple-mail accounts
//   apple-mail mailboxes [--account NAME]
//   apple-mail unread [--account NAME] [--limit N=20]
//   apple-mail list <mailbox> [--account NAME] [--limit N=50]
//   apple-mail search "<query>" [--account NAME] [--limit N=20]
//   apple-mail fetch <id> [--full]
//   apple-mail count <mailbox> [--account NAME] [--unread-only]
//   apple-mail drafts [--limit N=20]
//   apple-mail status
//
// Write commands (gated through Arthur policy apple_mail_send):
//   apple-mail draft --to ADDR --subject "..." (--body-file PATH | --body-stdin)
//                    [--cc ADDR] [--bcc ADDR] [--account NAME] [--html]
//   apple-mail send  ... [--approval-token TOK]
//   apple-mail reply <id> (--body-file PATH | --body-stdin) [--reply-all] [--approval-token TOK]
//   apple-mail forward <id> --to ADDR (--body-file PATH | --body-stdin) [--approval-token TOK]
//   apple-mail mark-read <id>[,<id>...]
//   apple-mail mark-unread <id>[,<id>...]
//   apple-mail move <id> --to-mailbox NAME [--account NAME]
//
// Approval flow for send/reply/forward:
//   1. Without --approval-token: tool calls Arthur.evaluate(), receives CONFIRM,
//      writes a pending-draft file, prints draft preview, pings Pulse + Telegram,
//      exits 2.
//   2. Approval token can be activated from any channel:
//        - In Claude:  re-run with --approval-token TOK
//        - In Pulse:   click pending notification (writes outcome file)
//        - Telegram:   /approve-mail TOK (handler writes outcome file)
//   3. Re-run with --approval-token TOK: tool reads pending+outcome files and
//      ships the mail iff decision === "approve". Token expires after 30 min.
//
// No --force flag, no in-tool override. The gate is the tool.

import { audit, evaluate } from "./Arthur.ts";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ─────────────────────────────── Platform guard ───────────────────────────────

if (process.platform !== "darwin") {
  process.stderr.write(
    JSON.stringify({ error: "apple-mail requires macOS", code: "unsupported_platform" }) + "\n",
  );
  process.exit(2);
}

// ─────────────────────────────── Constants ───────────────────────────────

const PAI_DIR = process.env.PAI_DIR ?? join(homedir(), ".claude", "PAI");
const PENDING_DIR = join(PAI_DIR, "MEMORY", "STATE", "apple-mail-pending");
const TOKEN_TTL_MS = 30 * 60 * 1000;
const TELEGRAM_TOKEN = process.env.PAI_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT = process.env.PAI_TELEGRAM_CHAT_ID;
const PULSE_URL = "http://localhost:31337/notify";

// Mailboxes excluded by default from cross-mailbox iteration (currently only `search`).
// Override per-call with --include-junk, or globally via PAI_APPLE_MAIL_INCLUDE_MAILBOXES (comma list).
const SKIP_MAILBOXES_DEFAULT: readonly string[] = [
  // Junk / Spam / iCloud Mail Categories (macOS 26+)
  "Junk", "Junk-E-Mail", "Junk E-mail", "Junk Email",
  "Spam", "Bulk Mail",
  "Sonstiges", "Werbung", "Newsletter", "Transaktionen", "Updates",
  // Trash
  "Trash", "Bin", "Deleted Items", "Deleted Messages",
  "Papierkorb", "Gelöschte Nachrichten", "Gelöschte Objekte",
  // Outbound / own mail
  "Sent", "Sent Items", "Sent Messages",
  "Gesendet", "Gesendete Nachrichten", "Gesendete Objekte",
  "Drafts", "Entwürfe",
];

function getSkipMailboxes(): readonly string[] {
  const env = process.env.PAI_APPLE_MAIL_INCLUDE_MAILBOXES;
  if (!env) return SKIP_MAILBOXES_DEFAULT;
  const include = new Set(env.split(",").map((s) => s.trim()).filter(Boolean));
  return SKIP_MAILBOXES_DEFAULT.filter((m) => !include.has(m));
}

function asListLiteral(names: readonly string[]): string {
  return "{" + names.map((n) => `"${escapeAS(n)}"`).join(", ") + "}";
}

if (!existsSync(PENDING_DIR)) mkdirSync(PENDING_DIR, { recursive: true, mode: 0o700 });

const TOKEN_RE = /^[0-9a-f]{32}$/;

function assertValidToken(token: string): void {
  if (!TOKEN_RE.test(token)) {
    audit({ event_type: "apple_mail_token_malformed", token_excerpt: token.slice(0, 8) });
    process.stderr.write(
      JSON.stringify({ error: "malformed approval token", code: "token_malformed" }) + "\n",
    );
    process.exit(2);
  }
}

// ─────────────────────────────── Types ───────────────────────────────

type Envelope = {
  kind: "send" | "reply" | "forward";
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body: string;
  html?: boolean;
  account?: string;
  replyToId?: string;
  replyAll?: boolean;
  forwardId?: string;
};

type Pending = {
  token: string;
  envelope: Envelope;
  created: string;
  expires: string;
};

type Outcome = {
  decision: "approve" | "reject";
  approver: string;
  decided: string;
};

// ─────────────────────────────── osascript wrapper ───────────────────────────────

function osa(script: string): string {
  const result = Bun.spawnSync(["osascript", "-e", script]);
  const stderr = new TextDecoder().decode(result.stderr).trim();
  const stdout = new TextDecoder().decode(result.stdout);
  if (result.exitCode !== 0) {
    throw new Error(`osascript failed (exit ${result.exitCode}): ${stderr || stdout}`);
  }
  return stdout;
}

function escapeAS(s: string): string {
  // AppleScript string escaping: backslash + double-quote.
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function ensureMailRunning(): void {
  try {
    osa('tell application "System Events" to (name of processes) contains "Mail"');
  } catch {
    // ignore
  }
  osa('tell application "Mail" to activate');
}

// ─────────────────────────────── Pending state ───────────────────────────────

function cleanupStaleTokens(): void {
  if (!existsSync(PENDING_DIR)) return;
  const now = Date.now();
  for (const f of readdirSync(PENDING_DIR)) {
    const p = join(PENDING_DIR, f);
    try {
      const age = now - statSync(p).mtimeMs;
      if (age > TOKEN_TTL_MS + 60_000) {
        unlinkSync(p);
      }
    } catch {
      // ignore
    }
  }
}

function writePending(p: Pending): void {
  const file = join(PENDING_DIR, `${p.token}.json`);
  writeFileSync(file, JSON.stringify(p, null, 2), { mode: 0o600 });
}

function readPending(token: string): Pending | null {
  const file = join(PENDING_DIR, `${token}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Pending;
}

function readOutcome(token: string): Outcome | null {
  const file = join(PENDING_DIR, `${token}.outcome.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Outcome;
}

function clearPending(token: string): void {
  for (const suffix of [".json", ".outcome.json"]) {
    const file = join(PENDING_DIR, `${token}${suffix}`);
    if (existsSync(file)) unlinkSync(file);
  }
}

// ─────────────────────────────── Notify channels ───────────────────────────────

async function notifyPulse(message: string): Promise<void> {
  try {
    await fetch(PULSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, voice_enabled: false, voice_id: "fTtv3eikoepIosk8dTZ5" }),
    });
  } catch (e) {
    process.stderr.write(`[apple-mail] Pulse notify failed: ${(e as Error).message}\n`);
  }
}

async function notifyTelegram(message: string): Promise<boolean> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) {
    process.stderr.write(
      "[apple-mail] Telegram approval channel not configured (set PAI_TELEGRAM_BOT_TOKEN + PAI_TELEGRAM_CHAT_ID); using session + Pulse only\n",
    );
    return false;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message }),
    });
    return r.ok;
  } catch (e) {
    process.stderr.write(`[apple-mail] Telegram notify failed: ${(e as Error).message}\n`);
    return false;
  }
}

// ─────────────────────────────── AppleScript generators ───────────────────────────────

function scriptAccounts(): string {
  return `tell application "Mail"
  set out to ""
  repeat with a in accounts
    try
      set addr to (item 1 of email addresses of a)
    on error
      set addr to ""
    end try
    set out to out & (name of a) & "|" & addr & linefeed
  end repeat
  return out
end tell`;
}

function scriptMailboxes(account: string | undefined): string {
  if (account) {
    return `tell application "Mail"
  set out to ""
  set acc to first account whose name is "${escapeAS(account)}"
  repeat with mb in mailboxes of acc
    set out to out & (name of acc) & "|" & (name of mb) & "|" & (unread count of mb) & "|" & (count of messages of mb) & linefeed
  end repeat
  return out
end tell`;
  }
  return `tell application "Mail"
  set out to ""
  repeat with acc in accounts
    repeat with mb in mailboxes of acc
      set out to out & (name of acc) & "|" & (name of mb) & "|" & (unread count of mb) & "|" & (count of messages of mb) & linefeed
    end repeat
  end repeat
  return out
end tell`;
}

function scriptUnread(account: string | undefined, limit: number): string {
  const acctFilter = account
    ? `set msgs to messages of (first mailbox of (first account whose name is "${escapeAS(account)}") whose name is "INBOX") whose read status is false`
    : `set msgs to {}
  repeat with acc in accounts
    try
      set inb to first mailbox of acc whose name is "INBOX"
      set msgs to msgs & (messages of inb whose read status is false)
    on error
      try
        set inb to first mailbox of acc whose name is "Inbox"
        set msgs to msgs & (messages of inb whose read status is false)
      end try
    end try
  end repeat`;
  return `tell application "Mail"
  set out to ""
  set i to 0
  ${acctFilter}
  repeat with m in msgs
    if i >= ${limit} then exit repeat
    try
      set snip to (content of m)
      if length of snip > 200 then set snip to (text 1 thru 200 of snip)
      set snip to my cleanLines(snip)
      set acctName to (name of (mailbox of m)'s account)
      set out to out & (id of m) & "|" & acctName & "|" & (name of mailbox of m) & "|" & (sender of m) & "|" & (subject of m) & "|" & ((date received of m) as string) & "|" & snip & linefeed
      set i to i + 1
    end try
  end repeat
  return out
end tell

on cleanLines(s)
  set AppleScript's text item delimiters to {return, linefeed, tab}
  set parts to text items of s
  set AppleScript's text item delimiters to " "
  set joined to parts as string
  set AppleScript's text item delimiters to ""
  return joined
end cleanLines`;
}

function scriptList(mailbox: string, account: string | undefined, limit: number): string {
  const acctScope = account
    ? `set acc to first account whose name is "${escapeAS(account)}"
  set mb to first mailbox of acc whose name is "${escapeAS(mailbox)}"
  set acctName to name of acc`
    : `set mb to first mailbox whose name is "${escapeAS(mailbox)}"
  set acctName to "(any)"`;
  return `tell application "Mail"
  set out to ""
  set i to 0
  ${acctScope}
  repeat with m in messages of mb
    if i >= ${limit} then exit repeat
    try
      set snip to (content of m)
      if length of snip > 200 then set snip to (text 1 thru 200 of snip)
      set snip to my cleanLines(snip)
      set out to out & (id of m) & "|" & acctName & "|" & (name of mb) & "|" & (sender of m) & "|" & (subject of m) & "|" & ((date received of m) as string) & "|" & snip & linefeed
      set i to i + 1
    end try
  end repeat
  return out
end tell

on cleanLines(s)
  set AppleScript's text item delimiters to {return, linefeed, tab}
  set parts to text items of s
  set AppleScript's text item delimiters to " "
  set joined to parts as string
  set AppleScript's text item delimiters to ""
  return joined
end cleanLines`;
}

function scriptSearch(
  query: string,
  account: string | undefined,
  limit: number,
  includeJunk: boolean,
): string {
  const skipList = includeJunk ? null : asListLiteral(getSkipMailboxes());
  const skipOpen = skipList ? `if (name of mb) is not in ${skipList} then` : "";
  const skipClose = skipList ? "end if" : "";
  const acctScope = account
    ? `set acc to first account whose name is "${escapeAS(account)}"
  set msgs to {}
  repeat with mb in mailboxes of acc
    ${skipOpen}
    try
      set msgs to msgs & (messages of mb whose content contains "${escapeAS(query)}")
    end try
    ${skipClose}
  end repeat`
    : `set msgs to {}
  repeat with acc in accounts
    repeat with mb in mailboxes of acc
      ${skipOpen}
      try
        set msgs to msgs & (messages of mb whose content contains "${escapeAS(query)}")
      end try
      ${skipClose}
    end repeat
  end repeat`;
  return `tell application "Mail"
  set out to ""
  set i to 0
  ${acctScope}
  repeat with m in msgs
    if i >= ${limit} then exit repeat
    try
      set snip to (content of m)
      if length of snip > 200 then set snip to (text 1 thru 200 of snip)
      set snip to my cleanLines(snip)
      set acctName to (name of (mailbox of m)'s account)
      set out to out & (id of m) & "|" & acctName & "|" & (name of mailbox of m) & "|" & (sender of m) & "|" & (subject of m) & "|" & ((date received of m) as string) & "|" & snip & linefeed
      set i to i + 1
    end try
  end repeat
  return out
end tell

on cleanLines(s)
  set AppleScript's text item delimiters to {return, linefeed, tab}
  set parts to text items of s
  set AppleScript's text item delimiters to " "
  set joined to parts as string
  set AppleScript's text item delimiters to ""
  return joined
end cleanLines`;
}

function scriptFetch(id: string, full: boolean): string {
  const bodyClause = full
    ? `set bd to content of m
  set out to out & "---BODY---" & linefeed & bd & linefeed`
    : "";
  return `tell application "Mail"
  set out to ""
  set m to first message of inbox whose id is ${parseInt(id, 10)}
  set out to "ID: " & (id of m) & linefeed
  set out to out & "FROM: " & (sender of m) & linefeed
  try
    set out to out & "TO: " & (address of (to recipient 1 of m)) & linefeed
  end try
  set out to out & "SUBJECT: " & (subject of m) & linefeed
  set out to out & "DATE: " & ((date received of m) as string) & linefeed
  set out to out & "ACCOUNT: " & (name of (mailbox of m)'s account) & linefeed
  set out to out & "MAILBOX: " & (name of mailbox of m) & linefeed
  ${bodyClause}
  return out
end tell`;
}

function scriptCount(mailbox: string, account: string | undefined, unreadOnly: boolean): string {
  const acctScope = account
    ? `set mb to first mailbox of (first account whose name is "${escapeAS(account)}") whose name is "${escapeAS(mailbox)}"`
    : `set mb to first mailbox whose name is "${escapeAS(mailbox)}"`;
  const countExpr = unreadOnly ? "unread count of mb" : "count of messages of mb";
  return `tell application "Mail"
  ${acctScope}
  return ${countExpr}
end tell`;
}

function scriptStatus(): string {
  return `tell application "System Events"
  set isRunning to (name of processes) contains "Mail"
end tell
if isRunning then
  tell application "Mail"
    set acctN to count of accounts
    set tot to 0
    repeat with acc in accounts
      repeat with mb in mailboxes of acc
        try
          set tot to tot + (unread count of mb)
        end try
      end repeat
    end repeat
    return "running|" & acctN & "|" & tot
  end tell
else
  return "stopped|0|0"
end if`;
}

function scriptSend(env: Envelope, finalAction: "send" | "save"): string {
  const subject = escapeAS(env.subject ?? "");
  const content = escapeAS(env.body);
  const html = env.html ? "true" : "false";
  const accountClause = env.account
    ? `set sender of newMsg to "${escapeAS(env.account)}"`
    : "";
  const recipientsClause = (env.to ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => `make new to recipient at end of to recipients with properties {address:"${escapeAS(a)}"}`)
    .join("\n    ");
  const ccClause = (env.cc ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => `make new cc recipient at end of cc recipients with properties {address:"${escapeAS(a)}"}`)
    .join("\n    ");
  const bccClause = (env.bcc ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => `make new bcc recipient at end of bcc recipients with properties {address:"${escapeAS(a)}"}`)
    .join("\n    ");
  return `tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:"${subject}", content:"${content}", visible:false}
  set html content of newMsg to ${html}
  tell newMsg
    ${recipientsClause}
    ${ccClause}
    ${bccClause}
  end tell
  ${accountClause}
  ${finalAction === "send" ? "send newMsg" : "save newMsg"}
  return (id of newMsg) as string
end tell`;
}

function scriptReply(id: string, body: string, replyAll: boolean): string {
  const action = replyAll ? "reply to" : "reply to";
  return `tell application "Mail"
  set orig to first message of inbox whose id is ${parseInt(id, 10)}
  set rep to ${action} orig with opening window
  delay 0.4
  tell rep
    set content to "${escapeAS(body)}" & linefeed & content
    send
  end tell
  return "replied"
end tell`;
}

function scriptForward(id: string, to: string, body: string): string {
  return `tell application "Mail"
  set orig to first message of inbox whose id is ${parseInt(id, 10)}
  set fwd to forward orig with opening window
  delay 0.4
  tell fwd
    make new to recipient at end of to recipients with properties {address:"${escapeAS(to)}"}
    set content to "${escapeAS(body)}" & linefeed & content
    send
  end tell
  return "forwarded"
end tell`;
}

function scriptMarkRead(ids: string[], read: boolean): string {
  const list = ids.map((i) => parseInt(i, 10)).filter((n) => !Number.isNaN(n));
  return `tell application "Mail"
  repeat with mid in {${list.join(", ")}}
    try
      set m to first message of inbox whose id is mid
      set read status of m to ${read ? "true" : "false"}
    end try
  end repeat
  return "ok"
end tell`;
}

function scriptMove(id: string, mailbox: string, account: string | undefined): string {
  const target = account
    ? `first mailbox of (first account whose name is "${escapeAS(account)}") whose name is "${escapeAS(mailbox)}"`
    : `first mailbox whose name is "${escapeAS(mailbox)}"`;
  return `tell application "Mail"
  set m to first message of inbox whose id is ${parseInt(id, 10)}
  set targetMb to ${target}
  move m to targetMb
  return "moved"
end tell`;
}

// ─────────────────────────────── Argv parser ───────────────────────────────

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function readBody(flags: Record<string, string | boolean>): string {
  if (typeof flags["body-file"] === "string") {
    return readFileSync(flags["body-file"] as string, "utf8");
  }
  if (flags["body-stdin"]) {
    return readFileSync(0, "utf8");
  }
  throw new Error("body required: pass --body-file PATH or --body-stdin");
}

// ─────────────────────────────── Output parsers ───────────────────────────────

function parsePipes(s: string, fields: string[]): Record<string, string>[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split("|");
      const obj: Record<string, string> = {};
      fields.forEach((f, i) => (obj[f] = parts[i] ?? ""));
      return obj;
    });
}

// ─────────────────────────────── Approval gate ───────────────────────────────

async function gateAndStage(envelope: Envelope): Promise<never> {
  // Defense-in-depth: any Arthur load/eval failure (e.g. policies.yaml missing on a
  // fresh PAI install) MUST fail closed → treat as CONFIRM so the token gate runs.
  // We never let an Arthur exception bypass the gate.
  let decision: { verdict: "ALLOW" | "DENY" | "CONFIRM"; reason: string; rule: string };
  try {
    decision = evaluate({
      key: "apple_mail_send",
      caller: "apple-mail.ts",
      purpose: "send mail",
      session_id: process.env.CLAUDE_SESSION_ID,
    });
  } catch (e) {
    audit({
      event_type: "apple_mail_arthur_unavailable",
      to: envelope.to,
      subject: envelope.subject,
      error: (e as Error).message,
      hint: "Arthur unreachable; failing closed to CONFIRM",
    });
    decision = { verdict: "CONFIRM", reason: "Arthur unavailable; fail-closed", rule: "fail_closed" };
  }

  if (decision.verdict === "DENY") {
    audit({
      event_type: "apple_mail_denied",
      to: envelope.to,
      subject: envelope.subject,
      reason: decision.reason,
      rule: decision.rule,
    });
    process.stderr.write(JSON.stringify({ error: decision.reason, code: "denied" }) + "\n");
    process.exit(2);
  }

  // Defense-in-depth: Arthur's default-allow path (rule === "default") fires when no
  // explicit policy exists for the key. For mail send/reply/forward we ALWAYS want
  // human confirmation — treat missing policy as if it had require_confirmation:true
  // so a fresh PAI install can't accidentally ship mail before the user wires up
  // ~/.claude/PAI/USER/ARTHUR/policies.yaml (see skills/AppleMail/policies-sample.yaml).
  if (decision.verdict === "ALLOW" && decision.rule !== "default") {
    // Explicit policy match with no confirmation required — ship immediately.
    await actuallySend(envelope, "(policy-allow)");
    process.exit(0);
  }
  if (decision.verdict === "ALLOW" && decision.rule === "default") {
    audit({
      event_type: "apple_mail_default_gate_engaged",
      to: envelope.to,
      subject: envelope.subject,
      hint: "no explicit apple_mail_send policy; defaulting to CONFIRM",
    });
    // Fall through to CONFIRM staging below.
  }

  // CONFIRM (or default-allow promoted to CONFIRM) — stage the draft.
  const token = randomBytes(16).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + TOKEN_TTL_MS);
  const pending: Pending = {
    token,
    envelope,
    created: now.toISOString(),
    expires: expires.toISOString(),
  };
  writePending(pending);

  const bodyPreview = envelope.body.slice(0, 800);
  const cc = envelope.cc ? `Cc: ${envelope.cc}\n` : "";
  const bcc = envelope.bcc ? `Bcc: ${envelope.bcc}\n` : "";
  const preview = `━━━ MAIL DRAFT — APPROVAL REQUIRED ━━━
To: ${envelope.to ?? "(reply target)"}
${cc}${bcc}Subject: ${envelope.subject ?? "(reply)"}
───
${bodyPreview}${envelope.body.length > 800 ? "\n[…body truncated]" : ""}
───
Approval token: ${token}
Approve from any channel:
  - In Claude:  apple-mail send --approval-token ${token}
  - In Pulse:   click the pending notification
  - Telegram:   /approve-mail ${token}
Expires: ${expires.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  process.stdout.write(preview + "\n");

  await notifyPulse(
    `Mail draft pending approval (token ${token}): To ${envelope.to ?? "(reply)"} — "${envelope.subject ?? ""}"`,
  );
  const telegramOk = await notifyTelegram(
    `📧 Mail draft pending approval\nTo: ${envelope.to ?? "(reply)"}\nSubject: ${envelope.subject ?? ""}\n\nApprove: /approve-mail ${token}\nReject: /reject-mail ${token}\n\nExpires in 30 min`,
  );

  audit({
    event_type: "apple_mail_send_requested",
    token,
    to: envelope.to,
    cc: envelope.cc,
    bcc: envelope.bcc,
    subject: envelope.subject,
    kind: envelope.kind,
    channels: telegramOk ? ["session", "pulse", "telegram"] : ["session", "pulse"],
  });

  const channels = telegramOk ? ["session", "pulse", "telegram"] : ["session", "pulse"];
  process.stdout.write(
    JSON.stringify({ status: "awaiting_approval", token, channels }, null, 2) + "\n",
  );
  process.exit(2);
}

async function consumeApprovalToken(token: string): Promise<never> {
  assertValidToken(token);
  const pending = readPending(token);
  if (!pending) {
    audit({ event_type: "apple_mail_token_unknown", token });
    process.stderr.write(JSON.stringify({ error: "unknown approval token", code: "token_unknown" }) + "\n");
    process.exit(2);
  }
  if (new Date(pending.expires).getTime() < Date.now()) {
    audit({
      event_type: "apple_mail_token_expired",
      token,
      to: pending.envelope.to,
      subject: pending.envelope.subject,
    });
    clearPending(token);
    process.stderr.write(JSON.stringify({ error: "approval token expired", code: "token_expired" }) + "\n");
    process.exit(2);
  }
  const outcome = readOutcome(token);
  if (!outcome) {
    process.stdout.write(
      JSON.stringify({ status: "awaiting_approval", token, hint: "no outcome file yet" }, null, 2) + "\n",
    );
    process.exit(2);
  }
  if (outcome.decision !== "approve") {
    audit({
      event_type: "apple_mail_rejected",
      token,
      to: pending.envelope.to,
      subject: pending.envelope.subject,
      approver: outcome.approver,
    });
    clearPending(token);
    process.stderr.write(
      JSON.stringify({ error: "draft rejected by approver", code: "rejected" }) + "\n",
    );
    process.exit(2);
  }
  await actuallySend(pending.envelope, outcome.approver);
  clearPending(token);
  process.exit(0);
}

async function actuallySend(env: Envelope, approver: string): Promise<void> {
  ensureMailRunning();
  let messageId = "";
  if (env.kind === "reply" && env.replyToId) {
    messageId = osa(scriptReply(env.replyToId, env.body, env.replyAll === true)).trim();
  } else if (env.kind === "forward" && env.forwardId) {
    messageId = osa(scriptForward(env.forwardId, env.to ?? "", env.body)).trim();
  } else {
    messageId = osa(scriptSend(env, "send")).trim();
  }
  audit({
    event_type: "apple_mail_sent",
    to: env.to,
    subject: env.subject,
    kind: env.kind,
    approver,
    messageId,
  });
  process.stdout.write(JSON.stringify({ sent: true, messageId, approver }, null, 2) + "\n");
}

// ─────────────────────────────── Help ───────────────────────────────

function printHelp(): void {
  process.stdout.write(
    `apple-mail — macOS Mail.app CLI wrapper

Read:
  accounts                                       list configured accounts
  mailboxes [--account NAME]                     list mailboxes
  unread [--account NAME] [--limit N]            unread messages (JSON)
  list <mailbox> [--account NAME] [--limit N]    list messages in mailbox
  search "<query>" [--account NAME] [--limit N] [--include-junk]
                                                 full-text search across mailboxes;
                                                 by default skips Junk/Sonstiges/Werbung/Spam,
                                                 Trash/Papierkorb/Deleted, Sent/Gesendet/Drafts/Entwürfe.
                                                 --include-junk searches all mailboxes.
  fetch <id> [--full]                            single message; --full = body
  count <mailbox> [--account NAME] [--unread-only]
  drafts [--limit N]                             list drafts
  filters                                        show active mailbox skip-list
  status                                         is Mail running + total unread

Write (Arthur-gated for send/reply/forward):
  draft   --to ADDR --subject "..." (--body-file P|--body-stdin) [--cc] [--bcc] [--account] [--html]
  send    --to ADDR --subject "..." (--body-file P|--body-stdin) [--cc] [--bcc] [--account] [--html] [--approval-token TOK]
  reply   <id> (--body-file P|--body-stdin) [--reply-all] [--approval-token TOK]
  forward <id> --to ADDR (--body-file P|--body-stdin) [--approval-token TOK]
  mark-read   <id>[,id...]
  mark-unread <id>[,id...]
  move <id> --to-mailbox NAME [--account NAME]
`,
  );
}

// ─────────────────────────────── Main ───────────────────────────────

async function main(): Promise<void> {
  cleanupStaleTokens();

  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  const rest = argv.slice(1);
  const flags = parseFlags(rest);
  const positional = rest.filter((a) => !a.startsWith("--") && rest[rest.indexOf(a) - 1]?.startsWith("--") !== true);

  // Re-derive positional more reliably:
  const positionals: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) i++;
      continue;
    }
    positionals.push(a);
  }

  switch (cmd) {
    case "accounts": {
      const raw = osa(scriptAccounts());
      const data = parsePipes(raw, ["name", "email"]);
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "mailboxes": {
      const raw = osa(scriptMailboxes(flags.account as string | undefined));
      const data = parsePipes(raw, ["account", "name", "unreadCount", "totalCount"]).map((r) => ({
        ...r,
        unreadCount: Number(r.unreadCount),
        totalCount: Number(r.totalCount),
      }));
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "unread": {
      const limit = Number(flags.limit ?? 20);
      const raw = osa(scriptUnread(flags.account as string | undefined, limit));
      const data = parsePipes(raw, [
        "id",
        "account",
        "mailbox",
        "from",
        "subject",
        "dateReceived",
        "snippet",
      ]);
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "list": {
      const mailbox = positionals[0];
      if (!mailbox) throw new Error("list requires <mailbox>");
      const limit = Number(flags.limit ?? 50);
      const raw = osa(scriptList(mailbox, flags.account as string | undefined, limit));
      const data = parsePipes(raw, [
        "id",
        "account",
        "mailbox",
        "from",
        "subject",
        "dateReceived",
        "snippet",
      ]);
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "search": {
      const query = positionals[0];
      if (!query) throw new Error('search requires "<query>"');
      const limit = Number(flags.limit ?? 20);
      const includeJunk = flags["include-junk"] === true;
      const raw = osa(scriptSearch(query, flags.account as string | undefined, limit, includeJunk));
      const data = parsePipes(raw, [
        "id",
        "account",
        "mailbox",
        "from",
        "subject",
        "dateReceived",
        "snippet",
      ]);
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "filters": {
      process.stdout.write(
        JSON.stringify(
          {
            skip_mailboxes: getSkipMailboxes(),
            override_env: "PAI_APPLE_MAIL_INCLUDE_MAILBOXES",
            override_flag: "--include-junk",
            applies_to: ["search"],
            note: "unread already restricted to INBOX/Inbox; list/count/fetch operate on explicit mailbox names",
          },
          null,
          2,
        ) + "\n",
      );
      return;
    }
    case "fetch": {
      const id = positionals[0];
      if (!id) throw new Error("fetch requires <id>");
      const raw = osa(scriptFetch(id, flags.full === true));
      const obj: Record<string, string> = {};
      let body = "";
      let inBody = false;
      for (const line of raw.split(/\r?\n/)) {
        if (line === "---BODY---") {
          inBody = true;
          continue;
        }
        if (inBody) {
          body += line + "\n";
          continue;
        }
        const m = line.match(/^([A-Z]+): (.*)$/);
        if (m) obj[m[1].toLowerCase()] = m[2];
      }
      if (flags.full === true) obj.body = body.trim();
      process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
      return;
    }
    case "count": {
      const mailbox = positionals[0];
      if (!mailbox) throw new Error("count requires <mailbox>");
      const raw = osa(
        scriptCount(mailbox, flags.account as string | undefined, flags["unread-only"] === true),
      );
      process.stdout.write(
        JSON.stringify({ mailbox, account: flags.account ?? null, count: Number(raw.trim()) }, null, 2) +
          "\n",
      );
      return;
    }
    case "drafts": {
      const limit = Number(flags.limit ?? 20);
      // Drafts mailbox exists per-account; list across all accounts.
      const raw = osa(scriptList("Drafts", undefined, limit));
      const data = parsePipes(raw, [
        "id",
        "account",
        "mailbox",
        "from",
        "subject",
        "dateReceived",
        "snippet",
      ]);
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      return;
    }
    case "status": {
      let running = false;
      let accountCount = 0;
      let totalUnread = 0;
      try {
        const raw = osa(scriptStatus()).trim();
        const [state, acctN, tot] = raw.split("|");
        running = state === "running";
        accountCount = Number(acctN);
        totalUnread = Number(tot);
      } catch {
        running = false;
      }
      process.stdout.write(JSON.stringify({ running, accountCount, totalUnread }, null, 2) + "\n");
      return;
    }
    case "draft": {
      ensureMailRunning();
      const env: Envelope = {
        kind: "send",
        to: flags.to as string,
        cc: flags.cc as string | undefined,
        bcc: flags.bcc as string | undefined,
        subject: flags.subject as string,
        body: readBody(flags),
        html: flags.html === true,
        account: flags.account as string | undefined,
      };
      const draftId = osa(scriptSend(env, "save")).trim();
      audit({ event_type: "apple_mail_drafted", to: env.to, subject: env.subject, draftId });
      process.stdout.write(JSON.stringify({ draftId, status: "drafted" }, null, 2) + "\n");
      return;
    }
    case "send": {
      if (typeof flags["approval-token"] === "string") {
        await consumeApprovalToken(flags["approval-token"] as string);
        return;
      }
      const env: Envelope = {
        kind: "send",
        to: flags.to as string,
        cc: flags.cc as string | undefined,
        bcc: flags.bcc as string | undefined,
        subject: flags.subject as string,
        body: readBody(flags),
        html: flags.html === true,
        account: flags.account as string | undefined,
      };
      if (!env.to || !env.subject) {
        throw new Error("send requires --to and --subject (or use --approval-token TOK to resume)");
      }
      await gateAndStage(env);
      return;
    }
    case "reply": {
      if (typeof flags["approval-token"] === "string") {
        await consumeApprovalToken(flags["approval-token"] as string);
        return;
      }
      const replyId = positionals[0];
      if (!replyId) throw new Error("reply requires <id>");
      const env: Envelope = {
        kind: "reply",
        body: readBody(flags),
        replyToId: replyId,
        replyAll: flags["reply-all"] === true,
      };
      await gateAndStage(env);
      return;
    }
    case "forward": {
      if (typeof flags["approval-token"] === "string") {
        await consumeApprovalToken(flags["approval-token"] as string);
        return;
      }
      const fwdId = positionals[0];
      if (!fwdId) throw new Error("forward requires <id>");
      const env: Envelope = {
        kind: "forward",
        to: flags.to as string,
        body: readBody(flags),
        forwardId: fwdId,
      };
      if (!env.to) throw new Error("forward requires --to");
      await gateAndStage(env);
      return;
    }
    case "mark-read":
    case "mark-unread": {
      ensureMailRunning();
      const ids = (positionals[0] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) throw new Error(`${cmd} requires <id>[,<id>...]`);
      const read = cmd === "mark-read";
      osa(scriptMarkRead(ids, read));
      audit({ event_type: `apple_mail_${cmd}`, ids });
      process.stdout.write(JSON.stringify({ status: "ok", ids, read }, null, 2) + "\n");
      return;
    }
    case "move": {
      ensureMailRunning();
      const id = positionals[0];
      const targetMailbox = flags["to-mailbox"] as string;
      if (!id || !targetMailbox) throw new Error("move requires <id> and --to-mailbox NAME");
      osa(scriptMove(id, targetMailbox, flags.account as string | undefined));
      audit({ event_type: "apple_mail_moved", id, targetMailbox, account: flags.account });
      process.stdout.write(JSON.stringify({ status: "moved", id, targetMailbox }, null, 2) + "\n");
      return;
    }
    default: {
      process.stderr.write(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(2);
    }
  }
}

main().catch((e) => {
  process.stderr.write(JSON.stringify({ error: (e as Error).message, code: "runtime_error" }) + "\n");
  process.exit(1);
});
