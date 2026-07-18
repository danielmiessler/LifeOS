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
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { isContained, isPatternAllowlisted, relativeToClaudeRoot } from "./containment-zones";
import { getClaudeDir } from "./paths";

const HOME = process.env.HOME ?? homedir();
const CLAUDE_ROOT = join(getClaudeDir());
const DEFAULT_DENY_LIST_PATH = join(CLAUDE_ROOT, "skills/_LIFEOS/DENY_LIST.txt");
const DEFAULT_HASHES_PATH = join(CLAUDE_ROOT, "skills/_LIFEOS/DENY_HASHES.json");
const DEFAULT_ENV_PATH = join(CLAUDE_ROOT, ".env");

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
 * Salted-hash filter — the PRIVACY-PRESERVING half of the guard (added 2026-07-07).
 * DeriveDenyHashes.ts turns the principal's private corpus into salted hashes of its
 * distinctive tokens; here we reproduce the same hashing at scan time. The filter
 * never contains the principal's data in the clear, and the salt lives in .env
 * (never ships), so a leaked hash file is opaque. Catches NOVEL private tokens (a
 * new device/contact/place) with no hand-maintenance, unlike the literal deny-list.
 */
export interface HashContext { hashes: Set<string>; salt: string; ngramSizes: number[]; minLen: number; hexLen: number }

export function loadHashContext(
  hashesPath = DEFAULT_HASHES_PATH,
  envPath = DEFAULT_ENV_PATH,
): HashContext | null {
  if (!existsSync(hashesPath) || !existsSync(envPath)) return null;
  try {
    const m = /^DENYLIST_SALT=(.+)$/m.exec(readFileSync(envPath, "utf-8"));
    if (!m) return null;
    const salt = m[1].trim().replace(/^["']|["']$/g, "");
    const data = JSON.parse(readFileSync(hashesPath, "utf-8"));
    if (!Array.isArray(data.hashes) || data.hashes.length === 0) return null;
    const hashes: Set<string> = new Set(data.hashes);
    return { hashes, salt, ngramSizes: data.ngramSizes ?? [1, 2], minLen: data.minLen ?? 4, hexLen: data.hashes[0].length };
  } catch {
    return null; // fail-open: a broken hash file never breaks writes
  }
}

function saltedHash(token: string, salt: string, hexLen: number): string {
  return createHash("sha256").update(`${salt}:${token}`).digest("hex").slice(0, hexLen);
}

/** Tokenize content the SAME way DeriveDenyHashes derives — 1/2-grams + emails/domains. */
export function contentTokens(content: string, minLen: number, ngramSizes: number[]): string[] {
  const lower = content.toLowerCase();
  const words = lower.match(/[a-z0-9'’-]+/g) ?? [];
  const out: string[] = [];
  if (ngramSizes.includes(1)) for (const w of words) if (w.length >= minLen) out.push(w);
  if (ngramSizes.includes(2)) for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
  for (const em of lower.matchAll(/\b([\w.+-]+)@([\w-]+(?:\.[\w-]+)+)\b/g)) { out.push(em[1]); out.push(em[2]); }
  for (const dm of lower.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g)) out.push(dm[0]);
  return out;
}

/** First content token whose salted hash is in the derived set. Match text is the
 * token from the WRITE's own content (echoing the user's input — reveals nothing new). */
export function scanForHashHit(content: string, ctx: HashContext): GuardHit | null {
  if (!content) return null;
  for (const tok of contentTokens(content, ctx.minLen, ctx.ngramSizes)) {
    if (ctx.hashes.has(saltedHash(tok, ctx.salt, ctx.hexLen))) {
      return { pattern: "derived:private-token (salted-hash)", match: tok, index: content.toLowerCase().indexOf(tok) };
    }
  }
  return null;
}

/**
 * The full decision: classify + (if SYSTEM) scan content + (if hit) block.
 * USER zone writes are never blocked even if content matches patterns.
 * Scans the literal deny-list FIRST, then the salted-hash filter (if present).
 */
export function evaluateWrite(
  absolutePath: string,
  newContent: string,
  opts: { denyListPath?: string; claudeRoot?: string; hashesPath?: string; envPath?: string } = {},
): GuardDecision {
  const { classification, relPath } = classifyTarget(absolutePath, opts.claudeRoot ?? CLAUDE_ROOT);
  if (classification !== "system") {
    return { classification, filePath: absolutePath, relPath, hits: [], block: false };
  }
  const patterns = loadPatterns(opts.denyListPath ?? DEFAULT_DENY_LIST_PATH);
  let hit = scanForFirstHit(newContent, patterns);
  if (!hit) {
    const hctx = loadHashContext(opts.hashesPath ?? DEFAULT_HASHES_PATH, opts.envPath ?? DEFAULT_ENV_PATH);
    if (hctx) hit = scanForHashHit(newContent, hctx);
  }
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
