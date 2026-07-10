#!/usr/bin/env bun
/**
 * DASchedule — CLI for managing DA scheduled tasks
 *
 * Usage:
 *   bun LIFEOS/TOOLS/DASchedule.ts list              # Active tasks
 *   bun LIFEOS/TOOLS/DASchedule.ts add --desc "..." --at "2026-04-07T09:00:00" --channel voice
 *   bun LIFEOS/TOOLS/DASchedule.ts add --desc "..." --cron "0 15 * * 5" --channel telegram
 *   bun LIFEOS/TOOLS/DASchedule.ts cancel <id>
 *   bun LIFEOS/TOOLS/DASchedule.ts history            # Completed/cancelled
 */

import { join } from "path"
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs"
import { getDAName } from "../../hooks/lib/identity"

const HOME = process.env.HOME ?? "~"
const LIFEOS_DIR = join(HOME, ".claude", "LIFEOS")
const TASKS_DIR = join(LIFEOS_DIR, "PULSE", "state", "da")
const TASKS_PATH = join(TASKS_DIR, "scheduled-tasks.jsonl")

// ── Types ──

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
    type: "notify" | "prompt" | "script"
    message?: string
    channel?: string
    prompt?: string
    model?: string
    command?: string
  }
  status: "active" | "completed" | "cancelled"
  last_fired?: string
  fire_count: number
}

// ── Task Store I/O ──

function ensureDir(): void {
  if (!existsSync(TASKS_DIR)) {
    mkdirSync(TASKS_DIR, { recursive: true })
  }
}

function readTasks(): ScheduledTask[] {
  try {
    if (!existsSync(TASKS_PATH)) return []
    const content = readFileSync(TASKS_PATH, "utf-8")
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ScheduledTask)
  } catch {
    return []
  }
}

function writeTasks(tasks: ScheduledTask[]): void {
  ensureDir()
  const content = tasks.map((t) => JSON.stringify(t)).join("\n") + "\n"
  writeFileSync(TASKS_PATH, content)
}

function appendTask(task: ScheduledTask): void {
  ensureDir()
  appendFileSync(TASKS_PATH, JSON.stringify(task) + "\n")
}

// ── CLI Argument Parsing ──

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2)
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true"
      result[key] = value
      if (value !== "true") i++
    }
  }
  return result
}

// ── Commands ──

function listTasks(filter: "active" | "all" | "history" = "active"): void {
  const tasks = readTasks()
  const filtered = filter === "active"
    ? tasks.filter((t) => t.status === "active")
    : filter === "history"
      ? tasks.filter((t) => t.status !== "active")
      : tasks

  if (filtered.length === 0) {
    console.log(filter === "history" ? "No completed or cancelled tasks." : "No active scheduled tasks.")
    return
  }

  console.log(`\n${"ID".padEnd(24)} ${"Status".padEnd(12)} ${"Schedule".padEnd(24)} ${"Description".padEnd(40)} Fired`)
  console.log("─".repeat(110))

  for (const task of filtered) {
    const schedule = task.schedule.type === "once"
      ? `once @ ${task.schedule.at?.slice(0, 16) ?? "?"}`
      : `cron: ${task.schedule.cron ?? "?"}`
    const status = task.status
    console.log(
      `${task.id.padEnd(24)} ${status.padEnd(12)} ${schedule.padEnd(24)} ${task.description.slice(0, 40).padEnd(40)} ${task.fire_count}`
    )
  }
  console.log("")
}

function addTask(args: Record<string, string>): void {
  const desc = args.desc ?? args.description
  if (!desc) {
    console.error("Error: --desc is required")
    process.exit(1)
  }

  const hasAt = !!args.at
  const hasCron = !!args.cron

  if (!hasAt && !hasCron) {
    console.error("Error: --at (ISO datetime) or --cron (5-field) is required")
    process.exit(1)
  }

  const channel = args.channel ?? "voice"
  const actionType = args.type ?? "notify"
  const message = args.message ?? desc

  const task: ScheduledTask = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    created_by: args.by ?? getDAName(),
    description: desc,
    schedule: hasCron
      ? { type: "recurring", cron: args.cron, until: args.until }
      : { type: "once", at: args.at },
    action: {
      type: actionType as "notify" | "prompt" | "script",
      message: actionType === "notify" ? message : undefined,
      channel,
      prompt: actionType === "prompt" ? args.prompt : undefined,
      model: args.model,
      command: actionType === "script" ? args.command : undefined,
    },
    status: "active",
    fire_count: 0,
  }

  appendTask(task)
  console.log(`Task created: ${task.id}`)
  console.log(`  Description: ${task.description}`)
  console.log(`  Schedule: ${hasCron ? `cron ${args.cron}` : `once at ${args.at}`}`)
  console.log(`  Action: ${actionType} → ${channel}`)
}

function cancelTask(id: string): void {
  const tasks = readTasks()
  const task = tasks.find((t) => t.id === id)
  if (!task) {
    // Try partial match
    const matches = tasks.filter((t) => t.id.startsWith(id))
    if (matches.length === 1) {
      matches[0].status = "cancelled"
      writeTasks(tasks)
      console.log(`Cancelled: ${matches[0].id} — "${matches[0].description}"`)
      return
    }
    if (matches.length > 1) {
      console.error(`Ambiguous ID "${id}" — matches ${matches.length} tasks. Be more specific.`)
      process.exit(1)
    }
    console.error(`Task not found: ${id}`)
    process.exit(1)
  }

  task.status = "cancelled"
  writeTasks(tasks)
  console.log(`Cancelled: ${task.id} — "${task.description}"`)
}

// ── Main ──

const [command, ...rest] = process.argv.slice(2)

switch (command) {
  case "list":
  case "ls":
    listTasks("active")
    break

  case "all":
    listTasks("all")
    break

  case "history":
  case "hist":
    listTasks("history")
    break

  case "add":
  case "create": {
    const args = parseArgs(rest)
    addTask(args)
    break
  }

  case "cancel":
  case "rm":
  case "remove": {
    const id = rest[0]
    if (!id) {
      console.error("Usage: cancel <task-id>")
      process.exit(1)
    }
    cancelTask(id)
    break
  }

  default:
    console.log(`DASchedule — DA Scheduled Task Manager

Usage:
  bun LIFEOS/TOOLS/DASchedule.ts list                           Active tasks
  bun LIFEOS/TOOLS/DASchedule.ts add --desc "..." --at "ISO"    One-time task
  bun LIFEOS/TOOLS/DASchedule.ts add --desc "..." --cron "..."  Recurring task
  bun LIFEOS/TOOLS/DASchedule.ts cancel <id>                    Cancel task
  bun LIFEOS/TOOLS/DASchedule.ts history                        Completed/cancelled

Options:
  --desc      Task description (required)
  --at        ISO datetime for one-time tasks
  --cron      5-field cron for recurring tasks
  --channel   voice | telegram (default: voice)
  --type      notify | prompt | script (default: notify)
  --message   Notification message (default: desc)
  --prompt    Prompt text (for type=prompt)
  --model     LLM model (for type=prompt, default: haiku)
  --command   Shell command (for type=script)
  --until     Expiry ISO datetime (for recurring)
  --by        Creator name (default: ${getDAName()})`)
    break
}
