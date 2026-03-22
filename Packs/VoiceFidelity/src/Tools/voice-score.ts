#!/usr/bin/env bun

/**
 * voice-score — Score a document against a voice profile
 *
 * Usage:
 *   voice-score document.md                              Score against default profile
 *   voice-score document.md --profile custom.json        Score against custom profile
 *   voice-score document.md --verbose                    Show flagged lines
 *   voice-score document.md --json                       Raw JSON output
 *   voice-score document.md --fix                        Show specific fixes
 *   echo "text" | voice-score                            Score stdin
 *
 * Exit codes: 0 = PASS (score >= 70), 1 = FAIL
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// --- Defaults ---
const DEFAULT_PROFILE = join(process.env.PAI_DIR || "/root/.claude", "tools", "rob-voice-profile.json");
const PASS_THRESHOLD = 70;

// --- Parse args ---
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOutput = args.includes("--json");
const fixMode = args.includes("--fix");
const profilePath = (() => {
  const idx = args.indexOf("--profile");
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : DEFAULT_PROFILE;
})();
const filePath = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--profile");

// --- Load profile ---
function loadProfile() {
  if (!existsSync(profilePath)) {
    console.error(`  Profile not found: ${profilePath}`);
    console.error(`  Run voice-extract first to create a profile.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(profilePath, "utf-8"));
}

// --- Get text ---
async function getText(): Promise<string> {
  if (filePath && existsSync(filePath)) {
    return readFileSync(filePath, "utf-8");
  }

  const stdin = process.stdin;
  if (stdin.isTTY) {
    console.error(`
  voice-score — score a document against a voice profile

  Usage:
    voice-score <file>                    Score against default profile
    voice-score <file> --profile p.json   Custom profile
    voice-score <file> --verbose          Show flagged sentences
    voice-score <file> --fix             Show specific fixes
    voice-score <file> --json            Raw JSON output
    echo "text" | voice-score            Score stdin
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

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && /[.!?]$/.test(s));
}

function extractParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 20);
}

// --- Individual checks ---
interface CheckResult {
  name: string;
  weight: number;
  score: number; // 0-100
  flags: string[];
  fixes: string[];
}

const AI_FILLER_WORDS = [
  "certainly", "indeed", "furthermore", "moreover", "additionally",
  "it's worth noting", "in today's landscape", "in conclusion",
  "it is important to note", "based on the analysis", "comprehensive",
  "robust", "holistic", "cutting-edge", "innovative", "best-in-class",
  "paradigm", "utilize", "leverage", "synergize", "stakeholders",
  "delve", "tapestry", "multifaceted", "nuanced", "streamline",
  "facilitate", "endeavor", "aforementioned", "subsequently",
  "in summary", "to summarize", "as previously mentioned"
];

const FILLER_OPENERS = [
  "certainly,", "indeed,", "absolutely,", "great question",
  "here is the", "here's the", "in today's", "it's worth noting",
  "it is important", "based on the analysis", "based on our analysis"
];

const HEDGE_PHRASES = [
  "it appears that", "it could be argued", "it seems that",
  "it is possible that", "one might say", "it is worth considering",
  "it may be the case", "to some extent", "it is generally accepted"
];

function checkBannedWords(text: string, profile: any): CheckResult {
  const lower = text.toLowerCase();
  const neverUsed: string[] = profile.vocabulary?.neverUsedAIWords || AI_FILLER_WORDS;
  const flags: string[] = [];
  const fixes: string[] = [];

  for (const word of neverUsed) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi");
    const matches = text.match(regex);
    if (matches) {
      flags.push(`"${word}" found ${matches.length}x`);
      fixes.push(`Remove "${word}" — this author never uses it.`);
    }
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 15);
  return { name: "Banned words", weight: 20, score, flags, fixes };
}

function checkFillerOpeners(text: string): CheckResult {
  const sentences = extractSentences(text);
  const flags: string[] = [];
  const fixes: string[] = [];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    for (const opener of FILLER_OPENERS) {
      if (lower.startsWith(opener)) {
        flags.push(`Opens with "${s.substring(0, 50)}..."`);
        fixes.push(`Rewrite opening: "${s.substring(0, 60)}..." — cut the filler, lead with the point.`);
        break;
      }
    }
  }

  const rate = sentences.length > 0 ? (flags.length / sentences.length) * 100 : 0;
  const score = rate === 0 ? 100 : Math.max(0, 100 - rate * 20);
  return { name: "Filler openers", weight: 10, score, flags, fixes };
}

function checkSentenceLength(text: string, profile: any): CheckResult {
  const sentences = extractSentences(text);
  const lengths = sentences.map(s => wordCount(s));
  const flags: string[] = [];
  const fixes: string[] = [];

  if (lengths.length === 0) return { name: "Sentence length", weight: 20, score: 100, flags: [], fixes: [] };

  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const target = profile.scoring?.sentenceLength?.target || { min: 8, max: 22 };
  const profileAvg = profile.sentences?.avgLength || 14;

  if (avg < target.min || avg > target.max) {
    flags.push(`Avg sentence length ${avg.toFixed(1)} words (profile target: ${target.min}-${target.max})`);
    fixes.push(`Adjust sentence length — profile averages ${profileAvg} words.`);
  }

  // Check consecutive long sentences
  const maxConsec = profile.scoring?.maxConsecutiveLong || 3;
  let currentRun = 0;
  let maxRun = 0;
  let runStart = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i] > 20) {
      if (currentRun === 0) runStart = i;
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  if (maxRun >= maxConsec) {
    flags.push(`${maxRun} consecutive long sentences (>${maxConsec - 1} triggers flag)`);
    fixes.push(`Break up the long sentence run — insert a short punch sentence.`);
  }

  // Burstiness check
  const profileBurstiness = profile.sentences?.burstiness || 30;
  let bursts = 0;
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) > 10) bursts++;
  }
  const docBurstiness = Math.round((bursts / Math.max(lengths.length - 1, 1)) * 100);

  if (docBurstiness < profileBurstiness - 15) {
    flags.push(`Low burstiness: ${docBurstiness}% (profile: ${profileBurstiness}%)`);
    fixes.push(`Rhythm is too uniform. Follow a long sentence with a short one. Break the pattern.`);
  }

  const penalty = flags.length * 20;
  const score = Math.max(0, 100 - penalty);
  return { name: "Sentence length", weight: 20, score, flags, fixes };
}

function checkParagraphStructure(text: string, profile: any): CheckResult {
  const paragraphs = extractParagraphs(text);
  const flags: string[] = [];
  const fixes: string[] = [];

  if (paragraphs.length < 3) return { name: "Paragraph structure", weight: 15, score: 100, flags: [], fixes: [] };

  const sentenceCounts = paragraphs.map(p => extractSentences(p).length);
  const maxParagraph = profile.scoring?.paragraphLength?.maxSentences || 6;

  // Long paragraphs
  const longParas = sentenceCounts.filter(c => c >= maxParagraph);
  if (longParas.length > 0) {
    flags.push(`${longParas.length} paragraph(s) with ${maxParagraph}+ sentences`);
    fixes.push(`Break long paragraphs — profile averages ${profile.paragraphs?.avgSentencesPerParagraph || 3} sentences.`);
  }

  // Uniformity check — all paragraphs same length
  const uniqueLengths = new Set(sentenceCounts);
  if (uniqueLengths.size <= 2 && paragraphs.length > 5) {
    flags.push(`Paragraph lengths are too uniform (${[...uniqueLengths].join(", ")} sentences)`);
    fixes.push(`Vary paragraph length — mix 1-sentence punches with 3-4 sentence blocks.`);
  }

  // Single sentence paragraph rate
  const profileSingleRate = profile.paragraphs?.distribution?.singleSentence || 20;
  const docSingleRate = Math.round((sentenceCounts.filter(c => c <= 1).length / sentenceCounts.length) * 100);
  if (docSingleRate < profileSingleRate - 15 && profileSingleRate > 10) {
    flags.push(`Too few single-sentence paragraphs: ${docSingleRate}% (profile: ${profileSingleRate}%)`);
    fixes.push(`Add impact paragraphs — this author uses single-sentence ¶s ${profileSingleRate}% of the time.`);
  }

  // Topic-sentence-first rate
  const maxTopicFirst = profile.scoring?.topicSentenceFirstMax || 80;
  const topicFirst = paragraphs.filter(p => {
    const first = p.split(/[.!?]/)[0]?.trim() || "";
    return !/^(But|And|When|If|However|Although|While|Since|Because|Or|Yet|So)\s/i.test(first)
      && !/^["']/.test(first)
      && first.length > 20;
  }).length;
  const topicFirstRate = Math.round((topicFirst / paragraphs.length) * 100);

  if (topicFirstRate > maxTopicFirst) {
    flags.push(`Topic-sentence-first rate ${topicFirstRate}% exceeds ${maxTopicFirst}%`);
    fixes.push(`Lead some paragraphs with context or setup, not the conclusion.`);
  }

  const penalty = flags.length * 15;
  const score = Math.max(0, 100 - penalty);
  return { name: "Paragraph structure", weight: 15, score, flags, fixes };
}

function checkHedging(text: string): CheckResult {
  const lower = text.toLowerCase();
  const flags: string[] = [];
  const fixes: string[] = [];

  for (const hedge of HEDGE_PHRASES) {
    const regex = new RegExp(hedge.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    const matches = text.match(regex);
    if (matches) {
      flags.push(`"${hedge}" found ${matches.length}x`);
      fixes.push(`Replace "${hedge}" with a direct assertion.`);
    }
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 20);
  return { name: "Hedge clusters", weight: 10, score, flags, fixes };
}

function checkPassiveVoice(text: string, profile: any): CheckResult {
  const sentences = extractSentences(text);
  const passivePattern = /\b(was|were|been|being|is|are)\s+([\w]+ed|[\w]+en)\b/gi;
  const flags: string[] = [];
  const fixes: string[] = [];

  const passiveMatches = text.match(passivePattern) || [];
  const rate = sentences.length > 0 ? Math.round((passiveMatches.length / sentences.length) * 100) : 0;
  const maxRate = profile.scoring?.passiveVoiceMax || 15;

  if (rate > maxRate) {
    flags.push(`Passive voice rate ${rate}% exceeds ${maxRate}%`);
    fixes.push(`Convert passive to active: "was developed" → "I built", "was identified" → "we found".`);
  }

  const score = rate <= maxRate ? 100 : Math.max(0, 100 - (rate - maxRate) * 5);
  return { name: "Passive voice", weight: 5, score, flags, fixes };
}

function checkAITriple(text: string): CheckResult {
  const lines = text.split("\n");
  const flags: string[] = [];
  const fixes: string[] = [];

  // Detect 3+ consecutive bullet points with identical grammatical structure
  const bulletLines: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*[-*•]\s+(.+)/);
    if (match) {
      bulletLines.push(match[1].trim());
    } else if (line.trim().length > 0 && bulletLines.length >= 3) {
      // Check the run
      checkBulletRun(bulletLines, flags, fixes);
      bulletLines.length = 0;
    } else if (line.trim().length === 0 && bulletLines.length >= 3) {
      checkBulletRun(bulletLines, flags, fixes);
      bulletLines.length = 0;
    } else if (line.trim().length > 0) {
      bulletLines.length = 0;
    }
  }
  if (bulletLines.length >= 3) checkBulletRun(bulletLines, flags, fixes);

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 25);
  return { name: "AI triple", weight: 10, score, flags, fixes };
}

function checkBulletRun(bullets: string[], flags: string[], fixes: string[]) {
  // Check if 3+ consecutive bullets start with the same grammatical pattern
  const starters = bullets.map(b => {
    const firstWord = b.split(/\s/)[0]?.toLowerCase() || "";
    // Classify: verb, noun phrase, adjective, etc.
    if (/^(ensure|create|deploy|monitor|identify|assess|evaluate|review|implement|establish|develop|provide|support|manage|build|design|enable|deliver|discover|enforce)s?$/i.test(firstWord)) {
      return "verb";
    }
    if (/^(the|a|an|our|their|this|that|each|every|all|no)$/i.test(firstWord)) {
      return "article";
    }
    return "other";
  });

  // Count consecutive same-type starters
  for (let i = 0; i <= starters.length - 3; i++) {
    if (starters[i] === starters[i + 1] && starters[i + 1] === starters[i + 2] && starters[i] === "verb") {
      flags.push(`3+ bullets starting with verbs: "${bullets[i].substring(0, 40)}...", "${bullets[i + 1].substring(0, 40)}...", "${bullets[i + 2].substring(0, 40)}..."`);
      fixes.push(`Vary the bullet structure — start one with a noun phrase or rewrite as prose.`);
      break;
    }
  }
}

function checkBulletWalls(rawText: string, profile: any): CheckResult {
  const lines = rawText.split("\n");
  const maxRun = profile.scoring?.maxConsecutiveBullets || 7;
  const flags: string[] = [];
  const fixes: string[] = [];

  let currentRun = 0;
  let runStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*[-*•]\s/.test(lines[i])) {
      if (currentRun === 0) runStart = i;
      currentRun++;
    } else if (lines[i].trim().length > 0) {
      if (currentRun >= maxRun) {
        flags.push(`${currentRun} consecutive bullets at line ${runStart + 1}`);
        fixes.push(`Break the bullet wall at line ${runStart + 1} — insert a prose paragraph after 5-6 bullets.`);
      }
      currentRun = 0;
    }
  }
  if (currentRun >= maxRun) {
    flags.push(`${currentRun} consecutive bullets at line ${runStart + 1}`);
    fixes.push(`Break the bullet wall — insert prose after 5-6 bullets.`);
  }

  const score = flags.length === 0 ? 100 : Math.max(0, 100 - flags.length * 20);
  return { name: "Bullet walls", weight: 10, score, flags, fixes };
}

// --- Voice conformance check (positive signature matching) ---
function checkVoiceConformance(text: string, rawText: string, profile: any): CheckResult {
  const flags: string[] = [];
  const fixes: string[] = [];
  let deductions = 0;

  const sentences = extractSentences(text);
  const paragraphs = extractParagraphs(text);

  // 1. Em dash conformance
  const profileEmDashRate = profile.vocabulary?.emDashUsageRate || 0;
  const docEmDashes = (text.match(/—/g) || []).length;
  const docEmDashRate = sentences.length > 0 ? Math.round((docEmDashes / sentences.length) * 100) : 0;
  const emDashDiff = Math.abs(docEmDashRate - profileEmDashRate);
  if (emDashDiff > 12) {
    flags.push(`Em dash usage ${docEmDashRate}% vs profile ${profileEmDashRate}%`);
    if (docEmDashRate < profileEmDashRate) {
      fixes.push(`This author uses em dashes in ${profileEmDashRate}% of sentences. Add mid-sentence asides with —.`);
    } else {
      fixes.push(`This author uses em dashes in ${profileEmDashRate}% of sentences. You're overusing them at ${docEmDashRate}%.`);
    }
    deductions += Math.min(emDashDiff - 10, 30);
  }

  // 2. Contraction rate conformance
  const profileContractionRate = profile.vocabulary?.contractionRate || 3;
  const contractions = text.match(/\b\w+'\w+\b/g) || [];
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  const docContractionRate = totalWords > 0 ? Math.round((contractions.length / totalWords) * 10000) / 100 : 0;
  const contractionDiff = Math.abs(docContractionRate - profileContractionRate);
  if (contractionDiff > 3) {
    flags.push(`Contraction rate ${docContractionRate}% vs profile ${profileContractionRate}%`);
    if (docContractionRate < profileContractionRate) {
      fixes.push(`This author uses contractions at ${profileContractionRate}%. Write "don't" not "do not", "isn't" not "is not".`);
    } else {
      fixes.push(`This author uses contractions at ${profileContractionRate}%. You're using too many at ${docContractionRate}%.`);
    }
    deductions += Math.min(contractionDiff * 3, 20);
  }

  // 3. List-to-prose ratio conformance
  const lines = rawText.split("\n");
  const bulletLines = lines.filter(l => /^\s*[-*•]\s/.test(l)).length;
  const totalContentLines = lines.filter(l => l.trim().length > 0).length;
  const docListRate = totalContentLines > 0 ? Math.round((bulletLines / totalContentLines) * 100) : 0;
  const profileListRate = profile.structure?.listToProse || 0;
  const listDiff = Math.abs(docListRate - profileListRate);
  if (listDiff > 20) {
    flags.push(`List-to-prose ratio ${docListRate}% vs profile ${profileListRate}%`);
    if (docListRate > profileListRate) {
      fixes.push(`Too many lists. This author uses ${profileListRate}% lists. Convert some bullets to prose.`);
    } else {
      fixes.push(`This author uses ${profileListRate}% lists. Add some structure with bullet points.`);
    }
    deductions += Math.min(listDiff - 15, 25);
  }

  // 4. Single-sentence paragraph rate conformance
  if (paragraphs.length > 5) {
    const profileSingleRate = profile.paragraphs?.distribution?.singleSentence || 20;
    const docSingleRate = Math.round((paragraphs.filter(p => extractSentences(p).length <= 1).length / paragraphs.length) * 100);
    const singleDiff = Math.abs(docSingleRate - profileSingleRate);
    if (singleDiff > 18) {
      flags.push(`Single-sentence ¶ rate ${docSingleRate}% vs profile ${profileSingleRate}%`);
      if (docSingleRate < profileSingleRate) {
        fixes.push(`This author uses single-sentence paragraphs ${profileSingleRate}% of the time. Add impact punches.`);
      } else {
        fixes.push(`Too many single-sentence paragraphs (${docSingleRate}%). This author averages ${profileSingleRate}%.`);
      }
      deductions += Math.min(singleDiff - 15, 20);
    }
  }

  // 5. Average sentence length conformance (tighter than the range check)
  if (sentences.length > 10) {
    const profileAvg = profile.sentences?.avgLength || 14;
    const docAvg = sentences.reduce((sum, s) => sum + wordCount(s), 0) / sentences.length;
    const avgDiff = Math.abs(docAvg - profileAvg);
    if (avgDiff > 4) {
      flags.push(`Avg sentence length ${docAvg.toFixed(1)} vs profile ${profileAvg}`);
      fixes.push(`This author averages ${profileAvg} words per sentence. Adjust toward that.`);
      deductions += Math.min((avgDiff - 3) * 5, 25);
    }
  }

  const score = Math.max(0, 100 - deductions);
  return { name: "Voice conformance", weight: 15, score, flags, fixes };
}

// --- Main scoring ---
function scoreDocument(rawText: string, profile: any) {
  const text = stripMarkdown(rawText);

  const checks: CheckResult[] = [
    checkBannedWords(text, profile),
    checkFillerOpeners(text),
    checkSentenceLength(text, profile),
    checkParagraphStructure(text, profile),
    checkHedging(text),
    checkPassiveVoice(text, profile),
    checkAITriple(rawText),
    checkBulletWalls(rawText, profile),
    checkVoiceConformance(text, rawText, profile),
  ];

  // Weighted score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const weightedScore = checks.reduce((sum, c) => sum + (c.score * c.weight / 100), 0);
  const finalScore = Math.round((weightedScore / totalWeight) * 100);
  const pass = finalScore >= PASS_THRESHOLD;

  return { checks, finalScore, pass };
}

// --- Main ---
async function main() {
  const rawText = await getText();

  if (!rawText.trim()) {
    console.error("  No text provided.");
    process.exit(1);
  }

  const profile = loadProfile();
  const { checks, finalScore, pass } = scoreDocument(rawText, profile);

  if (jsonOutput) {
    console.log(JSON.stringify({ score: finalScore, pass, checks, profile: profile.meta }, null, 2));
    process.exit(pass ? 0 : 1);
  }

  const icon = pass ? "✅" : "❌";
  const verdict = pass ? "PASS" : "FAIL";

  console.log();
  console.log(`  ${icon} VOICE SCORE: ${verdict} (${finalScore}/100)`);
  console.log(`  ════════════════════════════════════`);

  for (const check of checks) {
    const checkIcon = check.score >= 80 ? "✓" : check.score >= 50 ? "△" : "✗";
    const scoreStr = `${check.score}`.padStart(3);
    console.log(`  ${checkIcon} ${check.name.padEnd(22)} ${scoreStr}/100  (${check.weight}% weight)`);

    if ((verbose || fixMode) && check.flags.length > 0) {
      for (const flag of check.flags.slice(0, 5)) {
        console.log(`      → ${flag}`);
      }
      if (check.flags.length > 5) {
        console.log(`      ... and ${check.flags.length - 5} more`);
      }
    }

    if (fixMode && check.fixes.length > 0) {
      for (const fix of check.fixes.slice(0, 3)) {
        console.log(`      🔧 ${fix}`);
      }
    }
  }

  console.log();
  console.log(`  Profile: ${profile.meta?.sources?.join(", ") || profilePath}`);
  if (filePath) console.log(`  File:    ${filePath}`);
  console.log(`  Pass threshold: ${PASS_THRESHOLD}/100`);
  console.log();

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("  Error:", err.message);
  process.exit(1);
});
