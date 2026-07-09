#!/usr/bin/env bun
/**
 * KnowledgeHarvester — Harvest knowledge from LifeOS memory into KNOWLEDGE/
 *
 * Commands:
 *   harvest              Harvest from all sources (auto-memory, WORK/, reflections, RESEARCH/)
 *   harvest --source X   Harvest from specific source (memory|work|reflections|research)
 *   harvest --dry-run    Preview without writing
 *   status               Archive health dashboard
 *   index                Regenerate all MOC dashboards
 *   contradictions       Find note pairs with high tag overlap (candidates for semantic review)
 *
 * Examples:
 *   bun KnowledgeHarvester.ts harvest
 *   bun KnowledgeHarvester.ts harvest --source work --dry-run
 *   bun KnowledgeHarvester.ts status
 *   bun KnowledgeHarvester.ts index
 *   bun KnowledgeHarvester.ts contradictions
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

const CURRENT_USER = process.env.USER;
if (!CURRENT_USER) {
  console.error("KnowledgeHarvester: USER env var is required to locate auto-memory dir");
  process.exit(1);
}
const AUTO_MEMORY_DIR = path.join(HOME, ".claude", "projects",
  `-Users-${CURRENT_USER}--claude`, "memory");

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
  if (!fs.existsSync(AUTO_MEMORY_DIR)) return candidates;

  for (const file of fs.readdirSync(AUTO_MEMORY_DIR)) {
    if (file === "MEMORY.md" || !file.endsWith(".md")) continue;
    const filePath = path.join(AUTO_MEMORY_DIR, file);
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
    });
  }
  return candidates;
}

function scanWorkISAs(state: HarvestState, backfillMode: boolean = false): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];
  if (!fs.existsSync(WORK_DIR)) return candidates;

  // Get work directories sorted by name (timestamp-prefixed)
  const allWorkDirs = fs.readdirSync(WORK_DIR)
    .filter(d => {
      try { return fs.statSync(path.join(WORK_DIR, d)).isDirectory(); }
      catch { return false; }
    })
    .sort()
    .reverse();
  // In normal mode scan last 100, in backfill scan all
  const workDirs = backfillMode ? allWorkDirs : allWorkDirs.slice(0, 100);

  for (const dir of workDirs) {
    const isaPath = path.join(WORK_DIR, dir, "ISA.md");
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
      if (state.harvestedPaths.includes(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.length < 200) continue; // Skip stubs

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

function scanHarvestQueue(state: HarvestState): HarvestCandidate[] {
  const candidates: HarvestCandidate[] = [];
  if (!fs.existsSync(HARVEST_QUEUE_DIR)) return candidates;

  for (const file of fs.readdirSync(HARVEST_QUEUE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(HARVEST_QUEUE_DIR, file), "utf-8"));
      candidates.push({
        sourcePath: data.sourcePath || `queue:${file}`,
        title: data.title || file.replace(/\.json$/, ""),
        content: data.content || "",
        domain: data.domain || "Ideas",
        type: data.type || "reference",
        tags: data.tags || [],
      });
      // Remove queue file after processing
      fs.unlinkSync(path.join(HARVEST_QUEUE_DIR, file));
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

  // Keyword scoring
  let bestDomain = "Ideas"; // Default — broadest type
  let bestScore = 0;
  for (const [domain, keywords] of Object.entries(TYPE_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
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
  // Extract from content keywords
  const text = content.toLowerCase();
  for (const [, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw) && kw.length > 3) tags.add(kw);
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

  // Check if a note with very similar title already exists
  const slug = toKebabCase(candidate.title);
  const targetPath = path.join(KNOWLEDGE_DIR, candidate.domain, `${slug}.md`);
  return fs.existsSync(targetPath);
}

// ============================================================================
// Note Writing
// ============================================================================

function writeNote(candidate: HarvestCandidate): string {
  const slug = toKebabCase(candidate.title);
  const targetDir = path.join(KNOWLEDGE_DIR, candidate.domain);
  const targetPath = path.join(targetDir, `${slug}.md`);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const today = new Date().toISOString().split("T")[0];
  const tagsStr = candidate.tags.map(t => `${t}`).join(", ");

  const note = `---
title: "${candidate.title.replace(/"/g, '\\"')}"
type: ${candidate.type}
domain: ${candidate.domain.toLowerCase()}
tags: [${tagsStr}]
created: ${today}
updated: ${today}
quality: 5
harvested_from: ${candidate.sourcePath}
---

# ${candidate.title}

${candidate.content}
`;

  fs.writeFileSync(targetPath, note);
  return targetPath;
}

// ============================================================================
// MOC Dashboard Generation
// ============================================================================

function regenerateMOC(domain: string): void {
  const domainDir = path.join(KNOWLEDGE_DIR, domain);
  if (!fs.existsSync(domainDir)) return;

  const notes: Array<{ slug: string; title: string; quality: number; tags: string[]; updated: string; backlinkCount: number }> = [];

  for (const file of fs.readdirSync(domainDir)) {
    if (file === "_index.md" || !file.endsWith(".md")) continue;
    const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
    const fm = parseFrontmatter(content);
    const slug = file.replace(/\.md$/, "");

    // Count backlinks across all KNOWLEDGE/ files
    let backlinkCount = 0;
    try {
      const { execSync } = require("child_process");
      const result = execSync(`rg -c '\\[\\[${slug}' "${KNOWLEDGE_DIR}" 2>/dev/null || echo "0"`, { encoding: "utf-8" });
      backlinkCount = result.split("\n").reduce((acc: number, line: string) => {
        const match = line.match(/:(\d+)$/);
        return acc + (match ? parseInt(match[1]) : 0);
      }, 0);
    } catch { /* rg not available or no matches */ }

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

