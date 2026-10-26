#!/usr/bin/env bun
/**
 * ============================================================================
 * KNOWLEDGE DISTILL — weekly harvest of the Cortex Knowledge Archive
 * ============================================================================
 *
 * Distill is a ROUTER, not a destination: it reads the archive, synthesizes a
 * small cited digest, and files every item into the system of record that
 * already owns it. It never creates or edits KNOWLEDGE notes, and it never
 * re-surfaces an item a previous run already routed (stateful dedupe).
 *
 * Lanes:
 *   content    → GitHub issues (repo/label from user DistillConfig.json)
 *   system     → Upgrades store (Upgrades.ts addUpgrade)
 *   health     → report-only section in the digest
 *
 * USAGE:
 *   bun KnowledgeDistill.ts gather [--days N] [--limit N]     # JSON candidates
 *   bun KnowledgeDistill.ts mark --digest <path>              # record surfaced items
 *   bun KnowledgeDistill.ts run --headless [--dry-run]        # full unattended pass
 *   bun KnowledgeDistill.ts status                            # state summary
 *
 * Config (optional, personal — never hardcoded here):
 *   ~/.claude/LIFEOS/USER/CUSTOMIZATIONS/SKILLS/Knowledge/DistillConfig.json
 *   { contentRepo, contentLabel, maxIssues, maxUpgrades, maxDigestItems, windowDays }
 *   Missing config → the issue lane is skipped (candidates stay digest-only).
 *
 * Headless synthesis rides Inference.ts (never a nested `claude` session).
 * ============================================================================
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import { addUpgrade } from "./Upgrades";
import { PULSE_BASE } from "../PULSE/endpoint";

const BASE = process.env.LIFEOS_DIR || join(homedir(), ".claude", "LIFEOS");
const KNOWLEDGE = join(BASE, "MEMORY", "KNOWLEDGE");
const DIGESTS = join(BASE, "MEMORY", "DIGESTS");
const STATE_FILE = join(BASE, "MEMORY", "STATE", "distill.json");
const CONFIG_FILE = join(BASE, "USER", "CUSTOMIZATIONS", "SKILLS", "Cortex", "DistillConfig.json");
const DOMAINS = ["People", "Companies", "Ideas", "Research", "Blogs", "Books"];

interface DistillConfig {
  contentRepo?: string;
  contentLabel?: string;
  maxIssues: number;
  maxUpgrades: number;
  maxDigestItems: number;
  windowDays: number;
}

interface NoteCandidate {
  slug: string;
  path: string;       // repo-relative, e.g. KNOWLEDGE/Ideas/foo.md
  domain: string;
  title: string;
  tags: string[];
  status: string;
  created: string;
  updated: string;
  summary: string;
}

interface GatherResult {
  window_days: number;
  scanned: number;
  excluded_surfaced: number;
  candidates: NoteCandidate[];
  dropped_overflow: number;
  hot_tags: { tag: string; window: number; archive: number }[];
  seedlings_total: number;
  contradiction_candidates: { a: string; b: string; shared_tags: string[] }[];
}

interface DistillState {
  schema_version: number;
  surfaced_slugs: Record<string, string>; // slug -> ISO date
  item_hashes: Record<string, string>;    // sha256[0:16] of item title -> ISO date
  last_run: string | null;
}

interface DigestItem {
  lane: "content" | "system" | "health";
  title: string;
  pitch: string;
  why_now: string;
  sources: string[];          // repo-relative note paths
  suggested_format?: string;  // content lane
  recommendation?: string;    // system lane
  target_surface?: string;    // system lane
}

// ── helpers ──

const today = (): string => new Date().toLocaleDateString("sv"); // YYYY-MM-DD local

function loadState(): DistillState {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {}
  return { schema_version: 1, surfaced_slugs: {}, item_hashes: {}, last_run: null };
}

function saveState(st: DistillState): void {
  mkdirSync(join(BASE, "MEMORY", "STATE"), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
}

function loadConfig(): DistillConfig {
  const defaults: DistillConfig = { maxIssues: 5, maxUpgrades: 5, maxDigestItems: 10, windowDays: 7 };
  try {
    if (existsSync(CONFIG_FILE)) return { ...defaults, ...JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) };
  } catch (e) {
    console.error(`[distill] bad config at ${CONFIG_FILE}: ${e} — using defaults`);
  }
  return defaults;
}

function itemHash(title: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

/** Minimal frontmatter parse — enough fields for candidate ranking; never writes. */
function parseNote(absPath: string, domain: string): NoteCandidate | null {
  let raw: string;
  try { raw = readFileSync(absPath, "utf-8"); } catch { return null; }
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = m[1];
  const body = m[2] ?? "";
  const get = (k: string): string => fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m"))?.[1] ?? "";
  const tagsLine = get("tags");
  let tags: string[] = [];
  if (tagsLine.startsWith("[")) {
    tags = tagsLine.replace(/[\[\]"]/g, "").split(",").map((t) => t.trim()).filter(Boolean);
  } else {
    const block = fm.match(/^tags:\s*\n((?:\s+-\s+.*\n?)+)/m);
    if (block) tags = block[1].split("\n").map((l) => l.replace(/^\s+-\s+/, "").trim()).filter(Boolean);
  }
  const slug = absPath.split("/").pop()!.replace(/\.md$/, "");
  const firstLine = body.split("\n").map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("<!--")) ?? "";
  return {
    slug,
    path: `KNOWLEDGE/${domain}/${slug}.md`,
    domain,
    title: get("title") || slug,
    tags,
    status: get("status") || "unknown",
    created: get("created"),
    updated: get("updated"),
    summary: firstLine.slice(0, 220),
  };
}

// ── gather ──

function gather(days: number, limit: number): GatherResult {
  const state = loadState();
  const cutoff = new Date(Date.now() - days * 86400_000);
  const all: NoteCandidate[] = [];
  for (const d of DOMAINS) {
    const dir = join(KNOWLEDGE, d);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
      const n = parseNote(join(dir, f), d);
      if (n) all.push(n);
    }
  }
  const inWindow = all.filter((n) => {
    const stamp = n.updated || n.created;
    return stamp && new Date(stamp) >= cutoff;
  });
  const fresh = inWindow.filter((n) => !state.surfaced_slugs[n.slug]);
  const excluded = inWindow.length - fresh.length;

  // hot tags: window frequency vs archive baseline
  const archiveTags = new Map<string, number>();
  for (const n of all) for (const t of n.tags) archiveTags.set(t, (archiveTags.get(t) ?? 0) + 1);
  const windowTags = new Map<string, number>();
  for (const n of fresh) for (const t of n.tags) windowTags.set(t, (windowTags.get(t) ?? 0) + 1);
  const hot = [...windowTags.entries()]
    .filter(([, c]) => c >= 2)
    .map(([tag, c]) => ({ tag, window: c, archive: archiveTags.get(tag) ?? c }))
    .sort((a, b) => b.window - a.window)
    .slice(0, 12);

  // contradiction candidates: window notes sharing ≥2 tags with archive notes
  const pairs: { a: string; b: string; shared_tags: string[] }[] = [];
  outer: for (const n of fresh) {
    for (const o of all) {
      if (o.slug === n.slug) continue;
      const shared = n.tags.filter((t) => o.tags.includes(t));
      if (shared.length >= 2) {
        pairs.push({ a: n.path, b: o.path, shared_tags: shared });
        if (pairs.length >= 5) break outer;
      }
    }
  }

  const seedlings = all.filter((n) => n.status === "seedling").length;
  const candidates = fresh.slice(0, limit);
  return {
    window_days: days,
    scanned: all.length,
    excluded_surfaced: excluded,
    candidates,
    dropped_overflow: Math.max(0, fresh.length - candidates.length),
    hot_tags: hot,
    seedlings_total: seedlings,
    contradiction_candidates: pairs,
  };
}

