#!/usr/bin/env bun
/**
 * WritingGate.hook.ts — force a REAL _WRITING audit + AI-detector run on any
 * response that ships authored, outbound prose FOR {{PRINCIPAL_NAME}}.
 *
 * WHY (2026-07-01): a sponsored LinkedIn post shipped from NATIVE mode with no
 * audit and no detector run. Doctrine existed; nothing enforced it.
 *
 * TRIGGER: Stop
 *
 * DESIGN (iteration 2, after a cross-vendor Forge audit):
 *   - The pass condition is an EXECUTION ARTIFACT, not a self-authored string.
 *     PangramScore.ts logs every run (normalized-text SHA + ts) to
 *     pangram-runs.jsonl. The gate clears only when a FRESH run exists — ideally
 *     one whose SHA matches a deliverable block in this response (proof the
 *     detector ran on THIS content). A typed `✍️ WRITING-AUDIT:` token is a
 *     human-readable citation, never the pass condition — so "just type the
 *     token" (the self-attestation loop) no longer works.
 *   - decision:block RE-EMITS the response (user sees it twice). Reserved for
 *     STRONG publication signals (a #ad/#sponsored line, a hashtag cluster, a
 *     "Rewritten version:", or a response that STARTS with blog frontmatter).
 *     Weak signals log telemetry only.
 *   - Pangram is REPORTED, never thresholded — it saturates ~100% AI on all
 *     model prose. The requirement is that it RAN, not its number.
 *   - Honors stop_hook_active (loop guard). Fails open on any error.
 */

import { readHookInput, parseTranscriptFromInput } from "./lib/hook-io";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { dirname, join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const LIFEOS_DIR = process.env.LIFEOS_DIR || join(process.env.HOME!, ".claude", "LIFEOS");
const OBS_PATH = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "writing-gate.jsonl");
const RUNS_PATH = join(LIFEOS_DIR, "MEMORY", "OBSERVABILITY", "pangram-runs.jsonl");
const RUN_WINDOW_MS = 30 * 60 * 1000; // a run counts as "this turn" within 30 min

// ── Publication-content signals ───────────────────────────────────────────────
// STRONG (teeth): a disclosure hashtag ALONE on a line (caption shape, not a
// mid-sentence mention of #ad), a hashtag cluster, an explicit rewrite/deliver
// label, or a response that STARTS with blog/newsletter frontmatter.
const DISCLOSURE_CAPTION = /^\s{0,3}#(ad|sponsored)\b[^\n]{0,24}$/im;
const HASHTAG_CLUSTER = /(^|\n)\s*#[A-Za-z]\w+(\s+#[A-Za-z]\w+){1,}/;
const DELIVER_LABEL = /\brewritten version\s*:|\bhere'?s the (post|draft|copy|thread|caption|newsletter)\b|\bthe post\s*[—–-]\s*(drafted|rewritten|in your voice|final)/i;
// Blog frontmatter only when the response (fences stripped) STARTS with it AND
// it carries a publish marker — so pasted YAML examples and internal ISA/skill
// frontmatter (task:/slug:/name:) never trip the teeth.
const BLOG_FRONTMATTER =
  /^---\s*\n(?=[\s\S]{0,500}?\btitle\s*:)(?=[\s\S]{0,500}?\b(?:date|tags|published|category)\s*:)/i;

// WEAK (telemetry only): ambiguous authoring nouns.
const WEAK_SIGNALS: RegExp[] = [
  /\b(linkedin|x|twitter|instagram|bluesky)\s+post\b/i,
  /\b(tweet|thread|newsletter|blog post|blog draft|essay draft|marketing copy|ad copy|caption)\b/i,
  /\bdraft\s*:/i,
];

