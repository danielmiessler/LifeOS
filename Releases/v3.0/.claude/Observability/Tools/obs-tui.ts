#!/usr/bin/env bun
/**
 * obs-tui — Terminal UI for Claude Code Observability
 *
 * Watches Claude Code JSONL session transcripts in real-time and displays
 * tool calls, responses, and user prompts with color-coded output.
 *
 * Usage:
 *   bun ~/.claude/Observability/Tools/obs-tui.ts [options]
 *
 *   --all           Watch ALL project dirs (default: current dir's project only)
 *   --recent N      Show last N events on startup (default: 20)
 *   --no-color      Disable colors
 *   --tools-only    Only show tool use events
 *   --filter TYPE   Filter by event type (e.g. PreToolUse, Stop, UserPromptSubmit)
 */

import { watch, existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ── Config ──────────────────────────────────────────────────────────

const PROJECTS_BASE = join(homedir(), ".claude", "projects");
const args = process.argv.slice(2);
const watchAll = args.includes("--all");
const noColor = args.includes("--no-color");
const toolsOnly = args.includes("--tools-only");
const filterType = args.includes("--filter")
  ? args[args.indexOf("--filter") + 1]
  : null;
const recentCount = args.includes("--recent")
  ? parseInt(args[args.indexOf("--recent") + 1]) || 20
  : 20;

// ── Colors ──────────────────────────────────────────────────────────

const c = noColor
  ? {
      reset: "", dim: "", bold: "", italic: "",
      red: "", green: "", yellow: "", blue: "", magenta: "", cyan: "", white: "", gray: "",
      bgRed: "", bgGreen: "", bgYellow: "", bgBlue: "", bgMagenta: "", bgCyan: "",
    }
  : {
      reset: "\x1b[0m",
      dim: "\x1b[2m",
      bold: "\x1b[1m",
      italic: "\x1b[3m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      white: "\x1b[37m",
      gray: "\x1b[90m",
      bgRed: "\x1b[41m",
      bgGreen: "\x1b[42m",
      bgYellow: "\x1b[43m",
      bgBlue: "\x1b[44m",
      bgMagenta: "\x1b[45m",
      bgCyan: "\x1b[46m",
    };

// ── Tool color map ──────────────────────────────────────────────────

const toolColors: Record<string, string> = {
  Bash: c.red,
  Read: c.blue,
  Write: c.magenta,
  Edit: c.yellow,
  Grep: c.cyan,
  Glob: c.cyan,
  Task: c.green,
  WebFetch: c.magenta,
  WebSearch: c.magenta,
  TaskCreate: c.green,
  TaskUpdate: c.green,
  TaskList: c.green,
  AskUserQuestion: c.yellow,
  Skill: c.magenta,
  NotebookEdit: c.yellow,
};

// ── State ───────────────────────────────────────────────────────────

const filePositions = new Map<string, number>();
const watchedFiles = new Set<string>();
let eventCount = 0;

// ── Helpers ─────────────────────────────────────────────────────────

function timestamp(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");
  return `${c.dim}${h}:${m}:${s}${c.reset}`;
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  const oneLine = s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "..." : oneLine;
}

function formatToolUse(toolName: string, input: any): string {
  const color = toolColors[toolName] || c.white;
  const tag = `${color}${c.bold}${toolName}${c.reset}`;

  switch (toolName) {
    case "Bash":
      return `${tag} ${c.dim}$${c.reset} ${truncate(input?.command || "", 120)}`;
    case "Read":
      return `${tag} ${c.dim}${input?.file_path?.replace(homedir(), "~") || ""}${c.reset}`;
    case "Write":
      return `${tag} ${c.dim}${input?.file_path?.replace(homedir(), "~") || ""}${c.reset} ${c.yellow}(${(input?.content?.length || 0)} chars)${c.reset}`;
    case "Edit":
      return `${tag} ${c.dim}${input?.file_path?.replace(homedir(), "~") || ""}${c.reset}`;
    case "Grep":
      return `${tag} ${c.dim}/${input?.pattern || ""}/${c.reset} ${input?.path?.replace(homedir(), "~") || ""}`;
    case "Glob":
      return `${tag} ${c.dim}${input?.pattern || ""}${c.reset} ${input?.path?.replace(homedir(), "~") || ""}`;
    case "Task":
      return `${tag} ${c.green}[${input?.subagent_type || "?"}]${c.reset} ${truncate(input?.description || input?.prompt || "", 80)}`;
    case "TaskCreate":
      return `${tag} ${c.green}+${c.reset} ${truncate(input?.subject || "", 80)}`;
    case "TaskUpdate":
      return `${tag} ${c.dim}#${input?.taskId}${c.reset} ${input?.status || ""}`;
    case "WebSearch":
      return `${tag} ${c.dim}q=${c.reset}${truncate(input?.query || "", 80)}`;
    case "WebFetch":
      return `${tag} ${c.dim}${truncate(input?.url || "", 80)}${c.reset}`;
    case "AskUserQuestion":
      const q = input?.questions?.[0]?.question || "";
      return `${tag} ${c.yellow}?${c.reset} ${truncate(q, 80)}`;
    case "Skill":
      return `${tag} ${c.magenta}/${input?.skill || ""}${c.reset}`;
    default:
      return `${tag} ${c.dim}${truncate(JSON.stringify(input || {}), 100)}${c.reset}`;
  }
}

// ── Event Display ───────────────────────────────────────────────────

function displayEvent(entry: any, sessionShort: string): void {
  const ts = timestamp();
  const sid = `${c.dim}[${sessionShort}]${c.reset}`;

  // User message
  if (entry.type === "user" && entry.message?.role === "user") {
    if (toolsOnly) return;

    const content = entry.message.content;

    // Check for tool result
    if (Array.isArray(content)) {
      const toolResult = content.find((c: any) => c.type === "tool_result");
      if (toolResult) {
        if (filterType && filterType !== "PostToolUse") return;
        const resultText =
          typeof toolResult.content === "string"
            ? toolResult.content
            : JSON.stringify(toolResult.content);
        const isError = toolResult.is_error;
        const statusIcon = isError ? `${c.red}ERR${c.reset}` : `${c.green}OK${c.reset}`;
        console.log(
          `${ts} ${sid} ${c.dim}  <- ${statusIcon} ${truncate(resultText, 120)}${c.reset}`
        );
        return;
      }
    }

    if (filterType && filterType !== "UserPromptSubmit") return;

    let userText = "";
    if (typeof content === "string") {
      userText = content;
    } else if (Array.isArray(content)) {
      userText = content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join(" ");
    }

    // Skip system-reminder content
    if (userText.includes("<system-reminder>") && userText.length > 500) {
      console.log(
        `${ts} ${sid} ${c.bold}${c.cyan}USER${c.reset} ${c.dim}(system-reminder + prompt)${c.reset}`
      );
      return;
    }

    console.log(
      `${ts} ${sid} ${c.bold}${c.cyan}USER${c.reset} ${truncate(userText, 120)}`
    );
    eventCount++;
    return;
  }

  // Assistant message
  if (entry.type === "assistant" && entry.message?.role === "assistant") {
    const content = entry.message.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      // Tool use
      if (block.type === "tool_use") {
        if (filterType && filterType !== "PreToolUse") return;
        console.log(
          `${ts} ${sid}   ${c.bold}->${c.reset} ${formatToolUse(block.name, block.input)}`
        );
        eventCount++;
        continue;
      }

      // Thinking
      if (block.type === "thinking") {
        if (toolsOnly) continue;
        if (filterType && filterType !== "Thinking") continue;
        console.log(
          `${ts} ${sid} ${c.dim}${c.italic}  THINK ${truncate(block.thinking || "", 100)}${c.reset}`
        );
        continue;
      }

      // Text response
      if (block.type === "text") {
        if (toolsOnly) continue;
        if (filterType && filterType !== "Stop") continue;
        const text = block.text || "";
        if (text.length < 5) continue;
        // Show first line of response
        const firstLine = text.split("\n").find((l: string) => l.trim().length > 0) || "";
        console.log(
          `${ts} ${sid} ${c.bold}${c.green}RESP${c.reset} ${truncate(firstLine, 120)}`
        );
        eventCount++;
        continue;
      }
    }
    return;
  }

  // System/result messages
  if (entry.type === "system") {
    if (toolsOnly) return;
    console.log(`${ts} ${sid} ${c.dim}SYS${c.reset} ${truncate(JSON.stringify(entry), 100)}`);
    return;
  }
}

// ── File Processing ─────────────────────────────────────────────────

function processNewLines(filePath: string, sessionShort: string): void {
  if (!existsSync(filePath)) return;

  const lastPos = filePositions.get(filePath) || 0;
  const content = readFileSync(filePath, "utf-8");
  const newContent = content.slice(lastPos);

  filePositions.set(filePath, content.length);

  if (!newContent.trim()) return;

  for (const line of newContent.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      // Skip queue-operation and summary
      if (entry.type === "queue-operation" || entry.type === "summary") continue;
      displayEvent(entry, sessionShort);
    } catch {
      // Skip malformed lines
    }
  }
}

