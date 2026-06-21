/**
 * DocCrossRefIntegrity.ts - Hybrid doc integrity checker (deterministic + inference)
 *
 * Two-layer approach:
 * Layer 1 (Deterministic): Grep-based pattern checks for broken refs, counts, timestamps
 * Layer 2 (Inference): AI analysis of semantic drift using Tools/Inference.ts fast tier
 *
 * The deterministic layer detects WHAT changed. The inference layer understands
 * HOW docs need updating — generating surgical edit pairs, never full rewrites.
 *
 * TRIGGER: Stop hook (via DocIntegrity.hook.ts)
 *
 * PATTERN TYPES CHECKED (deterministic):
 * 1. Hook file references (*.hook.ts) - diff against disk
 * 2. Handler file references (handlers/*.ts) - diff against disk
 * 3. Shared lib references (hooks/lib/*.ts) - diff against disk
 * 4. SYSTEM doc path references - validate files exist
 * 5. Numeric counts (e.g., "21 hooks active") - recount from disk
 * 6. Last Updated timestamps - update on modification
 *
 * INFERENCE ANALYSIS:
 * 7. Semantic drift - doc descriptions vs actual file behavior
 * Uses Inference.ts fast tier (~500ms), constrained to surgical edits only
 *
 * AUDIT TRAIL: All operations logged to stderr via [DocAutoUpdate] prefix
 *
 * SIDE EFFECTS:
 * - Updates timestamps, counts (deterministic)
 * - Applies surgical text edits (inference-generated)
 * - Saves drift report to MEMORY/STATE/doc-drift-state.json
 * - Emits doc.integrity event to events.jsonl
 * - Adds unfixable items to MEMORY/STATE/doc-review-queue.json
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { paiPath, getPaiDir } from '../lib/paths';
import { getIdentity } from '../lib/identity';
import { inference } from '../../PAI/Tools/Inference';
import type { ParsedTranscript } from '../../PAI/Tools/TranscriptParser';

// ============================================================================
// Types
// ============================================================================

interface HookInput {
  session_id: string;
  transcript_path: string;
  hook_event_name: string;
}

interface DriftItem {
  doc: string;
  pattern: string;
  reference: string;
  issue: string;
}

interface DriftReport {
  timestamp: string;
  session_id: string;
  docs_checked: string[];
  drift_items: DriftItem[];
  updates_applied: string[];
}

// ============================================================================
// Constants
// ============================================================================

const SYSTEM_DIR = paiPath('PAI');
const HOOKS_DIR = paiPath('hooks');
const HANDLERS_DIR = join(HOOKS_DIR, 'handlers');
const LIB_DIR = join(HOOKS_DIR, 'lib');
const DRIFT_STATE_FILE = paiPath('MEMORY', 'STATE', 'doc-drift-state.json');
const REVIEW_QUEUE_FILE = paiPath('MEMORY', 'STATE', 'doc-review-queue.json');
const ERROR_LOG_FILE = paiPath('MEMORY', 'STATE', 'doc-integrity-errors.log');
const TAG = '[DocAutoUpdate]';

// ============================================================================
// Filesystem Inventory
// ============================================================================

function listFiles(dir: string, suffix: string): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith(suffix))
      .sort();
  } catch {
    return [];
  }
}

function getHookFilesOnDisk(): string[] {
  return listFiles(HOOKS_DIR, '.hook.ts');
}

function getHandlerFilesOnDisk(): string[] {
  return listFiles(HANDLERS_DIR, '.ts');
}

function getLibFilesOnDisk(): string[] {
  return listFiles(LIB_DIR, '.ts');
}

function getSystemDocsOnDisk(): string[] {
  return listFiles(SYSTEM_DIR, '.md');
}

// ============================================================================
// Transcript Parsing
// ============================================================================

function getModifiedFiles(transcriptPath: string): Set<string> {
  const modified = new Set<string>();
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Handle both transcript formats
        if (entry.type === 'tool_use' && (entry.name === 'Write' || entry.name === 'Edit')) {
          const path = entry.input?.file_path || '';
          if (path) modified.add(path);
        }
        if (entry.type === 'assistant' && entry.message?.content) {
          const blocks = Array.isArray(entry.message.content) ? entry.message.content : [];
          for (const block of blocks) {
            if (block.type === 'tool_use' && (block.name === 'Write' || block.name === 'Edit')) {
              const path = block.input?.file_path || '';
              if (path) modified.add(path);
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch (error) {
    console.error(`${TAG} Failed to parse transcript:`, error);
  }
  return modified;
}

function isSystemDocModified(modifiedFiles: Set<string>): boolean {
  for (const path of modifiedFiles) {
    if (path.includes('PAI/') && path.endsWith('.md')) return true;
  }
  return false;
}

function isHookModified(modifiedFiles: Set<string>): boolean {
  for (const path of modifiedFiles) {
    if (path.includes('/hooks/') && path.endsWith('.ts')) return true;
  }
  return false;
}

/**
 * Check if ANY meaningful PAI system file was modified.
 * This is the broader gate — catches skills, hooks, tools, config, components,
 * workflows, and SYSTEM docs.
 * Excludes MEMORY/WORK, MEMORY/LEARNING, MEMORY/STATE, and other non-system paths.
 */
