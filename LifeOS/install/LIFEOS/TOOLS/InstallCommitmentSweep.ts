#!/usr/bin/env bun
/**
 * InstallCommitmentSweep.ts — Materialize com.lifeos.commitmentsweep.plist.template and bootstrap.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCommitmentSweep.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCommitmentSweep.ts --uninstall # remove
 *
 * Reads template, substitutes __HOME__ with $HOME, writes to ~/Library/LaunchAgents/,
 * bootstraps via launchctl bootstrap. Idempotent — re-runs cleanly replace existing.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { getClaudeDir } from "./Paths";

const HOME = process.env.HOME || "";
const TEMPLATE = join(getClaudeDir(), "LIFEOS", "TOOLS", "com.lifeos.commitmentsweep.plist.template");
const TARGET_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET = join(TARGET_DIR, "com.lifeos.commitmentsweep.plist");
const STATE_DIR = join(getClaudeDir(), "LIFEOS", "MEMORY", "STATE");
const LABEL = "com.lifeos.commitmentsweep";

function uid(): string {
  const r = spawnSync("id", ["-u"], { encoding: "utf8" });
  return (r.stdout || "501").trim();
}

function launchctl(args: string[]): { code: number; out: string; err: string } {
  const r = spawnSync("launchctl", args, { encoding: "utf8" });
  return { code: r.status ?? 1, out: r.stdout || "", err: r.stderr || "" };
}

function uninstall(): void {
  const u = uid();
  const r = launchctl(["bootout", `gui/${u}/${LABEL}`]);
  if (r.code === 0) console.log(`[InstallCommitmentSweep] booted out ${LABEL}`);
  else console.log(`[InstallCommitmentSweep] bootout (likely already-out): ${r.err.trim() || r.code}`);
  if (existsSync(TARGET)) {
    unlinkSync(TARGET);
    console.log(`[InstallCommitmentSweep] removed ${TARGET}`);
  }
}

function install(): void {
  if (!existsSync(TEMPLATE)) {
    console.error(`[InstallCommitmentSweep] template missing: ${TEMPLATE}`);
    process.exit(1);
  }
  mkdirSync(TARGET_DIR, { recursive: true });
  mkdirSync(STATE_DIR, { recursive: true });

  const raw = readFileSync(TEMPLATE, "utf8");
  const materialized = raw.replaceAll("__HOME__", HOME);
  writeFileSync(TARGET, materialized, { mode: 0o644 });
  console.log(`[InstallCommitmentSweep] wrote ${TARGET}`);

  // Bootout first in case an old version is loaded
  const u = uid();
  launchctl(["bootout", `gui/${u}/${LABEL}`]);
  const r = launchctl(["bootstrap", `gui/${u}`, TARGET]);
  if (r.code === 0) {
    console.log(`[InstallCommitmentSweep] bootstrapped ${LABEL}`);
  } else {
    console.error(`[InstallCommitmentSweep] bootstrap failed: ${r.err.trim() || r.code}`);
    process.exit(2);
  }

  // Verify
  const list = launchctl(["list", LABEL]);
  if (list.code === 0) {
    console.log(`[InstallCommitmentSweep] verified — ${LABEL} is loaded`);
  } else {
    console.error(`[InstallCommitmentSweep] verification failed`);
    process.exit(3);
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--uninstall")) {
    uninstall();
    process.exit(0);
  }
  install();
}

if (import.meta.main) main();
