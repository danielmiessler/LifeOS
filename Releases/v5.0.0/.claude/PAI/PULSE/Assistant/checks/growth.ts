#!/usr/bin/env bun
/**
 * DA Weekly Growth Review — runs Sunday 4 AM via PULSE.toml
 *
 * Reads last 7 diary entries, synthesizes patterns, appends to growth.jsonl.
 * Also updates opinions.yaml: new opinions, confirmations, contradictions, decay, pruning.
 * Output: "Growth review complete" or NO_ACTION
 */

import { join } from "path"
import { existsSync, readFileSync, appendFileSync, writeFileSync, renameSync } from "fs"
import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
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

interface Opinion {
  topic: string
  belief: string
  confidence: number
  source: "observation" | "inference" | "stated"
  evidence_count: number
  first_observed: string
  last_confirmed: string
}

interface OpinionOp {
  action: "add" | "confirm" | "contradict"
  topic: string
  belief?: string
  source?: Opinion["source"]
  new_belief?: string
}

function readLastDiaryEntries(diaryPath: string, n: number): DiaryEntry[] {
  if (!existsSync(diaryPath)) return []
  return readFileSync(diaryPath, "utf-8")
    .split("\n").filter(Boolean)
    .slice(-n)
    .map((l) => { try { return JSON.parse(l) as DiaryEntry } catch { return null } })
    .filter(Boolean) as DiaryEntry[]
}

function readOpinions(opinionsPath: string): Opinion[] {
  if (!existsSync(opinionsPath)) return []
  try {
    const parsed = parseYaml(readFileSync(opinionsPath, "utf-8")) as { opinions?: Opinion[] }
    return Array.isArray(parsed?.opinions) ? parsed.opinions : []
  } catch { return [] }
}

function writeOpinions(opinionsPath: string, opinions: Opinion[]): void {
  const header = "# DA Opinions\n# Confidence-weighted beliefs, updated by weekly growth engine.\n# confidence: 0.0 (speculation) → 1.0 (repeatedly confirmed)\n\n"
  const tmp = opinionsPath + ".tmp"
  writeFileSync(tmp, header + stringifyYaml({ opinions }))
  renameSync(tmp, opinionsPath)
}

function applyOps(opinions: Opinion[], ops: OpinionOp[], today: string): Opinion[] {
  const updated = [...opinions]
  for (const op of ops) {
    const idx = updated.findIndex((o) => o.topic.toLowerCase() === op.topic.toLowerCase())
    if (op.action === "add" && idx === -1 && op.belief) {
      updated.push({
        topic: op.topic,
        belief: op.belief,
        confidence: op.source === "stated" ? 0.8 : 0.5,
        source: op.source ?? "observation",
        evidence_count: 1,
        first_observed: today,
        last_confirmed: today,
      })
    } else if (op.action === "confirm" && idx !== -1) {
      const cur = updated[idx]
      updated[idx] = {
        ...cur,
        confidence: cur.confidence + 0.05 * (1 - cur.confidence),
        evidence_count: cur.evidence_count + 1,
        last_confirmed: today,
        ...(op.new_belief ? { belief: op.new_belief } : {}),
      }
    } else if (op.action === "contradict" && idx !== -1) {
      updated[idx] = { ...updated[idx], confidence: Math.max(0, updated[idx].confidence - 0.15) }
    }
  }
  return updated
}

function decayAndPrune(opinions: Opinion[], now: Date): Opinion[] {
  const nowMs = now.getTime()
  const monthMs = 30 * 24 * 60 * 60 * 1000
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
  return opinions
    .map((op) => {
      const monthsUnconfirmed = (nowMs - new Date(op.last_confirmed).getTime()) / monthMs
      return { ...op, confidence: Math.max(0, op.confidence - 0.02 * monthsUnconfirmed) }
    })
    .filter((op) =>
      op.confidence >= 0.3 || (nowMs - new Date(op.first_observed).getTime()) < ninetyDaysMs
    )
    .slice(0, 50)
}

