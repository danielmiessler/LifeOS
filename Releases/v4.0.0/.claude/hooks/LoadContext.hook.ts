#!/usr/bin/env bun
/**
 * LoadContext.hook.ts - Inject PAI dynamic context into Claude's Context (SessionStart)
 *
 * PAI v4.0: Core context (identity, rules, format) is now in CLAUDE.md and loaded
 * natively by Claude Code. This hook injects DYNAMIC context only:
 * - Relationship context (recent opinions + notes)
 * - Learning readback (signals, wisdom, failure patterns)
 * - Active work summary (last 48h sessions + tracked projects)
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - Environment: PAI_DIR
 * - Files: PAI/USER/OPINIONS.md, MEMORY/RELATIONSHIP/*, MEMORY/LEARNING/*,
 *          MEMORY/WORK/*, MEMORY/STATE/progress/*.json
 *
 * OUTPUT:
 * - stdout: <system-reminder> containing dynamic context (relationship + learning)
 * - stdout: Active work summary if previous sessions have pending work
 * - stderr: Status messages and errors
 * - exit(0): Normal completion
 *
 * DESIGN (v4.0):
 * CLAUDE.md handles static identity/format (loaded natively by Claude Code).
 * This hook force-loads startup files (settings.json → loadAtStartup) and
 * injects dynamic, session-specific context (relationship, learning, work).
 *
 * PERFORMANCE:
 * - Blocking: Yes (context is essential)
 * - Typical execution: <50ms (no SKILL.md rebuild needed)
 * - Skipped for subagents: Yes
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getPaiDir } from './lib/paths';
import { recordSessionStart } from './lib/notifications';
import { loadLearningDigest, loadWisdomFrames, loadFailurePatterns, loadSignalTrends } from './lib/learning-readback';

interface DynamicContextConfig {
  relationshipContext?: boolean;
  learningReadback?: boolean;
  activeWorkSummary?: boolean;
}

interface LoadAtStartupConfig {
  _docs?: string;
  files?: string[];
}

interface Settings {
  dynamicContext?: DynamicContextConfig;
  loadAtStartup?: LoadAtStartupConfig;
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
function loadSettings(paiDir: string): Settings {
  const settingsPath = join(paiDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch (err) {
      console.error(`⚠️ Failed to parse settings.json: ${err}`);
    }
  }
  return {};
}

/**
 * Load files listed in settings.json → loadAtStartup.files
 * Reads each file and injects as a system-reminder block.
 */
