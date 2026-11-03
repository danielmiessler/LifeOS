#!/usr/bin/env bun
/**
 * @version 1.2.8
 * InstallCodexUpdate.ts — Materialize com.lifeos.codexupdate.plist.template and bootstrap it.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCodexUpdate.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCodexUpdate.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCodexUpdate.ts --status    # check
 *
 * Reads $HOME, substitutes {{HOME}}/{{BUN}}/{{BUN_DIR}} in the template, writes
 * ~/Library/LaunchAgents/com.lifeos.codexupdate.plist, and runs `launchctl bootstrap`.
 * Idempotent — re-running install bootouts the prior load first. Mirrors
 * InstallWorkSweep.ts exactly.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import * as systemd from "./lib/SystemdUser";
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { installVerb } from "./lib/InstallVerb";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const TEMPLATE_PATH = lifeosPath("TOOLS", "com.lifeos.codexupdate.plist.template");
const LAUNCH_AGENTS_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET_PLIST = join(LAUNCH_AGENTS_DIR, "com.lifeos.codexupdate.plist");
const LABEL = "com.lifeos.codexupdate";

async function uid(): Promise<string> {
  const proc = Bun.spawn(["id", "-u"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
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
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  const path = out.trim();
  if (!path) throw new Error("bun not found in PATH — install bun first");
  return path;
}

/** Where `bun install -g` places binaries; empty when bun can't say. public issue #1939, @mj-deving */
async function detectBunGlobalBin(): Promise<string> {
  try {
    const proc = Bun.spawn(["bun", "pm", "bin", "-g"], { stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out.trim() : "";
  } catch {
    return "";
  }
}

async function install(): Promise<void> {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`[InstallCodexUpdate] template missing at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const bunPath = await detectBun();
  const bunDir = bunPath.replace(/\/bun$/, "");
  // `bun install -g` puts codex under `bun pm bin -g` (~/.bun/bin), which is NOT
  // bunDir when bun itself came from Homebrew — so the launchd PATH could never
  // find the codex binary the job exists to update (public issue #1939, @mj-deving).
  const bunGlobalBin = (await detectBunGlobalBin()) || bunDir;
  console.log(`[InstallCodexUpdate] detected bun at ${bunPath} (global bin ${bunGlobalBin})`);
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const materialized = template
    .replace(/\{\{HOME\}\}/g, HOME)
    .replace(/\{\{BUN\}\}/g, bunPath)
    .replace(/\{\{BUN_DIR\}\}/g, bunDir)
    .replace(/\{\{BUN_GLOBAL_BIN\}\}/g, bunGlobalBin);
  if (!existsSync(LAUNCH_AGENTS_DIR)) mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
  }

  writeFileSync(TARGET_PLIST, materialized);
  console.log(`[InstallCodexUpdate] wrote ${TARGET_PLIST}`);

  const r = await launchctl(["bootstrap", `gui/${u}`, TARGET_PLIST]);
  if (!r.ok) {
    console.error(`[InstallCodexUpdate] bootstrap failed: ${r.err.trim()}`);
    process.exit(1);
  }
  console.log(`[InstallCodexUpdate] launchd bootstrap OK — ${LABEL} active`);

  const status = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (status.ok) {
    const stateLine = status.out.split("\n").find((l) => l.includes("state ="));
    console.log(`[InstallCodexUpdate] ${stateLine?.trim() ?? "state unknown"}`);
  }
}

async function uninstall(): Promise<void> {
  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    const r = await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
    console.log(`[InstallCodexUpdate] bootout ${r.ok ? "OK" : "FAILED: " + r.err.trim()}`);
    try { unlinkSync(TARGET_PLIST); console.log(`[InstallCodexUpdate] removed ${TARGET_PLIST}`); } catch {}
  } else {
    console.log(`[InstallCodexUpdate] no plist at ${TARGET_PLIST} — nothing to do`);
  }
}

async function status(): Promise<void> {
  const u = await uid();
  const r = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (!r.ok) {
    console.log(`[InstallCodexUpdate] ${LABEL} not loaded`);
    process.exit(1);
  }
  console.log(r.out);
}

/* ── systemd --user backend (Linux only) ────────────────────────────────────
 * Strictly additive. Every line above is the launchd path and is unchanged;
 * on darwin nothing in this section executes. Translation rules and the
 * reason this is a shared helper rather than per-job unit templates are
 * documented in lib/SystemdUser.ts.
 * ported from public PR #1698, @elhoim
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  const bunPath = await systemd.which("bun");
  if (!bunPath) throw new Error("bun not found in PATH - install bun first");
  return {
    label: LABEL,
    description: "LifeOS codex update",
    exec: [bunPath, lifeosPath("TOOLS", "CodexUpdate.ts")],
    logPath: lifeosPath("MEMORY", "STATE", "com.lifeos.codexupdate.log"),
    workingDirectory: getClaudeDir(),
    schedule: { kind: "calendar", hour: 4, minute: 0 },
  };
}

async function linuxMain(arg: string | undefined): Promise<void> {
  const spec = await linuxSpec();
  const log = (m: string) => console.log(`[InstallCodexUpdate] ${m}`);
  if (arg === "--uninstall") { await systemd.uninstall(spec, log); return; }
  if (arg === "--status") { if (!(await systemd.status(spec, log))) process.exit(1); return; }
  if (!(await systemd.install(spec, log))) process.exit(1);
}

async function main(): Promise<void> {
  const arg = installVerb(process.argv, "InstallCodexUpdate");
  if (systemd.hasUserScheduler()) return linuxMain(arg);
  if (arg === "--uninstall") return uninstall();
  if (arg === "--status") return status();
  return install();
}

if (import.meta.main) {
  main().catch((err) => { console.error(`[InstallCodexUpdate] Fatal: ${err}`); process.exit(1); });
}
