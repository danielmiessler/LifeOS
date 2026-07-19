#!/usr/bin/env bun
/**
 * @version 1.6.28
 * LoadContext.hook.ts - Inject LifeOS dynamic context into Claude's Context (SessionStart)
 *
 * LifeOS v5.0 Context Architecture:
 * - Constitutional rules     → LIFEOS/LIFEOS_SYSTEM_PROMPT.md (system prompt via --append-system-prompt-file)
 * - Operational procedures   → CLAUDE.md (loaded natively by Claude Code)
 * - Contextual knowledge     → @imports in CLAUDE.md (native Claude Code mechanism, v5.0)
 * - Dynamic context          → this hook (relationship, learning, work)
 *
 * This hook handles dynamic context only (v5.0 — static files moved to @imports):
 * - Injects dynamic, session-specific context:
 *   - Relationship context (recent opinions + notes)
 *   - Learning readback (signals, wisdom, failure patterns)
 *   - Active work summary (last 48h sessions + tracked projects)
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - Environment: LIFEOS_ROOT, LIFEOS_DIR, LIFEOS_CONFIG_DIR
 *          MEMORY/WORK/*, MEMORY/STATE/progress/*.json
 *
 * OUTPUT:
 * - stdout: <system-reminder> containing runtime paths and dynamic context
 * - stdout: Active work summary if previous sessions have pending work
 * - stderr: Status messages and errors
 * - exit(0): Normal completion
 *
 * DESIGN (v5.0):
 * Constitutional rules live in the system prompt (LIFEOS/LIFEOS_SYSTEM_PROMPT.md).
 * Operational procedures + contextual knowledge live in CLAUDE.md (@imports, native).
 * This hook injects dynamic, session-specific context only (relationship, learning, work).
 *
 * PERFORMANCE:
 * - Blocking: Yes (context is essential)
 * - Typical execution: <50ms (no SKILL.md rebuild needed)
 * - Subagents: runtime path contract only; personal dynamic context is skipped
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import { expandPath, getLifeosDir, getSettingsPath } from './lib/paths';
import { recordSessionStart } from './lib/notifications';
import { loadWisdomFrames } from './lib/learning-readback';
import { findArtifactPath } from './lib/isa-utils';

interface DynamicContextConfig {
  relationshipContext?: boolean;
  learningReadback?: boolean;
  activeWorkSummary?: boolean;
}

interface Settings {
  dynamicContext?: DynamicContextConfig;
  env?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Check if a dynamic context section is enabled.
 * Defaults to true if not configured (backward compatible).
 */
function isDynamicEnabled(settings: Settings, key: keyof DynamicContextConfig): boolean {
  if (!settings.dynamicContext) return true;
  const val = settings.dynamicContext[key];
  return val !== false;
}

/**
 * Load settings.json and return the settings object.
 */
function loadSettings(): Settings {
  const settingsPath = getSettingsPath();
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch (err) {
      console.error(`⚠️ Failed to parse settings.json: ${err}`);
    }
  }
  return {};
}

function configuredPath(settings: Settings, name: string): string | null {
  const value = process.env[name] ?? settings.env?.[name];
  return typeof value === 'string' && value.trim() !== '' ? expandPath(value) : null;
}

/**
 * Ground LifeOS' model-facing path placeholders in every session. These are
 * semantic prompt variables, not a Claude Code templating feature: the model
 * must replace them with the values below before it invokes a tool.
 */
function getRuntimePathContext(settings: Settings): string {
  const lifeosDir = configuredPath(settings, 'LIFEOS_DIR') ?? getLifeosDir();
  const derivedRoot = dirname(lifeosDir);
  const configuredRoot = configuredPath(settings, 'LIFEOS_ROOT');
  // LIFEOS_DIR/self-location is the recovery source of truth. Ignore a stale
  // LIFEOS_ROOT from an older settings merge instead of mixing two installs.
  const lifeosRoot = configuredRoot && resolve(configuredRoot) === resolve(derivedRoot)
    ? configuredRoot
    : derivedRoot;
  const configuredConfigDir = configuredPath(settings, 'LIFEOS_CONFIG_DIR');
  // Ignore the historical poisoned value LIFEOS_CONFIG_DIR=<root>/LIFEOS.
  const lifeosConfigDir = configuredConfigDir && resolve(configuredConfigDir) !== resolve(lifeosDir)
    ? configuredConfigDir
    : (resolve(lifeosRoot) === resolve(join(homedir(), '.claude'))
      ? join(homedir(), '.config', 'LIFEOS')
      : join(lifeosRoot, 'USER-data'));

  return `## LifeOS Runtime Paths (authoritative)

- {{LIFEOS_ROOT}} = ${JSON.stringify(lifeosRoot)}
- {{LIFEOS_DIR}} = ${JSON.stringify(lifeosDir)}
- {{LIFEOS_CONFIG_DIR}} = ${JSON.stringify(lifeosConfigDir)}

Resolve every \`{{LIFEOS_*}}\` placeholder to the value above before invoking Read, Edit, Write, Glob, Grep, or Bash. Never pass an unresolved LifeOS placeholder to a tool. In executable shell snippets, quoted shell variables such as \`"\${LIFEOS_ROOT}/skills"\` are intentional and are expanded by the shell instead.`;
}

