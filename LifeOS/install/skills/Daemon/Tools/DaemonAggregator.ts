#!/usr/bin/env bun

/**
 * DaemonAggregator — Reads LifeOS system data sources and produces
 * a security-filtered daemon.md update.
 *
 * This tool aggregates from TELOS, Knowledge, Projects, and Work sessions,
 * applies the SecurityFilter, and outputs either a daemon.md file or
 * a structured JSON diff for preview.
 *
 * Usage:
 *   bun DaemonAggregator.ts --output <daemon.md>          Write updated daemon.md
 *   bun DaemonAggregator.ts --preview                     Show what would change
 *   bun DaemonAggregator.ts --json                        Output as JSON (for pipeline)
 *   bun DaemonAggregator.ts --diff <current-daemon.md>    Show diff against current
 */

import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { filterContent, filterDaemonData, loadSecurityOverrides } from "./SecurityFilter.ts";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ─── Path Resolution ───

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const USER_DIR = join(LIFEOS_DIR, "USER");
const MEMORY_DIR = join(LIFEOS_DIR, "MEMORY");
const TELOS_DIR = join(USER_DIR, "TELOS");
const KNOWLEDGE_DIR = join(MEMORY_DIR, "KNOWLEDGE");
const WORK_DIR = join(MEMORY_DIR, "WORK");
const PROJECTS_FILE = join(USER_DIR, "PROJECTS", "PROJECTS.md");
const IDENTITY_FILE = join(USER_DIR, "PRINCIPAL_IDENTITY.md");
const CUSTOMIZATIONS_DIR = join(USER_DIR, "SKILLCUSTOMIZATIONS", "Daemon");
const USER_DAEMON_DIR = join(USER_DIR, "Daemon");

// ─── Structurally Excluded Paths (NEVER read these) ───

const EXCLUDED_PATHS = [
  join(USER_DIR, "CONTACTS.md"),
  join(USER_DIR, "FINANCES"),
  join(USER_DIR, "HEALTH"),
  join(USER_DIR, "BUSINESS"),
  join(USER_DIR, "OPINIONS.md"),
  join(TELOS_DIR, "TRAUMAS.md"),
  join(KNOWLEDGE_DIR, "People"),
  join(KNOWLEDGE_DIR, "Companies"),
  // ─── Current→Ideal Monitoring Spine (2026-04-15) ───
  // the user's explicit decision: IDEAL_STATE is fully private (Decision #3).
  // CURRENT_STATE contains aggregated health/finance/location/social — hardest private.
  // Preference files with location or consumption data are private.
  join(TELOS_DIR, "IDEAL_STATE"),
  join(TELOS_DIR, "CURRENT_STATE"),
  join(TELOS_DIR, "GAP"),
  join(TELOS_DIR, "RESTAURANTS.md"),
  join(TELOS_DIR, "FOOD_PREFERENCES.md"),
  join(TELOS_DIR, "LEARNING.md"),
  join(TELOS_DIR, "MEETUPS.md"),
  join(TELOS_DIR, "CIVIC.md"),
];

function isExcluded(filePath: string): boolean {
  const resolved = resolve(filePath);
  return EXCLUDED_PATHS.some((excluded) => resolved.startsWith(resolve(excluded)));
}

// ─── Public Projects List ───

const PUBLIC_PROJECTS = [
  "Website", "Fabric", "SecLists", "LifeOS", "Surface",
  "Human 3.0", "UL Site", "Daemon", "Substrate", "Telos",
  "TheAlgorithm", "FoundryServices", "Ladder", "LifeOS Marketing",
];

// ─── Source Readers ───

function readFileIfExists(path: string): string | null {
  if (isExcluded(path)) return null;
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

function readMissions(): string {
  const content = readFileIfExists(join(TELOS_DIR, "MISSION.md"));
  if (!content) return "";

  const lines = content.split("\n");
  const publicMissions: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Include M0 and M1 — they're public-safe philosophical missions
    if (trimmed.match(/^[-*]\s+\*?\*?M[01]\b/)) {
      publicMissions.push(trimmed.replace(/^[-*]\s+/, ""));
    }
  }

  // M2 reworded: mind upload aspiration without partner reference
  publicMissions.push(
    "M2: Explore the transfer and storage of human minds into digital formats for future continuity."
  );

  return publicMissions.join("\n");
}

