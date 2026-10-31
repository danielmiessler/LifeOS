#!/usr/bin/env bun
/**
 * Keeps launchd down to ONE Workflows job (ISA F27: ISC-311, ISC-312). A workflow's time triggers are evaluated by
 * the long-lived dispatcher (`dispatcher.ts serve`), so `installSchedule` no longer writes a per-workflow plist: it
 * checks the schedule still compiles (ISC-118, ISC-120), removes any legacy `com.lifeos.wf.<name>` job, and makes
 * sure the dispatcher is installed. Incident 2026-10-24: one launchd job per workflow (~2,750 starts an hour) made
 * macOS's dasd write ~5 GB a minute. The CLI's schedule verbs call `installSchedule` and `uninstallSchedule`;
 * nothing else in Workflows touches launchd. On Linux the same one dispatcher runs as a systemd user service
 * (`com.lifeos.workflows-dispatcher.service`, see `dispatcherUnit`), and no per-workflow job ever exists.
 *
 * Every effect is injectable so tests never reach the real launchd: the
 * LaunchAgents directory, the services registry path, and the launchctl runner.
 * Installing writes the plist, registers `com.lifeos.wf.<name>` in services.json
 * (so the inventory's W8 check sees a declared, installed service), and loads it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";
import { invariant } from "../../TOOLS/Invariant.ts";
import { defaultClaudeDir, expandPathFrom } from "../../TOOLS/Paths.ts";
import { classifyServiceRow } from "../../TOOLS/Services.ts";
import { loadDefinitionFile } from "./format.ts";
import { writeFileAtomic } from "./ledger.ts";
import { definitionsDir, pathForName } from "./paths.ts";
import { compileSchedule, defaultPath, HEADLESS_CHANNEL, LABEL_PREFIX, labelFor, ScheduleCompileError, type CompileOptions } from "./schedule.ts";

export const DISPATCHER_LABEL = "com.lifeos.workflows-dispatcher";
const HERE = import.meta.dir;
const LIFEOS_ROOT = join(HERE, "..", "..");

export type Launchctl = (args: string[]) => { code: number; stderr: string };

export function realLaunchctl(args: string[]): { code: number; stderr: string } {
  const p = Bun.spawnSync(["launchctl", ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, stderr: p.stderr.toString().slice(0, 300) };
}

/** Runs an executable as the launchctl binary; tests point this at a script that records its argv. */
export function launchctlAt(binary: string): Launchctl {
  return args => {
    const p = Bun.spawnSync([binary, ...args], { stdout: "pipe", stderr: "pipe" });
    return { code: p.exitCode ?? 1, stderr: p.stderr.toString().slice(0, 300) };
  };
}

/**
 * What the CLI's launchd call site installs into (ISC-121). With a real
 * definitions home it is the real LaunchAgents and launchctl, each overridable
 * by LIFEOS_WORKFLOWS_LAUNCH_AGENTS, LIFEOS_WORKFLOWS_SERVICES and
 * LIFEOS_WORKFLOWS_LAUNCHCTL. With LIFEOS_WORKFLOWS_DIR set (a test or a
 * sandbox) it returns null, and the caller skips launchd, unless all three
 * overrides are set: then the whole sandbox is injected and nothing real is
 * reachable.
 */
export function launchdOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): InstallOptions | null {
  const agents = env.LIFEOS_WORKFLOWS_LAUNCH_AGENTS;
  const services = env.LIFEOS_WORKFLOWS_SERVICES;
  const binary = env.LIFEOS_WORKFLOWS_LAUNCHCTL;
  if (env.LIFEOS_WORKFLOWS_DIR && !(agents && services && binary)) return null;
  return {
    ...(agents ? { launchAgentsDir: agents } : {}),
    ...(services ? { servicesPath: services } : {}),
    ...(binary ? { launchctl: launchctlAt(binary) } : {}),
  };
}

/** The systemd user manager, for the Linux dispatcher; tests inject a recorder in its place. */
export type Systemctl = (args: string[]) => { code: number; stderr: string };

