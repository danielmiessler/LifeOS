#!/usr/bin/env bun
// Normalize env path vars Claude Code may inject unexpanded — literal $HOME/${HOME}
// in LIFEOS_DIR/LIFEOS_CONFIG_DIR/PROJECTS_DIR resolves to a shadow dir (#1404 / PR #1451, author jbmml).
for (const __k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const __v = process.env[__k];
  if (__v && /^\$\{?HOME\}?(\/|$)/.test(__v)) process.env[__k] = __v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

/**
 * @version 1.6.2
 * TRIGGER: UserPromptSubmit
 * DriftReminder — pre-write format contract for the LifeOS output format.
 *
 * WHY (2026-07-31, the principal): FormatGate went observation-only on 2026-07-11
 * (commit ea6965351) because a Stop hook fires AFTER the text is on screen and
 * can only block, which forces a doubled re-emit. Measured in format-gate.jsonl:
 * violations stayed near zero while it blocked and became a majority of turns
 * every day once it only logged. The teeth were the thing that worked.
 *
 * The principal's fix, and it is the right one: check BEFORE the answer is written,
 * not after. This hook is the only enforcement point that runs pre-generation,
 * so it now emits a per-turn CONTRACT rather than an occasional nudge:
 *   - the line budget for THIS turn (lifted when the prompt asks for depth)
 *   - the structural rules (closer last, em-dash cap; the lone ◆ first line only
 *     where the rich-format mod draws the banner, never elsewhere — 1.6.0)
 *   - what the PREVIOUS response actually broke, measured
 *
 * Every turn, no rate limit. The old MIN_TURNS_BETWEEN_FIRES budget meant the
 * nudge was silent 4 turns out of 5, which is why 80% drift went unnoticed.
 * FormatGate stays as the post-write recorder; this is the pre-write shaper.
 *
 * NOT scaffolding (BLE): every field is a measured number or a deterministic
 * property of an artifact. It states the contract, never how to think.
 *
 * Performance: hot-path hook, no LLM calls, no large reads. Target <20ms.
 * Failure mode: any error logs to stderr and exits 0, never blocking prompts.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { firstBannedHit } from "./lib/banned-vocab";
import { closerPattern, getCloserEmoji } from "./lib/identity";
import { getLifeosDir, getSettingsPath } from "./lib/paths";
import { hookDrawn, hookCovers } from "./lib/function-hooks"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { EM_DASH_MAX, packedBulletPairs } from "./lib/format-caps"; // public issue #2166, @IvanLeontev-stack

// Terminal telemetry only. Headless spawns (the texting bridge, scheduled jobs) must never receive these
// notes — on 2026-09-04 a model-drift warning and a memory-freshness line were relayed into an iMessage reply.
export const HEADLESS = !!(process.env.LIFEOS_TEXTING_SESSION || process.env.LIFEOS_NOTIFICATION_CHANNEL === "headless");
if (import.meta.main && HEADLESS) process.exit(0);


// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


interface HookInput {
  session_id?: string;
  transcript_path?: string;
  prompt?: string;
  user_prompt?: string;
}

interface DriftState {
  last_fired_turn: number;
  turn_count: number;
  last_text: string | null;
  schema_version: 1;
}

const STDIN_TIMEOUT_MS = 300;
// Retained only so the persisted state schema stays readable across the 1.2.0
// change; the contract itself fires every turn (that silence was the bug).
const MIN_TURNS_BETWEEN_FIRES = 5;
// System prompt § Output Format: "often 1-5 lines, and for a question with no
// work attached, rarely more than about fifteen."
const DEFAULT_LINE_CAP = 15;
// The principal asking for depth lifts the cap. His explicit call outranks the
// default; nothing else does.
const DEPTH_RE = /\b(extensive|thorough|comprehensive|exhaustive|deep[\s-]?dive|in[\s-]depth|detailed|long[\s-]form|full (?:analysis|report|breakdown|write[\s-]?up)|go deep|be verbose|everything (?:you|we) (?:know|have))\b/i;
const LIFEOS_DIR = getLifeosDir();
import { readSessionResponse } from "./lib/response-cache";
const STATE_PATH = join(LIFEOS_DIR, "MEMORY", "STATE", "drift-reminder.json");
const INITIAL_STATE: DriftState = {
  last_fired_turn: -MIN_TURNS_BETWEEN_FIRES,
  turn_count: 0,
  last_text: null,
  schema_version: 1,
};
// Measured for history only: the banner is not required since system prompt v3.16.0 (2026-10-01).
// The ═══ substring matches the old `════ LifeOS ═══…` header.
const MODE_BANNERS = ["═══ LifeOS ═══"] as const;

async function readStdinWithTimeout(timeoutMs: number = STDIN_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), timeoutMs);
    process.stdin.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      // 10MB cap — unbounded buffering risked multi-GB allocation on a fast stream (public issue #1533, @christauff)
      if (data.length > 10_000_000) { clearTimeout(timer); try { process.stdin.pause(); } catch { /* closed */ } resolve(data); }
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseHookInput(raw: string): HookInput {
  try {
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    return {
      prompt: typeof record.prompt === "string" ? record.prompt : undefined,
      session_id: typeof record.session_id === "string" ? record.session_id : undefined,
      transcript_path: typeof record.transcript_path === "string" ? record.transcript_path : undefined,
      user_prompt: typeof record.user_prompt === "string" ? record.user_prompt : undefined,
    };
  } catch {
    return {};
  }
}

