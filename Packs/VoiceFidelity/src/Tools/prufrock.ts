#!/usr/bin/env bun

/**
 * prufrock - Indexical Grounding Audit
 * "The Love Song of J. Alfred Prufrock"
 *
 * Detects linguistically fluent but experientially ungrounded AI output.
 * Checks 10 layers: formulaic integrity, regional markers, community-of-practice,
 * register fit, embodied detail, temporal integrity, provenance safety,
 * cross-layer consistency, narrative pressure, and stance authenticity.
 *
 * Usage:
 *   prufrock document.md                    Run full audit
 *   prufrock document.md --verbose          Show flagged lines
 *   prufrock document.md --json             Raw JSON output
 *   prufrock document.md --checklist-only   Just the manual checklist
 *   echo "text" | prufrock                  Audit stdin
 *
 * Exit codes: 0 = PASS (score >= 70), 1 = FAIL
 */

import { readFileSync, existsSync } from "fs";

// --- Config ---
const PASS_THRESHOLD = 70;

// --- Common English idioms (near-miss detection corpus) ---
const IDIOM_CORPUS: string[] = [
  "rock the boat",
  "bite the bullet",
  "break the ice",
  "burn the midnight oil",
  "cut to the chase",
  "hit the nail on the head",
  "kick the bucket",
  "let the cat out of the bag",
  "miss the boat",
  "piece of cake",
  "spill the beans",
  "steal someone's thunder",
  "take the bull by the horns",
  "the ball is in your court",
  "the best of both worlds",
  "throw in the towel",
  "under the weather",
  "when pigs fly",
  "a blessing in disguise",
  "a dime a dozen",
  "add insult to injury",
  "back to the drawing board",
  "barking up the wrong tree",
  "beat around the bush",
  "better late than never",
  "between a rock and a hard place",
  "blow off steam",
  "break a leg",
  "burning bridges",
  "by the skin of your teeth",
  "call it a day",
  "costs an arm and a leg",
  "cross that bridge when you come to it",
  "cry over spilled milk",
  "cut corners",
  "devil's advocate",
  "don't put all your eggs in one basket",
  "drastic times call for drastic measures",
  "easier said than done",
  "every cloud has a silver lining",
  "get out of hand",
  "get your act together",
  "give the benefit of the doubt",
  "go back to square one",
  "hang in there",
  "hit the ground running",
  "in the heat of the moment",
  "it takes two to tango",
  "jump on the bandwagon",
  "keep your chin up",
  "kill two birds with one stone",
  "last straw",
  "leave no stone unturned",
  "let sleeping dogs lie",
  "make a long story short",
  "miss the mark",
  "no pain no gain",
  "on the ball",
  "on the fence",
  "on thin ice",
  "once in a blue moon",
  "out of the frying pan into the fire",
  "pull someone's leg",
  "put the cart before the horse",
  "raining cats and dogs",
  "read between the lines",
  "see eye to eye",
  "sit on the fence",
  "speak of the devil",
  "take it with a grain of salt",
  "the elephant in the room",
  "the tip of the iceberg",
  "through thick and thin",
  "time flies",
  "turn a blind eye",
  "two peas in a pod",
  "up in the air",
  "water under the bridge",
  "wrap your head around",
  "you can't judge a book by its cover",
  "at the end of the day",
  "bottom line",
  "get the ball rolling",
  "give it a shot",
  "go the extra mile",
  "in a nutshell",
  "keep an eye on",
  "make ends meet",
  "move the needle",
  "not rocket science",
  "on the same page",
  "open a can of worms",
  "par for the course",
  "play it by ear",
  "pull your weight",
  "put your money where your mouth is",
  "raise the bar",
  "read the room",
  "run circles around",
  "scratch the surface",
  "shake things up",
  "shoot from the hip",
  "step up to the plate",
  "test the waters",
  "the whole nine yards",
  "think outside the box",
  "throw under the bus",
  "tip of the spear",
  "toe the line",
  "turn the tables",
  "walk the walk",
  "weather the storm",
  "worth its weight in gold",
  // Security/tech domain frozen expressions
  "attack surface",
  "defense in depth",
  "least privilege",
  "separation of duties",
  "chain of custody",
  "blast radius",
  "single point of failure",
  "defense in depth",
  "zero trust",
  "crown jewels",
  "low hanging fruit",
  "rubber stamp",
  "due diligence",
  "best practices",
  "lessons learned",
  "root cause",
  "post mortem",
  "runbook",
  "war room",
  "red team blue team",
  "table stakes",
  "move the goalposts",
  "boil the ocean",
  "drink from the firehose",
  "peel the onion",
  "swim lane",
  "ramp up",
  "circle back",
  "take offline",
  "put a pin in it",
  "close the loop",
  "net new",
  // Consulting/business frozen expressions
  "value proposition",
  "competitive advantage",
  "time to value",
  "proof of concept",
  "center of excellence",
  "managed services",
  "go to market",
  "land and expand",
];

