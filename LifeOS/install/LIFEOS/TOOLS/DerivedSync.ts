#!/usr/bin/env bun
/**
 * DerivedSync.ts - Detect manual USER source edits and regenerate derived LifeOS artifacts.
 *
 * No-op runs are intentionally silent because launchd WatchPaths can fire often.
 */

import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getClaudeDir } from "./Paths";

type SpawnReadable = ReadableStream<Uint8Array> | null;
type SpawnProcess = {
  stdout: SpawnReadable;
  stderr: SpawnReadable;
  exited: Promise<number>;
  kill: (signal?: string) => void;
};
type SpawnOptions = {
  stdout?: "pipe" | "ignore" | "inherit";
  stderr?: "pipe" | "ignore" | "inherit";
};

declare const Bun: {
  spawn: (cmd: string[], opts?: SpawnOptions) => SpawnProcess;
};

type StateFile = {
  fileHashes: Record<string, string>;
  lastRun: string;
};

type ActionKind = "telos-summary" | "pai-state" | "data-plane-page";

type PlannedAction = {
  kind: ActionKind;
  cmd: string[];
  timeoutMs: number;
  triggeredBy: string[];
};

type ActionLog = {
  cmd: string;
  exit: number | null;
  ms: number;
};

type ActionResult = {
  log: ActionLog;
  ok: boolean;
  error?: string;
};

type JsonLogLine = {
  ts: string;
  changed: string[];
  actions: ActionLog[];
  dryRun: boolean;
  error?: string;
};

type RunSummary = {
  changed: string[];
  actions: ActionLog[];
  dryRun: boolean;
  ts: string;
};

const CLAUDE_DIR = getClaudeDir();
const LIFEOS_DIR = join(CLAUDE_DIR, "LIFEOS");
const USER_DIR = join(LIFEOS_DIR, "USER");
const TOOLS_DIR = join(LIFEOS_DIR, "TOOLS");
const PULSE_PAGES_DIR = join(LIFEOS_DIR, "PULSE", "pages");
const ADAPTER_CLI = join(LIFEOS_DIR, "PULSE", "Tools", "AdapterCli.ts");
const STATE_DIR = join(LIFEOS_DIR, "MEMORY", "STATE");
const OBSERVABILITY_DIR = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
const STATE_PATH = join(STATE_DIR, "derived-sync.json");
const LOCK_PATH = join(STATE_DIR, "derived-sync.lock");
const LOG_PATH = join(OBSERVABILITY_DIR, "derived-sync.jsonl");
const LOCK_STALE_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 30 * 1000;
const SWEEP_TIMEOUT_MS = 180 * 1000;

function usage(): string {
  return [
    "DerivedSync.ts",
    "  --dry-run  Print detected changes and planned actions, then exit without writes",
    "  --status   Print state-file age, watched-file count, and last run summary",
    "  --force    Treat every watched source as changed",
  ].join("\n");
}

function sourcePath(...parts: string[]): string {
  return join(USER_DIR, ...parts);
}

function existingFile(path: string): string[] {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return [];
}

function existingMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const stat = statSync(dir);
  if (!stat.isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name))
    .filter((path) => {
      const stat = statSync(path);
      return stat.isFile();
    });
}

function watchedSourceFiles(): string[] {
  const files = [
    ...existingFile(sourcePath("TELOS", "TELOS.md")),
    ...existingMarkdownFiles(sourcePath("TELOS", "IDEAL_STATE")),
    ...existingMarkdownFiles(sourcePath("TELOS", "CURRENT_STATE")),
    ...existingFile(sourcePath("PRINCIPAL", "PRINCIPAL_IDENTITY.md")),
    ...existingFile(sourcePath("PRINCIPAL", "PRINCIPAL_MEMORY.md")),
    ...existingFile(sourcePath("PRINCIPAL", "RESUME.md")),
    ...existingFile(sourcePath("PRINCIPAL", "WRITINGSTYLE.md")),
    ...existingFile(sourcePath("PRINCIPAL", "PRONUNCIATIONS.json")),
    ...existingFile(sourcePath("DIGITAL_ASSISTANT", "DA_IDENTITY.md")),
    ...existingFile(sourcePath("DIGITAL_ASSISTANT", "DA_MEMORY.md")),
    ...existingFile(sourcePath("CONTACTS.md")),
    ...existingFile(sourcePath("PROJECTS.md")),
    ...existingFile(sourcePath("DEFINITIONS.md")),
    ...existingFile(sourcePath("CANONICAL_CONTENT.md")),
    ...existingFile(sourcePath("CONFIG", "OPERATIONAL_RULES.md")),
  ];

  const unique = new Set<string>();
  files.forEach((file) => {
    if (!file.includes(`${USER_DIR}/Backups/`) && !file.includes(`${USER_DIR}/Archive/`)) {
      unique.add(file);
    }
  });

  // Loop prevention invariant: derived outputs are never in this structural watch list.
  unique.delete(sourcePath("TELOS", "PRINCIPAL_TELOS.md"));
  unique.delete(sourcePath("TELOS", "LIFEOS_STATE.json"));
  const sorted: string[] = [];
  unique.forEach((path) => sorted.push(path));
  return sorted.sort();
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function currentHashes(paths: string[]): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const path of paths) {
    hashes[path] = sha256(path);
  }
  return hashes;
}

