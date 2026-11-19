import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { allServices, type Svc } from "../TOOLS/Services.ts";
import { collectLaunchd } from "./sources/launchd.ts";
import { collectSystemd } from "./sources/systemd.ts";
import { collectAgents, launchdHomeOf } from "./sources/agents.ts";
import { collectPulse } from "./sources/pulse.ts";
import { collectCloud } from "./sources/cloud.ts";
import { collectProjects, collectSkills, collectSops } from "./sources/other.ts";
import { collectV2 } from "./sources/v2.ts";
import { card } from "./sources/shared.ts";
import { workflowStats } from "./sources/stats.ts";
import { invariant } from "../TOOLS/Invariant.ts";
import { definitionsDir, ledgerPath } from "./engine/paths.ts";
import type { Inventory, WorkflowRecord, Finding, FindingKind, Runtime, Executor, WorkflowSnapshot } from "./types.ts";

// ISC-100: the canonical health derivation. It lives in health.ts (pure, browser-safe) and is exported from here.
export { DEF_HEALTH_META, RECENT_MS, deriveHealth, type DefHealth, type HealthInput } from "./health.ts";

const home = homedir();
const root = join(home, ".claude");
export interface Sources {
  home: string; platform: NodeJS.Platform; launchAgents: string; launchctlList: string; registry: Svc[]; servicesConfig: string; agentJobs: string; agentRuns: string;
  /** `cloudFleet`: the Cloudflare Worker fleet root, holding `Workers/<dir>` and top-level Worker dirs. */
  pulseSystem: string; pulseUser: string; pulseState: string; cloudFleet: string; projectRoots: string[];
  /** `sops`: every SOP directory to read; ids are file basenames. */
  skills: string; sops: string[]; overlay: string; baseline: string; now: Date;
  /** Workflows definitions home (`<name>.workflow.yaml`) and the run ledger its evidence comes from. */
  workflowDefs: string; workflowLedger: string;
  systemdUser?: string; systemdTimers?: { name: string; text: string }[]; systemdShow?: string;
}
/**
 * Every skill customization's SOP directory (`<customizations>/<skill>/SOPs`), sorted. Discovered, never named:
 * which skills carry SOPs is the install's data, and an install with none gets an empty list.
 */
export function sopDirs(customizations: string = join(root, "LIFEOS/USER/CUSTOMIZATIONS/SKILLS")): string[] {
  if (!existsSync(customizations)) return [];
  return readdirSync(customizations).sort().map(skill => join(customizations, skill, "SOPs")).filter(dir => existsSync(dir));
}

export function defaultSources(platform: NodeJS.Platform = process.platform): Sources {
  let launchctlList = "";
  if (platform === "darwin") {
    try {
      const result = Bun.spawnSync(["launchctl", "list"], { stdout: "pipe", stderr: "pipe" });
      if (result.exitCode === 0) launchctlList = result.stdout.toString();
    } catch { /* A failed live-state probe leaves an empty listing. */ }
  }
  // systemd user timers (Linux), read the way launchd plists are read on macOS.
  let systemdUser: string | undefined;
  let systemdTimers: { name: string; text: string }[] | undefined;
  let systemdShow: string | undefined;
  if (platform === "linux") {
    systemdUser = join(home, ".config/systemd/user");
    systemdTimers = [];
    try {
      const names = readdirSync(systemdUser, { withFileTypes: true }).filter(d => d.isFile() && d.name.endsWith(".timer")).map(d => d.name).sort();
      for (const name of names) {
        try { systemdTimers.push({ name, text: readFileSync(join(systemdUser, name), "utf8") }); } catch { /* An unreadable timer file is skipped. */ }
      }
    } catch { /* No user timer directory means no timers. */ }
    systemdShow = "";
    if (systemdTimers.length) {
      try {
        const units = [...systemdTimers.map(t => t.name), ...systemdTimers.map(t => t.name.replace(/\.timer$/, ".service"))];
        const result = Bun.spawnSync(["systemctl", "--user", "show", ...units, "-p", "Id,Description,UnitFileState,ActiveState,LastTriggerUSec,Result"], { stdout: "pipe", stderr: "pipe" });
        if (result.exitCode === 0) systemdShow = result.stdout.toString();
      } catch { /* A failed live-state probe leaves an empty listing. */ }
    }
  }
  return { home, platform, launchAgents: join(home, "Library/LaunchAgents"), launchctlList, registry: allServices(), servicesConfig: join(root, "LIFEOS/USER/CONFIG/services.json"),
    agentJobs: join(root, "LIFEOS/USER/CONFIG/agent-jobs.json"), agentRuns: join(root, "LIFEOS/USER/MEMORY/STATE/agent-jobs/runs.json"),
    pulseSystem: join(root, "LIFEOS/PULSE/PULSE.toml"), pulseUser: join(root, "LIFEOS/USER/CONFIG/PULSE.user.toml"), pulseState: join(root, "LIFEOS/PULSE/state/state.json"),
    cloudFleet: join(root, "LIFEOS/USER/CUSTOMIZATIONS/WORKFLOWS"), projectRoots: [join(home, "Projects"), join(home, "LocalProjects"), ...lifeosSubsystems(root)],
    skills: join(root, "skills"), sops: sopDirs(),
    overlay: join(root, "LIFEOS/USER/CONFIG/workflows.json"), baseline: join(root, "LIFEOS/USER/CONFIG/workflows-baseline.json"), now: new Date(),
    workflowDefs: definitionsDir(), workflowLedger: ledgerPath(), systemdUser, systemdTimers, systemdShow };
}
/**
 * Every LifeOS subsystem directory (`LIFEOS/<NAME>`), scanned as a project root so a Worker it keeps in its own `worker/`
 * folder is inventoried with its crons. Before this, the Location and STATVS Workers' schedules ran unlisted (2026-10-18).
 */
