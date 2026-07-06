#!/usr/bin/env bun
/// <reference types="bun-types" />
declare const Bun: any;
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "../../../LIFEOS/TOOLS/Paths";

const HOME = homedir();
const LIFEOS_DIR = getClaudeDir();
const STATE_DIR = join(LIFEOS_DIR, "LIFEOS", "MEMORY", "STATE");
const WORK_DIR = join(LIFEOS_DIR, "LIFEOS", "MEMORY", "WORK");
// Claude Code names each project dir by its absolute path with "/" and "." mapped to "-",
// e.g. $HOME/.claude -> "-Users-<user>--claude". Derive it from $HOME instead of hardcoding.
const PROJECT_SLUG = LIFEOS_DIR.replace(/[/.]/g, "-");
const JSONL_DIR = join(LIFEOS_DIR, "Projects", PROJECT_SLUG);
const WORK_JSON = join(STATE_DIR, "work.json");
const NAMES_JSON = join(STATE_DIR, "session-names.json");

const STOPWORDS = new Set([
  "the", "a", "an", "on", "in", "of", "to", "that", "it",
  "is", "was", "we", "you", "i", "and", "or", "for", "with",
]);

type Source = "work.json" | "session-names.json" | "work-dir" | "isa-body" | "jsonl";

interface Result {
  source: Source[];
  slug: string;
  sessionUuid?: string;
  name?: string;
  task?: string;
  phase?: string;
  progress?: string;
  effort?: string;
  score: number;
  recencyDays: number | null;
  snippet?: string;
  path?: string;
}

interface Args {
  query: string;
  limit: number;
  since: Date | null;
  pretty: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    query: "",
    limit: 10,
    since: null,
    pretty: false,
    json: false,
    help: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--pretty") args.pretty = true;
    else if (a === "--json") args.json = true;
    else if (a === "--limit") {
      const n = parseInt(argv[++i] ?? "", 10);
      if (!Number.isNaN(n)) args.limit = n;
    } else if (a === "--since") {
      const d = new Date(argv[++i] ?? "");
      if (!Number.isNaN(d.getTime())) args.since = d;
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (!Number.isNaN(n)) args.limit = n;
    } else if (a.startsWith("--since=")) {
      const d = new Date(a.slice("--since=".length));
      if (!Number.isNaN(d.getTime())) args.since = d;
    } else if (!a.startsWith("--")) {
      positional.push(a);
    }
  }
  args.query = positional.join(" ").trim();
  return args;
}

function printHelp() {
  console.log(`ContextSearch — find prior LifeOS work by topic, tokens, or date.

Usage:
  bun run ContextSearch.ts <query> [flags]

Flags:
  --limit N        Max results (default 10, 0 = all)
  --since DATE     Only results updated on/after DATE (YYYY-MM-DD)
  --pretty         Force pretty terminal output (default if TTY)
  --json           Force single-line JSON (default if piped)
  --help, -h       Show this help

Examples:
  bun run ContextSearch.ts "extended markdown"
  bun run ContextSearch.ts pulse effort tag --limit 5
  bun run ContextSearch.ts "yesterday markdown"
  bun run ContextSearch.ts "isa render" --since 2026-05-01 --json`);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function parseDateFilter(query: string): { since: Date | null; until: Date | null; query: string } {
  const q = query.toLowerCase();
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const endOfDay = (d: Date) => {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  };

  const removed = (phrase: string) =>
    query.replace(new RegExp(phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "ig"), " ").replace(/\s+/g, " ").trim();

  if (/\bday before yesterday\b/i.test(q)) {
    const d = day(2);
    return { since: d, until: endOfDay(d), query: removed("day before yesterday") };
  }
  if (/\byesterday\b/i.test(q)) {
    const d = day(1);
    return { since: d, until: endOfDay(d), query: removed("yesterday") };
  }
  if (/\btoday\b/i.test(q)) {
    const d = day(0);
    return { since: d, until: endOfDay(d), query: removed("today") };
  }
  if (/\blast week\b/i.test(q)) return { since: day(7), until: null, query: removed("last week") };
  if (/\bthis week\b/i.test(q)) return { since: day(7), until: null, query: removed("this week") };
  if (/\blast month\b/i.test(q)) return { since: day(30), until: null, query: removed("last month") };

  const nDays = q.match(/\b(\d+)\s+days?\s+ago\b/);
  if (nDays) {
    const d = day(parseInt(nDays[1]!, 10));
    return { since: d, until: endOfDay(d), query: removed(nDays[0]!) };
  }

  const isoDate = q.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    const d = new Date(isoDate[0]!);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      return { since: d, until: endOfDay(d), query: removed(isoDate[0]!) };
    }
  }

  return { since: null, until: null, query };
}