function isSystemFileModified(modifiedFiles: Set<string>): boolean {
  const PAI_DIR = getPaiDir();
  const EXCLUDED = ['MEMORY/WORK/', 'MEMORY/LEARNING/', 'MEMORY/STATE/', 'Plans/', 'projects/', '.git/', 'node_modules/', 'ShellSnapshots/', 'Projects/', 'MEMORY/VOICE/', 'MEMORY/RELATIONSHIP/', 'history.jsonl', '.quote-cache'];
  for (const filePath of modifiedFiles) {
    // Normalize to relative path for checking
    const relPath = filePath.startsWith(PAI_DIR)
      ? filePath.slice(PAI_DIR.length + 1)
      : filePath;
    // Must be within PAI directory
    if (filePath.startsWith('/') && !filePath.startsWith(PAI_DIR)) continue;
    // Skip excluded paths
    if (EXCLUDED.some(ex => relPath.includes(ex))) continue;
    // Match meaningful system files (PAI root MDs, SYSTEM docs, USER dir, Algorithm, Tools, Workflows, skills)
    if ((relPath.startsWith('PAI/') || relPath.includes('skills/')) && (relPath.endsWith('.md') || relPath.endsWith('.ts') || relPath.endsWith('.yaml') || relPath.endsWith('.yml'))) return true;
    if (relPath.includes('hooks/') && relPath.endsWith('.ts')) return true;
    if (relPath.endsWith('settings.json')) return true;
    if (relPath.includes('PAI/Algorithm/') && relPath.endsWith('.md')) return true;
    if (relPath.includes('/Tools/') && relPath.endsWith('.ts')) return true;
    if (relPath.includes('/Workflows/') && relPath.endsWith('.md')) return true;
    if (relPath.startsWith('agents/') && relPath.endsWith('.md')) return true;
    if (relPath === 'CLAUDE.md') return true;
    if (relPath.startsWith('custom-agents/') && relPath.endsWith('.md')) return true;
  }
  return false;
}

// ============================================================================
// Pattern Checkers
// ============================================================================

/**
 * Check Pattern 2: Hook file references in docs vs actual files on disk.
 */
function checkHookFileRefs(docsToCheck: string[], hooksOnDisk: Set<string>): DriftItem[] {
  const drift: DriftItem[] = [];
  const hookRefRegex = /(\w+)\.hook\.ts/g;
  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    const content = readFileSync(docPath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = hookRefRegex.exec(content)) !== null) {
      const hookName = match[0];
      if (!hooksOnDisk.has(hookName)) {
        drift.push({
          doc: docFile,
          pattern: 'hook_file_ref',
          reference: hookName,
          issue: `References "${hookName}" but file does not exist on disk`,
        });
      }
    }
  }
  return drift;
}

/**
 * Check Pattern 3: Handler file references in docs vs actual files on disk.
 */
function checkHandlerFileRefs(docsToCheck: string[], handlersOnDisk: Set<string>): DriftItem[] {
  const drift: DriftItem[] = [];
  const handlerRefRegex = /handlers\/(\w+)\.ts/g;
  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    const content = readFileSync(docPath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = handlerRefRegex.exec(content)) !== null) {
      const handlerFilename = `${match[1]}.ts`;
      if (!handlersOnDisk.has(handlerFilename)) {
        drift.push({
          doc: docFile,
          pattern: 'handler_file_ref',
          reference: match[0],
          issue: `References "${match[0]}" but "${handlerFilename}" does not exist in handlers/`,
        });
      }
    }
  }
  return drift;
}

