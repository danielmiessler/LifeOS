/**
 * Menu Bar aggregator module — the single payload behind the rich Pulse menu bar.
 *
 * Serves ONE route:
 *   GET /api/menubar → { generatedAt, daemon, counts, feed[] }
 *
 * It stitches a cross-subsystem view for the native Swift menu bar app so the dropdown
 * can show per-subsystem counts + a chronological activity feed WITHOUT the Swift app
 * having to know about every subsystem's storage. Every subsystem read is best-effort:
 * a failing source degrades its own section to empty and NEVER throws to the caller
 * (ISC-13). Amber is cloud-D1 and reached via a cached, timeout-bounded proxy (ISC-4);
 * its base URL comes from AMBER_LEDGER_URL (never hardcoded in this SYSTEM file).
 *
 * Read-only. No capture, no mutation. Register in pulse.ts like the conduit module.
 */
import { existsSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "menubar"
const state = { running: false, startedAt: null as Date | null }

const CLAUDE = join(claudeDir())
const LIFEOS = join(CLAUDE, "LIFEOS")
const OBS = join(LIFEOS, "MEMORY", "OBSERVABILITY")
const STATE_DIR = join(LIFEOS, "PULSE", "state")
const WORK_JSON = join(LIFEOS, "MEMORY", "STATE", "work.json")

// ---------- types ----------

interface FeedItem {
  subsystem: string
  glyph: string
  title: string
  tsMs: number
  ago: string
  actionable: boolean
}

interface MenuBarPayload {
  generatedAt: string
  daemon: { status: string; label: string; uptimeSec: number; failingJobs: number; jobCount: number }
  counts: { amber: number; conduitMinutes: number; memory: number; memoryPending: number; work: number }
  feed: FeedItem[]
}

// ---------- helpers ----------

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function agoFrom(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** Read the last `n` lines of a text file, capping the read at 512KB so giant logs stay cheap. */
function tailLines(path: string, n: number): string[] {
  try {
    if (!existsSync(path)) return []
    const size = statSync(path).size
    const cap = 512 * 1024
    const buf = readFileSync(path)
    const text = size > cap ? buf.subarray(size - cap).toString("utf8") : buf.toString("utf8")
    const lines = text.split("\n").filter((l) => l.trim())
    return lines.slice(-n)
  } catch {
    return []
  }
}

/** Count JSONL lines whose ISO `ts`/`timestamp` field is within the last `hours`. Bounded read. */
function countRecent(path: string, hours: number): number {
  const cutoff = Date.now() - hours * 3600 * 1000
  let count = 0
  for (const line of tailLines(path, 5000)) {
    try {
      const o = JSON.parse(line)
      const t = o.ts || o.timestamp || o.time
      if (t && new Date(t).getTime() >= cutoff) count++
    } catch {
      /* skip */
    }
  }
  return count
}

// ---------- daemon (state.json) ----------

function fmtUptime(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function daemonBlock(): MenuBarPayload["daemon"] {
  const statePath = join(STATE_DIR, "state.json")
  const pidPath = join(STATE_DIR, "pulse.pid")
  try {
    if (!existsSync(statePath)) return { status: "stopped", label: "Stopped", uptimeSec: 0, failingJobs: 0, jobCount: 0 }
    const st = JSON.parse(readFileSync(statePath, "utf8"))
    const jobs = st.jobs || {}
    const jobCount = Object.keys(jobs).length
    const failingJobs = Object.values(jobs).filter((j: any) => (j?.consecutiveFailures ?? 0) >= 3).length
    const fileAgeSec = (Date.now() - statSync(statePath).mtimeMs) / 1000

    let alive = false
    try {
      const pid = Number(readFileSync(pidPath, "utf8").trim())
      if (pid > 0) {
        process.kill(pid, 0)
        alive = true
      }
    } catch {
      /* not alive */
    }

    if (!alive && fileAgeSec > 120) return { status: "stopped", label: "Stopped", uptimeSec: 0, failingJobs, jobCount }
    if (failingJobs > 0)
      return { status: "failing", label: `Failing — ${failingJobs} job${failingJobs === 1 ? "" : "s"}`, uptimeSec: 0, failingJobs, jobCount }
    if (fileAgeSec > 120) return { status: "stale", label: "Running — tick stale", uptimeSec: 0, failingJobs, jobCount }
    const uptimeSec = Math.max(0, Math.floor(Date.now() / 1000 - (st.startedAt || 0) / 1000))
    return { status: "running", label: `Running — ${fmtUptime(uptimeSec)}`, uptimeSec, failingJobs, jobCount }
  } catch {
    return { status: "stopped", label: "Stopped", uptimeSec: 0, failingJobs: 0, jobCount: 0 }
  }
}

// ---------- Amber (cloud, best-effort, cached) ----------

const AMBER_BASE = (process.env.AMBER_LEDGER_URL || "").replace(/\/$/, "")
let amberCache: { at: number; captures: any[] } = { at: 0, captures: [] }

function amberToken(): string | null {
  try {
    const cfg = join(homedir(), ".config", "arbol", "config.yaml")
    const m = readFileSync(cfg, "utf8").match(/^\s*auth_token:\s*["']?([^"'\n]+)["']?\s*$/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

async function amberCaptures(): Promise<any[]> {
  if (!AMBER_BASE) return []
  if (Date.now() - amberCache.at < 60_000) return amberCache.captures
  const token = amberToken()
  if (!token) return amberCache.captures
  try {
    const res = await fetch(`${AMBER_BASE}/captures?status=captured&limit=6`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return amberCache.captures
    const json: any = await res.json()
    const captures = Array.isArray(json.captures) ? json.captures : []
    amberCache = { at: Date.now(), captures }
    return captures
  } catch {
    return amberCache.captures // stale-but-serving; never throws
  }
}

// ---------- work.json ----------

function workBlock(): { count: number; items: FeedItem[] } {
  try {
    if (!existsSync(WORK_JSON)) return { count: 0, items: [] }
    const wj = JSON.parse(readFileSync(WORK_JSON, "utf8"))
    const sessions = Object.values(wj.sessions || {}) as any[]
    const active = sessions.filter((s) => {
      const phase = String(s.phase || "")
      if (phase === "complete" || phase === "minimal" || phase === "") return false
      const upd = new Date(s.updatedAt || s.updated || 0).getTime()
      return Date.now() - upd < 7 * 24 * 3600 * 1000 // active in last 7d
    })
    active.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    const items: FeedItem[] = active.slice(0, 3).map((s) => {
      const ts = new Date(s.updatedAt || s.updated || Date.now()).getTime()
      const name = String(s.task || s.sessionName || "work").slice(0, 40)
      return { subsystem: "work", glyph: "⚙", title: `Work: ${name} · ${s.phase}`, tsMs: ts, ago: agoFrom(ts), actionable: false }
    })
    return { count: active.length, items }
  } catch {
    return { count: 0, items: [] }
  }
}

// ---------- build payload ----------

async function buildPayload(): Promise<MenuBarPayload> {
  const feed: FeedItem[] = []

  // Amber
  let amberCount = 0
  try {
    const caps = await amberCaptures()
    const dayCut = Date.now() - 24 * 3600 * 1000
    for (const c of caps) {
      const ts = new Date(c.captured_at || c.created_at || Date.now()).getTime()
      if (ts >= dayCut) amberCount++
      const label = c.title || c.url || "(text)"
      feed.push({
        subsystem: "amber",
        glyph: "✦",
        title: `Amber captured "${String(label).slice(0, 44)}"`,
        tsMs: ts,
        ago: agoFrom(ts),
        actionable: false,
      })
    }
  } catch {
    /* amber section empty */
  }

  // Conduit — reuse the conduit module's live daily record if available
  let conduitMinutes = 0
  try {
    const conduit: any = await import("./conduit")
    const rec = typeof conduit.todayRecordPublic === "function" ? conduit.todayRecordPublic() : null
    if (rec && typeof rec.creationMinutes === "number") {
      conduitMinutes = rec.creationMinutes
      // Stable "today" stamp — a daily summary row, not a discrete event, so it must not
      // re-badge on every poll (it would never clear once seen).
      feed.push({
        subsystem: "conduit",
        glyph: "◆",
        title: `Conduit ${conduitMinutes}m creation today`,
        tsMs: startOfTodayMs(),
        ago: "today",
        actionable: false,
      })
    }
  } catch {
    /* conduit section empty */
  }

  // Memory — today's writes + pending proposals
  const memoryToday = countRecent(join(OBS, "memory-writes.jsonl"), 24) + countRecent(join(OBS, "reviewer-runs.jsonl"), 24)
  let memoryPending = 0
  let newestPendingMs = 0
  try {
    for (const line of tailLines(join(OBS, "pending-proposals.jsonl"), 2000)) {
      try {
        const o = JSON.parse(line)
        if (o.status === "pending") {
          memoryPending++
          const t = new Date(o.ts || 0).getTime()
          if (t > newestPendingMs) newestPendingMs = t
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* none */
  }
  if (memoryPending > 0) {
    // Stamp with the newest pending proposal's real time so it clears once seen and only
    // re-badges when a genuinely newer proposal arrives.
    const ts = newestPendingMs || startOfTodayMs()
    feed.push({
      subsystem: "memory",
      glyph: "✧",
      title: `${memoryPending} memory proposal${memoryPending === 1 ? "" : "s"} await you`,
      tsMs: ts,
      ago: agoFrom(ts),
      actionable: true,
    })
  }
  // recent memory writes as feed lines
  for (const line of tailLines(join(OBS, "memory-writes.jsonl"), 4)) {
    try {
      const o = JSON.parse(line)
      const ts = new Date(o.ts || o.timestamp || Date.now()).getTime()
      const what = o.target_kind || o.kind || o.target_file || "memory write"
      feed.push({ subsystem: "memory", glyph: "✧", title: `Memory wrote ${String(what).split("/").pop()}`, tsMs: ts, ago: agoFrom(ts), actionable: false })
    } catch {
      /* skip */
    }
  }

  // Work
  const work = workBlock()
  feed.push(...work.items)

  // Daemon
  const daemon = daemonBlock()
  if (daemon.failingJobs > 0) {
    // Stamp with the newest failing job's lastRun so this state row clears once seen.
    let ts = startOfTodayMs()
    try {
      const st = JSON.parse(readFileSync(join(STATE_DIR, "state.json"), "utf8"))
      for (const j of Object.values(st.jobs || {}) as any[]) {
        if ((j?.consecutiveFailures ?? 0) >= 3 && (j?.lastRun ?? 0) > ts) ts = j.lastRun
      }
    } catch {
      /* keep startOfToday */
    }
    feed.push({ subsystem: "system", glyph: "⚠", title: `${daemon.failingJobs} job${daemon.failingJobs === 1 ? "" : "s"} failing`, tsMs: ts, ago: agoFrom(ts), actionable: true })
  }

  feed.sort((a, b) => b.tsMs - a.tsMs)

  return {
    generatedAt: new Date().toISOString(),
    daemon,
    counts: { amber: amberCount, conduitMinutes, memory: memoryToday, memoryPending, work: work.count },
    feed: feed.slice(0, 20),
  }
}

// ---------- module API ----------

export async function start(): Promise<void> {
  state.running = true
  state.startedAt = new Date()
  console.log(`[${MODULE_NAME}] started`)
}

export async function stop(): Promise<void> {
  state.running = false
}

export function health(): { status: string } {
  return { status: state.running ? "healthy" : "stopped" }
}

export async function handleRequest(_req: Request, pathname: string): Promise<Response | null> {
  if (pathname === "/api/menubar" || pathname === "/api/menubar/") {
    try {
      return Response.json(await buildPayload())
    } catch (err) {
      // Absolute last-resort: never 500. Return a minimal daemon-only payload.
      return Response.json({
        generatedAt: new Date().toISOString(),
        daemon: daemonBlock(),
        counts: { amber: 0, conduitMinutes: 0, memory: 0, memoryPending: 0, work: 0 },
        feed: [],
        error: String(err),
      })
    }
  }
  return null
}
