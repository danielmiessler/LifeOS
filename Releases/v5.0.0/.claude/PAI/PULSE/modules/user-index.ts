/**
 * UserIndex — Life OS USER/ indexer and Pulse module.
 *
 * Walks ~/.claude/PAI/USER/, parses frontmatter + body of every .md file,
 * computes derived fields (staleness, completeness, item_count, preview),
 * and writes a typed JSON index at Pulse/state/user-index.json.
 *
 * Consumed by Pulse dashboard (/life, /health, /finances, ...), Daemon
 * aggregator (via publish_feed), and Interview skill (via interview_gaps).
 *
 * Spec: PAI/DOCUMENTATION/LifeOs/LifeOsSchema.md
 *
 * Usage:
 *   # As a Pulse module: registered in PULSE.toml, start()/stop() lifecycle
 *   # Standalone CLI:
 *   bun run Pulse/modules/user-index.ts              # full scan + write
 *   bun run Pulse/modules/user-index.ts --stats      # summary only
 *   bun run Pulse/modules/user-index.ts --query <p>  # inspect single file
 *   bun run Pulse/modules/user-index.ts --watch      # scan + fs.watch daemon
 */

import { readFileSync, writeFileSync, statSync, readdirSync, mkdirSync, existsSync, watch } from "fs"
import { join, relative, basename, dirname } from "path"

const HOME = process.env.HOME ?? ""
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude", "PAI")
const USER_DIR = join(PAI_DIR, "USER")
const STATE_DIR = join(PAI_DIR, "PULSE", "state")
const INDEX_PATH = join(STATE_DIR, "user-index.json")
const MODULE_NAME = "user-index"

// ───────────────────────────────────────────────────────────────────────────
// Types (matches DOCUMENTATION/LifeOs/LifeOsSchema.md)
// ───────────────────────────────────────────────────────────────────────────

export type Category =
  | "identity" | "voice" | "mind" | "taste" | "shape" | "ops" | "domain" | "unknown"

export type Kind =
  | "collection" | "narrative" | "reference" | "index" | "metric" | "unknown"

export type PublishValue =
  | "false" | "daemon-summary" | "daemon" | "public"

export interface CollectionItem {
  name: string
  creator?: string
  rating?: number
  notes?: string
  private?: boolean
}

export interface UserIndexEntry {
  path: string                 // relative to USER/, POSIX form
  absolute_path: string
  title: string
  category: Category
  kind: Kind
  publish: PublishValue
  review_cadence_days: number  // 0 = never
  interview_phase: number | null
  last_updated: string         // ISO
  last_updated_source: "frontmatter" | "mtime"
  staleness_days: number
  overdue_review: boolean
  completeness: number         // 0-100 heuristic
  has_tbd: boolean
  preview: string              // first 3 non-empty lines
  item_count: number | null    // collections only
  items: CollectionItem[] | null
  word_count: number
  size_bytes: number
  inferred: boolean            // true if frontmatter absent — temporary fallback
  frontmatter_raw: Record<string, string>
}

export interface DomainSummary {
  name: string                 // "Health", "Finances", ...
  readme_path: string | null
  file_count: number
  total_size_bytes: number
  avg_completeness: number
  any_overdue: boolean
  files: UserIndexEntry[]
}

export interface InterviewGap {
  path: string
  reason: string
  interview_phase: number | null
}

