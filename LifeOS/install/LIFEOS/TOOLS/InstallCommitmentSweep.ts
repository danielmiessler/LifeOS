#!/usr/bin/env bun
/**
 * @version 1.3.8
 * InstallCommitmentSweep.ts — Materialize com.lifeos.commitmentsweep.plist.template and bootstrap.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCommitmentSweep.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallCommitmentSweep.ts --uninstall # remove
 *
 * Reads template, substitutes {{BUN}}/{{BUN_DIR}}/{{HOME}}, writes to ~/Library/LaunchAgents/,
 * bootstraps via launchctl bootstrap. Idempotent — re-runs cleanly replace existing.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { spawnSync } from "child_process";
import * as systemd from "./lib/SystemdUser";
import { homedir } from "node:os";
import { getClaudeDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { installVerb } from "./lib/InstallVerb";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const TEMPLATE = lifeosPath("TOOLS", "com.lifeos.commitmentsweep.plist.template");
const TARGET_DIR = join(HOME, "Library", "LaunchAgents");
const TARGET = join(TARGET_DIR, "com.lifeos.commitmentsweep.plist");
const STATE_DIR = lifeosPath("MEMORY", "STATE");
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

  // The bun running this installer IS the bun the job should run — resolving it
  // from process.execPath (same shape as InstallPegWatch.ts) replaces the old
  // hardcoded /opt/homebrew/bin/bun, which does not exist on Intel Homebrew or
  // on a ~/.bun install, so launchd failed the job silently every morning.
  // public issues #1875, @GRyndStone; #1880, @schmetti-dev
  const bunBin = process.execPath;
  const raw = readFileSync(TEMPLATE, "utf8");
  const materialized = raw
    .replaceAll("{{BUN}}", bunBin)
    .replaceAll("{{BUN_DIR}}", dirname(bunBin))
    .replaceAll("{{HOME}}", HOME);
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

/* ── systemd --user backend (Linux only) ────────────────────────────────────
 * Strictly additive. Every line above is the launchd path and is unchanged;
 * on darwin nothing in this section executes. This installer's macOS half has
 * no --status branch, so --status stays Linux-only rather than being added to
 * the darwin path, which must not change.
 * ported from public PR #1698, @elhoim
 * ------------------------------------------------------------------------- */

async function linuxSpec(): Promise<systemd.UnitSpec> {
  const bunPath = await systemd.which("bun");
  if (!bunPath) throw new Error("bun not found in PATH - install bun first");
  return {
    label: LABEL,
    description: "LifeOS commitment sweep",
    exec: [bunPath, lifeosPath("TOOLS", "CommitmentSweep.ts")],
    logPath: join(STATE_DIR, "com.lifeos.commitmentsweep.log"),
    workingDirectory: getClaudeDir(),
    schedule: { kind: "calendar", hour: 7, minute: 0 },
  };
}

async function linuxMain(args: string[]): Promise<void> {
  const spec = await linuxSpec();
  const log = (m: string) => console.log(`[InstallCommitmentSweep] ${m}`);
  if (args.includes("--uninstall")) { await systemd.uninstall(spec, log); return; }
  if (args.includes("--status")) { if (!(await systemd.status(spec, log))) process.exit(1); return; }
  if (!(await systemd.install(spec, log))) process.exit(1);
}

async function main() {
  installVerb(process.argv, "InstallCommitmentSweep");
  const args = process.argv.slice(2);
  if (systemd.hasUserScheduler()) return linuxMain(args);
  if (args.includes("--uninstall")) {
    uninstall();
    process.exit(0);
  }
  install();
}

if (import.meta.main) main().catch((err) => { console.error(`[InstallCommitmentSweep] Fatal: ${err}`); process.exit(1); });
