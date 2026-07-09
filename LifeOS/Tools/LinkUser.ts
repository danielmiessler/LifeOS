#!/usr/bin/env bun
/**
 * LinkUser — Setup step 6. Establishes the system/user separation contract:
 * `<configRoot>/LIFEOS/USER` becomes a SYMLINK to `<configDir>/USER` (the private
 * data home). Migrates any live USER content into the data home first
 * (existsSync-guarded), then symlinks. Idempotent. Verifies the contract after.
 * Refuses on a dev tree unless --allow-dev.
 *
 * Usage:
 *   bun LinkUser.ts [--config-root <dir>] [--config-dir <dir>] [--apply] [--allow-dev]
 */

import { join } from "node:path";
import { checkSymlinkContract, detectDevTree, setupUserSeparation } from "./InstallEngine";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


function main(): void {
  const a = process.argv.slice(2);
  const get = (f: string): string | undefined => {
    const i = a.indexOf(f);
    return i >= 0 && a[i + 1] && !a[i + 1].startsWith("--") ? a[i + 1] : undefined;
  };
  const home = process.env.HOME || "";
  const configRoot = get("--config-root") || process.env.CLAUDE_CONFIG_DIR || join(home, ".claude");
  const configDir = get("--config-dir") || process.env.LIFEOS_CONFIG_DIR || join(home, ".config", "LIFEOS");
  const apply = a.includes("--apply");
  const allowDev = a.includes("--allow-dev");

  if (detectDevTree(configRoot) && !allowDev) {
    console.log(JSON.stringify({ ok: false, refused: "dev-tree", detail: `${configRoot} is a source tree — refusing to relink.` }, null, 2));
    process.exit(2);
  }

  if (!apply) {
    const contract = checkSymlinkContract(configRoot, configDir);
    console.log(JSON.stringify({ ok: true, dryRun: true, currentContract: contract, willLink: `${join(configRoot, "LIFEOS", "USER")} → ${join(configDir, "USER")}` }, null, 2));
    process.exit(0);
  }

  const result = setupUserSeparation(configRoot, configDir);
  const contract = checkSymlinkContract(configRoot, configDir);
  const ok = contract.passed && !result.error;
  console.log(JSON.stringify({ ok, written: true, ...result, contract }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
