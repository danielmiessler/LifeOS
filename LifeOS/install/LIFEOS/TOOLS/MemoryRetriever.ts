#!/usr/bin/env bun
/**
 * @version 1.5.1
 */
// Normalize env path vars Claude Code may inject unexpanded — literal $HOME/${HOME}
// in LIFEOS_DIR/LIFEOS_CONFIG_DIR/PROJECTS_DIR resolves to a shadow dir (#1404 / PR #1451, author jbmml).
for (const __k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const __v = process.env[__k];
  if (__v && /^\$\{?HOME\}?(\/|$)/.test(__v)) process.env[__k] = __v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

/**
 * ============================================================================
 * MemoryRetriever — Compressed context retrieval over LifeOS's knowledge archive
 * ============================================================================
 *
 * PURPOSE:
 * Given a query string, searches all markdown files in MEMORY/KNOWLEDGE/
 * (People/, Companies/, Ideas/, Research/), ranks by BM25-lite relevance,
 * and returns compressed summaries of the top matches within a token budget.
 *
 * USAGE:
 *   bun MemoryRetriever.ts "query string"                    # Search, return compressed results
 *   bun MemoryRetriever.ts "query string" --top 5            # Return top 5 (default: 3)
 *   bun MemoryRetriever.ts "query string" --raw              # Skip compression, return raw excerpts
 *   bun MemoryRetriever.ts "query string" --budget 800       # Token budget for output (default: 500)
 *   bun MemoryRetriever.ts --help                            # Show usage
 *
 * SEARCH:
 *   BM25-style keyword matching + tag co-occurrence scoring.
 *   No vector DB — pure markdown + YAML frontmatter. Per-turn retrieval has an opt-in embedding
 *   leg (LIFEOS_MEMORY_EMBEDDING=1, local Ollama only; MemoryEmbedding.ts), off by default.
 *
 * COMPRESSION:
 *   Uses Inference.ts low level for optional LLM compression of matched content.
 *   --raw flag skips compression and returns raw excerpts.
 *
 * STORAGE:
 *   Reads MEMORY/KNOWLEDGE/{People,Companies,Ideas,Research}/*.md  (class: knowledge)
 *   Reads MEMORY/LEARNING/ ** /*.md recursively                    (class: learning)
 *   Never modifies a note. The CLI writes nothing; the in-process API (getRelevantContext,
 *   indexedNotes, refreshIndex) maintains a persisted index in MEMORY/STATE.
 *
 * INDEX (in-process API, see "Persisted index for the hot path" below):
 *   retriever-index.json          meta: per-note scoring fields, the generation and folder
 *                                 fingerprint it was built from, and its postings file name
 *   retriever-index.json.*.postings  term → [doc, tf] in 256 shards, read by byte range;
 *                                 exactly two on disk, the current one and the one it replaced
 *   retriever-index-generation.json  bumped only by writers (bumpMemoryGeneration)
 *   retriever-index.json.lock     rebuild lock, owner-token checked on release and takeover
 *   A default caller rebuilds a stale index before scoring. getRelevantContext's
 *   `allowStaleIndex` (MemoryTurnStart only) serves the last good index with no walk; the
 *   async Stop hook hooks/MemoryIndexRefresh.hook.ts calls refreshIndex() after each turn.
 *
 * ============================================================================
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { invariant, InvariantViolation } from "./Invariant";
import { getClaudeDir, getLifeosDir, lifeosPath } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { ALL_DIRS } from "./KnowledgeSchema.ts"; // public PR #2149, @Bowlerjim; PR #2143, @joecoxtech
import { embeddingConfig, rankByEmbedding, refreshEmbeddings, type EmbeddingConfig } from "./MemoryEmbedding"; // opt-in leg, public issue #2207

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

// ============================================================================
// Configuration
// ============================================================================

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const LIFEOS_DIR = getLifeosDir();
// The memory root honours CORTEX_MEMORY_ROOT exactly as Cortex.ts does, so an isolated caller (a test, a
// public-install probe) can point the retriever away from the live tree; Paths resolves from the script
// location, not HOME, so HOME alone never isolates it (2026-09-05, hardening test).
const MEMORY_ROOT = process.env.CORTEX_MEMORY_ROOT ? path.resolve(process.env.CORTEX_MEMORY_ROOT) : path.join(LIFEOS_DIR, "MEMORY");
const KNOWLEDGE_DIR = path.join(MEMORY_ROOT, "KNOWLEDGE");
// All six note types (kb-v3 CANONICAL_TYPES). Using KnowledgeSchema.ALL_DIRS as the single
// source prevents drift where Books or Blogs notes would be invisible to the retriever (public PR #2149, @Bowlerjim).
const DOMAINS = ALL_DIRS;

// The LEARNING tree — failures, incidents, algorithm reflections, system notes —
// is a first-class part of the searchable corpus, not a write-only archive
// (public issue #1776, @umair-a11y). It is walked recursively because entries
// live in dated subdirs (FAILURES/2026-07/<slug>/CONTEXT.md).
const LEARNING_DIR = path.join(MEMORY_ROOT, "LEARNING");

// BM25 parameters
const BM25_K1 = 1.5;
const BM25_B = 0.75;

// Scoring weights
const TITLE_MATCH_WEIGHT = 10;
const TAG_MATCH_WEIGHT = 5;
const RELATED_MATCH_WEIGHT = 3;

// LEARNING notes are historical records of what happened, not curated statements
// of what is true. They should surface, but never outrank a KNOWLEDGE note that
// matches as well — hence a flat penalty on the final score.
const LEARNING_SCORE_MULTIPLIER = 0.7;

// getRelevantContext() runs synchronously on EVERY prompt (MemoryTurnStart
// hook), so its cost is a tax on every turn of every session. LEARNING is ~12k
// files / ~33MB and grows monotonically — roughly 8x the KNOWLEDGE corpus — so
// the hot path takes a recency-bounded slice while the CLI (user-initiated and
// latency-tolerant) searches the full tree.
//
// Measured on the live corpus, per fresh process (each hook run is one):
// KNOWLEDGE alone ~138ms, +500 LEARNING ~207ms, +1500 LEARNING ~300ms. Once
// the walk is bounded (see collectLearningPaths) the remaining cost is BM25
// scoring, which scales with document COUNT — reads are only 31ms per 1,500
// files. 500 holds the added tax at roughly half the existing baseline while
// covering the most recent ~4 weeks, which is where "have we already hit this?"
// retrieval pays off. Raising it is a one-constant change; ordering is by the
// date embedded in each path, so the slice is always the newest entries.
const HOT_PATH_LEARNING_LIMIT = 500;

// Defaults
const DEFAULT_TOP = 3;
const DEFAULT_BUDGET = 500;
const MAX_EXCERPT_CHARS = 2000;

// ============================================================================
// Types
// ============================================================================

interface Frontmatter {
  title?: string;
  type?: string;
  domain?: string;
  tags?: string[];
  related?: string[];
  [key: string]: unknown;
}

/**
 * Which corpus a note came from. Distinct from frontmatter `type` (which is a
 * per-note authoring field and is often absent): the class is structural, known
 * from the directory the note was discovered in, and always present.
 */
type NoteClass = "knowledge" | "learning" | "memory";

interface PrecomputedData {
  bodyTokens: string[]; // unique lowercase words from body
  termFrequencies: Record<string, number>; // term -> count in body
  normalizedTags: string[]; // lowercase tags
  normalizedRelated: string[]; // lowercase related slugs
  wikiLinks: string[]; // extracted [[...]] references
}

interface KnowledgeNote {
  filePath: string;
  frontmatter: Frontmatter;
  body: string;
  wordCount: number;
  noteClass: NoteClass;
  precomputed?: PrecomputedData; // set during index build
}

interface ScoredNote {
  note: KnowledgeNote;
  score: number;
}

// ============================================================================
// Frontmatter Parsing
// ============================================================================

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const result: Frontmatter = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Indented lines are block-list content — consumed by the collector below,
    // never treated as top-level keys (#1330).
    if (/^\s/.test(line)) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = line.substring(0, colonIdx).trim();
    let value: string | string[] = line.substring(colonIdx + 1).trim();
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      // Inline array: [a, b, c]
      value = value.slice(1, -1).split(",").map((s: string) => s.trim().replace(/['"]/g, ""));
    } else if (typeof value === "string" && value.length === 0) {
      // Empty scalar → possible YAML block list. Collect following indented "- item"
      // entries the old parser silently dropped. Typed kb-v3 items ("- slug: x")
      // yield the slug value; plain items ("- foo") yield the string. This is what
      // makes the +related-slug retrieval boost fire on kb-v3 notes (#1330).
      const items: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (next.trim().length === 0) continue;                     // tolerate blank lines
        if (!next.startsWith("  ") && !next.startsWith("\t")) break; // dedent ends the block
        const m = next.trim().match(/^-\s+(.*)$/);
        if (!m) continue;                                           // continuation field (e.g. "type: x")
        let item = m[1].trim();
        const slugMatch = item.match(/^slug:\s*(.+)$/);             // typed related item → its slug
        if (slugMatch) item = slugMatch[1].trim();
        item = item.replace(/['"]/g, "");
        if (item.length > 0) items.push(item);
      }
      if (items.length > 0) value = items;
    }
    result[key] = value;
  }

  const body = content.substring(match[0].length).trim();
  return { frontmatter: result, body };
}

// ============================================================================
// File Discovery
// ============================================================================

// Recursively walk a domain dir for `.md` files. Excludes `_`-prefixed dirs
// (e.g. `_harvest-queue/`) and `.`-prefixed dirs (e.g. `.git/`).
function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function readNotes(filePaths: string[], noteClass: NoteClass): KnowledgeNote[] {
  const notes: KnowledgeNote[] = [];
  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      const wordCount = body.split(/\s+/).filter(Boolean).length;
      notes.push({ filePath, frontmatter, body, wordCount, noteClass });
    } catch {
      // Skip unreadable files
    }
  }
  return notes;
}

function discoverNotes(): KnowledgeNote[] {
  const notes: KnowledgeNote[] = [];
  for (const domain of DOMAINS) {
    notes.push(...readNotes(walkMarkdown(path.join(KNOWLEDGE_DIR, domain)), "knowledge"));
  }
  return notes;
}

