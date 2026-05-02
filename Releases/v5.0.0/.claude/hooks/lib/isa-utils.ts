// isa-utils.ts -- Shared ISA functions for hooks
//
// Used by: ISASync.hook.ts (PostToolUse), and any other hook that reads or
// writes the per-session Ideal State Artifact.
//
// Functions:
//   findArtifactPath(slug)   -- prefer ISA.md, fall back to legacy PRD.md
//   findLatestISA()          -- scan MEMORY/WORK/[slug]/ISA.md (or legacy PRD.md) by mtime
//   parseFrontmatter()       -- extract YAML frontmatter to object
//   writeFrontmatterField()  -- update single field in existing frontmatter
//   countCriteria()          -- count checked/unchecked in Criteria section
//   syncToWorkJson()         -- upsert session into work.json from frontmatter
//
// Naming history: pre-v4.1.0 the artifact was called PRD ("Product Requirements
// Document") and lived at MEMORY/WORK/{slug}/PRD.md. From v4.1.0 onward the
// canonical name is ISA ("Ideal State Artifact") and the file is ISA.md. This
// module reads ISA.md first and falls back to PRD.md for sessions created
// before the rename. New sessions always write ISA.md.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { getObservabilityDir, getPaiDir, getStateDir, getWorkDir } from './paths';

export const WORK_DIR = getWorkDir();
export const WORK_JSON = join(getStateDir(), 'work.json');

// Canonical artifact filename (v4.1.0+) and the legacy fallback we still read.
export const ARTIFACT_FILENAME = 'ISA.md';
export const LEGACY_ARTIFACT_FILENAME = 'PRD.md';

/**
 * Resolve the ideal-state artifact path for a session slug.
 *
 * Read order: ISA.md (canonical) → PRD.md (legacy). Returns null if neither
 * exists. This is the SINGLE place the read fallback lives — every hook that
 * reads the per-session artifact must route through here.
 */
export function findArtifactPath(slug: string): string | null {
  const dir = join(WORK_DIR, slug);
  const isa = join(dir, ARTIFACT_FILENAME);
  if (existsSync(isa)) return isa;
  const legacy = join(dir, LEGACY_ARTIFACT_FILENAME);
  if (existsSync(legacy)) return legacy;
  return null;
}

/**
 * Scan MEMORY/WORK/* for the most recently-modified ideal-state artifact and
 * return its absolute path. Prefers ISA.md per directory, falls back to
 * legacy PRD.md.
 */
export function findLatestISA(): string | null {
  if (!existsSync(WORK_DIR)) return null;
  let latest: string | null = null;
  let latestMtime = 0;
  for (const dir of readdirSync(WORK_DIR)) {
    const candidate = findArtifactPath(dir);
    if (!candidate) continue;
    try {
      const s = statSync(candidate);
      if (s.mtimeMs > latestMtime) { latestMtime = s.mtimeMs; latest = candidate; }
    } catch {}
  }
  return latest;
}

/** @deprecated use findLatestISA — alias kept so older imports keep compiling. */
export const findLatestPRD = findLatestISA;

export function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

