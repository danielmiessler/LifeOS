#!/usr/bin/env bun
/**
 * Hometown.ts — sole resolver for the principal's hometown.
 *
 * Reads `**Hometown:**` line from PRINCIPAL_IDENTITY.md and returns a
 * structured object. Every fetcher and workflow in this skill calls this —
 * there are no hardcoded city strings anywhere else.
 *
 * Identity file location is configurable via env var `LIFEOS_PRINCIPAL_IDENTITY`,
 * defaulting to `~/.claude/LIFEOS/USER/PRINCIPAL/PRINCIPAL_IDENTITY.md`.
 *
 * Expected line shape (Quick Reference bullet):
 *   - **Hometown:** <City>, <ST> (ZIP <zip>, <County> County)
 *
 * `<ST>` is the two-letter USPS state code OR the full state name.
 * `(ZIP <zip>, <County> County)` is optional but recommended.
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { getLifeosDir } from "../../../LIFEOS/TOOLS/Paths";

export interface Hometown {
  city: string
  state: string          // two-letter USPS code if derivable
  stateName?: string     // full name if known
  zip?: string
  county?: string
  /** kebab-cased slug useful for templated URLs (e.g., Patch RSS) */
  citySlug: string
  stateSlug: string
}

export class NoHometownError extends Error {
  constructor(public identityPath: string) {
    super(
      `No \`**Hometown:**\` line found in ${identityPath}. ` +
        `Add one to the Quick Reference section, e.g.:\n` +
        `  - **Hometown:** Austin, TX (ZIP 78701, Travis County)`
    )
    this.name = "NoHometownError"
  }
}

const IDENTITY_DEFAULT = join(
  getLifeosDir(),
  "USER",
  "PRINCIPAL",
  "PRINCIPAL_IDENTITY.md"
)

/** Strict regex for the Quick Reference bullet line. */
const HOMETOWN_RE =
  /^- \*\*Hometown:\*\*\s+(?<city>[^,]+?),\s+(?<state>[A-Za-z .]+?)(?:\s*\((?<paren>[^)]+)\))?\s*$/m

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
}

const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE))

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function resolveState(raw: string): { code: string; name?: string } {
  const trimmed = raw.trim()
  if (trimmed.length === 2 && STATE_CODES.has(trimmed.toUpperCase())) {
    return { code: trimmed.toUpperCase() }
  }
  const lower = trimmed.toLowerCase()
  const code = STATE_NAME_TO_CODE[lower]
  if (code) return { code, name: trimmed }
  // Unrecognized — preserve as-is upper-cased; downstream may treat as code.
  return { code: trimmed.toUpperCase() }
}

function parseParenContent(paren: string | undefined): {
  zip?: string
  county?: string
} {
  if (!paren) return {}
  const out: { zip?: string; county?: string } = {}
  const zipMatch = paren.match(/ZIP\s+(\d{5}(?:-\d{4})?)/i)
  if (zipMatch) out.zip = zipMatch[1]
  const countyMatch = paren.match(/([A-Za-z .'-]+)\s+County/i)
  if (countyMatch) out.county = countyMatch[1].trim()
  return out
}

export async function readHometown(
  identityPath: string = process.env.LIFEOS_PRINCIPAL_IDENTITY ?? IDENTITY_DEFAULT
): Promise<Hometown> {
  const text = await readFile(identityPath, "utf8")
  const match = text.match(HOMETOWN_RE)
  if (!match || !match.groups) throw new NoHometownError(identityPath)
  const city = match.groups.city.trim()
  const stateRaw = match.groups.state
  const { code: state, name: stateName } = resolveState(stateRaw)
  const { zip, county } = parseParenContent(match.groups.paren)

  return {
    city,
    state,
    stateName,
    zip,
    county,
    citySlug: slugify(city),
    stateSlug: slugify(stateName ?? stateRaw ?? state),
  }
}

// CLI entry — `bun run Hometown.ts` prints JSON.
if (import.meta.main) {
  try {
    const home = await readHometown()
    console.log(JSON.stringify(home, null, 2))
  } catch (err) {
    if (err instanceof NoHometownError) {
      console.error(err.message)
      process.exit(2)
    }
    throw err
  }
}
