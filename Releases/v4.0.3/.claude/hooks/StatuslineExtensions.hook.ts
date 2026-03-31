#!/usr/bin/env bun
/**
 * StatuslineExtensions.hook.ts — Ensure user statusline extensions are wired
 *
 * PURPOSE:
 * Self-healing hook that checks if statusline-command.sh has the source line
 * for user extensions. If missing (e.g., after a PAI upgrade overwrites the
 * script), injects it automatically.
 *
 * TRIGGER: SessionStart
 *
 * WHAT IT DOES:
 * 1. Reads statusline-command.sh
 * 2. Checks for the _USER_EXTENSIONS source block
 * 3. If missing and extensions.sh exists, injects:
 *    - Source line (after .env source)
 *    - Prefetch call (before parallel block end)
 *    - user-ext.sh source (after parallel results)
 *    - Display call (before git/pwd section)
 *
 * DESIGN: Idempotent — safe to run every session. No-ops if already present
 * or if no user extensions file exists.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const STATUSLINE_PATH = join(PAI_DIR, 'statusline-command.sh');
const EXTENSIONS_PATH = join(PAI_DIR, 'PAI/USER/STATUSLINE/extensions.sh');

const SOURCE_MARKER = '_USER_EXTENSIONS';
const PREFETCH_MARKER = 'user_statusline_prefetch';
const DISPLAY_MARKER = 'user_statusline_display';
const USER_EXT_SOURCE = 'user-ext.sh';

const ENV_SOURCE_LINE = '[ -f "${PAI_CONFIG_DIR:-$HOME/.config/PAI}/.env" ] && source "${PAI_CONFIG_DIR:-$HOME/.config/PAI}/.env"';

function main() {
  // No extensions file — nothing to wire
  if (!existsSync(EXTENSIONS_PATH)) {
    process.exit(0);
  }

  if (!existsSync(STATUSLINE_PATH)) {
    console.error('[StatuslineExtensions] statusline-command.sh not found');
    process.exit(0);
  }

  let content = readFileSync(STATUSLINE_PATH, 'utf-8');
  let modified = false;

  // 1. Check for source line
  if (!content.includes(SOURCE_MARKER)) {
    const envIdx = content.indexOf(ENV_SOURCE_LINE);
    if (envIdx === -1) {
      console.error('[StatuslineExtensions] Could not find .env source line to anchor injection');
      process.exit(0);
    }
    const insertAfter = envIdx + ENV_SOURCE_LINE.length;
    const injection = `\n\n# Source user statusline extensions (upgrade-safe customizations)\n_USER_EXTENSIONS="$PAI_DIR/PAI/USER/STATUSLINE/extensions.sh"\n[ -f "$_USER_EXTENSIONS" ] && source "$_USER_EXTENSIONS"`;
    content = content.slice(0, insertAfter) + injection + content.slice(insertAfter);
    modified = true;
    console.error('[StatuslineExtensions] Injected extensions source line');
  }

  // 2. Check for prefetch call in parallel block
  if (!content.includes(PREFETCH_MARKER)) {
    const parallelEnd = content.indexOf('# --- PARALLEL BLOCK END');
    if (parallelEnd !== -1) {
      const injection = `# User extensions prefetch\n{ type -t user_statusline_prefetch &>/dev/null && user_statusline_prefetch "$_parallel_tmp"; } &\n\n`;
      content = content.slice(0, parallelEnd) + injection + content.slice(parallelEnd);
      modified = true;
      console.error('[StatuslineExtensions] Injected prefetch call');
    }
  }

  // 3. Check for user-ext.sh source in parallel results
  if (!content.includes(USER_EXT_SOURCE)) {
    const lastSource = content.lastIndexOf('" ] && source "$_parallel_tmp/');
    if (lastSource !== -1) {
      const lineEnd = content.indexOf('\n', lastSource);
      const injection = `\n[ -f "$_parallel_tmp/user-ext.sh" ] && source "$_parallel_tmp/user-ext.sh"`;
      content = content.slice(0, lineEnd) + injection + content.slice(lineEnd);
      modified = true;
      console.error('[StatuslineExtensions] Injected user-ext.sh source');
    }
  }

  // 4. Check for display call
  if (!content.includes(DISPLAY_MARKER)) {
    const gitLine = content.indexOf('# LINE 4: PWD & GIT');
    if (gitLine !== -1) {
      const injection = `# ═══════════════════════════════════════════════════════════════════════════════\n# LINE: USER EXTENSIONS DISPLAY\n# ═══════════════════════════════════════════════════════════════════════════════\ntype -t user_statusline_display &>/dev/null && user_statusline_display\n\n`;
      content = content.slice(0, gitLine) + injection + content.slice(gitLine);
      modified = true;
      console.error('[StatuslineExtensions] Injected display call');
    }
  }

  if (modified) {
    writeFileSync(STATUSLINE_PATH, content);
    console.error('[StatuslineExtensions] statusline-command.sh patched successfully');
  }

  process.exit(0);
}

main();
