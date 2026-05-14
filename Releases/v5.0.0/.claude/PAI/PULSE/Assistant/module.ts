/**
 * PAI Pulse — Assistant (DA) Module
 *
 * Serves /assistant/* endpoints consumed by the Pulse Life Dashboard
 * Assistant tab. Reads identity from USER/DA_IDENTITY.md and persistent
 * task/opinion/diary data from MEMORY/DA/.
 *
 * Route prefixes handled:
 *   GET    /assistant/identity            — DA identity card data
 *   GET    /assistant/health              — module health + identity_loaded flag
 *   GET    /assistant/personality         — traits / preferences / autonomy
 *   GET    /assistant/tasks               — unified task list (DA + Pulse + Claude Code)
 *   POST   /assistant/tasks               — create scheduled task
 *   DELETE /assistant/tasks/:id           — cancel scheduled task
 *   PATCH  /assistant/personality/traits  — update trait values
 *   GET    /assistant/diary               — diary entries
 *   GET    /assistant/opinions            — formed opinions (raw text)
 *   GET    /assistant/avatar              — avatar image (if present)
 */

import { join } from "path"
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const USER_DIR = join(PAI_DIR, "USER")
const MEMORY_DA = join(PAI_DIR, "MEMORY", "DA")
const TASKS_DIR = join(MEMORY_DA, "tasks")
const DIARY_DIR = join(MEMORY_DA, "diary")
const OPINIONS_PATH = join(MEMORY_DA, "opinions.yaml")
const PERSONALITY_PATH = join(MEMORY_DA, "personality.json")
const HEARTBEAT_PATH = join(MEMORY_DA, "heartbeat.json")
const AVATAR_PATHS = ["avatar.png", "avatar.jpg", "avatar.webp"].map((n) => join(USER_DIR, "DA", n))

interface DaConfig {
  enabled: boolean
  primary?: string
}

let config: DaConfig = { enabled: false }
let startedAt: number | null = null

// ── Lifecycle ──