function readGoals(): string {
  const content = readFileIfExists(join(TELOS_DIR, "GOALS.md"));
  if (!content) return "";

  const lines = content.split("\n");
  const publicGoals: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Include goals for public projects, exclude revenue/follower targets
    if (trimmed.match(/^[-*]\s+\*?\*?G\d+\b/)) {
      // Filter out goals with revenue, follower count, or monetization targets
      if (
        !trimmed.match(/\b(revenue|follower|subscriber|monetiz)/i) &&
        !trimmed.match(/\b\d+[Kk]\s+(follower|subscriber)/i)
      ) {
        publicGoals.push(trimmed.replace(/^[-*]\s+/, ""));
      }
    }
  }

  return publicGoals.join("\n");
}

function readBooks(): string[] {
  const content = readFileIfExists(join(TELOS_DIR, "BOOKS.md"));
  if (!content) return [];

  return content
    .split("\n")
    .filter((l) => l.match(/^[-*]\s+/))
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l.length > 0);
}

function readMovies(): string[] {
  const content = readFileIfExists(join(TELOS_DIR, "MOVIES.md"));
  if (!content) return [];

  return content
    .split("\n")
    .filter((l) => l.match(/^[-*]\s+/))
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l.length > 0);
}

function readWisdom(): string[] {
  const content = readFileIfExists(join(TELOS_DIR, "WISDOM.md"));
  if (!content) return [];

  // Split by double newlines to get individual quotes
  return content
    .split(/\n{2,}/)
    .map((q) => q.trim())
    .filter((q) => q.length > 10 && !q.startsWith("#"));
}

function readRecentIdeas(limit = 10): Array<{ title: string; thesis: string }> {
  const indexPath = join(KNOWLEDGE_DIR, "Ideas", "_index.md");
  const content = readFileIfExists(indexPath);
  if (!content) return [];

  // Extract recently updated ideas from the index
  const recentSection = content.match(/## Recently Updated\n([\s\S]*?)(?=\n## |$)/);
  if (!recentSection) return [];

  const ideaSlugs = recentSection[1]
    .split("\n")
    .filter((l) => l.match(/^\s*-\s+\[\[/))
    .slice(0, limit)
    .map((l) => {
      const slugMatch = l.match(/\[\[([^\]]+)\]\]/);
      const titleMatch = l.match(/"([^"]+)"/);
      return {
        slug: slugMatch?.[1] || "",
        title: titleMatch?.[1] || "",
      };
    })
    .filter((i) => i.slug && i.title);

  const ideas: Array<{ title: string; thesis: string }> = [];

  for (const { slug, title } of ideaSlugs) {
    const ideaPath = join(KNOWLEDGE_DIR, "Ideas", `${slug}.md`);
    const ideaContent = readFileIfExists(ideaPath);
    if (!ideaContent) {
      ideas.push({ title, thesis: "" });
      continue;
    }

    // Extract thesis section (first paragraph after ## Thesis)
    const thesisMatch = ideaContent.match(/## Thesis\s*\n([\s\S]*?)(?=\n## |$)/);
    const thesis = thesisMatch
      ? thesisMatch[1].trim().split("\n")[0].trim() // First line only
      : "";

    // Skip ideas that reference internal LifeOS architecture
    if (
      thesis.match(/PAI\/|hooks\/|MEMORY\/|Algorithm\/|\.hook\.ts/i) ||
      title.match(/^(LifeOS|Hook|Pulse|Algorithm)\b/i)
    ) {
      continue;
    }

    ideas.push({ title, thesis });
  }

  return ideas;
}

function readPublicProjects(): { technical: string[]; creative: string[]; personal: string[] } {
  const content = readFileIfExists(PROJECTS_FILE);
  if (!content) return { technical: [], creative: [], personal: [] };

  const technical: string[] = [];
  const creative: string[] = [];

  // Parse the projects table
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.includes("Project")) continue;

    // Extract project name
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const name = cells[0].replace(/\*\*/g, "").trim();

    if (PUBLIC_PROJECTS.includes(name)) {
      const url = cells[2] || "";
      if (url.includes("github.com")) {
        technical.push(`${name} — ${url}`);
      } else if (url) {
        creative.push(`${name} — ${url}`);
      } else {
        technical.push(name);
      }
    }
  }

  return { technical, creative, personal: [] };
}

