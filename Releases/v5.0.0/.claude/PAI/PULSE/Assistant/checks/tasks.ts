#!/usr/bin/env bun
/**
 * DA Scheduled Task Evaluator — runs every minute via PULSE.toml
 *
 * Reads state/da/scheduled-tasks.jsonl, fires tasks that are due,
 * updates their status, rewrites the file.
 * Output: notification string → voice, or NO_ACTION
 */

import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const TASKS_DIR = join(PAI_DIR, "PULSE", "state", "da")
const TASKS_PATH = join(TASKS_DIR, "scheduled-tasks.jsonl")

interface ScheduledTask {
  id: string
  created_at: string
  created_by: string
  description: string
  schedule: {
    type: "once" | "recurring"
    at?: string
    cron?: string
    until?: string
  }
  action: {
    type: "notify" | "script"
    message?: string
    channel?: string
    command?: string
  }
  status: "active" | "completed" | "cancelled"
  last_fired?: string
  fire_count: number
}

function readTasks(): ScheduledTask[] {
  if (!existsSync(TASKS_PATH)) return []
  return readFileSync(TASKS_PATH, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as ScheduledTask } catch { return null } })
    .filter(Boolean) as ScheduledTask[]
}

function writeTasks(tasks: ScheduledTask[]): void {
  mkdirSync(TASKS_DIR, { recursive: true })
  writeFileSync(TASKS_PATH, tasks.map((t) => JSON.stringify(t)).join("\n") + "\n")
}

// Minimal 5-field cron matcher: minute hour dom month dow
function cronMatches(expr: string, d: Date): boolean {
  const [min, hr, dom, mon, dow] = expr.split(" ")
  const matches = (field: string, val: number): boolean => {
    if (field === "*") return true
    if (field.includes(",")) return field.split(",").some((f) => matches(f, val))
    if (field.includes("/")) {
      const [base, step] = field.split("/")
      const start = base === "*" ? 0 : parseInt(base)
      return (val - start) % parseInt(step) === 0 && val >= start
    }
    if (field.includes("-")) {
      const [lo, hi] = field.split("-").map(Number)
      return val >= lo && val <= hi
    }
    return parseInt(field) === val
  }
  return (
    matches(min, d.getMinutes()) &&
    matches(hr, d.getHours()) &&
    matches(dom, d.getDate()) &&
    matches(mon, d.getMonth() + 1) &&
    matches(dow, d.getDay())
  )
}

async function main() {
  const tasks = readTasks()
  if (tasks.length === 0) {
    console.log("NO_ACTION")
    return
  }

  const now = new Date()
  const notifications: string[] = []
  let changed = false

  for (const task of tasks) {
    if (task.status !== "active") continue

    let due = false
    if (task.schedule.type === "once" && task.schedule.at) {
      due = new Date(task.schedule.at).getTime() <= now.getTime()
    } else if (task.schedule.type === "recurring" && task.schedule.cron) {
      due = cronMatches(task.schedule.cron, now)
      // Prevent double-firing: skip if fired within the last 55 seconds
      if (due && task.last_fired) {
        const lastFiredMs = new Date(task.last_fired).getTime()
        if (now.getTime() - lastFiredMs < 55_000) due = false
      }
    }

    if (!due) continue

    if (task.action.type === "notify" && task.action.message) {
      notifications.push(task.action.message)
    } else if (task.action.type === "script" && task.action.command) {
      try {
        const proc = Bun.spawn(["bash", "-c", task.action.command], { stdout: "pipe", stderr: "pipe" })
        await proc.exited
      } catch { /* non-fatal */ }
    }

    task.last_fired = now.toISOString()
    task.fire_count = (task.fire_count ?? 0) + 1
    if (task.schedule.type === "once") task.status = "completed"
    changed = true
  }

  if (changed) writeTasks(tasks)

  if (notifications.length === 0) {
    console.log("NO_ACTION")
  } else {
    console.log(notifications.join(". "))
  }
}

main().catch(() => console.log("NO_ACTION"))
