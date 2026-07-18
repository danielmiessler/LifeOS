#!/usr/bin/env bun
/**
 * IntegrityCheck.ts — Full-system integrity orchestrator for the LifeOS system.
 *
 * The deterministic backbone behind `/ic`. Runs one fast pass across every
 * LifeOS surface and emits a single consolidated report + a single exit code:
 *
 *   1. references       — every file reference resolves (delegates to ReferenceCheck.ts;
 *                          covers docs, hooks, skills, CLAUDE.md, workflows — the whole tree)
 *   2. version_anchors  — every Algorithm spec-file ref in DOCUMENTATION points at LATEST
 *   3. hook_registration— settings.json and the hooks directory agree (bidirectional)
 *   4. claude_imports   — every @-import in every CLAUDE.md resolves
 *   5. skills           — every skill's SKILL.md has name+description frontmatter
 *   6. workflows        — every skill workflow file is referenced by its SKILL.md
 *
 * This is an ORCHESTRATOR. It does NOT re-implement ReferenceCheck's tree-walk —
 * it shells out to it. The expensive 12-agent deep audit is NOT run here; `--deep`
 * only prints how to run it (agents are the workflow's job, not this tool's).
 *
 * Usage:
 *   bun IntegrityCheck.ts              # human report, all checks
 *   bun IntegrityCheck.ts --json       # structured JSON
 *   bun IntegrityCheck.ts --quiet      # findings only (suppress OK lines)
 *   bun IntegrityCheck.ts --deep       # append the deep-audit invocation hint
 *   bun IntegrityCheck.ts --help
 *
 * Exit codes:
 *   0 — no blocking findings (stale/orphan/unregistered/orphan-workflow are non-blocking)
 *   1 — ≥1 blocking finding (missing ref, anchor drift, missing hook file, broken @-import, bad skill frontmatter)
 *   2 — scan error
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { claudeDir } from "./lifeos-root";

const HOME = process.env.HOME || '';
const CLAUDE_DIR = join(claudeDir());
const LIFEOS_DIR = join(CLAUDE_DIR, 'LIFEOS');
const TOOLS_DIR = join(LIFEOS_DIR, 'TOOLS');
const DOC_DIR = join(LIFEOS_DIR, 'DOCUMENTATION');

// ── Arg parsing (manual, zero deps — llcli style) ──
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`IntegrityCheck — full-system integrity orchestrator (the /ic backbone)

Usage: bun IntegrityCheck.ts [flags]

Flags:
  --json     Structured JSON output
  --quiet    Suppress OK lines; findings only
  --deep     Print how to run the 12-agent deep audit (does not run agents)
  --help     This message

Checks: references, version_anchors, hook_registration, claude_imports, skills, workflows
Exit codes: 0 clean, 1 blocking findings, 2 scan error`);
  process.exit(0);
}
const jsonOutput = args.includes('--json');
const quiet = args.includes('--quiet');
const deep = args.includes('--deep');
const verbose = args.includes('--verbose');

// ── Result model ──
interface Finding {
  detail: string;
  blocking: boolean;
}
interface CheckResult {
  name: string;
  ok: boolean;            // true when no blocking findings
  blockingCount: number;
  infoCount: number;
  findings: Finding[];
  note?: string;          // one-line summary for the human report
}
const checks: CheckResult[] = [];

// Scan errors are distinct from blocking findings: a scan error means a check could NOT
// run (missing dependency, unreadable source of truth) — the tool malfunctioned, not the
// system. Any scan error forces exit 2, never exit 1. This keeps the 0/1/2 contract honest:
// a real scan failure must never look like a clean-but-blocking result. (Forge audit 2026-07-06.)
const scanErrors: string[] = [];
function scanError(msg: string): void { scanErrors.push(msg); }

function record(name: string, findings: Finding[], note?: string): void {
  const blockingCount = findings.filter(f => f.blocking).length;
  const infoCount = findings.length - blockingCount;
  checks.push({ name, ok: blockingCount === 0, blockingCount, infoCount, findings, note });
}

// ── helpers ──
// Enumerate files via `find` (guaranteed-available, recurses at any depth, no reimplemented
// tree walker). `extraArgs` are appended to the base `find <root>` invocation.
// install-payload copies and build/cache noise are pruned so counts reflect the LIVE system.
function findFiles(root: string, extraArgs: string[]): string[] {
  try {
    const out = execFileSync('find', [
      root,
      '(', '-path', '*/node_modules', '-o', '-path', '*/.git', '-o', '-path', '*/install',
      '-o', '-path', '*/LIFEOS_RELEASES', '-o', '-path', '*/Backups', '-o', '-path', '*/Archive',
      '-o', '-path', '*/dist', '-o', '-path', '*/.next', ')', '-prune', '-o',
      ...extraArgs, '-print',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return out.split('\n').filter(Boolean);
  } catch { return []; }
}

