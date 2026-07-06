/**
 * Pulse Syslog Module
 *
 * UDP syslog listener for UniFi debug logs. Bound to an unprivileged port (5514)
 * and writing structured JSONL to MEMORY/OBSERVABILITY/unifi-syslog.jsonl.
 *
 * Parses RFC3164 and CEF frames. Extracts severity, timestamp, host, tag, msg.
 * Registered in PULSE.toml under [modules.syslog].
 *
 * Request routes:
 *   GET /api/syslog/status           → ingest state + ring buffer metrics
 *   GET /api/syslog/tail?n=50        → last N raw lines
 */

import { createSocket, type Socket } from "dgram"
import { appendFileSync, mkdirSync, existsSync, statSync, readFileSync } from "fs"
import { dirname, join } from "path"
import { getLifeosDir } from "../../TOOLS/Paths";

const HOME = process.env.HOME ?? ""
const MODULE_NAME = "syslog"
const DEFAULT_PORT = 5514
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB rotation threshold

const LOG_PATH = join(
  getLifeosDir(),
  "MEMORY",
  "OBSERVABILITY",
  "unifi-syslog.jsonl",
)

type Severity = "emerg" | "alert" | "crit" | "err" | "warn" | "notice" | "info" | "debug"

const SEVERITY_NAMES: Severity[] = [
  "emerg", "alert", "crit", "err", "warn", "notice", "info", "debug",
]

interface ParsedMessage {
  ts: string
  source: string
  severity: Severity
  facility: number
  host?: string
  tag?: string
  msg: string
  raw: string
  format: "rfc3164" | "cef" | "unknown"
}

interface ModuleState {
  running: boolean
  startedAt: Date | null
  socket: Socket | null
  port: number
  messagesReceived: number
  lastMessageAt: Date | null
  lastSender: string | null
  parseFailures: number
}

const state: ModuleState = {
  running: false,
  startedAt: null,
  socket: null,
  port: DEFAULT_PORT,
  messagesReceived: 0,
  lastMessageAt: null,
  lastSender: null,
  parseFailures: 0,
}

const parseRfc3164 = (raw: string): ParsedMessage | null => {
  // <PRI>TIMESTAMP HOST TAG: MSG
  const m = raw.match(/^<(\d{1,3})>([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s*(.*)$/s)
  if (!m) return null
  const pri = Number(m[1])
  const facility = pri >> 3
  const severity = SEVERITY_NAMES[pri & 7] ?? "info"
  return {
    ts: new Date().toISOString(),
    source: "udp:5514",
    severity,
    facility,
    host: m[3],
    tag: m[4]?.trim(),
    msg: m[5]?.trim() ?? "",
    raw,
    format: "rfc3164",
  }
}

const parseCef = (raw: string): ParsedMessage | null => {
  // CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
  const idx = raw.indexOf("CEF:")
  if (idx < 0) return null
  const rest = raw.slice(idx)
  const parts = rest.split("|")
  if (parts.length < 7) return null
  const severityNum = Number(parts[6] ?? "6")
  const severity: Severity =
    severityNum >= 9 ? "crit" :
    severityNum >= 7 ? "err" :
    severityNum >= 5 ? "warn" :
    severityNum >= 3 ? "notice" : "info"
  return {
    ts: new Date().toISOString(),
    source: "udp:5514",
    severity,
    facility: 0,
    tag: `${parts[1]}/${parts[2]}`,
    msg: parts[5] ?? "",
    raw,
    format: "cef",
  }
}

const parse = (raw: string): ParsedMessage => {
  const cef = parseCef(raw)
  if (cef) return cef
  const rfc = parseRfc3164(raw)
  if (rfc) return rfc
  return {
    ts: new Date().toISOString(),
    source: "udp:5514",
    severity: "info",
    facility: 0,
    msg: raw.trim(),
    raw,
    format: "unknown",
  }
}

const rotateIfNeeded = (): void => {
  if (!existsSync(LOG_PATH)) return
  try {
    const s = statSync(LOG_PATH)
    if (s.size < MAX_FILE_SIZE) return
    const rotated = LOG_PATH + "." + new Date().toISOString().slice(0, 10)
    require("fs").renameSync(LOG_PATH, rotated)
  } catch {
    // best-effort — rotation failure should not kill ingest
  }
}

export async function start(): Promise<void> {
  console.log(`[${MODULE_NAME}] Starting...`)
  const portFromEnv = process.env.PULSE_SYSLOG_PORT
  if (portFromEnv) state.port = Number(portFromEnv)

  mkdirSync(dirname(LOG_PATH), { recursive: true })

  const socket = createSocket("udp4")

  socket.on("error", (err) => {
    console.error(`[${MODULE_NAME}] socket error: ${err.message}`)
  })

  socket.on("message", (buf, rinfo) => {
    try {
      const raw = buf.toString("utf-8")
      const parsed = parse(raw)
      rotateIfNeeded()
      appendFileSync(LOG_PATH, JSON.stringify({ ...parsed, sender: rinfo.address }) + "\n")
      state.messagesReceived++
      state.lastMessageAt = new Date()
      state.lastSender = rinfo.address
    } catch {
      state.parseFailures++
    }
  })

  await new Promise<void>((resolve, reject) => {
    socket.once("listening", resolve)
    socket.once("error", reject)
    socket.bind(state.port, "0.0.0.0")
  })

  state.socket = socket
  state.running = true
  state.startedAt = new Date()
  console.log(`[${MODULE_NAME}] Listening on UDP:${state.port} → ${LOG_PATH}`)
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE_NAME}] Stopping...`)
  state.running = false
  if (state.socket) {
    await new Promise<void>((resolve) => state.socket!.close(() => resolve()))
    state.socket = null
  }
  console.log(`[${MODULE_NAME}] Stopped`)
}

export function health(): { status: string; details?: Record<string, unknown> } {
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      port: state.port,
      uptime: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
      messages_received: state.messagesReceived,
      parse_failures: state.parseFailures,
      last_message_at: state.lastMessageAt?.toISOString() ?? null,
      last_sender: state.lastSender,
      log_file: LOG_PATH,
      log_file_exists: existsSync(LOG_PATH),
    },
  }
}

const tailFile = (n: number): string[] => {
  if (!existsSync(LOG_PATH)) return []
  const raw = readFileSync(LOG_PATH, "utf-8")
  return raw.split("\n").filter(Boolean).slice(-n)
}

export async function handleRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (path === "/status" || path === "") {
    return Response.json(health())
  }
  if (path.startsWith("/tail")) {
    const n = Number((body.n as string | undefined) ?? 50)
    return Response.json({ lines: tailFile(n) })
  }
  return Response.json({ error: "Not found" }, { status: 404 })
}
