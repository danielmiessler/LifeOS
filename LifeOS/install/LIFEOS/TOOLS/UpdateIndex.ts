#!/usr/bin/env bun
/**
 * @version 1.0.4
 * UpdateIndex - Regenerate index.json and CHANGELOG.md from update files
 *
 * Usage:
 *   bun UpdateIndex.ts regenerate    # Scan all files and regenerate index
 *   bun UpdateIndex.ts validate      # Check index matches files
 *
 * Lives in LIFEOS/TOOLS (not in release-only tooling) so the Ledger's derived
 * views have a producer on every install; CreateUpdate.ts calls regenerate()
 * after each registry write. public issue #1954, @pybe
 */

import { readdir, readFile, stat, mkdir } from "fs/promises";
import { join, basename, dirname } from "path";
import { parse as parseYaml } from "yaml";
import { getLifeosDir } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { assertSafeDestination, writeFileNoFollow } from "./lib/NoFollowWrite";
import { rootRelativeKey } from "../../hooks/lib/portable-path";

const LIFEOS_DIR = getLifeosDir();
const UPDATES_DIR = join(LIFEOS_DIR, "MEMORY/SYSTEMUPDATES");
const INDEX_PATH = join(UPDATES_DIR, "index.json");
const CHANGELOG_PATH = join(UPDATES_DIR, "CHANGELOG.md");
// LIFEOS_DIR already IS .../LIFEOS — the old doubled "LIFEOS/" prefix (and the ~/.claude
// fallback above) 404'd every RECENT.md write since the env convention settled.
const RECENT_PATH = join(LIFEOS_DIR, "USER/UPGRADES/RECENT.md");
const USER_DIR = join(LIFEOS_DIR, "USER");

type SignificanceLabel = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
type ChangeType = 'skill_update' | 'structure_change' | 'doc_update' | 'hook_update' | 'intent_update' | 'workflow_update' | 'config_update' | 'tool_update' | 'multi_area';

interface UpdateRecord {
  id: string;
  timestamp: string;  // Full ISO timestamp (2026-01-13T18:34:41Z) or legacy date (2026-01-13)
  title: string;
  significance: SignificanceLabel;  // New: replaces impact
  change_type: ChangeType;  // New: replaces type
  purpose?: string;  // New: why was this change made
  expected_improvement?: string;  // New: what should be better
  // Legacy fields for backward compatibility
  type?: string;
  impact?: string;
  version?: string;
  tags?: string[];
  files_affected: string[];
  summary?: string;
  file_path: string;
}

interface UpdateIndex {
  last_updated: string;
  total_updates: number;
  by_year: Record<string, { count: number; months: string[] }>;
  by_significance: Record<SignificanceLabel, number>;
  by_change_type: Record<ChangeType, number>;
  updates: UpdateRecord[];
}

/**
 * Map legacy type/impact to new significance/change_type
 */
function mapLegacyFields(type?: string, impact?: string): { significance: SignificanceLabel; change_type: ChangeType } {
  // Map legacy impact to significance
  const significanceMap: Record<string, SignificanceLabel> = {
    major: 'major',
    minor: 'minor',
    patch: 'trivial',
    unknown: 'minor',
  };

  // Map legacy type to change_type
  const changeTypeMap: Record<string, ChangeType> = {
    feature: 'skill_update',
    enhancement: 'skill_update',
    refactor: 'structure_change',
    docs: 'doc_update',
    architectural: 'structure_change',
    documentation: 'doc_update',
    correction: 'doc_update',
    identity: 'config_update',
    infrastructure: 'structure_change',
    unknown: 'doc_update',
  };

  return {
    significance: significanceMap[impact || 'unknown'] || 'minor',
    change_type: changeTypeMap[type || 'unknown'] || 'doc_update',
  };
}

