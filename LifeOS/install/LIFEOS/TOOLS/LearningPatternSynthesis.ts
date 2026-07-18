#!/usr/bin/env bun
/**
 * LearningPatternSynthesis - Aggregate ratings into actionable patterns
 *
 * Analyzes LEARNING/SIGNALS/ratings.jsonl to find recurring patterns
 * and generates synthesis reports for continuous improvement.
 *
 * Commands:
 *   --week         Analyze last 7 days (default)
 *   --month        Analyze last 30 days
 *   --all          Analyze all ratings
 *   --dry-run      Show analysis without writing
 *   --hypothesize  Run proactive deriver loop — emit ≤3 hypothesis notes
 *                  to MEMORY/WISDOM/FRAMES/_hypotheses/. See deriver section
 *                  below.
 *   --window <Nd>  Window for --hypothesize, e.g. 7d, 30d, 90d (default 7d)
 *
 * Examples:
 *   bun run LearningPatternSynthesis.ts --week
 *   bun run LearningPatternSynthesis.ts --month --dry-run
 *   bun run LearningPatternSynthesis.ts --hypothesize
 *   bun run LearningPatternSynthesis.ts --hypothesize --window 14d --dry-run
 */

import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { claudeDir } from "./lifeos-root";

// ============================================================================
// Configuration
// ============================================================================

const CLAUDE_DIR = path.join(claudeDir());
const LIFEOS_DIR = path.join(CLAUDE_DIR, "LIFEOS");
const MEMORY_DIR = path.join(LIFEOS_DIR, "MEMORY");
const LEARNING_DIR = path.join(MEMORY_DIR, "LEARNING");
const RATINGS_FILE = path.join(LEARNING_DIR, "SIGNALS", "ratings.jsonl");
// REFLECTIONS_FILE, FAILURES_DIR, WORK_DIR — deferred to v2 of the deriver.
// v1 sources hypotheses from ratings.jsonl only; multi-source fusion is the
// tunability story once we have a week of v1 data to compare against.
const SYNTHESIS_DIR = path.join(LEARNING_DIR, "SYNTHESIS");
const KNOWLEDGE_PEOPLE_DIR = path.join(MEMORY_DIR, "KNOWLEDGE", "People");
const FRAMES_DIR = path.join(MEMORY_DIR, "WISDOM", "FRAMES");
const HYPOTHESES_DIR = path.join(FRAMES_DIR, "_hypotheses");
const HYPOTHESES_ARCHIVE_DIR = path.join(HYPOTHESES_DIR, "_archive");
const HYPOTHESES_STATE_FILE = path.join(HYPOTHESES_DIR, ".state.json");
const DERIVER_LOG = path.join(MEMORY_DIR, "OBSERVABILITY", "deriver.log");

// Deriver doctrine — non-negotiable floors
const HYPO_CONFIDENCE_FLOOR = 0.6;
const HYPO_SAMPLE_FLOOR = 5;
const HYPO_MAX_PER_RUN = 3;
const HYPO_EXPIRY_DAYS = 30;
const HYPO_DEDUP_RETENTION_DAYS = 30; // claim-hashes kept post-archival

// ============================================================================
// Types
// ============================================================================

interface Rating {
  timestamp: string;
  rating: number;
  session_id: string;
  source: "explicit" | "implicit";
  sentiment_summary: string;
  confidence: number;
  comment?: string;
}

interface PatternGroup {
  pattern: string;
  count: number;
  avgRating: number;
  avgConfidence: number;
  examples: string[];
}

interface SynthesisResult {
  period: string;
  totalRatings: number;
  avgRating: number;
  frustrations: PatternGroup[];
  successes: PatternGroup[];
  topIssues: string[];
  recommendations: string[];
}

// ============================================================================
// Pattern Detection
// ============================================================================

const FRUSTRATION_PATTERNS: Record<string, RegExp> = {
  "Time/Performance Issues": /time|slow|delay|hang|wait|long|minutes|hours/i,
  "Incomplete Work": /incomplete|missing|partial|didn't finish|not done/i,
  "Wrong Approach": /wrong|incorrect|not what|misunderstand|mistake/i,
  "Over-engineering": /over-?engineer|too complex|unnecessary|bloat/i,
  "Tool/System Failures": /fail|error|broken|crash|bug|issue/i,
  "Communication Problems": /unclear|confus|didn't ask|should have asked/i,
  "Repetitive Issues": /again|repeat|still|same problem/i,
};

