#!/usr/bin/env bun
/**
 * @version 1.4.3
 * FormatGate.hook.ts — deterministic Stop-hook teeth for the LifeOS output
 * format (system prompt § Output Format).
 *
 * WHY (2026-07-11): the unified output format has a voice/layout nudge
 * (DriftReminder, UserPromptSubmit) but that fires one turn LATE and has no
 * teeth. This gate CHECKS, at Stop, the STRUCTURAL rules that are
 * deterministically verifiable without an LLM:
 *   1. (retired 2026-10-01, system prompt v3.16.0) the banner is no longer required.
 *   2. `🗣️` closer is the last visible line.
 *   3. When a <lifeos-memory-delta> arrived this turn, a `🧠 MEMORY:` line exists.
 *   3b. When a <lifeos-system-delta> arrived this turn, a `⚙️ SYSTEM:` line exists.
 *   4. No more than 2 em-dashes in prose (code/blockquote stripped).
 *   5. A blank line between bullets at the same level (2026-10-26).
 *
 * FLAG-ONLY (2026-09-21, hook minimization, principal-ratified): the gate never
 * blocks. It ran observation-only from 07-12 to 08-17, then blocked on the third
 * consecutive missing banner or closer; that block kept holding finished answers
 * over their frame and is gone. Every violation is a flag in the log, which
 * DriftReminder reads on the next prompt.
 *
 * NON-GOALS: length, paragraph density, voice/vocabulary — not reliably
 *deterministic; those stay DriftReminder + judgment.
 *
 * SAFETY: honors stop_hook_active (loop guard → continue). Fails OPEN on any
 * error or empty message. Never re-emits. Hot-path, no network, no LLM.
 *
 * TRIGGER: Stop. Register in USER/CONFIG/settings.user.json Stop array.
 */

import { readHookInput, parseTranscriptFromInput } from "./lib/hook-io";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { closerPattern, getCloserEmoji } from "./lib/identity";
import { getLifeosDir } from "./lib/paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { hookDrawn } from "./lib/function-hooks";
import { EM_DASH_MAX, packedBulletPairs } from "./lib/format-caps"; // public issue #2166, @IvanLeontev-stack
import { stripVoiceTags } from "../LIFEOS/TOOLS/VoiceTags";
import { recordGateRun } from "../LIFEOS/TOOLS/GateReach";

// Normalize env path vars Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

const LIFEOS_DIR = getLifeosDir();
const OBS_PATH = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "format-gate.jsonl");

export interface FormatViolation {
  code: "no-closer" | "closer-too-long" | "missing-memory-line" | "missing-system-line" | "too-many-emdashes" | "da-placeholder" | "open-item-length" | "agents-line" | "packed-bullets";
  detail: string;
}

/**
 * The 🗣️ closer is spoken verbatim by Fish (VoiceCompletion → VoiceServer).
 * A long spoken line is dead air, so the text after the
 * `🗣️ <DA>:` prefix is capped. Doctrine home: DA_IDENTITY.md § "The 🗣️ closer".
 */
export const CLOSER_MAX_CHARS = 110;

/**
 * ❓ OPEN items are 4–8 words each. Doctrine home: system
 * prompt § Output Format. Words are whitespace-separated tokens after the
 * `N.` marker and markdown emphasis are stripped.
 */
export const OPEN_ITEM_MIN_WORDS = 4;
export const OPEN_ITEM_MAX_WORDS = 8;

/**
 * The 🤖 AGENTS field is one line of at most this many characters, label included, so agent activity stays
 * compact (2026-10-11). Doctrine home: system prompt § Output Format.
 */
export const AGENTS_LINE_MAX_CHARS = 120;

/** Why the 🤖 AGENTS field breaks its one-short-line contract, or null when it holds or is absent. Pure. */
export function agentsLineProblem(message: string): string | null {
  const lines = stripNonProse(message).split("\n").map((l) => l.trim());
  // Only the field itself (label plus colon) counts; prose that merely names the field is not the field.
  const at = lines.map((l, i) => (l.startsWith("🤖 AGENTS:") ? i : -1)).filter((i) => i >= 0);
  if (at.length === 0) return null;
  if (at.length > 1) return `${at.length} 🤖 AGENTS lines (one allowed)`;
  const line = lines[at[0]];
  if (!/^🤖 AGENTS:\s*\S/.test(line)) return "the 🤖 AGENTS label has no content on its own line";
  if ([...line].length > AGENTS_LINE_MAX_CHARS) return `the 🤖 AGENTS line is ${[...line].length} chars (cap ${AGENTS_LINE_MAX_CHARS})`;
  // The field is followed by a blank line or by the next field (the closer, SPOKEN, or a hook line); anything else is a spill.
  const next = lines[at[0] + 1] ?? "";
  if (next && !new RegExp(`^(?:${closerPattern()}|🎙️|⚙️|🧠)`, "u").test(next)) return "the 🤖 AGENTS field runs onto a second line";
  return null;
}

