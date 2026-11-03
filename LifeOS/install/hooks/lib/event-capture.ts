/**
 * @version 1.0.1
 * event-capture.ts — what EventLogger.hook.ts writes to disk, and how.
 *
 * Extracted from EventLogger.hook.ts so the capture logic is testable without
 * running the hook (the hook calls main() on import). Every string that lands
 * in an observability file goes through `capture()` / `previewJson()`: redact
 * secret-shaped values FIRST, then truncate, so a cut can never split a token
 * into a tail that no longer matches a shape. Every append goes through
 * `appendPrivateLine()`, which keeps the file at 0600.
 * GHSA-8qfr-7fpx-68x9, @godagoo.
 * The redactor is label-redact.ts: secret shapes plus any value under a credential label,
 * whatever its length (hooks audit ac item 4, 2026-10-13).
 */

import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { isSecretLabel, redactLabelled, redactStructured } from './label-redact';
import { invariant } from '../../LIFEOS/TOOLS/Invariant';
import { hasPosixModes } from './portable-path';

/** Extra text redacted past the cut point before truncating. A token that starts
 * inside the kept window and runs past it is still a shape match on this span,
 * and the bound keeps regex work per field small when stdout is megabytes. */
const REDACT_MARGIN = 4096;
const PRIVATE_MODE = 0o600;

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
}

/** Redact, then truncate with the `...[truncated]` marker. */
export function capture(s: string, max: number): string {
  return truncate(redactLabelled(s.slice(0, max + REDACT_MARGIN)), max);
}

/** JSON preview of a tool input: redact the structured value (every leaf under a credential label,
 * every string leaf by shape and label), serialize, redact the text again, then cut with the legacy
 * `...` marker. Redacting before serialization means an escaped quote inside a value can never end
 * the redaction early (2026-10-14). */
export function previewJson(value: unknown, max: number): string {
  const raw = JSON.stringify(redactStructured(value)) ?? '';
  const clean = redactLabelled(raw.slice(0, max + REDACT_MARGIN));
  return clean.length > max ? clean.slice(0, max) + '...' : clean;
}

// ── Ground truth (PostToolUse) ────────────────────────────────────────────

// Tools that mutate filesystem state — capture extra ground truth.
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const BASH_TOOLS = new Set(['Bash']);

function gitSnapshot(cwd: string): { head?: string; dirty?: boolean } | undefined {
  try {
    const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 500,
    }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 500,
    });
    return { head, dirty: status.trim().length > 0 };
  } catch {
    return undefined;
  }
}

export function captureGroundTruth(
  toolName: string,
  input: Record<string, unknown>,
  response: unknown,
  cwd: string = process.cwd(),
): Record<string, unknown> | undefined {
  const gt: Record<string, unknown> = {};

  if (WRITE_TOOLS.has(toolName) && typeof input.file_path === 'string') {
    gt.file_path = input.file_path;
    // Edit/MultiEdit carry the before/after diff in args; capture bounded.
    if (typeof input.old_string === 'string' && typeof input.new_string === 'string') {
      gt.diff = {
        removed: capture(input.old_string, 500),
        added: capture(input.new_string, 500),
      };
    }
    if (typeof input.content === 'string') {
      gt.content_preview = capture(input.content, 500);
      gt.content_bytes = input.content.length;
    }
    const gs = gitSnapshot(cwd);
    if (gs) gt.git = gs;
  }

  if (BASH_TOOLS.has(toolName) && typeof input.command === 'string') {
    gt.command = capture(input.command, 500);
    // Claude Code puts stdout/stderr/exit in tool_response — shape varies.
    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      if ('stdout' in r && typeof r.stdout === 'string') {
        gt.stdout_preview = capture(r.stdout, 800);
        gt.stdout_bytes = r.stdout.length;
      }
      if ('stderr' in r && typeof r.stderr === 'string') {
        gt.stderr_preview = capture(r.stderr, 800);
      }
      if ('exit_code' in r || 'exitCode' in r) {
        gt.exit_code = r.exit_code ?? r.exitCode;
      }
    }
  }

  return Object.keys(gt).length > 0 ? gt : undefined;
}

// ── Private JSONL append ──────────────────────────────────────────────────