const SUCCESS_PATTERNS: Record<string, RegExp> = {
  "Quick Resolution": /quick|fast|efficient|smooth/i,
  "Good Understanding": /understood|clear|exactly|perfect/i,
  "Proactive Help": /proactive|anticipat|helpful|above and beyond/i,
  "Clean Implementation": /clean|simple|elegant|well done/i,
};

function detectPatterns(summaries: string[], patterns: Record<string, RegExp>): Map<string, string[]> {
  const results = new Map<string, string[]>();

  for (const summary of summaries) {
    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(summary)) {
        if (!results.has(name)) {
          results.set(name, []);
        }
        results.get(name)!.push(summary);
      }
    }
  }

  return results;
}

function groupToPatternGroups(
  grouped: Map<string, string[]>,
  ratings: Rating[]
): PatternGroup[] {
  const groups: PatternGroup[] = [];

  for (const [pattern, examples] of grouped.entries()) {
    // Find ratings that match these examples
    const matchingRatings = ratings.filter(r =>
      examples.some(e => e === r.sentiment_summary)
    );

    const avgRating = matchingRatings.length > 0
      ? matchingRatings.reduce((sum, r) => sum + r.rating, 0) / matchingRatings.length
      : 5;

    const avgConfidence = matchingRatings.length > 0
      ? matchingRatings.reduce((sum, r) => sum + r.confidence, 0) / matchingRatings.length
      : 0.5;

    groups.push({
      pattern,
      count: examples.length,
      avgRating,
      avgConfidence,
      examples: examples.slice(0, 3), // Top 3 examples
    });
  }

  return groups.sort((a, b) => b.count - a.count);
}

// ============================================================================
// Analysis
// ============================================================================

function analyzeRatings(ratings: Rating[], period: string): SynthesisResult {
  if (ratings.length === 0) {
    return {
      period,
      totalRatings: 0,
      avgRating: 0,
      frustrations: [],
      successes: [],
      topIssues: [],
      recommendations: [],
    };
  }

  const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  // Separate frustrations (rating <= 4) and successes (rating >= 7)
  const frustrationRatings = ratings.filter(r => r.rating <= 4);
  const successRatings = ratings.filter(r => r.rating >= 7);

  const frustrationSummaries = frustrationRatings.map(r => r.sentiment_summary);
  const successSummaries = successRatings.map(r => r.sentiment_summary);

  // Detect patterns
  const frustrationGroups = detectPatterns(frustrationSummaries, FRUSTRATION_PATTERNS);
  const successGroups = detectPatterns(successSummaries, SUCCESS_PATTERNS);

  const frustrations = groupToPatternGroups(frustrationGroups, frustrationRatings);
  const successes = groupToPatternGroups(successGroups, successRatings);

  // Generate top issues (most common frustrations)
  const topIssues = frustrations
    .slice(0, 3)
    .map(f => `${f.pattern} (${f.count} occurrences, avg rating ${f.avgRating.toFixed(1)})`);

  // Generate recommendations based on patterns
  const recommendations: string[] = [];

  if (frustrations.some(f => f.pattern === "Time/Performance Issues")) {
    recommendations.push("Consider setting clearer time expectations and progress updates");
  }
  if (frustrations.some(f => f.pattern === "Wrong Approach")) {
    recommendations.push("Ask clarifying questions before starting complex tasks");
  }
  if (frustrations.some(f => f.pattern === "Over-engineering")) {
    recommendations.push("Default to simpler solutions; only add complexity when justified");
  }
  if (frustrations.some(f => f.pattern === "Communication Problems")) {
    recommendations.push("Summarize understanding before implementation");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue current patterns - no major issues detected");
  }

  return {
    period,
    totalRatings: ratings.length,
    avgRating,
    frustrations,
    successes,
    topIssues,
    recommendations,
  };
}

// ============================================================================
// File Generation
// ============================================================================