export function writeFrontmatterField(content: string, field: string, value: string): string {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!fmMatch) return content;
  const lines = fmMatch[2].split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${field}:`)) {
      lines[i] = `${field}: ${value}`;
      found = true;
      break;
    }
  }
  if (!found) lines.push(`${field}: ${value}`);
  return fmMatch[1] + lines.join('\n') + fmMatch[3] + content.slice(fmMatch[0].length);
}

// ── Criteria section parsing ──────────────────────────────────────────────
//
// One canonical regex, centralized. Matches every historical heading variant:
//   ## Criteria
//   ## ISC Criteria
//   ## IDEAL STATE CRITERIA (Verification Criteria)
//     ### Criteria               (sub-heading inside IDEAL STATE block)
// Case-insensitive. Section ends at the next `## ` (H2) heading, `---`, or EOF.
//
// The regex INCLUDES `### Criteria` so ISAs using the v4.0 template layout
// (`## IDEAL STATE CRITERIA` + `### Criteria` sub-heading) parse correctly.
export const CRITERIA_HEADING_RE =
  /^(?:##\s+(?:ISC\s+)?Criteria\b[^\n]*|##\s+IDEAL\s+STATE\s+CRITERIA\b[^\n]*|###\s+Criteria\b[^\n]*)$/im;

// Canonical heading the template emits and migrations target.
// Short, unambiguous, what most live ISAs already use.
export const CANONICAL_CRITERIA_HEADING = '## ISC Criteria';

// Returns the criteria-section body (without the heading line), or null if no
// recognized heading was found. Used by both countCriteria and parseCriteriaList
// so they stay in lockstep.
export function extractCriteriaSection(content: string): string | null {
  const headingMatch = CRITERIA_HEADING_RE.exec(content);
  if (!headingMatch || headingMatch.index === undefined) return null;
  const startOfBody = headingMatch.index + headingMatch[0].length;
  const rest = content.slice(startOfBody);
  // End at the next H2 (`## ` but not `### `), a YAML doc terminator, or EOF.
  const endMatch = rest.match(/\n##\s+(?!#)|\n---\s*\n/);
  const body = endMatch ? rest.slice(0, endMatch.index) : rest;
  return body;
}

export function countCriteria(content: string): { checked: number; total: number } {
  const body = extractCriteriaSection(content);
  if (body === null) return { checked: 0, total: 0 };
  const lines = body.split('\n').filter(l => l.match(/^- \[[ x]\]/));
  const checked = lines.filter(l => l.startsWith('- [x]')).length;
  return { checked, total: lines.length };
}

export interface ModeTransition {
  mode: 'minimal' | 'native' | 'algorithm';
  startedAt: number;       // epoch ms
  endedAt?: number;        // undefined = current
}

export interface RatingPulse {
  value: number;           // 1-10
  timestamp: number;       // epoch ms
  message?: string;        // the short message that triggered it (optional, max 32 chars)
}

export interface AgentEntry {
  name: string;
  agentType: string;
  status: 'active' | 'idle' | 'completed';
  task?: string;
  phase: string;  // Which phase the agent was spawned in
}

export interface SessionEntry {
  isa?: string;
  /** @deprecated use `isa` — kept for sessions written before v4.1.0 */
  prd?: string;
  task: string;
  sessionName?: string;
  sessionUUID?: string;
  phase: string;
  progress: string;
  effort: string;
  mode: string;
  started: string;
  updatedAt: string;
  criteria?: CriterionEntry[];
  phaseHistory?: any[];
  iteration?: number;
  // Mode transition tracking
  currentMode?: 'minimal' | 'native' | 'algorithm';
  modeHistory?: ModeTransition[];
  // MINIMAL session tracking
  ratings?: RatingPulse[];
  minimalCount?: number;
  // Enriched pipeline data
  capabilities?: string[];      // Skills/capabilities selected for this session
  agents?: AgentEntry[];        // Agents active in this session
}

export interface CriterionEntry {
  id: string;
  description: string;
  type: 'criterion' | 'anti-criterion';
  status: 'pending' | 'completed';
  createdInPhase?: string;  // Phase when first added to ISA
  /**
   * Legacy category code from pre-v5.3.0 ISAs ([F]/[S]/[B]/[N]/[E]/[A]).
   * Algorithm v5.3.0 dropped bracketed category tags from the on-disk format;
   * new ISAs leave this `undefined`. Retained for backward-compat parsing of
   * historical ISAs in MEMORY/WORK/.
   */
  category?: string;
}

// ── Category tokens (legacy, pre-v5.3.0) ──────────────────────────────────
// Algorithm v5.3.0 dropped category tags from the surface format. This set is
// retained ONLY to recognize legacy bracketed letters in pre-v5.3.0 ISAs so the
// parser remains backward-compatible. New ISAs do not emit brackets — the
// criterion phrasing carries the meaning, and the two doctrinal gates
// (anti-criteria, antecedent) are now expressed as prose prefixes.
// Anything else in brackets (e.g. `[COMPLETE]`, `[DONE]`, `[WIP]`) is a status
// tag from prose, not a category — we strip it rather than capture it.
const VALID_CATEGORIES = new Set(['F', 'S', 'B', 'N', 'E', 'A']);

export function parseCriteriaList(content: string): CriterionEntry[] {
  const body = extractCriteriaSection(content);
  if (body === null) return [];
  return body.split('\n')
    .filter(l => l.match(/^- \[[ x]\]/))
    .map((line): CriterionEntry | null => {
      const checked = line.startsWith('- [x]');

      // Primary parse (Algorithm v5.3.0+): `- [x] ISC-1: description` — bare ISC ID, `:` required.
      // Backward-compat: also accepts pre-v5.3.0 bracketed format `- [x] ISC-1 [F]: description`
      // and legacy nested `- [x] ISC-1 [F][grep]: description`.
      let textMatch = line.match(/^- \[[ x]\]\s*(ISC-[\w-]+)(?:\s+\[([A-Za-z]+)\](?:\[\w+\])?)?:\s*(.*)/);

      // Fallback: no trailing `:` — e.g. `- [x] ISC-1 description` or
      // `- [x] ISC-1 [COMPLETE] description` (status word in brackets, no colon).
      // Accept the line but strip any non-category bracket tokens from the text.
      if (!textMatch) {
        const loose = line.match(/^- \[[ x]\]\s*(ISC-[\w-]+)\s+(.*)/);
        if (loose) {
          const rest = loose[2].replace(/\[[A-Za-z]+\]\s*/g, '').trim();
          if (rest.length > 0) {
            textMatch = [line, loose[1], undefined as unknown as string, rest] as RegExpMatchArray;
          }
        }
      }
      if (!textMatch) return null;

      const id = textMatch[1];
      const rawCategory = textMatch[2];
      // Only accept real category codes; drop captured status words like COMPLETE/DONE/WIP.
      const category = rawCategory && VALID_CATEGORIES.has(rawCategory.toUpperCase())
        ? rawCategory.toUpperCase()
        : undefined;
      const description = textMatch[3].trim();
      // Algorithm v5.5.0+: anti-criteria detected by `Anti:` prose prefix on the description.
      // Backward-compat: legacy ISAs (v5.3.0–v5.4.0) used `ISC-A-N` numbering; the `id.includes('-A-')`
      // fallback keeps those classified correctly. Domain-prefixed IDs like `ISC-CLI-3` are unaffected.
      const isAnti = /^Anti:\s/i.test(description) || id.includes('-A-');
      return {
        id,
        description,
        type: isAnti ? 'anti-criterion' as const : 'criterion' as const,
        status: checked ? 'completed' as const : 'pending' as const,
        category,
      };
    })
    .filter((c): c is CriterionEntry => c !== null);
}

// ── Intent/context extraction (empty-state UI fallback) ──────────────────
// When an ISA has no parseable ISCs, the dashboard still needs something
// meaningful to show on the card. In priority order:
//   1. `## Intent` section body (1–2 sentences)
//   2. `## Context` section body
//   3. H1 title line (after frontmatter)
// Returns trimmed text capped at ~280 chars.
export function extractIntentSnippet(content: string): string {
  const after = content.replace(/^---[\s\S]*?\n---\n/, '');

  // Try H2 sections in priority order.
  for (const heading of ['Intent', 'Context', 'Problem Space', 'Overview']) {
    const re = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
    const m = re.exec(after);
    if (m && m.index !== undefined) {
      const rest = after.slice(m.index + m[0].length);
      const end = rest.match(/\n##\s+|\n---\s*\n/);
      const body = (end ? rest.slice(0, end.index) : rest)
        .replace(/^\s*\*[^*]*\*\s*$/gm, '')   // drop placeholder italics like `*OBSERVE.*`
        .replace(/\n{2,}/g, '\n')
        .trim();
      if (body.length > 0) {
        return body.length > 280 ? body.slice(0, 277).trimEnd() + '…' : body;
      }
    }
  }

  // Fallback: first non-empty line after H1 that isn't a heading or blockquote.
  const lines = after.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('>')) continue;
    return line.length > 280 ? line.slice(0, 277) + '…' : line;
  }
  return '';
}

// ── Loud-fail signal for non-parseable ISAs ───────────────────────────────
// Emits one of:
//   'missing-section'   — no recognized Criteria heading at all
//   'empty-section'     — heading present, zero `- [ ]` checkbox lines
//   'all-dropped'       — checkbox lines present, ALL failed to parse (regex miss)
//   null                — healthy
// ISASync uses this to stamp `criteriaParseWarning` on the session so the
// dashboard can surface the condition visually instead of going silent.
export type CriteriaParseWarning =
  | 'missing-section'
  | 'empty-section'
  | 'all-dropped'
  | null;

export function diagnoseCriteria(content: string): CriteriaParseWarning {
  const body = extractCriteriaSection(content);
  if (body === null) return 'missing-section';
  const checkboxLines = body.split('\n').filter(l => l.match(/^- \[[ x]\]/));
  if (checkboxLines.length === 0) return 'empty-section';
  const parsed = parseCriteriaList(content);
  if (parsed.length === 0) return 'all-dropped';
  return null;
}

/**
 * Parse capabilities from ISA content.
 * The Algorithm writes a section like:
 *   🏹 CAPABILITIES SELECTED:
 *    🏹 [capability name] ...
 * Also handles inline " 🏹 CapName | reason" format.
 * Returns capability names only (stripped of reasoning text).
 */
export function parseCapabilities(content: string): string[] {
  const capabilities: string[] = [];
  const lines = content.split('\n');
  let inCapabilitiesBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of capabilities block
    if (trimmed.match(/🏹\s*CAPABILIT(?:IES|Y)\s*SELECTED/i)) {
      inCapabilitiesBlock = true;
      continue;
    }

    // Inside capabilities block, parse individual capability lines
    if (inCapabilitiesBlock) {
      // Blank line or new section header ends the block
      if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.startsWith('##'))) {
        // Allow blank lines within the block, but a section header ends it
        if (trimmed.startsWith('#')) {
          inCapabilitiesBlock = false;
        }
        continue;
      }
      // Another non-capability header also ends the block
      if (!trimmed.includes('🏹') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
        inCapabilitiesBlock = false;
        continue;
      }

      // Parse " 🏹 CapName | reason" or " 🏹 CapName — reason" or just " 🏹 CapName"
      const capMatch = trimmed.match(/🏹\s+(.+)/);
      if (capMatch) {
        let capText = capMatch[1].trim();
        // Strip reasoning after | or — or :
        capText = capText.split(/\s*[|—:]\s*/)[0].trim();
        // Skip if it's the header line text (already consumed above)
        if (!capText.match(/^CAPABILITIES?\s*SELECTED/i) && capText.length > 0) {
          // Clean up: remove leading/trailing punctuation, brackets
          capText = capText.replace(/^\[|\]$/g, '').trim();
          // Skip overly long entries (description lines, not capability names)
          // Real capability names are typically 1-4 words, under 40 chars
          const wordCount = capText.split(/\s+/).length;
          if (capText.length > 0 && capText.length < 50 && wordCount <= 6) {
            capabilities.push(capText);
          }
        }
      }
    }
  }

  return capabilities;
}