/** Word counts of the numbered items under the final `❓ OPEN` field. Pure. */
export function openItemWordCounts(message: string): number[] {
  const at = message.lastIndexOf("❓ OPEN");
  if (at < 0) return [];
  return message
    .slice(at)
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").replace(/[*_`]/g, "").split(/\s+/).filter(Boolean).length);
}

/**
 * Strip fenced code, inline code, and blockquote lines so structural checks see
 * only authored prose. Em-dashes and banners inside code/quotes are not voice.
 */
export function stripNonProse(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")      // fenced code
    .replace(/`[^`\n]*`/g, " ")            // inline code
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))       // blockquote lines
    .join("\n");
}

/** Visible lines: non-empty after trim, in order. */
function visibleLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

const closerRe = (): RegExp => new RegExp(closerPattern());
// The 🧠 line is action-first since 2026-09-06 ("Do next:" / a delta / a quiet
// "memory N/M fresh"), not the old "MEMORY:" report card. Accept every shape the
// line can take; the legacy prefix stays valid for in-flight transcripts.
const MEMORY_LINE = /🧠\s*(MEMORY\s*:|Do next:|memory\b|\+\d+\s+(learned|dropped))/;
const SYSTEM_LINE = /⚙️?\s*SYSTEM\s*:/;

/**
 * Did a <lifeos-memory-delta> block arrive on THIS turn? Scan only the transcript
 * tail after the last user-role marker so a delta from a prior turn can't force
 * a false block. Bias: when uncertain, do NOT require the line (fail-open).
 */
export function memoryDeltaThisTurn(rawTranscript: string): boolean {
  return deltaThisTurn(rawTranscript, "memory-delta");
}

/** Same turn-scoped scan for the ⚙️ SYSTEM surface. */
export function systemDeltaThisTurn(rawTranscript: string): boolean {
  return deltaThisTurn(rawTranscript, "system-delta");
}

/**
 * Readers accept BOTH prefixes; emitters write only `lifeos-`. A stale in-flight
 * session or a replayed transcript still carries `pai-` blocks, and a gate that
 * only knew the new name would silently stop enforcing the memory line — the
 * exact half-rename failure raised in public issue #1592 / PR #1594
 * (@anikinsasha). Drop the legacy prefix once no `pai-` transcripts remain.
 */
const TAG_PREFIXES = ["lifeos-", "pai-"] as const;

function deltaThisTurn(rawTranscript: string, suffix: string): boolean {
  if (!rawTranscript) return false;
  const lastUser = rawTranscript.lastIndexOf('"role":"user"');
  const region = lastUser >= 0 ? rawTranscript.slice(lastUser) : rawTranscript.slice(-8000);
  return TAG_PREFIXES.some((p) => region.includes(p + suffix));
}

/**
 * Pure structural checker. Returns the FIRST violation (block reasons compose
 * poorly; one clear fix at a time), or null when the message conforms.
 */
export function checkFormat(
  message: string,
  opts: { memoryDelta: boolean; systemDelta?: boolean; hookDrawn?: boolean },
): FormatViolation | null {
  const lines = visibleLines(message);
  if (lines.length === 0) return null; // nothing to gate — fail open

  // No banner check since 2026-10-01 (system prompt v3.16.0): the typed banner was
  // retired after it kept going missing from answers. `hookDrawn` gates only the 🧠/⚙️ lines.
  if (!closerRe().test(lines[lines.length - 1])) {
    return { code: "no-closer", detail: `last visible line is not the ${getCloserEmoji()} closer` };
  }
  // A literal <DA> in the closer's NAME position means identity substitution failed
  // (public PR #2134, @zephyr91). Only the name slot, never the spoken text.
  if (new RegExp(`^${closerPattern()}\\s*<DA>\\s*:`).test(lines[lines.length - 1])) {
    return { code: "da-placeholder", detail: "closer contains literal <DA> placeholder instead of the DA name" };
  }
  // Spoken-length cap: measure only the text after the `🗣️ <name>:` prefix,
  // since that is exactly what extractVoiceCompletion hands to the voice server.
  // Drama 3 tags in the closer are performed, never spoken, so they never count (2026-10-14).
  const spoken = stripVoiceTags(lines[lines.length - 1].replace(new RegExp(`^${closerPattern()}\\s*[^:]{0,24}:\\s*`, "u"), "").trim());
  if (spoken.length > CLOSER_MAX_CHARS) {
    return { code: "closer-too-long", detail: `closer is ${spoken.length} chars spoken aloud (cap ${CLOSER_MAX_CHARS})` };
  }
  const badOpen = openItemWordCounts(message).find((n) => n < OPEN_ITEM_MIN_WORDS || n > OPEN_ITEM_MAX_WORDS);
  if (badOpen !== undefined) {
    return { code: "open-item-length", detail: `an ❓ OPEN item is ${badOpen} words (allowed ${OPEN_ITEM_MIN_WORDS}–${OPEN_ITEM_MAX_WORDS})` };
  }
  const agents = agentsLineProblem(message);
  if (agents) return { code: "agents-line", detail: agents };
  if (opts.memoryDelta && !MEMORY_LINE.test(message)) {
    return { code: "missing-memory-line", detail: "a memory-delta arrived this turn but no 🧠 MEMORY: line was rendered" };
  }
  if (opts.systemDelta && !SYSTEM_LINE.test(message)) {
    return { code: "missing-system-line", detail: "a system-delta arrived this turn but no ⚙️ SYSTEM: line was rendered" };
  }
  const emdashes = (stripNonProse(message).match(/—/g) || []).length;
  if (emdashes > EM_DASH_MAX) {
    return { code: "too-many-emdashes", detail: `${emdashes} em-dashes in prose (max ${EM_DASH_MAX})` };
  }
  const packed = packedBulletPairs(message);
  if (packed > 0) {
    return { code: "packed-bullets", detail: `${packed} bullets with no blank line before them` };
  }
  return null;
}

function appendObs(rec: Record<string, unknown>): void {
  try {
    if (!existsSync(dirname(OBS_PATH))) mkdirSync(dirname(OBS_PATH), { recursive: true });
    appendFileSync(OBS_PATH, JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n", "utf-8");
  } catch { /* observability is best-effort */ }
}

/**
 * Gate entrypoint — matches the StopGates GateFn contract (returns a decision
 * object or null). Fails OPEN on every path: returns null rather than throwing.
 */
export async function run(
  input: NonNullable<Awaited<ReturnType<typeof readHookInput>>>,
): Promise<object | null> {
  try {
    recordGateRun("hook:FormatGate.hook", { result: "executed" });
    if (input.stop_hook_active === true) {
      appendObs({ session_id: input.session_id, decision: "skip-recovery", stop_hook_active: true });
      return null;
    }
    // The banner/closer contract is the TERMINAL format. Headless spawns (scheduled
    // jobs, the texting bridge) deliver plain text to a phone or an email, and a
    // forced re-emit here pushed "════ LifeOS ════" and 🗣️ lines into iMessage
    // replies (2026-09-03 texting probes). Their own output contracts govern.
    if (process.env.LIFEOS_TEXTING_SESSION || process.env.LIFEOS_NOTIFICATION_CHANNEL === "headless") {
      appendObs({ session_id: input.session_id, decision: "skip-headless" });
      return null;
    }

    const parsed = await parseTranscriptFromInput(input);
    // The format contract governs the FINAL message only — mid-turn narration
    // between tool calls is expected and legitimate (system prompt § Output
    // Format), so gate lastMessage, never the concatenated currentResponseText.
    const message = (parsed.lastMessage || "").trim();
    if (!message) return null;

    const drawn = hookDrawn(input.session_id);
    const memoryDelta = memoryDeltaThisTurn(parsed.raw) && !drawn;
    const systemDelta = systemDeltaThisTurn(parsed.raw) && !drawn;
    const violation = checkFormat(message, { memoryDelta, systemDelta, hookDrawn: drawn });

    // Flag-only since 2026-09-21: a finished answer is never held over its frame.
    // The flag feeds DriftReminder and the format-gate log.
    if (violation) {
      appendObs({ session_id: input.session_id ?? "unknown", decision: "flag", code: violation.code, detail: violation.detail });
      return null;
    }

    appendObs({ session_id: input.session_id, decision: "pass", memoryDelta });
    return null;
  } catch (e) {
    appendObs({ session_id: input?.session_id, decision: "error-failopen", error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// Standalone shim — runs only when executed directly, not when imported.
if (import.meta.main) {
  (async () => {
    const input = await readHookInput();
    if (input) {
      const d = await run(input);
      if (d) console.log(JSON.stringify(d));
    }
    process.exit(0);
  })().catch((err) => { console.error("[FormatGate] fatal:", err); process.exit(0); });
}
