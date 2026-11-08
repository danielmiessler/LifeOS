/**
 * CitationCheck — checks a `path:line` — `snippet` citation by content, never by date (public issue #2221).
 *
 * A doc that says "see `hooks/Foo.hook.ts:128` — `if (!session)`" makes a claim about code. The snippet is what makes the
 * claim checkable: with a line number alone, nothing tells "the code moved" from "the code is gone", and a file's mtime
 * changes whenever anything in it is touched. The states:
 *   ok        — line N contains the snippet.
 *   moved     — it does not, but the snippet is on exactly one other line: the claim holds, only the number is old.
 *   ambiguous — the snippet is on several other lines: the citation cannot be re-pointed.        → rotten
 *   changed   — the snippet is nowhere in the file.                                            → rotten
 *   gone      — the cited path does not exist.                                                  → rotten
 *   dir       — the cited path is a directory, which has no lines.                              → rotten
 *   outside   — the cited path resolves (symlinks followed) outside the checked tree.           → rotten
 *
 * It checks that the citation still points at the same code, not that the sentence next to it is true.
 * The snippet convention is optional: a `path:line` pointer with no snippet is not checked here, only counted.
 */

import { readFileSync, realpathSync, statSync } from 'fs';
import { isAbsolute, join, relative, sep } from 'path';

export type CitationState = 'ok' | 'moved' | 'ambiguous' | 'changed' | 'gone' | 'dir' | 'outside';
export interface CitationResult { state: CitationState; foundAt?: number[] }
export const isRotten = (s: CitationState): boolean => s !== 'ok' && s !== 'moved';

/** `path:line` — `snippet`, with the snippet in single backticks, or in double ones when it holds a backtick. */
export const CITATION_RE = /`([^`\s]+?):(\d+)`\s*[—–-]\s*(?:``\s?(.+?)\s?``|`([^`]+)`)/g;
/** A `path:line` pointer with no snippet after it. The path has a dot or a slash, so `step:2` is not one. */
export const POINTER_RE = /`([^`\s]*[./][^`\s]*?):(\d+)`(?!\s*[—–-]\s*`)/g;

/**
 * The state of one citation. `path` is relative to `root`, absolute, or starts with `~/.claude/` (read as `root`).
 * It resolves through `realpathSync` and must stay inside `root`. An unreadable root or file throws: a citation that
 * could not be read is never reported as fine.
 */
export function checkCitation(root: string, path: string, line: number, snippet: string): CitationResult {
  const rootReal = realpathSync(root);
  const rel = path.startsWith('~/.claude/') ? path.slice('~/.claude/'.length) : path;
  let real: string;
  try {
    real = realpathSync(isAbsolute(rel) ? rel : join(rootReal, rel));
  } catch (e: any) {
    if (e?.code === 'ENOENT' || e?.code === 'ENOTDIR') return { state: 'gone' };
    throw e;
  }
  const inside = relative(rootReal, real);
  if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) return { state: 'outside' };
  if (statSync(real).isDirectory()) return { state: 'dir' };
  const lines = readFileSync(real, 'utf-8').split('\n');
  if (lines[line - 1]?.includes(snippet)) return { state: 'ok' };
  const foundAt = lines.flatMap((l, i) => (l.includes(snippet) ? [i + 1] : []));
  if (foundAt.length > 1) return { state: 'ambiguous', foundAt };
  return foundAt.length === 1 ? { state: 'moved', foundAt } : { state: 'changed' };
}

export interface Citation { line: number; path: string; citedLine: number; snippet: string }

/** The citations in a markdown text, and how many `path:line` pointers in it have no snippet. Fenced blocks are examples
 * and are skipped, as the rest of ReferenceCheck skips them. */
export function findCitations(text: string): { citations: Citation[]; withoutSnippet: number } {
  const citations: Citation[] = [];
  let withoutSnippet = 0, fenced = false;
  text.split('\n').forEach((lineText, i) => {
    if (lineText.trimStart().startsWith('```')) { fenced = !fenced; return; }
    if (fenced) return;
    for (const m of lineText.matchAll(CITATION_RE)) {
      citations.push({ line: i + 1, path: m[1], citedLine: Number(m[2]), snippet: (m[3] ?? m[4]) });
    }
    withoutSnippet += [...lineText.matchAll(POINTER_RE)].length;
  });
  return { citations, withoutSnippet };
}