async function main() {
  if (!existsSync(REGISTRY_PATH)) { console.log("NO_ACTION"); return }
  const primary = parsePrimary(readFileSync(REGISTRY_PATH, "utf-8"))
  if (!primary) { console.log("NO_ACTION"); return }

  const daDir = join(PAI_DIR, "USER", "DA", primary)
  const diaryPath = join(daDir, "diary.jsonl")
  const growthPath = join(daDir, "growth.jsonl")
  const opinionsPath = join(daDir, "opinions.yaml")
  const daIdentityPath = join(daDir, "DA_IDENTITY.yaml")
  const principalName = existsSync(daIdentityPath)
    ? (readFileSync(daIdentityPath, "utf-8").match(/^\s*principal:\s*["']?([^"'\n#]+)["']?/m)?.[1]?.trim() ?? "the principal")
    : "the principal"

  const entries = readLastDiaryEntries(diaryPath, 7)
  if (entries.length === 0) { console.log("NO_ACTION"); return }

  const summary = entries.map((e) =>
    `${e.date}: topics=[${e.topics.join(", ")}], mood=${e.mood}, rating=${e.avg_rating ?? "n/a"}, notes="${e.notable_moments.join("; ")}"`
  ).join("\n")

  const existingOpinions = readOpinions(opinionsPath)
  const now = new Date()
  const today = now.toISOString().split("T")[0]

  try {
    const insightPrompt = `You are ${primary}, doing a weekly growth review.

Diary entries from the past week:
${summary}

Identify 1-2 patterns or insights. What is ${principalName} working toward? What friction is repeating? What preference is becoming clear?
Output ONLY 2-3 concise sentences — no preamble, no JSON.`

    const insight = (await spawnClaude(insightPrompt, { model: "haiku", timeoutMs: 30_000 })).trim()
    if (!insight) { console.log("NO_ACTION"); return }

    const opinionPrompt = `You are ${primary}, updating your opinion model about ${principalName} based on this week's diary.

Existing opinions:
${JSON.stringify(existingOpinions.map((o) => ({ topic: o.topic, belief: o.belief, confidence: o.confidence })), null, 2)}

Diary summary:
${summary}

Return ONLY a JSON array of opinion operations. Use [] if no clear signals:
[
  {"action": "add", "topic": "...", "belief": "...", "source": "observation"},
  {"action": "confirm", "topic": "<exact existing topic>"},
  {"action": "contradict", "topic": "<exact existing topic>"}
]
Rules:
- Add 0-3 new opinions max; only if clearly supported by the diary
- source must be "stated" (principal said it), "observation" (you noticed a pattern), or "inference" (you deduced it)
- confirm/contradict must use exact topic string from existing opinions
- No preamble, no explanation — only the JSON array`

    let ops: OpinionOp[] = []
    try {
      const raw = (await spawnClaude(opinionPrompt, { model: "haiku", timeoutMs: 30_000 })).trim()
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) ops = JSON.parse(jsonMatch[0]) as OpinionOp[]
    } catch { /* non-fatal — skip opinion updates on parse error */ }

    const updatedOpinions = decayAndPrune(applyOps(existingOpinions, ops, today), now)
    writeOpinions(opinionsPath, updatedOpinions)

    const event = {
      timestamp: now.toISOString(),
      type: "weekly_growth_review",
      entries_analyzed: entries.length,
      insight,
      opinions_added: ops.filter((o) => o.action === "add").length,
      opinions_confirmed: ops.filter((o) => o.action === "confirm").length,
      opinions_contradicted: ops.filter((o) => o.action === "contradict").length,
    }

    appendFileSync(growthPath, JSON.stringify(event) + "\n")
    console.log("Growth review complete")
  } catch {
    console.log("NO_ACTION")
  }
}

main().catch(() => console.log("NO_ACTION"))
