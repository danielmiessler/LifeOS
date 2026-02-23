#!/usr/bin/env bun
/**
 * GenerateCapabilityIndex.ts
 *
 * Scans all skills and their workflow files to build a rich capability index
 * with workflow-level metadata (description, timing, tags).
 *
 * The CapabilityRecommender hook consumes this index to make better
 * routing decisions at the workflow level, not just the skill level.
 *
 * Usage: bun run ~/.claude/skills/PAI/Tools/GenerateCapabilityIndex.ts
 *
 * Output: ~/.claude/skills/skill-workflow-capabilities.json
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';
import { existsSync } from 'fs';

const SKILLS_DIR = join(import.meta.dir, '..', '..');
const SKILL_INDEX_PATH = join(SKILLS_DIR, 'skill-index.json');
const OUTPUT_FILE = join(SKILLS_DIR, 'skill-workflow-capabilities.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowCapability {
  description: string;
  timing: 'fast' | 'standard' | 'deep';
  tags: string[];
}

interface SkillCapability {
  description: string;
  tier: string;
  workflows: Record<string, WorkflowCapability>;
}

interface CapabilityIndex {
  generated: string;
  version: string;
  totalSkills: number;
  totalWorkflows: number;
  skills: Record<string, SkillCapability>;
}

// ---------------------------------------------------------------------------
// Timing inference from content
// ---------------------------------------------------------------------------

function inferTiming(content: string, workflowName: string): 'fast' | 'standard' | 'deep' {
  const lower = content.toLowerCase();
  const nameLower = workflowName.toLowerCase();

  // Fast signals
  if (nameLower.includes('quick') || nameLower.includes('status') || nameLower.includes('get') ||
      nameLower.includes('check') || nameLower.includes('list') || nameLower.includes('show') ||
      nameLower.includes('info') || nameLower.includes('profile')) {
    return 'fast';
  }
  if (lower.includes('single agent') || lower.includes('10-15s') || lower.includes('< 30') ||
      lower.includes('quick') || lower.includes('fast lookup') || lower.includes('~30s')) {
    return 'fast';
  }

  // Deep signals
  if (nameLower.includes('extensive') || nameLower.includes('full') || nameLower.includes('complete') ||
      nameLower.includes('comprehensive') || nameLower.includes('create') && nameLower.includes('release')) {
    return 'deep';
  }
  if (lower.includes('extensive') || lower.includes('comprehensive') || lower.includes('60-90s') ||
      lower.includes('multi-model') || lower.includes('4-8 agents') || lower.includes('full audit') ||
      lower.includes('32 agents')) {
    return 'deep';
  }

  return 'standard';
}

// ---------------------------------------------------------------------------
// Tag generation from skill + workflow name
// ---------------------------------------------------------------------------

function generateTags(skillName: string, workflowName: string, content: string): string[] {
  const tags: string[] = [];

  // Skill-derived tags
  const skillLower = skillName.toLowerCase();
  tags.push(skillLower);

  // Domain tags from skill name
  const domainMap: Record<string, string[]> = {
    research: ['research', 'web', 'investigation'],
    art: ['visual', 'creative', 'media'],
    browser: ['web', 'ui', 'testing'],
    security: ['security'],
    recon: ['security', 'reconnaissance'],
    webassessment: ['security', 'pentest'],
    promptinjection: ['security', 'ai-safety'],
    vulnmanagement: ['security', 'vulnerability'],
    newsletter: ['content', 'email', 'marketing'],
    blogging: ['content', 'web', 'writing'],
    socialpost: ['content', 'social-media'],
    broadcast: ['content', 'social-media', 'distribution'],
    metrics: ['analytics', 'data'],
    usmetrics: ['analytics', 'economics'],
    parser: ['extraction', 'data', 'parsing'],
    fabric: ['prompts', 'patterns', 'extraction'],
    science: ['thinking', 'methodology'],
    firstprinciples: ['thinking', 'analysis'],
    council: ['thinking', 'debate'],
    redteam: ['thinking', 'adversarial'],
    becreative: ['thinking', 'creativity'],
    agents: ['infrastructure', 'agents'],
    observability: ['infrastructure', 'monitoring'],
    cloudflare: ['infrastructure', 'deployment'],
    createskill: ['infrastructure', 'skills'],
    createcli: ['infrastructure', 'tooling'],
    pai: ['infrastructure', 'system'],
    system: ['infrastructure', 'maintenance'],
    development: ['engineering', 'implementation'],
    documents: ['documents', 'file-processing'],
    osint: ['intelligence', 'investigation'],
    inbox: ['email', 'communication'],
    communication: ['messaging', 'outbound'],
    telegram: ['messaging', 'bots'],
    telos: ['life-system', 'goals'],
    personal: ['personal', 'philosophy'],
    dotfiles: ['system', 'configuration'],
    clickup: ['project-management', 'tasks'],
    news: ['aggregation', 'monitoring'],
    hormozi: ['business', 'frameworks'],
    sales: ['business', 'sales'],
    speaking: ['business', 'events'],
    apify: ['scraping', 'data'],
    brightdata: ['scraping', 'data'],
    remotion: ['video', 'creative'],
    voiceserver: ['voice', 'tts'],
    evals: ['testing', 'evaluation'],
  };

  for (const [key, domainTags] of Object.entries(domainMap)) {
    if (skillLower.includes(key)) {
      tags.push(...domainTags);
    }
  }

  // Workflow name-derived tags
  const wfLower = workflowName.toLowerCase();
  if (wfLower.includes('create') || wfLower.includes('write') || wfLower.includes('draft')) tags.push('creation');
  if (wfLower.includes('update') || wfLower.includes('sync')) tags.push('maintenance');
  if (wfLower.includes('check') || wfLower.includes('scan') || wfLower.includes('validate')) tags.push('validation');
  if (wfLower.includes('deploy') || wfLower.includes('publish') || wfLower.includes('push')) tags.push('deployment');
  if (wfLower.includes('search') || wfLower.includes('find') || wfLower.includes('lookup')) tags.push('search');
  if (wfLower.includes('extract') || wfLower.includes('parse')) tags.push('extraction');
  if (wfLower.includes('analyze') || wfLower.includes('diagnosis')) tags.push('analysis');

  return [...new Set(tags)];
}

// ---------------------------------------------------------------------------
// Description extraction from workflow file
// ---------------------------------------------------------------------------

function extractDescription(content: string, workflowName: string, skillName: string): string {
  // Try to find H1 title
  const h1Match = content.match(/^#\s+(.+)$/m);

  // Try "When to Use" section
  const whenMatch = content.match(/##?\s*When to Use\s*\n([\s\S]*?)(?=\n##|\n$)/i);
  if (whenMatch) {
    const firstBullet = whenMatch[1].trim().split('\n')[0].replace(/^[-*]\s*/, '').trim();
    if (firstBullet.length > 10 && firstBullet.length < 200) {
      return firstBullet;
    }
  }

  // Try first paragraph after H1
  const afterH1 = content.match(/^#\s+.+\n\n(.+)/m);
  if (afterH1) {
    const para = afterH1[1].replace(/\*\*/g, '').trim();
    if (para.length > 10 && para.length < 200 && !para.startsWith('#') && !para.startsWith('```')) {
      return para;
    }
  }

  // Try **Mode:** line (Research workflows use this)
  const modeMatch = content.match(/\*\*Mode:\*\*\s*(.+?)(?:\s*\||\n)/);
  if (modeMatch) {
    return modeMatch[1].trim();
  }

  // Try first non-empty, non-heading line
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('//') && !l.startsWith('curl'));
  if (lines.length > 0) {
    const candidate = lines[0].replace(/\*\*/g, '').replace(/^[-*]\s*/, '').trim();
    if (candidate.length > 10 && candidate.length < 200) {
      return candidate;
    }
  }

  // Fallback: generate from name
  return humanizeName(workflowName, skillName);
}

