#!/usr/bin/env bun
/**
 * @version 1.0.10
 */
// IsaFrontier.ts — dependency edges, takeable-frontier computation, and the
// concurrent-session claim protocol for ISAs.
//
// The ISA stays the single markdown artifact and the AI stays its sole writer:
// this tool NEVER writes the ISA file. Edges ride inside criterion descriptions as
// a trailing `(after: ID, ID)` parenthetical — opaque free text to every
// existing parser (isa-utils, ISAGate, Bunker). Lock state lives centrally at
// MEMORY/STATE/isa-locks/<sha1(isa-path)>/<claim-id>.lock so project repos stay
// clean; same-machine atomicity via writeFileSync 'wx' is sufficient because
// concurrent sessions share one machine.
//
// Commands:
//   frontier <isa> [--json]                    takeable criteria (open, unblocked, unlocked)
//   claim    <isa> --id C4 --session S         atomic take; exit 2 on conflict
//   release  <isa> --id C4 --session S         release own lock (--force overrides)
//   status   <isa> [--json]                    full map: closed/open/blocked/taken/stale
//   validate <isa>                             edge integrity only (cycles, unknown IDs)
//
// Doctrine: ISAFormat.md § Dependency edges and the frontier (v2.21.0),
// Algorithm v8.20.0.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync, realpathSync, renameSync } from 'fs';
import { resolve, join } from 'path';
import { createHash } from 'crypto';
// IsaClaims imports only fs/crypto and the leaf lib/IsaSections; it never loads the hook graph.
import { parseIsaClaimsText, isaBody, claimText, stripBulletPrefix } from './lib/IsaClaims';
import { CRITERIA_HEADING_RE } from './lib/IsaSections';
import { getClaudeDir } from './Paths'; // public issue #1974 @sabo961, PR #1918 @PigLardLord

const STALE_TTL_MS_DEFAULT = 2 * 60 * 60 * 1000; // 2h — a session gone this long has died or moved on

// ── Criterion + edge parsing ──────────────────────────────────────────────────
// The criteria heading regex of hooks/lib/isa-utils.ts, generated once in lib/IsaSections.ts (SECTION_ALIASES).
// Imported from that leaf module, not from isa-utils, so this standalone CLI doesn't drag in isa-utils' hook graph
// (work-events, ascent, execSync side effects). public issue #2527
export const FRONTIER_CRITERIA_HEADING_RE = CRITERIA_HEADING_RE;

