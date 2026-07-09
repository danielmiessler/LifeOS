#!/usr/bin/env bun

/**
 * InterviewScan — comprehensive completeness scanner across unified TELOS
 * sections + setup/identity files. Produces a prioritized gap report so
 * `/interview` can dynamically build the conversation around what's actually missing.
 *
 * Scans every relevant target, computes completeness, weights by leverage
 * (targets that unlock other context score higher), and outputs either a
 * human-readable gap report or a JSON plan the Interview skill consumes.
 *
 * Usage:
 *   bun InterviewScan.ts                 Human-readable gap report (default)
 *   bun InterviewScan.ts --json          JSON for programmatic consumption
 *   bun InterviewScan.ts --next          Show single next priority target + prompts
 *   bun InterviewScan.ts --file <path>   Deep-scan single file
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { readTelosFreshness, sectionSlug, type SectionFreshness } from "./TelosFreshness";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const USER_DIR = join(LIFEOS_DIR, "USER");
const TELOS_DIR = join(USER_DIR, "TELOS");
const TELOS_PATH = join(TELOS_DIR, "TELOS.md");

type Category = "setup" | "foundational" | "ideal_state" | "current_state" | "preference" | "identity";

// Phases drive interview ordering. Phase 0 = first-run setup (DA/Principal
// identity, voice, credentials, projects, work repo) — this is what makes
// Pulse work end-to-end on a fresh install. Phase 1 = foundational TELOS
// context (the core of the recurring interview). Phase 9 = deferred.
type Phase = 0 | 1 | 2 | 3 | 4 | 9;

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
  age_days: number | null;
  threshold_days: number;
  stale: boolean;
  why_incomplete: string[];
  prompts: string[];
};

// ─── Registry: what files are interview-targets, and their prompts ───
//
// PHASE ORDERING:
//   Phase 0 = First-run setup (DA/Principal identity, voice, credentials, projects, work repo)
//             — auto-skipped when every Phase 0 target is already populated
//   Phase 1 = Foundational TELOS context (the core of the recurring interview)
//   Phase 2 = Ideal State
//   Phase 3 = Preference sections (bands, movies, restaurants, etc.)
//   Phase 4 = Current State + identity
//   Phase 9 = Deferred

type RegistryTarget = Omit<Target, "content_length" | "tbd_count" | "seed_markers" | "empty_sections" | "required_fields_missing" | "completeness_score" | "priority" | "review_mode" | "age_days" | "threshold_days" | "stale" | "why_incomplete">;

const REGISTRY: RegistryTarget[] = [
  // ─── Phase 0: First-run setup (the bootstrap that makes Pulse work) ───
  { phase: 0, path: join(USER_DIR, "DA_IDENTITY.md"), name: "DA_IDENTITY", category: "setup", leverage: 10,
    prompts: ["What's your DA's name? (default: LifeOS)",
              "Full name and a one-line origin story?",
              "Display color in hex (e.g. #3B82F6)?",
              "One-paragraph personality summary — direct, peer, opinionated, etc.?"] },
  { phase: 0, path: join(USER_DIR, "PRINCIPAL_IDENTITY.md"), name: "PRINCIPAL_IDENTITY/setup", category: "setup", leverage: 10,
    prompts: ["Your name (with pronunciation if uncommon)?",
              "Location and timezone (e.g. San Francisco Bay Area, America/Los_Angeles)?",
              "One-line role / what you do?",
              "One-line focus — what you're working on right now?"] },
  { phase: 0, path: join(LIFEOS_DIR, "PULSE", "PULSE.toml"), name: "PULSE.toml/voice", category: "setup", leverage: 9,
    prompts: ["Main DA voice — pick from ElevenLabs library, or stick with default Rachel (21m00Tcm4TlvDq8ikWAM)?",
              "Algorithm voice (used for phase transitions) — default Adam (pNInz6obpgDQGcFmaJgB) is fine?",
              "Want voice notifications on by default? (default: yes)"] },
  { phase: 0, path: join(HOME, ".claude", ".env"), name: ".env/credentials", category: "setup", leverage: 10,
    prompts: ["ANTHROPIC_API_KEY — required for inference. Paste here (will write to .env, won't echo back)?",
              "ELEVENLABS_API_KEY — required for voice notifications. Skip if you don't want voice.",
              "GH_TOKEN — optional, only if you want the work pipeline. Skip if not using GitHub issues.",
              "Any other API keys you want stored (Stripe, OpenAI, etc.)?"] },
  { phase: 0, path: join(USER_DIR, "PROJECTS", "PROJECTS.md"), name: "PROJECTS/setup", category: "setup", leverage: 8,
    prompts: ["At least one project so routing works — name, local path, public URL (or blank), deploy command, stack?",
              "What aliases would you use to refer to it conversationally? (e.g. \"my blog\", \"the site\")"] },
  { phase: 0, path: join(USER_DIR, "WORK", "config.yaml"), name: "WORK/config", category: "setup", leverage: 7,
    prompts: ["WORK.REPO — GitHub repo (org/name) for issue-based work tracking? Skip + disable if you don't want GitHub-issue sync.",
              "If skipping: confirm we should set [work] enabled = false in PULSE.toml?"] },

  // ─── Phase 1: Foundational TELOS context ───
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Mission")}`, name: "Mission", category: "foundational", leverage: 10,
    prompts: ["What's your north-star mission — the single sentence that captures why you're building all of this?",
              "Any secondary missions that serve the north star but deserve their own articulation?",
              "What's the longest-horizon mission (decade+ timescale)?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Goals")}`, name: "Goals", category: "foundational", leverage: 10,
    prompts: ["Active goals for this year — G0 through G-whatever, each with a one-line outcome?",
              "Deferred or ongoing goals — things you're still tracking but not pushing on?",
              "Any goals in your head that aren't yet written down?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Problems")}`, name: "Problems", category: "foundational", leverage: 9,
    prompts: ["The big problems you're solving with your work — worldscale, not personal?",
              "Any problems you've identified but haven't committed a strategy to yet?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Strategies")}`, name: "Strategies", category: "foundational", leverage: 8,
    prompts: ["Active strategies — how are you attacking each problem?",
              "Strategies you've decided to NOT use (reverse strategies) worth documenting?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Challenges")}`, name: "Challenges", category: "foundational", leverage: 7,
    prompts: ["Personal challenges that get in the way — procrastination patterns, energy traps, known weaknesses?",
              "Challenges you're actively working to overcome vs. just tracking?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Narratives")}`, name: "Narratives", category: "foundational", leverage: 6,
    prompts: ["How do you describe your work to different audiences — one-liners per audience?",
              "The conference one-liner that captures your current pitch?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Beliefs")}`, name: "Beliefs", category: "foundational", leverage: 5,
    prompts: ["Core beliefs that shape how you work and decide?",
              "Any beliefs that have changed recently worth capturing?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Models")}`, name: "Models", category: "foundational", leverage: 4,
    prompts: ["Mental models you actively use — frameworks that shape how you see the world?",
              "Models you've retired or updated recently?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Frames")}`, name: "Frames", category: "foundational", leverage: 4,
    prompts: ["Useful ways of seeing the world — true-ish frames worth holding?",
              "Frames that conflict with each other but you hold both?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Traumas")}`, name: "Traumas", category: "foundational", leverage: 5,
    prompts: ["Which formative hard things still shape your defaults, reactions, or sense of what's possible?",
              "Any patterns that came from those experiences that {{DA_NAME}} should handle carefully?",
              "What has become strength, wisdom, or protection that is worth naming directly?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Wrong (Things I've been wrong about)")}`, name: "Wrong (Things I've been wrong about)", category: "foundational", leverage: 5,
    prompts: ["What have you been materially wrong about that changed how you make decisions?",
              "Any beliefs you still half-hold but suspect are obsolete?",
              "What would you want {{DA_NAME}} to challenge you on because history says you're biased there?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Wisdom")}`, name: "Wisdom", category: "foundational", leverage: 4,
    prompts: ["Hard-won insights from experience — things you want {{DA_NAME}} to remember permanently?",
              "Any recent lessons that haven't landed in WISDOM yet?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Predictions")}`, name: "Predictions", category: "foundational", leverage: 5,
    prompts: ["What current predictions deserve explicit dates, confidence levels, and falsification criteria?",
              "Any older predictions that should be reviewed against what actually happened?",
              "Where are you unusually confident compared with the consensus?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Ideas")}`, name: "Ideas", category: "foundational", leverage: 5,
    prompts: ["What ideas are recurring enough that they deserve permanent capture here?",
              "Which ideas are still raw but worth preserving before they disappear?",
              "Any idea that should be promoted into a goal, strategy, or essay?"] },
  { phase: 1, path: `${TELOS_PATH}#${sectionSlug("Sparks")}`, name: "Sparks", category: "foundational", leverage: 6,
    prompts: ["The creative sparks — music, fiction, languages, design — that you want to keep alive?",
              "Any sparks you'd forgotten about worth reviving?"] },

  // ─── Phase 2: Ideal State (single unified TELOS H2) ───
  { phase: 2, path: `${TELOS_PATH}#${sectionSlug("Ideal State")}`, name: "Ideal State", category: "ideal_state", leverage: 8,
    prompts: ["Weight and body-composition target?",
              "Sleep hours + efficiency target?",
              "Fitness targets — lifts, cardio, mobility?",
              "Monthly burn, runway, freedom, relationship, and creative-life targets that need refinement?"] },

  // ─── Phase 3: Preference sections ───
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("2036 — A Day in the Life with a Digital Assistant")}`, name: "2036 — A Day in the Life with a Digital Assistant", category: "preference", leverage: 5,
    prompts: ["What parts of the 2036 day still feel right as the target experience?",
              "What has changed in your vision of {{DA_NAME}}'s role by then?",
              "Any missing moments that would make the future day more concrete?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Books")}`, name: "Books", category: "preference", leverage: 5,
    prompts: ["The massive list — beyond the current 5, what books shaped you?",
              "Biographies, science, history, classics, business — categories to fill?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Authors")}`, name: "Authors", category: "preference", leverage: 5,
    prompts: ["Beyond the 7 already listed — what other authors do you track?",
              "Security / AI / tech writers whose new work you'd buy immediately?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Bands")}`, name: "Bands", category: "preference", leverage: 4,
    prompts: ["Beyond Tool, Meshuggah, Boris Brejcha — what other artists have shaped you?",
              "Artists you'd travel 100 miles for — tour-alert priority ones?",
              "Electronic / DJ / producer names you track?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Movies")}`, name: "Movies", category: "preference", leverage: 3,
    prompts: ["Sci-fi beyond Interstellar that shaped you?",
              "Crime / thrillers beyond Pulp Fiction and Snatch?",
              "Directors whose catalog you track?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Restaurants")}`, name: "Restaurants", category: "preference", leverage: 4,
    prompts: ["Favorites near home — your go-to list?",
              "Favorites in nearby metro — worth-the-drive places?",
              "Any restaurants on the blocklist (never recommend)?",
              "Special-occasion places?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Food")}`, name: "Food", category: "preference", leverage: 4,
    prompts: ["Top 3-5 cuisines you eat weekly happily?",
              "Cuisines avoided?",
              "Spice tolerance, dietary posture?",
              "Dishes you love to make? Dishes your partner makes you love?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Meetups")}`, name: "Meetups", category: "preference", leverage: 3,
    prompts: ["Beyond AI, security, founder meetups — any other topics?",
              "Preferred event size and price ceiling?",
              "Any specific groups you already like locally?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Civic")}`, name: "Civic", category: "preference", leverage: 2,
    prompts: ["Permit radius — 0.5 mile OK or wider?",
              "City council topics to always flag?",
              "State-level legislation topic areas?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Learning Interests")}`, name: "Learning Interests", category: "preference", leverage: 4,
    prompts: ["Beyond meditation / tennis / kickboxing — what else do you want to actively learn?",
              "Spanish refresh — active or dormant?",
              "Drums — lessons or self-taught?",
              "Dormant-but-interested topics?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Team")}`, name: "Team", category: "preference", leverage: 5,
    prompts: ["Who belongs in the human and agent team map now?",
              "Any responsibilities, trust boundaries, or operating roles that have changed?",
              "Which collaborators or agents should {{DA_NAME}} remember as first-class context?"] },
  { phase: 3, path: `${TELOS_PATH}#${sectionSlug("Context Filter")}`, name: "Context Filter", category: "preference", leverage: 5,
    prompts: ["What should {{DA_NAME}} bias toward when deciding what context matters?",
              "Any themes that should be deprioritized or ignored unless you ask directly?",
              "What framing should guide recommendations when priorities conflict?"] },

  // ─── Phase 4: Current-state snapshot + identity ───
  { phase: 4, path: join(USER_DIR, "PRINCIPAL_IDENTITY.md"), name: "PRINCIPAL_IDENTITY", category: "identity", leverage: 8,
    prompts: ["Anything in the identity file that's out-of-date or needs refinement?",
              "Aspects of how you want to be represented that aren't captured yet?"] },
  { phase: 4, path: `${TELOS_PATH}#${sectionSlug("Current State")}`, name: "Current State", category: "current_state", leverage: 5,
    prompts: ["Right now: focus, energy, mood, last meal, sleep?",
              "This week's top intent, stalled items, wins?"] },
  { phase: 4, path: `${TELOS_PATH}#${sectionSlug("Status — Current Work & Recent Accomplishments")}`, name: "Status — Current Work & Recent Accomplishments", category: "current_state", leverage: 5,
    prompts: ["What recent accomplishments should {{DA_NAME}} treat as current context?",
              "Which project statuses are outdated or missing?",
              "Any strategic insight from the last few weeks that belongs in the status section?"] },

  // Phase 9 is empty post-consolidation; RHYTHMS was archived into the unified TELOS history.
];

// ─── Scoring ───

const PLACEHOLDER_PATTERNS = [
  /\bTBD\b/g,
  /\bseed(ed)?\s+(during|through)\s+interview\b/gi,
  /\bseeded during interview\b/gi,
  /^\s*_\(.*(seeded|pending|empty|awaiting).*\)_\s*$/gim,
  /^\s*-\s*TBD\s*$/gim,
];

// Phase boost ensures setup-then-foundational ordering. Phase 0 (setup) at 100%
// drops to 0 boost so it disappears from the priority queue once configured;
// while incomplete it dominates. Phase 1 (TELOS) is the recurring core.
const PHASE_BOOST: Record<Phase, number> = { 0: 2000, 1: 1000, 2: 200, 3: 50, 4: 300, 9: 0 };

const TELOS_SECTION_PREFIX = `${TELOS_PATH}#`;
const TELOS_CONTENT = existsSync(TELOS_PATH) ? readFileSync(TELOS_PATH, "utf-8") : "";
const TELOS_SECTIONS = parseTelosSections(TELOS_CONTENT);
const freshness = readTelosFreshness();
const freshnessBySlug = new Map<string, SectionFreshness>(freshness.sections.map((sf) => [sf.slug, sf]));

function parseTelosSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const matches = [...content.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const heading = match[1].trim();
    const headingEnd = (match.index ?? 0) + match[0].length;
    const bodyStart = content.indexOf("\n", headingEnd);
    const nextStart = i + 1 < matches.length ? matches[i + 1].index ?? content.length : content.length;
    const body = content.slice(bodyStart === -1 ? headingEnd : bodyStart + 1, nextStart);
    sections.set(sectionSlug(heading), body);
  }
  return sections;
}

function extractSectionBody(target: RegistryTarget, sections: Map<string, string>): string | null {
  if (!target.path.startsWith(TELOS_SECTION_PREFIX)) return null;
  return sections.get(sectionSlug(target.name)) ?? null;
}

function freshnessForSection(target: RegistryTarget): SectionFreshness | null {
  if (!target.path.startsWith(TELOS_SECTION_PREFIX)) return null;
  return freshnessBySlug.get(sectionSlug(target.name)) ?? null;
}

function scoreFile(target: RegistryTarget): Target {
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
    age_days: null,
    threshold_days: 0,
    stale: false,
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

function scoreSection(target: RegistryTarget, sectionBody: string, sectionFreshness: SectionFreshness | null): Target {
  const result: Target = {
    ...target,
    content_length: sectionBody.length,
    tbd_count: 0,
    seed_markers: 0,
    empty_sections: 0,
    required_fields_missing: [],
    completeness_score: 0,
    priority: 0,
    review_mode: false,
    age_days: sectionFreshness?.ageDays ?? null,
    threshold_days: sectionFreshness?.thresholdDays ?? 0,
    stale: sectionFreshness?.stale ?? false,
    why_incomplete: [],
  };

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = sectionBody.match(pattern);
    if (!matches) continue;
    if (pattern.source.includes("TBD")) result.tbd_count += matches.length;
    else result.seed_markers += matches.length;
  }

  // Empty sections: a heading followed by whitespace or placeholder
  const sectionMatches = sectionBody.matchAll(/^#{3,4}\s+.+\n([\s\S]*?)(?=^#{3,4}|\Z)/gm);
  for (const m of sectionMatches) {
    const body = m[1].trim();
    const substantive = body
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/_\(.*?\)_/g, "")
      .replace(/\bTBD\b/g, "")
      .trim();
    if (substantive.length < 20) result.empty_sections += 1;
  }

  const substantiveSection = sectionBody
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/_\(.*?\)_/g, "")
    .replace(/\bTBD\b/g, "")
    .trim();
  if (substantiveSection.length < 20) result.empty_sections += 1;

  // Completeness heuristic: weight content length vs. placeholders
  const placeholderPenalty = result.tbd_count * 40 + result.seed_markers * 20 + result.empty_sections * 30;
  const contentBonus = Math.min(sectionBody.length / 10, 500);
  result.completeness_score = Math.max(0, Math.min(100, 100 - placeholderPenalty / 10 + contentBonus / 50));

  // Priority: phase (dominant) + leverage + incompleteness. Phase 1 always beats Phase 2.
  const incompleteness = 100 - result.completeness_score;
  // Stale sections get a large bump so overdue reviews naturally rise to the top.
  result.priority = Math.round(PHASE_BOOST[target.phase] + target.leverage * 2 + incompleteness + (result.stale ? 200 : 0));

  // Review mode vs. fill mode: ≥80% complete means we're reviewing, not filling.
  // Review prompts should be "here's what's there, anything to update/refine/add?"
  // Fill prompts should be "this is empty, let's populate it."
  result.review_mode = result.completeness_score >= 80;

  if (result.tbd_count > 0) result.why_incomplete.push(`${result.tbd_count} TBD markers`);
  if (result.seed_markers > 0) result.why_incomplete.push(`${result.seed_markers} "seed during interview" markers`);
  if (result.empty_sections > 0) result.why_incomplete.push(`${result.empty_sections} empty/sparse sections`);
  if (sectionBody.length < 500 && target.category !== "foundational") result.why_incomplete.push("sparse content");
  if (result.review_mode && result.why_incomplete.length === 0) result.why_incomplete.push("already substantive — review for updates/refinements");

  return result;
}

function scoreTarget(target: RegistryTarget): Target {
  const sectionBody = extractSectionBody(target, TELOS_SECTIONS);
  if (target.path.startsWith(TELOS_SECTION_PREFIX)) {
    if (sectionBody === null) {
      const sectionFreshness = freshnessForSection(target);
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
        age_days: sectionFreshness?.ageDays ?? null,
        threshold_days: sectionFreshness?.thresholdDays ?? 0,
        stale: sectionFreshness?.stale ?? false,
        why_incomplete: ["section does not exist"],
      };
      const incompleteness = 100 - result.completeness_score;
      // Stale sections get a large bump so overdue reviews naturally rise to the top.
      result.priority = Math.round(PHASE_BOOST[target.phase] + target.leverage * 2 + incompleteness + (result.stale ? 200 : 0));
      return result;
    }
    return scoreSection(target, sectionBody, freshnessForSection(target));
  }
  return scoreFile(target);
}

const PHASE_LABELS: Record<Phase, string> = {
  0: "PHASE 0 — Setup (DA / Principal / voice / credentials / projects / work repo)",
  1: "PHASE 1 — Foundational TELOS (the core — review first)",
  2: "PHASE 2 — Ideal State",
  3: "PHASE 3 — Preference sections",
  4: "PHASE 4 — Current state + identity",
  9: "PHASE 9 — Deferred",
};

// ─── Output formatters ───

function formatHuman(targets: Target[]): string {
  const overall = Math.round(targets.reduce((s, t) => s + t.completeness_score, 0) / targets.length);

  const lines: string[] = [];
  lines.push(`═══ LifeOS Interview Gap Report ═══`);
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
      const marker = t.stale ? "⚠" : t.completeness_score === 100 ? "✓" : t.completeness_score >= 80 ? "·" : "○";
      const base = `  ${marker} ${mode}  ${t.name.padEnd(48)}  ${t.completeness_score.toFixed(0).padStart(3)}%  (lev ${String(t.leverage).padStart(2)})`;
      if (t.threshold_days > 0) {
        const age = t.age_days === null ? "—" : `${t.age_days}d`;
        const stale = t.stale ? "STALE " : "";
        lines.push(`${base}  ${stale}${`${age}/${t.threshold_days}d`.padEnd(13)}  — ${t.why_incomplete.join(", ") || "—"}`);
      } else {
        lines.push(`${base}  — ${t.why_incomplete.join(", ") || "—"}`);
      }
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
    const scored = scoreTarget(match);
    console.log(JSON.stringify(scored, null, 2));
    return;
  }

  let scored = REGISTRY.map(scoreTarget);

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
