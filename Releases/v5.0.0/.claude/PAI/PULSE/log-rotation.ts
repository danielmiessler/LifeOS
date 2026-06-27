import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, truncateSync, unlinkSync } from "fs"
import { join } from "path"
import { getPaiDir } from "../TOOLS/lib/runtime-paths"

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_KEEP = 3
const DEFAULT_INTERVAL_MS = 60 * 1000

export interface LogRotationOptions {
  maxBytes?: number
  keep?: number
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function maxBytesFromEnv(): number {
  const explicitBytes = positiveInteger(process.env.PAI_PULSE_LOG_MAX_BYTES)
  if (explicitBytes) return explicitBytes

  const explicitMb = positiveInteger(process.env.PAI_PULSE_LOG_MAX_MB)
  return explicitMb ? explicitMb * 1024 * 1024 : DEFAULT_MAX_BYTES
}

function rotationOptions(options: LogRotationOptions = {}): Required<LogRotationOptions> {
  return {
    maxBytes: options.maxBytes ?? maxBytesFromEnv(),
    keep: options.keep ?? positiveInteger(process.env.PAI_PULSE_LOG_KEEP) ?? DEFAULT_KEEP,
  }
}

function rotateExistingArchives(filePath: string, keep: number): void {
  const oldest = `${filePath}.${keep}`
  if (existsSync(oldest)) unlinkSync(oldest)

  for (let index = keep - 1; index >= 1; index--) {
    const current = `${filePath}.${index}`
    if (existsSync(current)) {
      renameSync(current, `${filePath}.${index + 1}`)
    }
  }
}

export function rotateLogFile(filePath: string, options: LogRotationOptions = {}): boolean {
  if (!existsSync(filePath)) return false

  const { maxBytes, keep } = rotationOptions(options)
  if (keep < 1) return false

  const stat = statSync(filePath)
  if (!stat.isFile() || stat.size < maxBytes) return false

  rotateExistingArchives(filePath, keep)
  copyFileSync(filePath, `${filePath}.1`)
  truncateSync(filePath, 0)
  return true
}

export function rotatePulseLogs(
  pulseDir = join(getPaiDir(import.meta.dir), "PULSE"),
  options: LogRotationOptions = {},
): string[] {
  const logsDir = join(pulseDir, "logs")
  if (!existsSync(logsDir)) return []

  const rotated: string[] = []
  for (const entry of readdirSync(logsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".log")) continue

    const filePath = join(logsDir, entry.name)
    if (rotateLogFile(filePath, options)) rotated.push(filePath)
  }
  return rotated
}

export function startPulseLogRotation(
  pulseDir = join(getPaiDir(import.meta.dir), "PULSE"),
  intervalMs = DEFAULT_INTERVAL_MS,
): ReturnType<typeof setInterval> {
  mkdirSync(join(pulseDir, "logs"), { recursive: true })
  rotatePulseLogs(pulseDir)

  const timer = setInterval(() => {
    try {
      rotatePulseLogs(pulseDir)
    } catch {
      // Logging about log rotation can itself target the files being rotated.
    }
  }, intervalMs)
  timer.unref?.()
  return timer
}

if (import.meta.main) {
  const rotated = rotatePulseLogs()
  if (rotated.length > 0) {
    console.log(`Rotated ${rotated.length} Pulse log file(s).`)
  } else {
    console.log("No Pulse logs needed rotation.")
  }
}