// Criterion IDs: ISC-N (incl. split IDs like ISC-2.1), domain-prefixed (H-AVAIL,
// CRS-PAGE), short v8 forms (C1, A3, EQ-12). Dots included so split criteria work.
// Edges are the TRAILING parenthetical only (optionally followed by `.`), and
// backticked code spans are ignored — a criterion that merely QUOTES the syntax
// (like this build's own C1) must not parse as edged. Found by dogfooding:
// the first live run read its own documentation as a dependency.
const AFTER_RE = /\(after:\s*([^)]+)\)\s*\.?\s*$/i;
const CODE_SPAN_RE = /`[^`]*`/g;

export interface FrontierClaim {
  id: string;
  checked: boolean;
  description: string;
  after: string[];        // blocker IDs, [] when none
  dropped: boolean;       // tombstoned — counts as resolved for blocking
  indent: number;
}

export interface LockInfo {
  claimId: string;
  session: string;
  ts: string;
  stale: boolean;
}

export function parseClaims(content: string): FrontierClaim[] {
  const lines = isaBody(content).split(/\r?\n/);
  const claims: FrontierClaim[] = [];
  for (const claim of parseIsaClaimsText(content, { includeParents: true }).claims) {
    const line = lines[claim.line - 1]!;
    const description = claim.source === 'table'
      ? line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).filter(cell => claimText(cell)?.id !== claim.id).join(' | ').trim()
      : claimText(stripBulletPrefix(line))!.body;
    const afterMatch = description.replace(CODE_SPAN_RE, '').match(AFTER_RE);
    const after = afterMatch
      ? afterMatch[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    claims.push({
      id: claim.id,
      checked: claim.checked,
      description,
      after,
      dropped: /\[DROPPED/i.test(description),
      indent: line.match(/^\s*/)![0].length,
    });
  }
  return claims;
}

// Raw checkbox-line count in the same section — for the loud undercount check:
// an ID-less `- [ ]` line is invisible to the graph, and silence about that is
// the exact failure isa-utils' diagnoseCriteria exists to prevent (Forge F8).
export function countCheckboxLines(content: string): number {
  const headingMatch = FRONTIER_CRITERIA_HEADING_RE.exec(content);
  if (!headingMatch || headingMatch.index === undefined) return 0;
  const rest = content.slice(headingMatch.index + headingMatch[0].length);
  const endMatch = rest.match(/\n##\s+(?!#)|\n---\s*\n/);
  const body = endMatch ? rest.slice(0, endMatch.index) : rest;
  return body.split('\n').filter((l) => l.match(/^\s*- \[[ x]\]/)).length;
}

// ── Edge validation ───────────────────────────────────────────────────────

// IDs are structural independently of dependency edges. Keep this separate
// from validateEdges so callers that do not use (after:) still enforce it.
export function validateClaimIds(claims: FrontierClaim[]): string[] {
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const c of claims) {
    if (seen.has(c.id)) duplicates.add(c.id);
    seen.add(c.id);
  }
  return [...duplicates].map((id) => `duplicate ISC ID: ${id}`);
}

export function validateEdges(claims: FrontierClaim[]): string[] {
  const errors: string[] = [];
  const ids = new Set(claims.map((c) => c.id));

  for (const c of claims) {
    for (const b of c.after) {
      if (b === c.id) errors.push(`${c.id} blocks on itself`);
      else if (!ids.has(b)) errors.push(`${c.id} blocks on unknown ID: ${b}`);
    }
  }

  // Cycle detection: DFS with colors over the after-edges.
  const byId = new Map(claims.map((c) => [c.id, c]));
  const color = new Map<string, 0 | 1 | 2>(); // 0 white, 1 gray, 2 black
  const stack: string[] = [];
  const visit = (id: string): boolean => {
    color.set(id, 1);
    stack.push(id);
    for (const b of byId.get(id)?.after ?? []) {
      if (!byId.has(b)) continue;
      const col = color.get(b) ?? 0;
      if (col === 1) {
        const cycleStart = stack.indexOf(b);
        errors.push(`dependency cycle: ${[...stack.slice(cycleStart), b].join(' → ')}`);
        return true;
      }
      if (col === 0 && visit(b)) return true;
    }
    stack.pop();
    color.set(id, 2);
    return false;
  };
  for (const c of claims) {
    if ((color.get(c.id) ?? 0) === 0 && visit(c.id)) break; // one cycle report is enough to fail loudly
  }
  return errors;
}

/** Next whole-number ISC ID from criterion definitions, never frontmatter counts. */
export function nextIscId(claims: FrontierClaim[]): string {
  let max = 0;
  for (const { id } of claims) {
    const match = /^ISC-(\d+)$/i.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ISC-${max + 1}`;
}

// ── Lock protocol ─────────────────────────────────────────────────────────

function lifeosRoot(): string {
  return process.env.LIFEOS_ROOT || getClaudeDir();
}

export function lockDirFor(isaPath: string, root = lifeosRoot()): string {
  // realpathSync, never bare resolve: LIFEOS/MEMORY is a symlink, so the same
  // ISA reached by its two legal paths must hash to ONE lock dir or two
  // sessions each "atomically" win the same claim (Forge F1; the exact class
  // OPERATIONAL_PREFERENCES § Path boundary checks names). Fallback to resolve only
  // when the file doesn't exist yet (library callers in tests).
  let canonical: string;
  try { canonical = realpathSync(resolve(isaPath)); } catch { canonical = resolve(isaPath); }
  const hash = createHash('sha1').update(canonical).digest('hex').slice(0, 16);
  return join(root, 'LIFEOS', 'MEMORY', 'STATE', 'isa-locks', hash);
}

export function readLocks(isaPath: string, ttlMs = STALE_TTL_MS_DEFAULT, root = lifeosRoot()): LockInfo[] {
  const dir = lockDirFor(isaPath, root);
  if (!existsSync(dir)) return [];
  const locks: LockInfo[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.lock')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
      const age = Date.now() - Date.parse(data.ts || 0);
      locks.push({
        claimId: f.slice(0, -'.lock'.length),
        session: String(data.session || 'unknown'),
        ts: String(data.ts || ''),
        stale: !Number.isFinite(age) || age > ttlMs,
      });
    } catch {
      // Unreadable lock: surface as stale rather than hiding it.
      locks.push({ claimId: f.slice(0, -'.lock'.length), session: 'unreadable', ts: '', stale: true });
    }
  }
  return locks;
}