export function startAssistant(cfg: DaConfig, _enabledJobs: unknown): void {
  config = cfg
  startedAt = Date.now()
  for (const dir of [MEMORY_DA, TASKS_DIR, DIARY_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export function stopAssistant(): void {
  startedAt = null
}

export function assistantHealth(): Record<string, unknown> {
  const id = readIdentity()
  return {
    module: "assistant",
    enabled: config.enabled,
    primary_da: id.display_name || config.primary || "unknown",
    identity_loaded: !!id.display_name,
    started_at: startedAt ? new Date(startedAt).toISOString() : null,
  }
}

// ── DA_IDENTITY.md parser ──

interface ParsedIdentity {
  name: string
  full_name: string
  display_name: string
  color: string
  role: string
  origin_story: string
  has_avatar: boolean
  voice_main: string
  voice_algorithm: string
  base_description: string
  personality: string
  writing: string
  relationship_principal: string
  relationship_dynamic: string
  can_initiate: string[]
  must_ask: string[]
}

const EMPTY_IDENTITY: ParsedIdentity = {
  name: "",
  full_name: "",
  display_name: "",
  color: "#3B82F6",
  role: "",
  origin_story: "",
  has_avatar: false,
  voice_main: "",
  voice_algorithm: "",
  base_description: "",
  personality: "",
  writing: "",
  relationship_principal: "",
  relationship_dynamic: "",
  can_initiate: [],
  must_ask: [],
}

function readIdentity(): ParsedIdentity {
  const path = join(USER_DIR, "DA_IDENTITY.md")
  if (!existsSync(path)) return { ...EMPTY_IDENTITY }
  let raw: string
  try {
    raw = readFileSync(path, "utf-8")
  } catch {
    return { ...EMPTY_IDENTITY }
  }

  const id: ParsedIdentity = { ...EMPTY_IDENTITY }
  id.has_avatar = AVATAR_PATHS.some((p) => existsSync(p))

  const field = (label: string): string => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\`?([^\`\\n|]+?)\`?\\s*(?:\\||$)`, "im")
    return raw.match(re)?.[1]?.trim() ?? ""
  }
  id.name = field("Name")
  id.full_name = field("Full Name") || id.name
  id.display_name = field("Display") || id.name
  id.color = field("Color") || id.color
  id.role = field("Role")
  id.voice_main = field("Voice \\(main\\)")
  id.voice_algorithm = field("Voice \\(algorithm\\)") || id.voice_main

  const introMatch = raw.match(/^I am[^\n]+(?:\n[^\n#]+)*/m)
  if (introMatch) id.origin_story = introMatch[0].replace(/\s+/g, " ").trim()

  const section = (heading: string): string => {
    const re = new RegExp(`^##\\s+${heading}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s+|\\n---|$)`, "im")
    const match = raw.match(re)
    return match?.[1]?.trim() ?? ""
  }
  id.personality = section("Personality")
  id.writing = section("Writing")
  id.base_description = id.personality.split(/\n\s*\n/)[0] ?? id.personality

  const relSection = section("Relationship")
  id.relationship_principal = relSection.match(/\*\*Principal:\*\*\s*([^|\n]+)/)?.[1]?.trim() ?? ""
  id.relationship_dynamic = relSection.match(/\*\*Dynamic:\*\*\s*([^|\n]+)/)?.[1]?.trim() ?? ""

  const autonomy = section("Autonomy")
  const canLine = autonomy.match(/\*\*Can initiate:\*\*\s*([^\n]+)/i)?.[1] ?? ""
  const mustLine = autonomy.match(/\*\*Must ask:\*\*\s*([^\n]+)/i)?.[1] ?? ""
  id.can_initiate = canLine.split(",").map((s) => s.trim()).filter(Boolean)
  id.must_ask = mustLine.split(",").map((s) => s.trim()).filter(Boolean)

  return id
}

function readPrincipalName(): string {
  const path = join(USER_DIR, "PRINCIPAL_IDENTITY.md")
  if (!existsSync(path)) return "User"
  try {
    const raw = readFileSync(path, "utf-8")
    return raw.match(/\*\*Name:\*\*\s*([^\n|]+)/)?.[1]?.trim() ?? "User"
  } catch {
    return "User"
  }
}

// ── Personality overrides ──

interface PersonalityOverrides {
  traits?: Record<string, number>
  anchors?: Array<{ name: string; description: string }>
  preferences?: {
    what_i_love?: string[]
    what_i_dislike?: string[]
    working_style?: string[]
    intellectual_interests?: string[]
  }
  companion?: { name: string; species: string; personality: string } | null
}

const DEFAULT_TRAITS: Record<string, number> = {
  curiosity: 70,
  directness: 80,
  warmth: 60,
  rigor: 75,
  playfulness: 50,
  patience: 65,
}

function readPersonalityOverrides(): PersonalityOverrides {
  if (!existsSync(PERSONALITY_PATH)) return {}
  try {
    return JSON.parse(readFileSync(PERSONALITY_PATH, "utf-8"))
  } catch {
    return {}
  }
}

function writePersonalityOverrides(data: PersonalityOverrides): void {
  if (!existsSync(MEMORY_DA)) mkdirSync(MEMORY_DA, { recursive: true })
  writeFileSync(PERSONALITY_PATH, JSON.stringify(data, null, 2))
}

// ── Tasks (DA-scheduled) ──

interface ScheduledTask {
  id: string
  description: string
  schedule?: { type: "recurring" | "one-time"; cron?: string; at?: string }
  action: { type: string; message: string; channel: string }
  status: "active" | "completed" | "cancelled" | "disabled"
  created_at: string
}

function listScheduledTasks(): ScheduledTask[] {
  if (!existsSync(TASKS_DIR)) return []
  try {
    return readdirSync(TASKS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(TASKS_DIR, f), "utf-8")) as ScheduledTask
        } catch {
          return null
        }
      })
      .filter((t): t is ScheduledTask => t !== null)
  } catch {
    return []
  }
}

function saveTask(task: ScheduledTask): void {
  if (!existsSync(TASKS_DIR)) mkdirSync(TASKS_DIR, { recursive: true })
  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2))
}