function formatSynthesisReport(result: SynthesisResult): string {
  const date = new Date().toISOString().split('T')[0];

  let content = `# Learning Pattern Synthesis

**Period:** ${result.period}
**Generated:** ${date}
**Total Ratings:** ${result.totalRatings}
**Average Rating:** ${result.avgRating.toFixed(1)}/10

---

## Top Issues

${result.topIssues.length > 0
    ? result.topIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
    : 'No significant issues detected'}

## Frustration Patterns

`;

  if (result.frustrations.length === 0) {
    content += '*No frustration patterns detected*\n\n';
  } else {
    for (const f of result.frustrations) {
      content += `### ${f.pattern}

- **Occurrences:** ${f.count}
- **Avg Rating:** ${f.avgRating.toFixed(1)}
- **Confidence:** ${(f.avgConfidence * 100).toFixed(0)}%
- **Examples:**
${f.examples.map(e => `  - "${e}"`).join('\n')}

`;
    }
  }

  content += `## Success Patterns

`;

  if (result.successes.length === 0) {
    content += '*No success patterns detected*\n\n';
  } else {
    for (const s of result.successes) {
      content += `### ${s.pattern}

- **Occurrences:** ${s.count}
- **Avg Rating:** ${s.avgRating.toFixed(1)}
- **Examples:**
${s.examples.map(e => `  - "${e}"`).join('\n')}

`;
    }
  }

  content += `## Recommendations

${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

*Generated by LearningPatternSynthesis tool*
`;

  return content;
}

function writeSynthesis(result: SynthesisResult, period: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const monthDir = path.join(SYNTHESIS_DIR, `${year}-${month}`);
  if (!fs.existsSync(monthDir)) {
    fs.mkdirSync(monthDir, { recursive: true });
  }

  const dateStr = now.toISOString().split('T')[0];
  const filename = `${dateStr}_${period.toLowerCase().replace(/\s+/g, '-')}-patterns.md`;
  const filepath = path.join(monthDir, filename);

  const content = formatSynthesisReport(result);
  fs.writeFileSync(filepath, content);

  return filepath;
}

// ============================================================================
// Hypothesis Generation (Proactive Deriver Loop)
// ============================================================================
//
// Reads recent LEARNING/SIGNALS, REFLECTIONS, FAILURES, and WORK/*/ISA.md
// content within a window. Clusters by lexical overlap. Emits ≤3 hypothesis
// notes per run that meet floors (confidence ≥ 0.6, sample ≥ 5).
// Idempotent via claim-hash dedup against the prior 30 days.
// Writes to MEMORY/WISDOM/FRAMES/_hypotheses/.

interface HypothesisFrontmatter {
  status: "hypothesis" | "graduated" | "rejected" | "expired";
  slug: string;
  target_frame: string;
  confidence: number;
  generated: string;
  expires: string;
  evidence_signals: string[];
  falsifier: string;
}

interface HypothesisCandidate {
  slug: string;
  claim: string;
  target_frame: string;
  confidence: number;
  evidence_signals: string[];
  falsifier: string;
  pattern: string; // source pattern name for context
  cluster_size: number;
}

interface DeriverState {
  schema_version: number;
  last_run: string | null;
  claim_hashes: Record<string, { hash: string; archived_at: string | null; status: string }>;
}

function parseWindow(arg: string | undefined): number {
  if (!arg) return 7;
  const m = arg.match(/^(\d+)d$/);
  if (!m) throw new Error(`Invalid --window format: ${arg}. Use Nd (e.g. 7d, 30d, 90d).`);
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 365) throw new Error(`--window out of range: ${arg}. Use 1d–365d.`);
  return n;
}

function readDeriverState(): DeriverState {
  if (!fs.existsSync(HYPOTHESES_STATE_FILE)) {
    return { schema_version: 1, last_run: null, claim_hashes: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(HYPOTHESES_STATE_FILE, "utf-8"));
  } catch {
    return { schema_version: 1, last_run: null, claim_hashes: {} };
  }
}

function writeDeriverState(state: DeriverState): void {
  const tmp = HYPOTHESES_STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, HYPOTHESES_STATE_FILE);
}

function pruneStateClaimHashes(state: DeriverState): DeriverState {
  const cutoff = Date.now() - HYPO_DEDUP_RETENTION_DAYS * 86400 * 1000;
  for (const [slug, entry] of Object.entries(state.claim_hashes)) {
    if (entry.archived_at) {
      const archivedMs = new Date(entry.archived_at).getTime();
      if (archivedMs < cutoff) delete state.claim_hashes[slug];
    }
  }
  return state;
}