// ── mark ──

function markFromDigest(digestPath: string): { slugs: number; items: number } {
  const raw = readFileSync(digestPath, "utf-8");
  const st = loadState();
  const stamp = today();
  let slugs = 0;
  for (const m of raw.matchAll(/KNOWLEDGE\/(?:People|Companies|Ideas|Research|Blogs|Books)\/([a-z0-9-]+)\.md/g)) {
    if (!st.surfaced_slugs[m[1]]) { st.surfaced_slugs[m[1]] = stamp; slugs++; }
  }
  let items = 0;
  for (const m of raw.matchAll(/^### (.+)$/gm)) {
    const h = itemHash(m[1]);
    if (!st.item_hashes[h]) { st.item_hashes[h] = stamp; items++; }
  }
  st.last_run = stamp;
  saveState(st);
  return { slugs, items };
}

// ── headless run ──

const SYNTH_SYSTEM = `You are the Distill synthesizer for a personal knowledge archive. From the candidate notes JSON, produce the week's digest items. Rules: every item cites >=2 source note paths from the candidates (field "sources", exact paths); every item has a one-sentence plain-language "pitch" and a "why_now" line grounded in recency or cluster growth; lanes are "content" (could become a post/newsletter/video), "system" (an improvement to the AI system itself), "health" (archive-quality observation). Quality over quantity — return only items genuinely worth the principal's attention; zero items in a lane is a valid answer. Respond with ONLY a JSON object: {"items":[{"lane","title","pitch","why_now","sources",["suggested_format"],["recommendation"],["target_surface"]}]}`;

async function runHeadless(dryRun: boolean): Promise<void> {
  const cfg = loadConfig();
  const g = gather(cfg.windowDays, 100);
  if (g.candidates.length === 0) {
    console.log("[distill] no fresh candidates in window — nothing to do");
    return;
  }

  // synthesis via Inference.ts — sanctioned subprocess utility, never a nested claude session
  const user = JSON.stringify({ candidates: g.candidates, hot_tags: g.hot_tags });
  const proc = Bun.spawnSync(
    ["bun", join(BASE, "TOOLS", "Inference.ts"), "--json", "--level", "high", "--timeout", "240000", SYNTH_SYSTEM, user],
    { env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
  );
  const out = proc.stdout.toString();
  const jsonMatch = out.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[distill] synthesis failed — no JSON in Inference output:\n${out.slice(0, 500)}\n${proc.stderr.toString().slice(0, 500)}`);
    process.exit(1);
  }
  let items: DigestItem[];
  try { items = JSON.parse(jsonMatch[0]).items ?? []; } catch (e) {
    console.error(`[distill] synthesis JSON unparseable: ${e}`);
    process.exit(1);
  }

  // enforce caps + item-level dedupe
  const st = loadState();
  items = items.filter((i) => i.title && i.pitch && (i.sources?.length ?? 0) >= 1 && !st.item_hashes[itemHash(i.title)]);
  const dropped = Math.max(0, items.length - cfg.maxDigestItems);
  items = items.slice(0, cfg.maxDigestItems);
  const content = items.filter((i) => i.lane === "content").slice(0, cfg.maxIssues);
  const system = items.filter((i) => i.lane === "system").slice(0, cfg.maxUpgrades);
  const health = items.filter((i) => i.lane === "health");

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, content, system, health, dropped_overflow: dropped, gather: { ...g, candidates: g.candidates.length } }, null, 2));
    return;
  }

  // route: content lane → gh issues
  const routedContent: { item: DigestItem; dest: string }[] = [];
  for (const item of content) {
    let dest = "not filed — no contentRepo configured";
    if (cfg.contentRepo) {
      const body = `${item.pitch}\n\n**Why now:** ${item.why_now}\n\n**Sources:**\n${item.sources.map((s) => `- \`${s}\``).join("\n")}\n\n${item.suggested_format ? `**Suggested format:** ${item.suggested_format}\n\n` : ""}_Filed by Cortex Distill._`;
      const r = Bun.spawnSync(["gh", "issue", "create", "--repo", cfg.contentRepo, "--label", cfg.contentLabel ?? "content-idea", "--title", item.title, "--body", body], { stdout: "pipe", stderr: "pipe" });
      dest = r.exitCode === 0 ? r.stdout.toString().trim() : `not filed — gh error: ${r.stderr.toString().trim().slice(0, 200)}`;
    }
    routedContent.push({ item, dest });
  }

  // route: system lane → Upgrades store
  const routedSystem: { item: DigestItem; dest: string }[] = [];
  for (const item of system) {
    const res = addUpgrade({
      claim: item.pitch,
      source: "autonomous",
      recommendation: item.recommendation,
      target_surface: item.target_surface,
      evidence: item.sources,
    });
    routedSystem.push({ item, dest: res.created ? `upgrade ${res.id}` : `not filed — ${res.reason ?? "duplicate"}` });
  }

  // digest
  mkdirSync(DIGESTS, { recursive: true });
  const digestPath = join(DIGESTS, `${today()}-distill.md`);
  const section = (rows: { item: DigestItem; dest: string }[], empty: string) =>
    rows.length === 0 ? `_empty — ${empty}_\n` : rows.map(({ item, dest }) =>
      `### ${item.title}\n\n- ${item.pitch}\n- why now: ${item.why_now}\n- sources: ${item.sources.map((s) => `\`${s}\``).join(", ")}\n- routed: ${dest}\n`).join("\n");
  const digest = `# Cortex Distill — ${today()}

> window ${g.window_days}d · ${g.scanned} notes scanned · ${g.candidates.length} candidates · ${g.excluded_surfaced} previously surfaced excluded${dropped ? ` · ${dropped} items dropped over cap` : ""}

## Content candidates

${section(routedContent, "no content-grade clusters this week")}
## System improvements

${section(routedSystem, "nothing upgrade-shaped this week")}
## Archive health

- seedlings in archive: ${g.seedlings_total}
- hot tags: ${g.hot_tags.map((t) => `${t.tag} (${t.window}/${t.archive})`).join(", ") || "none"}
${health.map((i) => `- ${i.pitch} (${i.sources.map((s) => `\`${s}\``).join(", ")})`).join("\n")}
${g.contradiction_candidates.map((p) => `- possible contradiction: \`${p.a}\` ↔ \`${p.b}\` (${p.shared_tags.join(", ")})`).join("\n")}
- deeper action: \`/knowledge develop\` · \`/knowledge contradictions\`
`;
  writeFileSync(digestPath, digest);
  const marked = markFromDigest(digestPath);
  console.log(JSON.stringify({ digest: digestPath, issues: routedContent.map((r) => r.dest), upgrades: routedSystem.map((r) => r.dest), marked }, null, 2));

  // best-effort notification — Pulse may be down; never fail the run over it
  try {
    await fetch(`${PULSE_BASE}/notify`, { // port via endpoint.ts resolver (#2392)
      method: "POST", headers: { "Content-Type": "application/json" },
      // voice_enabled must be explicit: /notify defaults voice ON, and scheduled tasks never voice ({{PRINCIPAL_NAME}}, 2026-08-14)
      body: JSON.stringify({ message: `Cortex distill complete: ${routedContent.length} content ideas, ${routedSystem.length} upgrades filed.`, voice_enabled: false }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

// ── CLI ──

function argVal(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case "gather": {
    const cfg = loadConfig();
    const days = Number(argVal(args, "--days") ?? cfg.windowDays);
    const limit = Number(argVal(args, "--limit") ?? 100);
    console.log(JSON.stringify(gather(days, limit), null, 2));
    break;
  }
  case "mark": {
    const p = argVal(args, "--digest");
    if (!p || !existsSync(p)) { console.error("usage: KnowledgeDistill.ts mark --digest <path>"); process.exit(1); }
    console.log(JSON.stringify(markFromDigest(p)));
    break;
  }
  case "run": {
    await runHeadless(args.includes("--dry-run"));
    break;
  }
  case "status": {
    const st = loadState();
    console.log(JSON.stringify({ last_run: st.last_run, surfaced_slugs: Object.keys(st.surfaced_slugs).length, item_hashes: Object.keys(st.item_hashes).length, config: loadConfig() }, null, 2));
    break;
  }
  default:
    console.log("usage: KnowledgeDistill.ts gather [--days N] [--limit N] | mark --digest <path> | run [--headless] [--dry-run] | status");
    process.exit(cmd ? 1 : 0);
}