function readWorkThemes(daysBack = 14, limit = 8): string[] {
  if (!existsSync(WORK_DIR)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const themes = new Map<string, number>();

  try {
    const dirs = readdirSync(WORK_DIR)
      .filter((d) => d.match(/^\d{8}-/))
      .sort()
      .reverse()
      .slice(0, 50); // Check last 50 sessions max

    for (const dir of dirs) {
      // Extract date from dir name (YYYYMMDD-HHMMSS_description)
      const dateStr = dir.slice(0, 8);
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6)) - 1;
      const day = parseInt(dateStr.slice(6, 8));
      const dirDate = new Date(year, month, day);

      if (dirDate < cutoff) continue;

      // Extract theme from directory name (after the timestamp_)
      const descPart = dir.replace(/^\d{8}-\d{6}_/, "");
      if (!descPart) continue;

      // Generalize the theme (remove specific details)
      const theme = generalizeTheme(descPart);
      if (theme) {
        themes.set(theme, (themes.get(theme) || 0) + 1);
      }
    }
  } catch {
    return [];
  }

  // Sort by frequency, return top N
  return Array.from(themes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([theme]) => theme);
}

function generalizeTheme(slug: string): string | null {
  // Convert kebab-case slug to human-readable theme
  const words = slug.replace(/-/g, " ").toLowerCase();

  // Map specific patterns to general themes
  const themeMap: Array<[RegExp, string]> = [
    [/blog|post|writing|draft/, "Writing and content creation"],
    [/security|vuln|pentest|recon/, "Security research and assessment"],
    [/ai|llm|model|prompt/, "AI systems and development"],
    [/deploy|build|ship|release/, "Building and shipping software"],
    [/design|ui|ux|frontend/, "Design and user experience"],
    [/research|investigate|analysis/, "Research and analysis"],
    [/feed|surface|news/, "Content curation and intelligence"],
    [/pai|algorithm|skill|hook/, null], // Internal — exclude
    [/fix|bug|debug|error/, "Debugging and problem-solving"],
    [/newsletter|email|broadcast/, "Newsletter and communications"],
    [/telos|goal|mission/, "Purpose and goal development"],
  ];

  for (const [pattern, theme] of themeMap) {
    if (words.match(pattern)) return theme;
  }

  // If no pattern matches, create a generic theme from the first 3 meaningful words
  const meaningful = words
    .split(" ")
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "into"].includes(w))
    .slice(0, 3);

  if (meaningful.length >= 2) {
    return meaningful.join(" ").replace(/^\w/, (c) => c.toUpperCase());
  }

  return null;
}

function readAbout(): string {
  const content = readFileIfExists(IDENTITY_FILE);
  if (!content) return "";

  // Extract key public information
  const lines = content.split("\n");
  const parts: string[] = [];

  for (const line of lines) {
    if (line.includes("Name:")) {
      continue; // Skip, we'll compose our own
    }
    if (line.includes("Focus:")) {
      const focus = line.replace(/.*Focus:\*?\*?\s*/, "").trim();
      parts.push(focus);
    }
    if (line.includes("Online Since:")) {
      const since = line.replace(/.*Online Since:\*?\*?\s*/, "").trim();
      parts.push(`Online since ${since}`);
    }
  }

  return parts.join(". ");
}

function readPreferences(): string[] {
  // Read from existing daemon data if available
  const existingDaemon = readExistingDaemon();
  if (existingDaemon.preferences) {
    return typeof existingDaemon.preferences === "string"
      ? existingDaemon.preferences.split("\n").filter(Boolean)
      : (existingDaemon.preferences as string[]);
  }
  return [];
}

function readExistingDaemon(): Record<string, unknown> {
  const daemonPath = join(USER_DAEMON_DIR, "daemon.md");
  if (!existsSync(daemonPath)) {
    // Fall back to old location
    const oldPath = join(HOME, ".claude", "skills", "_DAEMON", "Mcp", "daemon.md");
    if (!existsSync(oldPath)) return {};
    return parseDaemonMd(readFileSync(oldPath, "utf-8"));
  }
  return parseDaemonMd(readFileSync(daemonPath, "utf-8"));
}

