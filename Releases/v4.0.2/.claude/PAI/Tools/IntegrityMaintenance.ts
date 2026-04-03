#!/usr/bin/env bun
/**
 * IntegrityMaintenance.ts - Background script for system integrity and update documentation
 *
 * Receives change data from SystemIntegrity.ts handler via stdin JSON.
 * Uses AI inference to understand the session context and generate
 * meaningful documentation - NOT generic templates.
 *
 * Input (stdin JSON):
 * {
 *   "session_id": "abc-123",
 *   "transcript_path": "/path/to/transcript.jsonl",
 *   "changes": [{ "tool": "Edit", "path": "skills/Foo/SKILL.md", ... }]
 * }
 *
 * Output:
 * - Creates PAISYSTEMUPDATES entry with AI-generated narrative
 * - Sends voice notification with summary
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { inference } from './Inference';
import { getIdentity } from '../../hooks/lib/identity';

// ============================================================================
// Types
// ============================================================================

type SignificanceLabel = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
type ChangeType =
  | 'skill_update'
  | 'structure_change'
  | 'doc_update'
  | 'hook_update'
  | 'workflow_update'
  | 'config_update'
  | 'tool_update'
  | 'multi_area';

interface FileChange {
  tool: 'Write' | 'Edit';
  path: string;
  category: string | null;
  isPhilosophical: boolean;
  isStructural: boolean;
}

interface StdinInput {
  session_id: string;
  transcript_path: string;
  changes: FileChange[];
}

interface IntegrityResult {
  references_found: number;
  references_updated: number;
  locations_checked: string[];
}

// Legacy narrative format
interface NarrativeData {
  context?: string;
  problem?: string;
  solution?: string;
  verification?: string;
  confidence: 'high' | 'medium' | 'low';
}

// New verbose narrative format
interface VerboseNarrative {
  // The Story (1-3 paragraphs)
  story_background?: string;    // Paragraph 1: Context/background
  story_problem?: string;       // Paragraph 2: What was broken/limited
  story_resolution?: string;    // Paragraph 3: How we fixed it

  // Before/After narratives
  how_it_was?: string;          // "We used to do it this way"
  how_it_was_bullets?: string[];// Characteristics of old approach
  how_it_is?: string;           // "We now do it this way"
  how_it_is_bullets?: string[]; // Improvements in new approach

  // Going forward
  future_impact?: string;       // "In the future, X will happen"
  future_bullets?: string[];    // Specific future implications

  // Verification
  verification_steps?: string[];
  verification_commands?: string[];

  confidence: 'high' | 'medium' | 'low';
}

interface UpdateData {
  title: string;
  significance: SignificanceLabel;
  change_type: ChangeType;
  files: string[];
  purpose: string;
  expected_improvement: string;
  integrity_work: IntegrityResult;
  narrative?: NarrativeData;           // Legacy format
  verbose_narrative?: VerboseNarrative; // New verbose format (preferred)
}

// ============================================================================
// Constants
// ============================================================================

const PAI_DIR = process.env.HOME + '/.claude';
const CREATE_UPDATE_SCRIPT = join(PAI_DIR, 'skills/_SYSTEM/Tools/CreateUpdate.ts');

// Words that indicate generic/bad titles - reject these
const GENERIC_TITLE_PATTERNS = [
  /^system (philosophy|structure) update$/i,
  /^documentation update$/i,
  /^multi-?skill update/i,
  /^architecture update$/i,
];

// ============================================================================
// Transcript Reading
// ============================================================================

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Read and parse the transcript file to extract conversation context.
 * Returns a summarized version suitable for AI analysis.
 */
function readTranscriptContext(transcriptPath: string, maxMessages: number = 20): TranscriptMessage[] {
  if (!existsSync(transcriptPath)) {
    console.error('[IntegrityMaintenance] Transcript not found:', transcriptPath);
    return [];
  }

  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');
    const messages: TranscriptMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' && entry.message?.content) {
          const text = extractTextContent(entry.message.content);
          if (text && text.length > 10) {
            messages.push({ role: 'user', content: text });
          }
        } else if (entry.type === 'assistant' && entry.message?.content) {
          const text = extractTextContent(entry.message.content);
          if (text && text.length > 10) {
            // Truncate long assistant messages
            messages.push({ role: 'assistant', content: text.slice(0, 2000) });
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Return last N messages for context
    return messages.slice(-maxMessages);
  } catch (error) {
    console.error('[IntegrityMaintenance] Error reading transcript:', error);
    return [];
  }
}

