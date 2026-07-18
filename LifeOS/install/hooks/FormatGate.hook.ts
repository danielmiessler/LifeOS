#!/usr/bin/env bun
/**
 * @version 1.0.0
 * FormatGate.hook.ts — deterministic Stop-hook teeth for the LifeOS output
 * format (system prompt § Output Format).
 *
 * WHY (2026-07-11): the unified output format has a voice/layout nudge
 * (DriftReminder, UserPromptSubmit) but that fires one turn LATE and has no
 * teeth. This gate CHECKS, at Stop, the STRUCTURAL rules that are
 * deterministically verifiable without an LLM:
 *   1. Banner `════ LifeOS` is the first visible line.
 *   2. `🗣️` closer is the last visible line.
 *   3. When a <pai-memory-delta> arrived this turn, a `🧠 MEMORY:` line exists.
 *   4. No more than 2 em-dashes in prose (code/blockquote stripped).
 *
 * OBSERVATION-ONLY (2026-07-12): this gate does NOT block. A Stop hook fires
 * AFTER the message is on screen and cannot edit emitted text — its only
 * enforcement move is decision:block, which forces a FULL re-emit of the whole
 * response to add one banner line or drop one em-dash. That re-emit prints the
 * response twice, which is the duplicated-output failure {{PRINCIPAL_NAME}} escalated on
 * hard (blocked ~10× no-banner / ~14× em-dash in a single session before this
 * change). A cosmetic format concern must never cost a doubled response. So the
 * gate logs every violation to format-gate.jsonl (decision:"flag") and returns
 * null. Format compliance reverts to model behavior + the DriftReminder nudge;
 * the telemetry keeps drift visible so we can tune the nudge, not the teeth.
 *
 * NON-GOALS: length, paragraph density, voice/vocabulary — not reliably
 * deterministic; those stay DriftReminder + judgment. Never touches
 * WritingGate/VerificationGate/security hooks (those legitimately block).
 *
 * SAFETY: honors stop_hook_active (loop guard → continue). Fails OPEN on any
 * error or empty message. Never re-emits. Hot-path, no network, no LLM.
 *
 * TRIGGER: Stop. Register in USER/CONFIG/settings.user.json Stop array.
 */

import { readHookInput, parseTranscriptFromInput } from "./lib/hook-io";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { getClaudeDir } from "./lib/paths";

// Normalize env path vars Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

const LIFEOS_DIR = process.env.LIFEOS_DIR || join(getClaudeDir(), "LIFEOS");
const OBS_PATH = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "format-gate.jsonl");

export interface FormatViolation {
  code: "no-banner" | "no-closer" | "missing-memory-line" | "too-many-emdashes";
  detail: string;
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

const BANNER = /════\s*LifeOS/;
const CLOSER = /🗣️/;
const MEMORY_LINE = /🧠\s*MEMORY\s*:/;

/**
 * Did a <pai-memory-delta> block arrive on THIS turn? Scan only the transcript
 * tail after the last user-role marker so a delta from a prior turn can't force
 * a false block. Bias: when uncertain, do NOT require the line (fail-open).
 */
export function memoryDeltaThisTurn(rawTranscript: string): boolean {
  if (!rawTranscript) return false;
  const lastUser = rawTranscript.lastIndexOf('"role":"user"');
  const region = lastUser >= 0 ? rawTranscript.slice(lastUser) : rawTranscript.slice(-8000);
  return region.includes("pai-memory-delta");
}

/**
 * Pure structural checker. Returns the FIRST violation (block reasons compose
 * poorly; one clear fix at a time), or null when the message conforms.
 */
export function checkFormat(message: string, opts: { memoryDelta: boolean }): FormatViolation | null {
  const lines = visibleLines(message);
  if (lines.length === 0) return null; // nothing to gate — fail open

  if (!BANNER.test(lines[0])) {
    return { code: "no-banner", detail: `first visible line is not the LifeOS banner: ${JSON.stringify(lines[0].slice(0, 48))}` };
  }
  if (!CLOSER.test(lines[lines.length - 1])) {
    return { code: "no-closer", detail: "last visible line is not the 🗣️ closer" };
  }
  if (opts.memoryDelta && !MEMORY_LINE.test(message)) {
    return { code: "missing-memory-line", detail: "a pai-memory-delta arrived this turn but no 🧠 MEMORY: line was rendered" };
  }
  const emdashes = (stripNonProse(message).match(/—/g) || []).length;
  if (emdashes > 2) {
    return { code: "too-many-emdashes", detail: `${emdashes} em-dashes in prose (max 2)` };
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
    if (input.stop_hook_active === true) {
      appendObs({ session_id: input.session_id, decision: "skip-recovery", stop_hook_active: true });
      return null;
    }

    const parsed = await parseTranscriptFromInput(input);
    // The format contract governs the FINAL message only — mid-turn narration
    // between tool calls is expected and legitimate (system prompt § Output
    // Format), so gate lastMessage, never the concatenated currentResponseText.
    const message = (parsed.lastMessage || "").trim();
    if (!message) return null;

    const memoryDelta = memoryDeltaThisTurn(parsed.raw);
    const violation = checkFormat(message, { memoryDelta });

    if (violation) {
      // Observation-only: log the drift, never re-emit (see header WHY 2026-07-12).
      appendObs({ session_id: input.session_id, decision: "flag", code: violation.code, detail: violation.detail });
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
