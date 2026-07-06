#!/usr/bin/env bun
/**
 * ============================================================================
 * BlogDiscovery — harvest, topic-score, and queue small/indie blogs for the Feed
 * ============================================================================
 *
 * Pulls candidate blogs from curated indie-blog directories (Kagi Small Web,
 * indieblog.page, Bear discover), dedups against the live `feed` D1 sources,
 * activity-checks each feed, then scores BOTH editorial quality AND topic-fit
 * against the principal's real Surface taxonomy (imported live from
 * ~/Projects/Surface/src/categories.ts — no drift), gated on recency. Combined
 * rank = quality × fit × recency. Only the top blogs are surfaced for approval.
 *
 * Option B: nothing reaches the production feed DB until `approve <id>` promotes
 * a candidate into feed_sources (surface_enabled=1) with canonical Surface tags.
 *
 * Local queue: ~/.claude/LIFEOS/MEMORY/STATE/feed-candidates.db (bun:sqlite)
 *
 * USAGE:
 *   bun BlogDiscovery.ts harvest [--batch 500] [--sources kagi,indieblog,bear]
 *                                 [--concurrency 16] [--score-batch 12]
 *                                 [--score-parallel 4] [--no-score]
 *   bun BlogDiscovery.ts list   [--limit 100] [--min 55] [--max-age-days 540]
 *   bun BlogDiscovery.ts top    [--n 50]          # the curated shortlist
 *   bun BlogDiscovery.ts approve <id> [<id> ...]  # also: approve --top 50
 *   bun BlogDiscovery.ts reject  <id> [<id> ...]
 *   bun BlogDiscovery.ts stats
 *   bun BlogDiscovery.ts reset                    # wipe local queue (no prod effect)
 * ============================================================================
 */

import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { getClaudeDir, getLifeosDir } from "./Paths";

const HOME = homedir();
const DB_PATH = join(getLifeosDir(), "MEMORY/STATE/feed-candidates.db");
const CFENV = join(getClaudeDir(), "skills/_CLOUDFLARE/Tools/CfEnv.ts");
const INFERENCE = join(getLifeosDir(), "TOOLS/Inference.ts");
const SURFACE_TAX = join(HOME, "Projects/Surface/src/categories.ts");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Surface taxonomy (imported live so it never drifts)
// ---------------------------------------------------------------------------
// tab -> priority weight, read off the categories.ts header (tiered to {{PRINCIPAL_NAME}}'s
// interest fingerprint). HIGHEST=1.0, HIGH=0.85, MED=0.65, LOW=0.4.
const TAB_TIER: Record<string, number> = {
  "ai-models": 1.0, "ai-agents": 1.0, human3: 1.0, meaning: 1.0,
  worldmodels: 1.0, "offensive-security": 1.0,
  thinking: 0.85, "cyber-defense": 0.85, "threat-intel": 0.85,
  geopolitics: 0.85, forecasting: 0.85, essays: 0.85,
  creativity: 0.65, natsec: 0.65, economy: 0.65, software: 0.65, tools: 0.65, science: 0.65,
  news: 0.4,
};

let ALL_TAGS: string[] = [];
let TAGS_BY_TAB: Record<string, string[]> = {};
try {
  const tax = await import(SURFACE_TAX);
  ALL_TAGS = tax.ALL_CATEGORIES ?? [];
  TAGS_BY_TAB = tax.CONTENT_TYPE_LABELS ?? {};
} catch (e) {
  console.error(`! could not import Surface taxonomy at ${SURFACE_TAX}; topic tags degraded`);
}
const TAG_SET = new Set(ALL_TAGS);
// tag -> tab, for turning the LLM's tags into a fit-tier blend
const TAG_TAB: Record<string, string> = {};
for (const [tab, tags] of Object.entries(TAGS_BY_TAB)) for (const t of tags) TAG_TAB[t] = tab;

