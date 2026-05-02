#!/usr/bin/env bun
/**
 * ContainmentGuard.hook.ts — PreToolUse Edit/Write/MultiEdit gate
 *
 * Blocks writes that would leak sensitive identity/infra strings into
 * files outside the Z1-Z4 containment zones used by ShadowRelease.
 *
 * Z1 USER/**            Z3 PAI/MEMORY/**
 * Z2 settings*.json     Z4 skills/_*
 *
 * Anything outside those zones must stay clean of:
 *   /Users/daniel, daniel@, kai@unsupervised-learning, danielmiessler.com,
 *   admin.ul.live, 889c0252fcc9f919765fa9f62467d46e (CF account ID),
 *   0baeb281c44f46878a4650ee3ff26b5b (CF KV namespace ID).
 *
 * TRIGGER: PreToolUse (matcher: Edit, Write, MultiEdit)
 * EXIT CODES: 0 = allow, 2 = deny (blocks the write)
 *
 * Test safely:
 *   echo '{"tool_name":"Write","tool_input":{"file_path":"/Users/daniel/.claude/hooks/demo.ts","content":"const u = \"/Users/daniel\";"}}' | bun run hooks/ContainmentGuard.hook.ts; echo $?
 */

import { readFileSync } from 'fs';
import { isContained, isPatternAllowlisted, relativeToClaudeRoot } from './lib/containment-zones';
import { getClaudeDir } from './lib/paths';

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

interface ScanTarget {
  filePath: string;
  content: string;
  label: string;
}

const IDENTITY_PATTERNS: readonly string[] = [
  '/Users/daniel',
  'daniel@',
  'kai@unsupervised-learning',
  'danielmiessler.com',
  'admin.ul.live',
  '889c0252fcc9f919765fa9f62467d46e',
  '0baeb281c44f46878a4650ee3ff26b5b',
];

const CLAUDE_ROOT = getClaudeDir();

function isUnderClaudeRoot(filePath: string): boolean {
  const prefix = CLAUDE_ROOT.endsWith('/') ? CLAUDE_ROOT : CLAUDE_ROOT + '/';
  return filePath === CLAUDE_ROOT || filePath.startsWith(prefix);
}

function isFileContained(filePath: string): boolean {
  // Files outside ~/.claude/ are personal project repos (~/Projects, ~/LocalProjects, etc.)
  // and are not part of the PAI release tree that ShadowRelease scrubs. The containment
  // guard exists to keep PAI public-release content clean — not to police Daniel's own projects.
  if (!isUnderClaudeRoot(filePath)) return true;
  if (isPatternAllowlisted(relativeToClaudeRoot(filePath, CLAUDE_ROOT))) return true;
  return isContained(filePath, CLAUDE_ROOT);
}

function extractScanTargets(toolName: string, toolInput: Record<string, unknown>): ScanTarget[] {
  const targets: ScanTarget[] = [];
  const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : '';
  if (!filePath) return targets;
  if (toolName === 'Write') {
    const content = typeof toolInput.content === 'string' ? toolInput.content : '';
    targets.push({ filePath, content, label: 'content' });
    return targets;
  }
  if (toolName === 'Edit') {
    const newString = typeof toolInput.new_string === 'string' ? toolInput.new_string : '';
    targets.push({ filePath, content: newString, label: 'new_string' });
    return targets;
  }
  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [];
    edits.forEach((edit, index) => {
      if (!edit || typeof edit !== 'object') return;
      const ns = (edit as Record<string, unknown>).new_string;
      if (typeof ns === 'string') targets.push({ filePath, content: ns, label: `edits[${index}].new_string` });
    });
  }
  return targets;
}

function findMatch(content: string): string | undefined {
  for (const pattern of IDENTITY_PATTERNS) {
    if (content.includes(pattern)) return pattern;
  }
  return undefined;
}

function main(): void {
  let input: HookInput;
  try {
    const raw = readFileSync('/dev/stdin', 'utf-8');
    if (!raw.trim()) return;
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const toolName = input.tool_name ?? '';
  if (toolName !== 'Write' && toolName !== 'Edit' && toolName !== 'MultiEdit') return;
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== 'object') return;

  const targets = extractScanTargets(toolName, toolInput as Record<string, unknown>);
  for (const target of targets) {
    if (isFileContained(target.filePath)) continue;
    const hit = findMatch(target.content);
    if (!hit) continue;
    process.stderr.write(
      `[ContainmentGuard] 🚨 BLOCKED: ${toolName} ${target.filePath} (${target.label}) would write '${hit}' outside Z1-Z4 containment. ` +
      `Route via env var, move the file under PAI/USER/, PAI/MEMORY/, skills/_*, or rewrite the content.\n`,
    );
    process.exit(2);
  }
}

main();
