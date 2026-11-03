#!/usr/bin/env bun
/**
 * InstallAll — the one deterministic command that brings LifeOS up on this machine: the whole
 * mechanical half of Setup (fresh) or Update (existing install), ending with the core background
 * services running and Pulse serving.
 *
 *   bun Tools/InstallAll.ts                      # plan only: prints every step, changes nothing
 *   bun Tools/InstallAll.ts --yes                # the single consent: run the chain
 *   bun Tools/InstallAll.ts --yes --json         # same, one JSON report on stdout
 *   bun Tools/InstallAll.ts --apply              # same as --yes (every sibling tool takes --apply)
 *
 * Flags: --components <csv>        enhancement components for DeployComponents (default: Setup.md step 7's documented set;
 *                                  `automode` deploys only when named here)
 *        --decline-services <csv>  core services the user said no to (recorded in USER/CONFIG/services.json)
 *        --no-hooks                skip InstallHooks (a harness without hooks, or the user declined)
 *        --mode fresh|upgrade      force the chain (default: upgrade when an install is already present)
 *        --config-root <dir>  --skill-root <dir>  --allow-dev
 *
 * Fresh:   InstallSettings, DeployCore, ScaffoldUser, LinkUser, InstallHooks, DeployComponents, ActivateImports, RenderIdentity,
 *          Migrate, core services.
 * Upgrade: Migrate --mark-from (records the pre-upgrade VERSION before the overlay rewrites it), OverlaySystem,
 *          InstallHooks (only where hooks are already wired), ScaffoldUser, LinkUser, the statusline refresher, DeployComponents (only
 *          with --components), ActivateImports, RenderIdentity, Migrate, core services (which restarts Pulse on the new code).
 * Migrate runs the USER-tree migrations newer than the install's from-version (installer ISA ISC-28), so Doctor, which the
 * Update intent runs after this command, always sees a migrated tree.
 * Core services are the Services.ts registry rows with optIn:false, installed with `Services.ts install --yes`, minus any
 * the user declined now or earlier (`_declined` in services.json). Each one must be loaded afterwards; Pulse must answer.
 *
 * It is the same chain the release boot runs, so the gate tests the path a user takes. Every child is a sibling tool
 * that is idempotent on its own, so a second run changes nothing. It stops at the first failing step. RenderIdentity fills
 * what the config already knows (version, zone, voice) and leaves scaffold names as tokens; the Interview hand-off runs it
 * again with --strict once the names are real. The TELOS interview and the launch alias stay in the agentic Setup.
 *
 * A plan (no --yes/--apply) reports ok:false: nothing was installed, and a caller reading only ok must never take a plan
 * for an install (installer ISA ISC-24).
 *
 * Imports stay inside the skill: this runs from the download directory before ../../../LIFEOS exists.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { CONSENT_ONLY_COMPONENTS, DOCUMENTED_OPTIONAL_COMPONENTS, recordDeclinedServices } from "./DeployComponents";

class InvariantViolation extends Error { constructor(m: string) { super(`invariant violated: ${m}`); this.name = "InvariantViolation"; } }
function invariant(cond: unknown, msg: string): asserts cond { if (!cond) throw new InvariantViolation(msg); }

// ── types ────────────────────────────────────────────────────────────

export type Mode = "fresh" | "upgrade";

export interface InstallOpts {
  configRoot: string;
  skillRoot: string;
  apply: boolean;
  /** Enhancement components the user picked; undefined = the documented default set. */
  components?: string[];
  /** Core service labels or short names the user declined in this run. */
  declineServices: string[];
  hooks: boolean;
  /** Forced chain; undefined = detectMode(). */
  mode?: Mode;
  allowDev: boolean;
  platform: NodeJS.Platform;
  bun: string;
}

export interface RunResult { exit: number; stdout: string; stderr: string; timedOut: boolean }
export type Runner = (argv: string[], env: Record<string, string>, timeoutMs: number) => RunResult;

export interface Deps {
  run: Runner;
  /** True when the URL answers HTTP 200. */
  httpOk: (url: string) => boolean;
}

export interface PlannedStep { name: string; argv: string[]; timeoutMs: number }

