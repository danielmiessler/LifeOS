#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../../LIFEOS/TOOLS/lifeos-root";

type FlagValue = string | boolean;
type ParsedArgs = {
  positionals: string[];
  flags: Record<string, FlagValue>;
};

type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue | undefined };

type SurfaceRole = {
  ref: string;
  role: string;
  raw?: string;
};

type SurfaceCell = {
  ref: string;
  cmd?: string;
  raw?: string;
};

type HostConfig = {
  name: string;
  ssh: string;
};

type MonitorStateName = "idle" | "working" | "done" | "awaiting-input";
type MonitorState = {
  ref: string;
  state: MonitorStateName;
  textTail: string;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const LAUNCH_TIMEOUT_MS = 5_000;
const PING_WAIT_MS = 15_000;
const PING_INTERVAL_MS = 750;
const MONITOR_TAIL_LINES = 40;
const VOICE_URL = "http://localhost:31337/notify";

function usageText(): string {
  return `cmux.ts - JSON CLI wrapper for the cmux GUI terminal multiplexer

USAGE:
  bun ~/.claude/skills/CMUX/Tools/cmux.ts <subcommand> [options]

SUBCOMMANDS:
  ping                                      Ensure cmux is up and return version
  send --surface <ref> "<text>" [--enter]  Type text into a surface, optionally press Enter
  read --surface <ref> [--lines N]          Read screen text from a surface
  boot-team --name <n> [--cwd <path>]       Boot orchestrator/lead/worker workspace
  race --feature <f> --agents N             Boot N race agents for a feature
  fleet --name <n> --grid 2x2               Boot a named grid of local surfaces
  mini-fleet [--hosts <csv>]                Boot SSH panes from --hosts or fleet.json
  monitor [--workspace <ref>] [--once]      Poll surfaces and voice key transitions
  list [--workspace <ref>]                  Return cmux tree topology
  tree [--workspace <ref>]                  Return cmux tree topology
  flash --workspace <ref> [--surface <ref>] Trigger cmux visual flash
  voice "<msg>"                             Send a short Pulse voice notification

GLOBAL:
  --help, -h                                Show this help text

OUTPUT:
  Subcommands print one JSON object to stdout. monitor without --once streams one JSON object per poll pass.
`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, FlagValue> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const name = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        index += 1;
      } else {
        flags[name] = true;
      }
    } else {
      positionals.push(token);
    }
  }

  return { positionals, flags };
}

function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === "string" ? value : undefined;
}

function flagBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true;
}

function requireFlag(args: ParsedArgs, name: string): string | JsonObject {
  const value = flagString(args, name);
  if (value === undefined || value.trim() === "") {
    return { ok: false, error: `Missing required --${name}` };
  }
  return value;
}

function parsePositiveInteger(value: string | undefined, fallback: number, label: string): number | JsonObject {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: `${label} must be a positive integer` };
  }
  return parsed;
}