/**
 * Check Pattern 4: Shared lib file references in docs vs actual files on disk.
 */
function checkLibFileRefs(docsToCheck: string[], libsOnDisk: Set<string>): DriftItem[] {
  const drift: DriftItem[] = [];
  const libRefRegex = /hooks\/lib\/([\w-]+)\.ts/g;
  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    const content = readFileSync(docPath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = libRefRegex.exec(content)) !== null) {
      const libFilename = `${match[1]}.ts`;
      if (!libsOnDisk.has(libFilename)) {
        drift.push({
          doc: docFile,
          pattern: 'lib_file_ref',
          reference: match[0],
          issue: `References "${match[0]}" but "${libFilename}" does not exist in hooks/lib/`,
        });
      }
    }
  }
  return drift;
}

/**
 * Check Pattern 1: SYSTEM doc cross-references validate target files exist.
 */
function checkSystemDocRefs(docsToCheck: string[], systemDocsOnDisk: Set<string>): DriftItem[] {
  const drift: DriftItem[] = [];
  const sysDocRefRegex = /(?:`|'|")(?:~\/\.claude\/)?(?:skills\/)?PAI\/([\w/]+\.md)(?:`|'|")/g;
  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    const content = readFileSync(docPath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = sysDocRefRegex.exec(content)) !== null) {
      const refTarget = match[1];
      const targetPath = join(SYSTEM_DIR, refTarget);
      if (!existsSync(targetPath)) {
        drift.push({
          doc: docFile,
          pattern: 'system_doc_ref',
          reference: `PAI/${refTarget}`,
          issue: `References "PAI/${refTarget}" but file does not exist`,
        });
      }
    }
  }
  return drift;
}

/**
 * Check Pattern 5: Numeric hook counts in docs vs actual count on disk.
 */
function checkHookCounts(docsToCheck: string[], actualCount: number): DriftItem[] {
  const drift: DriftItem[] = [];
  const countRegex = /\*\*Status:\*\*.*?(\d+) hooks? active/g;
  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    const content = readFileSync(docPath, 'utf-8');
    let match: RegExpExecArray | null;
    while ((match = countRegex.exec(content)) !== null) {
      const docCount = parseInt(match[1], 10);
      if (docCount !== actualCount) {
        drift.push({
          doc: docFile,
          pattern: 'hook_count',
          reference: match[0],
          issue: `States "${docCount} hooks active" but actual count on disk is ${actualCount}`,
        });
      }
    }
  }
  return drift;
}

// ============================================================================
// Voice Notification (fire-and-forget)
// ============================================================================

async function notifyVoice(message: string): Promise<void> {
  try {
    await fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({ message, voice_id: getIdentity().mainDAVoiceID }),
    });
  } catch {
    // Voice server may not be running — silent fail
  }
}

// ============================================================================
// Review Queue (for drift items that need human judgment)
// ============================================================================

interface ReviewItem {
  timestamp: string;
  type: 'broken_hook_ref' | 'broken_handler_ref' | 'broken_lib_ref' | 'broken_doc_ref' | 'count_mismatch';
  description: string;
  doc: string;
  reference: string;
}

