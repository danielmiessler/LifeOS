#!/usr/bin/env bun
/**
 * SeedPulse — Interview final step. Seeds the Pulse data plane from the now-
 * populated USER tree by regenerating the derived artifacts Pulse reads
 * (PRINCIPAL_TELOS.md, LIFEOS_STATE.json) via the shipped LIFEOS/TOOLS generators.
 * Best-effort: missing generators are reported, not fatal — Pulse simply shows
 * scaffold state until they run. Refuses on a dev tree unless --allow-dev.
 *
 * Usage:
 *   bun SeedPulse.ts [--config-root <dir>] [--config-dir <dir>] [--apply] [--allow-dev]
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { detectDevTree } from "./InstallEngine";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const GENERATORS = ["GenerateTelosSummary.ts", "UpdateLifeosState.ts"];

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
    console.log(JSON.stringify({ ok: false, refused: "dev-tree", detail: `${configRoot} is a source tree — refusing to seed Pulse.` }, null, 2));
    process.exit(2);
  }

  const toolsDir = join(configRoot, "LIFEOS", "TOOLS");
  const present = GENERATORS.filter((g) => existsSync(join(toolsDir, g)));
  const missing = GENERATORS.filter((g) => !existsSync(join(toolsDir, g)));

  if (!apply) {
    // Dry-run must ALSO fail LOUD when no generators are present: a Setup driver that
    // probes dry-run first otherwise sees ok:true on an undeployed runtime (the apply
    // path already fails loud; this closes the same hole on the dry-run path).
    const okDry = present.length > 0;
    const blocker = present.length === 0 ? `no Pulse generators present under ${toolsDir} — was the LIFEOS runtime deployed (DeployCore)?` : undefined;
    console.log(JSON.stringify({ ok: okDry, dryRun: true, willRun: present, missing, toolsDir, blocker }, null, 2));
    process.exit(okDry ? 0 : 1);
  }

  const ran: string[] = [];
  const failed: Array<{ tool: string; error: string }> = [];
  for (const g of present) {
    try {
      execFileSync("bun", [join(toolsDir, g)], {
        stdio: "pipe",
        env: {
          ...process.env,
          LIFEOS_CONFIG_DIR: configDir,
          LIFEOS_DIR: join(configRoot, "LIFEOS"),
          // GenerateTelosSummary resolves its TELOS dir via LifeosConfig.paiUserDir(),
          // which reads LIFEOS_CONFIG_PATH (NOT LIFEOS_DIR). UpdateLifeosState resolves via
          // LIFEOS_DIR. Pass BOTH so both generators target the same install root —
          // otherwise a non-default config root mis-targets ~/.claude.
          LIFEOS_CONFIG_PATH: join(configRoot, "LIFEOS", "USER", "CONFIG", "LIFEOS_CONFIG.toml"),
        },
        timeout: 60000,
      });
      ran.push(g);
    } catch (err) {
      failed.push({ tool: g, error: err instanceof Error ? err.message : String(err) });
    }
  }
  // Fail LOUD when nothing was actually seeded: an empty `present` set (no
  // generators found — runtime not deployed) previously read as ok:true because
  // `failed` was also empty. ok now requires at least one generator to have run.
  const ok = failed.length === 0 && present.length > 0;
  const blocker = present.length === 0 ? `no Pulse generators present under ${toolsDir} — was the LIFEOS runtime deployed (DeployCore)?` : undefined;
  console.log(JSON.stringify({ ok, written: ran.length > 0, ran, failed, missing, blocker }, null, 2));
  process.exit(ok ? 0 : 1);
}

main();
