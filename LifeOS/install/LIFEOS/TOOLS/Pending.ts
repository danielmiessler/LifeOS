#!/usr/bin/env bun
/**
 * Pending.ts — "what is still open across all my work?"
 *
 * Reads every ISA under the roots Pursuit reads (task ISAs in MEMORY/WORK plus
 * the system ISAs) and reports, per ISA, open vs closed criteria, unchecked
 * Remaining Work items, phase, age and a group label, with a few generic
 * anomalies. Runs only when called; read-only, it never writes an ISA.
 *
 *   bun LIFEOS/TOOLS/Pending.ts [--json] [--root <dir>]... [--group-field <name>] [--idle-days <n>]
 *
 * Reuses, never copies: criteria come from IsaFrontier's parseClaims, the
 * default roots from Pursuit's isaDirs, and "closed" from Pursuit's isaClosed.
 * Optional config under the `pending` key of settings.json (Config/ConfigSystem.md):
 *   { "pending": { "roots": ["~/Projects"], "groupField": "project", "idleDays": 14 } }
 * Flags override settings; settings override defaults. Doc: Pending/PendingSystem.md.
 *
 * Proposed in discussion #2352 (@henrique-franze).
 *
 * @version 1.0.0
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'fs';
import { join } from 'path';
import { isaClosed, isaDirs } from '../IDEALSTATE/Pursuit';
import { parseClaims } from './IsaFrontier';
import { expandPath, getSettingsPath } from './Paths';

const ARTIFACT_FILENAME = 'ISA.md';
export const UNLABELED = 'unlabeled';
const DAY_MS = 86_400_000;

/** `phase: complete # note` → `complete`; a `#` inside quotes is kept. Same rule as isa-utils. */
function stripTrailingYamlComment(raw: string): string {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || raw[i - 1] === ' ' || raw[i - 1] === '\t')) return raw.slice(0, i).trimEnd();
  }
  return raw;
}

/** Flat top-level `key: value` frontmatter, trailing comments and quotes stripped. Expects LF input. */
function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (kv) fm[kv[1]] = stripTrailingYamlComment(kv[2].trim()).replace(/^["']|["']$/g, '');
  }
  return fm;
}

