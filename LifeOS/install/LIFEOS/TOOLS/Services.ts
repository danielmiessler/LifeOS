#!/usr/bin/env bun
import { PRIVATE_SKILL_NAMES } from "./CodeDataBoundary.ts";
/**
 * @version 1.1.41
 * 1.1.39 (2026-10-13): install and uninstall run as argument arrays
 *   (cmd/splitCommand/runCommand), the default uninstall validates the label, and a service named
 *   with --only whose installer is absent exits 1 instead of reporting success.
 * Services — the one-shot control surface for every LifeOS background service.
 *
 * Single source of truth (SERVICES below) + live discovery/parse of the actual
 * launchd plists, so `status` reports reality, not a hand-maintained guess.
 *
 *   bun Services.ts status              # what's running vs installed vs available
 *   bun Services.ts install [--all|--only a,b] [--yes] [--strict]
 *                                       # exit 1 when an install fails or an opt-in service named in --only
 *                                       # has no installer here; --strict makes every missing installer fatal
 *   bun Services.ts uninstall --only a,b
 *   bun Services.ts doc                 # emit the canonical markdown table (for the doc)
 *
 * launchctl install/uninstall are the privileged steps; `status`/`doc` are read-only.
 *
 * Linux: `status`/`doc` branch on `process.platform` to read systemd --user
 * units instead of launchd plists (same pattern as InstallWorkSweep.ts and
 * the sibling Install*.ts scripts, which each materialize a systemd unit
 * pair on Linux). `install` needs no branch here — it just runs each service's
 * `install:` command, which is itself platform-dispatching inside the
 * Install*.ts script. `uninstall` DOES branch: most entries define no explicit
 * `uninstall:`, so the default command is written here and must speak systemd
 * on Linux and launchd on macOS. Services with no systemd unit yet (macOS
 * menu-bar app, deriver — both launchd-only by design) correctly report
 * "✗ missing" on Linux; that's fact, not a bug.
 *
 * ported from public PR #1705, @takanorinishida
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { getClaudeDir } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import * as wintask from "./lib/WinTask";

const IS_LINUX = process.platform === "linux";
const IS_WINDOWS = process.platform === "win32";
const HOME = homedir();
const CLAUDE = getClaudeDir();
const LIFEOS = join(CLAUDE, "LIFEOS");
const TOOLS = join(LIFEOS, "TOOLS");
const PULSE = join(LIFEOS, "PULSE");
const LAUNCH_AGENTS = join(HOME, "Library", "LaunchAgents");
const SYSTEMD_USER = join(HOME, ".config", "systemd", "user");
const HERMES = join(LIFEOS, "HERMES");

/**
 * Shell-safe command construction. A path that holds a space or a
 * shell metacharacter (an install root under a name like "My Drive", or a hostile one) must reach the
 * installer as ONE argument. `cmd()` quotes each word, `splitCommand()` reads such a string back into
 * an argv, and `runCommand()` executes that argv directly with no shell, so nothing is re-parsed.
 * Only a hand-written USER/CONFIG/services.json row that really needs shell syntax (`&&`, `$HOME`, a
 * glob) falls back to bash -c.
 */
export function shq(word: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/** Build the install or uninstall string for an argv; every word is quoted when it needs it. */
export function cmd(...argv: string[]): string {
  return argv.map(shq).join(" ");
}

/**
 * Read a simple command line back into an argv. Returns null when the string needs a shell
 * (operators, expansion, globbing, a leading VAR=value, an unterminated quote), and the caller then
 * keeps the old bash -c behaviour for that one row.
 */
export function splitCommand(command: string): string[] | null {
  const words: string[] = [];
  let cur = "";
  let inWord = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!;
    if (quote === "'") { if (c === "'") quote = null; else cur += c; continue; }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === "$" || c === "`" || c === "\\") return null;
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; inWord = true; continue; }
    if (c === "\\") { if (i + 1 >= command.length) return null; cur += command[++i]; inWord = true; continue; }
    if (/\s/.test(c)) { if (inWord) { words.push(cur); cur = ""; inWord = false; } continue; }
    if (";&|<>()$`*?[]{}!#~\n".includes(c)) return null;
    cur += c; inWord = true;
  }
  if (quote) return null;
  if (inWord) words.push(cur);
  if (words.length === 0 || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]!)) return null;
  return words;
}

export type Cat = "pulse" | "sidecar" | "capture" | "sync" | "sweep" | "maintenance" | "jobs";
export interface Svc {
  /** `com.lifeos.<x>` for services LifeOS installs; a vendor label for a mounted sidecar. */
  label: string;
  title: string;
  purpose: string;
  category: Cat;
  optIn: boolean;           // opt-in at install (vs default-on core)
  install: string;          // shell command that installs+loads it ("#"-prefixed = note, not runnable
  uninstall?: string;
  /** True for entries loaded from the USER-tree config — per-instance private
   *  machinery. `doc` renders these with a containment marker instead of the
   *  raw install command, so the shipped generated table never carries a
   *  private path even when regenerated (Max audit, 7.31.3: the hand-edited
   *  table row was reverted by its own generator — third occurrence of the
   *  self-referential-redaction blind spot). */
  perInstance?: boolean;
  /** Document a conditional maintainer service without exposing its unshipped installer path. */
  maintainerOnly?: boolean;
  /** Windows commands for a service whose `install` is a launchd/systemd shell script (Pulse's
   *  manage.sh). Installers that take a spec need none: they reach Task Scheduler through
   *  SystemdUser → lib/WinTask.ts on their own. */
  windows?: { install: string; uninstall?: string };
}