function expandHome(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function cmuxBinary(): string {
  return process.env.CMUX_BIN && process.env.CMUX_BIN.trim() !== ""
    ? expandHome(process.env.CMUX_BIN)
    : join(homedir(), ".local/bin/cmux");
}

function buildCmuxCommand(args: string[]): string[] {
  const password = process.env.CMUX_SOCKET_PASSWORD;
  const includesPassword = args.includes("--password");
  if (password && !includesPassword) {
    return [cmuxBinary(), "--password", password, ...args];
  }
  return [cmuxBinary(), ...args];
}

async function processText(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (stream === null) {
    return "";
  }
  return await new Response(stream).text();
}

async function runProcess(command: string[], timeoutMs: number): Promise<ExecResult> {
  let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  try {
    proc = Bun.spawn(command, {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
    });
  } catch (error) {
    return {
      code: 127,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  try {
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      processText(proc.stdout),
      processText(proc.stderr),
    ]);
    clearTimeout(timeout);
    if (timedOut) {
      return { code: code === 0 ? 124 : code, stdout, stderr: stderr || "Process timed out" };
    }
    return { code, stdout, stderr };
  } catch (error) {
    clearTimeout(timeout);
    proc.kill();
    return {
      code: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function isSocketMissing(result: ExecResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`;
  return /socket\s+not\s+found/i.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function cmuxExec(args: string[], retried = false): Promise<ExecResult> {
  const result = await runProcess(buildCmuxCommand(args), DEFAULT_TIMEOUT_MS);
  if (result.code === 0 || retried || !isSocketMissing(result)) {
    return result;
  }

  const launch = await runProcess(["open", "-a", "cmux"], LAUNCH_TIMEOUT_MS);
  if (launch.code !== 0) {
    await runProcess(buildCmuxCommand([process.cwd()]), DEFAULT_TIMEOUT_MS);
  }

  const deadline = Date.now() + PING_WAIT_MS;
  while (Date.now() < deadline) {
    const ping = await cmuxExec(["ping"], true);
    if (ping.code === 0) {
      return await cmuxExec(args, true);
    }
    await sleep(PING_INTERVAL_MS);
  }

  return {
    code: 1,
    stdout: result.stdout,
    stderr: `cmux socket was missing and auto-launch did not become ready within ${PING_WAIT_MS}ms`,
  };
}

function resultError(result: ExecResult, context: string): JsonObject {
  const detail = (result.stderr || result.stdout || "unknown cmux error").trim();
  return { ok: false, error: `${context}: ${detail}` };
}

function extractFirstRef(text: string, kind: "workspace" | "surface" | "pane" | "window"): string | undefined {
  const direct = text.match(new RegExp(`${kind}:[A-Za-z0-9._:-]+`));
  if (direct) {
    return direct[0];
  }

  const labeled = text.match(new RegExp(`"${kind}"\\s*:\\s*"([^"]+)"`));
  if (labeled) {
    return labeled[1];
  }

  const uuid = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuid ? uuid[0] : undefined;
}

function extractRefs(text: string, kind: "workspace" | "surface" | "pane" | "window"): string[] {
  const refs = new Set<string>();
  const direct = text.matchAll(new RegExp(`${kind}:[A-Za-z0-9._:-]+`, "g"));
  for (const match of direct) {
    refs.add(match[0]);
  }

  const labeled = text.matchAll(new RegExp(`"${kind}"\\s*:\\s*"([^"]+)"`, "g"));
  for (const match of labeled) {
    refs.add(match[1]);
  }

  return [...refs];
}

function argsWithWorkspace(base: string[], workspace: string | undefined): string[] {
  if (workspace === undefined) {
    return base;
  }
  return [...base, "--workspace", workspace];
}

function argsWithSurface(base: string[], surface: string | undefined): string[] {
  if (surface === undefined) {
    return base;
  }
  return [...base, "--surface", surface];
}

async function createWorkspace(name: string, cwd: string | undefined): Promise<{ workspace?: string; raw: string; error?: JsonObject }> {
  const createArgs = ["new-workspace"];
  if (cwd !== undefined) {
    createArgs.push("--cwd", expandHome(cwd));
  }

  const created = await cmuxExec(createArgs);
  if (created.code !== 0) {
    return { raw: created.stdout, error: resultError(created, "new-workspace failed") };
  }

  const workspace = extractFirstRef(created.stdout, "workspace");
  if (workspace !== undefined) {
    const renamed = await cmuxExec(["rename-workspace", "--workspace", workspace, name]);
    if (renamed.code !== 0) {
      return { workspace, raw: created.stdout, error: resultError(renamed, "rename-workspace failed") };
    }
  }

  return { workspace, raw: created.stdout };
}

async function discoverSurfaces(workspace: string | undefined): Promise<string[]> {
  const tree = await cmuxExec(argsWithWorkspace(["tree"], workspace));
  if (tree.code === 0) {
    const refs = extractRefs(tree.stdout, "surface");
    if (refs.length > 0) {
      return refs;
    }
  }

  const panes = await cmuxExec(argsWithWorkspace(["list-panes"], workspace));
  if (panes.code === 0) {
    return extractRefs(panes.stdout, "surface");
  }

  return [];
}

async function createSurface(workspace: string | undefined, direction: "right" | "down" | "left" | "up"): Promise<{ ref?: string; raw: string; error?: JsonObject }> {
  const splitArgs = argsWithWorkspace(["new-split", direction], workspace);
  const split = await cmuxExec(splitArgs);
  if (split.code !== 0) {
    return { raw: split.stdout, error: resultError(split, "new-split failed") };
  }

  const ref = extractFirstRef(split.stdout, "surface");
  if (ref !== undefined) {
    return { ref, raw: split.stdout };
  }

  const surfaceArgs = argsWithWorkspace(["new-surface", "--type", "terminal"], workspace);
  const surface = await cmuxExec(surfaceArgs);
  if (surface.code !== 0) {
    return { raw: `${split.stdout}\n${surface.stdout}`, error: resultError(surface, "new-surface failed") };
  }

  return {
    ref: extractFirstRef(surface.stdout, "surface"),
    raw: `${split.stdout}\n${surface.stdout}`,
  };
}

async function renameSurface(workspace: string | undefined, surface: string | undefined, title: string): Promise<JsonObject | undefined> {
  const args = argsWithWorkspace(["rename-tab"], workspace);
  const withSurface = argsWithSurface(args, surface);
  const result = await cmuxExec([...withSurface, title]);
  if (result.code !== 0) {
    return resultError(result, `rename-tab failed for ${title}`);
  }
  return undefined;
}

async function sendToSurface(workspace: string | undefined, surface: string | undefined, text: string, enter: boolean): Promise<JsonObject | undefined> {
  const sendArgs = argsWithWorkspace(["send"], workspace);
  const withSurface = argsWithSurface(sendArgs, surface);
  const sent = await cmuxExec([...withSurface, text]);
  if (sent.code !== 0) {
    return resultError(sent, "send failed");
  }
  if (enter) {
    const keyArgs = argsWithWorkspace(["send-key"], workspace);
    const keySurface = argsWithSurface(keyArgs, surface);
    const key = await cmuxExec([...keySurface, "Enter"]);
    if (key.code !== 0) {
      return resultError(key, "send-key Enter failed");
    }
  }
  return undefined;
}

async function commandPing(): Promise<JsonObject> {
  const ping = await cmuxExec(["ping"]);
  if (ping.code !== 0) {
    return resultError(ping, "ping failed");
  }

  const version = await cmuxExec(["version"]);
  if (version.code !== 0) {
    return resultError(version, "version failed");
  }

  return { ok: true, version: version.stdout.trim() };
}

async function commandSend(args: ParsedArgs): Promise<JsonObject> {
  const surfaceValue = requireFlag(args, "surface");
  if (typeof surfaceValue !== "string") {
    return surfaceValue;
  }

  const text = args.positionals.join(" ");
  if (text.trim() === "") {
    return { ok: false, error: "Missing text positional" };
  }

  const workspace = flagString(args, "workspace");
  const entered = flagBoolean(args, "enter");
  const error = await sendToSurface(workspace, surfaceValue, text, entered);
  if (error !== undefined) {
    return error;
  }

  return { ok: true, surface: surfaceValue, entered };
}

async function commandRead(args: ParsedArgs): Promise<JsonObject> {
  const surfaceValue = requireFlag(args, "surface");
  if (typeof surfaceValue !== "string") {
    return surfaceValue;
  }

  const linesValue = parsePositiveInteger(flagString(args, "lines"), 80, "--lines");
  if (typeof linesValue !== "number") {
    return linesValue;
  }

  const workspace = flagString(args, "workspace");
  let readArgs = argsWithWorkspace(["read-screen"], workspace);
  readArgs = argsWithSurface(readArgs, surfaceValue);
  readArgs.push("--lines", String(linesValue));
  if (flagBoolean(args, "scrollback")) {
    readArgs.push("--scrollback");
  }

  const result = await cmuxExec(readArgs);
  if (result.code !== 0) {
    return resultError(result, "read-screen failed");
  }

  return { ok: true, text: result.stdout };
}

async function commandBootTeam(args: ParsedArgs): Promise<JsonObject> {
  const nameValue = requireFlag(args, "name");
  if (typeof nameValue !== "string") {
    return nameValue;
  }

  const tiers = (flagString(args, "tiers") ?? "orchestrator,lead,worker,worker")
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
  if (tiers.length === 0) {
    return { ok: false, error: "--tiers must include at least one role" };
  }

  const created = await createWorkspace(nameValue, flagString(args, "cwd"));
  if (created.error !== undefined) {
    return created.error;
  }

  const surfaces: SurfaceRole[] = [];
  const existing = await discoverSurfaces(created.workspace);
  const firstRef = existing[0];
  surfaces.push(firstRef ? { ref: firstRef, role: tiers[0] } : { ref: "", role: tiers[0], raw: created.raw });

  for (let index = 1; index < tiers.length; index += 1) {
    const createdSurface = await createSurface(created.workspace, index === 1 ? "right" : "down");
    if (createdSurface.error !== undefined) {
      return createdSurface.error;
    }
    surfaces.push({
      ref: createdSurface.ref ?? "",
      role: tiers[index],
      raw: createdSurface.ref === undefined ? createdSurface.raw : undefined,
    });
  }

  for (const surface of surfaces) {
    const renameError = await renameSurface(created.workspace, surface.ref || undefined, surface.role);
    if (renameError !== undefined) {
      return renameError;
    }
  }

  return {
    ok: true,
    workspace: created.workspace ?? "",
    surfaces: surfaces as unknown as JsonValue,
    raw: created.workspace === undefined ? created.raw : undefined,
  };
}

function defaultRaceCommand(feature: string): string {
  const safeFeature = feature.replace(/'/g, "'\\''");
  return `printf '%s\\n' 'race agent ready: ${safeFeature}'`;
}

async function commandRace(args: ParsedArgs): Promise<JsonObject> {
  const featureValue = requireFlag(args, "feature");
  if (typeof featureValue !== "string") {
    return featureValue;
  }

  const agentsValue = parsePositiveInteger(flagString(args, "agents"), 0, "--agents");
  if (typeof agentsValue !== "number") {
    return agentsValue;
  }
  if (agentsValue < 1) {
    return { ok: false, error: "--agents is required and must be positive" };
  }

  const command = flagString(args, "cmd") ?? defaultRaceCommand(featureValue);
  const created = await createWorkspace(`race-${featureValue}`, flagString(args, "cwd"));
  if (created.error !== undefined) {
    return created.error;
  }

  const surfaces: SurfaceCell[] = [];
  const existing = await discoverSurfaces(created.workspace);
  if (existing[0]) {
    surfaces.push({ ref: existing[0], cmd: command });
  } else {
    surfaces.push({ ref: "", cmd: command, raw: created.raw });
  }

  for (let index = 1; index < agentsValue; index += 1) {
    const createdSurface = await createSurface(created.workspace, "right");
    if (createdSurface.error !== undefined) {
      return createdSurface.error;
    }
    surfaces.push({
      ref: createdSurface.ref ?? "",
      cmd: command,
      raw: createdSurface.ref === undefined ? createdSurface.raw : undefined,
    });
  }

  for (let index = 0; index < surfaces.length; index += 1) {
    const title = `race-${index + 1}`;
    const renameError = await renameSurface(created.workspace, surfaces[index].ref || undefined, title);
    if (renameError !== undefined) {
      return renameError;
    }
    const sendError = await sendToSurface(created.workspace, surfaces[index].ref || undefined, command, true);
    if (sendError !== undefined) {
      return sendError;
    }
  }

  return {
    ok: true,
    workspace: created.workspace ?? "",
    feature: featureValue,
    surfaces: surfaces as unknown as JsonValue,
    raw: created.workspace === undefined ? created.raw : undefined,
  };
}

function parseGrid(value: string | undefined): { rows: number; cols: number } | { error: JsonObject } {
  const grid = value ?? "2x2";
  const match = grid.match(/^([1-9][0-9]*)x([1-9][0-9]*)$/i);
  if (!match) {
    return { error: { ok: false, error: "--grid must be in RxC form, for example 2x2" } };
  }
  return { rows: Number.parseInt(match[1], 10), cols: Number.parseInt(match[2], 10) };
}

async function commandFleet(args: ParsedArgs): Promise<JsonObject> {
  const nameValue = requireFlag(args, "name");
  if (typeof nameValue !== "string") {
    return nameValue;
  }

  const grid = parseGrid(flagString(args, "grid"));
  if ("error" in grid) {
    return grid.error;
  }

  const commands = (flagString(args, "cmds") ?? "")
    .split(";")
    .map((cmd) => cmd.trim())
    .filter((cmd) => cmd.length > 0);
  const total = grid.rows * grid.cols;
  const created = await createWorkspace(nameValue, undefined);
  if (created.error !== undefined) {
    return created.error;
  }

  const cells: SurfaceCell[] = [];
  const existing = await discoverSurfaces(created.workspace);
  cells.push({ ref: existing[0] ?? "", cmd: commands[0], raw: existing[0] ? undefined : created.raw });

  for (let index = 1; index < total; index += 1) {
    const direction = index < grid.cols ? "right" : "down";
    const createdSurface = await createSurface(created.workspace, direction);
    if (createdSurface.error !== undefined) {
      return createdSurface.error;
    }
    cells.push({
      ref: createdSurface.ref ?? "",
      cmd: commands[index],
      raw: createdSurface.ref === undefined ? createdSurface.raw : undefined,
    });
  }

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const renameError = await renameSurface(created.workspace, cell.ref || undefined, `cell-${index + 1}`);
    if (renameError !== undefined) {
      return renameError;
    }
    if (cell.cmd !== undefined) {
      const sendError = await sendToSurface(created.workspace, cell.ref || undefined, cell.cmd, true);
      if (sendError !== undefined) {
        return sendError;
      }
    }
  }

  return {
    ok: true,
    workspace: created.workspace ?? "",
    cells: cells as unknown as JsonValue,
    raw: created.workspace === undefined ? created.raw : undefined,
  };
}

function parseHostsCsv(value: string): HostConfig[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const equalsIndex = entry.indexOf("=");
      if (equalsIndex === -1) {
        return { name: entry, ssh: entry };
      }
      return {
        name: entry.slice(0, equalsIndex).trim(),
        ssh: entry.slice(equalsIndex + 1).trim(),
      };
    });
}