export function realSystemctl(args: string[]): { code: number; stderr: string } {
  const p = Bun.spawnSync(["systemctl", "--user", ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, stderr: p.stderr.toString().slice(0, 300) };
}

export interface InstallOptions {
  defsDir?: string;
  launchAgentsDir?: string;
  servicesPath?: string;
  launchctl?: Launchctl;
  /** The host the dispatcher is installed for; this process's platform by default. Linux uses systemd, everything else launchd. */
  platform?: NodeJS.Platform;
  /** Where the Linux dispatcher's unit file goes; `~/.config/systemd/user` by default. */
  systemdUserDir?: string;
  systemctl?: Systemctl;
  uid?: number;
  compile?: CompileOptions;
  /** false writes and registers without loading. */
  load?: boolean;
  /** The environment the install-root variables are read from; the installing process's own by default. */
  env?: NodeJS.ProcessEnv;
}

/**
 * The variables a LifeOS install uses to find its own root (Paths.ts: CLAUDE_CONFIG_DIR, then LIFEOS_DIR). launchd starts a
 * job with only the plist's environment, so an install in a non-default config directory would lose them and its jobs would
 * look for `$HOME/.claude`. Whatever the installing process was given is baked into every plist this file writes.
 */
export const INSTALL_ROOT_ENV = ["CLAUDE_CONFIG_DIR", "LIFEOS_DIR"] as const;

export function installRootEnv(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): Record<string, string> {
  // A value that resolves to the default root changes nothing for the job, so it is left out and a default install's plists
  // stay byte-identical to the ones written before this was baked.
  const defaults: Record<(typeof INSTALL_ROOT_ENV)[number], string> = {
    CLAUDE_CONFIG_DIR: defaultClaudeDir(home),
    LIFEOS_DIR: join(defaultClaudeDir(home), "LIFEOS"),
  };
  const out: Record<string, string> = {};
  for (const key of INSTALL_ROOT_ENV) {
    const value = env[key];
    if (typeof value !== "string" || value.length === 0) continue;
    if (expandPathFrom(value, home).replace(/\/+$/, "") === defaults[key]) continue;
    out[key] = value;
  }
  return out;
}

export interface InstallResult {
  label: string;
  plistPath: string;
  loaded: boolean;
  calendar: number;
  interval: number | null;
}

interface ServiceRow {
  label: string;
  title: string;
  category: string;
  optIn: boolean;
  purpose: string;
  install: string;
  uninstall?: string;
}

const defaultServicesPath = () => join(LIFEOS_ROOT, "USER", "CONFIG", "services.json");
const defaultAgentsDir = () => join(homedir(), "Library", "LaunchAgents");

function readServices(path: string): ServiceRow[] {
  const rows = JSON.parse(readFileSync(path, "utf8"));
  invariant(Array.isArray(rows), `${path} must hold an array of service rows`);
  return rows;
}

function writeServices(path: string, rows: ServiceRow[]): void {
  // The one row rule is Services.ts classifyServiceRow, the same one loadUserServices reads with. Metadata rows (the
  // template's docs entry, DeployComponents' `_declined` record) pass untouched; a row that is neither metadata nor a
  // labelled service or sidecar (an install with no label, an empty label) is a lost label and refuses the write.
  // Third-party sidecars (sh.brew.moshi-hook) are labelled rows with no install; the com.lifeos. prefix is asserted on
  // the row Workflows itself writes (registerService).
  invariant(rows.every(r => classifyServiceRow(r) !== "invalid"), "Every service row keeps a label");
  const labelled = rows.filter(r => classifyServiceRow(r) !== "metadata");
  invariant(new Set(labelled.map(r => r.label)).size === labelled.length, "Service labels are unique");
  writeFileAtomic(path, `${JSON.stringify(rows, null, 2)}\n`);
}

/** Adds or replaces one row by label; every other row is written back unchanged. */
export function registerService(servicesPath: string, row: ServiceRow): void {
  invariant(row.label.startsWith("com.lifeos."), `Workflows registers only com.lifeos. services, not ${row.label}`);
  const rows = readServices(servicesPath);
  const at = rows.findIndex(r => r.label === row.label);
  if (at >= 0) rows[at] = row;
  else rows.push(row);
  writeServices(servicesPath, rows);
}

export function unregisterService(servicesPath: string, label: string): boolean {
  const rows = readServices(servicesPath);
  const kept = rows.filter(r => r.label !== label);
  if (kept.length === rows.length) return false;
  writeServices(servicesPath, kept);
  return true;
}

function plistTarget(dir: string, label: string): string {
  mkdirSync(dir, { recursive: true });
  const real = realpathSync(dir);
  const path = join(real, `${label}.plist`);
  invariant(dirname(path) === real || dirname(path).startsWith(real + sep), `Plist path escapes the LaunchAgents directory: ${path}`);
  return path;
}

const domain = (uid: number) => `gui/${uid}`;

export function installSchedule(name: string, opts: InstallOptions = {}): InstallResult {
  const defsDir = opts.defsDir ?? definitionsDir();
  const path = pathForName(name, defsDir);
  invariant(existsSync(path), `No workflow definition "${name}" in ${defsDir}`);
  const { def } = loadDefinitionFile(path);
  invariant(def.name === name, `Definition file name and workflow name differ: ${name} vs ${def.name}`);
  // Still compiled: it is the check that the schedule is valid on this host (PATH, zone), even though no plist is written.
  const compiled = compileSchedule(def, { ...opts.compile, extraEnv: { LIFEOS_WORKFLOWS_DIR: defsDir, ...installRootEnv(opts.env), ...(opts.compile?.extraEnv ?? {}) } });
  uninstallSchedule(name, opts);
  const dispatcher = ensureDispatcher(opts);
  return { label: DISPATCHER_LABEL, plistPath: dispatcher.plistPath, loaded: dispatcher.loaded, calendar: compiled.calendar.length, interval: compiled.interval };
}

/**
 * Installs the one dispatcher job when its plist is missing, out of date, or not loaded; a current, loaded job is left
 * running (a reinstall would kill the runs it holds as children). `loaded` is true whenever the job is loaded afterwards.
 */
export function ensureDispatcher(opts: InstallOptions & { home?: string } = {}): InstallResult {
  if (onLinux(opts)) {
    const unitPath = unitTarget(opts);
    const current = existsSync(unitPath) && readFileSync(unitPath, "utf8") === dispatcherUnit({ home: opts.home, extraEnv: installRootEnv(opts.env) });
    const running = opts.load !== false && (opts.systemctl ?? realSystemctl)(["is-active", "--quiet", DISPATCHER_UNIT]).code === 0;
    if (current && (running || opts.load === false)) return { label: DISPATCHER_LABEL, plistPath: unitPath, loaded: running, calendar: 0, interval: null };
    return installDispatcher(opts);
  }
  const plistPath = plistTarget(opts.launchAgentsDir ?? defaultAgentsDir(), DISPATCHER_LABEL);
  const want = dispatcherPlist({ home: opts.home, extraEnv: installRootEnv(opts.env) });
  const current = existsSync(plistPath) && readFileSync(plistPath, "utf8") === want;
  const running = opts.load !== false && (opts.launchctl ?? realLaunchctl)(["print", `${domain(opts.uid ?? process.getuid!())}/${DISPATCHER_LABEL}`]).code === 0;
  if (current && (running || opts.load === false)) return { label: DISPATCHER_LABEL, plistPath, loaded: running, calendar: 0, interval: null };
  return installDispatcher(opts);
}

export function uninstallSchedule(name: string, opts: InstallOptions = {}): { label: string; removedPlist: boolean; unregistered: boolean } {
  const label = labelFor(name);
  // Linux never had per-workflow jobs (its dispatcher is a systemd unit), and launchctl does not exist there.
  if (onLinux(opts)) return { label, removedPlist: false, unregistered: unregisterService(opts.servicesPath ?? defaultServicesPath(), label) };
  const agents = opts.launchAgentsDir ?? defaultAgentsDir();
  const plistPath = plistTarget(agents, label);
  if (opts.load !== false) {
    const launchctl = opts.launchctl ?? realLaunchctl;
    launchctl(["bootout", `${domain(opts.uid ?? process.getuid!())}/${label}`]);
  }
  const removedPlist = existsSync(plistPath);
  if (removedPlist) Bun.spawnSync(["rm", "-f", plistPath]);
  return { label, removedPlist, unregistered: unregisterService(opts.servicesPath ?? defaultServicesPath(), label) };
}

/* ── Drift: installed schedules that no longer match their definition (ISC-298) ── */

export interface DriftRow { name: string; label: string; installed: string; compiled: string }

/** The part of a plist that says when it fires; the rest (bun path, env) can change without moving a run. */
function whenOf(plist: string): string {
  const start = plist.search(/<key>Start(Calendar)?Interval<\/key>/);
  const end = plist.indexOf("<key>RunAtLoad</key>");
  return start >= 0 && end > start ? plist.slice(start, end).replace(/\s+/g, " ").trim() : "";
}

/**
 * Every installed com.lifeos.wf plist whose firing times differ from a fresh compile of its definition: the
 * definition changed after install, or the system zone changed. `fix` reinstalls each
 * drifted one through installSchedule. A plist with no definition, a disabled one, or one that no longer compiles is
 * left to the Workflows inventory, which already reports those.
 */
export function driftSchedules(opts: InstallOptions & { fix?: boolean } = {}): { drifted: DriftRow[]; fixed: string[] } {
  const defsDir = opts.defsDir ?? definitionsDir();
  const agents = opts.launchAgentsDir ?? defaultAgentsDir();
  const drifted: DriftRow[] = [];
  const fixed: string[] = [];
  if (!existsSync(agents)) return { drifted, fixed };
  for (const file of readdirSync(agents).sort()) {
    if (!file.startsWith(LABEL_PREFIX) || !file.endsWith(".plist")) continue;
    const name = file.slice(LABEL_PREFIX.length, -".plist".length);
    const defPath = pathForName(name, defsDir);
    if (!existsSync(defPath)) continue;
    // ISC-311: any per-workflow plist is drift now; the dispatcher evaluates the schedule, and `fix` removes the plist.
    // A definition that no longer loads is left to the Workflows inventory, which already reports it.
    try { loadDefinitionFile(defPath); } catch { continue; }
    drifted.push({ name, label: labelFor(name), installed: whenOf(readFileSync(join(agents, file), "utf8")), compiled: "evaluated by the dispatcher (no plist)" });
    if (opts.fix) { installSchedule(name, opts); fixed.push(name); }
  }
  return { drifted, fixed };
}

/* ── The dispatcher's own service ───────────────────────────────────────── */

export function dispatcherPlist(opts: { home?: string; bun?: string; path?: string; extraEnv?: Record<string, string> } = {}): string {
  const home = opts.home ?? homedir();
  const env = { ...(opts.extraEnv ?? {}), PATH: opts.path ?? defaultPath(home), HOME: home, LIFEOS_NOTIFICATION_CHANNEL: HEADLESS_CHANNEL };
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const logs = join(home, "Library", "Logs", "lifeos");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    `  <key>Label</key><string>${DISPATCHER_LABEL}</string>`,
    `  <key>ProgramArguments</key>`,
    `  <array>`,
    // The PATH lookup, not this process's execPath: a versioned Cellar path dies on the next bun upgrade, and an installer
    // run from another bun would rewrite the plist and restart the clock.
    `    <string>${esc(opts.bun ?? Bun.which("bun", { PATH: opts.path ?? defaultPath(home) }) ?? process.execPath)}</string>`,
    `    <string>${esc(join(HERE, "dispatcher.ts"))}</string>`,
    `    <string>serve</string>`,
    `  </array>`,
    `  <key>EnvironmentVariables</key>`,
    `  <dict>`,
    ...Object.entries(env).map(([k, v]) => `    <key>${esc(k)}</key><string>${esc(v)}</string>`),
    `  </dict>`,
    `  <key>RunAtLoad</key><true/>`,
    `  <key>KeepAlive</key><true/>`,
    `  <key>ThrottleInterval</key><integer>30</integer>`,
    // Runs are the dispatcher's children; without this, launchd kills them all whenever the dispatcher restarts.
    `  <key>AbandonProcessGroup</key><true/>`,
    `  <key>StandardOutPath</key><string>${esc(join(logs, `${DISPATCHER_LABEL}.out.log`))}</string>`,
    `  <key>StandardErrorPath</key><string>${esc(join(logs, `${DISPATCHER_LABEL}.err.log`))}</string>`,
    `</dict>`,
    `</plist>`,
    ``,
  ].join("\n");
}

