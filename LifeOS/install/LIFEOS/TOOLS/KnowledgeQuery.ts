#!/usr/bin/env bun
/**
 * KnowledgeQuery — the `kb query` surface over the Knowledge Archive.
 *
 * This is the payoff of the kb-v3 migration (design:
 * MEMORY/WORK/20260704-knowledge-schema-upgrade-design/DESIGN.md): now that
 * every note carries the same flat typed frontmatter, the archive is a database.
 * Filter/sort on source, author, tags, dates, type, quality, status, and typed
 * relations — deterministic, no LLM, over all ~4,400 notes in well under a second.
 * Uses the canonical KnowledgeSchema parser so there's one parser of record.
 *
 * Query surface (all AND-combined; repeatable/comma where noted):
 *   --type p,c,...        one of person|company|idea|blog|research (comma/repeat)
 *   --tag <t>             note's tags list contains <t> (repeatable → all must match)
 *   --source-name <s>     substring, case-insensitive
 *   --source-author <s>   substring, case-insensitive
 *   --source-kind <k>     blog|video|paper|tweet|conversation|bookmark|internal
 *   --status <s>          inbox|seedling|budding|evergreen
 *   --created-after <d>   created >= <d>   (YYYY, YYYY-MM, or YYYY-MM-DD)
 *   --created-before <d>  created <  <d>
 *   --source-after <d>    source_date >= <d>
 *   --source-before <d>   source_date <  <d>
 *   --quality-min <n>     --quality-max <n>
 *   --text <s>            title contains <s> (case-insensitive)
 *   --related-to <slug>   has any related edge whose slug is <slug>
 *   --related-type <rt>   has a related edge of type <rt> (e.g. contradicts)
 *   --dir <Dir>           limit to one KNOWLEDGE subdir
 *   --sort <field>        created|updated|quality|title|source_date (default created)
 *   --asc                 ascending (default descending for dates/quality)
 * Output:
 *   (default) table   |  --json  |  --count  |  --slugs  |  --limit N (default 40)  |  --all
 *
 * Examples:
 *   bun KnowledgeQuery.ts --source-author Karpathy
 *   bun KnowledgeQuery.ts --type idea --tag security --created-after 2026-05
 *   bun KnowledgeQuery.ts --related-type contradicts --slugs
 *   bun KnowledgeQuery.ts --status inbox --count
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve as pathResolve, join as pathJoin } from "node:path";
import { homedir } from "node:os";
import { parseNote, slugFromPath, ALL_DIRS, type ParsedNote } from "./KnowledgeSchema";
import { claudeDir } from "./lifeos-root";

const KNOWLEDGE_DIR = pathResolve(claudeDir(), "LIFEOS/MEMORY/KNOWLEDGE");
const DIRS = ALL_DIRS;

interface Rec {
  slug: string; dir: string;
  type: string; title: string;
  tags: string[];
  source_name: string; source_author: string; source_date: string;
  source_kind: string; source_session: string;
  status: string; created: string; updated: string;
  quality: number | null;
  relatedSlugs: string[]; relatedTypes: string[];
}

const deq = (s?: string) => (s ?? "").replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");

function scalar(parsed: ParsedNote, key: string): string {
  const f = parsed.fields.find((x) => x.key === key);
  return deq(f?.scalar);
}

function parseTags(parsed: ParsedNote): string[] {
  const f = parsed.fields.find((x) => x.key === "tags");
  if (!f) return [];
  // inline `[a, b, c]`
  if (f.scalar) {
    const m = f.scalar.match(/^\[(.*)\]$/);
    if (m) return m[1].split(",").map((s) => deq(s)).filter(Boolean);
    return [deq(f.scalar)].filter(Boolean);
  }
  // block form: `tags:\n  - a\n  - b`
  return [...f.raw.matchAll(/^\s+-\s+(.+)$/gm)].map((mm) => deq(mm[1])).filter(Boolean);
}

function readRec(path: string, dir: string): Rec | null {
  const parsed = parseNote(readFileSync(path, "utf8"));
  if (!parsed.hadFrontmatter) return null;
  const q = scalar(parsed, "quality");
  const rel = parsed.fields.find((x) => x.key === "related");
  const relatedSlugs = rel ? [...rel.raw.matchAll(/\bslug:\s*(.+)$/gm)].map((m) => deq(m[1])) : [];
  const relatedTypes = rel ? [...rel.raw.matchAll(/\btype:\s*([A-Za-z-]+)/g)].map((m) => m[1]) : [];
  return {
    slug: slugFromPath(path), dir,
    type: scalar(parsed, "type"), title: scalar(parsed, "title"),
    tags: parseTags(parsed),
    source_name: scalar(parsed, "source_name"), source_author: scalar(parsed, "source_author"),
    source_date: scalar(parsed, "source_date"), source_kind: scalar(parsed, "source_kind"),
    source_session: scalar(parsed, "source_session"),
    status: scalar(parsed, "status"), created: scalar(parsed, "created"), updated: scalar(parsed, "updated"),
    quality: q === "" ? null : Number(q),
    relatedSlugs, relatedTypes,
  };
}

// ── arg parsing ──
function argVal(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
function argMulti(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === flag && args[i + 1]) out.push(...args[i + 1].split(","));
  return out;
}

function main() {
  const args = process.argv.slice(2);
  // first positional (not a --flag and not the value of one) → free-text title search
  const types = argMulti(args, "--type").map((s) => s.toLowerCase());
  const tags = argMulti(args, "--tag");
  const srcName = argVal(args, "--source-name")?.toLowerCase();
  const srcAuthor = argVal(args, "--source-author")?.toLowerCase();
  const srcKind = argVal(args, "--source-kind");
  const status = argVal(args, "--status");
  const createdAfter = argVal(args, "--created-after");
  const createdBefore = argVal(args, "--created-before");
  const sourceAfter = argVal(args, "--source-after");
  const sourceBefore = argVal(args, "--source-before");
  const qMin = argVal(args, "--quality-min"); const qMax = argVal(args, "--quality-max");
  const text = argVal(args, "--text")?.toLowerCase();
  const relatedTo = argVal(args, "--related-to");
  const relatedType = argVal(args, "--related-type");
  const onlyDir = argVal(args, "--dir");
  const sortField = argVal(args, "--sort") ?? "created";
  const asc = args.includes("--asc");
  const asJson = args.includes("--json");
  const asCount = args.includes("--count");
  const asSlugs = args.includes("--slugs");
  const all = args.includes("--all");
  const limit = all ? Infinity : Number(argVal(args, "--limit") ?? 40);

  const dirs = onlyDir ? [onlyDir] : [...DIRS];
  const recs: Rec[] = [];
  for (const dir of dirs) {
    const abs = pathJoin(KNOWLEDGE_DIR, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!f.endsWith(".md") || f.startsWith("_") || f === "README.md") continue;
      const r = readRec(pathJoin(abs, f), dir);
      if (r) recs.push(r);
    }
  }

  let out = recs.filter((r) => {
    if (types.length && !types.includes(r.type.toLowerCase())) return false;
    if (tags.length && !tags.every((t) => r.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase()))) return false;
    if (srcName && !r.source_name.toLowerCase().includes(srcName)) return false;
    if (srcAuthor && !r.source_author.toLowerCase().includes(srcAuthor)) return false;
    if (srcKind && r.source_kind !== srcKind) return false;
    if (status && r.status !== status) return false;
    if (createdAfter && !(r.created >= createdAfter)) return false;
    if (createdBefore && !(r.created < createdBefore)) return false;
    if (sourceAfter && !(r.source_date && r.source_date >= sourceAfter)) return false;
    if (sourceBefore && !(r.source_date && r.source_date < sourceBefore)) return false;
    if (qMin && !(r.quality != null && r.quality >= Number(qMin))) return false;
    if (qMax && !(r.quality != null && r.quality <= Number(qMax))) return false;
    if (text && !r.title.toLowerCase().includes(text)) return false;
    if (relatedTo && !r.relatedSlugs.includes(relatedTo)) return false;
    if (relatedType && !r.relatedTypes.includes(relatedType)) return false;
    return true;
  });

  const cmp = (a: Rec, b: Rec) => {
    const key = sortField as keyof Rec;
    const av = a[key] ?? ""; const bv = b[key] ?? "";
    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    return 0;
  };
  out.sort(cmp);

  const total = out.length;
  if (asCount) { console.log(String(total)); return; }
  if (asSlugs) { out.slice(0, limit).forEach((r) => console.log(r.slug)); return; }
  if (asJson) { console.log(JSON.stringify(out.slice(0, limit), null, 2)); return; }

  // table
  const shown = out.slice(0, limit);
  console.log(`\n${total} match${total === 1 ? "" : "es"}${shown.length < total ? ` (showing ${shown.length}; --all for the rest)` : ""}\n`);
  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s).padEnd(n);
  console.log(`  ${"TYPE".padEnd(9)} ${"TITLE".padEnd(34)} ${"AUTHOR".padEnd(18)} ${"SOURCE".padEnd(16)} ${"CREATED".padEnd(10)} Q`);
  console.log(`  ${"-".repeat(9)} ${"-".repeat(34)} ${"-".repeat(18)} ${"-".repeat(16)} ${"-".repeat(10)} -`);
  for (const r of shown) {
    console.log(`  ${trunc(r.type, 9)} ${trunc(r.title, 34)} ${trunc(r.source_author, 18)} ${trunc(r.source_name, 16)} ${trunc((r.created || "").slice(0, 10), 10)} ${r.quality ?? "-"}`);
  }
  console.log("");
}

main();
