#!/usr/bin/env bun

/**
 * ApproveCurrentStateEntries — review and commit proposed CURRENT_STATE entries.
 *
 * Per {{PRINCIPAL_NAME}}'s Decision #5: no auto-capture. Every entity requires explicit approval.
 *
 * Workflow:
 *   1. Pollers enqueue proposals via ProposeCurrentStateEntry.ts → proposals.jsonl
 *   2. {{PRINCIPAL_NAME}} runs `bun ApproveCurrentStateEntries.ts --review` to see the queue
 *   3. {{PRINCIPAL_NAME}} runs `bun ApproveCurrentStateEntries.ts --approve <id>` to commit
 *   4. Or `bun ApproveCurrentStateEntries.ts --approve-all` to batch-approve
 *   5. Or `bun ApproveCurrentStateEntries.ts --reject <id>` to drop
 *
 * Approval commits the payload to the target CURRENT_STATE/*.md file as a YAML list
 * item and removes the proposal from the queue.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const QUEUE_FILE = join(LIFEOS_DIR, "USER", "TELOS", "CURRENT_STATE", "proposals.jsonl");
const CURRENT_STATE_DIR = join(LIFEOS_DIR, "USER", "TELOS", "CURRENT_STATE");

type Proposal = {
  id: string;
  timestamp: string;
  source: string;
  target: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
};

function loadQueue(): Proposal[] {
  if (!existsSync(QUEUE_FILE)) return [];
  return readFileSync(QUEUE_FILE, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Proposal);
}

function saveQueue(queue: Proposal[]): void {
  writeFileSync(QUEUE_FILE, queue.map((p) => JSON.stringify(p)).join("\n") + (queue.length ? "\n" : ""));
}

function formatPayload(payload: Record<string, unknown>): string {
  return Object.entries(payload)
    .map(([k, v]) => `    ${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
    .join("\n");
}

function reviewQueue(): void {
  const queue = loadQueue();
  const pending = queue.filter((p) => p.status === "pending");
  if (pending.length === 0) {
    console.log("✅ No pending proposals.");
    return;
  }
  console.log(`═══ Pending proposals (${pending.length}) ═══\n`);
  for (const p of pending) {
    console.log(`ID: ${p.id}`);
    console.log(`  Source: ${p.source}    Target: ${p.target}    At: ${p.timestamp}`);
    console.log(`  Payload:`);
    console.log(formatPayload(p.payload));
    console.log("");
  }
  console.log(`Approve: bun ApproveCurrentStateEntries.ts --approve <id>`);
  console.log(`Reject:  bun ApproveCurrentStateEntries.ts --reject <id>`);
  console.log(`Bulk:    bun ApproveCurrentStateEntries.ts --approve-all`);
}

function appendToTarget(target: string, payload: Record<string, unknown>, source: string): void {
  const targetFile = join(CURRENT_STATE_DIR, `${target}.md`);
  if (!existsSync(targetFile)) {
    console.error(`Target file does not exist: ${targetFile}`);
    return;
  }
  const existing = readFileSync(targetFile, "utf-8");
  const entry = [
    "",
    `<!-- approved ${new Date().toISOString()} from ${source} -->`,
    "- " +
      Object.entries(payload)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
        .join("\n  "),
  ].join("\n");
  writeFileSync(targetFile, existing + entry + "\n");
}

function approve(id: string): void {
  const queue = loadQueue();
  const idx = queue.findIndex((p) => p.id === id && p.status === "pending");
  if (idx === -1) {
    console.error(`No pending proposal with id: ${id}`);
    return;
  }
  const p = queue[idx];
  appendToTarget(p.target, p.payload, p.source);
  queue.splice(idx, 1);
  saveQueue(queue);
  console.log(`✅ Approved and committed: ${id} → ${p.target}`);
}

function reject(id: string): void {
  const queue = loadQueue();
  const before = queue.length;
  const filtered = queue.filter((p) => !(p.id === id && p.status === "pending"));
  if (filtered.length === before) {
    console.error(`No pending proposal with id: ${id}`);
    return;
  }
  saveQueue(filtered);
  console.log(`🗑️  Rejected: ${id}`);
}

function approveAll(): void {
  const queue = loadQueue();
  const pending = queue.filter((p) => p.status === "pending");
  if (pending.length === 0) {
    console.log("No pending proposals.");
    return;
  }
  console.log(`Approving ${pending.length} proposals...`);
  for (const p of pending) {
    appendToTarget(p.target, p.payload, p.source);
  }
  const remaining = queue.filter((p) => p.status !== "pending");
  saveQueue(remaining);
  console.log(`✅ ${pending.length} proposals approved and committed.`);
}

// ─── Main ───

const args = process.argv.slice(2);

if (args.includes("--review")) {
  reviewQueue();
} else if (args.includes("--approve-all")) {
  approveAll();
} else if (args.includes("--approve")) {
  const idx = args.indexOf("--approve");
  approve(args[idx + 1]);
} else if (args.includes("--reject")) {
  const idx = args.indexOf("--reject");
  reject(args[idx + 1]);
} else {
  console.log("Usage:");
  console.log("  bun ApproveCurrentStateEntries.ts --review");
  console.log("  bun ApproveCurrentStateEntries.ts --approve <id>");
  console.log("  bun ApproveCurrentStateEntries.ts --reject <id>");
  console.log("  bun ApproveCurrentStateEntries.ts --approve-all");
}
