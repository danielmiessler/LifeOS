#!/usr/bin/env bun
/**
 * @version 1.0.8
 * MemoryDeltaSurface — UserPromptSubmit hook that makes the autonomic memory
 * loop VISIBLE in every response, Hermes-style.
 *
 * ALWAYS-ON (2026-06-11 redesign, principal-directed): every primary-session
 * prompt gets a `<pai-memory-delta>` block with one verbatim 🧠 MEMORY line:
 *
 *   - DELTA form (loop wrote since last surfaced turn):
 *     🧠 MEMORY: +3 learned · −1 dropped — "principal: …", "self: …" · C 5/8 fresh
 *   - HEARTBEAT form (no new writes):
 *     🧠 MEMORY: C (5/8 fresh) · due: TELOS.md (never reviewed) · last curation +3 → principal 4h ago
 *
 * The line answers the principal's two standing questions in one glance:
 * "are you keeping our framework fresh?" (delta / last-curation heartbeat) and
 * "how fresh is it?" (A–F grade + fresh count + stalest file from the
 * freshness cache). All values are computed HERE, deterministically — the
 * model only echoes the string (the 2026-05-28 model-self-computed line failed
 * compliance repeatedly; never go back).
 *
 * History: built change-only on 2026-06-05 (81d1cf0ec), registration clobbered
 * 19h later by a concurrent session's whole-file settings.json write
 * (787f66ef7) — the surface sat dead for 5 days and nobody could tell, because
 * change-only silence looks healthy. Hence two guards: (1) this hook touches
 * MEMORY/STATE/delta-surface-heartbeat on every run and MemoryHealthCheck
 * flags it dead if writes continue without surfacing; (2) MemoryHealthCheck
 * treats missing settings registration as critical, which nags in chat via
 * the 🩺 line below.
 *
 * Failure mode: any error → stderr + exit 0. Never block a prompt.
 * Subagent skip: the per-turn surface is for the principal's primary session.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve as pathResolve, dirname } from "node:path";
import { homedir } from "node:os";
import { getClaudeDir } from "./lib/paths";

const CLAUDE_ROOT = pathResolve(getClaudeDir());
const WRITES_LOG = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/memory-writes.jsonl");
const CURSOR = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/memory-delta-cursor.json");
const HEALTH_LOG = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/OBSERVABILITY/memory-health.jsonl");
const FRESHNESS_CACHE = pathResolve(CLAUDE_ROOT, "LIFEOS/USER/CACHE/freshness.json");
const HEARTBEAT = pathResolve(CLAUDE_ROOT, "LIFEOS/MEMORY/STATE/delta-surface-heartbeat");

// Only the autonomic write path counts as "the system adjusting itself".
const AUTONOMIC_WRITER = "MemorySystem.add";
const FRESHNESS_MAX_AGE_MS = 24 * 60 * 60 * 1000; // older cache → warn, don't lie
const LINE_HARD_CAP = 180;

interface WriteRow {
  ts: string;
  file: string;
  updated_by?: string;
  accepted?: number;
  additions?: string[];
  evictions?: string[];
}

function isSubagent(): boolean {
  return Boolean(
    process.env.CLAUDE_CODE_SUBAGENT_NAME ||
    process.env.CLAUDE_CODE_SUBAGENT_TYPE ||
    process.env.CLAUDE_AGENT_SDK === "1",
  );
}

function readCursor(): string {
  try {
    if (!existsSync(CURSOR)) return "";
    return JSON.parse(readFileSync(CURSOR, "utf8")).last_ts ?? "";
  } catch {
    return "";
  }
}

function writeCursor(ts: string): void {
  try {
    mkdirSync(dirname(CURSOR), { recursive: true });
    writeFileSync(CURSOR, JSON.stringify({ last_ts: ts }) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

function touchHeartbeat(): void {
  try {
    mkdirSync(dirname(HEARTBEAT), { recursive: true });
    writeFileSync(HEARTBEAT, new Date().toISOString() + "\n", "utf8");
  } catch {
    /* best-effort — liveness guard only */
  }
}

function fileLabel(path: string): string {
  if (path.includes("PRINCIPAL_MEMORY")) return "principal";
  if (path.includes("DA_MEMORY")) return "self";
  if (path.includes("CONTACTS")) return "contacts";
  if (path.includes("PROJECTS")) return "projects";
  return "memory";
}

// Memory items can originate from external content (mail, web pages, pasted
// text). Echoing them verbatim into every prompt's context is an injection
// channel that bypasses tool-response scanning — so instruction-shaped samples
// are withheld, not rendered. Conservative shapes only; false positives just
// hide one sample, never break the line. (Advisor finding, 2026-06-11.)
const INJECTION_SHAPES = /ignore (all |any )?(previous|prior|above)|disregard (the |your )?(instructions|rules)|you must now|new instructions:|system prompt|<\/?[a-z-]+>|execute the|run this command|curl\s+http|IMPORTANT:|do not tell/i;

