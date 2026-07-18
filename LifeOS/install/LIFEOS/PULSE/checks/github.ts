#!/usr/bin/env bun
/**
 * GitHub PR Check — Script-type job
 *
 * Zero AI cost: GitHub API → filter new PRs/reviews → notification.
 * Monitors fabric, LifeOS, substrate, telos, SecLists.
 *
 * Output: summary of new activity or NO_ACTION
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "path"
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME ?? ""
const LEGACY_STATE_FILE = join(claudeDir(), "LIFEOS", "PULSE", "state", "github-seen.json")
const STATE_FILE = join(claudeDir(), "LIFEOS", "PULSE", "state", "github-seen.jsonl")
// Repos to monitor for new issues / activity. Override via LIFEOS_PULSE_REPOS
// env var (comma-separated "owner/name" pairs). Empty default keeps fresh
// installs from polling repos the user hasn't opted into.
const REPOS = (process.env.LIFEOS_PULSE_REPOS ?? "")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean)

type SeenEntry = {
  ts: string
  id: string
}

export async function loadSeen(): Promise<Set<string>> {
  try {
    if (existsSync(STATE_FILE)) {
      const lines = readJsonlLines()
      const ids = lastDistinctIds(lines, 500)
      if (lines.length > 5000) {
        writeSeenAtomically(ids)
      }
      return new Set(ids)
    }

    if (existsSync(LEGACY_STATE_FILE)) {
      const ids = (JSON.parse(readFileSync(LEGACY_STATE_FILE, "utf8")) as string[]).slice(-500)
      writeSeenAtomically(ids)
      renameSync(LEGACY_STATE_FILE, `${LEGACY_STATE_FILE}.migrated`)
      return new Set(ids)
    }
  } catch {}
  return new Set()
}

export async function appendSeen(newIds: string[]): Promise<void> {
  if (newIds.length === 0) return
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  const ts = new Date().toISOString()
  const lines = newIds.map((id) => JSON.stringify({ ts, id } satisfies SeenEntry)).join("\n")
  appendFileSync(STATE_FILE, `${lines}\n`, "utf8")
}

function readJsonlLines(): string[] {
  return readFileSync(STATE_FILE, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
}

function lastDistinctIds(lines: string[], limit: number): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (let i = lines.length - 1; i >= 0 && ids.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]) as SeenEntry
      if (typeof entry.id === "string" && !seen.has(entry.id)) {
        seen.add(entry.id)
        ids.push(entry.id)
      }
    } catch {}
  }
  return ids.reverse()
}

function writeSeenAtomically(ids: string[]): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  const ts = new Date().toISOString()
  const content = ids.map((id) => JSON.stringify({ ts, id } satisfies SeenEntry)).join("\n")
  const tmp = `${STATE_FILE}.tmp`
  writeFileSync(tmp, content ? `${content}\n` : "", "utf8")
  renameSync(tmp, STATE_FILE)
}

interface PRInfo {
  repo: string
  number: number
  title: string
  user: string
  action: string
}

async function checkRepo(repo: string, seen: Set<string>): Promise<PRInfo[]> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const newPRs: PRInfo[] = []

  try {
    // Check recent PRs (last 10)
    const resp = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&per_page=10`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) return newPRs

    const prs = (await resp.json()) as Array<{
      number: number
      title: string
      user: { login: string }
      updated_at: string
    }>

    for (const pr of prs) {
      const key = `${repo}#${pr.number}`
      if (!seen.has(key)) {
        newPRs.push({
          repo: repo.split("/")[1],
          number: pr.number,
          title: pr.title,
          user: pr.user.login,
          action: "opened",
        })
      }
    }
  } catch {}

  return newPRs
}

async function main() {
  const seen = await loadSeen()
  const allNew: PRInfo[] = []
  const newSeenIds = new Set<string>()

  const results = await Promise.allSettled(REPOS.map((repo) => checkRepo(repo, seen)))

  for (const result of results) {
    if (result.status === "fulfilled") {
      allNew.push(...result.value)
    }
  }

  // Mark all current PRs as seen. LIFEOS_PULSE_REPOS is expected to be
  // "owner/name" pairs, so `pr.repo` should always include "/". If it
  // doesn't, prefix with LIFEOS_GITHUB_ORG (env-driven, no hardcoded org).
  const ghOrg = process.env.LIFEOS_GITHUB_ORG ?? "YOUR-GITHUB-ORG"
  for (const pr of allNew) {
    const key = `${pr.repo.includes("/") ? pr.repo : `${ghOrg}/${pr.repo}`}#${pr.number}`
    if (!seen.has(key)) {
      seen.add(key)
      newSeenIds.add(key)
    }
  }
  // Also re-check repos to mark existing PRs
  for (const repo of REPOS) {
    try {
      const token = process.env.GITHUB_TOKEN
      const headers: Record<string, string> = { Accept: "application/vnd.github+json" }
      if (token) headers.Authorization = `Bearer ${token}`
      const resp = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&per_page=10`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (resp.ok) {
        const prs = (await resp.json()) as Array<{ number: number }>
        for (const pr of prs) {
          const key = `${repo}#${pr.number}`
          if (!seen.has(key)) {
            seen.add(key)
            newSeenIds.add(key)
          }
        }
      }
    } catch {}
  }

  await appendSeen(Array.from(newSeenIds))

  if (allNew.length === 0) {
    console.log("NO_ACTION")
    return
  }

  const lines = allNew.map((pr) => `${pr.repo}#${pr.number}: ${pr.title} (by ${pr.user})`)
  console.log(`${allNew.length} new PR${allNew.length > 1 ? "s" : ""}:\n${lines.join("\n")}`)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`github-check error: ${err}`)
    console.log("NO_ACTION")
  })
}
