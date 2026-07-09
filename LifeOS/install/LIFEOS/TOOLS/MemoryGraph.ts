#!/usr/bin/env bun
/**
 * MemoryGraph — a first-class graph layer over the WHOLE LifeOS memory system.
 *
 * Supersedes KnowledgeGraph.ts (KNOWLEDGE-only, console-text, no clustering).
 * Ingests every memory silo as nodes, builds DECLARED edges (related / wikilink /
 * tag), runs graphology pattern algorithms (Louvain communities, PageRank, degree,
 * optional betweenness), and emits two artifacts under MEMORY/GRAPH/:
 *   - graph.json    full nodes + edges + community + centrality (viz + tools read this)
 *   - PATTERNS.md   human-readable: communities, god-nodes, bridges, orphans, contradictions
 *
 * DECLARED EDGES ONLY in this slice — no inferred/semantic edges. Per the advisor:
 * edge quality is load-bearing for 100% of patterns, and auto-inference is ~30% wrong,
 * so the trustworthy baseline ships first. Inference is a later, validated layer.
 *
 * Privacy: 100% local. Zero network calls.
 *
 * Commands:
 *   build      Rebuild the graph cache (graph.json) + PATTERNS.md
 *   patterns   Print the pattern report (rebuilds if cache stale/missing)
 *   stats      One-line health: nodes, edges, communities, orphans, age
 *   related <slug>   Show a node's direct connections (compat with KnowledgeGraph)
 */

import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import pagerank from "graphology-metrics/centrality/pagerank";
import * as fs from "fs";
import * as path from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME!;
const LIFEOS_DIR = process.env.LIFEOS_DIR || path.join(HOME, ".claude", "LIFEOS");
const MEMORY = path.join(LIFEOS_DIR, "MEMORY");
const KNOWLEDGE_DIR = path.join(MEMORY, "KNOWLEDGE");
const WORK_DIR = path.join(MEMORY, "WORK");
const OUT_DIR = path.join(MEMORY, "GRAPH");

const KNOWLEDGE_DOMAINS = ["People", "Companies", "Ideas", "Research"];
const SKIP_FILES = new Set(["_index.md", "_schema.md", "_log.md", "README.md"]);
const SKIP_DIRS = new Set(["_archive", "_embeddings", "_harvest-queue", "_drafts"]);
const TAG_GROUP_CAP = 50;
const BETWEENNESS_MAX_NODES = 2500; // guard: betweenness is O(VE), skip on huge graphs

// ============================================================================
// Types
// ============================================================================

interface MemNode {
  id: string;
  silo: string; // knowledge | work
  type: string; // idea | person | company | research | isa
  title: string;
  path: string;
  tags: string[];
  updated: string | null;
}

interface MemEdge {
  from: string;
  to: string;
  weight: number;
  kind: "related" | "wikilink" | "tag" | "inferred" | "semantic";
  label?: string;
}

type EdgeLayer = "declared" | "all"; // declared = related+wikilink+tag; all = +inferred

// ============================================================================
// Frontmatter parsing (tolerant — handles our flat YAML + nested related:)
// ============================================================================