export function lifeosSubsystems(root: string): string[] {
  const base = join(root, "LIFEOS");
  try { return readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "USER").map((d) => join(base, d.name)); } catch { return []; }
}
const RUNTIME_LABEL: Record<Runtime, string> = { launchd: "launchd", systemd: "systemd", "agent-job": "agent job", "pulse-cron": "Pulse cron", cloud: "Cloudflare", "project-cron": "project cron", skill: "skill", workflow: "workflow" };
const RUNTIME_NOUN: Record<Runtime, string> = { launchd: "launchd services", systemd: "systemd timers", "agent-job": "agent jobs", "pulse-cron": "Pulse jobs", cloud: "Cloudflare Workers", "project-cron": "project-repo crons", skill: "skill intents", workflow: "typed workflows" };
const RUNTIMES: Runtime[] = ["launchd", "systemd", "agent-job", "pulse-cron", "cloud", "project-cron", "skill", "workflow"];
// "wf", "a", "f", "p" are the fleet's Worker-name prefix (`wf-f-…`), a live identifier until each flow migrates.
const stop = new Set(["com", "lifeos", "job", "jobs", "da", "assistant", "life", "cron", "worker", "wf", "a", "f", "p"]);
// Pure digits are record indexes (`Vector:1`), not words.
const tokens = (s: string): Set<string> => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(t => t && !stop.has(t) && !/^\d+$/.test(t)));
/** The Workflows clock itself: a launchd job by necessity, never migration debt. */
export const WORKFLOWS_CLOCK_ID = "launchd:com.lifeos.workflows-dispatcher";
/** Runtimes that run work outside Workflows. Cloud Workers, project crons and skills are inventoried apps and intents, not schedulers LifeOS owns locally. */
export const LEGACY_RUNTIMES: readonly Runtime[] = ["launchd", "agent-job", "pulse-cron"];
/**
 * Every enabled, installed record in a legacy runtime except the Workflows clock: what still runs outside Workflows.
 * A registry row with nothing installed runs nothing; if it is ever installed again, it is flagged here again.
 */
