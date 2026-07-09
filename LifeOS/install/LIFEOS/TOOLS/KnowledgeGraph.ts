#!/usr/bin/env bun
/**
 * KnowledgeGraph — Associative graph navigation over LifeOS's knowledge archive
 *
 * Builds an in-memory graph from KNOWLEDGE/ markdown files using frontmatter tags,
 * wikilinks, and `related:` fields. Enables BFS traversal and related-note queries.
 * NO persistent storage — computed fresh from files at query time.
 *
 * Commands:
 *   traverse <slug>              BFS from slug, show connected notes (default: 2 hops)
 *   traverse <slug> --hops 3     BFS with configurable depth
 *   related <slug>               Show directly connected notes (1 hop)
 *   stats                        Graph summary: nodes, edges, clusters, hubs
 *   hubs                         Top 10 most-connected notes
 *   find <tag>                   Find all notes with a specific tag
 *
 * Examples:
 *   bun KnowledgeGraph.ts traverse karpathy
 *   bun KnowledgeGraph.ts traverse mempalace --hops 3
 *   bun KnowledgeGraph.ts related andrej-karpathy
 *   bun KnowledgeGraph.ts stats
 *   bun KnowledgeGraph.ts hubs
 *   bun KnowledgeGraph.ts find architecture
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


// ============================================================================
// Configuration
// ============================================================================

const HOME = process.env.HOME!;
const LIFEOS_DIR = process.env.LIFEOS_DIR || path.join(HOME, ".claude", "LIFEOS");
const KNOWLEDGE_DIR = path.join(LIFEOS_DIR, "MEMORY", "KNOWLEDGE");
const DOMAINS = ["People", "Companies", "Ideas", "Research"];
const SKIP_FILES = new Set(["_index.md", "_schema.md", "_log.md"]);
const SKIP_DIRS = new Set(["_archive", "_embeddings", "_harvest-queue"]);

// ============================================================================
// Types
// ============================================================================

interface GraphNode {
  slug: string;
  domain: string;
  title: string;
  type: string;
  tags: string[];
  path: string;
}

interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  edgeType: "tag" | "wikilink" | "related";
  label?: string;
}

interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, GraphEdge[]>;
}

interface TraversalNode {
  node: GraphNode;
  hop: number;
  cumulativeWeight: number;
  viaEdge?: GraphEdge;
}

// ============================================================================
// Frontmatter & Content Parsing
// ============================================================================

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      // Skip indented lines (YAML nested content handled separately)
      if (line.startsWith("  ") || line.startsWith("\t")) continue;
      let value: any = line.substring(colonIdx + 1).trim();
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s: string) => s.trim().replace(/['"]/g, ""))
          .filter((s: string) => s.length > 0);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

function extractWikilinks(content: string): string[] {
  // Strip frontmatter before scanning for wikilinks
  const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const raw = match[1].trim();
    // Normalize: strip domain prefix paths like "ideas/" or "people/"
    const slug = raw.includes("/") ? raw.split("/").pop()! : raw;
    if (slug && !slug.startsWith("_")) {
      links.push(slug);
    }
  }
  return links;
}

function extractRelated(content: string): Array<{ slug: string; type: string }> {
  const related: Array<{ slug: string; type: string }> = [];
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return related;

  const lines = fmMatch[1].split("\n");
  let inRelated = false;
  let currentSlug: string | null = null;

  for (const line of lines) {
    if (line.match(/^related\s*:/)) {
      inRelated = true;
      continue;
    }
    if (inRelated) {
      // End of related block: non-indented, non-empty line that isn't a list item
      if (!line.startsWith("  ") && !line.startsWith("\t") && !line.startsWith("-") && line.trim().length > 0) {
        inRelated = false;
        continue;
      }
      // New list item
      if (line.trim().startsWith("- slug:") || line.trim().startsWith("slug:")) {
        const slugMatch = line.match(/slug:\s*(.+)/);
        if (slugMatch) {
          // Push previous entry if exists
          if (currentSlug) {
            related.push({ slug: currentSlug, type: "related" });
          }
          currentSlug = slugMatch[1].trim().replace(/['"]/g, "");
        }
        continue;
      }
      // Type line for current slug
      const typeMatch = line.match(/type:\s*(.+)/);
      if (typeMatch && currentSlug) {
        related.push({
          slug: currentSlug,
          type: typeMatch[1].trim().replace(/['"]/g, ""),
        });
        currentSlug = null;
        continue;
      }
    }
  }
  // Push trailing slug without type
  if (currentSlug) {
    related.push({ slug: currentSlug, type: "related" });
  }

  return related;
}

// ============================================================================
// Graph Construction
// ============================================================================

function buildGraph(): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, GraphEdge[]>();

  // Phase 1: Collect all nodes
  for (const domain of DOMAINS) {
    const domainDir = path.join(KNOWLEDGE_DIR, domain);
    if (!fs.existsSync(domainDir)) continue;

    for (const entry of fs.readdirSync(domainDir)) {
      if (SKIP_FILES.has(entry) || !entry.endsWith(".md")) continue;
      // Skip subdirectories
      const fullPath = path.join(domainDir, entry);
      try {
        if (!fs.statSync(fullPath).isFile()) continue;
      } catch {
        continue;
      }

      const slug = entry.replace(/\.md$/, "");
      const content = fs.readFileSync(fullPath, "utf-8");
      const fm = parseFrontmatter(content);

      const tags = Array.isArray(fm.tags)
        ? fm.tags.map((t: string) => t.trim().toLowerCase())
        : typeof fm.tags === "string"
          ? fm.tags
              .split(",")
              .map((t: string) => t.trim().replace(/['"]/g, "").toLowerCase())
              .filter((t: string) => t.length > 0)
          : [];

      nodes.set(slug, {
        slug,
        domain,
        title: fm.title || slug,
        type: fm.type || "unknown",
        tags,
        path: fullPath,
      });
    }
  }

  // Helper to ensure adjacency list exists
  function ensureAdj(slug: string): void {
    if (!adjacency.has(slug)) adjacency.set(slug, []);
  }

  // Phase 2: Build edges from wikilinks and related fields
  for (const [slug, node] of nodes) {
    const content = fs.readFileSync(node.path, "utf-8");

    // Wikilink edges
    const wikilinks = extractWikilinks(content);
    for (const target of wikilinks) {
      if (!nodes.has(target)) continue; // Only link to known nodes
      if (target === slug) continue; // No self-links
      const edge: GraphEdge = {
        from: slug,
        to: target,
        weight: 3,
        edgeType: "wikilink",
      };
      edges.push(edge);
      ensureAdj(slug);
      adjacency.get(slug)!.push(edge);
    }

    // Related field edges
    const related = extractRelated(content);
    for (const rel of related) {
      if (!nodes.has(rel.slug)) continue;
      if (rel.slug === slug) continue;
      const edge: GraphEdge = {
        from: slug,
        to: rel.slug,
        weight: 5,
        edgeType: "related",
        label: rel.type,
      };
      edges.push(edge);
      ensureAdj(slug);
      adjacency.get(slug)!.push(edge);
    }
  }

  // Phase 3: Tag co-occurrence edges
  // Build tag -> slugs index
  const tagIndex = new Map<string, string[]>();
  for (const [slug, node] of nodes) {
    for (const tag of node.tags) {
      if (!tagIndex.has(tag)) tagIndex.set(tag, []);
      tagIndex.get(tag)!.push(slug);
    }
  }

  // For each pair of notes sharing tags, create one edge per shared tag
  // To avoid O(n^2) explosion on popular tags, cap tag group size
  const TAG_GROUP_CAP = 50;
  const tagEdgeSet = new Set<string>(); // track "from|to|tag" to deduplicate

  for (const [tag, slugs] of tagIndex) {
    if (slugs.length < 2) continue;
    const group = slugs.length > TAG_GROUP_CAP ? slugs.slice(0, TAG_GROUP_CAP) : slugs;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        // Create bidirectional tag edges, but deduplicate
        const keyAB = `${a}|${b}|${tag}`;
        const keyBA = `${b}|${a}|${tag}`;
        if (tagEdgeSet.has(keyAB)) continue;
        tagEdgeSet.add(keyAB);
        tagEdgeSet.add(keyBA);

        const edgeAB: GraphEdge = {
          from: a,
          to: b,
          weight: 1,
          edgeType: "tag",
          label: tag,
        };
        const edgeBA: GraphEdge = {
          from: b,
          to: a,
          weight: 1,
          edgeType: "tag",
          label: tag,
        };
        edges.push(edgeAB, edgeBA);
        ensureAdj(a);
        ensureAdj(b);
        adjacency.get(a)!.push(edgeAB);
        adjacency.get(b)!.push(edgeBA);
      }
    }
  }

  return { nodes, edges, adjacency };
}

// ============================================================================
// Slug Resolution (exact match, then fuzzy)
// ============================================================================

function resolveSlug(graph: KnowledgeGraph, query: string): string | null {
  const q = query.toLowerCase();

  // Exact match
  if (graph.nodes.has(q)) return q;

  // Check all slugs for containment
  const candidates: string[] = [];
  for (const slug of graph.nodes.keys()) {
    if (slug.includes(q)) candidates.push(slug);
  }

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    // Prefer shortest match (most specific)
    candidates.sort((a, b) => a.length - b.length);
    return candidates[0];
  }

  return null;
}

// ============================================================================
// BFS Traversal
// ============================================================================

function traverse(
  graph: KnowledgeGraph,
  startSlug: string,
  maxHops: number
): TraversalNode[] {
  const visited = new Set<string>();
  const result: TraversalNode[] = [];
  const startNode = graph.nodes.get(startSlug);
  if (!startNode) return result;

  // BFS queue: [slug, hop, cumulativeWeight, viaEdge]
  const queue: Array<[string, number, number, GraphEdge | undefined]> = [
    [startSlug, 0, 0, undefined],
  ];
  visited.add(startSlug);

  while (queue.length > 0) {
    const [currentSlug, hop, cumWeight, viaEdge] = queue.shift()!;
    const currentNode = graph.nodes.get(currentSlug);
    if (!currentNode) continue;

    result.push({ node: currentNode, hop, cumulativeWeight: cumWeight, viaEdge });

    if (hop >= maxHops) continue;

    // Get outgoing edges, deduplicate targets, pick highest-weight edge per target
    const outgoing = graph.adjacency.get(currentSlug) || [];
    const bestEdgePerTarget = new Map<string, GraphEdge>();
    for (const edge of outgoing) {
      if (visited.has(edge.to)) continue;
      const existing = bestEdgePerTarget.get(edge.to);
      if (!existing || edge.weight > existing.weight) {
        bestEdgePerTarget.set(edge.to, edge);
      }
    }

    // Sort by weight descending for BFS priority
    const sorted = [...bestEdgePerTarget.entries()].sort(
      (a, b) => b[1].weight - a[1].weight
    );

    for (const [target, edge] of sorted) {
      if (visited.has(target)) continue;
      visited.add(target);
      queue.push([target, hop + 1, cumWeight + edge.weight, edge]);
    }
  }

  return result;
}

// ============================================================================
// Output Helpers
// ============================================================================

function edgeDescription(edge: GraphEdge): string {
  switch (edge.edgeType) {
    case "tag":
      return `tag:${edge.label}`;
    case "wikilink":
      return "wikilink";
    case "related":
      return `related:${edge.label || "related"}`;
  }
}

function connectionCount(graph: KnowledgeGraph, slug: string): number {
  // Count unique connected nodes (both directions)
  const connected = new Set<string>();
  const outgoing = graph.adjacency.get(slug) || [];
  for (const edge of outgoing) {
    connected.add(edge.to);
  }
  // Also count inbound edges
  for (const edge of graph.edges) {
    if (edge.to === slug) {
      connected.add(edge.from);
    }
  }
  return connected.size;
}

function allEdgesForNode(graph: KnowledgeGraph, slug: string): GraphEdge[] {
  const outgoing = graph.adjacency.get(slug) || [];
  const inbound = graph.edges.filter((e) => e.to === slug);
  return [...outgoing, ...inbound];
}

// ============================================================================
// Commands
// ============================================================================

function cmdTraverse(query: string, maxHops: number): void {
  const graph = buildGraph();
  const slug = resolveSlug(graph, query);

  if (!slug) {
    console.error(`Slug not found: "${query}"`);
    // Suggest close matches
    const suggestions: string[] = [];
    const q = query.toLowerCase();
    for (const s of graph.nodes.keys()) {
      if (s.includes(q.substring(0, Math.min(q.length, 5)))) {
        suggestions.push(s);
      }
    }
    if (suggestions.length > 0) {
      console.error(`\n  Did you mean:`);
      for (const s of suggestions.slice(0, 5)) {
        const node = graph.nodes.get(s)!;
        console.error(`    ${s} -- "${node.title}"`);
      }
    }
    process.exit(1);
  }

  const startNode = graph.nodes.get(slug)!;
  const results = traverse(graph, slug, maxHops);

  console.log(
    `\n\u{1F5FA}\uFE0F  Knowledge Graph Traversal: "${slug}"`
  );
  console.log("\u2500".repeat(50));
  console.log(
    `\n\u{1F4CD} START: ${slug} -- "${startNode.title}" (${startNode.type})`
  );

  // Group by hop
  const byHop = new Map<number, TraversalNode[]>();
  for (const r of results) {
    if (r.hop === 0) continue; // Skip start node
    if (!byHop.has(r.hop)) byHop.set(r.hop, []);
    byHop.get(r.hop)!.push(r);
  }

  for (const [hop, nodes] of [...byHop.entries()].sort((a, b) => a[0] - b[0])) {
    const label = hop === 1 ? "Hop 1 (direct connections)" : `Hop ${hop}`;
    console.log(`\n  ${label}:`);

    // Sort by cumulative weight descending
    nodes.sort((a, b) => b.cumulativeWeight - a.cumulativeWeight);

    for (const r of nodes) {
      const via = r.viaEdge ? ` via ${edgeDescription(r.viaEdge)}` : "";
      console.log(
        `    -> ${r.node.slug} (${r.node.type})${via} [weight: ${r.viaEdge?.weight || 0}]`
      );
    }
  }

  const totalTraversed = results.length;
  const maxHopReached = byHop.size > 0 ? Math.max(...byHop.keys()) : 0;
  console.log("\n" + "\u2500".repeat(50));
  console.log(
    `Traversed ${totalTraversed} nodes across ${maxHopReached} hops from ${graph.nodes.size} total nodes.`
  );
}

function cmdRelated(query: string): void {
  const graph = buildGraph();
  const slug = resolveSlug(graph, query);

  if (!slug) {
    console.error(`Slug not found: "${query}"`);
    process.exit(1);
  }

  const startNode = graph.nodes.get(slug)!;
  const results = traverse(graph, slug, 1);

  console.log(`\n\u{1F517} Related Notes: "${slug}"`);
  console.log("\u2500".repeat(50));
  console.log(
    `\n  Source: ${startNode.title} (${startNode.domain}/${startNode.type})`
  );
  console.log(`  Tags: [${startNode.tags.join(", ")}]\n`);

  const directConnections = results.filter((r) => r.hop === 1);

  if (directConnections.length === 0) {
    console.log("  No direct connections found.");
    console.log("\u2500".repeat(50));
    return;
  }

  // Group by edge type
  const byType = new Map<string, TraversalNode[]>();
  for (const r of directConnections) {
    const type = r.viaEdge?.edgeType || "unknown";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(r);
  }

  const typeOrder = ["related", "wikilink", "tag"];
  for (const type of typeOrder) {
    const group = byType.get(type);
    if (!group || group.length === 0) continue;

    const header =
      type === "related"
        ? "Typed relationships"
        : type === "wikilink"
          ? "Wikilink references"
          : "Tag co-occurrence";

    console.log(`  ${header}:`);
    group.sort((a, b) => b.cumulativeWeight - a.cumulativeWeight);
    for (const r of group) {
      const label = r.viaEdge?.label ? ` (${r.viaEdge.label})` : "";
      console.log(
        `    -> ${r.node.domain}/${r.node.slug} -- "${r.node.title}"${label}`
      );
    }
    console.log();
  }

  console.log("\u2500".repeat(50));
  console.log(`${directConnections.length} direct connections.`);
}

function cmdStats(): void {
  const graph = buildGraph();

  // Domain counts
  const domainCounts: Record<string, number> = {};
  for (const node of graph.nodes.values()) {
    domainCounts[node.domain] = (domainCounts[node.domain] || 0) + 1;
  }

  // Edge type counts
  const edgeTypeCounts: Record<string, number> = {};
  for (const edge of graph.edges) {
    edgeTypeCounts[edge.edgeType] = (edgeTypeCounts[edge.edgeType] || 0) + 1;
  }

  // Average connections per node
  const totalConnections = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!totalConnections.has(edge.from))
      totalConnections.set(edge.from, new Set());
    totalConnections.get(edge.from)!.add(edge.to);
    if (!totalConnections.has(edge.to))
      totalConnections.set(edge.to, new Set());
    totalConnections.get(edge.to)!.add(edge.from);
  }

  const connectedNodes = [...totalConnections.entries()].filter(
    ([, s]) => s.size > 0
  );
  const avgConnections =
    connectedNodes.length > 0
      ? (
          connectedNodes.reduce((acc, [, s]) => acc + s.size, 0) /
          graph.nodes.size
        ).toFixed(1)
      : "0.0";

  // Most connected node
  let mostConnectedSlug = "";
  let mostConnectedCount = 0;
  for (const [slug, conns] of totalConnections) {
    if (conns.size > mostConnectedCount) {
      mostConnectedCount = conns.size;
      mostConnectedSlug = slug;
    }
  }

  // Isolated nodes (no connections at all)
  const isolatedNodes: string[] = [];
  for (const slug of graph.nodes.keys()) {
    if (!totalConnections.has(slug) || totalConnections.get(slug)!.size === 0) {
      isolatedNodes.push(slug);
    }
  }

  // Tag clusters (tags with 2+ notes)
  const tagIndex = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    for (const tag of node.tags) {
      tagIndex.set(tag, (tagIndex.get(tag) || 0) + 1);
    }
  }
  const tagClusters = [...tagIndex.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  console.log("\n\u{1F4CA} Knowledge Graph Statistics");
  console.log("\u2500".repeat(50));

  const domainStr = DOMAINS.map(
    (d) => `${d}: ${domainCounts[d] || 0}`
  ).join(", ");
  console.log(`  Nodes: ${graph.nodes.size} (${domainStr})`);

  const edgeStr = ["tag", "wikilink", "related"]
    .map((t) => `${t}: ${edgeTypeCounts[t] || 0}`)
    .join(", ");
  console.log(`  Edges: ${graph.edges.length} (${edgeStr})`);

  console.log(`  Avg connections per node: ${avgConnections}`);

  if (mostConnectedSlug) {
    console.log(
      `  Most connected: "${mostConnectedSlug}" (${mostConnectedCount} edges)`
    );
  }

  console.log(
    `  Isolated nodes: ${isolatedNodes.length} (no connections)`
  );

  if (tagClusters.length > 0) {
    const clusterStr = tagClusters
      .slice(0, 10)
      .map(([tag, count]) => `${tag} (${count} notes)`)
      .join(", ");
    console.log(`  Tag clusters: ${clusterStr}`);
  }

  console.log("\u2500".repeat(50));
}

function cmdHubs(): void {
  const graph = buildGraph();

  // Count unique connections per node (both directions)
  const connectionMap = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!connectionMap.has(edge.from))
      connectionMap.set(edge.from, new Set());
    connectionMap.get(edge.from)!.add(edge.to);
    if (!connectionMap.has(edge.to))
      connectionMap.set(edge.to, new Set());
    connectionMap.get(edge.to)!.add(edge.from);
  }

  // Sort by connection count
  const ranked = [...connectionMap.entries()]
    .map(([slug, conns]) => ({ slug, count: conns.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  console.log("\n\u{1F517} Top Knowledge Hubs");
  console.log("\u2500".repeat(50));

  if (ranked.length === 0) {
    console.log("  No connected nodes found.");
    console.log("\u2500".repeat(50));
    return;
  }

  for (let i = 0; i < ranked.length; i++) {
    const { slug, count } = ranked[i];
    const node = graph.nodes.get(slug);
    const domain = node ? node.domain : "unknown";
    const title = node ? node.title : slug;
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${slug} (${count} connections) -- ${domain}`
    );
    console.log(`      "${title}"`);
  }

  console.log("\u2500".repeat(50));
}

function cmdFind(tag: string): void {
  const graph = buildGraph();
  const normalizedTag = tag.toLowerCase().trim();

  const matches: GraphNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.tags.includes(normalizedTag)) {
      matches.push(node);
    }
  }

  // Sort by domain then slug
  matches.sort((a, b) => {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.slug.localeCompare(b.slug);
  });

  console.log(`\n\u{1F3F7}\uFE0F  Notes tagged "${normalizedTag}"`);
  console.log("\u2500".repeat(50));

  if (matches.length === 0) {
    console.log(`  No notes found with tag "${normalizedTag}"`);

    // Suggest similar tags
    const allTags = new Set<string>();
    for (const node of graph.nodes.values()) {
      for (const t of node.tags) allTags.add(t);
    }
    const suggestions = [...allTags]
      .filter((t) => t.includes(normalizedTag) || normalizedTag.includes(t))
      .slice(0, 5);
    if (suggestions.length > 0) {
      console.log(`\n  Similar tags: ${suggestions.join(", ")}`);
    }
    console.log("\u2500".repeat(50));
    return;
  }

  for (const node of matches) {
    console.log(
      `  ${node.domain}/${node.slug} -- "${node.title}"`
    );
  }

  console.log("\u2500".repeat(50));
  console.log(
    `${matches.length} note${matches.length !== 1 ? "s" : ""} found with tag "${normalizedTag}"`
  );
}

function showHelp(): void {
  console.log(`
KnowledgeGraph -- Associative graph navigation over LifeOS's knowledge archive

Commands:
  traverse <slug>              BFS from slug, show connected notes (default: 2 hops)
  traverse <slug> --hops 3     BFS with configurable depth
  related <slug>               Show directly connected notes (1 hop)
  stats                        Graph summary: nodes, edges, clusters, hubs
  hubs                         Top 10 most-connected notes
  find <tag>                   Find all notes with a specific tag

Examples:
  bun KnowledgeGraph.ts traverse karpathy
  bun KnowledgeGraph.ts traverse mempalace --hops 3
  bun KnowledgeGraph.ts related andrej-karpathy
  bun KnowledgeGraph.ts stats
  bun KnowledgeGraph.ts hubs
  bun KnowledgeGraph.ts find architecture
`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    hops: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: false,
});

if (values.help) {
  showHelp();
  process.exit(0);
}

const command = positionals[0];

if (!command) {
  showHelp();
  process.exit(0);
}

switch (command) {
  case "traverse": {
    const slug = positionals[1];
    if (!slug) {
      console.error("Usage: bun KnowledgeGraph.ts traverse <slug> [--hops N]");
      process.exit(1);
    }
    const hops = values.hops ? parseInt(values.hops as string) : 2;
    if (isNaN(hops) || hops < 1) {
      console.error("--hops must be a positive integer");
      process.exit(1);
    }
    cmdTraverse(slug, hops);
    break;
  }
  case "related": {
    const slug = positionals[1];
    if (!slug) {
      console.error("Usage: bun KnowledgeGraph.ts related <slug>");
      process.exit(1);
    }
    cmdRelated(slug);
    break;
  }
  case "stats":
    cmdStats();
    break;
  case "hubs":
    cmdHubs();
    break;
  case "find": {
    const tag = positionals[1];
    if (!tag) {
      console.error("Usage: bun KnowledgeGraph.ts find <tag>");
      process.exit(1);
    }
    cmdFind(tag);
    break;
  }
  default:
    console.error(`Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
}
