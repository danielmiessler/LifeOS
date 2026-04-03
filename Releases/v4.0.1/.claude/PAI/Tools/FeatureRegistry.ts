#!/usr/bin/env bun
/**
 * Feature Registry CLI
 *
 * JSON-based feature tracking for complex multi-feature tasks.
 * Based on Anthropic's agent harness patterns - JSON is more robust
 * than Markdown because models are less likely to corrupt structured data.
 *
 * Usage:
 *   bun run ~/.claude/Tools/FeatureRegistry.ts <command> [options]
 *
 * Commands:
 *   init <project>              Initialize feature registry for project
 *   add <project> <feature>     Add feature to registry
 *   update <project> <id>       Update feature status
 *   list <project>              List all features
 *   verify <project>            Run verification for all features
 *   next <project>              Show next priority feature
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestStep {
  step: string;
  status: 'pending' | 'passing' | 'failing';
}

interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  status: 'pending' | 'in_progress' | 'passing' | 'failing' | 'blocked';
  test_steps: TestStep[];
  acceptance_criteria: string[];
  blocked_by: string[];
  started_at: string | null;
  completed_at: string | null;
  notes: string[];
}

interface FeatureRegistry {
  project: string;
  created: string;
  updated: string;
  version: string;
  features: Feature[];
  completion_summary: {
    total: number;
    passing: number;
    failing: number;
    pending: number;
    blocked: number;
  };
}

const REGISTRY_DIR = join(process.env.HOME || '', '.claude', 'MEMORY', 'progress');

function getRegistryPath(project: string): string {
  return join(REGISTRY_DIR, `${project}-features.json`);
}

function loadRegistry(project: string): FeatureRegistry | null {
  const path = getRegistryPath(project);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveRegistry(registry: FeatureRegistry): void {
  const path = getRegistryPath(registry.project);
  registry.updated = new Date().toISOString();
  registry.completion_summary = calculateSummary(registry.features);
  writeFileSync(path, JSON.stringify(registry, null, 2));
}

function calculateSummary(features: Feature[]): FeatureRegistry['completion_summary'] {
  return {
    total: features.length,
    passing: features.filter(f => f.status === 'passing').length,
    failing: features.filter(f => f.status === 'failing').length,
    pending: features.filter(f => f.status === 'pending').length,
    blocked: features.filter(f => f.status === 'blocked').length,
  };
}

function generateId(features: Feature[]): string {
  const maxId = features.reduce((max, f) => {
    const num = parseInt(f.id.replace('feat-', ''));
    return num > max ? num : max;
  }, 0);
  return `feat-${maxId + 1}`;
}

// Commands

function initRegistry(project: string): void {
  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }

  const path = getRegistryPath(project);
  if (existsSync(path)) {
    console.log(`Registry already exists for ${project}`);
    return;
  }

  const registry: FeatureRegistry = {
    project,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    version: '1.0.0',
    features: [],
    completion_summary: { total: 0, passing: 0, failing: 0, pending: 0, blocked: 0 }
  };

  saveRegistry(registry);
  console.log(`Initialized feature registry: ${path}`);
}

function addFeature(
  project: string,
  name: string,
  description: string = '',
  priority: 'P1' | 'P2' | 'P3' = 'P2',
  criteria: string[] = [],
  steps: string[] = []
): void {
  const registry = loadRegistry(project);
  if (!registry) {
    console.error(`No registry found for ${project}. Run: feature-registry init ${project}`);
    process.exit(1);
  }

  const feature: Feature = {
    id: generateId(registry.features),
    name,
    description,
    priority,
    status: 'pending',
    test_steps: steps.map(s => ({ step: s, status: 'pending' as const })),
    acceptance_criteria: criteria,
    blocked_by: [],
    started_at: null,
    completed_at: null,
    notes: []
  };

  registry.features.push(feature);
  saveRegistry(registry);
  console.log(`Added feature ${feature.id}: ${name}`);
}

function updateFeature(
  project: string,
  featureId: string,
  status?: Feature['status'],
  note?: string
): void {
  const registry = loadRegistry(project);
  if (!registry) {
    console.error(`No registry found for ${project}`);
    process.exit(1);
  }

  const feature = registry.features.find(f => f.id === featureId);
  if (!feature) {
    console.error(`Feature ${featureId} not found`);
    process.exit(1);
  }

  if (status) {
    feature.status = status;
    if (status === 'in_progress' && !feature.started_at) {
      feature.started_at = new Date().toISOString();
    }
    if (status === 'passing') {
      feature.completed_at = new Date().toISOString();
    }
  }

  if (note) {
    feature.notes.push(`[${new Date().toISOString()}] ${note}`);
  }

  saveRegistry(registry);
  console.log(`Updated ${featureId}: status=${feature.status}`);
}

function listFeatures(project: string): void {
  const registry = loadRegistry(project);
  if (!registry) {
    console.error(`No registry found for ${project}`);
    process.exit(1);
  }

  console.log(`\nFeature Registry: ${project}`);
  console.log(`Updated: ${registry.updated}`);
  console.log(`─────────────────────────────────────`);

  const summary = registry.completion_summary;
  console.log(`Progress: ${summary.passing}/${summary.total} passing`);
  console.log(`  Pending: ${summary.pending} | Failing: ${summary.failing} | Blocked: ${summary.blocked}`);
  console.log(`─────────────────────────────────────\n`);

  // Group by priority
  const byPriority = {
    P1: registry.features.filter(f => f.priority === 'P1'),
    P2: registry.features.filter(f => f.priority === 'P2'),
    P3: registry.features.filter(f => f.priority === 'P3'),
  };

  for (const [priority, features] of Object.entries(byPriority)) {
    if (features.length === 0) continue;
    console.log(`${priority} Features:`);
    for (const f of features) {
      const statusIcon = {
        pending: '○',
        in_progress: '◐',
        passing: '✓',
        failing: '✗',
        blocked: '⊘'
      }[f.status];
      console.log(`  ${statusIcon} [${f.id}] ${f.name} (${f.status})`);
    }
    console.log('');
  }
}

function verifyFeatures(project: string): void {
  const registry = loadRegistry(project);
  if (!registry) {
    console.error(`No registry found for ${project}`);
    process.exit(1);
  }

  console.log(`\nVerification Report: ${project}`);
  console.log(`═══════════════════════════════════════\n`);

  let allPassing = true;

  for (const feature of registry.features) {
    const icon = feature.status === 'passing' ? '✅' : '❌';
    console.log(`${icon} ${feature.id}: ${feature.name}`);

    if (feature.status !== 'passing') {
      allPassing = false;
      console.log(`   Status: ${feature.status}`);
      if (feature.blocked_by.length > 0) {
        console.log(`   Blocked by: ${feature.blocked_by.join(', ')}`);
      }
    }

    // Show test steps
    for (const step of feature.test_steps) {
      const stepIcon = step.status === 'passing' ? '✓' : step.status === 'failing' ? '✗' : '○';
      console.log(`   ${stepIcon} ${step.step}`);
    }
    console.log('');
  }

  console.log(`═══════════════════════════════════════`);
  if (allPassing) {
    console.log(`✅ ALL FEATURES PASSING - Ready for completion`);
  } else {
    console.log(`❌ INCOMPLETE - Some features not passing`);
  }
}

function nextFeature(project: string): void {
  const registry = loadRegistry(project);
  if (!registry) {
    console.error(`No registry found for ${project}`);
    process.exit(1);
  }

  // Priority order: in_progress > P1 pending > P2 pending > P3 pending
  const inProgress = registry.features.find(f => f.status === 'in_progress');
  if (inProgress) {
    console.log(`\nCurrent: [${inProgress.id}] ${inProgress.name}`);
    console.log(`Status: ${inProgress.status}`);
    console.log(`Started: ${inProgress.started_at}`);
    return;
  }

  for (const priority of ['P1', 'P2', 'P3'] as const) {
    const next = registry.features.find(f => f.priority === priority && f.status === 'pending');
    if (next) {
      console.log(`\nNext: [${next.id}] ${next.name} (${next.priority})`);
      console.log(`Description: ${next.description || 'None'}`);
      console.log(`\nTo start: feature-registry update ${project} ${next.id} in_progress`);
      return;
    }
  }

  console.log(`\nNo pending features. All features processed!`);
}

// CLI Parser

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    if (!args[1]) {
      console.error('Usage: feature-registry init <project>');
      process.exit(1);
    }
    initRegistry(args[1]);
    break;

  case 'add':
    if (!args[1] || !args[2]) {
      console.error('Usage: feature-registry add <project> <feature-name> [--description "desc"] [--priority P1|P2|P3]');
      process.exit(1);
    }
    const descIdx = args.indexOf('--description');
    const desc = descIdx > -1 ? args[descIdx + 1] : '';
    const prioIdx = args.indexOf('--priority');
    const prio = prioIdx > -1 ? args[prioIdx + 1] as 'P1' | 'P2' | 'P3' : 'P2';
    addFeature(args[1], args[2], desc, prio);
    break;

  case 'update':
    if (!args[1] || !args[2]) {
      console.error('Usage: feature-registry update <project> <feature-id> [status] [--note "note"]');
      process.exit(1);
    }
    const validStatuses = ['pending', 'in_progress', 'passing', 'failing', 'blocked'];
    const statusArg = validStatuses.includes(args[3]) ? args[3] as Feature['status'] : undefined;
    const noteIdx = args.indexOf('--note');
    const noteArg = noteIdx > -1 ? args[noteIdx + 1] : undefined;
    updateFeature(args[1], args[2], statusArg, noteArg);
    break;

  case 'list':
    if (!args[1]) {
      console.error('Usage: feature-registry list <project>');
      process.exit(1);
    }
    listFeatures(args[1]);
    break;

  case 'verify':
    if (!args[1]) {
      console.error('Usage: feature-registry verify <project>');
      process.exit(1);
    }
    verifyFeatures(args[1]);
    break;

  case 'next':
    if (!args[1]) {
      console.error('Usage: feature-registry next <project>');
      process.exit(1);
    }
    nextFeature(args[1]);
    break;

  default:
    console.log(`
Feature Registry CLI - JSON-based feature tracking

Commands:
  init <project>              Initialize feature registry
  add <project> <name>        Add feature (--description, --priority P1|P2|P3)
  update <project> <id>       Update status (pending|in_progress|passing|failing|blocked)
  list <project>              List all features with status
  verify <project>            Run verification report
  next <project>              Show next priority feature

Examples:
  feature-registry init my-app
  feature-registry add my-app "User Authentication" --priority P1
  feature-registry update my-app feat-1 in_progress
  feature-registry list my-app
  feature-registry verify my-app
`);
}