function readFront(content: string): { fm: Record<string, any>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  const fm: Record<string, any> = {};
  for (const line of m[1].split("\n")) {
    if (line.startsWith("  ") || line.startsWith("\t") || line.startsWith("-")) continue;
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let val: any = line.slice(i + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s: string) => s.trim().replace(/['"]/g, "")).filter(Boolean);
    } else {
      val = val.replace(/^['"]|['"]$/g, "");
    }
    fm[key] = val;
  }
  return { fm, body: m[2] };
}

function parseTags(fm: Record<string, any>): string[] {
  const t = fm.tags;
  if (Array.isArray(t)) return t.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof t === "string") return t.split(",").map((x) => x.trim().replace(/['"]/g, "").toLowerCase()).filter(Boolean);
  return [];
}

// Extract typed related: entries from a knowledge note's frontmatter block.
function extractRelated(content: string): Array<{ slug: string; type: string }> {
  const out: Array<{ slug: string; type: string }> = [];
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return out;
  const lines = fm[1].split("\n");
  let inRelated = false;
  let cur: string | null = null;
  for (const line of lines) {
    if (/^related\s*:/.test(line)) { inRelated = true; continue; }
    if (!inRelated) continue;
    if (!line.startsWith("  ") && !line.startsWith("\t") && !line.startsWith("-") && line.trim()) { inRelated = false; continue; }
    const slugM = line.match(/slug:\s*(.+)/);
    if (slugM) {
      if (cur) out.push({ slug: cur, type: "related" });
      cur = slugM[1].trim().replace(/['"]/g, "");
      continue;
    }
    const typeM = line.match(/type:\s*(.+)/);
    if (typeM && cur) { out.push({ slug: cur, type: typeM[1].trim().replace(/['"]/g, "") }); cur = null; }
  }
  if (cur) out.push({ slug: cur, type: "related" });
  return out;
}

function extractWikilinks(body: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1].trim();
    const slug = raw.includes("/") ? raw.split("/").pop()! : raw;
    if (slug && !slug.startsWith("_")) out.push(slug);
  }
  return out;
}

// ============================================================================
// Ingestion
// ============================================================================

interface Raw { node: MemNode; content: string; }

function ingest(): Raw[] {
  const raws: Raw[] = [];

  // KNOWLEDGE silo
  for (const domain of KNOWLEDGE_DOMAINS) {
    const dir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (SKIP_FILES.has(entry) || !entry.endsWith(".md")) continue;
      const fp = path.join(dir, entry);
      try { if (!fs.statSync(fp).isFile()) continue; } catch { continue; }
      const slug = entry.replace(/\.md$/, "");
      const content = fs.readFileSync(fp, "utf-8");
      const { fm } = readFront(content);
      raws.push({
        node: {
          id: slug, silo: "knowledge", type: fm.type || domain.toLowerCase(),
          title: fm.title || slug, path: fp, tags: parseTags(fm),
          updated: fm.last_updated || fm.updated || fm.created || null,
        }, content,
      });
    }
  }

  // WORK silo — one node per WORK/{slug}/, prefer ISA.md then PRD.md
  if (fs.existsSync(WORK_DIR)) {
    for (const entry of fs.readdirSync(WORK_DIR)) {
      if (SKIP_DIRS.has(entry)) continue;
      const wdir = path.join(WORK_DIR, entry);
      try { if (!fs.statSync(wdir).isDirectory()) continue; } catch { continue; }
      const file = ["ISA.md", "PRD.md"].map((f) => path.join(wdir, f)).find((f) => fs.existsSync(f));
      if (!file) continue;
      const content = fs.readFileSync(file, "utf-8");
      const { fm } = readFront(content);
      const id = `work:${entry}`;
      raws.push({
        node: {
          id, silo: "work", type: "isa",
          title: fm.task || fm.title || entry, path: file, tags: parseTags(fm),
          updated: fm.updated || fm.started || null,
        }, content,
      });
    }
  }

  return raws;
}

// ============================================================================
// Lexical inference (ISC-9) — connects the orphans that declared edges can't.
// WORK ISAs have no tags but rich task/goal text, so we infer from IDF-weighted
// token overlap over title+task+goal+tags+slug+snippet. Pure-local, no model.
// Labeled `inferred` and provenance-separable from declared edges (ISC-11/35).
// ============================================================================

const STOP = new Set(("a an and are as at be by for from has have in into is it its of on or that the to with we our this " +
  "you your i me my system build make want need use using via pai memory work isa kai daniel new add get set " +
  "not but all any can will should would they them then than over under about across into out up down").split(" "));

function tokenize(text: string): Set<string> {
  const toks = (text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) || [])
    .map((t: string) => t.replace(/^-+|-+$/g, ""))
    .filter((t: string) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
  return new Set(toks);
}

function nodeText(node: MemNode, content: string): string {
  const goal = (content.match(/principal_stated_goal:\s*(.+)/)?.[1] || "").replace(/['"]/g, "");
  const slugWords = node.id.replace(/^work:/, "").replace(/^\d+[-_]?/, "").replace(/[-_]/g, " ");
  return [node.title, node.tags.join(" "), goal, slugWords].join(" ");
}

interface Inferred { from: string; to: string; score: number; }

// Returns inferred edges via IDF-weighted shared-token cosine, top-K per node above threshold.
function computeInferred(raws: Raw[], opts: { topK?: number; minScore?: number } = {}): Inferred[] {
  const topK = opts.topK ?? 6;
  const minScore = opts.minScore ?? 0.18;
  const N = raws.length;

  const tokensOf = new Map<string, Set<string>>();
  const posting = new Map<string, string[]>(); // token -> node ids
  for (const { node, content } of raws) {
    const toks = tokenize(nodeText(node, content));
    tokensOf.set(node.id, toks);
    for (const t of toks) {
      if (!posting.has(t)) posting.set(t, []);
      posting.get(t)!.push(node.id);
    }
  }
  // IDF per token; drop ultra-common tokens (in >12% of nodes — they're noise, e.g. "ai")
  const idf = new Map<string, number>();
  const COMMON = N * 0.12;
  for (const [t, nodes] of [...posting]) {
    if (nodes.length < 2 || nodes.length > COMMON) { posting.delete(t); continue; }
    idf.set(t, Math.log(N / nodes.length));
  }
  // Per-node vector norm (sqrt sum idf^2 over kept tokens)
  const norm = new Map<string, number>();
  for (const [id, toks] of [...tokensOf]) {
    let s = 0;
    for (const t of toks) { const w = idf.get(t); if (w) s += w * w; }
    norm.set(id, Math.sqrt(s) || 1);
  }
  // Accumulate shared-token IDF^2 per candidate pair via postings
  const out: Inferred[] = [];
  const perNode = new Map<string, Array<{ to: string; score: number }>>();
  for (const [id, toks] of [...tokensOf]) {
    const acc = new Map<string, number>();
    for (const t of toks) {
      const w = idf.get(t); if (!w) continue;
      const post = posting.get(t); if (!post) continue;
      for (const other of post) {
        if (other === id) continue;
        acc.set(other, (acc.get(other) || 0) + w * w);
      }
    }
    const ranked: Array<{ to: string; score: number }> = [];
    for (const [other, dot] of [...acc]) {
      const score = dot / (norm.get(id)! * norm.get(other)!);
      if (score >= minScore) ranked.push({ to: other, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    perNode.set(id, ranked.slice(0, topK));
  }
  // Symmetric dedup
  const seen = new Set<string>();
  for (const [id, list] of [...perNode]) for (const { to, score } of list) {
    const key = id < to ? `${id}|${to}` : `${to}|${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: id, to, score });
  }
  return out;
}

// ============================================================================
// Graph build
// ============================================================================

function buildGraph(raws: Raw[], layer: EdgeLayer = "declared"): { graph: Graph; edges: MemEdge[] } {
  const graph = new Graph({ type: "undirected", multi: false });

  // bare-slug -> id resolver (knowledge slug is bare; work id is "work:slug")
  const bareToId = new Map<string, string>();
  for (const { node } of raws) {
    graph.addNode(node.id, { ...node });
    const bare = node.id.startsWith("work:") ? node.id.slice(5) : node.id;
    if (!bareToId.has(bare)) bareToId.set(bare, node.id);
  }

  const edges: MemEdge[] = [];
  const addEdge = (from: string, to: string, weight: number, kind: MemEdge["kind"], label?: string) => {
    if (from === to) return;
    if (!graph.hasNode(from) || !graph.hasNode(to)) return;
    if (graph.hasEdge(from, to)) {
      // keep the strongest edge kind/weight
      const w = graph.getEdgeAttribute(graph.edge(from, to), "weight") as number;
      if (weight > w) graph.setEdgeAttribute(graph.edge(from, to), "weight", weight);
      return;
    }
    graph.addEdge(from, to, { weight, kind, label });
    edges.push({ from, to, weight, kind, label });
  };

  // Declared: related (typed) + wikilinks (cross-silo capable)
  for (const { node, content } of raws) {
    for (const rel of extractRelated(content)) {
      const tid = bareToId.get(rel.slug);
      if (tid) addEdge(node.id, tid, 5, "related", rel.type);
    }
    const { body } = readFront(content);
    for (const wl of extractWikilinks(body)) {
      const tid = bareToId.get(wl);
      if (tid) addEdge(node.id, tid, 3, "wikilink");
    }
  }

  // Tag co-occurrence (capped per tag group)
  const tagIndex = new Map<string, string[]>();
  for (const { node } of raws) for (const t of node.tags) {
    if (!tagIndex.has(t)) tagIndex.set(t, []);
    tagIndex.get(t)!.push(node.id);
  }
  for (const [tag, ids] of tagIndex) {
    if (ids.length < 2) continue;
    const g = ids.length > TAG_GROUP_CAP ? ids.slice(0, TAG_GROUP_CAP) : ids;
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) addEdge(g[i], g[j], 1, "tag", tag);
  }

  // Inferred (lexical) edges — only in the "all" layer (ISC-9/35: provenance-separable)
  if (layer === "all") {
    for (const inf of computeInferred(raws)) {
      // weight scaled into 1..4 band; never outranks a declared `related` (5)
      addEdge(inf.from, inf.to, Math.min(4, 1 + inf.score * 4), "inferred", inf.score.toFixed(2));
    }
  }

  return { graph, edges };
}

// ============================================================================
// Patterns
// ============================================================================

function computePatterns(graph: Graph) {
  // Communities (Louvain)
  louvain.assign(graph, { resolution: 1 });

  // PageRank (influence) + degree
  pagerank.assign(graph, { getEdgeWeight: "weight" });

  const degree = new Map<string, number>();
  graph.forEachNode((n) => degree.set(n, graph.degree(n)));

  // Optional betweenness (bridges) — guarded for scale
  let betweenness: Map<string, number> | null = null;
  if (graph.order <= BETWEENNESS_MAX_NODES) {
    try {
      const bc = require("graphology-metrics/centrality/betweenness");
      const fn = bc.default || bc;
      const res = fn(graph, { getEdgeWeight: "weight" });
      betweenness = new Map(Object.entries(res) as [string, number][]);
    } catch { betweenness = null; }
  }

  // Communities -> members
  const comm = new Map<number, string[]>();
  graph.forEachNode((n, attr) => {
    const c = attr.community as number;
    if (!comm.has(c)) comm.set(c, []);
    comm.get(c)!.push(n);
  });

  const pr = (n: string) => graph.getNodeAttribute(n, "pagerank") as number;

  // Name each community by its top-pagerank members' tags + lead title
  const communities = [...comm.entries()].map(([id, members]) => {
    const sorted = [...members].sort((a, b) => pr(b) - pr(a));
    const tagFreq = new Map<string, number>();
    for (const m of members) for (const t of (graph.getNodeAttribute(m, "tags") as string[]))
      tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
    const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    return {
      id, size: members.length,
      lead: graph.getNodeAttribute(sorted[0], "title") as string,
      name: topTags.length ? topTags.join(" · ") : (graph.getNodeAttribute(sorted[0], "title") as string),
      siloMix: members.reduce((acc: Record<string, number>, m: string) => {
        const s = graph.getNodeAttribute(m, "silo") as string; acc[s] = (acc[s] || 0) + 1; return acc;
      }, {}),
    };
  }).sort((a, b) => b.size - a.size);

  const allNodes = graph.nodes();
  const godNodes = [...allNodes].sort((a, b) => pr(b) - pr(a)).slice(0, 15)
    .map((n) => ({ id: n, title: graph.getNodeAttribute(n, "title"), silo: graph.getNodeAttribute(n, "silo"), pagerank: pr(n), degree: degree.get(n)! }));

  const degVals = [...degree.values()].sort((a, b) => a - b);
  const medianDeg = degVals[Math.floor(degVals.length / 2)] || 0;
  let bridges: any[] = [];
  if (betweenness) {
    bridges = [...allNodes]
      .filter((n) => degree.get(n)! <= medianDeg && degree.get(n)! > 0)
      .sort((a, b) => (betweenness!.get(b) || 0) - (betweenness!.get(a) || 0))
      .slice(0, 15)
      .map((n) => ({ id: n, title: graph.getNodeAttribute(n, "title"), silo: graph.getNodeAttribute(n, "silo"), betweenness: betweenness!.get(n) || 0, degree: degree.get(n)! }));
  }

  const now = Date.now();
  const orphans = [...allNodes].filter((n) => degree.get(n)! === 0)
    .map((n) => {
      const u = graph.getNodeAttribute(n, "updated") as string | null;
      const ageDays = u ? Math.floor((now - Date.parse(u)) / 86400000) : null;
      return { id: n, title: graph.getNodeAttribute(n, "title"), silo: graph.getNodeAttribute(n, "silo"), ageDays };
    })
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));

  // Contradictions: edges declared with type 'contradicts'
  const contradictions: any[] = [];
  graph.forEachEdge((_e, attr, s, t) => {
    if (attr.kind === "related" && attr.label === "contradicts")
      contradictions.push({ from: s, to: t, fromTitle: graph.getNodeAttribute(s, "title"), toTitle: graph.getNodeAttribute(t, "title") });
  });

  return { communities, godNodes, bridges, orphans, contradictions, betweennessComputed: !!betweenness, medianDeg };
}

// ============================================================================
// Emit
// ============================================================================

function emit(graph: Graph, edges: MemEdge[], p: ReturnType<typeof computePatterns>) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const nodes = graph.mapNodes((n, attr) => ({
    id: n, silo: attr.silo, type: attr.type, title: attr.title,
    community: attr.community, pagerank: attr.pagerank, degree: graph.degree(n), tags: attr.tags,
  }));
  fs.writeFileSync(path.join(OUT_DIR, "graph.json"),
    JSON.stringify({ generated: new Date().toISOString(), nodeCount: graph.order, edgeCount: graph.size, nodes, edges }, null, 0));

  const siloCounts: Record<string, number> = {};
  graph.forEachNode((_n, a) => { siloCounts[a.silo] = (siloCounts[a.silo] || 0) + 1; });
  const crossSilo = edges.filter((e) => {
    const a = graph.getNodeAttribute(e.from, "silo"), b = graph.getNodeAttribute(e.to, "silo");
    return a !== b;
  }).length;

  const L: string[] = [];
  L.push(`# Memory Graph — Patterns`, ``, `> Generated ${new Date().toISOString()} · DECLARED edges only (trustworthy baseline)`, ``);
  L.push(`**Graph:** ${graph.order} nodes (${Object.entries(siloCounts).map(([s, c]) => `${s} ${c}`).join(", ")}), ${graph.size} edges, ${crossSilo} cross-silo, ${p.communities.length} communities.`, ``);
  if (crossSilo < graph.size * 0.02)
    L.push(`> ⚠️ Cross-silo edges are thin (${crossSilo}/${graph.size}). The "all your memory" graph is currently mostly within-silo — declared links rarely cross WORK↔KNOWLEDGE. Inferred/semantic edges (next slice) are what light up cross-silo structure.`, ``);

  L.push(`## Communities (top 15 by size)`, ``);
  for (const c of p.communities.slice(0, 15))
    L.push(`- **${c.name}** — ${c.size} items (${Object.entries(c.siloMix).map(([s, n]) => `${s} ${n}`).join(", ")}); lead: _${c.lead}_`);
  L.push(``);

  L.push(`## God-nodes (top by PageRank — the gravitational centers)`, ``);
  for (const g of p.godNodes) L.push(`- **${g.title}** \`${g.id}\` — ${g.silo}, degree ${g.degree}`);
  L.push(``);

  L.push(`## Bridges (high betweenness, low degree — the secret connectors)`, ``);
  if (p.betweennessComputed && p.bridges.length) for (const b of p.bridges) L.push(`- **${b.title}** \`${b.id}\` — ${b.silo}, degree ${b.degree}`);
  else L.push(`_Betweenness skipped (graph > ${BETWEENNESS_MAX_NODES} nodes) or unavailable — bridge detection deferred to the filtered-graph slice._`);
  L.push(``);

  L.push(`## Orphans (unconnected — captured then abandoned)`, ``);
  L.push(`${p.orphans.length} orphan nodes. Oldest 20:`, ``);
  for (const o of p.orphans.slice(0, 20)) L.push(`- ${o.title} \`${o.id}\` — ${o.silo}${o.ageDays != null ? `, ${o.ageDays}d old` : ""}`);
  L.push(``);

  L.push(`## Contradictions (declared \`contradicts\` links)`, ``);
  if (p.contradictions.length) for (const c of p.contradictions) L.push(`- _${c.fromTitle}_ ⟂ _${c.toTitle}_`);
  else L.push(`_None declared. Semantic-opposition detection is a later slice._`);
  L.push(``);

  fs.writeFileSync(path.join(OUT_DIR, "PATTERNS.md"), L.join("\n"));
}

// ============================================================================
// Commands
// ============================================================================

function build(layer: EdgeLayer = "declared"): { order: number; size: number; communities: number; orphans: number; inferred: number } {
  const raws = ingest();
  const { graph, edges } = buildGraph(raws, layer);
  const p = computePatterns(graph);
  emit(graph, edges, p);
  const inferred = edges.filter((e) => e.kind === "inferred").length;
  return { order: graph.order, size: graph.size, communities: p.communities.length, orphans: p.orphans.length, inferred };
}

// Validation gate (ISC-36): does lexical inference recover human-declared links,
// and how clean is it? Honest framing: precision-against-declared understates quality
// (a missing declared edge is not a wrong inference), so we report recall as the trust
// signal + a spot-check sample, and the cross-silo payoff inference unlocks.
function validate() {
  const raws = ingest();
  const { graph: declaredG } = buildGraph(raws, "declared");
  // Ground truth: human-asserted edges (related + wikilink), as undirected pairs
  const truth = new Set<string>();
  declaredG.forEachEdge((_e, attr, s, t) => {
    if (attr.kind === "related" || attr.kind === "wikilink") truth.add(s < t ? `${s}|${t}` : `${t}|${s}`);
  });
  const inferred = computeInferred(raws);
  const infSet = new Set(inferred.map((i) => (i.from < i.to ? `${i.from}|${i.to}` : `${i.to}|${i.from}`)));

  let recovered = 0;
  for (const pair of [...truth]) if (infSet.has(pair)) recovered++;
  const recall = truth.size ? recovered / truth.size : 0;

  // Precision proxy: of inferred edges whose BOTH endpoints are knowledge (where declared
  // links actually exist densely), how many are also declared?
  const sBilo = (id: string) => declaredG.getNodeAttribute(id, "silo");
  let infKK = 0, infKKdeclared = 0;
  for (const i of inferred) {
    if (sBilo(i.from) === "knowledge" && sBilo(i.to) === "knowledge") {
      infKK++;
      if (truth.has(i.from < i.to ? `${i.from}|${i.to}` : `${i.to}|${i.from}`)) infKKdeclared++;
    }
  }
  const precisionProxy = infKK ? infKKdeclared / infKK : 0;

  const crossSilo = inferred.filter((i) => sBilo(i.from) !== sBilo(i.to));
  const PRECISION_FLOOR = 0.05; // proxy floor; low by design (declared is sparse ground truth)

  console.log(`\n🔬 Inference Validation (lexical, IDF token-overlap)`);
  console.log("─".repeat(60));
  console.log(`  Declared (human) edges (ground truth): ${truth.size}`);
  console.log(`  Inferred edges total:                  ${inferred.length}`);
  console.log(`  Recall (declared pairs inference also finds): ${(recall * 100).toFixed(1)}%  ← trust signal`);
  console.log(`  Precision-proxy (KK-inferred that are declared): ${(precisionProxy * 100).toFixed(1)}%  (floor ${PRECISION_FLOOR * 100}% — low by design; declared is sparse)`);
  console.log(`  NEW cross-silo edges inference unlocks: ${crossSilo.length}  ← the payoff for the 75% orphans`);
  console.log(`  Gate: ${precisionProxy >= PRECISION_FLOOR ? "PASS — inferred edges safe to surface behind the `all` layer" : "HOLD — keep inferred filtered until threshold tuned"}`);
  console.log(`\n  Top cross-silo inferred edges (spot-check these — AI suggests, you ratify):`);
  for (const c of crossSilo.sort((a, b) => b.score - a.score).slice(0, 12)) {
    console.log(`    ${c.score.toFixed(2)}  ${declaredG.getNodeAttribute(c.from, "title")}  ⟷  ${declaredG.getNodeAttribute(c.to, "title")}`);
  }
  console.log("─".repeat(60));
}

function cacheAgeMin(): number | null {
  const f = path.join(OUT_DIR, "graph.json");
  if (!fs.existsSync(f)) return null;
  return (Date.now() - fs.statSync(f).mtimeMs) / 60000;
}

const cmd = process.argv[2] || "patterns";
const layer: EdgeLayer = process.argv.includes("--all") ? "all" : "declared";

if (cmd === "build") {
  const t0 = performance.now();
  const r = build(layer);
  console.log(`✅ Memory graph rebuilt (${layer} edges) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ${r.order} nodes, ${r.size} edges${layer === "all" ? ` (${r.inferred} inferred)` : ""}, ${r.communities} communities, ${r.orphans} orphans`);
  console.log(`   → ${path.join(OUT_DIR, "PATTERNS.md")}`);
} else if (cmd === "validate") {
  validate();
} else if (cmd === "stats") {
  const age = cacheAgeMin();
  if (age === null) { console.log("No graph cache. Run: bun MemoryGraph.ts build"); process.exit(0); }
  const g = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "graph.json"), "utf-8"));
  const comms = new Set(g.nodes.map((n: any) => n.community)).size;
  const orphans = g.nodes.filter((n: any) => n.degree === 0).length;
  console.log(`🕸️  Memory graph: ${g.nodeCount} nodes, ${g.edgeCount} edges, ${comms} communities, ${orphans} orphans · cache ${age.toFixed(0)}m old`);
} else if (cmd === "patterns") {
  const age = cacheAgeMin();
  if (age === null || age > 60) build(layer);
  console.log(fs.readFileSync(path.join(OUT_DIR, "PATTERNS.md"), "utf-8"));
} else if (cmd === "related") {
  const q = process.argv[3];
  const raws = ingest();
  const { graph } = buildGraph(raws);
  const node = graph.hasNode(q) ? q : graph.hasNode(`work:${q}`) ? `work:${q}` : graph.nodes().find((n) => n.includes(q));
  if (!node) { console.error(`Not found: ${q}`); process.exit(1); }
  console.log(`\n🔗 ${graph.getNodeAttribute(node, "title")} (${node})`);
  graph.forEachNeighbor(node, (nb) => {
    const e = graph.edge(node, nb);
    console.log(`  → ${graph.getNodeAttribute(nb, "title")} [${graph.getEdgeAttribute(e, "kind")}${graph.getEdgeAttribute(e, "label") ? ":" + graph.getEdgeAttribute(e, "label") : ""}]`);
  });
} else {
  console.log("Usage: bun MemoryGraph.ts [build|patterns|stats|related <slug>]");
}
