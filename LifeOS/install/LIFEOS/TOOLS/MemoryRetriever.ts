#!/usr/bin/env bun
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
 *   No embeddings, no vector DB — pure markdown + YAML frontmatter.
 *
 * COMPRESSION:
 *   Uses Inference.ts low level for optional LLM compression of matched content.
 *   --raw flag skips compression and returns raw excerpts.
 *
 * STORAGE:
 *   Reads MEMORY/KNOWLEDGE/{People,Companies,Ideas,Research}/*.md
 *   NEVER writes or modifies files — read-only tool.
 *
 * ============================================================================
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

// ============================================================================
// Configuration
// ============================================================================

const HOME = process.env.HOME!;
const LIFEOS_DIR = process.env.LIFEOS_DIR || path.join(HOME, ".claude", "LIFEOS");
const KNOWLEDGE_DIR = path.join(LIFEOS_DIR, "MEMORY", "KNOWLEDGE");
const DOMAINS = ["People", "Companies", "Ideas", "Research"];

// BM25 parameters
const BM25_K1 = 1.5;
const BM25_B = 0.75;

// Scoring weights
const TITLE_MATCH_WEIGHT = 10;
const TAG_MATCH_WEIGHT = 5;
const RELATED_MATCH_WEIGHT = 3;

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

interface KnowledgeNote {
  filePath: string;
  frontmatter: Frontmatter;
  body: string;
  wordCount: number;
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
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value: string | string[] = line.substring(colonIdx + 1).trim();
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((s: string) => s.trim().replace(/['"]/g, ""));
      }
      result[key] = value;
    }
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

function discoverNotes(): KnowledgeNote[] {
  const notes: KnowledgeNote[] = [];

  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    const filePaths = walkMarkdown(domainDir);

    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(content);
        const wordCount = body.split(/\s+/).filter(Boolean).length;
        notes.push({ filePath, frontmatter, body, wordCount });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return notes;
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

function scoreNote(
  note: KnowledgeNote,
  queryTerms: string[],
  avgDocLength: number
): number {
  let score = 0;
  const titleLower = (note.frontmatter.title || "").toLowerCase();
  const bodyLower = note.body.toLowerCase();

  // Normalize tags to string array (frontmatter values are unknown at runtime)
  const rawTags = note.frontmatter.tags as unknown;
  const tags: string[] = Array.isArray(rawTags)
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
  const relatedSlugs = [
    ...related,
    ...wikiLinks.map((l: string) => l.replace(/\[\[|\]\]/g, "").toLowerCase()),
  ];

  for (const term of queryTerms) {
    // Title match: +10 per query term in title
    if (titleLower.includes(term)) {
      score += TITLE_MATCH_WEIGHT;
    }

    // Tag match: +5 per query term matching a tag.
    // Reverse containment (term ⊇ tag) requires tag length ≥ 4 — otherwise any
    // garbage term swallows short tags and the zero-hit absence path is unreachable.
    for (const tag of tags) {
      if (tag.includes(term) || (tag.length >= 4 && term.includes(tag))) {
        score += TAG_MATCH_WEIGHT;
        break; // One match per term per tag set
      }
    }

    // Related slug match: +3 per query term in related slugs
    for (const slug of relatedSlugs) {
      if (slug.includes(term)) {
        score += RELATED_MATCH_WEIGHT;
        break; // One match per term per related set
      }
    }

    // Content frequency: BM25-style scoring
    const termRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = bodyLower.match(termRegex);
    const tf = matches ? matches.length : 0;
    if (tf > 0) {
      score += computeBM25(tf, note.wordCount, avgDocLength);
    }
  }

  return score;
}

// ============================================================================
// Excerpt Extraction
// ============================================================================

function extractExcerpt(note: KnowledgeNote, queryTerms: string[]): string {
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

  let bestParagraph = paragraphs[0];
  let bestDensity = 0;

  for (const para of paragraphs) {
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
      bestParagraph = para;
    }
  }

  return bestParagraph.substring(0, MAX_EXCERPT_CHARS);
}

// ============================================================================
// LLM Compression via Inference.ts
// ============================================================================

// A compression call can exit 0 with non-empty output yet return the model's
// clarification/refusal instead of a summary (e.g. it treats the note as absent
// and answers "I need the actual note content to compress…"). Those bodies then
// masquerade as real summaries. These high-signal tells detect that case; the
// guard's failure mode is benign — it falls back to a raw excerpt.
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
    lines.push(`  Searched ${totalSearched} notes across ${DOMAINS.join(", ")}.`);
    return lines.join("\n");
  }

  for (let i = 0; i < results.length; i++) {
    const { note, score } = results[i];
    const title = note.frontmatter.title || path.basename(note.filePath, ".md");
    const type = note.frontmatter.type || "unknown";
    const summary = summaries[i];

    lines.push("");
    lines.push(`  [${title}] (type: ${type}, score: ${score.toFixed(1)})`);

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
  { path: path.join(HOME, ".claude", "LIFEOS", "USER", "PRINCIPAL", "PRINCIPAL_MEMORY.md"), title: "Principal Memory" },
  { path: path.join(HOME, ".claude", "LIFEOS", "USER", "DIGITAL_ASSISTANT", "DA_MEMORY.md"), title: "DA Memory" },
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
      });
    } catch {
      // Skip unreadable
    }
  }

  return notes;
}

/**
 * Discover ALL items in the typed-item corpus — KNOWLEDGE notes + memory
 * hot-layer files. Used by getRelevantContext().
 */
function discoverAllItems(): KnowledgeNote[] {
  return [...discoverNotes(), ...loadMemoryFiles()];
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
 */
export function getRelevantContext(
  query: string,
  options: { topK?: number; threshold?: number; excerptChars?: number; typeFilter?: string } = {},
): GetRelevantContextResult {
  const topK = options.topK ?? RELEVANT_DEFAULT_TOP_K;
  const threshold = options.threshold ?? RELEVANT_DEFAULT_THRESHOLD;
  const excerptChars = options.excerptChars ?? RELEVANT_EXCERPT_CHARS;
  const typeFilter = options.typeFilter;

  // Cache check — key on query + options
  const cacheKey = JSON.stringify({ q: query.trim().toLowerCase(), topK, threshold, excerptChars, typeFilter });
  const cached = relevantCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RELEVANT_CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const empty: GetRelevantContextResult = { results: [], markdownBlock: "", totalSearched: 0, cached: false };

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    relevantCache.set(cacheKey, { ts: Date.now(), result: empty });
    return empty;
  }

  const allNotes = discoverAllItems();
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

  scored = scored.slice(0, topK);

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
    return { type: knownType, path: note.filePath, title, score, excerpt };
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
    const shortPath = r.path.replace(HOME + "/.claude/", "");
    lines.push("");
    lines.push(`### [${r.type} · ${r.score.toFixed(1)}] ${r.title}`);
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
  Searches MEMORY/KNOWLEDGE/{People,Companies,Ideas,Research}/*.md

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

  // Verify KNOWLEDGE directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`Error: Knowledge directory not found: ${KNOWLEDGE_DIR}`);
    process.exit(1);
  }

  // Discover all notes
  const notes = discoverNotes();
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