// ── Check 1: references (delegate to ReferenceCheck.ts) ──
function checkReferences(): void {
  const findings: Finding[] = [];
  let note = '';
  try {
    const rcPath = join(TOOLS_DIR, 'ReferenceCheck.ts');
    let raw = '';
    try {
      raw = execFileSync('bun', [rcPath, '--json', '--stale', '--orphans'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e: any) {
      // ReferenceCheck exits 1 when missing refs exist — stdout still holds the JSON
      raw = e.stdout?.toString() || '';
      if (!raw) throw e;
    }
    const rc = JSON.parse(raw);
    const s = rc.summary || {};
    note = `${rc.scannedRefs ?? '?'} refs across ${rc.scannedFiles ?? '?'} files: ${s.missing ?? 0} missing, ${s.stale ?? 0} stale, ${s.orphan ?? 0} orphan`;
    for (const f of rc.findings || []) {
      const isMissing = (f.kind || f.type) === 'missing';
      findings.push({
        detail: `${f.kind || f.type}: ${f.ref ?? f.reference ?? ''} in ${f.file ?? f.referrer ?? '?'}`,
        blocking: isMissing,
      });
    }
  } catch (e: any) {
    // Delegation failure = the check could not RUN (ReferenceCheck missing/unparseable output).
    // That is a scan error (exit 2), NOT a blocking finding (exit 1) — never let a broken tool
    // masquerade as a clean-but-blocking result. (Forge audit 2026-07-06.)
    scanError(`references: ReferenceCheck delegation failed — ${e.message}`);
    note = 'SCAN ERROR (delegation failed)';
  }
  record('references', findings, note);
}

// ── Check 2: version_anchors ──
function checkVersionAnchors(): void {
  const findings: Finding[] = [];
  let latest = '';
  try { latest = readFileSync(join(LIFEOS_DIR, 'ALGORITHM', 'LATEST'), 'utf8').trim(); }
  catch { scanError('version_anchors: ALGORITHM/LATEST unreadable'); record('version_anchors', [], 'SCAN ERROR (no LATEST)'); return; }

  const specRefRe = /(?:Algorithm|LIFEOS\/ALGORITHM)\/v(\d+\.\d+\.\d+)\.md/g;
  const docFiles = findFiles(DOC_DIR, ['-name', '*.md', '-type', 'f']);
  for (const file of docFiles) {
    let content = '';
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    let m: RegExpExecArray | null;
    specRefRe.lastIndex = 0;
    while ((m = specRefRe.exec(content)) !== null) {
      if (m[1] !== latest) {
        findings.push({ detail: `${file.replace(CLAUDE_DIR + '/', '')}: spec ref v${m[1]}.md ≠ LATEST v${latest}`, blocking: true });
      }
    }
  }
  record('version_anchors', findings, `LATEST=v${latest}; ${findings.length} drifted spec-file refs`);
}

// ── Check 3: hook_registration (bidirectional + parse-guard + exec-bit) ──
function checkHookRegistration(): void {
  const findings: Finding[] = [];
  const hooksDir = join(CLAUDE_DIR, 'hooks');
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  let settings = '';
  try { settings = readFileSync(settingsPath, 'utf8'); }
  catch { scanError('hook_registration: settings.json unreadable'); record('hook_registration', [], 'SCAN ERROR (no settings)'); return; }

  // settings.json must be valid JSON — a malformed settings.json breaks the whole harness.
  try { JSON.parse(settings); }
  catch (e: any) { findings.push({ detail: `settings.json does not parse as JSON: ${e.message}`, blocking: true }); }

  const registered = new Set<string>();
  const re = /([A-Za-z0-9_]+\.hook\.ts)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(settings)) !== null) registered.add(m[1]);

  let onDisk = new Set<string>();
  try { onDisk = new Set(readdirSync(hooksDir).filter(f => f.endsWith('.hook.ts'))); } catch {}

  // registered but file missing → BLOCKING
  for (const r of registered) {
    if (!onDisk.has(r)) findings.push({ detail: `registered in settings.json but file missing: hooks/${r}`, blocking: true });
    else {
      // registered hooks with a shebang are exec'd directly by the harness — a missing +x bit is a silent no-fire.
      try {
        const st = statSync(join(hooksDir, r));
        const isExec = (st.mode & 0o111) !== 0;
        if (!isExec) findings.push({ detail: `registered hook not executable (chmod +x): hooks/${r}`, blocking: false });
      } catch {}
    }
  }
  // on disk but not registered → INFO (may be intentionally dormant)
  for (const d of onDisk) {
    if (!registered.has(d)) findings.push({ detail: `on disk but not registered in settings.json: hooks/${d}`, blocking: false });
  }
  record('hook_registration', findings, `${registered.size} registered, ${onDisk.size} on disk`);
}

