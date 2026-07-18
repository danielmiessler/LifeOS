/**
 * Projects Pulse module — read-only surface over USER/PROJECTS.md ({{PRINCIPAL_NAME}}'s project
 * routing table). Holds ZERO data: parses the USER file on every request and serves
 * it. The dashboard page renders whatever this returns. Edit PROJECTS.md → the view
 * changes with no code change and no rebuild.
 *
 * Route: GET /api/projects → { count, source, generatedAt, projects: [ … ] }
 *
 * Data/code separation: no project name, path, URL, or stack is hardcoded here.
 * Every field is derived from the markdown table at request time.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { claudeDir } from "../../TOOLS/lifeos-root";

const MODULE_NAME = "projects";
const PROJECTS_PATH = join(
  process.env.CLAUDE_CONFIG_DIR || join(claudeDir()),
  "LIFEOS",
  "USER",
  "PROJECTS.md",
);
const state = { running: false };

export type Badge =
  | "system-of-record"
  | "sensitive"
  | "in-design"
  | "decommissioned"
  | "concept";

export interface Project {
  name: string; // clean display name (markup, emoji, status stripped)
  rawName: string; // original first-cell text
  path: string; // local path, backticks stripped
  url: string; // display text of the URL cell
  href: string | null; // real https:// link, or null when not a URL ("—", notes)
  deploy: string; // deploy command/text, backticks stripped
  stack: string; // stack / description
  badges: Badge[]; // derived status flags
  openSession: boolean; // has a matching "Open Sessions to Resume" row
}

// ── Cell helpers ─────────────────────────────────────────────────────────────

const stripBackticks = (s: string) => s.replace(/`/g, "").trim();

/**
 * Split a markdown table row `| a | b | c |` into trimmed cell strings. Splits
 * only on UNESCAPED pipes — deploy commands legitimately contain `\|` (e.g.
 * `grep … \| xargs`, `curl … \| sh`), which markdown escapes; those stay in the
 * cell and are unescaped back to a literal `|`.
 */
function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
}

/** A `|---|:--:|` style separator row (only dashes, colons, pipes, spaces). */
const isSeparator = (line: string) => /^\|[\s:|-]+\|?\s*$/.test(line.trim()) && line.includes("-");

/** Derive status badges from any cell text (name usually carries the flags). */
function deriveBadges(...cells: string[]): Badge[] {
  const hay = cells.join(" ");
  const low = hay.toLowerCase();
  const badges: Badge[] = [];
  if (hay.includes("🎯")) badges.push("system-of-record");
  if (hay.includes("🚨")) badges.push("sensitive");
  if (/\bin[\s-]?design\b/.test(low)) badges.push("in-design");
  if (/\bdecommissioned\b/.test(low)) badges.push("decommissioned");
  if (/\bconcept\b/.test(low)) badges.push("concept");
  return badges;
}

/**
 * Clean a project name cell into its display name. When the cell has a bold span
 * (`**Name** …trailing descriptor…`), the bold content is the name — trailing
 * flag text ("system of record", "HIGHLY SENSITIVE") is descriptor, not name.
 * Falls back to cleaning the whole cell when there's no bold markup.
 */
function cleanName(raw: string): string {
  const bold = raw.match(/\*\*(.+?)\*\*/);
  let s = bold ? bold[1] : raw;
  s = s.replace(/\*\*/g, "").replace(/__/g, ""); // stray bold
  s = s.replace(/_\((?:in design|decommissioned|concept)\)_/gi, ""); // italic status
  s = s.replace(/\((?:in design|decommissioned|concept)\)/gi, "");
  s = s.replace(/[🎯🚨🚧🔧✅🚀]/gu, ""); // status emoji
  s = s.replace(/_([^_]+)_/g, "$1"); // any remaining italic wrap
  return s.replace(/\s+/g, " ").trim();
}

/** Extract the first real https(s) href from a URL cell, or null. */
function deriveHref(urlCell: string): string | null {
  const cell = urlCell.trim();
  if (!cell || cell === "—" || cell === "-") return null;
  // Already a full URL?
  const full = cell.match(/https?:\/\/[^\s)]+/i);
  if (full) return full[0];
  // A bare domain / host[:port][/path] token — first one wins.
  const domain = cell.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,}|localhost)(?::\d+)?(?:\/[^\s),]*)?/i);
  if (!domain) return null;
  const host = domain[0];
  const scheme = /^localhost(?::|\/|$)/i.test(host) ? "http://" : "https://";
  return scheme + host;
}

