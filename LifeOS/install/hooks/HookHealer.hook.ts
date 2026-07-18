#!/usr/bin/env bun
/**
 * @version 1.0.2
 * HookHealer.hook.ts - Self-healing for the registered-script exec-bit class
 *
 * PURPOSE:
 * The Write tool creates files mode 0644. A hook registered in settings as a
 * direct-exec command ("$HOME/.claude/hooks/X.hook.ts") then fails every
 * invocation with "/bin/sh: Permission denied" until someone notices.
 * This hook detects and repairs that class automatically.
 *
 * MODES:
 * - (default)  SessionStart sweep: every script directly executed by a
 *              settings hook command (first token of each command segment)
 *              must exist and be executable. Missing exec bit -> chmod +x.
 *              Missing file / missing shebang -> surfaced warning only.
 * - --posttool PostToolUse(Write|Edit) ingestion guard: a written file under
 *              ~/.claude whose content starts with "#!" gets its exec bit
 *              immediately - heals at the ingestion point.
 *
 * SAFETY:
 * - chmod containment: only ever touches paths under ~/.claude
 * - non-blocking: exits 0 on every path, including internal errors
 * - registered via "bun <path>" so it is immune to losing its own exec bit
 *
 * OUTPUTS:
 * - MEMORY/OBSERVABILITY/hook-healer.jsonl (heal/warning events)
 * - stdout "🩹 HookHealer: ..." line when something was healed or needs attention
 *
 * PERFORMANCE: <50ms (two JSON reads + stat per registered path)
 */

import {
  existsSync, readFileSync, chmodSync, statSync, appendFileSync,
  mkdirSync, openSync, readSync, closeSync, realpathSync,
} from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getClaudeDir } from "./lib/paths";

const CLAUDE_DIR = join(getClaudeDir());
const OBS_DIR = join(CLAUDE_DIR, 'LIFEOS', 'MEMORY', 'OBSERVABILITY');
const LOG_FILE = join(OBS_DIR, 'hook-healer.jsonl');
const SETTINGS_FILES = ['settings.json', 'settings.local.json'];

function log(event: Record<string, unknown>): void {
  try {
    if (!existsSync(OBS_DIR)) mkdirSync(OBS_DIR, { recursive: true });
    appendFileSync(LOG_FILE, JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n', 'utf-8');
  } catch {
    // Observability must never break healing
  }
}

function isExecutable(p: string): boolean {
  try { return (statSync(p).mode & 0o111) !== 0; } catch { return false; }
}

function hasShebang(p: string): boolean {
  try {
    const fd = openSync(p, 'r');
    const buf = Buffer.alloc(2);
    readSync(fd, buf, 0, 2, 0);
    closeSync(fd);
    return buf.toString('utf-8') === '#!';
  } catch { return false; }
}

/**
 * chmod +x with containment: only paths whose RESOLVED target lives under
 * ~/.claude (chmod follows symlinks — a link inside pointing outside must
 * never be healed), only when needed.
 */
function heal(p: string, source: string): boolean {
  if (!p.startsWith(CLAUDE_DIR + '/')) return false;
  if (!existsSync(p) || isExecutable(p)) return false;
  try {
    const realClaudeDir = realpathSync(CLAUDE_DIR);
    const real = realpathSync(p);
    if (!real.startsWith(realClaudeDir + '/')) {
      log({ event: 'containment-refused', path: p, resolved: real, source });
      return false;
    }
    chmodSync(real, statSync(real).mode | 0o111);
    log({ event: 'healed', path: real, source });
    console.error(`[HookHealer] chmod +x ${real}`);
    return true;
  } catch (err) {
    log({ event: 'heal-failed', path: p, source, error: String(err) });
    return false;
  }
}

function expandHome(token: string): string {
  return token.replace(/^\$HOME/, homedir()).replace(/^~(?=\/)/, homedir());
}

/**
 * Collect scripts that settings hook commands execute DIRECTLY (first token
 * of each command segment). Scripts passed as arguments to bun/sh are
 * deliberately excluded - their exec bit is irrelevant.
 */
function directExecPaths(): Set<string> {
  const paths = new Set<string>();
  for (const name of SETTINGS_FILES) {
    const file = join(CLAUDE_DIR, name);
    if (!existsSync(file)) continue;
    let parsed: { hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
    try {
      parsed = JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      log({ event: 'settings-parse-failed', file });
      continue;
    }
    for (const groups of Object.values(parsed.hooks ?? {})) {
      for (const group of groups) {
        for (const hook of group?.hooks ?? []) {
          const cmd = hook?.command ?? '';
          for (const segment of cmd.split(/;|&&|\|\|/)) {
            const first = segment.trim().split(/\s+/)[0] ?? '';
            const p = expandHome(first);
            if (/\.(ts|js|sh)$/.test(p) && p.startsWith(CLAUDE_DIR + '/')) paths.add(p);
          }
        }
      }
    }
  }
  return paths;
}

function sweep(): void {
  const healed: string[] = [];
  const warnings: string[] = [];
  for (const p of [...directExecPaths()].sort()) {
    if (!existsSync(p)) {
      warnings.push(`missing: ${p}`);
      log({ event: 'missing', path: p, source: 'sweep' });
      continue;
    }
    if (!hasShebang(p)) {
      warnings.push(`no shebang: ${p}`);
      log({ event: 'no-shebang', path: p, source: 'sweep' });
    }
    if (heal(p, 'sweep')) healed.push(p);
  }
  if (healed.length > 0 || warnings.length > 0) {
    const short = (s: string) => s.replace(CLAUDE_DIR + '/', '');
    const parts: string[] = [];
    if (healed.length > 0) parts.push(`healed (chmod +x): ${healed.map(short).join(', ')}`);
    if (warnings.length > 0) parts.push(`needs attention: ${warnings.map(short).join('; ')}`);
    console.log(`🩹 HookHealer: ${parts.join(' | ')}`);
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), 2000);
    process.stdin.on('data', (chunk) => { data += chunk.toString(); });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data); });
  });
}

async function posttool(): Promise<void> {
  const input = await readStdin();
  if (!input.trim()) return;
  let data: { tool_input?: { file_path?: string } };
  try { data = JSON.parse(input); } catch { return; }
  const fp = data?.tool_input?.file_path;
  if (typeof fp !== 'string') return;
  if (!fp.startsWith(CLAUDE_DIR + '/')) return;
  if (existsSync(fp) && hasShebang(fp) && !isExecutable(fp)) heal(fp, 'posttool');
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes('--posttool')) {
      await posttool();
    } else {
      sweep();
    }
  } catch (err) {
    log({ event: 'internal-error', error: String(err) });
    console.error(`[HookHealer] Error: ${err}`);
  }
  process.exit(0);
}

main();