// broad keyword net for the cheap pre-LLM topic filter (recall over precision)
const KW = [
  "ai", "llm", "gpt", "claude", "openai", "anthropic", "machine learning", "neural", "model",
  "agent", "prompt", "rag", "inference", "transformer", "fine-tun",
  "security", "exploit", "malware", "ransomware", "vulnerab", "pentest", "hacking", "hacker",
  "threat", "osint", "cyber", "infosec", "appsec", "reverse eng", "ctf",
  "philosoph", "meaning", "consciousness", "stoic", "existential", "epistem", "rational",
  "mental model", "first principles", "thinking", "cognit", "decision", "deutsch",
  "complexity", "systems", "emergen", "geopolit", "china", "russia", "statecraft",
  "military", "defense", "intelligence", "forecast", "predict", "future", "essay",
  "econ", "market", "invest", "startup", "finance", "crypto",
  "program", "software", "engineer", "devops", "kubernetes", "linux", "database",
  "distributed", "open source", "opensource", "compiler", "rust", "haskell",
  "science", "physics", "quantum", "space", "astro", "neuro", "biotech", "genetic", "math",
  "writing", "book", "design", "typograph", "creativ", "human 3", "automation", "productivity",
];

// ---------------------------------------------------------------------------
// local queue
// ---------------------------------------------------------------------------
function openDb(): Database {
  const d = new Database(DB_PATH);
  d.run("PRAGMA journal_mode = WAL");
  d.run(`CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY, name TEXT, blog_url TEXT, rss_url TEXT, source_dir TEXT,
    discovered_at TEXT DEFAULT (datetime('now')),
    last_post_at TEXT, recent_posts INTEGER,
    quality_score INTEGER, topic_fit INTEGER, topic_tags TEXT,
    recency REAL, combined INTEGER, score_reason TEXT,
    status TEXT DEFAULT 'pending',
    decided_at TEXT, feed_source_id TEXT
  )`);
  d.run(`CREATE TABLE IF NOT EXISTS seen_raw (key TEXT PRIMARY KEY, url TEXT, seen_at TEXT DEFAULT (datetime('now')))`);
  return d;
}

// ---------------------------------------------------------------------------
// url helpers
// ---------------------------------------------------------------------------
const SUBDOMAIN_TENANT = ["github.io", "bearblog.dev", "substack.com", "wordpress.com", "tumblr.com", "blogspot.com"];
const MULTI_TENANT = [...SUBDOMAIN_TENANT, "medium.com", "svbtle.com", "micro.blog", "neocities.org",
  "pages.dev", "netlify.app", "mataroa.blog", "write.as", "hashnode.dev", "dev.to", "ghost.io"];