function addToReviewQueue(driftItems: DriftItem[]): void {
  if (driftItems.length === 0) return;

  let queue: ReviewItem[] = [];
  try {
    if (existsSync(REVIEW_QUEUE_FILE)) {
      queue = JSON.parse(readFileSync(REVIEW_QUEUE_FILE, 'utf-8'));
    }
  } catch { queue = []; }

  const now = new Date().toISOString();
  const newItems: ReviewItem[] = driftItems.map(item => ({
    timestamp: now,
    type: item.pattern as ReviewItem['type'],
    description: item.issue,
    doc: item.doc,
    reference: item.reference,
  }));
  queue.push(...newItems);
  if (queue.length > 50) queue = queue.slice(-50);

  const dir = dirname(REVIEW_QUEUE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(REVIEW_QUEUE_FILE, JSON.stringify(queue, null, 2));
  console.error(`${TAG} Added ${newItems.length} item(s) to review queue: ${REVIEW_QUEUE_FILE}`);
}

// ============================================================================
// Inference-Powered Semantic Analysis
// ============================================================================

interface InferenceEdit {
  doc: string;
  old_text: string;
  new_text: string;
  reason: string;
}

const INFERENCE_SYSTEM_PROMPT = `You are a documentation accuracy checker. You receive:
1. A list of source files that were modified (with their current content)
2. Documentation sections that reference those files

Your job: identify where documentation is now FACTUALLY INCORRECT given the source changes.
OUTPUT FORMAT: Return a JSON array of surgical edits:
[{"doc": "filename.md", "old_text": "exact text to replace", "new_text": "corrected text", "reason": "brief explanation"}]

RULES (CRITICAL):
- Update anything that is NOW FACTUALLY WRONG because of the source changes
- This includes: file names, descriptions of behavior, counts, paths, handler lists, process descriptions
- If a system was fundamentally redesigned, update the doc sections that describe it to match the new reality
- old_text must be an EXACT substring from the doc (copy-paste precision)
- new_text should change ONLY the parts affected by the source change — preserve everything else exactly
- The user's original INTENT and PHILOSOPHY must be preserved — update facts, never change the "why" or design rationale unless it was explicitly invalidated by the change
- Writing style, tone, and voice must stay exactly as-is
- DO NOT "improve" or "clean up" text that wasn't affected by the change
- DO NOT add commentary, opinions, or explanations beyond what was already there
- If nothing is factually wrong given the changes, return an empty array: []
- Maximum 10 edits per response

Return ONLY the JSON array, no other text.`;

function buildInferenceContext(modifiedFiles: Set<string>, docsToCheck: string[]): string {
  const parts: string[] = [];
  const relevantFiles = Array.from(modifiedFiles).filter(f =>
    f.includes('/hooks/') ||
    f.includes('/PAI/') ||
    f.includes('skills/') ||
    f.endsWith('settings.json') ||
    f.includes('/agents/') ||
    f.includes('/custom-agents/') ||
    f.endsWith('CLAUDE.md'),
  );
  for (const filePath of relevantFiles.slice(0, 5)) {
    try {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const snippet = lines.slice(0, 60).join('\n');
      parts.push(`=== SOURCE FILE: ${basename(filePath)} ===\n${snippet}\n`);
    } catch {
      // Skip unreadable
    }
  }

  for (const docFile of docsToCheck) {
    const docPath = join(SYSTEM_DIR, docFile);
    if (!existsSync(docPath)) continue;
    try {
      const content = readFileSync(docPath, 'utf-8');
      const referencesModified = relevantFiles.some(f => {
        const name = basename(f, '.ts').replace('.hook', '');
        return content.includes(name);
      });
      if (referencesModified) {
        const lines = content.split('\n');
        const sections: string[] = [];
        let currentSection: string[] = [];
        let currentSectionRelevant = false;
        for (let i = 0; i < lines.length; i++) {
          const isHeading = lines[i].match(/^#{1,3} /);
          if (isHeading && currentSection.length > 0) {
            if (currentSectionRelevant) {
              sections.push(currentSection.join('\n'));
            }
            currentSection = [lines[i]];
            currentSectionRelevant = false;
          } else {
            currentSection.push(lines[i]);
          }

          if (!currentSectionRelevant) {
            currentSectionRelevant = relevantFiles.some(f => {
              const name = basename(f, '.ts').replace('.hook', '');
              return lines[i].includes(name);
            });
          }
        }
        if (currentSectionRelevant && currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
        }

        if (sections.length > 0) {
          const docContext = sections.join('\n\n---\n\n').slice(0, 4000);
          parts.push(`=== DOC: ${docFile} (affected sections) ===\n${docContext}\n`);
        }
      }
    } catch {
      // Skip unreadable
    }
  }
  return parts.join('\n');
}

async function runInferenceAnalysis(modifiedFiles: Set<string>, docsToCheck: string[]): Promise<InferenceEdit[]> {
  const startTime = Date.now();
  const context = buildInferenceContext(modifiedFiles, docsToCheck);
  if (!context.trim()) {
    return [];
  }

  try {
    const result = await inference({
      systemPrompt: INFERENCE_SYSTEM_PROMPT,
      userPrompt: `Analyze these source file changes and documentation sections for factual inaccuracies:\n\n${context}`,
      level: 'standard',
      expectJson: true,
      timeout: 15000,
    });

    if (!result.success) {
      // SILENT FAILURE TO LOCAL DISK STREAM: Prevents token caching validation breakages via stderr leakage
      try {
        const dir = dirname(ERROR_LOG_FILE);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const errLog = `[${new Date().toISOString()}] Inference Failure: ${result.error}\n`;
        appendFileSync(ERROR_LOG_FILE, errLog);
      } catch {}
      return [];
    }

    const rawEdits = result.parsed as InferenceEdit[] | undefined;
    if (!Array.isArray(rawEdits)) {
      return [];
    }

    const validEdits: InferenceEdit[] = [];
    for (const edit of rawEdits.slice(0, 10)) {
      if (!edit.doc || !edit.old_text || !edit.new_text || !edit.reason) {
        continue;
      }

      const docPath = join(SYSTEM_DIR, edit.doc);
      if (!existsSync(docPath)) continue;

      const docContent = readFileSync(docPath, 'utf-8');
      if (!docContent.includes(edit.old_text)) continue;
      if (edit.old_text === edit.new_text) continue;

      validEdits.push(edit);
    }
    return validEdits;
  } catch (error) {
    // SILENT EXCEPTION PASSING: Prevents raw try/catch diagnostic context bleeding
    try {
      const dir = dirname(ERROR_LOG_FILE);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const errLog = `[${new Date().toISOString()}] Runtime Exception: ${error}\n`;
      appendFileSync(ERROR_LOG_FILE, errLog);
    } catch {}
    return [];
  }
}

function applyInferenceEdits(edits: InferenceEdit[]): string[] {
  const applied: string[] = [];
  for (const edit of edits) {
    const docPath = join(SYSTEM_DIR, edit.doc);
    try {
      const content = readFileSync(docPath, 'utf-8');
      if (!content.includes(edit.old_text)) {
        console.error(`${TAG} [INFERENCE-APPLY] old_text no longer found in ${edit.doc}, skipping`);
        continue;
      }

      const updated = content.replace(edit.old_text, edit.new_text);
      writeFileSync(docPath, updated);
      const summary = `[INFERENCE] ${edit.doc}: ${edit.reason} ("${edit.old_text.slice(0, 40)}..." → "${edit.new_text.slice(0, 40)}...")`;
      console.error(`${TAG} [UPDATED] ${summary}`);
      applied.push(summary);
    } catch (error) {
      console.error(`${TAG} [INFERENCE-APPLY] Failed on ${edit.doc}: ${error}`);
    }
  }
  return applied;
}

// ============================================================================
// Deterministic Updates (safe auto-fixes)
// ============================================================================

/**
 * Update Pattern 6: Last Updated timestamps in modified docs.
 */
function updateLastUpdatedTimestamp(docFile: string): string | null {
  const docPath = join(SYSTEM_DIR, docFile);
  if (!existsSync(docPath)) return null;
  const content = readFileSync(docPath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  const timestampRegex = /(\**Last Updated:\*\* )\d{4}-\d{2}-\d{2}/;

  const match = content.match(timestampRegex);
  if (match && !content.includes(`**Last Updated:** ${today}`)) {
    const updated = content.replace(timestampRegex, `$1${today}`);
    writeFileSync(docPath, updated);
    return `Updated "Last Updated" in ${docFile}: ${match[0]} -> **Last Updated:** ${today}`;
  }
  return null;
}

/**
 * Update Pattern 5: Hook count in THEHOOKSYSTEM.md.
 */
function updateHookCount(actualCount: number): string | null {
  const docPath = join(SYSTEM_DIR, 'THEHOOKSYSTEM.md');
  if (!existsSync(docPath)) return null;

  const content = readFileSync(docPath, 'utf-8');
  const countRegex = /(\**Status:\*\* Production - )\d+( hooks? active)/;

  const match = content.match(countRegex);
  if (match) {
    const oldCount = parseInt(content.match(/\*\*Status:\*\* Production - (\d+)/)?.[1] || '0', 10);
    if (oldCount !== actualCount) {
      const updated = content.replace(countRegex, `$1${actualCount}$2`);
      writeFileSync(docPath, updated);
      return `Updated hook count in THEHOOKSYSTEM.md: ${oldCount} -> ${actualCount}`;
    }
  }
  return null;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleDocCrossRefIntegrity(
  parsed: ParsedTranscript,
  hookInput: HookInput
): Promise<void> {
  const handlerStart = Date.now();
  console.error(`${TAG} === Starting hybrid doc integrity check (deterministic + inference) ===`);

  // Step 1: Parse transcript for modified files
  const modifiedFiles = getModifiedFiles(hookInput.transcript_path);
  console.error(`${TAG} Modified files in session: ${modifiedFiles.size}`);

  // Run if ANY meaningful PAI system file was modified (skills, hooks, tools, config, components, workflows, SYSTEM docs)
  const hasDocChanges = isSystemDocModified(modifiedFiles);
  const hasHookChanges = isHookModified(modifiedFiles);
  const hasAnySystemChange = isSystemFileModified(modifiedFiles);

  if (!hasAnySystemChange) {
    console.error(`${TAG} No meaningful system files modified, skipping`);
    return;
  }

  console.error(`${TAG} System docs modified: ${hasDocChanges}`);
  console.error(`${TAG} Hook files modified: ${hasHookChanges}`);
  console.error(`${TAG} System file change detected: ${hasAnySystemChange}`);

  // Step 2: Build filesystem inventory
  const hooksOnDisk = new Set(getHookFilesOnDisk());
  const handlersOnDisk = new Set(getHandlerFilesOnDisk());
  const libsOnDisk = new Set(getLibFilesOnDisk());
  const systemDocsOnDisk = new Set(getSystemDocsOnDisk());
  console.error(`${TAG} Inventory: ${hooksOnDisk.size} hooks, ${handlersOnDisk.size} handlers, ${libsOnDisk.size} libs, ${systemDocsOnDisk.size} system docs`);

  // Step 3: Determine which docs to check
  const docsToCheck = Array.from(systemDocsOnDisk);
  console.error(`${TAG} Checking ${docsToCheck.length} SYSTEM docs for cross-reference drift`);

  // Step 4: Run all pattern checks
  const allDrift: DriftItem[] = [];

  // Pattern 2: Hook file references
  const hookDrift = checkHookFileRefs(docsToCheck, hooksOnDisk);
  if (hookDrift.length > 0) {
    console.error(`${TAG} [DRIFT] Hook file references: ${hookDrift.length} broken refs found`);
    for (const item of hookDrift) {
      console.error(`${TAG}   - ${item.doc}: ${item.issue}`);
    }
    allDrift.push(...hookDrift);
  } else {
    console.error(`${TAG} [OK] Hook file references: all valid`);
  }

  // Pattern 3: Handler file references
  const handlerDrift = checkHandlerFileRefs(docsToCheck, handlersOnDisk);
  if (handlerDrift.length > 0) {
    console.error(`${TAG} [DRIFT] Handler file references: ${handlerDrift.length} broken refs found`);
    for (const item of handlerDrift) {
      console.error(`${TAG}   - ${item.doc}: ${item.issue}`);
    }
    allDrift.push(...handlerDrift);
  } else {
    console.error(`${TAG} [OK] Handler file references: all valid`);
  }

  // Pattern 4: Lib file references
  const libDrift = checkLibFileRefs(docsToCheck, libsOnDisk);
  if (libDrift.length > 0) {
    console.error(`${TAG} [DRIFT] Lib file references: ${libDrift.length} broken refs found`);
    for (const item of libDrift) {
      console.error(`${TAG}   - ${item.doc}: ${item.issue}`);
    }
    allDrift.push(...libDrift);
  } else {
    console.error(`${TAG} [OK] Lib file references: all valid`);
  }

  // Pattern 1: System doc cross-references
  const sysDocDrift = checkSystemDocRefs(docsToCheck, systemDocsOnDisk);
  if (sysDocDrift.length > 0) {
    console.error(`${TAG} [DRIFT] System doc references: ${sysDocDrift.length} broken refs found`);
    for (const item of sysDocDrift) {
      console.error(`${TAG}   - ${item.doc}: ${item.issue}`);
    }
    allDrift.push(...sysDocDrift);
  } else {
    console.error(`${TAG} [OK] System doc references: all valid`);
  }

  // Pattern 5: Hook counts
  const hookCountDrift = checkHookCounts(docsToCheck, hooksOnDisk.size);
  if (hookCountDrift.length > 0) {
    console.error(`${TAG} [DRIFT] Hook counts: ${hookCountDrift.length} mismatches found`);
    for (const item of hookCountDrift) {
      console.error(`${TAG}   - ${item.doc}: ${item.issue}`);
    }
    allDrift.push(...hookCountDrift);
  } else {
    console.error(`${TAG} [OK] Hook counts: accurate`);
  }

  // Step 5: Apply safe deterministic updates
  const updatesApplied: string[] = [];

  // Update Last Updated timestamps for modified SYSTEM docs
  for (const path of modifiedFiles) {
    if (path.includes('PAI/') && path.endsWith('.md')) {
      const docFile = basename(path);
      const result = updateLastUpdatedTimestamp(docFile);
      if (result) {
        console.error(`${TAG} [UPDATED] ${result}`);
        updatesApplied.push(result);
      }
    }
  }

  // Auto-fix hook count if drifted
  if (hasHookChanges) {
    const countResult = updateHookCount(hooksOnDisk.size);
    if (countResult) {
      console.error(`${TAG} [UPDATED] ${countResult}`);
      updatesApplied.push(countResult);
    }
  }

  // ============================================================================
  // Step 6: Inference-powered semantic analysis
  // ============================================================================
  let inferenceEditsCount = 0; // Pre-initialized function-scoped safety tracker

  if (allDrift.length > 0) {
    console.error(`${TAG} === Running inference analysis ===`);
    const inferenceEdits = await runInferenceAnalysis(modifiedFiles, docsToCheck);
    if (inferenceEdits && inferenceEdits.length > 0) {
      inferenceEditsCount = inferenceEdits.length; // Assigned safely inside valid tier execution path
      const inferenceApplied = applyInferenceEdits(inferenceEdits);
      updatesApplied.push(...inferenceApplied);
    } else {
      console.error(`${TAG} [INFERENCE] No semantic corrections needed`);
    }
  } else {
    console.error(`${TAG} [INFERENCE] Skipped — no drift detected`);
  }

  // ============================================================================
  // Step 7: Save drift report
  // ============================================================================
  const report: DriftReport = {
    timestamp: new Date().toISOString(),
    session_id: hookInput.session_id,
    docs_checked: docsToCheck,
    drift_items: allDrift,
    updates_applied: updatesApplied,
  };

  try {
    writeFileSync(DRIFT_STATE_FILE, JSON.stringify(report, null, 2));
    console.error(`${TAG} Drift report saved to ${DRIFT_STATE_FILE}`);
  } catch (error) {
    console.error(`${TAG} Failed to save drift report:`, error);
  }

  // ============================================================================
  // Step 8: Add unfixable drift items to review queue
  // ============================================================================
  if (allDrift.length > 0) {
    addToReviewQueue(allDrift);
  }

  // ============================================================================
  // Step 9: Summary
  // ============================================================================
  const totalElapsed = Date.now() - handlerStart;
  console.error(`${TAG} === Summary (${totalElapsed}ms) ===`);
  console.error(`${TAG} Docs checked: ${docsToCheck.length}`);
  console.error(`${TAG} Drift items found: ${allDrift.length}`);
  
  // FIXED LOGGING SUMMARY: Always reads a guaranteed numerical scalar value
  console.error(`${TAG} Updates applied: ${updatesApplied.length} (${updatesApplied.length - inferenceEditsCount} deterministic, ${inferenceEditsCount} inference)`);

  if (allDrift.length > 0) {
    console.error(`${TAG} WARNING: ${allDrift.length} cross-reference drift items need manual attention`);
    console.error(`${TAG} Review: ${DRIFT_STATE_FILE}`);
  } else {
    console.error(`${TAG} All cross-references valid`);
  }
  console.error(`${TAG} Wall time: ${totalElapsed}ms`);
  console.error(`${TAG} === Check complete ===`);

  // Step 10: Voice notification — ONLY when actual documentation edits were applied
  if (updatesApplied.length > 0) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const affectedDocs = new Set<string>();
    for (const update of updatesApplied) {
      const docMatch = update.match(/(?:in |] )(\w+\.md)/);
      if (docMatch) affectedDocs.add(docMatch[1].replace('.md', ''));
    }

    const docNames = Array.from(affectedDocs).slice(0, 3).join(', ') || 'system';
    const reason = hasHookChanges ? 'hook system changes' : hasDocChanges ? 'system documentation changes' : 'system file changes';
    await notifyVoice(`Updated ${docNames} documentation after detecting ${reason}.`);
  }
}