// Canonical registry: the human-meaningful metadata. Mechanical facts (cadence,
// runner) are read live from the plists in status()/doc().
export const SERVICES: Svc[] = [
  { label: "com.lifeos.pulse", title: "Pulse (dashboard server)", category: "pulse", optIn: false,
    purpose: "The Life Dashboard HTTP server on :31337 — Pulse, the visible surface onto LifeOS.",
    install: cmd("bash", join(PULSE, "manage.sh"), "install"),
    windows: {
      install: cmd("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(PULSE, "manage.ps1"), "install"),
      uninstall: cmd("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(PULSE, "manage.ps1"), "uninstall"),
    } },
  { label: "com.lifeos.pulse-menubar", title: "Pulse menu-bar app", category: "pulse", optIn: false,
    purpose: "macOS menu-bar app for Pulse — quick status + open the dashboard.",
    install: cmd("bash", join(PULSE, "MenuBar/install.sh")) },
  { label: "com.lifeos.deriver", title: "Pulse deriver", category: "pulse", optIn: false,
    purpose: "Regenerates Pulse's derived Data-Plane pages on a cadence.",
    install: cmd("bash", join(PULSE, "manage-deriver.sh"), "install") },
  { label: "com.lifeos.herdr-bridge", title: "Herdr web bridge", category: "pulse", optIn: true,
    purpose: "Phone-browser view and control of herdr agent panes, on loopback behind tailnet-only Tailscale serve, refusing any caller but the principal's Tailscale login.",
    install: cmd("bun", join(PULSE, "HerdrBridge/manage.ts"), "install"),
    uninstall: cmd("bun", join(PULSE, "HerdrBridge/manage.ts"), "uninstall") },
  // Separate but integrated: Hermes runs its own process tree under its own
  // vendor label, and LifeOS owns its health. Registered here so the sidecar
  // can't be up-or-down without the service surface knowing.
  // Listed only while a Hermes home exists: an install that never mounted the
  // sidecar (or stepped off it) must not carry a permanently-missing row.
  ...(existsSync(process.env.HERMES_HOME || join(HOME, ".hermes")) ? [
  { label: "ai.hermes.gateway", title: "Hermes sidecar (gateway)", category: "sidecar" as Cat, optIn: true,
    purpose: "The second front door — Hermes gateway mounting this LifeOS install, serving its message channels. Health probe: `bun LIFEOS/HERMES/Health.ts`.",
    install: cmd("bun", join(HERMES, "Mount.ts")) }] : []),
  { label: "com.lifeos.conduit", title: "Conduit (sensory capture)", category: "capture", optIn: false,
    purpose: "Local current-state capture — feeds memory + TELOS current state.",
    install: cmd("bun", join(PULSE, "Conduit/InstallConduit.ts")) },
  { label: "com.lifeos.conduit.insight", title: "Conduit insight builder", category: "capture", optIn: false,
    purpose: "Builds insights from Conduit's captured signal.",
    install: cmd("bun", join(PULSE, "Conduit/InstallConduitInsight.ts")) },
  { label: "com.lifeos.synthesis", title: "Synthesis", category: "maintenance", optIn: true,
    purpose: "Periodic synthesis pass over recent state/memory (weekly-style rollup).",
    install: `# installed with the Pulse/Conduit stack — see PULSE/` },
  { label: "com.lifeos.distill", title: "Cortex distill (weekly digest)", category: "maintenance", optIn: true,
    purpose: "Weekly harvest of the Knowledge Archive into a routed digest — content ideas, upgrades, archive health.",
    install: `# manual plist (no shipped installer yet; public issue #2248, @mj-deving) — it runs bun ${join(TOOLS, "KnowledgeDistill.ts")} run --headless` },
  { label: "com.lifeos.conveyor-watcher", title: "Conveyor inbox watcher", category: "capture", optIn: true,
    purpose: "Watches ~/Recordings/Inbox and registers dropped recordings in the content-pipeline ledger (Conveyor P1).",
    install: cmd("bun", join(TOOLS, "InstallConveyorWatcher.ts")) },
  { label: "com.lifeos.conveyor-runner", title: "Conveyor stage engine", category: "capture", optIn: true,
    purpose: "Advances claimable INBOX items to PREP via transcription, lease-guarded, one item per tick (Conveyor P2 stage 1).",
    install: cmd("bun", join(TOOLS, "InstallConveyorRunner.ts")) },
  { label: "com.lifeos.worksweep", title: "Work sweep", category: "sweep", optIn: true,
    purpose: "Hourly work capture — untracked sessions, stale items, project checks, TELOS-goal derivation.",
    install: cmd("bun", join(TOOLS, "InstallWorkSweep.ts")) },
  { label: "com.lifeos.atlas", title: "Atlas asset-graph sync", category: "sync", optIn: true,
    purpose: "Reconciles the Atlas asset graph — 15-min tick (hourly full sync) + event-hint targeted syncs via WatchPaths.",
    // InstallAtlas.ts renders the shipped template (launchd or systemd); the row
    // used to point at a hand-made plist. public issue #2246, @mj-deving
    install: cmd("bun", join(LIFEOS, "ATLAS", "InstallAtlas.ts")),
    uninstall: cmd("bun", join(LIFEOS, "ATLAS", "InstallAtlas.ts"), "--uninstall") },
  // Listed only where the Apple Contacts Swift adapter exists (the private contacts skill, not
  // in the public release): without it the hourly tick's first source throws every run, so the
  // row collapses instead of registering a core service that fails out of the box (round 23).
  ...(existsSync(join(CLAUDE, "skills", PRIVATE_SKILL_NAMES.contacts, "Tools", "ContactsCli.swift")) ? [
  { label: "com.lifeos.people", title: "People (contacts sync)", category: "sync" as Cat, optIn: false,
    purpose: "Hourly, headless: runs the People sources in order — Apple Contacts, Gmail, calendar, Stripe, the newsletter — then rebuilds the one people store. Each source is isolated; a failure is recorded, never swallowed. Never writes the business projection: the tick module has no import path to the boundary. Doctrine: LIFEOS/DOCUMENTATION/People/PeopleSystem.md. Listed only where the maintainer-side Apple Contacts adapter exists; the row collapses without it.",
    install: cmd("bun", join(LIFEOS, "PEOPLE", "InstallPeople.ts")),
    uninstall: cmd("bun", join(LIFEOS, "PEOPLE", "InstallPeople.ts"), "--uninstall") }] : []),
  { label: "com.lifeos.derivedsync", title: "Derived-file sync", category: "sync", optIn: true,
    purpose: "Watches 31 USER source files; regenerates PRINCIPAL_TELOS, LIFEOS_STATE, Data-Plane on hand-edits.",
    install: cmd("bun", join(TOOLS, "InstallDerivedSync.ts")) },
  { label: "com.lifeos.velocity", title: "Shipping velocity sync", category: "sync", optIn: true,
    purpose: "Nightly 03:30 (and once at load): recounts commits-to-main across every configured repo into MEMORY/STATE/velocity.json for the Pulse /velocity tab.",
    install: cmd("bun", join(TOOLS, "InstallVelocitySync.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallVelocitySync.ts"), "--uninstall") },
  { label: "com.lifeos.healthsync", title: "Health sync", category: "sync", optIn: true,
    purpose: "Syncs health data into CURRENT_STATE.",
    install: cmd("bun", join(TOOLS, "InstallHealthSync.ts")) },
  // The published-content corpus lives in the corpus Worker (D1/R2/Vectorize; formerly content-mcp) with its own cron;
  // the local contentsync/contentwatch/contentfreshness jobs were retired 2026-09-15 (content-system ISA).
  // Opt-in services whose executables live in a private skill or a maintainer-only config
  // appear only where that dependency exists (Fable in-family audit, 7.52.0 cut).
  { label: "com.lifeos.interviewdue", title: "Interview due-check", category: "maintenance", optIn: true,
    purpose: "Daily 07:10: rebuilds state-evidence, freshness, and interview-due caches feeding the statusline interview chip. Caches only — never claims files.",
    install: cmd("bun", join(TOOLS, "InstallInterviewDue.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallInterviewDue.ts"), "--uninstall") },
  { label: "com.lifeos.modelsync", title: "Model sync (lineup + prices)", category: "maintenance", optIn: false,
    purpose: "Daily 05:10, headless: pulls the Claude lineup and price table from Anthropic's public docs (no key), bumps models.ts CURRENT forward, regenerates model-pricing.json, re-probes the carrier fact when >25d old. Nothing model-shaped is hand-edited.",
    install: cmd("bun", join(TOOLS, "InstallModelSync.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallModelSync.ts"), "--uninstall") },
  { label: "com.lifeos.codexupdate", title: "Codex update", category: "maintenance", optIn: true,
    purpose: "Keeps the Codex mirror / update state current.",
    install: cmd("bun", join(TOOLS, "InstallCodexUpdate.ts")) },
  ...(existsSync(join(TOOLS, "com.lifeos.lifelogideasweep.plist.template")) ? [
  { label: "com.lifeos.lifelogideasweep", title: "Lifelog idea sweep", category: "sweep", optIn: true,
    purpose: "Reads yesterday's wearable recordings for blog-worthy ideas — marked ones verbatim, unmarked ones as pointers — and emails them over. The unmarked pass sends the day's transcript, bystanders' speech included, to a model provider, so it is opt-in and off by default: \"ideaSweepModelPass\": true in USER/CONFIG/lifelog.json.",
    install: cmd("bun", join(TOOLS, "InstallLifelogIdeaSweep.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallLifelogIdeaSweep.ts"), "--uninstall") },
  ] as Svc[] : []),
  ...(existsSync(join(CLAUDE, "skills", PRIVATE_SKILL_NAMES.inbox, "com.lifeos.inboxsweep.plist.template")) ? [
  { label: "com.lifeos.inboxsweep", title: "Inbox sweep", category: "sweep", optIn: true,
    maintainerOnly: true,
    purpose: "Every 5 min: deterministic Gmail triage — archives marketing/notification (podcast pitches, cold outreach) via the inbox sender taxonomy; keep-classes hard-guarded.",
    install: cmd("bun", join(TOOLS, "InstallInboxSweep.ts")), // maintainer-side, listed only where its private template exists
    uninstall: cmd("bun", join(TOOLS, "InstallInboxSweep.ts"), "--uninstall") }, // maintainer-side
  ] as Svc[] : []),
  { label: "com.lifeos.commitmentsweep", title: "Commitment sweep", category: "sweep", optIn: true,
    purpose: "Sweeps commitments/reminders on a cadence.",
    install: cmd("bun", join(TOOLS, "InstallCommitmentSweep.ts")) },
  { label: "com.lifeos.coach", title: "Coach review (DA self-improvement)", category: "maintenance", optIn: true,
    purpose: "Daily 06:30 PT, headless: mines the principal's corrections of the DA (FAILURES/ratings/reflections) into source=coach Upgrade records for the Pulse /upgrades queue (Coach source filter). Zero egress, zero voice.",
    install: cmd("bun", join(TOOLS, "InstallCoach.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallCoach.ts"), "--uninstall") },
  // Blog discovery ranks against the maintainer's own product taxonomy; the tool is maintainer-side
  // and the entry exists only where its installer does (Lane A cross-vendor audit, 7.52.0 cut).
  ...(existsSync(join(TOOLS, "InstallBlogDiscovery.ts")) ? [ // maintainer-side installer
  { label: "com.lifeos.blogdiscovery", title: "Blog discovery", category: "sweep", optIn: true,
    maintainerOnly: true,
    purpose: "Discovers blog-worthy signal on a cadence.",
    install: cmd("bun", join(TOOLS, "InstallBlogDiscovery.ts")) }, // maintainer-side
  ] as Svc[] : []),
  { label: "com.lifeos.socrates", title: "Socrates standing-question tick", category: "maintenance", optIn: true,
    purpose: "Hourly, headless: runs the due Socrates adapters, applies three-valued answers (pass/fail/unknown), routes persisting findings to Achilles + the work repo, exports the redacted Pulse snapshot. Doctrine: LIFEOS/SOCRATES/ISA.md (maintainer-side; the ISA does not ship).",
    install: cmd("bun", join(LIFEOS, "SOCRATES", "InstallSocrates.ts")),
    uninstall: cmd("bun", join(LIFEOS, "SOCRATES", "InstallSocrates.ts"), "--uninstall") },
  ...(existsSync(join(LIFEOS, "VIGIL", "InstallVigil.ts")) ? [{ label: "com.lifeos.vigil", title: "Vigil monitor tick", category: "capture", optIn: true, maintainerOnly: true,
    purpose: "Collects LifeOS monitoring events every five minutes and routes them under the Vigil interruption policy.",
    install: cmd("bun", join(LIFEOS, "VIGIL", "InstallVigil.ts")),
    uninstall: cmd("bun", join(LIFEOS, "VIGIL", "InstallVigil.ts"), "--uninstall") }] as Svc[] : []),
  { label: "com.lifeos.usage-aggregator", title: "Usage aggregator", category: "maintenance", optIn: true,
    purpose: "Aggregates usage/cost telemetry for Pulse.",
    install: cmd("bun", join(TOOLS, "InstallUsageAggregator.ts")) },
  { label: "com.lifeos.messages", title: "Messages reader (iMessage inbox)", category: "capture", optIn: true,
    purpose: "Every 5 min, headless: the compiled lifeos-messages binary (the only process with Full Disk Access) copies new inbound iMessages from chat.db, read-only, into a private 0600 inbox the 10-minute heartbeat reads. Counts-only row per run in messages-reader.jsonl.",
    install: cmd("bun", join(TOOLS, "InstallMessagesSync.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallMessagesSync.ts"), "--uninstall") },
  { label: "com.lifeos.orphanreaper", title: "Orphan reaper (leaked dev servers)", category: "sweep", optIn: true,
    purpose: "Every 15 min, headless: kills dev servers (vitepress/vite/astro/next/wrangler/workerd/`bun run dev`) re-parented to launchd with no terminal and older than ten minutes — what a dead session leaves behind. One JSONL row per kill in orphan-reaper.jsonl.",
    install: cmd("bun", join(TOOLS, "InstallOrphanReaper.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallOrphanReaper.ts"), "--uninstall") },
  { label: "com.lifeos.pegwatch", title: "PegWatch (CPU/GPU peg detector)", category: "sweep", optIn: true,
    purpose: "Every 16 min: detects pegged CPU/GPU, attributes a likely cause from the process table, surfaces a recommendation via silent Pulse banner + pegwatch.jsonl.",
    install: cmd("bun", join(TOOLS, "InstallPegWatch.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallPegWatch.ts"), "--uninstall") },
  { label: "com.lifeos.bunkermonitor", title: "Bunker app monitor", category: "sweep", optIn: true,
    purpose: "Every 5 min: re-runs every Bunker app's ISA Test Strategy probes; emails on green→red / red→green transitions.",
    install: cmd("bun", join(TOOLS, "InstallBunkerMonitor.ts")),
    uninstall: cmd("bun", join(TOOLS, "InstallBunkerMonitor.ts"), "--uninstall") },
];

// Per-instance services live OUTSIDE this file, in the USER tree — an entry
// whose install command points into private infrastructure (a personal Workflows
// worker, a private repo) must never sit in shipped system code. This file
// ships; `LIFEOS/USER/CONFIG/services.json` does not. Absent or malformed
// config → empty list, silently: a fresh public install simply has no
// per-instance services yet.
const USER_SERVICES_PATH = join(LIFEOS, "USER/CONFIG/services.json");
/**
 * What one row of USER/CONFIG/services.json is. The one rule; loadUserServices and the Workflows
 * schedule installer (engine/schedule-install.ts) both ask it, so they cannot disagree on an edge row.
 *   service  — a non-empty string `label` and a string `install`: something this registry can install.
 *   sidecar  — a non-empty string `label` and no `install` key: a third-party service the registry
 *              names but has nothing to run for (sh.brew.moshi-hook). Listed, never launched.
 *   metadata — neither a `label` nor an `install` key: the template's docs entry, the `_declined` record.
 *   invalid  — anything else: an `install` with no label (a real service that lost its label), an empty
 *              or non-string label, a non-string install, or a row that is not an object.
 */
export type ServiceRowKind = "service" | "sidecar" | "metadata" | "invalid";

export function classifyServiceRow(row: unknown): ServiceRowKind {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return "invalid";
  const r = row as Record<string, unknown>;
  const hasLabel = "label" in r;
  const hasInstall = "install" in r;
  if (!hasLabel && !hasInstall) return "metadata";
  if (typeof r.label !== "string" || r.label.length === 0) return "invalid";
  if (!hasInstall) return "sidecar";
  return typeof r.install === "string" ? "service" : "invalid";
}

/** True for a row this registry can install; sidecars, metadata and invalid rows are not services. */
export const isServiceRow = (row: unknown): row is { label: string; install: string } => classifyServiceRow(row) === "service";

export function loadUserServices(): Svc[] {
  try {
    const raw = JSON.parse(readFileSync(USER_SERVICES_PATH, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(isServiceRow)
      .map((s) => ({ ...s, perInstance: true } as Svc));
  } catch { return []; }
}

/** The full registry: shipped system services + this install's per-instance ones. */
/**
 * Nothing runs outside Workflows (OPERATIONAL_PREFERENCES § Workflows, 2026-10-22). A registry service whose work moved into
 * a Workflow definition of the same name (`com.lifeos.<x>` → `<x>` with dots as dashes) is no longer a launchd job, so
 * no consumer expects it loaded, reports it missing, or reinstalls it beside the workflow.
 */
export function movedToWorkflow(label: string, defsDir: string = join(LIFEOS, "USER", "WORKFLOWS")): boolean {
  if (!label.startsWith("com.lifeos.")) return false;
  return existsSync(join(defsDir, `${label.slice("com.lifeos.".length).replaceAll(".", "-")}.workflow.yaml`));
}

export function allServices(): Svc[] {
  return [...SERVICES, ...loadUserServices()].filter((s) => !movedToWorkflow(s.label));
}

function sh(command: string): { code: number; out: string } {
  const p = Bun.spawnSync(["bash", "-c", command], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: (p.stdout.toString() + p.stderr.toString()).trim() };
}

/** Run an argv with no shell; a missing binary is a failed result, not a throw. */
function runArgv(argv: string[]): { code: number; out: string } {
  try {
    const p = Bun.spawnSync(argv, { stdout: "pipe", stderr: "pipe" });
    return { code: p.exitCode ?? 1, out: (p.stdout.toString() + p.stderr.toString()).trim() };
  } catch (e) {
    return { code: 127, out: `${argv[0]}: ${e instanceof Error ? e.message : "could not run"}` };
  }
}

/** Execute an install or uninstall string: directly as an argv when it is a simple command line, through bash only when it needs one. */
export function runCommand(command: string): { code: number; out: string } {
  const argv = splitCommand(command);
  return argv ? runArgv(argv) : sh(command);
}

/** A service label becomes a plist or unit file name and a launchctl target: letters, digits, dot, underscore, dash only. */
export const SAFE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/**
 * The default uninstall, run as argument arrays and direct file removal: the label is validated, never
 * interpolated into a shell string. Returns the result the CLI prints.
 */
export function defaultUninstall(label: string, opts: { linux: boolean; uid?: number } = { linux: IS_LINUX }): { code: number; out: string } {
  if (!SAFE_LABEL.test(label)) return { code: 1, out: `refusing to uninstall: unsafe service label ${JSON.stringify(label.slice(0, 80))}` };
  const rm = (p: string) => { try { rmSync(p, { force: true }); } catch { /* absent or unremovable: the launchctl/systemctl result below is the signal */ } };
  if (IS_WINDOWS && !opts.linux) {
    const r = wintask.removeSync(label);
    return { code: r.ok ? 0 : 1, out: (r.err || r.out).trim() };
  }
  if (opts.linux) {
    runArgv(["systemctl", "--user", "disable", "--now", `${label}.path`, `${label}.timer`, `${label}.service`]);
    for (const ext of ["service", "timer", "path"]) rm(join(SYSTEMD_USER, `${label}.${ext}`));
    return runArgv(["systemctl", "--user", "daemon-reload"]);
  }
  const uid = opts.uid ?? process.getuid?.() ?? Number(runArgv(["id", "-u"]).out);
  runArgv(["launchctl", "bootout", `gui/${uid}/${label}`]);
  rm(join(LAUNCH_AGENTS, `${label}.plist`));
  return { code: 0, out: "" };
}

/**
 * Which selected installers can run. A requested service (named in --only) whose installer script is
 * absent is a FAILURE: the caller asked for it by name, and exiting 0 would report it installed. A
 * default or --all sweep still skips an absent private installer and reports it separately.
 */
export function installerScript(install: string): string | null {
  const argv = splitCommand(install);
  if (argv) return argv.find((w) => /\.(?:ts|sh)$/.test(w)) ?? null;
  const m = install.match(/(\S+\.(?:ts|sh))/);
  return m ? m[1]! : null;
}

/**
 * Can this service be scheduled on Windows? True for a row with explicit `windows` commands, and
 * for a TypeScript installer that reaches Task Scheduler (through SystemdUser.hasUserScheduler()
 * or lib/WinTask directly). A launchd/systemd shell script (the macOS menu-bar app) is not, and
 * reads as unavailable rather than failing the install.
 */
export function windowsCapable(s: Svc): boolean {
  if (s.windows) return true;
  const script = installerScript(s.install);
  if (!script?.endsWith(".ts") || !existsSync(script)) return false;
  try { return /hasUserScheduler\(\)|wintask\./.test(readFileSync(script, "utf8")); } catch { return false; }
}

export function installExitCode(failed: number, skippedRequested: number): number {
  return failed > 0 || skippedRequested > 0 ? 1 : 0;
}

/**
 * Every label launchd currently has loaded. Membership is tested by exact label,
 * so there is nothing to gain by pre-filtering the list — and a `lifeos` filter
 * silently reports any service under a vendor label (the Hermes sidecar) as
 * missing forever, which is the kind of bug that hides a dead service.
 */
function loadedLabelsDarwin(): Set<string> {
  const r = sh("launchctl list 2>/dev/null | awk '{print $3}'");
  return new Set(r.out.split("\n").map((s) => s.trim()).filter(Boolean));
}

/**
 * The systemd --user equivalent. Deliberately NOT filtered to `lifeos` either,
 * for the reason above: a vendor-labelled unit would otherwise read as missing
 * forever. The unit-type suffix is stripped so membership is tested against the
 * same bare label the registry stores.
 */
function loadedLabelsLinux(): Set<string> {
  const r = sh(
    "systemctl --user list-units --all --type=service,timer,path --plain --no-legend 2>/dev/null | awk '{print $1}'",
  );
  return new Set(
    r.out
      .split("\n")
      .map((s) => s.trim().replace(/\.(service|timer|path)$/, ""))
      .filter(Boolean),
  );
}

export function loadedLabels(): Set<string> {
  if (IS_WINDOWS) return wintask.loadedLabels();
  return IS_LINUX ? loadedLabelsLinux() : loadedLabelsDarwin();
}

/**
 * Windows: the installed "unit" is the spec JSON lib/WinTask.ts (or Pulse's manage.ps1) writes
 * beside the task. Not installed yet → the installer script stands in as "available", but only for
 * a service that can be scheduled on Windows at all; the rest read "✗ missing", which is fact.
 */
function findPlistWindows(label: string): { path: string; installed: boolean } | null {
  if (!SAFE_LABEL.test(label)) return null;
  const spec = wintask.specPath(label);
  if (existsSync(spec)) return { path: spec, installed: true };
  const s = allServices().find((x) => x.label === label);
  if (!s || !windowsCapable(s)) return null;
  return { path: installerScript(s.windows?.install ?? s.install) ?? spec, installed: false };
}

/** Find the plist for a label: installed one wins, else a template in TOOLS/PULSE. */
function findPlistDarwin(label: string): { path: string; installed: boolean } | null {
  const installed = join(LAUNCH_AGENTS, `${label}.plist`);
  if (existsSync(installed)) return { path: installed, installed: true };
  const short = label.replace(/^com\.lifeos\./, "");
  // Subsystems that keep their own installer and template beside their code
  // (People) are searched too, so a not-yet-installed service reads "available"
  // instead of "✗ missing" — the Linux side already searched outside TOOLS/PULSE.
  for (const base of [TOOLS, PULSE, join(PULSE, "MenuBar"), join(PULSE, "Conduit"), join(LIFEOS, "PEOPLE")]) {
    for (const cand of [`${label}.plist`, `${label}.plist.template`, `${short}.plist`]) {
      const p = join(base, cand);
      if (existsSync(p)) return { path: p, installed: false };
    }
  }
  return null;
}

/**
 * Find the most cadence-informative systemd unit for a label: a `.timer`
 * (OnCalendar/OnUnitActiveSec) or `.path` (PathModified — the file-watch
 * case, e.g. derivedsync) wins over the bare `.service`, since that's where
 * the scheduling lives. Falls back to the `.service` alone for persistent
 * daemons with no timer/path pairing (e.g. pulse — the systemd analog of a
 * RunAtLoad-only launchd job). Searches the same bases as findPlistDarwin,
 * so a unit shipped beside its installer is found wherever that installer lives.
 */
function findPlistLinux(label: string): { path: string; installed: boolean } | null {
  for (const ext of ["timer", "path", "service"]) {
    const installed = join(SYSTEMD_USER, `${label}.${ext}`);
    if (existsSync(installed)) return { path: installed, installed: true };
  }
  // Not-yet-installed source: most Install*.ts ship a `.template` (placeholders
  // substituted at install time); manage.sh instead keeps pulse's systemd unit
  // as a bare `.service` in PULSE/ (its own __HOME__/__BUN_PATH__ sed step) —
  // the same dual pattern findPlistDarwin already handles on the plist side.
  for (const ext of ["timer", "path", "service"]) {
    for (const base of [TOOLS, PULSE, join(PULSE, "MenuBar"), join(PULSE, "Conduit"), join(LIFEOS, "ATLAS")]) {
      for (const cand of [`${label}.${ext}.template`, `${label}.${ext}`]) {
        const p = join(base, cand);
        if (existsSync(p)) return { path: p, installed: false };
      }
    }
  }
  return null;
}

export function findPlist(label: string): { path: string; installed: boolean } | null {
  if (IS_WINDOWS) return findPlistWindows(label);
  return IS_LINUX ? findPlistLinux(label) : findPlistDarwin(label);
}

function cadenceOfDarwin(plistPath: string): string {
  try {
    const x = readFileSync(plistPath, "utf8");
    const si = x.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/);
    if (si) { const s = +si[1]; return s % 3600 === 0 ? `every ${s / 3600}h` : `every ${Math.round(s / 60)}m`; }
    if (/<key>StartCalendarInterval<\/key>/.test(x)) return "daily/scheduled";
    if (/<key>WatchPaths<\/key>/.test(x)) return "on file-change";
    if (/<key>RunAtLoad<\/key>\s*<true/.test(x)) return "at load";
    return "—";
  } catch { return "?"; }
}

function cadenceOfLinux(unitPath: string): string {
  try {
    const x = readFileSync(unitPath, "utf8");
    if (/^PathModified=/m.test(x)) return "on file-change";
    if (/^OnCalendar=/m.test(x)) return "daily/scheduled";
    // Our generated timers emit bare seconds (`900s` / `900`); accept the
    // min/h suffixes too, since a hand-written unit may use them.
    const oa = x.match(/^OnUnitActiveSec=(\d+)(s|min|h)?/m);
    if (oa) {
      const n = +oa[1];
      const s = oa[2] === "h" ? n * 3600 : oa[2] === "min" ? n * 60 : n;
      return s % 3600 === 0 ? `every ${s / 3600}h` : `every ${Math.round(s / 60)}m`;
    }
    if (/^\[Timer\]/m.test(x)) return "daily/scheduled"; // timer file with neither pattern matched above
    if (/^Type=simple/m.test(x)) return "at load"; // persistent daemon, no timer/path pairing (e.g. pulse)
    return "—";
  } catch { return "?"; }
}

export function cadenceOf(unitPath: string): string {
  if (IS_WINDOWS) return unitPath.endsWith(".json") ? wintask.cadenceOf(unitPath) : "—";
  return IS_LINUX ? cadenceOfLinux(unitPath) : cadenceOfDarwin(unitPath);
}

// CLI dispatch runs only when invoked directly. Pulse's `scheduled` module
// imports SERVICES so the registry has exactly one home; without this guard an
// import would execute a command and, worse, could exit the server process.
if (import.meta.main) {

const cmd = process.argv[2] || "status";
const onlyArg = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i + 1].split(",") : null; })();
const all = process.argv.includes("--all");
const yes = process.argv.includes("--yes");
const pick = (s: Svc) => (onlyArg ? onlyArg.includes(s.label) || onlyArg.includes(s.label.replace(/^com\.lifeos\./, "")) : true);

const REGISTRY = allServices();

if ((cmd === "status" || cmd === "list") && process.argv.includes("--json")) {
  // Machine-readable status, for probes that need one service's state rather than
  // a human table (People ISC-26 is the first). Same three facts the table shows:
  // is it loaded, is a plist installed, what cadence does that plist declare.
  const loaded = loadedLabels();
  console.log(JSON.stringify(
    REGISTRY.map((s) => {
      const pl = findPlist(s.label);
      return {
        label: s.label,
        title: s.title,
        category: s.category,
        optIn: s.optIn,
        loaded: loaded.has(s.label),
        installed: pl?.installed ?? false,
        available: Boolean(pl),
        cadence: pl ? cadenceOf(pl.path) : null,
      };
    }),
    null,
    2,
  ));
} else if (cmd === "status" || cmd === "list") {
  const loaded = loadedLabels();
  console.log(`LifeOS background services (${REGISTRY.length})\n`);
  console.log("  " + "STATE".padEnd(13) + "CADENCE".padEnd(16) + "SERVICE");
  for (const cat of ["pulse", "sidecar", "capture", "sync", "sweep", "maintenance", "jobs"] as Cat[]) {
    const rows = REGISTRY.filter((s) => s.category === cat);
    if (!rows.length) continue;
    console.log(`\n  ── ${cat} ──`);
    for (const s of rows) {
      const pl = findPlist(s.label);
      const state = loaded.has(s.label) ? "● running" : pl?.installed ? "○ installed" : pl ? "· available" : "✗ missing";
      const cad = pl ? cadenceOf(pl.path) : "—";
      console.log("  " + state.padEnd(13) + cad.padEnd(16) + `${s.title}  (${s.label})`);
    }
  }
  // A core service with no scheduler path on this platform (the macOS menu-bar app on Windows) is
  // unavailable here, not down; listing it would make the warning permanent noise.
  const missingCore = REGISTRY.filter((s) => !s.optIn && !loaded.has(s.label) && (!IS_WINDOWS || windowsCapable(s)));
  if (missingCore.length) console.log(`\n  ⚠️ core not running: ${missingCore.map((s) => s.label).join(", ")}`);
} else if (cmd === "doc") {
  console.log("| Service | Category | Cadence | Opt-in | Purpose | Install |");
  console.log("|---------|----------|---------|--------|---------|---------|");
  // Per-instance entries never render as rows: this table lands in shipped
  // DOCUMENTATION, and a row carries the maintainer's real job ids, cron cadence,
  // and purposes (business schedule, mailbox convention) even with a containment
  // marker on it — the marker only exempted the path-leak gate, it did nothing about
  // disclosure (Max in-family audit, 7.50.6 cut). One summary line stands in.
  let perInstance = false;
  for (const s of REGISTRY) {
    if (s.perInstance) { perInstance = true; continue; }
    const pl = findPlist(s.label);
    const cad = pl ? cadenceOf(pl.path) : "—";
    const inst = s.maintainerOnly ? "maintainer-side installer (not in the payload)" : s.install.startsWith("#") ? s.install.slice(1).trim().replaceAll(HOME, "~") : `\`${s.install.replaceAll(HOME, "~")}\``;
    const purpose = s.maintainerOnly ? `${s.purpose} (maintainer-side; not in the public release payload).` : s.purpose;
    console.log(`| **${s.title}** \`${s.label}\` | ${s.category} | ${cad} | ${s.optIn ? "yes" : "core"} | ${purpose} | ${inst} |`);
  }
  if (perInstance) console.log("\n_Per-install private services are defined in `LIFEOS/USER/CONFIG/services.json` and are not listed here._");
} else if (cmd === "install") {
  const targets = REGISTRY.filter(pick).filter((s) => (all || onlyArg ? true : !s.optIn) && !s.install.startsWith("#"));
  // An explicit --only that matches nothing installable is a caller error, not a
  // no-op: DeployComponents delegates here per component and read exit 0 as
  // "installed" for labels this registry does not have, or has only as a
  // `#`-prefixed note (public issue #1872, @GRyndStone). Name each label and why.
  if (onlyArg && targets.length === 0) {
    const why = onlyArg.map((want) => {
      const hit = REGISTRY.find((s) => s.label === want || s.label.replace(/^com\.lifeos\./, "") === want);
      if (!hit) return `${want}: no such service in the registry`;
      if (hit.install.startsWith("#")) return `${want}: not installable here — ${hit.install.slice(1).trim()}`;
      return `${want}: matched but filtered out`;
    });
    console.error(`No installable service matched --only ${onlyArg.join(",")}:\n  ${why.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`Installing ${targets.length} service(s):`);
  if (!yes) { console.log("  (dry preview — re-run with --yes to execute)"); for (const s of targets) console.log(`  ${s.label}: ${s.install.replace(HOME, "~")}`); process.exit(0); }
  // Some services install from a script that lives in a private, release-stripped
  // skill, so on a public install the script simply is not there. Skipping those
  // explicitly beats running them: the bare failure was an opaque exit 1 that read
  // like a broken release rather than "this service belongs to a component you did
  // not install". Caught by a cross-vendor audit, which found the inbox
  // sweep always exiting 1 and an Amber installer advertised but never shipped.
  // A service the caller asked for by name is not allowed to vanish: skipping the absent installer of an
  // opt-in service named with --only is a failure, and --strict makes
  // every skip a failure. Core services keep the reported skip (InstallAll reads the "⏭" line and
  // lists them as skippedInstallers), as does any service in a default or --all sweep.
  const strict = process.argv.includes("--strict");
  let failed = 0, skipped = 0, skippedRequested = 0;
  for (const s of targets) {
    const script = installerScript(s.install);
    // Windows: a service with no Task Scheduler path (a launchd/systemd shell script) is reported
    // unavailable on this platform, the way Linux reports the macOS menu-bar app, never run to fail.
    if (IS_WINDOWS && !windowsCapable(s)) {
      const requested = strict || (Boolean(onlyArg) && s.optIn);
      console.log(`  ${s.label} … ⏭  skipped${requested ? " — REQUESTED, NOT INSTALLED" : ""} (no Windows scheduler support in this installer)`);
      skipped++;
      if (requested) skippedRequested++;
      continue;
    }
    if (script && isAbsolute(script) && !existsSync(script)) {
      const requested = strict || (Boolean(onlyArg) && s.optIn);
      console.log(`  ${s.label} … ⏭  skipped${requested ? " — REQUESTED, NOT INSTALLED" : ""} (installer not present in this install: ${script.replace(HOME, "~")})`);
      skipped++;
      if (requested) skippedRequested++;
      continue;
    }
    process.stdout.write(`  ${s.label} … `);
    const r = runCommand(IS_WINDOWS && s.windows ? s.windows.install : s.install);
    if (r.code === 0) console.log("✅");
    else { console.log(`⚠️ (${r.out.split("\n").pop()})`); failed++; }
  }
  console.log(`\nRun \`bun Services.ts status\` to confirm.${skipped ? ` ${skipped} ${skippedRequested ? "requested installer(s) missing" : "optional installer(s) skipped"}.` : ""}`);
  // Exit non-zero when something actually failed or a requested installer was missing. The old
  // loop printed a warning glyph and still exited 0, so any caller or install script treating
  // the exit code as truth recorded a false success.
  if (failed > 0) console.error(`${failed} service install(s) FAILED.`);
  if (skippedRequested > 0) console.error(`${skippedRequested} requested service installer(s) not present: nothing was installed for them.`);
  process.exitCode = installExitCode(failed, skippedRequested);
} else if (cmd === "uninstall") {
  if (!onlyArg) { console.error("uninstall requires --only <labels> (refusing to remove everything at once)"); process.exit(1); }
  for (const s of REGISTRY.filter(pick)) {
    // The DEFAULT uninstall is platform-dispatched here — unlike install, which
    // delegates to each service's own platform-aware Install*.ts. Only 2 of the
    // registry entries define an explicit `uninstall:`, so without this branch
    // the other 18 ran a launchd-only command that always failed on Linux
    // (Max audit, 7.31.5, on the PR #1705 port).
    // defaultUninstall runs argument arrays on a validated label; `.path` is in the
    // Linux set because WatchPaths services (derivedsync) materialize a path unit, and omitting it
    // left an enabled orphan firing into a deleted service (Max audit, 7.31.6).
    process.stdout.write(`  ${s.label} … `);
    const un = IS_WINDOWS && s.windows ? s.windows.uninstall : s.uninstall;
    const r = un ? runCommand(un) : defaultUninstall(s.label);
    console.log(r.code === 0 ? "🧹" : `⚠️ (${r.out.split("\n").pop()})`);
    if (r.code !== 0 && !SAFE_LABEL.test(s.label)) process.exitCode = 1;
  }
} else {
  console.log("usage: bun Services.ts <status|install|uninstall|doc> [--all] [--only a,b] [--yes] [--strict]");
  process.exit(1);
}

} // end import.meta.main
