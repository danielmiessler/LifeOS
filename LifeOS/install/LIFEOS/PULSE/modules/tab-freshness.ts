/**
 * Pulse Tab Freshness Module
 *
 * Universal per-tab data-source freshness for the Pulse dashboard. Each tab in
 * the AppHeader consumes a known set of files / directories on disk; this
 * module maps `tabId → string[]` of source paths and exposes:
 *
 *   GET /api/tab-freshness?tab=<id>
 *
 * Returns a payload shaped to match the FreshnessIndicator component's
 * `FreshnessData` interface so the existing pill UI renders without
 * transformation:
 *
 *   {
 *     tabId: "telos",
 *     dataDate: "2026-05-04",
 *     label: "TELOS context",
 *     daysOld: 0,
 *     tier: "fresh" | "aging" | "stale" | "unknown",
 *     perFile: [{ name, date, source }],
 *   }
 *
 * Tier mapping: ≤7d fresh · ≤30d aging · >30d stale · null unknown.
 *
 * Unregistered tabs return `tier: "unknown"` with HTTP 200 — never 404, so
 * the client pill stays visible across all routes.
 */

import { existsSync, statSync, readdirSync, readFileSync } from "fs"
import { join } from "path"
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME ?? "~"
const LIFEOS_DIR = join(claudeDir(), "LIFEOS")
const USER_DIR = join(LIFEOS_DIR, "USER")
const TELOS_DIR = join(USER_DIR, "TELOS")

// ── Per-tab data-source registry ──
//
// Each entry lists files (or directories) whose mtime contributes to the
// tab's freshness. Globs are expanded shallowly: a directory entry contributes
// every direct *.md file. Missing files are silently ignored — the tab can
// still render `unknown` rather than 500.

interface SourceSpec {
  /** Display name shown in tooltip (short — under 30 chars). */
  name: string
  /** Absolute path on disk. */
  path: string
  /** When `true`, expand to direct *.md children at runtime. */
  expand?: boolean
}

