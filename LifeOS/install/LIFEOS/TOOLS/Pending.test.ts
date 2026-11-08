import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { isaDirs } from '../IDEALSTATE/Pursuit';
import { UNLABELED, formatHuman, loadConfig, parseArgs, scan, type PendingConfig } from './Pending';

const NOW = new Date('2030-06-01T00:00:00Z');
let root: string;

function isa(name: string, fm: string | null, claims: string[]): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const head = fm === null ? '' : `---\n${fm}\n---\n`;
  const path = join(dir, 'ISA.md');
  writeFileSync(path, `${head}# Title\n\n## Claims\n\n${claims.join('\n')}\n\n## Decisions\n`);
  return path;
}
const cfg = (over: Partial<PendingConfig> = {}): PendingConfig => ({ roots: [root], groupField: 'project', idleDays: 14, ...over });

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pending-'));
  isa('a', 'phase: climbing\nproject: alpha\nupdated: 2030-05-30T00:00:00Z', ['- [x] ISC-1: done', '- [ ] ISC-2: todo', '- [ ] ISC-3: todo too', '- [ ] ISC-4: [DROPPED] gone']);
  isa('b', 'phase: complete\nproject: alpha\nupdated: 2030-05-31T00:00:00Z', ['- [x] ISC-1: done', '- [ ] ISC-2: forgotten']);
  isa('c', 'phase: climbing\nupdated: 2030-01-01T00:00:00Z', ['- [ ] ISC-1: stale']);
  isa('d', null, ['- [x] ISC-1: done']);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('Pending', () => {
  let r: ReturnType<typeof scan>;
  beforeAll(() => { r = scan(cfg(), NOW); });
  const by = (n: string) => r.isas.find((i) => i.path === join(root, n, 'ISA.md'))!;

  test('counts open, closed and dropped criteria', () => {
    expect(by('a')).toMatchObject({ open: 2, closed: 1, dropped: 1, remaining: 0, phase: 'climbing', ageDays: 2 });
    expect(r.totals).toEqual({ isas: 4, open: 4, closed: 3, remaining: 0 });
  });

  test('a closed phase with open criteria is an anomaly', () => {
    expect(r.anomalies.filter((a) => a.kind === 'closed_with_open_criteria').map((a) => a.path)).toEqual([by('b').path]);
  });

  test.each(['complete', 'learn', 'abandoned', 'Archived'])('phase %s counts as closed, using Pursuit\'s isaClosed', (phase) => {
    const i = one(`closed-${phase}`, `---\nphase: ${phase}\nupdated: 2030-05-30T00:00:00Z\n---\n## Criteria\n\n- [ ] ISC-1: open\n`);
    const rep = scan(cfg({ roots: [join(root, 'raw', `closed-${phase}`)] }), NOW);
    expect(rep.anomalies.map((a) => a.kind)).toEqual(['closed_with_open_criteria']);
    expect(i.phase).toBe(phase.toLowerCase());
  });

  test('idle ISA with open criteria is an anomaly; recent and closed ones are not', () => {
    const idle = r.anomalies.filter((a) => a.kind === 'idle_with_open_criteria');
    expect(idle.map((a) => a.path)).toEqual([by('c').path]);
    expect(idle.map((a) => a.path)).not.toContain(by('a').path); // recent
    expect(idle.map((a) => a.path)).not.toContain(by('b').path); // closed
    expect(scan(cfg({ idleDays: 400 }), NOW).anomalies.some((a) => a.kind === 'idle_with_open_criteria')).toBe(false);
  });

  test('missing group field falls into "unlabeled"; field name is configurable', () => {
    expect(by('c').group).toBe(UNLABELED);
    expect(by('a').group).toBe('alpha');
    expect(scan(cfg({ groupField: 'phase' }), NOW).groups.map((g) => g.group).sort()).toEqual(['climbing', 'complete', UNLABELED].sort());
  });

  test('ISA without frontmatter is flagged and still counted, using file mtime for age', () => {
    expect(r.anomalies.some((a) => a.kind === 'no_frontmatter' && a.path === by('d').path)).toBe(true);
    expect(by('d')).toMatchObject({ phase: 'unknown', group: UNLABELED, open: 0, closed: 1 });
    const old = new Date('2030-04-01T00:00:00Z');
    utimesSync(by('d').path, old, old);
    expect(scan(cfg(), NOW).isas.find((i) => i.path === by('d').path)!.ageDays).toBe(61);
  });

  test('unreadable ISA is flagged, not fatal', () => {
    if (process.getuid?.() === 0) return;
    const p = isa('e', 'phase: climbing', ['- [ ] ISC-1: x']);
    chmodSync(p, 0o000);
    const rep = scan(cfg(), NOW);
    chmodSync(p, 0o644);
    expect(rep.anomalies.some((a) => a.kind === 'unreadable' && a.path === p)).toBe(true);
  });

  test('nonexistent root is reported, not thrown', () => {
    const rep = scan(cfg({ roots: [join(root, 'nope')] }), NOW);
    expect(rep.missingRoots).toEqual([join(root, 'nope')]);
    expect(rep.isas).toEqual([]);
  });

  test('--json shape is stable', () => {
    const { config, json } = parseArgs(['--json', '--root', root, '--idle-days', '30'], cfg());
    expect(json).toBe(true);
    expect(config.idleDays).toBe(30);
    const out = JSON.parse(JSON.stringify(scan(config, NOW)));
    expect(Object.keys(out)).toEqual(['generatedAt', 'config', 'missingRoots', 'totals', 'groups', 'isas', 'anomalies']);
    expect(Object.keys(out.isas[0])).toEqual(['path', 'group', 'phase', 'open', 'closed', 'dropped', 'updated', 'ageDays', 'remaining']);
    expect(Object.keys(out.groups[0])).toEqual(['group', 'isas', 'open', 'closed', 'remaining']);
    expect(Object.keys(out.totals)).toEqual(['isas', 'open', 'closed', 'remaining']);
    expect(Object.keys(out.anomalies[0])).toEqual(['path', 'kind', 'detail']);
  });

  test('settings.json `pending` block is read; absent file yields defaults with Pursuit\'s roots', () => {
    const sp = join(root, 'settings.json');
    writeFileSync(sp, JSON.stringify({ pending: { roots: [root], groupField: 'team', idleDays: 3 } }));
    expect(loadConfig(sp)).toEqual({ roots: [root], groupField: 'team', idleDays: 3 });
    expect(loadConfig(join(root, 'absent.json'))).toEqual({ roots: isaDirs(), groupField: 'project', idleDays: 14 });
  });
});