function claimHash(claim: string): string {
  const normalized = claim.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function loadJsonl<T>(filepath: string): T[] {
  if (!fs.existsSync(filepath)) return [];
  return fs.readFileSync(filepath, "utf-8")
    .split("\n")
    .filter(line => line.trim())
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter((x): x is T => x !== null);
}

function listPeopleSlugs(): Set<string> {
  if (!fs.existsSync(KNOWLEDGE_PEOPLE_DIR)) return new Set();
  const slugs = new Set<string>();
  for (const f of fs.readdirSync(KNOWLEDGE_PEOPLE_DIR)) {
    if (f.endsWith(".md")) slugs.add(f.replace(/\.md$/, "").toLowerCase());
  }
  return slugs;
}

function violatesPrivacy(text: string, peopleSlugs: Set<string>): boolean {
  const norm = text.toLowerCase();
  for (const slug of peopleSlugs) {
    // Slug typically `firstname-lastname`; check for both joined and space-separated.
    const flat = slug.replace(/-/g, "");
    const spaced = slug.replace(/-/g, " ");
    if (norm.includes(spaced) || norm.includes(flat)) return true;
  }
  return false;
}

function listExistingFrames(): { name: string; body: string }[] {
  if (!fs.existsSync(FRAMES_DIR)) return [];
  const out: { name: string; body: string }[] = [];
  for (const f of fs.readdirSync(FRAMES_DIR)) {
    if (!f.endsWith(".md") || f.startsWith("_")) continue;
    if (f.toUpperCase() === "README.MD") continue;
    const name = f.replace(/\.md$/, "");
    const body = fs.readFileSync(path.join(FRAMES_DIR, f), "utf-8");
    out.push({ name, body });
  }
  return out;
}

function suggestTargetFrame(claim: string, frames: { name: string; body: string }[]): string {
  const claimTokens = new Set(claim.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3));
  let best = { name: "new", overlap: 0 };
  for (const f of frames) {
    const titleTokens = new Set(f.name.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3));
    let overlap = 0;
    for (const t of claimTokens) if (titleTokens.has(t)) overlap += 2;
    // Body token overlap (cheap top-line heuristic — count claim tokens appearing in body)
    const bodyLower = f.body.toLowerCase();
    for (const t of claimTokens) if (bodyLower.includes(t)) overlap += 1;
    if (overlap > best.overlap) best = { name: f.name, overlap };
  }
  return best.overlap >= 3 ? best.name : "new";
}

function alreadyInFrame(claim: string, frames: { name: string; body: string }[]): boolean {
  const claimTokens = claim.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3);
  if (claimTokens.length === 0) return false;
  for (const f of frames) {
    const bodyLower = f.body.toLowerCase();
    let hits = 0;
    for (const t of claimTokens) if (bodyLower.includes(t)) hits++;
    // ≥70% of claim tokens already in this frame body → consider it covered
    if (hits / claimTokens.length >= 0.7) return true;
  }
  return false;
}

function slugifyClaim(claim: string): string {
  return claim.toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .slice(0, 60) || "untitled";
}

