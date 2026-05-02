#!/usr/bin/env bun
import { readdir, readFile, writeFile, rename, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { paiPath } from '../lib/paths'

const INBOX = join(homedir(), "Library/Mobile Documents/com~apple~CloudDocs/PAI/health/inbox")
const PROCESSED = join(homedir(), "Library/Mobile Documents/com~apple~CloudDocs/PAI/health/processed")
const SNAPSHOTS = paiPath("USER", "HEALTH", "snapshots")

type HealthSnapshot = {
  date?: string
  steps?: number
  active_kcal?: number
  exercise_minutes?: number
  resting_hr?: number
  hrv_ms?: number
  sleep_hours?: number
  weight_kg?: number
  body_fat_pct?: number
  vo2_max?: number
  notes?: string
  [extra: string]: unknown
}

function todayLA(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
}

function fmt(n: number | undefined, unit: string, digits = 0): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—"
  return `${n.toFixed(digits)} ${unit}`.trim()
}

function toMarkdown(snap: HealthSnapshot, source: string): string {
  const date = snap.date ?? todayLA()
  const lines: string[] = []
  lines.push("---")
  lines.push(`date: ${date}`)
  lines.push(`source: ${source}`)
  lines.push(`captured: ${new Date().toISOString()}`)
  lines.push("---")
  lines.push("")
  lines.push(`# Health Snapshot — ${date}`)
  lines.push("")
  lines.push("| Metric | Value |")
  lines.push("|--------|-------|")
  lines.push(`| Steps | ${fmt(snap.steps, "")} |`)
  lines.push(`| Active energy | ${fmt(snap.active_kcal, "kcal")} |`)
  lines.push(`| Exercise minutes | ${fmt(snap.exercise_minutes, "min")} |`)
  lines.push(`| Resting HR | ${fmt(snap.resting_hr, "bpm")} |`)
  lines.push(`| HRV | ${fmt(snap.hrv_ms, "ms")} |`)
  lines.push(`| Sleep | ${fmt(snap.sleep_hours, "h", 1)} |`)
  lines.push(`| Weight | ${fmt(snap.weight_kg, "kg", 1)} |`)
  lines.push(`| Body fat | ${fmt(snap.body_fat_pct, "%", 1)} |`)
  lines.push(`| VO2 max | ${fmt(snap.vo2_max, "", 1)} |`)
  if (snap.notes) {
    lines.push("")
    lines.push("## Notes")
    lines.push(snap.notes)
  }
  const known = new Set(["date", "steps", "active_kcal", "exercise_minutes", "resting_hr", "hrv_ms", "sleep_hours", "weight_kg", "body_fat_pct", "vo2_max", "notes"])
  const extras = Object.keys(snap).filter((k) => !known.has(k))
  if (extras.length > 0) {
    lines.push("")
    lines.push("## Extra fields")
    for (const k of extras) lines.push(`- **${k}**: ${JSON.stringify(snap[k])}`)
  }
  return lines.join("\n") + "\n"
}

async function ingestOne(filename: string): Promise<{ ok: boolean; date: string; out: string; reason?: string }> {
  const inboxPath = join(INBOX, filename)
  const raw = await readFile(inboxPath, "utf8")
  let snap: HealthSnapshot
  try {
    snap = JSON.parse(raw)
  } catch (e) {
    return { ok: false, date: "", out: "", reason: `invalid JSON: ${(e as Error).message}` }
  }
  const date = snap.date ?? todayLA()
  const md = toMarkdown(snap, filename)
  const outPath = join(SNAPSHOTS, `${date}.md`)
  await writeFile(outPath, md, "utf8")
  await rename(inboxPath, join(PROCESSED, filename))
  return { ok: true, date, out: outPath }
}

async function main() {
  const cmd = process.argv[2] ?? "ingest"
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log("usage: bun TOOLS/HealthSnapshot.ts [ingest|sample|status]")
    console.log("  ingest  — process every .json in iCloud inbox, write snapshots/YYYY-MM-DD.md")
    console.log("  sample  — drop a sample snapshot into inbox to test the pipeline")
    console.log("  status  — show inbox count, last snapshot, paths")
    return
  }
  for (const dir of [INBOX, PROCESSED, SNAPSHOTS]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }
  if (cmd === "status") {
    const inbox = (await readdir(INBOX)).filter((f) => f.endsWith(".json"))
    const snaps = (await readdir(SNAPSHOTS)).filter((f) => f.endsWith(".md")).sort()
    console.log(`inbox:    ${INBOX}`)
    console.log(`pending:  ${inbox.length} json file(s)`)
    console.log(`snapshots: ${SNAPSHOTS}`)
    console.log(`count:    ${snaps.length}`)
    if (snaps.length > 0) console.log(`latest:   ${snaps[snaps.length - 1]}`)
    return
  }
  if (cmd === "sample") {
    const sample: HealthSnapshot = {
      date: todayLA(),
      steps: 8423,
      active_kcal: 412,
      exercise_minutes: 38,
      resting_hr: 54,
      hrv_ms: 62,
      sleep_hours: 7.2,
      weight_kg: 80.4,
      notes: "Sample row — replace via real iPhone Shortcut once built.",
    }
    const samplePath = join(INBOX, `sample-${Date.now()}.json`)
    await writeFile(samplePath, JSON.stringify(sample, null, 2), "utf8")
    console.log(`wrote sample → ${samplePath}`)
    console.log("now run: bun TOOLS/HealthSnapshot.ts ingest")
    return
  }
  if (cmd === "ingest") {
    const files = (await readdir(INBOX)).filter((f) => f.endsWith(".json"))
    if (files.length === 0) {
      console.log("inbox empty — nothing to ingest")
      return
    }
    let ok = 0, failed = 0
    for (const f of files) {
      const r = await ingestOne(f)
      if (r.ok) {
        console.log(`✓ ${f} → ${r.out}`)
        ok++
      } else {
        console.error(`✗ ${f}: ${r.reason}`)
        failed++
      }
    }
    console.log(`\ndone: ${ok} ingested, ${failed} failed`)
    process.exit(failed > 0 ? 1 : 0)
  }
  console.error(`unknown command: ${cmd}`)
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
