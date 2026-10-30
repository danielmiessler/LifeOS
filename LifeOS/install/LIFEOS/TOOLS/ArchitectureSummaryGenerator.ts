#!/usr/bin/env bun
/**
 * @version 1.4.56
 */
// Normalize env path vars Claude Code may inject unexpanded — literal $HOME/${HOME}
// in LIFEOS_DIR/LIFEOS_CONFIG_DIR/PROJECTS_DIR resolves to a shadow dir (#1404 / PR #1451, author jbmml).
for (const __k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const __v = process.env[__k];
  if (__v && /^\$\{?HOME\}?(\/|$)/.test(__v)) process.env[__k] = __v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}

/**
 * ArchitectureSummaryGenerator — Generate ARCHITECTURE_SUMMARY.md from source docs
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
import { homedir } from "node:os";
import { getClaudeDir, getLifeosDir } from "./Paths"; // public issue #1974 @sabo961, PR #1918 @PigLardLord
import { renderMirror } from "./HeaderMirror";

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
const ARCH_SOURCE = path.join(LIFEOS_DIR, "DOCUMENTATION", "LifeosSystemArchitecture.md");
const SUMMARY_OUTPUT = path.join(LIFEOS_DIR, "DOCUMENTATION", "ARCHITECTURE_SUMMARY.md");
const ALGORITHM_DIR = path.join(LIFEOS_DIR, "ALGORITHM");
const MEMORY_SYSTEM_DOC = path.join(LIFEOS_DIR, "DOCUMENTATION", "Memory", "MemorySystem.md");
const CLAUDE_MD = path.join(getClaudeDir(), "CLAUDE.md");

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

/** Detect the system prompt's component version from its frontmatter `version:` line —
 *  the marker BumpSystemPromptVersion.ts owns (a versioning component line). Scoped to the
 *  leading `---` block so a `version:` in the body can't match. */
function detectSystemPromptVersion(): string {
  const spPath = path.join(LIFEOS_DIR, "LIFEOS_SYSTEM_PROMPT.md");
  if (!fs.existsSync(spPath)) return "unknown";
  const lines = fs.readFileSync(spPath, "utf-8").split("\n");
  if (lines[0]?.trim() !== "---") return "unknown";
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") break;
    const m = lines[i]?.match(/^version:\s*(\d+\.\d+\.\d+)\s*$/);
    if (m) return m[1]!;
  }
  return "unknown";
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
// v7.0.0 BLE cut: extractSections/extractSubsystems/extractPrinciples deleted.
// Subsystem Reference duplicated CLAUDE.md (both always resident); Founding
// Principles + section list live in the master doc (pull); Instruction
// Hierarchy duplicated the system prompt § Context Hierarchy.

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

