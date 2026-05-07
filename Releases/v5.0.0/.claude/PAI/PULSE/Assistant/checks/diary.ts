#!/usr/bin/env bun
/**
 * DA Daily Diary — runs at 11 PM via PULSE.toml
 *
 * Reads today's ratings and work, writes a diary entry to kai/diary.jsonl.
 * Output: "Diary entry written" or NO_ACTION
 */

import { join } from "path"
import { existsSync, readFileSync, appendFileSync, readdirSync, statSync } from "fs"
import { spawnClaude } from "../../lib"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const REGISTRY_PATH = join(PAI_DIR, "USER", "DA", "_registry.yaml")
const RATINGS_PATH = join(PAI_DIR, "MEMORY", "LEARNING", "SIGNALS", "ratings.jsonl")
const WORK_DIR = join(PAI_DIR, "MEMORY", "WORK")

function parsePrimary(content: string): string | null {
  return content.match(/^primary:\s*(\S+)/m)?.[1] ?? null
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

interface RatingSignal { timestamp: string; rating: number; comment?: string }

function getTodayRatings(): RatingSignal[] {
  if (!existsSync(RATINGS_PATH)) return []
  const today = todayStr()
  return readFileSync(RATINGS_PATH, "utf-8")
    .split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as RatingSignal } catch { return null } })
    .filter(Boolean)
    .filter((r) => r!.timestamp.startsWith(today)) as RatingSignal[]
}

function getTodayWork(): string[] {
  if (!existsSync(WORK_DIR)) return []
  const cutoff = new Date(todayStr() + "T00:00:00").getTime()
  const topics: string[] = []
  try {
    for (const entry of readdirSync(WORK_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const isaPath = join(WORK_DIR, entry.name, "ISA.md")
      if (!existsSync(isaPath)) continue
      if (statSync(isaPath).mtimeMs < cutoff) continue
      const title = readFileSync(isaPath, "utf-8")
        .split("\n").find((l) => l.startsWith("# "))?.replace(/^# /, "")
      if (title) topics.push(title)
    }
  } catch { /* skip */ }
  return topics
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) { console.log("NO_ACTION"); return }
  const primary = parsePrimary(readFileSync(REGISTRY_PATH, "utf-8"))
  if (!primary) { console.log("NO_ACTION"); return }

  const diaryPath = join(PAI_DIR, "USER", "DA", primary, "diary.jsonl")

  const ratings = getTodayRatings()
  const topics = getTodayWork()

  if (ratings.length === 0 && topics.length === 0) {
    console.log("NO_ACTION")
    return
  }

  const avgRating = ratings.length > 0
    ? ratings.reduce((a, b) => a + b.rating, 0) / ratings.length
    : null

  const mood: "positive" | "neutral" | "frustrated" =
    avgRating === null ? "neutral" : avgRating >= 7 ? "positive" : avgRating >= 4 ? "neutral" : "frustrated"

  const prompt = `You are ${primary}, writing your daily diary entry.

Today's data:
- Topics worked on: ${topics.length > 0 ? topics.join(", ") : "nothing tracked"}
- Ratings: ${ratings.length > 0 ? ratings.map((r) => r.rating).join(", ") : "none"}
- Average rating: ${avgRating?.toFixed(1) ?? "n/a"}
- Mood: ${mood}

Write a single concise diary entry (2-3 sentences max) capturing what happened and one thing learned or observed. Be specific and personal, not generic.
Output ONLY the diary text — no preamble, no JSON.`

  try {
    const diaryText = (await spawnClaude(prompt, { model: "haiku", timeoutMs: 30_000 })).trim()

    const entry = {
      date: todayStr(),
      interaction_count: ratings.length,
      topics,
      mood,
      avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      notable_moments: [diaryText],
      learning: null,
    }

    appendFileSync(diaryPath, JSON.stringify(entry) + "\n")
    console.log(`Diary entry written for ${todayStr()}`)
  } catch {
    console.log("NO_ACTION")
  }
}

main().catch(() => console.log("NO_ACTION"))
