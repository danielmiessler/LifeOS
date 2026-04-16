#!/usr/bin/env bun
/**
 * PAI Installer v4.0 — Main Entry Point
 * Routes to CLI, Web server (for Electron), or GUI (Electron app).
 *
 * Modes:
 *   --mode cli   → Interactive terminal wizard
 *   --mode web   → Start HTTP/WebSocket server (used internally by Electron)
 *   --mode gui   → Launch Electron app (which spawns web mode internally)
 */

import { spawn, spawnSync, execSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

const args = process.argv.slice(2);
const modeIdx = args.indexOf("--mode");

// Auto-detect headless (no DISPLAY/WAYLAND_DISPLAY on non-Darwin) when --mode
// is omitted. install.sh already does this when invoked via bash, but running
// main.ts directly (e.g. `bun PAI-Install/main.ts`) bypassed that check and
// unconditionally launched the Electron GUI, which fails on headless Linux.
function defaultMode(): "gui" | "cli" {
  if (process.platform === "darwin") return "gui";
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return "cli";
  return "gui";
}

const mode = modeIdx >= 0 ? args[modeIdx + 1] : defaultMode();

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

    // Install electron dependencies if needed
    if (!existsSync(electronPkg)) {
      console.log("Installing GUI dependencies (first run only)...\n");
      const install = spawnSync("npm", ["install"], {
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
    const child = spawn("npm", ["start"], {
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