export function outsideWorkflows(records: readonly WorkflowRecord[]): WorkflowRecord[] {
  return records.filter(r => LEGACY_RUNTIMES.includes(r.runtime) && r.enabled && r.installed !== "absent" && r.id !== WORKFLOWS_CLOCK_ID);
}
export const findingKey =(f: Pick<Finding, "kind" | "ids">): string => `${f.kind}:${[...f.ids].sort().join(",")}`;
function readJson(path: string, error: (source: string, message: string) => void): any {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")); } catch (e) { error(path, String(e)); return {}; }
}
export function buildInventory(opts: Partial<Sources> = {}): Inventory {
  const complete = (["home", "platform", "launchAgents", "launchctlList", "registry", "servicesConfig", "agentJobs", "agentRuns", "pulseSystem", "pulseUser", "pulseState", "cloudFleet", "projectRoots", "skills", "sops", "overlay", "baseline", "now", "workflowDefs", "workflowLedger"] satisfies Array<keyof Sources>).every(key => key in opts);
  const s: Sources = complete ? opts as Sources : { ...defaultSources(opts.platform), ...opts };
  const shown = (path: string): string => path.replace(s.home, "~");
  const errors: Inventory["errors"] = [];
  const error = (source: string, message: string): void => { errors.push({ source: shown(source), message: message.slice(0, 200) }); };
  if (s.platform !== "darwin" && s.platform !== "linux") error("launchd", "Live launchd state is macOS-only.");
  const config = readJson(s.servicesConfig, error);
  const declaredDeclines = (Array.isArray(config) ? config.find(row => Array.isArray(row?._declined))?._declined : undefined) ?? [];
  const declined = new Set<string>(declaredDeclines.filter((label: unknown): label is string => typeof label === "string"));
  const launch = collectLaunchd(s.platform === "linux" ? join(s.home, ".no-launchagents") : s.launchAgents, s.platform === "darwin" ? s.launchctlList : "", shown, error, s.registry, declined);
  const byLaunch = new Map(launch.records.map(r => [r.id, r]));
  const agents = collectAgents(s.agentJobs, s.agentRuns, byLaunch, shown, error);
  const connections = { checked: 0, runtime: 0, mismatch: 0 };
  const typed = collectV2(s.workflowDefs, s.workflowLedger, shown, error, connections);
  // A typed workflow's `com.lifeos.wf.<name>` plist is the same work seen from launchd: absorb it into the workflow
  // record (as an agent job absorbs its plist) instead of listing it as a separate, undeclared service.
  const wfPlist = (name: string): string => `launchd:com.lifeos.wf.${name}`;
  // A launchd job with no schedule of its own, named for a typed workflow (`com.lifeos.<x>` for workflow `<x>`, dots as
  // dashes), is that workflow's executor: the workflow decides when and starts it with `launchctl kickstart`. It exists
  // because macOS checks Full Disk Access against the process launchd starts (2026-10-22: the messages reader read
  // nothing when run as a child of the dispatcher). Given a schedule of its own, it is a second scheduler and stays listed.
  const typedNames = new Set(typed.map(w => w.name));
  const executors = launch.records.filter(r => r.trigger.kind === "on-demand" && r.name.startsWith("com.lifeos.") && typedNames.has(r.name.slice("com.lifeos.".length).replaceAll(".", "-"))).map(r => r.id);
  const absorbed = new Set([...agents.map(a => launchdHomeOf(a.name)), ...typed.map(w => wfPlist(w.name)), ...executors]);
  const records: WorkflowRecord[] = [
    ...launch.records.filter(r => !absorbed.has(r.id)), ...agents,
    ...collectSystemd(s.systemdUser ?? "", s.systemdTimers ?? [], s.systemdShow ?? "", shown),
    ...collectPulse([s.pulseSystem, s.pulseUser], s.pulseState, shown, error),
    ...collectCloud(s.cloudFleet, shown, error), ...collectProjects(s.projectRoots, shown, error),
    ...collectSkills(s.skills, shown, error), ...typed,
  ].sort((a, b) => a.id.localeCompare(b.id));
  // ISC-89: the installed plist's hash against the definition on disk. A plist with no hash key proves nothing either way.
  const drifted: Array<{ id: string; title: string }> = [];
  // ISC-312: the one dispatcher job evaluates every local time trigger, so a timed local workflow with no plist of its
  // own is installed exactly when that job is. A leftover per-workflow plist still wins below, so ISC-311 sees it.
  const clock = byLaunch.get(WORKFLOWS_CLOCK_ID);
  for (const w of typed) {
    const plist = byLaunch.get(wfPlist(w.name));
    if (!plist) {
      if (w.installed === "absent" && w.group === "local" && clock) {
        w.installed = clock.installed;
        w.alsoInstalledAs = `scheduled by ${clock.name} · ${clock.definedIn}`;
      }
      continue;
    }
    w.installed = plist.installed;
    w.alsoInstalledAs = `${plist.name} · ${plist.definedIn}`;
    if (plist.compiledFrom && w.definitionHash && plist.compiledFrom !== w.definitionHash) drifted.push({ id: w.id, title: w.title });
  }
  const overlay = readJson(s.overlay, error).cards ?? {};
  for (const r of records) {
    const o = overlay[r.id];
    if (!o || typeof o !== "object") continue;
    // A slot the overlay fills takes the overlay's word on whether it is inferred; every other slot keeps the collector's.
    const filled = new Set(Object.keys(o));
    const inferred = [...r.card.inferred.filter(k => !filled.has(k)), ...(Array.isArray(o.inferred) ? o.inferred : [])];
    r.card = card({ ...r.card, ...o, inferred });
  }
  // SOP directories live under USER customizations, outside the public release payload; none means no SOPs.
  const sops = s.sops.flatMap(dir => collectSops(dir, shown, error));
  for (const sop of sops) sop.usedBy = records.filter(r => r.card.sop === sop.id || r.card.sop === sop.path).map(r => r.id);
  const acknowledged = new Set<string>(readJson(s.baseline, error).acknowledged ?? []);
  const findings: Finding[] = [];
  const add = (kind: FindingKind, severity: Finding["severity"], ids: string[], sentence: string): void => {
    const f = { kind, severity, ids: ids.sort(), sentence: sentence.slice(0, 200), acknowledged: false };
    f.acknowledged = acknowledged.has(findingKey(f)); findings.push(f);
  };
  const agentIds = new Set(agents.map(r => r.name));
  for (const r of records) {
    const danglingJob = r.runtime === "launchd" && r.name.startsWith("com.lifeos.job.") && !agentIds.has(r.name.slice("com.lifeos.job.".length));
    const homes = r.runtime === "agent-job" ? [...r.linked, launchdHomeOf(r.name)] : r.linked;
    // Install state comes from launchd plists, which exist only on macOS; elsewhere absence proves nothing.
    if (s.platform === "darwin" && r.declared && r.installed === "absent" && r.enabled && (danglingJob || (!launch.optIn.has(r.id) && !homes.some(id => launch.optIn.has(id)))))
      add("missing", "high", [r.id], danglingJob ? `${r.title} is registered as a scheduled job, but its job definition no longer exists in agent-jobs.json.` : `${r.title} is declared but is not installed.`);
    if (r.runtime === "launchd" && !r.declared && (r.installed === "loaded" || r.installed === "on-disk"))
      add("orphan", "medium", [r.id], `${r.title} is installed without a declaration.`);
    if (r.trigger.kind === "schedule" && r.enabled && r.evidence.lastRunAt && r.trigger.periodMinutes) {
      const periods = (s.now.getTime() - Date.parse(r.evidence.lastRunAt)) / (r.trigger.periodMinutes * 60_000);
      if (periods > 2 + 15 / r.trigger.periodMinutes) add("late", periods > 6 ? "high" : "medium", [r.id], `${r.title} has not run on time.`);
    }
    if (r.enabled && r.evidence.lastStatus === "error") add("failing", "high", [r.id], `${r.title} last reported a failure.`);
  }
  for (const d of drifted) add("drift", "medium", [d.id], `${d.title} is installed from an older definition than the file on disk; recompile its schedule.`);
  // ISC-38: every typed workflow names the SOP that governs it; one that does not is a gap.
  for (const r of records) if (r.runtime === "workflow" && !r.card.sop) add("no-sop", "low", [r.id], `${r.title} names no SOP.`);
  // Nothing runs outside Workflows (principal directive, 2026-10-22). Every enabled job in a legacy runtime is migration debt
  // until it is a typed definition; the dispatcher is exempt because it is the Workflows clock itself. A scheduled
  // or event-started job is high. An always-on service (a server, a bridge, a menu-bar app) has no schedule to move:
  // it stays a registered service, listed low so the inventory still shows it (principal directive, 2026-10-22).
  for (const r of outsideWorkflows(records)) {
    const service = r.trigger.kind === "daemon";
    add("outside-workflows", service ? "low" : "high", [r.id], service
      ? `${r.title} is an always-on ${RUNTIME_LABEL[r.runtime]} service, registered rather than scheduled.`
      : `${r.title} runs outside Workflows (${RUNTIME_LABEL[r.runtime]}); it must become a typed definition.`);
  }
  const scheduled = records.filter(r => r.trigger.kind === "schedule" && r.enabled);
  for (let i = 0; i < scheduled.length; i++) for (let j = i + 1; j < scheduled.length; j++) {
    const a = scheduled[i], b = scheduled[j];
    if (a.runtime === b.runtime) continue;
    const at = tokens(a.name), bt = tokens(b.name);
    // A one-word name (a repo like "Vector") is a subset of every job that mentions it, so the
    // smaller side needs two tokens unless the sets are equal.
    const within = (x: Set<string>, y: Set<string>) => [...x].every(t => y.has(t)) && (x.size >= 2 || x.size === y.size);
    if (at.size && bt.size && (within(at, bt) || within(bt, at))) {
      // Two records with the same title only read as two things when each says where it runs.
      const same = a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
      const label = (r: WorkflowRecord): string => same ? `${r.title} (${RUNTIME_LABEL[r.runtime]})` : r.title;
      add("possible-duplicate", "medium", [a.id, b.id], `${label(a)} and ${label(b)} may run the same work twice.`);
    }
  }
  for (const runtime of ["cloud", "project-cron", "skill", "launchd", "agent-job", "pulse-cron", "workflow"] as Runtime[]) {
    const ids = scheduled.filter(r => r.runtime === runtime && r.evidence.kind === "none").map(r => r.id);
    if (ids.length) add("no-run-record", "low", ids, `${ids.length} scheduled ${RUNTIME_NOUN[runtime]} have no run record LifeOS can read.`);
  }
  const byRuntime = Object.fromEntries(RUNTIMES.map(r => [r, records.filter(x => x.runtime === r).length])) as Record<Runtime, number>;
  // A skill intent's one synthesized step says only that the prose is followed; its
  // executor is unknown by construction, so counting it would inflate the mix.
  const counted = (r: WorkflowRecord, t: WorkflowRecord["card"]["steps"][number]): boolean => !(r.runtime === "skill" && r.trigger.kind === "on-demand" && t.executor === "unknown");
  const executorMix = Object.fromEntries((["code", "judgment", "model", "human", "unknown"] as Executor[]).map(x => [x, records.reduce((n, r) => n + r.card.steps.filter(t => t.executor === x && counted(r, t)).length, 0)])) as Record<Executor, number>;
  // Healthy means nothing open that matters: acknowledged and low-severity findings do not count against it.
  const afflicted = new Set(findings.filter(f => !f.acknowledged && f.severity !== "low").flatMap(f => f.ids));
  const slots = scheduled.reduce((n, r) => n + 6 - r.card.undeclared.length, 0);
  const mixOf = (rs: WorkflowRecord[]): Record<Executor, number> => Object.fromEntries((["code", "judgment", "model", "human", "unknown"] as Executor[]).map(x => [x, rs.reduce((n, r) => n + r.card.steps.filter(t => t.executor === x).length, 0)])) as Record<Executor, number>;
  const settled = connections.checked + connections.runtime + connections.mismatch;
  const snapshot: WorkflowSnapshot = { date: s.now.toISOString().slice(0, 10), executorMix, typedExecutorMix: mixOf(typed), connections,
    checkedConnectionShare: settled ? connections.checked / settled : null };
  // ISC-146: trailing-30-day figures per typed workflow, read through the ledger's incremental daily index.
  const stats = typed.length ? workflowStats(s.workflowLedger, s.now) : {};
  const workflowStatsByName = Object.fromEntries(typed.map(w => [w.name, stats[w.name] ?? { runs: 0, failed: 0, failureRate: 0, medianDurationMs: null, modelSpendUsd: null }]));
  return { generatedAt: s.now.toISOString(), records, findings, sops, errors, summary: {
    total: records.length, byRuntime, scheduled: scheduled.length, onDemand: records.filter(r => r.trigger.kind === "on-demand").length,
    healthy: scheduled.filter(r => !afflicted.has(r.id)).length, attention: findings.filter(f => !f.acknowledged).length,
    cardCoverage: scheduled.length ? slots / (6 * scheduled.length) : 0, executorMix, workflowStats: workflowStatsByName, snapshot } };
}

/** Where the dated snapshot series lives; a state file, never config. */
export const seriesPath = (): string => join(root, "LIFEOS/USER/MEMORY/STATE/workflows/snapshots.json");

/** The kept series, oldest first; a missing or damaged file is an empty series. */
export function readSeries(path: string = seriesPath()): WorkflowSnapshot[] {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(data?.series) ? data.series.filter((x: any) => typeof x?.date === "string") : [];
  } catch { return []; }
}

/** ISC-91: writes `snapshot` as its day's entry (one per UTC date, the latest write wins) and returns the whole series. */
export function recordSnapshot(snapshot: WorkflowSnapshot, path: string = seriesPath()): WorkflowSnapshot[] {
  invariant(/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date), "Snapshot date must be YYYY-MM-DD");
  invariant(path.endsWith(".json"), "Snapshot series must be a .json file");
  const series = [...readSeries(path).filter(x => x.date !== snapshot.date), snapshot].sort((a, b) => a.date.localeCompare(b.date));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ series }, null, 2) + "\n");
  return series;
}
