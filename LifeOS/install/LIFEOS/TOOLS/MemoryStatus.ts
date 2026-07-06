#!/usr/bin/env bun
/**
 * MemoryStatus — read-only viewer for LifeOS's memory subsystem.
 *
 * F10 of the autonomic memory subsystem.
 *
 * Prints a terminal-formatted snapshot of:
 *   - Memory hot-layer files (PRINCIPAL_MEMORY.md, DA_MEMORY.md): entry count,
 *     char usage, cap utilization.
 *   - Idea / knowledge corpus sizes (file counts).
 *   - Pending proposals queue depth + most recent ids.
 *   - Last reviewer-run summary from reviewer-runs.jsonl.
 *   - Last retrieval summary from memory-retrievals.jsonl (when present).
 *   - Trigger state from review-state.json (turn count, pending flag,
 *     time since last review).
 *
 * Read-only: never opens any file outside the memory subsystem's known paths
 * (ISC-117). Exits 0 on success (ISC-116).
 *
 * Usage:
 *   bun MemoryStatus.ts            # full status block
 *   bun MemoryStatus.ts --json     # machine-readable JSON output
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join as pathJoin, resolve as pathResolve } from "node:path";
import {
  PRINCIPAL_MEMORY_PATH,
  DA_MEMORY_PATH,
  PENDING_PROPOSALS_PATH,
} from "./MemoryTypes";
import { read as readMemory } from "./MemoryWriter";
import { getClaudeDir } from "./Paths";

const CLAUDE_ROOT = getClaudeDir();
const LIFEOS_DIR = pathJoin(CLAUDE_ROOT, "LIFEOS");
const IDEAS_DIR = pathJoin(LIFEOS_DIR, "MEMORY", "IDEAS");
const KNOWLEDGE_DIR = pathJoin(LIFEOS_DIR, "MEMORY", "KNOWLEDGE");
const OBS_DIR = pathJoin(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
const REVIEW_STATE_PATH = pathJoin(OBS_DIR, "review-state.json");
const REVIEWER_RUNS_PATH = pathJoin(OBS_DIR, "reviewer-runs.jsonl");
const RETRIEVALS_PATH = pathJoin(OBS_DIR, "memory-retrievals.jsonl");

interface MemoryFileStats {
  path: string;
  exists: boolean;
  count: number;
  chars_used: number;
  cap_entries: number;
  cap_chars_total: number;
}

interface CorpusStats {
  dir: string;
  exists: boolean;
  file_count: number;
}

interface ProposalQueueStats {
  pending: number;
  total_observed: number;
  most_recent_ids: string[];
  /** P1 2026-05-25: count of pending proposals grouped by subtype. */
  pending_by_kind: Record<string, number>;
}

interface ReviewStateSnapshot {
  turn_count_since_last_review: number;
  pending_review: boolean;
  last_review_at: string | null;
  last_message_at: string | null;
  minutes_since_last_review: number | null;
  idle_minutes: number | null;
}

interface ReviewerRunSummary {
  ts: string;
  ok?: boolean;
  duration_ms?: number;
  items_total?: number;
  memory_writes?: number;
  knowledge_appends?: number;
  proposals_enqueued?: number;
}

interface RetrievalSummary {
  ts: string;
  query_hash?: string;
  top_score?: number;
  returned_count?: number;
  duration_ms?: number;
}

interface StatusReport {
  generated_at: string;
  memory_files: { principal: MemoryFileStats; da: MemoryFileStats };
  corpus: { ideas: CorpusStats; knowledge: CorpusStats };
  proposals: ProposalQueueStats;
  review_state: ReviewStateSnapshot | null;
  last_reviewer_run: ReviewerRunSummary | null;
  last_retrieval: RetrievalSummary | null;
}

function memoryFileStats(path: string): MemoryFileStats {
  const exists = existsSync(path);
  const empty: MemoryFileStats = {
    path,
    exists,
    count: 0,
    chars_used: 0,
    cap_entries: 0,
    cap_chars_total: 0,
  };
  if (!exists) return empty;
  try {
    const r = readMemory(path);
    if ("code" in r) return empty;
    return {
      path,
      exists: true,
      count: r.count,
      chars_used: r.chars_used,
      cap_entries: r.cap_entries,
      cap_chars_total: r.cap_chars,
    };
  } catch {
    return empty;
  }
}