const REGISTRY: Record<string, SourceSpec[]> = {
  telos: [
    { name: "TELOS.md", path: join(TELOS_DIR, "TELOS.md") },
    { name: "PRINCIPAL_TELOS.md", path: join(TELOS_DIR, "PRINCIPAL_TELOS.md") },
    { name: "LIFEOS_STATE.json", path: join(TELOS_DIR, "LIFEOS_STATE.json") },
    { name: "CURRENT_STATE/", path: join(TELOS_DIR, "CURRENT_STATE"), expand: true },
    { name: "IDEAL_STATE/", path: join(TELOS_DIR, "IDEAL_STATE"), expand: true },
  ],
  work: [
    { name: "STATE/work.json", path: join(LIFEOS_DIR, "MEMORY", "STATE", "work.json") },
    { name: "WORK/config.yaml", path: join(USER_DIR, "WORK", "config.yaml") },
    { name: "PROJECTS.md", path: join(USER_DIR, "PROJECTS.md") },
  ],
  health: [
    { name: "HEALTH/", path: join(USER_DIR, "HEALTH"), expand: true },
    { name: "IDEAL_STATE/HEALTH.md", path: join(TELOS_DIR, "IDEAL_STATE", "HEALTH.md") },
  ],
  finances: [
    { name: "FINANCES/", path: join(USER_DIR, "FINANCES"), expand: true },
    { name: "IDEAL_STATE/MONEY.md", path: join(TELOS_DIR, "IDEAL_STATE", "MONEY.md") },
  ],
  business: [
    { name: "BUSINESS/", path: join(USER_DIR, "BUSINESS"), expand: true },
  ],
  local: [
    { name: "LOCAL/", path: join(USER_DIR, "LOCAL"), expand: true },
    { name: "PRINCIPAL_IDENTITY.md", path: join(USER_DIR, "PRINCIPAL", "PRINCIPAL_IDENTITY.md") },
  ],
  knowledge: [
    { name: "KNOWLEDGE/", path: join(LIFEOS_DIR, "MEMORY", "KNOWLEDGE"), expand: true },
  ],
  hooks: [
    { name: "hooks/", path: join(claudeDir(), "hooks"), expand: true },
    { name: "settings.json", path: join(claudeDir(), "settings.json") },
  ],
  skills: [
    { name: "skills/", path: join(claudeDir(), "skills"), expand: true },
  ],
  agents: [
    { name: "agents/", path: join(claudeDir(), "agents"), expand: true },
  ],
  docs: [
    { name: "DOCUMENTATION/", path: join(LIFEOS_DIR, "DOCUMENTATION"), expand: true },
  ],
  arbol: [
    { name: "USER/CUSTOMIZATIONS/ARBOL/", path: join(USER_DIR, "CUSTOMIZATIONS", "ARBOL"), expand: true },
  ],
  security: [
    { name: "USER/SECURITY/", path: join(USER_DIR, "SECURITY"), expand: true },
  ],
  performance: [
    { name: "MEMORY/OBSERVABILITY/", path: join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY"), expand: true },
  ],
  amber: [
    { name: "KNOWLEDGE/Ideas/", path: join(LIFEOS_DIR, "MEMORY", "KNOWLEDGE", "Ideas"), expand: true },
    { name: "_X/State/", path: join(claudeDir(), "skills", "_X", "State") },
  ],
  assistant: [
    { name: "DA_IDENTITY.md", path: join(USER_DIR, "DIGITAL_ASSISTANT", "DA_IDENTITY.md") },
    { name: "PRINCIPAL_IDENTITY.md", path: join(USER_DIR, "PRINCIPAL", "PRINCIPAL_IDENTITY.md") },
  ],
}

// ── Module state ──

const MODULE_NAME = "tab-freshness"

interface ModuleState {
  running: boolean
  startedAt: Date | null
  cache: Map<string, { payload: unknown; expiresAt: number }>
}

const state: ModuleState = {
  running: false,
  startedAt: null,
  cache: new Map(),
}

const CACHE_TTL_MS = 60_000

// ── Helpers ──

interface ResolvedSource {
  name: string
  path: string
  exists: boolean
  mtime: Date | null
}

function resolveSpec(spec: SourceSpec): ResolvedSource[] {
  if (!existsSync(spec.path)) {
    return [{ name: spec.name, path: spec.path, exists: false, mtime: null }]
  }
  const stat = statSync(spec.path)
  if (spec.expand && stat.isDirectory()) {
    const out: ResolvedSource[] = []
    let entries: string[] = []
    try {
      entries = readdirSync(spec.path).filter((e) => e.endsWith(".md") || e.endsWith(".json") || e.endsWith(".yaml"))
    } catch {
      // unreadable dir — record as missing
      return [{ name: spec.name, path: spec.path, exists: false, mtime: null }]
    }
    for (const e of entries) {
      const p = join(spec.path, e)
      try {
        const s = statSync(p)
        if (s.isFile()) {
          out.push({ name: `${spec.name.replace(/\/$/, "")}/${e}`, path: p, exists: true, mtime: s.mtime })
        }
      } catch {
        // ignore single-file failure
      }
    }
    if (out.length === 0) {
      // directory exists but no qualifying children — treat directory mtime as the signal
      return [{ name: spec.name, path: spec.path, exists: true, mtime: stat.mtime }]
    }
    return out
  }
  return [{ name: spec.name, path: spec.path, exists: true, mtime: stat.mtime }]
}

// Pull `last_reviewed` (preferred) or `last_updated` from a markdown file's
// frontmatter. Returns null if neither is present or the file is unreadable.
// This lets the freshness pill prefer the principal-curated date over a hot
// auto-generated mtime where available.
function readFrontmatterDate(filePath: string): Date | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    if (!content.startsWith("---")) return null
    const end = content.indexOf("\n---", 3)
    if (end < 0) return null
    const fm = content.slice(0, end)
    const reviewed = fm.match(/^last_reviewed:\s*([^\s\n]+)/m)
    if (reviewed) {
      const d = new Date(reviewed[1])
      if (!isNaN(d.getTime())) return d
    }
    const updated = fm.match(/^last_updated:\s*([^\s\n]+)/m)
    if (updated) {
      const d = new Date(updated[1])
      if (!isNaN(d.getTime())) return d
    }
    return null
  } catch {
    return null
  }
}

