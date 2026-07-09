#!/usr/bin/env bun
/**
 * BookmarkSweep.ts — Periodic sweep that turns X bookmarks into UL ideas.
 *
 * Triggered by ~/Library/LaunchAgents/com.lifeos.bookmarksweep.plist every 30 minutes.
 * Also runnable on-demand:
 *
 *   bun ~/.claude/LIFEOS/TOOLS/BookmarkSweep.ts                 # apply
 *   bun ~/.claude/LIFEOS/TOOLS/BookmarkSweep.ts --dry-run       # classify only
 *   bun ~/.claude/LIFEOS/TOOLS/BookmarkSweep.ts --max-create 3  # cap issues
 *
 * What it does:
 *   1. Fetches recent X/Twitter bookmarks
 *   2. Filters to IDs not yet seen in bookmarks-state.json
 *   3. Classifies new bookmarks with one Inference.ts call
 *   4. Creates or skips bookmark idea-issues, capped by --max-create
 *   5. Audits dispositions, persists seen-state, and logs one JSON line
 *
 * Always exits 0. Fetch, inference, and issue failures log but never propagate.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, renameSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


declare const Bun: { spawn: (cmd: string[], opts?: any) => any };

const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const X_DIR = join(HOME, ".claude", "skills", "_X");
const BOOKMARKS_TOOL = join(X_DIR, "Tools", "bookmarks.ts");
const BOOKMARK_ISSUE_TOOL = join(X_DIR, "Tools", "bookmark-issue.ts");
const INFERENCE_TOOL = join(LIFEOS_DIR, "TOOLS", "Inference.ts");
const STATE_DIR = join(X_DIR, "State");
const STATE_FILE = join(STATE_DIR, "bookmarks-state.json");
const OBS_DIR = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
const OBS_LOG = join(OBS_DIR, "bookmarksweep.jsonl");
const DEFAULT_MAX_CREATE = 12;
const VALID_PROPERTIES = new Set(["newsletter", "website", "youtube", "podcast", "community", "consulting", "open-source", "internal"]);

interface Bookmark {
  id: string;
  text: string;
  author: string;
  author_name?: string;
  created_at?: string;
  url?: string;
  metrics?: unknown;
  urls?: string[];
}

interface Decision {
  id: string;
  decision: "create" | "skip";
  title?: string;
  body?: string;
  property?: string;
  reason?: string;
}

interface BookmarkState {
  seenIds: string[];
  lastPull: string | null;
  pullCount: number;
}

interface SpawnResult {
  exit: number;
  stdout: string;
  stderr: string;
}

interface SweepLogLine {
  ts: string;
  fetched: number;
  new: number;
  created: number;
  skipped: number;
  auditExit: number | null;
  issueUrls: string[];
  error?: string;
  errors?: string[];
}

function emptyState(): BookmarkState {
  return { seenIds: [], lastPull: null, pullCount: 0 };
}

function parseArgs(args: string[]): { dryRun: boolean; maxCreate: number } {
  const dryRun = args.includes("--dry-run");
  const maxCreateIdx = args.indexOf("--max-create");
  const requested = maxCreateIdx >= 0 ? parseInt(args[maxCreateIdx + 1] ?? "", 10) : DEFAULT_MAX_CREATE;
  const maxCreate = Number.isFinite(requested) && requested >= 0 ? requested : DEFAULT_MAX_CREATE;
  return { dryRun, maxCreate };
}

async function run(cmd: string[], timeout = 30000): Promise<SpawnResult> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", timeout });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exit = await proc.exited;
    return { exit, stdout, stderr };
  } catch (err) {
    return { exit: 127, stdout: "", stderr: String(err) };
  }
}

function parseJsonArray<T>(raw: string): T[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function normalizeBookmark(value: unknown): Bookmark | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.text !== "string" || typeof item.author !== "string") return null;
  return {
    id: item.id,
    text: item.text,
    author: item.author,
    author_name: typeof item.author_name === "string" ? item.author_name : undefined,
    created_at: typeof item.created_at === "string" ? item.created_at : undefined,
    url: typeof item.url === "string" ? item.url : undefined,
    metrics: item.metrics,
    urls: Array.isArray(item.urls) ? item.urls.filter((u): u is string => typeof u === "string") : undefined,
  };
}

async function fetchBookmarks(): Promise<{ bookmarks: Bookmark[]; error?: string }> {
  const result = await run(["bun", BOOKMARKS_TOOL, "fetch", "50", "--json"], 45000);
  if (result.exit !== 0) return { bookmarks: [], error: `fetch exited ${result.exit}` };
  const parsed = parseJsonArray<unknown>(result.stdout);
  if (!parsed) return { bookmarks: [], error: "fetch output was not a JSON array" };
  const bookmarks = parsed.map(normalizeBookmark).filter((b): b is Bookmark => b !== null);
  if (bookmarks.length === 0) return { bookmarks: [], error: "fetch returned no bookmarks" };
  return { bookmarks };
}

function loadState(): BookmarkState {
  if (!existsSync(STATE_FILE)) return emptyState();
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as Partial<BookmarkState>;
    return {
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds.filter((id): id is string => typeof id === "string") : [],
      lastPull: typeof parsed.lastPull === "string" ? parsed.lastPull : null,
      pullCount: typeof parsed.pullCount === "number" && Number.isFinite(parsed.pullCount) ? parsed.pullCount : 0,
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: BookmarkState, newIds: string[], ts: string): void {
  const seen = new Set(state.seenIds);
  for (const id of newIds) seen.add(id);
  const next: BookmarkState = {
    seenIds: Array.from(seen),
    lastPull: ts,
    pullCount: state.pullCount + 1,
  };
  mkdirSync(STATE_DIR, { recursive: true });
  // Atomic write: a launchd job killed mid-write must never truncate the seen-state
  // (a truncated state reads as "everything is new" → re-classify churn). temp + rename.
  const tmp = STATE_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", "utf-8");
  renameSync(tmp, STATE_FILE);
}

function writeLogLine(line: SweepLogLine): void {
  if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
  appendFileSync(OBS_LOG, JSON.stringify(line) + "\n");
}

function makeLogLine(partial: Partial<SweepLogLine>): SweepLogLine {
  return {
    ts: partial.ts ?? new Date().toISOString(),
    fetched: partial.fetched ?? 0,
    new: partial.new ?? 0,
    created: partial.created ?? 0,
    skipped: partial.skipped ?? 0,
    auditExit: partial.auditExit ?? null,
    issueUrls: partial.issueUrls ?? [],
    ...(partial.error ? { error: partial.error } : {}),
    ...(partial.errors && partial.errors.length > 0 ? { errors: partial.errors } : {}),
  };
}

function logAndPrint(line: SweepLogLine, dryRun: boolean, summary: string): void {
  if (!dryRun) writeLogLine(line);
  console.log(summary);
}

function toInferenceInput(bookmarks: Bookmark[]): Array<{ id: string; author: string; text: string }> {
  return bookmarks.map((b) => ({ id: b.id, author: b.author, text: b.text }));
}

function extractFirstJsonArray(raw: string): string | null {
  for (let start = raw.indexOf("["); start >= 0; start = raw.indexOf("[", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
      } else if (ch === "[") {
        depth++;
      } else if (ch === "]") {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeDecision(value: unknown): Decision | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string") return null;
  const decision = item.decision === "create" ? "create" : item.decision === "skip" ? "skip" : null;
  if (!decision) return null;
  return {
    id: item.id,
    decision,
    title: typeof item.title === "string" ? item.title.trim() : undefined,
    body: typeof item.body === "string" ? item.body.trim() : undefined,
    property: typeof item.property === "string" && VALID_PROPERTIES.has(item.property) ? item.property : undefined,
    reason: typeof item.reason === "string" ? item.reason.trim() : undefined,
  };
}

async function classifyBookmarks(bookmarks: Bookmark[]): Promise<{ decisions: Decision[]; error?: string }> {
  const systemPrompt = "You triage Twitter bookmarks into UL work ideas. For each bookmark decide create or skip. CREATE if it implies an actionable UL idea (content, product, LifeOS, or strategy — something to DO); draft a one-line title and a 1-3 sentence body in a plain, direct first-person voice, and optionally a property from {newsletter,website,youtube,podcast,community,consulting,open-source,internal}. SKIP pure-interest/news/quotes/humor/personal. When uncertain, CREATE (a skipped idea is lost forever). Return ONLY a JSON array, one object per input id: {id, decision:'create'|'skip', title?, body?, property?, reason?}.";
  const userPrompt = JSON.stringify(toInferenceInput(bookmarks));
  const result = await run(["bun", INFERENCE_TOOL, "--json", "--level", "medium", systemPrompt, userPrompt], 120000);
  if (result.exit !== 0) return { decisions: [], error: `inference exited ${result.exit}` };
  const arrayText = extractFirstJsonArray(result.stdout);
  if (!arrayText) return { decisions: [], error: "inference reply did not contain a JSON array" };
  const parsed = parseJsonArray<unknown>(arrayText);
  if (!parsed) return { decisions: [], error: "inference JSON array parse failed" };
  const decisions = parsed.map(normalizeDecision).filter((d): d is Decision => d !== null);
  if (decisions.length === 0 && bookmarks.length > 0) return { decisions: [], error: "inference returned no valid decisions" };
  return { decisions };
}

function titleFromBookmark(bookmark: Bookmark): string {
  const text = bookmark.text.replace(/\s+/g, " ").trim();
  return text.length > 78 ? text.slice(0, 77).trimEnd() + "…" : text || `Bookmark ${bookmark.id}`;
}

function bodyFromBookmark(bookmark: Bookmark): string {
  const author = bookmark.author || "unknown";
  const text = bookmark.text.replace(/\s+/g, " ").trim();
  return `I saved this from ${author} because it may point to a UL idea. Source text: ${text}`;
}

function dispositionFor(bookmark: Bookmark, decisionsById: Map<string, Decision>): Decision {
  const decision = decisionsById.get(bookmark.id);
  if (!decision) return { id: bookmark.id, decision: "skip", reason: "missing decision" };
  if (decision.decision === "skip") {
    return { ...decision, reason: decision.reason || "model skip" };
  }
  return {
    ...decision,
    title: decision.title || titleFromBookmark(bookmark),
    body: decision.body || bodyFromBookmark(bookmark),
  };
}

function applyMaxCreateCap(decisions: Decision[], maxCreate: number): Decision[] {
  let creates = 0;
  return decisions.map((decision) => {
    if (decision.decision !== "create") return decision;
    creates++;
    if (creates <= maxCreate) return decision;
    return { id: decision.id, decision: "skip", reason: "max-create cap" };
  });
}

function stripAt(author: string): string {
  return author.replace(/^@/, "");
}

function issueUrlFrom(output: string): string | null {
  const match = output.match(/https:\/\/github\.com\/[^\s]+\/issues\/\d+/);
  return match ? match[0] : null;
}

async function applyDecision(bookmark: Bookmark, decision: Decision): Promise<{ created: boolean; skipped: boolean; issueUrl?: string; error?: string }> {
  if (decision.decision === "create") {
    const args = [
      "bun",
      BOOKMARK_ISSUE_TOOL,
      "create",
      "--id",
      bookmark.id,
      "--title",
      decision.title || titleFromBookmark(bookmark),
      "--body",
      decision.body || bodyFromBookmark(bookmark),
      "--url",
      bookmark.url || "",
      "--author",
      stripAt(bookmark.author),
      "--text",
      bookmark.text,
    ];
    if (decision.property) args.push("--property", decision.property);
    const result = await run(args, 45000);
    const issueUrl = issueUrlFrom(result.stdout);
    if (result.exit !== 0) return { created: false, skipped: false, error: `create ${bookmark.id} exited ${result.exit}` };
    return { created: true, skipped: false, issueUrl: issueUrl ?? undefined };
  }

  const result = await run([
    "bun",
    BOOKMARK_ISSUE_TOOL,
    "skip",
    "--id",
    bookmark.id,
    "--reason",
    decision.reason || "model skip",
  ], 30000);
  if (result.exit !== 0) return { created: false, skipped: false, error: `skip ${bookmark.id} exited ${result.exit}` };
  return { created: false, skipped: true };
}

async function audit(ids: string[]): Promise<number> {
  const result = await run(["bun", BOOKMARK_ISSUE_TOOL, "audit", "--ids", ids.join(",")], 30000);
  return result.exit;
}

function printDryRun(decisions: Decision[]): void {
  console.log(JSON.stringify(decisions, null, 2));
  const creates = decisions.filter((d) => d.decision === "create").length;
  const skips = decisions.length - creates;
  console.log(`[BookmarkSweep] dry-run decisions=${decisions.length} create=${creates} skip=${skips}`);
}

async function main(): Promise<void> {
  const { dryRun, maxCreate } = parseArgs(process.argv.slice(2));
  const fetched = await fetchBookmarks();
  if (fetched.error) {
    logAndPrint(
      makeLogLine({ error: fetched.error }),
      dryRun,
      `[BookmarkSweep] ${dryRun ? "dry-run " : ""}stopped: ${fetched.error}`,
    );
    process.exit(0);
  }

  const state = loadState();
  const seen = new Set(state.seenIds);
  const newBookmarks = fetched.bookmarks.filter((b) => !seen.has(b.id));
  if (newBookmarks.length === 0) {
    logAndPrint(
      makeLogLine({ fetched: fetched.bookmarks.length, new: 0 }),
      dryRun,
      `[BookmarkSweep] fetched=${fetched.bookmarks.length} new=0`,
    );
    process.exit(0);
  }

  const classified = await classifyBookmarks(newBookmarks);
  if (classified.error) {
    logAndPrint(
      makeLogLine({ fetched: fetched.bookmarks.length, new: newBookmarks.length, error: classified.error }),
      dryRun,
      `[BookmarkSweep] fetched=${fetched.bookmarks.length} new=${newBookmarks.length} stopped: ${classified.error}`,
    );
    process.exit(0);
  }

  const decisionsById = new Map(classified.decisions.map((d) => [d.id, d]));
  const normalizedDecisions = newBookmarks.map((bookmark) => dispositionFor(bookmark, decisionsById));

  if (dryRun) {
    printDryRun(normalizedDecisions);
    process.exit(0);
  }

  const decisions = applyMaxCreateCap(normalizedDecisions, maxCreate);
  const issueUrls: string[] = [];
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;
  for (const bookmark of newBookmarks) {
    const decision = decisions.find((d) => d.id === bookmark.id) ?? { id: bookmark.id, decision: "skip", reason: "missing decision" };
    const result = await applyDecision(bookmark, decision);
    if (result.created) created++;
    if (result.skipped) skipped++;
    if (result.issueUrl) issueUrls.push(result.issueUrl);
    if (result.error) errors.push(result.error);
  }

  const auditExit = await audit(newBookmarks.map((b) => b.id));
  const ts = new Date().toISOString();
  writeState(state, newBookmarks.map((b) => b.id), ts);
  const line = makeLogLine({
    ts,
    fetched: fetched.bookmarks.length,
    new: newBookmarks.length,
    created,
    skipped,
    auditExit,
    issueUrls,
    errors,
  });
  writeLogLine(line);
  console.log(`[BookmarkSweep] fetched=${fetched.bookmarks.length} new=${newBookmarks.length} created=${created} skipped=${skipped} auditExit=${auditExit}`);
  process.exit(0);
}

if (import.meta.main) {
  main().catch(() => {
    const isDryRun = process.argv.includes("--dry-run");
    try {
      if (isDryRun) {
        console.error("[BookmarkSweep] Fatal (dry-run, not logged): fatal sweep error");
      } else {
        logAndPrint(makeLogLine({ error: "fatal sweep error" }), false, "[BookmarkSweep] Fatal: fatal sweep error");
      }
    } catch {
      console.error("[BookmarkSweep] Fatal: fatal sweep error");
    }
    process.exit(0);
  });
}