function short(entry: string, max = 56): string {
  const t = entry.replace(/\s+/g, " ").trim();
  if (INJECTION_SHAPES.test(t)) return "[withheld — instruction-shaped]";
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function ageStr(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Freshness segment from the statusline render cache. Never lies: a missing
 * or stale cache degrades to an explicit warning instead of confident numbers. */
function freshnessSegment(): string {
  try {
    if (!existsSync(FRESHNESS_CACHE)) return "freshness: no data";
    const age = Date.now() - statSync(FRESHNESS_CACHE).mtimeMs;
    const f = JSON.parse(readFileSync(FRESHNESS_CACHE, "utf8"));
    const grade = f.overall_grade ?? "?";
    const fresh = f.fresh_count ?? "?";
    const total = f.total ?? "?";
    if (age > FRESHNESS_MAX_AGE_MS) return `⚠ freshness data ${ageStr(age)}`;
    return `${grade} (${fresh}/${total} fresh)`;
  } catch {
    return "freshness: unreadable";
  }
}

function stalestSegment(): string {
  try {
    const f = JSON.parse(readFileSync(FRESHNESS_CACHE, "utf8"));
    const ms = f.most_stale;
    if (!ms?.name || (!ms.stale && ms.grade !== "F")) return "";
    const why = ms.why ? ` (${ms.why})` : "";
    return `due: ${ms.name}${why}`;
  } catch {
    return "";
  }
}

/** Latest critical health row → loud 🩺 nag (unchanged from v1). */
function criticalHealthLine(): string | null {
  try {
    if (!existsSync(HEALTH_LOG)) return null;
    const lines = readFileSync(HEALTH_LOG, "utf8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    if (last?.overall !== "critical") return null;
    const blockers = (last.findings ?? [])
      .filter((f: any) => f.severity === "critical")
      .map((f: any) => f.message)
      .slice(0, 3);
    return `🩺 MEMORY HEALTH: CRITICAL — ${blockers.join(" · ") || `${last.counts?.critical ?? "?"} blocker(s)`}. Fix: bun ~/.claude/LIFEOS/TOOLS/MemoryHealthCheck.ts`;
  } catch {
    return null;
  }
}

/** Returns the <pai-memory-health>? + <pai-memory-delta> blocks, or null. Pure — no exit. */
export function run(): string | null {
  let out = "";
  try {
    touchHeartbeat(); // liveness guard: MemoryHealthCheck flags a dead surface

    const cursor = readCursor();
    let maxTs = cursor;
    let learned = 0;
    let dropped = 0;
    const learnedSamples: string[] = [];
    const droppedSamples: string[] = [];
    let lastAutonomic: WriteRow | null = null;

    if (existsSync(WRITES_LOG)) {
      // Tail-bounded scan: rows are append-only chronological; cursor advances
      // every prompt, so only the tail can hold unsurfaced rows.
      const allLines = readFileSync(WRITES_LOG, "utf8").split("\n").filter((l) => l.trim().length > 0);
      for (const line of allLines.slice(-500)) {
        let row: WriteRow;
        try { row = JSON.parse(line); } catch { continue; }
        if (!row.ts) continue;
        if (row.updated_by !== AUTONOMIC_WRITER) continue;
        const isTestRow = (row.additions ?? []).some((e) => /SmokeTest|smoke-test/i.test(e));
        if (isTestRow) continue;
        lastAutonomic = row; // chronological — last one wins
        if (row.ts > maxTs) maxTs = row.ts;
        if (cursor && row.ts <= cursor) continue; // already surfaced
        const adds = row.additions ?? [];
        const evs = row.evictions ?? [];
        learned += adds.length;
        dropped += evs.length;
        for (const a of adds) if (learnedSamples.length < 2) learnedSamples.push(`${fileLabel(row.file)}: ${short(a)}`);
        for (const e of evs) if (droppedSamples.length < 1) droppedSamples.push(short(e));
      }
    }

    if (maxTs && maxTs !== cursor) writeCursor(maxTs);

    const healthLine = criticalHealthLine();
    if (healthLine) {
      out +=
        `<pai-memory-health>\n` +
        `Memory subsystem health is CRITICAL. Surface this line VERBATIM in your response so it cannot be ignored:\n` +
        `${healthLine}\n` +
        `</pai-memory-health>\n`;
    }

    // ── Compose the always-on line ──
    const fresh = freshnessSegment();
    let line: string;

    if (learned > 0 || dropped > 0) {
      // DELTA form: what just changed, with real items, plus the freshness gauge.
      const parts: string[] = [];
      if (learned > 0) parts.push(`+${learned} learned`);
      if (dropped > 0) parts.push(`−${dropped} dropped`);
      const samples = [...learnedSamples.map((s) => `"${s}"`), ...droppedSamples.map((s) => `−"${s}"`)];
      line = `🧠 MEMORY: ${parts.join(" · ")}${samples.length ? ` — ${samples.join(", ")}` : ""} · ${fresh}`;
    } else {
      // HEARTBEAT form: how fresh + proof the loop is alive.
      const segs: string[] = [fresh];
      const stalest = stalestSegment();
      if (stalest) segs.push(stalest);
      if (lastAutonomic) {
        const age = ageStr(Date.now() - Date.parse(lastAutonomic.ts));
        // additions[] is NET-new entries; `accepted` is the post-overwrite total
        // (set-overwrite semantics) and would overstate. Only claim +N for real news.
        const n = (lastAutonomic.additions ?? []).length;
        const what = n > 0 ? `+${n} new → ` : "ran → ";
        segs.push(`last curation ${what}${fileLabel(lastAutonomic.file)} ${age}`);
      } else {
        segs.push("no curation runs yet");
      }
      line = `🧠 MEMORY: ${segs.join(" · ")}`;
    }

    if (line.length > LINE_HARD_CAP) line = line.slice(0, LINE_HARD_CAP - 1) + "…";

    out +=
      `<pai-memory-delta>\n` +
      `Memory status from the autonomic loop (computed deterministically by MemoryDeltaSurface.hook.ts). Render this line VERBATIM in your response as the 🧠 MEMORY line of the output format, exactly once. Do not recompute or rephrase it:\n` +
      `${line}\n` +
      `</pai-memory-delta>\n`;
    return out;
  } catch (e) {
    process.stderr.write(`MemoryDeltaSurface error: ${(e as Error)?.message || String(e)}\n`);
    return out || null;
  }
}

if (import.meta.main) {
  if (!isSubagent()) {
    const out = run();
    if (out) process.stdout.write(out);
  }
  process.exit(0);
}
