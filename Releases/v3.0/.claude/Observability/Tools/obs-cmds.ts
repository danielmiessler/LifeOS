#!/usr/bin/env bun
/**
 * obs-cmds — Extract command output from Claude Code agent sessions
 *
 * Watches JSONL session transcripts and extracts Bash command invocations
 * with their full stdout/stderr, formatted as a clean terminal transcript.
 *
 * Output is both displayed in terminal AND written to a log file so you
 * can screenshot/review it after the task completes.
 *
 * Usage:
 *   obs-cmds                       # Watch current project, live stream
 *   obs-cmds --session abc123      # Extract from specific session
 *   obs-cmds --last N              # Show last N commands from most recent session
 *   obs-cmds --all                 # Watch all project dirs
 *   obs-cmds --no-log              # Don't write to log file
 *   obs-cmds --log-dir PATH        # Custom log directory (default: ./outputs/cmd-logs/)
 *   obs-cmds --ssh-only            # Only show SSH/remote commands
 */

import { watch, existsSync, readdirSync, statSync, readFileSync, mkdirSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ── Config ──────────────────────────────────────────────────────────

const PROJECTS_BASE = join(homedir(), ".claude", "projects");
const args = process.argv.slice(2);
const watchAll = args.includes("--all");
const noLog = args.includes("--no-log");
const sshOnly = args.includes("--ssh-only");
const specificSession = args.includes("--session")
  ? args[args.indexOf("--session") + 1]
  : null;
const lastN = args.includes("--last")
  ? parseInt(args[args.indexOf("--last") + 1]) || 10
  : null;
const logDir = args.includes("--log-dir")
  ? args[args.indexOf("--log-dir") + 1]
  : join(process.cwd(), "outputs", "cmd-logs");

// ── Colors ──────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  white: "\x1b[37m",
};

// ── State ───────────────────────────────────────────────────────────

const filePositions = new Map<string, number>();
const watchedFiles = new Set<string>();
let logFile: string | null = null;
let cmdCount = 0;

// Pending tool_use blocks waiting for their results
const pendingTools = new Map<string, { name: string; command: string; timestamp: string; sessionShort: string }>();

// ── Helpers ─────────────────────────────────────────────────────────

function timestamp(): string {
  const now = new Date();
  return now.toISOString().replace("T", " ").slice(0, 19);
}

function shortTimestamp(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function initLogFile(): void {
  if (noLog) return;

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  logFile = join(logDir, `cmds-${ts}.log`);

  const header = `# Claude Code Command Log
# Started: ${timestamp()}
# Project: ${process.cwd()}
${"=".repeat(72)}

`;
  appendFileSync(logFile, header);
  console.log(`${c.dim}Log file: ${logFile}${c.reset}`);
}

function log(text: string): void {
  if (logFile && !noLog) {
    // Strip ANSI codes for the log file
    const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
    appendFileSync(logFile, clean + "\n");
  }
}

function displayCommand(cmd: string, output: string, isError: boolean, sessionShort: string, entryTimestamp?: string): void {
  const ts = entryTimestamp || shortTimestamp();

  // Filter SSH-only if requested
  if (sshOnly && !cmd.includes("ssh") && !cmd.includes("sshpass")) {
    return;
  }

  cmdCount++;
  const separator = `${c.dim}${"─".repeat(72)}${c.reset}`;
  const errorTag = isError ? ` ${c.red}[ERROR]${c.reset}` : "";
  const sessionTag = `${c.dim}[${sessionShort}]${c.reset}`;

  // Command header
  console.log(separator);
  console.log(`${c.gray}${ts}${c.reset} ${sessionTag}${errorTag}`);
  console.log(`${c.bold}${c.green}$${c.reset} ${c.bold}${cmd}${c.reset}`);
  console.log();

  // Output
  if (output.trim()) {
    console.log(output);
  } else {
    console.log(`${c.dim}(no output)${c.reset}`);
  }

  console.log();

  // Log to file
  log(`${"─".repeat(72)}`);
  log(`${ts} [${sessionShort}]${isError ? " [ERROR]" : ""}`);
  log(`$ ${cmd}`);
  log("");
  log(output.trim() || "(no output)");
  log("");
}

// ── JSONL Processing ────────────────────────────────────────────────

function processEntry(entry: any, sessionShort: string): void {
  // Capture tool_use (command invocations)
  if (entry.type === "assistant" && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === "tool_use" && block.name === "Bash" && block.input?.command) {
        const entryTime = entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false })
          : shortTimestamp();

        pendingTools.set(block.id, {
          name: block.name,
          command: block.input.command,
          timestamp: entryTime,
          sessionShort,
        });
      }
    }
  }

  // Match tool results back to their commands
  if (entry.type === "user" && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        const pending = pendingTools.get(block.tool_use_id);
        if (pending) {
          // Extract the output text
          let output = "";
          const isError = block.is_error === true;

          if (typeof block.content === "string") {
            output = block.content;
          } else if (Array.isArray(block.content)) {
            output = block.content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text || "")
              .join("\n");
          }

          displayCommand(pending.command, output, isError, pending.sessionShort, pending.timestamp);
          pendingTools.delete(block.tool_use_id);
        }
      }
    }
  }
}

