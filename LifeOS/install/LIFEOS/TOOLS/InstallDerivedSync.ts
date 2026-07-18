#!/usr/bin/env bun
/**
 * InstallDerivedSync.ts - Materialize com.lifeos.derivedsync.plist.template and bootstrap it.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallDerivedSync.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallDerivedSync.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallDerivedSync.ts --status    # check
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, realpathSync } from "fs";
import { join } from "path";
import { claudeDir } from "./lifeos-root";

type SpawnProcess = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: (signal?: string) => void;
};

declare const Bun: { spawn: (cmd: string[], opts?: { stdout?: "pipe" | "ignore"; stderr?: "pipe" | "ignore" }) => SpawnProcess };

type CommandExit = {
  exit: number;
  ms: number;
  timedOut: boolean;
};

type LaunchctlResult = {
  ok: boolean;
  out: string;
  err: string;
  exit: number;
  ms: number;
};

const HOME = process.env.HOME || "";
const TEMPLATE_PATH = join(claudeDir(), "LIFEOS", "TOOLS", "com.lifeos.derivedsync.plist.template");
const LAUNCH_AGENTS_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET_PLIST = join(LAUNCH_AGENTS_DIR, "com.lifeos.derivedsync.plist");
const LABEL = "com.lifeos.derivedsync";
const COMMAND_TIMEOUT_MS = 30 * 1000;

async function exitedWithTimeout(proc: SpawnProcess): Promise<CommandExit> {
  const started = Date.now();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
  }, COMMAND_TIMEOUT_MS);
  const exit = await proc.exited;
  clearTimeout(timer);
  return { exit, ms: Date.now() - started, timedOut };
}

async function uid(): Promise<string> {
  const proc = Bun.spawn(["id", "-u"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  const result = await exitedWithTimeout(proc);
  if (result.timedOut) throw new Error(`id -u timed out after ${result.ms}ms`);
  if (result.exit !== 0) throw new Error(`id -u failed with exit ${result.exit} after ${result.ms}ms`);
  return out.trim();
}

async function launchctl(args: string[]): Promise<LaunchctlResult> {
  const proc = Bun.spawn(["launchctl", ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const result = await exitedWithTimeout(proc);
  return { ok: result.exit === 0 && !result.timedOut, out, err, exit: result.exit, ms: result.ms };
}

async function detectBun(): Promise<string> {
  const proc = Bun.spawn(["which", "bun"], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  const result = await exitedWithTimeout(proc);
  if (result.timedOut) throw new Error(`which bun timed out after ${result.ms}ms`);
  if (result.exit !== 0) throw new Error(`which bun failed with exit ${result.exit} after ${result.ms}ms`);
  const path = out.trim();
  if (!path) throw new Error("bun not found in PATH - install bun first");
  return path;
}

async function install(): Promise<void> {
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`[InstallDerivedSync] template missing at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const bunPath = await detectBun();
  const bunDir = bunPath.replace(/\/bun$/, "");
  const userDir = realpathSync(join(claudeDir(), "LIFEOS", "USER"));
  console.log(`[InstallDerivedSync] detected bun at ${bunPath}`);
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const materialized = template
    .replace(/\{\{HOME\}\}/g, HOME)
    .replace(/\{\{BUN\}\}/g, bunPath)
    .replace(/\{\{BUN_DIR\}\}/g, bunDir)
    .replace(/\{\{USER_DIR\}\}/g, userDir);
  if (!existsSync(LAUNCH_AGENTS_DIR)) mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
  }

  writeFileSync(TARGET_PLIST, materialized);
  console.log(`[InstallDerivedSync] wrote ${TARGET_PLIST}`);

  const r = await launchctl(["bootstrap", `gui/${u}`, TARGET_PLIST]);
  if (!r.ok) {
    console.error(`[InstallDerivedSync] bootstrap failed: ${r.err.trim()}`);
    process.exit(1);
  }
  console.log(`[InstallDerivedSync] launchd bootstrap OK - ${LABEL} active`);

  const status = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (status.ok) {
    const stateLine = status.out.split("\n").find((l) => l.includes("state ="));
    console.log(`[InstallDerivedSync] ${stateLine?.trim() ?? "state unknown"}`);
  } else {
    console.log(`[InstallDerivedSync] bootstrap succeeded but status check failed: ${status.err.trim()}`);
  }
}

async function uninstall(): Promise<void> {
  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    const r = await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
    console.log(`[InstallDerivedSync] bootout ${r.ok ? "OK" : "FAILED: " + r.err.trim()}`);
    try { unlinkSync(TARGET_PLIST); console.log(`[InstallDerivedSync] removed ${TARGET_PLIST}`); } catch { /* bootout result is already reported */ }
  } else {
    console.log(`[InstallDerivedSync] no plist at ${TARGET_PLIST} - nothing to do`);
  }
}

async function status(): Promise<void> {
  const u = await uid();
  const r = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (!r.ok) {
    console.log(`[InstallDerivedSync] ${LABEL} not loaded`);
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

main().catch((err) => { console.error(`[InstallDerivedSync] Fatal: ${err}`); process.exit(1); });