/**
 * Read subagent events for a given session UUID.
 * Uses tail approach: only reads last 200 lines to stay fast (<50ms).
 * Returns unique agents with name, type, status, task, phase.
 */
export function getSessionAgents(sessionUUID: string): AgentEntry[] {
  try {
    const eventsPath = join(getObservabilityDir(), 'subagent-events.jsonl');
    if (!existsSync(eventsPath)) return [];

    // Use execSync with tail for performance — only read last 200 lines
    const { execSync } = require('child_process');
    const raw: string = execSync(`tail -200 "${eventsPath}"`, {
      encoding: 'utf-8',
      timeout: 30, // 30ms hard cap
    });

    const agents: Map<string, AgentEntry> = new Map();

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.session_id !== sessionUUID) continue;

        // Build a unique key from subagent_id (or fallback to timestamp for unknown)
        const agentKey = event.subagent_id && event.subagent_id !== 'unknown'
          ? event.subagent_id
          : `agent-${event.timestamp}`;

        const name = event.subagent_id && event.subagent_id !== 'unknown'
          ? event.subagent_id
          : (event.prompt_preview ? event.prompt_preview.slice(0, 40) : 'Subagent');

        const agentType = event.subagent_type && event.subagent_type !== 'unknown'
          ? event.subagent_type
          : (event.subagent_model && event.subagent_model !== 'unknown' ? event.subagent_model : 'agent');

        // Determine status based on event type
        let status: 'active' | 'idle' | 'completed' = 'active';
        if (event.event === 'subagent_complete' || event.event === 'subagent_end') {
          status = 'completed';
        }

        // Infer phase from the timestamp relative to the session's phase history
        // For now, use the event type as a proxy
        const phase = event.phase || 'BUILD';

        agents.set(agentKey, {
          name,
          agentType,
          status,
          task: event.prompt_preview && event.prompt_preview.length > 0
            ? event.prompt_preview.slice(0, 80)
            : undefined,
          phase,
        });
      } catch {
        // Skip malformed lines
      }
    }

    return Array.from(agents.values());
  } catch {
    return [];
  }
}