// v5.0: loadStartupFiles removed — static files now loaded via @imports in CLAUDE.md.template

/**
 * Load relationship context for session startup.
 * Returns a lightweight summary of key opinions and recent notes.
 */
function loadRelationshipContext(paiDir: string): string | null {
  const parts: string[] = [];

  // Load recent relationship notes (today and yesterday)
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const formatMonth = (d: Date) => d.toISOString().slice(0, 7);

  const recentNotes: string[] = [];
  for (const date of [today, yesterday]) {
    const notePath = join(
      paiDir,
      'MEMORY/RELATIONSHIP',
      formatMonth(date),
      `${formatDate(date)}.md`
    );
    if (existsSync(notePath)) {
      try {
        const content = readFileSync(notePath, 'utf-8');
        const notes = content
          .split('\n')
          .filter(line => line.trim().startsWith('- '))
          .slice(0, 5);
        if (notes.length > 0) {
          recentNotes.push(`*${formatDate(date)}:*`);
          recentNotes.push(...notes);
        }
      } catch {}
    }
  }

  if (recentNotes.length > 0) {
    if (parts.length > 0) parts.push('');
    parts.push('**Recent Relationship Notes:**');
    parts.push(recentNotes.join('\n'));
  }

  if (parts.length === 0) return null;

  return `
## Relationship Context

${parts.join('\n')}

`;
}

interface WorkSession {
  type: 'recent' | 'project';
  name: string;
  title: string;
  status: string;
  timestamp: string;
  stale: boolean;
  objectives?: string[];
  handoff_notes?: string;
  next_steps?: string[];
  isa?: { id: string; status: string; progress: string } | null;
}

/**
 * Scan recent WORK/ directories (last 48h) for active sessions.
 */