// --- Commonly mangled idiom pairs (wrong -> right) ---
const KNOWN_MANGLES: Array<{ wrong: RegExp; right: string; explanation: string }> = [
  { wrong: /rock the ship/gi, right: "rock the boat", explanation: "Mixed metaphor: 'rock the boat' is the idiom" },
  { wrong: /nip it in the butt/gi, right: "nip it in the bud", explanation: "Eggcorn: 'bud' not 'butt'" },
  { wrong: /for all intensive purposes/gi, right: "for all intents and purposes", explanation: "Mondegreen: 'intents and purposes'" },
  { wrong: /could care less/gi, right: "couldn't care less", explanation: "Logic inversion: 'couldn't' means you care zero" },
  { wrong: /one in the same/gi, right: "one and the same", explanation: "Mishearing: 'and' not 'in'" },
  { wrong: /peaked my interest/gi, right: "piqued my interest", explanation: "'Piqued' means stimulated, not 'peaked'" },
  { wrong: /tow the line/gi, right: "toe the line", explanation: "'Toe' not 'tow' - standing at the line" },
  { wrong: /free reign/gi, right: "free rein", explanation: "'Rein' as in horse reins, not 'reign' as in rule" },
  { wrong: /deep-seeded/gi, right: "deep-seated", explanation: "'Seated' not 'seeded' - firmly established" },
  { wrong: /wet your appetite/gi, right: "whet your appetite", explanation: "'Whet' means to sharpen/stimulate" },
  { wrong: /bated breathe?/gi, right: "bated breath", explanation: "'Bated' is shortened from 'abated'" },
  { wrong: /wreck havoc/gi, right: "wreak havoc", explanation: "'Wreak' means to cause, not 'wreck'" },
  { wrong: /beckon call/gi, right: "beck and call", explanation: "'Beck' is a gesture, 'beckon call' is a mashup" },
  { wrong: /mute point/gi, right: "moot point", explanation: "'Moot' means debatable, not 'mute'" },
  { wrong: /case and point/gi, right: "case in point", explanation: "'In' not 'and'" },
  { wrong: /hone in on/gi, right: "home in on", explanation: "'Home in' like a homing device, not 'hone' (sharpen)" },
  { wrong: /sneak peak/gi, right: "sneak peek", explanation: "'Peek' (look) not 'peak' (summit)" },
  { wrong: /baited breath/gi, right: "bated breath", explanation: "'Bated' from 'abated', not 'baited'" },
  { wrong: /escape goat/gi, right: "scapegoat", explanation: "Not 'escape goat' - scapegoat is one word" },
  { wrong: /statue of limitations/gi, right: "statute of limitations", explanation: "'Statute' (law) not 'statue'" },
  { wrong: /doggy dog world/gi, right: "dog-eat-dog world", explanation: "Not 'doggy dog' - it's competitive/ruthless" },
  { wrong: /taken for granite/gi, right: "taken for granted", explanation: "'Granted' not 'granite'" },
  { wrong: /hunger pains/gi, right: "hunger pangs", explanation: "'Pangs' are sharp sensations" },
  { wrong: /old wise tale/gi, right: "old wives' tale", explanation: "'Wives' tale' - folklore from older women" },
  { wrong: /curve your enthusiasm/gi, right: "curb your enthusiasm", explanation: "'Curb' means to restrain" },
];

