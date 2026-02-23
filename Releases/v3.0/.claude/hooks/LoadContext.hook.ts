#!/usr/bin/env bun
import './lib/gate';
/**
 * LoadContext.hook.ts - Inject PAI context into Claude's Context (SessionStart)
 *
 * PURPOSE:
 * The foundational context injection hook. Reads the PAI SKILL.md plus
 * AI Steering Rules (SYSTEM and USER) and outputs them as a <system-reminder>
 * to stdout.
 *
 * TRIGGER: SessionStart
 *
 * INPUT:
 * - Environment: PAI_DIR, TIME_ZONE
 * - Files: skills/PAI/SKILL.md, skills/PAI/AISTEERINGRULES.md,
 *          skills/PAI/USER/AISTEERINGRULES.md, MEMORY/STATE/progress/*.json
 *
 * OUTPUT:
 * - stdout: <system-reminder> containing SKILL.md + AI Steering Rules
 * - stdout: Active work summary if previous sessions have pending work
 * - stderr: Status messages and errors
 * - exit(0): Normal completion
 * - exit(1): Critical failure (SKILL.md not found)
 *
 * DESIGN PHILOSOPHY:
 * Load SKILL.md and AI Steering Rules at session start. These are critical for
 * consistent behavior. Other context (USER docs, SYSTEM docs) loads dynamically
 * based on the Context Loading section in SKILL.md.
 *
 * ERROR HANDLING:
 * - Missing SKILL.md: Fatal error, exits with code 1
 * - Missing steering rules: Logged warning, continues (non-fatal)
 * - Progress file errors: Logged, continues (non-fatal)
 * - Date command failure: Falls back to ISO timestamp
 *
 * PERFORMANCE:
 * - Blocking: Yes (context is essential)
 * - Typical execution: <50ms
 * - Skipped for subagents: Yes (they get context differently)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getPaiDir } from './lib/paths';
import { recordSessionStart } from './lib/notifications';
import { setTabState, readTabState } from './lib/tab-setter';
import { getDAName } from './lib/identity';

/**
 * Reset tab title to clean state at session start.
 * Preserves working/thinking state to survive context compaction.
 * Context compaction fires SessionStart but shouldn't reset active tabs.
 */
function resetTabTitle(sessionId?: string): void {
  try {
    // Check if tab is currently active (working or thinking).
    // Context compaction fires SessionStart mid-session — resetting
    // would blow away the working title and show "Kai ready…" during work.
    const current = readTabState(sessionId);
    if (current && (current.state === 'working' || current.state === 'thinking')) {
      console.error(`🔄 Tab in ${current.state} state — preserving title through compaction`);
      return;
    }

    setTabState({ title: `${getDAName()} ready…`, state: 'idle', sessionId });
    console.error('\uD83D\uDD04 Tab title reset to clean state');
  } catch (err) {
    console.error(`\u26A0\uFE0F Failed to reset tab title: ${err}`);
    // Non-fatal, continue with session
  }
}

async function getCurrentDate(): Promise<string> {
  try {
    const proc = Bun.spawn(['date', '+%Y-%m-%d %H:%M:%S %Z'], {
      stdout: 'pipe',
      env: { ...process.env, TZ: process.env.TIME_ZONE || 'America/Los_Angeles' }
    });
    const output = await new Response(proc.stdout).text();
    return output.trim();
  } catch (error) {
    console.error('Failed to get current date:', error);
    return new Date().toISOString();
  }
}