function getRecentWorkSessions(paiDir: string): WorkSession[] {
  const workDir = join(paiDir, 'MEMORY', 'WORK');
  if (!existsSync(workDir)) return [];

  let sessionNames: Record<string, string> = {};
  const namesPath = join(paiDir, 'MEMORY', 'STATE', 'session-names.json');
  try {
    if (existsSync(namesPath)) {
      sessionNames = JSON.parse(readFileSync(namesPath, 'utf-8'));
    }
  } catch { /* ignore parse errors */ }

  const sessions: WorkSession[] = [];
  const now = Date.now();
  const cutoff48h = 48 * 60 * 60 * 1000;
  const seenSessionIds = new Set<string>();

  try {
    const allDirs = readdirSync(workDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse()
      .slice(0, 30);

    for (const dirName of allDirs) {
      const match = dirName.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_(.+)$/);
      if (!match) continue;

      const [, y, mo, d, h, mi, s, slug] = match;
      const dirTime = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();

      if (now - dirTime > cutoff48h) break;

      const dirPath = join(workDir, dirName);

      // Read metadata from ISA.md frontmatter (v4.1 canonical), legacy PRD.md
      // (v4.0 consolidated, pre-rename), or META.yaml (pre-v4.0 layout).
      let status = 'UNKNOWN';
      let rawTitle = slug.replace(/-/g, ' ');
      let sessionId: string | undefined;
      const isaPath = findArtifactPath(dirName);
      const metaPath = join(dirPath, 'META.yaml');

      if (isaPath) {
        // v4.0+: Read from ISA.md / PRD.md frontmatter
        try {
          const head = readFileSync(isaPath, 'utf-8').substring(0, 600);
          const statusMatch = head.match(/^status:\s*"?(\w+)"?/m);
          const titleMatch = head.match(/^title:\s*"?(.+?)"?\s*$/m);
          const sessionIdMatch = head.match(/^session_id:\s*"?(.+?)"?\s*$/m);
          if (statusMatch) status = statusMatch[1];
          if (titleMatch) rawTitle = titleMatch[1];
          if (sessionIdMatch) sessionId = sessionIdMatch[1]?.trim();
        } catch { /* skip */ }
      } else if (existsSync(metaPath)) {
        // Legacy: Read from META.yaml
        try {
          const meta = readFileSync(metaPath, 'utf-8');
          const statusMatch = meta.match(/^status:\s*"?(\w+)"?/m);
          const titleMatch = meta.match(/^title:\s*"?(.+?)"?\s*$/m);
          const sessionIdMatch = meta.match(/^session_id:\s*"?(.+?)"?\s*$/m);
          if (statusMatch) status = statusMatch[1];
          if (titleMatch) rawTitle = titleMatch[1];
          if (sessionIdMatch) sessionId = sessionIdMatch[1]?.trim();
        } catch { /* skip */ }
      } else {
        continue; // No ISA.md / PRD.md / META.yaml — skip
      }

      try {

        if (status === 'COMPLETED') continue;
        if (rawTitle.toLowerCase().startsWith('tasknotification') || rawTitle.length < 10) continue;
        if (sessionId && seenSessionIds.has(sessionId)) continue;
        if (sessionId) seenSessionIds.add(sessionId);

        const title = (sessionId && sessionNames[sessionId]) || rawTitle;

        if (sessions.length >= 8) break;

        let isa: WorkSession['isa'] = null;
        try {
          // v4.1: ISA.md at root; v4.0: PRD.md at root; pre-v4.0: PRD-*.md.
          // findArtifactPath already covers v4.0/v4.1; fall back to date-stamped
          // PRD-*.md files only when neither ISA.md nor PRD.md is present.
          let artifactFile: string | null = isaPath;
          if (!artifactFile) {
            const files = readdirSync(dirPath).filter(f =>
              (f.startsWith('ISA-') || f.startsWith('PRD-')) && f.endsWith('.md')
            );
            if (files.length > 0) artifactFile = join(dirPath, files[0]);
          }
          if (artifactFile) {
            const isaContent = readFileSync(artifactFile, 'utf-8');
            const idMatch = isaContent.match(/^id:\s*(.+)$/m);
            const statusMatch2 = isaContent.match(/^status:\s*(.+)$/m);
            const verifyMatch = isaContent.match(/^verification_summary:\s*"?(.+?)"?$/m);
            isa = {
              id: idMatch?.[1]?.trim() || 'ISA',
              status: statusMatch2?.[1]?.trim() || 'UNKNOWN',
              progress: verifyMatch?.[1]?.trim() || '0/0'
            };
          }
        } catch { /* no artifacts */ }

        sessions.push({
          type: 'recent',
          name: dirName,
          title: title.length > 60 ? title.substring(0, 57) + '...' : title,
          status,
          timestamp: `${y}-${mo}-${d} ${h}:${mi}`,
          stale: false,
          isa
        });
      } catch { /* skip malformed */ }
    }
  } catch (err) {
    console.error(`⚠️ Error scanning WORK dirs: ${err}`);
  }

  return sessions;
}

/**
 * Load persistent project progress files, flagging stale ones (>14 days).
 */
function getProjectProgress(paiDir: string): WorkSession[] {
  const progressDir = join(paiDir, 'MEMORY', 'STATE', 'progress');
  if (!existsSync(progressDir)) return [];

  const sessions: WorkSession[] = [];
  const now = Date.now();
  const staleThreshold = 14 * 24 * 60 * 60 * 1000;

  try {
    const files = readdirSync(progressDir).filter(f => f.endsWith('-progress.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(progressDir, file), 'utf-8');

        interface ProgressFile {
          project: string;
          status: string;
          updated: string;
          objectives: string[];
          next_steps: string[];
          handoff_notes: string;
        }

        const progress = JSON.parse(content) as ProgressFile;
        if (progress.status !== 'active') continue;

        const updatedTime = new Date(progress.updated).getTime();
        const isStale = (now - updatedTime) > staleThreshold;

        sessions.push({
          type: 'project',
          name: progress.project,
          title: progress.project,
          status: 'active',
          timestamp: new Date(progress.updated).toISOString().split('T')[0],
          stale: isStale,
          objectives: progress.objectives,
          handoff_notes: progress.handoff_notes,
          next_steps: progress.next_steps
        });
      } catch { /* skip malformed */ }
    }
  } catch (err) {
    console.error(`⚠️ Error reading progress files: ${err}`);
  }

  return sessions;
}

/**
 * Unified activity dashboard — merges recent WORK sessions + persistent projects.
 */