function isHostConfig(value: unknown): value is HostConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.ssh === "string";
}

function loadFleetConfig(): HostConfig[] | JsonObject {
  const configPath = join(claudeDir(), "LIFEOS/USER/CUSTOMIZATIONS/SKILLS/CMUX/fleet.json");
  if (!existsSync(configPath)) {
    return {
      ok: false,
      error: "No hosts configured. Pass --hosts name=ssh,name2=ssh2 or create ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/CMUX/fleet.json with {\"hosts\":[{\"name\":\"...\",\"ssh\":\"...\"}]}",
    };
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "fleet.json must contain an object" };
    }
    const hosts = (parsed as Record<string, unknown>).hosts;
    if (!Array.isArray(hosts) || !hosts.every(isHostConfig)) {
      return { ok: false, error: "fleet.json must have shape {\"hosts\":[{\"name\":\"...\",\"ssh\":\"...\"}]}" };
    }
    return hosts;
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read fleet.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function validateSshTarget(host: HostConfig): JsonObject | undefined {
  if (host.name.trim() === "" || host.ssh.trim() === "") {
    return { ok: false, error: "Host name and ssh target must be non-empty" };
  }
  if (!/^[A-Za-z0-9._@:%+/\-]+$/.test(host.ssh)) {
    return { ok: false, error: `SSH target for ${host.name} contains unsupported characters` };
  }
  return undefined;
}

