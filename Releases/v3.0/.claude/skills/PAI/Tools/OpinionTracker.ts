#!/usr/bin/env bun
/**
 * OpinionTracker.ts - Track and evolve confidence-based opinions
 *
 * PURPOSE:
 * Manages the OPINIONS.md file with confidence-tracked beliefs about
 * working with {PRINCIPAL.NAME}. Opinions evolve based on evidence from sessions.
 *
 * USAGE:
 *   bun OpinionTracker.ts add "The user prefers concise responses" --category communication
 *   bun OpinionTracker.ts evidence "The user prefers concise responses" --supporting "Got positive reaction to brief answer"
 *   bun OpinionTracker.ts evidence "The user prefers concise responses" --counter "Long explanation was appreciated"
 *   bun OpinionTracker.ts list
 *   bun OpinionTracker.ts show "The user prefers concise responses"
 *
 * CONFIDENCE UPDATE RULES:
 * - Each supporting instance: +0.02 (capped at 0.99)
 * - Each counter instance: -0.05
 * - Explicit confirmation from {PRINCIPAL.NAME}: +0.10
 * - Explicit contradiction from {PRINCIPAL.NAME}: -0.20
 * - Changes >0.15 trigger notification
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const OPINIONS_FILE = join(PAI_DIR, 'skills/PAI/USER/OPINIONS.md');
const RELATIONSHIP_LOG = join(PAI_DIR, 'MEMORY/RELATIONSHIP');

interface Evidence {
  date: string;
  type: 'supporting' | 'counter' | 'confirmation' | 'contradiction';
  description: string;
  session_id?: string;
}

interface Opinion {
  statement: string;
  confidence: number;
  category: 'communication' | 'technical' | 'relationship' | 'work_style';
  evidence: Evidence[];
  last_updated: string;
  created: string;
}

// Confidence adjustment values
const CONFIDENCE_ADJUSTMENTS = {
  supporting: 0.02,
  counter: -0.05,
  confirmation: 0.10,    // Explicit "yes that's right" from {PRINCIPAL.NAME}
  contradiction: -0.20,  // Explicit "no that's wrong" from {PRINCIPAL.NAME}
};

const NOTIFICATION_THRESHOLD = 0.15;

function getISODate(): string {
  return new Date().toISOString().split('T')[0];
}

function ensureRelationshipDir(): void {
  const monthDir = join(RELATIONSHIP_LOG, new Date().toISOString().slice(0, 7));
  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }
}

/**
 * Parse OPINIONS.md into structured data
 * Note: This is a simplified parser - the file is primarily human-readable
 */