// The summary is a ROUTER, not an archive: one line per pipeline plus a doc pointer,
// with wiring detail staying in the master doc.
// Pipeline NAMES come from the master doc's topology table (so new pipelines
// surface automatically); descriptions come from this curated map. An unmapped
// pipeline falls back to a truncated master-doc cell and warns on stderr so
// the map gets updated rather than silently drifting.
const PIPELINE_ROUTER: Record<string, { what: string; doc: string }> = {
  "Security": { what: "Constitutional security protocol, native denylist, safety-classifier hooks; deployed estate scanned hourly server-side by the Workflows scanner = the Bunker Security plane", doc: "Security/README.md" },
  "Algorithm": { what: "Outcome-driven ISA execution — articulate done, hill-climb, close criteria on tool evidence", doc: "Algorithm/AlgorithmSystem.md" },
  "Cortex (Memory)": { what: "Cortex, the memory system — autonomic capture, tiered curation, and retrieval across hot-layer, KNOWLEDGE, LEARNING", doc: "Memory/MemorySystem.md" },
  "Router": { what: "Who runs what, on which model, at what effort — agents named for their model, lanes in one registry, spoken levels as aliases, the route trail beside every dispatch; `bun LIFEOS/ROUTER/Router.ts`", doc: "Router/RouterSystem.md" },
  "Hooks": { what: "Deterministic enforcement and context injection at Claude Code events", doc: "Hooks/HookSystem.md" },
  "Observability": { what: "Tool activity and failures appended to JSONL, read by Pulse", doc: "Observability/ObservabilitySystem.md" },
  "Pulse": { what: "The Life Dashboard server on :31337 — voice, work kanban, wiki, iMessage/Siri", doc: "Pulse/PulseSystem.md" },
  "Work System": { what: "Four capture surfaces feeding private GitHub Issues as system of record", doc: "Work/WorkSystem.md" },
  "Skills": { what: "Domain capabilities: SKILL.md + intents + deterministic tools", doc: "Skills/SkillSystem.md" },
  "Config": { what: "settings.json, CLAUDE.md, system prompt; release tooling stages public artifacts", doc: "Config/ConfigSystem.md" },
  "Notifications": { what: "Voice notifications via Pulse to Fish Audio, logged to VOICE events", doc: "Notifications/NotificationSystem.md" },
  "Doc Integrity": { what: "SessionEnd-hook cross-reference checks; regenerates this summary from the master doc", doc: "Hooks/HookSystem.md" },
  "Bunker": { what: "Universal application harness — app state-of-record bunker.isa.md; Pulse /bunker tab; Security plane IS the Workflows infra-security scanner (server-side, hourly); reference implementation is private — the release ships the concept doc", doc: "Bunker/BunkerSystem.md" },
  "Atlas": { what: "Graph-based asset management — the current state of everything owned; `atlas` CLI (owns/blast/unregistered), Pulse /atlas", doc: "Atlas/AtlasSystem.md" },
  "Ledger": { what: "Change-tracking authority — versioning, update registry, integrity gate, deploy events (the APPLIED half of the change pipeline)", doc: "Ledger/LedgerSystem.md" },
};

const ROW_FALLBACK_MAX = 140;

/** Condense the verbatim topology section into a one-line-per-pipeline router */
function condenseTopology(section: string): string {
  const out: string[] = [
    "## Pipeline Router",
    "",
    "One line per pipeline. Full wiring, file inventories, and incident notes: master doc § Pipeline Topology.",
    "",
    "| Pipeline | What it is | Doc |",
    "|----------|------------|-----|",
  ];
  for (const line of section.split("\n")) {
    const m = line.match(/^\| \*\*(.+?)\*\* \| (.+) \|\s*$/);
    if (!m) continue;
    const name = m[1];
    const entry = PIPELINE_ROUTER[name];
    if (entry) {
      out.push(`| **${name}** | ${entry.what} | \`LIFEOS/DOCUMENTATION/${entry.doc}\` |`);
    } else {
      console.error(`WARN: pipeline "${name}" missing from PIPELINE_ROUTER map — add a one-liner (fallback used)`);
      let cell = m[2].replace(/\\\|/g, "|").trim();
      if (cell.length > ROW_FALLBACK_MAX) cell = cell.slice(0, ROW_FALLBACK_MAX).replace(/\s+\S*$/, "") + " …";
      out.push(`| **${name}** | ${cell.replace(/\|/g, "\\|")} | master doc |`);
    }
  }
  return out.join("\n");
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
  const topology = extractTopology(archContent);
  const lifeosVersion = detectLifeosVersion();
  const algorithmVersion = detectAlgorithmVersion();
  const systemPromptVersion = detectSystemPromptVersion();
  const memoryVersion = detectMemoryVersion();

  // Build the summary — frontmatter first (lifeos-freshness-v1 convention).
  // Auto-generated derivative; effective freshness inherits from derived_from.
  const nowIso = new Date().toISOString();
  const lines: string[] = [
    "---",
    `last_updated: ${nowIso}`,
    "last_updated_by: ArchitectureSummaryGenerator",
    "convention: lifeos-freshness-v1",
    "derived_from: LIFEOS/DOCUMENTATION/LifeosSystemArchitecture.md",
    "generator: LIFEOS/TOOLS/ArchitectureSummaryGenerator.ts",
    "---",
    "",
    "# LifeOS Architecture Summary",
    "",
    "> Auto-generated — do not edit (source + generator in frontmatter).",
    "",
    "## Overview",
    "",
    "LifeOS — the **Life Operating System** — is the AI harness that moves you from your current state to your ideal state: an intent engineering platform that captures what you're ultimately trying to achieve and conveys that intent to your AI on every task, then verifies the output against it.",
    "Everything below is the machinery of that one loop: Current State → Ideal State via verifiable iteration (ISC). Canonical thesis: `LIFEOS/DOCUMENTATION/LifeOs/LifeOsThesis.md`.",
    "",
    `**Current versions:** LifeOS ${lifeosVersion} | Algorithm v${algorithmVersion} | System Prompt v${systemPromptVersion} | Cortex (Memory) v${memoryVersion}`,
    "",
    "Doc routing lives in CLAUDE.md; founding principles + full section map in the master doc.",
    "",
    // BLE 2026-08-23: the per-pipeline router table duplicated CLAUDE.md's System Docs routing
    // (same 13 docs, glossed twice in every turn's context) — one pointer line replaces it.
    ...(topology ? ["Pipeline wiring: master doc § Pipeline Topology; per-system doc routing lives in CLAUDE.md § LifeOS System Docs.", ""] : []),
    "## Cross-References",
    "",
    "- Full architecture: `LIFEOS/DOCUMENTATION/LifeosSystemArchitecture.md`",
    `- Algorithm spec: \`LIFEOS/ALGORITHM/v${algorithmVersion}.md\``,
    "- ISA format: `LIFEOS/DOCUMENTATION/ISA/ISAFormat.md`",
    "- Config system: `LIFEOS/DOCUMENTATION/Config/ConfigSystem.md`",
    "",
  ];

  return lines.join("\n");
}