async function commandMiniFleet(args: ParsedArgs): Promise<JsonObject> {
  const hostFlag = flagString(args, "hosts");
  const hostsOrError = hostFlag !== undefined ? parseHostsCsv(hostFlag) : loadFleetConfig();
  if (!Array.isArray(hostsOrError)) {
    return hostsOrError;
  }
  if (hostsOrError.length === 0) {
    return { ok: false, error: "No hosts configured" };
  }

  for (const host of hostsOrError) {
    const validation = validateSshTarget(host);
    if (validation !== undefined) {
      return validation;
    }
  }

  const created = await createWorkspace("mini-fleet", undefined);
  if (created.error !== undefined) {
    return created.error;
  }

  const existing = await discoverSurfaces(created.workspace);
  const results: Array<HostConfig & { ref: string; raw?: string }> = [];
  results.push({ ...hostsOrError[0], ref: existing[0] ?? "", raw: existing[0] ? undefined : created.raw });

  for (let index = 1; index < hostsOrError.length; index += 1) {
    const createdSurface = await createSurface(created.workspace, "right");
    if (createdSurface.error !== undefined) {
      return createdSurface.error;
    }
    results.push({
      ...hostsOrError[index],
      ref: createdSurface.ref ?? "",
      raw: createdSurface.ref === undefined ? createdSurface.raw : undefined,
    });
  }

  for (const host of results) {
    const renameError = await renameSurface(created.workspace, host.ref || undefined, host.name);
    if (renameError !== undefined) {
      return renameError;
    }
    const sendError = await sendToSurface(created.workspace, host.ref || undefined, `ssh ${host.ssh}`, true);
    if (sendError !== undefined) {
      return sendError;
    }
  }

  return {
    ok: true,
    workspace: created.workspace ?? "",
    hosts: results as unknown as JsonValue,
    raw: created.workspace === undefined ? created.raw : undefined,
  };
}

