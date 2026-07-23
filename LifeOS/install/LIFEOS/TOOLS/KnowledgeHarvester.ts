#!/usr/bin/env bun
// Normalize env path vars Claude Code may inject unexpanded — literal $HOME/${HOME}
// in LIFEOS_DIR/LIFEOS_CONFIG_DIR/PROJECTS_DIR resolves to a shadow dir (#1404 / PR #1451, author jbmml).
for (const __k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const __v = process.env[__k];
  if (__v && /^\$\{?HOME\}?(\/|$)/.test(__v)) process.env[__k] = __v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

/**
 * KnowledgeHarvester — Harvest knowledge from LifeOS memory into KNOWLEDGE/
 *
 * Harvest STAGES candidates into KNOWLEDGE/_harvest-queue/<Domain>/ for review;
 * notes only enter KNOWLEDGE/<Domain>/ via an explicit `promote` (#1171/#1351).
 * Memory scanning is multi-instance: every ~/.claude/projects/<project>/memory
 * dir is covered, overridable via LIFEOS_AUTO_MEMORY_DIR (#1170).
 *
 * Commands:
 *   harvest              Stage candidates from all sources (auto-memory, WORK/, reflections, RESEARCH/)
 *   harvest --source X   Harvest from specific source (memory|work|reflections|research)
 *   harvest --dry-run    Preview without writing
 *   review               List staged notes pending review (read-only)
 *   promote <slug>       Promote staged note into KNOWLEDGE/ (--all for everything)
 *   reject <slug>        Delete staged note without promoting (--all for everything)
 *   status               Archive health dashboard
 *   index                Regenerate all MOC dashboards
 *   contradictions       Find note pairs with high tag overlap (candidates for semantic review)
 *
 * Examples:
 *   bun KnowledgeHarvester.ts harvest
 *   bun KnowledgeHarvester.ts harvest --source work --dry-run
 *   bun KnowledgeHarvester.ts review
 *   bun KnowledgeHarvester.ts promote Ideas/my-note
 *   bun KnowledgeHarvester.ts status
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ============================================================================
// Configuration
// ============================================================================

const HOME = process.env.HOME!;
const LIFEOS_DIR = process.env.LIFEOS_DIR || path.join(HOME, ".claude", "LIFEOS");
const MEMORY_DIR = path.join(LIFEOS_DIR, "MEMORY");
const KNOWLEDGE_DIR = path.join(MEMORY_DIR, "KNOWLEDGE");
const WORK_DIR = path.join(MEMORY_DIR, "WORK");
const LEARNING_DIR = path.join(MEMORY_DIR, "LEARNING");
const RESEARCH_DIR = path.join(MEMORY_DIR, "RESEARCH");
const HARVEST_QUEUE_DIR = path.join(KNOWLEDGE_DIR, "_harvest-queue");
const ARCHIVE_DIR = path.join(KNOWLEDGE_DIR, "_archive");

const PROJECTS_DIR = path.join(HOME, ".claude", "projects");

/**
 * Auto-memory dirs — multi-instance aware (#1170).
 * Override with LIFEOS_AUTO_MEMORY_DIR (colon-separated absolute paths).
 * Otherwise every ~/.claude/projects/<project>/memory dir is scanned, not just
 * the single hardcoded -Users-<user>--claude instance.
 */
function getAutoMemoryDirs(): Array<{ dir: string; project: string }> {
  const override = process.env.LIFEOS_AUTO_MEMORY_DIR;
  if (override) {
    return override.split(":").filter(Boolean).map(dir => ({
      dir,
      project: path.basename(path.dirname(dir)) || path.basename(dir),
    }));
  }
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const dirs: Array<{ dir: string; project: string }> = [];
  for (const entry of fs.readdirSync(PROJECTS_DIR)) {
    const memDir = path.join(PROJECTS_DIR, entry, "memory");
    try { if (!fs.statSync(memDir).isDirectory()) continue; } catch { continue; }
    dirs.push({ dir: memDir, project: entry });
  }
  return dirs;
}

/**
 * WORK roots — the central MEMORY/WORK plus any per-project
 * projects/<project>/memory/{WORK,MEMORY/WORK} trees (#1170).
 */
function getWorkRoots(): Array<{ dir: string; project: string | null }> {
  const roots: Array<{ dir: string; project: string | null }> = [{ dir: WORK_DIR, project: null }];
  for (const { dir, project } of getAutoMemoryDirs()) {
    for (const sub of ["WORK", path.join("MEMORY", "WORK")]) {
      const candidate = path.join(dir, sub);
      try { if (fs.statSync(candidate).isDirectory()) roots.push({ dir: candidate, project }); } catch { /* absent */ }
    }
  }
  return roots;
}

const HARVEST_STATE_FILE = path.join(KNOWLEDGE_DIR, ".harvest-state.json");
const REFLECTIONS_FILE = path.join(LEARNING_DIR, "REFLECTIONS", "algorithm-reflections.jsonl");
const RATINGS_FILE = path.join(LEARNING_DIR, "SIGNALS", "ratings.jsonl");

const MAX_NOTES_PER_HARVEST_DEFAULT = 5;
const MAX_NOTES_BACKFILL = 50;
const SEEDLING_EXPIRY_DAYS = 90;

const DOMAINS = ["People", "Companies", "Ideas", "Research"];

// Object type classification keywords
const TYPE_KEYWORDS: Record<string, string[]> = {
  People: ["osint", "person", "contact", "linkedin", "career", "background", "dossier", "profile", "biography"],
  Companies: ["company", "corporation", "startup", "organization", "acquired", "revenue", "employees", "founded"],
  Ideas: ["insight", "pattern", "thesis", "analysis", "framework", "discovery", "finding", "principle", "technique"],
  Research: ["research", "investigation", "multi-source", "extensive", "deep-dive", "methodology", "findings", "verified", "agents"],
};

// ============================================================================
// Types
// ============================================================================

interface HarvestState {
  lastHarvest: string;          // ISO timestamp
  harvestedPaths: string[];     // Source paths already harvested
  totalHarvested: number;
}

interface HarvestCandidate {
  sourcePath: string;
  title: string;
  content: string;
  domain: string;
  type: "person" | "company" | "idea" | "research";
  tags: string[];
  /** Project instance the candidate came from (multi-instance scan, #1170) */
  sourceProject?: string;
  /** Queue JSON file to remove AFTER the candidate is successfully staged (#1351) */
  queueFile?: string;
}

interface ArchiveStats {
  totalNotes: number;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  orphanLinks: string[];
  staleSeedlings: string[];
  lastHarvest: string | null;
}

// ============================================================================
// Harvest State Management
// ============================================================================

function loadHarvestState(): HarvestState {
  if (fs.existsSync(HARVEST_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(HARVEST_STATE_FILE, "utf-8"));
  }
  return { lastHarvest: "1970-01-01T00:00:00Z", harvestedPaths: [], totalHarvested: 0 };
}

function saveHarvestState(state: HarvestState): void {
  fs.writeFileSync(HARVEST_STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================================
// Source Scanners
// ============================================================================

function scanAutoMemory(state: HarvestState): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];

  for (const { dir, project } of getAutoMemoryDirs()) {
    let files: string[];
    try { files = fs.readdirSync(dir); } catch { continue; }

    for (const file of files) {
      if (file === "MEMORY.md" || !file.endsWith(".md")) continue;
      const filePath = path.join(dir, file);
      try { if (!fs.statSync(filePath).isFile()) continue; } catch { continue; }
      if (state.harvestedPaths.includes(filePath)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter.type || frontmatter.type === "feedback") continue; // Skip feedback — stays in auto-memory

      const domain = classifyDomain(content, frontmatter);
      // Map old types to new types or infer from domain
      const type = domain === "People" ? "person" as const :
                   domain === "Companies" ? "company" as const :
                   domain === "Research" ? "research" as const : "idea" as const;

      candidates.push({
        sourcePath: filePath,
        title: frontmatter.name || frontmatter.title || file.replace(/\.md$/, ""),
        content: content.replace(/^---[\s\S]*?---\n*/, ""), // Strip frontmatter
        domain,
        type,
        tags: extractTags(content),
        sourceProject: project,
      });
    }
  }
  return candidates;
}

function scanWorkISAs(state: HarvestState, backfillMode: boolean = false): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];

  for (const root of getWorkRoots()) {
    candidates.push(...scanWorkRoot(root.dir, root.project, state, backfillMode));
  }
  return candidates;
}

