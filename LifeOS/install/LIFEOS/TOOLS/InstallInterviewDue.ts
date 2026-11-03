#!/usr/bin/env bun
/**
 * @version 1.1.10
 * InstallInterviewDue.ts - Materialize com.lifeos.interviewdue.plist.template and bootstrap it.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallInterviewDue.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallInterviewDue.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallInterviewDue.ts --status    # check
 *
 * Daily (07:10, plus once at load) refresh of the interview caches:
 * state-evidence.json, freshness.json, interview-due.json. Cache writes only —
 * the job never touches claims files (ratification happens in /interview).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import * as systemd from "./lib/SystemdUser";
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { installVerb } from "./lib/InstallVerb";

type SpawnProcess = {
  exited: Promise<number>;
  kill: () => void;
};

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

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const TEMPLATE_PATH = lifeosPath("TOOLS", "com.lifeos.interviewdue.plist.template");
const LAUNCH_AGENTS_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET_PLIST = join(LAUNCH_AGENTS_DIR, "com.lifeos.interviewdue.plist");
const LABEL = "com.lifeos.interviewdue";
const COMMAND_TIMEOUT_MS = 30 * 1000;

async function exitedWithTimeout(proc: SpawnProcess): Promise<CommandExit> {
  const started = Date.now();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
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
    console.error(`[InstallInterviewDue] template missing at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const bunPath = await detectBun();
  const bunDir = bunPath.replace(/\/bun$/, "");
  console.log(`[InstallInterviewDue] detected bun at ${bunPath}`);
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
  console.log(`[InstallInterviewDue] wrote ${TARGET_PLIST}`);

  const r = await launchctl(["bootstrap", `gui/${u}`, TARGET_PLIST]);
  if (!r.ok) {
    console.error(`[InstallInterviewDue] bootstrap failed: ${r.err.trim()}`);
    process.exit(1);
  }
  console.log(`[InstallInterviewDue] launchd bootstrap OK - ${LABEL} active (daily 07:10)`);

  const status = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (status.ok) {
    const stateLine = status.out.split("\n").find((l) => l.includes("state ="));
    console.log(`[InstallInterviewDue] ${stateLine?.trim() ?? "state unknown"}`);
  } else {
    console.log(`[InstallInterviewDue] bootstrap succeeded but status check failed: ${status.err.trim()}`);
  }
}

async function uninstall(): Promise<void> {
  const u = await uid();
  if (existsSync(TARGET_PLIST)) {
    const r = await launchctl(["bootout", `gui/${u}`, TARGET_PLIST]);
    console.log(`[InstallInterviewDue] bootout ${r.ok ? "OK" : "FAILED: " + r.err.trim()}`);
    try { unlinkSync(TARGET_PLIST); console.log(`[InstallInterviewDue] removed ${TARGET_PLIST}`); } catch { /* bootout result is already reported */ }
  } else {
    console.log(`[InstallInterviewDue] no plist at ${TARGET_PLIST} - nothing to do`);
  }
}

async function status(): Promise<void> {
  const u = await uid();
  const r = await launchctl(["print", `gui/${u}/${LABEL}`]);
  if (!r.ok) {
    console.log(`[InstallInterviewDue] ${LABEL} not loaded`);
    process.exit(1);
  }
  console.log(r.out);
}

/* ── systemd --user backend (Linux only) ────────────────────────────────────
 * Strictly additive, mirrors InstallHealthSync.ts. On darwin nothing in this
 * section executes. Translation rules documented in lib/SystemdUser.ts.
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  const bunPath = await systemd.which("bun");
  if (!bunPath) throw new Error("bun not found in PATH - install bun first");
  return {
    label: LABEL,
    description: "LifeOS interview-due cache refresh",
    exec: [bunPath, lifeosPath("TOOLS", "InterviewDue.ts"), "--refresh"],
    logPath: lifeosPath("MEMORY", "OBSERVABILITY", "interview-due.log"),
    workingDirectory: getClaudeDir(),
    schedule: { kind: "calendar", hour: 7, minute: 10 },
  };
}

async function linuxMain(arg: string | undefined): Promise<void> {
  const spec = await linuxSpec();
  const log = (m: string) => console.log(`[InstallInterviewDue] ${m}`);
  if (arg === "--uninstall") { await systemd.uninstall(spec, log); return; }
  if (arg === "--status") { if (!(await systemd.status(spec, log))) process.exit(1); return; }
  if (!(await systemd.install(spec, log))) process.exit(1);
}

async function main(): Promise<void> {
  const arg = installVerb(process.argv, "InstallInterviewDue");
  if (systemd.hasUserScheduler()) return linuxMain(arg);
  if (arg === "--uninstall") return uninstall();
  if (arg === "--status") return status();
  return install();
}

main().catch((err) => { console.error(`[InstallInterviewDue] Fatal: ${err}`); process.exit(1); });
