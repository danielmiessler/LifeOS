#!/usr/bin/env bun
/**
 * PostCompact.hook.ts - Re-inject critical PAI state after context compaction
 *
 * TRIGGER: PostCompact (fires after Claude Code compacts conversation context)
 *
 * PURPOSE:
 * Context compaction can wipe dynamic state that LoadContext injected at session
 * start. This hook re-injects the most critical pieces so the model doesn't
 * lose track of active work, learning signals, or relationship context.
 *
 * OUTPUT:
 * - stdout: <system-reminder> with compact state recovery
 * - exit(0): Normal completion
 *
 * PERFORMANCE:
 * - <50ms (reads small cached files only)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getPaiDir } from './lib/paths';

const paiDir = getPaiDir();

function loadJSON(path: string): any {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {}
  return null;
}

// Build compact state recovery
const parts: string[] = [];

// 1. Active work sessions (from work.json — lightweight)
const workJson = loadJSON(join(paiDir, 'MEMORY', 'STATE', 'work.json'));
if (workJson?.sessions) {
  const now = Date.now();
  const cutoff = 48 * 60 * 60 * 1000;
  const recent = Object.entries(workJson.sessions)
    .filter(([_, s]: [string, any]) => {
      const ts = new Date(s.updated || s.started || 0).getTime();
      return now - ts < cutoff;
    })
    .slice(0, 8);

  if (recent.length > 0) {
    parts.push('## Active Work (last 48h)');
    for (const [slug, s] of recent as [string, any][]) {
      const title = s.title || slug;
      const status = s.phase || s.status || '?';
      const progress = s.progress || '?';
      parts.push(`- ${title} | ${status} | ${progress}`);
    }
  }
}

// 2. Signal trends (from learning-cache.sh if it exists)
const cachePath = join(paiDir, 'MEMORY', 'STATE', 'learning-cache.sh');
if (existsSync(cachePath)) {
  try {
    const cache = readFileSync(cachePath, 'utf-8');
    const weekAvg = cache.match(/week_avg='([^']+)'/)?.[1];
    const trend = cache.match(/trend='([^']+)'/)?.[1];
    if (weekAvg && trend) {
      parts.push(`\n## Learning Signals\nWeek avg: ${weekAvg}/10 | Trend: ${trend}`);
    }
  } catch {}
}

// 3. Key feedback rules (these are the ones that keep getting violated after compaction)
parts.push(`
## Key Rules (post-compaction reminder)
- Consolidated scripts only — no individual commands for multi-step work
- Capability selection is binding — must invoke via tool, not text-only
- Security tasks require Security skill invocation
- Verify before asserting — never claim "done" without evidence`);

// 4. Algorithm state recovery (from most recent PRD)
try {
  const workDir = join(paiDir, 'MEMORY', 'WORK');
  if (existsSync(workDir)) {
    const dirs = readdirSync(workDir).sort();
    const latest = dirs[dirs.length - 1];
    if (latest) {
      const prdPath = join(workDir, latest, 'PRD.md');
      if (existsSync(prdPath)) {
        const prd = readFileSync(prdPath, 'utf-8');
        const fm = prd.match(/^---\n([\s\S]*?)\n---/);
        if (fm) {
          const yaml = fm[1];
          const phase = yaml.match(/^phase:\s*(.+)$/m)?.[1]?.trim();
          const progress = yaml.match(/^progress:\s*(.+)$/m)?.[1]?.trim();
          const effort = yaml.match(/^effort:\s*(.+)$/m)?.[1]?.trim();
          const task = yaml.match(/^task:\s*(.+)$/m)?.[1]?.trim();
          const slug = yaml.match(/^slug:\s*(.+)$/m)?.[1]?.trim();

          if (phase && phase !== 'complete') {
            const lines: string[] = [`\n## Algorithm State Recovery`];
            lines.push(`- **Task:** ${task || slug || latest}`);
            lines.push(`- **Phase:** ${phase} | **Progress:** ${progress || '?'} | **Effort:** ${effort || '?'}`);
            lines.push(`- **PRD:** MEMORY/WORK/${latest}/PRD.md`);

            // Extract ISC criteria
            const criteria = prd.match(/^- \[[ x]\].+$/gm);
            if (criteria && criteria.length > 0) {
              lines.push('- **ISC Criteria:**');
              for (const c of criteria) {
                lines.push(`  ${c}`);
              }
            }

            parts.push(lines.join('\n'));
          }
        }
      }
    }
  }
} catch {}

if (parts.length > 0) {
  const output = `<system-reminder>\n# PAI State Recovery (post-compaction)\n\n${parts.join('\n')}\n</system-reminder>`;
  process.stdout.write(output);
}