function tierFromDays(daysOld: number | null): "fresh" | "aging" | "stale" | "unknown" {
  if (daysOld == null) return "unknown"
  if (daysOld <= 7) return "fresh"
  if (daysOld <= 30) return "aging"
  return "stale"
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface FreshnessFilePayload {
  name: string
  date: string | null
  source: "state" | "content" | "filename" | "mtime" | "unknown"
}

interface FreshnessPayload {
  tabId: string
  dataDate: string | null
  label: string
  daysOld: number | null
  tier: "fresh" | "aging" | "stale" | "unknown"
  perFile: FreshnessFilePayload[]
}

function computeTabFreshness(tabId: string): FreshnessPayload {
  const specs = REGISTRY[tabId]
  if (!specs) {
    return {
      tabId,
      dataDate: null,
      label: "no data sources registered",
      daysOld: null,
      tier: "unknown",
      perFile: [],
    }
  }
  const resolved = specs.flatMap((s) => resolveSpec(s))
  const perFile: FreshnessFilePayload[] = []
  let mostRecent: Date | null = null
  let anyExist = false
  for (const r of resolved) {
    if (!r.exists || !r.mtime) {
      perFile.push({ name: r.name, date: null, source: "unknown" })
      continue
    }
    anyExist = true
    // Prefer frontmatter date for .md files
    const fmDate = r.path.endsWith(".md") ? readFrontmatterDate(r.path) : null
    const effective = fmDate ?? r.mtime
    perFile.push({
      name: r.name,
      date: isoDate(effective),
      source: fmDate ? "content" : "mtime",
    })
    if (!mostRecent || effective > mostRecent) mostRecent = effective
  }
  const daysOld = mostRecent
    ? Math.floor((Date.now() - mostRecent.getTime()) / 86_400_000)
    : null
  const tier = tierFromDays(anyExist ? daysOld : null)
  const label = anyExist ? `${perFile.filter((p) => p.date).length} of ${perFile.length} sources dated` : "no sources on disk"
  return {
    tabId,
    dataDate: mostRecent ? isoDate(mostRecent) : null,
    label,
    daysOld,
    tier,
    perFile,
  }
}

// ── Lifecycle ──

export async function start(): Promise<void> {
  console.log(`[${MODULE_NAME}] Starting...`)
  state.running = true
  state.startedAt = new Date()
  console.log(`[${MODULE_NAME}] Started — ${Object.keys(REGISTRY).length} tabs registered`)
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE_NAME}] Stopping...`)
  state.running = false
  state.cache.clear()
  console.log(`[${MODULE_NAME}] Stopped`)
}

export function invalidate(): void {
  state.cache.clear()
}

export function health(): { status: string; details?: Record<string, unknown> } {
  if (!state.running) return { status: "stopped" }
  return {
    status: "healthy",
    details: {
      uptime_s: state.startedAt ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000) : 0,
      tabs_registered: Object.keys(REGISTRY).length,
      cache_entries: state.cache.size,
    },
  }
}

// ── HTTP handler ──

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (pathname !== "/api/tab-freshness") return null
  const url = new URL(req.url)
  const tabId = (url.searchParams.get("tab") ?? "").trim().toLowerCase()
  if (!tabId) {
    return Response.json({
      tabId: "",
      dataDate: null,
      label: "missing ?tab= query parameter",
      daysOld: null,
      tier: "unknown",
      perFile: [],
    }, { status: 200 })
  }
  // 60s in-process cache
  const now = Date.now()
  const cached = state.cache.get(tabId)
  if (cached && now < cached.expiresAt) {
    return Response.json(cached.payload)
  }
  const payload = computeTabFreshness(tabId)
  state.cache.set(tabId, { payload, expiresAt: now + CACHE_TTL_MS })
  return Response.json(payload)
}