function scanWorkRoot(workRoot: string, project: string | null, state: HarvestState, backfillMode: boolean): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];
  if (!fs.existsSync(workRoot)) return candidates;

  // Get work directories sorted by name (timestamp-prefixed)
  const allWorkDirs = fs.readdirSync(workRoot)
    .filter(d => {
      try { return fs.statSync(path.join(workRoot, d)).isDirectory(); }
      catch { return false; }
    })
    .sort()
    .reverse();
  // In normal mode scan last 100, in backfill scan all
  const workDirs = backfillMode ? allWorkDirs : allWorkDirs.slice(0, 100);

  for (const dir of workDirs) {
    const isaPath = path.join(workRoot, dir, "ISA.md");
    if (!fs.existsSync(isaPath)) continue;
    if (state.harvestedPaths.includes(isaPath)) continue;

    const content = fs.readFileSync(isaPath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    // Quality filter: only harvest completed work
    if (frontmatter.phase !== "complete" && frontmatter.phase !== "learn") continue;

    // Check for explicit knowledge flags (legacy v3.16.0 ISAs — v3.17.0+ writes directly to KNOWLEDGE/)
    // Explicit flags bypass sentiment filtering — the Algorithm already decided this is worth archiving
    const knowledgeSection = extractSection(content, "Knowledge");
    if (knowledgeSection && !knowledgeSection.includes("SKIP")) {
      // Parse explicit flags: "- NEW technology/slug — description" or "- UPDATED domain/slug — description"
      const flagLines = knowledgeSection.split("\n").filter(l => /^- (NEW|UPDATED)\s/.test(l.trim()));
      for (const line of flagLines) {
        const match = line.match(/^- (?:NEW|UPDATED)\s+(\w+)\/(\S+)\s*[—-]\s*(.+)$/);
        if (match) {
          const [, flagDomain, slug, description] = match;
          const domainName = DOMAINS.find(d => d.toLowerCase() === flagDomain.toLowerCase()) || "Ideas";
          const flagKey = `${isaPath}:knowledge:${slug}`;
          if (state.harvestedPaths.includes(flagKey)) continue;
          candidates.push({
            sourcePath: flagKey,
            title: description.trim(),
            content: `Flagged by Algorithm LEARN phase.\n\n**Source ISA:** ${dir}\n**Task:** ${frontmatter.task || dir}\n\n${description}`,
            domain: domainName,
            type: "idea",
            tags: extractTags(content),
            sourceProject: project ?? undefined,
          });
        }
      }
      continue; // Explicit flags found — don't also scan Decisions/Verification
    }

    // No explicit flags — apply sentiment filter before falling back to section scanning
    const sentiment = getSentimentForSession(dir);
    if (sentiment !== null && sentiment < 7) continue;

    // Fallback: extract Decisions/Verification sections (pre-v3.16.0 ISAs)
    const decisions = extractSection(content, "Decisions");
    const verification = extractSection(content, "Verification");
    if (!decisions && !verification) continue; // Nothing worth archiving

    const domain = classifyDomain(content, frontmatter);
    candidates.push({
      sourcePath: isaPath,
      title: frontmatter.task || dir,
      content: [decisions, verification].filter(Boolean).join("\n\n"),
      domain,
      type: "idea",
      tags: extractTags(content),
      sourceProject: project ?? undefined,
    });
  }
  return candidates;
}

