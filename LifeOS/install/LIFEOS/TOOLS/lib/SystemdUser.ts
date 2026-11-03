/**
 * SystemdUser.ts — the `systemd --user` scheduling backend for LifeOS installers.
 *
 * WHY THIS EXISTS
 *
 * Every LifeOS background job is scheduled by an `Install*.ts` script that
 * speaks launchd. On Linux there is no scheduler at all, so the jobs simply
 * never run. This module is the second backend beside launchd, following the
 * shape set by InstallWorkSweep.ts and by `PULSE/manage.sh`, which has always
 * branched `systemctl --user` on linux and `launchctl` on darwin.
 *
 * THE ONE RULE IT OBEYS
 *
 * Strictly additive. Nothing here runs on darwin, and no installer's launchd
 * path is altered by adopting it. An installer gains a `process.platform ===
 * "linux"` branch and keeps its existing code untouched, so a macOS install
 * behaves exactly as it did before. There is deliberately no shared
 * "scheduler abstraction" that both platforms route through: that would put
 * new code in the path the primary install already depends on.
 *
 * WHY A SPEC INSTEAD OF UNIT TEMPLATE FILES
 *
 * InstallWorkSweep.ts ships a `.service.template` + `.timer.template` pair
 * beside its plist. That is right for one job. Across the remaining installers
 * it would mean roughly twenty near-identical template files, each able to
 * drift from the installer that materializes it. So the unit text is generated
 * from a small typed spec instead, and each installer declares only what is
 * genuinely its own: its label, its command, its log file, and its schedule.
 * Adding the next job is a ten-line branch, not two new files.
 *
 * LAUNCHD → SYSTEMD TRANSLATION
 *
 *   StartInterval N + RunAtLoad   → .timer  OnBootSec=2min, OnUnitActiveSec=N,
 *                                           plus OnCalendar when N divides an hour
 *   StartCalendarInterval H:M     → .timer  OnCalendar=*-*-* H:M:00
 *   KeepAlive + ThrottleInterval  → .service Restart=always, RestartSec=N
 *   WatchPaths [dirs]             → .path   PathModified= per directory
 *
 * `Persistent=true` is systemd's closest analogue to launchd firing a missed
 * job once the machine wakes — but it only acts on a CALENDAR anchor, so it is
 * emitted only where an OnCalendar= exists. It is not identical to launchd
 * either: `RunAtLoad` fires on every load, whereas `Persistent=true` fires only
 * if the window was actually missed. For these jobs (sweeps and syncs that are
 * safe to run late, never early) that difference is the desirable direction.
 * An interval that does not map to a calendar expression keeps OnUnitActiveSec
 * alone and no Persistent=, rather than a flag that reads as catch-up coverage
 * and provides none.
 *
 * ported from public PR #1698, @elhoim
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "node:os";
import * as wintask from "./WinTask";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
export const UNIT_DIR = join(HOME, ".config", "systemd", "user");

/* ── Schedules, one per launchd shape ───────────────────────────────────── */

export type Schedule =
  /** launchd StartInterval — every N seconds, plus a run shortly after boot. */
  | { kind: "interval"; seconds: number }
  /** launchd StartCalendarInterval — daily at a wall-clock time. */
  | { kind: "calendar"; hour: number; minute: number }
  /** launchd KeepAlive — a long-running process systemd should keep alive. */
  | { kind: "daemon"; restartSec: number }
  /** launchd WatchPaths — re-run when any of these directories changes. */
  | { kind: "watch"; paths: string[] };

export interface UnitSpec {
  /** launchd Label, reused verbatim as the systemd unit basename. */
  label: string;
  /** One-line unit Description. */
  description: string;
  /** argv. Must be absolute — systemd --user has a minimal PATH. */
  exec: string[];
  /** Absolute path for stdout, matching the plist's StandardOutPath. */
  logPath: string;
  /** Absolute path for stderr when the plist splits them (Conduit does).
   *  Defaults to logPath, matching the installers that point both keys at
   *  the same file. */
  errLogPath?: string;
  /** WorkingDirectory, when the job needs one. */
  workingDirectory?: string;
  /** Extra Environment= entries. */
  environment?: Record<string, string>;
  schedule: Schedule;
}

/* ── Unit rendering ─────────────────────────────────────────────────────── */

/** systemd needs literal `%` escaped as `%%` in unit values.
 *
 *  Fail closed on control characters first. A unit file is a sequence of
 *  newline-delimited `Key=value` directives, so a raw newline or CR embedded in
 *  ANY rendered field — description, exec argv, log path, environment value,
 *  watch path — would terminate the current directive and inject a new one
 *  (e.g. a second `ExecStartPre=/usr/bin/touch /tmp/pwn`). No legitimate systemd
 *  value contains a C0 control or DEL, so reject rather than attempt to sanitize.
 *  All call sites are static constants today; this hardens the exported renderer
 *  against any future dynamic/free-text field before it can inject. */
