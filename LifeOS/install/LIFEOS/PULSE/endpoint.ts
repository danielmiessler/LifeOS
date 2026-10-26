import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

/**
 * LifeOS Pulse — canonical port + base URL for the local Pulse server.
 *
 * public issue #1618, @asdf8675309
 *
 * Pulse binds IPv4 only (pulse.ts: `hostname: bindAll ? "0.0.0.0" : "127.0.0.1"`),
 * so nothing ever listens on `::1`. On a stock macOS `/etc/hosts`, `localhost`
 * resolves to both `::1` and `127.0.0.1`, and Bun/Node happy-eyeballs will try
 * the IPv6 address first on a share of calls — each one stalls on a dead
 * address before falling back. Hardcoding the IPv4 literal removes the stall
 * without changing behaviour for anyone.
 *
 * The port is a single knob (danielmiessler/LifeOS#2392). Resolution order:
 *   1. PULSE_URL env (full-URL override; also sets the base)
 *   2. PULSE_PORT env
 *   3. PULSE.toml root `port`
 *   4. PULSE.toml [observability.server].port
 *   5. 31337 + stderr warning
 *
 * The warning matters: a wrong port in a security guard is a silent gap,
 * never a silent no-op — a guard aimed at the fallback (or at another
 * install's Pulse on a shared host) should be loud about it.
 *
 * Deliberately dependency-free so hooks, LIFEOS/TOOLS utilities and skill
 * tools can import it without dragging in Pulse's config layer (lib.ts pulls
 * smol-toml and the model registry). lib.ts re-exports it, so Pulse-internal
 * callers can keep importing from there. PULSE.toml is read with a line scan:
 * in valid TOML, root keys must precede any section header, so tracking the
 * current header is a correct read.
 *
 * No trailing slash — callers append paths.
 */

const PORT_RE = /^port\s*=\s*(\d+)\s*(?:#.*)?$/
const SECTION_RE = /^\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/

function isValidPort(n: number): boolean {
  return Number.isInteger(n) && n > 0 && n < 65536
}

/**
 * Extract the configured port from PULSE.toml text. A root `port` wins over
 * [observability.server].port (same precedence as pulse.ts's bind).
 */
export function tomlPort(toml: string): number | null {
  let section = ""
  let root: number | null = null
  let server: number | null = null
  for (const rawLine of toml.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const header = line.match(SECTION_RE)
    if (header) {
      section = header[1].trim()
      continue
    }
    const port = line.match(PORT_RE)
    if (port) {
      const n = parseInt(port[1], 10)
      if (!isValidPort(n)) continue
      if (section === "") root = n
      else if (section === "observability.server") server = n
    }
  }
  return root ?? server
}

/** Resolve the configured Pulse port (precedence above). Warns on fallback. */
export function resolvePulsePort(): number {
  const urlOverride = process.env.PULSE_URL
  if (urlOverride) {
    try {
      const n = parseInt(new URL(urlOverride).port || "0", 10)
      if (isValidPort(n)) return n
    } catch { /* malformed PULSE_URL — fall through */ }
  }
  if (process.env.PULSE_PORT) {
    const n = parseInt(process.env.PULSE_PORT, 10)
    if (isValidPort(n)) return n
  }
  try {
    const installRoot = process.env.LIFEOS_DIR ?? path.join(homedir(), ".claude")
    const toml = readFileSync(path.join(installRoot, "LIFEOS", "PULSE", "PULSE.toml"), "utf8")
    const n = tomlPort(toml)
    if (n !== null) return n
  } catch { /* PULSE.toml absent — fall through to default */ }
  process.stderr.write(
    "⚠️  PULSE: no port configured (PULSE_URL, PULSE_PORT, or PULSE.toml) — defaulting to 31337. " +
      "On a shared host this may collide with another install.\n",
  )
  return 31337
}

export const PULSE_PORT = resolvePulsePort()

export const PULSE_BASE = process.env.PULSE_URL ?? `http://127.0.0.1:${PULSE_PORT}`