function buildHypothesisFromCluster(
  patternName: string,
  examples: string[],
  ratings: Rating[],
  frames: { name: string; body: string }[]
): HypothesisCandidate | null {
  if (examples.length < HYPO_SAMPLE_FLOOR) return null;

  const matching = ratings.filter(r => examples.includes(r.sentiment_summary));
  if (matching.length < HYPO_SAMPLE_FLOOR) return null;

  const avgConfidence = matching.reduce((s, r) => s + r.confidence, 0) / matching.length;
  const sizeFactor = Math.min(matching.length / 20, 1); // saturate at 20 signals
  const confidence = Math.min(avgConfidence * 0.6 + sizeFactor * 0.4, 1.0);
  if (confidence < HYPO_CONFIDENCE_FLOOR) return null;

  const avgRating = matching.reduce((s, r) => s + r.rating, 0) / matching.length;
  const direction = avgRating <= 4 ? "frustration" : avgRating >= 7 ? "satisfaction" : "mixed";

  const claim = `Recurring ${patternName.toLowerCase()} pattern (${matching.length} signals, avg rating ${avgRating.toFixed(1)}/10) — ${direction} cluster.`;

  if (alreadyInFrame(claim, frames)) return null;

  const evidence = matching.slice(0, Math.min(matching.length, 10)).map(r => `sig:${r.timestamp}`);
  const falsifier =
    direction === "frustration"
      ? `Refuted if next ${matching.length} signals matching "${patternName}" average rating ≥ 6.`
      : direction === "satisfaction"
      ? `Refuted if next ${matching.length} signals matching "${patternName}" average rating ≤ 4.`
      : `Refuted if next ${matching.length} signals matching "${patternName}" cluster confidence < ${HYPO_CONFIDENCE_FLOOR}.`;

  return {
    slug: slugifyClaim(`${patternName}-${direction}`),
    claim,
    target_frame: suggestTargetFrame(claim, frames),
    confidence: Number(confidence.toFixed(2)),
    evidence_signals: evidence,
    falsifier,
    pattern: patternName,
    cluster_size: matching.length,
  };
}

function renderHypothesisFile(c: HypothesisCandidate): string {
  const generated = new Date();
  const expires = new Date(generated.getTime() + HYPO_EXPIRY_DAYS * 86400 * 1000);

  const fm: HypothesisFrontmatter = {
    status: "hypothesis",
    slug: c.slug,
    target_frame: c.target_frame,
    confidence: c.confidence,
    generated: generated.toISOString(),
    expires: expires.toISOString(),
    evidence_signals: c.evidence_signals,
    falsifier: c.falsifier,
  };

  const fmYaml = [
    "---",
    `status: ${fm.status}`,
    `slug: ${fm.slug}`,
    `target_frame: ${fm.target_frame}`,
    `confidence: ${fm.confidence}`,
    `generated: ${fm.generated}`,
    `expires: ${fm.expires}`,
    "evidence_signals:",
    ...fm.evidence_signals.map(s => `  - ${s}`),
    `falsifier: "${fm.falsifier.replace(/"/g, '\\"')}"`,
    "---",
    "",
  ].join("\n");

  const body = [
    "## Claim",
    "",
    c.claim,
    "",
    "## Evidence",
    "",
    ...c.evidence_signals.map(s => `- ${s}`),
    `- (cluster size: ${c.cluster_size}; pattern: ${c.pattern})`,
    "",
    "## Falsifier",
    "",
    c.falsifier,
    "",
    "## Suggested Action",
    "",
    c.target_frame === "new"
      ? `Start a new frame at \`MEMORY/WISDOM/FRAMES/${c.slug}.md\` if {{PRINCIPAL_NAME}} reviews and confirms the pattern.`
      : `Append a section to \`MEMORY/WISDOM/FRAMES/${c.target_frame}.md\` under \`## Hypothesis-Sourced\` if {{PRINCIPAL_NAME}} graduates this hypothesis.`,
    "",
    "## Changelog",
    "",
    `- ${generated.toISOString()} — emitted by deriver loop`,
    "",
  ].join("\n");

  return fmYaml + body;
}

function expirySweep(state: DeriverState, log: string[]): number {
  if (!fs.existsSync(HYPOTHESES_DIR)) return 0;
  let moved = 0;
  const now = Date.now();
  for (const f of fs.readdirSync(HYPOTHESES_DIR)) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const fp = path.join(HYPOTHESES_DIR, f);
    const content = fs.readFileSync(fp, "utf-8");
    const expiresMatch = content.match(/^expires:\s*(\S+)/m);
    const statusMatch = content.match(/^status:\s*(\S+)/m);
    if (!expiresMatch || !statusMatch) continue;
    if (statusMatch[1] !== "hypothesis") continue;
    const expiresMs = new Date(expiresMatch[1]).getTime();
    if (expiresMs > now) continue;

    const newContent = content.replace(/^status:\s*hypothesis/m, "status: expired") +
      `\n- ${new Date().toISOString()} — auto-expired by deriver sweep\n`;
    const archivePath = path.join(HYPOTHESES_ARCHIVE_DIR, f);
    fs.writeFileSync(archivePath, newContent);
    fs.unlinkSync(fp);

    const slugMatch = content.match(/^slug:\s*(\S+)/m);
    if (slugMatch && state.claim_hashes[slugMatch[1]]) {
      state.claim_hashes[slugMatch[1]].archived_at = new Date().toISOString();
      state.claim_hashes[slugMatch[1]].status = "expired";
    }
    log.push(`expired: ${f}`);
    moved++;
  }
  return moved;
}