function esc(v: string): string {
  const bad = v.match(/[\x00-\x1f\x7f]/);
  if (bad) {
    const code = bad[0].charCodeAt(0).toString(16).padStart(2, "0");
    throw new Error(
      `SystemdUser: refusing to render unit field containing control character 0x${code} — possible unit-directive injection`,
    );
  }
  return v.replace(/%/g, "%%");
}

/** The label is reused verbatim as the unit-file basename (`<label>.service`)
 *  and joined under UNIT_DIR. Constrain it so a value like `../../foo` cannot
 *  traverse out of ~/.config/systemd/user when written. */
const LABEL_RE = /^[A-Za-z0-9._-]+$/;
function assertValidLabel(label: string): void {
  if (!LABEL_RE.test(label)) {
    throw new Error(
      `SystemdUser: invalid unit label ${JSON.stringify(label)} — must match ${LABEL_RE} (prevents path traversal on the unit filename)`,
    );
  }
}

function execLine(argv: string[]): string {
  // Quote any argument containing whitespace; systemd splits on it otherwise.
  // Quote first, escape second: escaping only ever inserts `%`, never quotes,
  // so a `%` inside a quoted argument still ends up doubled.
  return argv.map((a) => (/\s/.test(a) ? `"${a}"` : a)).map(esc).join(" ");
}

export function renderService(spec: UnitSpec): string {
  assertValidLabel(spec.label);
  const daemon = spec.schedule.kind === "daemon";
  const lines = [
    "# Generated by LifeOS lib/SystemdUser.ts — do not edit; re-run the installer.",
    "[Unit]",
    `Description=${esc(spec.description)}`,
    "",
    "[Service]",
    `Type=${daemon ? "simple" : "oneshot"}`,
    `ExecStart=${execLine(spec.exec)}`,
    // Append rather than truncate, so the log reads like the launchd one.
    `StandardOutput=append:${esc(spec.logPath)}`,
    `StandardError=append:${esc(spec.errLogPath ?? spec.logPath)}`,
  ];
  if (spec.workingDirectory) lines.push(`WorkingDirectory=${esc(spec.workingDirectory)}`);
  for (const [k, v] of Object.entries(spec.environment ?? {})) lines.push(`Environment=${esc(k)}=${esc(v)}`);
  if (spec.schedule.kind === "daemon") {
    lines.push("Restart=always", `RestartSec=${spec.schedule.restartSec}`);
  }
  // A daemon is installed directly and so needs an install section; oneshot
  // units are started by their .timer or .path and must NOT have one, or
  // `enable` would also wire them into default.target.
  if (daemon) lines.push("", "[Install]", "WantedBy=default.target");
  return lines.join("\n") + "\n";
}

/**
 * A calendar expression equivalent to an N-second interval, or null when the
 * interval does not divide an hour evenly (in which case OnUnitActiveSec alone
 * is the honest translation and no Persistent= is emitted).
 *
 * public issues #1875, @GRyndStone; #1880, @schmetti-dev
 */
function intervalCalendar(seconds: number): string | null {
  if (seconds === 3600) return "hourly";
  if (seconds < 60 || seconds % 60 !== 0) return null;
  const minutes = seconds / 60;
  if (minutes >= 60 || 60 % minutes !== 0) return null;
  return `*:0/${minutes}`;
}

export function renderTimer(spec: UnitSpec): string | null {
  const s = spec.schedule;
  if (s.kind !== "interval" && s.kind !== "calendar") return null;
  assertValidLabel(spec.label);
  const lines = [
    "# Generated by LifeOS lib/SystemdUser.ts — do not edit; re-run the installer.",
    "[Unit]",
    `Description=${esc(spec.description)} (timer)`,
    "",
    "[Timer]",
  ];
  if (s.kind === "interval") {
    // OnBootSec stands in for launchd's RunAtLoad without firing the job in
    // the same instant the timer is enabled.
    lines.push("OnBootSec=2min", `OnUnitActiveSec=${s.seconds}s`);
    // An OnUnitActiveSec-only timer has no anchor systemd can miss, so a
    // suspended or powered-off machine simply resumes counting from the last
    // run — the launchd behaviour these units are translating (catch up on
    // wake) never happened, and Persistent=true was inert beside it.
    // Deriving a calendar expression restores the anchor.
    // public issues #1875, @GRyndStone; #1880, @schmetti-dev
    const calendar = intervalCalendar(s.seconds);
    if (calendar) lines.push(`OnCalendar=${calendar}`, "Persistent=true");
  } else {
    lines.push(`OnCalendar=*-*-* ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}:00`, "Persistent=true");
  }
  lines.push("", "[Install]", "WantedBy=timers.target");
  return lines.join("\n") + "\n";
}