function parseDaemonMd(content: string): Record<string, unknown> {
  const sections: Record<string, string> = {};
  let currentSection: string | null = null;
  let sectionContent: string[] = [];

  for (const line of content.split("\n")) {
    const sectionMatch = line.match(/^\[([A-Z_]+)\]$/);
    if (sectionMatch) {
      if (currentSection) {
        sections[currentSection] = sectionContent.join("\n").trim();
      }
      currentSection = sectionMatch[1].toLowerCase();
      sectionContent = [];
    } else if (currentSection && line.trim() && !line.startsWith("#")) {
      sectionContent.push(line);
    }
  }
  if (currentSection) {
    sections[currentSection] = sectionContent.join("\n").trim();
  }

  return sections;
}

// ─── Aggregation ───

interface DaemonUpdate {
  about: string;
  mission: string;
  current_location: string;
  telos: string;
  favorite_books: string[];
  favorite_movies: string[];
  predictions: string[];
  preferences: string[];
  daily_routine: string[];
  favorite_podcasts: string[];
  recent_ideas: Array<{ title: string; thesis: string }>;
  projects: { technical: string[]; creative: string[]; personal: string[] };
  work_themes: string[];
  wisdom: string[];
  last_updated: string;
}

export function aggregate(): DaemonUpdate {
  const existing = readExistingDaemon();

  // About: always prefer existing hand-written bio over auto-generated
  const about = (existing.about as string) || readAbout() || "";
  const mission = readMissions() || (existing.mission as string) || "";
  const books = readBooks();
  const movies = readMovies();
  const wisdom = readWisdom();
  const recentIdeas = readRecentIdeas(10);
  const projects = readPublicProjects();
  const workThemes = readWorkThemes(14, 8);
  const goals = readGoals();

  // Combine missions and goals into TELOS section
  const telosParts: string[] = [];
  if (mission) telosParts.push(mission);
  if (goals) telosParts.push(goals);

  // Preserve existing sections that we don't have LifeOS sources for
  const predictions = existing.predictions
    ? (typeof existing.predictions === "string"
        ? existing.predictions.split("\n").filter(Boolean).map((l: string) => l.replace(/^[-*]\s+/, ""))
        : (existing.predictions as string[]))
    : [];

  const preferences = readPreferences();

  const dailyRoutine = existing.daily_routine
    ? (typeof existing.daily_routine === "string"
        ? existing.daily_routine.split("\n").filter(Boolean).map((l: string) => l.replace(/^[-*]\s+/, ""))
        : (existing.daily_routine as string[]))
    : [];

  const podcasts = existing.favorite_podcasts
    ? (typeof existing.favorite_podcasts === "string"
        ? existing.favorite_podcasts.split("\n").filter(Boolean).map((l: string) => l.replace(/^[-*]\s+/, ""))
        : (existing.favorite_podcasts as string[]))
    : [];

  // Merge: LifeOS source books + existing daemon books (deduplicated)
  const existingBooks = existing.favorite_books
    ? (typeof existing.favorite_books === "string"
        ? existing.favorite_books.split("\n").filter(Boolean).map((l: string) => l.replace(/^[-*]\s+/, "").replace(/^"(.+)".*$/, "$1"))
        : (existing.favorite_books as string[]))
    : [];
  const mergedBooks = [...new Set([...books, ...existingBooks])];

  // Merge movies similarly
  const existingMovies = existing.favorite_movies
    ? (typeof existing.favorite_movies === "string"
        ? existing.favorite_movies.split("\n").filter(Boolean).map((l: string) => l.replace(/^[-*]\s+/, ""))
        : (existing.favorite_movies as string[]))
    : [];
  const mergedMovies = [...new Set([...movies, ...existingMovies])];

  return {
    about,
    mission: telosParts.join("\n\n"),
    current_location: (existing.current_location as string) || "San Francisco Bay Area",
    telos: telosParts.join("\n\n"),
    favorite_books: mergedBooks,
    favorite_movies: mergedMovies,
    predictions,
    preferences,
    daily_routine: dailyRoutine,
    favorite_podcasts: podcasts,
    recent_ideas: recentIdeas,
    projects,
    work_themes: workThemes,
    wisdom: wisdom.slice(0, 5), // Top 5 quotes
    last_updated: new Date().toISOString(),
  };
}

