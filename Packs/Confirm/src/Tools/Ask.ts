#!/usr/bin/env bun
/**
 * Ask.ts — yes/no approval gate via @<DA>_bot inline keyboard.
 *
 * Sends a Telegram message with buttons, waits for a tap, edits the message
 * to remove the keyboard + reflect the choice, prints the result as JSON.
 *
 * Usage:
 *   bun run Ask.ts "<question>" [--buttons "A,B,C"] [--timeout-ms N]
 *
 * Exit:
 *   0 = user tapped, JSON on stdout
 *   2 = timeout
 *   1 = error
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// The helper is resolved at runtime so this tool works whether it lives in
// the source repo (Packs/Confirm/src/Tools/) or installed at
// ~/.claude/skills/Confirm/Tools/. The helper itself is at
// ~/.claude/PAI/TOOLS/TelegramCallbacks.ts after install.
const helperPath = join(process.env.HOME ?? "", ".claude", "PAI", "TOOLS", "TelegramCallbacks.ts");
if (!existsSync(helperPath)) {
  process.stderr.write(`Missing helper at ${helperPath}. Install PAI v5.0.0+.\n`);
  process.exit(1);
}
const { waitForCallback } = (await import(helperPath)) as typeof import("../../../../Releases/v5.0.0/.claude/PAI/TOOLS/TelegramCallbacks");

interface Args {
  question: string;
  buttons: string[];
  timeoutMs: number;
  callbacksPath?: string;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    process.stderr.write(`usage: Ask.ts "<question>" [--buttons "A,B,C"] [--timeout-ms N]\n`);
    process.exit(1);
  }
  const out: Args = { question: args[0], buttons: ["Approve", "Reject", "Defer"], timeoutMs: 15 * 60 * 1000 };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--buttons" && args[i + 1]) {
      out.buttons = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (a === "--timeout-ms" && args[i + 1]) {
      out.timeoutMs = Number(args[++i]);
      if (!Number.isFinite(out.timeoutMs) || out.timeoutMs < 1000) {
        process.stderr.write(`bad --timeout-ms\n`);
        process.exit(1);
      }
    } else if (a === "--callbacks-path" && args[i + 1]) {
      out.callbacksPath = args[++i];
    }
  }
  if (out.buttons.length < 2 || out.buttons.length > 4) {
    process.stderr.write(`--buttons must be 2-4 labels\n`);
    process.exit(1);
  }
  return out;
}

function loadEnv(): { token: string; chatId: string } {
  // process.env takes precedence over .env file (lets callers override per-call
  // without mutating ~/.claude/.env, useful for tests and isolation).
  let token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  let chatId = (process.env.TELEGRAM_ALLOWED_USERS ?? "").split(",")[0]?.trim() ?? "";

  if (!token || !chatId) {
    const envPath = join(process.env.HOME ?? "", ".claude", ".env");
    if (existsSync(envPath)) {
      const fileEnv: Record<string, string> = {};
      for (const line of readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) fileEnv[m[1]] = m[2].trim();
      }
      if (!token) token = fileEnv.TELEGRAM_BOT_TOKEN ?? "";
      if (!chatId) chatId = (fileEnv.TELEGRAM_ALLOWED_USERS ?? "").split(",")[0]?.trim() ?? "";
    }
  }

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing (set env var or ~/.claude/.env)");
  if (!chatId) throw new Error("TELEGRAM_ALLOWED_USERS missing (set env var or ~/.claude/.env)");
  return { token, chatId };
}

async function tg<T = any>(token: string, method: string, body: object): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; description?: string; result?: T };
  if (!j.ok) throw new Error(`tg ${method} failed: ${j.description ?? r.status}`);
  return j.result as T;
}

async function main() {
  const args = parseArgs(process.argv);
  const { token, chatId } = loadEnv();
  const uuid = randomUUID();

  const inline_keyboard = [args.buttons.map((label) => ({
    text: label,
    callback_data: `${label.toLowerCase()}:${uuid}`,
  }))];

  const sent = await tg<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: args.question,
    reply_markup: { inline_keyboard },
  });

  const cb = await waitForCallback({
    timeoutMs: args.timeoutMs,
    predicate: (e) => e.data.endsWith(`:${uuid}`),
    path: args.callbacksPath,
  });

  if (!cb) {
    await tg(token, "editMessageText", {
      chat_id: chatId,
      message_id: sent.message_id,
      text: `${args.question}\n\n⏱ Timeout — no response.`,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => undefined);
    process.exit(2);
  }

  const action = cb.data.split(":")[0];
  const labelMatch = args.buttons.find((b) => b.toLowerCase() === action) ?? action;

  await tg(token, "editMessageText", {
    chat_id: chatId,
    message_id: sent.message_id,
    text: `${args.question}\n\n→ ${labelMatch}`,
    reply_markup: { inline_keyboard: [] },
  }).catch(() => undefined);

  process.stdout.write(JSON.stringify({
    action,
    data: cb.data,
    fromId: cb.fromId,
    timestamp: cb.timestamp,
  }) + "\n");
}

main().catch((e: unknown) => {
  process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