function classifyScreen(text: string): MonitorStateName {
  const tail = text.trimEnd();
  if (/(do you want|\[y\/n\]|\(y\/n\)|press enter|confirm|continue\?)/i.test(tail) || /\?\s*$/.test(tail)) {
    return "awaiting-input";
  }
  if (/(^|\n)(done|completed|exit code:\s*0)\b/i.test(tail) || /[✓✔]\s*(done|complete|completed)?/i.test(tail)) {
    return "done";
  }
  if (/(^|\n)[^\n]*([$%#❯])\s*$/.test(tail)) {
    return "idle";
  }
  return "working";
}

async function readMonitorStates(workspace: string | undefined): Promise<{ states?: MonitorState[]; error?: JsonObject }> {
  const health = await cmuxExec(argsWithWorkspace(["surface-health"], workspace));
  if (health.code !== 0) {
    return { error: resultError(health, "surface-health failed") };
  }

  const aggregateArgs = argsWithWorkspace(["read-screen"], workspace);
  const aggregate = await cmuxExec([...aggregateArgs, "--lines", String(MONITOR_TAIL_LINES)]);
  if (aggregate.code !== 0) {
    return { error: resultError(aggregate, "read-screen failed") };
  }

  const refs = extractRefs(health.stdout, "surface");
  if (refs.length === 0) {
    const ref = workspace ?? "workspace";
    return {
      states: [{ ref, state: classifyScreen(aggregate.stdout), textTail: aggregate.stdout }],
    };
  }

  const states: MonitorState[] = [];
  for (const ref of refs) {
    let args = argsWithWorkspace(["read-screen"], workspace);
    args = argsWithSurface(args, ref);
    const screen = await cmuxExec([...args, "--lines", String(MONITOR_TAIL_LINES)]);
    if (screen.code !== 0) {
      states.push({ ref, state: "working", textTail: screen.stderr || screen.stdout });
    } else {
      states.push({ ref, state: classifyScreen(screen.stdout), textTail: screen.stdout });
    }
  }
  return { states };
}

async function notifyVoice(message: string): Promise<boolean> {
  try {
    const response = await fetch(VOICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, voice_enabled: true }),
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (messageText.length === 0) {
      return false;
    }
    return false;
  }
}

async function commandVoice(args: ParsedArgs): Promise<JsonObject> {
  const message = args.positionals.join(" ");
  if (message.trim() === "") {
    return { ok: false, error: "Missing voice message positional" };
  }
  const notified = await notifyVoice(message);
  return { ok: true, notified };
}

async function commandMonitor(args: ParsedArgs): Promise<number> {
  const intervalValue = parsePositiveInteger(flagString(args, "interval"), 3, "--interval");
  if (typeof intervalValue !== "number") {
    console.log(JSON.stringify(intervalValue));
    return 1;
  }

  const workspace = flagString(args, "workspace");
  const once = flagBoolean(args, "once");
  const previous = new Map<string, MonitorStateName>();
  let stopping = false;

  process.on("SIGINT", () => {
    stopping = true;
    process.stdout.write(`${JSON.stringify({ ok: true, stopped: true })}\n`);
    process.exit(0);
  });

  while (!stopping) {
    const pass = await readMonitorStates(workspace);
    if (pass.error !== undefined) {
      console.log(JSON.stringify(pass.error));
      return 1;
    }

    const states = pass.states ?? [];
    for (const state of states) {
      const oldState = previous.get(state.ref);
      if (oldState !== state.state && (state.state === "done" || state.state === "awaiting-input")) {
        const label = state.state === "done" ? "done" : "awaiting input";
        await notifyVoice(`cmux surface ${state.ref} is ${label}`);
      }
      previous.set(state.ref, state.state);
    }

    console.log(JSON.stringify({ ok: true, states }));
    if (once) {
      return 0;
    }

    // cmux has no push/event API. This monitor is intentionally long-running and polls until SIGINT.
    await sleep(intervalValue * 1_000);
  }

  console.log(JSON.stringify({ ok: true, stopped: true }));
  return 0;
}

function parseMaybeJson(text: string): JsonValue {
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      parsed === null ||
      typeof parsed === "string" ||
      typeof parsed === "number" ||
      typeof parsed === "boolean" ||
      Array.isArray(parsed) ||
      typeof parsed === "object"
    ) {
      return parsed as JsonValue;
    }
    return { raw: text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.length === 0) {
      return { raw: text };
    }
    return { raw: text };
  }
}

