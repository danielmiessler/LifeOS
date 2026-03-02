// prd-utils.ts -- Shared PRD functions for hooks
//
// Used by: PRDSync.hook.ts (PostToolUse), PRDStateSync.hook.ts (Stop)
//
// Functions:
//   findLatestPRD() -- scan MEMORY/WORK/[slug]/PRD.md by mtime
//   parseFrontmatter() -- extract YAML frontmatter to object
//   writeFrontmatterField() -- update single field in existing frontmatter
//   countCriteria() -- count checked/unchecked in Criteria section
//   syncToWorkJson() -- upsert session into work.json from frontmatter

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { paiPath } from './paths';

export const WORK_DIR = paiPath('MEMORY', 'WORK');
export const WORK_JSON = paiPath('MEMORY', 'STATE', 'work.json');

export function findLatestPRD(): string | null {
  if (!existsSync(WORK_DIR)) return null;
  let latest: string | null = null;
  let latestMtime = 0;
  for (const dir of readdirSync(WORK_DIR)) {
    const prd = join(WORK_DIR, dir, 'PRD.md');
    try {
      const s = statSync(prd);
      if (s.mtimeMs > latestMtime) { latestMtime = s.mtimeMs; latest = prd; }
    } catch {}
  }
  return latest;
}

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

export function countCriteria(content: string): { checked: number; total: number } {
  const criteriaMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (!criteriaMatch) return { checked: 0, total: 0 };
  const lines = criteriaMatch[1].split('\n').filter(l => l.match(/^- \[[ x]\]/));
  const checked = lines.filter(l => l.startsWith('- [x]')).length;
  return { checked, total: lines.length };
}

export interface CriterionEntry {
  id: string;
  description: string;
  type: 'criterion' | 'anti-criterion';
  status: 'pending' | 'completed';
}

export function parseCriteriaList(content: string): CriterionEntry[] {
  const criteriaMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (!criteriaMatch) return [];
  return criteriaMatch[1].split('\n')
    .filter(l => l.match(/^- \[[ x]\]/))
    .map(line => {
      const checked = line.startsWith('- [x]');
      const textMatch = line.match(/^- \[[ x]\]\s*(ISC-[\w-]+):\s*(.*)/);
      if (!textMatch) return null;
      const id = textMatch[1];
      const description = textMatch[2].trim();
      const isAnti = id.includes('-A-');
      return {
        id,
        description,
        type: isAnti ? 'anti-criterion' as const : 'criterion' as const,
        status: checked ? 'completed' as const : 'pending' as const,
      };
    })
    .filter((c): c is CriterionEntry => c !== null);
}

export function readRegistry(): { sessions: Record<string, any> } {
  try {
    const data = JSON.parse(readFileSync(WORK_JSON, 'utf-8'));
    return data.sessions ? data : { sessions: {} };
  } catch { return { sessions: {} }; }
}

export function writeRegistry(reg: { sessions: Record<string, any> }): void {
  mkdirSync(join(paiPath('MEMORY'), 'STATE'), { recursive: true });
  const tmp = WORK_JSON + '.tmp';
  writeFileSync(tmp, JSON.stringify(reg, null, 2));
  renameSync(tmp, WORK_JSON);
}

export function syncToWorkJson(fm: Record<string, string>, prdPath: string, content?: string, sessionId?: string): void {
  if (!fm.slug) return;
  const paiDir = paiPath();
  const relativePrd = prdPath.replace(paiDir + '/', '');
  const registry = readRegistry();

  // Migration: if there's a 'starting' or 'native' placeholder entry for this session UUID,
  // remove it. PRDSync replaces it with the full PRD-based entry keyed by fm.slug.
  // This prevents duplicates when Algorithm sessions initially get a lightweight entry
  // from SessionAutoName, then get a full entry from PRDSync.
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
      const namesPath = paiPath('MEMORY', 'STATE', 'session-names.json');
      if (existsSync(namesPath)) {
        const names = JSON.parse(readFileSync(namesPath, 'utf-8'));
        if (names[sessionId]) sessionName = names[sessionId];
      }
    } catch {}
  }

  // Build phaseHistory: append entry when phase changes
  const phaseHistory: any[] = existing.phaseHistory || [];
  const lastPhase = phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : null;
  if (!lastPhase || lastPhase.phase !== newPhase.toUpperCase()) {
    // Close previous phase
    if (lastPhase && !lastPhase.completedAt) {
      lastPhase.completedAt = Date.now();
    }
    phaseHistory.push({
      phase: newPhase.toUpperCase(),
      startedAt: Date.now(),
      criteriaCount: 0,
      agentCount: 0,
    });
  }

  // Parse criteria from PRD content if available
  const criteria = content ? parseCriteriaList(content) : (existing.criteria || []);

  // Update criteriaCount on current phase entry
  if (phaseHistory.length > 0) {
    phaseHistory[phaseHistory.length - 1].criteriaCount = criteria.length;
  }

  registry.sessions[fm.slug] = {
    prd: relativePrd,
    task: fm.task || '',
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
    ...(fm.iteration ? { iteration: parseInt(fm.iteration) || 1 } : {}),
  };

  // Clean stale sessions:
  // - Completed sessions older than 24h
  // - Any non-complete session older than 7 days (prevents unbounded growth)
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
    const updated = new Date(session.updatedAt || session.started || 0).getTime();
    if (session.phase === 'complete' && now - updated > 86400000) {
      delete registry.sessions[slug];
    } else if (now - updated > SEVEN_DAYS) {
      delete registry.sessions[slug];
    }
  }

  writeRegistry(registry);
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
 * Called by SessionAutoName on first prompt for ALL sessions.
 *
 * For native mode: phase='native', stays as-is (updated by subsequent prompts).
 * For algorithm mode: phase='starting', replaced by PRDSync when PRD.md is written.
 *
 * On subsequent prompts, only updates `updatedAt` to keep the session "alive".
 */
export function upsertSession(sessionUUID: string, sessionName: string, task: string, mode: 'native' | 'starting' = 'native'): void {
  try {
    const registry = readRegistry();
    const timestamp = new Date().toISOString();

    // Check if this session already has an entry (by UUID match, native or starting)
    let existingSlug: string | null = null;
    for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
      if (session.sessionUUID === sessionUUID && (session.mode === 'native' || session.mode === 'starting')) {
        existingSlug = slug;
        break;
      }
    }

    if (existingSlug) {
      // Session exists — just bump updatedAt
      registry.sessions[existingSlug].updatedAt = timestamp;
      if (sessionName) registry.sessions[existingSlug].sessionName = sessionName;
    } else {
      // New session — create lightweight entry
      // Generate slug from timestamp + sanitized task
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
      };
    }

    writeRegistry(registry);
  } catch {}
}

/** @deprecated Use upsertSession instead */
export const upsertNativeSession = upsertSession;