function loadState(): DriftState {
  try {
    if (!existsSync(STATE_PATH)) return { ...INITIAL_STATE };
    const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as Partial<DriftState>;
    return {
      last_fired_turn: typeof raw.last_fired_turn === "number" ? raw.last_fired_turn : INITIAL_STATE.last_fired_turn,
      turn_count: typeof raw.turn_count === "number" ? raw.turn_count : INITIAL_STATE.turn_count,
      last_text: typeof raw.last_text === "string" ? raw.last_text : null,
      schema_version: 1,
    };
  } catch {
    return { ...INITIAL_STATE };
  }
}

function saveState(state: DriftState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const tmp = `${STATE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, STATE_PATH);
}

function countEmDashes(text: string): number {
  return (text.match(/—/g) ?? []).length;
}

/**
 * Strip fenced code, inline code, and blockquote lines so prose measurements
 * never count a code block's lines or an em-dash inside a shell command or a
 * quoted line (parity with FormatGate.stripNonProse, 2026-08-21). Banned-vocab
 * masking (quotes included) lives in lib/banned-vocab.ts firstBannedHit().
 */
function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

interface FormatMeasure {
  lines: number;
  emDashes: number;
  banner: boolean;
  closer: boolean;
  closerChars: number;
  banned: string | null;
  packedBullets: number;
}

/** Fish speaks the closer verbatim — cap mirrors FormatGate.CLOSER_MAX_CHARS. */
const CLOSER_MAX_CHARS = 110;

/** Spoken chars: text after the `🗣️ <name>:` prefix on the LAST closer line. */
function closerSpokenChars(text: string): number {
  const closers = text.split("\n").filter((l) => new RegExp(closerPattern()).test(l));
  if (closers.length === 0) return 0;
  return closers[closers.length - 1].replace(new RegExp(`^\\s*${closerPattern()}\\s*[^:]{0,24}:\\s*`, "u"), "").trim().length;
}

function measure(text: string): FormatMeasure {
  const prose = stripCode(text);
  return {
    lines: prose.split("\n").filter((l) => l.trim().length > 0).length,
    emDashes: countEmDashes(prose),
    banner: MODE_BANNERS.some((banner) => text.includes(banner)),
    closer: new RegExp(closerPattern()).test(text),
    closerChars: closerSpokenChars(text),
    banned: firstBannedHit(text),
    packedBullets: packedBulletPairs(text),
  };
}

/** What the previous response actually broke, measured. Empty when clean. */
export function breaksIn(m: FormatMeasure, cap: number | null, drawn = false): string[] {
  const out: string[] = [];
  // No banner check since 2026-10-01 (system prompt v3.16.0 retired the typed banner).
  if (!m.closer) out.push("no closer");
  if (m.closerChars > CLOSER_MAX_CHARS) out.push(`closer ${m.closerChars} chars (spoken cap ${CLOSER_MAX_CHARS})`);
  if (m.emDashes > EM_DASH_MAX) out.push(`${m.emDashes} em-dashes`);
  if (m.banned) out.push(`banned word '${m.banned}'`);
  if (m.packedBullets > 0) out.push(`${m.packedBullets} bullets with no blank line before them`);
  if (cap !== null && m.lines > cap) out.push(`${m.lines} lines (cap ${cap})`);
  return out;
}

/**
 * The line budget for THIS turn. Null means the principal asked for depth, so
 * the cap is lifted — his explicit call outranks the default (criterion 15).
 */
function capFor(prompt: string): number | null {
  return DEPTH_RE.test(prompt) ? null : DEFAULT_LINE_CAP;
}

/**
 * Is the rich-format mod switched on in settings.json? It draws only when its plugin is
 * enabled (`enabledPlugins["rich-format@<marketplace>"]`) and its `enabled` userConfig
 * option is not false (default on). Unreadable settings read as off: a stray ◆ on a
 * channel that cannot draw is worse than a missed one, which the mod still covers by
 * drawing the rule above the closer.
 */
export function richFormatOn(settingsPath: string = getSettingsPath()): boolean {
  try {
    const j = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      enabledPlugins?: Record<string, unknown>;
      pluginConfigs?: Record<string, { options?: Record<string, unknown> } | undefined>;
    };
    const keys = Object.keys(j.enabledPlugins ?? {}).filter((k) => /^rich-format@/.test(k) && j.enabledPlugins![k] === true);
    return keys.some((k) => j.pluginConfigs?.[k]?.options?.enabled !== false);
  } catch {
    return false;
  }
}

/**
 * The first-line marker the rich-format mod asks for, read from the mod's own prompt
 * section (FLOW_SECTION_TEXT) rather than restated here, so the contract follows the mod.
 * Null when the mod is absent or its section no longer asks for a marker. Loaded lazily:
 * an undrawn session never pays for the renderer's modules.
 */
export function richFormatMarker(coreModule: string = join(import.meta.dir, "..", "skills", "RichFormat", "hooks", "core.ts")): string | null {
  try {
    if (!existsSync(coreModule)) return null;
    const text = (require(coreModule) as { FLOW_SECTION_TEXT?: unknown }).FLOW_SECTION_TEXT;
    if (typeof text !== "string") return null;
    return /first line holding only `([^`\s]+)`/.exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * The marker for THIS session, or null. The mod draws the banner only in an interactive
 * terminal session that loaded the function-hook runtime — exactly the sessions the
 * LifeOSHooks plugin stamps at session.start (`hookDrawn`; non-interactive sessions are
 * never stamped) — and only while the mod is switched on.
 */
export function bannerMarker(sessionId: string | undefined | null, settingsPath: string = getSettingsPath()): string | null {
  if (!hookDrawn(sessionId)) return null;
  if (!richFormatOn(settingsPath)) return null;
  return richFormatMarker();
}

/**
 * The FORMAT CONTRACT line. `drawn`: the LifeOSHooks plugin logs the ⚙️/🧠 lines this
 * session. `marker`: the rich-format mod draws the banner, so a final answer opens with a
 * lone marker line (system prompt, "The banner is drawn, never typed"); null means a
 * channel that cannot draw, where there is no marker and the answer opens on content.
 */
export function contractLine(cap: number | null, last: FormatMeasure | null, drawn = false, marker: string | null = null): string {
  const budget = cap === null
    ? "depth requested, line cap lifted"
    : `max ${cap} prose lines`;
  const opening = marker
    ? `open a final answer with a lone ${marker} line, then a blank line (the terminal draws the LifeOS bar there; never on an interim note)`
    : "no banner, open on the answer";
  const structure = drawn
    ? `${opening}; the ⚙️/🧠 lines are logged by the harness this session — never type them; ${getCloserEmoji()} closer last (≤${CLOSER_MAX_CHARS} chars — it is spoken aloud), max ${EM_DASH_MAX} em-dashes, a blank line between bullets`
    : `${opening}; ${getCloserEmoji()} closer last (≤${CLOSER_MAX_CHARS} chars — it is spoken aloud), max ${EM_DASH_MAX} em-dashes, a blank line between bullets`;
  const previous = last
    ? (() => {
        const broke = breaksIn(last, cap, drawn);
        return broke.length
          ? ` Last response broke: ${broke.join(", ")}.`
          : ` Last response was clean (${last.lines} lines).`;
      })()
    : "";
  return `FORMAT CONTRACT (check before writing, not after): ${budget}; ${structure}.${previous}`;
}

function emit(line: string): void {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: line },
  }));
}

