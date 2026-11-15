#!/usr/bin/env bun
/**
 * InstallDeriverSystemd.ts — Linux (systemd --user) install for the nightly Pulse deriver.
 *
 * Same job as com.lifeos.deriver.plist (macOS): daily 03:00,
 *   bun run LIFEOS/TOOLS/LearningPatternSynthesis.ts --hypothesize
 * manage-deriver.sh delegates here on non-Darwin hosts.
 *
 *   bun InstallDeriverSystemd.ts            # install (also: install)
 *   bun InstallDeriverSystemd.ts uninstall  # remove
 *   bun InstallDeriverSystemd.ts status     # check
 */

import { getClaudeDir, lifeosPath } from "./Paths";
import * as systemd from "./lib/SystemdUser";

const LABEL = "com.lifeos.deriver";
const log = (m: string) => console.log(`[InstallDeriverSystemd] ${m}`);

async function main(): Promise<void> {
  const verb = (process.argv[2] ?? "install").replace(/^--/, "");
  const bunPath = await systemd.which("bun");
  if (!bunPath) throw new Error("bun not found in PATH - install bun first");

  const spec: systemd.UnitSpec = {
    label: LABEL,
    description: "LifeOS proactive deriver (nightly hypotheses)",
    exec: [bunPath, "run", lifeosPath("TOOLS", "LearningPatternSynthesis.ts"), "--hypothesize"],
    logPath: lifeosPath("MEMORY", "OBSERVABILITY", "deriver.log"),
    workingDirectory: getClaudeDir(),
    schedule: { kind: "calendar", hour: 3, minute: 0 },
  };

  if (verb === "uninstall") { await systemd.uninstall(spec, log); return; }
  if (verb === "status") { if (!(await systemd.status(spec, log))) process.exit(1); return; }
  if (verb !== "install") throw new Error(`unknown verb: ${verb}`);
  if (!(await systemd.install(spec, log))) process.exit(1);
}

main().catch((err) => { console.error(`[InstallDeriverSystemd] Fatal: ${err}`); process.exit(1); });
