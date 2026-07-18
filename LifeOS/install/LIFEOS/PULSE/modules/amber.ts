/**
 * Amber Pulse module — read-only surface over the Amber idea supply chain.
 *
 * Composes live numbers from four independent probes (each fail-soft):
 *   ledger    — the arbol-a-amber-ledger worker (/stats, /captures)
 *   knowledge — MEMORY/KNOWLEDGE note counts by `created:` frontmatter
 *   bookmarks — SEEN_BOOKMARKS KV key count (Cloudflare API) + local _X state
 *   sheet     — per-path observed sends (cloud bookmark cron + surface saves);
 *               the hotkey path has no local counter and is labeled as such
 *
 * Route: GET /api/amber → { generated_at, ledger, knowledge, bookmarks, sheet, inputs, errors }
 *
 * Instance wiring is resolved at runtime from USER-zone sources — nothing
 * principal-specific lives in this file: the workers.dev subdomain comes from
 * ~/.config/arbol/config.yaml (`subdomain:`), worker names and the KV
 * namespace id from the ARBOL wrangler configs under USER/CUSTOMIZATIONS.
 * Secrets (arbol bearer, CF token) never leave this process — the dashboard
 * page consumes only the composed JSON.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "amber";
const HOME = process.env.CLAUDE_CONFIG_DIR || join(claudeDir());
const KNOWLEDGE_DIR = join(HOME, "LIFEOS", "MEMORY", "KNOWLEDGE");
const X_STATE_DIR = join(HOME, "skills", "_X", "State");
const ENV_PATH = join(HOME, ".env");
const ARBOL_CFG = join(homedir(), ".config", "arbol", "config.yaml");
const ARBOL_WORKERS = join(HOME, "LIFEOS", "USER", "CUSTOMIZATIONS", "ARBOL", "Workers");

const CACHE_TTL_MS = 60_000;

const state: { running: boolean; cache: { payload: unknown; expiresAt: number } | null; cfAccountId: string | null } = {
  running: false,
  cache: null,
  cfAccountId: null,
};

function arbolCfg(key: string): string | null {
  try {
    const m = readFileSync(ARBOL_CFG, "utf8").match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, "m"));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/** Ledger worker base URL: env override, else name (USER wrangler) + subdomain (arbol config). */
function ledgerBase(): string | null {
  if (process.env.AMBER_LEDGER_URL) return process.env.AMBER_LEDGER_URL.replace(/\/$/, "");
  try {
    const wrangler = readFileSync(join(ARBOL_WORKERS, "_A_AMBER_LEDGER", "wrangler.jsonc"), "utf8");
    const name = wrangler.match(/"name":\s*"([^"]+)"/)?.[1];
    const sub = arbolCfg("subdomain");
    return name && sub ? `https://${name}.${sub}.workers.dev` : null;
  } catch {
    return null;
  }
}

