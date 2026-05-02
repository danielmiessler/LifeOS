#!/usr/bin/env bun
/**
 * SmartApprover.hook.ts — PermissionRequest entry point
 *
 * Replaces TrustedWorkspaceApprover with a smarter permission model:
 * 1. Trusted workspace paths → auto-approve (fast path, no LLM)
 * 2. Non-trusted paths → classify read vs write via haiku
 * 3. Read operations → auto-approve
 * 4. Write operations → let user decide
 *
 * TRIGGER: PermissionRequest (matcher: Write|Edit|MultiEdit|Bash)
 */

import { resolve } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { paiPath } from '../PAI/lib/paths';
import { getClaudeDir } from './lib/paths';

const HOME = homedir();

const TRUSTED_PREFIXES = [
  getClaudeDir() + '/',
  resolve(HOME, 'Projects') + '/',
  resolve(HOME, 'LocalProjects') + '/',
  resolve(HOME, 'Downloads') + '/',
  '/tmp/',
  '/private/tmp/',
  '/var/folders/',
];

// ── Permission Cache ──

interface PermissionCache {
  [toolKey: string]: 'allow' | 'ask';
}

const CACHE_PATH = paiPath('USER', 'SECURITY', 'permission-cache.yaml');
let memoryCache: PermissionCache = {};

function loadCache(): PermissionCache {
  if (Object.keys(memoryCache).length > 0) return memoryCache;
  try {
    if (existsSync(CACHE_PATH)) {
      const raw = readFileSync(CACHE_PATH, 'utf-8');
      memoryCache = JSON.parse(raw);
    }
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

function saveCache(): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(memoryCache, null, 2));
  } catch {
    // Cache write failure is non-fatal
  }
}

// ── Path Classification ──

function isTrustedPath(filePath: string): boolean {
  const expanded = filePath.startsWith('~')
    ? filePath.replace('~', HOME)
    : filePath;
  const normalized = resolve(expanded);
  return TRUSTED_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

function bashTargetsTrustedPath(command: string): boolean {
  const patterns = [
    '~/.claude/', `${HOME}/.claude/`,
    '~/Projects/', `${HOME}/Projects/`,
    '~/LocalProjects/', `${HOME}/LocalProjects/`,
    '$HOME/.claude/', '${HOME}/.claude/',
    '$HOME/Projects/', '${HOME}/Projects/',
  ];
  return patterns.some(p => command.includes(p));
}

// ── Read/Write Classification ──

async function classifyReadWrite(toolName: string, toolInput: Record<string, unknown>): Promise<'read' | 'write'> {
  // Static classification for known tools
  if (toolName === 'Read' || toolName === 'Glob' || toolName === 'Grep') return 'read';
  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') return 'write';

  // For Bash, check command heuristically
  if (toolName === 'Bash') {
    const command = (toolInput?.command as string) || '';
    const readOnlyPatterns = [
      /^(ls|cat|head|tail|wc|file|stat|du|df|which|type|echo|printf)\b/,
      /^(git\s+(status|log|diff|show|branch|tag|remote|rev-parse))\b/,
      /^(rg|grep|fd|find|bat|eza|tree|jq|yq)\b/,
      /^(bun\s+run\s+(test|check|lint|type-check|build))\b/,
      /^(node|bun|deno)\s+.*\s+--version/,
      /^(curl|wget)\s+-s\s/,
      /^date\b/,
      /^pwd\b/,
    ];
    if (readOnlyPatterns.some(p => p.test(command))) return 'read';
    return 'write'; // Default bash to write (conservative)
  }

  return 'write'; // Default to write (conservative)
}

// ── Main ──

async function main(): Promise<void> {
  const { readFileSync } = await import('fs');
  let rawText: string;
  try {
    rawText = readFileSync('/dev/stdin', 'utf-8');
  } catch {
    return;
  }

  if (!rawText.trim()) return;

  let input: { tool_name?: string; tool_input?: Record<string, unknown> };
  try {
    input = JSON.parse(rawText);
  } catch {
    return; // Parse error → let user decide
  }

  const toolName = input.tool_name ?? '';
  const toolInput = input.tool_input ?? {};
  const filePath = toolInput.file_path as string | undefined;
  const command = toolInput.command as string | undefined;

  // MCP tools matched by PermissionRequest matcher are pre-vetted
  const isMcpTool = toolName.startsWith('mcp__');

  // Fast path: trusted workspace
  const trusted = isMcpTool
    ? true
    : filePath
      ? isTrustedPath(filePath)
      : command
        ? bashTargetsTrustedPath(command)
        : false;

  if (trusted) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' },
      },
    }));
    return;
  }

  // Non-trusted: classify read vs write
  const cacheKey = `${toolName}:${(filePath || command || '').slice(0, 100)}`;
  const cache = loadCache();

  if (cache[cacheKey]) {
    if (cache[cacheKey] === 'allow') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'allow' },
        },
      }));
    }
    // 'ask' → return without output, letting user decide
    return;
  }

  const classification = await classifyReadWrite(toolName, toolInput);

  if (classification === 'read') {
    memoryCache[cacheKey] = 'allow';
    saveCache();
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'allow' },
      },
    }));
  }
  // Write operations: don't cache, let user decide each time
}

main().catch(() => process.exit(0));
