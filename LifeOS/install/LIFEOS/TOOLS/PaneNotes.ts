/**
 * PaneNotes.ts — one line saying what another session last said (FUNCTIONHOOKS ISC-206/207).
 *
 * The LifeOSHooks band lists the other herdr sessions that need the principal. For each it shows one line from the
 * session's own transcript: what a blocked session is waiting on (the tool it wants to run, or the question it asked),
 * or the closer a finished session ended on. Read-only; reads only the tail of each transcript.
 * `HookBridge pane-notes` is the caller.
 */
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { closerPattern } from "../../hooks/lib/identity";
import { getClaudeDir } from "./Paths";
import { stripVoiceTags } from "./VoiceTags";

const TAIL_BYTES = 256 * 1024;
const MAX_NOTE = 140;

/** The transcript of a session id, searched across every project folder. */
export function transcriptPath(sessionId: string, projectsDir = join(getClaudeDir(), "projects")): string | null {
  if (!/^[0-9a-f-]{36}$/.test(sessionId) || !existsSync(projectsDir)) return null;
  for (const dir of readdirSync(projectsDir)) {
    const p = join(projectsDir, dir, `${sessionId}.jsonl`);
    if (existsSync(p)) return p;
  }
  return null;
}

function tailLines(path: string): string[] {
  const size = statSync(path).size;
  const start = Math.max(0, size - TAIL_BYTES);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, "r");
  try { readSync(fd, buf, 0, buf.length, start); } finally { closeSync(fd); }
  const lines = buf.toString("utf8").split("\n");
  if (start > 0) lines.shift(); // a cut first line
  return lines.filter(Boolean);
}

function oneLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > MAX_NOTE ? `${t.slice(0, MAX_NOTE - 1).trimEnd()}…` : t;
}

type Block = { type?: string; text?: string; name?: string; input?: Record<string, unknown> };

/** What a pending tool call asks for, in a few words: the question, the command, or the file. */
export function toolAsk(name: string, input: Record<string, unknown> = {}): string {
  if (name === "AskUserQuestion") {
    const q = (input.questions as Array<{ question?: string }> | undefined)?.[0]?.question;
    if (q) return oneLine(q);
  }
  const raw = input.command ?? input.file_path ?? input.url ?? input.description ?? input.prompt;
  // A leading `cd <dir> &&` says where, not what; the command after it is the ask.
  const arg = typeof raw === "string" ? raw.replace(/^\s*cd\s+\S+\s*&&\s*/, "") : raw;
  return oneLine(typeof arg === "string" ? `${name}: ${arg}` : `${name}`);
}

/** The closer of an answer (the line after `🗣️ <name>:`), else its last non-empty line. */
export function closerOf(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = new RegExp(`^${closerPattern()}\\s*[^:]{1,24}:\\s*(.+)$`, "u").exec(lines[i]!);
    if (m) return oneLine(stripVoiceTags(m[1]!));
  }
  return lines.length ? oneLine(lines[lines.length - 1]!) : null;
}

/** The note for one session: what it waits on when blocked, how it ended when done. */
export function paneNote(sessionId: string, status: string, projectsDir?: string): string | null {
  const p = transcriptPath(sessionId, projectsDir);
  if (!p) return null;
  const lines = tailLines(p);
  for (let i = lines.length - 1; i >= 0; i--) {
    let row: { type?: string; message?: { role?: string; content?: unknown } };
    try { row = JSON.parse(lines[i]!); } catch { continue; }
    if (row.type !== "assistant" || !Array.isArray(row.message?.content)) continue;
    const blocks = row.message!.content as Block[];
    if (status === "blocked") {
      const tool = [...blocks].reverse().find((b) => b.type === "tool_use" && b.name);
      if (tool) return toolAsk(tool.name!, tool.input);
    }
    const text = blocks.filter((b) => b.type === "text" && b.text).map((b) => b.text).join("\n");
    if (text.trim()) return closerOf(text);
  }
  return null;
}

/** Notes for several sessions at once, keyed by session id; unreadable sessions are left out. */
export function paneNotes(items: Array<{ session: string; status: string }>, projectsDir?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const it of items.slice(0, 12)) {
    try { const n = paneNote(it.session, it.status, projectsDir); if (n) out[it.session] = n; } catch { /* skip */ }
  }
  return out;
}