/** Unchecked `- [ ]` items in `## Remaining Work` (ISAFormat.md v2.19.0: the backlog is open criteria plus these). */
export function countRemaining(content: string): number {
  const m = /^##\s+Remaining Work\b[^\n]*$/im.exec(content);
  if (!m) return 0;
  const rest = content.slice(m.index + m[0].length);
  const end = rest.match(/\n(?:#{1,2}\s|---\s*(?:\n|$))/);
  let fenced = false;
  let n = 0;
  // Same section and fence rules as the criteria parser: `#`/`##` or `---` ends it, fenced lines are skipped.
  for (const l of (end ? rest.slice(0, end.index) : rest).split('\n')) {
    if (/^\s*(?:`{3,}|~{3,})/.test(l)) fenced = !fenced;
    else if (!fenced && /^\s*- \[ \]/.test(l)) n++;
  }
  return n;
}

export interface PendingConfig {
  roots: string[];
  groupField: string;
  idleDays: number;
}

export type AnomalyKind = 'closed_with_open_criteria' | 'idle_with_open_criteria' | 'unreadable' | 'no_frontmatter';

export interface Anomaly { path: string; kind: AnomalyKind; detail: string }

export interface IsaReport {
  path: string;
  group: string;
  phase: string;
  open: number;
  closed: number;
  dropped: number;
  updated: string | null;
  ageDays: number | null;
  remaining: number;
}

export interface PendingReport {
  generatedAt: string;
  config: PendingConfig;
  missingRoots: string[];
  totals: { isas: number; open: number; closed: number; remaining: number };
  groups: { group: string; isas: number; open: number; closed: number; remaining: number }[];
  isas: IsaReport[];
  anomalies: Anomaly[];
}

export function loadConfig(settingsPath = getSettingsPath()): PendingConfig {
  let cfg: Record<string, unknown> = {};
  try { cfg = JSON.parse(readFileSync(settingsPath, 'utf-8')).pending ?? {}; } catch { /* no settings: defaults */ }
  const roots = Array.isArray(cfg.roots) && cfg.roots.length ? cfg.roots.map(String) : isaDirs();
  return {
    roots: roots.map(expandPath),
    groupField: typeof cfg.groupField === 'string' && cfg.groupField ? cfg.groupField : 'project',
    idleDays: typeof cfg.idleDays === 'number' && cfg.idleDays > 0 ? cfg.idleDays : 14,
  };
}

/** `<root>/<child>/ISA.md`, one level deep: the same shape Pursuit's liveIsas reads. */
function findIsas(root: string): string[] {
  let names: string[];
  try { names = readdirSync(root).sort(); } catch { return []; }
  return names.map((d) => join(root, d, ARTIFACT_FILENAME)).filter((p) => existsSync(p));
}

export function scan(config: PendingConfig, now = new Date()): PendingReport {
  const isas: IsaReport[] = [];
  const anomalies: Anomaly[] = [];
  const missingRoots: string[] = [];
  const seen = new Set<string>();

  for (const root of config.roots) {
    if (!existsSync(root)) { missingRoots.push(root); continue; }
    for (const path of findIsas(root)) {
      let key = path;
      try { key = realpathSync(path); } catch { /* unreadable below */ }
      if (seen.has(key)) continue;
      seen.add(key);
      let content: string;
      try { content = readFileSync(path, 'utf-8').replace(/\r\n?/g, '\n'); } catch (err) {
        anomalies.push({ path, kind: 'unreadable', detail: (err as Error).message });
        continue;
      }
      const fm = parseFrontmatter(content);
      if (!fm) anomalies.push({ path, kind: 'no_frontmatter', detail: 'no YAML frontmatter block' });

      // parseClaims keeps parent nodes for dependency edges; a parent with nested
      // children is verified through them, so only leaves are counted (as IsaClaims does).
      const all = parseClaims(content);
      const criteria = all.filter((c, i) => !(all[i + 1] && all[i + 1].indent > c.indent));
      const dropped = criteria.filter((c) => c.dropped).length;
      const open = criteria.filter((c) => !c.checked && !c.dropped).length;
      const closed = criteria.filter((c) => c.checked && !c.dropped).length;
      const remaining = countRemaining(content);
      const owed = open + remaining;
      const phase = (fm?.phase || 'unknown').toLowerCase();

      // `updated` frontmatter wins; file mtime is the fallback for ISAs that omit it.
      const parsed = fm?.updated ? Date.parse(fm.updated) : NaN;
      const updatedMs = Number.isNaN(parsed) ? statSync(path).mtimeMs : parsed;
      const ageDays = Math.max(0, Math.floor((now.getTime() - updatedMs) / DAY_MS));

      const owes = `${open} open ${open === 1 ? 'criterion' : 'criteria'}, ${remaining} remaining-work item(s)`;
      if (owed > 0 && isaClosed(phase)) {
        anomalies.push({ path, kind: 'closed_with_open_criteria', detail: `phase is ${phase} with ${owes}` });
      } else if (owed > 0 && ageDays > config.idleDays) {
        anomalies.push({ path, kind: 'idle_with_open_criteria', detail: `${owes}, idle ${ageDays} days (limit ${config.idleDays})` });
      }

      isas.push({
        path,
        group: fm?.[config.groupField] || UNLABELED,
        phase, open, closed, dropped,
        updated: new Date(updatedMs).toISOString(),
        ageDays,
        remaining,
      });
    }
  }

  const byGroup = new Map<string, { group: string; isas: number; open: number; closed: number; remaining: number }>();
  for (const i of isas) {
    const g = byGroup.get(i.group) ?? { group: i.group, isas: 0, open: 0, closed: 0, remaining: 0 };
    g.isas++; g.open += i.open; g.closed += i.closed; g.remaining += i.remaining;
    byGroup.set(i.group, g);
  }
  const sum = (k: 'open' | 'closed' | 'remaining') => isas.reduce((s, i) => s + i[k], 0);
  return {
    generatedAt: now.toISOString(),
    config,
    missingRoots,
    totals: { isas: isas.length, open: sum('open'), closed: sum('closed'), remaining: sum('remaining') },
    groups: [...byGroup.values()].sort((a, b) => b.open + b.remaining - (a.open + a.remaining) || a.group.localeCompare(b.group)),
    isas,
    anomalies,
  };
}

export function formatHuman(r: PendingReport): string {
  const lines = [`Pending: ${r.totals.open} open / ${r.totals.closed} closed criteria, ${r.totals.remaining} remaining-work item(s), across ${r.totals.isas} ISA(s)`];
  for (const root of r.missingRoots) lines.push(`  ! root not found: ${root}`);
  for (const g of r.groups) {
    lines.push('', `${g.group}  (${g.open} open, ${g.closed} closed, ${g.remaining} remaining)`);
    for (const i of r.isas.filter((x) => x.group === g.group).sort((a, b) => b.open - a.open)) {
      lines.push(`  ${String(i.open).padStart(3)} open ${String(i.closed).padStart(3)} closed ${String(i.remaining).padStart(3)} remaining  ${i.phase.padEnd(10)} ${String(i.ageDays).padStart(4)}d  ${i.path}`);
    }
  }
  if (r.anomalies.length) {
    lines.push('', 'Anomalies');
    for (const a of r.anomalies) lines.push(`  [${a.kind}] ${a.path} — ${a.detail}`);
  }
  return lines.join('\n');
}

export const USAGE = `Usage: bun LIFEOS/TOOLS/Pending.ts [--json] [--root <dir>]... [--group-field <name>] [--idle-days <n>]

Lists open vs closed criteria (and unchecked Remaining Work items) across ISAs.
Default roots are Pursuit's: MEMORY/WORK plus the system ISAs.
Read-only. Exit 0 on a completed scan, 2 on a bad argument.

  --json               stable machine-readable output
  --root <dir>         directory whose <child>/ISA.md files are read (repeatable; replaces the default roots)
  --group-field <name> frontmatter field used as group label (default: project)
  --idle-days <n>      flag open ISAs idle for more than n days (default: 14)
  -h, --help           show this help
`;

export function parseArgs(argv: string[], base: PendingConfig): { config: PendingConfig; json: boolean } {
  const config = { ...base };
  const roots: string[] = [];
  let json = false;
  const value = (flag: string, i: number): string => {
    const v = argv[i + 1];
    if (v === undefined || v === '' || v.startsWith('--')) throw new Error(`${flag} requires a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--root') roots.push(expandPath(value(a, i++)));
    else if (a === '--group-field') config.groupField = value(a, i++);
    else if (a === '--idle-days') {
      const raw = value(a, i++);
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`--idle-days requires a positive number, got: ${raw}`);
      config.idleDays = n;
    } else throw new Error(`unknown argument: ${a}`);
  }
  if (roots.length) config.roots = roots;
  return { config, json };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }
  try {
    const { config, json } = parseArgs(args, loadConfig());
    const report = scan(config);
    console.log(json ? JSON.stringify(report, null, 2) : formatHuman(report));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
  }
}
