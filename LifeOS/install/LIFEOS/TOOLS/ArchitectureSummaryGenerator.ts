#!/usr/bin/env bun
/**
 * ArchitectureSummaryGenerator — Generate LIFEOS_ARCHITECTURE_SUMMARY.md from source docs
 *
 * Commands:
 *   generate    Generate/regenerate the architecture summary
 *   check       Check if summary is stale (exit 1 if stale, 0 if fresh)
 *
 * Examples:
 *   bun ArchitectureSummaryGenerator.ts generate
 *   bun ArchitectureSummaryGenerator.ts check
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
const ARCH_SOURCE = path.join(LIFEOS_DIR, "DOCUMENTATION", "LifeosSystemArchitecture.md");
const SUMMARY_OUTPUT = path.join(LIFEOS_DIR, "DOCUMENTATION", "ARCHITECTURE_SUMMARY.md");
const ALGORITHM_DIR = path.join(LIFEOS_DIR, "ALGORITHM");
const MEMORY_SYSTEM_DOC = path.join(LIFEOS_DIR, "DOCUMENTATION", "Memory", "MemorySystem.md");
const CLAUDE_MD = path.join(HOME, ".claude", "CLAUDE.md");

// ============================================================================
// Version detection (source-of-truth lookups — no hardcoded versions)
// ============================================================================

/** Compare semver strings: returns positive if a > b, negative if a < b */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Detect the current Algorithm version by finding the highest vX.Y.Z.md in ALGORITHM/ */
function detectAlgorithmVersion(): string {
  // v6.2.0+: LATEST is the single source of truth. Defensive fallback to
  // highest-semver spec file only if LATEST is missing.
  const latestPath = path.join(ALGORITHM_DIR, "LATEST");
  if (fs.existsSync(latestPath)) {
    const v = fs.readFileSync(latestPath, "utf-8").trim();
    if (/^\d+\.\d+\.\d+$/.test(v)) return v;
  }
  if (!fs.existsSync(ALGORITHM_DIR)) return "unknown";
  const versions = fs
    .readdirSync(ALGORITHM_DIR)
    .map(f => f.match(/^v(\d+\.\d+\.\d+)\.md$/)?.[1])
    .filter((v): v is string => Boolean(v))
    .sort(compareSemver);
  return versions[versions.length - 1] ?? "unknown";
}

/** Detect current Memory version from `**Version:** X.Y` in MemorySystem.md */
function detectMemoryVersion(): string {
  if (!fs.existsSync(MEMORY_SYSTEM_DOC)) return "unknown";
  const content = fs.readFileSync(MEMORY_SYSTEM_DOC, "utf-8");
  const match = content.match(/\*\*Version:\*\*\s*([\d.]+)/);
  return match?.[1] ?? "unknown";
}

/**
 * Detect the LifeOS OS version from the canonical `LIFEOS/VERSION` file — the
 * single source of truth (chain A). Falls back to the `# LifeOS X.Y.Z` heading
 * in CLAUDE.md only if VERSION is missing/malformed, so a fresh tree still
 * renders. This collapses the former two-chain drift (2026-07-04): previously
 * this read the hand-typed CLAUDE.md header, which UpdateLifeosVersion never wrote.
 */
function detectLifeosVersion(): string {
  const VERSION_FILE = path.join(LIFEOS_DIR, "VERSION");
  if (fs.existsSync(VERSION_FILE)) {
    const v = fs.readFileSync(VERSION_FILE, "utf-8").trim();
    if (/^\d+\.\d+\.\d+$/.test(v)) return v;
  }
  if (!fs.existsSync(CLAUDE_MD)) return "unknown";
  const content = fs.readFileSync(CLAUDE_MD, "utf-8");
  const match = content.match(/^#\s*LifeOS\s+([\d.]+)/m);
  return match?.[1] ?? "unknown";
}

// ============================================================================
// Parsing
// ============================================================================

/** Extract H2/H3 sections and their content from the architecture doc */
function extractSections(content: string): Array<{ heading: string; level: number; body: string }> {
  const sections: Array<{ heading: string; level: number; body: string }> = [];
  const lines = content.split("\n");
  let currentHeading = "";
  let currentLevel = 0;
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h2Match || h3Match) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, level: currentLevel, body: currentBody.join("\n").trim() });
      }
      currentHeading = (h2Match || h3Match)![1];
      currentLevel = h2Match ? 2 : 3;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeading) {
    sections.push({ heading: currentHeading, level: currentLevel, body: currentBody.join("\n").trim() });
  }

  return sections;
}

/** Extract subsystem entries from CLAUDE.md routing — supports legacy table and current bullet-list formats.
 *
 * Section-aware: tracks the current `## ...` heading so bullets under `{{PRINCIPAL_NAME}} — ...`
 * sections (which document personal identity/voice files) resolve to LIFEOS/USER/, not
 * LIFEOS/DOCUMENTATION/. The downstream `USER/` filter then correctly drops them.
 */
