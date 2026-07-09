#!/usr/bin/env bun
/**
 * WorkSweep.ts — Periodic sweep that catches what event-driven hooks miss.
 *
 * Triggered by ~/Library/LaunchAgents/com.lifeos.worksweep.plist every 60 minutes.
 * Also runnable on-demand:
 *
 *   bun ~/.claude/LIFEOS/TOOLS/WorkSweep.ts            # apply
 *   bun ~/.claude/LIFEOS/TOOLS/WorkSweep.ts --dry-run  # show diff only
 *   bun ~/.claude/LIFEOS/TOOLS/WorkSweep.ts --since 48h  # widen the scan window
 *
 * What it does:
 *   1. Scans MEMORY/WORK/*\/ISA.md for sessions modified in the last 24h
 *   2. For each session with no github_issue: writeback AND no existing repo
 *      issue matching the slug, opens a labeled issue if the session meets
 *      the meaningful-work threshold
 *   3. Adds `stale` label to issues whose ISA hasn't moved in 7d
 *   4. Creates [Project-Check] issues for tracked projects with no commit in 14d
 *      and no open issue currently
 *   5. Creates [Goal] issues for active TELOS goals with zero matching open issues
 *   6. Calls RegenerateTasklist with --commit-push as the final step
 *   7. Appends one JSON line to MEMORY/OBSERVABILITY/worksweep.jsonl
 *
 * Always exits 0. gh failures log but never propagate.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { loadWorkConfig } from "../../hooks/lib/work-config";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const WORK_DIR = join(LIFEOS_DIR, "MEMORY", "WORK");
const OBS_DIR = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
const OBS_LOG = join(OBS_DIR, "worksweep.jsonl");
const PROJECTS_MD = join(LIFEOS_DIR, "USER", "PROJECTS.md");
const PRINCIPAL_TELOS = join(LIFEOS_DIR, "USER", "TELOS", "PRINCIPAL_TELOS.md");
const STATE_DIR = join(LIFEOS_DIR, "MEMORY", "STATE");
const BPE_AUDIT_STATE = join(STATE_DIR, "bpe-last-audit.json");
// Institutionalized subtraction: the system accretes scaffolding faster than it prunes,
// so a BPE pass fires on a cadence instead of depending on someone remembering. Tune here.
const BPE_CADENCE_DAYS = 30;
const BPE_AUDIT_TARGETS = "force-loaded + doctrine surface: CLAUDE.md, LIFEOS_SYSTEM_PROMPT.md, current ALGORITHM/v*.md";

interface IsaFm {
  task: string;
  slug: string;
  effort: string;
  phase: string;
  mode: string;
  started: string;
  updated: string;
  project?: string;
  principal_stated_goal?: string;
  github_issue?: number;
}

interface SweepStats {
  ts: string;
  sessions_scanned: number;
  issues_created: number;
  issues_updated: number;
  issues_stale_labeled: number;
  project_checks_created: number;
  goal_issues_created: number;
  bpe_reminder_created: number;
  duration_ms: number;
  errors: string[];
}

function parseFrontmatter(content: string): IsaFm | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm: Record<string, string | number> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const v = kv[2].replace(/^["']|["']$/g, "");
      fm[kv[1]] = /^\d+$/.test(v) ? parseInt(v, 10) : v;
    }
  }
  return fm as unknown as IsaFm;
}

function listSessionDirs(): string[] {
  if (!existsSync(WORK_DIR)) return [];
  return readdirSync(WORK_DIR)
    .map((n) => join(WORK_DIR, n))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, "ISA.md")));
}

function isMeaningfulWork(fm: IsaFm, isaPath: string): boolean {
  // Skip empty/abandoned scaffolds — no progress, no phase advance.
  // ALGORITHM sessions: must be at phase execute or beyond.
  if (fm.mode !== "native") {
    return ["execute", "verify", "learn", "complete"].includes(fm.phase);
  }
  // NATIVE sessions: require ≥2 artifacts beyond ISA.md in the dir (signals real work,
  // not a placeholder native row with only the scaffold).
  try {
    const dir = isaPath.replace(/\/ISA\.md$/, "");
    const contents = readdirSync(dir).filter((n) => n !== "ISA.md" && !n.startsWith("."));
    return contents.length >= 2;
  } catch {
    return false;
  }
}

function taskOrSlug(fm: IsaFm): string {
  // Fallback when older ISAs don't have a task field — use slug as readable approximation.
  if (fm.task && fm.task !== "undefined") return fm.task;
  return fm.slug.replace(/^\d+-?\d*_?/, "").replace(/-/g, " ");
}

async function ghIssueSearchSlug(repo: string, slug: string): Promise<{ number: number; url: string } | null> {
  const proc = Bun.spawn(
    ["gh", "issue", "list", "--repo", repo, "--state", "all", "--search", `[slug:${slug}]`, "--limit", "3", "--json", "number,url,title"],
    { stdout: "pipe", stderr: "pipe", timeout: 8000 },
  );
  const out = await new Response(proc.stdout).text();
  const exit = await proc.exited;
  if (exit !== 0) return null;
  try {
    const items = JSON.parse(out) as Array<{ number: number; url: string; title: string }>;
    const hit = items.find((i) => i.title.includes(`[slug:${slug}]`));
    return hit ? { number: hit.number, url: hit.url } : null;
  } catch {
    return null;
  }
}

async function ghLabelsExisting(repo: string): Promise<Set<string>> {
  const proc = Bun.spawn(
    ["gh", "label", "list", "--repo", repo, "--limit", "500", "--json", "name"],
    { stdout: "pipe", stderr: "pipe", timeout: 8000 },
  );
  const out = await new Response(proc.stdout).text();
  const exit = await proc.exited;
  if (exit !== 0) return new Set();
  try {
    const arr = JSON.parse(out) as Array<{ name: string }>;
    return new Set(arr.map((l) => l.name.toLowerCase()));
  } catch {
    return new Set();
  }
}

function filterLabels(labels: string[], existing: Set<string>): string[] {
  if (existing.size === 0) return labels;
  return labels.filter((l) => existing.has(l.toLowerCase()));
}

async function ghCreateIssue(repo: string, title: string, body: string, labels: string[]): Promise<{ number: number; url: string } | null> {
  const args = ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body, ...labels.flatMap((l) => ["--label", l])];
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", timeout: 10000 });
  const out = await new Response(proc.stdout).text();
  const exit = await proc.exited;
  if (exit !== 0) return null;
  const m = out.trim().match(/\/issues\/(\d+)$/);
  return m ? { number: parseInt(m[1], 10), url: out.trim() } : null;
}

async function ghAddLabel(repo: string, issueNumber: number, label: string): Promise<boolean> {
  const proc = Bun.spawn(
    ["gh", "issue", "edit", String(issueNumber), "--repo", repo, "--add-label", label],
    { stdout: "ignore", stderr: "pipe", timeout: 8000 },
  );
  const exit = await proc.exited;
  return exit === 0;
}

async function ghListOpenIssues(repo: string): Promise<Array<{ number: number; title: string; labels: string[]; updatedAt: string }>> {
  const proc = Bun.spawn(
    ["gh", "issue", "list", "--repo", repo, "--state", "open", "--limit", "500", "--json", "number,title,labels,updatedAt"],
    { stdout: "pipe", stderr: "pipe", timeout: 10000 },
  );
  const out = await new Response(proc.stdout).text();
  const exit = await proc.exited;
  if (exit !== 0) return [];
  try {
    const arr = JSON.parse(out) as Array<{ number: number; title: string; labels: Array<{ name: string }>; updatedAt: string }>;
    return arr.map((i) => ({ number: i.number, title: i.title, labels: i.labels.map((l) => l.name), updatedAt: i.updatedAt }));
  } catch {
    return [];
  }
}

// Classify a session's work into a canonical Type:* label from its task text.
// Replaces the old hardcoded Type:queue so swept items say what they actually
// are (research / feature / problem / project / decision), making the work list
// filterable instead of 463 undifferentiated "captured idea" rows. Order is
// most-specific-first; genuinely ambiguous text falls back to Type:queue.
// Canonical Type set lives in USER/WORK/labels.yml.
export function classifyType(text: string): string {
  const t = (text || "").toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => t.includes(k));
  // Structural prefixes win — WorkSweep's own sub-sweeps mint these and the type
  // is unambiguous from the marker (a TELOS goal is a multi-month project; a
  // stalled-project nudge is friction to resolve).
  if (t.includes("[goal:") || t.startsWith("[goal]")) return "Type:project";
  if (t.includes("[project-check]")) return "Type:decision"; // "is this paused/done?" — a status decision
  if (has("fix ", "fixed", "broken", "bug", "regression", "troubleshoot", "debug", "repair", "outage", "failing", "wedge", "secure", "harden", "patch", "permanently fix", "stalled")) return "Type:problem";
  if (has("research", "investigate", "analyze", "analysis", "audit", "explore", "figure out", "deep dive", "deep research", "understand", "evaluate", "comparison", "explain", "mine ", "recommend", "assess", "review", "study", "feasibility", "options")) return "Type:research";
  if (has("decide", "decision", "should i", "choose", "pick between", "keep-or-delete", "keep or delete")) return "Type:decision";
  if (has("remind me", "reminder", "deadline", "due date")) return "Type:reminder";
  if (has("platform", "multi-week", "major application", "new major", "pipeline", "subsystem", "migrate", "migration", "end-to-end", "convert", "scale ", "rollout", "rework", "release ")) return "Type:project";
  if (has("build", "implement", "ship", "create", "add ", "upgrade", "redesign", "rewrite", "wire", "make ", "design", "generate", "integrate", "refactor", "deploy", "fix-up", "set up", "stand up", "lock ", "get ", "operational", "show ", "propagate", "draft", "statusline", "roster", "webhook", "csv", "enable", "support", "example section", "clean up", "unify", "extract", "replace", "dedupe", "install", "skill")) return "Type:feature";
  return "Type:queue"; // genuinely uncategorizable → stays a triage item
}

async function sweepSessions(
  repo: string,
  sinceMs: number,
  existingLabels: Set<string>,
  projectProperty: (p: string | undefined) => string,
  dryRun: boolean,
  maxCreate: number,
  stats: SweepStats,
): Promise<void> {
  const cutoff = Date.now() - sinceMs;
  const dirs = listSessionDirs();
  for (const dir of dirs) {
    const isaPath = join(dir, "ISA.md");
    const mtime = statSync(isaPath).mtimeMs;
    if (mtime < cutoff) continue;
    stats.sessions_scanned++;

    const content = readFileSync(isaPath, "utf-8");
    const fm = parseFrontmatter(content);
    if (!fm || !fm.slug) continue;
    if (fm.github_issue) continue; // already synced

    // Look up by slug to avoid duplicating issues created by hook
    const existing = await ghIssueSearchSlug(repo, fm.slug);
    if (existing) continue;

    if (!isMeaningfulWork(fm, isaPath)) continue;

    const isNative = fm.mode === "native";
    const titlePrefix = isNative ? "[Native]" : "[Sweep]";
    const title = `${titlePrefix} ${taskOrSlug(fm)} [slug:${fm.slug}]`;
    const labels = filterLabels([
      "pai-sync",
      isNative ? "auto-native" : "auto-sweep",
      classifyType(taskOrSlug(fm)),
      "Status:queued",
      projectProperty(fm.project),
      "Priority:P3",
      "Agent:kai",
    ], existingLabels);
    const goalLine = fm.principal_stated_goal ? `\n> 🎯 **Principal stated goal:** ${fm.principal_stated_goal}\n` : "";
    const body = [
      `## 🧹 Captured by WorkSweep`,
      goalLine,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Task** | ${taskOrSlug(fm)} |`,
      `| **Effort** | ${fm.effort} |`,
      `| **Mode** | ${fm.mode} |`,
      `| **Phase** | ${fm.phase} |`,
      `| **Project** | ${fm.project ?? "—"} |`,
      `| **Slug** | \`${fm.slug}\` |`,
      `| **ISA** | \`${isaPath.replace(HOME, "~")}\` |`,
      `| **Updated** | ${fm.updated} |`,
      "",
      `---`,
      `*Auto-captured by LifeOS WorkSweep (${titlePrefix === "[Native]" ? "NATIVE-mode session with artifacts" : "untracked Algorithm session"})*`,
    ].filter(Boolean).join("\n");

    if (stats.issues_created >= maxCreate) {
      console.error(`[WorkSweep] hit --max-create ${maxCreate}, stopping session sweep`);
      stats.errors.push(`max-create cap hit at ${maxCreate}`);
      break;
    }
    if (dryRun) {
      console.log(`+ would create ${titlePrefix} ${taskOrSlug(fm)} (${fm.slug}) labels=${labels.join(",")}`);
      stats.issues_created++;
      continue;
    }
    const created = await ghCreateIssue(repo, title, body, labels);
    if (created) {
      console.log(`+ created #${created.number} ${title}`);
      stats.issues_created++;
    } else {
      stats.errors.push(`create failed: ${fm.slug}`);
    }
  }
}

async function sweepStaleIssues(
  repo: string,
  openIssues: Array<{ number: number; title: string; labels: string[]; updatedAt: string }>,
  dryRun: boolean,
  stats: SweepStats,
): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  for (const issue of openIssues) {
    if (issue.labels.includes("stale")) continue;
    const inProgress = issue.labels.some((l) => /^Status:in-progress$/i.test(l) || /^in-progress$/i.test(l));
    if (!inProgress) continue;
    if (Date.parse(issue.updatedAt) > sevenDaysAgo) continue;
    if (dryRun) {
      console.log(`~ would label #${issue.number} stale (in-progress >7d)`);
      stats.issues_stale_labeled++;
      continue;
    }
    if (await ghAddLabel(repo, issue.number, "stale")) {
      console.log(`~ labeled #${issue.number} stale`);
      stats.issues_stale_labeled++;
    }
  }
}

interface ProjectRow { name: string; pathLocal: string; }

function parseProjectsMd(): ProjectRow[] {
  if (!existsSync(PROJECTS_MD)) return [];
  const content = readFileSync(PROJECTS_MD, "utf-8");
  const rows: ProjectRow[] = [];
  // Match: | **Name** | `path` | ...
  const re = /^\|\s*\*\*([^*]+)\*\*[^|]*\|\s*`([^`]+)`/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const name = m[1].trim().replace(/[🎯🚨_]/g, "").trim();
    const pathStr = m[2].trim().replace(/^~/, HOME);
    rows.push({ name, pathLocal: pathStr });
  }
  return rows;
}

async function lastCommitAgeDays(repoPath: string): Promise<number | null> {
  if (!existsSync(join(repoPath, ".git"))) return null;
  const proc = Bun.spawn(
    ["git", "-C", repoPath, "log", "-1", "--format=%ct"],
    { stdout: "pipe", stderr: "ignore", timeout: 5000 },
  );
  const out = await new Response(proc.stdout).text();
  const exit = await proc.exited;
  if (exit !== 0) return null;
  const ts = parseInt(out.trim(), 10);
  if (!ts) return null;
  return Math.round((Date.now() / 1000 - ts) / 86400);
}

async function sweepProjectChecks(
  repo: string,
  openIssues: Array<{ number: number; title: string }>,
  existingLabels: Set<string>,
  projectProperty: (p: string | undefined) => string,
  dryRun: boolean,
  stats: SweepStats,
): Promise<void> {
  const rows = parseProjectsMd();
  const openTitlesLower = openIssues.map((i) => i.title.toLowerCase());
  for (const row of rows) {
    const age = await lastCommitAgeDays(row.pathLocal);
    if (age === null) continue; // not a git repo or path missing
    if (age < 14) continue;
    const title = `[Project-Check] ${row.name} — no commits in ${age} days`;
    // Dedup on the STABLE project prefix, not the full title. The day-count in
    // the title changes every run, so exact-title matching never matched the
    // next day and refiled a fresh duplicate daily (the 12-13x dupes bug).
    const prefix = `[project-check] ${row.name.toLowerCase()} —`;
    if (openTitlesLower.some((t) => t.startsWith(prefix))) continue;
    const labels = filterLabels([
      "pai-sync",
      "auto-sweep",
      "Type:decision",
      "Status:queued",
      projectProperty(row.name.toLowerCase()),
      "Priority:P3",
      "Agent:kai",
      "stale",
    ], existingLabels);
    const body = [
      `## 🧹 Project Check`,
      "",
      `**Project:** ${row.name}`,
      `**Path:** \`${row.pathLocal.replace(HOME, "~")}\``,
      `**Last commit:** ${age} days ago`,
      "",
      `Is this project paused, complete, or just slow? If active, push a commit or close this. If paused, label \`Status:blocked\` with reason. If done, close.`,
      "",
      `---`,
      `*Auto-generated by LifeOS WorkSweep*`,
    ].join("\n");

    if (dryRun) {
      console.log(`+ would create project-check: ${title}`);
      stats.project_checks_created++;
      continue;
    }
    const created = await ghCreateIssue(repo, title, body, labels);
    if (created) {
      console.log(`+ created #${created.number} ${title}`);
      stats.project_checks_created++;
    }
  }
}

interface TelosGoal { id: string; text: string; }

function parseActiveGoals(): TelosGoal[] {
  if (!existsSync(PRINCIPAL_TELOS)) return [];
  const content = readFileSync(PRINCIPAL_TELOS, "utf-8");
  // Find "## Active Goals" section, extract "- **GN**: text"
  const sectionM = content.match(/## Active Goals[\s\S]*?(?=\n## |\Z)/);
  if (!sectionM) return [];
  const out: TelosGoal[] = [];
  const re = /^- \*\*(G\d+)\*\*:\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sectionM[0])) !== null) {
    out.push({ id: m[1], text: m[2].trim() });
  }
  return out;
}

async function sweepGoals(
  repo: string,
  openIssues: Array<{ number: number; title: string }>,
  existingLabels: Set<string>,
  dryRun: boolean,
  stats: SweepStats,
): Promise<void> {
  const goals = parseActiveGoals();
  for (const g of goals) {
    const tag = `[goal:${g.id}]`;
    if (openIssues.some((i) => i.title.includes(tag))) continue;
    const title = `[Goal] ${g.text} ${tag}`;
    const labels = filterLabels([
      "pai-sync",
      "auto-sweep",
      "Type:project",
      "Status:queued",
      "Property:internal",
      "Priority:P2",
      "Agent:kai",
    ], existingLabels);
    const body = [
      `## 🎯 TELOS Goal`,
      "",
      `**Goal:** ${g.id} — ${g.text}`,
      "",
      `This goal is in your active TELOS but has no matching open issue. Pick a concrete next action, break it down, or close this if the goal needs to be deferred.`,
      "",
      `Source: \`LIFEOS/USER/TELOS/PRINCIPAL_TELOS.md\` → \`## Active Goals\``,
      "",
      `---`,
      `*Auto-generated by LifeOS WorkSweep*`,
    ].join("\n");

    if (dryRun) {
      console.log(`+ would create goal: ${title}`);
      stats.goal_issues_created++;
      continue;
    }
    const created = await ghCreateIssue(repo, title, body, labels);
    if (created) {
      console.log(`+ created #${created.number} ${title}`);
      stats.goal_issues_created++;
    }
  }
}

// Returns days since the last BPE audit, or null if never stamped (→ treat as due).
function daysSinceLastBpeAudit(): number | null {
  if (!existsSync(BPE_AUDIT_STATE)) return null;
  try {
    const { date } = JSON.parse(readFileSync(BPE_AUDIT_STATE, "utf8"));
    const then = new Date(date).getTime();
    if (Number.isNaN(then)) return null;
    return Math.floor((Date.now() - then) / 86400000);
  } catch {
    return null;
  }
}

// Resets the cadence clock — run after completing a BPE audit.
function stampBpeAudit(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(BPE_AUDIT_STATE, JSON.stringify({ date, stamped_by: "WorkSweep --stamp-bpe" }, null, 2) + "\n");
  console.log(`[WorkSweep] BPE audit stamped: ${date}`);
}

// Institutionalized subtraction. When a BPE pass is overdue and no reminder is already
// open, surface ONE propose-only reminder — never auto-cuts (a cut needs ratification).
async function sweepBpeCadence(
  repo: string,
  openIssues: Array<{ number: number; title: string }>,
  existingLabels: Set<string>,
  dryRun: boolean,
  stats: SweepStats,
): Promise<void> {
  const days = daysSinceLastBpeAudit();
  if (days !== null && days < BPE_CADENCE_DAYS) return; // not due yet
  const tag = "[bpe-audit-due]";
  if (openIssues.some((i) => i.title.includes(tag))) return; // reminder already open
  const overdue = days === null ? "never run" : `${days}d since last (cadence ${BPE_CADENCE_DAYS}d)`;
  const title = `[BPE] Subtraction pass due — ${overdue} ${tag}`;
  const labels = filterLabels([
    "pai-sync",
    "auto-sweep",
    "Type:reminder",
    "Status:queued",
    "Property:internal",
    "Priority:P3",
    "Agent:kai",
  ], existingLabels);
  const body = [
    `## 🪓 Scheduled BitterPillEngineering pass`,
    "",
    `As model capability rises, the healthy line (right amount of scaffolding) DROPS — but the actual line keeps climbing, because adding feels productive and pruning feels like nothing. The gap widens unless subtraction is scheduled. This is that schedule.`,
    "",
    `**Run:** \`Skill("BitterPillEngineering", "audit")\` over the ${BPE_AUDIT_TARGETS}.`,
    `**Cadence:** every ${BPE_CADENCE_DAYS} days. Last audit: ${days === null ? "never" : days + " days ago"}.`,
    `**Then stamp it:** \`bun ~/.claude/LIFEOS/TOOLS/WorkSweep.ts --stamp-bpe\` to reset the clock.`,
    "",
    `Propose-only — never auto-cut. A cut needs judgment + ratification (the producer-lock / shadow-log call is why).`,
    "",
    `---`,
    `*Auto-generated by LifeOS WorkSweep*`,
  ].join("\n");
  if (dryRun) {
    console.log(`+ would create BPE reminder: ${title}`);
    stats.bpe_reminder_created++;
    return;
  }
  const created = await ghCreateIssue(repo, title, body, labels);
  if (created) {
    console.log(`+ created #${created.number} ${title}`);
    stats.bpe_reminder_created++;
  }
}

function writeLogLine(stats: SweepStats): void {
  if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
  appendFileSync(OBS_LOG, JSON.stringify(stats) + "\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--stamp-bpe")) { stampBpeAudit(); process.exit(0); }
  const dryRun = args.includes("--dry-run");
  const sinceIdx = args.indexOf("--since");
  const sinceHours = sinceIdx >= 0 ? parseInt(args[sinceIdx + 1].replace(/h$/, ""), 10) : 24;
  const sinceMs = sinceHours * 3600 * 1000;
  const maxCreateIdx = args.indexOf("--max-create");
  const maxCreate = maxCreateIdx >= 0 ? parseInt(args[maxCreateIdx + 1], 10) : 50;

  const t0 = Date.now();
  const stats: SweepStats = {
    ts: new Date().toISOString(),
    sessions_scanned: 0,
    issues_created: 0,
    issues_updated: 0,
    issues_stale_labeled: 0,
    project_checks_created: 0,
    goal_issues_created: 0,
    bpe_reminder_created: 0,
    duration_ms: 0,
    errors: [],
  };

  const cfg = loadWorkConfig();
  if (!cfg.enabled || !cfg.repo) {
    console.error(`[WorkSweep] disabled: ${cfg.reason}`);
    stats.errors.push(`disabled: ${cfg.reason}`);
    stats.duration_ms = Date.now() - t0;
    writeLogLine(stats);
    process.exit(0);
  }
  if (!cfg.captureSweep) {
    console.error("[WorkSweep] CAPTURE_SWEEP=false in config — skipping");
    stats.duration_ms = Date.now() - t0;
    writeLogLine(stats);
    process.exit(0);
  }

  console.error(`[WorkSweep] repo=${cfg.repo} since=${sinceHours}h max-create=${maxCreate} ${dryRun ? "DRY RUN" : "APPLY"}`);

  const [existingLabels, openIssues] = await Promise.all([
    ghLabelsExisting(cfg.repo),
    ghListOpenIssues(cfg.repo),
  ]);

  await sweepSessions(cfg.repo, sinceMs, existingLabels, cfg.projectProperty, dryRun, maxCreate, stats);
  await sweepStaleIssues(cfg.repo, openIssues, dryRun, stats);
  await sweepProjectChecks(cfg.repo, openIssues, existingLabels, cfg.projectProperty, dryRun, stats);
  await sweepGoals(cfg.repo, openIssues, existingLabels, dryRun, stats);
  await sweepBpeCadence(cfg.repo, openIssues, existingLabels, dryRun, stats);

  stats.duration_ms = Date.now() - t0;
  writeLogLine(stats);
  console.error(`[WorkSweep] done in ${stats.duration_ms}ms — sessions=${stats.sessions_scanned} new=${stats.issues_created} stale=${stats.issues_stale_labeled} project-checks=${stats.project_checks_created} goals=${stats.goal_issues_created} bpe=${stats.bpe_reminder_created}`);

  // Final step: regenerate the TASKLIST.md and push (best-effort, never blocks)
  if (!dryRun) {
    const proc = Bun.spawn(
      ["bun", join(HOME, ".claude", "skills", "_ULWORK", "Tools", "RegenerateTasklist.ts"), "--commit-push"],
      { stdout: "inherit", stderr: "inherit", timeout: 30000 },
    );
    await proc.exited;
  }

  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => { console.error(`[WorkSweep] Fatal: ${err}`); process.exit(0); });
}
