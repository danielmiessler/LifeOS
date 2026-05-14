/**
 * Assistant scheduled tasks dispatcher.
 *
 * Iterates MEMORY/DA/tasks/*.json, fires any one-time task whose `at` time
 * has passed and is still active, and emits its message via Pulse /notify.
 * Recurring tasks are evaluated by Pulse cron, not here. Output sentinel:
 * NO_ACTION when nothing fires.
 */
import { join } from "path"
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs"

const HOME = process.env.HOME ?? ""
const TASKS_DIR = join(HOME, ".claude", "PAI", "MEMORY", "DA", "tasks")
mkdirSync(TASKS_DIR, { recursive: true })

const now = Date.now()
const fired: string[] = []

if (existsSync(TASKS_DIR)) {
  for (const f of readdirSync(TASKS_DIR)) {
    if (!f.endsWith(".json")) continue
    const path = join(TASKS_DIR, f)
    let task: any
    try {
      task = JSON.parse(readFileSync(path, "utf-8"))
    } catch {
      continue
    }
    if (task.status !== "active") continue
    if (task.schedule?.type !== "one-time" || !task.schedule.at) continue
    if (Date.parse(task.schedule.at) > now) continue

    try {
      await fetch("http://localhost:31337/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: task.action?.message ?? task.description, voice_enabled: task.action?.channel === "voice" }),
      })
      task.status = "completed"
      task.completed_at = new Date().toISOString()
      writeFileSync(path, JSON.stringify(task, null, 2))
      fired.push(task.description)
    } catch {
      // leave task active; will retry next run
    }
  }
}

console.log(fired.length === 0 ? "NO_ACTION" : `Fired ${fired.length} task(s): ${fired.join("; ")}`)
