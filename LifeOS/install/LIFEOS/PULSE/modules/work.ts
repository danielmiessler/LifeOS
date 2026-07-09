/**
 * Work — Pulse module rendering the agent-visible Kanban over GitHub Issues.
 *
 * The work system in LifeOS is backed by a private GitHub repo configured at
 * WORK.REPO in USER/WORK/config.yaml. ULWorkSync.hook.ts pushes Algorithm sessions
 * to that repo as issues, and ReminderRouter.hook.ts captures mid-conversation
 * reminders/research/queue intents. This module reads those issues via `gh`
 * and groups them into the configured Kanban columns for the Pulse Work tab.
 *
 * Routes (all under /api/work):
 *   GET  /api/work             → { config, columns, lastFetch, stale, items[] }
 *   GET  /api/work/columns     → { Inbox: [...], Queued: [...], ... }
 *   GET  /api/work/status      → module health
 *   POST /api/work/refresh     → forces an immediate refresh
 *
 * Failure modes:
 *   - WORK.REPO unset → returns a friendly setup-template payload, never errors.
 *   - gh CLI offline / unauthenticated → returns the last cached snapshot with
 *     a `stale: true` flag. The Pulse UI surfaces this as a banner.
 *
 * Polling cadence is configurable via WORK.POLL_INTERVAL_SECONDS (default 60).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { loadWorkConfig, type WorkConfig } from "../../../hooks/lib/work-config";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const PULSE_STATE_DIR = join(LIFEOS_DIR, "PULSE", "state");
const CACHE_PATH = join(PULSE_STATE_DIR, "work-cache.json");
const MODULE = "work";

interface IssueRecord {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | string;
  labels: string[];
  assignees: string[];
  updatedAt: string;
  createdAt: string;
  body?: string;
  ageHours: number;
  column: string;
  slug?: string;
  source: "pai-sync" | "auto-native" | "auto-sweep" | "reminder" | "bookmark" | "manual";
  // v6.6.0 — literal user ask, parsed from MEMORY/WORK/{slug}/ISA.md frontmatter
  // when slug resolves to a local ISA. Absent when no slug, no local ISA, or
  // ISA carries no principal_stated_goal field.
  principal_stated_goal?: string;
}

interface CacheShape {
  fetchedAt: string;
  repo: string;
  issues: IssueRecord[];
}

interface ModuleState {
  running: boolean;
  startedAt: Date | null;
  lastFetch: Date | null;
  pollHandle: ReturnType<typeof setInterval> | null;
  config: WorkConfig | null;
}

const state: ModuleState = {
  running: false,
  startedAt: null,
  lastFetch: null,
  pollHandle: null,
  config: null,
};

// ── Column derivation ───────────────────────────────────────────────────────

// Legacy label aliases — handle GitHub issues that still carry the pre-slim
// status labels so we don't have to relabel every existing issue when the
// column set changes. Match keys are lowercased.
// Updated 2026-05-25 to cover every observed bare label in the live repo.
const LEGACY_STATUS_ALIASES: Record<string, string> = {
  // Closed-state aliases → Complete
  "done": "Complete",
  // Open-state aliases → real columns
  "inbox": "Queued",
  "ready": "Queued",
  "triaged": "Queued",
  "queued": "Queued",
  "needs-triage": "Queued",
  "in-progress": "In-Progress",
  "ai-working": "In-Progress",
  "blocked": "Blocked",
  "needs-human": "In-Review",
  "in-review": "In-Review",
  "complete": "Complete",
};

// Source detection — derives where the issue came from based on labels.
// Used by the kanban card badge.
function issueSource(labels: string[]): "pai-sync" | "auto-native" | "auto-sweep" | "reminder" | "bookmark" | "manual" {
  const lc = new Set(labels.map((l) => l.toLowerCase()));
  if (lc.has("source:twitter-bookmark")) return "bookmark";
  if (lc.has("auto-native")) return "auto-native";
  if (lc.has("auto-sweep")) return "auto-sweep";
  if (lc.has("type:reminder") || lc.has("reminder")) return "reminder";
  if (lc.has("pai-sync")) return "pai-sync";
  return "manual";
}

function deriveColumn(issue: { labels: string[]; state: string }, columns: string[]): string {
  if (issue.state === "CLOSED") {
    return columns.includes("Complete")
      ? "Complete"
      : columns.includes("Done")
        ? "Done"
        : columns[columns.length - 1];
  }
  for (const label of issue.labels) {
    if (label.startsWith("Status:")) {
      const raw = label.slice("Status:".length).trim().toLowerCase();
      const aliased = LEGACY_STATUS_ALIASES[raw];
      const target = aliased ?? raw;
      const hit = columns.find((c) => c.toLowerCase() === target.toLowerCase());
      if (hit) return hit;
    }
  }
  // Default for open issues without a Status:* label.
  return columns.includes("Queued")
    ? "Queued"
    : columns.includes("Inbox")
      ? "Inbox"
      : columns[0];
}

function extractSlug(title: string): string | undefined {
  const m = title.match(/\[slug:([^\]]+)\]/);
  return m ? m[1] : undefined;
}

// v6.6.0 — read principal_stated_goal from a local ISA's YAML frontmatter.
// Returns undefined when slug is undefined, ISA file doesn't exist, or the
// frontmatter has no principal_stated_goal field. Sync-readFileSync is fine
// because fetchIssues runs on the polling interval (default 60s) against ≤200
// issues; the workload is bounded and the files are small.
function extractPrincipalGoal(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  const isaPath = join(HOME, ".claude", "LIFEOS", "MEMORY", "WORK", slug, "ISA.md");
  if (!existsSync(isaPath)) return undefined;
  try {
    const content = readFileSync(isaPath, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return undefined;
    const goalLine = fmMatch[1].match(/^principal_stated_goal:\s*"((?:[^"\\]|\\.)*)"/m);
    return goalLine && goalLine[1] ? goalLine[1] : undefined;
  } catch {
    return undefined;
  }
}

// ── Fetch ───────────────────────────────────────────────────────────────────

async function fetchIssues(repo: string): Promise<IssueRecord[] | null> {
  const proc = Bun.spawn(
    [
      "gh", "issue", "list",
      "--repo", repo,
      "--state", "all",
      "--limit", "500",
      "--json", "number,title,url,state,labels,assignees,updatedAt,createdAt,body",
    ],
    { stdout: "pipe", stderr: "pipe", timeout: 12000 },
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`[${MODULE}] gh issue list failed (exit ${exitCode})`);
    return null;
  }

  let raw: any[];
  try {
    raw = JSON.parse(stdout);
  } catch (err) {
    console.error(`[${MODULE}] could not parse gh JSON: ${err}`);
    return null;
  }

  const now = Date.now();
  const cfg = state.config!;
  return raw.map((i) => {
    const labels: string[] = (i.labels || []).map((l: any) => (typeof l === "string" ? l : l.name));
    const assignees: string[] = (i.assignees || []).map((a: any) => (typeof a === "string" ? a : a.login));
    const updatedAt = i.updatedAt || i.createdAt || new Date(now).toISOString();
    const ageHours = Math.max(0, Math.round((now - Date.parse(updatedAt)) / 3_600_000));
    const slug = extractSlug(i.title);
    return {
      number: i.number,
      title: i.title,
      url: i.url,
      state: i.state,
      labels,
      assignees,
      updatedAt,
      createdAt: i.createdAt,
      body: typeof i.body === "string" ? i.body.slice(0, 800) : undefined,
      ageHours,
      column: deriveColumn({ labels, state: i.state }, cfg.kanbanColumns),
      slug,
      source: issueSource(labels),
      principal_stated_goal: extractPrincipalGoal(slug),
    };
  });
}

// ── Cache ───────────────────────────────────────────────────────────────────

function loadCache(): CacheShape | null {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as CacheShape;
  } catch {
    return null;
  }
}

function writeCache(cache: CacheShape): void {
  if (!existsSync(PULSE_STATE_DIR)) mkdirSync(PULSE_STATE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// ── Refresh cycle ───────────────────────────────────────────────────────────

async function refresh(): Promise<{ ok: boolean; reason?: string }> {
  if (!state.config?.enabled || !state.config.repo) return { ok: false, reason: "WORK.REPO unset" };
  const issues = await fetchIssues(state.config.repo);
  if (!issues) return { ok: false, reason: "gh fetch failed" };
  state.lastFetch = new Date();
  writeCache({
    fetchedAt: state.lastFetch.toISOString(),
    repo: state.config.repo,
    issues,
  });
  return { ok: true };
}

// ── Module lifecycle ────────────────────────────────────────────────────────

export async function start(): Promise<void> {
  console.log(`[${MODULE}] Starting...`);
  state.running = true;
  state.startedAt = new Date();
  state.config = loadWorkConfig();

  if (!state.config.enabled) {
    console.log(`[${MODULE}] WORK.REPO unset — module idle (template view will render)`);
    return;
  }

  // Initial fetch — best-effort, don't crash startup if gh is offline.
  try {
    const r = await refresh();
    if (!r.ok) console.warn(`[${MODULE}] initial refresh failed: ${r.reason}`);
  } catch (err) {
    console.error(`[${MODULE}] initial refresh threw: ${err}`);
  }

  const intervalMs = (state.config.pollIntervalSeconds || 60) * 1000;
  state.pollHandle = setInterval(() => {
    refresh().catch((err) => console.error(`[${MODULE}] poll error: ${err}`));
  }, intervalMs);
  console.log(`[${MODULE}] Polling ${state.config.repo} every ${intervalMs / 1000}s`);
}

export async function stop(): Promise<void> {
  console.log(`[${MODULE}] Stopping...`);
  state.running = false;
  if (state.pollHandle) {
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
}

export function health(): { status: string; details?: Record<string, unknown> } {
  const cfg = state.config;
  return {
    status: state.running ? "healthy" : "stopped",
    details: {
      enabled: cfg?.enabled ?? false,
      repo: cfg?.repo ?? null,
      uptime_seconds: state.startedAt
        ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
        : 0,
      last_fetch: state.lastFetch?.toISOString() ?? null,
      poll_interval_seconds: cfg?.pollIntervalSeconds ?? null,
      cache_path: CACHE_PATH,
    },
  };
}

// ── HTTP surface ────────────────────────────────────────────────────────────

function setupTemplate(reason: string): Response {
  const cfg = state.config;
  const subtype = cfg?.reasonCode ?? "missing";
  const body = {
    setup_required: true,
    reason,
    subtype,
    instructions: [
      "Configure the work repo via the privacy-attested CLI: `bun ~/.claude/skills/_ULWORK/Tools/SetWorkRepo.ts <owner/repo>`. The CLI calls `gh repo view --json visibility,isPrivate` and refuses to write the config unless the repo is currently private.",
      "Ensure the repo has these labels: Type:feature, Type:reminder, Type:research, Type:queue, Status:queued, Status:in-progress, Status:in-review, Status:blocked, Status:done, Priority:P0..P3, Property:internal, Agent:kai, pai-sync.",
      "Restart Pulse so this module re-reads work_repo.json: `bun ~/.claude/LIFEOS/PULSE/manage.sh restart`.",
      "Run an Algorithm session — ULWorkSync.hook.ts will open the first issue at SessionEnd.",
    ],
    docs: "skills/_ULWORK/SKILL.md (search 'Capture flow')",
  };
  return Response.json(body);
}

function buildResponseFromCache(): Response {
  const cfg = state.config;
  if (!cfg?.enabled) return setupTemplate(cfg?.reason || "WORK.REPO unset");

  const cache = loadCache();
  if (!cache) {
    return Response.json({
      config: { repo: cfg.repo, columns: cfg.kanbanColumns },
      columns: Object.fromEntries(cfg.kanbanColumns.map((c) => [c, []])),
      items: [],
      lastFetch: null,
      stale: true,
      stale_reason: "no cache yet — first poll pending",
    });
  }

  const cacheAgeMs = Date.now() - statSync(CACHE_PATH).mtimeMs;
  const stale = cacheAgeMs > (cfg.pollIntervalSeconds * 2_500); // ~2.5x the poll interval

  const grouped: Record<string, IssueRecord[]> = Object.fromEntries(cfg.kanbanColumns.map((c) => [c, []]));
  for (const issue of cache.issues) {
    const col = grouped[issue.column] ? issue.column : cfg.kanbanColumns[0];
    grouped[col].push(issue);
  }
  for (const col of Object.values(grouped)) {
    col.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  return Response.json({
    config: { repo: cfg.repo, columns: cfg.kanbanColumns, poll_interval_seconds: cfg.pollIntervalSeconds },
    columns: grouped,
    items: cache.issues,
    lastFetch: cache.fetchedAt,
    stale,
    stale_reason: stale ? "gh fetch stale (offline or rate-limited?)" : undefined,
  });
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/api/work")) return null;
  const sub = pathname.replace(/^\/api\/work/, "") || "/";

  if (sub === "/status") return Response.json(health());

  if (req.method === "POST" && sub === "/refresh") {
    const r = await refresh();
    return Response.json({ ok: r.ok, reason: r.reason ?? null, lastFetch: state.lastFetch?.toISOString() ?? null });
  }

  if (req.method === "GET" && (sub === "/" || sub === "")) {
    return buildResponseFromCache();
  }

  if (req.method === "GET" && sub === "/columns") {
    const resp = buildResponseFromCache();
    const json = await resp.json() as any;
    return Response.json(json.columns ?? {});
  }

  if (req.method === "GET" && (sub === "/ui" || sub === "/view")) {
    return new Response(renderKanbanHTML(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

// ── HTML view ───────────────────────────────────────────────────────────────

function renderKanbanHTML(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>LifeOS · Work</title>
<style>
  :root {
    --bg: #0b0d12;
    --panel: #12151c;
    --panel-2: #181c25;
    --panel-3: #1f242f;
    --line: #262b36;
    --line-2: #323845;
    --text: #e6e9f0;
    --text-2: #b4bac6;
    --muted: #6b7280;
    --muted-2: #4b5563;
    --accent: #3b82f6;
    --accent-2: #60a5fa;
    --done: #22c55e;
    --blocked: #ef4444;
    --inprogress: #f59e0b;
    --review: #a855f7;
    --queued: #6b7280;
    --p0: #ef4444;
    --p1: #f59e0b;
    --p2: #eab308;
    --p3: #6b7280;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font: 13px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  a { color: inherit; text-decoration: none; }

  /* ── Top bar ──────────────────────────────────────────────────────── */
  header.topbar {
    position: sticky; top: 0; z-index: 20;
    background: rgba(11, 13, 18, 0.92);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .topbar-row1 {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--line);
  }
  .brand {
    display: flex; align-items: baseline; gap: 10px;
    font-weight: 600; letter-spacing: 0.02em; font-size: 14px;
  }
  .brand .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: inline-block; }
  .repo {
    color: var(--text-2);
    font-family: "SF Mono", ui-monospace, monospace; font-size: 12px;
    padding: 3px 8px; border-radius: 4px; background: var(--panel);
    border: 1px solid var(--line);
  }
  .grow { flex: 1; }
  .meta { color: var(--muted); font-size: 11px; font-family: "SF Mono", ui-monospace, monospace; }
  .meta .live-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--done); margin-right: 6px; vertical-align: middle; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .btn {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--line);
    padding: 5px 11px; border-radius: 5px; font: inherit; font-size: 12px;
    cursor: pointer; transition: all 120ms;
  }
  .btn:hover { background: var(--panel-3); border-color: var(--line-2); }
  .btn:active { transform: translateY(1px); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
  .btn.primary:hover { background: var(--accent-2); border-color: var(--accent-2); }

  /* ── Filter row ───────────────────────────────────────────────────── */
  .topbar-row2 {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 20px;
    overflow-x: auto;
    flex-wrap: wrap;
  }
  .filter-group { display: flex; align-items: center; gap: 6px; }
  .filter-label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  select.filter {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--line);
    padding: 4px 8px; border-radius: 4px; font: inherit; font-size: 12px;
    cursor: pointer;
  }
  select.filter:hover { border-color: var(--line-2); }
  .search-input {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--line);
    padding: 5px 10px; border-radius: 4px; font: inherit; font-size: 12px;
    min-width: 180px; flex: 1; max-width: 320px;
  }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .filter-counter { color: var(--muted); font-size: 11px; font-family: "SF Mono", ui-monospace, monospace; }

  /* ── Stale banner ────────────────────────────────────────────────── */
  .stale-banner {
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.12), transparent);
    color: var(--inprogress); padding: 8px 20px; font-size: 12px;
    border-bottom: 1px solid var(--line);
  }

  /* ── Main layout ─────────────────────────────────────────────────── */
  main {
    max-width: 1400px; margin: 0 auto;
    padding: 20px;
  }
  .section {
    margin-bottom: 24px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .section-head {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    user-select: none;
    background: linear-gradient(180deg, var(--panel-2), var(--panel));
  }
  .section-head:hover { background: var(--panel-2); }
  .section-head .chevron { color: var(--muted); transition: transform 150ms; font-size: 10px; }
  .section.collapsed .chevron { transform: rotate(-90deg); }
  .section.collapsed .section-body { display: none; }
  .section-head .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .status-queued .status-dot { background: var(--queued); }
  .status-blocked .status-dot { background: var(--blocked); }
  .status-in-progress .status-dot { background: var(--inprogress); }
  .status-in-review .status-dot { background: var(--review); }
  .status-complete .status-dot { background: var(--done); }
  .section-name { font-weight: 600; font-size: 13px; letter-spacing: 0.02em; }
  .section-count {
    color: var(--muted); font-size: 12px; font-family: "SF Mono", ui-monospace, monospace;
    padding: 2px 8px; background: var(--panel-3); border-radius: 10px; border: 1px solid var(--line);
  }
  .section-body { padding: 0; }
  .section-body.empty { padding: 18px 16px; color: var(--muted); font-style: italic; font-size: 12px; }

  /* ── Cards (compact row layout) ──────────────────────────────────── */
  .card {
    display: grid;
    grid-template-columns: minmax(48px, auto) 1fr auto auto auto;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    border-bottom: 1px solid var(--line);
    transition: background 120ms;
    cursor: pointer;
  }
  .card:last-child { border-bottom: none; }
  .card:hover { background: var(--panel-2); }
  .card .num {
    font-family: "SF Mono", ui-monospace, monospace; font-size: 11px;
    color: var(--muted); white-space: nowrap;
  }
  .card .title {
    color: var(--text); font-size: 13px; line-height: 1.35;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
  }
  .card:hover .title { color: var(--accent-2); }
  .card .pills { display: flex; gap: 4px; flex-shrink: 0; }
  .pill {
    font-size: 10px; padding: 2px 7px; border-radius: 10px;
    font-family: "SF Mono", ui-monospace, monospace;
    text-transform: lowercase; letter-spacing: 0.02em;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .pill-prop { background: rgba(59, 130, 246, 0.12); color: #93c5fd; border-color: rgba(59, 130, 246, 0.25); }
  .pill-p0 { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); }
  .pill-p1 { background: rgba(245, 158, 11, 0.15); color: #fcd34d; border-color: rgba(245, 158, 11, 0.3); }
  .pill-p2 { background: rgba(234, 179, 8, 0.10); color: #fde047; border-color: rgba(234, 179, 8, 0.25); }
  .pill-p3 { background: rgba(107, 114, 128, 0.15); color: #9ca3af; border-color: rgba(107, 114, 128, 0.25); }
  .source-badge {
    font-size: 9px; padding: 2px 6px; border-radius: 3px;
    font-family: "SF Mono", ui-monospace, monospace;
    text-transform: uppercase; letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .src-pai-sync { background: rgba(123, 97, 255, 0.15); color: #b09cff; }
  .src-auto-native { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
  .src-auto-sweep { background: rgba(251, 202, 4, 0.12); color: #fde68a; }
  .src-reminder { background: rgba(228, 230, 105, 0.15); color: #ffeb84; }
  .src-bookmark { background: rgba(29, 161, 242, 0.15); color: #7bc8fb; }
  .src-manual { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }
  .card .age {
    color: var(--muted); font-size: 11px;
    font-family: "SF Mono", ui-monospace, monospace;
    white-space: nowrap; text-align: right; min-width: 36px;
  }
  .card .age.overdue { color: var(--blocked); font-weight: 600; }
  .card.stale { opacity: 0.55; }
  .principal-goal {
    grid-column: 2 / -1;
    font-size: 11px; color: var(--accent-2); font-style: italic;
    margin-top: 2px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .principal-goal::before { content: '🎯 '; font-style: normal; }

  /* ── Setup view ──────────────────────────────────────────────────── */
  .setup { padding: 32px 24px; max-width: 720px; margin: 0 auto; }
  .setup h2 { color: var(--accent-2); margin-top: 0; }
  .setup pre { background: var(--panel); border: 1px solid var(--line); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  .setup ol { line-height: 1.7; }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 720px) {
    .card { grid-template-columns: auto 1fr auto; gap: 8px; padding: 8px 12px; }
    .card .pills { display: none; }
    .card .source-badge { display: none; }
    .topbar-row1 { padding: 10px 14px; }
    .topbar-row2 { padding: 8px 14px; gap: 8px; }
    main { padding: 12px; }
  }
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-row1">
    <span class="brand"><span class="dot"></span>LifeOS · Work</span>
    <span id="repo" class="repo"></span>
    <span class="grow"></span>
    <span id="meta" class="meta"></span>
    <button id="refresh" class="btn primary">Refresh</button>
  </div>
  <div class="topbar-row2">
    <input id="search" type="text" class="search-input" placeholder="Search title or number…" />
    <div class="filter-group">
      <span class="filter-label">Property</span>
      <select id="filter-property" class="filter"><option value="">all</option></select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Priority</span>
      <select id="filter-priority" class="filter"><option value="">all</option></select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Source</span>
      <select id="filter-source" class="filter"><option value="">all</option></select>
    </div>
    <div class="filter-group">
      <span class="filter-label">State</span>
      <select id="filter-state" class="filter">
        <option value="open">open</option>
        <option value="all">all</option>
        <option value="closed">closed</option>
      </select>
    </div>
    <span class="grow"></span>
    <span id="counter" class="filter-counter"></span>
  </div>
</header>

<div id="stale" class="stale-banner" style="display:none"></div>
<main id="root"></main>

<script>
const root = document.getElementById('root');
const repoEl = document.getElementById('repo');
const metaEl = document.getElementById('meta');
const staleEl = document.getElementById('stale');
const refreshBtn = document.getElementById('refresh');
const searchEl = document.getElementById('search');
const fProp = document.getElementById('filter-property');
const fPrio = document.getElementById('filter-priority');
const fSrc = document.getElementById('filter-source');
const fState = document.getElementById('filter-state');
const counterEl = document.getElementById('counter');

const STATUS_ORDER = ['In-Progress', 'In-Review', 'Blocked', 'Queued', 'Complete'];
const STATUS_CLASS = { 'In-Progress':'status-in-progress', 'In-Review':'status-in-review', 'Blocked':'status-blocked', 'Queued':'status-queued', 'Complete':'status-complete' };

let lastData = null;
const collapsed = JSON.parse(localStorage.getItem('pai-work-collapsed') || '{}');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function ageStr(h) {
  if (h < 1) return 'now';
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  if (d < 30) return d + 'd';
  const mo = Math.floor(d / 30);
  return mo + 'mo';
}
function cleanTitle(t) {
  return String(t)
    .replace(/\\s*\\[slug:[^\\]]+\\]\\s*$/,'')
    .replace(/\\s*\\[goal:[^\\]]+\\]\\s*$/,'')
    .trim();
}
function extractPropValue(labels) {
  for (const l of labels) {
    const m = String(l).match(/^Property:(.+)$/i);
    if (m) return m[1].toLowerCase();
  }
  for (const l of labels) {
    const lc = String(l).toLowerCase();
    if (['newsletter','website','youtube','podcast','community','consulting','open-source','internal','pai','life'].includes(lc)) return lc;
  }
  return null;
}
function extractPrioValue(labels) {
  for (const l of labels) {
    const m = String(l).match(/^Priority:(P\\d)$/i);
    if (m) return m[1].toUpperCase();
  }
  for (const l of labels) {
    const m = String(l).match(/^(P\\d)-/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}
function populateFilters(items) {
  const props = new Set(), prios = new Set(), srcs = new Set();
  for (const it of items) {
    const p = extractPropValue(it.labels || []); if (p) props.add(p);
    const pr = extractPrioValue(it.labels || []); if (pr) prios.add(pr);
    if (it.source) srcs.add(it.source);
  }
  fillSelect(fProp, [...props].sort());
  fillSelect(fPrio, [...prios].sort());
  fillSelect(fSrc, [...srcs].sort());
}
function fillSelect(sel, values) {
  const prev = sel.value;
  sel.innerHTML = '<option value="">all</option>' + values.map(v => '<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function applyFilters(items) {
  const q = searchEl.value.trim().toLowerCase();
  const wantProp = fProp.value;
  const wantPrio = fPrio.value;
  const wantSrc = fSrc.value;
  const wantState = fState.value;
  return items.filter(it => {
    if (wantState === 'open' && it.state !== 'OPEN') return false;
    if (wantState === 'closed' && it.state !== 'CLOSED') return false;
    if (wantProp && extractPropValue(it.labels || []) !== wantProp) return false;
    if (wantPrio && extractPrioValue(it.labels || []) !== wantPrio) return false;
    if (wantSrc && it.source !== wantSrc) return false;
    if (q) {
      const hay = (String(it.number) + ' ' + cleanTitle(it.title)).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function groupByStatus(items) {
  const groups = {};
  for (const it of items) {
    const col = it.column || 'Queued';
    if (!groups[col]) groups[col] = [];
    groups[col].push(it);
  }
  return groups;
}

function renderCard(it) {
  const labels = it.labels || [];
  const prop = extractPropValue(labels);
  const prio = extractPrioValue(labels);
  const isStale = labels.some(l => String(l).toLowerCase() === 'stale');
  const ageClass = isStale ? 'overdue' : '';
  const propPill = prop ? '<span class="pill pill-prop">' + escapeHtml(prop) + '</span>' : '';
  const prioPill = prio ? '<span class="pill pill-'+prio.toLowerCase()+'">'+escapeHtml(prio)+'</span>' : '';
  const sourceBadge = '<span class="source-badge src-' + escapeHtml(it.source || 'manual') + '" title="capture source: '+escapeHtml(it.source || 'manual')+'">' + escapeHtml(it.source || 'manual') + '</span>';
  const goalHtml = it.principal_stated_goal
    ? '<div class="principal-goal" title="principal_stated_goal">' + escapeHtml(it.principal_stated_goal) + '</div>'
    : '';
  return '<div class="card ' + (isStale?'stale':'') + '" onclick="window.open(\\''+escapeHtml(it.url)+'\\',\\'_blank\\')" title="' + escapeHtml(cleanTitle(it.title)) + '">' +
    '<span class="num">#' + it.number + '</span>' +
    '<span class="title">' + escapeHtml(cleanTitle(it.title)) + '</span>' +
    '<span class="pills">' + propPill + prioPill + '</span>' +
    sourceBadge +
    '<span class="age ' + ageClass + '">' + ageStr(it.ageHours) + '</span>' +
    goalHtml +
  '</div>';
}

function renderBoard(data) {
  if (data.setup_required) {
    root.innerHTML = '<div class="setup">' +
      '<h2>Setup required</h2>' +
      '<p>' + escapeHtml(data.reason || 'WORK.REPO is unset.') + '</p>' +
      '<ol>' + (data.instructions || []).map(s => '<li>' + escapeHtml(s) + '</li>').join('') + '</ol>' +
      '</div>';
    repoEl.textContent = '(no repo configured)';
    metaEl.textContent = '';
    counterEl.textContent = '';
    return;
  }

  lastData = data;
  repoEl.textContent = data.config.repo;
  const total = data.items?.length || 0;
  metaEl.innerHTML = data.lastFetch
    ? '<span class="live-dot"></span>last fetch ' + new Date(data.lastFetch).toLocaleTimeString() + '  ·  ' + total + ' issues  ·  poll ' + data.config.poll_interval_seconds + 's'
    : 'no fetch yet';

  if (data.stale) {
    staleEl.style.display = 'block';
    staleEl.textContent = '⚠ Stale data — ' + (data.stale_reason || 'gh fetch failed; showing cached snapshot');
  } else {
    staleEl.style.display = 'none';
  }

  populateFilters(data.items || []);
  rerender();
}

function rerender() {
  if (!lastData) return;
  const filtered = applyFilters(lastData.items || []);
  counterEl.textContent = filtered.length + ' of ' + (lastData.items || []).length + ' shown';
  const groups = groupByStatus(filtered);

  let html = '';
  for (const col of STATUS_ORDER) {
    const items = groups[col] || [];
    const isCollapsed = collapsed[col] === true || (col === 'Complete' && collapsed[col] !== false);
    const klass = 'section ' + (STATUS_CLASS[col] || '') + (isCollapsed ? ' collapsed' : '');
    items.sort((a, b) => {
      // Priority desc (P0 first), then age desc (newest first)
      const pa = (extractPrioValue(a.labels || []) || 'Z');
      const pb = (extractPrioValue(b.labels || []) || 'Z');
      if (pa !== pb) return pa.localeCompare(pb);
      return (a.ageHours || 0) - (b.ageHours || 0);
    });
    html += '<section class="' + klass + '" data-col="' + escapeHtml(col) + '">' +
      '<div class="section-head" onclick="toggleSection(\\''+escapeHtml(col)+'\\')">' +
        '<span class="chevron">▼</span>' +
        '<span class="status-dot"></span>' +
        '<span class="section-name">' + escapeHtml(col) + '</span>' +
        '<span class="section-count">' + items.length + '</span>' +
      '</div>' +
      (items.length === 0
        ? '<div class="section-body empty">none</div>'
        : '<div class="section-body">' + items.map(renderCard).join('') + '</div>') +
    '</section>';
  }
  root.innerHTML = html;
}

window.toggleSection = function(col) {
  collapsed[col] = !collapsed[col];
  localStorage.setItem('pai-work-collapsed', JSON.stringify(collapsed));
  rerender();
};

async function load() {
  try {
    const r = await fetch('/api/work', { cache: 'no-store' });
    const d = await r.json();
    renderBoard(d);
  } catch (err) {
    root.innerHTML = '<div class="setup"><h2>Error</h2><pre>' + escapeHtml(String(err)) + '</pre></div>';
  }
}

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Refreshing…';
  try {
    await fetch('/api/work/refresh', { method: 'POST' });
    await load();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
});

let searchTimer;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(rerender, 120);
});
fProp.addEventListener('change', rerender);
fPrio.addEventListener('change', rerender);
fSrc.addEventListener('change', rerender);
fState.addEventListener('change', rerender);

load();
setInterval(load, 60_000);
</script>
</body>
</html>`;
}

// ── CLI smoke ───────────────────────────────────────────────────────────────

if (import.meta.main) {
  state.config = loadWorkConfig();
  console.log("config:", state.config);
  if (state.config.enabled) {
    refresh().then((r) => {
      console.log("refresh:", r);
      const cache = loadCache();
      if (cache) {
        const summary = cache.issues.reduce((acc, i) => {
          acc[i.column] = (acc[i.column] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log("issues by column:", summary);
        console.log("total issues:", cache.issues.length);
      }
    });
  }
}