export function readRegistry(): { sessions: Record<string, any> } {
  try {
    const data = JSON.parse(readFileSync(WORK_JSON, 'utf-8'));
    return data.sessions ? data : { sessions: {} };
  } catch { return { sessions: {} }; }
}

export function writeRegistry(reg: { sessions: Record<string, any> }): void {
  mkdirSync(getStateDir(), { recursive: true });
  const tmp = WORK_JSON + '.tmp';
  writeFileSync(tmp, JSON.stringify(reg, null, 2));
  renameSync(tmp, WORK_JSON);
}

// ── Phase tracking (single-source: ISA frontmatter) ───────────────────────
//
// 2026-04-27: Voice phase capture was removed. ISA frontmatter is the SOLE
// writer of phaseHistory and `session.phase`. The PhaseSource type retains
// 'voice' and 'merged' for BACKWARD READ compatibility — work.json files
// written before this change still contain those values, and parsing must
// not crash on them. New writes only emit 'isa'.

export type PhaseSource = 'voice' | 'isa' | 'merged';

export interface PhaseEntry {
  phase: string;          // uppercased (OBSERVE, THINK, PLAN, BUILD, EXECUTE, VERIFY, LEARN, COMPLETE)
  startedAt: number;      // epoch ms — set when ISASync sees the new phase
  completedAt?: number;   // epoch ms — set when next phase arrives
  criteriaCount: number;  // enriched by ISASync
  agentCount: number;     // enriched by ISASync
  source?: PhaseSource;   // new entries: 'isa'. Legacy 'voice'/'merged'/'prd' parse as historical.
}

