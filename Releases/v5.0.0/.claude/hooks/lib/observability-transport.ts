// observability-transport.ts -- Transport module for PAI observability pipeline
//
// Extracts CF KV logic from isa-utils.ts and adds configurable target routing.
// Targets are defined in settings.json → observability.targets as ObservabilityTarget[].
//
// Exports:
//   pushStateToTargets()  -- clean stale sessions, read work.json, fan out to all targets
//   pushEventsToTargets() -- collect recent events from JSONL sources, fan out to all targets

import { getObservabilityConfig } from './identity';
import { readRegistry, writeRegistry, WORK_JSON } from './isa-utils';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ObservabilityTarget } from './identity';
import { getEnvPath } from './paths';
import { getMemoryDir } from './paths';

function readEnvOrPaiEnv(keys: readonly string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }

  try {
    const envPath = getEnvPath();
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, '');
    }
    for (const k of keys) {
      if (env[k]) return env[k];
    }
  } catch {}

  return '';
}

/**
 * Resolve Cloudflare API token.
 * Tries CLOUDFLARE_API_TOKEN_WORKERS_EDIT first, then falls back to
 * CLOUDFLARE_API_TOKEN (the one main token). Checks env vars, then ~/.claude/.env.
 */
function getCFToken(): string {
  const KEYS = ['CLOUDFLARE_API_TOKEN_WORKERS_EDIT', 'CLOUDFLARE_API_TOKEN'] as const;
  return readEnvOrPaiEnv(KEYS);
}

function getCFAccountId(): string {
  const value = readEnvOrPaiEnv(['CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID'] as const);
  if (value) return value;

  process.stderr.write(
    '[observability-transport] CLOUDFLARE_ACCOUNT_ID / CF_ACCOUNT_ID missing; CF KV transport will be skipped\n'
  );
  return '';
}

function getCFNamespaceId(): string {
  const value = readEnvOrPaiEnv(['CLOUDFLARE_KV_NAMESPACE_ID', 'CF_KV_NAMESPACE_ID'] as const);
  if (value) return value;

  process.stderr.write(
    '[observability-transport] CLOUDFLARE_KV_NAMESPACE_ID / CF_KV_NAMESPACE_ID missing; CF KV transport will be skipped\n'
  );
  return '';
}

/**
 * Clean stale sessions from the registry.
 * Age is measured against the newer of `lastToolActivity` and `updatedAt` so
 * an idle tab (no tool calls) is recognized as stale even if prompts keep
 * bumping `updatedAt`.
 * - Native/starting sessions older than 30 min
 * - Any session (including complete) older than 2 hours
 * Writes back if any sessions were cleaned. Returns true if cleaned.
 */
function cleanStaleSessions(): boolean {
  const registry = readRegistry();
  const now = Date.now();
  const THIRTY_MIN = 30 * 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  let cleaned = false;

  for (const [slug, session] of Object.entries(registry.sessions) as [string, any][]) {
    const updatedMs = new Date(session.updatedAt || session.started || 0).getTime();
    const toolMs = session.lastToolActivity ? new Date(session.lastToolActivity).getTime() : 0;
    const lastAlive = Math.max(updatedMs, toolMs);
    const age = now - lastAlive;
    const phase = (session.phase || '').toLowerCase();

    if ((phase === 'native' || phase === 'starting') && age > THIRTY_MIN) {
      delete registry.sessions[slug];
      cleaned = true;
    } else if (phase === 'complete' && age > TWO_HOURS) {
      delete registry.sessions[slug];
      cleaned = true;
    } else if (age > TWO_HOURS) {
      delete registry.sessions[slug];
      cleaned = true;
    }
  }

  if (cleaned) writeRegistry(registry);
  return cleaned;
}

/**
 * Collect recent events from JSONL sources.
 * Reads voice-events.jsonl and tool-failures.jsonl, takes last 50 per source,
 * merges with normalized fields, sorts ascending by timestamp, keeps last 200.
 */
