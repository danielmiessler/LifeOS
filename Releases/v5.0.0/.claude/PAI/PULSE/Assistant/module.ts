/**
 * PAI Assistant Module — DA subsystem for Pulse
 *
 * Manages DA identity and provides HTTP routes for the DA subsystem.
 * Cron behavior is handled by standalone check scripts in checks/.
 */

import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { parse as parseYaml } from "yaml"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const REGISTRY_PATH = join(PAI_DIR, "USER", "DA", "_registry.yaml")

interface DAConfig {
  enabled: boolean
  primary?: string
  heartbeat_schedule?: string
  heartbeat_model?: string
  heartbeat_cost_ceiling?: number
  diary_schedule?: string
  growth_schedule?: string
}

interface AssistantState {
  running: boolean
  startedAt: Date | null
  daName: string | null
  daDir: string | null
  identityLoaded: boolean
}

const state: AssistantState = {
  running: false,
  startedAt: null,
  daName: null,
  daDir: null,
  identityLoaded: false,
}

function parsePrimary(content: string): string | null {
  const m = content.match(/^primary:\s*(\S+)/m)
  return m?.[1] ?? null
}

function pulseLog(level: string, msg: string, extra?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, msg, subsystem: "assistant" }
  if (extra) Object.assign(entry, extra)
  process.stdout.write(JSON.stringify(entry) + "\n")
}

export function startAssistant(config: DAConfig, _enabledJobs?: unknown[]): void {
  state.running = true
  state.startedAt = new Date()

  if (!existsSync(REGISTRY_PATH)) {
    pulseLog("warn", "No DA registry found. Run: bun PAI/TOOLS/DAInterview.ts")
    return
  }

  const registryContent = readFileSync(REGISTRY_PATH, "utf-8")
  const primary = config.primary ?? parsePrimary(registryContent)

  if (!primary) {
    pulseLog("warn", "No primary DA in registry. Run: bun PAI/TOOLS/DAInterview.ts")
    return
  }

  state.daName = primary
  state.daDir = join(PAI_DIR, "USER", "DA", primary)
  state.identityLoaded = existsSync(join(state.daDir, "DA_IDENTITY.yaml"))

  if (!state.identityLoaded) {
    pulseLog("warn", `DA identity missing for "${primary}". Run: bun PAI/TOOLS/DAInterview.ts`)
  }
}

export async function handleAssistantRequest(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === "/assistant/health") {
    return Response.json(assistantHealth())
  }

  if (pathname === "/assistant/identity" && req.method === "GET") {
    if (!state.daDir) {
      return Response.json({ error: "No DA configured" }, { status: 404 })
    }
    const yamlPath = join(state.daDir, "DA_IDENTITY.yaml")
    if (!existsSync(yamlPath)) {
      return Response.json({ error: "DA_IDENTITY.yaml missing" }, { status: 404 })
    }
    try {
      const raw = parseYaml(readFileSync(yamlPath, "utf-8")) as Record<string, unknown>
      const core = (raw.core ?? {}) as Record<string, unknown>
      const rel = (raw.relationship ?? {}) as Record<string, unknown>
      const hasAvatar = existsSync(join(state.daDir, "avatar.png")) || existsSync(join(state.daDir, "avatar.jpg"))
      return Response.json({
        name: core.name ?? state.daName,
        full_name: core.full_name ?? core.name ?? state.daName,
        display_name: core.display_name ?? String(core.name ?? state.daName ?? "").toUpperCase(),
        color: core.color ?? "#3B82F6",
        role: core.role ?? "Primary DA",
        origin_story: core.origin_story ?? "",
        has_avatar: hasAvatar,
        principal: rel.principal ?? "Bryce",
        uptime_ms: state.startedAt ? Date.now() - state.startedAt.getTime() : 0,
      })
    } catch {
      return Response.json({ error: "Failed to parse DA_IDENTITY.yaml" }, { status: 500 })
    }
  }

  if (pathname === "/assistant/personality" && req.method === "GET") {
    if (!state.daDir) return Response.json({ error: "No DA configured" }, { status: 404 })
    const yamlPath = join(state.daDir, "DA_IDENTITY.yaml")
    if (!existsSync(yamlPath)) return Response.json({ error: "DA_IDENTITY.yaml missing" }, { status: 404 })
    try {
      const raw = parseYaml(readFileSync(yamlPath, "utf-8")) as Record<string, unknown>
      const personality = (raw.personality ?? {}) as Record<string, unknown>
      const autonomy = (raw.autonomy ?? {}) as Record<string, unknown>
      const writing = (raw.writing ?? {}) as Record<string, unknown>
      const voice = (raw.voice ?? null) as Record<string, unknown> | null
      return Response.json({
        base_description: personality.base_description ?? "",
        traits: personality.traits ?? {},
        anchors: personality.anchors ?? [],
        preferences: personality.preferences ?? { what_i_love: [], what_i_dislike: [], working_style: [], intellectual_interests: [] },
        companion: personality.companion ?? null,
        relationship: raw.relationship ?? { dynamic: "peers", interaction_style: "" },
        autonomy: { can_initiate: autonomy.can_initiate ?? [], must_ask: autonomy.must_ask ?? [] },
        writing: { style: writing.style ?? "", avoid: writing.avoid ?? [], prefer: writing.prefer ?? [] },
        voice: voice ? { provider: String((voice as Record<string, unknown>).provider ?? "elevenlabs") } : null,
      })
    } catch {
      return Response.json({ error: "Failed to parse DA_IDENTITY.yaml" }, { status: 500 })
    }
  }

  if (pathname === "/assistant/tasks" && req.method === "GET") {
    return Response.json({ tasks: [], count: 0, by_source: { da: 0, pulse: 0, "claude-code": 0 } })
  }

  if (pathname === "/assistant/diary" && req.method === "GET") {
    if (!state.daDir) return Response.json({ entries: [] })
    const diaryPath = join(state.daDir, "diary.jsonl")
    if (!existsSync(diaryPath)) return Response.json({ entries: [] })
    const lines = readFileSync(diaryPath, "utf-8").trim().split("\n").filter(Boolean)
    const entries = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    return Response.json({ entries: entries.slice(-30) })
  }

  if (pathname === "/assistant/opinions" && req.method === "GET") {
    if (!state.daDir) return Response.json({ opinions: [] })
    const opinionsPath = join(state.daDir, "opinions.yaml")
    if (!existsSync(opinionsPath)) return Response.json({ opinions: [] })
    return new Response(readFileSync(opinionsPath, "utf-8"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  return null
}

export function assistantHealth(): Record<string, unknown> {
  return {
    module: "assistant",
    status: state.running ? (state.identityLoaded ? "ok" : "degraded") : "stopped",
    daName: state.daName,
    primary_da: state.daName,
    identityLoaded: state.identityLoaded,
    identity_loaded: state.identityLoaded,
    scheduled_tasks: 0,
    last_heartbeat: null,
    diary_entries_today: 0,
    opinions_count: 0,
    uptime: state.startedAt
      ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
      : 0,
  }
}

export function stopAssistant(): void {
  state.running = false
}
