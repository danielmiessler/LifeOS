#!/usr/bin/env bun
/**
 * DA Heartbeat — runs every 30 min via PULSE.toml
 *
 * Layer 1: gather context (free, deterministic)
 * Layer 2: Haiku evaluates whether action is needed
 * Output: notification string → voice, or NO_ACTION
 */

import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { spawnClaude } from "../../lib"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const REGISTRY_PATH = join(PAI_DIR, "USER", "DA", "_registry.yaml")
const RATINGS_PATH = join(PAI_DIR, "MEMORY", "LEARNING", "SIGNALS", "ratings.jsonl")
const TASKS_PATH = join(PAI_DIR, "PULSE", "state", "da", "scheduled-tasks.jsonl")
const WORK_DIR = join(PAI_DIR, "MEMORY", "WORK")

function parsePrimary(content: string): string | null {
  return content.match(/^primary:\s*(\S+)/m)?.[1] ?? null
}

function readJsonlTail<T>(path: string, n: number): T[] {
  if (!existsSync(path)) return []
  const lines = readFileSync(path, "utf-8").trim().split("\n").filter(Boolean)
  return lines.slice(-n).map((l) => { try { return JSON.parse(l) as T } catch { return null } }).filter(Boolean) as T[]
}

interface RatingSignal { timestamp: string; rating: number }
interface ScheduledTask { status: string; schedule: { type: string; at?: string; cron?: string }; description: string }

function getRecentRatings(): number[] {
  return readJsonlTail<RatingSignal>(RATINGS_PATH, 3).map((r) => r.rating)
}

function getPendingTasks(): string[] {
  const now = Date.now()
  const tasks = readJsonlTail<ScheduledTask>(TASKS_PATH, 50)
  return tasks
    .filter((t) => t.status === "active" && t.schedule.type === "once" && t.schedule.at)
    .filter((t) => new Date(t.schedule.at!).getTime() <= now + 15 * 60 * 1000)
    .map((t) => t.description)
}

function getActiveWork(): string | null {
  if (!existsSync(WORK_DIR)) return null
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  try {
    const { readdirSync, statSync } = require("fs") as typeof import("fs")
    for (const entry of readdirSync(WORK_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const isaPath = join(WORK_DIR, entry.name, "ISA.md")
      if (existsSync(isaPath) && statSync(isaPath).mtimeMs > cutoff) {
        const firstLine = readFileSync(isaPath, "utf-8").split("\n").find((l) => l.startsWith("# "))
        return firstLine?.replace(/^# /, "") ?? entry.name
      }
    }
  } catch { /* skip */ }
  return null
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) {
    console.log("NO_ACTION")
    return
  }

  const primary = parsePrimary(readFileSync(REGISTRY_PATH, "utf-8"))
  if (!primary) {
    console.log("NO_ACTION")
    return
  }

  const daIdentityPath = join(PAI_DIR, "USER", "DA", primary, "DA_IDENTITY.yaml")
  if (!existsSync(daIdentityPath)) {
    console.log("NO_ACTION")
    return
  }

  const recentRatings = getRecentRatings()
  const pendingTasks = getPendingTasks()
  const activeWork = getActiveWork()

  const avgRating = recentRatings.length > 0
    ? (recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length).toFixed(1)
    : null

  const context = {
    timestamp: new Date().toISOString(),
    da_name: primary,
    recent_ratings: recentRatings,
    avg_rating: avgRating,
    active_work: activeWork,
    pending_tasks_due_soon: pendingTasks,
  }

  const prompt = `You are ${primary}, an AI assistant for Bryce.

Review this context snapshot and decide if you should proactively notify Bryce.

RULES:
- Default to NO_ACTION. Only act when genuinely useful.
- Notify if: a task is due within 15 minutes, ratings show sustained frustration (avg < 3 for 3 signals), or work has been stalled >20h.
- Keep notifications under 20 words.
- Respond with ONLY: NO_ACTION or a short notification message (no JSON, no preamble).

Context:
${JSON.stringify(context, null, 2)}`

  try {
    const result = await spawnClaude(prompt, { model: "haiku", timeoutMs: 30_000 })
    const trimmed = result.trim()
    console.log(trimmed || "NO_ACTION")
  } catch {
    console.log("NO_ACTION")
  }
}

main().catch(() => console.log("NO_ACTION"))