function scanReflections(_state: HarvestState): HarvestCandidate[] {
  // DISABLED: Algorithm reflections are task metrics, not knowledge.
  // They belong in LEARNING/REFLECTIONS/, not KNOWLEDGE/.
  // See _schema.md "What Does NOT Belong in KNOWLEDGE/" section.
  return [];
}

function scanResearch(state: HarvestState): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];
  if (!fs.existsSync(RESEARCH_DIR)) return candidates;

  // Walk RESEARCH/ recursively
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(fullPath); continue; }
      if (!entry.name.endsWith(".md")) continue;
      // Skip scaffolding: README, indexes, dashboards, underscore-prefixed files (#1351)
      if (/^(readme|index|_index|dashboard)\.md$/i.test(entry.name) || entry.name.startsWith("_")) continue;
      if (state.harvestedPaths.includes(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.length < 200) continue; // Skip stubs

      const fm = parseFrontmatter(content);
      if (fm.type === "moc" || fm.type === "dashboard" || fm.type === "index") continue; // Scaffolding, not knowledge

      const domain = classifyDomain(content, {});
      const type = domain === "People" ? "person" as const :
                   domain === "Companies" ? "company" as const : "idea" as const;
      candidates.push({
        sourcePath: fullPath,
        title: entry.name.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-\d{6}_/, "").replace(/_/g, " "),
        content: content.substring(0, 5000), // Cap content length
        domain,
        type,
        tags: extractTags(content),
      });
    }
  }
  walk(RESEARCH_DIR);
  return candidates;
}

function scanHarvestQueue(_state: HarvestState): HarvestCandidate[] {
  // Read-only scan (#1351): queue JSON candidates are no longer destroyed on
  // read. The file is unlinked only after its candidate is successfully staged
  // (see cmdHarvest), so a crash, dry-run, or per-run cap never loses input.
  const candidates: HarvestCandidate[] = [];
  if (!fs.existsSync(HARVEST_QUEUE_DIR)) return candidates;

  for (const file of fs.readdirSync(HARVEST_QUEUE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const queueFile = path.join(HARVEST_QUEUE_DIR, file);
    try {
      if (!fs.statSync(queueFile).isFile()) continue;
      const data = JSON.parse(fs.readFileSync(queueFile, "utf-8"));
      candidates.push({
        sourcePath: data.sourcePath || `queue:${file}`,
        title: data.title || file.replace(/\.json$/, ""),
        content: data.content || "",
        domain: data.domain || "Ideas",
        type: data.type || "reference",
        tags: data.tags || [],
        queueFile,
      });
    } catch { /* skip malformed */ }
  }
  return candidates;
}

// ============================================================================
// Classification & Extraction Helpers
// ============================================================================

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();
      // Handle simple arrays
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((s: string) => s.trim().replace(/['"]/g, "")) as any;
      }
      result[key] = value;
    }
  }
  return result;
}

/**
 * Word-boundary keyword match. Escapes regex metachars; hyphenated tokens like
 * "multi-source" / "deep-dive" keep their internal hyphen and are bounded by \b
 * on the outer alphanumerics. Replaces the substring `includes()` form that let
 * short tokens match inside unrelated words.
 */
function wordMatch(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(haystack);
}

function classifyDomain(content: string, frontmatter: Record<string, any>): string {
  const text = (content + " " + JSON.stringify(frontmatter)).toLowerCase();

  // Check frontmatter hints first
  if (frontmatter.domain) {
    const d = DOMAINS.find(d => d.toLowerCase() === String(frontmatter.domain).toLowerCase());
    if (d) return d;
  }
  // Explicit type field from frontmatter
  if (frontmatter.type === "person") return "People";
  if (frontmatter.type === "company") return "Companies";
  if (frontmatter.type === "idea") return "Ideas";
  // OSINT signals → People
  if (frontmatter.type === "reference" && frontmatter.name?.toLowerCase().includes("osint")) return "People";

  // Keyword scoring — word-boundary matches so a keyword like "career" doesn't
  // fire on "careerless" and short domain tokens don't match inside unrelated
  // words (the substring `text.includes(kw)` form over-matched the People domain).
  const scores: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(TYPE_KEYWORDS)) {
    scores[domain] = keywords.reduce((acc, kw) => acc + (wordMatch(text, kw) ? 1 : 0), 0);
  }
  // People over-matches on incidental tokens — one stray "profile"/"contact"
  // mention pulls unrelated notes into People. Require ≥2 People signals before
  // the domain can win.
  if (scores.People < 2) scores.People = 0;

  let bestDomain = "Ideas"; // Default — broadest type
  let bestScore = 0;
  for (const [domain, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; bestDomain = domain; }
  }
  return bestDomain;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  // Extract from frontmatter tags field
  const match = content.match(/^tags:\s*\[([^\]]*)\]/m);
  if (match) {
    for (const tag of match[1].split(",")) {
      const t = tag.trim().replace(/['"]/g, "").toLowerCase();
      if (t) tags.add(t);
    }
  }
  // Extract from content keywords — word-boundary matches (same over-match fix
  // as classifyDomain: a substring hit on a short token mis-tagged notes).
  const text = content.toLowerCase();
  for (const [, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.length > 3 && wordMatch(text, kw)) tags.add(kw);
    }
  }
  return [...tags].slice(0, 8); // Max 8 tags
}

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function getSentimentForSession(dirName: string): number | null {
  if (!fs.existsSync(RATINGS_FILE)) return null;
  // Extract timestamp from dir name: YYYYMMDD-HHMMSS_description
  // Match by session_id if available in ISA, otherwise by hour-level timestamp
  const dateTimePrefix = dirName.substring(0, 15); // YYYYMMDD-HHMMSS
  const dateFormatted = dateTimePrefix.replace(
    /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5"
  ); // "2026-04-01T22:30"
  const dateOnly = dateTimePrefix.substring(0, 8).replace(
    /(\d{4})(\d{2})(\d{2})/,
    "$1-$2-$3"
  ); // "2026-04-01"
  try {
    const lines = fs.readFileSync(RATINGS_FILE, "utf-8").trim().split("\n");
    // Check last 50 ratings — prefer minute-level match, fall back to averaging same-day
    const sameDayRatings: number[] = [];
    for (const line of lines.slice(-50).reverse()) {
      try {
        const entry = JSON.parse(line);
        const ts = entry.timestamp || "";
        const rating = entry.rating || entry.implied_sentiment;
        if (!rating) continue;
        // Minute-level match: most precise
        if (ts.includes(dateFormatted)) return rating;
        // Collect same-day ratings for averaging
        if (ts.includes(dateOnly)) sameDayRatings.push(rating);
      } catch { /* skip */ }
    }
    // No minute-level match — average same-day ratings instead of taking the worst one
    if (sameDayRatings.length > 0) {
      return Math.round(sameDayRatings.reduce((a, b) => a + b, 0) / sameDayRatings.length);
    }
  } catch { /* file read error */ }
  return null; // No rating found — allow harvest (don't filter)
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
}