/* ── Linux: the same dispatcher as a systemd user service ───────────────── */

export const DISPATCHER_UNIT = `${DISPATCHER_LABEL}.service`;

const onLinux = (opts: InstallOptions) => (opts.platform ?? process.platform) === "linux";
const defaultSystemdUserDir = (home: string = homedir()) => join(home, ".config", "systemd", "user");
const linuxLogsDir = (home: string = homedir()) => join(process.env.XDG_STATE_HOME || join(home, ".local", "state"), "lifeos", "logs");

function unitTarget(opts: InstallOptions & { home?: string }): string {
  const dir = opts.systemdUserDir ?? defaultSystemdUserDir(opts.home);
  mkdirSync(dir, { recursive: true });
  const real = realpathSync(dir);
  const path = join(real, DISPATCHER_UNIT);
  invariant(dirname(path) === real, `Unit path escapes the systemd user directory: ${path}`);
  return path;
}

/**
 * The dispatcher's systemd user unit: the plist's twin. Restart=always is KeepAlive with its 30-second throttle, and
 * KillMode=process is AbandonProcessGroup: runs are the dispatcher's children, and a restart must not kill them.
 */
export function dispatcherUnit(opts: { home?: string; bun?: string; path?: string; extraEnv?: Record<string, string> } = {}): string {
  const home = opts.home ?? homedir();
  const env = { ...(opts.extraEnv ?? {}), PATH: opts.path ?? defaultPath(home), HOME: home, LIFEOS_NOTIFICATION_CHANNEL: HEADLESS_CHANNEL };
  // systemd expands % specifiers everywhere and reads backslash escapes inside quotes.
  const unit = (s: string) => s.replace(/%/g, "%%");
  const quoted = (s: string) => `"${unit(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const logs = linuxLogsDir(home);
  // The PATH lookup, not this process's execPath, for the same reason as the plist.
  const bun = opts.bun ?? Bun.which("bun", { PATH: opts.path ?? defaultPath(home) }) ?? process.execPath;
  return [
    `[Unit]`,
    `Description=LifeOS Workflows dispatcher (evaluates every local time trigger)`,
    ``,
    `[Service]`,
    `Type=simple`,
    `ExecStart=${quoted(bun)} ${quoted(join(HERE, "dispatcher.ts"))} serve`,
    ...Object.entries(env).map(([k, v]) => `Environment=${quoted(`${k}=${v}`)}`),
    `Restart=always`,
    `RestartSec=30`,
    `KillMode=process`,
    `StandardOutput=append:${unit(join(logs, `${DISPATCHER_LABEL}.out.log`))}`,
    `StandardError=append:${unit(join(logs, `${DISPATCHER_LABEL}.err.log`))}`,
    ``,
    `[Install]`,
    `WantedBy=default.target`,
    ``,
  ].join("\n");
}

function installDispatcherSystemd(opts: InstallOptions & { home?: string }): InstallResult {
  const unitPath = unitTarget(opts);
  mkdirSync(linuxLogsDir(opts.home), { recursive: true });
  writeFileAtomic(unitPath, dispatcherUnit({ home: opts.home, extraEnv: installRootEnv(opts.env) }));
  let loaded = false;
  if (opts.load !== false) {
    const systemctl = opts.systemctl ?? realSystemctl;
    const reload = systemctl(["daemon-reload"]);
    invariant(reload.code === 0, `systemctl --user daemon-reload failed (${reload.code}): ${reload.stderr}`);
    // restart, not start: a unit that was already running picks up the rewritten file.
    for (const args of [["enable", DISPATCHER_UNIT], ["restart", DISPATCHER_UNIT]]) {
      const r = systemctl(args);
      invariant(r.code === 0, `systemctl --user ${args.join(" ")} failed (${r.code}): ${r.stderr}`);
    }
    loaded = systemctl(["is-active", "--quiet", DISPATCHER_UNIT]).code === 0;
  }
  return { label: DISPATCHER_LABEL, plistPath: unitPath, loaded, calendar: 0, interval: null };
}

function uninstallDispatcherSystemd(opts: InstallOptions & { home?: string }): { label: string; removedPlist: boolean } {
  const unitPath = unitTarget(opts);
  const systemctl = opts.systemctl ?? realSystemctl;
  if (opts.load !== false) systemctl(["disable", "--now", DISPATCHER_UNIT]);
  const removedPlist = existsSync(unitPath);
  if (removedPlist) Bun.spawnSync(["rm", "-f", unitPath]);
  if (opts.load !== false) systemctl(["daemon-reload"]);
  return { label: DISPATCHER_LABEL, removedPlist };
}

export function installDispatcher(opts: InstallOptions & { home?: string } = {}): InstallResult {
  if (onLinux(opts)) return installDispatcherSystemd(opts);
  const agents = opts.launchAgentsDir ?? defaultAgentsDir();
  const plistPath = plistTarget(agents, DISPATCHER_LABEL);
  writeFileAtomic(plistPath, dispatcherPlist({ home: opts.home, extraEnv: installRootEnv(opts.env) }));
  let loaded = false;
  if (opts.load !== false) {
    const launchctl = opts.launchctl ?? realLaunchctl;
    const target = domain(opts.uid ?? process.getuid!());
    launchctl(["bootout", `${target}/${DISPATCHER_LABEL}`]);
    // bootout returns before the old job has stopped; a bootstrap in that window fails with EIO (seen 2026-10-24, which
    // left the fleet with no clock). Retry briefly: the one Workflows job must not stay unloaded.
    let boot = launchctl(["bootstrap", target, plistPath]);
    for (let i = 0; boot.code !== 0 && i < 10; i++) {
      Bun.sleepSync(500);
      boot = launchctl(["bootstrap", target, plistPath]);
    }
    invariant(boot.code === 0, `launchctl bootstrap failed (${boot.code}): ${boot.stderr}`);
    loaded = true;
  }
  return { label: DISPATCHER_LABEL, plistPath, loaded, calendar: 0, interval: null };
}

export function uninstallDispatcher(opts: InstallOptions = {}): { label: string; removedPlist: boolean } {
  if (onLinux(opts)) return uninstallDispatcherSystemd(opts);
  const plistPath = plistTarget(opts.launchAgentsDir ?? defaultAgentsDir(), DISPATCHER_LABEL);
  if (opts.load !== false) (opts.launchctl ?? realLaunchctl)(["bootout", `${domain(opts.uid ?? process.getuid!())}/${DISPATCHER_LABEL}`]);
  const removedPlist = existsSync(plistPath);
  if (removedPlist) Bun.spawnSync(["rm", "-f", plistPath]);
  return { label: DISPATCHER_LABEL, removedPlist };
}

if (import.meta.main) {
  const [command, name] = process.argv.slice(2);
  try {
    if (command === "install" && name) console.log(JSON.stringify(installSchedule(name)));
    else if (command === "uninstall" && name) console.log(JSON.stringify(uninstallSchedule(name)));
    else if (command === "drift") {
      // The sandbox contract (ISC-121): with LIFEOS_WORKFLOWS_DIR set and no full set of overrides, nothing live is read or reinstalled.
      const sandbox = launchdOptionsFromEnv();
      if (sandbox === null) { console.error("drift: LIFEOS_WORKFLOWS_DIR is set without LIFEOS_WORKFLOWS_LAUNCH_AGENTS, _SERVICES and _LAUNCHCTL; refusing to touch live schedules"); process.exit(2); }
      const r = driftSchedules({ ...sandbox, fix: process.argv.includes("--fix") });
      console.log(JSON.stringify(r));
      if (r.drifted.length > r.fixed.length) process.exit(1);
    }
    else if (command === "install-dispatcher") console.log(JSON.stringify(installDispatcher()));
    else if (command === "uninstall-dispatcher") console.log(JSON.stringify(uninstallDispatcher()));
    else {
      console.error("usage: schedule-install.ts install <name> | uninstall <name> | drift [--fix] | install-dispatcher | uninstall-dispatcher");
      process.exit(2);
    }
  } catch (error) {
    console.error(error instanceof ScheduleCompileError ? error.message : String(error));
    process.exit(1);
  }
}

export { LABEL_PREFIX };
