#!/usr/bin/env bun
/**
 * PAI Installer v5.0 — Main Entry Point
 * Routes to CLI, Web server (for Electron), or GUI (Electron app).
 *
 * Modes:
 *   --mode cli   → Interactive terminal wizard
 *   --mode web   → Start HTTP/WebSocket server (used internally by Electron)
 *   --mode gui   → Launch Electron app (which spawns web mode internally)
 *
 * Install location (precedence: flag > env > default):
 *   --claude-config-dir <abs>  overrides $CLAUDE_CONFIG_DIR (default ~/.claude)
 *   --pai-dir <abs>            overrides $PAI_DIR (default ${claudeConfigDir}/PAI)
 */

import { spawn, spawnSync, execSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";
import { assertAbsolute, expandPath } from "../lib/paths";

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const mode = getFlag("--mode") ?? "gui";

// CLI overrides: set env vars before any code reads them so the entire
// installer (and any sub-processes it spawns) sees the override uniformly.
// resolveInstallPaths() in engine/paths.ts honors the same env vars; CLI
// flags mutate process.env so the precedence chain (flag > env > default)
// resolves to the flag's value via env-var lookup.
for (const [flag, envVar] of [
  ["--claude-config-dir", "CLAUDE_CONFIG_DIR"],
  ["--pai-dir", "PAI_DIR"],
] as const) {
  const value = getFlag(flag);
  if (value !== undefined) {
    try {
      process.env[envVar] = assertAbsolute(expandPath(value), flag);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      console.error(`Usage: ${flag} <absolute-path>`);
      process.exit(2);
    }
  }
}

const ROOT = import.meta.dir;

async function main() {
  if (mode === "cli") {
    // Run CLI wizard
    const { runCLI } = await import("./cli/index");
    await runCLI();
  } else if (mode === "web") {
    // Start the HTTP + WebSocket server (Electron loads this)
    await import("./web/server");
  } else {
    // Launch Electron GUI app
    const electronDir = join(ROOT, "electron");
    const electronPkg = join(electronDir, "node_modules", ".package-lock.json");

    // Install electron dependencies if needed.
    // bun is the bootstrap runtime install.sh guarantees; npm is NOT on a
    // bun-only host. Using bun install here keeps the GUI path reachable
    // for the typical PAI user.
    if (!existsSync(electronPkg)) {
      console.log("Installing GUI dependencies (first run only)...\n");
      const install = spawnSync("bun", ["install"], {
        cwd: electronDir,
        stdio: "inherit",
      });
      if (install.status !== 0) {
        console.error("Failed to install GUI dependencies. Falling back to CLI...\n");
        const { runCLI } = await import("./cli/index");
        await runCLI();
        return;
      }
    }

    // Clear macOS quarantine flags (prevents "app is damaged" error on copied installs)
    if (process.platform === "darwin") {
      try {
        execSync(`xattr -cr "${electronDir}"`, { stdio: "pipe", timeout: 30000 });
        console.log("Cleared macOS quarantine flags.\n");
      } catch {
        // Non-fatal
      }
    }

    console.log("Starting PAI Installer GUI...\n");
    const child = spawn("bun", ["run", "start"], {
      cwd: electronDir,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      process.exit(code || 0);
    });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