function showRecentEvents(filePath: string, sessionShort: string, count: number): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n").filter((l) => l.trim());

  // Parse all lines first to count displayable events
  const entries: any[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === "queue-operation" || entry.type === "summary") continue;
      entries.push(entry);
    } catch {}
  }

  // Show last N entries
  const recent = entries.slice(-count);
  for (const entry of recent) {
    displayEvent(entry, sessionShort);
  }

  // Set position to end of file so we only get new events going forward
  filePositions.set(filePath, content.length);
}

// ── Watch Logic ─────────────────────────────────────────────────────

function getProjectDirs(): string[] {
  if (watchAll) {
    return readdirSync(PROJECTS_BASE)
      .filter((d) => d.startsWith("-"))
      .map((d) => join(PROJECTS_BASE, d))
      .filter((d) => statSync(d).isDirectory());
  }

  // Auto-detect from CWD
  const cwd = process.cwd().replace(/\//g, "-").replace(/^-/, "-");
  const projectDir = join(PROJECTS_BASE, cwd);
  if (existsSync(projectDir)) {
    return [projectDir];
  }

  // Fallback: find the most recently modified project dir
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
    console.log(
      `${c.yellow}No project dir for CWD. Using most recent: ${dirs[0].name}${c.reset}`
    );
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

function watchFile(filePath: string): void {
  if (watchedFiles.has(filePath)) return;
  watchedFiles.add(filePath);

  const sessionShort = basename(filePath, ".jsonl").slice(0, 8);

  const watcher = watch(filePath, (eventType) => {
    if (eventType === "change") {
      processNewLines(filePath, sessionShort);
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
        console.log(
          `${timestamp()} ${c.green}+ New session${c.reset} ${c.dim}${basename(filePath, ".jsonl").slice(0, 8)}${c.reset}`
        );
        watchFile(filePath);
      }
    }
  });
}

// ── Main ────────────────────────────────────────────────────────────

function main(): void {
  const dirs = getProjectDirs();

  if (dirs.length === 0) {
    console.error(`${c.red}No Claude Code project directories found.${c.reset}`);
    process.exit(1);
  }

  // Header
  console.log(
    `\n${c.bold}${c.blue}obs-tui${c.reset} ${c.dim}— Claude Code Live Event Stream${c.reset}`
  );
  console.log(`${c.dim}${"─".repeat(50)}${c.reset}`);
  console.log(
    `${c.dim}Watching ${dirs.length} project dir(s) | Recent: ${recentCount} events${c.reset}`
  );
  if (toolsOnly) console.log(`${c.yellow}Filter: tools only${c.reset}`);
  if (filterType) console.log(`${c.yellow}Filter: ${filterType}${c.reset}`);
  console.log(`${c.dim}${"─".repeat(50)}${c.reset}\n`);

  for (const dir of dirs) {
    const files = getRecentJsonl(dir, 5);
    const dirShort = basename(dir);

    console.log(
      `${c.dim}Project: ${dirShort} (${files.length} recent sessions)${c.reset}`
    );

    // Show recent events from the MOST recent file only
    if (files.length > 0 && recentCount > 0) {
      const sessionShort = basename(files[0], ".jsonl").slice(0, 8);
      console.log(`${c.dim}─── Recent events from ${sessionShort} ───${c.reset}`);
      showRecentEvents(files[0], sessionShort, recentCount);
      console.log(`${c.dim}─── Live stream ───${c.reset}\n`);
    }

    // Watch all recent files for changes
    for (const file of files) {
      // Set position to end for files we didn't show recent events from
      if (file !== files[0]) {
        const content = readFileSync(file, "utf-8");
        filePositions.set(file, content.length);
      }
      watchFile(file);
    }

    // Watch for new session files
    watchDir(dir);
  }

  console.log(`${c.dim}Streaming... (Ctrl+C to stop)${c.reset}\n`);

  // Keep alive
  process.on("SIGINT", () => {
    console.log(`\n${c.dim}${eventCount} events displayed. Goodbye.${c.reset}`);
    process.exit(0);
  });
}

main();