function humanizeName(workflowName: string, skillName: string): string {
  // Convert CamelCase to spaced words
  const words = workflowName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .toLowerCase();
  return `${words} workflow for ${skillName}`;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

async function scanWorkflowFile(filePath: string, workflowName: string, skillName: string): Promise<WorkflowCapability> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return {
      description: extractDescription(content, workflowName, skillName),
      timing: inferTiming(content, workflowName),
      tags: generateTags(skillName, workflowName, content),
    };
  } catch {
    // File not readable or missing
    return {
      description: humanizeName(workflowName, skillName),
      timing: 'standard',
      tags: generateTags(skillName, workflowName, ''),
    };
  }
}

async function findWorkflowFile(skillDir: string, workflowName: string): Promise<string | null> {
  const candidates = [
    join(skillDir, 'Workflows', `${workflowName}.md`),
    join(skillDir, 'Workflows', `${workflowName.toLowerCase()}.md`),
    // Some workflows have different casing
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Try case-insensitive match in Workflows dir
  const workflowsDir = join(skillDir, 'Workflows');
  if (existsSync(workflowsDir)) {
    try {
      const files = await readdir(workflowsDir);
      const match = files.find(f =>
        f.toLowerCase().replace('.md', '') === workflowName.toLowerCase()
      );
      if (match) {
        return join(workflowsDir, match);
      }
    } catch { /* ignore */ }
  }

  return null;
}

async function main() {
  console.log('Generating skill-workflow capability index...');

  // Read existing skill index for the skill list
  let skillIndex: any;
  try {
    const raw = await readFile(SKILL_INDEX_PATH, 'utf-8');
    skillIndex = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read skill-index.json:', err);
    process.exit(1);
  }

  const capabilities: Record<string, SkillCapability> = {};
  let totalWorkflows = 0;

  for (const [key, skill] of Object.entries(skillIndex.skills) as [string, any][]) {
    const skillDir = join(SKILLS_DIR, skill.path.replace('/SKILL.md', ''));
    const skillDescription = skill.fullDescription?.split('.')[0] || skill.name;

    const workflows: Record<string, WorkflowCapability> = {};

    if (skill.workflows && skill.workflows.length > 0) {
      for (const wfName of skill.workflows) {
        const wfFile = await findWorkflowFile(skillDir, wfName);
        if (wfFile) {
          workflows[wfName] = await scanWorkflowFile(wfFile, wfName, skill.name);
        } else {
          // No workflow file found — generate from name
          workflows[wfName] = {
            description: humanizeName(wfName, skill.name),
            timing: inferTiming('', wfName),
            tags: generateTags(skill.name, wfName, ''),
          };
        }
        totalWorkflows++;
      }
    }

    capabilities[skill.name] = {
      description: skillDescription,
      tier: skill.tier,
      workflows,
    };
  }

  const index: CapabilityIndex = {
    generated: new Date().toISOString(),
    version: '1.0.0',
    totalSkills: Object.keys(capabilities).length,
    totalWorkflows,
    skills: capabilities,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(index, null, 2));
  console.log(`Generated ${OUTPUT_FILE}`);
  console.log(`  Skills: ${index.totalSkills}`);
  console.log(`  Workflows: ${index.totalWorkflows}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
