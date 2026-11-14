/**
 * Schedule compilation and the pure clock logic (ISA F8: ISC-24, 27, 116-120).
 *
 * launchd stays the clock. A definition's schedule, interval and once triggers
 * compile to ONE plist per workflow, `com.lifeos.wf.<name>`, whose only job is
 * to wake `dispatcher.ts fire <name>`. The wake-up decides, in the trigger's
 * own timezone, which occurrences are due, so DST never depends on a table
 * baked into the plist: the plist carries the host-local times the wake-ups
 * may land on, and the entrypoint checks the due occurrence with the cron
 * parser in the trigger's timezone. Everything here is pure (dates in, plans
 * out); the file and process effects live in schedule-install.ts and
 * dispatcher.ts.
 */
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { invariant } from "../../TOOLS/Invariant.ts";
import { occurrencesIn, type Occurrence, type TimeTrigger } from "./clock.ts";
import { nextScheduledAt } from "./v1.ts";
import { type DefinitionV2, type TriggerV2, PRINCIPAL_TIMEZONE, v1ScheduleProbe } from "./format.ts";
import { principalTimezone } from "../../TOOLS/lib/Timezone.ts";
import { ZONED_TICK_MINUTES } from "../../TOOLS/lib/ZonedSchedule.ts";

/**
 * The IANA zone a schedule trigger is read in right now. `timezone: principal` is wherever the principal is,
 * from the location service, read at every wake, so an 08:00 schedule is 08:00 where they are (2026-10-22).
 */
export function zoneOf(trigger: { timezone: string }): string {
  return trigger.timezone === PRINCIPAL_TIMEZONE ? principalTimezone() : trigger.timezone;
}
import { ledgerPath, NAME_RE } from "./paths.ts";
import { writeFileAtomic } from "./ledger.ts";

export const LABEL_PREFIX = "com.lifeos.wf.";
/** The channel every scheduled or dispatched run declares, so voice and notification hooks stay silent. */
export const HEADLESS_CHANNEL = "headless";
/** A wake-up this close to an occurrence is "on time"; older ones are catch-ups. */
/** More host-local wake-up slots than this means the plist polls every minute instead. */
export const MAX_SLOTS = 96;
const YEAR_MS = 366 * 86_400_000;
const FIRE_CAP = 2_000;

export class ScheduleCompileError extends Error {}

export type { TimeTrigger } from "./clock.ts";

export function labelFor(name: string): string {
  invariant(NAME_RE.test(name), `"${name}" is not a workflow name`);
  return `${LABEL_PREFIX}${name}`;
}

/**
 * The zone launchd fires in: the system zone behind /etc/localtime (WORKFLOWS ISA ISC-297). Never the process's own
 * zone, which follows TZ: LifeOS shells export TZ for wherever the principal is while the Mac's clock, and launchd,
 * stay on the system zone (a job installed from a shell exporting a different TZ fired hours early until reinstalled).
 * When the link cannot be read, a child with TZ removed reports the system zone; when that fails too, compiling stops,
 * because the process's own zone is exactly the wrong answer this exists to avoid.
 */
export function hostTimeZone(localtime = "/etc/localtime", childZone: () => string = systemZoneFromChild): string {
  const known = (zone: string) => {
    try { return zone.length > 0 && !!new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone; } catch { return false; }
  };
  try {
    const target = readlinkSync(localtime);
    const at = target.lastIndexOf("zoneinfo/");
    const zone = at >= 0 ? target.slice(at + "zoneinfo/".length) : "";
    if (known(zone)) return zone;
  } catch { /* not a link: ask a child that does not inherit TZ */ }
  const zone = childZone().trim();
  if (known(zone)) return zone;
  throw new Error(`Cannot tell the system timezone launchd fires in (${localtime} unreadable, child reported "${zone}"); refusing to compile a calendar in the shell's TZ.`);
}

function systemZoneFromChild(): string {
  const { TZ: _tz, ...env } = process.env;
  const r = Bun.spawnSync([process.execPath, "-e", "process.stdout.write(Intl.DateTimeFormat().resolvedOptions().timeZone)"], { env, stdout: "pipe", stderr: "ignore" });
  return r.exitCode === 0 ? r.stdout.toString() : "";
}

