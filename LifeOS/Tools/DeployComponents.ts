#!/usr/bin/env bun
/**
 * DeployComponents — Setup step 7.5 (opt-in). Deploys the AI-wide runtime
 * components that the bare skill SHIPS but does not auto-activate: the Pulse
 * dashboard service, the statusline, and the optional launchd jobs
 * (worksweep, derivedsync). Each component is OPT-IN — the Setup workflow asks
 * which the user wants, then calls this with `--components <csv>` (or `--all`).
 *
 * Thin orchestrator: it does not reimplement plist substitution / launchctl for
 * the jobs that already own a standalone installer — it delegates to them
 * (InstallWorkSweep.ts, InstallDerivedSync.ts). Only Pulse's plist install is
 * inlined, because Pulse's own installer (LIFEOS/PULSE/setup.ts) is a bundled
 * interactive flow, not a callable "just install the service" entry point.
 *
 * Self-staging: every component reads from the live runtime tree
 * `<configRoot>/LIFEOS`, falling back to the shipped payload `install/LifeOS/`
 * when the runtime tree isn't laid down yet — uniform across all four (the
 * cross-vendor audit flagged the prior pulse/statusline-only staging as an
 * inconsistent contract).
 *
 * Safety: dry-run by default (`--apply` to mutate); REFUSES on the author's live
 * source tree (`--allow-dev` to override); idempotent per component (a loaded,
 * unchanged service is left running — no restart, no backup churn); never
 * overwrites a populated file without a timestamped backup; a component whose
 * prerequisites are absent reports a LOUD blocker and fails the run (no silent
 * no-op success).
 *
 * Usage:
 *   bun DeployComponents.ts [--components pulse,statusline,worksweep,derivedsync | --all]
 *                           [--config-root <dir>] [--skill-root <dir>]
 *                           [--apply] [--allow-dev]
 *   (dry-run by default — reports the plan per component without writing)
 */

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { copyMissing, detectDevTree, resolveConfigRoot } from "./InstallEngine";

// Enhancement components are the à-la-carte half of setup. The "LifeOS Core"
// (skills + system prompt + base settings + CLAUDE.md) is installed by Setup's
// core steps; these are the opt-in extras the user (or their AI) picks some/all/none of.
//
// Two kinds:
// - Non-launchd: statusline, tooltips, spinnerverbs, agents, commands — settings.json merges + file copies
// - Launchd services: delegated to Services.ts (single source of truth for all 16 background services)
//
// Component names for launchd services are their short labels (pulse, worksweep, amberroute, etc.)
// or the full label (com.lifeos.pulse). Services.ts handles the mapping.
const NON_LAUNCHD_COMPONENTS = ["statusline", "tooltips", "spinnerverbs", "agents", "commands"] as const;
type NonLaunchdComponent = (typeof NON_LAUNCHD_COMPONENTS)[number];

// Launchd components — kept in sync with Services.ts. The install for these is delegated to Services.ts.
// Short labels (without com.lifeos. prefix) for convenience; Services.ts accepts both forms.
const LAUNCHD_COMPONENTS = [
  "pulse", "pulse-menubar", "deriver", "conduit", "conduit.insight", "synthesis",
  "worksweep", "derivedsync", "healthsync", "codexupdate", "commitmentsweep",
  "blogdiscovery", "usage-aggregator", "bookmark-watchdog", "backups", "amberroute"
] as const;
type LaunchdComponent = (typeof LAUNCHD_COMPONENTS)[number];

const KNOWN_COMPONENTS = [...NON_LAUNCHD_COMPONENTS, ...LAUNCHD_COMPONENTS] as const;
type Component = (typeof KNOWN_COMPONENTS)[number];

interface Ctx {
  configRoot: string;
  lifeosDir: string; // <configRoot>/LIFEOS — the live runtime root
  payloadRoot: string; // <skillRoot>/install/LIFEOS — the shipped runtime tree
  installRoot: string; // <skillRoot>/install — settings.enhancements.json + agents/ live here
  home: string;
  bun: string; // resolved bun binary path — substituted for __BUN_PATH__ in launchd plists
  launchAgents: string;
  apply: boolean;
}

