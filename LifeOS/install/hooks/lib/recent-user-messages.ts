/**
 * recent-user-messages.ts — the principal's last few text messages from a Claude Code JSONL transcript.
 *
 * Used by the opt-in embedding leg of per-turn memory retrieval (public issue #2207): the query is
 * embedded together with the previous user messages, because a short turn ("and the worker?") only
 * makes sense in its conversation. Measured on a held-out set of 70 real turns: prompt + 3 previous
 * messages found the expected note in 31/45 turns vs 17/45 for the prompt alone (McNemar p = 0.0005).
 *
 * Skips tool results, task notifications, system reminders, hook output, slash-command echoes, and
 * isMeta / sidechain entries. Reads only the transcript's tail. Never throws; any error returns [].
 */
import { openSync, readSync, fstatSync, closeSync } from "node:fs";

const TAIL_BYTES = 2_000_000;
const NOISE = /^\s*<(task-notification|system-reminder|command-name|command-message|command-args|local-command|lifeos-|user-prompt-submit-hook|bash-input|bash-stdout|bash-stderr)/i;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("\n");
}

/** Up to `n` previous user text messages, oldest first, each capped at `maxChars`. */
export function recentUserMessages(transcriptPath: string | undefined, n = 3, currentPrompt = "", maxChars = 600): string[] {
  if (!transcriptPath) return [];
  try {
    const fd = openSync(transcriptPath, "r");
    let raw: string;
    try {
      const size = fstatSync(fd).size;
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      readSync(fd, buf, 0, buf.length, start);
      raw = buf.toString("utf8");
    } finally { closeSync(fd); }
    const lines = raw.split("\n");
    if (raw.length >= TAIL_BYTES) lines.shift(); // the first line may be cut
    const msgs: string[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      let o: any;
      try { o = JSON.parse(line); } catch { continue; }
      if (o?.type !== "user" || o.isMeta || o.isSidechain) continue;
      const t = textOf(o.message?.content).trim();
      if (!t || NOISE.test(t)) continue;
      msgs.push(t);
    }
    // the transcript may already hold the current prompt as its last entry
    const cur = currentPrompt.trim();
    if (cur && msgs.length && msgs[msgs.length - 1] === cur) msgs.pop();
    return msgs.slice(-n).map((m) => m.slice(0, maxChars));
  } catch { return []; }
}

/** The previous messages as one block, newest first: what the embedding leg embeds after the prompt. */
export function conversationContext(prompt: string, transcriptPath: string | undefined): string {
  return recentUserMessages(transcriptPath, 3, prompt).reverse().join("\n");
}

