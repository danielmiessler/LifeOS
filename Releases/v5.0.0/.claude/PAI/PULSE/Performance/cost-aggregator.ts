#!/usr/bin/env bun
/**
 * Cost Aggregator — scans selected-harness session JSONLs for token usage data
 * and computes per-session costs.
 *
 * Data source: selected harness session/project JSONLs
 * Output: MEMORY/OBSERVABILITY/session-costs.jsonl
 *
 * Runs incrementally: tracks last scan time, only processes new/modified files.
 * Called by Pulse cron every 15 minutes or directly for initial scan.
 */

import { join, basename, dirname } from "path"
import { existsSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, mkdirSync } from "fs"
import { getHarnessHome, getHarnessKind, getPaiDir } from "../../TOOLS/lib/runtime-paths"

const PAI_DIR = getPaiDir(import.meta.dir)
const HARNESS_HOME = getHarnessHome()
const PROJECTS_DIR = join(HARNESS_HOME, getHarnessKind(HARNESS_HOME) === "codex" ? "sessions" : "projects")
const OUTPUT_FILE = join(PAI_DIR, "MEMORY", "OBSERVABILITY", "session-costs.jsonl")
const STATE_FILE = join(PAI_DIR, "PULSE", "Performance", "aggregator-state.json")

// Model pricing per million tokens (as of 2026-04)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  // Opus 4 / 4.6
  "claude-opus-4-20250514": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-6": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  // Sonnet 4 / 4.5 / 4.6
  "claude-sonnet-4-20250514": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  "claude-sonnet-4-5-20250514": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  // Haiku 4.5
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4, cacheWrite: 1.00, cacheRead: 0.08 },
}

function getPricing(model: string): { input: number; output: number; cacheWrite: number; cacheRead: number } {
  // Exact match
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  // Fuzzy match: opus, sonnet, haiku
  const lower = model.toLowerCase()
  if (lower.includes("opus")) return MODEL_PRICING["claude-opus-4-6"]
  if (lower.includes("haiku")) return MODEL_PRICING["claude-haiku-4-5-20251001"]
  if (lower.includes("sonnet")) return MODEL_PRICING["claude-sonnet-4-6"]
  // Default to Sonnet pricing for unknown models
  return MODEL_PRICING["claude-sonnet-4-6"]
}

interface SessionCost {
  sessionId: string
  project: string
  firstTimestamp: string
  lastTimestamp: string
  models: Record<string, number> // model -> message count
  primaryModel: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  totalTokens: number
  costInput: number
  costOutput: number
  costCacheWrite: number
  costCacheRead: number
  costTotal: number
  fileSize: number
  filePath: string
}

interface AggregatorState {
  lastScanMs: number
  sessionsProcessed: number
}

interface ParsedUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  timestamp?: string
}

function loadState(): AggregatorState {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
  } catch { /* fresh start */ }
  return { lastScanMs: 0, sessionsProcessed: 0 }
}