/** SEEN_BOOKMARKS KV namespace id, read from the bookmarks worker's wrangler config. */
function seenBookmarksKvId(): string | null {
  try {
    const wrangler = readFileSync(join(ARBOL_WORKERS, "_F_X_BOOKMARKS_SUMMARIZE", "wrangler.jsonc"), "utf8");
    const m = wrangler.match(/"binding":\s*"SEEN_BOOKMARKS",\s*"id":\s*"([a-f0-9]+)"/s);
    return m ? m[1] : null;
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
  const token = arbolCfg("auth_token");
  if (!base) throw new Error("amber ledger URL unresolvable");
  if (!token) throw new Error("no arbol auth_token");
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
 * Amber output. `amber_promoted` is the Amber-specific number: notes carrying a
 * `source_amber_id` frontmatter key, i.e. promoted from the ledger by `amber route`.
 */
// Wiki-page category names per KNOWLEDGE dir — must match the wiki module's
// domainToCategory so /knowledge?category=…&slug=… links resolve.
const DIR_TO_WIKI_CATEGORY: Record<string, string> = {
  Ideas: "idea", People: "person", Companies: "company",
  Research: "research", Blogs: "blog", Books: "book",
};

function knowledgeCounts(): {
  total: number; last7d: number; last30d: number; amber_promoted: number;
  by_type: Record<string, { total: number; last7d: number; last30d: number }>;
  amber_notes: Record<string, { category: string; slug: string }>;
  recent: { title: string; category: string; slug: string; type: string; created: string }[];
} {
  const now = Date.now();
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;
  const by_type: Record<string, { total: number; last7d: number; last30d: number }> = {};
  const amber_notes: Record<string, { category: string; slug: string }> = {};
  const recent: { title: string; category: string; slug: string; type: string; created: string; _t: number }[] = [];
  let total = 0, last7d = 0, last30d = 0, amber_promoted = 0;
  const typeDirs = ["Ideas", "People", "Companies", "Research", "Blogs", "Books"];
  for (const dir of typeDirs) {
    const abs = join(KNOWLEDGE_DIR, dir);
    if (!existsSync(abs)) continue;
    const bucket = { total: 0, last7d: 0, last30d: 0 };
    for (const f of readdirSync(abs)) {
      if (!f.endsWith(".md") || f.startsWith("_")) continue;
      bucket.total++;
      total++;
      try {
        // created: sits in the frontmatter head; read only the head for speed.
        const head = readFileSync(join(abs, f), "utf8").slice(0, 1200);
        const amberId = head.match(/^source_amber_id:\s*["']?([a-f0-9-]+)/m)?.[1];
        if (amberId) {
          amber_promoted++;
          amber_notes[amberId] = { category: DIR_TO_WIKI_CATEGORY[dir] ?? "idea", slug: f.replace(/\.md$/, "") };
        }
        const m = head.match(/^created:\s*["']?([0-9T:.Z+-]+)/m);
        if (!m) continue;
        const t = Date.parse(m[1]);
        if (Number.isNaN(t)) continue;
        if (t >= d30) {
          last30d++; bucket.last30d++;
          const title = head.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? f.replace(/\.md$/, "");
          recent.push({
            title,
            category: DIR_TO_WIKI_CATEGORY[dir] ?? "idea",
            slug: f.replace(/\.md$/, ""),
            type: dir,
            created: m[1],
            _t: t,
          });
        }
        if (t >= d7) { last7d++; bucket.last7d++; }
      } catch { /* unreadable note — skip */ }
    }
    by_type[dir] = bucket;
  }
  recent.sort((a, b) => b._t - a._t);
  return {
    total, last7d, last30d, amber_promoted, by_type, amber_notes,
    recent: recent.slice(0, 40).map(({ _t, ...r }) => r),
  };
}

function localBookmarkState(): {
  local_seen: number; issues_created: number; issues_skipped: number;
  recent_issues: { issue: number; url: string; created_at: string }[];
} {
  let local_seen = 0, issues_created = 0, issues_skipped = 0;
  const recent_issues: { issue: number; url: string; created_at: string }[] = [];
  const d30 = Date.now() - 30 * 86_400_000;
  try {
    const s = JSON.parse(readFileSync(join(X_STATE_DIR, "bookmarks-state.json"), "utf8"));
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

// The input catalog mirrors AmberSystem.md §Inputs — static topology, joined
// with live per-source ledger counts at request time.
const INPUTS = [
  { n: 1, name: "Summarize hotkey", trigger: "browser hotkey on any page", component: "summarize worker", status: "live", ledger_sources: [] as string[] },
  { n: 2, name: "Bookmarks → idea-issues", trigger: "bookmark sweep (tb)", component: "_X bookmark-issue.ts → Type:queue", status: "live", ledger_sources: [] },
  { n: 3, name: "Bookmarks → summarize (cloud)", trigger: "every-minute cron", component: "_F_X_BOOKMARKS_SUMMARIZE → sheet", status: "live", ledger_sources: [] },
  { n: 4, name: "Harvest → Knowledge", trigger: "/ha on a URL/video/text", component: "_HARVEST → _A_HARVEST_CLASSIFY", status: "live", ledger_sources: [] },
  { n: 5, name: "Voice markers", trigger: "“begin idea … end idea” on the wearable", component: "_LIFELOG", status: "live", ledger_sources: [] },
  { n: 6, name: "Feed pipeline", trigger: "RSS/YouTube/social polling", component: "feed-api → poller → processor", status: "live", ledger_sources: ["feed"] },
  { n: 7, name: "Surface save", trigger: "save/summarize in the reader", component: "summarize worker → ledger (service binding)", status: "live", ledger_sources: ["surface"] },
  { n: 8, name: "CLI / skill capture", trigger: "amber capture <url|text>", component: "amber CLI → ledger", status: "live", ledger_sources: ["cli"] },
  { n: 9, name: "Reader upvote → capture", trigger: "thumbs-up on a reader item", component: "—", status: "roadmap", ledger_sources: [] },
  { n: 10, name: "Gesture / wearable trigger", trigger: "physical trigger from anywhere", component: "—", status: "roadmap", ledger_sources: [] },
  { n: 11, name: "Email → capture", trigger: "forward to a capture address", component: "—", status: "roadmap", ledger_sources: [] },
];

async function compose(): Promise<any> {
  const errors: Record<string, string> = {};

  const [ledgerStats, ledgerRecent, cloudParsed] = await Promise.all([
    ledgerReq("/stats").catch((e) => { errors.ledger = String(e?.message ?? e); return null; }),
    ledgerReq("/captures?limit=50").catch((e) => { errors.captures = String(e?.message ?? e); return null; }),
    countSeenBookmarksKV().catch((e) => { errors.bookmarks_cloud = String(e?.message ?? e); return null; }),
  ]);

  let knowledge: ReturnType<typeof knowledgeCounts> | null = null;
  try { knowledge = knowledgeCounts(); } catch (e: any) { errors.knowledge = String(e?.message ?? e); }

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
          recent: (ledgerRecent?.captures ?? []).map((c: any) => ({
            source: c.source,
            score: c.score ?? null,
            title: c.title || null,
            url: c.url || null,
            captured_at: c.captured_at,
            status: c.status,
            // the promoted KNOWLEDGE note, when `amber route` has written one
            note: knowledge?.amber_notes?.[c.id] ?? null,
          })),
        }
      : null,
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
        { name: "Bookmark cron → sheet", count: cloudParsed, note: "SEEN_BOOKMARKS KV keys — written only after a successful summarize → sheet send; 90-day KV TTL, so this is a rolling window" },
        { name: "Surface saves → sheet", count: bySource["surface"] ?? null, note: "ledger rows with source=surface (dual-written to sheet + ledger since 2026-07-08)" },
        { name: "Hotkey → sheet", count: null, note: "not yet instrumented — no local counter until the hotkey path is wired to the ledger (Phase 3)" },
      ],
    },
    inputs: INPUTS.map((i) => ({
      ...i,
      ledger_count: i.ledger_sources.reduce((n, s) => n + (bySource[s] ?? 0), 0) || null,
    })),
    errors: Object.keys(errors).length ? errors : null,
  };
}

export function start(): void {
  state.running = true;
  console.log(`[${MODULE_NAME}] Started — serving /api/amber`);
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  if (pathname !== "/api/amber" && pathname !== "/api/amber/") return null;
  if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
  const now = Date.now();
  if (state.cache && state.cache.expiresAt > now) {
    return Response.json(state.cache.payload, { headers: { "X-Amber-Cache": "hit" } });
  }
  const payload = await compose();
  state.cache = { payload, expiresAt: now + CACHE_TTL_MS };
  return Response.json(payload);
}

export function health(): { running: boolean } {
  return { running: state.running };
}