/**
 * Recency rank for a LEARNING path segment, from the `YYYY-MM[-DD]` the tree
 * embeds in its dated subdir names. stat()-ing for real mtimes would cost more
 * than the reads this ordering exists to avoid.
 *
 * Undated segments sort FIRST: they are the small hand-curated set (README.md,
 * ROOT_CAUSE_ANALYSIS.md, the top-level feedback_*.md notes), so a truncated
 * hot-path slice keeps them rather than dropping them for churn.
 */
function learningRecencyKey(segment: string): string {
  const dates = segment.match(/\d{4}-\d{2}(?:-\d{2})?/g);
  if (!dates || dates.length === 0) return "￿"; // sorts above any date
  return dates.reduce((a, b) => (b > a ? b : a));
}

/**
 * Enumerate LEARNING note paths newest-first, descending into at most as many
 * dated month-buckets as it takes to reach `limit`.
 *
 * Walking the whole tree and slicing afterwards does NOT bound the cost: the
 * recursive walk alone measured 83-118ms over 3,540 dirs, dwarfing both the
 * reads (31ms for 1,500 files) and the scoring it was meant to cap. So the
 * bounded path reads only the top two levels (~9 readdirs) to find the
 * `CATEGORY/YYYY-MM/` buckets, then recurses into them in date order.
 *
 * `limit === undefined` (the CLI) walks the whole tree, which is correct there.
 */
function collectLearningPaths(limit?: number): string[] {
  if (!fs.existsSync(LEARNING_DIR)) return [];
  if (limit === undefined) return walkMarkdown(LEARNING_DIR);

  const { direct, buckets } = learningLayout();
  const out = [...direct];
  for (const bucket of buckets) {
    if (out.length >= limit) break;
    out.push(...walkMarkdown(bucket.dir));
  }
  return out.length > limit ? out.slice(0, limit) : out;
}

/**
 * The top two LEARNING levels: undated `.md` files found there (`direct`, always
 * kept), the category dirs, and the `CATEGORY/<dated>/` buckets, newest first. Shared
 * by the bounded slice above and the freshness walk, so both always agree on which
 * buckets the hot-path index covers.
 */
function learningLayout(): { direct: string[]; categories: string[]; buckets: { key: string; dir: string }[] } {
  const direct: string[] = []; // undated, curated — always kept
  const categories: string[] = [];
  const buckets: { key: string; dir: string }[] = [];

  const scanLevel = (dir: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".md")) direct.push(full);
      else if (entry.isDirectory()) {
        // depth 0 = LEARNING root, its dirs are categories (ALGORITHM, FAILURES…).
        // depth 1 = a category, its dirs are the dated buckets we rank.
        if (depth === 0) { categories.push(full); scanLevel(full, 1); }
        else buckets.push({ key: learningRecencyKey(entry.name), dir: full });
      }
    }
  };
  scanLevel(LEARNING_DIR, 0);

  buckets.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return { direct, categories, buckets };
}

/**
 * Discover LEARNING notes, newest-first. `limit` bounds the hot path; the CLI
 * passes nothing and gets the whole tree. Absent LEARNING dir → empty array,
 * never a throw (public issue #1776, @umair-a11y).
 */
function discoverLearningNotes(limit?: number): KnowledgeNote[] {
  return readNotes(collectLearningPaths(limit), "learning");
}

// ============================================================================
// BM25-lite Scoring
// ============================================================================

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Precompute all the data needed for scoring at index build time.
 * This is called once per note during indexedNotes() and stored in the index.
 */
function computePrecomputed(note: KnowledgeNote): PrecomputedData {
  const bodyLower = note.body.toLowerCase();

  // Extract unique tokens from body and count frequencies
  const tokens = tokenize(note.body);
  const bodyTokens = [...new Set(tokens)];
  const termFrequencies: Record<string, number> = {};
  for (const token of tokens) {
    termFrequencies[token] = (termFrequencies[token] ?? 0) + 1;
  }

  // Normalize tags
  const rawTags = note.frontmatter.tags as unknown;
  const normalizedTags: string[] = Array.isArray(rawTags)
    ? (rawTags as unknown[]).map((t) => String(t).toLowerCase())
    : typeof rawTags === "string"
      ? [(rawTags as string).toLowerCase()]
      : [];

  // Normalize related
  const rawRelated = note.frontmatter.related as unknown;
  const normalizedRelated: string[] = Array.isArray(rawRelated)
    ? (rawRelated as unknown[]).map((r) => {
        if (typeof r === "string") return r.toLowerCase();
        if (r && typeof r === "object" && "slug" in r) return String((r as { slug: unknown }).slug).toLowerCase();
        return "";
      }).filter((s) => s.length > 0)
    : typeof rawRelated === "string"
      ? [(rawRelated as string).toLowerCase()]
      : [];

  // Extract wiki links
  const wikiLinksMatches = note.body.match(/\[\[([^\]]+)\]\]/g) || [];
  const wikiLinks = wikiLinksMatches.map((l: string) => l.replace(/\[\[|\]\]/g, "").toLowerCase());

  return {
    bodyTokens,
    termFrequencies,
    normalizedTags,
    normalizedRelated,
    wikiLinks,
  };
}

