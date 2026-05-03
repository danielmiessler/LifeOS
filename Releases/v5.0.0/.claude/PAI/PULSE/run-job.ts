#!/usr/bin/env bun
/**
 * Manually run a specific Pulse job by name.
 * Usage: bun run run-job.ts <job-name>
 */
import { join } from "path"
import { readFileSync } from "fs"

// Load .env
const envPath = join(process.env.HOME ?? "~", ".claude", ".env")
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
} catch {}

import { loadConfig, spawnClaude, spawnScript, dispatch, isSentinel, log } from "./lib"

const jobName = process.argv[2]
if (!jobName) {
  console.error("Usage: bun run run-job.ts <job-name>")
  process.exit(1)
}

const PULSE_DIR = join(process.env.HOME ?? "~", ".claude", "PAI", "PULSE")
const config = await loadConfig(PULSE_DIR)
const job = config.jobs.find((j) => j.name === jobName)
if (!job) {
  console.error(`Job "${jobName}" not found. Available: ${config.jobs.map((j) => j.name).join(", ")}`)
  process.exit(1)
}

log("info", `Manual run: ${job.name}`, { type: job.type })
const start = Date.now()

let output: string
if (job.type === "claude") {
  output = await spawnClaude(job.prompt!, { model: job.model ?? "sonnet" })
} else {
  output = await spawnScript(job.command!)
}

const durationMs = Date.now() - start

if (isSentinel(output)) {
  log("info", `${job.name} — nothing to report`, { durationMs })
} else {
  console.log("\n--- OUTPUT ---\n")
  console.log(output)
  console.log("\n--- DISPATCHING ---\n")
  await dispatch(output, job.output, job.name)
  log("info", `${job.name} — dispatched`, { durationMs })
}