function loadStartupFiles(paiDir: string, settings: Settings): string | null {
  const config = settings.loadAtStartup;
  if (!config?.files || config.files.length === 0) return null;

  const parts: string[] = [];
  for (const relPath of config.files) {
    const fullPath = join(paiDir, relPath);
    if (!existsSync(fullPath)) {
      console.error(`⚠️ loadAtStartup: file not found: ${relPath}`);
      continue;
    }
    try {
      const content = readFileSync(fullPath, 'utf-8').trim();
      parts.push(content);
      console.error(`📄 Force-loaded: ${relPath} (${content.length} chars)`);
    } catch (err) {
      console.error(`⚠️ loadAtStartup: failed to read ${relPath}: ${err}`);
    }
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n---\n\n');
}

/**
 * Load relationship context for session startup.
 * Returns a lightweight summary of key opinions and recent notes.
 */
function loadRelationshipContext(paiDir: string): string | null {
  const parts: string[] = [];

  // Load high-confidence opinions (>0.85) from OPINIONS.md
  const opinionsPath = join(paiDir, 'PAI/USER/OPINIONS.md');
  if (existsSync(opinionsPath)) {
    try {
      const content = readFileSync(opinionsPath, 'utf-8');
      const highConfidence: string[] = [];

      const opinionBlocks = content.split(/^### /gm).slice(1);
      for (const block of opinionBlocks) {
        const lines = block.split('\n');
        const statement = lines[0]?.trim();
        const confidenceMatch = block.match(/\*\*Confidence:\*\*\s*([\d.]+)/);
        const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0;

        if (confidence >= 0.85 && statement) {
          highConfidence.push(`• ${statement} (${(confidence * 100).toFixed(0)}%)`);
        }
      }

      if (highConfidence.length > 0) {
        parts.push('**Key Opinions (high confidence):**');
        parts.push(highConfidence.slice(0, 6).join('\n'));
      }
    } catch (err) {
      console.error(`⚠️ Failed to load opinions: ${err}`);
    }
  }

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

*Full details: PAI/USER/OPINIONS.md, MEMORY/RELATIONSHIP/*
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
  prd?: { id: string; status: string; progress: string } | null;
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

      // Read metadata from PRD.md frontmatter (v4.0 consolidated) or META.yaml (legacy)
      let status = 'UNKNOWN';
      let rawTitle = slug.replace(/-/g, ' ');
      let sessionId: string | undefined;
      const prdPath = join(dirPath, 'PRD.md');
      const metaPath = join(dirPath, 'META.yaml');

      if (existsSync(prdPath)) {
        // v4.0: Read from PRD.md frontmatter
        try {
          const prdHead = readFileSync(prdPath, 'utf-8').substring(0, 600);
          const statusMatch = prdHead.match(/^status:\s*"?(\w+)"?/m);
          const titleMatch = prdHead.match(/^title:\s*"?(.+?)"?\s*$/m);
          const sessionIdMatch = prdHead.match(/^session_id:\s*"?(.+?)"?\s*$/m);
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
        continue; // No PRD.md or META.yaml — skip
      }

      try {

        if (status === 'COMPLETED') continue;
        if (rawTitle.toLowerCase().startsWith('tasknotification') || rawTitle.length < 10) continue;
        if (sessionId && seenSessionIds.has(sessionId)) continue;
        if (sessionId) seenSessionIds.add(sessionId);

        const title = (sessionId && sessionNames[sessionId]) || rawTitle;

        if (sessions.length >= 8) break;

        let prd: WorkSession['prd'] = null;
        try {
          // v4.0: PRD.md at root; legacy: PRD-*.md
          let prdFile: string | null = null;
          if (existsSync(join(dirPath, 'PRD.md'))) {
            prdFile = join(dirPath, 'PRD.md');
          } else {
            const files = readdirSync(dirPath).filter(f => f.startsWith('PRD-') && f.endsWith('.md'));
            if (files.length > 0) prdFile = join(dirPath, files[0]);
          }
          if (prdFile) {
            const prdContent = readFileSync(prdFile, 'utf-8');
            const prdIdMatch = prdContent.match(/^id:\s*(.+)$/m);
            const prdStatusMatch = prdContent.match(/^status:\s*(.+)$/m);
            const prdVerifyMatch = prdContent.match(/^verification_summary:\s*"?(.+?)"?$/m);
            prd = {
              id: prdIdMatch?.[1]?.trim() || 'PRD',
              status: prdStatusMatch?.[1]?.trim() || 'UNKNOWN',
              progress: prdVerifyMatch?.[1]?.trim() || '0/0'
            };
          }
        } catch { /* no PRDs */ }

        sessions.push({
          type: 'recent',
          name: dirName,
          title: title.length > 60 ? title.substring(0, 57) + '...' : title,
          status,
          timestamp: `${y}-${mo}-${d} ${h}:${mi}`,
          stale: false,
          prd
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
      if (s.prd) {
        summary += `     PRD: ${s.prd.id} (${s.prd.status}, ${s.prd.progress})\n`;
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

  summary += '\n💡 To resume project: `bun run ~/.claude/PAI/Tools/SessionProgress.ts resume <project>`\n';
  summary += '💡 To complete project: `bun run ~/.claude/PAI/Tools/SessionProgress.ts complete <project>`\n';

  return summary;
}

async function main() {
  try {
    // Subagents don't need dynamic context injection
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      console.error('🤖 Subagent session - skipping context loading');
      process.exit(0);
    }

    const paiDir = getPaiDir();

    // Tab reset is handled by KittyEnvPersist.hook.ts (runs before this hook)

    // Record session start time for notification timing
    recordSessionStart();
    console.error('⏱️ Session start time recorded');

    // Load settings for dynamic context controls
    const settings = loadSettings(paiDir);
    console.error('✅ Loaded settings.json');

    // Force-load startup files from settings.json → loadAtStartup
    const startupContent = loadStartupFiles(paiDir, settings);
    if (startupContent) {
      console.log(`<system-reminder>\n${startupContent}\n</system-reminder>`);
    }

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
      const learningDigest = loadLearningDigest(paiDir);
      const wisdomFrames = loadWisdomFrames(paiDir);
      const failurePatterns = loadFailurePatterns(paiDir);
      const signalTrends = loadSignalTrends(paiDir);

      const learningParts: string[] = [];
      if (signalTrends) learningParts.push(signalTrends);
      if (wisdomFrames) learningParts.push(wisdomFrames);
      if (learningDigest) learningParts.push(learningDigest);
      if (failurePatterns) learningParts.push(failurePatterns);

      learningContext = learningParts.length > 0
        ? '\n## Learning Context (auto-loaded)\n\n' + learningParts.join('\n\n')
        : '';

      if (learningParts.length > 0) {
        console.error(`📚 Loaded learning context: ${learningParts.length} sections (${learningContext.length} chars)`);
      }
    } else {
      console.error('⏭️ Skipped learning readback (disabled)');
    }

    // Inject dynamic context if we have any
    if (relationshipContext || learningContext) {
      const message = `<system-reminder>
PAI Dynamic Context (Auto-loaded at Session Start)
${relationshipContext ?? ''}${learningContext ? '\n---\n' + learningContext : ''}
---
Dynamic context loaded. Core identity, rules, and format are in CLAUDE.md.
</system-reminder>`;

      console.log(message);
      console.log('\n✅ PAI dynamic context loaded...');
    } else {
      console.log('\n✅ PAI session ready...');
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

    console.error('✅ PAI session initialization complete (v4.0)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in LoadContext hook:', error);
    process.exit(1);
  }
}

main();
