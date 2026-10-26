/**
 * Books Pulse module — read-only surface over the user's book list.
 * Holds ZERO data: parses the source file on each request and serves it. The
 * dashboard page renders whatever this returns.
 *
 * Source resolution (issue #2393 class, consolidated 2026-05-01): the unified
 * TELOS.md `## Books` section first — a post-consolidation install ships only
 * TELOS.md — with the legacy USER/BOOKS.md pseudo-YAML file as fallback.
 *
 * Route: GET /api/books → { count, lastUpdated, groups: [{ category, books:[…] }] }
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MODULE_NAME = "books";
const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const BOOKS_PATH = join(CONFIG_DIR, "LIFEOS", "USER", "BOOKS.md");
const TELOS_PATH = join(CONFIG_DIR, "LIFEOS", "USER", "TELOS", "TELOS.md");
const state = { running: false };

interface Book {
  title: string;
  author?: string;
  year?: number;
  rating?: number;
  themes?: string[];
  canonical?: boolean;
  /** One-line "why this book" note from the unified TELOS.md format. */
  note?: string;
}
interface Group { category: string; books: Book[] }

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");

/** Parse the pseudo-YAML BOOKS.md into category groups. Tolerant; ignores prose sections. */
function parseBooks(md: string): { groups: Group[]; lastUpdated: string | null } {
  const groups = new Map<string, Book[]>();
  let category = "Uncategorized";
  let cur: Book | null = null;
  const flush = () => {
    if (cur && cur.title) {
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(cur);
    }
    cur = null;
  };
  let lastUpdated: string | null = null;

  for (const raw of md.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const lu = line.match(/^last_updated:\s*(.+)$/);
    if (lu) lastUpdated = unquote(lu[1]);
    const h = line.match(/^##\s+(.+)/);
    if (h) { flush(); category = h[1].trim(); continue; }
    const t = line.match(/^-\s+title:\s*(.+)$/);
    if (t) { flush(); cur = { title: unquote(t[1]) }; continue; }
    if (!cur) continue;
    const kv = line.match(/^\s+(\w+):\s*(.+)$/);
    if (!kv) continue;
    const [, k, vRaw] = kv;
    const v = vRaw.trim();
    if (k === "author") cur.author = unquote(v);
    else if (k === "year") cur.year = parseInt(v, 10) || undefined;
    else if (k === "rating") cur.rating = parseInt(v, 10) || undefined;
    else if (k === "themes") cur.themes = v.replace(/^\[|\]$/g, "").split(",").map((s) => unquote(s)).filter(Boolean);
    else if (k === "canonical") cur.canonical = v === "true";
  }
  flush();

  // Keep only groups that actually hold books (drops Daemon/Cross-reference prose).
  const out: Group[] = [...groups.entries()].filter(([, b]) => b.length > 0).map(([c, b]) => ({ category: c, books: b }));
  return { groups: out, lastUpdated };
}

// ── Unified TELOS.md source ──

/** Extract the `## Books` H2 section body (up to the next H2) from TELOS.md. */
function extractTelosBooksSection(md: string): string | null {
  const lines = md.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Books\s*$/i.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

/**
 * Parse the unified `## Books` section: `### Category` headings plus
 * `- **Title** — note` bullets (em or en dash optional). Blockquotes,
 * comments, and bullets without a bold title are not books and are skipped.
 */
function parseTelosBooks(section: string): { groups: Group[]; lastUpdated: string | null } {
  const groups = new Map<string, Book[]>();
  let category = "General";
  let lastUpdated: string | null = null;
  const lu = section.match(/<!--\s*updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (lu) lastUpdated = lu[1];
  for (const raw of section.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) { category = h[1].trim(); continue; }
    const b = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*(?:[—–]\s*(.*))?$/);
    if (!b) continue;
    const title = b[1].trim();
    if (!title) continue;
    const note = b[2]?.trim() || undefined;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(note ? { title, note } : { title });
  }
  const out: Group[] = [...groups.entries()].filter(([, b]) => b.length > 0).map(([c, b]) => ({ category: c, books: b }));
  return { groups: out, lastUpdated };
}

/** Unified TELOS.md `## Books` first; legacy USER/BOOKS.md as fallback. */
function read(): { count: number; lastUpdated: string | null; groups: Group[] } {
  if (existsSync(TELOS_PATH)) {
    const section = extractTelosBooksSection(readFileSync(TELOS_PATH, "utf8"));
    if (section) {
      const { groups, lastUpdated } = parseTelosBooks(section);
      if (groups.length > 0) {
        return { count: groups.reduce((n, g) => n + g.books.length, 0), lastUpdated, groups };
      }
    }
  }
  if (!existsSync(BOOKS_PATH)) return { count: 0, lastUpdated: null, groups: [] };
  const { groups, lastUpdated } = parseBooks(readFileSync(BOOKS_PATH, "utf8"));
  return { count: groups.reduce((n, g) => n + g.books.length, 0), lastUpdated, groups };
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
  try { count = read().count; } catch { /* ignore */ }
  return { status: state.running ? "healthy" : "stopped", details: { books: count } };
}
export async function handleRequest(_req: Request, pathname: string): Promise<Response | null> {
  const sub = pathname.replace(/^\/api\/books/, "") || "/";
  if (sub === "/" || sub === "/list") return Response.json(read());
  if (sub === "/status" || sub === "/health") return Response.json(health());
  return null;
}