/**
 * Append a phase transition to phaseHistory with dual-source dedup.
 *
 * - Same phase, same/legacy source → no-op (duplicate guard)
 * - Same phase, different source   → upgrade source to 'merged' (voice+ISA confirmed)
 * - Different phase                → close previous (completedAt = now), push new entry
 *
 * Mutates `phaseHistory` in place AND returns it for chaining.
 * `startedAt` is set from the first source to arrive — subsequent confirmations don't overwrite.
 *
 * Legacy 'prd' source values written by older builds are treated as 'isa' for
 * dedup purposes — same semantic meaning, just renamed.
 */
export function appendPhase(
  phaseHistory: PhaseEntry[],
  newPhase: string,
  source: PhaseSource
): PhaseEntry[] {
  const upperPhase = newPhase.toUpperCase();
  const now = Date.now();
  const last = phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : null;

  // Normalize legacy 'prd' source to 'isa' so old phase entries dedup cleanly
  // against new ISA-sourced ones.
  const normalize = (s: PhaseSource | undefined): PhaseSource =>
    (s as unknown as string) === 'prd' ? 'isa' : (s ?? 'isa');

  const incomingSource = normalize(source);

  if (last && last.phase === upperPhase) {
    // Same phase — dedup/upgrade
    const existingSource: PhaseSource = normalize(last.source);
    if (existingSource !== incomingSource && existingSource !== 'merged') {
      last.source = 'merged';
    }
    return phaseHistory;
  }

  // New phase transition — close previous
  if (last && !last.completedAt) {
    last.completedAt = now;
  }

  phaseHistory.push({
    phase: upperPhase,
    startedAt: now,
    criteriaCount: 0,
    agentCount: 0,
    source: incomingSource,
  });

  return phaseHistory;
}