// Conversational glue is not evidence of a memory match. Keep short domain
// terms (AI, UI, Go, etc.); an acknowledgement alone needs no new retrieval.
const QUERY_GLUE = new Set("a an the and or but if then than to of in on at for from with by as is are was were be been being it its this that these those i me my we us our you your they them their he she his her have has had do does did can could would should will just please yes yeah okay ok thanks thank fix do go ahead continue proceed".split(" "));
export function retrievalTerms(query: string): string[] {
  // Approval-only follow-ups refer to the current conversation, not the archive.
  // Match the whole utterance so an added topic still reaches retrieval.
  const approval = query.replace(/[’']/g, "").replace(/[,.!?]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(?:(?:well|okay|ok|yeah|yes|please) )*(?:do (?:it|that|whatever you can(?: now)?(?: to fix (?:it|that))?)|go ahead|fix (?:it|that)|continue|proceed)(?: now)?(?: and (?:then )?lets (?:just )?(?:keep observing|wait(?: (?:a little|a bit))?))?$/i.test(approval)) return [];
  return [...new Set(tokenize(query))].filter(term => term === "go" || !QUERY_GLUE.has(term));
}

// One compiled matcher per term: scoring runs containsTerm for every term against every
// note's title, tags and related slugs, and building a fresh RegExp per call was most of
// the scoring time on the hot path. No `g` flag, so `test` keeps no state between calls.
//
// `needle` is a substring prefilter that skips the regex when it cannot match. It is exact,
// not a heuristic, because every caller passes already-lowercased text (scoreNote lowercases
// titles, tags and slugs) and the needle is only set for an ASCII term: without the `u` flag a
// case-insensitive match never pairs a non-ASCII text character with an ASCII term character,
// so any match is the lowercased term appearing verbatim in the lowercased text.
const termMatchers = new Map<string, { re: RegExp; needle: string | null }>();
const TERM_MATCHER_CAP = 5000;

function containsTerm(text: string, term: string): boolean {
  let m = termMatchers.get(term);
  if (!m) {
    if (termMatchers.size >= TERM_MATCHER_CAP) termMatchers.clear(); // long-lived importers (Pulse) see unbounded distinct terms
    m = {
      re: new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i"),
      needle: /^[\x00-\x7f]*$/.test(term) ? term.toLowerCase() : null,
    };
    termMatchers.set(term, m);
  }
  if (m.needle !== null && !text.includes(m.needle)) return false;
  return m.re.test(text);
}

function computeBM25(
  termFreq: number,
  docLength: number,
  avgDocLength: number
): number {
  const tf = termFreq;
  const numerator = tf * (BM25_K1 + 1);
  const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
  return numerator / denominator;
}

export function scoreNote(
  note: KnowledgeNote,
  queryTerms: string[],
  avgDocLength: number
): number {
  let score = 0;
  const titleLower = (note.frontmatter.title || "").toLowerCase();

  // Use precomputed data if available (from indexed hot path), otherwise recompute (for CLI and legacy paths)
  let tags: string[];
  let relatedSlugs: string[];
  let termFrequencies: Record<string, number>;

  if (note.precomputed) {
    // Hot path: use precomputed data from index
    tags = note.precomputed.normalizedTags;
    relatedSlugs = [...note.precomputed.normalizedRelated, ...note.precomputed.wikiLinks];
    termFrequencies = note.precomputed.termFrequencies;
  } else {
    // Legacy path: recompute on demand (for CLI, unindexed notes, tests)
    const bodyLower = note.body.toLowerCase();

    // Normalize tags to string array (frontmatter values are unknown at runtime)
    const rawTags = note.frontmatter.tags as unknown;
    tags = Array.isArray(rawTags)
      ? (rawTags as unknown[]).map((t) => String(t).toLowerCase())
      : typeof rawTags === "string"
        ? [(rawTags as string).toLowerCase()]
        : [];

    // Normalize related to string array
    const rawRelated = note.frontmatter.related as unknown;
    const related: string[] = Array.isArray(rawRelated)
      ? (rawRelated as unknown[]).map((r) => {
          // related entries may be strings OR {slug, type} objects (new convention)
          if (typeof r === "string") return r.toLowerCase();
          if (r && typeof r === "object" && "slug" in r) return String((r as { slug: unknown }).slug).toLowerCase();
          return "";
        }).filter((s) => s.length > 0)
      : typeof rawRelated === "string"
        ? [(rawRelated as string).toLowerCase()]
        : [];

    // Also extract [[wiki-link]] style related slugs from body
    const wikiLinks = note.body.match(/\[\[([^\]]+)\]\]/g) || [];
    relatedSlugs = [
      ...related,
      ...wikiLinks.map((l: string) => l.replace(/\[\[|\]\]/g, "").toLowerCase()),
    ];

    // Compute term frequencies for BM25
    termFrequencies = {};
    const tokens = tokenize(note.body);
    for (const token of tokens) {
      termFrequencies[token] = (termFrequencies[token] ?? 0) + 1;
    }
  }

  for (const term of new Set(queryTerms)) {
    // Title match: +10 per query term in title
    if (containsTerm(titleLower, term)) {
      score += TITLE_MATCH_WEIGHT;
    }

    // Tag match: +5 per query term matching a tag.
    // Reverse containment (term ⊇ tag) requires tag length ≥ 4 — otherwise any
    // garbage term swallows short tags and the zero-hit absence path is unreachable.
    for (const tag of tags) {
      // `untagged` is the migrator's placeholder (MemorySystem writes `tags: [untagged]`),
      // not a topic: scoring it lets a query containing "tag" or "untagged" rank every
      // placeholder note above real matches. (public issue #1985, @hjbrandt)
      if (tag === "untagged") continue;
      if (containsTerm(tag, term)) {
        score += TAG_MATCH_WEIGHT;
        break; // One match per term per tag set
      }
    }

    // Related slug match: +3 per query term in related slugs
    for (const slug of relatedSlugs) {
      if (containsTerm(slug, term)) {
        score += RELATED_MATCH_WEIGHT;
        break; // One match per term per related set
      }
    }

    // Content frequency: BM25-style scoring
    const tf = termFrequencies[term] ?? 0;
    if (tf > 0) {
      score += computeBM25(tf, note.wordCount, avgDocLength);
    }
  }

  // Historical records rank below curated knowledge at equal match strength.
  if (note.noteClass === "learning") score *= LEARNING_SCORE_MULTIPLIER;

  return score;
}

// ============================================================================
// Excerpt Extraction
// ============================================================================

/**
 * A heading-only block carries no payload: the result header already renders the
 * note title, so returning a heading as the excerpt spends a retrieval slot on a
 * line the caller has printed already. Covers ATX ("## Thesis") and setext (a
 * title underlined with equals signs or hyphens). (public PR #1984, @rathko)
 */
function isHeadingOnly(p: string): boolean {
  const lines = p.trim().split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return false;
  const isAtx = (l: string) => /^\s*#{1,6}\s/.test(l);
  if (lines.every(isAtx)) return true;
  return lines.length === 2 && !isAtx(lines[0]!) && /^\s*(=+|-+)\s*$/.test(lines[1]!);
}

export function extractExcerpt(note: KnowledgeNote, queryTerms: string[]): string {
  const body = note.body;

  // Prioritized section headers to extract from
  const sectionPriority = ["## Thesis", "## Background", "## Key Findings", "## Key Facts", "## Context", "## Evidence", "## Summary"];

  for (const header of sectionPriority) {
    const idx = body.indexOf(header);
    if (idx === -1) continue;

    // Extract from header to next ## or end of content
    const afterHeader = body.substring(idx + header.length);
    const nextHeader = afterHeader.search(/\n## /);
    const section = nextHeader > -1
      ? afterHeader.substring(0, nextHeader).trim()
      : afterHeader.substring(0, MAX_EXCERPT_CHARS).trim();

    if (section.length > 20) {
      return section.substring(0, MAX_EXCERPT_CHARS);
    }
  }

  // Fallback: find the paragraph with the highest query term density
  const paragraphs = body.split(/\n\n+/).filter((p) => p.trim().length > 30);
  if (paragraphs.length === 0) return body.substring(0, MAX_EXCERPT_CHARS);

  let bestIndex = -1;
  let bestDensity = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;
    const paraLower = para.toLowerCase();
    let hits = 0;
    for (const term of queryTerms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = paraLower.match(regex);
      if (matches) hits += matches.length;
    }
    const density = hits / para.split(/\s+/).length;
    if (density > bestDensity) {
      bestDensity = density;
      bestIndex = i;
    }
  }

  // public PR #1984, @rathko — never hand back a bare heading as the excerpt.
  // Nothing matched: every density is 0, so the old code returned paragraphs[0],
  // the note title for any note opening with a heading over 30 chars. Prefer prose.
  if (bestIndex === -1) {
    const firstProse = paragraphs.find((p) => !isHeadingOnly(p));
    return (firstProse ?? paragraphs[0]!).substring(0, MAX_EXCERPT_CHARS);
  }

  // The match landed on a heading: return the prose that heading introduces, so a
  // query hitting a section title yields that section rather than an unrelated one.
  // A trailing heading with nothing after it (or an all-headings note) falls through
  // and returns the matched heading itself: thinner, but it names the section that hit.
  if (isHeadingOnly(paragraphs[bestIndex]!)) {
    const following = paragraphs.slice(bestIndex + 1).find((p) => !isHeadingOnly(p));
    if (following) return following.substring(0, MAX_EXCERPT_CHARS);
  }

  return paragraphs[bestIndex]!.substring(0, MAX_EXCERPT_CHARS);
}

// ============================================================================
// LLM Compression via Inference.ts
// ============================================================================

// A compression call can exit 0 with non-empty output yet return the model's
// clarification/refusal instead of a summary (e.g. it treats the note as absent
// and answers "I need the actual note content to compress…"). Those bodies then
// masquerade as real summaries. These high-signal tells detect that case; the
// guard's failure mode is benign — it falls back to a raw excerpt.
// Ported from LifeOS#1449 by @asdf8675309.
const META_ARTIFACT_PATTERNS: RegExp[] = [
  /\bi need the actual\b/i,
  /\bpaste the full\b/i,
  /\byou'?ve provided the title\b/i,
  /\bthe note body itself\b/i,
  /\bnote content to compress\b/i,
  /\bcontent to compress isn'?t\b/i,
  /\bi'?ll compress it\b/i,
  /\bcompress it to under\b/i,
  /\bready when you share\b/i,
  /\bplease (?:paste|share)\b[\s\S]{0,30}\bnote\b/i,
  /\bnote\b[\s\S]{0,20}\b(?:isn'?t|not|wasn'?t) (?:included|provided)\b/i,
  /\b(?:isn'?t|not|wasn'?t) (?:included|provided)\b[\s\S]{0,20}\bnote\b/i,
  // Measured refusal from the compression call (public issue #2262, @drpaulobernardy).
  /\bprovide the full text\b/i,
  /\bno body content\b/i,
];

export function looksLikeMetaArtifact(s: string): boolean {
  return META_ARTIFACT_PATTERNS.some((p) => p.test(s));
}

function compress(text: string, budget: number): string {
  const inferPath = path.join(LIFEOS_DIR, "TOOLS", "Inference.ts");

  if (!fs.existsSync(inferPath)) {
    // Fallback: truncate to approximate token count
    return text.substring(0, budget * 4);
  }

  const systemPrompt = `Compress the following knowledge note into a dense summary under ${budget} tokens. Preserve key facts, names, dates, and relationships. No filler. No preamble.`;
  const userPrompt = text.substring(0, MAX_EXCERPT_CHARS);

  const result = spawnSync(
    "bun",
    [inferPath, "--level", "low", systemPrompt, userPrompt],
    { encoding: "utf-8", timeout: 15000 }
  );

  if (result.status === 0 && result.stdout.trim()) {
    const summary = result.stdout.trim();
    // Reject a "successful" result that is actually the model's clarification or
    // refusal rather than a summary; fall through to the raw-truncation fallback.
    if (!looksLikeMetaArtifact(summary)) return summary;
  }

  // Fallback: return truncated raw text
  return text.substring(0, budget * 4);
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatResults(
  query: string,
  results: ScoredNote[],
  summaries: string[],
  totalSearched: number
): string {
  const lines: string[] = [];

  lines.push(`\n  Memory Retrieval: "${query}"`);
  lines.push("  " + "-".repeat(45));

  if (results.length === 0) {
    lines.push("  No matching memories found.");
    lines.push("  " + "-".repeat(45));
    lines.push(`  Searched ${totalSearched} notes across ${DOMAINS.join(", ")}, LEARNING.`);
    return lines.join("\n");
  }

  for (let i = 0; i < results.length; i++) {
    const { note, score } = results[i];
    const title = note.frontmatter.title || path.basename(note.filePath, ".md");
    const type = note.frontmatter.type || "unknown";
    const summary = summaries[i];

    lines.push("");
    // Class is shown ahead of type so a LEARNING hit reads as a historical
    // record at a glance rather than as a curated fact (public issue #1776).
    lines.push(`  [${note.noteClass}] [${title}] (type: ${type}, score: ${score.toFixed(1)})`);

    // Indent summary lines
    const summaryLines = summary.split("\n");
    for (const sl of summaryLines) {
      lines.push(`     ${sl}`);
    }
  }

  lines.push("");
  lines.push("  " + "-".repeat(45));
  lines.push(`  Retrieved ${results.length} results from ${totalSearched} notes searched.`);

  return lines.join("\n");
}

// ============================================================================
// F6 — getRelevantContext: typed-corpus retrieval for per-turn injection
// ============================================================================
//
// Extends the existing BM25 search to (a) cover the two _MEMORY.md hot-layer
// files as virtual notes alongside the KNOWLEDGE corpus, (b) return a
// markdown block ready for injection into buildLifeosContextBlock, (c) cache by
// query hash for 60s so repeated calls within a turn cluster are cheap.
//
// ISA F6 (revision 2). ISC-69..81 + 142..144 (simplified — pure BM25, no
// dual-tier prefetch, no graph traversal on hot path).

const MEMORY_FILES: ReadonlyArray<{ path: string; title: string }> = [
  { path: lifeosPath("USER", "PRINCIPAL", "PRINCIPAL_MEMORY.md"), title: "Principal Memory" },
  { path: lifeosPath("USER", "DIGITAL_ASSISTANT", "DA_MEMORY.md"), title: "DA Memory" },
];

const RELEVANT_CACHE_TTL_MS = 60_000;
const RELEVANT_DEFAULT_TOP_K = 5;
const RELEVANT_DEFAULT_THRESHOLD = 0.20;
const RELEVANT_EXCERPT_CHARS = 500;

interface RelevantCacheEntry {
  ts: number;
  result: GetRelevantContextResult;
}

const relevantCache = new Map<string, RelevantCacheEntry>();

export interface RelevantResultItem {
  type: "memory" | "idea" | "knowledge" | "unknown";
  /**
   * Which corpus the hit came from. Additive alongside `type`, which stays
   * bound to the MemoryTypeName union that MemorySystem.find() casts to — a
   * "learning" value there would break that consumer (public issue #1776).
   */
  noteClass: NoteClass;
  path: string;
  title: string;
  score: number;
  excerpt: string;
}

export interface GetRelevantContextResult {
  results: RelevantResultItem[];
  markdownBlock: string;
  totalSearched: number;
  cached: boolean;
}

/**
 * Load the two _MEMORY.md hot-layer files as virtual KnowledgeNote records
 * so they participate in the same BM25 scoring as KNOWLEDGE notes. The body
 * is the joined typed entries (NAME:/ROLE:/etc.); frontmatter type is "memory"
 * so result items can be discriminated.
 *
 * Reads via fs directly (not MemoryWriter) to keep this module's import graph
 * shallow. The entries are validated at write time by MemoryWriter, so what's
 * on disk is trusted.
 */
function loadMemoryFiles(): KnowledgeNote[] {
  const notes: KnowledgeNote[] = [];

  for (const { path: filePath, title } of MEMORY_FILES) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);

      // Strip HTML comments and marker lines; keep only the actual entries
      const cleaned = body
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/^\s*$/gm, "")
        .trim();

      if (cleaned.length === 0) continue;

      const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
      notes.push({
        filePath,
        frontmatter: {
          ...frontmatter,
          title,
          type: "memory",
        },
        body: cleaned,
        wordCount,
        noteClass: "memory",
      });
    } catch {
      // Skip unreadable
    }
  }

  return notes;
}