// --- Rob's regional/cultural markers (Wisconsin/Midwest) ---
const REGIONAL_MARKERS = {
  positive: [
    // Wisconsin/Midwest markers Rob uses naturally
    { marker: "pop", context: "carbonated beverage (not 'soda')", weight: 3 },
    { marker: "bubbler", context: "drinking fountain", weight: 5 },
    { marker: "ope", context: "Midwest interjection", weight: 3 },
    { marker: "you betcha", context: "Midwest affirmation", weight: 2 },
    { marker: "come to find out", context: "Midwest narrative phrase", weight: 2 },
    { marker: "real quick", context: "Midwest pacing phrase", weight: 1 },
    // Professional tribe markers
    { marker: "shell", context: "command shell / reverse shell (security)", weight: 2 },
    { marker: "box", context: "server/machine (security slang)", weight: 2 },
    { marker: "popped", context: "compromised a system (pentesting)", weight: 3 },
    { marker: "pivot", context: "lateral movement in pentesting", weight: 2 },
    { marker: "phish", context: "social engineering (not 'fish')", weight: 2 },
    { marker: "domain admin", context: "AD privilege (security)", weight: 2 },
    { marker: "lateral movement", context: "moving between systems post-compromise", weight: 2 },
    { marker: "TTPs", context: "tactics, techniques, and procedures", weight: 2 },
  ],
  antiMarkers: [
    // Markers that signal wrong region or no region
    { marker: "soda", context: "Rob says 'pop', not 'soda'", weight: -3 },
    { marker: "drinking fountain", context: "Rob says 'bubbler'", weight: -2 },
    { marker: "y'all", context: "Southern, not Midwest", weight: -2 },
    { marker: "wicked", context: "New England intensifier, not Midwest", weight: -2 },
    { marker: "hella", context: "NorCal slang, not Midwest", weight: -2 },
  ]
};

// --- Cliche embodied-detail phrases (placeholders for real experience) ---
const EMBODIED_CLICHES = [
  "adrenaline pumping",
  "adrenaline rush",
  "heart racing",
  "heart pounding",
  "heart sank",
  "pit in my stomach",
  "pit of my stomach",
  "knot in my stomach",
  "butterflies in my stomach",
  "blood ran cold",
  "blood boiling",
  "broke out in a cold sweat",
  "cold sweat",
  "shivers down my spine",
  "chill down my spine",
  "jaw dropped",
  "jaw on the floor",
  "eyes widened",
  "the room went silent",
  "the room fell silent",
  "deafening silence",
  "time stood still",
  "time seemed to stop",
  "everything clicked",
  "it all clicked",
  "lightbulb moment",
  "light at the end of the tunnel",
  "weight off my shoulders",
  "weight of the world",
  "game changer",
  "game-changer",
  "changed the game",
  "paradigm shift",
  "wake-up call",
  "turning point",
  "defining moment",
  "eye-opening experience",
  "roller coaster of emotions",
  "emotional roller coaster",
  "on cloud nine",
  "over the moon",
  "hit me like a ton of bricks",
  "hit different",
  "the penny dropped",
  "fell into place",
  "everything fell into place",
];

// --- Temporal vagueness markers ---
const TEMPORAL_VAGUE = [
  { pattern: /\b(a few|several|some) (weeks?|months?|years?) (ago|later|in)\b/gi, issue: "Vague timeframe - can you be specific?" },
  { pattern: /\b(recently|lately|not long ago|the other day)\b/gi, issue: "Vague temporal reference" },
  { pattern: /\b(soon|shortly|in due time|before long|in the near future)\b/gi, issue: "Vague future reference" },
  { pattern: /\bafter (a while|some time|a period)\b/gi, issue: "Vague duration" },
  { pattern: /\b(I|we) (quickly|immediately|instantly) (realized|understood|knew|saw)\b/gi, issue: "Narrative compression - real insight is rarely instant" },
  { pattern: /\b(it became clear|it dawned on me|I came to realize)\b/gi, issue: "Smoothed epiphany - how did it actually happen?" },
];

// --- Register inconsistency markers ---
const REGISTER_FORMAL = [
  "furthermore", "moreover", "additionally", "consequently", "nevertheless",
  "notwithstanding", "heretofore", "henceforth", "whereby", "wherein",
  "therein", "thereof", "pursuant to", "in accordance with", "with respect to",
  "it should be noted", "it is imperative", "of paramount importance",
];

const REGISTER_CASUAL = [
  "gonna", "wanna", "gotta", "kinda", "sorta", "ain't", "dunno",
  "nah", "yep", "nope", "dude", "bro", "lol", "omg", "tbh", "imo",
  "legit", "lowkey", "highkey", "vibe", "vibes", "lit", "slay",
  "no cap", "fr fr", "bet",
];