export function syncToWorkJson(fm: Record<string, string>, isaPath: string, content?: string, sessionId?: string): void {
  if (!fm.slug) return;
  const paiDir = getPaiDir();
  const relativeIsa = isaPath.replace(paiDir + '/', '');
  const registry = readRegistry();

  // Migration: if there's a 'starting' or 'native' placeholder entry for this session UUID,
  // remove it. ISASync replaces it with the full ISA-based entry keyed by fm.slug.
  // This prevents duplicates when Algorithm sessions initially get a lightweight entry
  // from SessionAutoName, then get a full entry from ISASync.
  if (sessionId) {
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID === sessionId && (session.mode === 'starting' || session.mode === 'native') && slug !== fm.slug) {
        delete registry.sessions[slug];
        break;
      }
    }
  }

  const existing = registry.sessions[fm.slug] || {};
  const newPhase = fm.phase || 'observe';
  const timestamp = new Date().toISOString();

  // Look up the 4-word session name from session-names.json (authoritative source)
  let sessionName = existing.sessionName || '';
  if (sessionId) {
    try {
      const namesPath = join(getStateDir(), 'session-names.json');
      if (existsSync(namesPath)) {
        const names = JSON.parse(readFileSync(namesPath, 'utf-8'));
        if (names[sessionId]) sessionName = names[sessionId];
      }
    } catch {}
  }

  // Build phaseHistory via shared appendPhase utility (dual-source aware)
  const phaseHistory: PhaseEntry[] = existing.phaseHistory || [];
  appendPhase(phaseHistory, newPhase, 'isa');

  // Parse criteria from ISA content if available, with createdInPhase tracking
  const currentPhaseUpper = newPhase.toUpperCase();
  let criteria: CriterionEntry[];
  let criteriaParseWarning: CriteriaParseWarning = null;
  if (content) {
    const freshCriteria = parseCriteriaList(content);
    criteriaParseWarning = diagnoseCriteria(content);

    // Loud-fail: non-empty ISA with no parseable criteria is a bug signal.
    // Per feedback_loud_fail_env_token_lookup: critical lookups must emit
    // stderr on miss; never silently no-op. Same principle here.
    if (criteriaParseWarning) {
      const reason = {
        'missing-section': 'no `## ISC Criteria` / `## Criteria` / `## IDEAL STATE CRITERIA` heading found',
        'empty-section':   'criteria heading present but no `- [ ]` / `- [x]` lines inside it',
        'all-dropped':     'checkbox lines present but all failed to parse (regex miss — investigate line format)',
      }[criteriaParseWarning];
      console.error(`[ISASync] criteriaParseWarning=${criteriaParseWarning} slug=${fm.slug} isa=${relativeIsa}: ${reason}`);
    }

    const existingCriteria: CriterionEntry[] = existing.criteria || [];
    // Build lookup of existing criteria by id to preserve createdInPhase
    const existingById = new Map<string, CriterionEntry>();
    for (const c of existingCriteria) {
      existingById.set(c.id, c);
    }
    // Merge: preserve createdInPhase for known criteria, set current phase for new ones
    criteria = freshCriteria.map(c => {
      const prev = existingById.get(c.id);
      return {
        ...c,
        createdInPhase: prev?.createdInPhase || currentPhaseUpper,
        category: c.category || prev?.category,
      };
    });
  } else {
    criteria = existing.criteria || [];
    criteriaParseWarning = existing.criteriaParseWarning ?? null;
  }

  // Update criteriaCount on current phase entry
  if (phaseHistory.length > 0) {
    phaseHistory[phaseHistory.length - 1].criteriaCount = criteria.length;
  }

  // Parse capabilities from ISA content
  const capabilities: string[] = content
    ? parseCapabilities(content)
    : (existing.capabilities || []);

  // Get agents from subagent-events.jsonl for this session
  const resolvedSessionId = sessionId || existing.sessionUUID;
  const agents: AgentEntry[] = resolvedSessionId
    ? getSessionAgents(resolvedSessionId)
    : (existing.agents || []);

  // Update agentCount on current phase entry
  if (phaseHistory.length > 0) {
    phaseHistory[phaseHistory.length - 1].agentCount = agents.length;
  }

  // Track mode transitions: ISASync always means 'algorithm' mode
  const existingModeHistory: ModeTransition[] = existing.modeHistory || [];
  const existingCurrentMode: string = existing.currentMode || '';
  const newCurrentMode: 'minimal' | 'native' | 'algorithm' = 'algorithm';

  if (existingCurrentMode !== newCurrentMode) {
    // Close previous mode entry if open
    if (existingModeHistory.length > 0) {
      const last = existingModeHistory[existingModeHistory.length - 1];
      if (!last.endedAt) last.endedAt = Date.now();
    }
    // Push new mode transition
    existingModeHistory.push({ mode: newCurrentMode, startedAt: Date.now() });
  } else if (existingModeHistory.length === 0) {
    // First time — initialize with algorithm
    existingModeHistory.push({ mode: newCurrentMode, startedAt: Date.now() });
  }

  // Intent snippet — UI fallback when no criteria render on the current phase.
  const intent = content ? extractIntentSnippet(content) : (existing.intent || '');

  // Derive task from frontmatter OR the H1 title line OR the existing task.
  // Algorithm ISAs use `title:` not `task:`; keep backward compat.
  const taskValue = fm.task || fm.title || existing.task || '';

  registry.sessions[fm.slug] = {
    isa: relativeIsa,
    task: taskValue,
    sessionName: sessionName || undefined,
    sessionUUID: sessionId || existing.sessionUUID || undefined,
    phase: newPhase,
    progress: fm.progress || '0/0',
    effort: fm.effort || 'standard',
    mode: fm.mode || 'interactive',
    started: fm.started || timestamp,
    updatedAt: timestamp,
    criteria,
    phaseHistory,
    currentMode: newCurrentMode,
    modeHistory: existingModeHistory,
    ratings: existing.ratings || [],
    minimalCount: existing.minimalCount || 0,
    capabilities: capabilities.length > 0 ? capabilities : undefined,
    agents: agents.length > 0 ? agents : undefined,
    intent: intent || undefined,
    criteriaParseWarning: criteriaParseWarning || undefined,
    ...(fm.iteration ? { iteration: parseInt(fm.iteration) || 1 } : {}),
  };

  // Aggressive cleanup to prevent dashboard bloat.
  // Thresholds are read against the newer of `lastToolActivity` and `updatedAt`
  // so idle tabs (no tool calls) fall out quickly even if prompts still bump updatedAt.
  const now = Date.now();
  const THIRTY_MIN = 30 * 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
    const updatedMs = new Date(session.updatedAt || session.started || 0).getTime();
    const toolMs = session.lastToolActivity ? new Date(session.lastToolActivity).getTime() : 0;
    const lastAlive = Math.max(updatedMs, toolMs);
    const age = now - lastAlive;
    const phase = (session.phase || '').toLowerCase();

    if ((phase === 'native' || phase === 'starting') && age > THIRTY_MIN) {
      delete registry.sessions[slug];
    } else if (phase === 'complete' && age > TWO_HOURS) {
      delete registry.sessions[slug];
    } else if (age > TWO_HOURS) {
      delete registry.sessions[slug];
    }
  }

  // Cap at 50 most recent sessions to prevent unbounded growth
  const entries = Object.entries(registry.sessions) as [string, any][];
  if (entries.length > 50) {
    entries.sort((a, b) => {
      const aTime = new Date(a[1].updatedAt || a[1].started || 0).getTime();
      const bTime = new Date(b[1].updatedAt || b[1].started || 0).getTime();
      return bTime - aTime; // newest first
    });
    const toRemove = entries.slice(50);
    for (const [slug] of toRemove) {
      delete registry.sessions[slug];
    }
  }

  writeRegistry(registry);
}

