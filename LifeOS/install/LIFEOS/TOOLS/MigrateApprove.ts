#!/usr/bin/env bun

/**
 * MigrateApprove — review and commit proposed migration chunks from external
 * sources. Paired with MigrateScan.ts which enqueues proposals.
 *
 * Each proposal has a proposed_target. {{PRINCIPAL_NAME}} can approve (commit as-proposed),
 * modify (change target before commit), skip (drop), or bulk-approve trusted
 * targets.
 *
 * Commits write the chunk content to the target file with a provenance line
 * indicating source_file + source_section + timestamp.
 *
 * Usage:
 *   bun MigrateApprove.ts --review                   Show all pending proposals
 *   bun MigrateApprove.ts --summary                  High-level routing summary
 *   bun MigrateApprove.ts --approve <id>             Commit single proposal
 *   bun MigrateApprove.ts --modify <id> --target X   Change target then commit
 *   bun MigrateApprove.ts --reject <id>              Drop single proposal
 *   bun MigrateApprove.ts --approve-target <target>  Bulk approve all proposals for target
 *   bun MigrateApprove.ts --approve-all              Commit every pending proposal
 *   bun MigrateApprove.ts --reset                    Clear queue (use carefully)
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const QUEUE_FILE = join(LIFEOS_DIR, "MEMORY", "MIGRATION", "migration-proposals.jsonl");
const COMMITTED_LOG = join(LIFEOS_DIR, "MEMORY", "MIGRATION", "committed.jsonl");

type Proposal = {
  id: string;
  timestamp: string;
  source_file: string;
  source_section: string;
  content_preview: string;
  content_full: string;
  proposed_target: string;
  classification_confidence: number;
  classification_reasons: string[];
  alternatives: string[];
  status: "pending" | "approved" | "rejected" | "modified";
};

function loadQueue(): Proposal[] {
  if (!existsSync(QUEUE_FILE)) return [];
  return readFileSync(QUEUE_FILE, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Proposal);
}

function saveQueue(queue: Proposal[]): void {
  const dir = dirname(QUEUE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(QUEUE_FILE, queue.map((p) => JSON.stringify(p)).join("\n") + (queue.length ? "\n" : ""));
}

function logCommit(entry: Record<string, unknown>): void {
  const dir = dirname(COMMITTED_LOG);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(COMMITTED_LOG, JSON.stringify(entry) + "\n");
}

function resolveTargetPath(target: string): string {
  // Map target label to absolute file path.
  if (target.startsWith("TELOS/") || target.startsWith("USER/") || target.startsWith("MEMORY/")) {
    return join(LIFEOS_DIR, target.startsWith("USER/") ? target : target);
  }
  if (target === "memory/feedback") {
    // Feedback memories live outside LifeOS dir in projects/${HARNESS_USER_DIR}/memory/
    return join(HOME, ".claude", "projects", "${HARNESS_USER_DIR}", "memory");
  }
  return join(LIFEOS_DIR, target);
}

function commitProposal(p: Proposal): boolean {
  if (p.proposed_target === "UNCLEAR") {
    console.error(`Cannot commit UNCLEAR proposal. Use --modify first.`);
    return false;
  }

  const targetPath = resolveTargetPath(p.proposed_target);

  const provenance = `\n<!-- migrated ${new Date().toISOString()} from ${p.source_file} :: ${p.source_section} -->\n`;
  const entry = `${provenance}${p.content_full}\n`;

  // Feedback memories = new file per chunk
  if (p.proposed_target === "memory/feedback") {
    if (!existsSync(targetPath)) mkdirSync(targetPath, { recursive: true });
    const slug = p.source_section
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 40);
    const filePath = join(targetPath, `feedback_migrated_${slug}_${p.id.slice(0, 8)}.md`);
    const content = `---
name: ${slug}
description: Migrated from ${p.source_file}
type: feedback
created: ${new Date().toISOString().slice(0, 10)}
---

${p.content_full}
`;
    writeFileSync(filePath, content);
    logCommit({ ...p, committed_at: new Date().toISOString(), target_path: filePath });
    console.log(`✅ Committed to ${filePath}`);
    return true;
  }

  // Knowledge dir = new file per chunk
  if (p.proposed_target.startsWith("MEMORY/KNOWLEDGE/")) {
    if (!existsSync(targetPath)) mkdirSync(targetPath, { recursive: true });
    const slug = p.source_section
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 40);
    const filePath = join(targetPath, `migrated_${slug}_${p.id.slice(0, 8)}.md`);
    const type = p.proposed_target.split("/").pop()?.toLowerCase().replace(/s$/, "") || "idea";
    const content = `---
title: ${p.source_section}
type: ${type}
tags: [migrated]
created: ${new Date().toISOString().slice(0, 10)}
source: "${p.source_file}"
---

${p.content_full}
`;
    writeFileSync(filePath, content);
    logCommit({ ...p, committed_at: new Date().toISOString(), target_path: filePath });
    console.log(`✅ Committed to ${filePath}`);
    return true;
  }

  // Regular TELOS / USER files = append
  if (!existsSync(targetPath)) {
    console.error(`Target file does not exist: ${targetPath}`);
    return false;
  }
  const existing = readFileSync(targetPath, "utf-8");
  writeFileSync(targetPath, existing + entry);
  logCommit({ ...p, committed_at: new Date().toISOString(), target_path: targetPath });
  console.log(`✅ Committed to ${targetPath}`);
  return true;
}

// ─── Commands ───

function cmdReview(): void {
  const queue = loadQueue();
  const pending = queue.filter((p) => p.status === "pending");
  if (pending.length === 0) {
    console.log("✅ No pending proposals.");
    return;
  }
  console.log(`═══ ${pending.length} pending proposals ═══\n`);
  for (const p of pending) {
    const conf = Math.round(p.classification_confidence * 100);
    const icon = p.proposed_target === "UNCLEAR" ? "❓" : conf >= 60 ? "✅" : "⚠️";
    console.log(`${icon}  ${p.id.slice(0, 8)}  →  ${p.proposed_target}  (${conf}%)`);
    console.log(`    Source: ${p.source_file} :: ${p.source_section}`);
    console.log(`    Preview: ${p.content_preview}${p.content_full.length > 160 ? "..." : ""}`);
    if (p.alternatives.length) console.log(`    Alternatives: ${p.alternatives.slice(0, 3).join(", ")}`);
    console.log(``);
  }
  console.log(`Approve: bun MigrateApprove.ts --approve <id>`);
  console.log(`Modify:  bun MigrateApprove.ts --modify <id> --target <new_target>`);
  console.log(`Reject:  bun MigrateApprove.ts --reject <id>`);
  console.log(`Bulk:    bun MigrateApprove.ts --approve-target <target>`);
}

function cmdSummary(): void {
  const queue = loadQueue();
  const pending = queue.filter((p) => p.status === "pending");
  const by: Record<string, { count: number; avg_conf: number }> = {};
  for (const p of pending) {
    by[p.proposed_target] = by[p.proposed_target] || { count: 0, avg_conf: 0 };
    by[p.proposed_target].count += 1;
    by[p.proposed_target].avg_conf += p.classification_confidence;
  }
  console.log(`═══ Migration Queue Summary ═══\n`);
  console.log(`Total pending: ${pending.length}\n`);
  for (const [target, { count, avg_conf }] of Object.entries(by).sort((a, b) => b[1].count - a[1].count)) {
    const conf = Math.round((avg_conf / count) * 100);
    console.log(`  ${target.padEnd(38)}  ${String(count).padStart(3)} chunks  (${conf}% avg confidence)`);
  }
}

function cmdApprove(id: string): void {
  const queue = loadQueue();
  const idx = queue.findIndex((p) => p.id.startsWith(id) && p.status === "pending");
  if (idx === -1) {
    console.error(`No pending proposal matching id: ${id}`);
    return;
  }
  if (commitProposal(queue[idx])) {
    queue.splice(idx, 1);
    saveQueue(queue);
  }
}

function cmdModify(id: string, newTarget: string): void {
  const queue = loadQueue();
  const idx = queue.findIndex((p) => p.id.startsWith(id) && p.status === "pending");
  if (idx === -1) {
    console.error(`No pending proposal matching id: ${id}`);
    return;
  }
  queue[idx].proposed_target = newTarget;
  queue[idx].status = "modified";
  if (commitProposal(queue[idx])) {
    queue.splice(idx, 1);
    saveQueue(queue);
  }
}

function cmdReject(id: string): void {
  const queue = loadQueue();
  const idx = queue.findIndex((p) => p.id.startsWith(id) && p.status === "pending");
  if (idx === -1) {
    console.error(`No pending proposal matching id: ${id}`);
    return;
  }
  queue.splice(idx, 1);
  saveQueue(queue);
  console.log(`🗑️  Rejected ${id}`);
}

function cmdApproveTarget(target: string): void {
  const queue = loadQueue();
  const matching = queue.filter((p) => p.proposed_target === target && p.status === "pending");
  if (matching.length === 0) {
    console.log(`No pending proposals for target ${target}`);
    return;
  }
  console.log(`Committing ${matching.length} proposals for ${target}...`);
  let committed = 0;
  for (const p of matching) {
    if (commitProposal(p)) committed += 1;
  }
  const remaining = queue.filter((p) => !(p.proposed_target === target && p.status === "pending"));
  saveQueue(remaining);
  console.log(`✅ Committed ${committed}/${matching.length} proposals for ${target}`);
}

function cmdApproveAll(): void {
  const queue = loadQueue();
  const pending = queue.filter((p) => p.status === "pending" && p.proposed_target !== "UNCLEAR");
  if (pending.length === 0) {
    console.log("No pending proposals to bulk-approve.");
    return;
  }
  console.log(`Committing ${pending.length} proposals (skipping UNCLEAR)...`);
  let committed = 0;
  for (const p of pending) if (commitProposal(p)) committed += 1;
  const remaining = queue.filter((p) => p.status === "pending" && p.proposed_target === "UNCLEAR");
  saveQueue(remaining);
  console.log(`✅ Committed ${committed}/${pending.length}  —  ${remaining.length} UNCLEAR left for manual routing`);
}

function cmdReset(): void {
  saveQueue([]);
  console.log("Queue cleared.");
}

// ─── Main ───

const args = process.argv.slice(2);

if (args.includes("--review")) cmdReview();
else if (args.includes("--summary")) cmdSummary();
else if (args.includes("--approve-all")) cmdApproveAll();
else if (args.includes("--approve-target")) {
  const idx = args.indexOf("--approve-target");
  cmdApproveTarget(args[idx + 1]);
} else if (args.includes("--approve")) {
  cmdApprove(args[args.indexOf("--approve") + 1]);
} else if (args.includes("--modify")) {
  const id = args[args.indexOf("--modify") + 1];
  const target = args[args.indexOf("--target") + 1];
  if (!target) {
    console.error("--modify requires --target <new_target>");
    process.exit(1);
  }
  cmdModify(id, target);
} else if (args.includes("--reject")) {
  cmdReject(args[args.indexOf("--reject") + 1]);
} else if (args.includes("--reset")) {
  cmdReset();
} else {
  console.log("Usage:");
  console.log("  bun MigrateApprove.ts --review");
  console.log("  bun MigrateApprove.ts --summary");
  console.log("  bun MigrateApprove.ts --approve <id>");
  console.log("  bun MigrateApprove.ts --modify <id> --target <new>");
  console.log("  bun MigrateApprove.ts --reject <id>");
  console.log("  bun MigrateApprove.ts --approve-target <target>");
  console.log("  bun MigrateApprove.ts --approve-all");
  console.log("  bun MigrateApprove.ts --reset");
}
