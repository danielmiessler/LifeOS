import { closeSync, openSync, readSync } from "fs";
import { StringDecoder } from "string_decoder";
import type { PaiHarness } from "./runtime-paths";

export type TranscriptRole = "user" | "assistant" | "tool";
export type TranscriptStatus = "ok" | "error" | "unknown";

export interface TranscriptMessage {
  role: TranscriptRole;
  content: string;
  timestamp?: string;
  sourceKind: string;
  sourceLine: number;
  toolName?: string;
  toolCallId?: string;
  status?: TranscriptStatus;
}

interface RawSessionEntry {
  timestamp?: string;
  type?: string;
  payload?: unknown;
  message?: {
    role?: string;
    content?: unknown;
  };
}

const ARGUMENT_LIMIT = 1500;
const TOOL_OUTPUT_LIMIT = 4000;
const MAX_PREVIEW_DEPTH = 4;
const MAX_PREVIEW_ITEMS = 20;
const MAX_PREVIEW_STRING = 1000;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_JSONL_LINE_CHARS = 2_000_000;
const MAX_TRANSCRIPT_MESSAGES = 20_000;
const SECRET_KEY_PATTERN = "[A-Z0-9_-]*(?:API[_-]?KEY|API[_-]?TOKEN|TOKEN|SECRET|PASSWORD|PASSWD|AUTHORIZATION|AUTH[_-]?TOKEN|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN)[A-Z0-9_-]*";

const CODEX_SKIP_KINDS = new Set([
  "session_meta/",
  "turn_context/",
  "compacted/",
  "event_msg/context_compacted",
  "event_msg/task_started",
  "event_msg/task_complete",
  "event_msg/thread_goal_updated",
  "event_msg/thread_rolled_back",
  "event_msg/token_count",
  "event_msg/turn_aborted",
  "response_item/reasoning",
]);

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function sourceKind(entry: RawSessionEntry): string {
  const payloadType = isRecord(entry.payload) && typeof entry.payload.type === "string"
    ? entry.payload.type
    : "";
  return `${entry.type || ""}/${payloadType}`;
}

function shouldSkipCodexKind(kind: string): boolean {
  return CODEX_SKIP_KINDS.has(kind) ||
    kind.includes("image_generation") ||
    kind.startsWith("event_msg/thread_goal_");
}

function redactSensitive(text: string): string {
  return text
    .replace(new RegExp(`(["'])(${SECRET_KEY_PATTERN})\\1\\s*:\\s*(["'])[^"']{4,}\\3`, "gi"), "$1$2$1:$3[REDACTED]$3")
    .replace(new RegExp(`\\b(${SECRET_KEY_PATTERN}\\s*[:=]\\s*)["']?[^\\s"']{4,}`, "gi"), "$1[REDACTED]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]");
}

function cap(text: string, limit: number): string {
  const redacted = redactSensitive(text);
  if (redacted.length <= limit) return redacted;
  return `${redacted.slice(0, limit)}\n[truncated ${redacted.length - limit} chars]`;
}

function stringify(value: unknown, limit: number): string {
  if (typeof value === "string") return cap(value, limit);
  try {
    return cap(JSON.stringify(previewValue(value, limit)), limit);
  } catch {
    return cap(String(value), limit);
  }
}

function previewValue(value: unknown, limit: number, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return cap(value, Math.min(limit, MAX_PREVIEW_STRING));
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_PREVIEW_DEPTH) return "[max-depth]";

  seen.add(value);

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, MAX_PREVIEW_ITEMS)
      .map((item) => previewValue(item, limit, depth + 1, seen));
    if (value.length > MAX_PREVIEW_ITEMS) {
      preview.push(`[truncated ${value.length - MAX_PREVIEW_ITEMS} items]`);
    }
    return preview;
  }

  const entries = Object.entries(value);
  const preview: Record<string, unknown> = {};
  for (const [key, item] of entries.slice(0, MAX_PREVIEW_ITEMS)) {
    preview[key] = previewValue(item, limit, depth + 1, seen);
  }
  if (entries.length > MAX_PREVIEW_ITEMS) {
    preview.__truncated_keys = entries.length - MAX_PREVIEW_ITEMS;
  }
  return preview;
}

export function extractTranscriptText(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .filter((item) => (
        isRecord(item) &&
        (item.type === "text" || item.type === "input_text" || item.type === "output_text") &&
        typeof item.text === "string"
      ))
      .map((item) => item.text)
      .join("\n");
  }

  return "";
}

function compactToolCall(name: string, args: unknown): string {
  const argsText = args === undefined ? "" : stringify(args, ARGUMENT_LIMIT);
  return argsText
    ? `Tool call: ${name}\nArguments: ${argsText}`
    : `Tool call: ${name}`;
}

function looksLikeError(text: string): boolean {
  return /(?:^|\b)(?:error|failed|exception|stderr|permission denied|not found|exit [1-9]\d*)(?:\b|:)/i.test(text);
}

