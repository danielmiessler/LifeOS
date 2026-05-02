#!/usr/bin/env bun
/**
 * GitHub PR Check — Script-type job
 *
 * Zero AI cost: GitHub API → filter new PRs/reviews → notification.
 * Monitors fabric, PAI, substrate, telos, SecLists.
 *
 * Output: summary of new activity or NO_ACTION
 */

import { join } from "path"
import { paiPath } from "../../lib/paths"

const STATE_FILE = paiPath("PULSE", "state", "github-seen.json")
// Repos to monitor for new issues / activity. Override via PAI_PULSE_REPOS
// env var (comma-separated "owner/name" pairs). Empty default keeps fresh
// installs from polling repos the user hasn't opted into.
const REPOS = (process.env.PAI_PULSE_REPOS ?? "")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean)

async function loadSeen(): Promise<Set<string>> {
  try {
    const file = Bun.file(STATE_FILE)
    if (await file.exists()) return new Set((await file.json()) as string[])
  } catch {}
  return new Set()
}

async function saveSeen(ids: Set<string>): Promise<void> {
  const arr = Array.from(ids).slice(-500)
  await Bun.write(STATE_FILE, JSON.stringify(arr))
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

  const results = await Promise.allSettled(REPOS.map((repo) => checkRepo(repo, seen)))

  for (const result of results) {
    if (result.status === "fulfilled") {
      allNew.push(...result.value)
    }
  }

  // Mark all current PRs as seen
  for (const pr of allNew) {
    seen.add(`${pr.repo.includes("/") ? pr.repo : `danielmiessler/${pr.repo}`}#${pr.number}`)
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
        for (const pr of prs) seen.add(`${repo}#${pr.number}`)
      }
    } catch {}
  }

  await saveSeen(seen)

  if (allNew.length === 0) {
    console.log("NO_ACTION")
    return
  }

  const lines = allNew.map((pr) => `${pr.repo}#${pr.number}: ${pr.title} (by ${pr.user})`)
  console.log(`${allNew.length} new PR${allNew.length > 1 ? "s" : ""}:\n${lines.join("\n")}`)
}

main().catch((err) => {
  console.error(`github-check error: ${err}`)
  console.log("NO_ACTION")
})