// ── Persisted index for the hot path ──
// 2026-09-03 (20260903-hook-process-storm): every prompt re-read and re-parsed ~3,400 files,
// so the parsed corpus moved into a persisted index keyed by a generation counter. Writers
// (the harvest writers, KnowledgeHarvester, SessionHarvester, etc.) bump the generation after
// writes; a throttled freshness walk catches out-of-band edits (the principal editing a note).
//
// 2026-10-09 (MemoryTurnStart speed lane), measured on the live corpus: the v1 index was 175MB
// of JSON (74ms read + 900ms parse per fresh hook process), 82MB of it note bodies and 34MB
// `bodyTokens`, neither of which scoring reads; and a stale index was rebuilt on the prompt
// (7.9s). Now:
//   - the index is split: a small meta file (per-note title/tags/related/wordCount, everything
//     scoreNote reads except term frequencies) plus one postings file of term → [doc, tf] shards,
//     read by byte range for the query's terms only. Bodies come from the note file on disk, and
//     only for the hits that are injected. Scores use exactly the inputs v1 used.
//   - freshness is the caller's choice. By default a caller gets HEAD's contract: a stale index
//     is rebuilt before it is scored, where stale means the writers' generation or the covered
//     folders' fingerprint (walked at most once per 60s per process) differs from the one the
//     index was built from. MemoryTurnStart alone passes `allowStaleIndex`: it does no walk and
//     serves the last good index, and the async Stop hook (hooks/MemoryIndexRefresh.hook.ts →
//     refreshIndex()) walks and rebuilds after the turn. A missing or unreadable index is built
//     on any path, once.
//   - the walk never writes the generation file; only writers do, so a writer's bump cannot be
//     overwritten by a concurrent walk.
//   - a rebuild persists only under the rebuild lock, and keeps exactly two postings files on
//     disk: the current one and the one it replaced, so a reader still holding the previous meta
//     can finish its read.

/**
 * Where the index lives. A caller isolated by CORTEX_MEMORY_ROOT gets its own STATE dir under that
 * root, so a probe or test corpus can never overwrite the live index.
 */
const RETRIEVER_STATE_DIR = process.env.CORTEX_MEMORY_ROOT ? path.join(MEMORY_ROOT, "STATE") : lifeosPath("MEMORY", "STATE");
export const RETRIEVER_INDEX_PATH = path.join(RETRIEVER_STATE_DIR, "retriever-index.json");
export const RETRIEVER_GENERATION_PATH = path.join(RETRIEVER_STATE_DIR, "retriever-index-generation.json");
const INDEX_VERSION = 2;
const INDEX_HEADER = `{"version":${INDEX_VERSION},`; // JSON.stringify writes `version` first; checked before parsing
const POSTINGS_SHARDS = 256;
const FRESHNESS_WALK_INTERVAL_MS = 60_000; // a default caller walks the covered folders at most once per 60s
const REBUILD_LOCK_STALE_MS = 120_000; // a rebuild lock older than this belongs to a dead process (a build takes ~7s)
const LOCK_BREAKER_STALE_MS = 10_000; // a breaker is held for microseconds; one this old was left by a crash

/** One note as the scorer sees it: every scoreNote input except term frequencies, which live in postings. */
interface IndexRecord {
  filePath: string;
  frontmatter: Frontmatter;
  wordCount: number;
  noteClass: NoteClass;
  normalizedTags: string[];
  normalizedRelated: string[];
  wikiLinks: string[];
}

interface IndexMeta {
  version: number;
  /** The writers' generation when the build started. */
  generation: string;
  /** coveredFingerprint() when the build started. Absent on an index written before it existed, which reads as stale. */
  coveredFingerprint?: string;
  /** Basename of the postings file, beside the meta file. */
  postingsFile: string;
  /** Basename of the postings file of the meta this one replaced, kept so a reader holding that meta can finish. */
  previousPostingsFile?: string;
  /** [byteOffset, byteLength] of each shard's JSON object inside the postings file. */
  shards: Array<[number, number]>;
  notes: IndexRecord[];
  /** Set only on a meta this process just built: its shards, so scoring skips re-reading them. Never persisted. */
  inMemory?: PostingsShard[];
}

/** A shard maps term → flat [docIndex, termFrequency, docIndex, termFrequency, ...]. */
type PostingsShard = Record<string, number[]>;

/** An index built in this process: its shards and the exact postings bytes, ready to persist. */
type BuiltIndex = IndexMeta & { inMemory: PostingsShard[]; postingsBytes: Buffer };

/** A held rebuild lock. `token` is unique to this acquisition; only its holder may release it. */
export interface RebuildLock { path: string; token: string }

// In-process caches for long-lived importers (Pulse): the meta is keyed by its file identity,
// and the last walk's fingerprint is reused for FRESHNESS_WALK_INTERVAL_MS.
let cachedMeta: { key: string; meta: IndexMeta } | null = null;
let lastWalk: { at: number; fingerprint: string } | null = null;
let bumpSeq = 0;
const indexStats = { walks: 0, builds: 0 };

/** Freshness walks and index builds this process has run. Tests read it to prove the prompt path does neither. */
export function retrieverIndexStats(): { walks: number; builds: number } {
  return { ...indexStats };
}

/** FNV-1a over the term's UTF-16 code units, reduced to a shard number. */
function shardOf(term: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % POSTINGS_SHARDS;
}

/** The writers' generation; "0" when no writer has bumped it yet (or the file is corrupt). */
function readGeneration(): string {
  try {
    const data = JSON.parse(fs.readFileSync(RETRIEVER_GENERATION_PATH, "utf-8")) as { gen?: unknown };
    if (typeof data.gen === "string" && data.gen) return data.gen;
  } catch { /* missing or corrupt → "0", which no index carries after the first bump */ }
  return "0";
}

/**
 * Signal that the memory corpus changed and the retriever index must be rebuilt.
 * Called by the harvest writers, KnowledgeHarvester, SessionHarvester, etc. after writes.
 * Writers are the only writers of the generation file: the freshness walk never touches it,
 * so no read-modify-write can erase a bump. Each bump is unique (pid + sequence), so two
 * bumps in the same millisecond still differ from the generation an index was built from.
 */
