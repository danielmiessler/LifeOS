#!/usr/bin/env bun
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

type Args = { slug: string; prompt?: string; model: string; timeoutMs: number; temperature: number; maxTokens: number };
type JsonRecord = Record<string, unknown>;
type Paths = { eventsFile: string; finalFile: string };
type RunState = { timedOut: boolean; interrupted: boolean };
type TimeoutControl = { clear: () => void };
type SignalControl = { clear: () => void };
type RunResult = { verdict: "success"; accumulated: string } | { verdict: "error" | "timeout"; accumulated: string; reason: string };
type FinalInput = { verdict: "success" | "error" | "timeout"; exitCode: number | null; eventsFile: string; finalFile: string; durationMs: number; finalMessage: string; reason?: string };
const HTTP_ERROR_BODY_TIMEOUT_MS = 2000;
function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { model: "kimi-k2.6", timeoutMs: 300000, temperature: 1, maxTokens: 16000 };
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
      case "--timeout-ms": args.timeoutMs = positiveInt(flag, value); break;
      case "--temperature": args.temperature = nonNegativeNumber(flag, value); break;
      case "--max-tokens": args.maxTokens = positiveInt(flag, value); break;
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
function nonNegativeNumber(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative finite number`);
  return parsed;
}
function homeDir(): string { const home = process.env.HOME; if (!home) throw new Error("HOME is not set"); return home; }
async function ensureSlugDir(home: string, slug: string): Promise<Paths> {
  const slugDir = join(home, ".claude", "PAI", "MEMORY", "WORK", slug);
  await mkdir(slugDir, { recursive: true }); // Local artifact I/O is unbounded so errors can surface naturally.
  return { eventsFile: join(slugDir, "anvil-events.jsonl"), finalFile: join(slugDir, "anvil-final.txt") };
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
async function readMoonshotApiKey(home: string): Promise<string | null> {
  const envKey = process.env.MOONSHOT_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) return envKey.trim();
  try { return parseMoonshotApiKey(await readFile(join(home, ".claude", ".env"), "utf8")); } // Local env read is intentionally unbounded.
  catch (error: unknown) {
    if (errorCode(error) === "ENOENT") return null;
    throw new Error(`failed to read Moonshot env file: ${errorMessage(error)}`);
  }
}
function parseMoonshotApiKey(text: string): string | null {
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimStart();
    if (!line.startsWith("MOONSHOT_API_KEY=")) continue;
    const rawValue = line.slice("MOONSHOT_API_KEY=".length).replace(/[ \t\r]+$/g, "");
    const value = unquote(rawValue);
    if (value.length > 0) return value;
  }
  return null;
}
function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}
async function writeLine(stream: WriteStream, line: string): Promise<void> {
  if (stream.write(line)) return; // Local log I/O is unbounded because it is the durable audit trail.
  await new Promise<void>((resolve, reject) => { stream.once("drain", resolve); stream.once("error", reject); });
}
async function endStream(stream: WriteStream): Promise<void> {
  await new Promise<void>((resolve, reject) => { stream.once("error", reject); stream.end(resolve); });
}
async function writeFinal(finalFile: string, finalMessage: string): Promise<void> {
  await writeFile(finalFile, finalMessage, "utf8"); // Local final artifact write is intentionally unbounded.
}
function asRecord(value: unknown): JsonRecord | null { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null; }
function errorCode(error: unknown): string | null {
  const record = asRecord(error);
  return record && typeof record.code === "string" ? record.code : null;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function isAbortError(error: unknown): boolean {
  const record = asRecord(error);
  return error instanceof DOMException && error.name === "AbortError" || error instanceof Error && error.name === "AbortError" || record?.name === "AbortError";
}
function truncate(text: string, limit: number): string { return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 3))}...`; }
function collapse(text: string): string { return text.replace(/\s+/g, " ").trim(); }
function tailCollapsed(text: string, limit: number): string {
  const cleaned = collapse(text);
  return cleaned.length <= limit ? cleaned : cleaned.slice(cleaned.length - limit);
}
function reportProgress(message: string): void {
  // Text progress to stderr. Voice/Pulse emission was removed; the durable
  // progress record is the JSONL events file and the final stdout line.
  console.error(`AnvilProgress: ${message}`);
}
function startProgressPoller(accumulated: () => string): () => void {
  let lastMessage = "", cleaned = false;
  const timer = setInterval(() => {
    try {
      const message = `[kimi-stream] ${tailCollapsed(accumulated(), 120)}`;
      if (message === lastMessage) return;
      lastMessage = message;
      reportProgress(message);
    } catch (error: unknown) { console.error(`AnvilProgress: progress poller failed: ${String(error)}`); }
  }, 8000);
  return () => { if (cleaned) return; cleaned = true; clearInterval(timer); };
}
function wireTimeout(controller: AbortController, state: RunState, args: Args): TimeoutControl {
  const timer = setTimeout(() => {
    state.timedOut = true; controller.abort();
    reportProgress(`Anvil: Moonshot timed out after ${args.timeoutMs}ms`);
  }, args.timeoutMs);
  return { clear: () => clearTimeout(timer) };
}
function wireSignals(controller: AbortController, state: RunState, timeoutControl: TimeoutControl): SignalControl {
  let handled = false;
  const handler = (_signal: NodeJS.Signals): void => {
    if (handled) return;
    handled = true; state.interrupted = true; timeoutControl.clear(); controller.abort();
  };
  process.once("SIGINT", handler); process.once("SIGTERM", handler);
  return { clear: () => { process.off("SIGINT", handler); process.off("SIGTERM", handler); } };
}
async function postMoonshot(apiKey: string, args: Args, prompt: string, signal: AbortSignal): Promise<Response> {
  const body: JsonRecord = { model: args.model, messages: [{ role: "user", content: prompt }], stream: true, temperature: args.temperature, max_tokens: args.maxTokens };
  return await fetch("https://api.moonshot.ai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
}
async function readWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([reader.read(), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function cancelWithTimeout(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([reader.cancel(), new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function readResponseBodyText(response: Response, timeoutMs: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await readWithTimeout(reader, Math.max(1, deadline - Date.now()));
    if (result === null) { await cancelWithTimeout(reader, 500); return truncate(text, 500); }
    if (result.done) return truncate(text + decoder.decode(), 500);
    if (text.length < 500) text += decoder.decode(result.value, { stream: true }).slice(0, 500 - text.length);
  }
  await cancelWithTimeout(reader, 500);
  return truncate(text, 500);
}
function nextBoundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf("\n\n"), crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return null;
  if (lf === -1) return { index: crlf, length: 4 };
  if (crlf === -1) return { index: lf, length: 2 };
  return crlf < lf ? { index: crlf, length: 4 } : { index: lf, length: 2 };
}
async function consumeSseEvent(event: string, writer: WriteStream, append: (content: string) => void): Promise<boolean> {
  let sawDone = false;
  for (const line of event.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") { sawDone = true; break; }
    const parsed = parseSsePayload(payload);
    await writeLine(writer, `${JSON.stringify(parsed)}\n`);
    const content = choiceDeltaContent(parsed);
    if (content) append(content);
  }
  return sawDone;
}
async function drainSseBuffer(buffer: string, writer: WriteStream, append: (content: string) => void): Promise<{ buffer: string; sawDone: boolean }> {
  let remaining = buffer;
  while (true) {
    const boundary = nextBoundary(remaining);
    if (!boundary) return { buffer: remaining, sawDone: false };
    const event = remaining.slice(0, boundary.index);
    remaining = remaining.slice(boundary.index + boundary.length);
    if (await consumeSseEvent(event, writer, append)) return { buffer: remaining, sawDone: true };
  }
}
function parseSsePayload(payload: string): unknown {
  try { return JSON.parse(payload) as unknown; }
  catch (error: unknown) { throw new Error(`invalid SSE JSON payload: ${truncate(payload, 200)} (${errorMessage(error)})`); }
}
function choiceDeltaContent(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;
  const choices = record.choices;
  if (!Array.isArray(choices)) return null;
  const choice = choices.length > 0 ? asRecord(choices[0]) : null;
  if (!choice) return null;
  const delta = asRecord(choice.delta);
  if (!delta) return null;
  const content = delta.content;
  return typeof content === "string" && content.length > 0 ? content : null;
}
async function streamSse(body: ReadableStream<Uint8Array>, writer: WriteStream, append: (content: string) => void): Promise<boolean> {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = "", sawDone = false;
  // Bounded by the request AbortController timeout, helper signal handling, or remote stream end.
  while (!sawDone) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    const drained = await drainSseBuffer(buffer, writer, append);
    buffer = drained.buffer; sawDone = drained.sawDone;
  }
  buffer += decoder.decode();
  if (!sawDone && buffer.trim().length > 0) sawDone = await consumeSseEvent(buffer, writer, append);
  return sawDone;
}
async function runMoonshot(args: Args, paths: Paths, apiKey: string, prompt: string): Promise<RunResult> {
  const state: RunState = { timedOut: false, interrupted: false }, controller = new AbortController(), writer = createWriteStream(paths.eventsFile, { flags: "a" });
  const timeoutControl = wireTimeout(controller, state, args), signalControl = wireSignals(controller, state, timeoutControl);
  let accumulated = "", stage: "fetch" | "stream" = "fetch";
  const cleanupPoller = startProgressPoller(() => accumulated);
  try {
    const response = await postMoonshot(apiKey, args, prompt, controller.signal);
    if (!response.ok) { timeoutControl.clear(); cleanupPoller(); return { verdict: "error", accumulated, reason: `HTTP ${response.status} ${await readResponseBodyText(response, HTTP_ERROR_BODY_TIMEOUT_MS)}` }; }
    if (!response.body) return { verdict: "error", accumulated, reason: "Moonshot response body missing" };
    stage = "stream";
    const sawDone = await streamSse(response.body, writer, (content: string) => { accumulated += content; });
    if (state.timedOut) return { verdict: "timeout", accumulated, reason: `timed out after ${args.timeoutMs}ms` };
    if (state.interrupted) return { verdict: "error", accumulated, reason: "stream aborted: interrupted" };
    if (sawDone || accumulated.length > 0) return { verdict: "success", accumulated };
    return { verdict: "error", accumulated, reason: "stream ended without content" };
  } catch (error: unknown) {
    if (state.timedOut) return { verdict: "timeout", accumulated, reason: `timed out after ${args.timeoutMs}ms` };
    if (state.interrupted) return { verdict: "error", accumulated, reason: `${stage === "stream" ? "stream" : "request"} aborted: interrupted` };
    const message = errorMessage(error);
    if (stage === "stream" || isAbortError(error)) return { verdict: "error", accumulated, reason: `stream aborted: ${message}` };
    return { verdict: "error", accumulated, reason: message };
  } finally {
    timeoutControl.clear(); cleanupPoller(); signalControl.clear(); await endStream(writer);
  }
}
function formatFinalLine(input: FinalInput): string {
  const base: JsonRecord = { verdict: input.verdict, exit_code: input.exitCode, events_file: input.eventsFile, final_file: input.finalFile, duration_ms: input.durationMs, final_message: input.finalMessage };
  if (input.reason !== undefined) base.reason = input.reason;
  return JSON.stringify(base);
}
function emptyErrorLine(reason: string, startMs: number): string {
  return formatFinalLine({ verdict: "error", exitCode: 1, eventsFile: "", finalFile: "", durationMs: Date.now() - startMs, finalMessage: "", reason });
}
export default async function main(argv: string[]): Promise<number> {
  const startMs = Date.now();
  let paths: Paths | null = null, finalMessage = "";
  try {
    const args = parseArgs(argv), home = homeDir(), apiKey = await readMoonshotApiKey(home);
    if (!apiKey) { process.stdout.write('{"verdict":"unavailable","reason":"MOONSHOT_API_KEY not set"}\n'); return 2; }
    paths = await ensureSlugDir(home, args.slug);
    const prompt = await readPrompt(args.prompt);
    if (prompt.length === 0) throw new Error("no prompt provided; pass --prompt or pipe stdin data");
    const result = await runMoonshot(args, paths, apiKey, prompt);
    finalMessage = result.accumulated; await writeFinal(paths.finalFile, finalMessage);
    const durationMs = Date.now() - startMs, exitCode = result.verdict === "timeout" ? null : result.verdict === "success" ? 0 : 1;
    process.stdout.write(`${formatFinalLine({ verdict: result.verdict, exitCode, eventsFile: paths.eventsFile, finalFile: paths.finalFile, durationMs, finalMessage, reason: result.verdict === "success" ? undefined : result.reason })}\n`);
    return result.verdict === "success" ? 0 : 1;
  } catch (error: unknown) {
    const reason = errorMessage(error);
    console.error(`AnvilProgress: ${reason}`);
    if (paths) {
      try { await writeFinal(paths.finalFile, finalMessage); } catch (writeError: unknown) { console.error(`AnvilProgress: failed to write final artifact after error: ${String(writeError)}`); }
      process.stdout.write(`${formatFinalLine({ verdict: "error", exitCode: 1, eventsFile: paths.eventsFile, finalFile: paths.finalFile, durationMs: Date.now() - startMs, finalMessage, reason })}\n`);
    } else process.stdout.write(`${emptyErrorLine(reason, startMs)}\n`);
    return 1;
  }
}
if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