/** Append one JSON line, creating the file 0600 and tightening an existing
 * file to 0600 (appendFileSync's `mode` applies only on create). */
export function appendPrivateLine(filePath: string, record: unknown): void {
  const line = JSON.stringify(record);
  invariant(typeof line === 'string' && !line.includes('\n'), 'JSONL record serializes to exactly one line');
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, line + '\n', { encoding: 'utf-8', mode: PRIVATE_MODE });
  chmodSync(filePath, PRIVATE_MODE);
}

const PRIVATE_DIR_MODE = 0o700;

/** Create `dir` (and parents) 0700, and strip group/other bits from an existing `dir`. */
export function ensurePrivateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: PRIVATE_DIR_MODE });
  const mode = statSync(dir).mode & 0o777;
  if (mode & 0o077) chmodSync(dir, mode & PRIVATE_DIR_MODE);
  // Windows reports 0o666 for every directory; the profile ACL keeps it private there.
  if (hasPosixModes()) invariant((statSync(dir).mode & 0o077) === 0, 'private record directory is owner-only');
}

/** appendPrivateLine into a private directory: the file is 0600 and its directory owner-only,
 * whether either existed before or not (2026-10-14). */
export function appendPrivateRecord(filePath: string, record: unknown): void {
  ensurePrivateDir(dirname(filePath));
  appendPrivateLine(filePath, record);
  if (hasPosixModes()) invariant((statSync(filePath).mode & 0o777) === PRIVATE_MODE, 'private record file is 0600');
}

// ── Settings snapshot diff (ConfigChange) ─────────────────────────────────

const HASHED_ENV_VALUE = /^sha256:[0-9a-f]{64}$/;

/** Every `env` value → `sha256:<hex>`. Idempotent, so an already-hashed
 * snapshot read back from disk compares equal to freshly hashed settings. */
function hashEnvValues(settings: Record<string, unknown>): Record<string, unknown> {
  const env = settings.env;
  if (!env || typeof env !== 'object' || Array.isArray(env)) return settings;
  const hashed: Record<string, string> = {};
  for (const [k, v] of Object.entries(env as Record<string, unknown>)) {
    const text = typeof v === 'string' ? v : JSON.stringify(v) ?? '';
    hashed[k] = HASHED_ENV_VALUE.test(text) ? text : `sha256:${createHash('sha256').update(text).digest('hex')}`;
  }
  return { ...settings, env: hashed };
}

