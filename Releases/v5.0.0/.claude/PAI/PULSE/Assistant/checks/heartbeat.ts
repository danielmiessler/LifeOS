/**
 * Assistant heartbeat — writes ts to MEMORY/DA/heartbeat.json so the
 * dashboard "last_heartbeat" field is non-null. Output sentinel: NO_ACTION.
 */
import { join } from "path"
import { mkdirSync, writeFileSync } from "fs"

const HOME = process.env.HOME ?? ""
const DIR = join(HOME, ".claude", "PAI", "MEMORY", "DA")
mkdirSync(DIR, { recursive: true })
writeFileSync(join(DIR, "heartbeat.json"), JSON.stringify({ ts: new Date().toISOString() }, null, 2))
console.log("NO_ACTION")
