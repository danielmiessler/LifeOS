/**
 * WinTask.ts — the Windows Task Scheduler backend for LifeOS installers.
 *
 * WHY THIS EXISTS
 *
 * Every LifeOS background job is scheduled by an `Install*.ts` script that
 * speaks launchd, and SystemdUser.ts added systemd --user beside it. On Windows
 * neither exists, so the jobs never ran. This module is the third backend. It
 * takes the same `UnitSpec` SystemdUser.ts takes, so an installer that already
 * declares a spec for Linux gets Windows for free: SystemdUser's
 * install/uninstall/status delegate here when `process.platform === "win32"`.
 *
 * THE ONE RULE IT OBEYS
 *
 * Strictly additive, like SystemdUser.ts. Nothing here runs on darwin or linux.
 * Every task is registered for the CURRENT user under the `\LifeOS\` folder:
 * no admin rights, no machine-wide state, nothing outside that folder touched.
 *
 * LAUNCHD → TASK SCHEDULER TRANSLATION
 *
 *   StartInterval N + RunAtLoad   → TimeTrigger repeating every N + LogonTrigger (2 min delay)
 *   StartCalendarInterval H:M     → CalendarTrigger daily at H:M, StartWhenAvailable (catch up)
 *   KeepAlive + ThrottleInterval  → LogonTrigger; WinTaskRun.ts respawns the child on exit
 *   WatchPaths [dirs]             → LogonTrigger; WinTaskRun.ts holds fs.watch on each path
 *                                   and runs the job (debounced, throttled) on change
 *
 * Task Scheduler cannot redirect output, set per-task environment, or watch
 * paths, so the action is never the job itself: it is `WinTaskRun.ts <spec>`,
 * which reads the spec JSON written beside it, sets HOME/PATH and the spec's
 * environment, appends output to the spec's log, and owns the daemon/watch
 * loops. `conhost.exe --headless` hosts it so no console window flashes.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir, tmpdir } from "node:os";
import type { Schedule, UnitSpec } from "./SystemdUser";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any; spawnSync: (cmd: string[], opts?: any) => any; which: (bin: string) => string | null };

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const LIFEOS = process.env.LIFEOS_DIR && !process.env.LIFEOS_DIR.startsWith("$") ? process.env.LIFEOS_DIR : join(HOME, ".claude", "LIFEOS");
/** Where each installed task's spec lives; WinTaskRun.ts reads it at every start. */
export const SPEC_DIR = join(LIFEOS, "MEMORY", "STATE", "wintask");
/** Task Scheduler folder holding every LifeOS task. */
export const TASK_FOLDER = "\\LifeOS\\";
const RUNNER = join(import.meta.dir, "WinTaskRun.ts");

const LABEL_RE = /^[A-Za-z0-9._-]+$/;
function assertValidLabel(label: string): void {
  if (!LABEL_RE.test(label)) {
    throw new Error(`WinTask: invalid task label ${JSON.stringify(label)} — must match ${LABEL_RE}`);
  }
}

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function taskName(label: string): string {
  assertValidLabel(label);
  return `${TASK_FOLDER}${label}`;
}

export function specPath(label: string): string {
  assertValidLabel(label);
  return join(SPEC_DIR, `${label}.json`);
}

/** True when `label`'s task is registered, enabled, and its spec on disk matches `spec`. */
export function isCurrent(spec: UnitSpec): boolean {
  try {
    const onDisk = JSON.parse(readFileSync(specPath(spec.label), "utf8"));
    for (const k of ["exec", "schedule", "environment"] as const) {
      if (JSON.stringify(onDisk[k] ?? null) !== JSON.stringify(spec[k] ?? null)) return false;
    }
  } catch { return false; }
  return loadedLabels().has(spec.label);
}

/** Absolute path of an executable, or "". Bun.which honours PATHEXT, so `bun` finds bun.exe. */
export async function which(bin: string): Promise<string> {
  return Bun.which(bin) ?? "";
}

/* ── Task XML rendering ─────────────────────────────────────────────────── */

