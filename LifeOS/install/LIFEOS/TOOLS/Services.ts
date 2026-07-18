#!/usr/bin/env bun
/**
 * Services — the one-shot control surface for every LifeOS background service.
 *
 * Single source of truth (SERVICES below) + live discovery/parse of the actual
 * launchd plists, so `status` reports reality, not a hand-maintained guess.
 *
 *   bun Services.ts status              # what's running vs installed vs available
 *   bun Services.ts install [--all|--only a,b] [--yes]
 *   bun Services.ts uninstall --only a,b
 *   bun Services.ts doc                 # emit the canonical markdown table (for the doc)
 *
 * launchctl install/uninstall are the privileged steps; `status`/`doc` are read-only.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "./lifeos-root";

const HOME = homedir();
// Config root via the canonical resolver (LIFEOS_DIR env / self-location), NOT a
// hardcoded ~/.claude — so `status`/install/uninstall target a custom LifeOS home too.
const CLAUDE = claudeDir();
const LIFEOS = join(CLAUDE, "LIFEOS");
const TOOLS = join(LIFEOS, "TOOLS");
const PULSE = join(LIFEOS, "PULSE");
const LAUNCH_AGENTS = join(HOME, "Library", "LaunchAgents");
const AMBER = join(LIFEOS, "USER/CUSTOMIZATIONS/ARBOL/Workers/_A_AMBER_LEDGER");

type Cat = "pulse" | "capture" | "sync" | "sweep" | "maintenance";
interface Svc {
  label: string;            // com.lifeos.<x>
  title: string;
  purpose: string;
  category: Cat;
  optIn: boolean;           // opt-in at install (vs default-on core)
  install: string;          // shell command that installs+loads it ("#"-prefixed = note, not runnable
  uninstall?: string;
}

// Canonical registry: the human-meaningful metadata. Mechanical facts (cadence,
// runner) are read live from the plists in status()/doc().
const SERVICES: Svc[] = [
  { label: "com.lifeos.pulse", title: "Pulse (dashboard server)", category: "pulse", optIn: false,
    purpose: "The Life Dashboard HTTP server on :31337 — Pulse, the visible surface onto LifeOS.",
    install: `bash ${join(PULSE, "manage.sh")} install` },
  { label: "com.lifeos.pulse-menubar", title: "Pulse menu-bar app", category: "pulse", optIn: false,
    purpose: "macOS menu-bar app for Pulse — quick status + open the dashboard.",
    install: `bash ${join(PULSE, "MenuBar/install.sh")}` },
  { label: "com.lifeos.deriver", title: "Pulse deriver", category: "pulse", optIn: false,
    purpose: "Regenerates Pulse's derived Data-Plane pages on a cadence.",
    install: `bash ${join(PULSE, "manage-deriver.sh")} install` },
  { label: "com.lifeos.conduit", title: "Conduit (sensory capture)", category: "capture", optIn: false,
    purpose: "Local current-state capture — feeds memory + TELOS current state.",
    install: `bun ${join(PULSE, "Conduit/InstallConduit.ts")}` },
  { label: "com.lifeos.conduit.insight", title: "Conduit insight builder", category: "capture", optIn: false,
    purpose: "Builds insights from Conduit's captured signal.",
    install: `bun ${join(PULSE, "Conduit/InstallConduitInsight.ts")}` },
  { label: "com.lifeos.synthesis", title: "Synthesis", category: "maintenance", optIn: true,
    purpose: "Periodic synthesis pass over recent state/memory (weekly-style rollup).",
    install: `# installed with the Pulse/Conduit stack — see PULSE/` },
  { label: "com.lifeos.conveyor-watcher", title: "Conveyor inbox watcher", category: "capture", optIn: true,
    purpose: "Watches ~/Recordings/Inbox and registers dropped recordings in the content-pipeline ledger (Conveyor P1).",
    install: `bun ${join(TOOLS, "InstallConveyorWatcher.ts")}` },
  { label: "com.lifeos.conveyor-runner", title: "Conveyor stage engine", category: "capture", optIn: true,
    purpose: "Advances claimable INBOX items to PREP via transcription, lease-guarded, one item per tick (Conveyor P2 stage 1).",
    install: `bun ${join(TOOLS, "InstallConveyorRunner.ts")}` },
  { label: "com.lifeos.worksweep", title: "Work sweep", category: "sweep", optIn: true,
    purpose: "Hourly UL work capture — untracked sessions, stale items, project checks, TELOS-goal derivation.",
    install: `bun ${join(TOOLS, "InstallWorkSweep.ts")}` },
  { label: "com.lifeos.derivedsync", title: "Derived-file sync", category: "sync", optIn: true,
    purpose: "Watches 31 USER source files; regenerates PRINCIPAL_TELOS, LIFEOS_STATE, Data-Plane on hand-edits.",
    install: `bun ${join(TOOLS, "InstallDerivedSync.ts")}` },
  { label: "com.lifeos.healthsync", title: "Health sync", category: "sync", optIn: true,
    purpose: "Syncs health data into CURRENT_STATE.",
    install: `bun ${join(TOOLS, "InstallHealthSync.ts")}` },
  { label: "com.lifeos.codexupdate", title: "Codex update", category: "maintenance", optIn: true,
    purpose: "Keeps the Codex mirror / update state current.",
    install: `bun ${join(TOOLS, "InstallCodexUpdate.ts")}` },
  { label: "com.lifeos.commitmentsweep", title: "Commitment sweep", category: "sweep", optIn: true,
    purpose: "Sweeps commitments/reminders on a cadence.",
    install: `bun ${join(TOOLS, "InstallCommitmentSweep.ts")}` },
  { label: "com.lifeos.blogdiscovery", title: "Blog discovery", category: "sweep", optIn: true,
    purpose: "Discovers blog-worthy signal on a cadence.",
    install: `bun ${join(TOOLS, "InstallBlogDiscovery.ts")}` },
  { label: "com.lifeos.usage-aggregator", title: "Usage aggregator", category: "maintenance", optIn: true,
    purpose: "Aggregates usage/cost telemetry for Pulse.",
    install: `bun ${join(TOOLS, "InstallUsageAggregator.ts")}` },
  { label: "com.lifeos.bookmark-watchdog", title: "Bookmark pipeline watchdog", category: "capture", optIn: true,
    purpose: "Watches the X bookmark → summarize/idea pipeline for stalls.",
    install: `# ARBOL/BookmarkPipelineWatchdog.ts — see Arbol` },
  { label: "com.lifeos.backups", title: "Backups", category: "maintenance", optIn: true,
    purpose: "Daily 03:00 PT repo backup (Git LFS).",
    install: `# Backups project — installed from its own repo (backup.sh)` },
  { label: "com.lifeos.amberroute", title: "Amber router", category: "capture", optIn: true,
    purpose: "Every 30 min: TELOS-grade unrouted Amber captures → KNOWLEDGE notes / UL issues.",
    install: `bun ${join(AMBER, "Tools/InstallAmberRoute.ts")}`,
    uninstall: `bun ${join(AMBER, "Tools/InstallAmberRoute.ts")} --uninstall` },
];

function sh(cmd: string): { code: number; out: string } {
  const p = Bun.spawnSync(["bash", "-c", cmd], { stdout: "pipe", stderr: "pipe" });
  return { code: p.exitCode ?? 1, out: (p.stdout.toString() + p.stderr.toString()).trim() };
}

function loadedLabels(): Set<string> {
  const r = sh("launchctl list 2>/dev/null | grep -iE 'lifeos' | awk '{print $3}'");
  return new Set(r.out.split("\n").map((s) => s.trim()).filter(Boolean));
}

/** Find the plist for a label: installed one wins, else a template in TOOLS/PULSE. */
function findPlist(label: string): { path: string; installed: boolean } | null {
  const installed = join(LAUNCH_AGENTS, `${label}.plist`);
  if (existsSync(installed)) return { path: installed, installed: true };
  const short = label.replace(/^com\.lifeos\./, "");
  for (const base of [TOOLS, PULSE, join(PULSE, "MenuBar"), join(PULSE, "Conduit")]) {
    for (const cand of [`${label}.plist`, `${label}.plist.template`, `${short}.plist`]) {
      const p = join(base, cand);
      if (existsSync(p)) return { path: p, installed: false };
    }
  }
  return null;
}

