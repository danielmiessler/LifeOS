#!/usr/bin/env bun
/**
 * @version 1.0.1
 * InstallModelSync.ts - Materialize com.lifeos.modelsync.plist.template and bootstrap it.
 *
 *   bun ~/.claude/LIFEOS/TOOLS/InstallModelSync.ts             # install
 *   bun ~/.claude/LIFEOS/TOOLS/InstallModelSync.ts --uninstall # remove
 *   bun ~/.claude/LIFEOS/TOOLS/InstallModelSync.ts --status    # check
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { installVerb } from "./lib/InstallVerb";
import * as wintask from "./lib/WinTask";

const HOME = homedir();
const LABEL = "com.lifeos.modelsync";
const TEMPLATE = lifeosPath("TOOLS", `${LABEL}.plist.template`);
const TARGET = join(HOME, "Library", "LaunchAgents", `${LABEL}.plist`);

async function sh(cmd: string[]): Promise<{ exit: number; out: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const out = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text());
  return { exit: await proc.exited, out };
}

// Windows: Task Scheduler through lib/WinTask.ts — the same daily 05:10 run, the
// same log, the same best-effort first sync. The launchd path below never runs there.
if (wintask.isWindows()) {
  const arg = installVerb(process.argv, "InstallModelSync");
  const bun = (await wintask.which("bun")) || process.execPath;
  const spec = {
    label: LABEL,
    description: "LifeOS model sync",
    exec: [bun, lifeosPath("TOOLS", "ModelSync.ts"), "--daily"],
    logPath: lifeosPath("MEMORY", "OBSERVABILITY", "model-sync-launchd.log"),
    schedule: { kind: "calendar" as const, hour: 5, minute: 10 },
  };
  const log = (m: string) => console.log(`[InstallModelSync] ${m}`);
  if (arg === "--uninstall") process.exit((await wintask.uninstall(spec, log)) ? 0 : 1);
  if (arg === "--status") process.exit((await wintask.status(spec, log)) ? 0 : 1);
  if (!(await wintask.install(spec, log))) process.exit(1);
  const first = await sh([bun, lifeosPath("TOOLS", "ModelSync.ts"), "--sync"]);
  console.log(first.exit === 0 ? "First sync: done" : `First sync skipped (${first.out.trim().split("\n").pop()}) — the daily job will retry`);
  process.exit(0);
}

const uid = (await sh(["id", "-u"])).out.trim();
const domain = `gui/${uid}`;

installVerb(process.argv, "InstallModelSync");
if (process.argv.includes("--status")) {
  const listed = await sh(["launchctl", "print", `${domain}/${LABEL}`]);
  console.log(existsSync(TARGET) ? `plist: ${TARGET}` : "plist: not installed");
  console.log(listed.exit === 0 ? "launchd: loaded" : "launchd: not loaded");
  process.exit(0);
}

if (process.argv.includes("--uninstall")) {
  await sh(["launchctl", "bootout", domain, TARGET]);
  if (existsSync(TARGET)) unlinkSync(TARGET);
  console.log(`Uninstalled ${LABEL}`);
  process.exit(0);
}

const bunBin = process.execPath;
const plist = readFileSync(TEMPLATE, "utf8")
  .replaceAll("{{BUN}}", bunBin)
  .replaceAll("{{BUN_DIR}}", dirname(bunBin))
  .replaceAll("{{HOME}}", HOME);

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, plist);
await sh(["launchctl", "bootout", domain, TARGET]); // idempotent reinstall
const boot = await sh(["launchctl", "bootstrap", domain, TARGET]);
if (boot.exit !== 0) {
  console.error(`bootstrap failed: ${boot.out}`);
  process.exit(1);
}
console.log(`Installed ${LABEL} (daily 05:10) → ${TARGET}`);

// First sync now, best-effort: a fresh install has no snapshot until 05:10 and
// the shipped price table may be older than the 14d gate, so /ic would open red
// on a clean box. Network failure logs and continues — never fails the install.
const first = await sh([bunBin, lifeosPath("TOOLS", "ModelSync.ts"), "--sync"]);
console.log(first.exit === 0 ? "First sync: done" : `First sync skipped (${first.out.trim().split("\n").pop()}) — the daily job will retry`);