export function defaultPath(home: string = homedir()): string {
  return [join(home, ".bun", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(delimiter);
}

/* ── PATH gate (ISC-118) ────────────────────────────────────────────────── */

function isExecutable(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Where a program resolves under a PATH string, or null. An argv[0] with a slash must be absolute and executable itself. */
export function resolveOnPath(program: string, pathValue: string, executable: (p: string) => boolean = isExecutable): string | null {
  if (program.includes("/")) return isAbsolute(program) && executable(program) ? program : null;
  for (const dir of pathValue.split(delimiter)) {
    if (!dir || !isAbsolute(dir)) continue;
    const candidate = join(dir, program);
    if (executable(candidate)) return candidate;
  }
  return null;
}

/** Every command step's argv[0], by step id. */
export function commandPrograms(def: DefinitionV2): Array<{ step: string; program: string }> {
  return Object.entries(def.steps).flatMap(([id, s]) => (s.kind === "command" && s.argv?.length ? [{ step: id, program: s.argv[0] }] : []));
}

/** Programs that do not resolve under the PATH a plist will declare. */
export function unresolvedPrograms(def: DefinitionV2, pathValue: string, executable?: (p: string) => boolean): Array<{ step: string; program: string }> {
  return commandPrograms(def).filter(p => resolveOnPath(p.program, pathValue, executable) === null);
}

/* ── Occurrence math ────────────────────────────────────────────────────── */

export { graceMinutes, instantForWall, ON_TIME_MS, planCatchUp, wallOf, type CatchUpPlan, type Occurrence, type Skipped } from "./clock.ts";

/** Scheduled instants in (from, to], oldest first, in the trigger's zone read now (`timezone: principal` follows the principal). */
export function occurrencesBetween(trigger: TimeTrigger, from: Date, to: Date, cap?: number): Occurrence[] {
  return occurrencesIn(trigger, from, to, trigger.type === "schedule" ? zoneOf(trigger) : "UTC", cap);
}

/** The instant's clock time in a timezone. */
const formatters = new Map<string, Intl.DateTimeFormat>();
export function clockIn(instant: Date, timeZone: string): { Hour: number; Minute: number; Weekday: number; Day: number; Month: number } {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", hour: "numeric", minute: "numeric", weekday: "short", day: "numeric", month: "numeric" });
    formatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { Hour: Number(get("hour")), Minute: Number(get("minute")), Weekday: weekday, Day: Number(get("day")), Month: Number(get("month")) };
}

/* ── Host-local wake-up slots (ISC-120) ─────────────────────────────────── */

export interface Slot {
  Hour: number;
  Minute: number;
}

/**
 * The host-local (hour, minute) pairs a schedule trigger can fire at over the
 * year after `from`, in either DST regime of the trigger's zone and the
 * host's. Null when the trigger fires too often to list (the plist polls each
 * minute instead; the entrypoint's due check keeps that correct).
 */
export function hostSlots(trigger: Extract<TriggerV2, { type: "schedule" }>, hostTz: string, from: Date): Slot[] | null {
  // Firing more than MAX_SLOTS times a day needs more than MAX_SLOTS wake-up slots; skip the year-long walk.
  if (occurrencesBetween(trigger, from, new Date(from.getTime() + 2 * 86_400_000), MAX_SLOTS * 2 + 1).length > MAX_SLOTS * 2) return null;
  // A month that already projects past FIRE_CAP for the year gets the interval fallback without walking the year.
  const month = occurrencesBetween(trigger, from, new Date(from.getTime() + 30 * 86_400_000), Math.ceil(FIRE_CAP / 12) + 1);
  if (month.length * 12.2 > FIRE_CAP) return null;
  const fires = occurrencesBetween(trigger, from, new Date(from.getTime() + YEAR_MS), FIRE_CAP + 1);
  if (fires.length > FIRE_CAP) return null;
  const seen = new Map<string, Slot>();
  for (const f of fires) {
    const c = clockIn(f.at, hostTz);
    seen.set(`${c.Hour}:${c.Minute}`, { Hour: c.Hour, Minute: c.Minute });
  }
  const slots = [...seen.values()].sort((a, b) => a.Hour - b.Hour || a.Minute - b.Minute);
  return slots.length > MAX_SLOTS ? null : slots;
}

/**
 * Host wake minutes for a `timezone: principal` cron whose minute field is one number: that minute and each quarter
 * hour after it. Empty when the minute field is anything else (the plist then polls each minute).
 */
export function principalWakeMinutes(cron: string): number[] {
  const minute = cron.trim().split(/\s+/)[0] ?? "";
  if (!/^\d{1,2}$/.test(minute) || Number(minute) > 59) return [];
  const steps = 60 / ZONED_TICK_MINUTES;
  return [...new Set(Array.from({ length: steps }, (_, k) => (Number(minute) + k * ZONED_TICK_MINUTES) % 60))].sort((a, b) => a - b);
}

/**
 * The latest scheduled occurrence in (since, now]. Evaluated in the trigger's
 * own timezone, so a wake-up on either side of a DST change picks the right
 * instant, and a wake-up that matches nothing picks nothing.
 */
export function dueOccurrences(trigger: TimeTrigger, since: Date, now: Date): Occurrence[] {
  return occurrencesBetween(trigger, since, now);
}

/* ── State beside the ledger ────────────────────────────────────────────── */

export function scheduleStateDir(ledger: string = ledgerPath()): string {
  return join(dirname(ledger), "schedule");
}

interface ScheduleState {
  last_evaluated?: string;
  once_consumed?: string[];
}

function statePathFor(dir: string, name: string): string {
  invariant(NAME_RE.test(name), `"${name}" is not a workflow name`);
  return join(dir, `${name}.json`);
}

export function readScheduleState(dir: string, name: string): ScheduleState {
  const path = statePathFor(dir, name);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ScheduleState;
  } catch {
    return {};
  }
}

function writeScheduleState(dir: string, name: string, state: ScheduleState): void {
  invariant(state.once_consumed === undefined || state.once_consumed.every(x => typeof x === "string"), "Consumed once triggers are ISO strings");
  invariant(state.last_evaluated === undefined || Number.isFinite(Date.parse(state.last_evaluated)), "last_evaluated is a timestamp");
  mkdirSync(dir, { recursive: true });
  writeFileAtomic(statePathFor(dir, name), `${JSON.stringify(state)}\n`);
}

export function setLastEvaluated(dir: string, name: string, at: Date): void {
  writeScheduleState(dir, name, { ...readScheduleState(dir, name), last_evaluated: at.toISOString() });
}

/** A `once` trigger is consumed by its `at` value, so editing the time makes it a new trigger. */
export function isOnceConsumed(dir: string, name: string, at: string): boolean {
  return (readScheduleState(dir, name).once_consumed ?? []).includes(at);
}

export function markOnceConsumed(dir: string, name: string, at: string): void {
  const state = readScheduleState(dir, name);
  const consumed = new Set(state.once_consumed ?? []);
  consumed.add(at);
  writeScheduleState(dir, name, { ...state, once_consumed: [...consumed] });
}

/** The next fire of one trigger, or null: a consumed or past `once` trigger has none. The CLI's `next` uses this. */
export function nextFire(trigger: TriggerV2, name: string, now: Date, lastStart: number, dir: string = scheduleStateDir()): Date | null {
  switch (trigger.type) {
    case "schedule":
      return nextScheduledAt(v1ScheduleProbe(trigger.cron, zoneOf(trigger)), now);
    case "interval": {
      const period = trigger.minutes * 60_000;
      const found = occurrencesBetween(trigger, now, new Date(now.getTime() + period));
      return found[0]?.at ?? null;
    }
    case "once":
      return Date.parse(trigger.at) > now.getTime() && !isOnceConsumed(dir, name, trigger.at) ? new Date(trigger.at) : null;
    default:
      return null;
  }
}

/* ── Plist compile (ISC-24, 118, 119, 120) ──────────────────────────────── */

export interface CompileOptions {
  home?: string;
  path?: string;
  bun?: string;
  dispatcher?: string;
  hostTz?: string;
  now?: Date;
  logDir?: string;
  extraEnv?: Record<string, string>;
  executable?: (path: string) => boolean;
}

export interface CalendarEntry {
  Minute: number;
  /** Absent for a principal-zone wake, which fires at its minute every hour. */
  Hour?: number;
  Month?: number;
  Day?: number;
}

export interface Compiled {
  label: string;
  plist: string;
  path: string;
  argv: string[];
  calendar: CalendarEntry[];
  interval: number | null;
  env: Record<string, string>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function compileSchedule(def: DefinitionV2, opts: CompileOptions = {}): Compiled {
  const home = opts.home ?? homedir();
  const pathValue = opts.path ?? defaultPath(home);
  const hostTz = opts.hostTz ?? hostTimeZone();
  const now = opts.now ?? new Date();
  const label = labelFor(def.name);
  if (def.enabled === false) throw new ScheduleCompileError(`Workflow "${def.name}" is disabled; nothing to schedule.`);
  const triggers = def.triggers.filter((t): t is TimeTrigger => t.enabled !== false && (t.type === "schedule" || t.type === "interval" || t.type === "once"));
  if (!triggers.length) throw new ScheduleCompileError(`Workflow "${def.name}" has no enabled schedule, interval or once trigger.`);

  // ISC-118: refuse when a command step's program would not resolve under the PATH the plist declares.
  const missing = unresolvedPrograms(def, pathValue, opts.executable);
  if (missing.length) {
    throw new ScheduleCompileError(
      `PATH gate: ${missing.map(m => `step "${m.step}" runs "${m.program}"`).join("; ")} — not found or not executable under PATH ${pathValue}. Use an absolute program path or install it on that PATH.`,
    );
  }

  const calendar = new Map<string, CalendarEntry>();
  let interval: number | null = null;
  const addInterval = (seconds: number) => {
    interval = interval === null ? seconds : gcd(interval, seconds);
  };
  for (const t of triggers) {
    if (t.type === "interval") addInterval(t.minutes * 60);
    else if (t.type === "once") {
      const c = clockIn(new Date(t.at), hostTz);
      calendar.set(`o${c.Month}/${c.Day}/${c.Hour}:${c.Minute}`, { Minute: c.Minute, Hour: c.Hour, Month: c.Month, Day: c.Day });
    } else if (t.timezone === PRINCIPAL_TIMEZONE) {
      // The zone moves with the principal, so no fixed host slot is right for long. Every UTC offset is a whole number
      // of quarter hours, so waking at the cron's minute and each quarter after it lands on the local minute in any
      // zone; the dispatcher's due check, read in the zone of the moment, decides whether this wake is the one.
      for (const m of principalWakeMinutes(t.cron)) calendar.set(`m${m}`, { Minute: m });
      if (principalWakeMinutes(t.cron).length === 0) addInterval(60);
    } else {
      const slots = hostSlots(t, hostTz, now);
      if (slots === null) addInterval(60);
      else for (const s of slots) calendar.set(`${s.Hour}:${s.Minute}`, { Minute: s.Minute, Hour: s.Hour });
    }
  }
  const entries = [...calendar.values()];
  const env: Record<string, string> = { ...(opts.extraEnv ?? {}), PATH: pathValue, HOME: home, LIFEOS_NOTIFICATION_CHANNEL: HEADLESS_CHANNEL };
  const bun = opts.bun ?? process.execPath;
  const dispatcher = opts.dispatcher ?? join(import.meta.dir, "dispatcher.ts");
  const argv = [bun, dispatcher, "fire", def.name];
  const logDir = opts.logDir ?? join(home, "Library", "Logs", "lifeos");

  const dict = (e: CalendarEntry) =>
    `    <dict>\n${(["Month", "Day", "Hour", "Minute"] as const).filter(k => e[k] !== undefined).map(k => `      <key>${k}</key><integer>${e[k]}</integer>`).join("\n")}\n    </dict>`;
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    `  <key>Label</key><string>${esc(label)}</string>`,
    `  <key>ProgramArguments</key>`,
    `  <array>`,
    ...argv.map(a => `    <string>${esc(a)}</string>`),
    `  </array>`,
    `  <key>EnvironmentVariables</key>`,
    `  <dict>`,
    ...Object.entries(env).map(([k, v]) => `    <key>${esc(k)}</key><string>${esc(v)}</string>`),
    `  </dict>`,
    ...(entries.length ? [`  <key>StartCalendarInterval</key>`, `  <array>`, ...entries.map(dict), `  </array>`] : []),
    ...(interval !== null ? [`  <key>StartInterval</key><integer>${interval}</integer>`] : []),
    `  <key>RunAtLoad</key><false/>`,
    `  <key>StandardOutPath</key><string>${esc(join(logDir, `${label}.out.log`))}</string>`,
    `  <key>StandardErrorPath</key><string>${esc(join(logDir, `${label}.err.log`))}</string>`,
    `</dict>`,
    `</plist>`,
    ``,
  ];
  return { label, plist: lines.join("\n"), path: pathValue, argv, calendar: entries, interval, env };
}
