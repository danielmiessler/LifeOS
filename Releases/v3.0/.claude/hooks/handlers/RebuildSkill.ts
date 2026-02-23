#!/usr/bin/env bun
/**
 * RebuildSkill.ts - Auto-rebuild PAI SKILL.md from Components
 *
 * PURPOSE:
 * Automatically rebuilds SKILL.md from Components/ after every response.
 * Ensures SKILL.md stays current if components were edited during the session.
 *
 * TRIGGER: Stop event (via StopOrchestrator)
 *
 * BEHAVIOR:
 * - Checks if any Component file is newer than SKILL.md
 * - If yes, runs BuildSkill.ts to regenerate SKILL.md
 * - Logs rebuild status to stderr
 *
 * DESIGN RATIONALE:
 * - Rebuild on session END (not START) keeps LoadContext fast
 * - Components are source of truth, SKILL.md is generated artifact
 * - No manual `bun BuildSkill.ts` needed - happens automatically
 */

import { statSync, readdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

export async function handleRebuildSkill(): Promise<void> {
  const CORE_DIR = join(process.env.HOME!, '.claude/skills/PAI');
  const COMPONENTS_DIR = join(CORE_DIR, 'Components');
  const SKILL_MD = join(CORE_DIR, 'SKILL.md');
  const BUILD_SCRIPT = join(CORE_DIR, 'Tools/RebuildPAI.ts');

  try {
    // Check if SKILL.md exists
    let skillStat;
    try {
      skillStat = statSync(SKILL_MD);
    } catch {
      // SKILL.md doesn't exist - rebuild needed
      console.error('[RebuildSkill] SKILL.md missing - rebuilding');
      await rebuild(BUILD_SCRIPT);
      return;
    }

    // Check if any component is newer than SKILL.md
    const components = readdirSync(COMPONENTS_DIR).filter(f => f.endsWith('.md'));
    const anyNewer = components.some(file => {
      const componentPath = join(COMPONENTS_DIR, file);
      const componentStat = statSync(componentPath);
      return componentStat.mtimeMs > skillStat.mtimeMs;
    });

    if (anyNewer) {
      console.error('[RebuildSkill] Components modified - rebuilding SKILL.md');
      await rebuild(BUILD_SCRIPT);
    } else {
      console.error('[RebuildSkill] SKILL.md is current - no rebuild needed');
    }
  } catch (error) {
    console.error('[RebuildSkill] Error checking/rebuilding:', error);
  }
}

function rebuild(buildScript: string): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      console.error('[RebuildSkill] Build timed out after 10s');
      resolve();
    }, 10000);

    const child = spawn('bun', [buildScript], {
      cwd: join(process.env.HOME!, '.claude/skills/PAI'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { console.error(d.toString()); });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        console.error(`[RebuildSkill] Build exited with code ${code}`);
      } else {
        console.error('[RebuildSkill]', stdout.trim() || 'Build completed');
      }
      resolve();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[RebuildSkill] Build failed:', err);
      resolve();
    });
  });
}
