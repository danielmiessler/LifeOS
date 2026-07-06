#!/usr/bin/env bun
/**
 * SessionHarvester - Extract learnings from Claude Code session transcripts
 *
 * Harvests insights from ~/.claude/projects/ sessions and writes to LEARNING/
 *
 * Commands:
 *   --recent N     Harvest from N most recent sessions (default: 10)
 *   --all          Harvest from all sessions modified in last 7 days
 *   --session ID   Harvest from specific session UUID
 *   --dry-run      Show what would be harvested without writing
 *   --mine         Mine conversations for decisions, preferences, milestones, problems
 *
 * Examples:
 *   bun run SessionHarvester.ts --recent 5
 *   bun run SessionHarvester.ts --session abc-123
 *   bun run SessionHarvester.ts --all --dry-run
 *   bun run SessionHarvester.ts --mine --recent 5
 *   bun run SessionHarvester.ts --mine --recent 10 --dry-run
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { getLearningCategory, isLearningCapture } from "../../hooks/lib/learning-utils";
import { getClaudeDir } from "./Paths";

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = getClaudeDir();
// Derive the project slug dynamically from CLAUDE_DIR (works on macOS and Linux)
// macOS: ${HOME}/.claude → ${HARNESS_USER_DIR}
// Linux: ${HOME}/.claude → ${HARNESS_USER_DIR}
const CWD_SLUG = CLAUDE_DIR.replace(/[\/\.]/g, "-");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects", CWD_SLUG);
const LEARNING_DIR = path.join(CLAUDE_DIR, "LIFEOS", "MEMORY", "LEARNING");

// Patterns indicating learning moments in conversations
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

// Memory mining patterns — extract structured knowledge from conversations
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

type MemoryType = 'decision' | 'preference' | 'milestone' | 'problem';

const MINING_PATTERN_MAP: Record<MemoryType, RegExp[]> = {
  decision: DECISION_PATTERNS,
  preference: PREFERENCE_PATTERNS,
  milestone: MILESTONE_PATTERNS,
  problem: PROBLEM_PATTERNS,
};

// ============================================================================
// Types
// ============================================================================

interface ProjectsEntry {
  sessionId?: string;
  type?: "user" | "assistant" | "summary";
  message?: {
    role?: string;
    content?: string | Array<{
      type: string;
      text?: string;
      name?: string;
      input?: any;
    }>;
  };
  timestamp?: string;
}

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
  category: 'SYSTEM' | 'ALGORITHM';
  type: 'correction' | 'error' | 'insight';
  context: string;
  content: string;
  source: string;
}

// ============================================================================
// Session File Discovery
// ============================================================================

function getSessionFiles(options: {
  recent?: number;
  all?: boolean;
  sessionId?: string;
  projectsDir?: string;
}): string[] {
  const dir = options.projectsDir ?? PROJECTS_DIR;
  if (!fs.existsSync(dir)) {
    console.error(`Projects directory not found: ${dir}`);
    return [];
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (options.sessionId) {
    const match = files.find(f => f.name.includes(options.sessionId!));
    return match ? [match.path] : [];
  }

  if (options.all) {
    // Archive mode: when --projects-dir is set, skip the 7-day filter.
    // Archives are old by definition; the filter would reject everything.
    if (options.projectsDir) return files.map(f => f.path);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return files.filter(f => f.mtime > sevenDaysAgo).map(f => f.path);
  }

  const limit = options.recent || 10;
  return files.slice(0, limit).map(f => f.path);
}

// ============================================================================
// Content Extraction
// ============================================================================

function extractTextContent(content: string | Array<any>): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join('\n');
  }

  return '';
}

function matchesPatterns(text: string, patterns: RegExp[]): { matches: boolean; matchedPattern: string | null } {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return { matches: true, matchedPattern: pattern.source };
    }
  }
  return { matches: false, matchedPattern: null };
}

// ============================================================================
// Learning Extraction
// ============================================================================

function harvestLearnings(sessionPath: string): HarvestedLearning[] {
  const learnings: HarvestedLearning[] = [];
  const sessionId = path.basename(sessionPath, '.jsonl');

  const content = fs.readFileSync(sessionPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  let previousContext = '';

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as ProjectsEntry;

      if (!entry.message?.content) continue;

      const textContent = extractTextContent(entry.message.content);
      if (!textContent || textContent.length < 20) continue;

      const timestamp = entry.timestamp || new Date().toISOString();

      // Check for corrections (user messages)
      if (entry.type === 'user') {
        const { matches, matchedPattern } = matchesPatterns(textContent, CORRECTION_PATTERNS);
        if (matches) {
          learnings.push({
            sessionId,
            timestamp,
            category: getLearningCategory(textContent),
            type: 'correction',
            context: previousContext.slice(0, 200),
            content: textContent.slice(0, 500),
            source: matchedPattern || 'correction'
          });
        }
        previousContext = textContent;
      }

      // Check for errors (assistant messages with error patterns)
      if (entry.type === 'assistant') {
        const { matches: errorMatch, matchedPattern: errorPattern } = matchesPatterns(textContent, ERROR_PATTERNS);
        if (errorMatch) {
          // Only capture if it seems like a real error being addressed
          if (isLearningCapture(textContent)) {
            learnings.push({
              sessionId,
              timestamp,
              category: getLearningCategory(textContent),
              type: 'error',
              context: previousContext.slice(0, 200),
              content: textContent.slice(0, 500),
              source: errorPattern || 'error'
            });
          }
        }

        // Check for insights
        const { matches: insightMatch, matchedPattern: insightPattern } = matchesPatterns(textContent, INSIGHT_PATTERNS);
        if (insightMatch) {
          learnings.push({
            sessionId,
            timestamp,
            category: getLearningCategory(textContent),
            type: 'insight',
            context: previousContext.slice(0, 200),
            content: textContent.slice(0, 500),
            source: insightPattern || 'insight'
          });
        }

        previousContext = textContent;
      }
    } catch {
      // Skip malformed lines
    }
  }

  return learnings;
}

// ============================================================================
// Memory Mining
// ============================================================================

function mineMemories(sessionPath: string): MinedMemory[] {
  const memories: MinedMemory[] = [];
  const sessionId = path.basename(sessionPath, '.jsonl');

  const content = fs.readFileSync(sessionPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    try {
      const entry = JSON.parse(lines[lineIdx]) as ProjectsEntry;

      if (!entry.message?.content) continue;
      if (entry.type !== 'user' && entry.type !== 'assistant') continue;

      const textContent = extractTextContent(entry.message.content);
      if (!textContent || textContent.length < 20) continue;

      const timestamp = entry.timestamp || new Date().toISOString();

      for (const [memType, patterns] of Object.entries(MINING_PATTERN_MAP) as [MemoryType, RegExp[]][]) {
        let matchCount = 0;
        let firstMatchedPattern = '';

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
          sourceLine: lineIdx + 1,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Deduplicate: if two candidates from same session have >80% content overlap, keep higher confidence
  const deduped: MinedMemory[] = [];
  for (const mem of memories) {
    const overlap = deduped.findIndex(existing => contentOverlap(existing.content, mem.content) > 0.8);
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
  // Simple character-level overlap ratio
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  return matches / longer.length;
}

function confidenceIcon(c: number): string {
  if (c >= 0.8) return "\u{1F7E2}";  // green circle
  if (c >= 0.5) return "\u{1F7E1}";  // yellow circle
  return "\u{1F534}";                  // red circle
}

const HARVEST_QUEUE_DIR = path.join(CLAUDE_DIR, "LIFEOS", "MEMORY", "KNOWLEDGE", "_harvest-queue");

function writeToQueue(mem: MinedMemory): string {
  if (!fs.existsSync(HARVEST_QUEUE_DIR)) {
    fs.mkdirSync(HARVEST_QUEUE_DIR, { recursive: true });
  }

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sessionShort = mem.sessionId.slice(0, 8);
  const filename = `mine_${ts}_${mem.memoryType}_${sessionShort}_L${mem.sourceLine}.json`;
  const filepath = path.join(HARVEST_QUEUE_DIR, filename);

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

  fs.writeFileSync(filepath, JSON.stringify(candidate, null, 2));
  return filepath;
}

// ============================================================================
// Learning File Generation
// ============================================================================

function getMonthDir(category: 'SYSTEM' | 'ALGORITHM'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthDir = path.join(LEARNING_DIR, category, `${year}-${month}`);

  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir, { recursive: true });
  }

  return monthDir;
}

function generateLearningFilename(learning: HarvestedLearning): string {
  const date = new Date(learning.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toISOString().split('T')[1].slice(0, 5).replace(':', '');
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

*Harvested by SessionHarvester from projects/ transcript*
`;
}

function writeLearning(learning: HarvestedLearning): string {
  const monthDir = getMonthDir(learning.category);
  const filename = generateLearningFilename(learning);
  const filepath = path.join(monthDir, filename);

  // Skip if file already exists
  if (fs.existsSync(filepath)) {
    return filepath + ' (skipped - exists)';
  }

  const content = formatLearningFile(learning);
  fs.writeFileSync(filepath, content);

  return filepath;
}

// ============================================================================
// CLI
// ============================================================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    recent: { type: "string" },
    all: { type: "boolean" },
    session: { type: "string" },
    "projects-dir": { type: "string" },
    "dry-run": { type: "boolean" },
    mine: { type: "boolean", short: "m" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(`
SessionHarvester - Extract learnings from Claude Code session transcripts

Usage:
  bun run SessionHarvester.ts --recent 10    Harvest from 10 most recent sessions
  bun run SessionHarvester.ts --all          Harvest from all sessions (7 days)
  bun run SessionHarvester.ts --session ID            Harvest from specific session
  bun run SessionHarvester.ts --projects-dir PATH     Override PROJECTS_DIR (e.g. v4 archive or sibling cwd); skips 7-day --all filter when set
  bun run SessionHarvester.ts --dry-run               Preview without writing files
  bun run SessionHarvester.ts --mine                  Mine conversations for decisions, preferences, milestones, problems

Mining examples:
  bun run SessionHarvester.ts --mine --recent 5
  bun run SessionHarvester.ts --mine --recent 10 --dry-run

Output:
  Harvest: MEMORY/LEARNING/{ALGORITHM|SYSTEM}/YYYY-MM/
  Mine:    MEMORY/KNOWLEDGE/_harvest-queue/ (review queue)
`);
  process.exit(0);
}

// Get sessions to process
const sessionFiles = getSessionFiles({
  recent: values.recent ? parseInt(values.recent) : undefined,
  all: values.all,
  sessionId: values.session,
  projectsDir: values["projects-dir"]
});

if (sessionFiles.length === 0) {
  console.log("No sessions found to harvest");
  process.exit(0);
}

// Mining mode
if (values.mine) {
  console.log(`\u{1F50D} Mining ${sessionFiles.length} session(s) for memory candidates...`);
  let totalMined = 0;
  for (const session of sessionFiles) {
    const memories = mineMemories(session);
    if (memories.length === 0) continue;
    console.log(`\n\u{1F4CB} ${path.basename(session, '.jsonl').slice(0, 8)}: ${memories.length} candidate(s)`);
    for (const mem of memories) {
      if (!values["dry-run"]) {
        writeToQueue(mem);
      }
      console.log(`  ${confidenceIcon(mem.confidence)} [${mem.memoryType}] ${mem.content.substring(0, 80)}... (${(mem.confidence * 100).toFixed(0)}%)`);
      totalMined++;
    }
  }
  console.log(`\n\u{2705} ${totalMined} candidate(s) ${values["dry-run"] ? "found (dry run)" : "queued for review"}`);
  if (!values["dry-run"] && totalMined > 0) {
    console.log(`  Review: bun KnowledgeHarvester.ts harvest --source queue`);
  }
  process.exit(0);
}

console.log(`\u{1F50D} Scanning ${sessionFiles.length} session(s)...`);

// Harvest learnings from each session
let totalLearnings = 0;
const allLearnings: HarvestedLearning[] = [];

for (const sessionFile of sessionFiles) {
  const sessionName = path.basename(sessionFile, '.jsonl').slice(0, 8);
  const learnings = harvestLearnings(sessionFile);

  if (learnings.length > 0) {
    console.log(`  📂 ${sessionName}: ${learnings.length} learning(s)`);
    allLearnings.push(...learnings);
    totalLearnings += learnings.length;
  }
}

if (totalLearnings === 0) {
  console.log("✅ No new learnings found");
  process.exit(0);
}

console.log(`\n📊 Found ${totalLearnings} learning(s)`);
console.log(`   - Corrections: ${allLearnings.filter(l => l.type === 'correction').length}`);
console.log(`   - Errors: ${allLearnings.filter(l => l.type === 'error').length}`);
console.log(`   - Insights: ${allLearnings.filter(l => l.type === 'insight').length}`);

if (values["dry-run"]) {
  console.log("\n🔍 DRY RUN - Would write:");
  for (const learning of allLearnings) {
    const monthDir = getMonthDir(learning.category);
    const filename = generateLearningFilename(learning);
    console.log(`   ${learning.category}/${path.basename(monthDir)}/${filename}`);
  }
} else {
  console.log("\n✍️  Writing learning files...");
  for (const learning of allLearnings) {
    const result = writeLearning(learning);
    console.log(`   ✅ ${path.basename(result)}`);
  }
  console.log(`\n✅ Harvested ${totalLearnings} learning(s) to MEMORY/LEARNING/`);
}
