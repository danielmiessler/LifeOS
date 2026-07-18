/**
 * LifeOS Pulse — Shared Utilities
 *
 * Cron matching, state I/O, config loading, output dispatch, process spawning.
 * Extracted from Monitor's proven code, stripped to essentials.
 */

import { parse } from "smol-toml"
import { join } from "path"
import { existsSync } from "fs"
import { rename } from "fs/promises"
import { modelForEffort } from "../TOOLS/models.ts"

// ── Types ──

export type OutputTarget = "voice" | "telegram" | "ntfy" | "email" | "log"

export type JobSource = "system" | "user"

export interface Job {
  name: string
  schedule: string
  type: "script" | "claude"
  command?: string
  prompt?: string
  model?: string
  output: OutputTarget | OutputTarget[]
  enabled: boolean
  /**
   * Where this job was loaded from. Not persisted to TOML — set by the
   * loader after parsing. Used by the dashboard to render the source
   * badge and by the API to route writes (always to the user file).
   *
   * - "system": from LIFEOS/PULSE/PULSE.toml (ships in public release)
   * - "user":   from LIFEOS/USER/CONFIG/PULSE.user.toml (private, stripped at release)
   */
  _source?: JobSource
}

export interface DaemonConfig {
  jobs: Job[]
}

// ── User-file path helpers ──
//
// USER_CRON_PATH points inside LIFEOS/USER/**, which is already declared a
// containment-deletion zone in hooks/lib/containment-zones.ts:24. Anything
// written here is automatically stripped from shadow releases. That's the
// structural privacy lever — no separate scrub policy needed.

export const USER_CRON_PATH = join(
  process.env.HOME ?? "~",
  ".claude", "LIFEOS", "USER", "CONFIG", "PULSE.user.toml",
)

export interface JobState {
  lastRun: number
  lastResult: "ok" | "error"
  consecutiveFailures: number
}

export interface DaemonState {
  version: 1
  jobs: Record<string, JobState>
  startedAt: number
}

// ── Env Var Resolution ──
//
// Historically this was applied to exactly one field (a job's `command`), so
// every other `${VAR}` in PULSE.toml was a dead literal. Two silent failures
// followed from that: upstream ships `[notifications.discord] webhook =
// "${DISCORD_WEBHOOK}"` that nothing ever expanded, and any module reading a
// secret straight off the config would hand the literal string "${TOKEN}" to a
// remote API and fail authentication with no local error.
//
// Expansion is now applied to every string value in the parsed config (see
// parseConfigToml), so secrets can live in the environment instead of in the
// file. Substitution semantics are deliberately unchanged from the original
// single-field behaviour — both `$VAR` and `${VAR}` are recognised, and an
// undefined variable resolves to the empty string.
//
// Backward compatibility: the regex only matches a `$` followed by an
// uppercase identifier, so a plain literal value ("ntfy.sh", a cron
// expression, a prose prompt) is returned byte-identical and existing installs
// keep working across an upgrade.

export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/g, (_, name) => process.env[name] ?? "")
}

// Recursively expand env vars in every string reachable from a parsed TOML
// document. Non-string scalars (numbers, booleans, dates) pass through
// untouched; object keys are never rewritten, only values.
function resolveEnvVarsDeep<T>(value: T): T {
  if (typeof value === "string") return resolveEnvVars(value) as unknown as T
  if (Array.isArray(value)) return value.map(resolveEnvVarsDeep) as unknown as T
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveEnvVarsDeep(v)
    }
    return out as unknown as T
  }
  return value
}

/**
 * Parse a Pulse TOML document and expand `${VAR}` / `$VAR` references in all
 * string values against the process environment.
 *
 * This is the single entry point for reading PULSE.toml — both the job loader
 * here and loadPulseConfig() in pulse.ts go through it, so env expansion is a
 * property of the config layer rather than of any one consumer.
 */
export function parseConfigToml(raw: string): Record<string, unknown> {
  return resolveEnvVarsDeep(parse(raw) as Record<string, unknown>)
}

// ── Config Loading ──
//
// Loads PULSE.toml (system) and LIFEOS/USER/CONFIG/PULSE.user.toml (user)
// and merges them into a single Job[]. User-tier jobs override system-tier
// jobs by name (same-name override pattern). Each Job carries a _source
// tag so downstream code can render badges and route writes correctly.
//
// Missing user file is non-fatal — fresh LifeOS installs have system-only
// jobs until the user adds something via the API.

