#!/usr/bin/env bun
/**
 * RelationshipReflect.ts - Periodic reflection on relationship growth
 *
 * PURPOSE:
 * Runs daily or on-demand to evolve the relationship files based on
 * accumulated evidence from sessions.
 *
 * USAGE:
 *   bun RelationshipReflect.ts                    # Full reflection
 *   bun RelationshipReflect.ts --opinions-only    # Just update opinion confidence
 *   bun RelationshipReflect.ts --milestones-only  # Just check for milestones
 *   bun RelationshipReflect.ts --dry-run          # Show what would change
 *
 * ACTIONS:
 * 1. Scan MEMORY/RELATIONSHIP/ for recent notes
 * 2. Update OPINIONS.md confidence scores based on evidence
 * 3. Update ABOUT_USER.md patterns and preferences
 * 4. Check for milestone achievements → OUR_STORY.md
 * 5. Queue soul updates if significant patterns emerge
 *
 * NOTIFICATION:
 * - Major confidence shifts (>0.15) trigger notification
 * - Milestone achievements trigger notification
 * - Soul evolution proposals trigger notification
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');

interface RelationshipNote {
  type: 'W' | 'B' | 'O';
  entity: string;
  content: string;
  confidence?: number;
  date: string;
}

interface OpinionEvidence {
  statement: string;
  supporting: number;
  counter: number;
  confirmations: number;
  contradictions: number;
}

interface ReflectionResult {
  opinionsUpdated: number;
  majorShifts: string[];
  milestonesDetected: string[];
  soulUpdatesQueued: number;
}

// Milestone definitions to check against
const MILESTONES = [
  {
    id: 'first-pushback',
    description: 'First time {DAIDENTITY.NAME} correctly pushed back on {PRINCIPAL.NAME}\'s approach',
    pattern: /pushed back|disagreed|suggested alternative|recommended against/i,
    detected: false
  },
  {
    id: 'genuine-unknown',
    description: 'First genuine "I don\'t know" that led to discovery',
    pattern: /don't know|uncertain|not sure|discovered|found out/i,
    detected: false
  },
  {
    id: 'voice-smile',
    description: 'First voice notification that made {PRINCIPAL.NAME} smile',
    pattern: /voice.*(?:worked|success)|notification.*(?:good|great|smile)/i,
    detected: false
  },
  {
    id: '100-sessions',
    description: '100 sessions working together',
    pattern: null, // Checked differently
    detected: false
  }
];

/**
 * Get ISO date string
 */
function getISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get PST date components
 */
function getPSTComponents(): { year: string; month: string; day: string } {
  const now = new Date();
  const pst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return {
    year: pst.getFullYear().toString(),
    month: String(pst.getMonth() + 1).padStart(2, '0'),
    day: String(pst.getDate()).padStart(2, '0')
  };
}

/**
 * Parse relationship notes from a daily file
 */
function parseRelationshipNotes(content: string, date: string): RelationshipNote[] {
  const notes: RelationshipNote[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) continue;

    const noteContent = trimmed.substring(2);

    // Parse W/B/O type
    const typeMatch = noteContent.match(/^([WBO])(?:\(c=([\d.]+)\))?\s+(@\w+):\s*(.+)$/);
    if (typeMatch) {
      notes.push({
        type: typeMatch[1] as 'W' | 'B' | 'O',
        entity: typeMatch[3],
        content: typeMatch[4],
        confidence: typeMatch[2] ? parseFloat(typeMatch[2]) : undefined,
        date
      });
    }
  }

  return notes;
}

/**
 * Load all recent relationship notes
 */