export interface StepReport {
  name: string;
  command: string;
  status: "ok" | "failed" | "skipped" | "planned" | "not-run";
  exit?: number;
  reason?: string;
  /** The child's JSON report when it printed one, else its output tail. */
  report?: unknown;
  tail?: string;
}

export interface ServiceRow { label: string; optIn: boolean; loaded: boolean; available: boolean }

export interface ServicesReport {
  core: string[];
  declined: string[];
  targets: string[];
  /** Targets whose installer is not present in this install (Services.ts skips them). */
  skippedInstallers: string[];
  loaded: string[];
  notLoaded: string[];
  /** Targets with no unit for this platform (e.g. the macOS menu-bar app on Linux). */
  unavailable: string[];
  pulseHealthy: boolean | null;
  recordedDeclined?: string[];
}

export interface RetirementSummary { moved: number; refused: number; failures: number; retiredDir: string | null }

export interface InstallReport {
  ok: boolean;
  dryRun: boolean;
  mode: Mode;
  configRoot: string;
  skillRoot: string;
  components: string[];
  steps: StepReport[];
  services: ServicesReport | null;
  /** OverlaySystem's retirement pass (upgrade only). */
  retirements: RetirementSummary | null;
  error?: string;
  /** Set on a plan: what to run to actually install. */
  next?: string;
}

// ── pure planning ────────────────────────────────────────────────────

export const PULSE_LABEL = "com.lifeos.pulse";
export const PULSE_HEALTH_URL = "http://127.0.0.1:31337/healthz";
const SERVICE_PREFIX = /^com\.lifeos\./;

export const shortName = (label: string): string => label.replace(SERVICE_PREFIX, "");

/** An existing install has the runtime VERSION, a settings.json and a USER tree; anything less re-runs the fresh chain (copyMissing, safe). */
export function detectMode(configRoot: string, exists: (p: string) => boolean = existsSync): Mode {
  return exists(join(configRoot, "LIFEOS", "VERSION")) && exists(join(configRoot, "settings.json")) && exists(join(configRoot, "LIFEOS", "USER"))
    ? "upgrade" : "fresh";
}

/** The install marker's version before any step runs, or undefined when there is no valid marker. */
export function installedVersion(configRoot: string): string | undefined {
  const p = join(configRoot, "LIFEOS", "VERSION");
  if (!existsSync(p)) return undefined;
  const v = readFileSync(p, "utf8").trim().replace(/^v/, "");
  return /^\d+\.\d+\.\d+$/.test(v) ? v : undefined;
}

/** True when settings.json already registers at least one hook command (Update.md step 4 re-merges only then). */
export function hooksWired(configRoot: string): boolean {
  try {
    const s = JSON.parse(readFileSync(join(configRoot, "settings.json"), "utf8"));
    return !!s?.hooks && typeof s.hooks === "object" && Object.values(s.hooks).some((groups) => Array.isArray(groups) && groups.length > 0);
  } catch { return false; }
}

/**
 * The DeployComponents selection: the user's picks (or the documented set), minus the core launchd services the
 * services step installs (installing Pulse twice restarts it twice). Consent-only components pass only when named.
 */
export function componentSelection(requested: string[] | undefined, coreShortNames: readonly string[]): string[] {
  const base = requested ?? [...DOCUMENTED_OPTIONAL_COMPONENTS];
  const core = new Set(coreShortNames);
  return [...new Set(base)].filter((c) => !core.has(shortName(c)) && (requested !== undefined || !(CONSENT_ONLY_COMPONENTS as readonly string[]).includes(c)));
}

/** The core service set for this install: registry rows with optIn:false. */
export function coreLabels(rows: ServiceRow[]): string[] {
  return rows.filter((r) => r.optIn === false).map((r) => r.label);
}