function isDuplicate(candidate: HarvestCandidate, state: HarvestState): boolean {
  // Check source path dedup
  if (state.harvestedPaths.includes(candidate.sourcePath)) return true;

  // Check if a note with very similar title already exists — committed or staged
  const slug = toKebabCase(candidate.title);
  const committedPath = path.join(KNOWLEDGE_DIR, candidate.domain, `${slug}.md`);
  const stagedPath = path.join(HARVEST_QUEUE_DIR, candidate.domain, `${slug}.md`);
  return fs.existsSync(committedPath) || fs.existsSync(stagedPath);
}

// ============================================================================
// Note Staging (curation gate — #1171/#1351)
// ============================================================================

/**
 * Stage a harvested note into _harvest-queue/<Domain>/ for review.
 * Nothing lands in KNOWLEDGE/<Domain>/ until an explicit `promote`.
 */
function stageNote(candidate: HarvestCandidate): string {
  const slug = toKebabCase(candidate.title);
  const targetDir = path.join(HARVEST_QUEUE_DIR, candidate.domain);
  const targetPath = path.join(targetDir, `${slug}.md`);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const today = new Date().toISOString().split("T")[0];
  const tagsStr = candidate.tags.map(t => `${t}`).join(", ");
  const projectLine = candidate.sourceProject ? `\nsource_project: ${candidate.sourceProject}` : "";

  const note = `---
title: "${candidate.title.replace(/"/g, '\\"')}"
type: ${candidate.type}
domain: ${candidate.domain.toLowerCase()}
tags: [${tagsStr}]
created: ${today}
updated: ${today}
quality: 5
status: pending-review
harvested_from: ${candidate.sourcePath}${projectLine}
---

# ${candidate.title}

${candidate.content}
`;

  fs.writeFileSync(targetPath, note);
  return targetPath;
}

interface StagedNote {
  domain: string;
  slug: string;
  path: string;
  title: string;
  harvestedFrom: string;
  created: string;
}