function jobsFromToml(raw: string, source: JobSource): Job[] {
  // parseConfigToml already expanded env vars in every string, including
  // `command` — which is why there is no per-field resolveEnvVars call here
  // any more.
  const parsed = parseConfigToml(raw) as { job?: Array<Record<string, unknown>> }
  return (parsed.job ?? []).map((j) => ({
    name: j.name as string,
    schedule: j.schedule as string,
    type: (j.type as "script" | "claude") ?? "script",
    command: j.command as string | undefined,
    prompt: j.prompt as string | undefined,
    model: (j.model as string) ?? modelForEffort('medium'),
    output: (j.output ?? "log") as OutputTarget | OutputTarget[],
    enabled: (j.enabled as boolean) ?? true,
    _source: source,
  }))
}

export async function loadConfig(daemonDir: string): Promise<DaemonConfig> {
  const systemRaw = await Bun.file(join(daemonDir, "PULSE.toml")).text()
  const systemJobs = jobsFromToml(systemRaw, "system")

  let userJobs: Job[] = []
  if (existsSync(USER_CRON_PATH)) {
    try {
      const userRaw = await Bun.file(USER_CRON_PATH).text()
      userJobs = jobsFromToml(userRaw, "user")
    } catch (err) {
      log("error", "Failed to parse user cron file", { path: USER_CRON_PATH, error: String(err) })
    }
  }

  // Merge: user overrides system by name. Order: system first (in
  // PULSE.toml order), then user-only jobs (in USER file order).
  const userByName = new Map(userJobs.map((j) => [j.name, j]))
  const userOverrideNames = new Set<string>()
  const merged: Job[] = []

  for (const sys of systemJobs) {
    const override = userByName.get(sys.name)
    if (override) {
      userOverrideNames.add(sys.name)
      merged.push(override)
    } else {
      merged.push(sys)
    }
  }

  for (const usr of userJobs) {
    if (!userOverrideNames.has(usr.name)) merged.push(usr)
  }

  return { jobs: merged }
}

// ── Cron Matching (from Monitor/cron/scheduler.ts) ──

interface CronField {
  type: "any" | "values"
  values: number[]
}

function parseField(field: string, min: number, max: number): CronField {
  if (field === "*") return { type: "any", values: [] }

  if (field.includes("/")) {
    const [range, stepStr] = field.split("/")
    const step = parseInt(stepStr, 10)
    const values: number[] = []
    let start = min, end = max
    if (range !== "*") {
      const [s, e] = range.split("-").map(Number)
      start = s
      if (e !== undefined) end = e
    }
    for (let i = start; i <= end; i += step) values.push(i)
    return { type: "values", values }
  }

  if (field.includes(",")) return { type: "values", values: field.split(",").map(Number) }

  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number)
    const values: number[] = []
    for (let i = start; i <= end; i++) values.push(i)
    return { type: "values", values }
  }

  return { type: "values", values: [parseInt(field, 10)] }
}

export function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Invalid cron (need 5 fields): "${expression}"`)

  const fields = [
    parseField(parts[0], 0, 59),
    parseField(parts[1], 0, 23),
    parseField(parts[2], 1, 31),
    parseField(parts[3], 1, 12),
    parseField(parts[4], 0, 6),
  ]
  const actuals = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()]

  return fields.every((f, i) => f.type === "any" || f.values.includes(actuals[i]))
}

export function isDue(schedule: string, now: Date, lastRun?: number): boolean {
  if (!matchesCron(schedule, now)) return false
  if (lastRun === undefined) return true
  // Don't run more than once per minute
  return Math.floor(now.getTime() / 60_000) > Math.floor(lastRun / 60_000)
}

// ── State I/O (atomic write-to-tmp + rename) ──

export async function readState(path: string): Promise<DaemonState> {
  try {
    const file = Bun.file(path)
    if (await file.exists()) return await file.json() as DaemonState
  } catch {}
  return { version: 1, jobs: {}, startedAt: Date.now() }
}

export async function writeState(path: string, state: DaemonState): Promise<void> {
  const tmp = path + ".tmp"
  await Bun.write(tmp, JSON.stringify(state, null, 2))
  await rename(tmp, path)
}

// ── Logging ──

export function log(level: string, msg: string, data?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, msg, ...data }
  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

// ── Output Dispatch ──

export async function dispatch(output: string, target: OutputTarget | OutputTarget[], jobName: string): Promise<void> {
  const targets = Array.isArray(target) ? target : [target]
  await Promise.allSettled(targets.map((t) => dispatchSingle(output, t, jobName)))
}

async function dispatchSingle(output: string, target: OutputTarget, jobName: string): Promise<void> {
  const timeout = 10_000

  try {
    switch (target) {
      case "voice":
        await fetch("http://localhost:31337/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: output.slice(0, 500) }),
          signal: AbortSignal.timeout(timeout),
        })
        break

      case "telegram": {
        const token = process.env.TELEGRAM_BOT_TOKEN
        const chatId = process.env.TELEGRAM_PRINCIPAL_CHAT_ID
        if (!token || !chatId) {
          log("warn", "Telegram dispatch skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_PRINCIPAL_CHAT_ID")
          return
        }
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: output.slice(0, 4096), parse_mode: "Markdown" }),
          signal: AbortSignal.timeout(timeout),
        })
        break
      }

      case "email": {
        const recipient = process.env.GMAIL_USER
        if (!recipient) {
          log("warn", "Email dispatch skipped: missing GMAIL_USER")
          return
        }
        const subject = `LifeOS Pulse: ${jobName}`
        const gwsPath = Bun.which("gws") ?? "/opt/homebrew/bin/gws"
        const proc = Bun.spawn([gwsPath, "gmail", "+send", "--to", recipient, "--subject", subject, "--body", output.slice(0, 50_000)], {
          stdout: "pipe",
          stderr: "pipe",
          env: process.env,
        })
        const timer = setTimeout(() => proc.kill("SIGTERM"), 30_000)
        await proc.exited
        clearTimeout(timer)
        break
      }

      case "ntfy": {
        const topic = process.env.NTFY_TOPIC
        if (!topic) {
          log("warn", "ntfy dispatch skipped: missing NTFY_TOPIC")
          return
        }
        await fetch(`https://ntfy.sh/${topic}`, {
          method: "POST",
          headers: { Title: `LifeOS: ${jobName}`, Priority: "3" },
          body: output.slice(0, 4096),
          signal: AbortSignal.timeout(timeout),
        })
        break
      }

      case "log":
        break
    }
  } catch (err) {
    log("error", `Dispatch to ${target} failed for ${jobName}`, { error: String(err) })
  }
}

