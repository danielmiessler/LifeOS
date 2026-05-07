#!/usr/bin/env bun
/**
 * DA Weekly Growth Review — runs Sunday 4 AM via PULSE.toml
 *
 * Reads last 7 diary entries, synthesizes patterns, appends to growth.jsonl.
 * Output: "Growth review complete" or NO_ACTION
 */

import { join } from "path"
import { existsSync, readFileSync, appendFileSync } from "fs"
import { spawnClaude } from "../../lib"

const HOME = process.env.HOME ?? ""
const PAI_DIR = join(HOME, ".claude", "PAI")
const REGISTRY_PATH = join(PAI_DIR, "USER", "DA", "_registry.yaml")

function parsePrimary(content: string): string | null {
  return content.match(/^primary:\s*(\S+)/m)?.[1] ?? null
}

interface DiaryEntry {
  date: string
  interaction_count: number
  topics: string[]
  mood: string
  avg_rating: number | null
  notable_moments: string[]
}

function readLastDiaryEntries(diaryPath: string, n: number): DiaryEntry[] {
  if (!existsSync(diaryPath)) return []
  return readFileSync(diaryPath, "utf-8")
    .split("\n").filter(Boolean)
    .slice(-n)
    .map((l) => { try { return JSON.parse(l) as DiaryEntry } catch { return null } })
    .filter(Boolean) as DiaryEntry[]
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) { console.log("NO_ACTION"); return }
  const primary = parsePrimary(readFileSync(REGISTRY_PATH, "utf-8"))
  if (!primary) { console.log("NO_ACTION"); return }

  const daDir = join(PAI_DIR, "USER", "DA", primary)
  const diaryPath = join(daDir, "diary.jsonl")
  const growthPath = join(daDir, "growth.jsonl")

  const entries = readLastDiaryEntries(diaryPath, 7)
  if (entries.length === 0) { console.log("NO_ACTION"); return }

  const summary = entries.map((e) =>
    `${e.date}: topics=[${e.topics.join(", ")}], mood=${e.mood}, rating=${e.avg_rating ?? "n/a"}, notes="${e.notable_moments.join("; ")}"`
  ).join("\n")

  const prompt = `You are ${primary}, doing a weekly growth review.

Diary entries from the past week:
${summary}

Identify 1-2 patterns or insights. What is Bryce working toward? What friction is repeating? What preference is becoming clear?
Output ONLY 2-3 concise sentences — no preamble, no JSON.`

  try {
    const insight = (await spawnClaude(prompt, { model: "haiku", timeoutMs: 30_000 })).trim()
    if (!insight) { console.log("NO_ACTION"); return }

    const event = {
      timestamp: new Date().toISOString(),
      type: "weekly_growth_review",
      entries_analyzed: entries.length,
      insight,
    }

    appendFileSync(growthPath, JSON.stringify(event) + "\n")
    console.log("Growth review complete")
  } catch {
    console.log("NO_ACTION")
  }
}

main().catch(() => console.log("NO_ACTION"))