function listStagedNotes(): StagedNote[] {
  const staged: StagedNote[] = [];
  if (!fs.existsSync(HARVEST_QUEUE_DIR)) return staged;

  for (const domain of DOMAINS) {
    const domainDir = path.join(HARVEST_QUEUE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;
    for (const file of fs.readdirSync(domainDir)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(domainDir, file);
      let fm: Record<string, any> = {};
      try { fm = parseFrontmatter(fs.readFileSync(filePath, "utf-8")); } catch { /* unreadable — still list it */ }
      staged.push({
        domain,
        slug: file.replace(/\.md$/, ""),
        path: filePath,
        title: fm.title || file.replace(/\.md$/, ""),
        harvestedFrom: fm.harvested_from || "unknown",
        created: fm.created || "unknown",
      });
    }
  }
  return staged;
}

/** Match staged notes by `slug` or `Domain/slug`; null target matches nothing. */
function matchStaged(staged: StagedNote[], target: string): StagedNote[] {
  const norm = target.replace(/\.md$/, "");
  if (norm.includes("/")) {
    const [domainPart, slugPart] = [norm.substring(0, norm.indexOf("/")), norm.substring(norm.indexOf("/") + 1)];
    return staged.filter(s => s.domain.toLowerCase() === domainPart.toLowerCase() && s.slug === slugPart);
  }
  return staged.filter(s => s.slug === norm);
}

// ============================================================================
// MOC Dashboard Generation
// ============================================================================

// Single-pass backlink index: read every note once and tally each [[target]] wikilink
// into a slug→count map. Replaces the former per-note `rg -c '[[slug'` scan that re-read
// the ENTIRE archive once per note — O(n²), heavy I/O and ~13min on a 6k-note archive.
// This is one O(n) sweep. Compute it ONCE per command run and pass into every
// regenerateMOC/expireStaleSeedlings call. Counts distinct source notes per target and
// matches exact targets (the old prefix match let [[foo]] wrongly count toward [[foo-bar]]).
function computeBacklinks(): Map<string, number> {
  const sources = new Map<string, Set<string>>(); // target slug -> set of source slugs
  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;
    for (const file of fs.readdirSync(domainDir)) {
      // Skip generated MOC/index files (_*.md) — they list every note as a [[link]] and
      // would inflate real note-to-note counts. Matches the ripple search's `!_*` glob.
      if (!file.endsWith(".md") || file.startsWith("_")) continue;
      const sourceSlug = file.replace(/\.md$/, "");
      const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
      for (const match of content.matchAll(/\[\[([^\]|#\n]+)/g)) {
        const target = match[1].trim();
        if (!target || target === sourceSlug) continue;
        if (!sources.has(target)) sources.set(target, new Set());
        sources.get(target)!.add(sourceSlug);
      }
    }
  }
  const counts = new Map<string, number>();
  for (const [target, srcs] of sources) counts.set(target, srcs.size);
  return counts;
}

function regenerateMOC(domain: string, backlinks: Map<string, number>): void {
  const domainDir = path.join(KNOWLEDGE_DIR, domain);
  if (!fs.existsSync(domainDir)) return;

  const notes: Array<{ slug: string; title: string; quality: number; tags: string[]; updated: string; backlinkCount: number }> = [];

  for (const file of fs.readdirSync(domainDir)) {
    if (file === "_index.md" || !file.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
    const fm = parseFrontmatter(content);
    const slug = file.replace(/\.md$/, "");

    // Backlink count from the single-pass index (O(1) lookup, was a per-note rg scan).
    const backlinkCount = backlinks.get(slug) ?? 0;

    notes.push({
      slug,
      title: fm.title || slug,
      quality: typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(fm.quality) : 5),
      tags: Array.isArray(fm.tags) ? fm.tags : (typeof fm.tags === "string" ? fm.tags.split(",").map((t: string) => t.trim()) : []),
      updated: fm.updated || fm.created || "unknown",
      backlinkCount,
    });
  }

  const today = new Date().toISOString().split("T")[0];

  // Build structured dashboard
  const sections: string[] = [];

  // Recently Updated
  const recent = [...notes].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 10);
  if (recent.length > 0) {
    sections.push("## Recently Updated");
    for (const n of recent) {
      sections.push(`- [[${n.slug}]] — ${n.title} (${n.updated})`);
    }
  }

  // Most Referenced
  const referenced = [...notes].filter(n => n.backlinkCount > 0).sort((a, b) => b.backlinkCount - a.backlinkCount).slice(0, 10);
  if (referenced.length > 0) {
    sections.push("\n## Most Referenced");
    for (const n of referenced) {
      sections.push(`- [[${n.slug}]] — Referenced by ${n.backlinkCount} note${n.backlinkCount !== 1 ? "s" : ""}`);
    }
  }

  // By Tag
  const tagMap = new Map<string, typeof notes>();
  for (const n of notes) {
    for (const tag of n.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(n);
    }
  }
  if (tagMap.size > 0) {
    sections.push("\n## By Tag");
    for (const [tag, tagNotes] of [...tagMap.entries()].sort()) {
      sections.push(`### ${tag}`);
      for (const n of tagNotes) {
        sections.push(`- [[${n.slug}]] — ${n.title}`);
      }
    }
  }

  // Low Quality (need development)
  const lowQuality = notes.filter(n => n.quality <= 3).sort((a, b) => a.quality - b.quality);
  sections.push("\n## Low Quality (need development)");
  if (lowQuality.length > 0) {
    for (const n of lowQuality) {
      sections.push(`- [[${n.slug}]] — ${n.title} (quality: ${n.quality}, ${n.updated})`);
    }
  } else {
    sections.push("- (none)");
  }

  const moc = `---
title: "${domain}"
type: moc
domain: ${domain.toLowerCase()}
updated: ${today}
---

# ${domain}

${sections.join("\n")}

---
*Auto-generated by KnowledgeHarvester. ${notes.length} note${notes.length !== 1 ? "s" : ""} in domain.*
`;

  fs.writeFileSync(path.join(domainDir, "_index.md"), moc);
}

function regenerateMasterMOC(): void {
  const today = new Date().toISOString().split("T")[0];
  const domainStats: Array<{ name: string; count: number }> = [];
  const recentNotes: Array<{ slug: string; domain: string; title: string; updated: string }> = [];

  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) { domainStats.push({ name: domain, count: 0 }); continue; }

    let count = 0;
    for (const file of fs.readdirSync(domainDir)) {
      if (file === "_index.md" || !file.endsWith(".md")) continue;
      count++;
      const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
      const fm = parseFrontmatter(content);
      recentNotes.push({
        slug: `${domain.toLowerCase()}/${file.replace(/\.md$/, "")}`,
        domain: domain.toLowerCase(),
        title: fm.title || file.replace(/\.md$/, ""),
        updated: fm.updated || fm.created || "unknown",
      });
    }
    domainStats.push({ name: domain, count });
  }

  const totalNotes = domainStats.reduce((acc, d) => acc + d.count, 0);
  const recent = recentNotes.sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 10);

  const state = loadHarvestState();

  const domainTable = domainStats.map(d =>
    `| [[${d.name.toLowerCase()}/_index\\|${d.name}]] | ${d.count} |`
  ).join("\n");

  const recentList = recent.map(n =>
    `- [[${n.slug}]] — ${n.title} (${n.updated})`
  ).join("\n");

  const moc = `---
title: "Knowledge Archive"
type: moc
domain: root
updated: ${today}
---

# Knowledge Archive

LifeOS's organized knowledge base. Harvested from work sessions, research, OSINT, and manual captures.

## Domains

| Domain | Notes |
|---|---|
${domainTable}

## Recently Updated
${recentList || "- (none yet)"}

## Archive Health
- **Total notes:** ${totalNotes}
- **Last harvest:** ${state.lastHarvest !== "1970-01-01T00:00:00Z" ? state.lastHarvest.split("T")[0] : "never"}
- **Total harvested:** ${state.totalHarvested}

---
*Schema: [[_schema]]*
`;

  fs.writeFileSync(path.join(KNOWLEDGE_DIR, "_index.md"), moc);
}

// ============================================================================
// Archive Health / Seedling Expiry
// ============================================================================