// --- Parse args ---
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOutput = args.includes("--json");
const checklistOnly = args.includes("--checklist-only");
const filePath = args.find(a => !a.startsWith("--"));

// --- Get text ---
async function getText(): Promise<string> {
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, "utf-8");
  }

  const stdin = process.stdin;
  if (stdin.isTTY) {
    console.error(`
  prufrock - Indexical Grounding Audit
  "Do I dare to eat a peach?"

  Usage:
    prufrock <file>                    Run full audit
    prufrock <file> --verbose          Show flagged lines
    prufrock <file> --json             Raw JSON output
    prufrock <file> --checklist-only   Just the manual checklist
    echo "text" | prufrock             Audit stdin
    `);
    process.exit(0);
  }

  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    stdin.on("data", (chunk) => chunks.push(chunk));
    stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

// --- Strip markdown ---
function stripMarkdown(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\n*/m, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\|.*\|/g, "")
    .replace(/[-|:]+\s*[-|:]+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/>\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10 && /[.!?]$/.test(s));
}

// --- Check results ---
interface CheckResult {
  layer: number;
  name: string;
  automated: boolean;
  weight: number;
  score: number;
  flags: string[];
  severity: string;
}

// --- Layer 1: Formulaic Integrity ---
function checkFormulaic(text: string): CheckResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  // Check known mangles
  for (const m of KNOWN_MANGLES) {
    const matches = text.match(m.wrong);
    if (matches) {
      flags.push(`MANGLED: "${matches[0]}" should be "${m.right}" - ${m.explanation}`);
    }
  }

  // Fuzzy check: look for partial idiom matches that might be near-misses
  // Only check idioms with 4+ words to reduce false positives
  const words = lower.split(/\s+/);
  for (const idiom of IDIOM_CORPUS) {
    const idiomWords = idiom.split(" ");
    if (idiomWords.length < 4) continue;

    // Key words = content words 4+ chars
    const keyWords = idiomWords.filter(w => w.length > 3);
    if (keyWords.length < 3) continue;

    // Check if the exact idiom (or conjugated form) is present - if so, skip
    // Allow for verb conjugation: stem-match each key word
    const stems = keyWords.map(w => w.replace(/(ing|ed|s|er|est)$/i, ""));
    const idiomPresent = stems.every(stem => lower.includes(stem));

    // Only flag if ALL key word stems are present but the exact idiom phrase isn't
    // AND at least one key word appears in a different order or combination
    if (!idiomPresent) continue;
    if (lower.includes(idiom)) continue;

    // Check that the key words cluster within a narrow window (suggesting mangling)
    const positions = stems.map(stem => lower.indexOf(stem));
    const spread = Math.max(...positions) - Math.min(...positions);
    if (spread < 60) {
      const contextStart = Math.max(0, Math.min(...positions) - 10);
      const context = text.substring(contextStart, contextStart + 60).trim();
      flags.push(`NEAR-MISS: Found "${context}..." - possible mangled "${idiom}"`);
    }
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 30);
  return { layer: 1, name: "Formulaic Integrity", automated: true, weight: 15, score, flags, severity: "HIGH" };
}

// --- Layer 2: Regional/Identity Grounding ---
function checkRegional(text: string): CheckResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];
  let markerScore = 0;

  // Check for positive regional markers
  let positiveFound = 0;
  for (const m of REGIONAL_MARKERS.positive) {
    if (lower.includes(m.marker.toLowerCase())) {
      positiveFound++;
      markerScore += m.weight;
    }
  }

  // Check for anti-markers (wrong region)
  for (const m of REGIONAL_MARKERS.antiMarkers) {
    if (lower.includes(m.marker.toLowerCase())) {
      flags.push(`WRONG REGION: "${m.marker}" - ${m.context}`);
      markerScore += m.weight; // negative weight
    }
  }

  // Check for total absence of any grounding markers
  const sentences = extractSentences(text);
  if (sentences.length > 10 && positiveFound === 0 && flags.length === 0) {
    flags.push("NO REGION: Text has no regional, professional, or cultural markers. Could be written from anywhere.");
  }

  // Score: presence of correct markers = good, wrong markers = bad, no markers = medium-bad
  let score: number;
  if (flags.length > 0 && flags.some(f => f.startsWith("WRONG"))) {
    score = Math.max(0, 30 + markerScore * 5);
  } else if (flags.length > 0) {
    score = 50; // No markers at all
  } else {
    score = Math.min(100, 70 + markerScore * 5);
  }

  return { layer: 2, name: "Regional Grounding", automated: true, weight: 12, score, flags, severity: "HIGH" };
}

