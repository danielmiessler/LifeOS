/**
 * Hypotheses — Pulse API module for the proactive deriver review queue.
 *
 * The deriver loop (LearningPatternSynthesis.ts --hypothesize, run nightly via
 * com.lifeos.deriver launchd) writes hypothesis notes to:
 *
 *   ~/.claude/LIFEOS/MEMORY/WISDOM/FRAMES/_hypotheses/YYYY-MM-DD_<slug>.md
 *
 * This module reads them, parses the YAML frontmatter + body sections, and
 * serves them as JSON. Rendering happens in the Observability Next.js app at
 * /hypotheses (src/app/hypotheses/page.tsx).
 *
 * Doctrine constraint ({{PRINCIPAL_NAME}}, 2026-05-08): "Pulse always reads from clean
 * sources only — USER/ or MEMORY/, nothing hard-coded."
 *
 *   - Zero string literals resembling hypothesis content live in this file.
 *   - Every byte served comes from a markdown file under HYPOTHESES_DIR.
 *   - Empty directory → empty array, never a fabricated placeholder.
 *
 * Routes:
 *   GET  /api/hypotheses              → { hypotheses: [...] } (status=hypothesis)
 *   GET  /api/hypotheses/:slug        → full hypothesis detail
 *   POST /api/hypotheses/:slug/graduate → { ok, slug, target_frame }
 *   POST /api/hypotheses/:slug/reject   → { ok, slug }
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const FRAMES_DIR = join(LIFEOS_DIR, "MEMORY", "WISDOM", "FRAMES");
const HYPOTHESES_DIR = join(FRAMES_DIR, "_hypotheses");
const ARCHIVE_DIR = join(HYPOTHESES_DIR, "_archive");
const STATE_FILE = join(HYPOTHESES_DIR, ".state.json");
const MODULE = "hypotheses";

interface Hypothesis {
  slug: string;
  filename: string;
  status: string;
  target_frame: string;
  confidence: number;
  generated: string;
  expires: string;
  evidence_signals: string[];
  falsifier: string;
  claim: string;
  evidence: string;
  suggested_action: string;
  raw_body: string;
  expires_in_days: number;
}

interface ModuleState {
  running: boolean;
  startedAt: Date | null;
}

const moduleState: ModuleState = {
  running: false,
  startedAt: null,
};

// ── Parsing ────────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): { fm: Record<string, any>; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: content };
  const fmRaw = m[1];
  const body = m[2];

  const fm: Record<string, any> = {};
  const lines = fmRaw.split("\n");
  let currentArrayKey: string | null = null;
  for (const line of lines) {
    if (currentArrayKey && /^\s+-\s/.test(line)) {
      fm[currentArrayKey].push(line.replace(/^\s+-\s/, "").trim());
      continue;
    }
    currentArrayKey = null;
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (val === "") {
      fm[key] = [];
      currentArrayKey = key;
    } else if (val.startsWith('"') && val.endsWith('"')) {
      fm[key] = val.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^\d+(\.\d+)?$/.test(val)) {
      fm[key] = parseFloat(val);
    } else {
      fm[key] = val;
    }
  }
  return { fm, body };
}

function extractSection(body: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`, "m");
  const m = body.match(re);
  return m ? m[1].trim() : "";
}

function loadHypothesis(filename: string): Hypothesis | null {
  const fp = join(HYPOTHESES_DIR, filename);
  if (!existsSync(fp)) return null;
  const content = readFileSync(fp, "utf-8");
  const { fm, body } = parseFrontmatter(content);
  if (!fm.slug || !fm.status) return null;

  const expiresMs = fm.expires ? new Date(fm.expires).getTime() : 0;
  const expiresInDays = expiresMs > 0 ? Math.round((expiresMs - Date.now()) / 86400000) : 0;

  return {
    slug: String(fm.slug),
    filename,
    status: String(fm.status),
    target_frame: String(fm.target_frame || "new"),
    confidence: Number(fm.confidence || 0),
    generated: String(fm.generated || ""),
    expires: String(fm.expires || ""),
    evidence_signals: Array.isArray(fm.evidence_signals) ? fm.evidence_signals : [],
    falsifier: String(fm.falsifier || ""),
    claim: extractSection(body, "Claim"),
    evidence: extractSection(body, "Evidence"),
    suggested_action: extractSection(body, "Suggested Action"),
    raw_body: body,
    expires_in_days: expiresInDays,
  };
}

function listPending(): Hypothesis[] {
  if (!existsSync(HYPOTHESES_DIR)) return [];
  const files = readdirSync(HYPOTHESES_DIR)
    .filter(f => f.endsWith(".md") && f !== "README.md");
  const results: Hypothesis[] = [];
  for (const f of files) {
    const h = loadHypothesis(f);
    if (h && h.status === "hypothesis") results.push(h);
  }
  // Newest first
  return results.sort((a, b) => b.generated.localeCompare(a.generated));
}

// ── Mutations (graduate / reject) ──────────────────────────────────────────

function archiveHypothesis(slug: string, newStatus: "graduated" | "rejected", note?: string): { ok: boolean; reason?: string } {
  if (!existsSync(HYPOTHESES_DIR)) return { ok: false, reason: "directory_missing" };
  const files = readdirSync(HYPOTHESES_DIR).filter(f => f.endsWith(".md") && f !== "README.md");
  const target = files.find(f => {
    const h = loadHypothesis(f);
    return h && h.slug === slug && h.status === "hypothesis";
  });
  if (!target) return { ok: false, reason: "not_found_or_already_archived" };

  mkdirSync(ARCHIVE_DIR, { recursive: true });
  const src = join(HYPOTHESES_DIR, target);
  const content = readFileSync(src, "utf-8");
  const stamp = new Date().toISOString();
  const noteLine = note ? `\n- ${stamp} — ${newStatus} with note: ${note}` : `\n- ${stamp} — ${newStatus}`;
  const newContent = content.replace(/^status:\s*hypothesis/m, `status: ${newStatus}`) + noteLine + "\n";
  writeFileSync(join(ARCHIVE_DIR, target), newContent);
  unlinkSync(src);

  // Update state sidecar (best-effort, never blocks the move)
  if (existsSync(STATE_FILE)) {
    try {
      const st = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      if (st.claim_hashes && st.claim_hashes[slug]) {
        st.claim_hashes[slug].archived_at = stamp;
        st.claim_hashes[slug].status = newStatus;
        writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
      }
    } catch {
      // sidecar update failures are non-fatal
    }
  }

  return { ok: true };
}

function graduateToFrame(slug: string, target_frame: string, claim: string): void {
  // Append a section to the target frame, or create a new frame.
  if (target_frame === "new") {
    const newFramePath = join(FRAMES_DIR, `${slug}.md`);
    if (!existsSync(newFramePath)) {
      const stamp = new Date().toISOString();
      const seed = `# Frame: ${slug}\n\n## Meta\n- **Domain:** ${slug}\n- **Confidence:** seedling\n- **Crystallized:** ${stamp}\n- **Source:** Graduated from hypothesis ${slug}\n\n## Core Claim\n\n${claim}\n`;
      writeFileSync(newFramePath, seed);
    }
    return;
  }
  const framePath = join(FRAMES_DIR, `${target_frame}.md`);
  if (!existsSync(framePath)) return; // target frame missing — nothing to append
  const stamp = new Date().toISOString();
  const append = `\n\n## Hypothesis-Sourced (${stamp})\n\nGraduated from \`_hypotheses/${slug}\`:\n\n${claim}\n`;
  writeFileSync(framePath, readFileSync(framePath, "utf-8") + append);
}

// ── HTTP handler ───────────────────────────────────────────────────────────

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function summarizeForList(h: Hypothesis) {
  return {
    slug: h.slug,
    claim: h.claim,
    confidence: h.confidence,
    target_frame: h.target_frame,
    evidence_count: h.evidence_signals.length,
    generated: h.generated,
    expires_in_days: h.expires_in_days,
  };
}

export async function handleRequest(req: Request, pathname: string): Promise<Response | null> {
  // API: list
  if (pathname === "/api/hypotheses" && req.method === "GET") {
    const items = listPending().map(summarizeForList);
    return jsonResponse({ hypotheses: items });
  }

  // API: detail or action
  const detail = pathname.match(/^\/api\/hypotheses\/([^/]+)$/);
  const action = pathname.match(/^\/api\/hypotheses\/([^/]+)\/(graduate|reject)$/);

  if (detail && req.method === "GET") {
    const slug = decodeURIComponent(detail[1]);
    const items = listPending();
    const found = items.find(h => h.slug === slug);
    if (!found) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse(found);
  }

  if (action && req.method === "POST") {
    const slug = decodeURIComponent(action[1]);
    const verb = action[2] as "graduate" | "reject";
    let note: string | undefined;
    try {
      const body = await req.json() as { note?: string };
      note = body?.note;
    } catch {
      // empty body OK
    }

    if (verb === "graduate") {
      const items = listPending();
      const h = items.find(x => x.slug === slug);
      if (!h) return jsonResponse({ error: "not_found" }, 404);
      graduateToFrame(slug, h.target_frame, h.claim);
      const result = archiveHypothesis(slug, "graduated", note);
      if (!result.ok) return jsonResponse({ error: result.reason }, 409);
      return jsonResponse({ ok: true, slug, new_status: "graduated", target_frame: h.target_frame });
    }

    if (verb === "reject") {
      const result = archiveHypothesis(slug, "rejected", note);
      if (!result.ok) return jsonResponse({ error: result.reason }, result.reason === "not_found_or_already_archived" ? 404 : 500);
      return jsonResponse({ ok: true, slug, new_status: "rejected" });
    }
  }

  return null;
}

export function start() {
  // No background polling — this module is read-on-demand.
  moduleState.running = true;
  moduleState.startedAt = new Date();
  // Touch the module name so it's not considered unused if Pulse audits.
  void MODULE;
}
