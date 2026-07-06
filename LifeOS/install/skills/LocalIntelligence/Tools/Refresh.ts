#!/usr/bin/env bun
/**
 * Refresh.ts — orchestrator for the LocalIntelligence daily digest.
 *
 * Runs all eight fetchers via Promise.allSettled (one dead source never blanks
 * the digest), writes the dated JSON file plus the latest.json copy that the
 * Pulse module serves.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"

import { readHometown, NoHometownError } from "./Hometown.ts"
import type { Digest, FetchResult, Fetcher, Hometown, SectionKey } from "./Types.ts"
import { fetchConstruction } from "./FetchConstruction.ts"
import { fetchBusiness } from "./FetchBusiness.ts"
import { fetchOfficials } from "./FetchOfficials.ts"
import { fetchLegislation } from "./FetchLegislation.ts"
import { fetchElections } from "./FetchElections.ts"
import { fetchArrests } from "./FetchArrests.ts"
import { fetchNews } from "./FetchNews.ts"
import { fetchCrime } from "./FetchCrime.ts"
import { getClaudeDir } from "../../../LIFEOS/TOOLS/Paths";

const DATA_DIR = join(getClaudeDir(), "LIFEOS", "MEMORY", "DATA", "LocalIntelligence")

const fetchers: Record<SectionKey, Fetcher> = {
  construction: fetchConstruction,
  crime: fetchCrime,
  business: fetchBusiness,
  officials: fetchOfficials,
  legislation: fetchLegislation,
  elections: fetchElections,
  arrests: fetchArrests,
  news: fetchNews,
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

async function runOne(key: SectionKey, fn: Fetcher, home: Hometown): Promise<FetchResult> {
  try {
    return await fn(home)
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[${key}] fetcher threw: ${msg}`)
    return { items: [], source_status: "unavailable", errors: [msg] }
  }
}

export async function refresh(home: Hometown): Promise<Digest> {
  const keys = Object.keys(fetchers) as SectionKey[]
  const results = await Promise.allSettled(
    keys.map((k) => runOne(k, fetchers[k], home))
  )

  const sections: Partial<Record<SectionKey, FetchResult>> = {}
  const sourcesUsed: string[] = []
  const sourcesFailed: string[] = []
  const errors: string[] = []

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const r = results[i]
    if (r.status === "fulfilled") {
      sections[key] = r.value
      if (r.value.source_status === "ok") sourcesUsed.push(key)
      if (r.value.source_status === "unavailable") sourcesFailed.push(key)
      for (const e of r.value.errors ?? []) errors.push(`${key}: ${e}`)
    } else {
      const msg = String(r.reason)
      sections[key] = { items: [], source_status: "unavailable", errors: [msg] }
      sourcesFailed.push(key)
      errors.push(`${key}: ${msg}`)
    }
  }

  const digest: Digest = {
    meta: {
      city: home.city,
      state: home.state,
      county: home.county,
      zip: home.zip,
      generated_at: new Date().toISOString(),
      sources_used: sourcesUsed,
      sources_failed: sourcesFailed,
      errors,
    },
    construction: sections.construction!,
    crime: sections.crime!,
    business: sections.business!,
    officials: sections.officials!,
    legislation: sections.legislation!,
    elections: sections.elections!,
    arrests: sections.arrests!,
    news: sections.news!,
  }

  return digest
}

async function persist(digest: Digest): Promise<{ datedPath: string; latestPath: string }> {
  await mkdir(DATA_DIR, { recursive: true })
  const dateStr = todayDateString()
  const citySlug = digest.meta.city.toLowerCase().replace(/\s+/g, "-")
  const stateSlug = digest.meta.state.toLowerCase()
  const datedPath = join(DATA_DIR, `${dateStr}_${citySlug}_${stateSlug}_digest.json`)
  const latestPath = join(DATA_DIR, "latest.json")
  const json = JSON.stringify(digest, null, 2)
  await writeFile(datedPath, json, "utf8")
  await writeFile(latestPath, json, "utf8")
  return { datedPath, latestPath }
}

if (import.meta.main) {
  try {
    const home = await readHometown()
    const digest = await refresh(home)
    const { datedPath, latestPath } = await persist(digest)
    const summary = {
      city: digest.meta.city,
      state: digest.meta.state,
      sources_used: digest.meta.sources_used,
      sources_failed: digest.meta.sources_failed,
      total_items: Object.values(digest)
        .filter((v): v is FetchResult => typeof v === "object" && v !== null && "items" in v)
        .reduce((acc, r) => acc + r.items.length, 0),
      datedPath,
      latestPath,
    }
    console.log(JSON.stringify(summary, null, 2))
  } catch (err) {
    if (err instanceof NoHometownError) {
      console.error(err.message)
      process.exit(2)
    }
    throw err
  }
}