// --- Layer 4: Register Consistency ---
function checkRegister(text: string): CheckResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  let formalCount = 0;
  let casualCount = 0;
  const formalFound: string[] = [];
  const casualFound: string[] = [];

  for (const word of REGISTER_FORMAL) {
    if (lower.includes(word)) { formalCount++; formalFound.push(word); }
  }
  for (const word of REGISTER_CASUAL) {
    if (lower.includes(word)) { casualCount++; casualFound.push(word); }
  }

  // Flag register collision
  if (formalCount > 0 && casualCount > 0) {
    flags.push(`REGISTER COLLISION: Formal (${formalFound.slice(0, 3).join(", ")}) mixed with casual (${casualFound.slice(0, 3).join(", ")})`);
  }

  // Flag over-formalization (AI default)
  if (formalCount >= 3) {
    flags.push(`OVER-FORMAL: ${formalCount} formal register markers found (${formalFound.slice(0, 4).join(", ")})`);
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 25);
  return { layer: 4, name: "Register Fit", automated: true, weight: 10, score, flags, severity: "MEDIUM-HIGH" };
}

// --- Layer 5: Embodied Detail Authenticity ---
function checkEmbodied(text: string): CheckResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];

  for (const cliche of EMBODIED_CLICHES) {
    if (lower.includes(cliche.toLowerCase())) {
      flags.push(`CLICHE DETAIL: "${cliche}" - generic placeholder, not lived experience`);
    }
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 15);
  return { layer: 5, name: "Embodied Detail", automated: true, weight: 8, score, flags, severity: "MEDIUM" };
}

// --- Layer 6: Temporal Integrity ---
function checkTemporal(text: string): CheckResult {
  const flags: string[] = [];

  for (const t of TEMPORAL_VAGUE) {
    const matches = text.match(t.pattern);
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        flags.push(`TEMPORAL: "${match}" - ${t.issue}`);
      }
    }
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 10);
  return { layer: 6, name: "Temporal Integrity", automated: true, weight: 8, score, flags, severity: "MEDIUM" };
}

// --- Layers 3, 7, 8, 9, 10: Manual Checklist ---
function getManualChecklist(): CheckResult[] {
  return [
    {
      layer: 3, name: "Community-of-Practice", automated: false, weight: 12, score: -1,
      flags: [
        "Would an insider say it THIS way?",
        "Is it explaining things insiders don't explain?",
        "Is the shorthand right, or is it outsider phrasing?",
      ],
      severity: "HIGH"
    },
    {
      layer: 7, name: "Provenance Safety", automated: false, weight: 12, score: -1,
      flags: [
        "Where did each piece of information come from?",
        "Is anything from a confidential call or private context?",
        "Should this audience have access to this?",
        "Would the CEO approve this representing the company?",
      ],
      severity: "CRITICAL"
    },
    {
      layer: 8, name: "Cross-Layer Consistency", automated: false, weight: 10, score: -1,
      flags: [
        "Does this sound like one coherent person?",
        "Do regional + professional + generational signals align?",
        "Any mixed identities or inconsistent voice?",
      ],
      severity: "HIGH"
    },
    {
      layer: 9, name: "Narrative vs Truth", automated: false, weight: 10, score: -1,
      flags: [
        "Does this feel too clean? Real stories are messy.",
        "Were facts verified or inferred?",
        "Did narrative coherence override accuracy?",
        "Are timelines exact or story-shaped?",
      ],
      severity: "HIGH"
    },
    {
      layer: 10, name: "Stance Authenticity", automated: false, weight: 8, score: -1,
      flags: [
        "Does the emotional stance feel real?",
        "Has irritation been sanitized into polished concern?",
        "Has uncertainty been smoothed into tidy confidence?",
        "Does this feel like a person taking a real position?",
      ],
      severity: "MEDIUM"
    },
  ];
}