function processFile(filePath: string, sessionShort: string, fromStart: boolean = false): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf-8");

  if (!fromStart) {
    const lastPos = filePositions.get(filePath) || 0;
    const newContent = content.slice(lastPos);
    filePositions.set(filePath, content.length);

    if (!newContent.trim()) return;

    for (const line of newContent.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, sessionShort);
      } catch {}
    }
  } else {
    // Process from beginning (for --last or --session)
    filePositions.set(filePath, content.length);

    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        processEntry(entry, sessionShort);
      } catch {}
    }
  }
}

// ── Watch Logic ─────────────────────────────────────────────────────

function getProjectDirs(): string[] {
  if (watchAll) {
    return readdirSync(PROJECTS_BASE)
      .filter((d) => d.startsWith("-"))
      .map((d) => join(PROJECTS_BASE, d))
      .filter((d) => statSync(d).isDirectory());
  }

  const cwd = process.cwd().replace(/\//g, "-").replace(/^-/, "-");
  const projectDir = join(PROJECTS_BASE, cwd);
  if (existsSync(projectDir)) {
    return [projectDir];
  }

  const dirs = readdirSync(PROJECTS_BASE)
    .filter((d) => d.startsWith("-"))
    .map((d) => ({
      name: d,
      path: join(PROJECTS_BASE, d),
      mtime: statSync(join(PROJECTS_BASE, d)).mtime.getTime(),
    }))
    .filter((d) => statSync(d.path).isDirectory())
    .sort((a, b) => b.mtime - a.mtime);

  if (dirs.length > 0) {
    return [dirs[0].path];
  }
  return [];
}

function getRecentJsonl(dir: string, limit: number = 10): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({
      name: f,
      path: join(dir, f),
      mtime: statSync(join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit)
    .map((f) => f.path);
}

function findSession(dirs: string[], sessionId: string): string | null {
  for (const dir of dirs) {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    const match = files.find((f) => f.startsWith(sessionId));
    if (match) return join(dir, match);
  }
  return null;
}

function watchFile(filePath: string): void {
  if (watchedFiles.has(filePath)) return;
  watchedFiles.add(filePath);

  const sessionShort = basename(filePath, ".jsonl").slice(0, 8);

  // Set position to end — only capture NEW commands
  const content = readFileSync(filePath, "utf-8");
  filePositions.set(filePath, content.length);

  const watcher = watch(filePath, (eventType) => {
    if (eventType === "change") {
      processFile(filePath, sessionShort);
    }
  });

  watcher.on("error", () => {
    watchedFiles.delete(filePath);
  });
}

function watchDir(dir: string): void {
  watch(dir, (eventType, filename) => {
    if (filename && filename.endsWith(".jsonl")) {
      const filePath = join(dir, filename);
      if (existsSync(filePath) && !watchedFiles.has(filePath)) {
        console.log(`${c.dim}+ New session: ${basename(filePath, ".jsonl").slice(0, 8)}${c.reset}`);
        watchFile(filePath);
      }
    }
  });
}

// ── Main ────────────────────────────────────────────────────────────

function main(): void {
  // Header
  console.log(`\n${c.bold}${c.blue}obs-cmds${c.reset} ${c.dim}— Claude Code Command Output Log${c.reset}`);
  console.log(`${c.dim}${"═".repeat(72)}${c.reset}`);

  const dirs = getProjectDirs();
  if (dirs.length === 0) {
    console.error(`${c.red}No Claude Code project directories found.${c.reset}`);
    process.exit(1);
  }

  // Mode: Extract specific session
  if (specificSession) {
    const file = findSession(dirs, specificSession);
    if (!file) {
      console.error(`${c.red}Session ${specificSession} not found.${c.reset}`);
      process.exit(1);
    }

    console.log(`${c.dim}Extracting commands from session: ${specificSession}${c.reset}\n`);
    initLogFile();
    processFile(file, specificSession.slice(0, 8), true);
    console.log(`\n${c.dim}${cmdCount} commands extracted.${c.reset}`);
    if (logFile) console.log(`${c.dim}Saved to: ${logFile}${c.reset}`);
    process.exit(0);
  }

  // Mode: Show last N commands
  if (lastN) {
    const files = getRecentJsonl(dirs[0], 1);
    if (files.length === 0) {
      console.error(`${c.red}No session files found.${c.reset}`);
      process.exit(1);
    }

    const sessionShort = basename(files[0], ".jsonl").slice(0, 8);
    console.log(`${c.dim}Last ${lastN} commands from session: ${sessionShort}${c.reset}\n`);

    // Process entire file to collect all commands, then show last N
    const allCmds: { cmd: string; output: string; isError: boolean; ts: string }[] = [];
    const content = readFileSync(files[0], "utf-8");
    const localPending = new Map<string, { command: string; timestamp: string }>();

    for (const line of content.trim().split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);

        if (entry.type === "assistant" && Array.isArray(entry.message?.content)) {
          for (const block of entry.message.content) {
            if (block.type === "tool_use" && block.name === "Bash" && block.input?.command) {
              const entryTime = entry.timestamp
                ? new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false })
                : "";
              localPending.set(block.id, { command: block.input.command, timestamp: entryTime });
            }
          }
        }

        if (entry.type === "user" && Array.isArray(entry.message?.content)) {
          for (const block of entry.message.content) {
            if (block.type === "tool_result" && block.tool_use_id) {
              const p = localPending.get(block.tool_use_id);
              if (p) {
                let output = "";
                if (typeof block.content === "string") output = block.content;
                else if (Array.isArray(block.content))
                  output = block.content.filter((x: any) => x.type === "text").map((x: any) => x.text || "").join("\n");

                allCmds.push({
                  cmd: p.command,
                  output,
                  isError: block.is_error === true,
                  ts: p.timestamp,
                });
                localPending.delete(block.tool_use_id);
              }
            }
          }
        }
      } catch {}
    }

    const toShow = allCmds.slice(-lastN);
    for (const { cmd, output, isError, ts } of toShow) {
      if (sshOnly && !cmd.includes("ssh") && !cmd.includes("sshpass")) continue;
      displayCommand(cmd, output, isError, sessionShort, ts);
    }

    console.log(`\n${c.dim}${toShow.length}/${allCmds.length} commands shown.${c.reset}`);
    process.exit(0);
  }

  // Mode: Live stream
  initLogFile();

  if (sshOnly) console.log(`${c.yellow}Filter: SSH/remote commands only${c.reset}`);
  console.log(`${c.dim}Watching for new commands...${c.reset}\n`);

  for (const dir of dirs) {
    const files = getRecentJsonl(dir, 10);

    for (const file of files) {
      watchFile(file);
    }

    watchDir(dir);
  }

  console.log(`${c.dim}Streaming... (Ctrl+C to stop)${c.reset}\n`);

  process.on("SIGINT", () => {
    console.log(`\n${c.dim}${cmdCount} commands captured.${c.reset}`);
    if (logFile) console.log(`${c.dim}Log saved: ${logFile}${c.reset}`);
    process.exit(0);
  });
}

main();