export function bumpMemoryGeneration(): void {
  const gen = `writer:${Date.now()}:${process.pid}:${++bumpSeq}`;
  invariant(/^writer:\d+:\d+:\d+$/.test(gen), `retriever generation is malformed: ${gen}`);
  try {
    fs.mkdirSync(path.dirname(RETRIEVER_GENERATION_PATH), { recursive: true });
    const tmp = `${RETRIEVER_GENERATION_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ gen }));
    fs.renameSync(tmp, RETRIEVER_GENERATION_PATH);
  } catch (err) {
    // The write is still caught by the fingerprint walk, so this is not fatal, but it is not silent either.
    process.stderr.write(`MemoryRetriever: generation bump not written (${(err as Error).message})\n`);
  }
}

/**
 * Fingerprint of exactly the folders the hot-path index is built from: every path and its
 * mtime and size, for each KNOWLEDGE domain tree, the LEARNING root, every category dir
 * (a new dated bucket, or a deleted undated note in a category that has no buckets, changes
 * it), the undated notes, and the dated buckets inside the HOT_PATH_LEARNING_LIMIT slice.
 * An edit, an addition, a deletion or a rename anywhere in that set changes it; entries
 * outside the set cannot change the index, so they are not statted.
 */
function coveredFingerprint(): string {
  indexStats.walks++;
  const hash = createHash("sha1");
  const add = (p: string): boolean => {
    try {
      const st = fs.statSync(p);
      hash.update(`${p}\0${st.mtimeMs}\0${st.size}\n`);
      return true;
    } catch { return false; }
  };
  // Adds every entry under `dir` and returns how many `.md` files walkMarkdown would yield.
  const walk = (dir: string): number => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    let count = 0;
    for (const entry of entries) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (!add(full)) continue;
      if (entry.isDirectory()) count += walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) count++;
    }
    return count;
  };

  for (const domain of DOMAINS) {
    const dir = path.join(KNOWLEDGE_DIR, domain);
    if (add(dir)) walk(dir);
  }
  if (add(LEARNING_DIR)) {
    const { direct, categories, buckets } = learningLayout();
    for (const category of categories) add(category);
    for (const file of direct) add(file);
    let covered = direct.length;
    for (const bucket of buckets) {
      if (covered >= HOT_PATH_LEARNING_LIMIT) break;
      add(bucket.dir);
      covered += walk(bucket.dir);
    }
  }
  hash.update(`learning-limit:${HOT_PATH_LEARNING_LIMIT}`);
  return hash.digest("hex");
}

/** Walk now, and remember the result for the throttled check. */
function freshFingerprint(): string {
  const fingerprint = coveredFingerprint();
  lastWalk = { at: Date.now(), fingerprint };
  return fingerprint;
}

/** The covered folders' fingerprint, walked at most once per FRESHNESS_WALK_INTERVAL_MS in this process. */
function throttledFingerprint(): string {
  if (lastWalk && Date.now() - lastWalk.at < FRESHNESS_WALK_INTERVAL_MS) return lastWalk.fingerprint;
  return freshFingerprint();
}

function isFresh(meta: IndexMeta, generation: string, fingerprint: string): boolean {
  return meta.generation === generation && meta.coveredFingerprint === fingerprint;
}

/** The meta file's identity for the in-process cache: a rename-into-place always changes it. */
function metaKey(indexPath: string): string | null {
  try {
    const st = fs.statSync(indexPath);
    return `${indexPath}|${st.mtimeMs}|${st.size}|${st.ino}`;
  } catch { return null; }
}

/** A bare file name (no directory part), as every postings reference in a meta must be. */
function isBareName(name: unknown): name is string {
  return typeof name === "string" && name.length > 0 && path.basename(name) === name && name !== "." && name !== "..";
}

/**
 * Load the index meta, or null when it is missing, unreadable, or an older format. The header
 * check runs before JSON.parse so an old 175MB v1 index is rejected in microseconds, not parsed.
 */
function loadIndexMeta(indexPath: string): IndexMeta | null {
  const key = metaKey(indexPath);
  if (!key) return null;
  if (cachedMeta && cachedMeta.key === key) return cachedMeta.meta;
  try {
    const fd = fs.openSync(indexPath, "r");
    let text: string;
    try {
      const head = Buffer.alloc(INDEX_HEADER.length);
      fs.readSync(fd, head, 0, head.length, 0);
      if (head.toString("utf-8") !== INDEX_HEADER) return null;
      text = fs.readFileSync(fd, "utf-8");
    } finally {
      fs.closeSync(fd);
    }
    // readFileSync on an fd continues from the current position, which readSync with an
    // explicit position does not move, so `text` is the whole file.
    const meta = JSON.parse(text) as IndexMeta;
    if (meta.version !== INDEX_VERSION || typeof meta.generation !== "string" || !Array.isArray(meta.notes)
      || !Array.isArray(meta.shards) || meta.shards.length !== POSTINGS_SHARDS || !isBareName(meta.postingsFile)
      || (meta.previousPostingsFile !== undefined && !isBareName(meta.previousPostingsFile))
      || (meta.coveredFingerprint !== undefined && typeof meta.coveredFingerprint !== "string")) return null;
    cachedMeta = { key, meta };
    return meta;
  } catch { return null; }
}

/**
 * Term frequencies for `terms`, per document index, read from only the shards those terms hash
 * to. Null when the postings cannot be read: ENOENT is the expected case (a reader holding a
 * meta two rebuilds old) and stays quiet; anything else is reported on stderr before the
 * caller falls back, so a corrupt or truncated postings file is never hidden behind a rebuild.
 */
function readTermFrequencies(indexPath: string, meta: IndexMeta, terms: string[]): Map<number, Record<string, number>> | null {
  if (meta.inMemory) return termFrequenciesFromShards(meta.inMemory, terms);
  const byDoc = new Map<number, Record<string, number>>();
  const wanted = new Map<number, string[]>();
  for (const term of new Set(terms)) {
    const shard = shardOf(term);
    const list = wanted.get(shard);
    if (list) list.push(term); else wanted.set(shard, [term]);
  }
  try {
    const fd = fs.openSync(path.join(path.dirname(indexPath), meta.postingsFile), "r");
    try {
      for (const [shard, shardTerms] of wanted) {
        const [offset, length] = meta.shards[shard]!;
        const buf = Buffer.alloc(length);
        const read = fs.readSync(fd, buf, 0, length, offset);
        if (read !== length) throw new Error(`shard ${shard} short read: ${read}/${length} bytes`);
        const postings = JSON.parse(buf.toString("utf-8")) as PostingsShard;
        for (const term of shardTerms) {
          if (Object.prototype.hasOwnProperty.call(postings, term)) addPostings(byDoc, term, postings[term]!);
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      process.stderr.write(`MemoryRetriever: postings ${meta.postingsFile} unreadable: ${(err as Error).message}\n`);
    }
    return null;
  }
  return byDoc;
}

/** Merge one term's flat [doc, tf, ...] postings into the per-document frequency map. */
function addPostings(byDoc: Map<number, Record<string, number>>, term: string, flat: number[]): void {
  for (let i = 0; i < flat.length; i += 2) {
    const doc = flat[i]!;
    let tf = byDoc.get(doc);
    if (!tf) { tf = {}; byDoc.set(doc, tf); }
    tf[term] = flat[i + 1]!;
  }
}

function termFrequenciesFromShards(shards: PostingsShard[], terms: string[]): Map<number, Record<string, number>> {
  const byDoc = new Map<number, Record<string, number>>();
  for (const term of new Set(terms)) {
    const flat = shards[shardOf(term)]![term];
    if (flat) addPostings(byDoc, term, flat);
  }
  return byDoc;
}

// ── Rebuild lock ──
// A lock file holds its acquirer's unique token. Release removes it only when the token is still
// ours. A lock older than REBUILD_LOCK_STALE_MS was left by a dead process; breaking it takes a
// second wx-created "breaker" file first and re-reads that the lock still holds the same stale
// token, so a takeover never deletes a fresh lock another process just took.

function readLockFile(lockPath: string): { token: string; mtimeMs: number } | null {
  try {
    const mtimeMs = fs.statSync(lockPath).mtimeMs;
    return { token: fs.readFileSync(lockPath, "utf-8"), mtimeMs };
  } catch { return null; }
}

/** Create `lockPath` holding `token` only if no such file exists. False when one does, or on any other failure. */
function createLockFile(lockPath: string, token: string): boolean {
  invariant(token.length > 0, "a rebuild lock token must be non-empty");
  invariant(lockPath.endsWith(".lock") || lockPath.endsWith(".lock.breaker"), `not a rebuild lock path: ${lockPath}`);
  let created = false;
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const fd = fs.openSync(lockPath, "wx");
    created = true;
    try { fs.writeSync(fd, token); } finally { fs.closeSync(fd); }
    return true;
  } catch (err) {
    // Created but the token never landed (ENOSPC, EIO): an empty lock would read as held by nobody
    // and block takeover, so remove it (Astra review, 2026-10-09).
    if (created) { try { fs.unlinkSync(lockPath); } catch { /* already gone */ } }
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      process.stderr.write(`MemoryRetriever: cannot create ${path.basename(lockPath)}: ${(err as Error).message}\n`);
    }
    return false;
  }
}

/**
 * Remove `lockPath` only if it still holds `token` (and is at least `minAgeMs` old). An empty token
 * matches only on a stale takeover (minAgeMs > 0): a crash between create and write leaves an empty
 * file, and refusing it would block every later rebuild for good (Astra review, 2026-10-09).
 */
function removeLockIfToken(lockPath: string, token: string, minAgeMs = 0): boolean {
  invariant(token.length > 0 || minAgeMs > 0, "refusing to remove a live lock by an empty token");
  const current = readLockFile(lockPath);
  if (!current || current.token !== token || Date.now() - current.mtimeMs < minAgeMs) return false;
  try { fs.unlinkSync(lockPath); return true; } catch { return false; }
}

/** Take the rebuild lock at `lockPath`, or null when another live process holds it. */
export function acquireRebuildLock(lockPath: string): RebuildLock | null {
  const token = `${process.pid}:${randomUUID()}`;
  if (createLockFile(lockPath, token)) return { path: lockPath, token };
  const held = readLockFile(lockPath);
  if (!held) return createLockFile(lockPath, token) ? { path: lockPath, token } : null; // released between the two calls
  if (Date.now() - held.mtimeMs < REBUILD_LOCK_STALE_MS) return null;

  const breakerPath = `${lockPath}.breaker`;
  if (!createLockFile(breakerPath, token)) {
    // Another process is breaking it now. A breaker that old was left by a crash: clear it so the next attempt can proceed.
    const breaker = readLockFile(breakerPath);
    if (breaker) removeLockIfToken(breakerPath, breaker.token, LOCK_BREAKER_STALE_MS);
    return null;
  }
  try {
    removeLockIfToken(lockPath, held.token, REBUILD_LOCK_STALE_MS);
    return createLockFile(lockPath, token) ? { path: lockPath, token } : null;
  } finally {
    removeLockIfToken(breakerPath, token);
  }
}

/** Release a lock we hold. A lock that was broken and retaken by another process is left alone. */
export function releaseRebuildLock(lock: RebuildLock): boolean {
  return removeLockIfToken(lock.path, lock.token);
}

function ownsRebuildLock(lock: RebuildLock): boolean {
  return readLockFile(lock.path)?.token === lock.token;
}

// ── Build, persist, prune ──

/** Build the index from the covered corpus, in memory. `generation` and `fingerprint` were taken before any note is read. */
function buildIndex(indexPath: string, generation: string, fingerprint: string): BuiltIndex {
  indexStats.builds++;
  const knowledgePaths = DOMAINS.flatMap((d) => walkMarkdown(path.join(KNOWLEDGE_DIR, d)));
  const learningPaths = collectLearningPaths(HOT_PATH_LEARNING_LIMIT);
  const notes = [...readNotes(knowledgePaths, "knowledge"), ...readNotes(learningPaths, "learning")];

  const records: IndexRecord[] = [];
  const shardMaps: PostingsShard[] = Array.from({ length: POSTINGS_SHARDS }, () => Object.create(null) as PostingsShard);
  notes.forEach((note, doc) => {
    const pre = computePrecomputed(note);
    records.push({
      filePath: note.filePath,
      frontmatter: note.frontmatter,
      wordCount: note.wordCount,
      noteClass: note.noteClass,
      normalizedTags: pre.normalizedTags,
      normalizedRelated: pre.normalizedRelated,
      wikiLinks: pre.wikiLinks,
    });
    for (const [term, tf] of Object.entries(pre.termFrequencies)) {
      const shard = shardMaps[shardOf(term)]!;
      (shard[term] ??= []).push(doc, tf);
    }
  });

  const chunks: Buffer[] = [];
  const shards: Array<[number, number]> = [];
  let offset = 0;
  for (const shard of shardMaps) {
    const chunk = Buffer.from(JSON.stringify(shard), "utf-8");
    shards.push([offset, chunk.length]);
    chunks.push(chunk);
    offset += chunk.length;
  }
  return {
    version: INDEX_VERSION,
    generation,
    coveredFingerprint: fingerprint,
    postingsFile: `${path.basename(indexPath)}.${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}.postings`,
    shards,
    notes: records,
    inMemory: shardMaps,
    postingsBytes: Buffer.concat(chunks),
  };
}

/**
 * Persist a built index under the rebuild lock: the postings file first, then the meta that
 * points at it (renamed into place last, so a reader never sees a meta whose postings are not
 * on disk yet), then prune. Throws on any write failure; the caller reports it.
 */
function persistIndex(indexPath: string, built: BuiltIndex, replaced: IndexMeta | null, lock: RebuildLock): void {
  invariant(lock.path === `${indexPath}.lock`, `persisting ${indexPath} under a foreign lock ${lock.path}`);
  invariant(built.generation.length > 0, "index generation must be a non-empty string");
  invariant(isBareName(built.postingsFile) && built.postingsFile.endsWith(".postings"), `bad postings name ${built.postingsFile}`);
  invariant(built.shards.length === POSTINGS_SHARDS, `index has ${built.shards.length} shards, expected ${POSTINGS_SHARDS}`);
  const last = built.shards[POSTINGS_SHARDS - 1]!;
  invariant(last[0] + last[1] === built.postingsBytes.length, `postings shards cover ${last[0] + last[1]} of ${built.postingsBytes.length} bytes`);

  const previous = replaced && replaced.postingsFile !== built.postingsFile ? replaced.postingsFile : undefined;
  const meta: IndexMeta = {
    version: built.version,
    generation: built.generation,
    coveredFingerprint: built.coveredFingerprint,
    postingsFile: built.postingsFile,
    ...(previous ? { previousPostingsFile: previous } : {}),
    shards: built.shards,
    notes: built.notes,
  };

  const dir = path.dirname(indexPath);
  fs.mkdirSync(dir, { recursive: true });
  const postingsPath = path.join(dir, built.postingsFile);
  const postingsTmp = `${postingsPath}.${process.pid}.tmp`;
  fs.writeFileSync(postingsTmp, built.postingsBytes);
  fs.renameSync(postingsTmp, postingsPath);
  const metaTmp = `${indexPath}.${process.pid}.tmp`;
  fs.writeFileSync(metaTmp, JSON.stringify(meta));
  fs.renameSync(metaTmp, indexPath);
  const key = metaKey(indexPath);
  cachedMeta = key ? { key, meta } : null;
  // A lock lost mid-build (held past REBUILD_LOCK_STALE_MS and taken over) means another builder may
  // have postings in flight; pruning now could delete them, so the next lock holder prunes instead.
  if (ownsRebuildLock(lock)) prunePostings(indexPath, meta);
}

/**
 * Keep exactly the current postings file and the one it replaced; delete every other postings
 * file, whatever its age, and temp files older than a lock. Runs only under the rebuild lock, so
 * no other builder has postings in flight. When the meta names no previous file (an index
 * written before this field existed), the newest other postings file stands in for it.
 */
function prunePostings(indexPath: string, meta: IndexMeta): void {
  const dir = path.dirname(indexPath);
  const prefix = `${path.basename(indexPath)}.`;
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return; }
  const postings = names.filter((n) => n.startsWith(prefix) && n.endsWith(".postings"));
  const mtime = (name: string): number => { try { return fs.statSync(path.join(dir, name)).mtimeMs; } catch { return 0; } };

  const keep = new Set<string>([meta.postingsFile]);
  if (meta.previousPostingsFile && postings.includes(meta.previousPostingsFile)) keep.add(meta.previousPostingsFile);
  else {
    const newestOther = postings.filter((n) => n !== meta.postingsFile).sort((a, b) => mtime(b) - mtime(a))[0];
    if (newestOther) keep.add(newestOther);
  }
  invariant(keep.has(meta.postingsFile) && keep.size <= 2, `postings prune would keep ${[...keep].join(", ")}`);

  const now = Date.now();
  for (const name of names) {
    if (!name.startsWith(prefix) || keep.has(name)) continue;
    const isPostings = name.endsWith(".postings");
    if (!isPostings && !(name.endsWith(".tmp") && now - mtime(name) > REBUILD_LOCK_STALE_MS)) continue;
    try { fs.unlinkSync(path.join(dir, name)); } catch { /* already gone */ }
  }
}

interface RebuildOutcome {
  /** The index to score from: the existing one if it turned out fresh, else the new build. Null only when locked out of a refresh. */
  meta: IndexMeta | null;
  /** True only when a new index was written to disk. */
  rebuilt: boolean;
  reason: string;
  /** A write failure, reported by the caller. */
  error?: string;
}

/**
 * Bring the index at `indexPath` up to date. Under the lock it re-checks freshness (another
 * session may have just rebuilt), builds, and persists. Without the lock, `requireLock`
 * (refreshIndex) gives up, and a query path builds in memory and scores from that, writing
 * nothing. `force` rebuilds even an index that reads as fresh (its postings were unreadable).
 */
function rebuildIndex(indexPath: string, opts: { requireLock: boolean; force?: boolean }): RebuildOutcome {
  const lock = acquireRebuildLock(`${indexPath}.lock`);
  if (!lock && opts.requireLock) return { meta: null, rebuilt: false, reason: "locked" };
  try {
    // Taken before any note is read, so a write landing during the build leaves the new index
    // already stale (rebuilt next time) rather than silently missing it.
    const generation = readGeneration();
    const fingerprint = freshFingerprint();
    const existing = loadIndexMeta(indexPath);
    if (!opts.force && existing && isFresh(existing, generation, fingerprint)) return { meta: existing, rebuilt: false, reason: "fresh" };
    const reason = !existing ? "missing" : opts.force ? "unreadable" : "stale";
    const built = buildIndex(indexPath, generation, fingerprint);
    if (!lock) return { meta: built, rebuilt: false, reason: "locked" };
    try {
      persistIndex(indexPath, built, existing, lock);
      return { meta: built, rebuilt: true, reason };
    } catch (err) {
      if (err instanceof InvariantViolation) throw err;
      return { meta: built, rebuilt: false, reason: "write-failed", error: (err as Error).message };
    }
  } finally {
    if (lock) releaseRebuildLock(lock);
  }
}

// A build this process made but could not save (lock held elsewhere, or the write failed). Kept so a
// long-lived caller such as Pulse reuses it while it stays fresh, instead of rebuilding (~5s) on every
// query until the write succeeds, as HEAD's in-process cache did (Astra review, 2026-10-09).
let unsavedBuild: { indexPath: string; meta: IndexMeta } | null = null;

function unsavedFor(indexPath: string): IndexMeta | null {
  return unsavedBuild && unsavedBuild.indexPath === indexPath ? unsavedBuild.meta : null;
}

/** rebuildIndex for a query path, which always gets an index back; a write failure goes to stderr. */
function rebuildForQuery(indexPath: string, force = false): IndexMeta {
  const outcome = rebuildIndex(indexPath, { requireLock: false, force });
  if (outcome.error) process.stderr.write(`MemoryRetriever: index rebuilt but not saved: ${outcome.error}\n`);
  invariant(outcome.meta !== null, "a query-path rebuild always yields an index");
  if (outcome.rebuilt || outcome.reason === "fresh") unsavedBuild = null;
  else unsavedBuild = { indexPath, meta: outcome.meta };
  return outcome.meta;
}

/**
 * The index a query scores against.
 *   default        — HEAD's contract: rebuild first when the generation or the covered folders'
 *                    fingerprint (walked at most once per 60s per process) moved past the index.
 *   allowStale     — no walk, no generation check: serve the last good index. Only a missing or
 *                    unreadable index is built. MemoryTurnStart's opt-in; the Stop hook refreshes.
 */
function resolveIndex(indexPath: string, allowStale: boolean): IndexMeta {
  if (allowStale) return loadIndexMeta(indexPath) ?? unsavedFor(indexPath) ?? rebuildForQuery(indexPath);
  const fingerprint = throttledFingerprint();
  const generation = readGeneration();
  const meta = loadIndexMeta(indexPath);
  if (meta && isFresh(meta, generation, fingerprint)) return meta;
  const unsaved = unsavedFor(indexPath);
  if (unsaved && isFresh(unsaved, generation, fingerprint)) return unsaved;
  return rebuildForQuery(indexPath);
}

/**
 * Off-prompt refresh, run by the async Stop hook after every turn: walk the covered folders now
 * (no throttle) and rebuild the index when it is behind the generation or the walk. `rebuilt`
 * is true only when a new index reached disk; a write failure comes back as reason
 * "write-failed" with the error, and a rebuild already running elsewhere as "locked".
 */
export function refreshIndex(opts: { indexPath?: string } = {}): { rebuilt: boolean; generation: string; reason: string; error?: string } {
  const indexPath = opts.indexPath ?? RETRIEVER_INDEX_PATH;
  const fingerprint = freshFingerprint();
  const generation = readGeneration();
  const meta = loadIndexMeta(indexPath);
  if (meta && isFresh(meta, generation, fingerprint)) return { rebuilt: false, generation, reason: "fresh" };
  const outcome = rebuildIndex(indexPath, { requireLock: true });
  return {
    rebuilt: outcome.rebuilt,
    generation: outcome.meta?.generation ?? generation,
    reason: outcome.reason,
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}

/** Real paths of the declared corpus roots (KNOWLEDGE and LEARNING); a root that does not exist contributes nothing. */
function corpusRealRoots(): string[] {
  const roots: string[] = [];
  for (const r of [KNOWLEDGE_DIR, LEARNING_DIR]) { try { roots.push(fs.realpathSync(r)); } catch { /* absent root holds no notes */ } }
  return roots;
}

/**
 * True when `filePath` is a markdown note whose real path sits inside a declared corpus root. The index
 * file is data on disk: a tampered `filePath` must never make the retriever read and inject an arbitrary
 * file as relevant memory. realpath before the boundary check, so a link planted in
 * the corpus that points out of it is refused too.
 */
export function isCorpusNotePath(filePath: unknown, roots: string[] = corpusRealRoots()): boolean {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !filePath.endsWith(".md")) return false;
  let real: string;
  try { real = fs.realpathSync(filePath); } catch { return false; }
  return roots.some((r) => real.startsWith(r + path.sep));
}

/** Read a note's body from its file; null when the file is gone, unreadable, or outside the corpus. */
function readBody(filePath: string): string | null {
  if (!isCorpusNotePath(filePath)) return null;
  try { return parseFrontmatter(fs.readFileSync(filePath, "utf-8")).body; } catch { return null; }
}

/**
 * The hot-path corpus (KNOWLEDGE + bounded LEARNING) as full notes, bodies read from disk.
 * Default freshness: a stale index is rebuilt first, so a caller that just bumped the
 * generation sees its write.
 */
export function indexedNotes(opts: { indexPath?: string } = {}): KnowledgeNote[] {
  const meta = resolveIndex(opts.indexPath ?? RETRIEVER_INDEX_PATH, false);
  const notes: KnowledgeNote[] = [];
  for (const r of meta.notes) {
    const body = readBody(r.filePath);
    if (body === null) continue;
    notes.push({ filePath: r.filePath, frontmatter: r.frontmatter, body, wordCount: r.wordCount, noteClass: r.noteClass });
  }
  return notes;
}

/** The unindexed path, kept for parity tests. */
export function unindexedNotes(): KnowledgeNote[] {
  return [...discoverNotes(), ...discoverLearningNotes(HOT_PATH_LEARNING_LIMIT)];
}

/**
 * The corpus scored for `queryTerms`. Index notes carry everything scoreNote reads (title,
 * tags, related, wiki links, word count, and the term frequencies of exactly these query
 * terms from postings), with an empty body; memory hot-layer files are full notes. Order is
 * index notes then memory files, as before, so the stable sort breaks ties identically.
 *
 * Unreadable postings: reload the meta once (a rebuild may have replaced it under us), then
 * rebuild. The rebuild is forced, because the meta itself may still read as fresh.
 */
function corpusForQuery(queryTerms: string[], allowStale: boolean, indexPath: string = RETRIEVER_INDEX_PATH): KnowledgeNote[] {
  let meta = resolveIndex(indexPath, allowStale);
  let tfs = readTermFrequencies(indexPath, meta, queryTerms);
  if (!tfs) {
    cachedMeta = null;
    meta = resolveIndex(indexPath, allowStale);
    tfs = readTermFrequencies(indexPath, meta, queryTerms);
  }
  if (!tfs) {
    meta = rebuildForQuery(indexPath, true);
    tfs = readTermFrequencies(indexPath, meta, queryTerms);
    invariant(tfs !== null, "a freshly built index scores from memory");
  }
  const notes: KnowledgeNote[] = meta.notes.map((r, i) => ({
    filePath: r.filePath,
    frontmatter: r.frontmatter,
    body: "",
    wordCount: r.wordCount,
    noteClass: r.noteClass,
    precomputed: {
      bodyTokens: [],
      termFrequencies: tfs.get(i) ?? {},
      normalizedTags: r.normalizedTags,
      normalizedRelated: r.normalizedRelated,
      wikiLinks: r.wikiLinks,
    },
  }));
  notes.push(...loadMemoryFiles());
  return notes;
}

/**
 * Synchronous, in-process BM25 retrieval over the typed-item corpus. Returns
 * top-K results above the score threshold, plus a markdown block ready for
 * injection into buildLifeosContextBlock.
 *
 * Behavior contract:
 *   - Empty / below-threshold results return empty markdown string (no noise)
 *   - Cached by query hash for 60s
 *   - Returns within ~50ms for typical corpora (no LLM call on hot path)
 *   - Result type field comes from the note's frontmatter
 *
 * Options:
 *   topK         — max results to return (default 5)
 *   threshold    — minimum BM25 score; below → empty (default 0.20)
 *   excerptChars — max excerpt length per result (default 500)
 *   typeFilter   — restrict to one type
 *   allowStaleIndex — serve the last good index without a freshness walk or rebuild (default
 *                  false: a stale index is rebuilt first). Only MemoryTurnStart passes it: the
 *                  prompt cannot wait on a walk or a seconds-long rebuild, and the async Stop hook
 *                  (MemoryIndexRefresh → refreshIndex) refreshes the index after the turn.
 */
export function getRelevantContext(
  query: string,
  options: RelevantContextOptions = {},
): GetRelevantContextResult {
  const startedAt = Date.now();
  const result = computeRelevantContext(query, options);
  logRetrieval(query, result.results.length, Date.now() - startedAt);
  return result;
}

/**
 * The per-turn entry for the retrieval worker (hooks/lib/retrieval-worker.ts). With the embedding
 * leg off (the default) it is getRelevantContext, unchanged. With LIFEOS_MEMORY_EMBEDDING=1 it
 * ranks the same corpus by embedding (MemoryEmbedding.ts) (public issue #2207). The keyword result is
 * computed first and kept, and the query embed gets only the time left before `deadline` (epoch ms,
 * from the hook): a failure or a slow embed returns that keyword result in time, so a stopped or
 * cold server costs one keyword turn and never the turn. Without `deadline`, `timeoutMs` (default
 * 250) bounds the embed. `context` (the previous user messages) is embedded after the query; it
 * never decides whether to search: a prompt with no content words still retrieves nothing.
 */
export async function getRelevantContextAsync(
  query: string,
  options: RelevantContextOptions & { deadline?: number; timeoutMs?: number; context?: string } = {},
): Promise<GetRelevantContextResult> {
  const cfg = embeddingConfig();
  if (!cfg.enabled) return getRelevantContext(query, options);
  const startedAt = Date.now();
  const keyword = computeRelevantContext(query, options);
  let result = keyword;
  try {
    const timeoutMs = options.deadline !== undefined ? options.deadline - Date.now() - EMBED_RESULT_RESERVE_MS : options.timeoutMs ?? 250;
    result = await computeEmbeddingContext(query, { ...options, timeoutMs }, cfg);
  } catch (err) {
    if (err instanceof InvariantViolation) throw err;
    result = keyword; // fail open to the keyword result already in hand
  }
  logRetrieval(query, result.results.length, Date.now() - startedAt);
  return result;
}

/** Time kept after the query embed to build the hits and post them back before the hook's deadline. */
const EMBED_RESULT_RESERVE_MS = 15;

async function computeEmbeddingContext(
  query: string,
  options: RelevantContextOptions & { timeoutMs: number; context?: string },
  cfg: EmbeddingConfig,
): Promise<GetRelevantContextResult> {
  const topK = options.topK ?? RELEVANT_DEFAULT_TOP_K;
  const excerptChars = options.excerptChars ?? RELEVANT_EXCERPT_CHARS;
  const empty: GetRelevantContextResult = { results: [], markdownBlock: "", totalSearched: 0, cached: false };
  // Same gate as the keyword path: a prompt with no content words ("ok", "go ahead") retrieves nothing.
  const queryTerms = retrievalTerms(query);
  if (queryTerms.length === 0) return empty;
  const allNotes = corpusForQuery(queryTerms, options.allowStaleIndex === true);
  if (allNotes.length === 0) return empty;
  const embedded = options.context?.trim() ? `${query.trim()}\n${options.context.trim()}` : query;
  const ranking = await rankByEmbedding(embedded, allNotes, cfg, { timeoutMs: options.timeoutMs });
  const results: RelevantResultItem[] = [];
  for (let j = 0; j < ranking.order.length && results.length < topK; j++) {
    const note = allNotes[ranking.order[j]];
    if (options.typeFilter && (note.frontmatter.type ?? "unknown") !== options.typeFilter) continue;
    const body = note.noteClass === "memory" ? note.body : readBody(note.filePath);
    if (body === null) continue; // a stale index entry whose file is gone gives way to the next one
    const rawType = (note.frontmatter.type ?? "unknown") as string;
    const knownType: RelevantResultItem["type"] =
      rawType === "memory" || rawType === "idea" || rawType === "knowledge" ? rawType : "unknown";
    results.push({
      type: knownType,
      noteClass: note.noteClass,
      path: note.filePath,
      title: (note.frontmatter.title as string) || path.basename(note.filePath, ".md"),
      score: ranking.cosines[j],
      excerpt: extractExcerpt({ ...note, body }, queryTerms).slice(0, excerptChars),
    });
  }
  return { results, markdownBlock: formatRelevantBlock(results), totalSearched: allNotes.length, cached: false };
}

/**
 * Embed new and changed notes for the embedding leg; called by the async Stop hook after the
 * keyword index refresh. Null when the leg is off.
 */
export async function refreshEmbeddingIndex(opts: { budgetMs?: number } = {}): Promise<{ embedded: number; pending: number; pruned: number; warmed: boolean } | null> {
  const cfg = embeddingConfig();
  if (!cfg.enabled) return null;
  const notes = [...indexedNotes(), ...loadMemoryFiles()].map((n) => ({
    filePath: n.filePath,
    title: (n.frontmatter.title as string) || path.basename(n.filePath, ".md"),
    noteClass: n.noteClass,
    body: n.body,
  }));
  return refreshEmbeddings(notes, cfg, opts);
}

/**
 * Append one evidence row per retrieval to MEMORY/OBSERVABILITY/memory-retrievals.jsonl,
 * the log CortexHealth reads to answer "is recall actually running?". Without it
 * the memory system's own health check had no observation of its hot path and
 * reported `missing` forever (public issue #1848, @jaylarr176, @xmasyx,
 * @CarbonRaven, @DRAZY).
 *
 * The query is hashed, never stored: this file records that retrieval happened
 * and how it performed, and prompt text is not its business. Fail-open by
 * construction — an unwritable log must never take down per-turn recall.
 */
// CortexHealth reads the whole retrieval log on every health pass, so it must stay
// small. The log grows ~10KB/day with no cap; at 512KB keep only the newest 1000
// rows. Per-process tmp name + atomic rename, so a concurrent appender never sees
// a half-written file. (public PR #2023, @rathko)
const RETRIEVALS_LOG_MAX_BYTES = 512 * 1024;
const RETRIEVALS_LOG_KEEP_ROWS = 1000;

/** Truncate a JSONL log to its newest `keepRows` rows once it exceeds `maxBytes`. Returns true when rotated. */
export function rotateRetrievalLog(logPath: string, maxBytes = RETRIEVALS_LOG_MAX_BYTES, keepRows = RETRIEVALS_LOG_KEEP_ROWS): boolean {
  let size: number;
  try { size = fs.statSync(logPath).size; } catch { return false; } // absent: appendFileSync creates it
  if (size <= maxBytes) return false;
  const kept = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean).slice(-keepRows);
  invariant(kept.length <= keepRows, `rotation kept ${kept.length} rows, cap ${keepRows}`);
  const tmp = `${logPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, kept.join("\n") + "\n");
  fs.renameSync(tmp, logPath);
  return true;
}

function logRetrieval(query: string, returnedCount: number, durationMs: number): void {
  try {
    const dir = path.join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY");
    fs.mkdirSync(dir, { recursive: true });
    const logPath = path.join(dir, "memory-retrievals.jsonl");
    try { rotateRetrievalLog(logPath); } catch (err) {
      if (err instanceof InvariantViolation) throw err; // impossible state fails loud, never fail-open
      /* rotation is best-effort; the append below still lands */
    }
    const queryHash = createHash("sha256").update(query).digest("hex").slice(0, 12);
    const row = { ts: new Date().toISOString(), query_hash: queryHash, returned_count: returnedCount, duration_ms: durationMs };
    fs.appendFileSync(logPath, JSON.stringify(row) + "\n");
  } catch (err) {
    if (err instanceof InvariantViolation) throw err;
    // fail-open: retrieval already succeeded; losing its evidence row is not
    // worth failing the turn over.
  }
}

export interface RelevantContextOptions {
  topK?: number;
  threshold?: number;
  excerptChars?: number;
  typeFilter?: string;
  allowStaleIndex?: boolean;
}

function computeRelevantContext(query: string, options: RelevantContextOptions = {}): GetRelevantContextResult {
  const topK = options.topK ?? RELEVANT_DEFAULT_TOP_K;
  const threshold = options.threshold ?? RELEVANT_DEFAULT_THRESHOLD;
  const excerptChars = options.excerptChars ?? RELEVANT_EXCERPT_CHARS;
  const typeFilter = options.typeFilter;
  const allowStaleIndex = options.allowStaleIndex === true;

  // Cache check — key on query + options
  const cacheKey = JSON.stringify({ q: query.trim().toLowerCase(), topK, threshold, excerptChars, typeFilter, allowStaleIndex });
  const cached = relevantCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RELEVANT_CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const empty: GetRelevantContextResult = { results: [], markdownBlock: "", totalSearched: 0, cached: false };

  const queryTerms = retrievalTerms(query);
  if (queryTerms.length === 0) {
    relevantCache.set(cacheKey, { ts: Date.now(), result: empty });
    return empty;
  }

  const allNotes = corpusForQuery(queryTerms, allowStaleIndex);
  if (allNotes.length === 0) {
    relevantCache.set(cacheKey, { ts: Date.now(), result: { ...empty, totalSearched: 0 } });
    return empty;
  }

  const avgDocLength = allNotes.reduce((sum, n) => sum + n.wordCount, 0) / allNotes.length;

  let scored: ScoredNote[] = allNotes
    .map((note) => ({ note, score: scoreNote(note, queryTerms, avgDocLength) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);

  if (typeFilter) {
    scored = scored.filter((s) => (s.note.frontmatter.type ?? "unknown") === typeFilter);
  }

  // Index notes are scored without their bodies; read a body only for a hit that will be
  // injected. A hit whose file is gone (a stale index being served) gives way to the next one.
  const hits: ScoredNote[] = [];
  for (const s of scored) {
    if (hits.length >= topK) break;
    if (s.note.noteClass === "memory") { hits.push(s); continue; }
    const body = readBody(s.note.filePath);
    if (body !== null) hits.push({ note: { ...s.note, body }, score: s.score });
  }
  scored = hits;

  if (scored.length === 0) {
    const result = { ...empty, totalSearched: allNotes.length };
    relevantCache.set(cacheKey, { ts: Date.now(), result });
    return result;
  }

  const results: RelevantResultItem[] = scored.map(({ note, score }) => {
    const rawType = (note.frontmatter.type ?? "unknown") as string;
    const knownType: RelevantResultItem["type"] =
      rawType === "memory" || rawType === "idea" || rawType === "knowledge" ? rawType : "unknown";
    const title = (note.frontmatter.title as string) || path.basename(note.filePath, ".md");
    const excerpt = extractExcerpt(note, queryTerms).slice(0, excerptChars);
    return { type: knownType, noteClass: note.noteClass, path: note.filePath, title, score, excerpt };
  });

  const markdownBlock = formatRelevantBlock(results);
  const result: GetRelevantContextResult = { results, markdownBlock, totalSearched: allNotes.length, cached: false };
  relevantCache.set(cacheKey, { ts: Date.now(), result });
  return result;
}

/**
 * Format the results as a markdown block for prompt injection. Header is
 * `## RELEVANT MEMORY`; each item is a one-line header + indented excerpt.
 * Empty results → empty string (caller can decide whether to render header).
 */
function formatRelevantBlock(results: RelevantResultItem[]): string {
  if (results.length === 0) return "";
  const lines: string[] = ["## RELEVANT MEMORY"];
  for (const r of results) {
    const shortPath = r.path.replace(getClaudeDir() + "/", "");
    lines.push("");
    // A learning hit is labelled by class rather than by its (usually absent)
    // frontmatter type, so the injected block reads as a historical record
    // instead of an unlabelled "unknown" fact (public issue #1776, @umair-a11y).
    const label = r.noteClass === "learning" ? "learning · historical" : r.type;
    lines.push(`### [${label} · ${r.score.toFixed(1)}] ${r.title}`);
    lines.push(`<!-- ${shortPath} -->`);
    // Trim noisy whitespace and limit to roughly the excerpt budget
    const excerpt = r.excerpt.replace(/\n{3,}/g, "\n\n").trim();
    lines.push(excerpt);
  }
  return lines.join("\n");
}

/** Clear the retriever's query-level cache. Mostly for tests. */
export function clearRelevantCache(): void {
  relevantCache.clear();
}

// ============================================================================
// Help
// ============================================================================

function printHelp(): void {
  console.log(`
MemoryRetriever — Compressed context retrieval over LifeOS's knowledge archive

USAGE:
  bun MemoryRetriever.ts "query string"                    Search, return compressed results
  bun MemoryRetriever.ts "query string" --top 5            Return top 5 (default: 3)
  bun MemoryRetriever.ts "query string" --raw              Skip compression, return raw excerpts
  bun MemoryRetriever.ts "query string" --budget 800       Token budget for output (default: 500)
  bun MemoryRetriever.ts --help                            Show this help

OPTIONS:
  --top <N>       Number of results to return (default: ${DEFAULT_TOP})
  --raw           Skip LLM compression, return raw excerpts
  --budget <N>    Token budget for compressed output (default: ${DEFAULT_BUDGET})
  --help          Show this help message

SEARCH:
  BM25-style keyword matching + tag co-occurrence scoring.
  Searches MEMORY/KNOWLEDGE/{People,Companies,Ideas,Research}/*.md  [knowledge]
  and MEMORY/LEARNING/ recursively                                  [learning]
  Each hit is tagged with its class. Learning notes are historical records
  and score at ${LEARNING_SCORE_MULTIPLIER}x so curated knowledge outranks them on equal matches.

COMPRESSION:
  Uses Inference.ts (low level) for LLM-powered compression.
  --raw skips this step and returns raw excerpt text.

EXAMPLES:
  bun MemoryRetriever.ts "security policy stanford"
  bun MemoryRetriever.ts "agent architecture" --top 5 --raw
  bun MemoryRetriever.ts "ai consciousness" --budget 1000
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      top: { type: "string", short: "t" },
      raw: { type: "boolean", short: "r", default: false },
      budget: { type: "string", short: "b" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const query = positionals.join(" ").trim();
  if (!query) {
    console.error("Error: Query string required.\n");
    printHelp();
    process.exit(1);
  }

  const topN = values.top ? parseInt(values.top, 10) : DEFAULT_TOP;
  const raw = values.raw || false;
  const budget = values.budget ? parseInt(values.budget, 10) : DEFAULT_BUDGET;

  if (isNaN(topN) || topN < 1) {
    console.error("Error: --top must be a positive integer.");
    process.exit(1);
  }
  if (isNaN(budget) || budget < 50) {
    console.error("Error: --budget must be at least 50.");
    process.exit(1);
  }

  // Either corpus alone is a working install: KNOWLEDGE-only is the common case,
  // and LEARNING-only happens before the first knowledge note is written. Only
  // the absence of BOTH is a real misconfiguration (public issue #1776).
  if (!fs.existsSync(KNOWLEDGE_DIR) && !fs.existsSync(LEARNING_DIR)) {
    console.error(`Error: no memory corpus found. Looked for:\n  ${KNOWLEDGE_DIR}\n  ${LEARNING_DIR}`);
    process.exit(1);
  }

  // Discover all notes. The CLI searches the FULL LEARNING tree — unlike the
  // per-turn hot path, it is user-initiated and can afford the read.
  const notes = [...discoverNotes(), ...discoverLearningNotes()];
  if (notes.length === 0) {
    console.log(`No prior work found on "${query}" in the knowledge corpus.`);
    process.exit(0);
  }

  // Compute average document length for BM25
  const avgDocLength = notes.reduce((sum, n) => sum + n.wordCount, 0) / notes.length;

  // Tokenize query
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    console.error("Error: Query produced no searchable terms after tokenization.");
    process.exit(1);
  }

  // Score all notes
  const scored: ScoredNote[] = notes
    .map((note) => ({ note, score: scoreNote(note, queryTerms, avgDocLength) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (scored.length === 0) {
    console.log(`No prior work found on "${query}" in the knowledge corpus.`);
    process.exit(0);
  }

  // Extract excerpts
  const excerpts = scored.map((s) => extractExcerpt(s.note, queryTerms));

  // Compress or use raw excerpts
  let summaries: string[];
  if (raw) {
    summaries = excerpts;
  } else {
    const perNoteBudget = Math.max(50, Math.floor(budget / Math.max(scored.length, 1)));
    summaries = scored.map((_s, i) => compress(excerpts[i], perNoteBudget));
  }

  // Format and output
  const output = formatResults(query, scored, summaries, notes.length);
  console.log(output);
}

// ============================================================================
// Entry Point
// ============================================================================

if (import.meta.main) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