export function renderPath(spec: UnitSpec): string | null {
  const s = spec.schedule;
  if (s.kind !== "watch") return null;
  assertValidLabel(spec.label);
  const lines = [
    "# Generated by LifeOS lib/SystemdUser.ts — do not edit; re-run the installer.",
    "[Unit]",
    `Description=${esc(spec.description)} (path watch)`,
    "",
    "[Path]",
  ];
  // launchd WatchPaths fires on any change to the directory; PathModified is
  // the systemd equivalent that also catches writes to files inside it.
  for (const p of s.paths) lines.push(`PathModified=${esc(p)}`);
  lines.push("", "[Install]", "WantedBy=default.target");
  return lines.join("\n") + "\n";
}

/* ── systemctl plumbing ─────────────────────────────────────────────────── */

export interface Run {
  ok: boolean;
  out: string;
  err: string;
}

async function sh(cmd: string[], env?: Record<string, string>): Promise<Run> {
  // A missing binary (systemctl/loginctl absent, e.g. a non-systemd container)
  // makes Bun.spawn throw ENOENT. Catch it and return a normal failed Run so the
  // caller reaches the friendly diagnosis path (userManagerReachable → "schedule
  // via cron instead") rather than an unhandled exception.
  try {
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    const exit = await proc.exited;
    return { ok: exit === 0, out, err };
  } catch (e) {
    return { ok: false, out: "", err: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * `systemctl --user` needs XDG_RUNTIME_DIR to find the user bus, and a
 * non-interactive shell does not set it. Without this, every call fails with
 * "Failed to connect to user scope bus ... $DBUS_SESSION_BUS_ADDRESS and
 * $XDG_RUNTIME_DIR not defined" even though the user manager is running
 * perfectly well — which is precisely the context an installer runs in when
 * driven from a script, a cron job, or a non-login SSH session.
 *
 * Same class of bug as the `process.env.USER` issue InstallWorkSweep.ts calls
 * out: an environment variable that happens to be set in a terminal and absent
 * everywhere else. Resolved here rather than left to the caller.
 */
let runtimeDirCache: string | null | undefined;
function runtimeEnv(): Record<string, string> | undefined {
  if (process.env.XDG_RUNTIME_DIR) return undefined; // already correct
  if (runtimeDirCache === undefined) {
    const uid = typeof process.getuid === "function" ? process.getuid() : NaN;
    const candidate = Number.isNaN(uid) ? "" : `/run/user/${uid}`;
    runtimeDirCache = candidate && existsSync(candidate) ? candidate : null;
  }
  return runtimeDirCache ? { XDG_RUNTIME_DIR: runtimeDirCache } : undefined;
}

export function systemctl(args: string[]): Promise<Run> {
  return sh(["systemctl", "--user", ...args], runtimeEnv());
}

/** Is a systemd user manager actually reachable? Checked before install so the
 *  failure reads as a diagnosis instead of a dbus error. */
export async function userManagerReachable(): Promise<{ ok: boolean; detail: string }> {
  const r = await systemctl(["is-system-running"]);
  const state = r.out.trim();
  // "degraded" and "starting" are still usable; only an unreachable bus is not.
  if (state) return { ok: true, detail: state };
  return { ok: false, detail: r.err.trim().split("\n")[0] || "no response from user bus" };
}

/** Current username. `id -un`, never `process.env.USER` — a non-interactive
 *  shell may not set USER, and an empty name makes enable-linger fail. */
async function username(): Promise<string> {
  const r = await sh(["id", "-un"]);
  return r.out.trim();
}

/** Absolute path of an executable, or "" — systemd --user has a minimal PATH,
 *  so installers must bake absolute paths into ExecStart. */
export async function which(bin: string): Promise<string> {
  const r = await sh(["which", bin]);
  return r.ok ? r.out.trim() : "";
}

/** The unit that gets enabled: the timer/path if there is one, else the service. */
function primaryUnit(spec: UnitSpec): string {
  assertValidLabel(spec.label);
  switch (spec.schedule.kind) {
    case "interval":
    case "calendar":
      return `${spec.label}.timer`;
    case "watch":
      return `${spec.label}.path`;
    case "daemon":
      return `${spec.label}.service`;
  }
}

function unitFiles(spec: UnitSpec): Array<[string, string]> {
  const files: Array<[string, string]> = [[`${spec.label}.service`, renderService(spec)]];
  const timer = renderTimer(spec);
  if (timer) files.push([`${spec.label}.timer`, timer]);
  const path = renderPath(spec);
  if (path) files.push([`${spec.label}.path`, path]);
  return files;
}

/* ── Public operations ──────────────────────────────────────────────────── */

/**
 * Materialize the units, enable and start the primary one. Idempotent: a
 * re-install disables the prior unit first, so re-running is safe.
 */
export async function install(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  if (wintask.isWindows()) return wintask.install(spec, log);
  // Diagnose an unreachable user manager before writing anything, so the
  // failure reads as an explanation instead of a raw dbus error.
  const mgr = await userManagerReachable();
  if (!mgr.ok) {
    log(`no systemd user manager reachable: ${mgr.detail}`);
    log("on a host without user sessions (some containers), schedule via the system manager or cron instead");
    return false;
  }
  mkdirSync(UNIT_DIR, { recursive: true });
  mkdirSync(join(spec.logPath, ".."), { recursive: true });
  if (spec.errLogPath) mkdirSync(join(spec.errLogPath, ".."), { recursive: true });

  const unit = primaryUnit(spec);

  // Stop whatever is already there before rewriting it underneath systemd.
  await systemctl(["disable", "--now", unit]);

  for (const [name, body] of unitFiles(spec)) {
    const target = join(UNIT_DIR, name);
    writeFileSync(target, body);
    log(`wrote ${target}`);
  }

  const reload = await systemctl(["daemon-reload"]);
  if (!reload.ok) {
    log(`daemon-reload failed: ${reload.err.trim()}`);
    return false;
  }

  // Without linger, user units stop when the last session closes — the same
  // requirement already documented for com.lifeos.pulse on Linux.
  const user = await username();
  if (user) {
    const linger = await sh(["loginctl", "enable-linger", user], runtimeEnv());
    if (!linger.ok) log(`note: enable-linger failed (${linger.err.trim() || "no detail"}); units stop at logout`);
  } else {
    log("note: could not resolve username via `id -un`; skipped enable-linger");
  }

  const en = await systemctl(["enable", "--now", unit]);
  if (!en.ok) {
    log(`enable failed: ${en.err.trim()}`);
    return false;
  }
  log(`systemd unit enabled — ${unit} active`);
  return true;
}

/** Disable the primary unit and delete every file this spec created. */
export async function uninstall(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  if (wintask.isWindows()) return wintask.uninstall(spec, log);
  const unit = primaryUnit(spec);
  await systemctl(["disable", "--now", unit]);
  for (const [name] of unitFiles(spec)) {
    const target = join(UNIT_DIR, name);
    if (existsSync(target)) {
      rmSync(target);
      log(`removed ${target}`);
    }
  }
  await systemctl(["daemon-reload"]);
  log(`systemd unit removed — ${unit}`);
  return true;
}

/** Print whether the unit is installed and what it is doing. */
export async function status(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  if (wintask.isWindows()) return wintask.status(spec, log);
  const unit = primaryUnit(spec);
  const file = join(UNIT_DIR, unit);
  if (!existsSync(file)) {
    log(`not installed (no ${file})`);
    return false;
  }
  log(`unit file: ${file}`);
  const active = await systemctl(["is-active", unit]);
  const enabled = await systemctl(["is-enabled", unit]);
  log(`active: ${active.out.trim() || "unknown"} · enabled: ${enabled.out.trim() || "unknown"}`);
  if (unit.endsWith(".timer")) {
    const list = await systemctl(["list-timers", "--no-pager", unit]);
    const row = list.out.split("\n").find((l) => l.includes(spec.label));
    if (row) log(`next run: ${row.trim()}`);
  }
  // Surface the last failure reason rather than making the caller dig.
  if (active.out.trim() === "failed") {
    const p = await systemctl(["status", "--no-pager", "-n", "5", unit]);
    log(p.out.trim());
  }
  return true;
}

/** True when this module is the right backend for the running platform. */
export function isLinux(): boolean {
  return process.platform === "linux";
}

/**
 * True when a spec-driven scheduler serves this platform: systemd --user on
 * Linux, Task Scheduler on Windows (install/uninstall/status above delegate to
 * lib/WinTask.ts there). Installers branch on this instead of isLinux() so one
 * `linuxSpec()` covers both; darwin keeps its launchd path untouched.
 */
export function hasUserScheduler(): boolean {
  return isLinux() || wintask.isWindows();
}

/** Read a plist template's log path so the systemd unit logs to the same file.
 *  Falls back to the caller's default when the template can't be read. */
export function logPathFromPlist(templatePath: string, fallback: string): string {
  try {
    const xml = readFileSync(templatePath, "utf-8");
    const m = xml.match(/<key>StandardOutPath<\/key>\s*<string>([^<]+)<\/string>/);
    if (!m) return fallback;
    return m[1].replace(/\{\{HOME\}\}/g, HOME);
  } catch {
    return fallback;
  }
}
