import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ANTI_HEADING_RE, BRIDGE_HEADING_RE, CRITERIA_HEADING_RE } from "./IsaSections";

export interface IsaClaim {
  id: string;
  checked: boolean;
  status: "completed" | "open" | "partial";
  anti: boolean;
  line: number;
  source: "checkbox" | "prose" | "table";
  /** Set only on a `[container]` criterion that has nested child criteria (returned with includeParents only). */
  container?: true;
}
export interface IsaClaimDiagnostic { code: string; line: number; message: string }
export interface IsaClaimsResult {
  claims: IsaClaim[];
  diagnostics: IsaClaimDiagnostic[];
  era: "legacy" | "current";
  revision: string;
}

// The criteria, bridge and anti heading names live in SECTION_ALIASES (./IsaSections), which generates these
// regexes; isa-utils' CRITERIA_HEADING_RE is the same one. No hook graph dependency. public issue #2527
export const CLAIMS_HEADING_RE = CRITERIA_HEADING_RE;
export { BRIDGE_HEADING_RE, ANTI_HEADING_RE };


export function isaBody(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, "");
}
export function isaRevision(text: string): string {
  return createHash("sha256").update(isaBody(text)).digest("hex");
}

// Byte-mirrors ISAGate.ts creationEraMs and its assert-era boundary.
const ASSERT_ADOPTION_MS = Date.parse("2026-08-31T00:00:00-07:00");
function creationEraMs(fm: Record<string, string>): number | null {
  const signals = [
    Date.parse(fm.started ?? ""),
    Date.parse(fm.principal_stated_goal_locked ?? ""),
    Date.parse((fm.slug ?? "").match(/^(\d{4})(\d{2})(\d{2})/)?.slice(1).join("-") ?? ""),
  ].filter((t) => !Number.isNaN(t));
  return signals.length ? Math.min(...signals) : null;
}

const ID = /^(ISC-[\w-]+(?:\.[\w-]+)*|[A-Z]{1,6}-[A-Z0-9][\w-]*(?:\.[\w-]+)*|[A-Z]{1,4}\d+[a-z]?(?:\.\d+)*)(?=$|\s|[:.—–])/;
// Bullet marker: `-`/`*`/`+`, or a numbered-list marker (`1.` / `1)`) — a real
// H9-shape ISA declares its criteria as a bare numbered list with no checkbox at
// all, and asterisk-bulleted checkboxes (`* [ ]`) are an equally real shape
// (absence-review finding, 2026-09-10: H9 must be a general invariant over any
// criteria-bearing line, not a fit to the four original fixture shapes).
const BULLET_MARKER = "(?:[-*+]|\\d+[.)])";
const CHECKBOX = new RegExp(`^(\\s*)${BULLET_MARKER}\\s+\\[([ xX~-]|DEFERRED-VERIFY)\\]\\s*`);
const BULLET = new RegExp(`^\\s*${BULLET_MARKER}\\s+(.*)$`);
const CLAIM_LIKE = /\b(?:ISC-\d+|[A-Z]{1,4}\d+)\b/;

// Shared with every consumer that needs the raw criterion TEXT (description/body),
// not just the recognized criterion — strips the bullet/checkbox prefix a
// consumer's own line-stripping regex would otherwise have to reimplement
// (three copies drifted out of sync with BULLET_MARKER above and crashed on
// numbered-list lines until this export existed, 2026-09-10).
export function stripBulletPrefix(line: string): string {
  return line.replace(new RegExp(`^\\s*${BULLET_MARKER}\\s+(?:\\[[^\\]]*\\]\\s*)?`), "");
}

export interface IsaClaimText { id: string; body: string; anti: boolean }
// Shared recognition; descriptions/status decorations remain consumer concerns.
export function claimText(value: string): IsaClaimText | null {
  let text = value.trim();
  const anti = /^(?:\*\*)?(?:Anti-(?:claim|criterion)\s+|Anti:\s*)/i.test(text);
  text = text.replace(/^\*\*/, "").replace(/^(?:Anti-(?:claim|criterion)\s+|Anti:\s*)/i, "").replace(/^`([^`]+)`/, "$1");
  // Bold-wrapped IDs (`**ISC-12.** text`, `**C3:** text`): drop the closing bold after the ID.
  text = text.replace(/^([A-Za-z]+-?\d+[a-z]?(?:\.\d+)*)([.:]?)\*\*(?=\s)/, (_m, id: string, sep: string) => id + sep);
  // Preserve Test Strategy's legacy alphabetic IDs when explicitly separated.
  const match = text.match(ID) ?? text.match(/^([A-Za-z][A-Za-z0-9.-]*)(?=\s*(?:`[^`]*`\s*|\([^)]*\)\s*)?(?::|—))/);
  if (!match) return null;
  const id = match[1]!;
  const rest = text.slice(match[0].length);
  // Bare ID + whitespace prose is intentional; bare bullets are always unchecked.
  if (rest && !/^(?:\s|[:—–]|\.\s)/.test(rest)) return null;
  const body = rest.replace(/^\s*(?:(?:`[^`]*`|(?:\*\*)?\([^)]*\)(?:\*\*))\s*)?(?::|[—–]|\.\s)\s*/, "").trim();
  return { id, body, anti: anti || /^A\d/.test(id) || /^Anti:/i.test(body) || /^\s*\(anti\)\s*:/i.test(rest) };
}

// A split keeps its parent as `ISC-2: [container] <text>` with nested children
// ISC-2.1, ISC-2.2 (ISAFormat § The ID-stability rule). The container is
// verified through its children, so it is not a criterion of its own.
export const CONTAINER_RE = /^\[container\]/i;

/**
 * Whether the list item at `lines[at]` has a nested child criterion: a deeper
 * bullet that parses as a criterion before the next line at or above its
 * indent. Indented continuation prose is skipped; a fence ends the search.
 */
export function hasNestedCriterion(lines: readonly string[], at: number): boolean {
  const indent = /^\s*/.exec(lines[at] ?? "")![0].length;
  for (let j = at + 1; j < lines.length; j++) {
    const l = lines[j]!;
    if (!l.trim()) continue;
    if (/^\s*/.exec(l)![0].length <= indent || /^\s*(`{3,}|~{3,})/.test(l)) return false;
    const box = l.match(CHECKBOX);
    const bullet = l.match(BULLET);
    if (bullet && claimText(box ? l.slice(box[0].length) : bullet[1]!)) return true;
  }
  return false;
}