function readState(): StateFile | null {
  if (!existsSync(STATE_PATH)) return null;
  const raw = readFileSync(STATE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Partial<StateFile>;
  if (!parsed.fileHashes || typeof parsed.lastRun !== "string") {
    throw new Error(`invalid state file at ${STATE_PATH}`);
  }
  return { fileHashes: parsed.fileHashes, lastRun: parsed.lastRun };
}

function writeState(state: StateFile): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function changedFiles(state: StateFile | null, hashes: Record<string, string>, force: boolean): string[] {
  const paths = Object.keys(hashes).sort();
  if (force) return paths;
  if (!state) return paths;
  return paths.filter((path) => state.fileHashes[path] !== hashes[path]);
}

function isTelosSource(path: string): boolean {
  return path === sourcePath("TELOS", "TELOS.md");
}

function isStateSource(path: string): boolean {
  return path.startsWith(sourcePath("TELOS", "IDEAL_STATE") + "/") || path.startsWith(sourcePath("TELOS", "CURRENT_STATE") + "/");
}

function parseManifestId(path: string): string | null {
  const text = readFileSync(path, "utf-8");
  const match = text.match(/^\s*id\s*=\s*"([^"]+)"\s*$/m);
  if (!match) return null;
  return match[1];
}

function pageIds(): string[] {
  if (!existsSync(PULSE_PAGES_DIR)) return [];
  const stat = statSync(PULSE_PAGES_DIR);
  if (!stat.isDirectory()) return [];
  const ids: string[] = [];
  for (const name of readdirSync(PULSE_PAGES_DIR).sort()) {
    if (!name.endsWith(".manifest.toml")) continue;
    const id = parseManifestId(join(PULSE_PAGES_DIR, name));
    if (id) ids.push(id);
  }
  return ids;
}

function plannedActions(changed: string[]): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const telosSources = changed.filter(isTelosSource);
  const stateSources = changed.filter(isStateSource);

  if (telosSources.length > 0) {
    actions.push({
      kind: "telos-summary",
      cmd: ["bun", join(TOOLS_DIR, "GenerateTelosSummary.ts")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
      triggeredBy: telosSources,
    });
  }

  if (stateSources.length > 0) {
    actions.push({
      kind: "pai-state",
      cmd: ["bun", join(TOOLS_DIR, "UpdateLifeosState.ts")],
      timeoutMs: DEFAULT_TIMEOUT_MS,
      triggeredBy: stateSources,
    });
  }

  if (changed.length > 0) {
    for (const id of pageIds()) {
      actions.push({
        kind: "data-plane-page",
        cmd: ["bun", ADAPTER_CLI, id],
        timeoutMs: SWEEP_TIMEOUT_MS,
        triggeredBy: changed,
      });
    }
  }

  return actions;
}

function shellCommand(cmd: string[]): string {
  return cmd.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ");
}

async function streamText(stream: SpawnReadable): Promise<string> {
  if (!stream) return "";
  return new Response(stream).text();
}

async function runAction(action: PlannedAction): Promise<ActionResult> {
  const started = Date.now();
  const proc = Bun.spawn(action.cmd, { stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill("SIGTERM");
  }, action.timeoutMs);

  const stdoutPromise = streamText(proc.stdout);
  const stderrPromise = streamText(proc.stderr);
  const exit = await proc.exited;
  clearTimeout(timer);

  const stdout = await stdoutPromise;
  const stderr = await stderrPromise;
  const ms = Date.now() - started;
  const log = { cmd: shellCommand(action.cmd), exit, ms };
  if (timedOut) {
    const detail = stderr.trim() || stdout.trim() || "no child output";
    return { log, ok: false, error: `timeout after ${action.timeoutMs}ms for ${shellCommand(action.cmd)}: ${detail}` };
  }
  if (exit !== 0) {
    // A page manifest whose sourceGlobs match nothing on this install is a
    // permanent config state, not a sync failure — skip clean so the launchd
    // job isn't perpetually red over pages that can never build.
    if (action.kind === "data-plane-page" && stdout.includes('"status": "no-sources"')) {
      return { log: { ...log, exit: 0 }, ok: true };
    }
    const detail = stderr.trim() || stdout.trim() || "no child output";
    return { log, ok: false, error: `exit ${exit} for ${shellCommand(action.cmd)} after ${ms}ms: ${detail}` };
  }
  return { log, ok: true };
}

function appendLog(line: JsonLogLine): void {
  mkdirSync(OBSERVABILITY_DIR, { recursive: true });
  appendFileSync(LOG_PATH, JSON.stringify(line) + "\n");
}

