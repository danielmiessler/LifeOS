#!/usr/bin/env bun
/**
 * @version 1.0.3
 * InstallLifelogIdeaSweep.ts — Materialize com.lifeos.lifelogideasweep.plist.template and bootstrap it.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallLifelogIdeaSweep.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallLifelogIdeaSweep.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallLifelogIdeaSweep.ts --status    # check
 *
 * Runs LifelogIdeaSweep once a day (07:15) over yesterday's recordings and
 * emails whatever it finds. Idempotent.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import * as systemd from "./lib/SystemdUser";
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { installVerb } from "./lib/InstallVerb";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const TEMPLATE_PATH = lifeosPath("TOOLS", "com.lifeos.lifelogideasweep.plist.template");
const LAUNCH_AGENTS_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET_PLIST = join(LAUNCH_AGENTS_DIR, "com.lifeos.lifelogideasweep.plist");
const LABEL = "com.lifeos.lifelogideasweep";

async function uid(): Promise<string> {
  const proc = Bun.spawn(["id", "-u"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text(); await proc.exited; return out.trim();
}
async function launchctl(args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const proc = Bun.spawn(["launchctl", ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const exit = await proc.exited;
  return { ok: exit === 0, out, err };
}
async function detectBun(): Promise<string> {
  const proc = Bun.spawn(["which", "bun"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text(); await proc.exited;
  const path = out.trim(); if (!path) throw new Error("bun not found in PATH — install bun first");
  return path;
}
async function install(): Promise<void> {
  if (!existsSync(TEMPLATE_PATH)) { console.error(`[InstallLifelogIdeaSweep] template missing at ${TEMPLATE_PATH}`); process.exit(1); }
  const bunPath = await detectBun(); const bunDir = bunPath.replace(/\/bun$/, "");
  console.log(`[InstallLifelogIdeaSweep] detected bun at ${bunPath}`);
  const materialized = readFileSync(TEMPLATE_PATH, "utf-8")
    .replace(/\{\{HOME\}\}/g, HOME).replace(/\{\{BUN\}\}/g, bunPath).replace(/\{\{BUN_DIR\}\}/g, bunDir);
  if (!existsSync(LAUNCH_AGENTS_DIR)) mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  const u = await uid();
  if (existsSync(TARGET_PLIST)) await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
  writeFileSync(TARGET_PLIST, materialized);
  console.log(`[InstallLifelogIdeaSweep] wrote ${TARGET_PLIST}`);
  const r = await launchctl(["bootstrap", `gui/${u}`, TARGET_PLIST]);
  if (!r.ok) { console.error(`[InstallLifelogIdeaSweep] bootstrap failed: ${r.err.trim()}`); process.exit(1); }
  console.log(`[InstallLifelogIdeaSweep] launchd bootstrap OK — ${LABEL} active (daily 07:15)`);
  const status = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (status.ok) console.log(`[InstallLifelogIdeaSweep] ${status.out.split("\n").find((l) => l.includes("state ="))?.trim() ?? "state unknown"}`);
}
async function uninstall(): Promise<void> {
  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    const r = await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
    console.log(`[InstallLifelogIdeaSweep] bootout ${r.ok ? "OK" : "FAILED: " + r.err.trim()}`);
    try { unlinkSync(TARGET_PLIST); console.log(`[InstallLifelogIdeaSweep] removed ${TARGET_PLIST}`); } catch {}
  } else console.log(`[InstallLifelogIdeaSweep] no plist at ${TARGET_PLIST} — nothing to do`);
}
async function status(): Promise<void> {
  const u = await uid(); const r = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (!r.ok) { console.log(`[InstallLifelogIdeaSweep] ${LABEL} not loaded`); process.exit(1); }
  console.log(r.out);
}
/* ── systemd --user backend (Linux only) ────────────────────────────────────
 * Strictly additive. Every line above is the launchd path and is unchanged;
 * on darwin nothing in this section executes. Translation rules live in
 * lib/SystemdUser.ts.
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  const bunPath = await systemd.which("bun");
  if (!bunPath) throw new Error("bun not found in PATH - install bun first");
  return {
    label: LABEL,
    description: "LifeOS lifelog blog-idea sweep",
    exec: [bunPath, lifeosPath("TOOLS", "LifelogIdeaSweep.ts"), "run", "--days", "1", "--level", "medium"],
    logPath: lifeosPath("MEMORY", "STATE", "com.lifeos.lifelogideasweep.log"),
    workingDirectory: getClaudeDir(),
    schedule: { kind: "calendar", hour: 7, minute: 15 },
  };
}

async function linuxMain(arg: string | undefined): Promise<void> {
  const spec = await linuxSpec();
  const log = (m: string) => console.log(`[InstallLifelogIdeaSweep] ${m}`);
  if (arg === "--uninstall") { await systemd.uninstall(spec, log); return; }
  if (arg === "--status") { if (!(await systemd.status(spec, log))) process.exit(1); return; }
  if (!(await systemd.install(spec, log))) process.exit(1);
}

async function main(): Promise<void> {
  const arg = installVerb(process.argv, "InstallLifelogIdeaSweep");
  if (systemd.hasUserScheduler()) return linuxMain(arg);
  if (arg === "--uninstall") return uninstall();
  if (arg === "--status") return status();
  return install();
}
if (import.meta.main) main().catch((err) => { console.error(`[InstallLifelogIdeaSweep] Fatal: ${err}`); process.exit(1); });