/**
 * Extract text from Claude's content format (string or array of blocks).
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(c => {
        if (typeof c === 'string') return c;
        if (c?.text) return c.text;
        if (c?.content) return extractTextContent(c.content);
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
}

/**
 * Build a context summary for the AI from transcript messages.
 */
function buildContextSummary(messages: TranscriptMessage[]): string {
  if (messages.length === 0) return '';

  const parts: string[] = [];
  for (const msg of messages) {
    const prefix = msg.role === 'user' ? 'USER:' : 'ASSISTANT:';
    // Clean up system reminders and keep it concise
    const cleaned = msg.content
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (cleaned) {
      parts.push(`${prefix} ${cleaned.slice(0, 1500)}`);
    }
  }
  return parts.join('\n\n---\n\n');
}

// ============================================================================
// Title Generation
// ============================================================================

/**
 * Generate a descriptive 4-8 word title based on the changes.
 */
function generateDescriptiveTitle(changes: FileChange[]): string {
  const paths = changes.map(c => c.path);

  // Extract skill names
  const skillNames = new Set<string>();
  for (const p of paths) {
    const match = p.match(/skills\/([^/]+)\//);
    if (match && match[1] !== 'CORE') skillNames.add(match[1]);
  }

  // Extract file types
  const hasSkillMd = paths.some(p => p.endsWith('SKILL.md'));
  const hasWorkflows = paths.some(p => p.includes('/Workflows/'));
  const hasTools = paths.some(p => p.includes('/Tools/') && p.endsWith('.ts'));
  const hasHooks = paths.some(p => p.includes('hooks/'));
  const hasConfig = paths.some(p => p.endsWith('settings.json'));
  const hasPAISystem = paths.some(p => p.includes('/PAI/'));
  const hasPAIUser = paths.some(p => p.includes('PAI/USER/'));

  // Extract common patterns from filenames
  const fileNames = paths.map(p => basename(p, '.md').replace(/\.ts$/, ''));
  const commonWords = extractCommonPatterns(fileNames);

  // Build title based on what we found
  let title = '';

  // Single skill update
  if (skillNames.size === 1) {
    const skill = [...skillNames][0];
    if (hasSkillMd) {
      title = `${skill} Skill Definition Update`;
    } else if (hasWorkflows) {
      const workflowNames = paths
        .filter(p => p.includes('/Workflows/'))
        .map(p => basename(p, '.md'));
      if (workflowNames.length === 1) {
        title = `${skill} ${workflowNames[0]} Workflow Update`;
      } else {
        title = `${skill} Workflows Updated`;
      }
    } else if (hasTools) {
      const toolNames = paths
        .filter(p => p.includes('/Tools/'))
        .map(p => basename(p, '.ts'));
      if (toolNames.length === 1) {
        title = `${skill} ${toolNames[0]} Tool Update`;
      } else {
        title = `${skill} Tools Updated`;
      }
    } else {
      title = `${skill} Skill Update`;
    }
  }
  // Multiple skills
  else if (skillNames.size > 1 && skillNames.size <= 3) {
    const skills = [...skillNames].slice(0, 3).join(' and ');
    title = `${skills} Skills Updated`;
  }
  // Hook changes
  else if (hasHooks) {
    const hookNames = paths
      .filter(p => p.includes('hooks/'))
      .map(p => basename(p, '.ts').replace('.hook', ''));
    if (hookNames.length === 1) {
      title = `${hookNames[0]} Hook Updated`;
    } else if (hookNames.length <= 3) {
      title = `${hookNames.slice(0, 3).join(', ')} Hooks Updated`;
    } else {
      title = `Hook System Updates`;
    }
  }
  // Config changes
  else if (hasConfig) {
    title = 'System Configuration Updated';
  }
  // PAI system changes
  else if (hasPAISystem) {
    const docNames = paths
      .filter(p => p.includes('/PAI/'))
      .map(p => basename(p, '.md'));
    if (docNames.length === 1) {
      title = `${docNames[0]} Documentation Updated`;
    } else {
      title = 'PAI System Documentation Updated';
    }
  }
  // PAI user changes
  else if (hasPAIUser) {
    const docNames = paths
      .filter(p => p.includes('PAI/USER/'))
      .map(p => basename(p, '.md'));
    if (docNames.length === 1) {
      title = `${docNames[0]} User Config Updated`;
    } else {
      title = 'User Configuration Updated';
    }
  }
  // Generic with common words
  else if (commonWords.length > 0) {
    title = `${commonWords.join(' ')} Updates`;
  }
  // Fallback
  else {
    const categories = new Set(changes.map(c => c.category).filter(Boolean));
    if (categories.size === 1) {
      const cat = [...categories][0];
      title = `${capitalize(cat || 'System')} Updates`;
    } else {
      title = 'Multi-Area System Updates';
    }
  }

  // Ensure 4-8 words
  const words = title.split(/\s+/);
  if (words.length < 4) {
    // Pad with context
    title = `PAI ${title}`;
  } else if (words.length > 8) {
    // Truncate
    title = words.slice(0, 8).join(' ');
  }

  return title;
}

/**
 * Extract common patterns from an array of filenames.
 */
function extractCommonPatterns(names: string[]): string[] {
  if (names.length === 0) return [];

  // Convert camelCase/PascalCase to words
  const allWords = names.flatMap(n =>
    n.split(/(?=[A-Z])|[-_]/).filter(w => w.length > 2)
  );

  // Count word frequency
  const freq = new Map<string, number>();
  for (const w of allWords) {
    const lower = w.toLowerCase();
    freq.set(lower, (freq.get(lower) || 0) + 1);
  }

  // Return words that appear in multiple files
  return [...freq.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => capitalize(word));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// Significance Determination
// ============================================================================

/**
 * Determine the significance label based on change characteristics.
 */
function determineSignificance(changes: FileChange[]): SignificanceLabel {
  const count = changes.length;
  const hasStructural = changes.some(c => c.isStructural);
  const hasPhilosophical = changes.some(c => c.isPhilosophical);
  const hasNewFiles = changes.some(c => c.tool === 'Write');

  // Count by category
  const categories = new Set(changes.map(c => c.category).filter(Boolean));
  const hasCoreSystem = changes.some(c => c.category === 'core-system');
  const hasHooks = changes.some(c => c.category === 'hook');
  const hasSkills = changes.some(c => c.category === 'skill');

  // Critical: breaking changes, major restructuring
  if (hasStructural && hasPhilosophical && count >= 5) {
    return 'critical';
  }

  // Major: new skills/workflows, architectural decisions
  if (hasNewFiles && (hasStructural || hasPhilosophical)) {
    return 'major';
  }
  if (hasCoreSystem || (categories.size >= 3)) {
    return 'major';
  }
  if (hasHooks && count >= 3) {
    return 'major';
  }

  // Moderate: multi-file updates, small features
  if (count >= 3 || categories.size >= 2) {
    return 'moderate';
  }
  if (hasSkills && count >= 2) {
    return 'moderate';
  }

  // Minor: single file doc updates
  if (count === 1 && !hasStructural && !hasPhilosophical) {
    return 'minor';
  }

  // Trivial: only if very small doc changes (rare to reach here)
  if (count === 1 && changes[0].category === 'documentation') {
    return 'trivial';
  }

  return 'minor';
}

// ============================================================================
// Change Type Determination
// ============================================================================

/**
 * Determine the change type based on affected files.
 */
function inferChangeType(changes: FileChange[]): ChangeType {
  const categories = changes.map(c => c.category).filter(Boolean);
  const uniqueCategories = new Set(categories);

  // Multi-area if touching 3+ categories
  if (uniqueCategories.size >= 3) {
    return 'multi_area';
  }

  // Single category cases
  if (uniqueCategories.size === 1) {
    const cat = [...uniqueCategories][0];
    switch (cat) {
      case 'skill': return changes.some(c => c.isStructural) ? 'structure_change' : 'skill_update';
      case 'hook': return 'hook_update';
      case 'workflow': return 'workflow_update';
      case 'config': return 'config_update';
      case 'core-system': return 'structure_change';
      case 'documentation': return 'doc_update';
      default: return 'skill_update';
    }
  }

  // Two categories - pick the more significant one
  if (uniqueCategories.has('hook')) return 'hook_update';
  if (uniqueCategories.has('skill')) return 'skill_update';
  if (uniqueCategories.has('workflow')) return 'workflow_update';
  if (uniqueCategories.has('config')) return 'config_update';

  return 'multi_area';
}

// ============================================================================
// Purpose and Improvement Generation
// ============================================================================

/**
 * Generate purpose statement based on changes.
 */
function generatePurpose(changes: FileChange[], title: string): string {
  const changeType = inferChangeType(changes);
  const significance = determineSignificance(changes);

  // Extract skill names for context
  const skillNames = new Set<string>();
  for (const c of changes) {
    const match = c.path.match(/skills\/([^/]+)\//);
    if (match) skillNames.add(match[1]);
  }

  const skillContext = skillNames.size > 0
    ? `in ${[...skillNames].slice(0, 3).join(', ')} skill(s)`
    : '';

  switch (changeType) {
    case 'skill_update':
      return `Update functionality and behavior ${skillContext}`;
    case 'structure_change':
      return `Modify system structure and organization ${skillContext}`;
    case 'doc_update':
      return `Improve documentation clarity and accuracy ${skillContext}`;
    case 'hook_update':
      return 'Enhance lifecycle event handling and automation';
    case 'workflow_update':
      return `Update workflow routing and processes ${skillContext}`;
    case 'config_update':
      return 'Adjust system configuration settings';
    case 'tool_update':
      return `Update tooling capabilities ${skillContext}`;
    case 'multi_area':
      return 'Cross-cutting changes across multiple system areas';
    default:
      return 'System maintenance and updates';
  }
}

/**
 * Generate expected improvement statement.
 */
function generateExpectedImprovement(changes: FileChange[]): string {
  const changeType = inferChangeType(changes);
  const significance = determineSignificance(changes);

  const improvements: string[] = [];

  // Based on change type
  switch (changeType) {
    case 'skill_update':
      improvements.push('Better skill functionality');
      break;
    case 'structure_change':
      improvements.push('Improved system organization');
      break;
    case 'doc_update':
      improvements.push('Clearer documentation');
      break;
    case 'hook_update':
      improvements.push('More reliable automation');
      break;
    case 'workflow_update':
      improvements.push('Smoother workflow execution');
      break;
    case 'config_update':
      improvements.push('Better system behavior');
      break;
    case 'tool_update':
      improvements.push('Enhanced tooling capabilities');
      break;
    case 'multi_area':
      improvements.push('Broader system improvements');
      break;
  }

  // Based on significance
  switch (significance) {
    case 'critical':
      improvements.push('significant behavioral changes');
      break;
    case 'major':
      improvements.push('notable new capabilities');
      break;
    case 'moderate':
      improvements.push('incremental enhancements');
      break;
    case 'minor':
      improvements.push('small refinements');
      break;
    case 'trivial':
      improvements.push('minor corrections');
      break;
  }

  return improvements.join(', ');
}

// ============================================================================
// AI-Powered Narrative Generation
// ============================================================================

interface AIGeneratedNarrative {
  title: string;
  story_background: string;
  story_problem: string;
  story_resolution: string;
  how_it_was: string;
  how_it_was_bullets: string[];
  how_it_is: string;
  how_it_is_bullets: string[];
  future_impact: string;
  future_bullets: string[];
  verification_steps: string[];
}

/**
 * Use Claude to analyze the session and generate meaningful narrative.
 * This replaces the old template-based approach with actual understanding.
 */
async function generateNarrativeWithAI(
  transcriptPath: string,
  changes: FileChange[]
): Promise<AIGeneratedNarrative | null> {
  // Read transcript context
  const messages = readTranscriptContext(transcriptPath);
  const contextSummary = buildContextSummary(messages);

  if (!contextSummary) {
    console.error('[IntegrityMaintenance] No transcript context available');
    return null;
  }

  // Build file changes summary
  const filesSummary = changes
    .map(c => `- ${c.path} (${c.category || 'other'})`)
    .join('\n');

  const prompt = `You are analyzing a Claude Code session to generate documentation for a PAI (Personal AI Infrastructure) system update.

## Session Transcript (most recent messages)
${contextSummary}

## Files Changed
${filesSummary}

## Your Task
Based on the session transcript above, generate a JSON object documenting what happened. Extract SPECIFIC details from the conversation - do NOT use generic placeholder text.

The JSON must have these fields:
{
  "title": "4-8 word specific title describing what was done (e.g., 'Fixed Status Line Weather Display' not 'System Update')",
  "story_background": "1-2 sentences: What was the user trying to accomplish? What was the context?",
  "story_problem": "1-2 sentences: What specific problem or limitation existed? What triggered this work?",
  "story_resolution": "1-2 sentences: How was it solved? What approach was taken?",
  "how_it_was": "1 sentence: What was the previous behavior or state?",
  "how_it_was_bullets": ["Specific previous characteristic 1", "Specific previous characteristic 2"],
  "how_it_is": "1 sentence: What is the new behavior or state?",
  "how_it_is_bullets": ["Specific improvement 1", "Specific improvement 2", "Specific improvement 3"],
  "future_impact": "1 sentence: What does this enable going forward?",
  "future_bullets": ["Specific future implication 1", "Specific future implication 2"],
  "verification_steps": ["How was this verified to work?", "What tests or checks were done?"]
}

CRITICAL RULES:
1. Extract SPECIFIC details from the transcript - names, values, behaviors mentioned
2. NEVER use generic text like "improved functionality" or "updated behavior"
3. If you can't determine something specific, make reasonable inference from context
4. The title should describe WHAT was done, not just WHERE (bad: "System Update", good: "Added Multi-Format Export to Parser")
5. Be concise but specific - every bullet should contain real information

Return ONLY the JSON object, no other text.`;

  try {
    console.error('[IntegrityMaintenance] Calling inference tool for narrative generation...');

    const systemPrompt = 'You are analyzing a Claude Code session to generate documentation. Return ONLY valid JSON, no other text.';

    const result = await inference({
      systemPrompt,
      userPrompt: prompt,
      level: 'fast',  // Use Haiku for cost efficiency
      expectJson: true,
      timeout: 30000,
    });

    if (!result.success) {
      console.error('[IntegrityMaintenance] Inference failed:', result.error);
      return null;
    }

    if (!result.parsed) {
      // Try manual JSON extraction if expectJson didn't work
      const cleanJson = result.output
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleanJson) as AIGeneratedNarrative;
        console.error('[IntegrityMaintenance] AI generated title:', parsed.title);
        return parsed;
      } catch {
        console.error('[IntegrityMaintenance] Failed to parse JSON from response');
        return null;
      }
    }

    const parsed = result.parsed as AIGeneratedNarrative;
    console.error('[IntegrityMaintenance] AI generated title:', parsed.title);
    return parsed;
  } catch (error) {
    console.error('[IntegrityMaintenance] AI inference failed:', error);
    return null;
  }
}

/**
 * Generate verbose narrative - uses AI when transcript is available,
 * falls back to basic inference when not.
 */
async function generateVerboseNarrative(
  transcriptPath: string,
  changes: FileChange[],
  title: string,
  purpose: string,
  expectedImprovement: string
): Promise<{ narrative: VerboseNarrative; aiTitle?: string }> {
  // Try AI-powered generation first
  const aiNarrative = await generateNarrativeWithAI(transcriptPath, changes);

  if (aiNarrative) {
    return {
      narrative: {
        story_background: aiNarrative.story_background,
        story_problem: aiNarrative.story_problem,
        story_resolution: aiNarrative.story_resolution,
        how_it_was: aiNarrative.how_it_was,
        how_it_was_bullets: aiNarrative.how_it_was_bullets,
        how_it_is: aiNarrative.how_it_is,
        how_it_is_bullets: aiNarrative.how_it_is_bullets,
        future_impact: aiNarrative.future_impact,
        future_bullets: aiNarrative.future_bullets,
        verification_steps: aiNarrative.verification_steps,
        verification_commands: [`bun ~/.claude/skills/_SYSTEM/Tools/UpdateSearch.ts recent 5`],
        confidence: 'high',
      },
      aiTitle: aiNarrative.title,
    };
  }

  // Fallback to basic inference (when AI fails or no transcript)
  console.error('[IntegrityMaintenance] Falling back to basic narrative generation');

  const changeType = inferChangeType(changes);
  const skillNames = new Set<string>();
  for (const c of changes) {
    const match = c.path.match(/skills\/([^/]+)\//);
    if (match) skillNames.add(match[1]);
  }
  const skillContext = skillNames.size > 0 ? [...skillNames].slice(0, 3).join(', ') : 'PAI system';

  return {
    narrative: {
      story_background: `Changes were made to ${skillContext} during this session. ${changes.length} file(s) were modified.`,
      story_problem: purpose || `The ${changeType.replace('_', ' ')} required updates.`,
      story_resolution: expectedImprovement || 'The necessary changes were applied.',
      how_it_was: `The system operated with previous configuration.`,
      how_it_was_bullets: changes.slice(0, 3).map(c => `${basename(c.path)} had previous behavior`),
      how_it_is: `The system now includes these updates.`,
      how_it_is_bullets: changes.slice(0, 3).map(c => `${basename(c.path)} updated`),
      future_impact: `The ${changeType.replace('_', ' ')} will use updated behavior.`,
      future_bullets: ['Changes are active for future sessions'],
      verification_steps: ['Changes applied via automatic detection'],
      verification_commands: [`bun ~/.claude/skills/_SYSTEM/Tools/UpdateSearch.ts recent 5`],
      confidence: 'medium',
    },
  };
}

// ============================================================================
// Reference Checking (Stub - actual implementation would grep)
// ============================================================================

/**
 * Check for references to changed files.
 */
function checkReferences(changes: FileChange[]): IntegrityResult {
  // This is a simplified version - full implementation would use ripgrep
  const locations: string[] = [];
  let totalFound = 0;

  for (const change of changes.slice(0, 5)) {
    // Just track the changed paths for now
    locations.push(change.path);
    totalFound += 1;
  }

  return {
    references_found: totalFound,
    references_updated: 0,
    locations_checked: locations,
  };
}

// ============================================================================
// Voice Notification
// ============================================================================

async function sendVoiceNotification(message: string): Promise<void> {
  try {
    const identity = getIdentity();
    const personality = identity.personality;

    if (!personality?.baseVoice) {
      // Fall back to simple notify if no personality configured
      await fetch('http://localhost:8888/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, play: true }),
      });
      return;
    }

    await fetch('http://localhost:8888/notify/personality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        personality: {
          name: identity.name.toLowerCase(),
          base_voice: personality.baseVoice,
          enthusiasm: personality.enthusiasm,
          energy: personality.energy,
          expressiveness: personality.expressiveness,
          resilience: personality.resilience,
          composure: personality.composure,
          optimism: personality.optimism,
          warmth: personality.warmth,
          formality: personality.formality,
          directness: personality.directness,
          precision: personality.precision,
          curiosity: personality.curiosity,
          playfulness: personality.playfulness,
        },
      }),
    });
  } catch {
    // Voice server might not be running - silent fail
  }
}

