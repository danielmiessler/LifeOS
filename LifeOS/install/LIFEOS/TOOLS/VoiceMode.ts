#!/usr/bin/env bun
/**
 * VoiceMode — talk with the DA inside a live Claude Code session.
 *
 * Voice mode is per session. While it is on:
 *   - every prompt carries an instruction (hooks/VoiceMode.hook.ts) to end the reply with a
 *     `🎙️ SPOKEN:` field written for the ear, and to work the session's ISA one question at a time;
 *   - the Stop-time speech path speaks that field instead of the 🗣️ closer (spokenLine);
 *   - playback is interruptible: the voice server stops it when a talk mic opens, and a
 *     submitted prompt stops it too.
 * With voice mode off, spokenLine returns exactly what the closer path returned before.
 *
 *   bun VoiceMode.ts on|off|toggle|status [--session <id>]   (default: $CLAUDE_CODE_SESSION_ID)
 *   bun VoiceMode.ts bench [--runs 5]                        time from /notify to audio start
 *
 * Doc: LIFEOS/DOCUMENTATION/VoiceMode/VoiceMode.md
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { closerPattern, getCloserEmoji } from "../../hooks/lib/identity";
import { invariant } from "./Invariant";
import { PULSE_BASE } from "../PULSE/endpoint";

const LIFEOS_ROOT = resolve(import.meta.dir, "..");

/** Spoken text must fit the voice server's 500-character limit (voice.ts validateInput). */
export const SPOKEN_MAX = 480;