async function checkActiveProgress(paiDir: string): Promise<string | null> {
  const recentSessions = getRecentWorkSessions(paiDir);
  const projects = getProjectProgress(paiDir);

  if (recentSessions.length === 0 && projects.length === 0) {
    return null;
  }

  let summary = '\n📋 ACTIVE WORK:\n';

  if (recentSessions.length > 0) {
    summary += '\n  ── Recent Sessions (last 48h) ──\n';
    for (const s of recentSessions) {
      summary += `\n  ⚡ ${s.title}\n`;
      summary += `     ${s.timestamp} | Status: ${s.status}\n`;
      if (s.isa) {
        summary += `     ISA: ${s.isa.id} (${s.isa.status}, ${s.isa.progress})\n`;
      }
    }
  }

  if (projects.length > 0) {
    summary += '\n  ── Tracked Projects ──\n';
    for (const proj of projects) {
      const staleTag = proj.stale ? ' ⚠️ STALE (>14d)' : '';
      summary += `\n  ${proj.stale ? '🟡' : '🔵'} ${proj.name}${staleTag}\n`;

      if (proj.objectives && proj.objectives.length > 0) {
        summary += '     Objectives:\n';
        proj.objectives.forEach(o => summary += `     • ${o}\n`);
      }

      if (proj.handoff_notes) {
        summary += `     Handoff: ${proj.handoff_notes}\n`;
      }

      if (proj.next_steps && proj.next_steps.length > 0) {
        summary += '     Next steps:\n';
        proj.next_steps.forEach(s => summary += `     → ${s}\n`);
      }
    }
  }

  const toolsDir = paiDir + '/Tools';
  summary += `\n💡 To resume project: \`bun run ${toolsDir}/SessionProgress.ts resume <project>\`\n`;
  summary += `💡 To complete project: \`bun run ${toolsDir}/SessionProgress.ts complete <project>\`\n`;

  return summary;
}

async function main() {
  try {
    // Load settings before the subagent check: subagents skip personal dynamic
    // context, but still need the authoritative path mapping used by skills.
    const settings = loadSettings();
    const runtimePathContext = getRuntimePathContext(settings);

    // Subagents don't need dynamic context injection
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      console.log(`<system-reminder>\n${runtimePathContext}\n</system-reminder>`);
      console.error('🤖 Subagent session - skipping context loading');
      process.exit(0);
    }

    const paiDir = getLifeosDir();

    // Tab reset is handled by KittyEnvPersist.hook.ts (runs before this hook)

    // Record session start time for notification timing
    recordSessionStart();
    console.error('⏱️ Session start time recorded');

    // Settings were loaded before the subagent check so paths are always grounded.
    console.error('✅ Loaded settings.json');

    // v5.0: Static startup files now loaded via @imports in CLAUDE.md (native Claude Code mechanism)

    // Load relationship context (lightweight summary)
    let relationshipContext: string | null = null;
    if (isDynamicEnabled(settings, 'relationshipContext')) {
      relationshipContext = loadRelationshipContext(paiDir);
      if (relationshipContext) {
        console.error(`💕 Loaded relationship context (${relationshipContext.length} chars)`);
      }
    } else {
      console.error('⏭️ Skipped relationship context (disabled)');
    }

    // Load learning readback context
    let learningContext = '';
    if (isDynamicEnabled(settings, 'learningReadback')) {
      // 2026-07-10 ({{PRINCIPAL_NAME}} directive): keep ONLY the Wisdom Frames — the actionable
      // behavioral guidance. Dropped the self-rating wall (Performance Signals,
      // Complaint Clusters, Recent Learning Signals, Recent Failure Patterns): it was
      // negative session-start priming and the biggest single one-time context block.
      const wisdomFrames = loadWisdomFrames(paiDir);

      learningContext = wisdomFrames
        ? '\n## Learning Context (auto-loaded)\n\n' + wisdomFrames
        : '';

      if (wisdomFrames) {
        console.error(`📚 Loaded learning context: wisdom frames (${learningContext.length} chars)`);
      }
    } else {
      console.error('⏭️ Skipped learning readback (disabled)');
    }

    // Always inject the runtime path contract; append optional dynamic context.
    {
      const dynamicContext = relationshipContext || learningContext
        ? `\n---\n${relationshipContext ?? ''}${learningContext ? '\n---\n' + learningContext : ''}\n---\nDynamic context loaded. Constitutional rules are in the system prompt (LIFEOS/LIFEOS_SYSTEM_PROMPT.md). Operational procedures are in CLAUDE.md.`
        : '';
      const message = `<system-reminder>
LifeOS Dynamic Context (Auto-loaded at Session Start)
${runtimePathContext}${dynamicContext}
</system-reminder>`;

      console.log(message);
      console.log(relationshipContext || learningContext
        ? '\n✅ LifeOS dynamic context loaded...'
        : '\n✅ LifeOS session ready...');
    }

    // Active work summary
    if (isDynamicEnabled(settings, 'activeWorkSummary')) {
      const activeProgress = await checkActiveProgress(paiDir);
      if (activeProgress) {
        console.log(activeProgress);
        console.error(`📋 Active work summary loaded (${activeProgress.length} chars)`);
      }
    } else {
      console.error('⏭️ Skipped active work summary (disabled)');
    }

    console.error('✅ LifeOS session initialization complete (v5.0 — static context via @imports)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in LoadContext hook:', error);
    process.exit(0); // Non-fatal — don't block session startup
  }
}

main();
