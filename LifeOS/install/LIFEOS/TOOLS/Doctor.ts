#!/usr/bin/env bun
/**
 * @version 1.0.0
 * Doctor — LifeOS capability prober and manifest writer.
 *
 * Probes the external tools that LifeOS doctrine depends on (cross-vendor
 * audit CLI, browser verification, Cloudflare/wrangler, voice) plus core
 * wiring, and writes an advisory capability manifest. Born from community
 * feedback (LifeOS discussion #1461): capabilities that are assumed but
 * never verified degrade silently; anything dormant at rest is invisible
 * to change-scoped checks.
 *
 * Design contract (RedTeam-derived, 2026-07-12):
 *   - The manifest is a TTL'd advisory CACHE, never truth. Readers treat it
 *     as untrusted input; doctrine-critical gates re-verify live.
 *   - Four states: live | broken | declined | stale. Declined is first-class
 *     and permanently silent — opted-out is not a defect.
 *   - No scores, no percentages. Diagnostic register only.
 *   - Never install-fatal: default run always exits 0, every probe is
 *     timeout-bounded, network probes are opt-in (--network) and only fire
 *     for capabilities the user has configured.
 *   - Tamper-evident: manifest carries a salted integrity hash (salt is a
 *     separate 0600 file). Detects casual/model edits, not a determined
 *     local attacker.
 *
 * Usage:
 *   bun Doctor.ts                  # probe (offline checks), table output
 *   bun Doctor.ts --network        # include network probes for configured caps
 *   bun Doctor.ts --json           # machine-readable
 *   bun Doctor.ts --no-network     # explicit offline (default is offline)
 *   bun Doctor.ts decline <cap>    # mark capability declined (silent forever)
 *   bun Doctor.ts enable <cap>     # undo a decline
 *   bun Doctor.ts ack              # acknowledge current broken set (statusline delta)
 *   bun Doctor.ts --statusline     # one glyph if NEW regression since ack, else empty
 *   bun Doctor.ts --verify         # integrity-check the manifest (exit 2 on tamper)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';

const HOME = process.env.HOME || '';
const CONFIG_ROOT = process.env.CLAUDE_CONFIG_DIR || join(HOME, '.claude');
const LIFEOS_DIR = (process.env.LIFEOS_DIR || join(CONFIG_ROOT, 'LIFEOS'))
  .replace(/^\$HOME/, HOME).replace(/^~(?=\/)/, HOME);
const STATE_DIR = join(LIFEOS_DIR, 'MEMORY', 'STATE');
const MANIFEST = join(STATE_DIR, 'capabilities.json');
const SALT_FILE = join(STATE_DIR, '.capabilities-salt');
const HEARTBEAT = join(STATE_DIR, 'doctor-heartbeat.json');
const PROBE_TIMEOUT_MS = 15_000;

type CapState = 'live' | 'broken' | 'declined' | 'stale';

interface CapResult {
  state: CapState;
  checkedAt: string;      // ISO timestamp of last real probe
  ttlHours: number;       // readers treat entries older than this as stale
  detail: string;         // one-line human diagnosis
  fixCmd: string | null;  // copy-paste remediation, null when live/declined
  probeClass: 'offline' | 'network';
}

interface Manifest {
  version: 1;
  updatedAt: string;
  note: string;
  capabilities: Record<string, CapResult>;
  ackedBroken: string[];  // broken set acknowledged via `ack` (statusline delta base)
  integrity?: string;
}

interface CapSpec {
  id: string;
  title: string;
  powers: string;
  ttlHours: number;
  // Returns null when the capability has no local configuration at all —
  // network probing it would be pre-consent egress (never allowed).
  configured: () => boolean;
  probeOffline: () => Promise<{ ok: boolean; detail: string }>;
  probeNetwork?: () => Promise<{ ok: boolean; detail: string }>;
  fixCmd: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function run(cmd: string[], timeoutMs = PROBE_TIMEOUT_MS): Promise<{ code: number; out: string }> {
  try {
    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' });
    // Race the read: a killed child's grandchildren can inherit the stdout pipe
    // and hold it open past the kill, so awaiting stream EOF alone can hang.
    return await Promise.race([
      (async () => {
        const out = await new Response(proc.stdout).text();
        const code = await proc.exited;
        return { code, out: out.trim() };
      })(),
      new Promise<{ code: number; out: string }>(resolve =>
        setTimeout(() => { try { proc.kill(9); } catch {} resolve({ code: 124, out: '' }); }, timeoutMs)),
    ]);
  } catch {
    return { code: 127, out: '' };
  }
}

function which(bin: string): boolean {
  const paths = (process.env.PATH || '').split(':');
  return paths.some(p => p && existsSync(join(p, bin)));
}

function envKey(name: string): string | null {
  if (process.env[name]) return process.env[name]!;
  // .env at config root is the canonical secrets file on a LifeOS install.
  const envFile = join(CONFIG_ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(new RegExp(`^${name}=["']?([^"'\\n]+)`, 'm'));
    if (m) return m[1];
  }
  return null;
}

function whichPath(bin: string): string | null {
  const hit = (process.env.PATH || '').split(':').find(p => p && existsSync(join(p, bin)));
  return hit ? join(hit, bin) : null;
}

function chromeBinary(): string | null {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Nix Apps/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Nix Apps/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  // Nix/Home Manager installs expose the browser on PATH rather than in /Applications
  return candidates.find(existsSync)
    || whichPath('google-chrome') || whichPath('chromium')
    || whichPath('brave') || whichPath('brave-browser')
    || null;
}

// ── capability registry ──────────────────────────────────────────────────────

const CAPS: CapSpec[] = [
  {
    id: 'codex',
    title: 'Cross-vendor audit (codex CLI)',
    powers: 'independent second-vendor review on high-impact work',
    ttlHours: 24 * 7,
    configured: () => which('codex') || existsSync(join(HOME, '.codex')),
    probeOffline: async () => {
      if (!which('codex')) return { ok: false, detail: 'codex binary not on PATH' };
      const authed = existsSync(join(HOME, '.codex', 'auth.json'));
      return authed
        ? { ok: true, detail: 'binary present, auth file present' }
        : { ok: false, detail: 'binary present but not logged in (~/.codex/auth.json missing)' };
    },
    fixCmd: 'bun install -g @openai/codex && codex login',
  },
  {
    id: 'interceptor',
    title: 'Browser verification (Interceptor)',
    powers: 'real-browser verification of all web/UI claims',
    ttlHours: 24 * 7,
    configured: () => true, // ships with LifeOS; a missing browser is broken, not unconfigured
    probeOffline: async () => {
      const skill = existsSync(join(CONFIG_ROOT, 'skills', 'Interceptor', 'SKILL.md'));
      if (!skill) return { ok: false, detail: 'Interceptor skill not installed' };
      const browser = chromeBinary();
      if (!browser) return { ok: false, detail: 'no Chrome/Brave/Chromium binary found' };
      return { ok: true, detail: `skill present, browser found (${browser.split('/').pop()})` };
    },
    fixCmd: 'install Google Chrome (or Brave), then re-run: bun LIFEOS/TOOLS/Doctor.ts',
  },
  {
    id: 'cloudflare',
    title: 'Scheduled cloud flows (Cloudflare/wrangler)',
    powers: 'Arbol scheduled flows and Worker deploys',
    ttlHours: 24,
    configured: () => !!envKey('CLOUDFLARE_API_TOKEN') || existsSync(join(HOME, '.wrangler')) || which('wrangler'),
    probeOffline: async () => {
      const hasToken = !!envKey('CLOUDFLARE_API_TOKEN');
      const hasWrangler = which('wrangler') || which('bunx');
      if (!hasWrangler) return { ok: false, detail: 'wrangler not available (bunx missing?)' };
      return hasToken
        ? { ok: true, detail: 'CLOUDFLARE_API_TOKEN set, wrangler reachable' }
        : { ok: false, detail: 'no CLOUDFLARE_API_TOKEN in env or .env' };
    },
    probeNetwork: async () => {
      const r = await run(['bunx', 'wrangler', 'whoami']);
      return r.code === 0
        ? { ok: true, detail: 'wrangler whoami OK' }
        : { ok: false, detail: 'wrangler whoami failed (token invalid or expired)' };
    },
    fixCmd: 'add CLOUDFLARE_API_TOKEN to <configRoot>/.env, then: bun LIFEOS/TOOLS/Doctor.ts --network',
  },
  {
    id: 'voice',
    title: 'Voice notifications (ElevenLabs)',
    powers: 'spoken notifications via the Pulse voice server',
    ttlHours: 24,
    configured: () => !!envKey('ELEVENLABS_API_KEY'),
    probeOffline: async () => {
      const key = envKey('ELEVENLABS_API_KEY');
      if (!key) return { ok: false, detail: 'no ELEVENLABS_API_KEY in env or .env' };
      const voiceId = envKey('ELEVENLABS_VOICE_ID');
      return voiceId
        ? { ok: true, detail: 'API key and voice id configured' }
        : { ok: false, detail: 'API key set but no ELEVENLABS_VOICE_ID configured' };
    },
    probeNetwork: async () => {
      const key = envKey('ELEVENLABS_API_KEY');
      const voiceId = envKey('ELEVENLABS_VOICE_ID');
      if (!key || !voiceId) return { ok: false, detail: 'key or voice id missing' };
      // Probe the TTS endpoint itself, not /v1/voices metadata: scoped keys
      // (TTS-only permission) 401 on metadata while TTS works, and famous
      // voices 401 on TTS while metadata looks fine (#1461 bug 5). The only
      // honest probe is the exact path notifications use. Cost: a 2-char
      // synthesis — negligible, and only for opted-in configured installs.
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'ok', model_id: 'eleven_turbo_v2_5' }),
        });
        clearTimeout(timer);
        if (res.ok) return { ok: true, detail: 'TTS round-trip OK (real synthesis on the notification path)' };
        const errText = (await res.text()).slice(0, 200);
        if (errText.includes('famous_voice_not_permitted')) {
          return { ok: false, detail: 'configured voice is a famous voice — not usable via API TTS' };
        }
        return { ok: false, detail: `TTS failed (${res.status})` };
      } catch {
        return { ok: false, detail: 'ElevenLabs unreachable (offline or timeout)' };
      }
    },
    fixCmd: 'set ELEVENLABS_VOICE_ID to an API-permitted (premade/cloned) voice in <configRoot>/.env',
  },
];

// ── manifest io ──────────────────────────────────────────────────────────────

function loadManifest(): Manifest {
  if (existsSync(MANIFEST)) {
    try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
  }
  return {
    version: 1, updatedAt: new Date().toISOString(),
    note: 'Advisory cache, not truth. Written only by LIFEOS/TOOLS/Doctor.ts. Readers must treat entries past ttlHours as stale and re-verify doctrine-critical capabilities live.',
    capabilities: {}, ackedBroken: [],
  };
}

function salt(): string {
  if (!existsSync(SALT_FILE)) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(SALT_FILE, randomBytes(32).toString('hex'));
    try { chmodSync(SALT_FILE, 0o600); } catch {}
  }
  return readFileSync(SALT_FILE, 'utf8').trim();
}

function computeIntegrity(m: Manifest): string {
  const { integrity: _drop, ...body } = m;
  return createHash('sha256').update(salt() + JSON.stringify(body)).digest('hex');
}

function saveManifest(m: Manifest): void {
  m.updatedAt = new Date().toISOString();
  m.integrity = computeIntegrity(m);
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
  // Display sidecar for the statusline: precomputed here so the shell script
  // renders with a bare `cat` — no bun spawn, no hash math, per refresh tick.
  const broken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  const fresh = broken.filter(id => !(m.ackedBroken || []).includes(id));
  writeFileSync(join(STATE_DIR, 'capabilities-statusline.txt'),
    fresh.length ? `⚠ ${fresh.length} capability regression — lifeos doctor` : '');
}

function isStale(r: CapResult): boolean {
  return Date.now() - Date.parse(r.checkedAt) > r.ttlHours * 3_600_000;
}

// ── commands ─────────────────────────────────────────────────────────────────

async function probeAll(network: boolean): Promise<Manifest> {
  const m = loadManifest();
  for (const cap of CAPS) {
    const prev = m.capabilities[cap.id];
    if (prev?.state === 'declined') continue; // declined is silent and sticky

    if (!cap.configured()) {
      m.capabilities[cap.id] = {
        state: 'broken', checkedAt: new Date().toISOString(), ttlHours: cap.ttlHours,
        detail: 'not set up on this machine', fixCmd: cap.fixCmd, probeClass: 'offline',
      };
      continue;
    }
    let res = await cap.probeOffline();
    let probeClass: 'offline' | 'network' = 'offline';
    if (res.ok && network && cap.probeNetwork) {
      res = await cap.probeNetwork();
      probeClass = 'network';
    }
    m.capabilities[cap.id] = {
      state: res.ok ? 'live' : 'broken',
      checkedAt: new Date().toISOString(), ttlHours: cap.ttlHours,
      detail: res.detail, fixCmd: res.ok ? null : cap.fixCmd, probeClass,
    };
  }
  saveManifest(m);
  writeFileSync(HEARTBEAT, JSON.stringify({ ranAt: new Date().toISOString(), network }, null, 2));
  return m;
}

function renderTable(m: Manifest): string {
  const lines: string[] = ['', 'LifeOS Doctor — capability check', ''];
  for (const cap of CAPS) {
    const r = m.capabilities[cap.id];
    if (!r) continue;
    const stale = r.state !== 'declined' && isStale(r);
    const icon = r.state === 'live' ? (stale ? '◌' : '✅')
      : r.state === 'declined' ? '⏸'
      : r.state === 'broken' ? '❌' : '◌';
    const label = r.state === 'declined' ? 'off (declined)' : stale ? `${r.state} (stale — re-run doctor)` : r.state;
    lines.push(`${icon} ${cap.title} — ${label}`);
    lines.push(`   powers: ${cap.powers}`);
    if (r.state !== 'declined') lines.push(`   ${r.detail}`);
    if (r.state === 'broken' && r.fixCmd) lines.push(`   fix: ${r.fixCmd}`);
    lines.push('');
  }
  lines.push('Re-run any time: bun <configRoot>/LIFEOS/TOOLS/Doctor.ts  (add --network for live auth checks)');
  lines.push('Opt out of a capability forever: bun ... Doctor.ts decline <name>  — declined is silent, never nagged.');
  return lines.join('\n');
}

function statuslineGlyph(): string {
  if (!existsSync(MANIFEST)) return '';
  let m: Manifest;
  try { m = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { return ''; }
  if (m.integrity && m.integrity !== computeIntegrity(m)) return '⚠ doctor: manifest tampered';
  const broken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  const fresh = broken.filter(id => !(m.ackedBroken || []).includes(id));
  return fresh.length ? `⚠ ${fresh.length} capability regression — lifeos doctor` : '';
}

// ── main ─────────────────────────────────────────────────────────────────────

// ── reconciler: declared (hooks on disk) vs registered (settings.json) ──────
// v1 scope: hooks only, two inventories. "Observed" (fire evidence from
// observability logs) is deferred — noted in the output so absence is loud.
function reconcileHooks(): { unwired: string[]; missing: string[]; note: string } {
  const hooksDir = join(CONFIG_ROOT, 'hooks');
  const settingsPath = join(CONFIG_ROOT, 'settings.json');
  const declared = existsSync(hooksDir)
    ? readdirSync(hooksDir).filter(f => f.endsWith('.hook.ts') || f.endsWith('.hook.sh'))
    : [];
  let registeredBlob = '';
  try {
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    registeredBlob = JSON.stringify(s.hooks || {});
  } catch {}
  // Direct registration by filename, then expand through dispatcher imports:
  // registered hooks that import sibling hook files wire them indirectly
  // (e.g. a PreToolUse dispatcher invoking per-domain guards). Without this
  // expansion the reconciler cries wolf on every dispatched hook.
  const registered = new Set(declared.filter(f => registeredBlob.includes(f)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of [...registered]) {
      let src = '';
      try { src = readFileSync(join(hooksDir, f), 'utf8'); } catch { continue; }
      for (const g of declared) {
        if (registered.has(g)) continue;
        const base = g.replace(/\.hook\.(ts|sh)$/, '');
        // Real import/require statements only — a comment mention is not wiring.
        if (new RegExp(`(?:from\\s+['"]\\./${base}\\.hook['"]|require\\(['"]\\./${base}\\.hook['"]\\)|import\\(['"]\\./${base}\\.hook['"]\\))`).test(src)) {
          registered.add(g); grew = true;
        }
      }
    }
  }
  const unwired = declared.filter(f => !registered.has(f));
  // wired-but-missing: registered commands referencing hook files not on disk
  const missing = [...registeredBlob.matchAll(/([A-Za-z0-9_-]+\.hook\.(?:ts|sh))/g)]
    .map(m => m[1]).filter((f, i, a) => a.indexOf(f) === i)
    .filter(f => !declared.includes(f));
  return { unwired, missing, note: 'v1 reconciles declared (hooks/ dir) vs registered (settings.json); observed-fire evidence deferred' };
}

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);

if (flag('--statusline')) {
  console.log(statuslineGlyph());
  process.exit(0);
}

if (flag('--reconcile')) {
  const r = reconcileHooks();
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

if (flag('--verify')) {
  if (!existsSync(MANIFEST)) { console.log('no manifest yet — run Doctor first'); process.exit(0); }
  const m: Manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const ok = !!m.integrity && m.integrity === computeIntegrity(m);
  console.log(ok ? 'integrity OK' : 'INTEGRITY FAILURE — manifest was edited outside Doctor. Re-run Doctor to regenerate.');
  process.exit(ok ? 0 : 2);
}

if (args[0] === 'decline' || args[0] === 'enable') {
  const id = args[1];
  const cap = CAPS.find(c => c.id === id);
  if (!cap) { console.log(`unknown capability "${id}" — known: ${CAPS.map(c => c.id).join(', ')}`); process.exit(0); }
  const m = loadManifest();
  if (args[0] === 'decline') {
    m.capabilities[id] = {
      state: 'declined', checkedAt: new Date().toISOString(), ttlHours: 24 * 365,
      detail: 'declined by user — permanently silent', fixCmd: null, probeClass: 'offline',
    };
    m.ackedBroken = (m.ackedBroken || []).filter(x => x !== id);
    console.log(`${cap.title}: off (declined). It will never warn or nag. Re-enable: bun ... Doctor.ts enable ${id}`);
  } else {
    delete m.capabilities[id];
    console.log(`${cap.title}: re-enabled — run Doctor to probe it.`);
  }
  saveManifest(m);
  process.exit(0);
}

if (args[0] === 'ack') {
  const m = loadManifest();
  m.ackedBroken = Object.entries(m.capabilities)
    .filter(([, r]) => r.state === 'broken').map(([id]) => id);
  saveManifest(m);
  console.log(`acknowledged ${m.ackedBroken.length} broken capabilit${m.ackedBroken.length === 1 ? 'y' : 'ies'} — statusline stays quiet until something NEW regresses.`);
  process.exit(0);
}

const network = flag('--network') && !flag('--no-network');
const m = await probeAll(network);
if (flag('--json')) {
  console.log(JSON.stringify(m, null, 2));
} else {
  console.log(renderTable(m));
}
process.exit(0);
