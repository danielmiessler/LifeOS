#!/usr/bin/env bun

/**
 * flinch — Somatic signal capture for cognitive instrumentation
 *
 * Fast capture (5 seconds):
 *   flinch "chest tightening when Archie hedged in the Moser doc"
 *   flinch "gut pull — something wrong with the routing table"
 *   flinch "excitement spike — might be impulsivity not insight"
 *
 * With flags:
 *   flinch "eye-roll at 'In conclusion'" --trigger reports/audit.md --state tired
 *   flinch "mental fog hit mid-paragraph" --state flat --intensity 4
 *
 * Review:
 *   flinch --review              # show recent unscored entries
 *   flinch --score <id> correct  # score a past flinch
 *   flinch --stats               # accuracy by state, pattern frequency
 *   flinch --refine              # propose voice reference updates from 3+ patterns
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.env.PAI_DIR || "/root/.claude", "flowlabs", "logs");
const LOG_FILE = join(LOG_DIR, "somatic_history.jsonl");
const VOICE_REF = join(process.env.PAI_DIR || "/root/.claude", "projects", "-root--claude", "memory", "rob-voice-reference.md");

// Ensure directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// Parse args
const args = process.argv.slice(2);

// --- Review mode ---
if (args.includes("--review")) {
  if (!existsSync(LOG_FILE)) {
    console.log("No flinches logged yet.");
    process.exit(0);
  }
  const entries = readFileSync(LOG_FILE, "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((e) => !e.outcome);

  if (entries.length === 0) {
    console.log("All flinches have been scored.");
    process.exit(0);
  }

  console.log(`\n  ${entries.length} unscored flinch(es):\n`);
  for (const e of entries) {
    const age = Math.round((Date.now() - new Date(e.timestamp).getTime()) / 3600000);
    console.log(`  [${e.id}] ${age}h ago | ${e.state || "—"} | ${e.signal}`);
    if (e.trigger) console.log(`         trigger: ${e.trigger}`);
    console.log();
  }
  process.exit(0);
}

// --- Score mode ---
if (args.includes("--score")) {
  const scoreIdx = args.indexOf("--score");
  const id = args[scoreIdx + 1];
  const outcome = args[scoreIdx + 2]; // correct | wrong | unclear

  if (!id || !outcome || !["correct", "wrong", "unclear"].includes(outcome)) {
    console.log("Usage: flinch --score <id> correct|wrong|unclear");
    process.exit(1);
  }

  if (!existsSync(LOG_FILE)) {
    console.log("No flinches logged yet.");
    process.exit(1);
  }

  const lines = readFileSync(LOG_FILE, "utf-8").trim().split("\n");
  let found = false;
  const updated = lines.map((line) => {
    const entry = JSON.parse(line);
    if (entry.id === id) {
      entry.outcome = outcome;
      entry.scored_at = new Date().toISOString();
      found = true;
    }
    return JSON.stringify(entry);
  });

  if (!found) {
    console.log(`Flinch ${id} not found.`);
    process.exit(1);
  }

  writeFileSync(LOG_FILE, updated.join("\n") + "\n");
  console.log(`  Scored flinch ${id} as: ${outcome}`);
  process.exit(0);
}

// --- Stats mode ---
if (args.includes("--stats")) {
  if (!existsSync(LOG_FILE)) {
    console.log("No flinches logged yet.");
    process.exit(0);
  }

  const entries = readFileSync(LOG_FILE, "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  const total = entries.length;
  const scored = entries.filter((e) => e.outcome);
  const correct = scored.filter((e) => e.outcome === "correct").length;
  const wrong = scored.filter((e) => e.outcome === "wrong").length;
  const unclear = scored.filter((e) => e.outcome === "unclear").length;
  const unscored = total - scored.length;

  console.log(`\n  Flinch Stats`);
  console.log(`  ────────────────────────────`);
  console.log(`  Total:     ${total}`);
  console.log(`  Scored:    ${scored.length}`);
  console.log(`  Correct:   ${correct} (${scored.length ? Math.round((correct / scored.length) * 100) : 0}%)`);
  console.log(`  Wrong:     ${wrong}`);
  console.log(`  Unclear:   ${unclear}`);
  console.log(`  Unscored:  ${unscored}`);

  // Accuracy by state
  const states = new Map();
  for (const e of scored) {
    const s = e.state || "untagged";
    if (!states.has(s)) states.set(s, { correct: 0, total: 0 });
    states.get(s).total++;
    if (e.outcome === "correct") states.get(s).correct++;
  }

  if (states.size > 0) {
    console.log(`\n  Accuracy by State`);
    console.log(`  ────────────────────────────`);
    for (const [state, data] of states) {
      const pct = Math.round((data.correct / data.total) * 100);
      console.log(`  ${state.padEnd(12)} ${pct}% (${data.correct}/${data.total})`);
    }
  }

  // Pattern frequency
  const patterns = new Map();
  for (const e of entries) {
    if (e.pattern) {
      patterns.set(e.pattern, (patterns.get(e.pattern) || 0) + 1);
    }
  }

  if (patterns.size > 0) {
    console.log(`\n  Pattern Frequency`);
    console.log(`  ────────────────────────────`);
    const sorted = [...patterns.entries()].sort((a, b) => b[1] - a[1]);
    for (const [pattern, count] of sorted) {
      const flag = count >= 3 ? " ⚠️  REFINE" : "";
      console.log(`  ${count}x  ${pattern}${flag}`);
    }
  }

  console.log();
  process.exit(0);
}

// --- Refine mode ---
if (args.includes("--refine")) {
  if (!existsSync(LOG_FILE)) {
    console.log("No flinches logged yet.");
    process.exit(0);
  }

  const entries = readFileSync(LOG_FILE, "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

  const patterns = new Map();
  for (const e of entries) {
    if (e.pattern) {
      patterns.set(e.pattern, (patterns.get(e.pattern) || 0) + 1);
    }
  }

  const refinements = [...patterns.entries()].filter(([, count]) => count >= 3);

  if (refinements.length === 0) {
    console.log("No patterns have hit 3+ occurrences yet. Keep logging.");
    process.exit(0);
  }

  console.log(`\n  Patterns ready for voice reference refinement:\n`);
  for (const [pattern, count] of refinements) {
    console.log(`  ${count}x  "${pattern}"`);
    console.log(`       → Add to rob-voice-reference.md anti-patterns list\n`);
  }

  console.log(`  Voice reference: ${VOICE_REF}`);
  console.log(`  Run with Archie to integrate these into the anti-pattern list.\n`);
  process.exit(0);
}

// --- Capture mode (default) ---
const signal = args.find((a) => !a.startsWith("--"));

if (!signal) {
  console.log(`
  flinch — somatic signal capture

  Capture:
    flinch "description of what you felt"
    flinch "signal" --trigger file.md --state tired --intensity 3 --pattern hedging

  Review:
    flinch --review              show unscored entries
    flinch --score <id> correct  score a past flinch (correct|wrong|unclear)
    flinch --stats               accuracy and pattern stats
    flinch --refine              show patterns ready for voice ref update
  `);
  process.exit(0);
}

// Parse optional flags
const getFlag = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
};

const entry = {
  id: `f-${Date.now().toString(36)}`,
  timestamp: new Date().toISOString(),
  signal,
  trigger: getFlag("--trigger"),
  state: getFlag("--state"),
  intensity: getFlag("--intensity") ? parseInt(getFlag("--intensity")!) : undefined,
  pattern: getFlag("--pattern"),
  outcome: undefined as string | undefined,
  scored_at: undefined as string | undefined,
};

// Append to log
const line = JSON.stringify(entry) + "\n";
if (existsSync(LOG_FILE)) {
  const existing = readFileSync(LOG_FILE, "utf-8");
  writeFileSync(LOG_FILE, existing + line);
} else {
  writeFileSync(LOG_FILE, line);
}

console.log(`  ⚡ flinch captured [${entry.id}]`);
console.log(`     ${entry.signal}`);
if (entry.trigger) console.log(`     trigger: ${entry.trigger}`);
if (entry.state) console.log(`     state: ${entry.state}`);
if (entry.intensity) console.log(`     intensity: ${entry.intensity}/5`);
if (entry.pattern) console.log(`     pattern: ${entry.pattern}`);