function corpusStats(dir: string): CorpusStats {
  if (!existsSync(dir)) return { dir, exists: false, file_count: 0 };
  let count = 0;
  try {
    const walk = (d: string): void => {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const full = pathJoin(d, ent.name);
        if (ent.isDirectory()) walk(full);
        else if (ent.isFile() && ent.name.endsWith(".md")) count += 1;
      }
    };
    walk(dir);
  } catch {
    // best-effort
  }
  return { dir, exists: true, file_count: count };
}

function proposalQueueStats(): ProposalQueueStats {
  const empty: ProposalQueueStats = { pending: 0, total_observed: 0, most_recent_ids: [], pending_by_kind: {} };
  if (!existsSync(PENDING_PROPOSALS_PATH)) return empty;
  try {
    const raw = readFileSync(PENDING_PROPOSALS_PATH, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    let pending = 0;
    const recent: string[] = [];
    const pendingByKind: Record<string, number> = {};
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as { id?: string; status?: string; target_kind?: string; target_file?: string };
        if (row.status === "pending") {
          pending += 1;
          // P1 2026-05-25: group pending by subtype.
          const kind = row.target_kind ?? "identity";
          pendingByKind[kind] = (pendingByKind[kind] ?? 0) + 1;
        }
        if (row.id) recent.push(row.id);
      } catch {
        // skip malformed row
      }
    }
    return {
      pending,
      total_observed: lines.length,
      most_recent_ids: recent.slice(-5).reverse(),
      pending_by_kind: pendingByKind,
    };
  } catch {
    return empty;
  }
}

function reviewStateSnapshot(): ReviewStateSnapshot | null {
  if (!existsSync(REVIEW_STATE_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(REVIEW_STATE_PATH, "utf8"));
    const now = Date.now();
    const parseIso = (s: string | null): number | null => {
      if (!s) return null;
      const ms = Date.parse(s);
      return Number.isNaN(ms) ? null : ms;
    };
    const lastReviewMs = parseIso(raw.last_review_at ?? null);
    const lastMsgMs = parseIso(raw.last_message_at ?? null);
    return {
      turn_count_since_last_review: typeof raw.turn_count_since_last_review === "number" ? raw.turn_count_since_last_review : 0,
      pending_review: !!raw.pending_review,
      last_review_at: typeof raw.last_review_at === "string" ? raw.last_review_at : null,
      last_message_at: typeof raw.last_message_at === "string" ? raw.last_message_at : null,
      minutes_since_last_review: lastReviewMs ? Math.round((now - lastReviewMs) / 60_000) : null,
      idle_minutes: lastMsgMs ? Math.round((now - lastMsgMs) / 60_000) : null,
    };
  } catch {
    return null;
  }
}

function lastJsonlRow<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]!) as T;
  } catch {
    return null;
  }
}

function buildReport(): StatusReport {
  return {
    generated_at: new Date().toISOString(),
    memory_files: {
      principal: memoryFileStats(PRINCIPAL_MEMORY_PATH),
      da: memoryFileStats(DA_MEMORY_PATH),
    },
    corpus: {
      ideas: corpusStats(IDEAS_DIR),
      knowledge: corpusStats(KNOWLEDGE_DIR),
    },
    proposals: proposalQueueStats(),
    review_state: reviewStateSnapshot(),
    last_reviewer_run: lastJsonlRow<ReviewerRunSummary>(REVIEWER_RUNS_PATH),
    last_retrieval: lastJsonlRow<RetrievalSummary>(RETRIEVALS_PATH),
  };
}