// ============================================================================
// Commands
// ============================================================================

const withoutStamp = (s: string): string => s.replace(/^last_updated: .*$/m, "");

function cmdGenerate(): void {
  // Write the header-mirror block in the same write. Without it the file sat mirror-less
  // until DerivedSync re-added the block ~30 s later, and a session starting in that gap missed the prompt cache.
  const summary = renderMirror(generate());
  // Stamp-only rewrites dirtied git after most sessions; keep the bytes and bump
  // mtime so RebuildArchSummary's mtime check settles (public issue #2200, @corobis).
  if (fs.existsSync(SUMMARY_OUTPUT) && withoutStamp(fs.readFileSync(SUMMARY_OUTPUT, "utf-8")) === withoutStamp(summary)) {
    const now = new Date();
    fs.utimesSync(SUMMARY_OUTPUT, now, now);
    console.log(`Unchanged ${SUMMARY_OUTPUT} (mtime bumped)`);
    return;
  }
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
  const claudeMdMtime = getMtime(path.join(getClaudeDir(), "CLAUDE.md"));

  if (sourceMtime > summaryMtime || claudeMdMtime > summaryMtime) {
    console.log("STALE: Source files are newer than summary");
    process.exit(1);
  }

  // Version drift check: the master doc shouldn't mention an older Algorithm version than ALGORITHM/
  // Only Algorithm-QUALIFIED mentions count ("Algorithm v8.4.0", "ALGORITHM/v8.4.0.md") — the doc
  // legitimately cites hook/Memory/Bunker versions and historical notes, and a bare-semver match
  // flagged all of them as drift, making --check permanently fail (public issue #1501).
  let archContent = fs.readFileSync(ARCH_SOURCE, "utf-8");
  // public PR #2126, @pai-scaffolde: skip the append-only Architecture Decisions log when checking for drift
  const decisionsIndex = archContent.indexOf('\n## Architecture Decisions');
  if (decisionsIndex > -1) {
    archContent = archContent.slice(0, decisionsIndex);
  }
  const current = detectAlgorithmVersion();
  const cited = [...archContent.matchAll(/(?:Algorithm\s+v|ALGORITHM\/v)(\d+\.\d+\.\d+)/gi)].map(m => m[1]);
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
  generate    Generate/regenerate ARCHITECTURE_SUMMARY.md
  check       Check if summary is stale (exit 1 if stale)`);
    process.exit(command ? 1 : 0);
}