function getArchiveStats(): ArchiveStats {
  const stats: ArchiveStats = {
    totalNotes: 0,
    byDomain: {},
    byStatus: {},
    byType: {},
    orphanLinks: [],
    staleSeedlings: [],
    lastHarvest: null,
  };

  const state = loadHarvestState();
  stats.lastHarvest = state.lastHarvest !== "1970-01-01T00:00:00Z" ? state.lastHarvest : null;

  const allSlugs = new Set<string>();
  const allLinks = new Set<string>();

  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;
    stats.byDomain[domain] = 0;

    for (const file of fs.readdirSync(domainDir)) {
      if (file === "_index.md" || !file.endsWith(".md")) continue;
      stats.totalNotes++;
      stats.byDomain[domain]++;

      const slug = file.replace(/\.md$/, "");
      allSlugs.add(slug);
      allSlugs.add(`${domain.toLowerCase()}/${slug}`);

      const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
      const fm = parseFrontmatter(content);

      const quality = typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(fm.quality) : 5);
      const qualityBucket = quality <= 3 ? "low (0-3)" : quality <= 6 ? "medium (4-6)" : "high (7-10)";
      stats.byStatus[qualityBucket] = (stats.byStatus[qualityBucket] || 0) + 1;

      const type = fm.type || "reference";
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Collect wikilinks
      const links = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      for (const match of links) {
        allLinks.add(match[1]);
      }

      // Check stale low-quality notes
      if (quality <= 2 && fm.created) {
        const created = new Date(fm.created);
        const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > SEEDLING_EXPIRY_DAYS) {
          stats.staleSeedlings.push(`${domain}/${slug}`);
        }
      }
    }
  }

  // Find orphan links
  for (const link of allLinks) {
    const normalized = link.toLowerCase().replace(/\//g, "/");
    if (!allSlugs.has(normalized) && !link.includes("_index") && !link.includes("_schema") && !link.includes("kebab-case")) {
      stats.orphanLinks.push(link);
    }
  }

  return stats;
}

function expireStaleSeedlings(backlinks: Map<string, number>): string[] {
  const expired: string[] = [];
  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;

    for (const file of fs.readdirSync(domainDir)) {
      if (file === "_index.md" || !file.endsWith(".md")) continue;
      const filePath = path.join(domainDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);

      const quality = typeof fm.quality === "number" ? fm.quality : (fm.quality ? parseInt(fm.quality) : 5);
      if (quality > 2 || !fm.created) continue;
      const daysSince = (Date.now() - new Date(fm.created).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= SEEDLING_EXPIRY_DAYS) continue;

      // Check for inbound references via the single-pass index (was a per-note rg scan).
      const slug = file.replace(/\.md$/, "");
      if ((backlinks.get(slug) ?? 0) > 0) continue; // Has references, don't expire

      // Move to archive
      const archivePath = path.join(ARCHIVE_DIR, file);
      if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
      fs.renameSync(filePath, archivePath);
      expired.push(`${domain}/${file}`);
    }
  }
  return expired;
}

// ============================================================================
// Commands
// ============================================================================

function cmdHarvest(sourceFilter: string | null, dryRun: boolean, maxNotes: number = MAX_NOTES_PER_HARVEST_DEFAULT): void {
  const state = loadHarvestState();
  let allCandidates: HarvestCandidate[] = [];

  console.log("🌾 Knowledge Harvester");
  console.log("─".repeat(40));

  // Collect candidates from each source
  if (!sourceFilter || sourceFilter === "memory") {
    const memCandidates = scanAutoMemory(state);
    console.log(`  Auto-memory: ${memCandidates.length} candidates`);
    allCandidates.push(...memCandidates);
  }

  if (!sourceFilter || sourceFilter === "work") {
    const isBackfill = maxNotes > MAX_NOTES_PER_HARVEST_DEFAULT;
    const workCandidates = scanWorkISAs(state, isBackfill);
    console.log(`  WORK/ ISAs: ${workCandidates.length} candidates`);
    allCandidates.push(...workCandidates);
  }

  if (!sourceFilter || sourceFilter === "reflections") {
    const refCandidates = scanReflections(state);
    console.log(`  Reflections: ${refCandidates.length} candidates`);
    allCandidates.push(...refCandidates);
  }

  if (!sourceFilter || sourceFilter === "research") {
    const resCandidates = scanResearch(state);
    console.log(`  RESEARCH/: ${resCandidates.length} candidates`);
    allCandidates.push(...resCandidates);
  }

  // Always check harvest queue
  const queueCandidates = scanHarvestQueue(state);
  if (queueCandidates.length > 0) {
    console.log(`  Queue: ${queueCandidates.length} candidates`);
    allCandidates.push(...queueCandidates);
  }

  // Deduplicate
  allCandidates = allCandidates.filter(c => !isDuplicate(c, state));
  console.log(`\n  After dedup: ${allCandidates.length} candidates`);

  // Cap at max per harvest
  const toHarvest = allCandidates.slice(0, maxNotes);
  console.log(`  Harvesting: ${toHarvest.length} (max ${maxNotes}/run)\n`);

  if (toHarvest.length === 0) {
    console.log("  Nothing to harvest.");
    return;
  }

  for (const candidate of toHarvest) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would stage: _harvest-queue/${candidate.domain}/${toKebabCase(candidate.title)}.md`);
      console.log(`            Title: ${candidate.title}`);
      console.log(`            Type: ${candidate.type} | Tags: ${candidate.tags.join(", ")}`);
      console.log();
    } else {
      const stagedPath = stageNote(candidate);
      state.harvestedPaths.push(candidate.sourcePath);
      // Queue JSON is only removed once its content is safely staged (#1351)
      if (candidate.queueFile) {
        try { fs.unlinkSync(candidate.queueFile); } catch { /* already gone */ }
      }
      console.log(`  📥 staged: ${path.relative(KNOWLEDGE_DIR, stagedPath)}`);
    }
  }

  if (!dryRun) {
    // Expire stale seedlings in the committed archive
    const backlinks = computeBacklinks();
    const expired = expireStaleSeedlings(backlinks);
    if (expired.length > 0) {
      console.log(`\n  📦 Archived ${expired.length} stale low-quality note(s):`);
      for (const e of expired) console.log(`     ${e}`);
      regenerateMasterMOC();
    }

    // Save state
    state.lastHarvest = new Date().toISOString();
    saveHarvestState(state);
    console.log(`\n  ✅ Harvest complete. ${toHarvest.length} note(s) staged to _harvest-queue/.`);
    console.log("  Review with `review`, then `promote <slug>` (or `promote --all`) / `reject <slug>`.");
  }
}

function cmdReview(): void {
  const staged = listStagedNotes();
  console.log("🗂  Harvest Queue — pending review");
  console.log("─".repeat(40));
  if (staged.length === 0) {
    console.log("  Queue is empty. Nothing pending review.");
    return;
  }
  for (const s of staged) {
    console.log(`  ${s.domain}/${s.slug}`);
    console.log(`    Title: ${s.title}`);
    console.log(`    From:  ${s.harvestedFrom} (${s.created})`);
  }
  console.log(`\n  ${staged.length} note(s) pending. Promote with \`promote <slug>\` or \`promote --all\`; reject with \`reject <slug>\`.`);
}