export interface UserIndex {
  version: string
  generated_at: string
  user_dir: string
  files: UserIndexEntry[]
  by_category: Record<Category, UserIndexEntry[]>
  domains: DomainSummary[]
  publish_feed: UserIndexEntry[]      // publish != "false"
  stale_queue: UserIndexEntry[]       // overdue_review true, sorted by staleness desc
  interview_gaps: InterviewGap[]
  stats: {
    total_files: number
    total_size_bytes: number
    avg_completeness: number
    by_kind: Record<Kind, number>
    by_publish: Record<PublishValue, number>
    frontmatter_coverage: number     // % files with explicit frontmatter
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Frontmatter fallback inference (for files without frontmatter — current state)
// Remove once all USER/ files are migrated to the new schema.
// ───────────────────────────────────────────────────────────────────────────

const ROOT_FALLBACK: Record<string, { category: Category; kind: Kind; publish: PublishValue }> = {
  "PRINCIPAL_IDENTITY.md":   { category: "identity", kind: "narrative",  publish: "daemon-summary" },
  "DA_IDENTITY.md":          { category: "identity", kind: "narrative",  publish: "false" },
  "OUR_STORY.md":            { category: "identity", kind: "narrative",  publish: "false" },
  "OPINIONS.md":             { category: "identity", kind: "narrative",  publish: "false" },
  "RESUME.md":               { category: "identity", kind: "narrative",  publish: "false" },
  "CONTACTS.md":             { category: "identity", kind: "reference",  publish: "false" },
  "WRITINGSTYLE.md":         { category: "voice",    kind: "narrative",  publish: "false" },
  "RHETORICALSTYLE.md":      { category: "voice",    kind: "narrative",  publish: "false" },
  "AI_WRITING_PATTERNS.md":  { category: "voice",    kind: "reference",  publish: "false" },
  "PRONUNCIATIONS.md":       { category: "voice",    kind: "reference",  publish: "false" },
  "DEFINITIONS.md":          { category: "mind",     kind: "reference",  publish: "daemon" },
  "CORECONTENT.md":          { category: "mind",     kind: "reference",  publish: "false" },
  "PRODUCTIVITY.md":         { category: "ops",      kind: "narrative",  publish: "false" },
  "ASSETMANAGEMENT.md":      { category: "ops",      kind: "reference",  publish: "false" },
  "FEED.md":                 { category: "ops",      kind: "reference",  publish: "false" },
  "ARCHITECTURE.md":         { category: "ops",      kind: "reference",  publish: "false" },
  "SECURITY_MONITORING.md":  { category: "ops",      kind: "reference",  publish: "false" },
  "ADMIN_EMAIL_API.md":      { category: "ops",      kind: "reference",  publish: "false" },
  "README.md":               { category: "identity", kind: "narrative",  publish: "false" },
}

const TELOS_FALLBACK: Record<string, { category: Category; kind: Kind; publish: PublishValue }> = {
  "MISSION.md":        { category: "domain", kind: "narrative",  publish: "daemon-summary" },
  "GOALS.md":          { category: "domain", kind: "collection", publish: "daemon-summary" },
  "PROBLEMS.md":       { category: "domain", kind: "collection", publish: "daemon-summary" },
  "STRATEGIES.md":     { category: "domain", kind: "collection", publish: "daemon-summary" },
  "CHALLENGES.md":     { category: "domain", kind: "narrative",  publish: "false" },
  "BELIEFS.md":        { category: "mind",   kind: "narrative",  publish: "daemon-summary" },
  "WISDOM.md":         { category: "mind",   kind: "collection", publish: "daemon-summary" },
  "MODELS.md":         { category: "mind",   kind: "collection", publish: "daemon-summary" },
  "FRAMES.md":         { category: "mind",   kind: "narrative",  publish: "false" },
  "NARRATIVES.md":     { category: "mind",   kind: "collection", publish: "daemon-summary" },
  "BOOKS.md":          { category: "taste",  kind: "collection", publish: "daemon" },
  "AUTHORS.md":        { category: "taste",  kind: "collection", publish: "daemon" },
  "MOVIES.md":         { category: "taste",  kind: "collection", publish: "daemon" },
  "BANDS.md":          { category: "taste",  kind: "collection", publish: "daemon" },
  "RESTAURANTS.md":    { category: "taste",  kind: "collection", publish: "false" },
  "FOOD_PREFERENCES.md":{category: "taste",  kind: "collection", publish: "false" },
  "SPARKS.md":         { category: "shape",  kind: "narrative",  publish: "false" },
  "MEETUPS.md":        { category: "shape",  kind: "collection", publish: "false" },
  "CIVIC.md":          { category: "shape",  kind: "narrative",  publish: "false" },
  "PREDICTIONS.md":    { category: "shape",  kind: "collection", publish: "daemon-summary" },
  "TRAUMAS.md":        { category: "shape",  kind: "narrative",  publish: "false" },
  "IDEAS.md":          { category: "mind",   kind: "collection", publish: "false" },
  "LEARNED.md":        { category: "mind",   kind: "collection", publish: "false" },
  "WRONG.md":          { category: "mind",   kind: "collection", publish: "daemon-summary" },
  "PROJECTS.md":       { category: "domain", kind: "reference",  publish: "false" },
  "STATUS.md":         { category: "domain", kind: "reference",  publish: "false" },
}

function inferFallback(userRelPath: string): { category: Category; kind: Kind; publish: PublishValue } | null {
  const parts = userRelPath.split("/")
  const file = basename(userRelPath)
  if (parts.length === 1) {
    // Root file
    return ROOT_FALLBACK[file] || null
  }
  if (parts[0] === "TELOS" && parts.length === 2) {
    return TELOS_FALLBACK[file] || null
  }
  // Directory README — assume index/domain
  if (file === "README.md") {
    return { category: "domain", kind: "index", publish: "false" }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Frontmatter parser (zero-dep, handles the subset we use)
// ───────────────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  if (!content.startsWith("---\n")) return { meta: {}, body: content }
  const end = content.indexOf("\n---\n", 4)
  if (end === -1) return { meta: {}, body: content }
  const header = content.slice(4, end)
  const body = content.slice(end + 5)
  const meta: Record<string, string> = {}
  for (const line of header.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const colon = trimmed.indexOf(":")
    if (colon === -1) continue
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
    // strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }
  return { meta, body }
}

// ───────────────────────────────────────────────────────────────────────────
// Collection item parser
// Shape: - **name** — creator · ★rating · notes
// All parts after name optional. `(private)` prefix hides from Daemon.
// ───────────────────────────────────────────────────────────────────────────

const COLLECTION_ITEM_RE = /^-\s+(?:\((private)\)\s+)?\*\*([^*]+?)\*\*(?:\s*[—–-]\s*([^·\n]+?))?(?:\s*·\s*★(\d+))?(?:\s*·\s*(.+))?$/

function parseCollection(body: string): CollectionItem[] {
  const items: CollectionItem[] = []
  for (const line of body.split("\n")) {
    const m = line.match(COLLECTION_ITEM_RE)
    if (!m) continue
    const [, priv, name, creator, rating, notes] = m
    const item: CollectionItem = { name: name.trim() }
    if (creator) item.creator = creator.trim()
    if (rating) item.rating = parseInt(rating, 10)
    if (notes) item.notes = notes.trim()
    if (priv) item.private = true
    items.push(item)
  }
  return items
}

// ───────────────────────────────────────────────────────────────────────────
// Derived field computation
// ───────────────────────────────────────────────────────────────────────────

function parseCadence(value: string | undefined): number {
  if (!value || value === "never") return 0
  const m = value.match(/^(\d+)d$/)
  return m ? parseInt(m[1], 10) : 0
}

function computeStaleness(isoDate: string): number {
  if (isoDate === "TBD") return Infinity
  const then = Date.parse(isoDate)
  if (isNaN(then)) return Infinity
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24))
}

const TBD_MARKERS = /\b(TBD|XXX|FIXME|\?\?\?|<fill>|<placeholder>)\b/i

function computeCompleteness(
  meta: Record<string, string>,
  body: string,
  kind: Kind,
  itemCount: number | null,
): number {
  let score = 0
  // Frontmatter presence
  if (meta.category) score += 10
  if (meta.kind) score += 10
  if (meta.publish) score += 5
  if (meta.last_updated && meta.last_updated !== "TBD") score += 10
  // Body substance
  const words = body.trim().split(/\s+/).length
  if (words > 20) score += 15
  if (words > 100) score += 15
  if (words > 300) score += 10
  // Kind-specific
  if (kind === "collection" && itemCount !== null) {
    if (itemCount >= 3) score += 15
    if (itemCount >= 10) score += 10
  }
  if (kind === "narrative") {
    // Narrative files benefit from structure (headings)
    const headings = (body.match(/^##+ /gm) || []).length
    if (headings >= 2) score += 10
    if (headings >= 5) score += 10
  }
  // Penalize TBD markers
  const tbdCount = (body.match(TBD_MARKERS) || []).length
  score -= tbdCount * 3
  return Math.max(0, Math.min(100, score))
}

function extractPreview(body: string, kind: Kind, items: CollectionItem[] | null): string {
  if (kind === "collection" && items && items.length > 0) {
    return items.slice(0, 5).map(i => `${i.name}${i.creator ? ` — ${i.creator}` : ""}`).join(" · ")
  }
  const lines = body.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
  return lines.slice(0, 3).join(" ").slice(0, 240)
}

function extractTitle(body: string, fallbackPath: string): string {
  const m = body.match(/^#\s+(.+)$/m)
  if (m) return m[1].trim()
  return basename(fallbackPath, ".md")
}

// ───────────────────────────────────────────────────────────────────────────
// File parser
// ───────────────────────────────────────────────────────────────────────────

function parseFile(absolutePath: string): UserIndexEntry {
  const content = readFileSync(absolutePath, "utf-8")
  const { meta, body } = parseFrontmatter(content)
  const stat = statSync(absolutePath)
  const relPath = relative(USER_DIR, absolutePath).split("\\").join("/")

  // Fallback inference if frontmatter missing
  const inferred = !meta.category && !meta.kind
  let category: Category = (meta.category as Category) || "unknown"
  let kind: Kind = (meta.kind as Kind) || "unknown"
  let publish: PublishValue = (meta.publish as PublishValue) || "false"
  if (inferred) {
    const fallback = inferFallback(relPath)
    if (fallback) {
      category = fallback.category
      kind = fallback.kind
      publish = fallback.publish
    }
  }

  // Dates
  const fmUpdated = meta.last_updated
  const last_updated = fmUpdated && fmUpdated !== "TBD"
    ? fmUpdated
    : stat.mtime.toISOString().slice(0, 10)
  const last_updated_source: "frontmatter" | "mtime" = fmUpdated && fmUpdated !== "TBD" ? "frontmatter" : "mtime"

  const review_cadence_days = parseCadence(meta.review_cadence)
  const staleness_days = computeStaleness(last_updated)
  const overdue_review = review_cadence_days > 0 && staleness_days > review_cadence_days

  // Collection parsing
  const items = kind === "collection" ? parseCollection(body) : null
  const item_count = items ? items.length : null

  const completeness = computeCompleteness(meta, body, kind, item_count)
  const has_tbd = TBD_MARKERS.test(body)
  const preview = extractPreview(body, kind, items)
  const title = extractTitle(body, relPath)
  const word_count = body.trim().split(/\s+/).filter(Boolean).length

  return {
    path: relPath,
    absolute_path: absolutePath,
    title,
    category,
    kind,
    publish,
    review_cadence_days,
    interview_phase: meta.interview_phase ? parseInt(meta.interview_phase, 10) : null,
    last_updated,
    last_updated_source,
    staleness_days: staleness_days === Infinity ? 99999 : staleness_days,
    overdue_review,
    completeness,
    has_tbd,
    preview,
    item_count,
    items,
    word_count,
    size_bytes: stat.size,
    inferred,
    frontmatter_raw: meta,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Tree walker
// ───────────────────────────────────────────────────────────────────────────

// Skip patterns — infrastructure directories that aren't life content
const SKIP_DIRS = new Set([
  "Actions", "ACTIONS",
  "Flows", "FLOWS",
  "Pipelines", "PIPELINES",
  "Workflows",
  "Arbol", "ARBOL",
  "BrowserState", "browser-state",
  "Config",
  "Credentials", "CREDENTIALS",
  "SkillCustomizations", "SKILLCUSTOMIZATIONS",
  "Terminal", "TERMINAL",
  "PAISECURITYSYSTEM", "Security",
  "Daemon",  // handled by Daemon skill directly
  "node_modules", ".git", "Backups",
])

function walkUserDir(): string[] {
  const files: string[] = []
  function walk(dir: string, depth: number) {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (depth >= 2) continue  // max one level deep into domain dirs
        walk(full, depth + 1)
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(full)
      }
    }
  }
  walk(USER_DIR, 0)
  return files
}

// ───────────────────────────────────────────────────────────────────────────
// Index builder
// ───────────────────────────────────────────────────────────────────────────

function buildIndex(): UserIndex {
  const files = walkUserDir().map(parseFile)

  const by_category = {
    identity: [] as UserIndexEntry[],
    voice: [] as UserIndexEntry[],
    mind: [] as UserIndexEntry[],
    taste: [] as UserIndexEntry[],
    shape: [] as UserIndexEntry[],
    ops: [] as UserIndexEntry[],
    domain: [] as UserIndexEntry[],
    unknown: [] as UserIndexEntry[],
  }
  for (const f of files) by_category[f.category].push(f)

  // Domains — group by top-level directory
  const domainMap = new Map<string, UserIndexEntry[]>()
  for (const f of files) {
    const parts = f.path.split("/")
    if (parts.length > 1) {
      const d = parts[0]
      if (!domainMap.has(d)) domainMap.set(d, [])
      domainMap.get(d)!.push(f)
    }
  }
  const domains: DomainSummary[] = []
  for (const [name, entries] of domainMap) {
    const readme = entries.find(e => basename(e.path) === "README.md")
    const totalSize = entries.reduce((s, e) => s + e.size_bytes, 0)
    const avgComp = entries.length > 0 ? entries.reduce((s, e) => s + e.completeness, 0) / entries.length : 0
    domains.push({
      name,
      readme_path: readme?.path ?? null,
      file_count: entries.length,
      total_size_bytes: totalSize,
      avg_completeness: Math.round(avgComp),
      any_overdue: entries.some(e => e.overdue_review),
      files: entries,
    })
  }
  domains.sort((a, b) => a.name.localeCompare(b.name))

  const publish_feed = files.filter(f => f.publish !== "false")
  const stale_queue = files.filter(f => f.overdue_review).sort((a, b) => b.staleness_days - a.staleness_days)

  const interview_gaps: InterviewGap[] = files
    .filter(f => f.completeness < 40 || f.has_tbd)
    .map(f => ({
      path: f.path,
      reason: f.has_tbd ? "contains TBD markers" : `low completeness (${f.completeness})`,
      interview_phase: f.interview_phase,
    }))
    .sort((a, b) => (a.interview_phase ?? 99) - (b.interview_phase ?? 99))

  const by_kind = { collection: 0, narrative: 0, reference: 0, index: 0, metric: 0, unknown: 0 }
  const by_publish = { "false": 0, "daemon-summary": 0, "daemon": 0, "public": 0 }
  for (const f of files) {
    by_kind[f.kind] = (by_kind[f.kind] || 0) + 1
    by_publish[f.publish] = (by_publish[f.publish] || 0) + 1
  }
  const explicitFrontmatter = files.filter(f => !f.inferred).length
  const frontmatter_coverage = files.length > 0 ? Math.round((explicitFrontmatter / files.length) * 100) : 0

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    user_dir: USER_DIR,
    files,
    by_category,
    domains,
    publish_feed,
    stale_queue,
    interview_gaps,
    stats: {
      total_files: files.length,
      total_size_bytes: files.reduce((s, f) => s + f.size_bytes, 0),
      avg_completeness: files.length > 0
        ? Math.round(files.reduce((s, f) => s + f.completeness, 0) / files.length)
        : 0,
      by_kind,
      by_publish,
      frontmatter_coverage,
    },
  }
}

function writeIndex(index: UserIndex): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2))
}

// ───────────────────────────────────────────────────────────────────────────
// Pulse module contract
// ───────────────────────────────────────────────────────────────────────────

interface ModuleState {
  running: boolean
  startedAt: Date | null
  lastIndexed: Date | null
  watcher: ReturnType<typeof watch> | null
  debounceTimer: ReturnType<typeof setTimeout> | null
}

const state: ModuleState = {
  running: false,
  startedAt: null,
  lastIndexed: null,
  watcher: null,
  debounceTimer: null,
}

function reindexDebounced(reason: string): void {
  if (state.debounceTimer) clearTimeout(state.debounceTimer)
  state.debounceTimer = setTimeout(() => {
    try {
      const index = buildIndex()
      writeIndex(index)
      state.lastIndexed = new Date()
      console.log(`[${MODULE_NAME}] Reindexed (${reason}): ${index.files.length} files`)
    } catch (err) {
      console.error(`[${MODULE_NAME}] Reindex failed:`, err)
    }
  }, 250)
}

export async function start(): Promise<void> {
  console.log(`[${MODULE_NAME}] Starting...`)
  state.running = true
  state.startedAt = new Date()

  // Initial full scan
  const index = buildIndex()
  writeIndex(index)
  state.lastIndexed = new Date()
  console.log(`[${MODULE_NAME}] Initial scan: ${index.files.length} files, ${index.stats.frontmatter_coverage}% frontmatter coverage`)

  // Watch for changes
  try {
    state.watcher = watch(USER_DIR, { recursive: true }, (event, filename) => {
      if (!filename || !filename.endsWith(".md")) return
      reindexDebounced(`${event}:${filename}`)
    })
    console.log(`[${MODULE_NAME}] Watching ${USER_DIR}`)
  } catch (err) {
    console.warn(`[${MODULE_NAME}] Watch failed, polling disabled:`, err)
  }
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE_NAME}] Stopping...`)
  state.running = false
  if (state.watcher) {
    state.watcher.close()
    state.watcher = null
  }
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer)
    state.debounceTimer = null
  }
}

export function health(): { status: string; details?: Record<string, unknown> } {
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      uptime_seconds: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
      last_indexed: state.lastIndexed?.toISOString() ?? null,
      index_path: INDEX_PATH,
    },
  }
}

export async function handleRequest(path: string, _body: Record<string, unknown>): Promise<Response> {
  if (path === "/status") return Response.json(health())

  if (!existsSync(INDEX_PATH)) {
    return Response.json({ error: "Index not generated yet" }, { status: 503 })
  }
  const index = JSON.parse(readFileSync(INDEX_PATH, "utf-8")) as UserIndex

  if (path === "/" || path === "") return Response.json(index)
  if (path === "/stats") return Response.json(index.stats)
  if (path === "/domains") return Response.json(index.domains)
  if (path === "/publish_feed") return Response.json(index.publish_feed)
  if (path === "/stale_queue") return Response.json(index.stale_queue)
  if (path === "/interview_gaps") return Response.json(index.interview_gaps)

  const catMatch = path.match(/^\/category\/(\w+)$/)
  if (catMatch) {
    const cat = catMatch[1] as Category
    return Response.json(index.by_category[cat] ?? [])
  }

  const fileMatch = path.match(/^\/file\/(.+)$/)
  if (fileMatch) {
    const target = decodeURIComponent(fileMatch[1])
    const entry = index.files.find(f => f.path === target)
    if (!entry) return Response.json({ error: "Not found" }, { status: 404 })
    return Response.json(entry)
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}

// ───────────────────────────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────────────────────────

async function cli(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.includes("--watch")) {
    await start()
    process.on("SIGINT", async () => {
      await stop()
      process.exit(0)
    })
    // Block forever
    await new Promise(() => {})
    return
  }

  const queryIdx = args.indexOf("--query")
  if (queryIdx !== -1 && args[queryIdx + 1]) {
    const target = args[queryIdx + 1]
    const index = buildIndex()
    const entry = index.files.find(f => f.path === target || f.absolute_path === target)
    if (!entry) {
      console.error(`Not found: ${target}`)
      process.exit(1)
    }
    console.log(JSON.stringify(entry, null, 2))
    return
  }

  // Default: scan + write + stats
  const index = buildIndex()
  writeIndex(index)

  if (args.includes("--json")) {
    console.log(JSON.stringify(index, null, 2))
    return
  }

  console.log(`\n═══ Life OS Index ═══`)
  console.log(`Generated: ${index.generated_at}`)
  console.log(`Index written to: ${INDEX_PATH}`)
  console.log(`\nTotal files: ${index.stats.total_files}`)
  console.log(`Avg completeness: ${index.stats.avg_completeness}%`)
  console.log(`Frontmatter coverage: ${index.stats.frontmatter_coverage}%`)
  console.log(`\nBy kind:`)
  for (const [k, c] of Object.entries(index.stats.by_kind)) {
    if (c > 0) console.log(`  ${k.padEnd(12)} ${c}`)
  }
  console.log(`\nBy publish:`)
  for (const [p, c] of Object.entries(index.stats.by_publish)) {
    if (c > 0) console.log(`  ${p.padEnd(16)} ${c}`)
  }
  console.log(`\nDomains (${index.domains.length}):`)
  for (const d of index.domains) {
    const overdue = d.any_overdue ? " ⚠" : ""
    console.log(`  ${d.name.padEnd(16)} ${d.file_count} files · ${d.avg_completeness}% complete${overdue}`)
  }
  console.log(`\nStale queue: ${index.stale_queue.length} files overdue`)
  console.log(`Interview gaps: ${index.interview_gaps.length} files need attention`)
  console.log(`Publish feed: ${index.publish_feed.length} entries broadcast-eligible`)
}

if (import.meta.main) {
  cli().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