// --- Scoring ---
function computeScore(results: CheckResult[]): { automated: number; pass: boolean } {
  const automatedResults = results.filter(r => r.automated);
  const totalWeight = automatedResults.reduce((sum, r) => sum + r.weight, 0);
  const weightedScore = automatedResults.reduce((sum, r) => sum + (r.score * r.weight / 100), 0);
  const finalScore = Math.round((weightedScore / totalWeight) * 100);
  return { automated: finalScore, pass: finalScore >= PASS_THRESHOLD };
}

// --- Main ---
async function main() {
  const rawText = await getText();
  if (!rawText.trim()) {
    console.error("  No text provided.");
    process.exit(1);
  }

  const text = stripMarkdown(rawText);

  // Run automated checks
  const automated: CheckResult[] = [
    checkFormulaic(text),
    checkRegional(text),
    checkRegister(text),
    checkEmbodied(text),
    checkTemporal(text),
  ];

  const manual = getManualChecklist();
  const allResults = [...automated, ...manual].sort((a, b) => a.layer - b.layer);
  const { automated: autoScore, pass } = computeScore(automated);

  if (jsonOutput) {
    console.log(JSON.stringify({ score: autoScore, pass, layers: allResults }, null, 2));
    process.exit(pass ? 0 : 1);
  }

  if (checklistOnly) {
    console.log();
    console.log("  PRUFROCK - Indexical Grounding Checklist");
    console.log("  ========================================");
    console.log();
    for (const r of allResults) {
      const status = r.automated ? (r.score >= 80 ? "[PASS]" : r.score >= 50 ? "[WARN]" : "[FAIL]") : "[MANUAL]";
      console.log(`  Layer ${r.layer}: ${r.name} ${status}`);
      for (const f of r.flags) {
        const prefix = r.automated ? "    !" : "    ?";
        console.log(`${prefix} ${f}`);
      }
      console.log();
    }
    console.log("  3+ manual flags = rewrite before publishing");
    console.log();
    process.exit(0);
  }

  // Full output
  const icon = pass ? "PASS" : "FAIL";
  const statusIcon = pass ? "+" : "x";

  console.log();
  console.log(`  PRUFROCK - Indexical Grounding Audit`);
  console.log(`  "Do I dare to eat a peach?"`);
  console.log(`  ====================================`);
  console.log();
  console.log(`  [${statusIcon}] AUTOMATED SCORE: ${autoScore}/100 (${icon})`);
  console.log(`  Threshold: ${PASS_THRESHOLD}/100`);
  console.log();

  // Automated layers
  console.log("  --- Automated Layers ---");
  console.log();
  for (const r of automated) {
    const checkIcon = r.score >= 80 ? "+" : r.score >= 50 ? "~" : "x";
    console.log(`  [${checkIcon}] L${r.layer} ${r.name.padEnd(22)} ${String(r.score).padStart(3)}/100  [${r.severity}]`);

    if (verbose && r.flags.length > 0) {
      for (const f of r.flags.slice(0, 5)) {
        console.log(`        ${f}`);
      }
      if (r.flags.length > 5) {
        console.log(`        ... and ${r.flags.length - 5} more`);
      }
    } else if (r.flags.length > 0 && r.score < 80) {
      console.log(`        ${r.flags[0]}`);
    }
  }

  // Manual checklist
  console.log();
  console.log("  --- Manual Review Required ---");
  console.log();
  for (const r of manual) {
    console.log(`  [?] L${r.layer} ${r.name.padEnd(22)}          [${r.severity}]`);
    for (const f of r.flags) {
      console.log(`        ${f}`);
    }
  }

  console.log();
  console.log("  --- Red Team Quick Check ---");
  console.log();
  console.log("  Before publishing, answer these 10 questions:");
  console.log("   1. Any phrase feel 'almost right'?");
  console.log("   2. Could this be written from anywhere?");
  console.log("   3. Would an insider say it this way?");
  console.log("   4. Is the tone matched to the context?");
  console.log("   5. Are details specific or generic?");
  console.log("   6. Are timelines exact or story-shaped?");
  console.log("   7. Is any info not meant for this audience?");
  console.log("   8. Does this sound like one real person?");
  console.log("   9. Did narrative override fact?");
  console.log("  10. Does this feel emotionally real?");
  console.log();
  console.log("  3+ yes = rewrite.");
  console.log();

  if (filePath) console.log(`  File: ${filePath}`);
  console.log();

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("  Error:", err.message);
  process.exit(1);
});
