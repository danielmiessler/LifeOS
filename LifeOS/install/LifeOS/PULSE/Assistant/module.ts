/**
 * Assistant module — STUB.
 *
 * pulse.ts imports "./Assistant/module" whenever `config.da.enabled` is true
 * (see pulse.ts's da subsystem wiring) and wires its exports to the
 * `/assistant/*` routes that back the Pulse Assistant tab
 * (Observability/src/app/assistant/page.tsx). No implementation of this
 * module has shipped yet, so every route below returns an honest empty/501
 * response instead of the import silently failing and leaving the tab's
 * fetches unhandled. The frontend already renders a clean empty state for
 * these shapes (see EmptyStateGuide + the `isFreshInstall` check in
 * page.tsx) — this module exists so that behavior is deliberate, not a
 * side-effect of a caught import error.
 *
 * Does NOT create its own HTTP server — pulse.ts calls
 * handleAssistantRequest(). Real identity/personality/diary/cron-CRUD
 * persistence is a separate, larger feature; this stub intentionally does
 * not attempt it.
 */

interface DaConfig {
  enabled: boolean
  primary?: string
  [key: string]: unknown
}

const NOT_IMPLEMENTED =
  "Assistant backend not implemented in this LifeOS release — DA configuration is read-only until this ships."

let primaryDa = ""

export function assistantHealth() {
  return {
    status: "ok",
    primary_da: primaryDa,
    identity_loaded: false,
    scheduled_tasks: 0,
    last_heartbeat: null as string | null,
    diary_entries_today: 0,
    opinions_count: 0,
  }
}

export function startAssistant(daConfig: DaConfig, _jobs: unknown): void {
  primaryDa = daConfig.primary ?? ""
  console.log("[assistant] stub module loaded — DA identity/personality/diary/cron are not yet implemented, serving empty state")
}

export function stopAssistant(): void {
  primaryDa = ""
}

function jsonReadOnly<T>(body: T): Response {
  return Response.json(body)
}

function notImplemented(): Response {
  return Response.json({ error: NOT_IMPLEMENTED }, { status: 501 })
}

export async function handleAssistantRequest(req: Request, pathname: string): Promise<Response | null> {
  const method = req.method

  if (pathname === "/assistant/health") {
    return method === "GET" ? jsonReadOnly(assistantHealth()) : null
  }

  if (pathname === "/assistant/identity") {
    return method === "GET" ? jsonReadOnly(null) : null
  }

  if (pathname === "/assistant/personality") {
    return method === "GET" ? jsonReadOnly(null) : null
  }

  if (pathname === "/assistant/personality/traits") {
    return method === "PATCH" ? notImplemented() : null
  }

  if (pathname === "/assistant/tasks") {
    return method === "GET"
      ? jsonReadOnly({ tasks: [], count: 0, by_source: { da: 0, pulse: 0, "claude-code": 0 } })
      : null
  }

  if (pathname === "/assistant/diary") {
    return method === "GET" ? jsonReadOnly({ entries: [] }) : null
  }

  if (pathname === "/assistant/opinions") {
    return method === "GET" ? jsonReadOnly({ raw: "" }) : null
  }

  if (pathname === "/assistant/cron") {
    if (method === "GET") {
      return jsonReadOnly({ jobs: [], user_file_path: "", counts: { total: 0, enabled: 0, system: 0, user: 0 } })
    }
    if (method === "POST") return notImplemented()
    return null
  }

  if (pathname.startsWith("/assistant/cron/")) {
    if (method === "PATCH" || method === "DELETE") return notImplemented()
    return null
  }

  if (pathname === "/assistant/avatar") {
    return new Response(null, { status: 404 })
  }

  return null
}