function parseOpinions(): Map<string, Opinion> {
  const opinions = new Map<string, Opinion>();

  if (!existsSync(OPINIONS_FILE)) {
    return opinions;
  }

  const content = readFileSync(OPINIONS_FILE, 'utf-8');

  // Extract opinions from the markdown sections
  // Format: ### Statement\n**Confidence:** 0.XX
  const opinionBlocks = content.split(/^### /gm).slice(1);

  for (const block of opinionBlocks) {
    const lines = block.split('\n');
    const statement = lines[0]?.trim();

    if (!statement) continue;

    const confidenceMatch = block.match(/\*\*Confidence:\*\*\s*([\d.]+)/);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;

    const categoryMatch = block.match(/## (\w+) Opinions/i);
    const category = (categoryMatch?.[1]?.toLowerCase() || 'relationship') as Opinion['category'];

    const lastUpdatedMatch = block.match(/\*Last updated:\s*([^*]+)\*/);
    const lastUpdated = lastUpdatedMatch?.[1]?.trim() || getISODate();

    // Extract evidence from table
    const evidence: Evidence[] = [];
    const tableRows = block.match(/\| (Supporting|Counter) \| ([^|]+) \|/gi) || [];
    for (const row of tableRows) {
      const [, type, desc] = row.match(/\| (Supporting|Counter) \| ([^|]+) \|/i) || [];
      if (type && desc) {
        evidence.push({
          date: getISODate(),
          type: type.toLowerCase() as 'supporting' | 'counter',
          description: desc.trim()
        });
      }
    }

    opinions.set(statement.toLowerCase(), {
      statement,
      confidence,
      category,
      evidence,
      last_updated: lastUpdated,
      created: lastUpdated
    });
  }

  return opinions;
}

/**
 * Add new evidence to an opinion and update confidence
 */
function addEvidence(
  statement: string,
  evidenceType: Evidence['type'],
  description: string,
  sessionId?: string
): { opinion: Opinion; confidenceChange: number; needsNotification: boolean } {
  const opinions = parseOpinions();
  const key = statement.toLowerCase();

  let opinion = opinions.get(key);
  if (!opinion) {
    throw new Error(`Opinion not found: "${statement}"`);
  }

  const oldConfidence = opinion.confidence;
  const adjustment = CONFIDENCE_ADJUSTMENTS[evidenceType];

  // Update confidence (clamped to 0.01 - 0.99)
  opinion.confidence = Math.max(0.01, Math.min(0.99, opinion.confidence + adjustment));
  opinion.last_updated = getISODate();

  // Add evidence
  opinion.evidence.push({
    date: getISODate(),
    type: evidenceType,
    description,
    session_id: sessionId
  });

  const confidenceChange = opinion.confidence - oldConfidence;
  const needsNotification = Math.abs(confidenceChange) >= NOTIFICATION_THRESHOLD;

  // Log to relationship memory
  logRelationshipEvent('opinion_update', {
    statement: opinion.statement,
    old_confidence: oldConfidence,
    new_confidence: opinion.confidence,
    evidence_type: evidenceType,
    description
  });

  return { opinion, confidenceChange, needsNotification };
}

/**
 * Add a new opinion
 */
function addOpinion(
  statement: string,
  category: Opinion['category'],
  initialConfidence: number = 0.5
): Opinion {
  const opinion: Opinion = {
    statement,
    confidence: initialConfidence,
    category,
    evidence: [],
    last_updated: getISODate(),
    created: getISODate()
  };

  logRelationshipEvent('opinion_created', {
    statement,
    category,
    initial_confidence: initialConfidence
  });

  return opinion;
}

/**
 * Log an event to the relationship memory
 */
function logRelationshipEvent(eventType: string, data: Record<string, unknown>): void {
  ensureRelationshipDir();

  const today = getISODate();
  const monthDir = join(RELATIONSHIP_LOG, today.slice(0, 7));
  const logFile = join(monthDir, `${today}.jsonl`);

  const entry = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    ...data
  };

  const line = JSON.stringify(entry) + '\n';

  if (existsSync(logFile)) {
    const existing = readFileSync(logFile, 'utf-8');
    writeFileSync(logFile, existing + line);
  } else {
    writeFileSync(logFile, line);
  }
}

/**
 * Generate notification message for significant opinion change
 */
function generateNotification(
  statement: string,
  oldConfidence: number,
  newConfidence: number,
  evidenceType: Evidence['type']
): string {
  const direction = newConfidence > oldConfidence ? 'increased' : 'decreased';
  const emoji = newConfidence > oldConfidence ? '📈' : '📉';

  return `
${emoji} Opinion Confidence ${direction.toUpperCase()}

**Opinion:** ${statement}
**Change:** ${(oldConfidence * 100).toFixed(0)}% → ${(newConfidence * 100).toFixed(0)}%
**Cause:** ${evidenceType} evidence

This change exceeds the notification threshold (${NOTIFICATION_THRESHOLD * 100}%).
`.trim();
}

/**
 * List all opinions with their confidence levels
 */
function listOpinions(): void {
  const opinions = parseOpinions();

  console.log('\n📊 Current Opinions\n');

  const categories = new Map<string, Opinion[]>();
  for (const opinion of opinions.values()) {
    const list = categories.get(opinion.category) || [];
    list.push(opinion);
    categories.set(opinion.category, list);
  }

  for (const [category, opinionList] of categories) {
    console.log(`\n## ${category.charAt(0).toUpperCase() + category.slice(1)}\n`);

    for (const op of opinionList.sort((a, b) => b.confidence - a.confidence)) {
      const bar = '█'.repeat(Math.round(op.confidence * 10)) +
                  '░'.repeat(10 - Math.round(op.confidence * 10));
      console.log(`  [${bar}] ${(op.confidence * 100).toFixed(0)}% - ${op.statement}`);
    }
  }

  console.log('');
}

/**
 * Show details for a specific opinion
 */
function showOpinion(statement: string): void {
  const opinions = parseOpinions();
  const opinion = opinions.get(statement.toLowerCase());

  if (!opinion) {
    console.error(`Opinion not found: "${statement}"`);
    process.exit(1);
  }

  console.log(`
📋 Opinion Details

**Statement:** ${opinion.statement}
**Confidence:** ${(opinion.confidence * 100).toFixed(0)}%
**Category:** ${opinion.category}
**Created:** ${opinion.created}
**Last Updated:** ${opinion.last_updated}

## Evidence (${opinion.evidence.length} items)
`);

  const supporting = opinion.evidence.filter(e => e.type === 'supporting' || e.type === 'confirmation');
  const counter = opinion.evidence.filter(e => e.type === 'counter' || e.type === 'contradiction');

  if (supporting.length > 0) {
    console.log('### Supporting');
    for (const e of supporting) {
      console.log(`  - [${e.date}] ${e.description}`);
    }
  }

  if (counter.length > 0) {
    console.log('\n### Counter');
    for (const e of counter) {
      console.log(`  - [${e.date}] ${e.description}`);
    }
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'add': {
      const statement = args[1];
      const categoryIdx = args.indexOf('--category');
      const category = (categoryIdx !== -1 ? args[categoryIdx + 1] : 'relationship') as Opinion['category'];

      if (!statement) {
        console.error('Usage: bun OpinionTracker.ts add "statement" [--category communication|technical|relationship|work_style]');
        process.exit(1);
      }

      const opinion = addOpinion(statement, category);
      console.log(`✅ Added opinion: "${statement}" (${category}, confidence: 50%)`);
      break;
    }

    case 'evidence': {
      const statement = args[1];
      const supportingIdx = args.indexOf('--supporting');
      const counterIdx = args.indexOf('--counter');
      const confirmIdx = args.indexOf('--confirmation');
      const contradictIdx = args.indexOf('--contradiction');

      let evidenceType: Evidence['type'];
      let description: string;

      if (supportingIdx !== -1) {
        evidenceType = 'supporting';
        description = args[supportingIdx + 1];
      } else if (counterIdx !== -1) {
        evidenceType = 'counter';
        description = args[counterIdx + 1];
      } else if (confirmIdx !== -1) {
        evidenceType = 'confirmation';
        description = args[confirmIdx + 1];
      } else if (contradictIdx !== -1) {
        evidenceType = 'contradiction';
        description = args[contradictIdx + 1];
      } else {
        console.error('Usage: bun OpinionTracker.ts evidence "statement" --supporting|--counter|--confirmation|--contradiction "description"');
        process.exit(1);
      }

      if (!statement || !description) {
        console.error('Usage: bun OpinionTracker.ts evidence "statement" --supporting|--counter|--confirmation|--contradiction "description"');
        process.exit(1);
      }

      try {
        const result = addEvidence(statement, evidenceType, description);
        console.log(`✅ Added ${evidenceType} evidence to "${statement}"`);
        console.log(`   Confidence: ${(result.opinion.confidence * 100).toFixed(0)}% (${result.confidenceChange > 0 ? '+' : ''}${(result.confidenceChange * 100).toFixed(1)}%)`);

        if (result.needsNotification) {
          console.log('\n⚠️  SIGNIFICANT CHANGE - User should be notified');
        }
      } catch (err) {
        console.error(`❌ ${err}`);
        process.exit(1);
      }
      break;
    }

    case 'list':
      listOpinions();
      break;

    case 'show': {
      const statement = args[1];
      if (!statement) {
        console.error('Usage: bun OpinionTracker.ts show "statement"');
        process.exit(1);
      }
      showOpinion(statement);
      break;
    }

    default:
      console.log(`
OpinionTracker - Manage confidence-tracked opinions

Commands:
  add "statement" [--category <cat>]           Add new opinion
  evidence "statement" --supporting "desc"     Add supporting evidence
  evidence "statement" --counter "desc"        Add counter evidence
  evidence "statement" --confirmation "desc"   User explicitly confirmed
  evidence "statement" --contradiction "desc"  User explicitly contradicted
  list                                         List all opinions
  show "statement"                             Show opinion details

Categories: communication, technical, relationship, work_style
`);
  }
}

main().catch(console.error);