export function stateDir(): string {
  return process.env.LIFEOS_VOICE_MODE_DIR ?? join(LIFEOS_ROOT, "MEMORY", "STATE", "voice-mode");
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function statePath(sessionId: string): string {
  invariant(SAFE_ID.test(sessionId), `voice mode: unsafe session id ${JSON.stringify(sessionId)}`);
  return join(stateDir(), `${sessionId}.json`);
}

export function isOn(sessionId: string | undefined | null): boolean {
  if (!sessionId || !SAFE_ID.test(sessionId)) return false;
  return existsSync(join(stateDir(), `${sessionId}.json`));
}

export function setOn(sessionId: string, now: Date = new Date()): void {
  const p = statePath(sessionId);
  mkdirSync(stateDir(), { recursive: true });
  writeFileSync(p, JSON.stringify({ session_id: sessionId, on: true, since: now.toISOString() }) + "\n");
  invariant(isOn(sessionId), `voice mode: state for ${sessionId} not readable after write`);
}

export function setOff(sessionId: string): void {
  rmSync(statePath(sessionId), { force: true });
  invariant(!isOn(sessionId), `voice mode: state for ${sessionId} still present after removal`);
}

// ── Spoken text ───────────────────────────────────────────────────────────────

// The field label must start its own line, so a reply that mentions the marker in
// prose or backticks never matches (Fable review, 2026-10-03: an inline mention used
// to swallow the real field and get spoken instead).
const SPOKEN_LABEL_RE = /(?:^|\n)[ \t]*🎙️?[ \t]*\*{0,2}SPOKEN:\*{0,2}[ \t]*/g;
const closerRe = (): RegExp => new RegExp(`\\n[ \\t]*${closerPattern()}`);

/** Plain speech from a markdown-ish block: no code, links, emphasis or bullets. */
export function toSpeech(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The last `🎙️ SPOKEN:` field in a reply, as plain speech, or "" when absent. */
export function extractSpoken(text: string): string {
  const labels = [...text.matchAll(SPOKEN_LABEL_RE)];
  const last = labels[labels.length - 1];
  if (!last) return "";
  const body = text.slice(last.index! + last[0].length);
  const end = body.search(closerRe());
  return toSpeech(end >= 0 ? body.slice(0, end) : body);
}

/** Fit speech under `max` characters, cutting at the last sentence end that fits. */
export function fitSpoken(text: string, max: number = SPOKEN_MAX): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const ends = [...head.matchAll(/[.!?](?=\s|$)/g)];
  const cut = ends.length ? ends[ends.length - 1].index! + 1 : -1;
  if (cut >= Math.floor(max / 3)) return head.slice(0, cut).trim();
  const space = head.lastIndexOf(" ");
  return `${head.slice(0, space > 0 ? space : max).trim()}.`;
}

/**
 * What the Stop path should say for this reply. Voice mode off: exactly `closer(answer)`,
 * unchanged from before voice mode existed. Voice mode on: the SPOKEN field, fitted; the
 * closer when the reply has none, never a fallback summary.
 */
export function spokenLine(
  sessionId: string | undefined | null,
  answer: string,
  closer: (text: string) => string,
  // Voice mode's fallback: the bare 🗣️ line, never a summary guessed from the body.
  voiceCloser: (text: string) => string = closer,
): { text: string; interruptible: boolean; source: "closer" | "spoken" } {
  if (!isOn(sessionId)) return { text: closer(answer), interruptible: false, source: "closer" };
  const spoken = extractSpoken(answer);
  if (spoken) return { text: fitSpoken(spoken), interruptible: true, source: "spoken" };
  return { text: fitSpoken(toSpeech(voiceCloser(answer))), interruptible: true, source: "closer" };
}

// ── The per-prompt instruction ───────────────────────────────────────────────

export function instruction(isaPath: string | null): string {
  const lines = [
    "VOICE MODE is on for this session (LIFEOS/DOCUMENTATION/VoiceMode/VoiceMode.md). The principal is listening and answers by dictation.",
    `- Write the terminal answer as usual. Then, directly above the ${getCloserEmoji()} closer, add a \`🎙️ SPOKEN:\` field: two to five plain sentences written for the ear, carrying the point and the one thing you need from them. No code, file paths, tables, lists or markdown in it, and under 480 characters. It is spoken instead of the closer.`,
    "- Their prompts are dictated, so read through transcription slips. If a word that changes the meaning is unclear (do or don't, yes or no), ask before acting on it.",
  ];
  if (isaPath) {
    lines.push(
      `- The session's ISA is ${isaPath}. Work it as a spoken interview: ask exactly one question per turn about its open decisions or fog, lead with your recommendation, and never ask for what you can look up.`,
      "- Append each answer to the ISA's `## Articulation Log` the same turn. Each entry quotes the question you asked, their verbatim transcript, and the recommendation they were answering. Then fold settled decisions into the ladder, criteria or Decisions.",
    );
  }
  return lines.join("\n");
}

// ── Voice server checks (warn on silent degradation) ─────────────────────────

export async function serverWarnings(base: string = PULSE_BASE, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  try {
    const res = await fetchImpl(`${base}/voice/mute`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [`voice server answered ${res.status}; you may not hear me`];
    const body = (await res.json()) as { muted?: boolean };
    return body.muted ? ["voice is muted (⇧⌘M or the Pulse menu to unmute); you will not hear me"] : [];
  } catch {
    return [`voice server unreachable at ${base}; you will not hear me until Pulse is running`];
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function bench(runs: number): Promise<void> {
  const text = "This is a timing run for voice mode. It measures how long it takes from the moment a turn ends to the moment you hear the first word. A spoken reply is usually a few sentences long, so this one is about that size. It should begin within a few seconds, and then it will be cut off on purpose. Nothing else changes.";
  const times: number[] = [];
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    const req = fetch(`${PULSE_BASE}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Voice mode bench", message: text, interruptible: true }),
    });
    let started = -1;
    while (performance.now() - t0 < 15000) {
      const ps = Bun.spawnSync(["pgrep", "-f", "afplay .*voice-"]).stdout.toString().trim();
      if (ps) { started = performance.now() - t0; break; }
      await Bun.sleep(25);
    }
    await fetch(`${PULSE_BASE}/voice/stop`, { method: "POST" }).catch(() => {});
    await req.catch(() => {});
    console.log(`run ${r + 1}: ${started < 0 ? "no audio within 15 s" : `${Math.round(started)} ms`}`);
    if (started >= 0) times.push(started);
    await Bun.sleep(500);
  }
  times.sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : NaN;
  console.log(JSON.stringify({ runs, measured: times.length, median_ms: Math.round(median) }));
  process.exit(times.length === runs && median < 4000 ? 0 : 1);
}

async function main(): Promise<void> {
  // Bare `/voice` passes no argument and means toggle; flags start with "--".
  const first = process.argv[2];
  const cmd = !first || first.startsWith("--") ? "toggle" : first;
  if (cmd === "bench") return bench(Number(arg("--runs") ?? 5));
  const session = arg("--session") ?? process.env.CLAUDE_CODE_SESSION_ID ?? "";
  if (!SAFE_ID.test(session)) {
    console.error("voice mode: no session id (pass --session or run inside Claude Code)");
    process.exit(2);
  }
  let on = isOn(session);
  if (cmd === "on" || (cmd === "toggle" && !on)) { setOn(session); on = true; }
  else if (cmd === "off" || (cmd === "toggle" && on)) { setOff(session); on = false; }
  else if (cmd !== "status") { console.error(`voice mode: unknown command ${cmd}`); process.exit(2); }
  console.log(`voice mode ${on ? "ON" : "OFF"} for session ${session}`);
  if (on && cmd !== "status") for (const w of await serverWarnings()) console.log(`warning: ${w}`);
}

if (import.meta.main) await main();
