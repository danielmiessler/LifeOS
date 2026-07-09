#!/usr/bin/env bun
/**
 * PangramScore.ts — score text for AI-detectability via the Pangram API.
 *
 * Use it as a voice-eval probe: feed in my (or anyone's) writing and get back
 * how much of it reads as AI-generated. Lower fraction_ai = sounds more human.
 *
 * Two-step async flow (from the official docs, June 2026):
 *   1. POST https://text.external-api.pangram.com/task  -> { task_id }
 *      headers: Content-Type: application/json, x-api-key: <key>
 *      body:    { "text": "...", "public_dashboard_link": false }
 *   2. GET  https://text.external-api.pangram.com/task/<task_id>  (poll)
 *      done when stage === "STAGE_SUCCESS" | "STAGE_FAILED"
 * Docs: https://docs.pangram.com/quickstart-rest
 *
 * Key: PANGRAM_API_KEY in ~/.claude/.env (not present yet — add it before running).
 * Override the endpoint with PANGRAM_API_URL if Pangram moves it.
 */

import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const ENV_PATH = `${process.env.HOME}/.claude/.env`;

// Run-record: proof the detector actually executed on a specific text. The
// WritingGate Stop hook reads this so its pass condition is "Pangram ran on
// this content", not "a token string is present" (Forge audit 2026-07-01).
const RUNS_PATH = join(
  process.env.LIFEOS_DIR || `${process.env.HOME}/.claude/LifeOS`,
  "MEMORY", "OBSERVABILITY", "pangram-runs.jsonl",
);
export function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function appendRunRecord(text: string, aiPct: unknown): void {
  try {
    mkdirSync(dirname(RUNS_PATH), { recursive: true });
    const sha256 = createHash("sha256").update(normalizeForHash(text)).digest("hex");
    appendFileSync(RUNS_PATH, JSON.stringify({
      ts: new Date().toISOString(), sha256, chars: text.length,
      ai_pct: typeof aiPct === "number" ? aiPct : null, source: "PangramScore",
    }) + "\n", "utf-8");
  } catch (err) {
    console.error("[PangramScore] run-record write failed:", err);
  }
}
const DEFAULT_URL = "https://text.external-api.pangram.com/task";

function loadKey(): string {
  const fromEnv = process.env.PANGRAM_API_KEY;
  if (fromEnv) return fromEnv;
  try {
    const env = readFileSync(ENV_PATH, "utf8");
    const line = env.split("\n").find((l) => l.startsWith("PANGRAM_API_KEY="));
    if (line) return line.slice("PANGRAM_API_KEY=".length).replace(/^["']|["']$/g, "").trim();
  } catch {}
  console.error("No PANGRAM_API_KEY found. Add it to ~/.claude/.env, then re-run.");
  process.exit(1);
}

function usage(): never {
  console.error(`Usage:
  bun PangramScore.ts "text to score"
  bun PangramScore.ts --file path/to/sample.md
  echo "text" | bun PangramScore.ts
  ... add --json for the raw response`);
  process.exit(1);
}

async function readInput(args: string[]): Promise<string> {
  const fileFlag = args.indexOf("--file");
  if (fileFlag !== -1) {
    const p = args[fileFlag + 1];
    if (!p) usage();
    return readFileSync(p, "utf8");
  }
  const positional = args.filter((a) => a !== "--json");
  if (positional.length) return positional.join(" ");
  if (!process.stdin.isTTY) return await Bun.stdin.text();
  usage();
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const text = (await readInput(args)).trim();
  if (!text) usage();

  const url = process.env.PANGRAM_API_URL || DEFAULT_URL;
  const key = loadKey();

  // Step 1: submit the task.
  const submit = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ text, public_dashboard_link: false }),
  });
  if (!submit.ok) {
    console.error(`Pangram submit ${submit.status}: ${await submit.text()}`);
    process.exit(1);
  }
  const { task_id } = (await submit.json()) as { task_id?: string };
  if (!task_id) {
    console.error("No task_id returned from submit.");
    process.exit(1);
  }

  // Step 2: poll until terminal stage (STAGE_SUCCESS | STAGE_FAILED).
  let data: any = {};
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const poll = await fetch(`${url}/${task_id}`, { headers: { "x-api-key": key } });
    if (!poll.ok) {
      console.error(`Pangram poll ${poll.status}: ${await poll.text()}`);
      process.exit(1);
    }
    data = await poll.json();
    if (data.stage === "STAGE_SUCCESS" || data.stage === "STAGE_FAILED") break;
    await Bun.sleep(1000);
  }
  if (data.stage === "STAGE_FAILED") {
    console.error(`Pangram task failed: ${data.error ?? JSON.stringify(data)}`);
    process.exit(1);
  }

  appendRunRecord(text, data.fraction_ai);

  if (json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const pct = (n: unknown) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
  if (data.stage && data.stage !== "STAGE_SUCCESS") {
    console.log(`⚠️  stage="${data.stage}" — did not reach STAGE_SUCCESS. Check --json.`);
  }
  console.log(`Headline:   ${data.headline ?? data.prediction_short ?? "—"}`);
  console.log(`Verdict:    ${data.prediction ?? "—"}`);
  console.log(`AI:         ${pct(data.fraction_ai)}`);
  console.log(`AI-assisted:${pct(data.fraction_ai_assisted)}`);
  console.log(`Human:      ${pct(data.fraction_human)}`);
  console.log(`Segments:   ${data.num_ai_segments ?? 0} AI / ${data.num_ai_assisted_segments ?? 0} assisted / ${data.num_human_segments ?? 0} human`);
  console.log(`\n→ Lower AI% = reads more human.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