function normUrl(u: string): string | null {
  try { let s = u.trim(); if (!s) return null; if (!/^https?:\/\//i.test(s)) s = "https://" + s; return new URL(s).toString(); }
  catch { return null; }
}
function dedupKey(u: string): string {
  try {
    let s = u.trim(); if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    const p = new URL(s); const host = p.hostname.toLowerCase().replace(/^www\./, "");
    if (SUBDOMAIN_TENANT.find((m) => host.endsWith("." + m))) return host;
    if (MULTI_TENANT.find((m) => host === m || host.endsWith("." + m)))
      return host + "/" + (p.pathname.split("/").filter(Boolean)[0] || "");
    return host;
  } catch { return u.toLowerCase(); }
}
function origin(u: string): string | null { const n = normUrl(u); try { return n ? new URL(n).origin : null; } catch { return null; } }

// ---------------------------------------------------------------------------
// D1
// ---------------------------------------------------------------------------
function d1(command: string): any[] {
  const r = spawnSync("bun", [CFENV, "d1", "execute", "feed", "--remote", "--json", "--command", command],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`d1 failed: ${(r.stderr || "").slice(-400)}`);
  const out = (r.stdout || "").trim(); const s = out.indexOf("[");
  if (s < 0) return []; return JSON.parse(out.slice(s))?.[0]?.results ?? [];
}
function loadExistingKeys(): Set<string> {
  const rows = d1("SELECT rss_url, blog_url, website_url FROM feed_sources");
  const set = new Set<string>();
  for (const r of rows) for (const v of [r.rss_url, r.blog_url, r.website_url]) if (v) set.add(dedupKey(String(v)));
  return set;
}

// ---------------------------------------------------------------------------
// fetch + parse
// ---------------------------------------------------------------------------
async function fetchText(url: string, timeoutMs = 12000): Promise<string | null> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: ctrl.signal, redirect: "follow" });
    return res.ok ? await res.text() : null;
  } catch { return null; } finally { clearTimeout(t); }
}
function cleanText(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
interface FeedInfo { ok: boolean; itemCount: number; recent90: number; lastPost: string | null; titles: string[]; snippet: string; }
function parseFeed(xml: string): FeedInfo {
  const blocks = xml.split(/<(?:item|entry)[\s>]/i).slice(1);
  const titles: string[] = []; const dates: number[] = [];
  for (const b of blocks.slice(0, 12)) {
    const tm = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i); if (tm) titles.push(cleanText(tm[1]).slice(0, 120));
    const dm = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || b.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
      || b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || b.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
    if (dm) { const ts = Date.parse(cleanText(dm[1])); if (!isNaN(ts)) dates.push(ts); }
  }
  const cutoff = Date.now() - 90 * 86400 * 1000;
  const fb = blocks[0] || "";
  const sm = fb.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || fb.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
    || fb.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  return {
    ok: blocks.length > 0, itemCount: blocks.length,
    recent90: dates.length ? dates.filter((d) => d >= cutoff).length : Math.min(blocks.length, 3),
    lastPost: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    titles: titles.filter(Boolean).slice(0, 6), snippet: sm ? cleanText(sm[1]).slice(0, 280) : "",
  };
}
async function discoverRss(homepage: string): Promise<string | null> {
  const html = await fetchText(homepage, 10000); if (!html) return null;
  for (const l of [...html.matchAll(/<link[^>]+>/gi)].map((m) => m[0])) {
    if (/rel=["']?alternate/i.test(l) && /type=["']?application\/(rss|atom)\+xml/i.test(l)) {
      const href = l.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) { try { return new URL(href, homepage).toString(); } catch {} }
    }
  }
  for (const g of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/index.xml", "/atom.xml"]) {
    const probe = origin(homepage) + g; const txt = await fetchText(probe, 8000);
    if (txt && /<(rss|feed|item|entry)/i.test(txt)) return probe;
  }
  return null;
}
function recencyFactor(lastPost: string | null): number {
  if (!lastPost) return 0.25; const days = (Date.now() - Date.parse(lastPost)) / 86400000;
  if (isNaN(days) || days < -7) return 0.25; // future-dated feeds are junk, don't reward
  if (days <= 180) return 1.0; if (days <= 365) return 0.8; if (days <= 730) return 0.5; return 0.2;
}
function topicHits(text: string): number { const t = text.toLowerCase(); return KW.filter((k) => t.includes(k)).length; }