export function parseIsaClaims(isaPath: string): IsaClaimsResult {
  return parseIsaClaimsText(readFileSync(isaPath, "utf8"), { path: isaPath });
}
export function parseIsaClaimsText(text: string, opts?: { path?: string; includeParents?: boolean }): IsaClaimsResult {
  const fm: Record<string, string> = {};
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  for (const line of (front?.[1] ?? "").split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w]*):\s*(.*)$/);
    if (kv) fm[kv[1]!] = kv[2]!.trim();
  }
  const time = creationEraMs(fm);
  const claims: IsaClaim[] = [];
  const diagnostics: IsaClaimDiagnostic[] = [];
  const seen = new Map<string, number>();
  const lines = isaBody(text).split(/\r?\n/);
  let active = false;
  let antiSection = false;
  let fence: { char: string; size: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const fenceMatch = raw.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fenceMatch && fenceMatch[1]![0] === fence.char && fenceMatch[1]!.length >= fence.size && !fenceMatch[2]!.trim()) fence = null;
      continue;
    }
    if (fenceMatch) { fence = { char: fenceMatch[1]![0]!, size: fenceMatch[1]!.length }; continue; }
    if (CLAIMS_HEADING_RE.test(raw) || BRIDGE_HEADING_RE.test(raw) || ANTI_HEADING_RE.test(raw)) {
      active = true; antiSection = ANTI_HEADING_RE.test(raw); continue;
    }
    if (/^#{1,2}\s|^---\s*$/.test(raw)) { active = false; continue; }
    if (!active) continue;
    const checkbox = raw.match(CHECKBOX);
    const bullet = raw.match(BULLET);
    const table = /^\s*\|/.test(raw);
    if (!bullet && !table) continue;
    // Frontier retains parent nodes because dependency edges can reference them.
    if (checkbox && !opts?.includeParents) {
      let next = i + 1;
      while (next < lines.length && !lines[next]!.trim()) next++;
      const child = lines[next]?.match(CHECKBOX);
      if (child && child[1]!.length > checkbox[1]!.length) continue;
    }
    const cells = table ? raw.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim()) : [];
    const parsed = table ? cells.map(claimText).find(Boolean) : claimText(checkbox ? raw.slice(checkbox[0].length) : bullet![1]!);
    if (!parsed) {
      if (CLAIM_LIKE.test(raw)) diagnostics.push({ code: "unparsed-claim-like-line", line: i + 1, message: `Criterion-like line ${i + 1} could not be parsed${opts?.path ? ` in ${opts.path}` : ""}.` });
      continue;
    }
    // A [container] with children is verified through them: never a criterion of its own.
    const container = !table && CONTAINER_RE.test(parsed.body) && hasNestedCriterion(lines, i);
    if (container && !opts?.includeParents) continue;
    // Only an explicit checkbox x or a whole status cell closes a criterion.
    const status = table
      ? (cells.some(c => /^(?:\[x\]|passed|closed|complete|done|✅)$/i.test(c)) ? "completed" : "open")
      : checkbox?.[2] === "~" ? "partial" : checkbox?.[2]?.toLowerCase() === "x" ? "completed" : "open";
    const checked = status === "completed";
    claims.push({ id: parsed.id, checked, status, anti: antiSection || parsed.anti, line: i + 1, source: table ? "table" : checkbox ? "checkbox" : "prose", ...(container ? { container: true as const } : {}) });
    const previous = seen.get(parsed.id);
    if (previous !== undefined) diagnostics.push({ code: "duplicate-claim-id", line: i + 1, message: `Duplicate criterion id ${parsed.id} at lines ${previous} and ${i + 1}.` });
    else seen.set(parsed.id, i + 1);
  }
  return { claims, diagnostics, era: time !== null && time >= ASSERT_ADOPTION_MS ? "current" : "legacy", revision: isaRevision(text) };
}