async function commandTree(args: ParsedArgs): Promise<JsonObject> {
  let treeArgs = ["tree", "--all"];
  const workspace = flagString(args, "workspace");
  treeArgs = argsWithWorkspace(treeArgs, workspace);
  const result = await cmuxExec(treeArgs);
  if (result.code !== 0) {
    return resultError(result, "tree failed");
  }
  return { ok: true, tree: parseMaybeJson(result.stdout) };
}

async function commandFlash(args: ParsedArgs): Promise<JsonObject> {
  const workspaceValue = requireFlag(args, "workspace");
  if (typeof workspaceValue !== "string") {
    return workspaceValue;
  }

  let flashArgs = ["trigger-flash", "--workspace", workspaceValue];
  flashArgs = argsWithSurface(flashArgs, flagString(args, "surface"));
  const result = await cmuxExec(flashArgs);
  if (result.code !== 0) {
    return resultError(result, "trigger-flash failed");
  }
  return { ok: true };
}

async function dispatch(command: string, args: ParsedArgs): Promise<JsonObject | number> {
  switch (command) {
    case "ping":
      return await commandPing();
    case "send":
      return await commandSend(args);
    case "read":
      return await commandRead(args);
    case "boot-team":
      return await commandBootTeam(args);
    case "race":
      return await commandRace(args);
    case "fleet":
      return await commandFleet(args);
    case "mini-fleet":
      return await commandMiniFleet(args);
    case "monitor":
      return await commandMonitor(args);
    case "list":
    case "tree":
      return await commandTree(args);
    case "flash":
      return await commandFlash(args);
    case "voice":
      return await commandVoice(args);
    default:
      return { ok: false, error: `Unknown subcommand: ${command}` };
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    console.log(usageText());
    return 0;
  }

  const command = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const result = await dispatch(command, parsed);

  if (typeof result === "number") {
    return result;
  }

  console.log(JSON.stringify(result));
  return result.ok === true ? 0 : 1;
}

try {
  const code = await main();
  process.exit(code);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}
