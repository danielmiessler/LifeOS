#!/usr/bin/env bun

/**
 * ProposeCurrentStateEntry — Pollers and _LIFELOG extractors enqueue proposals here.
 *
 * Per {{PRINCIPAL_NAME}}'s Decision #5: every entity requires explicit approval before landing
 * in CURRENT_STATE. This tool writes to a queue (JSONL). Approval happens via
 * ApproveCurrentStateEntries.ts, which consumes the queue and commits approved
 * entries to the appropriate CURRENT_STATE/*.md file.
 *
 * Usage:
 *   bun ProposeCurrentStateEntry.ts --source <src> --target <file> --json '<payload>'
 *
 * Example:
 *   bun ProposeCurrentStateEntry.ts \
 *     --source lifelog --target CONSUMPTION \
 *     --json '{"category":"restaurant","name":"<sample-restaurant>","cuisine":"thai","visited":"2026-04-14","location":"<your-city>, <your-state>"}'
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const QUEUE_FILE = join(LIFEOS_DIR, "USER", "TELOS", "CURRENT_STATE", "proposals.jsonl");

const ALLOWED_SOURCES = ["lifelog", "calendar", "gmail", "homebridge", "manual", "amazon", "bills"];
const ALLOWED_TARGETS = ["CONSUMPTION", "ACTIVITY", "SOCIAL", "FINANCIAL", "SIGNALS", "SNAPSHOT"];

type Proposal = {
  id: string;
  timestamp: string;
  source: string;
  target: string;
  payload: Record<string, unknown>;
  status: "pending";
};

function parseArgs(): { source: string; target: string; payload: Record<string, unknown> } {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf("--source");
  const targetIdx = args.indexOf("--target");
  const jsonIdx = args.indexOf("--json");

  if (sourceIdx === -1 || targetIdx === -1 || jsonIdx === -1) {
    console.error("Required flags: --source <src> --target <TARGET_FILE> --json '<payload>'");
    process.exit(1);
  }

  const source = args[sourceIdx + 1];
  const target = args[targetIdx + 1];

  if (!ALLOWED_SOURCES.includes(source)) {
    console.error(`source must be one of: ${ALLOWED_SOURCES.join(", ")}`);
    process.exit(1);
  }
  if (!ALLOWED_TARGETS.includes(target)) {
    console.error(`target must be one of: ${ALLOWED_TARGETS.join(", ")}`);
    process.exit(1);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(args[jsonIdx + 1]);
  } catch (err) {
    console.error("Invalid JSON payload:", (err as Error).message);
    process.exit(1);
  }

  return { source, target, payload };
}

function enqueue(proposal: Proposal): void {
  const dir = dirname(QUEUE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(QUEUE_FILE, JSON.stringify(proposal) + "\n");
}

const { source, target, payload } = parseArgs();

const proposal: Proposal = {
  id: randomUUID(),
  timestamp: new Date().toISOString(),
  source,
  target,
  payload,
  status: "pending",
};

enqueue(proposal);

console.log(`✅ Proposal ${proposal.id} enqueued (${source} → ${target})`);
console.log(`Review with: bun ApproveCurrentStateEntries.ts --review`);