// ============================================================================
// Create Update Entry
// ============================================================================

async function createUpdateEntry(data: UpdateData): Promise<void> {
  // Prepare JSON input for CreateUpdate.ts
  const input = {
    title: data.title,
    significance: data.significance,
    change_type: data.change_type,
    files: data.files,
    purpose: data.purpose,
    expected_improvement: data.expected_improvement,
    integrity_work: data.integrity_work,
    narrative: data.narrative,
    verbose_narrative: data.verbose_narrative,  // New verbose format
  };

  console.error(`[IntegrityMaintenance] Creating update: ${data.title}`);
  console.error(`[IntegrityMaintenance] Significance: ${data.significance}`);
  console.error(`[IntegrityMaintenance] Change type: ${data.change_type}`);

  // Call CreateUpdate.ts with --stdin
  const child = spawn('bun', [CREATE_UPDATE_SCRIPT, '--stdin'], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  child.stdin?.write(JSON.stringify(input));
  child.stdin?.end();

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CreateUpdate exited with code ${code}`));
    });
  });
}

// ============================================================================
// Main
// ============================================================================

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.error('[IntegrityMaintenance] Starting background integrity check...');

  // Read input from stdin
  let inputData = '';
  for await (const chunk of Bun.stdin.stream()) {
    inputData += new TextDecoder().decode(chunk);
  }

  if (!inputData.trim()) {
    console.error('[IntegrityMaintenance] No input received, exiting');
    return;
  }

  let input: StdinInput;
  try {
    input = JSON.parse(inputData);
  } catch (e) {
    console.error('[IntegrityMaintenance] Invalid JSON input:', e);
    return;
  }

  const { changes, transcript_path } = input;

  if (!changes || changes.length === 0) {
    console.error('[IntegrityMaintenance] No changes to process');
    return;
  }

  console.error(`[IntegrityMaintenance] Processing ${changes.length} changes`);
  console.error(`[IntegrityMaintenance] Transcript path: ${transcript_path}`);

  // Generate basic metadata
  let title = generateDescriptiveTitle(changes);
  const significance = determineSignificance(changes);
  const changeType = inferChangeType(changes);
  const purpose = generatePurpose(changes, title);
  const expectedImprovement = generateExpectedImprovement(changes);
  const integrityWork = checkReferences(changes);

  // Generate AI-powered verbose narrative (uses transcript for context)
  const { narrative: verboseNarrative, aiTitle } = await generateVerboseNarrative(
    transcript_path,
    changes,
    title,
    purpose,
    expectedImprovement
  );

  // Use AI-generated title if it's better than the heuristic-based one
  if (aiTitle) {
    const aiTitleValid = aiTitle.split(/\s+/).length >= 4 && aiTitle.split(/\s+/).length <= 8;
    const isAiTitleGeneric = GENERIC_TITLE_PATTERNS.some(p => p.test(aiTitle));
    if (aiTitleValid && !isAiTitleGeneric) {
      console.error(`[IntegrityMaintenance] Using AI title: "${aiTitle}" (was: "${title}")`);
      title = aiTitle;
    }
  }

  // Check for generic titles and warn (but don't fail)
  const isGeneric = GENERIC_TITLE_PATTERNS.some(p => p.test(title));
  if (isGeneric) {
    console.error(`[IntegrityMaintenance] Warning: Generated generic title "${title}"`);
  }

  // Create the update entry with AI-powered narrative
  const updateData: UpdateData = {
    title,
    significance,
    change_type: changeType,
    files: changes.map(c => c.path),
    purpose,
    expected_improvement: expectedImprovement,
    integrity_work: integrityWork,
    // Legacy narrative for backward compatibility
    narrative: {
      context: verboseNarrative.story_background || 'Changes detected during session activity',
      problem: verboseNarrative.story_problem || 'System files required updates',
      solution: verboseNarrative.story_resolution || 'Applied necessary modifications',
      verification: verboseNarrative.verification_steps?.join('. ') || 'Automatic integrity check completed',
      confidence: verboseNarrative.confidence || 'medium',
    },
    // New verbose narrative is the preferred format
    verbose_narrative: verboseNarrative,
  };

  await createUpdateEntry(updateData);

  // Wait 10 seconds before voice notification to avoid talking over the session completion voice
  console.error('[IntegrityMaintenance] Waiting 10 seconds before voice notification...');
  await sleep(10000);

  // Send voice notification
  const voiceMessage = `Documented ${significance} change: ${title}`;
  await sendVoiceNotification(voiceMessage);

  console.error('[IntegrityMaintenance] Complete');
}

main().catch(err => {
  console.error('[IntegrityMaintenance] Error:', err);
  process.exit(1);
});