async function parseUpdateFile(filePath: string): Promise<UpdateRecord | null> {
  try {
    const content = await readFile(filePath, "utf-8");

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      // Try to parse from markdown structure if no frontmatter
      return parseFromMarkdown(filePath, content);
    }

    const frontmatter = parseYaml(frontmatterMatch[1]);

    // Extract summary from Overview section or Purpose section
    const overviewMatch = content.match(/## Overview\n\n([^\n]+)/) ||
                          content.match(/## Purpose\n\n([^\n]+)/);
    const summary = overviewMatch ? overviewMatch[1] : undefined;

    // Handle both new 'timestamp' and legacy 'date' fields
    const timestamp = frontmatter.timestamp || frontmatter.date || extractTimestampFromFilename(filePath);

    // Handle new vs legacy schema
    let significance: SignificanceLabel;
    let change_type: ChangeType;

    if (frontmatter.significance && frontmatter.change_type) {
      // New schema
      significance = frontmatter.significance as SignificanceLabel;
      change_type = frontmatter.change_type as ChangeType;
    } else {
      // Legacy schema - map to new fields
      const mapped = mapLegacyFields(frontmatter.type, frontmatter.impact);
      significance = mapped.significance;
      change_type = mapped.change_type;
    }

    return {
      id: frontmatter.id || basename(filePath, ".md"),
      timestamp,
      title: frontmatter.title || "Untitled Update",
      significance,
      change_type,
      purpose: frontmatter.purpose,
      expected_improvement: frontmatter.expected_improvement,
      // Keep legacy fields for reference
      type: frontmatter.type,
      impact: frontmatter.impact,
      version: frontmatter.version,
      tags: frontmatter.tags || [],
      files_affected: frontmatter.files_affected || [],
      summary,
      file_path: rootRelativeKey(UPDATES_DIR, filePath) ?? filePath,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

function parseFromMarkdown(filePath: string, content: string): UpdateRecord | null {
  // Parse existing files that don't have YAML frontmatter
  const filename = basename(filePath, ".md");
  const timestamp = extractTimestampFromFilename(filePath);

  // Extract title from first H1
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(/^\d{4}-\d{2}-\d{2}(-\d{6})?_/, "").replace(/-/g, " ");

  // Extract type from **Type:** or **Change Type:** line
  const typeMatch = content.match(/\*\*(?:Change )?Type:\*\*\s*(.+)/i);
  const typeRaw = typeMatch ? typeMatch[1].toLowerCase().trim() : "unknown";
  const validTypes = ["architectural", "feature", "enhancement", "documentation", "correction", "identity", "infrastructure"];
  const type = validTypes.find(t => typeRaw.includes(t)) || "unknown";

  // Extract impact or significance
  const impactMatch = content.match(/\*\*(?:Impact|Significance):\*\*\s*(.+)/i);
  const impactRaw = impactMatch ? impactMatch[1].toLowerCase().replace(/[🔴🟠🟡🟢⚪]/g, '').trim() : "unknown";
  const impact = impactRaw;

  // Map to new schema
  const mapped = mapLegacyFields(type, impact);

  // Extract version
  const versionMatch = content.match(/\*\*Version:\*\*\s*(v[\d.]+)/i) ||
                       content.match(/PAI (v[\d.]+)/i);
  const version = versionMatch ? versionMatch[1] : undefined;

  // Extract overview/summary/purpose
  const overviewMatch = content.match(/## Overview\n\n([^\n]+)/) ||
                        content.match(/## Summary\n\n([^\n]+)/) ||
                        content.match(/## Purpose\n\n([^\n]+)/);
  const summary = overviewMatch ? overviewMatch[1] : undefined;

  return {
    id: filename,
    timestamp,
    title,
    significance: mapped.significance,
    change_type: mapped.change_type,
    type,
    impact,
    version,
    tags: [],
    files_affected: [],
    summary,
    file_path: rootRelativeKey(UPDATES_DIR, filePath) ?? filePath,
  };
}

/**
 * Extract timestamp from filename
 * Handles both formats:
 *   - Legacy: 2026-01-13_title-slug.md -> 2026-01-13
 *   - New: 2026-01-13-183441_title-slug.md -> 2026-01-13T18:34:41Z
 */
function extractTimestampFromFilename(filePath: string): string {
  const filename = basename(filePath);

  // Try new format first: YYYY-MM-DD-HHMMSS_title
  const fullMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})_/);
  if (fullMatch) {
    const [, year, month, day, hour, min, sec] = fullMatch;
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
  }

  // Fall back to legacy format: YYYY-MM-DD_title
  const legacyMatch = filename.match(/^(\d{4}-\d{2}-\d{2})_/);
  if (legacyMatch) {
    return legacyMatch[1];
  }

  return "unknown";
}

async function scanUpdateFiles(): Promise<UpdateRecord[]> {
  const updates: UpdateRecord[] = [];

  // Scan year directories
  const yearDirs = await readdir(UPDATES_DIR);

  for (const yearDir of yearDirs) {
    if (!/^\d{4}$/.test(yearDir)) continue;

    const yearPath = join(UPDATES_DIR, yearDir);
    const yearStat = await stat(yearPath);
    if (!yearStat.isDirectory()) continue;

    // Scan month directories
    const monthDirs = await readdir(yearPath);

    for (const monthDir of monthDirs) {
      if (!/^\d{2}$/.test(monthDir)) continue;

      const monthPath = join(yearPath, monthDir);
      const monthStat = await stat(monthPath);
      if (!monthStat.isDirectory()) continue;

      // Scan update files
      const files = await readdir(monthPath);

      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const filePath = join(monthPath, file);
        const record = await parseUpdateFile(filePath);

        if (record) {
          updates.push(record);
        }
      }
    }
  }

  // Sort by timestamp descending (most recent first)
  // Both ISO timestamps and date-only strings sort correctly via localeCompare
  updates.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return updates;
}

/**
 * Extract year and month from a timestamp
 * Handles both: 2026-01-13T18:34:41Z and 2026-01-13
 */
function extractYearMonth(timestamp: string): [string, string] {
  // Works for both formats since they both start with YYYY-MM
  const [year, month] = timestamp.split("-");
  return [year, month];
}

function buildIndex(updates: UpdateRecord[]): UpdateIndex {
  const byYear: Record<string, { count: number; months: Set<string> }> = {};
  const bySignificance: Record<SignificanceLabel, number> = {
    critical: 0,
    major: 0,
    moderate: 0,
    minor: 0,
    trivial: 0,
  };
  const byChangeType: Record<ChangeType, number> = {
    skill_update: 0,
    structure_change: 0,
    doc_update: 0,
    hook_update: 0,
    intent_update: 0,
    workflow_update: 0,
    config_update: 0,
    tool_update: 0,
    multi_area: 0,
  };

  for (const update of updates) {
    const [year, month] = extractYearMonth(update.timestamp);

    // Count by year
    if (!byYear[year]) {
      byYear[year] = { count: 0, months: new Set() };
    }
    byYear[year].count++;
    byYear[year].months.add(month);

    // Count by significance
    bySignificance[update.significance] = (bySignificance[update.significance] || 0) + 1;

    // Count by change type
    byChangeType[update.change_type] = (byChangeType[update.change_type] || 0) + 1;
  }

  // Convert Set to Array for JSON serialization
  const byYearFinal: Record<string, { count: number; months: string[] }> = {};
  for (const [year, data] of Object.entries(byYear)) {
    byYearFinal[year] = {
      count: data.count,
      months: Array.from(data.months).sort(),
    };
  }

  return {
    last_updated: new Date().toISOString(),
    total_updates: updates.length,
    by_year: byYearFinal,
    by_significance: bySignificance,
    by_change_type: byChangeType,
    updates,
  };
}

function getSignificanceBadge(significance: SignificanceLabel): string {
  const badges: Record<SignificanceLabel, string> = {
    critical: '🔴',
    major: '🟠',
    moderate: '🟡',
    minor: '🟢',
    trivial: '⚪',
  };
  return `${badges[significance]} ${significance}`;
}

function formatChangeType(changeType: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    skill_update: 'Skill',
    structure_change: 'Structure',
    doc_update: 'Docs',
    hook_update: 'Hook',
    intent_update: 'Intent',
    workflow_update: 'Intent (old name)',
    config_update: 'Config',
    tool_update: 'Tool',
    multi_area: 'Multi',
  };
  return labels[changeType];
}

function generateChangelog(updates: UpdateRecord[]): string {
  const lines: string[] = [
    "# System Updates Changelog",
    "",
    `**Last Updated:** ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    `**Total Updates:** ${updates.length}`,
    "",
    "---",
    "",
  ];

  // Group by year and month
  const byYearMonth: Record<string, Record<string, UpdateRecord[]>> = {};

  for (const update of updates) {
    const [year, month] = extractYearMonth(update.timestamp);
    if (!byYearMonth[year]) byYearMonth[year] = {};
    if (!byYearMonth[year][month]) byYearMonth[year][month] = [];
    byYearMonth[year][month].push(update);
  }

  // Generate markdown by year (descending)
  const years = Object.keys(byYearMonth).sort().reverse();

  for (const year of years) {
    lines.push(`## ${year}`);
    lines.push("");

    const months = Object.keys(byYearMonth[year]).sort().reverse();

    for (const month of months) {
      const monthName = new Date(`${year}-${month}-01`).toLocaleString("en-US", { month: "long" });
      lines.push(`### ${monthName} ${year}`);
      lines.push("");
      lines.push("| Timestamp | Title | Significance | Change Type |");
      lines.push("|-----------|-------|--------------|-------------|");

      for (const update of byYearMonth[year][month]) {
        const link = `[${update.title}](${update.file_path})`;
        lines.push(`| ${update.timestamp} | ${link} | ${getSignificanceBadge(update.significance)} | ${formatChangeType(update.change_type)} |`);
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}

function generateRecent(updates: UpdateRecord[], count: number = 10): string {
  const recent = updates.slice(0, count);

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [
    // lifeos-freshness-v1 frontmatter: `generator:`/`derived_from:` mark this file as a
    // derived view, so the doc versioner (DocVersionScope.isGenerated) leaves it alone.
    // Without it, every regenerate wiped the seeded `version:` marker and the docs bump
    // in the release version bump failed on "changed doc has no version: marker" (7.50.0 bump).
    "---",
    `last_updated: ${now}`,
    "last_updated_by: UpdateIndex",
    "convention: lifeos-freshness-v1",
    "derived_from: LIFEOS/MEMORY/SYSTEMUPDATES/index.json",
    "generator: LIFEOS/TOOLS/UpdateIndex.ts",
    "---",
    "",
    "# Recent System Updates",
    "",
    `**Last Updated:** ${now}`,
    "",
    "Quick reference to the most recent system changes. For full history, see:",
    "- `~/.claude/LIFEOS/MEMORY/SYSTEMUPDATES/CHANGELOG.md`",
    "- `~/.claude/LIFEOS/MEMORY/SYSTEMUPDATES/index.json`",
    "",
    "---",
    "",
    "| Timestamp | Title | Significance | Change Type |",
    "|-----------|-------|--------------|-------------|",
  ];

  for (const update of recent) {
    const fullPath = `~/.claude/LIFEOS/MEMORY/SYSTEMUPDATES/${update.file_path}`;
    lines.push(`| ${update.timestamp} | [${update.title}](${fullPath}) | ${getSignificanceBadge(update.significance)} | ${formatChangeType(update.change_type)} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`*Showing ${recent.length} of ${updates.length} total updates*`);

  return lines.join("\n");
}

export async function regenerate() {
  console.log("Scanning update files...");
  const updates = await scanUpdateFiles();
  console.log(`Found ${updates.length} update files`);

  console.log("Building index...");
  const index = buildIndex(updates);

  // Every derived view is written through NoFollowWrite: a symlink planted at
  // index.json, CHANGELOG.md or RECENT.md is refused, never followed, and each directory must resolve inside its
  // tree. All three destinations are checked BEFORE the first write, so a refusal leaves the set consistent.
  const changelog = generateChangelog(updates);
  const recent = generateRecent(updates);
  // USER/UPGRADES/ is not part of the shipped user scaffold, so a fresh
  // install's first regenerate has to create it. public issue #1954, @pybe
  await mkdir(dirname(RECENT_PATH), { recursive: true });
  assertSafeDestination(INDEX_PATH, UPDATES_DIR);
  assertSafeDestination(CHANGELOG_PATH, UPDATES_DIR);
  assertSafeDestination(RECENT_PATH, USER_DIR);

  console.log("Writing index.json...");
  writeFileNoFollow(INDEX_PATH, JSON.stringify(index, null, 2), { root: UPDATES_DIR });

  console.log("Generating CHANGELOG.md...");
  writeFileNoFollow(CHANGELOG_PATH, changelog, { root: UPDATES_DIR });

  console.log("Generating RECENT.md...");
  writeFileNoFollow(RECENT_PATH, recent, { root: USER_DIR });

  console.log("\nDone!");
  console.log(`  Index: ${INDEX_PATH}`);
  console.log(`  Changelog: ${CHANGELOG_PATH}`);
  console.log(`  Recent: ${RECENT_PATH}`);
  console.log(`\nStatistics:`);
  console.log(`  Total updates: ${index.total_updates}`);
  console.log(`  By significance: ${JSON.stringify(index.by_significance)}`);
  console.log(`  By change type: ${JSON.stringify(index.by_change_type)}`);
  console.log(`  By year: ${Object.entries(index.by_year).map(([y, d]) => `${y}: ${d.count}`).join(", ")}`);
}

async function validate() {
  console.log("Validating index...");

  const updates = await scanUpdateFiles();

  let index: UpdateIndex;
  try {
    const indexContent = await readFile(INDEX_PATH, "utf-8");
    index = JSON.parse(indexContent);
  } catch {
    console.error("No index.json found. Run 'regenerate' first.");
    process.exit(1);
  }

  const fileIds = new Set(updates.map(u => u.id));
  const indexIds = new Set(index.updates.map(u => u.id));

  const missingInIndex = [...fileIds].filter(id => !indexIds.has(id));
  const extraInIndex = [...indexIds].filter(id => !fileIds.has(id));

  if (missingInIndex.length === 0 && extraInIndex.length === 0) {
    console.log("Index is up to date!");
  } else {
    if (missingInIndex.length > 0) {
      console.log(`Missing from index: ${missingInIndex.join(", ")}`);
    }
    if (extraInIndex.length > 0) {
      console.log(`Extra in index: ${extraInIndex.join(", ")}`);
    }
    console.log("\nRun 'regenerate' to fix.");
    process.exit(1);
  }
}

// Main — guarded so CreateUpdate.ts can import regenerate() without the CLI
// dispatch running against its argv. public issue #1954, @pybe
if (import.meta.main) {
  const command = process.argv[2];

  switch (command) {
    case "regenerate":
      await regenerate();
      break;
    case "validate":
      await validate();
      break;
    default:
      console.log("Usage: bun UpdateIndex.ts <command>");
      console.log("");
      console.log("Commands:");
      console.log("  regenerate  Scan all files and regenerate index");
      console.log("  validate    Check index matches files");
  }
}
