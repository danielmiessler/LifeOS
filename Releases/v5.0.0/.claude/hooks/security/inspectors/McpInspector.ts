/**
 * McpInspector — PreToolUse defense surface for MCP-server tools.
 *
 * MCP server tools are loaded into the agent's context with their full
 * description, name, and parameter schema. A malicious or sloppy server
 * can:
 *   1. Name a tool to impersonate a core tool (mcp__x__bash, mcp__x__read).
 *   2. Encode prompt-injection payloads in its description so the agent
 *      passes crafted arguments back through the same tool.
 *   3. Surface as a brand-new server mid-session without the user ever
 *      having vetted it (a fresh `claude mcp add` away).
 *
 * This inspector defends against (1), (2-via-arguments), and (3). It does
 * NOT defend against the description itself entering the prompt (that
 * happens at MCP-server registration, before any inspector runs); the
 * description-scan story belongs upstream of PreToolUse and is documented
 * as such in the README. What is catchable here is *every consequence* of
 * a poisoned description that flows back through tool input — which is
 * the actual exfiltration path.
 *
 * Three defenses:
 *   A. Tool-name impersonation — DENY when the suffix matches a core
 *      tool name (bash, read, write, edit, multiedit, task, webfetch,
 *      websearch, glob, grep). No legitimate MCP server should publish
 *      a tool with these names; the only purpose is confusion.
 *
 *   B. Argument injection scan — REQUIRE_APPROVAL when any string-valued
 *      argument matches an injection pattern. Reuses the same regex set
 *      InjectionInspector applies to tool RESULTS, applied here to
 *      tool INPUTS. Catches the case where description-side injection
 *      already steered the agent and we are about to act on it.
 *
 *   C. First-call quarantine — REQUIRE_APPROVAL the first time a given
 *      `mcp__<server>__<tool>` is invoked in a session. Subsequent calls
 *      in the same session are silently approved. Per-session cache
 *      keyed on session_id.
 *
 * Priority: 70 — runs after Pattern (100) and Egress (90), before Rules
 * (50). MCP-namespaced tools never go through Pattern (which is
 * Bash-specific), so this slots in cleanly.
 *
 * Fail-open: any internal error returns ALLOW with an alert log. This
 * inspector is defense-in-depth, not the primary security boundary —
 * its failures must not block legitimate work.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { Inspector, InspectionContext, InspectionResult } from '../types';
import { ALLOW, alert, deny, requireApproval } from '../types';
import { paiPath } from '../../lib/paths';

const IMPERSONATED_CORE_TOOLS = new Set<string>([
  'bash', 'read', 'write', 'edit', 'multiedit',
  'task', 'webfetch', 'websearch', 'glob', 'grep',
  'notebookedit', 'exitplanmode', 'todowrite',
]);

interface ArgPattern {
  regex: RegExp;
  category: string;
  description: string;
}

const ARG_INJECTION_PATTERNS: ArgPattern[] = [
  { regex: /ignore\s+(all\s+)?previous\s+instructions/i, category: 'instruction_override', description: 'Ignore previous instructions' },
  { regex: /forget\s+(everything|what|all|your)\s+(you\s+)?(were|know|previous)/i, category: 'instruction_override', description: 'Forget previous context' },
  { regex: /your\s+new\s+instructions\s+are/i, category: 'instruction_override', description: 'New instructions directive' },
  { regex: /disregard\s+(all\s+)?(prior|previous|above)/i, category: 'instruction_override', description: 'Disregard prior instructions' },

  { regex: /\[SYSTEM\]\s*:/i, category: 'system_impersonation', description: 'System message impersonation' },
  { regex: /\[ADMIN\]\s*:/i, category: 'system_impersonation', description: 'Admin message impersonation' },
  { regex: /system\s+override\s*:/i, category: 'system_impersonation', description: 'System override directive' },

  { regex: /sk-[A-Za-z0-9]{20,}/, category: 'credential_exfiltration', description: 'API key shape (sk-...)' },
  { regex: /ghp_[A-Za-z0-9]{20,}/, category: 'credential_exfiltration', description: 'GitHub PAT shape (ghp_...)' },
  { regex: /-----BEGIN\s+(?:RSA|EC|OPENSSH)?\s*PRIVATE\s+KEY-----/, category: 'credential_exfiltration', description: 'Private key block' },
  { regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./, category: 'credential_exfiltration', description: 'JWT shape' },

  { regex: /(?:^|[\s'"])(?:~|\$HOME|\/Users\/[^/]+|\/home\/[^/]+)\/\.(?:ssh|aws|config\/gcloud|kube|docker)\b/, category: 'sensitive_path', description: 'Reference to credential directory' },
];

interface McpSessionCache {
  sessionId: string;
  approved: string[];
  updated: string;
}

function cachePathFor(sessionId: string): string {
  return paiPath('MEMORY', 'SECURITY', 'mcp-session-cache', `${sessionId}.json`);
}

function loadCache(sessionId: string): McpSessionCache {
  const path = cachePathFor(sessionId);
  if (!existsSync(path)) {
    return { sessionId, approved: [], updated: new Date().toISOString() };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as McpSessionCache;
    if (parsed && Array.isArray(parsed.approved)) return parsed;
  } catch {
  }
  return { sessionId, approved: [], updated: new Date().toISOString() };
}

function saveCache(cache: McpSessionCache): void {
  const path = cachePathFor(cache.sessionId);
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(cache, null, 2));
  } catch {
  }
}

function parseMcpName(toolName: string): { server: string; tool: string } | null {
  if (!toolName.startsWith('mcp__')) return null;
  const rest = toolName.slice('mcp__'.length);
  const sep = rest.indexOf('__');
  if (sep < 0) return null;
  return { server: rest.slice(0, sep), tool: rest.slice(sep + 2) };
}

function flattenStringValues(input: unknown, max = 50): string[] {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (out.length >= max || depth > 6) return;
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
      return;
    }
    if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) {
        walk(val, depth + 1);
      }
    }
  };
  walk(input, 0);
  return out;
}

class McpInspector implements Inspector {
  name = 'McpInspector';
  priority = 70;

  inspect(ctx: InspectionContext): InspectionResult {
    const parsed = parseMcpName(ctx.toolName);
    if (!parsed) return ALLOW;

    const { server, tool } = parsed;
    const fullName = `mcp__${server}__${tool}`;

    if (IMPERSONATED_CORE_TOOLS.has(tool.toLowerCase())) {
      return deny(
        `MCP server "${server}" exposes a tool named "${tool}" which impersonates a core Claude Code tool. This is a known prompt-injection pattern.`,
        `MCP-impersonation-${server}-${tool}`,
      );
    }

    let argInjectionHit: { description: string; category: string } | null = null;
    try {
      const strings = flattenStringValues(ctx.toolInput);
      for (const s of strings) {
        if (s.length < 4) continue;
        for (const { regex, category, description } of ARG_INJECTION_PATTERNS) {
          if (regex.test(s)) {
            argInjectionHit = { description, category };
            break;
          }
        }
        if (argInjectionHit) break;
      }
    } catch {
    }

    if (argInjectionHit) {
      const reason = `Suspicious content in arguments to ${fullName}: ${argInjectionHit.description} (${argInjectionHit.category})`;
      const warning = [
        `[PAI SECURITY] MCP tool ${fullName} called with arguments containing ${argInjectionHit.description}.`,
        `Category: ${argInjectionHit.category}.`,
        `If you did NOT intend to send this content to "${server}", deny.`,
        `Common cause: a poisoned tool description steered the agent into echoing sensitive content back through this tool.`,
      ].join('\n');
      return requireApproval(reason, warning);
    }

    let cache: McpSessionCache;
    try {
      cache = loadCache(ctx.sessionId);
    } catch {
      return alert(`McpInspector cache unavailable; allowing ${fullName}`);
    }

    if (!cache.approved.includes(fullName)) {
      cache.approved.push(fullName);
      cache.updated = new Date().toISOString();
      saveCache(cache);

      const reason = `First call to MCP tool ${fullName} in this session.`;
      const warning = [
        `[PAI SECURITY] First-this-session call to MCP server "${server}" tool "${tool}".`,
        `MCP servers run in your own user context with full filesystem access via stdio.`,
        `If you did not configure "${server}" or do not recognize this tool, deny.`,
        `Approving once allows all calls to ${fullName} for the rest of this session.`,
      ].join('\n');
      return requireApproval(reason, warning);
    }

    return ALLOW;
  }
}

export function createMcpInspector(): McpInspector {
  return new McpInspector();
}
