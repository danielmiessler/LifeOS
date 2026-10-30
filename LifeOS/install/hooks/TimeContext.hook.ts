#!/usr/bin/env bun
/**
 * @version 1.1.0
 * TimeContext.hook.ts — inject a LIVE, per-turn wall-clock line on UserPromptSubmit
 * so the assistant always knows the current time, date, and day of week.
 *
 * Ported from public PR #1511 (credit @anikinsasha). Why: the harness
 * `currentDate` context is date-only and anchored at session start, so on a
 * long-running session it goes stale — the model can believe it is still
 * "morning" hours after midnight, or reason from yesterday's date. This hook
 * recomputes the wall clock every turn and injects it as additionalContext, so
 * the value can never drift within a session.
 *
 * Timezone comes from settings.json `principal.timezone`; falls back to UTC if
 * unset or unreadable. Fails open: any error is swallowed and the turn proceeds
 * without the line — a timestamp is nice-to-have, never worth blocking.
 */
import { readFileSync } from "node:fs";
import { hookCovers } from "./lib/function-hooks";
import { getClaudeDir } from "./lib/paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord

/** The live wall-clock block, or null on any failure (fail open). */
export function run(): string | null {
try {
  let TZ = "UTC";
  try {
    const s = JSON.parse(readFileSync(`${getClaudeDir()}/settings.json`, "utf8"));
    if (s?.principal?.timezone) TZ = s.principal.timezone;
  } catch {
    // keep UTC
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
  }).formatToParts(new Date());
  const g = (t: string): string => parts.find((x) => x.type === t)?.value ?? "";
  const h = Number(g("hour"));
  const rel =
    h < 5 ? "late night" : h < 9 ? "early morning" : h < 12 ? "morning" :
    h < 17 ? "afternoon" : h < 21 ? "evening" : "late night";
  const line = `${g("weekday")} ${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")} ${g("timeZoneName")} (${rel})`;
  return `<time-now>\n🕐 Current time: ${line}\n(The harness date line is date-only and can be stale mid-session — trust this live value.)\n</time-now>\n`;
} catch {
  // fail open — never block a turn over a missing timestamp
  return null;
}
}

if (import.meta.main) {
  let input: { session_id?: string; prompt?: string; prompt_id?: string; transcript_path?: string } = {};
  try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* no stdin */ }
  // The ⏱️ SHAPE line and deadline row (hooks/lib/prompt-shape.ts) go in every session: the plugin draws no shape.
  const { shapeLine } = await import("./lib/prompt-shape");
  const shape = await shapeLine(input.prompt, input.session_id, input.prompt_id || crypto.randomUUID(), { transcriptPath: input.transcript_path });
  // Armed session: the LifeOSHooks plugin writes the time line from $.clock itself.
  // The presence block (hooks/lib/presence-context.ts) rides the same cap: HookBridge prompt-context composes it when armed.
  const covered = hookCovers(input.session_id ?? "", "prompt-context");
  // A texting turn already carries `Now:` in its turn block. The minute here changed every
  // text and sat just before the prompt-cache breakpoint, so each text rewrote ~47k cached tokens.
  const texting = !!process.env.LIFEOS_TEXTING_SESSION;
  const out = covered || texting ? null : run();
  const reach = covered ? null : (await import("./lib/presence-context")).presenceContext();
  if (out || reach || shape) process.stdout.write((out ?? "") + (reach ?? "") + (shape ? `${shape}\n` : ""));
}