function appendDeriverLog(lines: string[]): void {
  if (lines.length === 0) return;
  fs.mkdirSync(path.dirname(DERIVER_LOG), { recursive: true });
  const stamp = new Date().toISOString();
  const entry = lines.map(l => `[${stamp}] ${l}`).join("\n") + "\n";
  fs.appendFileSync(DERIVER_LOG, entry);
}

function runDeriver(opts: { window: number; dryRun: boolean }): { emitted: number; expired: number } {
  const log: string[] = [];
  log.push(`run: window=${opts.window}d dry-run=${opts.dryRun}`);

  fs.mkdirSync(HYPOTHESES_DIR, { recursive: true });
  fs.mkdirSync(HYPOTHESES_ARCHIVE_DIR, { recursive: true });

  let state = readDeriverState();
  state = pruneStateClaimHashes(state);

  const expired = opts.dryRun ? 0 : expirySweep(state, log);

  // Load signals within window
  const cutoff = Date.now() - opts.window * 86400 * 1000;
  const allRatings = loadJsonl<Rating>(RATINGS_FILE);
  const ratings = allRatings.filter(r => new Date(r.timestamp).getTime() >= cutoff);
  log.push(`signals: total=${allRatings.length} in_window=${ratings.length}`);

  if (ratings.length === 0) {
    log.push("no signals in window — nothing to do");
    if (!opts.dryRun) appendDeriverLog(log);
    return { emitted: 0, expired };
  }

  const summaries = ratings.map(r => r.sentiment_summary);
  const frustrationGroups = detectPatterns(summaries.filter((_, i) => ratings[i].rating <= 4), FRUSTRATION_PATTERNS);
  const successGroups = detectPatterns(summaries.filter((_, i) => ratings[i].rating >= 7), SUCCESS_PATTERNS);
  const allGroups = new Map<string, string[]>();
  for (const [k, v] of frustrationGroups) allGroups.set(k, v);
  for (const [k, v] of successGroups) {
    const existing = allGroups.get(k) || [];
    allGroups.set(k, [...existing, ...v]);
  }
  log.push(`clusters: ${allGroups.size}`);

  const frames = listExistingFrames();
  const peopleSlugs = listPeopleSlugs();

  const candidates: HypothesisCandidate[] = [];
  for (const [pattern, examples] of allGroups.entries()) {
    const c = buildHypothesisFromCluster(pattern, examples, ratings, frames);
    if (!c) continue;
    if (violatesPrivacy(c.claim + " " + c.evidence_signals.join(" "), peopleSlugs)) {
      log.push(`privacy-block: ${pattern}`);
      continue;
    }
    const h = claimHash(c.claim);
    const existing = Object.values(state.claim_hashes).find(e => e.hash === h);
    if (existing) {
      log.push(`dedup-skip: ${pattern}`);
      continue;
    }
    candidates.push(c);
  }

  candidates.sort((a, b) => (b.confidence * b.cluster_size) - (a.confidence * a.cluster_size));
  const emit = candidates.slice(0, HYPO_MAX_PER_RUN);

  if (opts.dryRun) {
    log.push(`dry-run: would emit ${emit.length} hypotheses`);
    for (const c of emit) log.push(`  ${c.slug} (conf=${c.confidence}, samples=${c.cluster_size})`);
    appendDeriverLog(log);
    return { emitted: emit.length, expired };
  }

  let emitted = 0;
  for (const c of emit) {
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `${dateStr}_${c.slug}.md`;
    const filepath = path.join(HYPOTHESES_DIR, filename);
    if (fs.existsSync(filepath)) {
      log.push(`collision-skip: ${filename}`);
      continue;
    }
    const content = renderHypothesisFile(c);
    const tmp = filepath + ".tmp";
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, filepath);
    state.claim_hashes[c.slug] = {
      hash: claimHash(c.claim),
      archived_at: null,
      status: "hypothesis",
    };
    log.push(`emitted: ${filename} (conf=${c.confidence}, samples=${c.cluster_size})`);
    emitted++;
  }

  state.last_run = new Date().toISOString();
  writeDeriverState(state);
  appendDeriverLog(log);

  return { emitted, expired };
}