// ── Check 3b: frontmatter validation for self-describing units (commands, agents) ──
// Class-sweep sibling of the skills check: every markdown unit that registers itself
// by frontmatter must carry name + description, or it decays silently.
function checkFrontmatterUnits(name: string, dir: string, requireName: boolean): void {
  const findings: Finding[] = [];
  let files: string[] = [];
  // *Context.md are companion role-context docs loaded BY an agent/skill, not
  // self-registering units — they carry no frontmatter by design. Excluded here.
  try { files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md' && !f.endsWith('Context.md')); } catch {
    record(name, [], `${dir.replace(CLAUDE_DIR + '/', '')} absent`); return;
  }
  for (const f of files) {
    let content = '';
    try { content = readFileSync(join(dir, f), 'utf8'); } catch { continue; }
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) { findings.push({ detail: `${name}/${f}: no frontmatter block`, blocking: true }); continue; }
    if (requireName && !/^name:\s*\S/m.test(fm[1])) findings.push({ detail: `${name}/${f}: missing frontmatter 'name:'`, blocking: true });
    if (!/^description:\s*\S/m.test(fm[1])) findings.push({ detail: `${name}/${f}: missing frontmatter 'description:'`, blocking: true });
  }
  record(name, findings, `${files.length} ${name} validated`);
}

// ── Check 4: claude_imports (@-imports across every CLAUDE.md) ──
function checkClaudeImports(): void {
  const findings: Finding[] = [];
  const claudeMds = findFiles(CLAUDE_DIR, ['(', '-name', 'CLAUDE.md', '-o', '-name', 'CLAUDE.user.md', ')', '-type', 'f']);
  let importCount = 0;
  for (const file of claudeMds) {
    let content = '';
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of content.split('\n')) {
      const im = line.match(/^@([^\s]+)/);
      if (!im) continue;
      importCount++;
      const target = join(CLAUDE_DIR, im[1]);
      if (!existsSync(target)) {
        findings.push({ detail: `${file.replace(CLAUDE_DIR + '/', '')}: broken @-import → ${im[1]}`, blocking: true });
      }
    }
  }
  record('claude_imports', findings, `${claudeMds.length} CLAUDE.md files, ${importCount} @-imports`);
}

