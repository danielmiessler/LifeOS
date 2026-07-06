#!/usr/bin/env bun
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { accessSync, constants, createWriteStream, existsSync, type WriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { getClaudeDir } from "./Paths";

type Args = { slug: string; prompt?: string; model: string; effort: string; sandbox: string; timeoutMs: number; pulseUrl: string };
type JsonRecord = Record<string, unknown>;
type RingEntry = { raw: JsonRecord; type: string };
type RunState = { startMs: number; childAlive: boolean; timedOut: boolean; interrupted: boolean };
type ExitInfo = { code: number | null; signal: NodeJS.Signals | null; error?: Error };
type TimeoutControl = { clearNaturalExit: () => void; clearAll: () => void };
type SignalControl = { clear: () => void };
type Paths = { eventsFile: string; finalFile: string };
type FinalInput = { verdict: "success" | "error" | "timeout"; exitCode: number | null; eventsFile: string; finalFile: string; durationMs: number; finalMessage: string };
const RING_SIZE = 5;
const PULSE_TIMEOUT_MS = 2000;
const ESCALATE_MS = 5000;
function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { model: "gpt-5.5", effort: "high", sandbox: "workspace-write", timeoutMs: 300000, pulseUrl: "http://localhost:31337/notify" };
  const seen = new Set<string>();
  const valueFor = (flag: string, inline: string | undefined, index: number): [string, number] => {
    if (inline !== undefined) return [inline, index];
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    return [value, index + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error(`unexpected positional argument: ${token}`);
    const eq = token.indexOf("="), flag = eq === -1 ? token : token.slice(0, eq), inline = eq === -1 ? undefined : token.slice(eq + 1);
    if (seen.has(flag)) throw new Error(`duplicate flag: ${flag}`);
    seen.add(flag);
    const [value, next] = valueFor(flag, inline, i); i = next;
    switch (flag) {
      case "--slug": args.slug = nonEmpty(flag, value); break;
      case "--prompt": args.prompt = nonEmpty(flag, value); break;
      case "--model": args.model = nonEmpty(flag, value); break;
      case "--reasoning-effort": args.effort = nonEmpty(flag, value); break;
      case "--sandbox": args.sandbox = nonEmpty(flag, value); break;
      case "--timeout-ms": args.timeoutMs = positiveInt(flag, value); break;
      case "--pulse-url": args.pulseUrl = validUrl(flag, value); break;
      default: throw new Error(`unknown flag: ${flag}`);
    }
  }
  if (!args.slug) throw new Error("--slug is required");
  if (!/^[A-Za-z0-9._-]+$/.test(args.slug) || args.slug === "." || args.slug === "..") throw new Error("--slug must contain only letters, numbers, dot, underscore, or hyphen");
  return args as Args;
}
function nonEmpty(flag: string, value: string): string { if (value.length === 0) throw new Error(`${flag} must not be empty`); return value; }
function positiveInt(flag: string, value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive safe integer`);
  return parsed;
}
function validUrl(flag: string, value: string): string {
  try { return new URL(nonEmpty(flag, value)).toString(); }
  catch (error: unknown) { throw new Error(`${flag} must be a valid URL: ${String(error)}`); }
}
function homeDir(): string { const home = process.env.HOME; if (!home) throw new Error("HOME is not set"); return home; }
function preflightCodex(home: string): string | null {
  const codexPath = join(home, ".bun", "bin", "codex");
  try { accessSync(codexPath, constants.X_OK); return codexPath; }
  catch (_error: unknown) { return null; } // Safe: caller emits the exact unavailable JSON.
}
async function ensureSlugDir(home: string, slug: string): Promise<Paths> {
  const slugDir = join(getClaudeDir(), "LIFEOS", "MEMORY", "WORK", slug);
  await mkdir(slugDir, { recursive: true }); // Local artifact I/O is unbounded so errors can surface naturally.
  return { eventsFile: join(slugDir, "forge-events.jsonl"), finalFile: join(slugDir, "forge-final.txt") };
}
async function readPrompt(prompt: string | undefined): Promise<string> {
  if (prompt !== undefined) return prompt;
  const stdin = process.stdin as typeof process.stdin & { isTTY?: boolean };
  if (stdin.isTTY) return "";
  let text = "";
  // Unbounded by design: this CLI consumes a prompt stream, and the OS/process bounds the input.
  for await (const chunk of stdin) text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  return text;
}
function spawnCodex(codexPath: string, args: Args, finalFile: string, prompt: string): ChildProcessWithoutNullStreams {
  const argv = [codexPath, "exec", "--model", args.model, "-c", `model_reasoning_effort=${args.effort}`, "--sandbox", args.sandbox, "--skip-git-repo-check", "--cd", process.cwd(), "--json", "-o", finalFile, "-"];
  const child = spawn(argv[0], argv.slice(1), { stdio: ["pipe", "pipe", "pipe"], detached: true });
  child.stdin.end(prompt);
  return child;
}
async function writeLine(stream: WriteStream, line: string): Promise<void> {
  if (stream.write(line)) return; // Local log I/O is unbounded because it is the durable audit trail.
  await new Promise<void>((resolve, reject) => { stream.once("drain", resolve); stream.once("error", reject); });
}
async function endStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve, reject) => { stream.once("error", reject); stream.end(resolve); });
}
async function wireStdout(child: ChildProcessWithoutNullStreams, eventsFile: string, ring: RingEntry[], args: Args): Promise<void> {
  const writer = createWriteStream(eventsFile, { flags: "a" });
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let warnedNoise = false, sentOpening = false;
  try {
    // Bounded by child stdout closing through normal exit, timeout, or helper signal handling.
    for await (const rawLine of rl) {
      const line = rawLine.trimEnd();
      if (line.length === 0) continue;
      await writeLine(writer, `${line}\n`);
      const parsed = parseJsonLine(line);
      if (!parsed) {
        if (!warnedNoise) console.error("ForgeProgress: codex stdout included non-JSON noise; persisted to events log and skipping future parse warnings");
        warnedNoise = true; continue;
      }
      const type = eventType(parsed);
      if (!type) continue;
      ring.push({ raw: parsed, type });
      while (ring.length > RING_SIZE) ring.shift();
      if (!sentOpening && type === "thread.started") {
        sentOpening = true;
        void sendNotify(args.pulseUrl, { message: "Forge: spinning up codex", agent: "Forge", slug: args.slug, voice_enabled: false });
      }
    }
  } finally { await endStream(writer); }
}
function parseJsonLine(line: string): JsonRecord | null {
  try { return asRecord(JSON.parse(line) as unknown); }
  catch (_error: unknown) { return null; } // Safe: raw stdout noise is already persisted to JSONL.
}
function asRecord(value: unknown): JsonRecord | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null; }
function eventType(record: JsonRecord): string | null {
  if (typeof record.type === "string") return record.type;
  const msg = asRecord(record.msg);
  if (msg && typeof msg.type === "string") return msg.type;
  return null;
}
function startProgressPoller(ring: RingEntry[], args: Args): () => void {
  let lastSummary = "", cleaned = false;
  const timer = setInterval(() => {
    try {
      const entry = [...ring].reverse().find((candidate: RingEntry) => candidate.type === "item.completed");
      if (!entry) return;
      const summary = buildSummary(entry);
      if (!summary || summary.message === lastSummary) return;
      lastSummary = summary.message;
      void sendNotify(args.pulseUrl, { message: summary.message, voice_enabled: false, agent: "Forge", slug: args.slug, phase: "FORGE", item_type: summary.itemType });
    } catch (error: unknown) { console.error(`ForgeProgress: progress poller failed: ${String(error)}`); }
  }, 8000);
  return () => { if (cleaned) return; cleaned = true; clearInterval(timer); };
}
function buildSummary(entry: RingEntry): { message: string; itemType: string } | null {
  if (entry.type !== "item.completed") return null;
  const item = itemRecord(entry.raw), itemType = stringField(item, ["type", "item_type", "name", "tool_name"]) ?? "item";
  const body = collapse(extractText(item) ?? extractText(asRecord(entry.raw.msg)) ?? "completed");
  return { itemType, message: truncate(`[${itemType}] ${body}`, 120) };
}
function itemRecord(record: JsonRecord): JsonRecord { const msg = asRecord(record.msg); return asRecord(msg?.item) ?? asRecord(record.item) ?? msg ?? record; }
function stringField(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) { const value = record[key]; if (typeof value === "string" && value.length > 0) return value; }
  return null;
}
function extractText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).filter((part: string | null): part is string => Boolean(part)).join(" ");
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["text", "summary", "content", "command", "cmd", "name", "tool_name"]) { const found = extractText(record[key]); if (found) return found; }
  return JSON.stringify(record);
}
function collapse(text: string): string { return text.replace(/\s+/g, " ").trim() || "completed"; }
function truncate(text: string, limit: number): string { return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 3))}...`; }
async function sendNotify(url: string, body: JsonRecord): Promise<void> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), PULSE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, voice_enabled: false }), signal: controller.signal });
    if (!response.ok) console.error(`ForgeProgress: Pulse notify failed with HTTP ${response.status}`);
  } catch (error: unknown) { console.error(`ForgeProgress: Pulse notify failed: ${String(error)}`); }
  finally { clearTimeout(timer); }
}
function wireTimeout(child: ChildProcessWithoutNullStreams, state: RunState, args: Args, cleanupPoller: () => void): TimeoutControl {
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const timeoutTimer = setTimeout(() => {
    state.timedOut = true; cleanupPoller(); sendChildSignal(child, "SIGTERM", "timeout");
    killTimer = setTimeout(() => { if (state.childAlive) sendChildSignal(child, "SIGKILL", "timeout escalation"); }, ESCALATE_MS);
    void sendNotify(args.pulseUrl, { message: `Forge: codex timed out after ${args.timeoutMs}ms`, voice_enabled: false, agent: "Forge", slug: args.slug });
  }, args.timeoutMs);
  return {
    clearNaturalExit: () => { if (!state.timedOut) clearTimeout(timeoutTimer); if (killTimer) clearTimeout(killTimer); },
    clearAll: () => { clearTimeout(timeoutTimer); if (killTimer) clearTimeout(killTimer); },
  };
}
function wireSignals(child: ChildProcessWithoutNullStreams, state: RunState, timeoutControl: TimeoutControl, cleanupPoller: () => void): SignalControl {
  let handled = false, killTimer: ReturnType<typeof setTimeout> | undefined, hardTimer: ReturnType<typeof setTimeout> | undefined;
  const handler = (signal: NodeJS.Signals): void => {
    if (handled) return;
    handled = true; state.interrupted = true; cleanupPoller(); timeoutControl.clearAll(); sendChildSignal(child, "SIGTERM", `helper ${signal}`);
    killTimer = setTimeout(() => { if (state.childAlive) sendChildSignal(child, "SIGKILL", `helper ${signal} escalation`); }, ESCALATE_MS);
    hardTimer = setTimeout(() => { console.error(`ForgeProgress: hard exit after ${signal}; child did not reap`); process.exit(1); }, ESCALATE_MS * 2);
  };
  process.once("SIGINT", handler); process.once("SIGTERM", handler);
  return { clear: () => { process.off("SIGINT", handler); process.off("SIGTERM", handler); if (killTimer) clearTimeout(killTimer); if (hardTimer) clearTimeout(hardTimer); } };
}
function sendChildSignal(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals, context: string): void {
  if (!child.pid) { try { child.kill(signal); } catch (error: unknown) { console.error(`ForgeProgress: failed to send ${signal} during ${context}: ${String(error)}`); } return; }
  try { process.kill(-child.pid, signal); }
  catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code === "ESRCH") { console.error(`ForgeProgress: process group already exited while sending ${signal} during ${context}`); return; } // ESRCH means the group is already gone, not a signal failure.
    console.error(`ForgeProgress: failed to send ${signal} during ${context}: ${String(error)}`);
  }
}
async function waitForChild(child: ChildProcessWithoutNullStreams): Promise<ExitInfo> {
  // Bounded by the subprocess timeout and helper signal handlers.
  return await new Promise<ExitInfo>((resolve) => {
    child.once("error", (error: Error) => resolve({ code: null, signal: null, error }));
    child.once("exit", (code: number | null, signal: NodeJS.Signals | null) => resolve({ code, signal }));
  });
}
async function readFinalMessage(finalFile: string): Promise<string> {
  if (!existsSync(finalFile)) return "";
  return await readFile(finalFile, "utf8"); // Local final artifact read is intentionally unbounded.
}
function formatFinalLine(input: FinalInput): string {
  return JSON.stringify({ verdict: input.verdict, exit_code: input.exitCode, events_file: input.eventsFile, final_file: input.finalFile, duration_ms: input.durationMs, final_message: input.finalMessage });
}
export default async function main(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv), home = homeDir(), codexPath = preflightCodex(home);
    if (!codexPath) { process.stdout.write('{"verdict":"unavailable","reason":"codex CLI not found at ~/.bun/bin/codex"}\n'); return 2; }
    const prompt = await readPrompt(args.prompt);
    if (prompt.length === 0) throw new Error("no prompt provided; pass --prompt or pipe stdin data");
    const paths = await ensureSlugDir(home, args.slug), state: RunState = { startMs: Date.now(), childAlive: true, timedOut: false, interrupted: false }, ring: RingEntry[] = [];
    const child = spawnCodex(codexPath, args, paths.finalFile, prompt);
    child.stderr.pipe(process.stderr);
    const cleanupPoller = startProgressPoller(ring, args), timeoutControl = wireTimeout(child, state, args, cleanupPoller), signalControl = wireSignals(child, state, timeoutControl, cleanupPoller);
    let stdoutError: Error | null = null;
    const stdoutTask = wireStdout(child, paths.eventsFile, ring, args).catch((error: unknown) => { stdoutError = error instanceof Error ? error : new Error(String(error)); console.error(`ForgeProgress: stdout wiring failed: ${String(error)}`); sendChildSignal(child, "SIGTERM", "stdout failure"); });
    const exitInfo = await waitForChild(child);
    state.childAlive = false; timeoutControl.clearNaturalExit(); cleanupPoller(); signalControl.clear(); await stdoutTask;
    const durationMs = Date.now() - state.startMs;
    void sendNotify(args.pulseUrl, { message: `Forge: codex complete (${durationMs}ms, exit ${exitInfo.code})`, voice_enabled: false, agent: "Forge", slug: args.slug });
    if (exitInfo.error) console.error(`ForgeProgress: codex spawn failed: ${exitInfo.error.message}`);
    const finalMessage = await readFinalMessage(paths.finalFile);
    const verdict: "success" | "error" | "timeout" = state.timedOut ? "timeout" : exitInfo.code === 0 && !stdoutError && !exitInfo.error && !state.interrupted ? "success" : "error";
    const exitCode = verdict === "timeout" ? null : exitInfo.code;
    process.stdout.write(`${formatFinalLine({ verdict, exitCode, eventsFile: paths.eventsFile, finalFile: paths.finalFile, durationMs, finalMessage })}\n`);
    return verdict === "success" ? 0 : 1;
  } catch (error: unknown) { console.error(`ForgeProgress: ${String(error)}`); return 1; }
}
if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