/** `_declined` from USER/CONFIG/services.json, or [] when the file is absent or has none. Malformed JSON throws. */
export function readDeclined(servicesJson: string): string[] {
  if (!existsSync(servicesJson)) return [];
  const rows = JSON.parse(readFileSync(servicesJson, "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${servicesJson} must be a JSON array`);
  const meta = rows.find((r) => Array.isArray(r?._declined));
  return meta ? (meta._declined as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

/** Normalise a user-typed service name to the registry label it names (unknown names are returned as typed). */
export function toLabel(name: string, labels: readonly string[]): string {
  return labels.find((l) => l === name || shortName(l) === name) ?? name;
}

/** Services.ts install's skip lines: `  <label> … ⏭  skipped (installer not present …)`. */
export function parseSkippedInstallers(out: string): string[] {
  const hits: string[] = [];
  for (const m of out.matchAll(/^\s+(\S+) … ⏭/gm)) hits.push(m[1]);
  return hits;
}

/** Parse `Services.ts status --json`; throws with the output when it is not the expected array. */
export function parseServiceRows(out: string): ServiceRow[] {
  let v: unknown;
  try { v = JSON.parse(out.trim()); } catch { throw new Error(`Services.ts status --json did not print JSON: ${out.trim().slice(-300)}`); }
  if (!Array.isArray(v)) throw new Error("Services.ts status --json did not print an array");
  return v.map((r: any) => {
    if (typeof r?.label !== "string" || typeof r?.optIn !== "boolean") throw new Error(`malformed Services.ts row: ${JSON.stringify(r)}`);
    return { label: r.label, optIn: r.optIn, loaded: r.loaded === true, available: r.available === true };
  });
}

/** The tool steps for a mode, before the core services step. */
export function planSteps(o: Pick<InstallOpts, "configRoot" | "skillRoot" | "hooks" | "allowDev" | "bun">, mode: Mode, components: string[], wired: boolean, fromVersion?: string): { steps: PlannedStep[]; skipped: StepReport[] } {
  const tool = (name: string, ...args: string[]): PlannedStep => ({
    name,
    argv: [o.bun, join(o.skillRoot, "Tools", `${name}.ts`), "--config-root", o.configRoot, ...args, "--apply", ...(o.allowDev ? ["--allow-dev"] : [])],
    timeoutMs: name === "DeployComponents" || name === "OverlaySystem" ? 600_000 : 300_000,
  });
  const skipped: StepReport[] = [];
  const steps: PlannedStep[] = [];
  const hooksStep = (allowed: boolean, why: string) => {
    if (allowed) steps.push(tool("InstallHooks"));
    else skipped.push({ name: "InstallHooks", command: "bun Tools/InstallHooks.ts --apply", status: "skipped", reason: why });
  };
  if (mode === "fresh") {
    steps.push(tool("InstallSettings"), tool("DeployCore"), tool("ScaffoldUser"), tool("LinkUser"));
    hooksStep(o.hooks, "--no-hooks: hooks not installed (Core runs un-bannered and un-augmented)");
    if (components.length) steps.push(tool("DeployComponents", "--components", components.join(",")));
    steps.push(tool("ActivateImports"), tool("RenderIdentity"), tool("Migrate", ...(fromVersion ? ["--from", fromVersion] : [])));
  } else {
    // The overlay writes the new VERSION, so the old one is recorded in the USER tree first: a re-run after a failed
    // step still migrates from the version the user came from (an earlier recorded version wins).
    if (fromVersion) steps.push({ ...tool("Migrate", "--mark-from", fromVersion), name: "MigrateMark" });
    // The overlay reads the release payload from --skill-root (default: the installed skill, which may be bootstrap-only),
    // so the payload this run was started from has to be passed through.
    steps.push(tool("OverlaySystem", "--skill-root", o.skillRoot));
    hooksStep(o.hooks && wired, o.hooks ? "hooks are not wired in settings.json for this install" : "--no-hooks");
    steps.push(tool("ScaffoldUser"));
    // An install made before the MEMORY leg existed still has a real LIFEOS/MEMORY directory, and the overlay never
    // touches MEMORY. LinkUser moves it into the data home and links it (a no-op once both legs hold), so an upgraded
    // install meets the same two-leg contract Doctor checks.
    steps.push(tool("LinkUser"));
    steps.push({ ...tool("DeployComponents", "--refresh-statusline"), name: "RefreshStatusline" });
    if (components.length) steps.push(tool("DeployComponents", "--components", components.join(",")));
    steps.push(tool("ActivateImports"), tool("RenderIdentity"), tool("Migrate"));
  }
  return { steps, skipped };
}

const display = (argv: string[], o: Pick<InstallOpts, "configRoot" | "skillRoot">): string =>
  argv.map((a) => a.replace(o.skillRoot, "<skill>").replace(o.configRoot, "<config>")).join(" ");

function parseJson(s: string): unknown {
  try { return JSON.parse(s.trim()); } catch { return undefined; }
}

const tailOf = (s: string, n = 1500): string => (s.length <= n ? s : "…" + s.slice(-n));

export function summarizeRetirements(overlay: unknown): RetirementSummary | null {
  const r = (overlay as { retirements?: { moved?: unknown; refused?: unknown; failures?: unknown; retiredDir?: unknown } } | undefined)?.retirements;
  if (!r || typeof r !== "object") return null;
  const len = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  return { moved: len(r.moved), refused: len(r.refused), failures: len(r.failures), retiredDir: typeof r.retiredDir === "string" ? r.retiredDir : null };
}

// ── run ──────────────────────────────────────────────────────────────

/** A finished plan: never ok (nothing was installed), and it says what installs. */
function planned(report: InstallReport): InstallReport {
  invariant(report.dryRun, "planned() is only for a dry run");
  report.ok = false;
  report.next = "plan only, nothing installed: re-run with --yes (or --apply) to install";
  return report;
}

/** Services.ts in the live runtime, else the shipped payload copy (planning before DeployCore). */
/** The payload's own Services.ts first: an upgrade must not ask an older installed copy for a contract it predates
 *  (RC 8.620.0: 7.40.4's Services.ts has no `status --json`, so the upgrade boot failed). The installed copy is the
 *  fallback for an install run without its payload. */
export function servicesTool(configRoot: string, skillRoot: string): string | null {
  return [join(skillRoot, "install", "LIFEOS", "TOOLS", "Services.ts"), join(configRoot, "LIFEOS", "TOOLS", "Services.ts")].find(existsSync) ?? null;
}

export function runInstall(o: InstallOpts, deps: Deps): InstallReport {
  invariant(isAbsolute(o.configRoot) && resolve(o.configRoot) !== "/", `config root must be an absolute, non-root path: ${o.configRoot}`);
  const mode = o.mode ?? detectMode(o.configRoot);
  const env: Record<string, string> = { ...(process.env as Record<string, string>), CLAUDE_CONFIG_DIR: o.configRoot };
  const report: InstallReport = { ok: false, dryRun: !o.apply, mode, configRoot: o.configRoot, skillRoot: o.skillRoot, components: [], steps: [], services: null, retirements: null };

  // The registry decides which launchd services are core. Before DeployCore it is read from the payload copy; a plan
  // without either copy cannot name them, and an apply re-reads it after the tool steps.
  const statusRows = (): ServiceRow[] | null => {
    const tool = servicesTool(o.configRoot, o.skillRoot);
    if (!tool) return null;
    const r = deps.run([o.bun, tool, "status", "--json"], env, 60_000);
    if (r.exit !== 0) throw new Error(`Services.ts status --json exited ${r.exit}: ${tailOf(r.stderr || r.stdout, 300)}`);
    return parseServiceRows(r.stdout);
  };

  try {
    const initialRows = statusRows();
    const knownCore = coreLabels(initialRows ?? []).map(shortName);
    report.components = mode === "fresh" || o.components ? componentSelection(o.components, knownCore) : [];
    const { steps, skipped } = planSteps(o, mode, report.components, mode === "upgrade" && hooksWired(o.configRoot), installedVersion(o.configRoot));

    for (const s of skipped) report.steps.push(s);
    for (const step of steps) {
      const command = display(step.argv, o);
      if (!o.apply) { report.steps.push({ name: step.name, command, status: "planned" }); continue; }
      const r = deps.run(step.argv, env, step.timeoutMs);
      const parsed = parseJson(r.stdout);
      const ok = r.exit === 0;
      report.steps.push({
        name: step.name, command, status: ok ? "ok" : "failed", exit: r.exit,
        ...(r.timedOut ? { reason: `timed out after ${step.timeoutMs / 1000}s` } : {}),
        ...(parsed !== undefined ? { report: parsed } : { tail: tailOf(r.stdout + r.stderr) }),
      });
      if (step.name === "OverlaySystem") report.retirements = summarizeRetirements(parsed);
      if (!ok) {
        const rest = steps.slice(steps.indexOf(step) + 1);
        for (const n of rest) report.steps.push({ name: n.name, command: display(n.argv, o), status: "not-run" });
        report.steps.push({ name: "CoreServices", command: "bun LIFEOS/TOOLS/Services.ts install --yes", status: "not-run" });
        report.error = `step ${step.name} failed (exit ${r.exit})`;
        return report;
      }
    }

    // Core services: re-read the registry from the live runtime now that DeployCore/Overlay placed it.
    const rows = o.apply ? statusRows() : initialRows;
    if (!rows) {
      report.steps.push({ name: "CoreServices", command: "bun LIFEOS/TOOLS/Services.ts install --yes", status: o.apply ? "failed" : "planned", reason: "Services.ts not found in the runtime or the payload" });
      if (o.apply) { report.error = "Services.ts not found: cannot install the core services"; return report; }
      return planned(report);
    }
    const core = coreLabels(rows);
    const servicesJson = join(o.configRoot, "LIFEOS", "USER", "CONFIG", "services.json");
    const declinedNow = o.declineServices.map((n) => toLabel(n, core));
    const unknownDecline = declinedNow.filter((l) => !core.includes(l));
    if (unknownDecline.length) throw new Error(`--decline-services names no core service: ${unknownDecline.join(", ")} (core: ${core.map(shortName).join(", ")})`);
    const declined = [...new Set([...readDeclined(servicesJson), ...declinedNow])].filter((l) => core.includes(l)).sort();
    const targets = core.filter((l) => !declined.includes(l));
    const svc: ServicesReport = { core, declined, targets, skippedInstallers: [], loaded: [], notLoaded: [], unavailable: [], pulseHealthy: null };
    report.services = svc;
    const tool = servicesTool(o.configRoot, o.skillRoot)!;
    const installArgv = [o.bun, tool, "install", ...(declined.length ? ["--only", targets.join(",")] : []), "--yes"];
    const command = display(installArgv, o);

    if (!o.apply) {
      report.steps.push({ name: "CoreServices", command, status: targets.length ? "planned" : "skipped", ...(targets.length ? {} : { reason: "every core service was declined" }) });
      return planned(report);
    }

    if (targets.length) {
      const r = deps.run(installArgv, env, 900_000);
      svc.skippedInstallers = parseSkippedInstallers(r.stdout);
      report.steps.push({ name: "CoreServices", command, status: r.exit === 0 ? "ok" : "failed", exit: r.exit, tail: tailOf(r.stdout + r.stderr) });
      if (r.exit !== 0) { report.error = `core service install failed (exit ${r.exit})`; return report; }
    } else {
      report.steps.push({ name: "CoreServices", command, status: "skipped", reason: "every core service was declined" });
    }

    // Evidence, not exit codes: every targeted service is loaded afterwards, and Pulse answers.
    const after = statusRows() ?? [];
    for (const label of targets) {
      if (svc.skippedInstallers.includes(label)) continue;
      const row = after.find((x) => x.label === label);
      if (row?.loaded) svc.loaded.push(label);
      else if ((o.platform === "linux" || o.platform === "win32") && row && !row.available) svc.unavailable.push(label);
      else svc.notLoaded.push(label);
    }
    if (svc.loaded.includes(PULSE_LABEL)) svc.pulseHealthy = deps.httpOk(PULSE_HEALTH_URL);
    // Only what the user said no to is recorded as declined; a service never offered is never "declined".
    const asLaunchd = rows.map((x) => ({ label: x.label, component: shortName(x.label), optIn: x.optIn }));
    svc.recordedDeclined = recordDeclinedServices(servicesJson, asLaunchd, targets, declinedNow, (l) => svc.loaded.includes(l));

    if (svc.notLoaded.length) report.error = `core service(s) not loaded after install: ${svc.notLoaded.join(", ")}`;
    else if (svc.pulseHealthy === false) report.error = `Pulse is loaded but ${PULSE_HEALTH_URL} does not answer 200`;
    report.ok = !report.error;
    return report;
  } catch (e) {
    if (e instanceof InvariantViolation) throw e;
    report.error = e instanceof Error ? e.message : String(e);
    report.ok = false;
    return report;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────

export const defaultDeps: Deps = {
  run: (argv, env, timeoutMs) => {
    const p = Bun.spawnSync(argv, { env, stdout: "pipe", stderr: "pipe", stdin: "ignore", timeout: timeoutMs });
    const timedOut = p.exitCode === null;
    return { exit: p.exitCode ?? 124, stdout: p.stdout.toString(), stderr: p.stderr.toString(), timedOut };
  },
  httpOk: (url) => {
    // Pulse can take a moment to bind after launchd loads it: poll for up to 20s.
    for (let i = 0; i < 20; i++) {
      const p = Bun.spawnSync(["curl", "-fsS", "--max-time", "3", "-o", "/dev/null", "-w", "%{http_code}", url], { stdout: "pipe", stderr: "pipe", timeout: 10_000 });
      if (p.stdout.toString().trim() === "200") return true;
      Bun.sleepSync(1000);
    }
    return false;
  },
};

function arg(a: string[], flag: string): string | undefined {
  const i = a.indexOf(flag);
  return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
}

const csv = (s: string | undefined): string[] | undefined => (s === undefined ? undefined : s.split(",").map((x) => x.trim()).filter(Boolean));

export function parseArgs(a: string[], env: Record<string, string | undefined> = process.env, home: string = homedir()): InstallOpts | { error: string } {
  const mode = arg(a, "--mode");
  if (mode !== undefined && mode !== "fresh" && mode !== "upgrade") return { error: `--mode must be fresh or upgrade, got ${mode}` };
  for (const f of ["--components", "--decline-services", "--config-root", "--skill-root"]) {
    if (a.includes(f) && arg(a, f) === undefined) return { error: `${f} needs a value` };
  }
  return {
    configRoot: resolve(arg(a, "--config-root") || env.CLAUDE_CONFIG_DIR || join(env.HOME || home, ".claude")),
    skillRoot: resolve(arg(a, "--skill-root") || join(import.meta.dir, "..")),
    apply: a.includes("--yes") || a.includes("--apply"),
    components: csv(arg(a, "--components")),
    declineServices: csv(arg(a, "--decline-services")) ?? [],
    hooks: !a.includes("--no-hooks"),
    mode: mode as Mode | undefined,
    allowDev: a.includes("--allow-dev"),
    platform: process.platform,
    bun: /\/bun$/.test(process.execPath) ? process.execPath : "bun",
  };
}

function human(r: InstallReport): string {
  const lines = [`LifeOS ${r.mode} install ${r.dryRun ? "plan (nothing changed; re-run with --yes or --apply)" : r.ok ? "complete" : "FAILED"}`];
  for (const s of r.steps) lines.push(`  ${s.status.padEnd(8)} ${s.name}${s.reason ? ` — ${s.reason}` : ""}`);
  if (r.services && !r.dryRun) {
    lines.push(`  core services loaded: ${r.services.loaded.map(shortName).join(", ") || "none"}`);
    if (r.services.declined.length) lines.push(`  declined: ${r.services.declined.map(shortName).join(", ")}`);
    if (r.services.notLoaded.length) lines.push(`  NOT loaded: ${r.services.notLoaded.join(", ")}`);
    if (r.services.pulseHealthy !== null) lines.push(`  Pulse ${r.services.pulseHealthy ? "answers on :31337" : "does NOT answer on :31337"}`);
  }
  if (r.error) lines.push(`  error: ${r.error}`);
  return lines.join("\n");
}

if (import.meta.main) {
  const a = process.argv.slice(2);
  if (a.includes("--help") || a.includes("-h")) {
    console.log(readFileSync(join(import.meta.dir, "InstallAll.help.md"), "utf8"));
    process.exit(0);
  }
  const parsed = parseArgs(a);
  if ("error" in parsed) {
    console.log(JSON.stringify({ ok: false, error: parsed.error }, null, 2));
    process.exit(1);
  }
  const report = runInstall(parsed, defaultDeps);
  console.log(a.includes("--json") ? JSON.stringify(report, null, 2) : human(report));
  process.exit(report.ok ? 0 : 1);
}