function loadRecentNotes(daysBack: number = 7): RelationshipNote[] {
  const allNotes: RelationshipNote[] = [];
  const { year, month } = getPSTComponents();

  // Check current and previous month
  const months = [`${year}-${month}`];
  if (parseInt(month) === 1) {
    months.push(`${parseInt(year) - 1}-12`);
  } else {
    months.push(`${year}-${String(parseInt(month) - 1).padStart(2, '0')}`);
  }

  for (const monthStr of months) {
    const monthDir = join(PAI_DIR, 'MEMORY/RELATIONSHIP', monthStr);
    if (!existsSync(monthDir)) continue;

    try {
      const files = readdirSync(monthDir)
        .filter(f => f.endsWith('.md') && f !== 'INDEX.md')
        .sort()
        .reverse()
        .slice(0, daysBack);

      for (const file of files) {
        const content = readFileSync(join(monthDir, file), 'utf-8');
        const date = file.replace('.md', '');
        const notes = parseRelationshipNotes(content, date);
        allNotes.push(...notes);
      }
    } catch {}
  }

  return allNotes;
}

/**
 * Load recent ratings from ratings.jsonl
 */
function loadRecentRatings(daysBack: number = 7): Array<{ rating: number; date: string }> {
  const ratingsPath = join(PAI_DIR, 'MEMORY/LEARNING/SIGNALS/ratings.jsonl');
  if (!existsSync(ratingsPath)) return [];

  const ratings: Array<{ rating: number; date: string }> = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  try {
    const content = readFileSync(ratingsPath, 'utf-8');
    for (const line of content.trim().split('\n')) {
      try {
        const entry = JSON.parse(line);
        const entryDate = new Date(entry.timestamp || entry.date);
        if (entryDate >= cutoff) {
          ratings.push({
            rating: entry.rating,
            date: entryDate.toISOString().split('T')[0]
          });
        }
      } catch {}
    }
  } catch {}

  return ratings;
}

/**
 * Aggregate evidence for each opinion
 */
function aggregateEvidence(notes: RelationshipNote[], ratings: Array<{ rating: number; date: string }>): Map<string, OpinionEvidence> {
  const evidence = new Map<string, OpinionEvidence>();

  // Count positive and negative sentiment from ratings
  let positiveRatings = 0;
  let negativeRatings = 0;
  for (const r of ratings) {
    if (r.rating >= 4) positiveRatings++;
    if (r.rating <= 2) negativeRatings++;
  }

  // Pattern matching for common opinion topics
  const opinionPatterns: Array<{ statement: string; supportPattern: RegExp; counterPattern: RegExp }> = [
    {
      statement: '{PRINCIPAL.NAME} prefers concise responses for simple tasks',
      supportPattern: /concise|brief|short|direct/i,
      counterPattern: /too short|need more|elaborate/i
    },
    {
      statement: '{PRINCIPAL.NAME} values verification over claims of completion',
      supportPattern: /verif|test|confirm|check|proof/i,
      counterPattern: /just do it|skip test|trust me/i
    },
    {
      statement: '{PRINCIPAL.NAME} appreciates when I catch my own mistakes',
      supportPattern: /catch|found|notice|correct.*mistake|self-correct/i,
      counterPattern: /didn't notice|missed|should have/i
    }
  ];

  for (const pattern of opinionPatterns) {
    const ev: OpinionEvidence = {
      statement: pattern.statement,
      supporting: 0,
      counter: 0,
      confirmations: 0,
      contradictions: 0
    };

    for (const note of notes) {
      if (pattern.supportPattern.test(note.content)) {
        ev.supporting++;
      }
      if (pattern.counterPattern.test(note.content)) {
        ev.counter++;
      }
    }

    // High ratings = supporting evidence for positive opinions
    ev.supporting += Math.floor(positiveRatings / 3);
    ev.counter += Math.floor(negativeRatings / 2);

    evidence.set(pattern.statement.toLowerCase(), ev);
  }

  return evidence;
}

/**
 * Parse current opinions from OPINIONS.md
 */