// ─── Output Formatters ───

function toDaemonMd(data: DaemonUpdate): string {
  const sections: string[] = [
    "# DAEMON DATA FILE",
    "",
    "# This file contains personal information for the daemon profile",
    "# Format: Section headers are marked with [SECTION_NAME]",
    "# Auto-generated by DaemonAggregator from LifeOS sources",
    "",
  ];

  sections.push("[ABOUT]", "", data.about, "");
  sections.push("[CURRENT_LOCATION]", "", data.current_location, "");
  sections.push("[MISSION]", "", data.mission, "");

  if (data.telos) {
    sections.push("[TELOS]", "", data.telos, "");
  }

  sections.push("[FAVORITE_BOOKS]", "");
  for (const book of data.favorite_books) {
    sections.push(`- ${book}`);
  }
  sections.push("");

  sections.push("[FAVORITE_MOVIES]", "");
  for (const movie of data.favorite_movies) {
    sections.push(`- ${movie}`);
  }
  sections.push("");

  if (data.daily_routine.length > 0) {
    sections.push("[DAILY_ROUTINE]", "");
    for (const item of data.daily_routine) {
      sections.push(`- ${item}`);
    }
    sections.push("");
  }

  if (data.preferences.length > 0) {
    sections.push("[PREFERENCES]", "");
    for (const pref of data.preferences) {
      sections.push(`- ${pref}`);
    }
    sections.push("");
  }

  if (data.favorite_podcasts.length > 0) {
    sections.push("[FAVORITE_PODCASTS]", "");
    for (const pod of data.favorite_podcasts) {
      sections.push(`- ${pod}`);
    }
    sections.push("");
  }

  if (data.predictions.length > 0) {
    sections.push("[PREDICTIONS]", "");
    for (const pred of data.predictions) {
      sections.push(`- ${pred}`);
    }
    sections.push("");
  }

  if (data.recent_ideas.length > 0) {
    sections.push("[RECENT_IDEAS]", "");
    for (const idea of data.recent_ideas) {
      const line = idea.thesis ? `- ${idea.title}: ${idea.thesis}` : `- ${idea.title}`;
      sections.push(line);
    }
    sections.push("");
  }

  if (data.work_themes.length > 0) {
    sections.push("[CURRENTLY_WORKING_ON]", "");
    for (const theme of data.work_themes) {
      sections.push(`- ${theme}`);
    }
    sections.push("");
  }

  if (data.wisdom.length > 0) {
    sections.push("[WISDOM]", "");
    for (const quote of data.wisdom) {
      sections.push(`- ${quote}`);
    }
    sections.push("");
  }

  sections.push("# Note: PROJECTS are pulled dynamically");
  sections.push("");

  return sections.join("\n");
}

// ─── CLI ───

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DaemonAggregator — Aggregate LifeOS data into daemon.md

Usage:
  bun DaemonAggregator.ts --output <path>    Write daemon.md to path
  bun DaemonAggregator.ts --preview          Show aggregated content (no write)
  bun DaemonAggregator.ts --json             Output as JSON
  bun DaemonAggregator.ts --diff <current>   Show diff against current daemon.md
  bun DaemonAggregator.ts --sources          List data sources and their status

Options:
  --filter          Apply SecurityFilter to output (default: on)
  --no-filter       Skip SecurityFilter (for debugging only)
  --verbose         Show aggregation details
