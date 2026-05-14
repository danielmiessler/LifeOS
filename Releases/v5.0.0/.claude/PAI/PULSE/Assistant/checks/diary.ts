/**
 * Assistant daily diary — placeholder that writes a diary entry stub for
 * today if one doesn't already exist. Real summarization will replace this
 * once the diary content pipeline is built. Output sentinel: NO_ACTION.
 */
import { join } from "path"
import { existsSync, writeFileSync, mkdirSync } from "fs"

const HOME = process.env.HOME ?? ""
const DIR = join(HOME, ".claude", "PAI", "MEMORY", "DA", "diary")
mkdirSync(DIR, { recursive: true })

const today = new Date().toISOString().slice(0, 10)
const path = join(DIR, `${today}.json`)
if (!existsSync(path)) {
  writeFileSync(path, JSON.stringify({
    date: today,
    interaction_count: 0,
    topics: [],
    mood: "neutral",
    avg_rating: 0,
    notable_moments: [],
    learning: null,
  }, null, 2))
}
console.log("NO_ACTION")
