#!/usr/bin/env bun
/**
 * DA Growth Viewer — CLI tool
 *
 * View diary entries, opinions, growth events, and summary for the primary DA.
 *
 * Usage:
 *   bun LIFEOS/TOOLS/DAGrowth.ts diary           # Last 7 diary entries
 *   bun LIFEOS/TOOLS/DAGrowth.ts diary --days 30 # Last 30 days
 *   bun LIFEOS/TOOLS/DAGrowth.ts opinions        # Current opinions
 *   bun LIFEOS/TOOLS/DAGrowth.ts growth          # Growth event log
 *   bun LIFEOS/TOOLS/DAGrowth.ts summary         # Overview
 */

import { join } from "path"
import { getDAName } from "../../hooks/lib/identity"

const HOME = process.env.HOME ?? "~"
const LifeOS = join(HOME, ".claude", "LIFEOS")
const REGISTRY_PATH = join(LifeOS, "USER", "DA", "_registry.yaml")

// ── Types ──

interface DiaryEntry {
  date: string
  interaction_count: number
  topics: string[]
  mood: "positive" | "neutral" | "frustrated"
  avg_rating: number
  notable_moments: string[]
  learning: string | null
}

interface GrowthEvent {
  date: string
  type: string
  detail: string
}

// ── Helpers ──

function parsePrimaryDA(content: string): string {
  const match = content.match(/^primary:\s*(\S+)/m)
  return match?.[1] ?? getDAName()
}

async function readJSONL<T>(path: string): Promise<T[]> {
  try {
    const content = await Bun.file(path).text()
    const lines = content.trim().split("\n").filter(Boolean)
    const items: T[] = []
    for (const line of lines) {
      try { items.push(JSON.parse(line)) } catch {}
    }
    return items
  } catch {
    return []
  }
}

function daysAgoStr(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

const MOOD_ICON: Record<string, string> = {
  positive: "+",
  neutral: "~",
  frustrated: "-",
}

// ── Commands ──

async function cmdDiary(daDir: string, days: number) {
  const entries = await readJSONL<DiaryEntry>(join(daDir, "diary.jsonl"))
  const cutoff = daysAgoStr(days)
  const recent = entries.filter((e) => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date))

  if (recent.length === 0) {
    console.log(`No diary entries in the last ${days} days.`)
    return
  }

  console.log(`\n  DA Diary — Last ${days} Days (${recent.length} entries)\n`)
  console.log("  DATE        MOOD  RATING  SESSIONS  TOPICS")
  console.log("  " + "-".repeat(70))

  for (const e of recent) {
    const moodChar = MOOD_ICON[e.mood] ?? "?"
    const topics = e.topics.slice(0, 3).join(", ")
    const truncTopics = topics.length > 40 ? topics.slice(0, 37) + "..." : topics
    console.log(`  ${e.date}  [${moodChar}]   ${e.avg_rating.toFixed(1).padStart(4)}    ${String(e.interaction_count).padStart(4)}      ${truncTopics}`)
  }

  // Show last entry details
  const last = recent[recent.length - 1]
  console.log(`\n  Latest (${last.date}):`)
  if (last.notable_moments.length > 0) {
    for (const m of last.notable_moments) {
      console.log(`    * ${m}`)
    }
  }
  if (last.learning) {
    console.log(`    Learning: ${last.learning}`)
  }
  console.log()
}

async function cmdOpinions(daDir: string) {
  const content = await Bun.file(join(daDir, "opinions.yaml")).text().catch(() => "")

  if (!content.includes("topic:")) {
    console.log("\n  No opinions formed yet.\n")
    return
  }

  // Simple parse for display
  const blocks = content.split(/^\s*- topic:/m).slice(1)
  const opinions: Array<{ topic: string; position: string; confidence: number; confirmations: number; contradictions: number }> = []

  for (const block of blocks) {
    const get = (key: string) => {
      const m = block.match(new RegExp(`${key}:\\s*"?(.+?)"?\\s*$`, "m"))
      return m?.[1] ?? ""
    }
    opinions.push({
      topic: get("topic"),
      position: get("position"),
      confidence: parseFloat(get("confidence") || "0"),
      confirmations: parseInt(get("confirmations") || "0", 10),
      contradictions: parseInt(get("contradictions") || "0", 10),
    })
  }

  if (opinions.length === 0) {
    console.log("\n  No opinions formed yet.\n")
    return
  }

  opinions.sort((a, b) => b.confidence - a.confidence)

  console.log(`\n  DA Opinions (${opinions.length} total)\n`)
  console.log("  CONF   +/-     TOPIC")
  console.log("  " + "-".repeat(60))

  for (const o of opinions) {
    const bar = "#".repeat(Math.round(o.confidence * 10)).padEnd(10, ".")
    console.log(`  [${bar}] ${String(o.confirmations).padStart(2)}/${String(o.contradictions).padStart(2)}  ${o.topic}`)
    console.log(`  ${"".padStart(15)}${o.position}`)
  }
  console.log()
}