`);
    process.exit(0);
  }

  // Load security overrides if available
  const overridesPath = join(CUSTOMIZATIONS_DIR, "SecurityOverrides.md");
  const overrides = loadSecurityOverrides(overridesPath);

  if (args.includes("--sources")) {
    console.log("Data Source Status:\n");
    const sources = [
      { name: "TELOS/MISSION.md", path: join(TELOS_DIR, "MISSION.md") },
      { name: "TELOS/GOALS.md", path: join(TELOS_DIR, "GOALS.md") },
      { name: "TELOS/BOOKS.md", path: join(TELOS_DIR, "BOOKS.md") },
      { name: "TELOS/MOVIES.md", path: join(TELOS_DIR, "MOVIES.md") },
      { name: "TELOS/WISDOM.md", path: join(TELOS_DIR, "WISDOM.md") },
      { name: "KNOWLEDGE/Ideas/_index.md", path: join(KNOWLEDGE_DIR, "Ideas", "_index.md") },
      { name: "PROJECTS.md", path: PROJECTS_FILE },
      { name: "PRINCIPAL_IDENTITY.md", path: IDENTITY_FILE },
      { name: "WORK/ (sessions)", path: WORK_DIR },
      { name: "User daemon.md", path: join(USER_DAEMON_DIR, "daemon.md") },
    ];

    for (const s of sources) {
      const exists = existsSync(s.path);
      const excluded = isExcluded(s.path);
      const status = excluded ? "EXCLUDED" : exists ? "OK" : "MISSING";
      const icon = excluded ? "X" : exists ? "+" : "-";
      console.log(`  [${icon}] ${s.name}: ${status}`);
    }
    process.exit(0);
  }

  console.log("Aggregating LifeOS data sources...\n");
  const data = aggregate();

  // Apply security filter unless --no-filter
  const skipFilter = args.includes("--no-filter");
  let daemonMd = toDaemonMd(data);

  if (!skipFilter) {
    const result = filterContent(daemonMd, overrides);
    daemonMd = result.clean;

    if (result.redactions.length > 0) {
      console.log(`Security filter applied: ${result.redactions.length} redactions`);
      if (args.includes("--verbose")) {
        for (const r of result.redactions) {
          console.log(`  [${r.type}] "${r.original}"`);
        }
      }
    } else {
      console.log("Security filter applied: clean (no redactions needed)");
    }
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  if (args.includes("--preview")) {
    console.log("\n--- PREVIEW ---\n");
    console.log(daemonMd);
    console.log("\n--- END PREVIEW ---");

    // Summary
    console.log("\nSections populated:");
    console.log(`  Books: ${data.favorite_books.length}`);
    console.log(`  Movies: ${data.favorite_movies.length}`);
    console.log(`  Ideas: ${data.recent_ideas.length}`);
    console.log(`  Work themes: ${data.work_themes.length}`);
    console.log(`  Wisdom: ${data.wisdom.length}`);
    console.log(`  Predictions: ${data.predictions.length}`);
    process.exit(0);
  }

  const diffIdx = args.indexOf("--diff");
  if (diffIdx !== -1 && args[diffIdx + 1]) {
    const currentPath = args[diffIdx + 1];
    if (existsSync(currentPath)) {
      const current = readFileSync(currentPath, "utf-8");
      // Simple line-by-line diff summary
      const currentLines = new Set(current.split("\n").map((l) => l.trim()).filter(Boolean));
      const newLines = new Set(daemonMd.split("\n").map((l) => l.trim()).filter(Boolean));

      const added = [...newLines].filter((l) => !currentLines.has(l));
      const removed = [...currentLines].filter((l) => !newLines.has(l));

      console.log(`\nDiff Summary:`);
      console.log(`  Added: ${added.length} lines`);
      console.log(`  Removed: ${removed.length} lines`);

      if (added.length > 0) {
        console.log("\n+ Added:");
        for (const line of added.slice(0, 20)) {
          console.log(`  + ${line}`);
        }
        if (added.length > 20) console.log(`  ... and ${added.length - 20} more`);
      }

      if (removed.length > 0) {
        console.log("\n- Removed:");
        for (const line of removed.slice(0, 20)) {
          console.log(`  - ${line}`);
        }
        if (removed.length > 20) console.log(`  ... and ${removed.length - 20} more`);
      }
    } else {
      console.log(`Current file not found: ${currentPath}`);
    }
    process.exit(0);
  }

  const outputIdx = args.indexOf("--output");
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    const outputPath = args[outputIdx + 1];
    writeFileSync(outputPath, daemonMd);
    console.log(`\nWrote daemon.md to: ${outputPath}`);
    console.log(`Size: ${daemonMd.length} bytes`);
    process.exit(0);
  }

  // Default: preview mode
  console.log(daemonMd);
}