// Human-readable citation (kept for the fresh-run fallback; NOT the pass gate).
const TOKEN_MARKER = /writing[\s-]?audit\s*:/i;
const PANGRAM_EVIDENCE =
  /pangram[^\n%]{0,40}\d{1,3}\s*%|pangram[^\n]{0,40}(unavailable|no\s*key|not\s*run|couldn'?t\s*run)/i;
const DETECT_EVIDENCE = /detect[^\n]{0,30}(clean|\d)|\bP0\s*\/\s*P1\b|\b\d+\s*P[01]\b|\b0\s*P0\b/i;
function hasCitation(m: string): boolean {
  return TOKEN_MARKER.test(m) && PANGRAM_EVIDENCE.test(m) && DETECT_EVIDENCE.test(m);
}

function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function sha(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

// Deliverable-block candidates: the region between #ad/#sponsored, fenced blocks,
// and any paragraph with >=40 words. Each is a thing the detector could have run on.
function deliverableBlocks(message: string): string[] {
  const out: string[] = [];
  const between = message.match(/#ad\b([\s\S]*?)#sponsored\b/i);
  if (between && between[1].trim()) out.push(between[1]);
  for (const m of message.matchAll(/```[\s\S]*?```/g)) out.push(m[0].replace(/```/g, ""));
  for (const para of message.split(/\n\s*\n/)) {
    const words = para.match(/[A-Za-z][A-Za-z'’-]+/g);
    if (words && words.length >= 40) out.push(para);
  }
  return out;
}

interface RunRec { ts: string; sha256: string; }
function freshRuns(): RunRec[] {
  try {
    if (!existsSync(RUNS_PATH)) return [];
    const now = Date.now();
    return readFileSync(RUNS_PATH, "utf-8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as RunRec; } catch { return null; } })
      .filter((r): r is RunRec => !!r && typeof r.ts === "string" && (now - Date.parse(r.ts)) <= RUN_WINDOW_MS);
  } catch { return []; }
}

// Returns proof that the detector actually ran this turn.
function auditRunProof(message: string): { freshRun: boolean; shaMatch: boolean } {
  const runs = freshRuns();
  if (runs.length === 0) return { freshRun: false, shaMatch: false };
  const runShas = new Set(runs.map((r) => r.sha256));
  const blockShas = deliverableBlocks(message).map(sha);
  return { freshRun: true, shaMatch: blockShas.some((s) => runShas.has(s)) };
}

function proseWordCount(message: string): number {
  const stripped = message
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[═━].*$/gm, " ")
    .replace(/^\s*[\p{Emoji_Presentation}\u{1F300}-\u{1FAFF}☀-➿][^\n:]{0,24}:.*$/gmu, " ");
  return (stripped.match(/[A-Za-z][A-Za-z'’-]+/g) || []).length;
}

type Decision =
  | "pass-run-verified" | "pass-run-fresh" | "block-strong-no-run"
  | "telemetry-weak" | "no-content" | "skip-recovery";

function appendObs(rec: Record<string, unknown>): void {
  try { mkdirSync(dirname(OBS_PATH), { recursive: true });
    appendFileSync(OBS_PATH, JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n", "utf-8");
  } catch (err) { console.error("[WritingGate] obs write failed:", err); }
}

const BLOCK_REASON =
  "WRITING-AUDIT GAP. This response ships authored outbound prose (a post / draft / marketing copy) and " +
  "there is NO record the AI detector actually ran on it this turn. Any writing produced FOR {{PRINCIPAL_NAME}} must go " +
  "through the _WRITING skill AND the detector before it is shown (OPERATIONAL_RULES.md § Authored content). " +
  "The gate checks for a real PangramScore.ts run on the draft — a typed token does NOT satisfy it. Before " +
  "stopping: (1) run Skill(\"_WRITING\") DETECT mode on the draft and fix every P0/P1 in the right voice; " +
  "(2) run `bun ~/.claude/LIFEOS/TOOLS/PangramScore.ts --file <draft>` on the ACTUAL draft text so the run is " +
  "logged; (3) cite the detect result + the reported AI% in a `✍️ WRITING-AUDIT:` line. Pangram saturates on " +
  "model prose, so the number is REPORTED, not a pass/fail bar — the requirement is that the audit RAN.";

async function main(): Promise<void> {
  const input = await readHookInput();
  if (!input) process.exit(0);
  const session_id = input.session_id ?? "unknown";

  if (input.stop_hook_active === true) {
    appendObs({ session_id, decision: "skip-recovery" as Decision, stop_hook_active: true });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  let message = input.last_assistant_message;
  if (!message) {
    try { message = (await parseTranscriptFromInput(input)).lastMessage ?? undefined; } catch { /* best-effort */ }
  }
  if (!message || message.trim().length === 0) process.exit(0);

  const fenceStripped = message.replace(/```[\s\S]*?```/g, " ").trimStart();
  const strong =
    DISCLOSURE_CAPTION.test(message) || HASHTAG_CLUSTER.test(message) ||
    DELIVER_LABEL.test(message) || BLOG_FRONTMATTER.test(fenceStripped);
  const weak = strong || WEAK_SIGNALS.some((p) => p.test(message));
  const words = proseWordCount(message);

  if (strong && words >= 40) {
    // Pass ONLY on a SHA match: the detector demonstrably ran on THIS content.
    // A fresh-run-on-something-else does not clear it (closes the "ran it on
    // other text" gaming path Forge flagged). Citation is required too, as the
    // human-readable record, but it is never sufficient alone.
    const { freshRun, shaMatch } = auditRunProof(message);
    if (shaMatch && hasCitation(message)) {
      appendObs({ session_id, decision: "pass-run-verified" as Decision, strong, words });
      process.exit(0);
    }
    appendObs({ session_id, decision: "block-strong-no-run" as Decision, strong, words, freshRun, shaMatch });
    console.log(JSON.stringify({ decision: "block", reason: BLOCK_REASON }));
    process.exit(0);
  }

  if (weak && words >= 60) {
    appendObs({ session_id, decision: "telemetry-weak" as Decision, weak, words });
    process.exit(0);
  }

  appendObs({ session_id, decision: "no-content" as Decision, strong, weak, words });
  process.exit(0);
}

main().catch((err) => { console.error("[WritingGate] fatal:", err); process.exit(0); });