// ── Fixtures written as raw content (heading variants, CRLF, fences, ...) ──
function raw(name: string, content: string): string {
  const dir = join(root, 'raw', name, 'isa'); // <root>/<child>/ISA.md, the shape scan() reads
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'ISA.md');
  writeFileSync(path, content);
  return path;
}
const one = (name: string, content: string) => {
  const p = raw(name, content);
  return scan(cfg({ roots: [join(root, 'raw', name)] }), NOW).isas.find((i) => i.path === p)!;
};
const FM = '---\nphase: climbing\nupdated: 2030-05-30T00:00:00Z\n---\n';

describe('Pending criteria parsing (parseClaims)', () => {
  test.each(['## Claims', '## Criteria', '## ISC Criteria', '## Features'])('heading variant %s is recognised', (h) => {
    const i = one(`h-${h.replace(/\W+/g, '')}`, `${FM}# T\n\n${h}\n\n- [x] ISC-1: a\n- [ ] ISC-2: b\n\n## Decisions\n`);
    expect([i.open, i.closed]).toEqual([1, 1]);
  });

  test('a parent with nested children is counted through its leaves; [DEFERRED-VERIFY] counts as open', () => {
    const i = one('nested', `${FM}## Criteria\n\n- [ ] ISC-1: parent\n  - [x] ISC-1.1: leaf done\n  - [ ] ISC-1.2: leaf open\n- [ ] ISC-2: [DEFERRED-VERIFY] needs prod\n`);
    expect([i.open, i.closed, i.dropped]).toEqual([2, 1, 0]);
  });

  test('a fully closed split ISA is closed, with no anomaly', () => {
    const p = raw('split', `---\nphase: complete\nupdated: 2030-05-30T00:00:00Z\n---\n## Criteria\n\n- [ ] ISC-1: [container] parent\n  - [x] ISC-1.1: a\n  - [x] ISC-1.2: b\n- [ ] ISC-2: plain parent\n  - [x] ISC-2.1: c\n`);
    const rep = scan(cfg({ roots: [join(root, 'raw', 'split')] }), NOW);
    expect(rep.isas.find((i) => i.path === p)).toMatchObject({ open: 0, closed: 3 });
    expect(rep.anomalies).toEqual([]);
  });

  test('## Anti-criteria and ## Bridge Criteria are read like criteria', () => {
    const i = one('anti-bridge', `${FM}## Criteria\n\n- [x] ISC-1: a\n\n## Anti-criteria\n\n- [ ] ISC-A1: must not happen\n\n## Bridge Criteria\n\n- [x] ISC-3: Bridge: holds\n`);
    expect([i.open, i.closed]).toEqual([1, 2]);
  });

  test('checkboxes inside code fences are not criteria', () => {
    const i = one('fence', `${FM}## Criteria\n\n- [ ] ISC-1: real\n\n\`\`\`\n- [ ] ISC-2: in a fence\n\`\`\`\n`);
    expect(i.open).toBe(1);
  });

  test('table rows with an ID are criteria; a passed status cell closes one', () => {
    const i = one('table', `${FM}## Criteria\n\n| id | criterion | status |\n|---|---|---|\n| ISC-1 | a | passed |\n| ISC-2 | b | open |\n`);
    expect([i.open, i.closed]).toEqual([1, 1]);
  });

  test('sections outside the criteria sections are not read', () => {
    const i = one('outside', `${FM}## Problem\n\n- [ ] ISC-9: not a criterion here\n\n## Criteria\n\n- [ ] ISC-1: a\n\n## Decisions\n\n- [ ] ISC-8: nor here\n`);
    expect(i.open).toBe(1);
  });

  test('a checked claim carrying [DROPPED] is dropped, not closed', () => {
    const i = one('dropped-checked', `${FM}## Claims\n\n- [x] ISC-1: [DROPPED] superseded\n- [x] ISC-2: done\n`);
    expect([i.open, i.closed, i.dropped]).toEqual([0, 1, 1]);
  });

  test('trailing YAML comments are stripped like isa-utils; # inside quotes is kept', () => {
    const i = one('fm-comment', `---\nphase: complete   # REQUIRED\nproject: "fix #12" # note\nupdated: 2030-05-30T00:00:00Z\n---\n## Claims\n\n- [ ] ISC-1: open\n`);
    expect(i).toMatchObject({ phase: 'complete', group: 'fix #12' });
  });

  test('CRLF files parse like LF files, frontmatter included', () => {
    const lf = `---\nphase: complete\nproject: crlf\nupdated: 2030-05-30T00:00:00Z\n---\n## Claims\n\n- [x] ISC-1: a\n- [ ] ISC-2: b\n\n## Remaining Work\n\n- [ ] follow-up\n`;
    const i = one('crlf', lf.replace(/\n/g, '\r\n'));
    expect(i).toMatchObject({ open: 1, closed: 1, remaining: 1, phase: 'complete', group: 'crlf' });
  });

  test('Remaining Work skips fenced items and ends at a # heading or ---', () => {
    const i = one('remaining-fence', `${FM}## Criteria\n\n- [x] ISC-1: a\n\n## Remaining Work\n\n- [ ] real\n\n\`\`\`\n- [ ] in a fence\n\`\`\`\n\n### sub\n\n- [ ] under a subheading\n\n---\n\n- [ ] after a rule\n`);
    expect(i.remaining).toBe(2);
  });

  test('indented frontmatter keys do not override top-level ones', () => {
    const i = one('fm-nested', `---\nphase: build\nmeta:\n  phase: complete\nupdated: 2030-05-30T00:00:00Z\n---\n## Criteria\n\n- [ ] ISC-1: open\n`);
    expect(i.phase).toBe('build');
  });

  test('Remaining Work unchecked items are a separate field and keep ISAs "open"', () => {
    const p = raw('remaining', `---\nphase: complete\nupdated: 2030-05-30T00:00:00Z\n---\n## Claims\n\n- [x] ISC-1: a\n\n## Remaining Work\n\n- [ ] one\n- [x] done already\n- [ ] two\n\n## Decisions\n\n- [ ] not remaining work\n`);
    const rep = scan(cfg({ roots: [join(root, 'raw', 'remaining')] }), NOW);
    expect(rep.isas[0]).toMatchObject({ open: 0, closed: 1, remaining: 2 });
    expect(rep.totals.remaining).toBe(2);
    expect(rep.groups[0].remaining).toBe(2);
    expect(rep.anomalies.map((a) => [a.kind, a.path])).toEqual([['closed_with_open_criteria', p]]);
    const idle = raw('remaining-idle', `---\nphase: climbing\nupdated: 2030-01-01T00:00:00Z\n---\n## Claims\n\n- [x] ISC-1: a\n\n## Remaining Work\n\n- [ ] one\n`);
    expect(scan(cfg({ roots: [join(root, 'raw', 'remaining-idle')] }), NOW).anomalies.map((a) => [a.kind, a.path])).toEqual([['idle_with_open_criteria', idle]]);
  });
});

