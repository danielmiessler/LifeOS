#!/usr/bin/env bun

/**
 * InterviewScan — comprehensive completeness scanner across TELOS + IDEAL_STATE +
 * preferences + identity. Produces a prioritized gap report so `/interview` can
 * dynamically build the conversation around what's actually missing.
 *
 * Scans every relevant file, computes per-file completeness, weights by leverage
 * (files that unlock other files score higher), and outputs either a human-readable
 * gap report or a JSON plan the Interview skill consumes.
 *
 * Usage:
 *   bun InterviewScan.ts                 Human-readable gap report (default)
 *   bun InterviewScan.ts --json          JSON for programmatic consumption
 *   bun InterviewScan.ts --next          Show single next priority target + prompts
 *   bun InterviewScan.ts --file <path>   Deep-scan single file
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";
const PAI_DIR = process.env.PAI_DIR || join(HOME, ".claude", "PAI");
const USER_DIR = join(PAI_DIR, "USER");
const TELOS_DIR = join(USER_DIR, "TELOS");
const IDEAL_DIR = join(TELOS_DIR, "IDEAL_STATE");
const CURRENT_DIR = join(TELOS_DIR, "CURRENT_STATE");

type Category = "foundational" | "ideal_state" | "current_state" | "preference" | "identity";

// Phases drive interview ordering. Phase 1 = foundational TELOS context
// ({{PRINCIPAL_NAME}}'s explicit priority: this is the core of the interview, not IDEAL_STATE).
// Phase 9 = deferred (RHYTHMS currently — {{PRINCIPAL_NAME}} said not needed at first).
type Phase = 1 | 2 | 3 | 4 | 9;

type Target = {
  path: string;
  name: string;
  category: Category;
  phase: Phase;
  leverage: number; // 1-10 — higher = more valuable within its phase
  content_length: number;
  tbd_count: number;
  seed_markers: number;
  empty_sections: number;
  required_fields_missing: string[];
  completeness_score: number; // 0-100
  priority: number; // computed — includes phase boost so phase 1 always beats phase 2+
  review_mode: boolean; // true if ≥80% complete — interview walks through as a review, not a fill
  why_incomplete: string[];
  prompts: string[];
};

// ─── Registry: what files are interview-targets, and their prompts ───
//
// PHASE ORDERING ({{PRINCIPAL_NAME}}'s explicit priority 2026-04-15):
//   Phase 1 = Foundational TELOS context (the core of the interview)
//   Phase 2 = IDEAL_STATE dimensions (minus RHYTHMS — deferred)
//   Phase 3 = Preference files (bands, movies, restaurants, etc.)
//   Phase 4 = CURRENT_STATE snapshot + PRINCIPAL_IDENTITY
//   Phase 9 = Deferred (RHYTHMS — not needed at first)

const REGISTRY: Array<Omit<Target, "content_length" | "tbd_count" | "seed_markers" | "empty_sections" | "required_fields_missing" | "completeness_score" | "priority" | "review_mode" | "why_incomplete">> = [
  // ─── Phase 1: Foundational TELOS context ───
  { phase: 1, path: join(TELOS_DIR, "MISSION.md"), name: "MISSION", category: "foundational", leverage: 10,
    prompts: ["What's your north-star mission — the single sentence that captures why you're building all of this?",
              "Any secondary missions that serve the north star but deserve their own articulation?",
              "What's the longest-horizon mission (decade+ timescale)?"] },
  { phase: 1, path: join(TELOS_DIR, "GOALS.md"), name: "GOALS", category: "foundational", leverage: 10,
    prompts: ["Active goals for this year — G0 through G-whatever, each with a one-line outcome?",
              "Deferred or ongoing goals — things you're still tracking but not pushing on?",
              "Any goals in your head that aren't yet written down?"] },
  { phase: 1, path: join(TELOS_DIR, "PROBLEMS.md"), name: "PROBLEMS", category: "foundational", leverage: 9,
    prompts: ["The big problems you're solving with your work — worldscale, not personal?",
              "Any problems you've identified but haven't committed a strategy to yet?"] },
  { phase: 1, path: join(TELOS_DIR, "STRATEGIES.md"), name: "STRATEGIES", category: "foundational", leverage: 8,
    prompts: ["Active strategies — how are you attacking each problem?",
              "Strategies you've decided to NOT use (reverse strategies) worth documenting?"] },
  { phase: 1, path: join(TELOS_DIR, "CHALLENGES.md"), name: "CHALLENGES", category: "foundational", leverage: 7,
    prompts: ["Personal challenges that get in the way — procrastination patterns, energy traps, known weaknesses?",
              "Challenges you're actively working to overcome vs. just tracking?"] },
  { phase: 1, path: join(TELOS_DIR, "NARRATIVES.md"), name: "NARRATIVES", category: "foundational", leverage: 6,
    prompts: ["How do you describe your work to different audiences — one-liners per audience?",
              "The conference one-liner that captures your current pitch?"] },
  { phase: 1, path: join(TELOS_DIR, "SPARKS.md"), name: "SPARKS", category: "foundational", leverage: 6,
    prompts: ["The creative sparks — music, fiction, languages, design — that you want to keep alive?",
              "Any sparks you'd forgotten about worth reviving?"] },
  { phase: 1, path: join(TELOS_DIR, "BELIEFS.md"), name: "BELIEFS", category: "foundational", leverage: 5,
    prompts: ["Core beliefs that shape how you work and decide?",
              "Any beliefs that have changed recently worth capturing?"] },
  { phase: 1, path: join(TELOS_DIR, "WISDOM.md"), name: "WISDOM", category: "foundational", leverage: 4,
    prompts: ["Hard-won insights from experience — things you want {{DA_NAME}} to remember permanently?",
              "Any recent lessons that haven't landed in WISDOM yet?"] },
  { phase: 1, path: join(TELOS_DIR, "MODELS.md"), name: "MODELS", category: "foundational", leverage: 4,
    prompts: ["Mental models you actively use — frameworks that shape how you see the world?",
              "Models you've retired or updated recently?"] },
  { phase: 1, path: join(TELOS_DIR, "FRAMES.md"), name: "FRAMES", category: "foundational", leverage: 4,
    prompts: ["Useful ways of seeing the world — true-ish frames worth holding?",
              "Frames that conflict with each other but you hold both?"] },

  // ─── Phase 2: IDEAL_STATE dimensions (minus RHYTHMS, deferred) ───
  { phase: 2, path: join(IDEAL_DIR, "HEALTH.md"), name: "IDEAL_STATE/HEALTH", category: "ideal_state", leverage: 8,
    prompts: ["Weight and body-composition target?",
              "Sleep hours + efficiency target?",
              "Fitness targets — lifts, cardio, mobility?",
              "Bloodwork biomarkers you track + targets?",
              "Anything north-star only (aspirational, not scored)?"] },
  { phase: 2, path: join(IDEAL_DIR, "MONEY.md"), name: "IDEAL_STATE/MONEY", category: "ideal_state", leverage: 8,
    prompts: ["Monthly burn ceiling target?",
              "Runway target in months?",
              "Revenue diversification target?",
              "Savings rate target?",
              "Investment allocation posture?",
              "Any financial north-stars (FI number, etc.)?"] },
  { phase: 2, path: join(IDEAL_DIR, "FREEDOM.md"), name: "IDEAL_STATE/FREEDOM", category: "ideal_state", leverage: 8,
    prompts: ["Max meetings per day before a day feels hijacked?",
              "Deep-work % of workday target?",
              "Meeting-free days per week target?",
              "Travel days per quarter — max + ideal?",
              "Any autonomy non-negotiables?"] },
  { phase: 2, path: join(IDEAL_DIR, "RELATIONSHIPS.md"), name: "IDEAL_STATE/RELATIONSHIPS", category: "ideal_state", leverage: 6,
    prompts: ["Ideal {{PRINCIPAL_PARTNER_NAME}} presence shape — daily, weekly, travel anchors?",
              "Family cadence — daughters, siblings, parents?",
              "Tier-A friends (weekly contact): who are the 5-10 names?",
              "Tier-B (monthly) and Tier-C (quarterly) names?"] },
  { phase: 2, path: join(IDEAL_DIR, "CREATIVE.md"), name: "IDEAL_STATE/CREATIVE", category: "ideal_state", leverage: 5,
    prompts: ["What does an active music-life look like in a month? (narrative, not metric)",
              "Active fiction work shape?",
              "Spanish maintenance — active or dormant?",
              "Teaching / explaining cadence?"] },

  // ─── Phase 3: Preference files ───
  { phase: 3, path: join(TELOS_DIR, "BOOKS.md"), name: "BOOKS", category: "preference", leverage: 5,
    prompts: ["The massive list — beyond the current 5, what books shaped you?",
              "Biographies, science, history, classics, business — categories to fill?"] },
  { phase: 3, path: join(TELOS_DIR, "AUTHORS.md"), name: "AUTHORS", category: "preference", leverage: 5,
    prompts: ["Beyond the 7 already listed — what other authors do you track?",
              "Security / AI / tech writers whose new work you'd buy immediately?"] },
  { phase: 3, path: join(TELOS_DIR, "BANDS.md"), name: "BANDS", category: "preference", leverage: 4,
    prompts: ["Beyond Tool, Meshuggah, Boris Brejcha — what other artists have shaped you?",
              "Artists you'd travel 100 miles for — tour-alert priority ones?",
              "Electronic / DJ / producer names you track?"] },
  { phase: 3, path: join(TELOS_DIR, "MOVIES.md"), name: "MOVIES", category: "preference", leverage: 3,
    prompts: ["Sci-fi beyond Interstellar that shaped you?",
              "Crime / thrillers beyond Pulp Fiction and Snatch?",
              "Directors whose catalog you track?"] },
  { phase: 3, path: join(TELOS_DIR, "RESTAURANTS.md"), name: "RESTAURANTS", category: "preference", leverage: 4,
    prompts: ["Favorites in Newark / Fremont — your go-to list?",
              "Favorites Peninsula / SF — worth-the-drive places?",
              "Any restaurants on the blocklist (never recommend)?",
              "Special-occasion places?"] },
  { phase: 3, path: join(TELOS_DIR, "FOOD_PREFERENCES.md"), name: "FOOD_PREFERENCES", category: "preference", leverage: 4,
    prompts: ["Top 3-5 cuisines you eat weekly happily?",
              "Cuisines avoided?",
              "Spice tolerance, dietary posture?",
              "Dishes you love to make? Dishes {{PRINCIPAL_PARTNER_NAME}} makes you love?"] },
  { phase: 3, path: join(TELOS_DIR, "LEARNING.md"), name: "LEARNING", category: "preference", leverage: 4,
    prompts: ["Beyond meditation / tennis / kickboxing — what else do you want to actively learn?",
              "Spanish refresh — active or dormant?",
              "Drums — lessons or self-taught?",
              "Dormant-but-interested topics?"] },
  { phase: 3, path: join(TELOS_DIR, "MEETUPS.md"), name: "MEETUPS", category: "preference", leverage: 3,
    prompts: ["Beyond AI, security, founder meetups — any other topics?",
              "Preferred event size and price ceiling?",
              "Any specific groups you already like locally?"] },
  { phase: 3, path: join(TELOS_DIR, "CIVIC.md"), name: "CIVIC", category: "preference", leverage: 2,
    prompts: ["Permit radius — 0.5 mile OK or wider?",
              "City council topics to always flag?",
              "State-level legislation topic areas?"] },

  // ─── Phase 4: Current-state snapshot + identity ───
  { phase: 4, path: join(USER_DIR, "PRINCIPAL_IDENTITY.md"), name: "PRINCIPAL_IDENTITY", category: "identity", leverage: 8,
    prompts: ["Anything in the identity file that's out-of-date or needs refinement?",
              "Aspects of how you want to be represented that aren't captured yet?"] },
  { phase: 4, path: join(CURRENT_DIR, "SNAPSHOT.md"), name: "CURRENT_STATE/SNAPSHOT", category: "current_state", leverage: 5,
    prompts: ["Right now: focus, energy, mood, last meal, sleep?",
              "This week's top intent, stalled items, wins?"] },

  // ─── Phase 9: Deferred ({{PRINCIPAL_NAME}} said "not needed at first") ───
  { phase: 9, path: join(IDEAL_DIR, "RHYTHMS.md"), name: "IDEAL_STATE/RHYTHMS", category: "ideal_state", leverage: 10,
    prompts: ["Wake time and the protected anchors of an ideal day?",
              "Deep-work blocks — when, how long, how protected?",
              "Creative block placement — when does drums / fiction / music fit?",
              "Family / {{PRINCIPAL_PARTNER_NAME}} protected time — when?",
              "Day-close shape — how do you want to end?",
              "Weekly shape — Monday through Sunday anchors?",
              "Yearly anchors — conferences, retreats, family travel, off-grid time?"] },
];

// ─── Scoring ───

const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/g,
  /\bseed(ed)?\s+(during|through)\s+interview\b/gi,
  /\bseeded during interview\b/gi,
  /^\s*_\(.*(seeded|pending|empty|awaiting).*\)_\s*$/gim,
  /^\s*-\s*TBD\s*$/gim,
];

// Sample-template detection. Bootstrap-installed TELOS files carry a banner
// and "(sample)" prefixed entries. Both indicate the user has not yet
// personalized the file — without these checks the scanner scored such files
// 100% because they're length-substantive and TBD-free, masking real gaps.
const SAMPLE_TEMPLATE_BANNER = /🎯 SAMPLE TEMPLATE/;
const SAMPLE_LINE = /^\s*[-*]\s+(?:\*\*[^*]+\*\*[\s:—–-]*)?\(sample\)\b/gim;

// Phase boost ensures foundational TELOS files always beat Phase 2+ files in
// priority order, regardless of incompleteness. Phase 1 at 100% complete still
// outranks Phase 2 at 0% complete — {{PRINCIPAL_NAME}}'s rule: review foundational first.
const PHASE_BOOST: Record<Phase, number> = { 1: 1000, 2: 200, 3: 50, 4: 300, 9: 0 };

function scoreFile(target: (typeof REGISTRY)[number]): Target {
  const result: Target = {
    ...target,
    content_length: 0,
    tbd_count: 0,
    seed_markers: 0,
    empty_sections: 0,
    required_fields_missing: [],
    completeness_score: 0,
    priority: 0,
    review_mode: false,
    why_incomplete: [],
  };

  if (!existsSync(target.path)) {
    result.why_incomplete.push("file does not exist");
    result.completeness_score = 0;
    result.priority = PHASE_BOOST[target.phase] + target.leverage * 2 + 100;
    return result;
  }

  const content = readFileSync(target.path, "utf-8");
  result.content_length = content.length;

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = content.match(pattern);
    if (!matches) continue;
    if (pattern.source.includes("TBD")) result.tbd_count += matches.length;
    else result.seed_markers += matches.length;
  }

  // Empty sections: a heading followed by whitespace or placeholder
  const sectionMatches = content.matchAll(/^#{2,4}\s+.+\n([\s\S]*?)(?=^#{2,4}|\Z)/gm);
  for (const m of sectionMatches) {
    const body = m[1].trim();
    const substantive = body
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/_\(.*?\)_/g, "")
      .replace(/\bTBD\b/g, "")
      .trim();
    if (substantive.length < 20) result.empty_sections += 1;
  }

  // Completeness heuristic: weight content length vs. placeholders
  const placeholderPenalty = result.tbd_count * 40 + result.seed_markers * 20 + result.empty_sections * 30;
  const contentBonus = Math.min(content.length / 10, 500);
  result.completeness_score = Math.max(0, Math.min(100, 100 - placeholderPenalty / 10 + contentBonus / 50));

  // Sample-template kill-switch. Banner = unmodified bootstrap → cap at 15%.
  // ≥2 "(sample)" entries = mostly-template → cap at 25%. A single "(sample)"
  // could be incidental user wording, so we only act on multiples.
  const hasBanner = SAMPLE_TEMPLATE_BANNER.test(content);
  const sampleEntries = (content.match(SAMPLE_LINE) || []).length;
  if (hasBanner) {
    result.completeness_score = Math.min(result.completeness_score, 15);
    result.why_incomplete.push("SAMPLE TEMPLATE banner present — content is bootstrap default");
  } else if (sampleEntries >= 2) {
    result.completeness_score = Math.min(result.completeness_score, 25);
    result.why_incomplete.push(`${sampleEntries} "(sample)" entries — content not personalized`);
  }

  // Priority: phase (dominant) + leverage + incompleteness. Phase 1 always beats Phase 2.
  const incompleteness = 100 - result.completeness_score;
  result.priority = Math.round(PHASE_BOOST[target.phase] + target.leverage * 2 + incompleteness);

  // Review mode vs. fill mode: ≥80% complete means we're reviewing, not filling.
  // Review prompts should be "here's what's there, anything to update/refine/add?"
  // Fill prompts should be "this is empty, let's populate it."
  result.review_mode = result.completeness_score >= 80;

  if (result.tbd_count > 0) result.why_incomplete.push(`${result.tbd_count} TBD markers`);
  if (result.seed_markers > 0) result.why_incomplete.push(`${result.seed_markers} "seed during interview" markers`);
  if (result.empty_sections > 0) result.why_incomplete.push(`${result.empty_sections} empty/sparse sections`);
  if (content.length < 500 && target.category !== "foundational") result.why_incomplete.push("sparse content");
  if (result.review_mode && result.why_incomplete.length === 0) result.why_incomplete.push("already substantive — review for updates/refinements");

  return result;
}

const PHASE_LABELS: Record<Phase, string> = {
  1: "PHASE 1 — Foundational TELOS (the core — review first)",
  2: "PHASE 2 — IDEAL_STATE dimensions",
  3: "PHASE 3 — Preference files",
  4: "PHASE 4 — Current state + identity",
  9: "PHASE 9 — Deferred",
};

// ─── Output formatters ───

function formatHuman(targets: Target[]): string {
  const overall = Math.round(targets.reduce((s, t) => s + t.completeness_score, 0) / targets.length);

  const lines: string[] = [];
  lines.push(`═══ PAI Interview Gap Report ═══`);
  lines.push(``);
  lines.push(`Overall: ${overall}% complete across ${targets.length} interview targets`);

  // Per-phase averages
  const phases: Phase[] = [1, 2, 3, 4, 9];
  const phaseStats = phases.map((p) => {
    const t = targets.filter((x) => x.phase === p);
    const avg = t.length ? Math.round(t.reduce((s, x) => s + x.completeness_score, 0) / t.length) : 0;
    return { phase: p, count: t.length, avg };
  });
  lines.push(
    `Phases: ` +
      phaseStats
        .filter((p) => p.count > 0)
        .map((p) => `P${p.phase}=${p.avg}%`)
        .join("  ·  ")
  );
  lines.push(``);

  // Render each phase as its own block
  for (const phase of phases) {
    const items = targets.filter((t) => t.phase === phase);
    if (items.length === 0) continue;
    lines.push(`── ${PHASE_LABELS[phase]} ──`);
    for (const t of items) {
      const mode = t.review_mode ? "review" : "fill  ";
      const marker = t.completeness_score === 100 ? "✓" : t.completeness_score >= 80 ? "·" : "○";
      lines.push(
        `  ${marker} ${mode}  ${t.name.padEnd(26)}  ${t.completeness_score.toFixed(0).padStart(3)}%  (lev ${t.leverage})  — ${t.why_incomplete.join(", ") || "—"}`
      );
    }
    lines.push(``);
  }

  // Suggested next — skip Phase 9 (deferred)
  const next = targets.find((t) => t.phase !== 9);
  if (next) {
    const modeLabel = next.review_mode ? "REVIEW" : "FILL";
    lines.push(`── Suggested next (${modeLabel}): ${next.name} ──`);
    next.prompts.slice(0, 3).forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    lines.push(``);
    lines.push(`Run /interview to start the conversational pass.`);
  } else {
    lines.push(`✅ Everything in scope is either done or deferred.`);
  }

  return lines.join("\n");
}

function formatJson(targets: Target[]): string {
  const overall = Math.round(targets.reduce((s, t) => s + t.completeness_score, 0) / targets.length);
  return JSON.stringify({ overall_complete: overall, count: targets.length, targets }, null, 2);
}

function formatNext(targets: Target[]): string {
  // Pick the highest-priority non-deferred target
  const t = targets.find((x) => x.phase !== 9);
  if (!t) return "✅ Nothing in scope. Check --phase 9 for deferred items.";
  const lines: string[] = [];
  const modeLabel = t.review_mode ? "REVIEW mode — read file, ask what to update/refine/add" : "FILL mode — walk through prompts to populate";
  lines.push(`📋 ${t.name}  —  ${t.completeness_score.toFixed(0)}% complete  ·  ${PHASE_LABELS[t.phase]}`);
  lines.push(`File: ${t.path}`);
  lines.push(`Leverage: ${t.leverage}/10  ·  Priority: ${t.priority}  ·  ${modeLabel}`);
  lines.push(`Why incomplete: ${t.why_incomplete.join(", ") || "—"}`);
  lines.push(``);
  if (t.review_mode) {
    lines.push(`Review approach ({{DA_NAME}} reads file first, then asks):`);
    lines.push(`  - "Here's what you've got in ${t.name}. Anything outdated? Sharpen / refine?"`);
    lines.push(`  - "Any recent thinking that should be captured here?"`);
    lines.push(`  - "Anything missing from a category that should exist?"`);
  } else {
    lines.push(`Questions for {{DA_NAME}} to ask:`);
    t.prompts.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
  }
  return lines.join("\n");
}

// ─── Main ───

function main(): void {
  const args = process.argv.slice(2);
  const includeDeferred = args.includes("--include-deferred");
  const phaseIdx = args.indexOf("--phase");
  const phaseFilter = phaseIdx !== -1 ? Number(args[phaseIdx + 1]) : null;

  if (args.includes("--file")) {
    const idx = args.indexOf("--file");
    const match = REGISTRY.find((t) => t.path === args[idx + 1] || t.name === args[idx + 1]);
    if (!match) {
      console.error(`Not found: ${args[idx + 1]}`);
      process.exit(1);
    }
    const scored = scoreFile(match);
    console.log(JSON.stringify(scored, null, 2));
    return;
  }

  let scored = REGISTRY.map(scoreFile);

  // Filter: by default skip phase 9 (deferred). --include-deferred to include.
  // --phase N filters to a single phase.
  if (phaseFilter !== null) {
    scored = scored.filter((t) => t.phase === phaseFilter);
  } else if (!includeDeferred) {
    scored = scored.filter((t) => t.phase !== 9);
  }

  // Sort: phase ascending (1 before 2), then priority descending within phase.
  scored.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    return b.priority - a.priority;
  });

  if (args.includes("--json")) {
    console.log(formatJson(scored));
  } else if (args.includes("--next")) {
    console.log(formatNext(scored));
  } else {
    console.log(formatHuman(scored));
  }
}

main();
