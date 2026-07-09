#!/usr/bin/env bun
/**
 * CommitmentSweep.ts — Daily sweep over Type:commitment issues.
 *
 * Triggered by ~/Library/LaunchAgents/com.lifeos.commitmentsweep.plist at 7am PT.
 * Also runnable on-demand:
 *
 *   bun ~/.claude/LIFEOS/TOOLS/CommitmentSweep.ts             # apply
 *   bun ~/.claude/LIFEOS/TOOLS/CommitmentSweep.ts --dry-run   # print digest, skip notify
 *   bun ~/.claude/LIFEOS/TOOLS/CommitmentSweep.ts --notify    # force voice notify even when empty
 *
 * What it does:
 *   1. Queries gh for open issues labeled Type:commitment in the WORK repo
 *   2. Parses `commitment-due:` HTML comment from each body (fallback: --due flag in body)
 *   3. Buckets: overdue / due_today / due_this_week / future
 *   4. Voice-notifies on overdue OR due_today (via Pulse /notify)
 *   5. Appends one digest line to MEMORY/OBSERVABILITY/commitment-digest.jsonl
 *
 * Always exits 0. gh / pulse failures log but never propagate.
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { loadWorkConfig } from "../../hooks/lib/work-config";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const OBS_DIR = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
const OBS_LOG = join(OBS_DIR, "commitment-digest.jsonl");
const PULSE_NOTIFY = "http://localhost:31337/notify";

interface GhIssue {
  number: number;
  title: string;
  url: string;
  body: string;
  labels: { name: string }[];
  updatedAt: string;
}

interface Commitment {
  number: number;
  title: string;
  url: string;
  due: string;            // YYYY-MM-DD
  beneficiary: string;
  daysUntilDue: number;   // negative if overdue
  bucket: "overdue" | "due_today" | "due_this_week" | "future";
}

interface Digest {
  ts: string;
  repo: string;
  total_open: number;
  overdue: Commitment[];
  due_today: Commitment[];
  due_this_week: Commitment[];
  future: Commitment[];
  notified: boolean;
  errors: string[];
}

function parseDueFromBody(body: string): string | null {
  const m = body.match(/<!--\s*commitment-due:\s*(\d{4}-\d{2}-\d{2})\s*-->/);
  return m ? m[1] : null;
}

function parseBeneficiaryFromBody(body: string): string {
  const m = body.match(/<!--\s*commitment-beneficiary:\s*(.+?)\s*-->/);
  if (m) return m[1].trim();
  const t = body.match(/\*\*To:\*\*\s*(.+?)\s*$/m);
  return t ? t[1].trim() : "(unknown)";
}

function daysBetween(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDay.getTime() - aDay.getTime()) / MS);
}

function bucket(daysUntilDue: number): Commitment["bucket"] {
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue <= 7) return "due_this_week";
  return "future";
}

function fetchIssues(repo: string): { issues: GhIssue[]; error: string | null } {
  const r = spawnSync(
    "gh",
    [
      "issue", "list",
      "--repo", repo,
      "--label", "Type:commitment",
      "--state", "open",
      "--limit", "500",
      "--json", "number,title,url,body,labels,updatedAt",
    ],
    { encoding: "utf8" },
  );
  if ((r.status ?? 1) !== 0) {
    return { issues: [], error: r.stderr?.trim() || `gh exit ${r.status}` };
  }
  try {
    return { issues: JSON.parse(r.stdout || "[]") as GhIssue[], error: null };
  } catch (err) {
    return { issues: [], error: `parse_failure: ${String(err)}` };
  }
}

function pulseNotify(message: string): boolean {
  const r = spawnSync(
    "curl",
    [
      "-sk", "-X", "POST", PULSE_NOTIFY,
      "-H", "Content-Type: application/json",
      "-d", JSON.stringify({ message, voice_enabled: true }),
      "--max-time", "8",
    ],
    { encoding: "utf8" },
  );
  return (r.status ?? 1) === 0;
}

function renderVoiceLine(digest: Digest): string {
  const od = digest.overdue.length;
  const dt = digest.due_today.length;
  if (od === 0 && dt === 0) return "";

  const parts: string[] = [];
  if (od > 0) {
    parts.push(`${od} ${od === 1 ? "commitment is" : "commitments are"} overdue`);
  }
  if (dt > 0) {
    parts.push(`${dt} ${dt === 1 ? "commitment" : "commitments"} due today`);
  }
  const head = parts.join(", and ");

  const named = [...digest.overdue, ...digest.due_today].slice(0, 3)
    .map((c) => `${c.beneficiary} — ${c.title.replace(/^\[Commitment\]\s*/i, "").replace(/^[^:]+:\s*/, "")}`)
    .join("; ");
  const tail = named ? `. Top items: ${named}.` : ".";
  return `Commitments digest: ${head}${tail}`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const forceNotify = args.includes("--notify");

  mkdirSync(OBS_DIR, { recursive: true });

  const cfg = loadWorkConfig();
  const ts = new Date().toISOString();
  const digest: Digest = {
    ts,
    repo: cfg.repo || "",
    total_open: 0,
    overdue: [],
    due_today: [],
    due_this_week: [],
    future: [],
    notified: false,
    errors: [],
  };

  if (!cfg.enabled || !cfg.repo) {
    digest.errors.push(`work_config_disabled: ${cfg.reason || "unknown"}`);
    appendFileSync(OBS_LOG, JSON.stringify(digest) + "\n");
    console.error(`[CommitmentSweep] disabled: ${cfg.reason}`);
    process.exit(0);
  }

  const { issues, error } = fetchIssues(cfg.repo);
  if (error) digest.errors.push(`gh_fetch: ${error}`);
  digest.total_open = issues.length;

  const now = new Date();
  for (const issue of issues) {
    const due = parseDueFromBody(issue.body || "");
    if (!due) {
      digest.errors.push(`issue_${issue.number}: no due date parsed`);
      continue;
    }
    const dueDate = new Date(due + "T00:00:00");
    if (isNaN(dueDate.getTime())) {
      digest.errors.push(`issue_${issue.number}: invalid due "${due}"`);
      continue;
    }
    const daysUntilDue = daysBetween(now, dueDate);
    const c: Commitment = {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      due,
      beneficiary: parseBeneficiaryFromBody(issue.body || ""),
      daysUntilDue,
      bucket: bucket(daysUntilDue),
    };
    if (c.bucket === "overdue") digest.overdue.push(c);
    else if (c.bucket === "due_today") digest.due_today.push(c);
    else if (c.bucket === "due_this_week") digest.due_this_week.push(c);
    else digest.future.push(c);
  }
  digest.overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  digest.due_this_week.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // Notify
  const voiceLine = renderVoiceLine(digest);
  const shouldNotify = !dryRun && (forceNotify || voiceLine.length > 0);
  if (shouldNotify) {
    const message = voiceLine || `Commitments digest: no overdue or due-today. ${digest.future.length} upcoming.`;
    digest.notified = pulseNotify(message);
    if (!digest.notified) digest.errors.push("pulse_notify_failed");
  }

  appendFileSync(OBS_LOG, JSON.stringify(digest) + "\n");

  // Human-readable stdout
  console.log(
    `[CommitmentSweep] repo=${cfg.repo} total=${digest.total_open} ` +
    `overdue=${digest.overdue.length} today=${digest.due_today.length} ` +
    `week=${digest.due_this_week.length} future=${digest.future.length} ` +
    `notified=${digest.notified} errors=${digest.errors.length}`,
  );
  if (dryRun && voiceLine) console.log(`[CommitmentSweep] would-say: ${voiceLine}`);
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[CommitmentSweep] Fatal: ${String(err)}`);
    process.exit(0);
  });
}