function saveState(state: AggregatorState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function loadExistingSessionIds(): Set<string> {
  const ids = new Set<string>()
  try {
    if (!existsSync(OUTPUT_FILE)) return ids
    const lines = readFileSync(OUTPUT_FILE, "utf-8").trim().split("\n").filter(Boolean)
    for (const line of lines) {
      try {
        const d = JSON.parse(line)
        if (d.sessionId) ids.add(d.sessionId)
      } catch { /* skip malformed */ }
    }
  } catch { /* no existing file */ }
  return ids
}

function claudeUsageFromEvent(d: any): ParsedUsage | null {
  if (d.type !== "assistant") return null
  const msg = d.message
  if (!msg?.usage) return null

  const model = msg.model || "<unknown>"
  if (model === "<synthetic>") return null

  const usage = msg.usage
  return {
    model,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    timestamp: d.timestamp,
  }
}

function codexUsageFromEvent(d: any, currentModel: string): ParsedUsage | null {
  if (d.type === "turn_context" && typeof d.payload?.model === "string") return null
  if (d.type !== "event_msg" || d.payload?.type !== "token_count") return null

  const usage = d.payload?.info?.last_token_usage
  if (!usage) return null

  const inputTokens = usage.input_tokens ?? 0
  const cacheReadTokens = usage.cached_input_tokens ?? 0
  return {
    model: currentModel || "<unknown>",
    inputTokens: Math.max(inputTokens - cacheReadTokens, 0),
    outputTokens: usage.output_tokens ?? 0,
    cacheWriteTokens: 0,
    cacheReadTokens,
    timestamp: d.timestamp,
  }
}

export function processSessionFile(filePath: string, projectSlug: string): SessionCost | null {
  try {
    const raw = readFileSync(filePath, "utf-8")
    const lines = raw.split("\n").filter(Boolean)

    const models: Record<string, number> = {}
    let messageCount = 0
    let inputTokens = 0
    let outputTokens = 0
    let cacheWriteTokens = 0
    let cacheReadTokens = 0
    let firstTimestamp = ""
    let lastTimestamp = ""
    let costInput = 0
    let costOutput = 0
    let costCacheWrite = 0
    let costCacheRead = 0
    let currentCodexModel = "<unknown>"

    for (const line of lines) {
      let d: any
      try { d = JSON.parse(line) } catch { continue }

      if (d.type === "turn_context" && typeof d.payload?.model === "string") {
        currentCodexModel = d.payload.model
        continue
      }

      const parsed = claudeUsageFromEvent(d) ?? codexUsageFromEvent(d, currentCodexModel)
      if (!parsed) continue

      const model = parsed.model
      const pricing = getPricing(model)
      const inTok = parsed.inputTokens
      const outTok = parsed.outputTokens
      const cwTok = parsed.cacheWriteTokens
      const crTok = parsed.cacheReadTokens

      inputTokens += inTok
      outputTokens += outTok
      cacheWriteTokens += cwTok
      cacheReadTokens += crTok
      models[model] = (models[model] ?? 0) + 1
      messageCount++

      costInput += (inTok * pricing.input) / 1_000_000
      costOutput += (outTok * pricing.output) / 1_000_000
      costCacheWrite += (cwTok * pricing.cacheWrite) / 1_000_000
      costCacheRead += (crTok * pricing.cacheRead) / 1_000_000

      const ts = parsed.timestamp
      if (ts && typeof ts === "string") {
        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts
      }
    }

    if (messageCount === 0) return null

    const primaryModel = Object.entries(models).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "<unknown>"
    const sessionId = basename(filePath, ".jsonl")
    const fileSize = statSync(filePath).size

    return {
      sessionId,
      project: projectSlug,
      firstTimestamp,
      lastTimestamp,
      models,
      primaryModel,
      messageCount,
      inputTokens,
      outputTokens,
      cacheWriteTokens,
      cacheReadTokens,
      totalTokens: inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens,
      costInput: Math.round(costInput * 10000) / 10000,
      costOutput: Math.round(costOutput * 10000) / 10000,
      costCacheWrite: Math.round(costCacheWrite * 10000) / 10000,
      costCacheRead: Math.round(costCacheRead * 10000) / 10000,
      costTotal: Math.round((costInput + costOutput + costCacheWrite + costCacheRead) * 10000) / 10000,
      fileSize,
      filePath,
    }
  } catch {
    return null
  }
}

async function main() {
  const startMs = Date.now()
  const state = loadState()
  const existingIds = loadExistingSessionIds()
  const isFullScan = process.argv.includes("--full")

  if (!existsSync(PROJECTS_DIR)) {
    console.log("No projects directory found")
    process.exit(0)
  }

  // Ensure output directory exists
  const outDir = dirname(OUTPUT_FILE)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Find all project directories
  const projectDirs: string[] = []
  try {
    for (const entry of readdirSync(PROJECTS_DIR)) {
      const full = join(PROJECTS_DIR, entry)
      try {
        if (statSync(full).isDirectory()) projectDirs.push(full)
      } catch { /* skip inaccessible */ }
    }
  } catch {
    console.log("Cannot read projects directory")
    process.exit(0)
  }

  let newSessions = 0
  let skipped = 0
  let errors = 0

  for (const projDir of projectDirs) {
    const projectSlug = basename(projDir)

    // Scan for session JSONL files (direct children, UUID-named)
    let entries: string[]
    try { entries = readdirSync(projDir) } catch { continue }

    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue
      const sessionId = entry.replace(".jsonl", "")

      // Skip already processed
      if (!isFullScan && existingIds.has(sessionId)) {
        skipped++
        continue
      }

      const filePath = join(projDir, entry)

      // Incremental: skip files older than last scan (unless full scan)
      if (!isFullScan && state.lastScanMs > 0) {
        try {
          const mtime = statSync(filePath).mtimeMs
          if (mtime < state.lastScanMs) { skipped++; continue }
        } catch { continue }
      }

      const cost = processSessionFile(filePath, projectSlug)
      if (cost) {
        appendFileSync(OUTPUT_FILE, JSON.stringify(cost) + "\n")
        newSessions++
      } else {
        errors++
      }
    }

    // Also scan subagent JSONLs inside session directories
    for (const entry of entries) {
      const sessionDir = join(projDir, entry)
      if (entry.endsWith(".jsonl")) continue // already handled files
      const subagentDir = join(sessionDir, "subagents")
      if (!existsSync(subagentDir)) continue

      let subEntries: string[]
      try { subEntries = readdirSync(subagentDir) } catch { continue }

      for (const subEntry of subEntries) {
        if (!subEntry.endsWith(".jsonl")) continue
        const agentId = subEntry.replace(".jsonl", "")

        if (!isFullScan && existingIds.has(agentId)) { skipped++; continue }

        const filePath = join(subagentDir, subEntry)

        if (!isFullScan && state.lastScanMs > 0) {
          try {
            const mtime = statSync(filePath).mtimeMs
            if (mtime < state.lastScanMs) { skipped++; continue }
          } catch { continue }
        }

        const cost = processSessionFile(filePath, projectSlug)
        if (cost) {
          appendFileSync(OUTPUT_FILE, JSON.stringify(cost) + "\n")
          newSessions++
        }
      }
    }
  }

  state.lastScanMs = Date.now()
  state.sessionsProcessed += newSessions
  saveState(state)

  const elapsed = Date.now() - startMs
  console.log(`Cost aggregation complete: ${newSessions} new, ${skipped} skipped, ${errors} errors (${elapsed}ms)`)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Cost aggregator failed:", err)
    process.exit(1)
  })
}