async function cmdGrowth(daDir: string) {
  const events = await readJSONL<GrowthEvent>(join(daDir, "growth.jsonl"))

  if (events.length === 0) {
    console.log("\n  No growth events recorded yet.\n")
    return
  }

  // Show last 20
  const recent = events.slice(-20)
  console.log(`\n  Growth Log (${events.length} total, showing last ${recent.length})\n`)

  for (const e of recent) {
    const typeTag = e.type.replace("opinion_", "").replace("trait_", "").toUpperCase().padEnd(12)
    console.log(`  ${e.date}  ${typeTag}  ${e.detail}`)
  }
  console.log()
}

async function cmdSummary(daDir: string) {
  const entries = await readJSONL<DiaryEntry>(join(daDir, "diary.jsonl"))
  const events = await readJSONL<GrowthEvent>(join(daDir, "growth.jsonl"))
  const opinionsContent = await Bun.file(join(daDir, "opinions.yaml")).text().catch(() => "")
  const opinionCount = (opinionsContent.match(/- topic:/g) ?? []).length

  const last7 = entries.filter((e) => e.date >= daysAgoStr(7))
  const last30 = entries.filter((e) => e.date >= daysAgoStr(30))
  const totalSessions = entries.reduce((sum, e) => sum + e.interaction_count, 0)
  const avgRating7d = last7.length > 0
    ? (last7.reduce((sum, e) => sum + e.avg_rating, 0) / last7.length).toFixed(1)
    : "n/a"
  const avgRating30d = last30.length > 0
    ? (last30.reduce((sum, e) => sum + e.avg_rating, 0) / last30.length).toFixed(1)
    : "n/a"
  const moodCounts = entries.reduce(
    (acc, e) => { acc[e.mood] = (acc[e.mood] ?? 0) + 1; return acc },
    {} as Record<string, number>
  )

  console.log("\n  DA Growth Summary")
  console.log("  " + "=".repeat(40))
  console.log(`  Diary entries:     ${entries.length} total (${last7.length} this week, ${last30.length} this month)`)
  console.log(`  Total sessions:    ${totalSessions}`)
  console.log(`  Avg rating (7d):   ${avgRating7d}`)
  console.log(`  Avg rating (30d):  ${avgRating30d}`)
  console.log(`  Mood breakdown:    + ${moodCounts.positive ?? 0}  ~ ${moodCounts.neutral ?? 0}  - ${moodCounts.frustrated ?? 0}`)
  console.log(`  Opinions:          ${opinionCount}`)
  console.log(`  Growth events:     ${events.length}`)

  if (entries.length > 0) {
    console.log(`  First entry:       ${entries[0].date}`)
    console.log(`  Latest entry:      ${entries[entries.length - 1].date}`)
  }
  console.log()
}

// ── CLI Entry ──

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] ?? "summary"

  let primaryDA = getDAName()
  try {
    const registryContent = await Bun.file(REGISTRY_PATH).text()
    primaryDA = parsePrimaryDA(registryContent)
  } catch {}

  const daDir = join(LifeOS, "USER", "DA", primaryDA)

  switch (command) {
    case "diary": {
      const daysIdx = args.indexOf("--days")
      const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) || 7 : 7
      await cmdDiary(daDir, days)
      break
    }
    case "opinions":
      await cmdOpinions(daDir)
      break
    case "growth":
      await cmdGrowth(daDir)
      break
    case "summary":
      await cmdSummary(daDir)
      break
    default:
      console.log(`Unknown command: ${command}`)
      console.log("Usage: bun DAGrowth.ts [diary|opinions|growth|summary] [--days N]")
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(`DAGrowth error: ${err}`)
  process.exit(1)
})