function cmdPromote(target: string | null, all: boolean): void {
  const staged = listStagedNotes();
  const toPromote = all ? staged : target ? matchStaged(staged, target) : [];

  if (!all && !target) {
    console.error("Usage: promote <slug|Domain/slug> or promote --all");
    process.exit(1);
  }
  if (toPromote.length === 0) {
    console.error(all ? "Queue is empty — nothing to promote." : `No staged note matches "${target}". Run \`review\` to list the queue.`);
    process.exit(1);
  }
  if (!all && toPromote.length > 1) {
    console.error(`"${target}" is ambiguous — matches: ${toPromote.map(s => `${s.domain}/${s.slug}`).join(", ")}. Use Domain/slug.`);
    process.exit(1);
  }

  const state = loadHarvestState();
  const affectedDomains = new Set<string>();

  for (const s of toPromote) {
    const targetDir = path.join(KNOWLEDGE_DIR, s.domain);
    const targetPath = path.join(targetDir, `${s.slug}.md`);
    if (fs.existsSync(targetPath)) {
      console.log(`  ⚠️  skipped ${s.domain}/${s.slug} — already exists in KNOWLEDGE/ (reject or rename the staged copy)`);
      continue;
    }
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    // Drop the pending-review marker; harvested_from provenance stays
    const content = fs.readFileSync(s.path, "utf-8").replace(/^status: pending-review\n/m, "");
    fs.writeFileSync(targetPath, content);
    fs.unlinkSync(s.path);
    state.totalHarvested++;
    affectedDomains.add(s.domain);
    console.log(`  ✅ promoted: ${s.domain}/${s.slug}.md`);
  }

  if (affectedDomains.size > 0) {
    console.log("\n  📑 Regenerating MOCs...");
    const backlinks = computeBacklinks();
    for (const domain of affectedDomains) {
      regenerateMOC(domain, backlinks);
      console.log(`     ${domain}/_index.md`);
    }
    regenerateMasterMOC();
    console.log("     _index.md (master)");
    saveHarvestState(state);
  }
}

function cmdReject(target: string | null, all: boolean): void {
  const staged = listStagedNotes();
  const toReject = all ? staged : target ? matchStaged(staged, target) : [];

  if (!all && !target) {
    console.error("Usage: reject <slug|Domain/slug> or reject --all");
    process.exit(1);
  }
  if (toReject.length === 0) {
    console.error(all ? "Queue is empty — nothing to reject." : `No staged note matches "${target}". Run \`review\` to list the queue.`);
    process.exit(1);
  }
  if (!all && toReject.length > 1) {
    console.error(`"${target}" is ambiguous — matches: ${toReject.map(s => `${s.domain}/${s.slug}`).join(", ")}. Use Domain/slug.`);
    process.exit(1);
  }

  for (const s of toReject) {
    fs.unlinkSync(s.path);
    console.log(`  🗑  rejected: ${s.domain}/${s.slug}.md`);
  }
  // Note: harvestedPaths keeps the source entry, so rejected content is not re-staged next run.
}

function cmdStatus(): void {
  const stats = getArchiveStats();

  console.log("📊 Knowledge Archive Status");
  console.log("─".repeat(40));
  console.log(`  Total notes: ${stats.totalNotes}`);
  console.log(`  Last harvest: ${stats.lastHarvest || "never"}`);
  console.log();

  console.log("  By Domain:");
  for (const [domain, count] of Object.entries(stats.byDomain)) {
    if (count > 0) console.log(`    ${domain}: ${count}`);
  }
  console.log();

  console.log("  By Quality:");
  for (const [bucket, count] of Object.entries(stats.byStatus)) {
    console.log(`    ${bucket}: ${count}`);
  }
  console.log();

  console.log("  By Type:");
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`    ${type}: ${count}`);
  }

  if (stats.orphanLinks.length > 0) {
    console.log(`\n  ⚠️  Orphan links (${stats.orphanLinks.length}):`);
    for (const link of stats.orphanLinks.slice(0, 10)) {
      console.log(`    [[${link}]]`);
    }
    if (stats.orphanLinks.length > 10) console.log(`    ... and ${stats.orphanLinks.length - 10} more`);
  }

  if (stats.staleSeedlings.length > 0) {
    console.log(`\n  🥀 Stale low-quality notes (>${SEEDLING_EXPIRY_DAYS} days, quality ≤2):`);
    for (const s of stats.staleSeedlings) {
      console.log(`    ${s}`);
    }
  }
}

// Check if two temporal validity windows overlap
function temporalWindowsOverlap(fmA: Record<string, any>, fmB: Record<string, any>): boolean {
  const aFrom = fmA.valid_from ? new Date(fmA.valid_from).getTime() : 0;
  const aUntil = fmA.valid_until ? new Date(fmA.valid_until).getTime() : Infinity;
  const bFrom = fmB.valid_from ? new Date(fmB.valid_from).getTime() : 0;
  const bUntil = fmB.valid_until ? new Date(fmB.valid_until).getTime() : Infinity;

  // No overlap if one ends before the other starts
  return aFrom <= bUntil && bFrom <= aUntil;
}