function parseOpinions(): Map<string, { confidence: number; section: string }> {
  const opinions = new Map<string, { confidence: number; section: string }>();
  const opinionsPath = join(PAI_DIR, 'skills/PAI/USER/OPINIONS.md');

  if (!existsSync(opinionsPath)) return opinions;

  const content = readFileSync(opinionsPath, 'utf-8');
  const blocks = content.split(/^### /gm).slice(1);

  for (const block of blocks) {
    const lines = block.split('\n');
    const statement = lines[0]?.trim();
    const confidenceMatch = block.match(/\*\*Confidence:\*\*\s*([\d.]+)/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

    // Determine section from surrounding context
    const sectionMatch = content.substring(0, content.indexOf(block)).match(/## (\w+) Opinions/gi);
    const section = sectionMatch ? sectionMatch[sectionMatch.length - 1] : 'relationship';

    if (statement) {
      opinions.set(statement.toLowerCase(), { confidence, section });
    }
  }

  return opinions;
}

/**
 * Update opinion confidence based on evidence
 */
function updateOpinionConfidence(
  evidence: Map<string, OpinionEvidence>,
  dryRun: boolean
): { updated: number; majorShifts: string[] } {
  const opinionsPath = join(PAI_DIR, 'skills/PAI/USER/OPINIONS.md');
  if (!existsSync(opinionsPath)) return { updated: 0, majorShifts: [] };

  let content = readFileSync(opinionsPath, 'utf-8');
  const currentOpinions = parseOpinions();
  let updated = 0;
  const majorShifts: string[] = [];

  for (const [key, ev] of evidence) {
    const current = currentOpinions.get(key);
    if (!current) continue;

    // Calculate confidence change
    const supportingDelta = ev.supporting * 0.02;
    const counterDelta = ev.counter * -0.05;
    const confirmDelta = ev.confirmations * 0.10;
    const contradictDelta = ev.contradictions * -0.20;

    const totalDelta = supportingDelta + counterDelta + confirmDelta + contradictDelta;

    if (Math.abs(totalDelta) < 0.01) continue; // No meaningful change

    const newConfidence = Math.max(0.01, Math.min(0.99, current.confidence + totalDelta));
    const actualDelta = newConfidence - current.confidence;

    if (Math.abs(actualDelta) >= 0.15) {
      majorShifts.push(`${key}: ${(current.confidence * 100).toFixed(0)}% → ${(newConfidence * 100).toFixed(0)}%`);
    }

    if (!dryRun && Math.abs(actualDelta) >= 0.01) {
      // Find and update the confidence in the file
      const pattern = new RegExp(
        `(###\\s+${escapeRegex(key.charAt(0).toUpperCase() + key.slice(1))}[\\s\\S]*?\\*\\*Confidence:\\*\\*\\s*)(\\d\\.\\d+)`,
        'i'
      );
      if (pattern.test(content)) {
        content = content.replace(pattern, `$1${newConfidence.toFixed(2)}`);
        updated++;
      }
    }
  }

  if (!dryRun && updated > 0) {
    // Update last updated dates
    const today = getISODate();
    content = content.replace(/\*Last updated: \d{4}-\d{2}-\d{2}\*/g, `*Last updated: ${today}*`);
    writeFileSync(opinionsPath, content);
  }

  return { updated, majorShifts };
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check for milestone achievements
 */
function checkMilestones(notes: RelationshipNote[]): string[] {
  const achieved: string[] = [];
  const storyPath = join(PAI_DIR, 'skills/PAI/USER/OUR_STORY.md');

  if (!existsSync(storyPath)) return achieved;

  const storyContent = readFileSync(storyPath, 'utf-8');
  const allNoteText = notes.map(n => n.content).join(' ');

  for (const milestone of MILESTONES) {
    // Skip if already achieved (checked box in story)
    if (storyContent.includes(`[x] ${milestone.description}`)) continue;

    if (milestone.pattern && milestone.pattern.test(allNoteText)) {
      achieved.push(milestone.description);
    }
  }

  return achieved;
}

/**
 * Add milestone to OUR_STORY.md
 */
function addMilestone(description: string, dryRun: boolean): boolean {
  const storyPath = join(PAI_DIR, 'skills/PAI/USER/OUR_STORY.md');
  if (!existsSync(storyPath)) return false;

  let content = readFileSync(storyPath, 'utf-8');

  // Find the unchecked milestone and check it
  const unchecked = `- [ ] ${description}`;
  const checked = `- [x] ${description} *(achieved ${getISODate()})*`;

  if (content.includes(unchecked)) {
    if (!dryRun) {
      content = content.replace(unchecked, checked);
      writeFileSync(storyPath, content);
    }
    return true;
  }

  return false;
}

/**
 * Send notification for major changes
 */
function sendNotification(message: string): void {
  console.log(`[Notification] ${message}`);

  // Use ntfy if available
  try {
    const topic = process.env.NTFY_TOPIC;
    if (topic) {
      execSync(`curl -s -d "${message}" ntfy.sh/${topic} 2>/dev/null || true`, {
        stdio: 'ignore',
        timeout: 3000
      });
    }
  } catch {}
}

/**
 * Main reflection process
 */
async function reflect(options: {
  opinionsOnly?: boolean;
  milestonesOnly?: boolean;
  dryRun?: boolean;
}): Promise<ReflectionResult> {
  const result: ReflectionResult = {
    opinionsUpdated: 0,
    majorShifts: [],
    milestonesDetected: [],
    soulUpdatesQueued: 0
  };

  console.log('\n Relationship Reflection\n');

  // Load recent data
  const notes = loadRecentNotes(7);
  const ratings = loadRecentRatings(7);

  console.log(`Loaded ${notes.length} relationship notes from last 7 days`);
  console.log(`Loaded ${ratings.length} ratings from last 7 days`);

  if (!options.milestonesOnly) {
    // Update opinion confidence
    const evidence = aggregateEvidence(notes, ratings);
    const { updated, majorShifts } = updateOpinionConfidence(evidence, options.dryRun || false);

    result.opinionsUpdated = updated;
    result.majorShifts = majorShifts;

    if (updated > 0) {
      console.log(`\nUpdated ${updated} opinion confidence scores`);
    }

    if (majorShifts.length > 0) {
      console.log('\n Major confidence shifts:');
      for (const shift of majorShifts) {
        console.log(`  - ${shift}`);
        if (!options.dryRun) {
          sendNotification(`Opinion shift: ${shift}`);
        }
      }
    }
  }

  if (!options.opinionsOnly) {
    // Check milestones
    const milestones = checkMilestones(notes);
    result.milestonesDetected = milestones;

    if (milestones.length > 0) {
      console.log('\n Milestones detected:');
      for (const m of milestones) {
        console.log(`  - ${m}`);
        if (!options.dryRun) {
          const added = addMilestone(m, false);
          if (added) {
            sendNotification(`Milestone achieved: ${m}`);
          }
        }
      }
    }
  }

  if (options.dryRun) {
    console.log('\n[DRY RUN] No changes were made');
  }

  console.log('\nReflection complete.\n');

  return result;
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  const options = {
    opinionsOnly: args.includes('--opinions-only'),
    milestonesOnly: args.includes('--milestones-only'),
    dryRun: args.includes('--dry-run')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
RelationshipReflect - Periodic reflection on relationship growth

Usage:
  bun RelationshipReflect.ts [options]

Options:
  --opinions-only    Only update opinion confidence scores
  --milestones-only  Only check for milestone achievements
  --dry-run          Show what would change without making changes
  --help, -h         Show this help

This tool:
  1. Scans MEMORY/RELATIONSHIP/ for recent notes
  2. Updates OPINIONS.md confidence based on evidence
  3. Checks for milestone achievements in OUR_STORY.md
  4. Notifies on major changes (>15% confidence shift)
`);
    process.exit(0);
  }

  await reflect(options);
}

main().catch(console.error);