function xml(v: string): string {
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new Error("WinTask: refusing to render a field containing a control character");
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Windows command-line quoting for one argument (CommandLineToArgvW rules). */
function quoteArg(a: string): string {
  if (a && !/[\s"]/.test(a)) return a;
  return `"${a.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
}

function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function currentUser(): string {
  const domain = process.env.USERDOMAIN;
  const user = process.env.USERNAME ?? "";
  return domain ? `${domain}\\${user}` : user;
}

function minutesDuration(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m % 60 === 0 ? `PT${m / 60}H` : `PT${m}M`;
}

function triggers(s: Schedule, user: string, now: Date): string[] {
  const logon = (delay: string) =>
    `<LogonTrigger><Enabled>true</Enabled><UserId>${xml(user)}</UserId><Delay>${delay}</Delay></LogonTrigger>`;
  switch (s.kind) {
    case "interval": {
      const start = new Date(now.getTime() + 60_000);
      return [
        logon("PT2M"),
        `<TimeTrigger><StartBoundary>${localIso(start)}</StartBoundary><Enabled>true</Enabled>` +
          `<Repetition><Interval>${minutesDuration(s.seconds)}</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition></TimeTrigger>`,
      ];
    }
    case "calendar": {
      const start = new Date(now);
      start.setHours(s.hour, s.minute, 0, 0);
      return [
        `<CalendarTrigger><StartBoundary>${localIso(start)}</StartBoundary><Enabled>true</Enabled>` +
          `<ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>`,
      ];
    }
    case "daemon":
    case "watch":
      return [logon("PT30S")];
  }
}

export function renderTaskXml(spec: UnitSpec, bunPath: string, now = new Date()): string {
  assertValidLabel(spec.label);
  const user = currentUser();
  const longRunning = spec.schedule.kind === "daemon" || spec.schedule.kind === "watch";
  const conhost = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "conhost.exe");
  const args = ["--headless", bunPath, RUNNER, specPath(spec.label)].map(quoteArg).join(" ");
  return [
    `<?xml version="1.0" encoding="UTF-16"?>`,
    `<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">`,
    `<RegistrationInfo><Description>${xml(spec.description)} (generated by LifeOS lib/WinTask.ts; re-run the installer, do not edit)</Description>` +
      `<URI>${xml(taskName(spec.label))}</URI></RegistrationInfo>`,
    `<Triggers>${triggers(spec.schedule, user, now).join("")}</Triggers>`,
    `<Principals><Principal id="Author"><UserId>${xml(user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>`,
    `<Settings>`,
    `<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>`,
    `<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>`,
    `<AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable>`,
    `<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>`,
    `<IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>`,
    `<AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>false</Hidden>`,
    `<RunOnlyIfIdle>false</RunOnlyIfIdle><WakeToRun>false</WakeToRun>`,
    `<ExecutionTimeLimit>${longRunning ? "PT0S" : "PT1H"}</ExecutionTimeLimit><Priority>7</Priority>`,
    `<RestartOnFailure><Interval>PT1M</Interval><Count>${longRunning ? 999 : 3}</Count></RestartOnFailure>`,
    `</Settings>`,
    `<Actions Context="Author"><Exec><Command>${xml(conhost)}</Command><Arguments>${xml(args)}</Arguments>` +
      (spec.workingDirectory ? `<WorkingDirectory>${xml(spec.workingDirectory)}</WorkingDirectory>` : "") +
      `</Exec></Actions>`,
    `</Task>`,
  ].join("\r\n");
}

/* ── schtasks / PowerShell plumbing ─────────────────────────────────────── */

export interface Run { ok: boolean; out: string; err: string }

function runSync(cmd: string[]): Run {
  try {
    const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
    return { ok: p.exitCode === 0, out: p.stdout.toString(), err: p.stderr.toString() };
  } catch (e) {
    return { ok: false, out: "", err: e instanceof Error ? e.message : String(e) };
  }
}

function schtasks(args: string[]): Run {
  return runSync(["schtasks.exe", ...args]);
}

function powershell(script: string): Run {
  return runSync(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script]);
}

/** UTF-16LE with BOM: the encoding schtasks /XML reliably accepts. */
function writeUtf16(path: string, text: string): void {
  writeFileSync(path, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));
}

export interface TaskState { label: string; state: string; lastRun?: string; lastResult?: number; nextRun?: string }

/**
 * Every task under `\LifeOS\`, with its state. Read through PowerShell because
 * `schtasks /Query` prints localized status words; ScheduledTask.State is an
 * enum that serializes the same on every locale.
 */