function collectEvents(): any[] {
  const memoryDir = getMemoryDir();
  // Per-source counts match Observability/observability.ts handleEventsRecentApi()
  const sources = [
    { path: join(memoryDir, 'VOICE', 'voice-events.jsonl'), source: 'voice', count: 50 },
    { path: join(memoryDir, 'OBSERVABILITY', 'tool-failures.jsonl'), source: 'tool-failure', count: 50 },
    { path: join(memoryDir, 'OBSERVABILITY', 'tool-activity.jsonl'), source: 'tool-activity', count: 100 },
    { path: join(memoryDir, 'OBSERVABILITY', 'subagent-events.jsonl'), source: 'subagent', count: 50 },
  ];

  const allEvents: any[] = [];

  for (const s of sources) {
    try {
      if (!existsSync(s.path)) continue;
      const content = readFileSync(s.path, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      const recent = lines.slice(-s.count);
      for (const line of recent) {
        try {
          const parsed = JSON.parse(line);
          allEvents.push({
            timestamp: parsed.timestamp || new Date().toISOString(),
            session_id: parsed.session_id || '',
            source: s.source,
            type: parsed.event || parsed.type || s.source,
            ...parsed,
          });
        } catch {}
      }
    } catch {}
  }

  // Sort newest first (matches Observability/observability.ts), keep first 200
  allEvents.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime() || 0;
    const tb = new Date(b.timestamp).getTime() || 0;
    return tb - ta;
  });

  return allEvents.slice(0, 200);
}

/**
 * Push payload to an HTTP target.
 * POST to target.url + endpoint with JSON body, 5s timeout.
 * Includes target.headers if present.
 */
async function pushToHTTPTarget(target: ObservabilityTarget, endpoint: string, body: string): Promise<void> {
  if (!target.url) return;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(target.headers || {}),
  };

  await fetch(`${target.url}${endpoint}`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Push payload to Cloudflare KV.
 * PUT to CF KV API with bearer token, 8s timeout.
 * Silently returns if no token is available.
 */
async function pushToCFKV(key: string, body: string): Promise<void> {
  const accountId = getCFAccountId();
  const namespaceId = getCFNamespaceId();
  if (!accountId || !namespaceId) return;

  const token = getCFToken();
  if (!token) {
    process.stderr.write(
      `[pushToCFKV] ${key}: no CF token resolved (set CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_TOKEN_WORKERS_EDIT in ~/.claude/.env)\n`
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Push work state to all configured observability targets.
 * Cleans stale sessions first, reads work.json, then fans out via Promise.allSettled.
 */
export async function pushStateToTargets(): Promise<void> {
  try {
    cleanStaleSessions();

    if (!existsSync(WORK_JSON)) return;
    const workData = readFileSync(WORK_JSON, 'utf-8');

    const config = getObservabilityConfig();
    const promises = config.targets.map(async (target) => {
      try {
        if (target.type === 'cloudflare-kv') {
          await pushToCFKV('sync:work_state', workData);
        } else if (target.type === 'http') {
          await pushToHTTPTarget(target, '/api/observability/state', workData);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[pushStateToTargets] ${target.name}: ${msg}\n`);
      }
    });

    await Promise.allSettled(promises);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[pushStateToTargets] Failed: ${msg}\n`);
  }
}

/**
 * Push collected events to all configured observability targets.
 * Collects recent events from JSONL sources, then fans out via Promise.allSettled.
 */
export async function pushEventsToTargets(): Promise<void> {
  try {
    const events = collectEvents();
    const eventsJson = JSON.stringify(events);

    const config = getObservabilityConfig();
    const promises = config.targets.map(async (target) => {
      try {
        if (target.type === 'cloudflare-kv') {
          await pushToCFKV('sync:events', eventsJson);
        } else if (target.type === 'http') {
          await pushToHTTPTarget(target, '/api/observability/events', eventsJson);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[pushEventsToTargets] ${target.name}: ${msg}\n`);
      }
    });

    await Promise.allSettled(promises);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[pushEventsToTargets] Failed: ${msg}\n`);
  }
}