// ── Check 5: skills (SKILL.md frontmatter name+description, all depths) ──
function checkSkills(): void {
  const findings: Finding[] = [];
  const skillsDir = join(CLAUDE_DIR, 'skills');
  const skillMds = findFiles(skillsDir, ['-name', 'SKILL.md', '-type', 'f']);
  for (const skillMd of skillMds) {
    const rel = skillMd.replace(CLAUDE_DIR + '/', '');
    let content = '';
    try { content = readFileSync(skillMd, 'utf8'); } catch { continue; }
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) { findings.push({ detail: `${rel}: no frontmatter block`, blocking: true }); continue; }
    const fm = fmMatch[1];
    if (!/^name:\s*\S/m.test(fm)) findings.push({ detail: `${rel}: missing frontmatter 'name:'`, blocking: true });
    if (!/^description:\s*\S/m.test(fm)) findings.push({ detail: `${rel}: missing frontmatter 'description:'`, blocking: true });
  }
  // Structural: a Workflows/ or Tools/ dir with no sibling SKILL.md is a broken skill.
  const structureDirs = findFiles(skillsDir, ['(', '-name', 'Workflows', '-o', '-name', 'Tools', ')', '-type', 'd']);
  const flagged = new Set<string>();
  for (const sd of structureDirs) {
    const skillRoot = sd.slice(0, sd.lastIndexOf('/'));
    // Only a top-level skill root (skills/<name>) must carry SKILL.md. A nested content dir that
    // merely happens to contain a Tools/ or Workflows/ subdir (e.g. skills/Prompting/Templates/Tools)
    // is not a skill and is exempt.
    const afterSkills = skillRoot.split('/skills/')[1];
    if (!afterSkills || afterSkills.includes('/')) continue;
    if (flagged.has(skillRoot)) continue;
    if (!existsSync(join(skillRoot, 'SKILL.md'))) {
      flagged.add(skillRoot);
      findings.push({ detail: `${skillRoot.replace(CLAUDE_DIR + '/', '')}/: has Workflows/Tools but no SKILL.md`, blocking: true });
    }
  }
  record('skills', findings, `${skillMds.length} SKILL.md validated`);
}

// ── Check 6: workflows (referenced by their SKILL.md, nested paths included) ──
function checkWorkflows(): void {
  const findings: Finding[] = [];
  const skillsDir = join(CLAUDE_DIR, 'skills');
  const wfFiles = findFiles(skillsDir, ['-path', '*/Workflows/*', '-name', '*.md', '-type', 'f']);
  const cache = new Map<string, string>();
  for (const wf of wfFiles) {
    const rel = wf.replace(CLAUDE_DIR + '/', '');
    const idx = wf.indexOf('/Workflows/');
    const skillMd = join(wf.slice(0, idx), 'SKILL.md');
    let sc = cache.get(skillMd);
    if (sc === undefined) { try { sc = readFileSync(skillMd, 'utf8'); } catch { sc = ''; } cache.set(skillMd, sc); }
    const bn = wf.slice(wf.lastIndexOf('/') + 1);
    const base = bn.replace(/\.md$/, '');
    // referenced if the SKILL.md mentions the filename or the bare workflow name
    if (!sc.includes(bn) && !sc.includes(base)) {
      findings.push({ detail: `${rel}: not referenced by its SKILL.md (orphan workflow)`, blocking: false });
    }
  }
  record('workflows', findings, `${wfFiles.length} workflow files, ${findings.length} orphaned`);
}

