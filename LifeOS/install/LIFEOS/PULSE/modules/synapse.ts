import { PRIVATE_SKILL_NAMES } from "../../TOOLS/CodeDataBoundary.ts";
/**
 * Synapse Pulse module — read-only surface over the Synapse input router (the capture/grade/route loop).
 *
 * Composes live numbers from four independent probes (each fail-soft):
 *   ledger    — the install's amber-ledger worker (/stats, /captures), discovered by name
 *   knowledge — MEMORY/KNOWLEDGE note counts by `created:` frontmatter
 *   bookmarks — SEEN_BOOKMARKS KV key count (Cloudflare API) + local social-platform skill state
 *   sheet     — per-path observed sends (cloud bookmark cron + surface saves);
 *               the hotkey path has no local counter and is labeled as such
 *
 * Route: GET /api/synapse → { generated_at, ledger, knowledge, bookmarks, sheet, inputs, errors }
 *
 * Instance wiring is resolved at runtime from USER-zone sources — nothing
 * principal-specific lives in this file: the workers.dev subdomain comes from
 * ~/.config/workflows/config.yaml (`subdomain:`), worker names and the KV
 * namespace id from the WORKFLOWS wrangler configs under USER/CUSTOMIZATIONS.
 * Secrets (Workflows bearer, CF token) never leave this process — the dashboard
 * page consumes only the composed JSON.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { workflowsConfigPath } from "../../TOOLS/WorkflowsConfig";
import { lifeosPath } from "../../TOOLS/Paths.ts";

const MODULE_NAME = "synapse";
const HOME = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const KNOWLEDGE_DIR = join(HOME, "LIFEOS", "MEMORY", "KNOWLEDGE");
const X_STATE_DIR = join(HOME, "skills", PRIVATE_SKILL_NAMES.social, "State");
const ENV_PATH = join(HOME, ".env");
const WORKFLOWS_CFG = workflowsConfigPath();
const WORKFLOWS_WORKERS = join(HOME, "LIFEOS", "USER", "CUSTOMIZATIONS", "WORKFLOWS", "Workers");

const CACHE_TTL_MS = 60_000;

const state: { running: boolean; cache: { payload: unknown; expiresAt: number } | null; cfAccountId: string | null } = {
  running: false,
  cache: null,
  cfAccountId: null,
};

function workflowsCfg(key: string): string | null {
  try {
    const m = readFileSync(WORKFLOWS_CFG, "utf8").match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/** Every Worker config (cloudflare.config.ts, or legacy wrangler.jsonc) under the USER Workflows Workers tree, discovered — this
 *  file ships, so it names no per-instance worker directory. Which workers an
 *  install has is that install's business; we find them by CONTENT (wrangler
 *  `name:` fields, KV bindings), never by hardcoded dir name. */
function workerConfigs(): string[] {
  try {
    return readdirSync(WORKFLOWS_WORKERS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ["cloudflare.config.ts", "wrangler.jsonc"].map((f) => join(WORKFLOWS_WORKERS, d.name, f)).find((p) => existsSync(p)))
      .filter((p): p is string => !!p);
  } catch { return []; }
}

