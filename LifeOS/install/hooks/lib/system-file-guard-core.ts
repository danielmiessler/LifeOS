/**
 * system-file-guard-core.ts — pure classifier + deny-list scanner.
 *
 * Imported by:
 *   - hooks/SystemFileGuard.hook.ts (PreToolUse runtime gate)
 *   - LIFEOS/TOOLS/CheckFileBoundary.ts (on-demand CLI / CI gate)
 *   - hooks/SystemFileGuard.test.ts (unit tests)
 *
 * Pure functions; no fs writes, no process.exit, no logging side effects.
 * The hook adds the side effects on top.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isContained, isPatternAllowlisted, relativeToClaudeRoot } from "./containment-zones";
import { getClaudeDir } from "./paths";

const CLAUDE_ROOT = getClaudeDir();
const DEFAULT_DENY_LIST_PATH = join(CLAUDE_ROOT, "skills/_LIFEOS/DENY_LIST.txt");

export type GuardClassification = "system" | "user" | "out-of-tree";

export interface GuardHit {
  pattern: string;
  match: string;
  index: number;
}

export interface GuardDecision {
  classification: GuardClassification;
  filePath: string;
  relPath: string;
  /** Empty when classification != "system" or no patterns matched. */
  hits: GuardHit[];
  /** Convenience: hits.length > 0 && classification === "system". */
  block: boolean;
}

/**
 * Classify a target file path. SYSTEM files are everything under CLAUDE_ROOT
 * that does NOT live in a containment zone AND is not pattern-allowlisted.
 * USER files are anything inside a containment zone OR pattern-allowlisted.
 * Out-of-tree files (outside ~/.claude) are never blocked.
 */
export function classifyTarget(
  absolutePath: string,
  claudeRoot = CLAUDE_ROOT,
): { classification: GuardClassification; relPath: string } {
  if (!absolutePath || !absolutePath.startsWith(claudeRoot + "/") && absolutePath !== claudeRoot) {
    return { classification: "out-of-tree", relPath: absolutePath };
  }
  const rel = relativeToClaudeRoot(absolutePath, claudeRoot);
  if (isContained(absolutePath, claudeRoot)) return { classification: "user", relPath: rel };
  if (isPatternAllowlisted(rel)) return { classification: "user", relPath: rel };
  return { classification: "system", relPath: rel };
}

/**
 * Read the deny-list and compile each non-comment line into a RegExp.
 * Patterns are case-insensitive (matches ripgrep `-i` used by DenyListCheck.ts).
 * Returns the compiled list plus the raw source line for each (for hit reporting).
 */
export function loadPatterns(
  denyListPath = DEFAULT_DENY_LIST_PATH,
): Array<{ source: string; regex: RegExp }> {
  if (!existsSync(denyListPath)) return [];
  const raw = readFileSync(denyListPath, "utf-8");
  const out: Array<{ source: string; regex: RegExp }> = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      out.push({ source: line, regex: new RegExp(line, "i") });
    } catch {
      // Pattern that won't compile as JS regex (rare) — skip silently.
    }
  }
  return out;
}

/**
 * Scan content for the first match of any pattern. Returns null when clean.
 * Stops at first hit — the hook only needs to know whether to block.
 */
export function scanForFirstHit(
  content: string,
  patterns: ReadonlyArray<{ source: string; regex: RegExp }>,
): GuardHit | null {
  if (!content) return null;
  for (const { source, regex } of patterns) {
    const m = regex.exec(content);
    if (m) return { pattern: source, match: m[0], index: m.index };
  }
  return null;
}

/**
 * The full decision: classify + (if SYSTEM) scan content + (if hit) block.
 * USER zone writes are never blocked even if content matches patterns.
 */
export function evaluateWrite(
  absolutePath: string,
  newContent: string,
  opts: { denyListPath?: string; claudeRoot?: string } = {},
): GuardDecision {
  const { classification, relPath } = classifyTarget(absolutePath, opts.claudeRoot ?? CLAUDE_ROOT);
  if (classification !== "system") {
    return { classification, filePath: absolutePath, relPath, hits: [], block: false };
  }
  const patterns = loadPatterns(opts.denyListPath ?? DEFAULT_DENY_LIST_PATH);
  const hit = scanForFirstHit(newContent, patterns);
  if (!hit) return { classification, filePath: absolutePath, relPath, hits: [], block: false };
  return { classification, filePath: absolutePath, relPath, hits: [hit], block: true };
}

/**
 * Extract new content from a Write/Edit/MultiEdit tool_input shape.
 * Unknown shapes return empty string (the hook treats empty as nothing-to-scan).
 */
export function extractNewContent(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "";
  const ti = toolInput as {
    content?: unknown;
    new_string?: unknown;
    edits?: unknown;
  };
  if (typeof ti.content === "string") return ti.content;
  if (typeof ti.new_string === "string") return ti.new_string;
  if (Array.isArray(ti.edits)) {
    return ti.edits
      .map((e) => (e && typeof e === "object" && typeof (e as { new_string?: unknown }).new_string === "string"
        ? (e as { new_string: string }).new_string
        : ""))
      .join("\n");
  }
  return "";
}