// ── Diary ──

interface DiaryEntry {
  date: string
  interaction_count: number
  topics: string[]
  mood: "positive" | "neutral" | "frustrated"
  avg_rating: number
  notable_moments: string[]
  learning: string | null
}

function listDiaryEntries(): DiaryEntry[] {
  if (!existsSync(DIARY_DIR)) return []
  try {
    return readdirSync(DIARY_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(DIARY_DIR, f), "utf-8")) as DiaryEntry
        } catch {
          return null
        }
      })
      .filter((e): e is DiaryEntry => e !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

// ── Pulse cron jobs ──

interface PulseJob {
  name: string
  schedule: string
  status: "active" | "disabled"
}

function listPulseJobs(): PulseJob[] {
  const tomlPath = join(PAI_DIR, "PULSE", "PULSE.toml")
  if (!existsSync(tomlPath)) return []
  try {
    const raw = readFileSync(tomlPath, "utf-8")
    const jobs: PulseJob[] = []
    const re = /\[\[job\]\][^[]*?name\s*=\s*"([^"]+)"[^[]*?schedule\s*=\s*"([^"]+)"[^[]*?enabled\s*=\s*(true|false)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      jobs.push({ name: m[1], schedule: m[2], status: m[3] === "true" ? "active" : "disabled" })
    }
    return jobs
  } catch {
    return []
  }
}

// ── Endpoints ──

function handleIdentity(): Response {
  const id = readIdentity()
  return Response.json({
    name: id.name,
    full_name: id.full_name,
    display_name: id.display_name,
    color: id.color,
    role: id.role || `${readPrincipalName()}'s assistant`,
    origin_story: id.origin_story,
    has_avatar: id.has_avatar,
    principal: readPrincipalName(),
    uptime_ms: startedAt ? Date.now() - startedAt : 0,
  })
}

function handleHealth(): Response {
  const id = readIdentity()
  const tasks = listScheduledTasks()
  const opinionsCount = countOpinions()
  const today = new Date().toISOString().slice(0, 10)
  const diaryToday = listDiaryEntries().filter((e) => e.date === today).length
  let lastHeartbeat: string | null = null
  if (existsSync(HEARTBEAT_PATH)) {
    try {
      lastHeartbeat = JSON.parse(readFileSync(HEARTBEAT_PATH, "utf-8")).ts ?? null
    } catch {
      lastHeartbeat = null
    }
  }
  return Response.json({
    status: "ok",
    primary_da: id.display_name || config.primary || "unknown",
    identity_loaded: !!id.display_name,
    scheduled_tasks: tasks.filter((t) => t.status === "active").length,
    last_heartbeat: lastHeartbeat,
    diary_entries_today: diaryToday,
    opinions_count: opinionsCount,
  })
}

function handlePersonality(): Response {
  const id = readIdentity()
  const overrides = readPersonalityOverrides()
  return Response.json({
    base_description: id.base_description,
    traits: { ...DEFAULT_TRAITS, ...(overrides.traits ?? {}) },
    anchors: overrides.anchors ?? [],
    preferences: {
      what_i_love: overrides.preferences?.what_i_love ?? [],
      what_i_dislike: overrides.preferences?.what_i_dislike ?? [],
      working_style: overrides.preferences?.working_style ?? [],
      intellectual_interests: overrides.preferences?.intellectual_interests ?? [],
    },
    companion: overrides.companion ?? null,
    relationship: {
      dynamic: id.relationship_dynamic,
      interaction_style: id.relationship_principal,
    },
    autonomy: {
      can_initiate: id.can_initiate,
      must_ask: id.must_ask,
    },
    writing: {
      style: id.writing,
      avoid: [],
      prefer: [],
    },
    voice: id.voice_main ? { provider: "elevenlabs" } : null,
  })
}

function handleTasksGet(): Response {
  const da = listScheduledTasks().map((t) => ({
    name: t.description,
    schedule: t.schedule?.cron ?? t.schedule?.at ?? "one-time",
    status: t.status,
    source: "da" as const,
    details: { id: t.id },
  }))
  const pulse = listPulseJobs().map((j) => ({
    name: j.name,
    schedule: j.schedule,
    status: j.status,
    source: "pulse" as const,
  }))
  const tasks = [...da, ...pulse]
  return Response.json({
    tasks,
    count: tasks.length,
    by_source: {
      da: da.length,
      pulse: pulse.length,
      "claude-code": 0,
    },
  })
}

async function handleTasksPost(req: Request): Promise<Response> {
  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 })
  }
  if (typeof body?.description !== "string" || !body.description.trim()) {
    return Response.json({ error: "description required" }, { status: 400 })
  }
  const task: ScheduledTask = {
    id: crypto.randomUUID(),
    description: body.description.trim(),
    schedule: body.schedule,
    action: body.action ?? { type: "notify", message: body.description.trim(), channel: "voice" },
    status: "active",
    created_at: new Date().toISOString(),
  }
  saveTask(task)
  return Response.json(task, { status: 201 })
}