function statusFromPayload(payload: Record<string, any>, content = ""): TranscriptStatus {
  if (payload.status === "failed" || payload.status === "error" || payload.success === false) return "error";
  if (payload.status === "completed" || payload.status === "success" || payload.success === true) return "ok";
  if (content && looksLikeError(content)) return "error";
  return "unknown";
}

function codexUserText(payload: Record<string, any>): string {
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.text_elements)) {
    return payload.text_elements
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item) && typeof item.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function projectClaudeEntry(entry: RawSessionEntry, sourceLine: number): TranscriptMessage | undefined {
  const role = entry.message?.role || entry.type;
  if (role !== "user" && role !== "assistant") return undefined;

  const content = extractTranscriptText(entry.message?.content).trim();
  if (!content) return undefined;

  return {
    role,
    content,
    timestamp: entry.timestamp,
    sourceKind: "claude/message",
    sourceLine,
  };
}

function projectPatch(payload: Record<string, any>, kind: string, sourceLine: number, timestamp?: string): TranscriptMessage {
  const changes = Array.isArray(payload.changes)
    ? payload.changes.map((change) => {
      if (!isRecord(change)) return String(change);
      const path = typeof change.path === "string" ? change.path : "unknown";
      const changeKind = typeof change.kind === "string" ? change.kind : "change";
      return `${changeKind}:${path}`;
    })
    : [];
  const output = [payload.stdout, payload.stderr]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
  const status = statusFromPayload(payload, output);
  const content = [
    `Tool result: apply_patch status=${payload.status ?? status}`,
    changes.length > 0 ? `Changes: ${changes.join(", ")}` : "",
    output ? cap(output, TOOL_OUTPUT_LIMIT) : "",
  ].filter(Boolean).join("\n");

  return {
    role: "tool",
    content,
    timestamp,
    sourceKind: kind,
    sourceLine,
    toolName: "apply_patch",
    toolCallId: typeof payload.call_id === "string" ? payload.call_id : undefined,
    status,
  };
}

function mcpToolName(payload: Record<string, any>): string {
  const invocation = isRecord(payload.invocation) ? payload.invocation : {};
  const server = typeof invocation.server === "string" ? invocation.server : "mcp";
  const tool = typeof invocation.tool === "string" ? invocation.tool : "tool";
  return `mcp.${server}.${tool}`;
}

function projectMcpToolCallEnd(payload: Record<string, any>, kind: string, sourceLine: number, timestamp?: string): TranscriptMessage {
  const toolName = mcpToolName(payload);
  const invocation = isRecord(payload.invocation) ? payload.invocation : {};
  const result = isRecord(payload.result) ? payload.result : {};
  const ok = isRecord(result.Ok) ? result.Ok : undefined;
  const err = result.Err ?? result.Error ?? result.error;
  const status: TranscriptStatus = err || ok?.isError === true ? "error" : ok ? "ok" : "unknown";

  let resultText = "";
  if (ok && Array.isArray(ok.content)) {
    resultText = ok.content
      .map((item) => mcpContentText(item))
      .filter(Boolean)
      .join("\n");
  } else if (err) {
    resultText = stringify(err, TOOL_OUTPUT_LIMIT);
  } else {
    resultText = stringify(result, TOOL_OUTPUT_LIMIT);
  }

  const args = invocation.arguments === undefined ? "" : stringify(invocation.arguments, ARGUMENT_LIMIT);
  const content = [
    `Tool result: ${toolName}`,
    args ? `Arguments: ${args}` : "",
    resultText ? cap(resultText, TOOL_OUTPUT_LIMIT) : "",
  ].filter(Boolean).join("\n");

  return {
    role: "tool",
    content,
    timestamp,
    sourceKind: kind,
    sourceLine,
    toolName,
    toolCallId: typeof payload.call_id === "string" ? payload.call_id : undefined,
    status,
  };
}

function mcpContentText(item: unknown): string {
  if (!isRecord(item)) return stringify(item, TOOL_OUTPUT_LIMIT);
  const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
  if (/(?:image|audio|video|binary|file)/.test(type)) return "";
  if ("data" in item || "blob" in item || "base64" in item) return "";
  if (typeof item.text === "string") return item.text;
  return stringify(item, TOOL_OUTPUT_LIMIT);
}