function extractSubsystems(): Array<{ name: string; description: string; docPath: string }> {
  const claudeMdPath = path.join(HOME, ".claude", "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) return [];

  const content = fs.readFileSync(claudeMdPath, "utf-8");
  const entries: Array<{ name: string; description: string; docPath: string; sectionRoot: string }> = [];

  const tableLegacy1 = /^\| \*\*(.+?)\*\* \| `(.+?)` .*/;
  const tableLegacy2 = /^\| (.+?) \| `(.+?)`/;
  const bulletLine = /^\s*-\s+(?:\*\*([^*]+?)\*\*|([A-Za-z][^—–\-`\n]*?))\s*[—–-]\s*`([^`]+?\.md)`/;
  // Section heading: `## {{PRINCIPAL_NAME}} — Identity & Voice (paths under LIFEOS/USER/)` etc.
  // Captures the optional "paths under <X>" hint to override the default section root.
  const headingPathHint = /paths under\s+`?([A-Za-z_/.0-9-]+?)`?(?:\s|\)|$)/;

  let currentSectionRoot = "LIFEOS/DOCUMENTATION/";

  const push = (rawName: string, docPath: string) => {
    const name = rawName.replace(/\*\*/g, "").trim();
    if (!name || !docPath) return;
    if (!entries.find(e => e.name === name && e.docPath === docPath)) {
      entries.push({ name, description: name, docPath, sectionRoot: currentSectionRoot });
    }
  };

  for (const line of content.split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      const heading = h2[1];
      const hint = heading.match(headingPathHint);
      if (hint) {
        let root = hint[1];
        if (!root.endsWith("/")) root += "/";
        currentSectionRoot = root;
      } else {
        currentSectionRoot = "LIFEOS/DOCUMENTATION/";
      }
      continue;
    }

    let m = line.match(tableLegacy1);
    if (m) { push(m[1], m[2]); continue; }
    m = line.match(tableLegacy2);
    if (m) { push(m[1], m[2]); continue; }
    m = line.match(bulletLine);
    if (m) { push(m[1] ?? m[2] ?? "", m[3]); continue; }
  }

  return entries
    .map(e => {
      let p = e.docPath;
      if (!p.startsWith("LIFEOS/") && !p.startsWith("~") && !p.startsWith("/") && p.endsWith(".md")) {
        p = e.sectionRoot + p;
      }
      return { name: e.name, description: e.description, docPath: p };
    })
    .filter(e =>
      e.docPath.includes("LIFEOS/") &&
      !e.docPath.includes("USER/") &&
      !e.docPath.includes("DA_") &&
      e.docPath.endsWith(".md")
    );
}

/** Extract founding principles from architecture doc */
function extractPrinciples(content: string): string[] {
  const principles: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match "### N. Principle Name" pattern
    const match = line.match(/^### \d+\. (.+)$/);
    if (match) {
      principles.push(match[1]);
    }
  }

  return principles;
}

/** Extract the Pipeline Topology section from the architecture doc */
function extractTopology(content: string): string | null {
  const startMarker = "## Pipeline Topology";
  const startIdx = content.indexOf(startMarker);
  if (startIdx === -1) return null;

  // Find the next ## heading after the topology section
  const afterStart = content.indexOf("\n## ", startIdx + startMarker.length);
  const section = afterStart === -1
    ? content.slice(startIdx)
    : content.slice(startIdx, afterStart);

  return section.trim();
}

/** Get modification time of a file, or 0 if missing */
function getMtime(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

// ============================================================================
// Generation
// ============================================================================

function generate(): string {
  if (!fs.existsSync(ARCH_SOURCE)) {
    console.error(`ERROR: Architecture source not found: ${ARCH_SOURCE}`);
    process.exit(1);
  }

  const archContent = fs.readFileSync(ARCH_SOURCE, "utf-8");
  const subsystems = extractSubsystems();
  const principles = extractPrinciples(archContent);
  const topology = extractTopology(archContent);
  const paiVersion = detectLifeosVersion();
  const algorithmVersion = detectAlgorithmVersion();
  const memoryVersion = detectMemoryVersion();

  // Build subsystem list — one bullet per subsystem (more compact than a table)
  // (existence is asserted by inclusion; missing files would fail the regen, not silently render "N")
  const subsystemRows: string[] = [];
  const missing: string[] = [];
  for (const sub of subsystems) {
    const resolved = sub.docPath.startsWith("/")
      ? sub.docPath
      : sub.docPath.startsWith("~")
        ? sub.docPath.replace(/^~/, HOME)
        : path.join(HOME, ".claude", sub.docPath);
    const shortPath = sub.docPath.replace("~/.claude/", "");
    if (!fs.existsSync(resolved)) missing.push(shortPath);
    subsystemRows.push(`- ${sub.name} — ${shortPath}`);
  }

  // Extract key architecture sections — emitted inline (compressed from bullet list)
  const sections = extractSections(archContent);
  const majorSections = sections
    .filter(s => s.level === 2 && !s.heading.includes("Changelog") && !s.heading.includes("Updates"))
    .map(s => s.heading);

  // Build the summary — frontmatter first (pai-freshness-v1 convention).
  // Auto-generated derivative; effective freshness inherits from derived_from.
  const nowIso = new Date().toISOString();
  const lines: string[] = [
    "---",
    `last_updated: ${nowIso}`,
    "last_updated_by: ArchitectureSummaryGenerator",
    "convention: pai-freshness-v1",
    "derived_from: LIFEOS/DOCUMENTATION/LifeosSystemArchitecture.md",
    "generator: LIFEOS/TOOLS/ArchitectureSummaryGenerator.ts",
    "---",
    "",
    "# LifeOS Architecture Summary",
    "",
    "> Auto-generated by ArchitectureSummaryGenerator.ts. Do not edit manually.",
    `> Generated: ${nowIso} | Source: DOCUMENTATION/LifeosSystemArchitecture.md`,
    "",
    "## Overview",
    "",
    "LifeOS — the **Life Operating System**, built on the LifeOS (LifeOS) layer — is the framework that knows your goals, people, and current state, and continuously hill-climbs you toward your ideal state.",
    "Everything below is the machinery of that one loop: Current State → Ideal State via verifiable iteration (ISC). Canonical thesis: `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`.",
    "",
    `**Current versions:** LifeOS ${paiVersion} | Algorithm v${algorithmVersion} | Memory v${memoryVersion}`,
    "",
    "## Subsystem Reference",
    "",
    ...subsystemRows,
    ...(missing.length > 0 ? ["", `> Missing: ${missing.join(", ")}`] : []),
    "",
    `**Sections in source doc:** ${majorSections.join(" · ")}`,
    "",
    "## Founding Principles",
    "",
    ...principles.slice(0, 17).map((p, i) => `${i + 1}. ${p}`),
    "",
    "## Instruction Hierarchy",
    "",
    "1. **System Prompt** — LIFEOS_SYSTEM_PROMPT.md, constitutional, survives compaction",
    "2. **CLAUDE.md** — routing table: @-imports + subsystem pointers (no constitutional rules)",
    "3. **@Imported files** — PRINCIPAL_IDENTITY, DA_IDENTITY, PROJECTS, PRINCIPAL_TELOS, this file",
    "4. **Dynamic context** — LoadContext hook output, ephemeral",
    "",
    "## Key Design Decisions",
    "",
    "- Algorithm is the gravitational center — everything else feeds it",
    "- ISA is the single source of truth per Algorithm run",
    "- Skills = self-activating composable domain units",
    "- Hooks provide SessionStart→SessionEnd lifecycle integration",
    "- Memory compounds across sessions: WORK → LEARNING → KNOWLEDGE",
    "- System/user config separation enables public releases without personal data",
    "",
    ...(topology ? [topology, ""] : []),
    "## Cross-References",
    "",
    "- Full architecture: `LIFEOS/DOCUMENTATION/LifeosSystemArchitecture.md`",
    `- Algorithm spec: \`LIFEOS/ALGORITHM/v${algorithmVersion}.md\``,
    "- ISA format: `LIFEOS/DOCUMENTATION/Isa/IsaFormat.md`",
    "- Config system: `LIFEOS/DOCUMENTATION/Config/ConfigSystem.md`",
    "",
  ];

  return lines.join("\n");
}

// ============================================================================
// Commands
// ============================================================================

function cmdGenerate(): void {
  const summary = generate();
  fs.writeFileSync(SUMMARY_OUTPUT, summary);
  console.log(`Generated ${SUMMARY_OUTPUT}`);
  console.log(`  ${summary.split("\n").length} lines`);
}

function cmdCheck(): void {
  if (!fs.existsSync(SUMMARY_OUTPUT)) {
    console.log("STALE: Summary does not exist");
    process.exit(1);
  }

  const sourceMtime = getMtime(ARCH_SOURCE);
  const summaryMtime = getMtime(SUMMARY_OUTPUT);
  const claudeMdMtime = getMtime(path.join(HOME, ".claude", "CLAUDE.md"));

  if (sourceMtime > summaryMtime || claudeMdMtime > summaryMtime) {
    console.log("STALE: Source files are newer than summary");
    process.exit(1);
  }

  // Version drift check: the master doc shouldn't mention an older Algorithm version than ALGORITHM/
  const archContent = fs.readFileSync(ARCH_SOURCE, "utf-8");
  const current = detectAlgorithmVersion();
  const cited = [...archContent.matchAll(/v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  const stale = cited.filter(v => compareSemver(v, current) < 0);
  if (stale.length > 0) {
    console.log(`STALE: LifeosSystemArchitecture.md references older Algorithm version(s) ${[...new Set(stale)].join(", ")} — current is v${current}`);
    process.exit(1);
  }

  console.log("FRESH: Summary is up to date");
  process.exit(0);
}

// ============================================================================
// CLI Entry
// ============================================================================

const { positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
});

const command = positionals[0];

switch (command) {
  case "generate":
    cmdGenerate();
    break;
  case "check":
    cmdCheck();
    break;
  default:
    console.log(`Usage: bun ArchitectureSummaryGenerator.ts <command>

Commands:
  generate    Generate/regenerate LIFEOS_ARCHITECTURE_SUMMARY.md
  check       Check if summary is stale (exit 1 if stale)`);
    process.exit(command ? 1 : 0);
}