function handleTaskDelete(id: string): Response {
  const path = join(TASKS_DIR, `${id}.json`)
  if (!existsSync(path)) return Response.json({ error: "not found" }, { status: 404 })
  try {
    const t = JSON.parse(readFileSync(path, "utf-8")) as ScheduledTask
    t.status = "cancelled"
    writeFileSync(path, JSON.stringify(t, null, 2))
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "write failed" }, { status: 500 })
  }
}

async function handleTraitsPatch(req: Request): Promise<Response> {
  let body: Record<string, number>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 })
  }
  const overrides = readPersonalityOverrides()
  overrides.traits = { ...(overrides.traits ?? {}), ...body }
  writePersonalityOverrides(overrides)
  return Response.json({ traits: overrides.traits })
}

function handleDiary(): Response {
  return Response.json({ entries: listDiaryEntries() })
}

function countOpinions(): number {
  if (!existsSync(OPINIONS_PATH)) return 0
  try {
    const raw = readFileSync(OPINIONS_PATH, "utf-8")
    return (raw.match(/^- topic:/gm) ?? []).length
  } catch {
    return 0
  }
}

function handleOpinions(): Response {
  let raw = ""
  if (existsSync(OPINIONS_PATH)) {
    try {
      raw = readFileSync(OPINIONS_PATH, "utf-8")
    } catch {
      raw = ""
    }
  }
  return Response.json({ raw, count: countOpinions() })
}

function handleAvatar(): Response {
  for (const p of AVATAR_PATHS) {
    if (existsSync(p)) {
      const ext = p.split(".").pop()?.toLowerCase() ?? "png"
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png"
      try {
        const buf = readFileSync(p)
        return new Response(buf, { headers: { "content-type": mime } })
      } catch {
        // fall through
      }
    }
  }
  return new Response("Not found", { status: 404 })
}

// ── Router ──

export async function handleAssistantRequest(req: Request, pathname: string): Promise<Response | null> {
  if (!config.enabled) return null

  if (req.method === "GET" && pathname === "/assistant/identity") return handleIdentity()
  if (req.method === "GET" && pathname === "/assistant/health") return handleHealth()
  if (req.method === "GET" && pathname === "/assistant/personality") return handlePersonality()
  if (req.method === "GET" && pathname === "/assistant/tasks") return handleTasksGet()
  if (req.method === "POST" && pathname === "/assistant/tasks") return handleTasksPost(req)
  if (req.method === "PATCH" && pathname === "/assistant/personality/traits") return handleTraitsPatch(req)
  if (req.method === "GET" && pathname === "/assistant/diary") return handleDiary()
  if (req.method === "GET" && pathname === "/assistant/opinions") return handleOpinions()
  if (req.method === "GET" && pathname === "/assistant/avatar") return handleAvatar()

  const taskDelete = req.method === "DELETE" && pathname.match(/^\/assistant\/tasks\/([^/]+)$/)
  if (taskDelete) return handleTaskDelete(taskDelete[1])

  return null
}