/** A value's stable stand-in: change still diffs, the value never persists. Idempotent. */
function hashLeaf(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return HASHED_ENV_VALUE.test(text) ? text : `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

/** Containers whose every leaf is a credential carrier: an MCP server's `env` and `headers`. */
const CREDENTIAL_CONTAINERS = new Set(['env', 'headers']);

/**
 * True when a settings key labels its value as a secret: the shared classifier in
 * label-redact.ts (`isSecretLabel`), judged by the key's last word or two, so
 * `apiKeyHelper` (a script path) and `maxTokens` (a count) stay readable. A private
 * word list here drifted from the shared one and let `pwd` and `apikey` values
 * persist in snapshots (2026-10-14).
 */
export function isSecretKey(key: string): boolean {
  return isSecretLabel(key);
}

/** Redact every string leaf, and hash every leaf a key labels as a secret or that
 * sits in a credential container. Value-shape redaction alone missed secrets with
 * no recognisable shape (`"password": "hunter2"`, an `X-API-Key` header), which
 * the snapshot then kept (LOSIntegrity 2026-10-13). Walking
 * the parsed value (instead of redacting the serialized JSON) keeps the result
 * valid JSON: a PEM header with no END would otherwise redact through the
 * closing quotes. */
function redactDeep(value: unknown, sensitive = false): unknown {
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, sensitive));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactDeep(v, sensitive || isSecretKey(k) || CREDENTIAL_CONTAINERS.has(k.toLowerCase()));
    }
    return out;
  }
  if (sensitive && value !== null && value !== undefined) return hashLeaf(value);
  if (typeof value === 'string') return redactLabelled(value);
  return value;
}

/** True when every leaf under a secret-labelled key or credential container is a hash. */
function secretLeavesHashed(value: unknown, sensitive = false): boolean {
  if (Array.isArray(value)) return value.every((v) => secretLeavesHashed(v, sensitive));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).every(([k, v]) =>
      secretLeavesHashed(v, sensitive || isSecretKey(k) || CREDENTIAL_CONTAINERS.has(k.toLowerCase())));
  }
  return !sensitive || value === null || value === undefined || (typeof value === 'string' && HASHED_ENV_VALUE.test(value));
}

/** The form a settings object takes on disk and in every comparison. */
export function normalizeSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return redactDeep(hashEnvValues(settings)) as Record<string, unknown>;
}

/**
 * Diff current settings.json against the cached snapshot, then replace the
 * snapshot. Both sides are normalized (env hashed, strings redacted), so the
 * snapshot never holds a secret and an old raw snapshot does not diff as changed.
 * Returns the top-level keys that changed, plus a summary string.
 */
export function diffSettings(settingsPath: string, snapshotPath: string): { changedKeys: string[]; summary: string } {
  let current: Record<string, unknown> = {};
  let snapshot: Record<string, unknown> = {};

  try {
    current = normalizeSettings(JSON.parse(readFileSync(settingsPath, 'utf-8')));
  } catch {
    return { changedKeys: ['settings.json'], summary: 'could not read settings.json' };
  }

  try {
    if (existsSync(snapshotPath)) {
      snapshot = normalizeSettings(JSON.parse(readFileSync(snapshotPath, 'utf-8')));
    }
  } catch {
    // No snapshot or corrupt — treat everything as new
  }

  // Save new snapshot for next comparison
  try {
    const env = current.env;
    invariant(
      !env || typeof env !== 'object' || Array.isArray(env) || Object.values(env).every((v) => typeof v === 'string' && HASHED_ENV_VALUE.test(v)),
      'settings snapshot holds only hashed env values',
    );
    invariant(secretLeavesHashed(current), 'settings snapshot holds only hashed values under secret-labelled keys');
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify(current), { encoding: 'utf-8', mode: PRIVATE_MODE });
    chmodSync(snapshotPath, PRIVATE_MODE);
  } catch (e) {
    if (e instanceof Error && e.name === 'InvariantViolation') throw e;
    // Non-fatal I/O
  }

  // If no prior snapshot, we can't diff
  if (Object.keys(snapshot).length === 0) {
    return { changedKeys: ['initial'], summary: 'initial snapshot (no prior to diff)' };
  }

  // Compare top-level keys
  const allKeys = new Set([...Object.keys(current), ...Object.keys(snapshot)]);
  const changed: string[] = [];
  const summaryParts: string[] = [];

  for (const key of allKeys) {
    const curVal = JSON.stringify(current[key]);
    const snapVal = JSON.stringify(snapshot[key]);

    if (curVal !== snapVal) {
      changed.push(key);

      if (!(key in snapshot)) {
        summaryParts.push(`${key}: added`);
      } else if (!(key in current)) {
        summaryParts.push(`${key}: removed`);
      } else if (typeof current[key] === 'object' && current[key] && typeof snapshot[key] === 'object' && snapshot[key]) {
        // For arrays/objects, show what changed at the second level (names only)
        const curObj = current[key] as Record<string, unknown>;
        const snapObj = snapshot[key] as Record<string, unknown>;
        const subKeys = new Set([...Object.keys(curObj), ...Object.keys(snapObj)]);
        const subChanged: string[] = [];
        for (const sk of subKeys) {
          if (JSON.stringify(curObj[sk]) !== JSON.stringify(snapObj[sk])) subChanged.push(sk);
        }
        if (subChanged.length <= 3) {
          summaryParts.push(`${key}.{${subChanged.join(',')}}: modified`);
        } else {
          summaryParts.push(`${key}: ${subChanged.length} sub-keys modified`);
        }
      } else {
        summaryParts.push(`${key}: → ${redactLabelled(JSON.stringify(current[key]) ?? '').slice(0, 80)}`);
      }
    }
  }

  if (changed.length === 0) {
    return { changedKeys: ['unchanged'], summary: 'no diff detected (possible race)' };
  }

  return { changedKeys: changed, summary: summaryParts.join('; ') };
}
