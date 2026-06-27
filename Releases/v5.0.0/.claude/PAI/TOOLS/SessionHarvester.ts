#!/usr/bin/env bun
/**
 * SessionHarvester - Extract learnings from harness session transcripts
 *
 * Harvests insights from Claude Code or Codex sessions and writes to PAI memory.
 *
 * Commands:
 *   --recent N     Harvest from N most recent sessions (default: 10)
 *   --all          Harvest from all sessions modified in last 7 days
 *   --session ID   Harvest from specific session UUID
 *   --harness X    Force harness source: claude or codex
 *   --dry-run      Show what would be harvested without writing
 *   --mine         Mine conversations for decisions, preferences, milestones, problems
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { getRuntimePaths, type PaiHarness } from "./lib/runtime-paths";
import { readTranscriptMessages } from "./lib/session-transcripts";

// ============================================================================
// Configuration
// ============================================================================

const CORRECTION_PATTERNS = [
  /actually,?\s+/i,
  /wait,?\s+/i,
  /no,?\s+i meant/i,
  /let me clarify/i,
  /that's not (quite )?right/i,
  /you misunderstood/i,
  /i was wrong/i,
  /my mistake/i,
];

const ERROR_PATTERNS = [
  /error:/i,
  /failed:/i,
  /exception:/i,
  /stderr:/i,
  /command failed/i,
  /permission denied/i,
  /not found/i,
];

const INSIGHT_PATTERNS = [
  /learned that/i,
  /realized that/i,
  /discovered that/i,
  /key insight/i,
  /important:/i,
  /note to self/i,
  /for next time/i,
  /lesson:/i,
];

const DECISION_PATTERNS = [
  /(?:we|i) (?:decided|chose|went with|picked|selected)\b/i,
  /(?:let'?s|going to) (?:use|go with|switch to|adopt)\b/i,
  /(?:the )?(?:decision|choice|call) (?:is|was) to\b/i,
  /(?:trade-?off|chose .+ over|prefer .+ to)\b/i,
  /(?:we'?re|i'?m) (?:going with|sticking with)\b/i,
];

const PREFERENCE_PATTERNS = [
  /(?:always|never|don'?t) (?:use|do|add|create|write|make)\b/i,
  /(?:prefer|like|want|hate|avoid)\s+(?:to |using |when )/i,
  /(?:the rule|the convention|our standard) is\b/i,
  /(?:bun|bunx)\s+(?:always|never|not)\b/i,
  /(?:must|should|shall) (?:always|never)\b/i,
];

const MILESTONE_PATTERNS = [
  /(?:it |that |this )(?:works?|worked|shipped|deployed|launched)\b/i,
  /(?:finally|successfully) (?:got|made|built|shipped|deployed|fixed)\b/i,
  /(?:pushed|merged|released|published|completed|finished)\b/i,
  /(?:milestone|breakthrough|shipped it|it'?s live|went live)\b/i,
];

const PROBLEM_PATTERNS = [
  /(?:the )?(?:issue|problem|bug|failure|crash) (?:is|was|seems)\b/i,
  /(?:broke|broken|breaking|fails?|failed|crashing)\b/i,
  /(?:can'?t|couldn'?t|unable to|won'?t|doesn'?t work)\b/i,
  /(?:root cause|caused by|the reason|turns out)\b/i,
  /(?:regression|degraded|degradation|worse than)\b/i,
];

type MemoryType = "decision" | "preference" | "milestone" | "problem";

const MINING_PATTERN_MAP: Record<MemoryType, RegExp[]> = {
  decision: DECISION_PATTERNS,
  preference: PREFERENCE_PATTERNS,
  milestone: MILESTONE_PATTERNS,
  problem: PROBLEM_PATTERNS,
};

// ============================================================================
// Types
// ============================================================================

interface MinedMemory {
  sessionId: string;
  timestamp: string;
  memoryType: MemoryType;
  content: string;
  context: string;
  confidence: number;
  sourcePattern: string;
  sourceLine: number;
}

interface HarvestedLearning {
  sessionId: string;
  timestamp: string;
  category: "SYSTEM" | "ALGORITHM";
  type: "correction" | "error" | "insight";
  context: string;
  content: string;
  source: string;
}

interface RuntimeConfig {
  harness: PaiHarness;
  harnessHome: string;
  paiDir: string;
  sessionsDir: string;
  learningDir: string;
  harvestQueueDir: string;
}

// ============================================================================
// Shared Learning Utilities
// ============================================================================

function getLearningCategory(content: string, comment?: string): "SYSTEM" | "ALGORITHM" {
  const text = `${content} ${comment || ""}`.toLowerCase();
  const algorithmIndicators = [
    /over.?engineer/,
    /wrong approach/,
    /should have asked/,
    /didn't follow/,
    /missed the point/,
    /too complex/,
    /didn't understand/,
    /wrong direction/,
    /not what i wanted/,
    /approach|method|strategy|reasoning/,
  ];
  const systemIndicators = [
    /hook|crash|broken/,
    /tool|config|deploy|path/,
    /import|module|file.*not.*found/,
    /typescript|javascript|npm|bun/,
  ];

  for (const pattern of algorithmIndicators) {
    if (pattern.test(text)) return "ALGORITHM";
  }
  for (const pattern of systemIndicators) {
    if (pattern.test(text)) return "SYSTEM";
  }
  return "ALGORITHM";
}

function isLearningCapture(text: string, summary?: string, analysis?: string): boolean {
  const learningIndicators = [
    /problem|issue|bug|error|failed|broken/i,
    /fixed|solved|resolved|discovered|realized|learned/i,
    /troubleshoot|debug|investigate|root cause/i,
    /lesson|takeaway|now we know|next time/i,
  ];

  const checkText = `${summary || ""} ${analysis || ""} ${text}`;
  let indicatorCount = 0;
  for (const pattern of learningIndicators) {
    if (pattern.test(checkText)) indicatorCount++;
  }

  return indicatorCount >= 2;
}

// ============================================================================
// Runtime and Session File Discovery
// ============================================================================

function normalizeHarness(value: unknown): PaiHarness | undefined {
  return value === "claude" || value === "codex" ? value : undefined;
}

function makeClaudeProjectsDir(harnessHome: string): string {
  const cwdSlug = harnessHome.replace(/[\/\.]/g, "-");
  return path.join(harnessHome, "projects", cwdSlug);
}

function createRuntimeConfig(harnessOverride?: unknown): RuntimeConfig {
  const paths = getRuntimePaths(import.meta.dir);
  const forcedHarness = normalizeHarness(harnessOverride);
  const harness = forcedHarness ?? paths.harness;
  const harnessHome = forcedHarness && !process.env.HARNESS_HOME
    ? path.join(process.env.HOME!, forcedHarness === "claude" ? ".claude" : ".codex")
    : paths.harnessHome;
  const sessionsDir = harness === "codex"
    ? path.join(harnessHome, "sessions")
    : makeClaudeProjectsDir(harnessHome);

  return {
    harness,
    harnessHome,
    paiDir: paths.paiDir,
    sessionsDir,
    learningDir: path.join(paths.paiDir, "MEMORY", "LEARNING"),
    harvestQueueDir: path.join(paths.paiDir, "MEMORY", "KNOWLEDGE", "_harvest-queue"),
  };
}

function walkJsonlFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(entryPath);
      }
    }
  };

  visit(root);
  return files;
}

function getSessionFiles(
  options: { recent?: number; all?: boolean; sessionId?: string },
  runtime: RuntimeConfig,
): string[] {
  if (!fs.existsSync(runtime.sessionsDir)) {
    console.error(`Sessions directory not found: ${runtime.sessionsDir}`);
    return [];
  }

  const files = walkJsonlFiles(runtime.sessionsDir)
    .map((file) => ({
      name: path.basename(file),
      path: file,
      mtime: fs.statSync(file).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (options.sessionId) {
    const match = files.find((file) => file.name.includes(options.sessionId!));
    return match ? [match.path] : [];
  }

  if (options.all) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return files.filter((file) => file.mtime > sevenDaysAgo).map((file) => file.path);
  }

  const limit = options.recent || 10;
  return files.slice(0, limit).map((file) => file.path);
}

// ============================================================================
// Content Extraction
// ============================================================================

function matchesPatterns(text: string, patterns: RegExp[]): { matches: boolean; matchedPattern: string | null } {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return { matches: true, matchedPattern: pattern.source };
    }
  }
  return { matches: false, matchedPattern: null };
}

const TRANSIENT_TOOL_FAILURE_PATTERNS = [
  /command not found/i,
  /cannot find module/i,
  /module not found/i,
  /no such file or directory/i,
  /permission denied/i,
  /missing .*token/i,
  /not found/i,
];

function hasFixOrRootCauseSignal(text: string): boolean {
  return /(?:fixed|solved|resolved|workaround|root cause|turns out|caused by|the reason)/i.test(text);
}

function isTransientToolFailure(text: string): boolean {
  return TRANSIENT_TOOL_FAILURE_PATTERNS.some((pattern) => pattern.test(text)) && !hasFixOrRootCauseSignal(text);
}

// ============================================================================
// Learning Extraction
// ============================================================================

export function harvestLearnings(sessionPath: string, harness: PaiHarness = "claude"): HarvestedLearning[] {
  const learnings: HarvestedLearning[] = [];
  const sessionId = path.basename(sessionPath, ".jsonl");
  const entries = readTranscriptMessages(sessionPath, harness);
  let previousContext = "";

  for (const entry of entries) {
    const textContent = entry.content;
    if (!textContent || textContent.length < 20) continue;

    const timestamp = entry.timestamp || new Date().toISOString();

    if (entry.role === "user") {
      const { matches, matchedPattern } = matchesPatterns(textContent, CORRECTION_PATTERNS);
      if (matches) {
        learnings.push({
          sessionId,
          timestamp,
          category: getLearningCategory(textContent),
          type: "correction",
          context: previousContext.slice(0, 200),
          content: textContent.slice(0, 500),
          source: matchedPattern || "correction",
        });
      }
      previousContext = textContent;
    }

    if (entry.role === "assistant") {
      const { matches: errorMatch, matchedPattern: errorPattern } = matchesPatterns(textContent, ERROR_PATTERNS);
      if (errorMatch && isLearningCapture(textContent)) {
        learnings.push({
          sessionId,
          timestamp,
          category: getLearningCategory(textContent),
          type: "error",
          context: previousContext.slice(0, 200),
          content: textContent.slice(0, 500),
          source: errorPattern || "error",
        });
      }

      const { matches: insightMatch, matchedPattern: insightPattern } = matchesPatterns(textContent, INSIGHT_PATTERNS);
      if (insightMatch) {
        learnings.push({
          sessionId,
          timestamp,
          category: getLearningCategory(textContent),
          type: "insight",
          context: previousContext.slice(0, 200),
          content: textContent.slice(0, 500),
          source: insightPattern || "insight",
        });
      }

      previousContext = textContent;
    }

    if (entry.role === "tool") {
      const { matches: errorMatch, matchedPattern: errorPattern } = matchesPatterns(textContent, ERROR_PATTERNS);
      if (
        entry.status === "error" &&
        errorMatch &&
        !isTransientToolFailure(textContent) &&
        isLearningCapture(textContent, previousContext)
      ) {
        learnings.push({
          sessionId,
          timestamp,
          category: getLearningCategory(textContent),
          type: "error",
          context: previousContext.slice(0, 200),
          content: textContent.slice(0, 500),
          source: entry.toolName ? `tool:${entry.toolName}` : errorPattern || "tool-error",
        });
      }
      previousContext = textContent;
    }
  }

  return learnings;
}

// ============================================================================
// Memory Mining
// ============================================================================

export function mineMemories(sessionPath: string, harness: PaiHarness = "claude"): MinedMemory[] {
  const memories: MinedMemory[] = [];
  const sessionId = path.basename(sessionPath, ".jsonl");
  const entries = readTranscriptMessages(sessionPath, harness);

  for (let lineIdx = 0; lineIdx < entries.length; lineIdx++) {
    const entry = entries[lineIdx];

    if (entry.role !== "user" && entry.role !== "assistant" && entry.role !== "tool") continue;

    const textContent = entry.content;
    if (!textContent || textContent.length < 20) continue;

    const timestamp = entry.timestamp || new Date().toISOString();
    const patternEntries = entry.role === "tool"
      ? [["problem", PROBLEM_PATTERNS] as [MemoryType, RegExp[]]]
      : Object.entries(MINING_PATTERN_MAP) as [MemoryType, RegExp[]][];

    if (entry.role === "tool" && (entry.status !== "error" || isTransientToolFailure(textContent))) {
      continue;
    }

    for (const [memType, patterns] of patternEntries) {
      let matchCount = 0;
      let firstMatchedPattern = "";

      for (const pattern of patterns) {
        if (pattern.test(textContent)) {
          matchCount++;
          if (!firstMatchedPattern) firstMatchedPattern = pattern.source;
        }
      }

      if (matchCount === 0) continue;

      let confidence = Math.min(matchCount / 5.0, 1.0);
      if (textContent.length > 200) confidence = Math.min(confidence + 0.1, 1.0);
      if (confidence < 0.3) continue;

      memories.push({
        sessionId,
        timestamp,
        memoryType: memType,
        content: textContent.slice(0, 500),
        context: textContent.slice(0, 300),
        confidence,
        sourcePattern: firstMatchedPattern,
        sourceLine: entry.sourceLine,
      });
    }
  }

  const deduped: MinedMemory[] = [];
  for (const mem of memories) {
    const overlap = deduped.findIndex((existing) => contentOverlap(existing.content, mem.content) > 0.8);
    if (overlap >= 0) {
      if (mem.confidence > deduped[overlap].confidence) {
        deduped[overlap] = mem;
      }
    } else {
      deduped.push(mem);
    }
  }

  return deduped.sort((a, b) => b.confidence - a.confidence);
}

function contentOverlap(a: string, b: string): number {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length === 0) return 0;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  return matches / longer.length;
}

function confidenceIcon(c: number): string {
  if (c >= 0.8) return "\u{1F7E2}";
  if (c >= 0.5) return "\u{1F7E1}";
  return "\u{1F534}";
}

function writeToQueue(mem: MinedMemory, runtime: RuntimeConfig): string {
  if (!fs.existsSync(runtime.harvestQueueDir)) {
    fs.mkdirSync(runtime.harvestQueueDir, { recursive: true, mode: 0o700 });
  }

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const sessionShort = mem.sessionId.slice(0, 8);
  const filename = `mine_${ts}_${mem.memoryType}_${sessionShort}_L${mem.sourceLine}.json`;
  const filepath = path.join(runtime.harvestQueueDir, filename);

  const candidate = {
    title: `${mem.memoryType}: ${mem.content.substring(0, 60)}...`,
    content: `## ${mem.memoryType.charAt(0).toUpperCase() + mem.memoryType.slice(1)}\n\n${mem.content}\n\n## Context\n\n${mem.context}`,
    domain: "Ideas",
    type: "idea",
    tags: [mem.memoryType, "mined"],
    confidence: mem.confidence,
    sourcePattern: mem.sourcePattern,
    sourcePath: mem.sessionId,
    minedAt: now.toISOString(),
  };

  fs.writeFileSync(filepath, JSON.stringify(candidate, null, 2), { mode: 0o600 });
  return filepath;
}

// ============================================================================
// Learning File Generation
// ============================================================================

function getMonthDir(category: "SYSTEM" | "ALGORITHM", runtime: RuntimeConfig): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthDir = path.join(runtime.learningDir, category, `${year}-${month}`);

  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir, { recursive: true, mode: 0o700 });
  }

  return monthDir;
}

function generateLearningFilename(learning: HarvestedLearning): string {
  const date = new Date(learning.timestamp);
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toISOString().split("T")[1].slice(0, 5).replace(":", "");
  const typeSlug = learning.type;
  const sessionShort = learning.sessionId.slice(0, 8);

  return `${dateStr}_${timeStr}_${typeSlug}_${sessionShort}.md`;
}

function formatLearningFile(learning: HarvestedLearning): string {
  return `# ${learning.type.charAt(0).toUpperCase() + learning.type.slice(1)} Learning

**Session:** ${learning.sessionId}
**Timestamp:** ${learning.timestamp}
**Category:** ${learning.category}
**Source Pattern:** ${learning.source}

---

## Context

${learning.context}

## Learning

${learning.content}

---

*Harvested by SessionHarvester from harness transcript*
`;
}

function writeLearning(learning: HarvestedLearning, runtime: RuntimeConfig): string {
  const monthDir = getMonthDir(learning.category, runtime);
  const filename = generateLearningFilename(learning);
  const filepath = path.join(monthDir, filename);

  if (fs.existsSync(filepath)) {
    return `${filepath} (skipped - exists)`;
  }

  const content = formatLearningFile(learning);
  fs.writeFileSync(filepath, content, { mode: 0o600 });

  return filepath;
}

// ============================================================================
// CLI
// ============================================================================

export function main(argv: string[] = Bun.argv.slice(2)): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      recent: { type: "string" },
      all: { type: "boolean" },
      session: { type: "string" },
      harness: { type: "string" },
      "dry-run": { type: "boolean" },
      mine: { type: "boolean", short: "m" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.harness && !normalizeHarness(values.harness)) {
    console.error(`Invalid harness: ${values.harness}. Expected claude or codex.`);
    process.exit(1);
  }

  if (values.help) {
    console.log(`
SessionHarvester - Extract learnings from harness session transcripts

Usage:
  bun run SessionHarvester.ts --recent 10             Harvest from 10 most recent sessions
  bun run SessionHarvester.ts --all                   Harvest from all sessions (7 days)
  bun run SessionHarvester.ts --session ID            Harvest from specific session
  bun run SessionHarvester.ts --harness codex         Force Codex session source
  bun run SessionHarvester.ts --dry-run               Preview without writing files
  bun run SessionHarvester.ts --mine                  Mine conversations for memory candidates

Mining examples:
  bun run SessionHarvester.ts --mine --recent 5
  bun run SessionHarvester.ts --mine --recent 10 --dry-run

Output:
  Harvest: MEMORY/LEARNING/{ALGORITHM|SYSTEM}/YYYY-MM/
  Mine:    MEMORY/KNOWLEDGE/_harvest-queue/ (review queue)
`);
    process.exit(0);
  }

  const runtime = createRuntimeConfig(values.harness);
  const sessionFiles = getSessionFiles({
    recent: values.recent ? parseInt(values.recent) : undefined,
    all: Boolean(values.all),
    sessionId: values.session,
  }, runtime);

  if (sessionFiles.length === 0) {
    console.log("No sessions found to harvest");
    process.exit(0);
  }

  if (values.mine) {
    console.log(`\u{1F50D} Mining ${sessionFiles.length} ${runtime.harness} session(s) for memory candidates...`);
    let totalMined = 0;
    for (const session of sessionFiles) {
      const memories = mineMemories(session, runtime.harness);
      if (memories.length === 0) continue;
      console.log(`\n\u{1F4CB} ${path.basename(session, ".jsonl").slice(0, 8)}: ${memories.length} candidate(s)`);
      for (const mem of memories) {
        if (!values["dry-run"]) {
          writeToQueue(mem, runtime);
        }
        console.log(`  ${confidenceIcon(mem.confidence)} [${mem.memoryType}] ${mem.content.substring(0, 80)}... (${(mem.confidence * 100).toFixed(0)}%)`);
        totalMined++;
      }
    }
    console.log(`\n\u{2705} ${totalMined} candidate(s) ${values["dry-run"] ? "found (dry run)" : "queued for review"}`);
    if (!values["dry-run"] && totalMined > 0) {
      console.log("  Review: bun KnowledgeHarvester.ts harvest --source queue");
    }
    process.exit(0);
  }

  console.log(`\u{1F50D} Scanning ${sessionFiles.length} ${runtime.harness} session(s)...`);

  let totalLearnings = 0;
  const allLearnings: HarvestedLearning[] = [];

  for (const sessionFile of sessionFiles) {
    const sessionName = path.basename(sessionFile, ".jsonl").slice(0, 8);
    const learnings = harvestLearnings(sessionFile, runtime.harness);

    if (learnings.length > 0) {
      console.log(`  \u{1F4C2} ${sessionName}: ${learnings.length} learning(s)`);
      allLearnings.push(...learnings);
      totalLearnings += learnings.length;
    }
  }

  if (totalLearnings === 0) {
    console.log("\u{2705} No new learnings found");
    process.exit(0);
  }

  console.log(`\n\u{1F4CA} Found ${totalLearnings} learning(s)`);
  console.log(`   - Corrections: ${allLearnings.filter((learning) => learning.type === "correction").length}`);
  console.log(`   - Errors: ${allLearnings.filter((learning) => learning.type === "error").length}`);
  console.log(`   - Insights: ${allLearnings.filter((learning) => learning.type === "insight").length}`);

  if (values["dry-run"]) {
    console.log("\n\u{1F50D} DRY RUN - Would write:");
    for (const learning of allLearnings) {
      const monthDir = getMonthDir(learning.category, runtime);
      const filename = generateLearningFilename(learning);
      console.log(`   ${learning.category}/${path.basename(monthDir)}/${filename}`);
    }
  } else {
    console.log("\n\u{270D}\u{FE0F}  Writing learning files...");
    for (const learning of allLearnings) {
      const result = writeLearning(learning, runtime);
      console.log(`   \u{2705} ${path.basename(result)}`);
    }
    console.log(`\n\u{2705} Harvested ${totalLearnings} learning(s) to MEMORY/LEARNING/`);
  }
}

if (import.meta.main) {
  main();
}
