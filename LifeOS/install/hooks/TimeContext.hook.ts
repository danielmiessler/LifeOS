#!/usr/bin/env bun
/**
 * @version 1.0.0
 * TimeContext.hook.ts — inject a LIVE, per-turn wall-clock line on UserPromptSubmit
 * so the assistant always knows the current time, date, and day of week.
 *
 * Why: the harness `currentDate` context is date-only and anchored at session start,
 * so on a long-running session it goes stale — the model can believe it is still
 * "morning" hours after midnight, or reason from yesterday's date. This hook
 * recomputes the wall clock every turn and injects it as additionalContext, so the
 * value can never drift within a session.
 *
 * Timezone comes from settings.json `principal.timezone` (the same source
 * `lib/time.ts` reads); falls back to UTC if unset or unreadable. Read inline so a
 * config hiccup can't break the hook. Fails open: any error is swallowed and the
 * turn proceeds without the line — a timestamp is nice-to-have, never worth blocking.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

try {
  let TZ = "UTC";
  try {
    const s = JSON.parse(readFileSync(`${homedir()}/.claude/settings.json`, "utf8"));
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
  process.stdout.write(
    `<time-now>\n🕐 Current time: ${line}\n(The harness date line is date-only and can be stale mid-session — trust this live value.)\n</time-now>\n`,
  );
} catch {
  // fail open — never block a turn over a missing timestamp
}