interface ComponentResult {
  component: Component;
  ready: boolean; // can be deployed (present in live tree OR payload)
  actions: string[]; // what apply will / did do
  blockers: string[]; // why it can't run — a non-empty list FAILS the run
  applied?: boolean;
  probe?: { name: string; passed: boolean; detail: string };
  error?: string;
}

// ── helpers ──────────────────────────────────────────────────────────

function arg(a: string[], flag: string): string | undefined {
  const i = a.indexOf(flag);
  return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
}

/**
 * Resolve the live runtime dir robustly. The runtime references all-caps
 * `LIFEOS` (statusline, plists), but the sibling install tools use mixed-case
 * `LifeOS` (works on macOS's case-insensitive FS, latent on Linux). Pick
 * whichever actually exists; default to the all-caps runtime name.
 */
function resolveLifeosDir(configRoot: string): string {
  for (const name of ["LIFEOS", "LifeOS"]) {
    if (existsSync(join(configRoot, name))) return join(configRoot, name);
  }
  return join(configRoot, "LIFEOS");
}

const stamp = (): string => String(Date.now());

/** Back up a file aside as <file>.lifeos-backup-<ts> (only if it exists). */
function backup(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const dst = `${path}.lifeos-backup-${stamp()}`;
  copyFileSync(path, dst);
  return dst;
}

/** Where a component's path can be sourced from. */
function availability(rel: string, ctx: Ctx): { inLive: boolean; inPayload: boolean } {
  return { inLive: existsSync(join(ctx.lifeosDir, rel)), inPayload: existsSync(join(ctx.payloadRoot, rel)) };
}

/**
 * Ensure a component path exists in the live tree, copying from the shipped
 * payload only when ABSENT (never overwrites a populated target — idempotent).
 * Returns whether the path is present after the call.
 */
function ensurePresent(rel: string, ctx: Ctx): boolean {
  const dst = join(ctx.lifeosDir, rel);
  if (existsSync(dst)) return true;
  const src = join(ctx.payloadRoot, rel);
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  return true;
}

const uid = (): string => execFileSync("id", ["-u"]).toString().trim();

function launchctl(args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync("launchctl", args, { stdio: ["pipe", "pipe", "pipe"], timeout: 15000 }).toString();
    return { ok: true, out };
  } catch (err) {
    return { ok: false, out: err instanceof Error ? err.message : String(err) };
  }
}

// ── component deployers ──────────────────────────────────────────────