export type ClaimResult = { ok: true } | { ok: false; holder: string; stale: boolean };

export function claimLock(
  isaPath: string,
  claimId: string,
  session: string,
  ttlMs = STALE_TTL_MS_DEFAULT,
  root = lifeosRoot(),
): ClaimResult {
  const dir = lockDirFor(isaPath, root);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${claimId}.lock`);
  const payload = JSON.stringify({ session, ts: new Date().toISOString(), isa: resolve(isaPath) }) + '\n';
  const tryCreate = (): boolean => {
    try {
      writeFileSync(file, payload, { flag: 'wx' }); // atomic create — the mutual exclusion
      return true;
    } catch {
      return false;
    }
  };
  if (tryCreate()) return { ok: true };

  const existing = readLocks(isaPath, ttlMs, root).find((l) => l.claimId === claimId);
  if (existing?.session === session) {
    // Idempotent re-claim doubles as the heartbeat: rewrite with a fresh ts so
    // a session legitimately working a claim past the TTL never goes stale
    // under itself (Forge F3). Safe — ownership just verified.
    writeFileSync(file, payload);
    return { ok: true };
  }
  if (existing?.stale) {
    // Steal via atomic rename, never unlink-then-create: with unlink, a second
    // stealer holding a stale read could delete the FIRST stealer's fresh lock
    // and both would win (Forge F2). renameSync has exactly one winner; the
    // loser gets ENOENT. Tombstones don't match readLocks' `.lock` filter.
    const tomb = join(dir, `${claimId}.steal.${createHash('sha1').update(session).digest('hex').slice(0, 8)}`);
    try {
      renameSync(file, tomb);
    } catch {
      // Lost the rename race — fall through to report the (possibly fresh) holder.
    }
    if (existsSync(tomb)) {
      try { unlinkSync(tomb); } catch {}
      if (tryCreate()) return { ok: true };
    }
  }
  // Lock may have vanished between the failed create and now (release or GC) —
  // one clean retry wins that window instead of reporting a phantom holder.
  const holder = readLocks(isaPath, ttlMs, root).find((l) => l.claimId === claimId);
  if (!holder && tryCreate()) return { ok: true };
  return { ok: false, holder: holder?.session ?? 'unknown', stale: holder?.stale ?? false };
}

export function releaseLock(
  isaPath: string,
  claimId: string,
  session: string,
  force = false,
  root = lifeosRoot(),
): { ok: boolean; reason?: string } {
  const file = join(lockDirFor(isaPath, root), `${claimId}.lock`);
  if (!existsSync(file)) return { ok: true }; // idempotent
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    if (!force && data.session !== session) {
      return { ok: false, reason: `lock held by ${data.session}, not ${session} (use --force to override)` };
    }
  } catch {
    // Unreadable lock is releasable by anyone — it can't prove ownership.
  }
  try { unlinkSync(file); } catch {}
  return { ok: true };
}

// ── Frontier computation (pure) ───────────────────────────────────────────
// A criterion is TAKEABLE iff: open (unchecked, not dropped) ∧ every blocker is
// resolved (checked or dropped) ∧ no fresh lock held by another session.

export interface FrontierView {
  takeable: FrontierClaim[];
  taken: Array<FrontierClaim & { session: string; ts: string }>;
  blocked: Array<FrontierClaim & { openBlockers: string[] }>;
  closed: FrontierClaim[];
  staleLocks: LockInfo[];
}

export function computeFrontier(claims: FrontierClaim[], locks: LockInfo[]): FrontierView {
  const resolved = new Set(claims.filter((c) => c.checked || c.dropped).map((c) => c.id));
  const freshLocks = new Map(locks.filter((l) => !l.stale).map((l) => [l.claimId, l]));
  const view: FrontierView = { takeable: [], taken: [], blocked: [], closed: [], staleLocks: locks.filter((l) => l.stale) };

  for (const c of claims) {
    if (c.checked || c.dropped) { view.closed.push(c); continue; }
    const openBlockers = c.after.filter((b) => !resolved.has(b));
    if (openBlockers.length > 0) { view.blocked.push({ ...c, openBlockers }); continue; }
    const lock = freshLocks.get(c.id);
    if (lock) view.taken.push({ ...c, session: lock.session, ts: lock.ts });
    else view.takeable.push(c);
  }
  return view;
}

// ── CLI ───────────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const [cmd, isaPath] = [process.argv[2], process.argv[3]];
  const json = process.argv.includes('--json');
  if (!cmd || !isaPath || !existsSync(isaPath)) {
    console.error('usage: IsaFrontier.ts <frontier|claim|release|status|validate> <isa-path> [--id C4] [--session S] [--json] [--ttl-hours N] [--force]');
    process.exit(1);
  }
  // A mistyped --ttl-hours must fail loudly, not make every lock immortal:
  // Number('abc') is NaN, and `age > NaN` is false forever (Forge F7).
  const ttlMs = arg('--ttl-hours') ? Number(arg('--ttl-hours')) * 3600_000 : STALE_TTL_MS_DEFAULT;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) { console.error(`✗ invalid --ttl-hours: ${arg('--ttl-hours')}`); process.exit(1); }
  const content = readFileSync(isaPath, 'utf-8');
  const claims = parseClaims(content);
  const errors = [...validateClaimIds(claims), ...validateEdges(claims)];
  const boxCount = countCheckboxLines(content);
  const undercount = boxCount - claims.length;

  if (cmd === 'validate') {
    if (errors.length) { for (const e of errors) console.error(`✗ ${e}`); process.exit(1); }
    if (undercount > 0) console.error(`⚠ ${undercount} checkbox line(s) carry no parseable ISC ID — invisible to the graph`);
    const edged = claims.filter((c) => c.after.length > 0).length;
    console.log(`✓ ${claims.length} criteria, ${edged} with edges, no cycles, all IDs resolve`);
    return;
  }
  if (errors.length) { for (const e of errors) console.error(`✗ ${e}`); process.exit(1); }

  if (cmd === 'claim' || cmd === 'release') {
    const id = arg('--id');
    const session = arg('--session');
    if (!id || !session) { console.error(`✗ ${cmd} requires --id and --session`); process.exit(1); }
    if (!claims.some((c) => c.id === id)) { console.error(`✗ unknown ISC ID: ${id}`); process.exit(1); }
    if (cmd === 'claim') {
      const open = computeFrontier(claims, readLocks(isaPath, ttlMs));
      if (!open.takeable.some((c) => c.id === id)) {
        const why = open.closed.some((c) => c.id === id) ? 'already closed'
          : open.blocked.some((c) => c.id === id) ? `blocked by ${open.blocked.find((c) => c.id === id)!.openBlockers.join(', ')}`
          : 'held by another session';
        console.error(`✗ ${id} is not takeable: ${why}`);
        process.exit(2);
      }
      const res = claimLock(isaPath, id, session, ttlMs);
      if (!res.ok) { console.error(`✗ ${id} lost race to ${res.holder}`); process.exit(2); }
      console.log(`✓ ${id} claimed by ${session}`);
    } else {
      const res = releaseLock(isaPath, id, session, process.argv.includes('--force'));
      if (!res.ok) { console.error(`✗ ${res.reason}`); process.exit(2); }
      console.log(`✓ ${id} released`);
    }
    return;
  }

  // frontier / status
  const view = computeFrontier(claims, readLocks(isaPath, ttlMs));
  if (json) { console.log(JSON.stringify(view, null, 2)); return; }
  console.log(`═══ FRONTIER: ${isaPath} ═══`);
  console.log(`closed ${view.closed.length}/${claims.length}`);
  for (const c of view.takeable) console.log(`  ▶ TAKEABLE ${c.id}: ${c.description.replace(AFTER_RE, '').trim()}`);
  for (const c of view.taken) console.log(`  ⏳ TAKEN    ${c.id} by ${c.session} since ${c.ts}`);
  if (cmd === 'status') {
    for (const c of view.blocked) console.log(`  ⛔ BLOCKED  ${c.id} ← waiting on ${c.openBlockers.join(', ')}`);
    for (const c of view.closed) console.log(`  ✓ CLOSED   ${c.id}`);
  } else if (view.blocked.length) {
    console.log(`  (${view.blocked.length} blocked — run status for detail)`);
  }
  for (const l of view.staleLocks) console.log(`  ⚠ STALE LOCK ${l.claimId} (${l.session}, ${l.ts || 'unreadable'}) — takeable`);
  if (cmd === 'status' && undercount > 0) console.log(`  ⚠ ${undercount} checkbox line(s) carry no parseable ISC ID — invisible to the graph`);
}

if (import.meta.main) main();
