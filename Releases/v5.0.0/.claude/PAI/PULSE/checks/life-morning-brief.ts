#!/usr/bin/env bun
/**
 * Life Morning Brief — Phase 0 Pulse Life Dashboard
 *
 * Reads TELOS/GOALS.md (top-3 goals), TELOS/SPARKS.md (random spark),
 * and TELOS/CURRENT.md (next likely actions). Outputs a voice-ready
 * morning brief narration.
 *
 * Output: voice narration or NO_ACTION if files missing
 */

import { join } from "path"
import { existsSync, readFileSync } from "fs"
import { paiPath } from "../../lib/paths"

const TELOS_DIR = paiPath("USER", "TELOS")

function readFile(name: string): string {
  const p = join(TELOS_DIR, name)
  if (!existsSync(p)) return ""
  return readFileSync(p, "utf-8")
}

// Extract top 3 goals from GOALS.md
function getTopGoals(content: string): string[] {
  const lines = content.split("\n")
  const goals: string[] = []
  for (const line of lines) {
    const match = line.match(/^[-*]\s*\*{0,2}G\d+\*{0,2}:\s*(.+)/)
    if (match && goals.length < 3) {
      goals.push(match[1].replace(/\.\.\.$/, "").trim())
    }
  }
  return goals
}

// Pick a random spark name from SPARKS.md
function getRandomSpark(content: string): string | null {
  const sparks = content
    .split("\n")
    .filter(l => l.startsWith("### "))
    .map(l => l.replace(/^###\s*/, ""))
  if (sparks.length === 0) return null
  return sparks[Math.floor(Math.random() * sparks.length)]
}

// Get top next action from CURRENT.md
function getNextMove(content: string): string | null {
  const section = content.split("## Next likely actions")[1]
  if (!section) return null
  const first = section
    .split("\n")
    .find(l => /^\d+\./.test(l.trim()))
  if (!first) return null
  return first.trim().replace(/^\d+\.\s*/, "")
}

const goals = readFile("GOALS.md")
const sparks = readFile("SPARKS.md")
const current = readFile("CURRENT.md")

if (!goals && !sparks && !current) {
  console.log("NO_ACTION")
  process.exit(0)
}

const topGoals = getTopGoals(goals)
const spark = getRandomSpark(sparks)
const nextMove = getNextMove(current)

const parts: string[] = ["Good morning."]

if (topGoals.length > 0) {
  parts.push(`Your top goals: ${topGoals.map((g, i) => `${i + 1}, ${g}`).join(". ")}.`)
}

if (spark) {
  parts.push(`One spark to ask you about today: ${spark}.`)
}

if (nextMove) {
  parts.push(`Next obvious move: ${nextMove}.`)
}

console.log(parts.join(" "))