function cadenceOf(plistPath: string): string {
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

const cmd = process.argv[2] || "status";
const onlyArg = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i + 1].split(",") : null; })();
const all = process.argv.includes("--all");
const yes = process.argv.includes("--yes");
const pick = (s: Svc) => (onlyArg ? onlyArg.includes(s.label) || onlyArg.includes(s.label.replace(/^com\.lifeos\./, "")) : true);

if (cmd === "status" || cmd === "list") {
  const loaded = loadedLabels();
  console.log(`LifeOS background services (${SERVICES.length})\n`);
  console.log("  " + "STATE".padEnd(13) + "CADENCE".padEnd(16) + "SERVICE");
  for (const cat of ["pulse", "capture", "sync", "sweep", "maintenance"] as Cat[]) {
    const rows = SERVICES.filter((s) => s.category === cat);
    if (!rows.length) continue;
    console.log(`\n  ── ${cat} ──`);
    for (const s of rows) {
      const pl = findPlist(s.label);
      const state = loaded.has(s.label) ? "● running" : pl?.installed ? "○ installed" : pl ? "· available" : "✗ missing";
      const cad = pl ? cadenceOf(pl.path) : "—";
      console.log("  " + state.padEnd(13) + cad.padEnd(16) + `${s.title}  (${s.label})`);
    }
  }
  const missingCore = SERVICES.filter((s) => !s.optIn && !loaded.has(s.label));
  if (missingCore.length) console.log(`\n  ⚠️ core not running: ${missingCore.map((s) => s.label).join(", ")}`);
} else if (cmd === "doc") {
  console.log("| Service | Category | Cadence | Opt-in | Purpose | Install |");
  console.log("|---------|----------|---------|--------|---------|---------|");
  for (const s of SERVICES) {
    const pl = findPlist(s.label);
    const cad = pl ? cadenceOf(pl.path) : "—";
    const inst = s.install.startsWith("#") ? s.install.slice(1).trim() : `\`${s.install.replace(HOME, "~")}\``;
    console.log(`| **${s.title}** \`${s.label}\` | ${s.category} | ${cad} | ${s.optIn ? "yes" : "core"} | ${s.purpose} | ${inst} |`);
  }
} else if (cmd === "install") {
  const targets = SERVICES.filter(pick).filter((s) => (all || onlyArg ? true : !s.optIn) && !s.install.startsWith("#"));
  console.log(`Installing ${targets.length} service(s):`);
  if (!yes) { console.log("  (dry preview — re-run with --yes to execute)"); for (const s of targets) console.log(`  ${s.label}: ${s.install.replace(HOME, "~")}`); process.exit(0); }
  for (const s of targets) {
    process.stdout.write(`  ${s.label} … `);
    const r = sh(s.install);
    console.log(r.code === 0 ? "✅" : `⚠️ (${r.out.split("\n").pop()})`);
  }
  console.log("\nRun `bun Services.ts status` to confirm.");
} else if (cmd === "uninstall") {
  if (!onlyArg) { console.error("uninstall requires --only <labels> (refusing to remove everything at once)"); process.exit(1); }
  for (const s of SERVICES.filter(pick)) {
    const un = s.uninstall || `launchctl bootout gui/$(id -u)/${s.label}; rm -f ${join(LAUNCH_AGENTS, s.label + ".plist")}`;
    process.stdout.write(`  ${s.label} … `);
    const r = sh(un);
    console.log(r.code === 0 ? "🧹" : `⚠️ (${r.out.split("\n").pop()})`);
  }
} else {
  console.log("usage: bun Services.ts <status|install|uninstall|doc> [--all] [--only a,b] [--yes]");
  process.exit(1);
}