// ── Sentinel Check ──

const SENTINELS = ["NO_ACTION", "NO_URGENT", "NO_EVENTS", "HEARTBEAT_OK"]

export function isSentinel(output: string): boolean {
  const trimmed = output.trim()
  return !trimmed || SENTINELS.includes(trimmed)
}

// ── Process Spawning ──

// Resolve bash absolutely so cron-spawned children don't hit ENOENT when the
// inherited PATH is sparse (observed on Linux when Pulse runs under a
// minimal-env service manager). /bin/bash is the POSIX fallback — present on
// macOS natively and on every mainstream Linux distro.
const BASH_PATH = Bun.which("bash") ?? "/bin/bash"

export async function spawnScript(command: string, timeoutMs = 60_000): Promise<string> {
  const proc = Bun.spawn([BASH_PATH, "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: join(process.env.HOME ?? "~", ".claude", "LIFEOS", "PULSE"),
    env: { ...process.env },
  })

  const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs)
  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  clearTimeout(timer)

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Script exited ${exitCode}: ${stderr.slice(0, 200)}`)
  }

  return output.trim()
}

export async function spawnClaude(prompt: string, opts: { model: string; timeoutMs?: number }): Promise<string> {
  // BILLING: Use subscription via OAuth, NOT API key. Two requirements:
  //   1. Remove --bare flag — `--bare` forces ANTHROPIC_API_KEY auth and skips
  //      OAuth/keychain entirely. That was the root cause of the Apr 2026 Haiku
  //      $22.66 line item on the Anthropic invoice (heartbeat + tasks + memory
  //      consolidation all used --bare, all billed API).
  //   2. Strip ANTHROPIC_API_KEY from env — bun auto-loads ~/.claude/.env, and if the
  //      key is present `claude` CLI prefers it over subscription even without
  //      --bare. Mirrors LIFEOS/TOOLS/Inference.ts:114.
  // Flag set mirrors Inference.ts: --tools '' and --setting-sources '' keep the
  // subprocess lightweight (no hooks, no CLAUDE.md auto-discovery), so we still
  // get the cost-reduction benefit --bare was intended to provide.
  const args = [
    "--print",
    "--model", opts.model,
    "--tools", "",
    "--output-format", "text",
    "--setting-sources", "",
    "--system-prompt", "",
  ]
  const claudePath = Bun.which("claude") ?? join(process.env.HOME ?? "~", ".local", "bin", "claude")

  const env: Record<string, string> = { ...process.env, HOME: process.env.HOME ?? "" } as Record<string, string>
  // Strip BOTH keys — Anthropic's precedence chain ranks ANTHROPIC_API_KEY and
  // ANTHROPIC_AUTH_TOKEN above CLAUDE_CODE_OAUTH_TOKEN, so either one in env
  // silently overrides OAuth. Mirrors LIFEOS/TOOLS/Inference.ts:116-117.
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN

  const proc = Bun.spawn([claudePath, ...args], {
    stdin: new Blob([prompt]),
    stdout: "pipe",
    stderr: "pipe",
    env,
  })

  const timeoutMs = opts.timeoutMs ?? 300_000
  const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs)
  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  clearTimeout(timer)

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`claude exited ${exitCode}: ${stderr.slice(0, 200)}`)
  }

  return output.trim()
}