// ---------------------------------------------------------------------------
// adapters
// ---------------------------------------------------------------------------
interface Raw { name?: string; blog_url?: string; rss_url?: string; }
async function srcKagi(): Promise<Raw[]> {
  const txt = await fetchText("https://raw.githubusercontent.com/kagisearch/smallweb/main/smallweb.txt", 20000);
  if (!txt) return [];
  return txt.split("\n").map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l))
    .map((rss) => ({ rss_url: rss, blog_url: origin(rss) || undefined }));
}
async function srcIndieblog(): Promise<Raw[]> {
  const out: Raw[] = [];
  for (const u of ["https://indieblog.page/dailyfeed?num=25", "https://indieblog.page/weeklyfeed?num=25"]) {
    const xml = await fetchText(u, 12000); if (!xml) continue;
    for (const m of xml.matchAll(/<link>([\s\S]*?)<\/link>/gi)) {
      const link = cleanText(m[1]).replace(/\?utm_source=indieblog.*$/, "");
      if (/^https?:\/\//i.test(link) && !/indieblog\.page/i.test(link)) { const h = origin(link); if (h) out.push({ blog_url: h }); }
    }
  }
  return out;
}
async function srcBear(): Promise<Raw[]> {
  const out: Raw[] = [];
  for (const u of ["https://bearblog.dev/discover/", "https://bearblog.dev/discover/?newest=true"]) {
    const html = await fetchText(u, 12000); if (!html) continue;
    for (const m of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
      const href = m[1];
      if (/bearblog\.dev/i.test(href) && !/\/discover|\/dashboard|\/login|\/signup/i.test(href)) {
        const h = origin(href); if (h && !/^https?:\/\/(www\.)?bearblog\.dev/i.test(h)) out.push({ blog_url: h });
      }
    }
  }
  return out;
}
const ADAPTERS: Record<string, () => Promise<Raw[]>> = { kagi: srcKagi, indieblog: srcIndieblog, bear: srcBear };

// ---------------------------------------------------------------------------
// scoring
// ---------------------------------------------------------------------------
const SCORE_SYS =
  "You evaluate small/independent blogs for a personal feed reader. The owner's PRIORITY topics, " +
  "in tiers: HIGHEST = frontier AI & LLMs, AI agents & future of work, Human 3.0 / human flourishing, " +
  "meaning & philosophy, Deutschian world models & epistemics, offensive security. HIGH = thinking & mental " +
  "models, cyber defense, threat intel, geopolitics, forecasting, essays/ideas. MEDIUM = creativity, national " +
  "security, economy, software engineering, dev tools, frontier science. He does NOT want generic news, " +
  "marketing/SEO, product changelogs, or off-topic personal diaries.\n" +
  "From each blog's recent titles + snippet, return ONLY a JSON array of " +
  '{"i":<index>,"score":<1-100 editorial quality: depth, originality, distinct voice>,' +
  '"fit":<1-100 match to the owner priorities above; 100=squarely frontier-AI/security/meaning/world-models, 1=off-topic>,' +
  '"tags":[1-3 short topic tags],"reason":"<=10 words"}.';

function buildUser(items: { i: number; name: string; titles: string[]; snippet: string }[]): string {
  return "Rate these blogs:\n\n" + items.map((it) =>
    `[${it.i}] ${it.name}\nTitles: ${it.titles.join(" | ") || "(none)"}\nSnippet: ${it.snippet || "(none)"}`).join("\n\n");
}
function parseScores(out: string): Map<number, { score: number; fit: number; tags: string[]; reason: string }> {
  const map = new Map<number, any>(); const s = out.indexOf("["); const e = out.lastIndexOf("]");
  if (s < 0 || e < 0) return map;
  try {
    for (const o of JSON.parse(out.slice(s, e + 1))) {
      if (typeof o.i === "number" && typeof o.score === "number") {
        // snap LLM tags to canonical Surface tags where possible
        const tags = (Array.isArray(o.tags) ? o.tags : []).map(String)
          .map((t: string) => TAG_SET.has(t) ? t : ALL_TAGS.find((c) => c.toLowerCase() === t.toLowerCase()) || t).slice(0, 3);
        map.set(o.i, {
          score: Math.max(1, Math.min(100, Math.round(o.score))),
          fit: Math.max(1, Math.min(100, Math.round(o.fit ?? 50))),
          tags, reason: String(o.reason || "").slice(0, 80),
        });
      }
    }
  } catch {}
  return map;
}
async function scoreChunk(items: { i: number; name: string; titles: string[]; snippet: string }[]) {
  const proc = Bun.spawn(["bun", INFERENCE, "--json", "--level", argVal("--level", "medium"), SCORE_SYS, buildUser(items)],
    { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text(); await proc.exited;
  return parseScores(out);
}

// fit blended with tab-tier of the assigned tags (keeps ranking honest if LLM fit drifts)
function tierOfTags(tags: string[]): number {
  const tiers = tags.map((t) => TAB_TIER[TAG_TAB[t]] ?? 0).filter((x) => x > 0);
  return tiers.length ? Math.max(...tiers) : 0.6;
}
function combinedScore(quality: number, fit: number, tags: string[], lastPost: string | null): number {
  const blendedFit = Math.round(fit * 0.7 + fit * tierOfTags(tags) * 0.3);
  return Math.round((quality * 0.4 + blendedFit * 0.6) * recencyFactor(lastPost));
}

// ---------------------------------------------------------------------------
async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let idx = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const my = idx++; out[my] = await fn(items[my], my); }
  }));
  return out;
}
function argVal(f: string, d: string): string { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
function hasFlag(f: string): boolean { return process.argv.includes(f); }

// ---------------------------------------------------------------------------
async function cmdHarvest() {
  const batch = parseInt(argVal("--batch", "500"), 10);
  const concurrency = parseInt(argVal("--concurrency", "16"), 10);
  const scoreSize = parseInt(argVal("--score-batch", "12"), 10);
  const scorePar = parseInt(argVal("--score-parallel", "4"), 10);
  const sources = argVal("--sources", "kagi,indieblog,bear").split(",").map((s) => s.trim());
  const noScore = hasFlag("--no-score");
  const db = openDb();
  console.log(`[harvest] sources=${sources.join(",")} batch=${batch} taxonomy=${ALL_TAGS.length} tags`);

  let raw: (Raw & { source_dir: string })[] = [];
  for (const s of sources) {
    const fn = ADAPTERS[s]; if (!fn) { console.log(`  ! unknown source ${s}`); continue; }
    const got = await fn(); console.log(`  ${s}: ${got.length} raw urls`);
    raw.push(...got.map((g) => ({ ...g, source_dir: s })));
  }

  const seenStmt = db.prepare("SELECT 1 FROM seen_raw WHERE key=?");
  const candStmt = db.prepare("SELECT 1 FROM candidates WHERE id=?");
  const fresh: any[] = []; const dropDup = new Set<string>();
  for (const r of raw) {
    const u = r.rss_url || r.blog_url; if (!u) continue;
    const key = dedupKey(u); if (dropDup.has(key)) continue; dropDup.add(key);
    if (seenStmt.get(key) || candStmt.get(key)) continue;
    fresh.push({ ...r, key });
  }
  console.log(`  fresh (never seen): ${fresh.length}`);
  const existing = loadExistingKeys();
  console.log(`  existing feed sources: ${existing.size} keys`);
  const newOnes = fresh.filter((f) => !existing.has(f.key));
  console.log(`  not already in feed: ${newOnes.length}`);
  for (let i = newOnes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [newOnes[i], newOnes[j]] = [newOnes[j], newOnes[i]]; }
  const work = newOnes.slice(0, batch);
  console.log(`  processing ${work.length} this run`);

  const checked = await pool(work, concurrency, async (w: any) => {
    let rss = w.rss_url as string | undefined;
    if (!rss && w.blog_url) rss = (await discoverRss(w.blog_url)) || undefined;
    if (!rss) return { ...w, dead: true };
    const xml = await fetchText(rss, 12000); if (!xml) return { ...w, rss_url: rss, dead: true };
    const info = parseFeed(xml); if (!info.ok || info.itemCount === 0) return { ...w, rss_url: rss, dead: true };
    const host = (() => { try { return new URL(rss!).hostname.replace(/^www\./, ""); } catch { return w.key; } })();
    return { ...w, rss_url: rss, blog_url: w.blog_url || origin(rss), name: host, host, dead: false, info };
  });
  const live = checked.filter((c: any) => !c.dead);
  const dead = checked.filter((c: any) => c.dead);
  console.log(`  live: ${live.length} | dead: ${dead.length}`);

  // recency gate + cheap topic pre-filter (saves LLM cost on off-topic/stale)
  const onTopic = (live as any[]).filter((c) => {
    const fresh = recencyFactor(c.info.lastPost) >= 0.5; // posted within ~2y
    const hit = topicHits([...c.info.titles, c.info.snippet, c.host].join(" ")) >= 1;
    return fresh && hit;
  });
  const skipped = (live as any[]).filter((c) => !onTopic.includes(c));
  console.log(`  on-topic & recent: ${onTopic.length} | skipped (stale/off-topic): ${skipped.length}`);

  const insSeen = db.prepare("INSERT OR IGNORE INTO seen_raw (key,url) VALUES (?,?)");
  const insCand = db.prepare(`INSERT OR IGNORE INTO candidates
    (id,name,blog_url,rss_url,source_dir,last_post_at,recent_posts,status) VALUES (?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    for (const d of [...dead, ...skipped, ...live]) insSeen.run(d.key, d.rss_url || d.blog_url || "");
    for (const c of onTopic) insCand.run(c.key, c.name, c.blog_url, c.rss_url, c.source_dir, c.info.lastPost, c.info.recent90, "pending");
    for (const c of skipped) insCand.run(c.key, c.name, c.blog_url, c.rss_url, c.source_dir, c.info.lastPost, c.info.recent90, "offtopic");
  })();

  if (!noScore && onTopic.length) {
    console.log(`  scoring ${onTopic.length} (medium, ${scorePar}× parallel batches of ${scoreSize})...`);
    const chunks: any[][] = [];
    for (let i = 0; i < onTopic.length; i += scoreSize) chunks.push(onTopic.slice(i, i + scoreSize));
    const upd = db.prepare("UPDATE candidates SET quality_score=?,topic_fit=?,topic_tags=?,recency=?,combined=?,score_reason=? WHERE id=?");
    let done = 0;
    await pool(chunks, scorePar, async (chunk) => {
      const scored = await scoreChunk(chunk.map((c, j) => ({ i: j, name: c.name, titles: c.info.titles, snippet: c.info.snippet })));
      db.transaction(() => {
        chunk.forEach((c, j) => {
          const s = scored.get(j); if (!s) return;
          const rec = recencyFactor(c.info.lastPost);
          const comb = combinedScore(s.score, s.fit, s.tags, c.info.lastPost);
          upd.run(s.score, s.fit, JSON.stringify(s.tags), rec, comb, s.reason, c.key);
        });
      })();
      done += chunk.length; process.stdout.write(`    scored ${done}/${onTopic.length}\r`);
    });
    console.log("");
  }
  const pend = (db.query("SELECT COUNT(*) n FROM candidates WHERE status='pending' AND combined IS NOT NULL").get() as any).n;
  const good = (db.query("SELECT COUNT(*) n FROM candidates WHERE status='pending' AND combined>=55").get() as any).n;
  console.log(`[harvest] done. pending scored: ${pend}, of which combined>=55: ${good}.`);
  console.log(`Shortlist: bun ${join(getLifeosDir(), "TOOLS/BlogDiscovery.ts")} top --n 50`);
}

function rankRows(db: Database, limit: number, min: number, maxAgeDays: number, minFit = 0): any[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
  return db.query(
    `SELECT * FROM candidates WHERE status='pending' AND combined>=? AND COALESCE(topic_fit,0)>=?
     AND (last_post_at IS NULL OR last_post_at>=?) ORDER BY combined DESC, topic_fit DESC LIMIT ?`
  ).all(min, minFit, cutoff, limit) as any[];
}
function printRows(rows: any[]) {
  for (const r of rows) {
    const tags = r.topic_tags ? JSON.parse(r.topic_tags).join(", ") : "";
    const last = r.last_post_at ? r.last_post_at.slice(0, 10) : "—";
    console.log(`  ${String(r.combined ?? "?").padStart(3)} | q${r.quality_score ?? "?"} f${r.topic_fit ?? "?"} | ${r.name}`);
    console.log(`        ${r.blog_url}  [${tags}]  last ${last}, ${r.recent_posts ?? 0} recent`);
    console.log(`        ${r.score_reason || ""}   id: ${r.id}`);
  }
}
function cmdList() {
  const db = openDb();
  const rows = rankRows(db, parseInt(argVal("--limit", "100"), 10), parseInt(argVal("--min", "55"), 10), parseInt(argVal("--max-age-days", "540"), 10), parseInt(argVal("--min-fit", "0"), 10));
  if (!rows.length) { console.log("No candidates match."); return; }
  console.log(`\n${rows.length} candidate(s) [combined | quality fit]:\n`); printRows(rows);
}
function cmdTop() {
  const db = openDb(); const n = parseInt(argVal("--n", "50"), 10);
  const rows = rankRows(db, n, parseInt(argVal("--min", "50"), 10), parseInt(argVal("--max-age-days", "540"), 10), parseInt(argVal("--min-fit", "0"), 10));
  console.log(`\nTop ${rows.length} shortlist [combined | quality fit]:\n`); printRows(rows);
  console.log(`\nApprove all: bun BlogDiscovery.ts approve --top ${n}`);
}

const FS_COLS = "(id,name,description,rss_url,blog_url,website_url,tags,category,poll_interval_minutes,priority,active,source_type,surface_enabled,created_at,updated_at)";
function rowValues(c: any, id: string, now: string): string {
  const tags = c.topic_tags ? JSON.stringify([...new Set([...JSON.parse(c.topic_tags), "indie-blog"])]) : JSON.stringify(["indie-blog"]);
  const q = (v: any) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  // personal blogs post rarely → poll once a day (1440 min)
  return `(${q(id)},${q(c.name)},${q(c.score_reason)},${q(c.rss_url)},${q(c.blog_url)},${q(c.blog_url)},${q(tags)},'feed',1440,'normal',1,'rss_feed',1,${q(now)},${q(now)})`;
}
// batched multi-row inserts (D1 has per-query size limits → chunk at 40)
function promoteMany(db: Database, cands: any[]): number {
  const now = new Date().toISOString();
  const mark = db.prepare("UPDATE candidates SET status='added',decided_at=?,feed_source_id=? WHERE id=?");
  let added = 0;
  for (let i = 0; i < cands.length; i += 40) {
    const chunk = cands.slice(i, i + 40).map((c) => ({ c, id: randomUUID() }));
    try {
      d1(`INSERT INTO feed_sources ${FS_COLS} VALUES ${chunk.map((r) => rowValues(r.c, r.id, now)).join(",")}`);
      db.transaction(() => { for (const r of chunk) { mark.run(now, r.id, r.c.id); added++; } })();
      process.stdout.write(`  promoted ${added}/${cands.length}\r`);
    } catch (e: any) { console.log(`\n  ! chunk failed at ${i}: ${e.message}`); }
  }
  console.log("");
  return added;
}
function cmdDecide(decision: "approved" | "rejected") {
  const db = openDb(); const now = new Date().toISOString();
  let ids = process.argv.slice(3).filter((a) => !a.startsWith("--"));
  if (hasFlag("--top")) ids = rankRows(db, parseInt(argVal("--top", "50"), 10), parseInt(argVal("--min", "50"), 10), parseInt(argVal("--max-age-days", "540"), 10), parseInt(argVal("--min-fit", "0"), 10)).map((r) => r.id);
  if (!ids.length) { console.log(`Usage: approve <id ...> | approve --top 256`); return; }
  if (decision === "approved") {
    const cands = ids.map((id) => db.query("SELECT * FROM candidates WHERE id=?").get(id)).filter(Boolean) as any[];
    const n = promoteMany(db, cands);
    console.log(`\nAdded ${n} source(s) to the feed (surface_enabled=1, daily poll). Poller picks them up within ~5 min.`);
  } else {
    for (const id of ids) { db.run("UPDATE candidates SET status='rejected',decided_at=? WHERE id=?", [now, id]); }
    console.log(`Rejected ${ids.length}.`);
  }
}
function cmdStats() {
  const db = openDb();
  for (const r of db.query("SELECT status, COUNT(*) n, ROUND(AVG(combined),1) c FROM candidates GROUP BY status").all() as any[])
    console.log(`  ${r.status.padEnd(10)} ${String(r.n).padStart(5)}  avg combined ${r.c ?? "—"}`);
  console.log(`  raw seen (lifetime): ${(db.query("SELECT COUNT(*) n FROM seen_raw").get() as any).n}`);
}
function cmdReset() { try { require("fs").rmSync(DB_PATH); } catch {} try { require("fs").rmSync(DB_PATH + "-wal"); } catch {} try { require("fs").rmSync(DB_PATH + "-shm"); } catch {} openDb(); console.log("queue reset."); }

const cmd = process.argv[2];
switch (cmd) {
  case "harvest": await cmdHarvest(); break;
  case "list": cmdList(); break;
  case "top": cmdTop(); break;
  case "approve": cmdDecide("approved"); break;
  case "reject": cmdDecide("rejected"); break;
  case "stats": cmdStats(); break;
  case "reset": cmdReset(); break;
  default: console.log("Usage: bun BlogDiscovery.ts <harvest|list|top|approve|reject|stats|reset>"); process.exit(1);
}