// ============================================================================
// CLI
// ============================================================================

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    week: { type: "boolean" },
    month: { type: "boolean" },
    all: { type: "boolean" },
    "dry-run": { type: "boolean" },
    hypothesize: { type: "boolean" },
    window: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(`
LearningPatternSynthesis - Aggregate ratings into actionable patterns

Usage:
  bun run LearningPatternSynthesis.ts --week                Analyze last 7 days (default)
  bun run LearningPatternSynthesis.ts --month               Analyze last 30 days
  bun run LearningPatternSynthesis.ts --all                 Analyze all ratings
  bun run LearningPatternSynthesis.ts --dry-run             Preview without writing
  bun run LearningPatternSynthesis.ts --hypothesize         Run proactive deriver loop
  bun run LearningPatternSynthesis.ts --hypothesize \\
                                       --window 14d          Override deriver window
  bun run LearningPatternSynthesis.ts --hypothesize \\
                                       --dry-run             Show would-emit hypotheses

Synthesis output: MEMORY/LEARNING/SYNTHESIS/YYYY-MM/
Deriver output:   MEMORY/WISDOM/FRAMES/_hypotheses/
Deriver log:      MEMORY/OBSERVABILITY/deriver.log
`);
  process.exit(0);
}

// Hypothesize mode short-circuits — runs the proactive deriver loop and exits.
if (values.hypothesize) {
  let windowDays = 7;
  try {
    windowDays = parseWindow(values.window);
  } catch (e: any) {
    console.error("error:", e.message);
    process.exit(1);
  }
  const { emitted, expired } = runDeriver({ window: windowDays, dryRun: !!values["dry-run"] });
  console.log(`🌙 deriver: window=${windowDays}d expired=${expired} emitted=${emitted}${values["dry-run"] ? " (dry-run)" : ""}`);
  process.exit(0);
}

// Check ratings file exists
if (!fs.existsSync(RATINGS_FILE)) {
  console.log("No ratings file found at:", RATINGS_FILE);
  process.exit(0);
}

// Read all ratings
const content = fs.readFileSync(RATINGS_FILE, 'utf-8');
const allRatings: Rating[] = content
  .split('\n')
  .filter(line => line.trim())
  .map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter((r): r is Rating => r !== null);

console.log(`📊 Loaded ${allRatings.length} total ratings`);

// Determine period and filter
let period = 'Weekly';
let cutoffDate = new Date();

if (values.month) {
  period = 'Monthly';
  cutoffDate.setDate(cutoffDate.getDate() - 30);
} else if (values.all) {
  period = 'All Time';
  cutoffDate = new Date(0); // Beginning of time
} else {
  // Default: week
  cutoffDate.setDate(cutoffDate.getDate() - 7);
}

const filteredRatings = allRatings.filter(r => {
  const ratingDate = new Date(r.timestamp);
  return ratingDate >= cutoffDate;
});

console.log(`🔍 Analyzing ${filteredRatings.length} ratings for ${period.toLowerCase()} period`);

if (filteredRatings.length === 0) {
  console.log("✅ No ratings in this period");
  process.exit(0);
}

// Analyze
const result = analyzeRatings(filteredRatings, period);

console.log(`\n📈 Analysis Results:`);
console.log(`   Average Rating: ${result.avgRating.toFixed(1)}/10`);
console.log(`   Frustration Patterns: ${result.frustrations.length}`);
console.log(`   Success Patterns: ${result.successes.length}`);

if (result.topIssues.length > 0) {
  console.log(`\n⚠️  Top Issues:`);
  for (const issue of result.topIssues) {
    console.log(`   - ${issue}`);
  }
}

if (values["dry-run"]) {
  console.log("\n🔍 DRY RUN - Would write synthesis report");
  console.log("\nRecommendations:");
  for (const rec of result.recommendations) {
    console.log(`   - ${rec}`);
  }
} else {
  const filepath = writeSynthesis(result, period);
  console.log(`\n✅ Created synthesis report: ${path.basename(filepath)}`);
}
