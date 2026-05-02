/**
 * Example Pulse Module
 *
 * Copy this file and rename it to create your own custom module.
 * Register it in PULSE.toml under [modules].
 *
 * A module must export: start(), stop(), health(), and handleRequest()
 */

const MODULE_NAME = "example"

interface ModuleState {
  running: boolean
  startedAt: Date | null
}

const state: ModuleState = {
  running: false,
  startedAt: null,
}

export async function start(): Promise<void> {
  console.log(`[${MODULE_NAME}] Starting...`)
  state.running = true
  state.startedAt = new Date()

  // Initialize your module here
  // Example: set up watchers, connect to services, start polling

  console.log(`[${MODULE_NAME}] Started`)
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE_NAME}] Stopping...`)
  state.running = false

  // Clean up resources here
  // Example: close connections, stop watchers, flush buffers

  console.log(`[${MODULE_NAME}] Stopped`)
}

export function health(): { status: string; details?: Record<string, unknown> } {
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      uptime: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
    },
  }
}

export async function handleRequest(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  // Handle HTTP requests routed to your module
  // Pulse routes /api/{module_name}/* to handleRequest

  if (path === "/status") {
    return Response.json(health())
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}
