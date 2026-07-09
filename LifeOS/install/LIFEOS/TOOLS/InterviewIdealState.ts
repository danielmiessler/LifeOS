#!/usr/bin/env bun

/**
 * InterviewIdealState — agenda tracker for seeding IDEAL_STATE + preference files.
 *
 * Not an interactive interviewer — {{DA_NAME}} does the interviewing in chat. This tool
 * organizes the agenda: what's still TBD across all files, in what order, and
 * tracks progress so {{PRINCIPAL_NAME}} can do the interview in one 90-min block OR three
 * 30-min bursts (Decision #4).
 *
 * Usage:
 *   bun InterviewIdealState.ts --next         Show next dimension to interview
 *   bun InterviewIdealState.ts --status       Progress report across all files
 *   bun InterviewIdealState.ts --dimension X  Show TBD markers for dimension X
 *   bun InterviewIdealState.ts --mark-done X  Mark dimension X complete
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// Normalize env path vars that Claude Code injects without shell expansion (LifeOS#1404)
for (const k of ["LIFEOS_DIR", "LIFEOS_CONFIG_DIR", "PROJECTS_DIR"]) {
  const v = process.env[k];
  if (v && /^\$\{?HOME\}?(\/|$)/.test(v)) process.env[k] = v.replace(/^\$\{?HOME\}?/, process.env.HOME ?? "~");
}


const HOME = process.env.HOME || "";
const LIFEOS_DIR = process.env.LIFEOS_DIR || join(HOME, ".claude", "LIFEOS");
const TELOS_DIR = join(LIFEOS_DIR, "USER", "TELOS");
const IDEAL_DIR = join(TELOS_DIR, "IDEAL_STATE");
const STATE_FILE = join(LIFEOS_DIR, "USER", "TELOS", "CURRENT_STATE", "interview-state.json");

type InterviewState = {
  started: string;
  last_session: string;
  dimensions: Record<string, { status: "pending" | "partial" | "done"; completed_at?: string }>;
  preference_files: Record<string, { status: "pending" | "partial" | "done"; completed_at?: string }>;
};

const DIMENSIONS = ["HEALTH", "RELATIONSHIPS", "MONEY", "FREEDOM", "CREATIVE", "RHYTHMS"];
const PREFERENCE_FILES = [
  "BANDS",
  "MOVIES",
  "BOOKS",
  "AUTHORS",
  "RESTAURANTS",
  "FOOD_PREFERENCES",
  "LEARNING",
  "MEETUPS",
  "CIVIC",
];

const DIMENSION_PROMPTS: Record<string, string[]> = {
  HEALTH: [
    "What weight or body-composition target captures where you want to be?",
    "What sleep hours and efficiency target?",
    "What fitness cadence and targets — lifts, cardio, mobility?",
    "Which bloodwork biomarkers do you actively track, and what are the targets?",
    "Anything health-related that's north-star only (aspirational, not scored)?",
  ],
  RELATIONSHIPS: [
    "What does an ideal week with your partner look like — anchors, rituals, protected time?",
    "Family contact cadence — daughters, siblings, parents: ideal shape?",
    "Tier-A friends (weekly contact): who are the 5-10 names?",
    "Tier-B (monthly): who?",
    "Tier-C (quarterly): who?",
  ],
  MONEY: [
    "Monthly burn ceiling target?",
    "Emergency runway target in months?",
    "Revenue diversification target — how many streams each contributing ≥20%?",
    "Savings rate target?",
    "Investment allocation posture?",
    "Any financial north-stars (FI number, generational wealth intent)?",
  ],
  FREEDOM: [
    "Max meetings per day before the day feels hijacked?",
    "Deep-work % of workday you want to protect?",
    "Meeting-free days per week target?",
    "Travel days per quarter — max and ideal?",
    "What permissions should you never have to ask for (schedule autonomy rules)?",
  ],
  CREATIVE: [
    "What does an active music-life look like in a month — not scored, just described?",
    "What does active fiction work look like?",
    "Spanish — active maintenance or dormant-for-now?",
    "Visual design / typography — where does it show up in an active month?",
    "Teaching / explaining — desired cadence?",
  ],
  RHYTHMS: [
    "Wake time. Coffee ritual shape. Morning review timing.",
    "Deep-work block 1 — when, how long, protected how?",
    "Break / walk — when, with what?",
    "Creative block — when, which spark modality on which day?",
    "Family / your partner protected time — when?",
    "Wind-down and day-close — when, what shape?",
    "Weekly shape: Monday through Sunday — any day-of-week anchors?",
    "Yearly anchors: conferences, retreats, family travel, off-grid time?",
  ],
};

const PREFERENCE_PROMPTS: Record<string, string[]> = {
  BANDS: [
    "Beyond Tool, Meshuggah, Boris Brejcha — what other artists have shaped you?",
    "Any artists you'd travel for — the 5-10 you'd drive 100 miles to see?",
    "Electronic subgenres or individual DJs you track?",
    "Progressive metal, classic metal — who's in there?",
    "Any artists where you want FULL tour-alert coverage vs. just local?",
  ],
  MOVIES: [
    "Sci-fi that shaped your worldview — beyond Interstellar?",
    "Crime / thrillers you love — beyond Pulp Fiction, Snatch?",
    "Fantasy / epics?",
    "Directors whose full catalog you'd see — beyond Nolan, Tarantino, Ritchie?",
    "Movies you re-watch? Comfort films?",
  ],
  BOOKS: [
    "Beyond the current 5 — what other books shaped you? Aim for the massive list.",
    "Biographies — who did you read that changed your thinking?",
    "Sci-fi canon — Banks, Herbert, Stephenson are in AUTHORS.md. What specific works?",
    "History / politics?",
    "Business / strategy?",
    "Classics — Marcus Aurelius? Epictetus? Seneca?",
  ],
  AUTHORS: [
    "Beyond Frankl, Brooks, Deutsch, Rothfuss, Herbert, Stephenson, Banks — who else?",
    "Security thinkers — Schneier? Krebs? Others worth tour-alerts?",
    "AI / tech writers you track?",
    "Historians whose books you read?",
    "Anyone whose EVERY new book you'd buy immediately?",
  ],
  RESTAURANTS: [
    "Favorites near home — your go-to's?",
    "Favorites in nearby metro — places worth the drive?",
    "Any cuisine-specific bests — best sushi, best pho, best pizza?",
    "Special-occasion restaurants?",
    "Places you've tried and DON'T want recommended again? (blocklist)",
  ],
  FOOD_PREFERENCES: [
    "Top 3-5 cuisines you'd eat weekly happily?",
    "Cuisines you avoid or don't reach for?",
    "Spice tolerance, sweet tolerance?",
    "Dietary posture — any restrictions, allergies, avoidances?",
    "Dishes you love to make? Dishes your partner makes that you love?",
  ],
  LEARNING: [
    "Beyond meditation, tennis, kickboxing — what else do you want to actively learn?",
    "Spanish refresh — active, dormant, or south-of-border-only?",
    "Drums — lessons or self-taught?",
    "Any cooking / photography / investing / chess interests?",
    "Dormant-but-interested topics to revisit later?",
  ],
  MEETUPS: [
    "Beyond AI, security, founder meetups — any other topic areas?",
    "Preferred size — small (≤30) or larger (100+)?",
    "Max price threshold?",
    "Any specific meetup groups you already like in SF/South Bay?",
  ],
  CIVIC: [
    "Building permit radius — 0.5 mile OK, or wider?",
    "City council topics to always flag — development, regulation, budget, what else?",
    "State-level legislation — which topic areas (AI, privacy, security)?",
    "Any specific streets or intersections you want active road-work alerts for?",
  ],
};

function loadState(): InterviewState {
  if (!existsSync(STATE_FILE)) {
    const fresh: InterviewState = {
      started: new Date().toISOString(),
      last_session: new Date().toISOString(),
      dimensions: Object.fromEntries(DIMENSIONS.map((d) => [d, { status: "pending" }])),
      preference_files: Object.fromEntries(PREFERENCE_FILES.map((f) => [f, { status: "pending" }])),
    };
    writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as InterviewState;
}

function saveState(state: InterviewState): void {
  state.last_session = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function countTbd(file: string): number {
  if (!existsSync(file)) return 0;
  const content = readFileSync(file, "utf-8");
  return (content.match(/\bTBD\b/g) || []).length;
}

function showNext(state: InterviewState): void {
  const pendingDims = DIMENSIONS.filter((d) => state.dimensions[d].status !== "done");
  const pendingPrefs = PREFERENCE_FILES.filter((f) => state.preference_files[f].status !== "done");

  if (pendingDims.length === 0 && pendingPrefs.length === 0) {
    console.log("✅ All interviews complete.");
    return;
  }

  // Order: RHYTHMS first (informs FREEDOM), then HEALTH/MONEY/FREEDOM, then
  // RELATIONSHIPS/CREATIVE (narrative, easier). Then preferences.
  const DIM_ORDER = ["RHYTHMS", "HEALTH", "MONEY", "FREEDOM", "RELATIONSHIPS", "CREATIVE"];
  const next = DIM_ORDER.find((d) => pendingDims.includes(d));

  if (next) {
    const tbdCount = countTbd(join(IDEAL_DIR, `${next}.md`));
    console.log(`📋 NEXT: IDEAL_STATE/${next}.md  (${tbdCount} TBD markers)\n`);
    console.log(`Questions for {{DA_NAME}} to ask:`);
    DIMENSION_PROMPTS[next]?.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    console.log(`\nWhen done, mark: bun InterviewIdealState.ts --mark-done ${next}`);
    return;
  }

  const nextPref = pendingPrefs[0];
  const tbdCount = countTbd(join(TELOS_DIR, `${nextPref}.md`));
  console.log(`📋 NEXT (preference file): ${nextPref}.md  (${tbdCount} TBD markers)\n`);
  console.log(`Questions for {{DA_NAME}} to ask:`);
  PREFERENCE_PROMPTS[nextPref]?.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  console.log(`\nWhen done, mark: bun InterviewIdealState.ts --mark-done ${nextPref}`);
}

function showStatus(state: InterviewState): void {
  console.log("═══ Interview Progress ═══\n");
  console.log("IDEAL_STATE dimensions:");
  for (const d of DIMENSIONS) {
    const tbd = countTbd(join(IDEAL_DIR, `${d}.md`));
    const mark = state.dimensions[d].status === "done" ? "✅" : tbd === 0 ? "🟡" : "⬜";
    console.log(`  ${mark} ${d.padEnd(16)}  ${tbd} TBD remaining`);
  }
  console.log("\nPreference files:");
  for (const f of PREFERENCE_FILES) {
    const tbd = countTbd(join(TELOS_DIR, `${f}.md`));
    const mark = state.preference_files[f].status === "done" ? "✅" : tbd === 0 ? "🟡" : "⬜";
    console.log(`  ${mark} ${f.padEnd(20)}  ${tbd} TBD remaining`);
  }
  const dimDone = Object.values(state.dimensions).filter((d) => d.status === "done").length;
  const prefDone = Object.values(state.preference_files).filter((f) => f.status === "done").length;
  console.log(`\nDimensions: ${dimDone}/${DIMENSIONS.length}   Preferences: ${prefDone}/${PREFERENCE_FILES.length}`);
  console.log(`Last session: ${state.last_session}`);
}

function showDimension(name: string): void {
  const upper = name.toUpperCase();
  const isDimension = DIMENSIONS.includes(upper);
  const isPref = PREFERENCE_FILES.includes(upper);
  if (!isDimension && !isPref) {
    console.error(`Unknown dimension: ${name}`);
    process.exit(1);
  }
  const path = isDimension ? join(IDEAL_DIR, `${upper}.md`) : join(TELOS_DIR, `${upper}.md`);
  const prompts = isDimension ? DIMENSION_PROMPTS[upper] : PREFERENCE_PROMPTS[upper];
  const tbd = countTbd(path);
  console.log(`📋 ${upper}  —  ${tbd} TBD markers  —  ${path}\n`);
  console.log(`Questions:`);
  prompts?.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
}

function markDone(state: InterviewState, name: string): void {
  const upper = name.toUpperCase();
  if (DIMENSIONS.includes(upper)) {
    state.dimensions[upper] = { status: "done", completed_at: new Date().toISOString() };
  } else if (PREFERENCE_FILES.includes(upper)) {
    state.preference_files[upper] = { status: "done", completed_at: new Date().toISOString() };
  } else {
    console.error(`Unknown name: ${name}`);
    process.exit(1);
  }
  saveState(state);
  console.log(`✅ Marked ${upper} complete.`);
}

// ─── Main ───

const args = process.argv.slice(2);
const state = loadState();

if (args.includes("--next")) {
  showNext(state);
} else if (args.includes("--status")) {
  showStatus(state);
} else if (args.includes("--dimension")) {
  const idx = args.indexOf("--dimension");
  showDimension(args[idx + 1]);
} else if (args.includes("--mark-done")) {
  const idx = args.indexOf("--mark-done");
  markDone(state, args[idx + 1]);
} else {
  console.log("Usage:");
  console.log("  bun InterviewIdealState.ts --next");
  console.log("  bun InterviewIdealState.ts --status");
  console.log("  bun InterviewIdealState.ts --dimension HEALTH");
  console.log("  bun InterviewIdealState.ts --mark-done HEALTH");
}