function expireStaleSeedlings(): string[] {
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

      // Check for inbound references
      try {
        const slug = file.replace(/\.md$/, "");
        const { execSync } = require("child_process");
        const result = execSync(`rg -c '\\[\\[${slug}' "${KNOWLEDGE_DIR}" 2>/dev/null || echo ""`, { encoding: "utf-8" });
        const totalRefs = result.split("\n").reduce((acc: number, line: string) => {
          const match = line.match(/:(\d+)$/);
          return acc + (match ? parseInt(match[1]) : 0);
        }, 0);
        if (totalRefs > 0) continue; // Has references, don't expire
      } catch { /* rg failed, be conservative — don't expire */ continue; }

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

  const affectedDomains = new Set<string>();

  for (const candidate of toHarvest) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would write: ${candidate.domain}/${toKebabCase(candidate.title)}.md`);
      console.log(`            Title: ${candidate.title}`);
      console.log(`            Type: ${candidate.type} | Tags: ${candidate.tags.join(", ")}`);
      console.log();
    } else {
      const writtenPath = writeNote(candidate);
      state.harvestedPaths.push(candidate.sourcePath);
      state.totalHarvested++;
      affectedDomains.add(candidate.domain);
      console.log(`  ✅ ${path.relative(KNOWLEDGE_DIR, writtenPath)}`);
    }
  }

  if (!dryRun) {
    // Expire stale seedlings
    const expired = expireStaleSeedlings();
    if (expired.length > 0) {
      console.log(`\n  📦 Archived ${expired.length} stale low-quality note(s):`);
      for (const e of expired) console.log(`     ${e}`);
    }

    // Regenerate affected MOCs
    console.log("\n  📑 Regenerating MOCs...");
    for (const domain of affectedDomains) {
      regenerateMOC(domain);
      console.log(`     ${domain}/_index.md`);
    }
    regenerateMasterMOC();
    console.log("     _index.md (master)");

    // Save state
    state.lastHarvest = new Date().toISOString();
    saveHarvestState(state);
    console.log(`\n  ✅ Harvest complete. ${toHarvest.length} note(s) written.`);
  }
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
  for (const domain of DOMAINS) {
    regenerateMOC(domain);
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
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: false,
});

const command = positionals[0] || "status";

if (values.help) {
  console.log(`
KnowledgeHarvester — Harvest knowledge from LifeOS memory into KNOWLEDGE/

Commands:
  harvest              Harvest from all sources
  harvest --source X   Harvest from: memory, work, reflections, research
  harvest --dry-run    Preview without writing
  status               Archive health dashboard
  index                Regenerate all MOC dashboards
  contradictions       Find note pairs with high tag overlap for semantic review

Examples:
  bun KnowledgeHarvester.ts harvest
  bun KnowledgeHarvester.ts harvest --source work --dry-run
  bun KnowledgeHarvester.ts status
  bun KnowledgeHarvester.ts contradictions
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