/**
 * Bump `lastToolActivity` on the most recent non-complete session for a given UUID.
 * Called by ToolActivityTracker on every PostToolUse. This is the signal the
 * dashboard uses to mark a session "live" — distinct from `updatedAt` which
 * bumps on user prompts and ISA writes regardless of whether real work is
 * happening.
 *
 * Debounced: only writes if the stored `lastToolActivity` is older than 30s.
 * This cuts write volume by ~100x during tool-heavy bursts and shrinks the
 * race window with ISASync. 30s precision is fine — the running window is 5min.
 */
const BUMP_DEBOUNCE_MS = 30 * 1000;

export function bumpLastToolActivity(sessionUUID: string): boolean {
  if (!sessionUUID) return false;
  try {
    const registry = readRegistry();
    let bestSlug: string | null = null;
    let bestTime = 0;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID !== sessionUUID) continue;
      if (session.phase === 'complete') continue;
      const t = new Date(session.updatedAt || session.started || 0).getTime();
      if (t > bestTime) { bestTime = t; bestSlug = slug; }
    }
    if (!bestSlug) return false;

    const current = registry.sessions[bestSlug].lastToolActivity;
    if (current) {
      const currentMs = new Date(current).getTime();
      if (Date.now() - currentMs < BUMP_DEBOUNCE_MS) return false; // still fresh — skip write
    }
    registry.sessions[bestSlug].lastToolActivity = new Date().toISOString();
    writeRegistry(registry);
    return true;
  } catch {
    return false;
  }
}

/** Update sessionName in work.json for a given session UUID. Called by SessionAutoName on name upgrade.
 *  Only updates the most recent non-complete entry for the UUID to avoid keeping stale entries alive. */
export function updateSessionNameInWorkJson(sessionUUID: string, sessionName: string): void {
  try {
    const registry = readRegistry();
    // Find the most recent non-complete entry for this UUID
    let bestSlug: string | null = null;
    let bestTime = 0;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID !== sessionUUID) continue;
      if (session.phase === 'complete') continue;
      const t = new Date(session.updatedAt || session.started || 0).getTime();
      if (t > bestTime) { bestTime = t; bestSlug = slug; }
    }
    if (bestSlug) {
      registry.sessions[bestSlug].sessionName = sessionName;
      registry.sessions[bestSlug].updatedAt = new Date().toISOString();
      writeRegistry(registry);
    }
  } catch {}
}

/**
 * Upsert a session into work.json — handles BOTH native and algorithm modes.
 * Called by SessionAnalysis on first prompt for ALL sessions.
 *
 * For native mode: phase='native', stays as-is (updated by subsequent prompts).
 * For algorithm mode: phase='starting', replaced by ISASync when ISA.md is written.
 *
 * On subsequent prompts, only updates `updatedAt` to keep the session "alive".
 * Tracks mode transitions via currentMode and modeHistory.
 */