export function listTasks(): TaskState[] {
  const r = powershell(
    "$ErrorActionPreference='SilentlyContinue';" +
      `@(Get-ScheduledTask -TaskPath '${TASK_FOLDER}' | ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; ` +
      "[pscustomobject]@{ label=$_.TaskName; state=[string]$_.State; lastRun=[string]$i.LastRunTime; lastResult=$i.LastTaskResult; nextRun=[string]$i.NextRunTime } }) | ConvertTo-Json -Compress",
  );
  const text = r.out.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** Labels whose task is registered and enabled (Ready or Running) — the "loaded" set. */
export function loadedLabels(): Set<string> {
  return new Set(listTasks().filter((t) => t.state === "Ready" || t.state === "Running").map((t) => t.label));
}

/** Human cadence for an installed spec JSON, in Services.ts's vocabulary. */
export function cadenceOf(specFile: string): string {
  try {
    const s: Schedule = JSON.parse(readFileSync(specFile, "utf8")).schedule;
    switch (s.kind) {
      case "interval": return s.seconds % 3600 === 0 ? `every ${s.seconds / 3600}h` : `every ${Math.round(s.seconds / 60)}m`;
      case "calendar": return "daily/scheduled";
      case "watch": return "on file-change";
      case "daemon": return "at load";
    }
  } catch { return "?"; }
}

/** Stop and delete one task and its spec, synchronously. Used by Services.ts's default uninstall. */
export function removeSync(label: string): Run {
  const name = taskName(label);
  try { rmSync(specPath(label), { force: true }); } catch { /* the schtasks result is the signal */ }
  // Query first: an absent task is already uninstalled, and the /Delete error text is localized.
  if (!schtasks(["/Query", "/TN", name]).ok) return { ok: true, out: "not installed", err: "" };
  schtasks(["/End", "/TN", name]);
  return schtasks(["/Delete", "/TN", name, "/F"]);
}

/* ── Public operations (same contract as SystemdUser.ts) ────────────────── */

/**
 * Write the spec, register the task, and start it when it is long-running.
 * Idempotent: /F replaces a prior registration, and a running instance is
 * ended first so the new spec is what runs.
 */
export async function install(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  return installSync(spec, log);
}

/** install(), for callers that are synchronous end to end (the Workflows dispatcher installer). */
export function installSync(spec: UnitSpec, log: (m: string) => void): boolean {
  assertValidLabel(spec.label);
  const bunPath = Bun.which("bun") ?? process.execPath;
  // exec[0] may be a POSIX-style path from `which` under Git Bash; resolve it to a real file.
  const exec = [...spec.exec];
  if (exec[0] && !existsSync(exec[0])) exec[0] = Bun.which(exec[0].split(/[\\/]/).pop() ?? exec[0]) ?? exec[0];
  if (!existsSync(exec[0] ?? "")) {
    log(`executable not found: ${spec.exec[0]}`);
    return false;
  }

  mkdirSync(SPEC_DIR, { recursive: true });
  mkdirSync(dirname(spec.logPath), { recursive: true });
  if (spec.errLogPath) mkdirSync(dirname(spec.errLogPath), { recursive: true });
  writeFileSync(specPath(spec.label), JSON.stringify({ ...spec, exec, bun: bunPath }, null, 2) + "\n");
  log(`wrote ${specPath(spec.label)}`);

  const name = taskName(spec.label);
  schtasks(["/End", "/TN", name]);
  const xmlPath = join(tmpdir(), `lifeos-task-${spec.label}-${process.pid}.xml`);
  writeUtf16(xmlPath, renderTaskXml(spec, bunPath));
  const created = schtasks(["/Create", "/TN", name, "/XML", xmlPath, "/F"]);
  try { rmSync(xmlPath, { force: true }); } catch { /* temp file */ }
  if (!created.ok) {
    log(`schtasks /Create failed: ${(created.err || created.out).trim()}`);
    return false;
  }
  log(`scheduled task registered — ${name}`);

  if (spec.schedule.kind === "daemon" || spec.schedule.kind === "watch") {
    const run = schtasks(["/Run", "/TN", name]);
    log(run.ok ? `started ${name}` : `registered but /Run failed: ${run.err.trim()} (it starts at next logon)`);
  }
  return true;
}

export async function uninstall(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  const r = removeSync(spec.label);
  log(r.ok ? `scheduled task removed — ${taskName(spec.label)}` : `remove failed: ${r.err.trim()}`);
  return r.ok;
}

export async function status(spec: UnitSpec, log: (m: string) => void): Promise<boolean> {
  const t = listTasks().find((x) => x.label === spec.label);
  if (!t) {
    log(`not installed (no task ${taskName(spec.label)})`);
    return false;
  }
  log(`task: ${taskName(spec.label)} · state: ${t.state}`);
  log(`last run: ${t.lastRun || "never"} (result ${t.lastResult ?? "?"}) · next run: ${t.nextRun || "—"}`);
  log(`log: ${spec.logPath}`);
  return true;
}
