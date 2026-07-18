#!/usr/bin/env bun
/**
 * InstallUsageAggregator.ts — Materialize com.lifeos.usage-aggregator.plist.template
 * and bootstrap it as a nightly launchd job (03:30). Mirrors InstallWorkSweep.ts.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallUsageAggregator.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallUsageAggregator.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallUsageAggregator.ts --status    # check
 *
 * Reads $HOME, substitutes {{HOME}}/{{BUN}}/{{BUN_DIR}} in the template, writes
 * ~/Library/LaunchAgents/com.lifeos.usage-aggregator.plist, and runs launchctl
 * bootstrap. Idempotent: re-running bootouts the prior load before bootstrapping.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { claudeDir } from "./lifeos-root";

declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME || "";
const TEMPLATE_PATH = join(claudeDir(), "LIFEOS", "TOOLS", "com.lifeos.usage-aggregator.plist.template");
const LAUNCH_AGENTS_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET_PLIST = join(LAUNCH_AGENTS_DIR, "com.lifeos.usage-aggregator.plist");
const LABEL = "com.lifeos.usage-aggregator";

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

async function install(): Promise<void> {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`[InstallUsageAggregator] template missing at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const bunPath = await detectBun();
  const bunDir = bunPath.replace(/\/bun$/, "");
  console.log(`[InstallUsageAggregator] detected bun at ${bunPath}`);
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const materialized = template
    .replace(/\{\{HOME\}\}/g, HOME)
    .replace(/\{\{BUN\}\}/g, bunPath)
    .replace(/\{\{BUN_DIR\}\}/g, bunDir);
  if (!existsSync(LAUNCH_AGENTS_DIR)) mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
  }

  writeFileSync(TARGET_PLIST, materialized);
  console.log(`[InstallUsageAggregator] wrote ${TARGET_PLIST}`);

  const r = await launchctl(["bootstrap", `gui/${u}`, TARGET_PLIST]);
  if (!r.ok) {
    console.error(`[InstallUsageAggregator] bootstrap failed: ${r.err.trim()}`);
    process.exit(1);
  }
  console.log(`[InstallUsageAggregator] launchd bootstrap OK — ${LABEL} active (nightly 03:30)`);

  const status = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (status.ok) {
    const stateLine = status.out.split("\n").find((l) => l.includes("state ="));
    console.log(`[InstallUsageAggregator] ${stateLine?.trim() ?? "state unknown"}`);
  }
}

async function uninstall(): Promise<void> {
  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    const r = await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
    console.log(`[InstallUsageAggregator] bootout ${r.ok ? "OK" : "FAILED: " + r.err.trim()}`);
    try { unlinkSync(TARGET_PLIST); console.log(`[InstallUsageAggregator] removed ${TARGET_PLIST}`); } catch {}
  } else {
    console.log(`[InstallUsageAggregator] no plist at ${TARGET_PLIST} — nothing to do`);
  }
}

async function status(): Promise<void> {
  const u = await uid();
  const r = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (!r.ok) {
    console.log(`[InstallUsageAggregator] ${LABEL} not loaded`);
    process.exit(1);
  }
  console.log(r.out);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === "--uninstall") return uninstall();
  if (arg === "--status") return status();
  return install();
}

if (import.meta.main) {
  main().catch((err) => { console.error(`[InstallUsageAggregator] Fatal: ${err}`); process.exit(1); });
}