/** Statusline: place the script, chmod +x, wire settings.json statusLine. */
function deployStatusline(ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component: "statusline", ready: false, actions: [], blockers: [] };
  const av = availability("LIFEOS_StatusLine.sh", ctx);
  const scriptPath = join(ctx.lifeosDir, "LIFEOS_StatusLine.sh");
  const settingsPath = join(ctx.configRoot, "settings.json");
  // Build the settings.json command from the ACTUAL install root (ctx.lifeosDir),
  // not a hardcoded ~/.claude — a custom --config-root (e.g. ~/.claude-fable) places
  // the script under its own LIFEOS/, and the old literal pointed at the wrong tree.
  const command = scriptPath.startsWith(`${ctx.home}/`)
    ? `$HOME/${scriptPath.slice(ctx.home.length + 1)}`
    : scriptPath;

  if (!av.inLive && !av.inPayload) {
    r.blockers.push(`LIFEOS_StatusLine.sh not in live tree (${scriptPath}) or payload`);
    return r;
  }
  r.ready = true;
  if (!ctx.apply) {
    if (!av.inLive) r.actions.push(`copy LIFEOS_StatusLine.sh from payload → ${scriptPath}`);
    r.actions.push(`chmod +x ${scriptPath}`, `wire settings.json statusLine → ${command}`);
    return r;
  }

  try {
    ensurePresent("LIFEOS_StatusLine.sh", ctx);
    chmodSync(scriptPath, 0o755);

    // A populated-but-unparseable settings.json must NOT be rewritten from {} —
    // that would silently drop the user's whole config. Abort with a blocker.
    let settings: Record<string, unknown> = {};
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      } catch {
        r.blockers.push(`settings.json exists but is not valid JSON — refusing to rewrite (would drop your config). Fix it, then re-run.`);
        return r;
      }
    }
    const current = settings.statusLine as Record<string, unknown> | undefined;
    const alreadyWired = current?.command === command;
    if (!alreadyWired) {
      backup(settingsPath);
      settings.statusLine = { type: "command", command, refreshInterval: 1 };
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    }
    r.applied = !alreadyWired;
    const reread = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const wired = (reread.statusLine as Record<string, unknown> | undefined)?.command === command;
    let executable = false;
    try { execFileSync("test", ["-x", scriptPath]); executable = true; } catch { executable = false; }
    r.probe = { name: "statusline-wired", passed: wired && executable, detail: `wired=${wired} executable=${executable}${alreadyWired ? " (idempotent)" : ""}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

/**
 * Merge a single Claude-Code enhancement key (spinnerTipsOverride / spinnerVerbs)
 * from the shipped `install/settings.enhancements.json` into the user's
 * settings.json — set-the-key semantics (these are whole-object settings, like
 * statusLine). Idempotent (deep-equal → skip), backup-before-write, parse-abort.
 */
function deploySettingsKey(component: Component, key: string, ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component, ready: false, actions: [], blockers: [] };
  const enhPath = join(ctx.installRoot, "settings.enhancements.json");
  if (!existsSync(enhPath)) {
    r.blockers.push(`settings.enhancements.json not in payload (${enhPath}) — runtime not staged`);
    return r;
  }
  let enh: Record<string, unknown>;
  try { enh = JSON.parse(readFileSync(enhPath, "utf-8")); } catch { r.blockers.push(`${enhPath} is not valid JSON`); return r; }
  if (!(key in enh)) {
    r.blockers.push(`${key} not present in settings.enhancements.json`);
    return r;
  }
  r.ready = true;
  const settingsPath = join(ctx.configRoot, "settings.json");
  if (!ctx.apply) {
    r.actions.push(`merge settings.${key} into ${settingsPath} (backup-first, idempotent)`);
    return r;
  }
  try {
    let settings: Record<string, unknown> = {};
    if (existsSync(settingsPath)) {
      try { settings = JSON.parse(readFileSync(settingsPath, "utf-8")); }
      catch { r.blockers.push(`settings.json exists but is not valid JSON — refusing to rewrite (would drop your config).`); return r; }
    }
    const already = JSON.stringify(settings[key]) === JSON.stringify(enh[key]);
    if (!already) {
      backup(settingsPath);
      settings[key] = enh[key];
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    }
    r.applied = !already;
    const reread = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf-8")) : {};
    const passed = JSON.stringify(reread[key]) === JSON.stringify(enh[key]);
    r.probe = { name: `${component}-merged`, passed, detail: `settings.${key} set${already ? " (idempotent)" : ""}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

/** Agents: copyMissing the shipped agents tree into the harness agents dir (never overwrites). */
function deployAgents(ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component: "agents", ready: false, actions: [], blockers: [] };
  const src = join(ctx.installRoot, "agents");
  const dst = join(ctx.configRoot, "agents");
  if (!existsSync(src) && !existsSync(dst)) {
    r.blockers.push(`agents not in payload (${src}) and not already installed (${dst})`);
    return r;
  }
  r.ready = true;
  if (!ctx.apply) {
    r.actions.push(existsSync(src) ? `copyMissing agents → ${dst} (never overwrites existing)` : `agents already present at ${dst} — no-op`);
    return r;
  }
  try {
    if (!existsSync(src)) {
      r.applied = false;
      r.probe = { name: "agents-present", passed: true, detail: `already present at ${dst} (no payload to copy)` };
      return r;
    }
    const { copied, failures } = copyMissing(src, dst);
    r.applied = copied > 0;
    r.probe = { name: "agents-copied", passed: failures.length === 0 && existsSync(dst), detail: `${copied} agent file(s) copied${failures.length ? `, ${failures.length} failed` : ""}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

// commands mirrors agents exactly: copy the payload's install/commands/ into the
// user's ~/.claude/commands/, never overwriting. The payload is already filtered
// at emit time to public commands only (a command ships iff its target skill
// ships), so there is nothing private-pointing to guard against here.
function deployCommands(ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component: "commands", ready: false, actions: [], blockers: [] };
  const src = join(ctx.installRoot, "commands");
  const dst = join(ctx.configRoot, "commands");
  if (!existsSync(src) && !existsSync(dst)) {
    r.blockers.push(`commands not in payload (${src}) and not already installed (${dst})`);
    return r;
  }
  r.ready = true;
  if (!ctx.apply) {
    r.actions.push(existsSync(src) ? `copyMissing commands → ${dst} (never overwrites existing)` : `commands already present at ${dst} — no-op`);
    return r;
  }
  try {
    if (!existsSync(src)) {
      r.applied = false;
      r.probe = { name: "commands-present", passed: true, detail: `already present at ${dst} (no payload to copy)` };
      return r;
    }
    const { copied, failures } = copyMissing(src, dst);
    r.applied = copied > 0;
    r.probe = { name: "commands-copied", passed: failures.length === 0 && existsSync(dst), detail: `${copied} command file(s) copied${failures.length ? `, ${failures.length} failed` : ""}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

/**
 * Delegate launchd service install to Services.ts — single source of truth for all 16 services.
 * This keeps DeployComponents focused on non-launchd components (settings merges, file copies)
 * while Services.ts owns the full launchd machinery.
 */
function deployViaServices(component: LaunchdComponent, ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component, ready: false, actions: [], blockers: [] };
  const servicesTs = join(ctx.lifeosDir, "TOOLS", "Services.ts");

  // Services.ts must be present (either in live tree or staged from payload)
  const av = availability("TOOLS", ctx);
  if (!av.inLive && !av.inPayload) {
    r.blockers.push(`TOOLS not in live tree (${join(ctx.lifeosDir, "TOOLS")}) or payload`);
    return r;
  }
  r.ready = true;

  // Build the label — Services.ts accepts short form (pulse) or full (com.lifeos.pulse)
  const label = component.startsWith("com.lifeos.") ? component : `com.lifeos.${component}`;

  if (!ctx.apply) {
    if (!av.inLive) r.actions.push(`stage TOOLS from payload → ${join(ctx.lifeosDir, "TOOLS")}`);
    r.actions.push(`bun ${servicesTs.replace(ctx.home, "~")} install --only ${component} --yes`);
    return r;
  }

  try {
    ensurePresent("TOOLS", ctx);
    if (!existsSync(servicesTs)) {
      r.blockers.push(`Services.ts still missing after staging: ${servicesTs}`);
      return r;
    }
    // Delegate to Services.ts
    const out = execFileSync("bun", [servicesTs, "install", "--only", component, "--yes"], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000, // some services take longer (e.g. Pulse waits for healthz)
      cwd: dirname(servicesTs),
    }).toString();
    r.applied = true;
    // Confirm the job actually loaded
    const loaded = launchctl(["print", `gui/${uid()}/${label}`]).ok;
    r.probe = { name: `${component}-loaded`, passed: loaded, detail: loaded ? `${label} loaded via Services.ts` : `Services.ts exit 0 but ${label} not loaded: ${out.trim().split("\n").slice(-1)[0]}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

function isLaunchdComponent(c: Component): c is LaunchdComponent {
  return (LAUNCHD_COMPONENTS as readonly string[]).includes(c);
}

function deploy(component: Component, ctx: Ctx): ComponentResult {
  // Non-launchd components: handled directly
  switch (component) {
    case "statusline": return deployStatusline(ctx);
    case "tooltips": return deploySettingsKey("tooltips", "spinnerTipsOverride", ctx);
    case "spinnerverbs": return deploySettingsKey("spinnerverbs", "spinnerVerbs", ctx);
    case "agents": return deployAgents(ctx);
    case "commands": return deployCommands(ctx);
  }
  // Launchd components: delegate to Services.ts
  if (isLaunchdComponent(component)) {
    return deployViaServices(component, ctx);
  }
  // Fallback (shouldn't reach here with proper types, but TypeScript wants exhaustiveness)
  return { component, ready: false, actions: [], blockers: [`unknown component: ${component}`] };
}

// ── main ─────────────────────────────────────────────────────────────

function main(): void {
  const a = process.argv.slice(2);
  const home = process.env.HOME || "";
  const configRoot = resolveConfigRoot(arg(a, "--config-root"));
  const skillRoot = arg(a, "--skill-root") || join(import.meta.dir, "..");
  const apply = a.includes("--apply");
  const allowDev = a.includes("--allow-dev");

  if (detectDevTree(configRoot) && !allowDev) {
    console.log(JSON.stringify({ ok: false, refused: "dev-tree", detail: `${configRoot} is a LifeOS source tree (skills/_LIFEOS present) — refusing to deploy components. Use --allow-dev only in a sandbox.` }, null, 2));
    process.exit(2);
  }

  // Selection: --all, or --components csv. Dry-run with no selection plans all.
  const csv = arg(a, "--components");
  const selectAll = a.includes("--all");
  let selected: Component[];
  if (selectAll) {
    selected = [...KNOWN_COMPONENTS];
  } else if (csv) {
    const requested = csv.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = requested.filter((c) => !KNOWN_COMPONENTS.includes(c as Component));
    if (unknown.length) {
      console.log(JSON.stringify({ ok: false, error: `unknown component(s): ${unknown.join(", ")}`, known: KNOWN_COMPONENTS }, null, 2));
      process.exit(1);
    }
    selected = requested as Component[];
  } else if (apply) {
    console.log(JSON.stringify({ ok: false, error: "--apply needs --components <csv> or --all (opt-in: nothing deploys implicitly)", known: KNOWN_COMPONENTS }, null, 2));
    process.exit(1);
  } else {
    selected = [...KNOWN_COMPONENTS]; // dry-run planning view
  }

  const ctx: Ctx = {
    configRoot,
    lifeosDir: resolveLifeosDir(configRoot),
    payloadRoot: existsSync(join(skillRoot, "install", "LIFEOS"))
      ? join(skillRoot, "install", "LIFEOS")
      : join(skillRoot, "install", "LifeOS"),
    installRoot: join(skillRoot, "install"),
    home,
    // launchd runs the plist with a minimal PATH, so ProgramArguments[0] must be an
    // absolute bun path. Prefer the interpreter running this installer; fall back to
    // the standard bun install location.
    bun: /\/bun$/.test(process.execPath) ? process.execPath : join(home, ".bun", "bin", "bun"),
    launchAgents: join(home, "Library", "LaunchAgents"),
    apply,
  };

  const results = selected.map((c) => deploy(c, ctx));
  // A blocked component (prereq absent, nothing written) is a FAILURE, not a
  // silent success — `ok` factors in blockers, error, AND probe in both modes.
  const ok = results.every((r) => r.blockers.length === 0 && !r.error && (!r.probe || r.probe.passed));

  console.log(JSON.stringify({
    ok,
    dryRun: !apply,
    configRoot,
    lifeosDir: ctx.lifeosDir,
    payloadRoot: ctx.payloadRoot,
    selected,
    results,
    note: apply ? undefined : "dry-run — re-run with --apply --components <csv> after the user opts in",
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