function recencyMultiplier(d: Date | null): { multiplier: number; days: number | null } {
  if (!d) return { multiplier: 1, days: null };
  const days = Math.max(0, (Date.now() - d.getTime()) / 86_400_000);
  return { multiplier: 1 + 1 / (1 + days), days };
}

function tokenOverlap(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set(tokenize(text));
  let hits = 0;
  for (const t of queryTokens) if (haystack.has(t)) hits++;
  return hits;
}

function dateFromSlug(slug: string): Date | null {
  const m = slug.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function passSinceFilter(d: Date | null, since: Date | null, until: Date | null = null): boolean {
  if (!since && !until) return true;
  if (!d) return false;
  if (since && d.getTime() < since.getTime()) return false;
  if (until && d.getTime() > until.getTime()) return false;
  return true;
}

function searchWorkJson(tokens: string[], since: Date | null, until: Date | null = null): Result[] {
  if (!existsSync(WORK_JSON)) return [];
  const data = JSON.parse(readFileSync(WORK_JSON, "utf8"));
  const sessions = data.sessions ?? {};
  const out: Result[] = [];
  for (const [slug, entry] of Object.entries<any>(sessions)) {
    const updated = entry.updatedAt ? new Date(entry.updatedAt) : dateFromSlug(slug);
    if (!passSinceFilter(updated, since, until)) continue;
    const blob = [slug, entry.task, entry.sessionName].filter(Boolean).join(" ");
    const overlap = tokenOverlap(tokens, blob);
    if (overlap === 0 && tokens.length > 0) continue;
    const { multiplier, days } = recencyMultiplier(updated);
    out.push({
      source: ["work.json"],
      slug,
      sessionUuid: entry.sessionUUID,
      task: entry.task,
      name: entry.sessionName,
      phase: entry.phase,
      progress: entry.progress,
      effort: entry.effort,
      score: overlap * multiplier,
      recencyDays: days,
      path: entry.isa ? join(LIFEOS_DIR, entry.isa) : undefined,
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.recencyDays ?? Number.POSITIVE_INFINITY;
    const bd = b.recencyDays ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  return out.slice(0, 50);
}

function searchSessionNames(tokens: string[], since: Date | null, until: Date | null = null): Result[] {
  if (!existsSync(NAMES_JSON)) return [];
  const data = JSON.parse(readFileSync(NAMES_JSON, "utf8"));
  const out: Result[] = [];
  const fileMtime = (() => {
    try {
      return new Date(statSync(NAMES_JSON).mtime);
    } catch {
      return null;
    }
  })();
  for (const [uuid, name] of Object.entries<string>(data)) {
    const overlap = tokenOverlap(tokens, name);
    if (overlap === 0 && tokens.length > 0) continue;
    let dt: Date | null = null;
    const jsonlPath = join(JSONL_DIR, `${uuid}.jsonl`);
    if (existsSync(jsonlPath)) {
      try {
        dt = new Date(statSync(jsonlPath).mtime);
      } catch {}
    }
    if (!dt) dt = fileMtime;
    if (!passSinceFilter(dt, since, until)) continue;
    const { multiplier, days } = recencyMultiplier(dt);
    out.push({
      source: ["session-names.json"],
      slug: uuid,
      sessionUuid: uuid,
      name,
      score: overlap * multiplier,
      recencyDays: days,
      path: existsSync(jsonlPath) ? jsonlPath : undefined,
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.recencyDays ?? Number.POSITIVE_INFINITY;
    const bd = b.recencyDays ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  return out.slice(0, 50);
}

function searchWorkDirs(tokens: string[], since: Date | null, until: Date | null = null): Result[] {
  if (!existsSync(WORK_DIR)) return [];
  const dirs = readdirSync(WORK_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const out: Result[] = [];
  for (const dir of dirs) {
    const dt = dateFromSlug(dir);
    if (!passSinceFilter(dt, since, until)) continue;
    const slugCore = dir.replace(/^\d{4}-?\d{2}-?\d{2}[-_]?(\d+_)?/, "");
    const overlap = tokenOverlap(tokens, slugCore);
    if (overlap === 0 && tokens.length > 0) continue;
    const { multiplier, days } = recencyMultiplier(dt);
    const isaPath = join(WORK_DIR, dir, "ISA.md");
    out.push({
      source: ["work-dir"],
      slug: dir,
      score: overlap * multiplier,
      recencyDays: days,
      path: existsSync(isaPath) ? isaPath : undefined,
    });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.recencyDays ?? Number.POSITIVE_INFINITY;
    const bd = b.recencyDays ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  return out.slice(0, 50);
}

async function ripgrep(pattern: string, dir: string, extra: string[] = []): Promise<string> {
  const proc = Bun.spawn(["rg", "--no-heading", "--line-number", "-i", ...extra, pattern, dir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out;
}

async function searchIsaBodies(tokens: string[], since: Date | null, until: Date | null = null): Promise<Result[]> {
  if (tokens.length === 0 || !existsSync(WORK_DIR)) return [];
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const out = await ripgrep(pattern, WORK_DIR, ["--glob", "*ISA.md", "-c"]);
  const byDir = new Map<string, { hits: number; isaPath: string }>();
  for (const line of out.split("\n")) {
    if (!line) continue;
    const m = line.match(/^(.+?):(\d+)$/);
    if (!m) continue;
    const path = m[1]!;
    const hits = parseInt(m[2]!, 10);
    const dir = basename(path.replace(/\/ISA\.md$/, ""));
    const prev = byDir.get(dir);
    if (!prev || hits > prev.hits) byDir.set(dir, { hits, isaPath: path });
  }
  const results: Result[] = [];
  for (const [dir, info] of byDir.entries()) {
    const dt = dateFromSlug(dir);
    if (!passSinceFilter(dt, since, until)) continue;
    const { multiplier, days } = recencyMultiplier(dt);
    let snippet: string | undefined;
    try {
      const body = readFileSync(info.isaPath, "utf8");
      const re = new RegExp(`(.{0,40}(?:${pattern}).{0,80})`, "i");
      const sm = body.match(re);
      if (sm) snippet = sm[1]!.trim().replace(/\s+/g, " ").slice(0, 160);
    } catch {}
    results.push({
      source: ["isa-body"],
      slug: dir,
      score: info.hits * multiplier,
      recencyDays: days,
      snippet,
      path: info.isaPath,
    });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 100);
}

async function searchJsonl(tokens: string[], since: Date | null, until: Date | null = null): Promise<Result[]> {
  if (tokens.length === 0 || !existsSync(JSONL_DIR)) return [];
  const realDir = JSONL_DIR;
  if (!realDir.startsWith(join(getClaudeDir(), "Projects", PROJECT_SLUG))) return [];
  const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const out = await ripgrep(pattern, realDir, ["--glob", "*.jsonl", "-c"]);
  const byFile = new Map<string, { hits: number; path: string }>();
  for (const line of out.split("\n")) {
    if (!line) continue;
    const m = line.match(/^(.+?):(\d+)$/);
    if (!m) continue;
    const p = m[1]!;
    const hits = parseInt(m[2]!, 10);
    byFile.set(p, { hits, path: p });
  }
  const results: Result[] = [];
  const sorted = [...byFile.entries()].sort((a, b) => b[1].hits - a[1].hits).slice(0, 30);
  const re = new RegExp(pattern, "i");
  for (const [path, info] of sorted) {
    let snippet: string | undefined;
    let firstUserTimestamp: Date | null = null;
    let mtime: Date | null = null;
    try {
      mtime = new Date(statSync(path).mtime);
    } catch {}
    try {
      const text = readFileSync(path, "utf8");
      let nlIdx = -1;
      while (true) {
        const start = nlIdx + 1;
        nlIdx = text.indexOf("\n", start);
        const ln = nlIdx === -1 ? text.slice(start) : text.slice(start, nlIdx);
        if (ln.length > 0) {
          if (!firstUserTimestamp || !snippet) {
            try {
              if (ln.includes('"type":"user"')) {
                const j = JSON.parse(ln);
                if (j.type === "user") {
                  if (!firstUserTimestamp && j.timestamp) {
                    const t = new Date(j.timestamp);
                    if (!Number.isNaN(t.getTime())) firstUserTimestamp = t;
                  }
                  if (!snippet && re.test(ln)) {
                    const c = j?.message?.content;
                    let userText = "";
                    if (typeof c === "string") userText = c;
                    else if (Array.isArray(c)) {
                      for (const p of c) if (p?.type === "text") userText += " " + (p.text ?? "");
                    }
                    userText = userText.trim();
                    if (userText && !userText.startsWith("<") && re.test(userText)) {
                      snippet = userText.replace(/\s+/g, " ").slice(0, 200);
                    }
                  }
                }
              }
            } catch {}
          }
          if (firstUserTimestamp && snippet) break;
        }
        if (nlIdx === -1) break;
      }
    } catch {}
    const dt = firstUserTimestamp ?? mtime;
    if (!passSinceFilter(dt, since, until)) continue;
    if (!snippet) continue;
    const { multiplier, days } = recencyMultiplier(dt);
    const uuid = basename(path).replace(/\.jsonl$/, "");
    results.push({
      source: ["jsonl"],
      slug: uuid,
      sessionUuid: uuid,
      score: info.hits * multiplier,
      recencyDays: days,
      snippet,
      path,
    });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 100);
}

function dedupe(all: Result[]): Result[] {
  const namesPath = NAMES_JSON;
  const sessionNames = existsSync(namesPath) ? JSON.parse(readFileSync(namesPath, "utf8")) : {};
  const workData = existsSync(WORK_JSON) ? JSON.parse(readFileSync(WORK_JSON, "utf8")) : { sessions: {} };
  const uuidToSlug = new Map<string, string>();
  for (const [slug, e] of Object.entries<any>(workData.sessions ?? {})) {
    if (e.sessionUUID) uuidToSlug.set(e.sessionUUID, slug);
  }
  const merged = new Map<string, Result>();
  for (const r of all) {
    const key = r.sessionUuid && uuidToSlug.has(r.sessionUuid)
      ? uuidToSlug.get(r.sessionUuid)!
      : r.slug;
    const existing = merged.get(key);
    if (!existing) {
      const enriched = { ...r, slug: key };
      if (r.sessionUuid && sessionNames[r.sessionUuid] && !enriched.name) {
        enriched.name = sessionNames[r.sessionUuid];
      }
      merged.set(key, enriched);
    } else {
      existing.score += r.score;
      for (const s of r.source) if (!existing.source.includes(s)) existing.source.push(s);
      if (r.snippet && !existing.snippet) existing.snippet = r.snippet;
      if (r.task && !existing.task) existing.task = r.task;
      if (r.name && !existing.name) existing.name = r.name;
      if (r.phase && !existing.phase) existing.phase = r.phase;
      if (r.progress && !existing.progress) existing.progress = r.progress;
      if (r.effort && !existing.effort) existing.effort = r.effort;
      if (r.path && !existing.path) existing.path = r.path;
      if (r.recencyDays !== null && (existing.recencyDays === null || r.recencyDays < existing.recencyDays)) {
        existing.recencyDays = r.recencyDays;
      }
    }
  }
  return [...merged.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ad = a.recencyDays ?? Number.POSITIVE_INFINITY;
    const bd = b.recencyDays ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
}

function formatPretty(query: string, results: Result[], stats: Record<string, number>): string {
  const lines: string[] = [];
  lines.push(`═══ CONTEXT: ${query || "(empty query)"} ═══════════════════════`);
  lines.push("");
  if (results.length === 0) {
    lines.push(absenceMessage(query));
    lines.push("");
    lines.push(`Searched: work.json=${stats.work}, names=${stats.names}, dirs=${stats.dirs}, isa=${stats.isa}, jsonl=${stats.jsonl}`);
    lines.push("════════════════════════════════════════════════");
    return lines.join("\n");
  }
  lines.push(`📋 RESULTS (${results.length}, newest+best first):`);
  for (const r of results) {
    const head = `  • ${r.slug}`;
    const meta = [
      r.task ? `task: ${r.task}` : r.name ? `name: ${r.name}` : null,
      r.phase ? `phase: ${r.phase}` : null,
      r.progress ? `progress: ${r.progress}` : null,
      r.effort ? `effort: ${r.effort}` : null,
      r.recencyDays !== null ? `${r.recencyDays.toFixed(1)}d ago` : null,
      `score: ${r.score.toFixed(2)}`,
      `sources: ${r.source.join(",")}`,
    ].filter(Boolean).join(" | ");
    lines.push(head);
    lines.push(`    ${meta}`);
    if (r.snippet) lines.push(`    ↳ "${r.snippet}"`);
    if (r.path) lines.push(`    ${r.path}`);
  }
  lines.push("");
  lines.push(`Searched: work.json=${stats.work}, names=${stats.names}, dirs=${stats.dirs}, isa=${stats.isa}, jsonl=${stats.jsonl}`);
  lines.push("════════════════════════════════════════════════");
  return lines.join("\n");
}

function absenceMessage(query: string): string {
  return `No prior work found on "${query}" (searched work.json, session names, work dirs, ISA bodies, conversation logs).`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  const { since: parsedSince, until: parsedUntil, query: cleanedQuery } = parseDateFilter(args.query);
  const since = args.since ?? parsedSince;
  const until = parsedUntil;
  const tokens = tokenize(cleanedQuery);

  const [work, names, dirs, isa, jsonl] = await Promise.all([
    Promise.resolve(searchWorkJson(tokens, since, until)),
    Promise.resolve(searchSessionNames(tokens, since, until)),
    Promise.resolve(searchWorkDirs(tokens, since, until)),
    searchIsaBodies(tokens, since, until),
    searchJsonl(tokens, since, until),
  ]);

  const all = [...work, ...names, ...dirs, ...isa, ...jsonl];
  let merged = dedupe(all);
  if (args.limit > 0) merged = merged.slice(0, args.limit);

  const stats = {
    work: work.length,
    names: names.length,
    dirs: dirs.length,
    isa: isa.length,
    jsonl: jsonl.length,
  };

  const wantJson = args.json || (!args.pretty && !process.stdout.isTTY);
  const absence = merged.length === 0 ? absenceMessage(args.query) : null;
  if (wantJson) {
    process.stdout.write(JSON.stringify({
      query: args.query,
      cleaned_query: cleanedQuery,
      tokens,
      since: since?.toISOString() ?? null,
      until: until?.toISOString() ?? null,
      stats,
      absence,
      results: merged,
    }) + "\n");
  } else {
    process.stdout.write(formatPretty(args.query, merged, stats) + "\n");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("ContextSearch error:", err?.message ?? err);
  process.exit(1);
});