function cmdContradictions(): void {
  console.log("🔍 Contradiction Candidates");
  console.log("─".repeat(40));
  console.log("  Finding note pairs with high tag overlap...\n");

  // Collect all notes with their tags and temporal fields
  const notes: Array<{ slug: string; domain: string; title: string; tags: string[]; path: string; fm: Record<string, any> }> = [];

  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;

    for (const file of fs.readdirSync(domainDir)) {
      if (file === "_index.md" || !file.endsWith(".md")) continue;
      const filePath = path.join(domainDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      const tags = Array.isArray(fm.tags)
        ? fm.tags.map((t: string) => t.trim().toLowerCase())
        : typeof fm.tags === "string"
          ? fm.tags.split(",").map((t: string) => t.trim().replace(/['"]/g, "").toLowerCase())
          : [];

      if (tags.length === 0) continue;

      notes.push({
        slug: file.replace(/\.md$/, ""),
        domain,
        title: fm.title || file.replace(/\.md$/, ""),
        tags,
        path: filePath,
        fm,
      });
    }
  }

  // Find pairs with 2+ shared tags
  const pairs: Array<{ noteA: typeof notes[0]; noteB: typeof notes[0]; shared: string[]; temporalSkip: boolean }> = [];
  let temporalSkipped = 0;

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const shared = notes[i].tags.filter(t => notes[j].tags.includes(t));
      if (shared.length >= 2) {
        // Check temporal validity — skip pairs with non-overlapping windows
        const hasTemporalData = notes[i].fm.valid_from || notes[i].fm.valid_until ||
                                notes[j].fm.valid_from || notes[j].fm.valid_until;
        const temporalSkip = hasTemporalData && !temporalWindowsOverlap(notes[i].fm, notes[j].fm);

        if (temporalSkip) {
          temporalSkipped++;
        } else {
          pairs.push({ noteA: notes[i], noteB: notes[j], shared, temporalSkip: false });
        }
      }
    }
  }

  // Sort by overlap count (most shared tags first)
  pairs.sort((a, b) => b.shared.length - a.shared.length);

  if (pairs.length === 0) {
    console.log("  No note pairs with 2+ shared tags found.");
    if (temporalSkipped > 0) {
      console.log(`  (${temporalSkipped} pair(s) skipped — non-overlapping temporal validity windows)`);
    }
    console.log("  Archive is clean or notes need more tags.");
    return;
  }

  console.log(`  Found ${pairs.length} pair(s) with 2+ shared tags:\n`);
  if (temporalSkipped > 0) {
    console.log(`  ⏰ ${temporalSkipped} pair(s) skipped (non-overlapping temporal windows)\n`);
  }

  for (const pair of pairs.slice(0, 20)) {
    console.log(`  📋 ${pair.shared.length} shared tags: [${pair.shared.join(", ")}]`);
    console.log(`     A: ${pair.noteA.domain}/${pair.noteA.slug} — "${pair.noteA.title}"`);
    if (pair.noteA.fm.valid_from || pair.noteA.fm.valid_until) {
      console.log(`        ⏰ valid: ${pair.noteA.fm.valid_from || "?"} → ${pair.noteA.fm.valid_until || "present"}`);
    }
    console.log(`     B: ${pair.noteB.domain}/${pair.noteB.slug} — "${pair.noteB.title}"`);
    if (pair.noteB.fm.valid_from || pair.noteB.fm.valid_until) {
      console.log(`        ⏰ valid: ${pair.noteB.fm.valid_from || "?"} → ${pair.noteB.fm.valid_until || "present"}`);
    }
    console.log();
  }

  if (pairs.length > 20) {
    console.log(`  ... and ${pairs.length - 20} more pairs.`);
  }

  console.log("  Run `/knowledge contradictions` in Claude Code for semantic review.");
}

function cmdIndex(): void {
  console.log("📑 Regenerating all MOC dashboards...");
  const backlinks = computeBacklinks();
  for (const domain of DOMAINS) {
    regenerateMOC(domain, backlinks);
    console.log(`  ${domain}/_index.md`);
  }
  regenerateMasterMOC();
  console.log("  _index.md (master)");
  console.log("\n  ✅ Done.");
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    source: { type: "string", short: "s" },
    "dry-run": { type: "boolean" },
    backfill: { type: "boolean" },
    limit: { type: "string", short: "n" },
    all: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0] || "status";

if (values.help) {
  console.log(`
KnowledgeHarvester — Harvest knowledge from LifeOS memory into KNOWLEDGE/

Harvest stages candidates to KNOWLEDGE/_harvest-queue/<Domain>/ for curation;
nothing enters KNOWLEDGE/<Domain>/ until an explicit promote.

Commands:
  harvest              Stage candidates from all sources into _harvest-queue/
  harvest --source X   Harvest from: memory, work, reflections, research
  harvest --dry-run    Preview without writing
  review               List staged notes pending review (read-only)
  promote <slug>       Promote a staged note into KNOWLEDGE/ (--all for everything)
  reject <slug>        Delete a staged note without promoting (--all for everything)
  status               Archive health dashboard
  index                Regenerate all MOC dashboards
  contradictions       Find note pairs with high tag overlap for semantic review

Env:
  LIFEOS_AUTO_MEMORY_DIR   Colon-separated memory dirs to scan (default: all
                           ~/.claude/projects/*/memory instances)

Examples:
  bun KnowledgeHarvester.ts harvest
  bun KnowledgeHarvester.ts harvest --source work --dry-run
  bun KnowledgeHarvester.ts review
  bun KnowledgeHarvester.ts promote Ideas/my-note
  bun KnowledgeHarvester.ts reject my-note
  bun KnowledgeHarvester.ts status
`);
  process.exit(0);
}

switch (command) {
  case "harvest": {
    const limit = values.backfill ? MAX_NOTES_BACKFILL :
                  values.limit ? parseInt(values.limit as string) :
                  MAX_NOTES_PER_HARVEST_DEFAULT;
    cmdHarvest(values.source as string | null ?? null, !!values["dry-run"], limit);
    break;
  }
  case "review":
    cmdReview();
    break;
  case "promote":
    cmdPromote(positionals[1] ?? null, !!values.all);
    break;
  case "reject":
    cmdReject(positionals[1] ?? null, !!values.all);
    break;
  case "status":
    cmdStatus();
    break;
  case "index":
    cmdIndex();
    break;
  case "contradictions":
    cmdContradictions();
    break;
  default:
    console.error(`Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
}