/** Collect the normalized leading labels of every Open Session row. */
function openSessionLabels(md: string): string[] {
  const labels: string[] = [];
  const m = md.match(/##\s+Open Sessions to Resume[\s\S]*?(?=\n##\s|\n#\s|$)/);
  if (!m) return labels;
  for (const raw of m[0].split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim().startsWith("|") || isSeparator(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2 || /^project$/i.test(cells[0])) continue; // header
    const name = cleanName(cells[0]);
    if (name) labels.push(name.toLowerCase());
  }
  return labels;
}

/**
 * A project has an open session when a session label equals its name OR begins
 * with its name followed by a word boundary. Session rows are verbose descriptors
 * ("The Real Internet of Things (book site)", "Surface category lockdown"), so the
 * project name is a PREFIX of the label — exact-only matching under-counts.
 */
function hasOpenSession(name: string, labels: string[]): boolean {
  const n = name.toLowerCase();
  return labels.some((l) => l === n || l.startsWith(n + " ") || l.startsWith(n + ":"));
}

// ── Parser (pure, exported for tests) ────────────────────────────────────────

export function parseProjects(md: string): Project[] {
  const lines = md.split("\n");
  const projects: Project[] = [];
  const sessionLabels = openSessionLabels(md);

  // Find the main projects table header: a row naming Project + Deploy + Stack.
  let i = 0;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim().startsWith("|") && /\bProject\b/i.test(l) && /\bDeploy\b/i.test(l) && /\bStack\b/i.test(l)) {
      break;
    }
  }
  if (i >= lines.length) return projects; // no table found
  i++; // move past header row

  for (; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim().startsWith("|")) break; // table ended
    if (isSeparator(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 5) continue;
    const [rawName, pathCell, urlCell, deployCell, ...rest] = cells;
    const stackCell = rest.join(" | "); // rejoin any stray pipes inside stack prose
    const name = cleanName(rawName);
    if (!name) continue;
    projects.push({
      name,
      rawName: rawName.trim(),
      path: stripBackticks(pathCell),
      url: urlCell.trim(),
      href: deriveHref(urlCell),
      deploy: stripBackticks(deployCell),
      stack: stackCell.trim(),
      badges: deriveBadges(rawName, urlCell, stackCell),
      openSession: hasOpenSession(name, sessionLabels),
    });
  }
  return projects;
}

// ── Module contract ──────────────────────────────────────────────────────────

interface ReadResult {
  count: number;
  source: string;
  generatedAt: string;
  projects: Project[];
  error?: string;
}

/**
 * Read + parse PROJECTS.md. Fail-soft: a missing, unreadable, or malformed file
 * NEVER throws — it returns an empty list (+ an `error` field when relevant) so
 * the endpoint and the dashboard degrade gracefully instead of taking down Pulse.
 */
function read(): ReadResult {
  const generatedAt = new Date().toISOString();
  const source = "USER/PROJECTS.md";
  try {
    if (!existsSync(PROJECTS_PATH)) return { count: 0, source, generatedAt, projects: [], error: "PROJECTS.md not found" };
    const md = readFileSync(PROJECTS_PATH, "utf8");
    const projects = parseProjects(md);
    // Drift signal: file has content but no parseable table → heading/format changed.
    if (projects.length === 0 && md.trim().length > 0) {
      console.warn(`[${MODULE_NAME}] PROJECTS.md present but no project table parsed — check the '| Project | … | Stack |' header`);
    }
    return { count: projects.length, source, generatedAt, projects };
  } catch (err) {
    console.warn(`[${MODULE_NAME}] failed to read/parse PROJECTS.md: ${String(err)}`);
    return { count: 0, source, generatedAt, projects: [], error: String(err) };
  }
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
  return { status: state.running ? "healthy" : "stopped", details: { projects: count } };
}
export async function handleRequest(_req: Request, pathname: string): Promise<Response | null> {
  const sub = pathname.replace(/^\/api\/projects/, "") || "/";
  if (sub === "/" || sub === "/list") return Response.json(read());
  if (sub === "/status" || sub === "/health") return Response.json(health());
  return null;
}
