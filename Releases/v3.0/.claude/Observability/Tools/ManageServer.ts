#!/usr/bin/env bun
/**
 * ManageServer.ts - Observability Dashboard Manager
 *
 * A CLI tool for managing the PAI Observability Dashboard (server + client)
 *
 * Usage:
 *   bun ~/.claude/Observability/Tools/ManageServer.ts <command>
 *
 * Commands:
 *   start     Start the observability dashboard
 *   stop      Stop the observability dashboard
 *   restart   Restart the observability dashboard
 *   status    Check if dashboard is running
 *   logs      Show recent server output
 *   open      Open dashboard in browser
 *
 * @author PAI (Personal AI Infrastructure)
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const CONFIG = {
  basePath: join(process.env.HOME || "", ".claude/Observability"),
  serverPort: 4000,
  clientPort: 5172,
  logFile: join(process.env.HOME || "", "Library/Logs/pai-observability.log"),
};

const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const result = await $`lsof -Pi :${port} -sTCP:LISTEN -t`.quiet().nothrow();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function isServerHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${CONFIG.serverPort}/events/filter-options`);
    return response.ok;
  } catch {
    return false;
  }
}

async function isClientHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${CONFIG.clientPort}`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer(): Promise<void> {
  const serverRunning = await isPortInUse(CONFIG.serverPort);
  const clientRunning = await isPortInUse(CONFIG.clientPort);

  if (serverRunning && clientRunning) {
    console.log(colors.yellow("Observability dashboard already running."));
    console.log(colors.bold(`URL: http://localhost:${CONFIG.clientPort}`));
    return;
  }

  if (serverRunning || clientRunning) {
    console.log(colors.yellow("Partial state detected. Cleaning up..."));
    await stopServer();
  }

  console.log(colors.blue("Starting observability dashboard..."));

  // Start server
  const serverCmd = `cd "${CONFIG.basePath}/apps/server" && nohup bun run dev >> "${CONFIG.logFile}" 2>&1 &`;
  await $`sh -c ${serverCmd}`.quiet();

  // Wait for server
  for (let i = 0; i < 15; i++) {
    await Bun.sleep(500);
    if (await isServerHealthy()) break;
  }

  if (!await isServerHealthy()) {
    console.error(colors.red("Server failed to start. Check logs."));
    process.exit(1);
  }

  // Start client
  const clientCmd = `cd "${CONFIG.basePath}/apps/client" && nohup bun run dev >> "${CONFIG.logFile}" 2>&1 &`;
  await $`sh -c ${clientCmd}`.quiet();

  // Wait for client
  for (let i = 0; i < 15; i++) {
    await Bun.sleep(500);
    if (await isClientHealthy()) break;
  }

  if (await isClientHealthy()) {
    console.log(colors.green("Observability dashboard started!"));
    console.log(colors.dim(`Server: http://localhost:${CONFIG.serverPort}`));
    console.log(colors.bold(`Dashboard: http://localhost:${CONFIG.clientPort}`));
  } else {
    console.error(colors.red("Client failed to start. Check logs."));
    process.exit(1);
  }
}

async function stopServer(): Promise<void> {
  console.log(colors.blue("Stopping observability dashboard..."));

  // Kill by port
  for (const port of [CONFIG.serverPort, CONFIG.clientPort]) {
    const result = await $`lsof -ti :${port}`.quiet().nothrow();
    if (result.exitCode === 0) {
      const pids = result.stdout.toString().trim().split("\n");
      for (const pid of pids) {
        if (pid) await $`kill -9 ${pid}`.quiet().nothrow();
      }
    }
  }

  // Kill any remaining bun processes for observability
  await $`pkill -f "Observability/apps/(server|client)"`.quiet().nothrow();

  // Clean SQLite WAL files
  const walPath = join(CONFIG.basePath, "apps/server/events.db-wal");
  const shmPath = join(CONFIG.basePath, "apps/server/events.db-shm");
  if (existsSync(walPath)) await $`rm -f ${walPath}`.quiet().nothrow();
  if (existsSync(shmPath)) await $`rm -f ${shmPath}`.quiet().nothrow();

  await Bun.sleep(500);
  console.log(colors.green("Observability dashboard stopped."));
}

async function restartServer(): Promise<void> {
  console.log(colors.blue("Restarting observability dashboard..."));
  await stopServer();
  await Bun.sleep(500);
  await startServer();
}

async function showStatus(): Promise<void> {
  const serverUp = await isPortInUse(CONFIG.serverPort);
  const clientUp = await isPortInUse(CONFIG.clientPort);
  const serverHealthy = await isServerHealthy();
  const clientHealthy = await isClientHealthy();

  if (serverUp && clientUp && serverHealthy && clientHealthy) {
    console.log(colors.green("Status: RUNNING"));
    console.log(colors.dim(`Server: http://localhost:${CONFIG.serverPort} (healthy)`));
    console.log(colors.bold(`Dashboard: http://localhost:${CONFIG.clientPort}`));
  } else if (serverUp || clientUp) {
    console.log(colors.yellow("Status: PARTIAL"));
    console.log(colors.dim(`Server port ${CONFIG.serverPort}: ${serverUp ? (serverHealthy ? "healthy" : "unhealthy") : "down"}`));
    console.log(colors.dim(`Client port ${CONFIG.clientPort}: ${clientUp ? (clientHealthy ? "healthy" : "unhealthy") : "down"}`));
  } else {
    console.log(colors.red("Status: NOT RUNNING"));
  }
}

async function showLogs(): Promise<void> {
  if (!existsSync(CONFIG.logFile)) {
    console.log(colors.yellow("No log file found."));
    return;
  }

  const result = await $`tail -40 ${CONFIG.logFile}`.quiet();
  console.log(colors.bold("Recent observability logs:"));
  console.log(colors.dim("─".repeat(50)));
  console.log(result.stdout.toString());
}

async function openDashboard(): Promise<void> {
  const healthy = await isClientHealthy();
  if (!healthy) {
    console.log(colors.yellow("Dashboard not running. Starting..."));
    await startServer();
  }

  console.log(colors.blue("Opening dashboard in browser..."));
  await $`open http://localhost:${CONFIG.clientPort}`.quiet();
}

function showHelp(): void {
  console.log(colors.bold("ManageServer.ts - Observability Dashboard Manager"));
  console.log(colors.dim("─".repeat(50)));
  console.log(`
${colors.bold("Usage:")}
  bun ManageServer.ts <command>

${colors.bold("Commands:")}
  ${colors.green("start")}     Start the observability dashboard
  ${colors.green("stop")}      Stop the observability dashboard
  ${colors.green("restart")}   Restart the observability dashboard
  ${colors.green("status")}    Check dashboard status
  ${colors.green("logs")}      Show recent logs
  ${colors.green("open")}      Open dashboard in browser

${colors.bold("Examples:")}
  ${colors.dim("# Quick restart")}
  bun ManageServer.ts restart

  ${colors.dim("# Open in browser")}
  bun ManageServer.ts open

${colors.bold("Dashboard:")} http://localhost:${CONFIG.clientPort}
${colors.bold("API:")} http://localhost:${CONFIG.serverPort}
`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || "help";

  switch (command) {
    case "start":
      await startServer();
      break;
    case "stop":
      await stopServer();
      break;
    case "restart":
      await restartServer();
      break;
    case "status":
      await showStatus();
      break;
    case "logs":
      await showLogs();
      break;
    case "open":
      await openDashboard();
      break;
    case "help":
    case "--help":
      showHelp();
      break;
    default:
      console.error(colors.red(`Unknown command: ${command}`));
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(colors.red("Fatal error:"), error);
  process.exit(1);
});