/** Ledger worker base URL: env override, else discovered wrangler name (`*amber-ledger*`) + subdomain (Workflows config). */
function ledgerBase(): string | null {
  if (process.env.AMBER_LEDGER_URL) return process.env.AMBER_LEDGER_URL.replace(/\/$/, "");
  try {
    for (const cfg of workerConfigs()) {
      const cfgText = readFileSync(cfg, "utf8");
      const name = (cfgText.match(/"name":\s*"([^"]+)"/) ?? cfgText.match(/\bname\s*:\s*["']([^"']+)["']/))?.[1];
      if (!name || !name.includes("amber-ledger")) continue;
      const sub = workflowsCfg("subdomain");
      return sub ? `https://${name}.${sub}.workers.dev` : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** SEEN_BOOKMARKS KV namespace id — discovered by BINDING NAME across the install's worker configs. */
function seenBookmarksKvId(): string | null {
  try {
    for (const cfg of workerConfigs()) {
      const m = readFileSync(cfg, "utf8").match(/"binding":\s*"SEEN_BOOKMARKS",\s*"id":\s*"([a-f0-9]+)"/s);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

function cfToken(): string | null {
  try {
    const m = readFileSync(ENV_PATH, "utf8").match(/^CLOUDFLARE_API_TOKEN=["']?([^"'\n]+)["']?/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function ledgerReq(path: string): Promise<any> {
  const base = ledgerBase();
  const token = workflowsCfg("auth_token");
  if (!base) throw new Error("amber ledger URL unresolvable");
  if (!token) throw new Error("no Workflows auth_token");
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ledger ${path} HTTP ${res.status}`);
  return res.json();
}

async function cfReq(path: string, token: string): Promise<any> {
  const res = await fetch("https://api.cloudflare.com/client/v4" + path, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`cf ${path} HTTP ${res.status}`);
  return res.json();
}

/** Count keys in the SEEN_BOOKMARKS namespace (cursor-paginated). */
async function countSeenBookmarksKV(): Promise<number> {
  const token = cfToken();
  if (!token) throw new Error("no CLOUDFLARE_API_TOKEN");
  const nsId = seenBookmarksKvId();
  if (!nsId) throw new Error("SEEN_BOOKMARKS namespace id unresolvable");
  if (!state.cfAccountId) {
    const acct = await cfReq("/accounts?per_page=1", token);
    state.cfAccountId = acct.result?.[0]?.id ?? null;
    if (!state.cfAccountId) throw new Error("no CF account id");
  }
  let count = 0;
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const qs = cursor ? `?limit=1000&cursor=${encodeURIComponent(cursor)}` : "?limit=1000";
    const out = await cfReq(`/accounts/${state.cfAccountId}/storage/kv/namespaces/${nsId}/keys${qs}`, token);
    count += out.result?.length ?? 0;
    cursor = out.result_info?.cursor ?? "";
    if (!cursor) break;
  }
  return count;
}

/**
 * KNOWLEDGE notes by `created:` frontmatter — total + 7d/30d windows, per type dir.
 * These are ARCHIVE-WIDE creation counts (every pipeline that writes notes), NOT
 * Synapse output. `amber_promoted` is the ledger-specific number: notes carrying a
 * `source_amber_id` frontmatter key, i.e. promoted from the amber ledger by `amber route`.
 */
// Wiki-page category names per KNOWLEDGE dir — must match the wiki module's
// domainToCategory so /knowledge?category=…&slug=… links resolve.
const DIR_TO_WIKI_CATEGORY: Record<string, string> = {
  Ideas: "idea", People: "person", Companies: "company",
  Research: "research", Blogs: "blog", Books: "book",
};

type KnowledgeCounts = {
  total: number; last7d: number; last30d: number; amber_promoted: number;
  by_type: Record<string, { total: number; last7d: number; last30d: number }>;
  amber_notes: Record<string, { category: string; slug: string }>;
  recent: { title: string; category: string; slug: string; type: string; created: string }[];
};

/** What one note's frontmatter head contributes. Cached per path by mtime+size,
 *  so a rescan re-reads only notes that changed. */
type NoteHead = { mtimeMs: number; size: number; amberId: string | null; created: string | null; t: number | null; title: string | null };
const HEAD_BYTES = 1200;
const SCAN_BATCH = 64;
const noteHeads = new Map<string, NoteHead>();

async function readNoteHead(file: string): Promise<NoteHead | null> {
  let fh: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const st = await stat(file);
    const cached = noteHeads.get(file);
    if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached;
    // created: sits in the frontmatter head; read only the head, never the whole note.
    fh = await open(file, "r");
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    const head = buf.subarray(0, bytesRead).toString("utf8");
    const created = head.match(/^created:\s*["']?([0-9T:.Z+-]+)/m)?.[1] ?? null;
    const parsed = created ? Date.parse(created) : NaN;
    const entry: NoteHead = {
      mtimeMs: st.mtimeMs,
      size: st.size,
      amberId: head.match(/^source_amber_id:\s*["']?([a-f0-9-]+)/m)?.[1] ?? null,
      created,
      t: Number.isNaN(parsed) ? null : parsed,
      title: head.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null,
    };
    noteHeads.set(file, entry);
    return entry;
  } catch {
    return null; // unreadable note — skip its dated fields
  } finally {
    await fh?.close().catch(() => {});
  }
}

/** Async and head-only (ISA ISC-23): the old synchronous full-file scan of ~9.5k
 *  notes blocked the Pulse event loop for 10-17 s on every cache miss. */
export async function knowledgeCounts(knowledgeDir: string = KNOWLEDGE_DIR, nowMs: number = Date.now()): Promise<KnowledgeCounts> {
  const now = nowMs;
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;
  const by_type: Record<string, { total: number; last7d: number; last30d: number }> = {};
  const amber_notes: Record<string, { category: string; slug: string }> = {};
  const recent: { title: string; category: string; slug: string; type: string; created: string; _t: number }[] = [];
  let total = 0, last7d = 0, last30d = 0, amber_promoted = 0;
  const typeDirs = ["Ideas", "People", "Companies", "Research", "Blogs", "Books"];
  const seen = new Set<string>();
  for (const dir of typeDirs) {
    const abs = join(knowledgeDir, dir);
    let names: string[];
    try { names = await readdir(abs); } catch { continue; }
    const files = names.filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    const bucket = { total: files.length, last7d: 0, last30d: 0 };
    total += files.length;
    for (let i = 0; i < files.length; i += SCAN_BATCH) {
      const batch = files.slice(i, i + SCAN_BATCH);
      const heads = await Promise.all(batch.map((f) => { const p = join(abs, f); seen.add(p); return readNoteHead(p); }));
      heads.forEach((h, j) => {
        if (!h) return;
        const f = batch[j];
        const slug = f.replace(/\.md$/, "");
        if (h.amberId) {
          amber_promoted++;
          amber_notes[h.amberId] = { category: DIR_TO_WIKI_CATEGORY[dir] ?? "idea", slug };
        }
        if (h.t === null || h.created === null) return;
        if (h.t >= d30) {
          last30d++; bucket.last30d++;
          recent.push({ title: h.title ?? slug, category: DIR_TO_WIKI_CATEGORY[dir] ?? "idea", slug, type: dir, created: h.created, _t: h.t });
        }
        if (h.t >= d7) { last7d++; bucket.last7d++; }
      });
    }
    by_type[dir] = bucket;
  }
  // Drop cache entries for notes that are gone from this directory tree.
  for (const p of noteHeads.keys()) if (p.startsWith(knowledgeDir) && !seen.has(p)) noteHeads.delete(p);
  recent.sort((a, b) => b._t - a._t);
  return {
    total, last7d, last30d, amber_promoted, by_type, amber_notes,
    recent: recent.slice(0, 40).map(({ _t, ...r }) => r),
  };
}

export function localBookmarkState(): {
  local_seen: number; issues_created: number; issues_skipped: number;
  recent_issues: { issue: number; url: string; created_at: string }[];
} {
  let local_seen = 0, issues_created = 0, issues_skipped = 0;
  const recent_issues: { issue: number; url: string; created_at: string }[] = [];
  const d30 = Date.now() - 30 * 86_400_000;
  try {
    const s = JSON.parse(readFileSync(join(lifeosPath("MEMORY", "STATE", "X"), "bookmarks-state.json"), "utf8"));
    local_seen = Array.isArray(s.seenIds) ? s.seenIds.length : 0;
  } catch { /* absent */ }
  try {
    const s = JSON.parse(readFileSync(join(X_STATE_DIR, "bookmark-issues.json"), "utf8"));
    for (const v of Object.values(s) as any[]) {
      if (v?.skipped) { issues_skipped++; continue; }
      issues_created++;
      const t = Date.parse(v?.created_at ?? "");
      if (v?.issue && v?.url && !Number.isNaN(t) && t >= d30) {
        recent_issues.push({ issue: v.issue, url: v.url, created_at: v.created_at });
      }
    }
  } catch { /* absent */ }
  recent_issues.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return { local_seen, issues_created, issues_skipped, recent_issues: recent_issues.slice(0, 40) };
}

// The input catalog mirrors SynapseSystem.md §Inputs — static topology, joined
// with live per-source ledger counts at request time.
const INPUTS = [
  { n: 1, name: "Summarize hotkey", trigger: "browser hotkey on any page", component: "summarize worker → sheet + ledger", status: "live", ledger_sources: [] as string[] },
  { n: 2, name: "Bookmarks → idea-issues", trigger: "bookmark sweep", component: "social-bookmark skill → Type:queue", status: "live", ledger_sources: [] },
  { n: 3, name: "Bookmarks → summarize (cloud)", trigger: "every-minute cron", component: "bookmark-summarize worker → sheet + ledger", status: "live", ledger_sources: ["x-bookmark"] },
  { n: 4, name: "Harvest → Knowledge", trigger: "harvest on a URL/video/text", component: "harvest skill → classify worker", status: "live", ledger_sources: [] },
  { n: 5, name: "Voice markers", trigger: "“begin idea … end idea” on the wearable", component: "lifelog skill", status: "live", ledger_sources: [] },
  { n: 6, name: "Feed pipeline", trigger: "RSS/YouTube/social polling", component: "feed-api → poller → processor", status: "live", ledger_sources: ["feed"] },
  { n: 7, name: "Reader save", trigger: "save/summarize in the reader", component: "summarize worker → ledger (service binding)", status: "live", ledger_sources: ["surface"] },
  { n: 8, name: "CLI / skill capture", trigger: "amber capture <url|text>", component: "amber CLI → ledger", status: "live", ledger_sources: ["cli"] },
  { n: 9, name: "Reader upvote → capture", trigger: "thumbs-up on a reader item", component: "—", status: "roadmap", ledger_sources: [] },
  { n: 10, name: "Gesture / wearable trigger", trigger: "physical trigger from anywhere", component: "—", status: "roadmap", ledger_sources: [] },
  { n: 11, name: "Email → capture", trigger: "forward to a capture address", component: "—", status: "roadmap", ledger_sources: [] },
];

/** One ledger capture row → dashboard shape. The Cortex note link prefers the
 *  ledger's own stored `routed_refs` (written at route time — survives note
 *  renames of OTHER notes, visible to every consumer); the filesystem
 *  frontmatter join stays as fallback for rows routed before refs existed. */
function mapCapture(c: any, knowledge: KnowledgeCounts | null): any {
  let actions: string[] | null = null;
  try {
    const a = c.routed_actions ? JSON.parse(c.routed_actions) : null;
    if (Array.isArray(a)) actions = a.filter((x) => typeof x === "string");
  } catch { /* malformed — leave null */ }
  let note: { category: string; slug: string } | null = null;
  try {
    const refs = c.routed_refs ? JSON.parse(c.routed_refs) : null;
    const r = Array.isArray(refs) ? refs.find((x: any) => x?.type === "knowledge_note" && x.category && x.slug) : null;
    if (r) note = { category: String(r.category), slug: String(r.slug) };
  } catch { /* malformed refs — fall back to the scan join */ }
  if (!note) note = knowledge?.amber_notes?.[c.id] ?? null;
  return {
    id: c.id,
    source: c.source,
    score: c.score ?? null,
    title: c.title || null,
    url: c.url || null,
    author: c.author || null,
    content_kind: c.content_kind || "other",
    excerpt: c.excerpt || null,
    grade_version: c.grade_version || null,
    routed_actions: actions,
    alert: c.alert || null,
    captured_at: c.captured_at,
    status: c.status,
    note,
  };
}

async function compose(): Promise<any> {
  const errors: Record<string, string> = {};

  const [ledgerStats, ledgerRecent, ledgerAlerts, cloudParsed] = await Promise.all([
    ledgerReq("/stats").catch((e) => { errors.ledger = String(e?.message ?? e); return null; }),
    ledgerReq("/captures?limit=50").catch((e) => { errors.captures = String(e?.message ?? e); return null; }),
    // unacked security alerts — acked rows carry alert='security_critical:acked' and don't match
    ledgerReq("/captures?alert=security_critical&limit=20").catch((e) => { errors.alerts = String(e?.message ?? e); return null; }),
    countSeenBookmarksKV().catch((e) => { errors.bookmarks_cloud = String(e?.message ?? e); return null; }),
  ]);

  let knowledge: KnowledgeCounts | null = null;
  try { knowledge = await knowledgeCounts(); } catch (e: any) { errors.knowledge = String(e?.message ?? e); }

  const local = localBookmarkState();

  const bySource: Record<string, number> = {};
  for (const r of ledgerStats?.by_source ?? []) bySource[r.source] = r.n;
  const byStatus: Record<string, number> = {};
  for (const r of ledgerStats?.by_status ?? []) byStatus[r.status] = r.n;

  return {
    generated_at: new Date().toISOString(),
    ledger: ledgerStats
      ? {
          total: ledgerStats.total,
          by_source: bySource,
          by_status: byStatus,
          captured: byStatus.captured ?? 0,
          routed: byStatus.routed ?? 0,
          recent: (ledgerRecent?.captures ?? []).map((c: any) => mapCapture(c, knowledge)),
        }
      : null,
    // Unacked security-critical captures — the global Pulse banner feed. Each
    // carries its Cortex note ref so the banner can deep-link the review.
    alerts: (ledgerAlerts?.captures ?? []).map((c: any) => mapCapture(c, knowledge)),
    // amber_notes is join material for `recent`, not a dashboard number — keep the payload lean
    knowledge: knowledge ? { ...knowledge, amber_notes: undefined } : null,
    bookmarks: {
      cloud_parsed: cloudParsed, // SEEN_BOOKMARKS KV — successful cron sends only (put gated on response.ok); 90d TTL rolling window
      ...local,
    },
    sheet: {
      // No local Google Sheets credential exists (the worker holds it), so
      // spreadsheet sends are reported per instrumented path, honestly.
      paths: [
        { name: "Bookmark cron → sheet", count: cloudParsed, note: "SEEN_BOOKMARKS KV keys — written only after a successful summarize → sheet send; 90-day KV TTL, so this is a rolling window. Ledger rows tag source=x-bookmark since 2026-08-28" },
        { name: "App saves + hotkey → sheet", count: bySource["surface"] ?? null, note: "ledger rows with source=surface — every summarize call dual-writes sheet + ledger; reader saves and the browser hotkey share this tag (per-caller attribution is the open sliver)" },
      ],
    },
    inputs: INPUTS.map((i) => ({
      ...i,
      ledger_count: i.ledger_sources.reduce((n, s) => n + (bySource[s] ?? 0), 0) || null,
    })),
    errors: Object.keys(errors).length ? errors : null,
  };
}

/** One compose at a time. A request that finds the cache expired gets the last
 *  payload at once while this refreshes it (ISA ISC-23); only the very first
 *  request with no payload at all waits, and it joins the run start() began. */
let inflight: Promise<unknown> | null = null;
let generation = 0; // bumped by an ack, so a compose begun before it never lands
function refresh(): Promise<unknown> {
  if (inflight) return inflight;
  const gen = generation;
  const run: Promise<unknown> = compose()
    .then((payload) => {
      if (gen === generation) state.cache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
      return payload;
    })
    .finally(() => { if (inflight === run) inflight = null; });
  inflight = run;
  return run;
}

export function start(): void {
  state.running = true;
  // Warm the cache so the first /api/synapse after a Pulse restart is not a cold scan.
  refresh().catch((e) => console.error(`[${MODULE_NAME}] warm compose failed: ${e?.message ?? e}`));
  console.log(`[${MODULE_NAME}] Started — serving /api/synapse`);
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  // POST /api/synapse/ack {id} — mark a security alert reviewed. The ack lives
  // in the ledger row itself (alert → 'security_critical:acked'), so it is
  // durable and visible to every consumer, not just this dashboard.
  if (pathname === "/api/synapse/ack") {
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
    let id: string | null = null;
    try { id = String((await req.json() as any)?.id || "") || null; } catch { /* no body */ }
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return Response.json({ error: "valid capture id required" }, { status: 400 });
    const base = ledgerBase();
    const token = workflowsCfg("auth_token");
    if (!base || !token) return Response.json({ error: "ledger unresolvable" }, { status: 502 });
    // Alert rows are only ever created at route time, so status is 'routed'
    // already — re-sending it keeps the enrich endpoint's unconditional status
    // write a no-op.
    const res = await fetch(`${base}/captures/${id}/enrich`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ alert: "security_critical:acked", status: "routed" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return Response.json({ error: `ledger HTTP ${res.status}` }, { status: 502 });
    state.cache = null; // the banner should clear on the next fetch, not in 60s
    generation++;
    inflight = null;
    return Response.json({ status: "acked", id });
  }
  if (pathname !== "/api/synapse" && pathname !== "/api/synapse/") return null;
  if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
  if (new URL(req.url).searchParams.get("fresh") === "1") return Response.json(await refresh(), { headers: { "X-Synapse-Cache": "fresh" } });
  if (state.cache && state.cache.expiresAt > Date.now()) {
    return Response.json(state.cache.payload, { headers: { "X-Synapse-Cache": "hit" } });
  }
  if (state.cache) {
    // Expired: serve the last payload now and refresh behind it.
    refresh().catch((e) => console.error(`[${MODULE_NAME}] refresh failed: ${e?.message ?? e}`));
    return Response.json(state.cache.payload, { headers: { "X-Synapse-Cache": "stale" } });
  }
  const payload = await refresh();
  return Response.json(payload);
}

export function health(): { running: boolean } {
  return { running: state.running };
}