function acquireLock(): boolean {
  mkdirSync(STATE_DIR, { recursive: true });
  try {
    writeFileSync(LOCK_PATH, `${process.pid}\n${new Date().toISOString()}\n`, { flag: "wx" });
    return true;
  } catch (err) {
    if (!existsSync(LOCK_PATH)) return false;
    const ageMs = Date.now() - statSync(LOCK_PATH).mtimeMs;
    if (ageMs <= LOCK_STALE_MS) return false;
    rmSync(LOCK_PATH, { force: true });
    writeFileSync(LOCK_PATH, `${process.pid}\n${new Date().toISOString()}\n`, { flag: "wx" });
    return true;
  }
}

function releaseLock(): void {
  rmSync(LOCK_PATH, { force: true });
}

function printDryRun(changed: string[], actions: PlannedAction[]): void {
  console.log(`changed: ${changed.length}`);
  for (const path of changed) {
    console.log(`  ${path}`);
  }
  console.log(`planned actions: ${actions.length}`);
  for (const action of actions) {
    console.log(`  ${shellCommand(action.cmd)}`);
  }
}

function newestLogLine(): RunSummary | null {
  if (!existsSync(LOG_PATH)) return null;
  const lines = readFileSync(LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
  const last = lines[lines.length - 1];
  if (!last) return null;
  return JSON.parse(last) as RunSummary;
}

function printStatus(): void {
  const state = readState();
  const watched = watchedSourceFiles();
  if (!state) {
    console.log(`state: missing at ${STATE_PATH}`);
  } else {
    const ageMs = Date.now() - Date.parse(state.lastRun);
    console.log(`state: ${STATE_PATH}`);
    console.log(`state age ms: ${Number.isFinite(ageMs) ? ageMs : "unknown"}`);
    console.log(`last run: ${state.lastRun}`);
  }
  console.log(`watched files: ${watched.length}`);
  const summary = newestLogLine();
  if (summary) {
    console.log(`last log: ${summary.ts} changed=${summary.changed.length} actions=${summary.actions.length} dryRun=${summary.dryRun}`);
  } else {
    console.log("last log: none");
  }
}

async function runSync(dryRun: boolean, force: boolean): Promise<number> {
  const state = readState();
  const watched = watchedSourceFiles();
  const hashes = currentHashes(watched);
  const changed = changedFiles(state, hashes, force);
  const actions = plannedActions(changed);

  if (dryRun) {
    printDryRun(changed, actions);
    return 0;
  }

  if (changed.length === 0) return 0;

  const actionLogs: ActionLog[] = [];
  const failedActionSources = new Set<string>();
  let hadFailure = false;

  for (const action of actions) {
    try {
      const result = await runAction(action);
      actionLogs.push(result.log);
      if (!result.ok) {
        hadFailure = true;
        // Sweep failures don't poison hash state: AdapterRunner keeps its own
        // per-page source-hash cache and writes <page>.error.json, so a
        // permanently-broken page would otherwise force every watched source
        // to re-fire on every WatchPaths event, forever.
        if (action.kind !== "data-plane-page") {
          for (const source of action.triggeredBy) {
            failedActionSources.add(source);
          }
        }
        console.error(`[DerivedSync] action failed: ${result.error ?? "unknown action failure"}`);
      }
    } catch (err) {
      hadFailure = true;
      if (action.kind !== "data-plane-page") {
        for (const source of action.triggeredBy) {
          failedActionSources.add(source);
        }
      }
      const ms = 0;
      actionLogs.push({ cmd: shellCommand(action.cmd), exit: null, ms });
      console.error(`[DerivedSync] action failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const previousHashes = state?.fileHashes ?? {};
  const nextHashes: Record<string, string> = {};
  for (const path of watched) {
    if (failedActionSources.has(path)) {
      if (previousHashes[path]) nextHashes[path] = previousHashes[path];
    } else {
      nextHashes[path] = hashes[path];
    }
  }

  const lastRun = new Date().toISOString();
  writeState({ fileHashes: nextHashes, lastRun });
  appendLog({ ts: lastRun, changed, actions: actionLogs, dryRun: false });
  return hadFailure ? 1 : 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const allowed = new Set(["--dry-run", "--status", "--force", "--help"]);
  for (const arg of args) {
    if (!allowed.has(arg)) {
      console.error(usage());
      process.exit(2);
    }
  }

  if (args.includes("--help")) {
    console.log(usage());
    return;
  }

  if (args.includes("--status")) {
    printStatus();
    return;
  }

  if (!acquireLock()) return;
  // Compute the exit code inside try/finally, then exit AFTER releasing the lock.
  // Calling process.exit() inside the try would skip the finally and leak the lockfile.
  let exitCode = 0;
  try {
    exitCode = await runSync(args.includes("--dry-run"), args.includes("--force"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendLog({ ts: new Date().toISOString(), changed: [], actions: [], dryRun: args.includes("--dry-run"), error: message });
    console.error(`[DerivedSync] Fatal: ${message}`);
    exitCode = 1;
  } finally {
    releaseLock();
  }
  process.exit(exitCode);
}

main();