/** The per-turn FORMAT CONTRACT line, or null on failure. */
export function run(rawInput: Record<string, unknown>): string | null {
  if (HEADLESS) return null;
  try {
    const input = parseHookInput(JSON.stringify(rawInput));
    const prompt = input.prompt || input.user_prompt || "";

    const state = loadState();
    state.turn_count += 1;

    const cap = capFor(prompt);
    const lastResponse = readSessionResponse(input.session_id ?? "");
    let line = contractLine(cap, lastResponse ? measure(lastResponse) : null, hookDrawn(input.session_id), bannerMarker(input.session_id));
    // The delegation line (2026-09-15) is retired (2026-10-16 native-unblock ISC-16): whether to dispatch is
    // Claude Code's own call, and the check read the whole transcript on every prompt.

    // Every turn, no rate limit and no dedupe. A contract that is silent 4
    // turns out of 5 is how daily drift went unnoticed for weeks.
    state.last_fired_turn = state.turn_count;
    state.last_text = line;
    saveState(state);
    return line;
  } catch (err) {
    process.stderr.write(`DriftReminder error: ${(err as Error)?.message || String(err)}\n`);
    return null;
  }
}

if (import.meta.main) {
  const raw = await readStdinWithTimeout();
  let parsed: Record<string, unknown> = {};
  try { parsed = raw.trim() ? JSON.parse(raw) : {}; } catch { /* empty */ }
  // Armed session: runs once inside HookBridge prompt-context instead.
  if (hookCovers(typeof parsed.session_id === "string" ? parsed.session_id : "", "prompt-context")) process.exit(0);
  const line = run(parsed);
  if (line) emit(line);
  process.exit(0);
}
