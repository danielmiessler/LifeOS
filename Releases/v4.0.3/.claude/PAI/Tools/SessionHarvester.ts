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
 *
 * Examples:
 *   bun run SessionHarvester.ts --recent 5
 *   bun run SessionHarvester.ts --session abc-123
 *   bun run SessionHarvester.ts --all --dry-run
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import { getLearningCategory, isLearningCapture } from "../../hooks/lib/learning-utils";

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = process.env.PAI_DIR || path.join(process.env.HOME!, ".claude");
// Derive the project slug dynamically from CLAUDE_DIR (works on macOS and Linux)
// macOS: ${HOME}/.claude → -Users-username--claude
// Linux: /home/username/.claude → -home-username--claude
const CWD_SLUG = CLAUDE_DIR.replace(/[\/\.]/g, "-");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects", CWD_SLUG);
const LEARNING_DIR = path.join(CLAUDE_DIR, "MEMORY", "LEARNING");

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

function getSessionFiles(options: { recent?: number; all?: boolean; sessionId?: string }): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Projects directory not found: ${PROJECTS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      path: path.join(PROJECTS_DIR, f),
      mtime: fs.statSync(path.join(PROJECTS_DIR, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (options.sessionId) {
    const match = files.find(f => f.name.includes(options.sessionId!));
    return match ? [match.path] : [];
  }

  if (options.all) {
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
    "dry-run": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(`
SessionHarvester - Extract learnings from Claude Code session transcripts

Usage:
  bun run SessionHarvester.ts --recent 10    Harvest from 10 most recent sessions
  bun run SessionHarvester.ts --all          Harvest from all sessions (7 days)
  bun run SessionHarvester.ts --session ID   Harvest from specific session
  bun run SessionHarvester.ts --dry-run      Preview without writing files

Output: Creates learning files in MEMORY/LEARNING/{ALGORITHM|SYSTEM}/YYYY-MM/
`);
  process.exit(0);
}

// Get sessions to process
const sessionFiles = getSessionFiles({
  recent: values.recent ? parseInt(values.recent) : undefined,
  all: values.all,
  sessionId: values.session
});

if (sessionFiles.length === 0) {
  console.log("No sessions found to harvest");
  process.exit(0);
}

console.log(`🔍 Scanning ${sessionFiles.length} session(s)...`);

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