export function upsertSession(sessionUUID: string, sessionName: string, task: string, mode: 'native' | 'starting' = 'native', currentMode?: 'minimal' | 'native' | 'algorithm'): void {
  try {
    const registry = readRegistry();
    const timestamp = new Date().toISOString();

    // Derive currentMode from the legacy mode param if not explicitly provided
    const resolvedMode: 'minimal' | 'native' | 'algorithm' = currentMode || (mode === 'starting' ? 'algorithm' : 'native');

    // Check if this UUID already has ANY non-complete entry. ISA sessions
    // (mode='normal'/'interactive') are authoritative — if one exists, just
    // bump updatedAt on it and bail so SessionAnalysis doesn't create a
    // duplicate native row that splits tool-activity bumps.
    let existingSlug: string | null = null;
    let existingISASlug: string | null = null;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID !== sessionUUID) continue;
      if (session.phase === 'complete') continue;
      if (session.mode === 'native' || session.mode === 'starting') {
        existingSlug = slug;
      } else {
        existingISASlug = slug;
      }
    }

    if (existingISASlug && !existingSlug) {
      // Active ISA session owns this UUID — bump updatedAt and return. Do not
      // touch mode, phase, criteria, or create a duplicate native row.
      registry.sessions[existingISASlug].updatedAt = timestamp;
      writeRegistry(registry);
      return;
    }

    if (existingSlug) {
      const session = registry.sessions[existingSlug];
      // Session exists — bump updatedAt
      session.updatedAt = timestamp;
      if (sessionName) session.sessionName = sessionName;

      // Track mode transition if mode changed
      const prevMode = session.currentMode || (session.mode === 'starting' ? 'algorithm' : 'native');
      if (prevMode !== resolvedMode) {
        const modeHistory: ModeTransition[] = session.modeHistory || [];
        // Close previous mode entry
        if (modeHistory.length > 0) {
          const last = modeHistory[modeHistory.length - 1];
          if (!last.endedAt) last.endedAt = Date.now();
        }
        modeHistory.push({ mode: resolvedMode, startedAt: Date.now() });
        session.modeHistory = modeHistory;
        session.currentMode = resolvedMode;
      } else if (!session.currentMode) {
        // Initialize currentMode if missing
        session.currentMode = resolvedMode;
        if (!session.modeHistory || session.modeHistory.length === 0) {
          session.modeHistory = [{ mode: resolvedMode, startedAt: Date.now() }];
        }
      }
    } else {
      // New session — create lightweight entry
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const datePrefix = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}00`;
      const taskSlug = (task || sessionName || 'session')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
      const slug = `${datePrefix}_${taskSlug}`;

      registry.sessions[slug] = {
        task: task || sessionName || (mode === 'native' ? 'Native session' : 'Starting...'),
        sessionName: sessionName || undefined,
        sessionUUID: sessionUUID,
        phase: mode === 'native' ? 'native' : 'starting',
        progress: '0/0',
        effort: mode === 'native' ? 'native' : 'standard',
        mode: mode,
        started: timestamp,
        updatedAt: timestamp,
        currentMode: resolvedMode,
        modeHistory: [{ mode: resolvedMode, startedAt: Date.now() }],
        ratings: [],
        minimalCount: 0,
      };
    }

    writeRegistry(registry);
  } catch {}
}

/** @deprecated Use upsertSession instead */
export const upsertNativeSession = upsertSession;

/**
 * Add a RatingPulse to a session in work.json. Called by SessionAnalysis fast-path.
 * If sessionUUID matches an existing session, appends to its ratings array and increments minimalCount.
 * If no session exists, writes to a __pulse_strip array for orphan ratings.
 * Designed to stay under 10ms — simple JSON read-modify-write.
 */
export function addRatingPulse(sessionUUID: string, pulse: RatingPulse): void {
  try {
    const registry = readRegistry();

    // Find existing session by UUID
    let found = false;
    for (const [, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID === sessionUUID) {
        if (!session.ratings) session.ratings = [];
        session.ratings.push(pulse);
        session.minimalCount = (session.minimalCount || 0) + 1;
        // Set currentMode to 'minimal' if first interaction was a rating
        if (!session.currentMode) {
          session.currentMode = 'minimal';
          session.modeHistory = [{ mode: 'minimal' as const, startedAt: Date.now() }];
        }
        found = true;
        break;
      }
    }

    if (!found) {
      // Orphan rating — store in __pulse_strip
      if (!registry.sessions['__pulse_strip']) {
        registry.sessions['__pulse_strip'] = {
          task: '__pulse_strip',
          sessionName: '__pulse_strip',
          sessionUUID: '__pulse_strip',
          phase: 'minimal',
          progress: '0/0',
          effort: 'native',
          mode: 'minimal',
          started: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentMode: 'minimal' as const,
          ratings: [],
          minimalCount: 0,
        };
      }
      const strip = registry.sessions['__pulse_strip'];
      if (!strip.ratings) strip.ratings = [];
      strip.ratings.push(pulse);
      strip.minimalCount = (strip.minimalCount || 0) + 1;
      strip.updatedAt = new Date().toISOString();
      // Cap orphan ratings to prevent unbounded growth (keep last 50)
      if (strip.ratings.length > 50) strip.ratings = strip.ratings.slice(-50);
    }

    writeRegistry(registry);
  } catch {}
}
