/**
 * Assets Pulse module — read-only unified inventory surface over the user's existing
 * asset stores. Holds ZERO data: parses the source files on every request and
 * serves a merged, categorized inventory. Edit a source file → the view changes
 * with no code change and no rebuild.
 *
 * Route: GET /api/assets → { count, sources, generatedAt, categories, networkEndpoints, assets: [ … ] }
 *
 * Sources (merged, in priority order):
 *   1. USER/GEAR.md                              — the curated human inventory (tables per category)
 *   2. MEMORY/_NETWORK/topology-snapshot-*.md    — named network / smart-home devices (cameras, switches, gateway) with IPs
 *   3. MEMORY/_NETWORK/assets.json               — raw LAN arp scan; reduced to a COUNT only (0 named entries → too noisy to card)
 *
 * Data/code separation: no asset name, model, or IP is hardcoded here — every
 * field is derived from the source files at request time. READ-ONLY: this module
 * never writes to any source (Anti-criterion ISC).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "assets";
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(claudeDir());
const GEAR_PATH = join(CLAUDE_DIR, "LIFEOS", "USER", "GEAR.md");
const NETWORK_DIR = join(CLAUDE_DIR, "LIFEOS", "MEMORY", "_NETWORK");
const NETWORK_ASSETS_JSON = join(NETWORK_DIR, "assets.json");
const state = { running: false };

export interface Asset {
  name: string;
  category: string;
  detail: string;
  use: string;
  source: string; // "GEAR.md" | "topology-snapshot"
  ip?: string;
}

// ── Cell helpers ─────────────────────────────────────────────────────────────

const stripMd = (s: string) =>
  s
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links → text
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const isSeparator = (line: string) => /^\|[\s:|-]+\|?\s*$/.test(line.trim()) && line.includes("-");

function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

// Header-cell labels that mark a table's header row (skip these rows).
const HEADER_CELLS = new Set([
  "item", "component", "category", "gear", "software", "language", "tech",
  "field", "method", "details", "device", "switch", "camera", "model", "model / details",
]);

// ── Parsers (pure, exported for tests) ───────────────────────────────────────

/**
 * Parse GEAR.md into assets. Every `## Heading` sets the category; every markdown
 * table row under it becomes one asset (cell 0 = name, cell 1 = detail, rest = use).
 * Header rows, separators, and TODO prose stubs are skipped.
 */
export function parseGear(md: string): Asset[] {
  const out: Asset[] = [];
  let category = "General";
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      category = stripMd(h[1]);
      continue;
    }
    if (!line.trim().startsWith("|") || isSeparator(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    const name = stripMd(cells[0]);
    if (!name || HEADER_CELLS.has(name.toLowerCase())) continue;
    const detail = stripMd(cells[1] || "");
    const use = stripMd(cells.slice(2).join(" — "));
    out.push({ name, category, detail, use, source: "GEAR.md" });
  }
  return out;
}

/** Newest topology-snapshot-*.md in the _NETWORK dir, or null. */
function newestSnapshot(): string | null {
  try {
    const files = readdirSync(NETWORK_DIR)
      .filter((f) => /^topology-snapshot-.*\.md$/.test(f))
      .sort();
    return files.length ? join(NETWORK_DIR, files[files.length - 1]) : null;
  } catch {
    return null;
  }
}

/**
 * Parse the named-device tables from a network topology snapshot. We only keep
 * rows that carry a full IPv4 or a short `.NN` octet — the curated, named devices
 * (cameras, switches, the gateway). Rows with only a MAC are skipped. Dedup by
 * name+ip. The LAN prefix for short octets is DERIVED from the file's first full
 * IPv4, so no subnet is hardcoded (and it works for any user's network).
 */
export function parseTopology(md: string): Asset[] {
  const out: Asset[] = [];
  const seen = new Set<string>();
  const firstFull = md.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  const prefix = firstFull ? firstFull[1].split(".").slice(0, 3).join(".") : null;
  let category = "Network Devices";
  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (h) {
      const c = stripMd(h[1]);
      category = /camera|doorbell|sensor|light|smart|hub|thermostat|lock/i.test(c) ? "Smart Home Devices" : "Network Devices";
      continue;
    }
    if (!line.trim().startsWith("|") || isSeparator(line)) continue;
    const cells = splitRow(line).map(stripMd);
    const ipCell = cells.find((c) => /^\d{1,3}(\.\d{1,3}){3}$/.test(c) || /^\.\d{1,3}$/.test(c));
    if (!ipCell) continue;
    const name = cells[0];
    if (!name || HEADER_CELLS.has(name.toLowerCase())) continue;
    const isShort = /^\.\d+$/.test(ipCell);
    if (isShort && !prefix) continue; // can't expand a short octet without a known prefix
    const ip = isShort ? `${prefix}${ipCell}` : ipCell;
    const key = `${name}|${ip}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const detail = cells.filter((c, i) => i !== 0 && c !== ipCell && c).slice(0, 2).join(" — ");
    out.push({ name, category, detail, use: "", source: "topology-snapshot", ip });
  }
  return out;
}

/** Count of LAN endpoints in the arp scan (rendered as a stat, not cards). */
function networkEndpointCount(): number {
  try {
    const a = JSON.parse(readFileSync(NETWORK_ASSETS_JSON, "utf8"));
    return Object.keys(a.assets || {}).length;
  } catch {
    return 0;
  }
}

// ── Module contract ──────────────────────────────────────────────────────────

interface ReadResult {
  count: number;
  sources: string[];
  generatedAt: string;
  categories: string[];
  networkEndpoints: number;
  assets: Asset[];
  error?: string;
}

/** Read + merge all sources. Fail-soft: never throws — degrades to what it can read. */
function read(): ReadResult {
  const generatedAt = new Date().toISOString();
  const assets: Asset[] = [];
  const sources: string[] = [];
  try {
    if (existsSync(GEAR_PATH)) {
      assets.push(...parseGear(readFileSync(GEAR_PATH, "utf8")));
      sources.push("USER/GEAR.md");
    }
  } catch (err) {
    console.warn(`[${MODULE_NAME}] failed to read GEAR.md: ${String(err)}`);
  }
  try {
    const snap = newestSnapshot();
    if (snap) {
      const devices = parseTopology(readFileSync(snap, "utf8"));
      if (devices.length) {
        assets.push(...devices);
        sources.push("MEMORY/_NETWORK/topology-snapshot");
      }
    }
  } catch (err) {
    console.warn(`[${MODULE_NAME}] failed to read topology snapshot: ${String(err)}`);
  }
  const categories = [...new Set(assets.map((a) => a.category))];
  return {
    count: assets.length,
    sources,
    generatedAt,
    categories,
    networkEndpoints: networkEndpointCount(),
    assets,
  };
}

export async function start(): Promise<void> {
  state.running = true;
  console.log(`[${MODULE_NAME}] started`);
}
export async function stop(): Promise<void> {
  state.running = false;
}
export function health(): { status: string; details?: Record<string, unknown> } {
  let count = 0;
  try {
    count = read().count;
  } catch {
    /* ignore */
  }
  return { status: state.running ? "healthy" : "stopped", details: { assets: count } };
}
export async function handleRequest(_req: Request, pathname: string): Promise<Response | null> {
  const sub = pathname.replace(/^\/api\/assets/, "") || "/";
  if (sub === "/" || sub === "/list") return Response.json(read());
  if (sub === "/status" || sub === "/health") return Response.json(health());
  return null;
}