// ── Check: carrier-probe freshness (CarrierProbe --check, zero spend) ──
// The DISPATCH_EXECUTES_FABLE fact in models.ts underpins the Fable-carrier
// rule, the statusline dispatch mapping, and Algorithm §Spend. It flipped
// silently on a harness update once (2026-07-12); this gate keeps it probed.
function checkCarrierProbe(): void {
  const findings: Finding[] = [];
  try {
    execFileSync('bun', [join(CLAUDE_DIR, 'LIFEOS', 'TOOLS', 'CarrierProbe.ts'), '--check'], { encoding: 'utf8' });
  } catch (e: any) {
    const msg = (e.stderr || e.stdout || e.message || '').toString().trim().split('\n')[0];
    findings.push({ detail: msg || 'CarrierProbe --check failed', blocking: true });
  }
  record('carrier-probe', findings, findings.length === 0 ? 'fact fresh' : undefined);
}

// ── Run all ──
try {
  checkReferences();
  checkVersionAnchors();
  checkHookRegistration();
  checkCarrierProbe();
  checkClaudeImports();
  checkSkills();
  checkWorkflows();
  checkFrontmatterUnits('commands', join(CLAUDE_DIR, 'commands'), true);
  checkFrontmatterUnits('agents', join(CLAUDE_DIR, 'agents'), false);
} catch (e: any) {
  if (jsonOutput) console.log(JSON.stringify({ error: e.message }, null, 2));
  else console.error(`SCAN ERROR: ${e.message}`);
  process.exit(2);
}

const totalBlocking = checks.reduce((n, c) => n + c.blockingCount, 0);
const totalInfo = checks.reduce((n, c) => n + c.infoCount, 0);
// Exit-code precedence (Forge audit 2026-07-06): scan error (2) outranks blocking (1) outranks clean (0).
// A check that could not RUN is exit 2 — never collapsed into a blocking finding, so a broken
// tool can never masquerade as a clean-but-blocking result.
const exitCode = scanErrors.length > 0 ? 2 : totalBlocking > 0 ? 1 : 0;

if (jsonOutput) {
  console.log(JSON.stringify({
    ok: exitCode === 0,
    exitCode,
    scanErrors,
    totalBlocking,
    totalInfo,
    checks: checks.map(c => ({ name: c.name, ok: c.ok, blocking: c.blockingCount, info: c.infoCount, note: c.note, findings: c.findings })),
  }, null, 2));
} else {
  const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', DIM = '\x1b[2m', RST = '\x1b[0m';
  console.log(`\n🔎 LifeOS Integrity Check\n${'─'.repeat(60)}`);
  for (const c of checks) {
    const icon = c.blockingCount > 0 ? `${R}✗${RST}` : c.infoCount > 0 ? `${Y}!${RST}` : `${G}✓${RST}`;
    if (quiet && c.blockingCount === 0 && c.infoCount === 0) continue;
    console.log(`${icon} ${c.name.padEnd(20)} ${DIM}${c.note ?? ''}${RST}`);
    // Blocking findings always print. Non-blocking print only with --verbose (default rolls them to the note count).
    for (const f of c.findings) {
      if (!f.blocking && !verbose) continue;
      console.log(`    ${f.blocking ? R + 'BLOCK' : Y + 'info '}${RST} ${f.detail}`);
    }
    if (!verbose && c.infoCount > 0) console.log(`    ${DIM}(${c.infoCount} non-blocking — run --verbose to list)${RST}`);
  }
  console.log(`${'─'.repeat(60)}`);
  for (const se of scanErrors) console.log(`${R}⚠ SCAN ERROR${RST} ${se}`);
  const verdict = scanErrors.length > 0 ? `${R}SCAN ERROR (exit 2)${RST}` : totalBlocking > 0 ? `${R}${totalBlocking} BLOCKING${RST}` : `${G}CLEAN${RST}`;
  console.log(`Verdict: ${verdict}  ${DIM}(${totalInfo} non-blocking info)${RST}`);
  console.log(`${DIM}Tier: deterministic (structural + reference integrity). Semantic drift — docs describing changed behavior — is only caught by /ic --deep.${RST}\n`);
  if (deep) {
    console.log(`${DIM}--deep: run the 12-agent deep audit via the workflow:${RST}`);
    console.log(`  Skill("<your-release-skill>", "integrity check --deep")\n`);
  }
}

process.exit(exitCode);