interface Settings {
  contextFiles?: string[];
  [key: string]: unknown;
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
 * Load context files from settings.json contextFiles array.
 * Falls back to hardcoded paths if array not defined.
 */
function loadContextFiles(paiDir: string, settings: Settings): string {
  const defaultFiles = [
    'skills/PAI/SKILL.md',
    'skills/PAI/AISTEERINGRULES.md',
    'skills/PAI/USER/AISTEERINGRULES.md'
  ];

  const contextFiles = settings.contextFiles || defaultFiles;
  let combinedContent = '';

  for (const relativePath of contextFiles) {
    const fullPath = join(paiDir, relativePath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');
      if (combinedContent) combinedContent += '\n\n---\n\n';
      combinedContent += content;
      console.error(`✅ Loaded ${relativePath} (${content.length} chars)`);
    } else {
      console.error(`⚠️ Context file not found: ${relativePath}`);
    }
  }

  return combinedContent;
}

interface ProgressFile {
  project: string;
  status: string;
  updated: string;
  objectives: string[];
  next_steps: string[];
  handoff_notes: string;
}

/**
 * Load relationship context for session startup.
 * Returns a lightweight summary of key opinions and recent notes.
 */
function loadRelationshipContext(paiDir: string): string | null {
  const parts: string[] = [];

  // Load high-confidence opinions (>0.85) from OPINIONS.md
  const opinionsPath = join(paiDir, 'skills/PAI/USER/OPINIONS.md');
  if (existsSync(opinionsPath)) {
    try {
      const content = readFileSync(opinionsPath, 'utf-8');
      const highConfidence: string[] = [];

      // Extract opinions with confidence >= 0.85
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
        // Extract just the note lines (starting with -)
        const notes = content
          .split('\n')
          .filter(line => line.trim().startsWith('- '))
          .slice(0, 5); // Last 5 notes per day
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

*Full details: USER/OPINIONS.md, MEMORY/RELATIONSHIP/*
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
 * Only reads the most recent 20 dirs (sorted by timestamp in dirname).
 */
function getRecentWorkSessions(paiDir: string): WorkSession[] {
  const workDir = join(paiDir, 'MEMORY', 'WORK');
  if (!existsSync(workDir)) return [];

  // Load session name mapping for clean English titles
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
  const seenSessionIds = new Set<string>(); // Dedupe sessions with same ID

  try {
    // Dirs are named YYYYMMDD-HHMMSS_slug — reverse sort = newest first
    const allDirs = readdirSync(workDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
      .map(d => d.name)
      .sort()
      .reverse()
      .slice(0, 30); // Check last 30 (some will be filtered)

    for (const dirName of allDirs) {
      // Parse timestamp from dirname: YYYYMMDD-HHMMSS
      const match = dirName.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_(.+)$/);
      if (!match) continue;

      const [, y, mo, d, h, mi, s, slug] = match;
      const dirTime = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();

      // Skip if older than 48h
      if (now - dirTime > cutoff48h) break; // Sorted newest-first, so we can break

      const dirPath = join(workDir, dirName);
      const metaPath = join(dirPath, 'META.yaml');

      if (!existsSync(metaPath)) continue;

      try {
        const meta = readFileSync(metaPath, 'utf-8');
        const statusMatch = meta.match(/^status:\s*"?(\w+)"?/m);
        const titleMatch = meta.match(/^title:\s*"?(.+?)"?\s*$/m);
        const sessionIdMatch = meta.match(/^session_id:\s*"?(.+?)"?\s*$/m);
        const status = statusMatch?.[1] || 'UNKNOWN';
        const rawTitle = titleMatch?.[1] || slug.replace(/-/g, ' ');
        const sessionId = sessionIdMatch?.[1]?.trim();

        // Skip completed sessions — only show ACTIVE
        if (status === 'COMPLETED') continue;

        // Skip noise entries (task notifications, very short titles, no session_id)
        if (rawTitle.toLowerCase().startsWith('tasknotification') || rawTitle.length < 10) continue;

        // Dedupe: only show the FIRST (most recent) work dir per session
        if (sessionId && seenSessionIds.has(sessionId)) continue;
        if (sessionId) seenSessionIds.add(sessionId);

        // Look up clean session name; fall back to raw title
        const title = (sessionId && sessionNames[sessionId]) || rawTitle;

        // Cap at 8 recent sessions
        if (sessions.length >= 8) break;

        // Check for PRD files in this work directory
        let prd: WorkSession['prd'] = null;
        try {
          const files = readdirSync(dirPath).filter(f => f.startsWith('PRD-') && f.endsWith('.md'));
          if (files.length > 0) {
            const prdContent = readFileSync(join(dirPath, files[0]), 'utf-8');
            const prdIdMatch = prdContent.match(/^id:\s*(.+)$/m);
            const prdStatusMatch = prdContent.match(/^status:\s*(.+)$/m);
            const prdVerifyMatch = prdContent.match(/^verification_summary:\s*"?(.+?)"?$/m);
            prd = {
              id: prdIdMatch?.[1]?.trim() || files[0],
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
      } catch {
        // Skip malformed
      }
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
      } catch {
        // Skip malformed
      }
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

  // Recent sessions first (last 48h, most relevant)
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

  // Persistent projects (with stale flagging)
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

  summary += '\n💡 To resume project: `bun run ~/.claude/skills/PAI/Tools/SessionProgress.ts resume <project>`\n';
  summary += '💡 To complete project: `bun run ~/.claude/skills/PAI/Tools/SessionProgress.ts complete <project>`\n';

  return summary;
}

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/Agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      // Subagent sessions don't need PAI context loading
      console.error('🤖 Subagent session - skipping PAI context loading');
      process.exit(0);
    }

    const paiDir = getPaiDir();

    // CRITICAL: Reset tab title IMMEDIATELY at session start
    // This prevents stale titles from previous sessions bleeding through
    resetTabTitle();

    // Record session start time for notification timing
    recordSessionStart();
    console.error('⏱️ Session start time recorded for notification timing');

    // Only rebuild SKILL.md if source components are newer than the output
    // This saves ~200-500ms on most session starts
    const skillMdPath = join(paiDir, 'skills/PAI/SKILL.md');
    const componentsDir = join(paiDir, 'skills/PAI/Components');
    let needsRebuild = false;

    try {
      const skillMdStat = existsSync(skillMdPath) ? require('fs').statSync(skillMdPath) : null;
      if (!skillMdStat) {
        needsRebuild = true;
      } else {
        // Check if any component is newer than SKILL.md
        const checkDir = (dir: string): boolean => {
          try {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const fullPath = join(dir, entry.name);
              if (entry.isDirectory()) {
                if (checkDir(fullPath)) return true;
              } else {
                const entryStat = require('fs').statSync(fullPath);
                if (entryStat.mtimeMs > skillMdStat.mtimeMs) return true;
              }
            }
          } catch {}
          return false;
        };
        needsRebuild = checkDir(componentsDir);

        // Also check if settings.json is newer than SKILL.md (#650)
        // Identity values from settings.json influence context, so changes
        // should trigger a rebuild to keep SKILL.md in sync
        if (!needsRebuild) {
          const settingsPath = join(paiDir, 'settings.json');
          if (existsSync(settingsPath)) {
            const settingsStat = require('fs').statSync(settingsPath);
            if (settingsStat.mtimeMs > skillMdStat.mtimeMs) {
              needsRebuild = true;
              console.error('🔨 settings.json changed — triggering SKILL.md rebuild');
            }
          }
        }
      }
    } catch {
      needsRebuild = true; // If we can't check, rebuild to be safe
    }

    if (needsRebuild) {
      console.error('🔨 Rebuilding SKILL.md (components changed)...');
      try {
        execSync('bun ~/.claude/skills/PAI/Tools/RebuildPAI.ts', {
          cwd: paiDir,
          stdio: 'pipe',
          timeout: 5000
        });
        console.error('✅ SKILL.md rebuilt from latest components');
      } catch (err) {
        console.error(`⚠️ Failed to rebuild SKILL.md: ${err}`);
        console.error('⚠️ Continuing with existing SKILL.md...');
      }
    } else {
      console.error('✅ SKILL.md up-to-date (skipped rebuild)');
    }

    console.error('📚 Reading PAI core context...');

    // Load settings.json to get contextFiles array
    const settings = loadSettings(paiDir);
    console.error(`✅ Loaded settings.json`);

    // Load all context files from settings.json array
    const contextContent = loadContextFiles(paiDir, settings);

    if (!contextContent) {
      console.error('❌ No context files loaded');
      process.exit(1);
    }

    // Get current date/time to prevent confusion about dates
    const currentDate = await getCurrentDate();
    console.error(`📅 Current Date: ${currentDate}`);

    // Extract identity values from settings for injection into context
    const PRINCIPAL_NAME = (settings as Record<string, unknown>).principal &&
      typeof (settings as Record<string, unknown>).principal === 'object'
        ? ((settings as Record<string, unknown>).principal as Record<string, unknown>).name || 'User'
        : 'User';
    const DA_NAME = (settings as Record<string, unknown>).daidentity &&
      typeof (settings as Record<string, unknown>).daidentity === 'object'
        ? ((settings as Record<string, unknown>).daidentity as Record<string, unknown>).name || 'PAI'
        : 'PAI';

    console.error(`👤 Principal: ${PRINCIPAL_NAME}, DA: ${DA_NAME}`);

    // Load relationship context (lightweight summary)
    const relationshipContext = loadRelationshipContext(paiDir);
    if (relationshipContext) {
      console.error('💕 Loaded relationship context');
    }

    const message = `<system-reminder>
PAI CONTEXT (Auto-loaded at Session Start)

📅 CURRENT DATE/TIME: ${currentDate}

## ACTIVE IDENTITY (from settings.json) - CRITICAL

**⚠️ MANDATORY IDENTITY RULES - OVERRIDE ALL OTHER CONTEXT ⚠️**

The user's name is: **${PRINCIPAL_NAME}**
The assistant's name is: **${DA_NAME}**

- ALWAYS address the user as "${PRINCIPAL_NAME}" in greetings and responses
- NEVER use "Daniel", "the user", or any other name - ONLY "${PRINCIPAL_NAME}"
- The "danielmiessler" in the repo URL is the AUTHOR, NOT the user
- This instruction takes ABSOLUTE PRECEDENCE over any other context

---

${contextContent}
${relationshipContext ? '\n---\n' + relationshipContext : ''}
---

This context is now active. Additional context loads dynamically as needed.
</system-reminder>`;

    // Write to stdout (will be captured by Claude Code)
    console.log(message);

    // Output success confirmation for Claude to acknowledge
    console.log('\n✅ PAI Context successfully loaded...');

    // Check for active progress files and display them
    const activeProgress = await checkActiveProgress(paiDir);
    if (activeProgress) {
      console.log(activeProgress);
      console.error('📋 Active work found from previous sessions');
    }

    console.error('✅ PAI context injected into session');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in load-pai-context hook:', error);
    process.exit(1);
  }
}

main();