function projectCodexEntry(
  entry: RawSessionEntry,
  sourceLine: number,
  toolCallNames: Map<string, string>,
): TranscriptMessage | undefined {
  const kind = sourceKind(entry);
  if (shouldSkipCodexKind(kind)) return undefined;
  if (!isRecord(entry.payload)) return undefined;

  const payload = entry.payload;

  if (kind === "event_msg/user_message") {
    const content = codexUserText(payload).trim();
    return content ? {
      role: "user",
      content,
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
    } : undefined;
  }

  if (kind === "event_msg/agent_message") {
    const content = typeof payload.message === "string" ? payload.message.trim() : "";
    return content ? {
      role: "assistant",
      content,
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
    } : undefined;
  }

  if (kind === "response_item/message") {
    const role = payload.role;
    if (role !== "user" && role !== "assistant") return undefined;
    const content = extractTranscriptText(payload.content).trim();
    return content ? {
      role,
      content,
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
    } : undefined;
  }

  if (
    kind === "response_item/function_call" ||
    kind === "response_item/custom_tool_call" ||
    kind === "response_item/tool_search_call" ||
    kind === "response_item/web_search_call"
  ) {
    const callId = typeof payload.call_id === "string"
      ? payload.call_id
      : typeof payload.id === "string" ? payload.id : undefined;
    const name = typeof payload.name === "string"
      ? payload.name
      : kind === "response_item/web_search_call" ? "web_search" : "tool";
    if (callId) toolCallNames.set(callId, name);
    return {
      role: "tool",
      content: compactToolCall(name, payload.arguments ?? payload.input ?? payload.action),
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
      toolName: name,
      toolCallId: callId,
      status: statusFromPayload(payload),
    };
  }

  if (
    kind === "response_item/function_call_output" ||
    kind === "response_item/custom_tool_call_output" ||
    kind === "response_item/tool_search_output"
  ) {
    const callId = typeof payload.call_id === "string" ? payload.call_id : undefined;
    const name = callId ? toolCallNames.get(callId) ?? "tool" : "tool";
    const output = stringify(payload.output ?? payload.tools ?? payload.execution ?? payload, TOOL_OUTPUT_LIMIT);
    const status = statusFromPayload(payload, output);
    return {
      role: "tool",
      content: `Tool result: ${name}\n${output}`,
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
      toolName: name,
      toolCallId: callId,
      status,
    };
  }

  if (kind === "event_msg/patch_apply_end") {
    return projectPatch(payload, kind, sourceLine, entry.timestamp);
  }

  if (kind === "event_msg/mcp_tool_call_end") {
    return projectMcpToolCallEnd(payload, kind, sourceLine, entry.timestamp);
  }

  if (kind === "event_msg/web_search_end") {
    const query = typeof payload.query === "string" ? payload.query : "";
    const action = stringify(payload.action, ARGUMENT_LIMIT);
    return {
      role: "tool",
      content: [`Tool result: web_search`, query ? `Query: ${query}` : "", action ? `Action: ${action}` : ""].filter(Boolean).join("\n"),
      timestamp: entry.timestamp,
      sourceKind: kind,
      sourceLine,
      toolName: "web_search",
      toolCallId: typeof payload.call_id === "string" ? payload.call_id : undefined,
      status: statusFromPayload(payload),
    };
  }

  return undefined;
}

function pushTranscriptMessage(
  messages: TranscriptMessage[],
  message: TranscriptMessage,
  overflow: { count: number },
): void {
  const redacted = { ...message, content: redactSensitive(message.content) };
  if (messages.length < MAX_TRANSCRIPT_MESSAGES) {
    messages.push(redacted);
    return;
  }

  messages[overflow.count % MAX_TRANSCRIPT_MESSAGES] = redacted;
  overflow.count++;
}

function orderedMessages(messages: TranscriptMessage[], overflow: { count: number }): TranscriptMessage[] {
  if (overflow.count === 0 || messages.length < MAX_TRANSCRIPT_MESSAGES) return messages;
  const start = overflow.count % MAX_TRANSCRIPT_MESSAGES;
  return messages.slice(start).concat(messages.slice(0, start));
}

export function readTranscriptMessages(sessionPath: string, harness: PaiHarness): TranscriptMessage[] {
  const fd = openSync(sessionPath, "r");
  const decoder = new StringDecoder("utf8");
  const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
  const messages: TranscriptMessage[] = [];
  const overflow = { count: 0 };
  const toolCallNames = new Map<string, string>();
  let pending = "";
  let sourceLine = 0;
  let skippingLongLine = false;

  const projectLine = (line: string) => {
    sourceLine++;
    const trimmed = line.trim();
    if (!trimmed || skippingLongLine) {
      skippingLongLine = false;
      return;
    }

    if (trimmed.length > MAX_JSONL_LINE_CHARS) return;

    try {
      const entry = JSON.parse(trimmed) as RawSessionEntry;
      const message = harness === "codex"
        ? projectCodexEntry(entry, sourceLine, toolCallNames)
        : projectClaudeEntry(entry, sourceLine);
      if (message) pushTranscriptMessage(messages, message, overflow);
    } catch {
      // Skip malformed lines. Session logs are append-only and can contain partial records.
    }
  };

  try {
    let bytesRead = 0;
    while ((bytesRead = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      pending += decoder.write(buffer.subarray(0, bytesRead));

      let newlineIndex = pending.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = pending.slice(0, newlineIndex);
        pending = pending.slice(newlineIndex + 1);
        projectLine(line);
        newlineIndex = pending.indexOf("\n");
      }

      if (pending.length > MAX_JSONL_LINE_CHARS) {
        pending = "";
        skippingLongLine = true;
      }
    }

    pending += decoder.end();
    if (pending) projectLine(pending);
  } finally {
    closeSync(fd);
  }

  return orderedMessages(messages, overflow);
}
