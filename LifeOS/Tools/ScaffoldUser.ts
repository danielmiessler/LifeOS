#!/usr/bin/env bun
/**
 * ScaffoldUser — Setup step 5. existsSync-GUARDED copy of the shipped
 * `install/USER` template tree into the user's data home (`<configDir>/USER`,
 * default ~/.config/LIFEOS/USER). Never overwrites a populated file — existing
 * user content always wins. Refuses on a dev tree unless --allow-dev.
 *
 * Usage:
 *   bun ScaffoldUser.ts [--config-root <dir>] [--config-dir <dir>] [--skill-root <dir>] [--apply] [--allow-dev]
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { copyMissing, detectDevTree } from "./InstallEngine";

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
  const skillRoot = get("--skill-root") || join(import.meta.dir, "..");
  const apply = a.includes("--apply");
  const allowDev = a.includes("--allow-dev");

  if (detectDevTree(configRoot) && !allowDev) {
    console.log(JSON.stringify({ ok: false, refused: "dev-tree", detail: `${configRoot} is a source tree — refusing to scaffold.` }, null, 2));
    process.exit(2);
  }

  const templateUser = join(skillRoot, "install", "USER");
  const dataUser = join(configDir, "USER");
  if (!existsSync(templateUser)) {
    console.log(JSON.stringify({ ok: false, error: `template USER not found at ${templateUser}` }, null, 2));
    process.exit(1);
  }

  if (!apply) {
    // Dry-run: count what WOULD copy by diffing against a non-existent target view.
    console.log(JSON.stringify({ ok: true, dryRun: true, from: templateUser, to: dataUser, note: "re-run with --apply to copy missing template files" }, null, 2));
    process.exit(0);
  }

  const { copied, failures } = copyMissing(templateUser, dataUser);
  console.log(JSON.stringify({ ok: failures.length === 0, written: true, from: templateUser, to: dataUser, copied, failures }, null, 2));
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