function formatPct(used: number, cap: number): string {
  if (cap <= 0) return "0%";
  return `${Math.round((used / cap) * 100)}%`;
}

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "invalid-timestamp";
  const deltaMin = (Date.now() - ms) / 60_000;
  if (deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${Math.round(deltaMin)} min ago`;
  if (deltaMin < 60 * 24) return `${(deltaMin / 60).toFixed(1)}h ago`;
  return `${(deltaMin / (60 * 24)).toFixed(1)}d ago`;
}

function renderText(r: StatusReport): string {
  const out: string[] = [];
  out.push("kai status — LifeOS memory subsystem");
  out.push("─".repeat(48));
  out.push("");
  out.push("Hot-layer memory files:");
  const p = r.memory_files.principal;
  const d = r.memory_files.da;
  out.push(`  PRINCIPAL_MEMORY.md   ${p.exists ? `${p.count}/${p.cap_entries} entries · ${p.chars_used}/${p.cap_chars_total} chars (${formatPct(p.count, p.cap_entries)} full)` : "missing"}`);
  out.push(`  DA_MEMORY.md          ${d.exists ? `${d.count}/${d.cap_entries} entries · ${d.chars_used}/${d.cap_chars_total} chars (${formatPct(d.count, d.cap_entries)} full)` : "missing"}`);
  out.push("");
  out.push("Corpus:");
  out.push(`  ideas       ${r.corpus.ideas.exists ? `${r.corpus.ideas.file_count} notes` : "no dir yet"}`);
  out.push(`  knowledge   ${r.corpus.knowledge.exists ? `${r.corpus.knowledge.file_count} notes` : "no dir yet"}`);
  out.push("");
  out.push("Pending proposals:");
  out.push(`  queue depth   ${r.proposals.pending} pending (${r.proposals.total_observed} lifetime)`);
  const kindEntries = Object.entries(r.proposals.pending_by_kind ?? {});
  if (kindEntries.length > 0) {
    const byKind = kindEntries.sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(" ");
    out.push(`  by subtype    ${byKind}`);
  }
  if (r.proposals.most_recent_ids.length > 0) {
    out.push(`  recent ids    ${r.proposals.most_recent_ids.map((id) => `#${id}`).join(" ")}`);
  }
  out.push("");
  out.push("Reviewer state:");
  if (r.review_state) {
    const s = r.review_state;
    out.push(`  turns since   ${s.turn_count_since_last_review}`);
    out.push(`  pending fire  ${s.pending_review ? "YES" : "no"}`);
    out.push(`  last review   ${relTime(s.last_review_at)}`);
    out.push(`  last message  ${relTime(s.last_message_at)}`);
  } else {
    out.push("  no state file yet (hooks have not fired)");
  }
  out.push("");
  out.push("Last reviewer run:");
  if (r.last_reviewer_run) {
    const lr = r.last_reviewer_run;
    out.push(`  at            ${relTime(lr.ts)}`);
    out.push(`  ok            ${lr.ok === undefined ? "(unknown)" : lr.ok ? "yes" : "no"}`);
    if (lr.duration_ms !== undefined) out.push(`  duration      ${lr.duration_ms} ms`);
    if (lr.items_total !== undefined) out.push(`  items         ${lr.items_total} total`);
    if (lr.memory_writes !== undefined) out.push(`  memory writes ${lr.memory_writes}`);
    if (lr.knowledge_appends !== undefined) out.push(`  knowledge     ${lr.knowledge_appends}`);
    if (lr.proposals_enqueued !== undefined) out.push(`  proposals     ${lr.proposals_enqueued}`);
  } else {
    out.push("  no runs yet");
  }
  out.push("");
  out.push("Last retrieval:");
  if (r.last_retrieval) {
    const lret = r.last_retrieval;
    out.push(`  at            ${relTime(lret.ts)}`);
    if (lret.returned_count !== undefined) out.push(`  returned      ${lret.returned_count} results`);
    if (lret.top_score !== undefined) out.push(`  top score     ${lret.top_score.toFixed(3)}`);
    if (lret.duration_ms !== undefined) out.push(`  duration      ${lret.duration_ms} ms`);
  } else {
    out.push("  no retrievals logged yet");
  }
  out.push("");
  out.push(`generated   ${r.generated_at}`);
  return out.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const wantJson = args.includes("--json");
  const report = buildReport();
  if (wantJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(renderText(report) + "\n");
  }
  process.exit(0);
}

if (import.meta.main) {
  main();
}

export { buildReport, renderText };
export type { StatusReport };
