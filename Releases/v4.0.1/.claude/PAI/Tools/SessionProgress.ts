#!/usr/bin/env bun
/**
 * Session Progress CLI
 *
 * Manages session continuity files for multi-session work.
 * Based on Anthropic's claude-progress.txt pattern.
 *
 * Usage:
 *   bun run ~/.claude/PAI/Tools/SessionProgress.ts <command> [options]
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface Decision {
  timestamp: string;
  decision: string;
  rationale: string;
}

interface WorkItem {
  timestamp: string;
  description: string;
  artifacts: string[];
}

interface Blocker {
  timestamp: string;
  blocker: string;
  resolution: string | null;
}

interface SessionProgress {
  project: string;
  created: string;
  updated: string;
  status: 'active' | 'completed' | 'blocked';
  objectives: string[];
  decisions: Decision[];
  work_completed: WorkItem[];
  blockers: Blocker[];
  handoff_notes: string;
  next_steps: string[];
}

// Progress files are now in STATE/progress/ (consolidated from MEMORY/PROGRESS/)
const PROGRESS_DIR = join(process.env.HOME || '', '.claude', 'MEMORY', 'STATE', 'progress');

function getProgressPath(project: string): string {
  return join(PROGRESS_DIR, `${project}-progress.json`);
}

function loadProgress(project: string): SessionProgress | null {
  const path = getProgressPath(project);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveProgress(progress: SessionProgress): void {
  progress.updated = new Date().toISOString();
  writeFileSync(getProgressPath(progress.project), JSON.stringify(progress, null, 2));
}

// Commands

function createProgress(project: string, objectives: string[]): void {
  const path = getProgressPath(project);
  if (existsSync(path)) {
    console.log(`Progress file already exists for ${project}`);
    console.log(`Use 'session-progress resume ${project}' to continue`);
    return;
  }

  const progress: SessionProgress = {
    project,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    status: 'active',
    objectives,
    decisions: [],
    work_completed: [],
    blockers: [],
    handoff_notes: '',
    next_steps: []
  };

  saveProgress(progress);
  console.log(`Created progress file: ${path}`);
  console.log(`Objectives: ${objectives.join(', ')}`);
}

function addDecision(project: string, decision: string, rationale: string): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.decisions.push({
    timestamp: new Date().toISOString(),
    decision,
    rationale
  });

  saveProgress(progress);
  console.log(`Added decision: ${decision}`);
}

function addWork(project: string, description: string, artifacts: string[]): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.work_completed.push({
    timestamp: new Date().toISOString(),
    description,
    artifacts
  });

  saveProgress(progress);
  console.log(`Added work: ${description}`);
}

function addBlocker(project: string, blocker: string, resolution?: string): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.blockers.push({
    timestamp: new Date().toISOString(),
    blocker,
    resolution: resolution || null
  });

  progress.status = 'blocked';
  saveProgress(progress);
  console.log(`Added blocker: ${blocker}`);
}

function setNextSteps(project: string, steps: string[]): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.next_steps = steps;
  saveProgress(progress);
  console.log(`Set ${steps.length} next steps`);
}

function setHandoff(project: string, notes: string): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.handoff_notes = notes;
  saveProgress(progress);
  console.log(`Set handoff notes`);
}

function resumeProgress(project: string): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SESSION RESUME: ${project}`);
  console.log(`${'═'.repeat(60)}\n`);

  console.log(`Status: ${progress.status}`);
  console.log(`Last Updated: ${progress.updated}\n`);

  console.log(`OBJECTIVES:`);
  progress.objectives.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));

  if (progress.decisions.length > 0) {
    console.log(`\nKEY DECISIONS:`);
    progress.decisions.slice(-3).forEach(d => {
      console.log(`  • ${d.decision}`);
      console.log(`    Rationale: ${d.rationale}`);
    });
  }

  if (progress.work_completed.length > 0) {
    console.log(`\nRECENT WORK:`);
    progress.work_completed.slice(-5).forEach(w => {
      console.log(`  • ${w.description}`);
      if (w.artifacts.length > 0) {
        console.log(`    Artifacts: ${w.artifacts.join(', ')}`);
      }
    });
  }

  if (progress.blockers.length > 0) {
    const unresolvedBlockers = progress.blockers.filter(b => !b.resolution);
    if (unresolvedBlockers.length > 0) {
      console.log(`\n⚠️ ACTIVE BLOCKERS:`);
      unresolvedBlockers.forEach(b => {
        console.log(`  • ${b.blocker}`);
      });
    }
  }

  if (progress.handoff_notes) {
    console.log(`\n📝 HANDOFF NOTES:`);
    console.log(`  ${progress.handoff_notes}`);
  }

  if (progress.next_steps.length > 0) {
    console.log(`\n➡️ NEXT STEPS:`);
    progress.next_steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }

  console.log(`\n${'═'.repeat(60)}\n`);
}

function listActive(): void {
  if (!existsSync(PROGRESS_DIR)) {
    console.log('No progress files found');
    return;
  }

  const files = readdirSync(PROGRESS_DIR)
    .filter(f => f.endsWith('-progress.json'));

  if (files.length === 0) {
    console.log('No active progress files');
    return;
  }

  console.log(`\nActive Progress Files:\n`);

  for (const file of files) {
    const progress = JSON.parse(readFileSync(join(PROGRESS_DIR, file), 'utf-8')) as SessionProgress;
    const statusIcon = {
      active: '🔵',
      completed: '✅',
      blocked: '🔴'
    }[progress.status];

    console.log(`${statusIcon} ${progress.project} (${progress.status})`);
    console.log(`   Updated: ${new Date(progress.updated).toLocaleDateString()}`);
    console.log(`   Work items: ${progress.work_completed.length}`);
    if (progress.next_steps.length > 0) {
      console.log(`   Next: ${progress.next_steps[0]}`);
    }
    console.log('');
  }
}

function completeProgress(project: string): void {
  const progress = loadProgress(project);
  if (!progress) {
    console.error(`No progress file for ${project}`);
    process.exit(1);
  }

  progress.status = 'completed';
  progress.handoff_notes = `Completed at ${new Date().toISOString()}`;
  saveProgress(progress);
  console.log(`Marked ${project} as completed`);
}

// CLI Parser

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'create':
    if (!args[1]) {
      console.error('Usage: session-progress create <project> [objective1] [objective2] ...');
      process.exit(1);
    }
    createProgress(args[1], args.slice(2));
    break;

  case 'decision':
    if (!args[1] || !args[2]) {
      console.error('Usage: session-progress decision <project> "<decision>" "<rationale>"');
      process.exit(1);
    }
    addDecision(args[1], args[2], args[3] || '');
    break;

  case 'work':
    if (!args[1] || !args[2]) {
      console.error('Usage: session-progress work <project> "<description>" [artifact1] [artifact2] ...');
      process.exit(1);
    }
    addWork(args[1], args[2], args.slice(3));
    break;

  case 'blocker':
    if (!args[1] || !args[2]) {
      console.error('Usage: session-progress blocker <project> "<blocker>" ["resolution"]');
      process.exit(1);
    }
    addBlocker(args[1], args[2], args[3]);
    break;

  case 'next':
    if (!args[1]) {
      console.error('Usage: session-progress next <project> <step1> <step2> ...');
      process.exit(1);
    }
    setNextSteps(args[1], args.slice(2));
    break;

  case 'handoff':
    if (!args[1] || !args[2]) {
      console.error('Usage: session-progress handoff <project> "<notes>"');
      process.exit(1);
    }
    setHandoff(args[1], args[2]);
    break;

  case 'resume':
    if (!args[1]) {
      console.error('Usage: session-progress resume <project>');
      process.exit(1);
    }
    resumeProgress(args[1]);
    break;

  case 'list':
    listActive();
    break;

  case 'complete':
    if (!args[1]) {
      console.error('Usage: session-progress complete <project>');
      process.exit(1);
    }
    completeProgress(args[1]);
    break;

  default:
    console.log(`
Session Progress CLI - Multi-session continuity management

Commands:
  create <project> [objectives...]    Create new progress file
  decision <project> <decision> <rationale>  Record a decision
  work <project> <description> [artifacts...]  Record completed work
  blocker <project> <blocker> [resolution]    Add blocker
  next <project> <step1> <step2>...   Set next steps
  handoff <project> <notes>           Set handoff notes
  resume <project>                    Display context for resuming
  list                                List all active progress files
  complete <project>                  Mark project as completed

Examples:
  session-progress create auth-feature "Implement user authentication"
  session-progress decision auth-feature "Using JWT" "Simpler than sessions for our API"
  session-progress work auth-feature "Created User model" src/models/user.ts
  session-progress next auth-feature "Write auth tests" "Implement login endpoint"
  session-progress resume auth-feature
`);
}