describe('Pending traversal and output', () => {
  test('reads <root>/<child>/ISA.md one level deep, like Pursuit; a deeper ISA is not counted', () => {
    const base = mkdtempSync(join(tmpdir(), 'pending-depth-'));
    try {
      mkdirSync(join(base, 'task', 'nested'), { recursive: true });
      writeFileSync(join(base, 'task', 'ISA.md'), `${FM}## Criteria\n\n- [ ] ISC-1: x\n`);
      writeFileSync(join(base, 'task', 'nested', 'ISA.md'), `${FM}## Criteria\n\n- [ ] ISC-1: y\n`);
      writeFileSync(join(base, 'ISA.md'), `${FM}## Criteria\n\n- [ ] ISC-1: z\n`);
      const rep = scan(cfg({ roots: [base] }), NOW);
      expect(rep.isas.map((i) => i.path)).toEqual([join(base, 'task', 'ISA.md')]);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('one ISA reached through two roots or a symlink is reported once', () => {
    const base = mkdtempSync(join(tmpdir(), 'pending-sym-'));
    try {
      mkdirSync(join(base, 'real', 'proj'), { recursive: true });
      writeFileSync(join(base, 'real', 'proj', 'ISA.md'), `${FM}## Criteria\n\n- [ ] ISC-1: x\n`);
      mkdirSync(join(base, 'scan'));
      symlinkSync(join(base, 'real', 'proj'), join(base, 'scan', 'linked'));
      const rep = scan(cfg({ roots: [join(base, 'scan'), join(base, 'real')] }), NOW);
      expect(rep.isas.length).toBe(1);
      expect(rep.isas[0].open).toBe(1);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('human output shows totals, group headers, per-ISA counts and anomalies', () => {
    const out = formatHuman(scan(cfg(), NOW));
    expect(out).toContain('Pending:');
    expect(out).toContain('alpha  (');
    expect(out).toContain('remaining');
    expect(out).toContain('Anomalies');
    expect(out).toContain('[closed_with_open_criteria]');
    expect(out).toContain('criteria');
    expect(out).not.toMatch(/claim/i);
  });
});

describe('Pending CLI', () => {
  const cli = join(import.meta.dir, 'Pending.ts');
  // An empty config root: no settings.json, and LIFEOS resolves under it (CLAUDE_CONFIG_DIR outranks LIFEOS_DIR in Paths.ts).
  const configRoot = () => join(root, 'claude-none');
  const lifeos = () => join(configRoot(), 'LIFEOS');
  const env = () => {
    const e: Record<string, string | undefined> = { ...process.env, CLAUDE_CONFIG_DIR: configRoot() };
    for (const k of ['IDEALSTATE_ISA_DIR', 'LIFEOS_DIR', 'LIFEOS_SKILLS_DIR', 'CLAUDE_PLUGIN_ROOT']) delete e[k];
    return e;
  };
  const run = (...args: string[]) => Bun.spawnSync(['bun', cli, ...args], { env: env() });
  const err = (r: ReturnType<typeof run>) => r.stderr.toString();

  test('--help and -h print usage and exit 0', () => {
    for (const f of ['--help', '-h']) {
      const r = run(f);
      expect(r.exitCode).toBe(0);
      expect(r.stdout.toString()).toContain('Usage: bun LIFEOS/TOOLS/Pending.ts');
    }
  });

  test('a completed scan exits 0 and --json parses', () => {
    const r = run('--json', '--root', root);
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout.toString()).totals.isas).toBeGreaterThan(0);
  });

  test('with no --root and no settings, the roots are Pursuit\'s: MEMORY/WORK plus the LIFEOS dir for system ISAs', () => {
    const r = run('--json');
    expect(r.exitCode).toBe(0);
    expect(JSON.parse(r.stdout.toString()).config.roots).toEqual([join(lifeos(), 'MEMORY', 'WORK'), lifeos()]);
  });

  test.each([
    [['--idle-days'], '--idle-days requires a value'],
    [['--idle-days', 'abc'], '--idle-days requires a positive number'],
    [['--idle-days', '0'], '--idle-days requires a positive number'],
    [['--idle-days', '--json'], '--idle-days requires a value'],
    [['--root'], '--root requires a value'],
    [['--group-field'], '--group-field requires a value'],
    [['--nope'], 'unknown argument: --nope'],
  ])('bad argument %j exits 2 with a message on stderr', (args, msg) => {
    const r = run(...args);
    expect(r.exitCode).toBe(2);
    expect(err(r)).toContain(msg);
    expect(r.stdout.toString()).toBe('');
  });
});
