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
import { copyMissing, detectDevTree } from "./InstallEngine";

// Enhancement components are the à-la-carte half of setup. The "LifeOS Core"
// (skills + system prompt + base settings + CLAUDE.md) is installed by Setup's
// core steps; these are the opt-in extras the user (or their AI) picks some/all/none of.
const KNOWN_COMPONENTS = ["statusline", "tooltips", "spinnerverbs", "agents", "pulse", "worksweep", "derivedsync"] as const;
type Component = (typeof KNOWN_COMPONENTS)[number];

interface Ctx {
  configRoot: string;
  lifeosDir: string; // <configRoot>/LIFEOS — the live runtime root
  payloadRoot: string; // <skillRoot>/install/LIFEOS — the shipped runtime tree
  installRoot: string; // <skillRoot>/install — settings.enhancements.json + agents/ live here
  home: string;
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

function httpCode(url: string): string {
  try {
    return execFileSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "3", url]).toString().trim();
  } catch {
    return "000";
  }
}

// ── component deployers ──────────────────────────────────────────────

/** Pulse: ensure the PULSE tree is laid down, then install + load its plist. */
function deployPulse(ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component: "pulse", ready: false, actions: [], blockers: [] };
  const av = availability("PULSE", ctx);
  const pulseDir = join(ctx.lifeosDir, "PULSE");
  const plistDst = join(ctx.launchAgents, "com.lifeos.pulse.plist");

  if (!av.inLive && !av.inPayload) {
    r.blockers.push(`PULSE not in live tree (${pulseDir}) or payload (${join(ctx.payloadRoot, "PULSE")})`);
    return r;
  }
  r.ready = true;
  if (!ctx.apply) {
    if (!av.inLive) r.actions.push(`copy PULSE from payload → ${pulseDir}`);
    r.actions.push(`materialize ${plistDst} (__HOME__ → ${ctx.home})`, "launchctl bootstrap gui/<uid> (skip if already loaded + unchanged)", "poll 127.0.0.1:31337/healthz until 200");
    return r;
  }

  try {
    ensurePresent("PULSE", ctx);
    const plistSrc = join(pulseDir, "com.lifeos.pulse.plist");
    if (!existsSync(plistSrc)) throw new Error(`plist template missing at ${plistSrc}`);
    const materialized = readFileSync(plistSrc, "utf-8")
      .replaceAll("__HOME__", ctx.home)
      .replaceAll("__BUN_PATH__", process.execPath);
    const u = uid();
    const sameOnDisk = existsSync(plistDst) && readFileSync(plistDst, "utf-8") === materialized;
    const alreadyLoaded = launchctl(["print", `gui/${u}/com.lifeos.pulse`]).ok;

    // Idempotent: a loaded service with an identical plist is left running.
    if (sameOnDisk && alreadyLoaded) {
      r.applied = false;
      r.probe = { name: "pulse-healthz", passed: httpCode("http://127.0.0.1:31337/healthz") === "200", detail: "already loaded, plist unchanged (idempotent)" };
      return r;
    }

    if (existsSync(plistDst) && !sameOnDisk) backup(plistDst);
    mkdirSync(ctx.launchAgents, { recursive: true });
    writeFileSync(plistDst, materialized);
    if (alreadyLoaded) launchctl(["bootout", `gui/${u}`, plistDst]);
    const boot = launchctl(["bootstrap", `gui/${u}`, plistDst]);
    r.applied = true;

    // Readiness poll: launchd bootstrap returns before Pulse binds :31337.
    let code = "000";
    for (let i = 0; i < 12; i++) {
      code = httpCode("http://127.0.0.1:31337/healthz");
      if (code === "200") break;
      Bun.sleepSync(500);
    }
    r.probe = { name: "pulse-healthz", passed: code === "200", detail: `healthz → ${code}${boot.ok ? "" : ` (bootstrap: ${boot.out.trim()})`}` };
  } catch (err) {
    r.error = err instanceof Error ? err.message : String(err);
  }
  return r;
}

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

/** Delegate a launchd job to its own standalone installer (no-arg = install). */
function deployLaunchdJob(component: Component, installerRel: string, ctx: Ctx): ComponentResult {
  const r: ComponentResult = { component, ready: false, actions: [], blockers: [] };
  const av = availability(installerRel, ctx);
  // The installer needs sibling TOOLS files (templates, WorkSweep.ts, …), so the
  // unit of staging is the whole TOOLS dir — uniform with pulse/statusline.
  const toolsAv = availability("TOOLS", ctx);
  const installer = join(ctx.lifeosDir, installerRel);

  if (!av.inLive && !toolsAv.inPayload) {
    r.blockers.push(`${installerRel} not in live tree and TOOLS not in payload (${join(ctx.payloadRoot, "TOOLS")}) — runtime tree not staged`);
    return r;
  }
  r.ready = true;
  if (!ctx.apply) {
    if (!av.inLive) r.actions.push(`stage TOOLS from payload → ${join(ctx.lifeosDir, "TOOLS")}`);
    r.actions.push(`bun ${installer}  (delegates plist materialize + launchctl bootstrap)`);
    return r;
  }

  try {
    if (!existsSync(installer)) ensurePresent("TOOLS", ctx);
    if (!existsSync(installer)) {
      r.blockers.push(`installer still missing after staging: ${installer}`);
      return r;
    }
    const out = execFileSync("bun", [installer], { stdio: ["pipe", "pipe", "pipe"], timeout: 60000 }).toString();
    r.applied = true;
    // Confirm the job actually loaded, not just that the installer exited 0.
    const label = component === "worksweep" ? "com.lifeos.worksweep" : "com.lifeos.derivedsync";
    const loaded = launchctl(["print", `gui/${uid()}/${label}`]).ok;
    r.probe = { name: `${component}-loaded`, passed: loaded, detail: loaded ? `${label} loaded` : `installer exit 0 but ${label} not loaded: ${out.trim().split("\n").slice(-1)[0]}` };
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

function deploy(component: Component, ctx: Ctx): ComponentResult {
  switch (component) {
    case "pulse": return deployPulse(ctx);
    case "statusline": return deployStatusline(ctx);
    case "tooltips": return deploySettingsKey("tooltips", "spinnerTipsOverride", ctx);
    case "spinnerverbs": return deploySettingsKey("spinnerverbs", "spinnerVerbs", ctx);
    case "agents": return deployAgents(ctx);
    case "worksweep": return deployLaunchdJob("worksweep", join("TOOLS", "InstallWorkSweep.ts"), ctx);
    case "derivedsync": return deployLaunchdJob("derivedsync", join("TOOLS", "InstallDerivedSync.ts"), ctx);
  }
}

// ── main ─────────────────────────────────────────────────────────────

function main(): void {
  const a = process.argv.slice(2);
  const home = process.env.HOME || "";
  const configRoot = arg(a, "--config-root") || process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
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
