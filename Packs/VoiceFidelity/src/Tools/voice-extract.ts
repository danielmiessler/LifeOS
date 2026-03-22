#!/usr/bin/env bun

/**
 * voice-extract — Extract a stylometric voice profile from a writing corpus
 *
 * Usage:
 *   voice-extract --corpus ~/my-writing/           Extract from all .md/.txt files in folder
 *   voice-extract --files file1.md file2.md         Extract from specific files
 *   voice-extract --corpus ~/docs/ --out profile.json   Custom output path
 *   voice-extract --corpus ~/docs/ --verbose        Show detailed analysis
 *
 * Output: JSON voice profile that voice-score can check documents against.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";

// --- Config ---
const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".mdx"]);

// Common AI filler words to detect absence of
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

// Common hedge phrases
const HEDGE_PHRASES = [
  "it appears that", "it could be argued", "it seems that",
  "it is possible that", "one might say", "perhaps", "typically",
  "it is worth considering", "it may be the case", "arguably",
  "to some extent", "in some ways", "it is generally accepted"
];

// --- Parse args ---
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function getFlagMulti(flag: string): string[] {
  const idx = args.indexOf(flag);
  if (idx === -1) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith("--")) break;
    values.push(args[i]);
  }
  return values;
}

const corpusDir = getFlag("--corpus");
const specificFiles = getFlagMulti("--files");
const outputPath = getFlag("--out") || "voice-profile.json";

// --- Collect files ---
function collectFiles(): string[] {
  const files: string[] = [];

  if (specificFiles.length > 0) {
    for (const f of specificFiles) {
      if (existsSync(f)) files.push(f);
      else console.error(`  ⚠️ File not found: ${f}`);
    }
  } else if (corpusDir) {
    if (!existsSync(corpusDir)) {
      console.error(`  Corpus directory not found: ${corpusDir}`);
      process.exit(1);
    }
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(full);
        } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
          files.push(full);
        }
      }
    };
    walk(corpusDir);
  }

  return files;
}

// --- Strip markdown for analysis ---
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

// --- Extract sentences ---
function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && /[.!?]$/.test(s));
}

// --- Extract paragraphs ---
function extractParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20);
}

// --- Word count of a string ---
function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

// --- Analyze sentence patterns ---
function analyzeSentences(sentences: string[]) {
  const lengths = sentences.map(s => wordCount(s));
  const total = lengths.length;
  if (total === 0) return null;

  const avg = lengths.reduce((a, b) => a + b, 0) / total;
  const sorted = [...lengths].sort((a, b) => a - b);
  const median = sorted[Math.floor(total / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Standard deviation
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / total;
  const stdDev = Math.sqrt(variance);

  // Distribution buckets
  const short = lengths.filter(l => l <= 8).length;
  const medium = lengths.filter(l => l > 8 && l <= 20).length;
  const long = lengths.filter(l => l > 20).length;

  // Burstiness — how often does a long sentence follow a short one or vice versa
  let bursts = 0;
  for (let i = 1; i < lengths.length; i++) {
    const diff = Math.abs(lengths[i] - lengths[i - 1]);
    if (diff > 10) bursts++;
  }

  // Consecutive long sentences (3+ over 20 words)
  let maxConsecutiveLong = 0;
  let currentRun = 0;
  for (const l of lengths) {
    if (l > 20) { currentRun++; maxConsecutiveLong = Math.max(maxConsecutiveLong, currentRun); }
    else currentRun = 0;
  }

  // Fragment detection (sentences under 6 words)
  const fragments = sentences.filter(s => wordCount(s) <= 6);

  // Sentences starting with "And" or "But"
  const andButStarts = sentences.filter(s => /^(And|But)\s/i.test(s)).length;

  return {
    count: total,
    avgLength: Math.round(avg * 10) / 10,
    medianLength: median,
    minLength: min,
    maxLength: max,
    stdDev: Math.round(stdDev * 10) / 10,
    distribution: {
      short: Math.round((short / total) * 100),
      medium: Math.round((medium / total) * 100),
      long: Math.round((long / total) * 100),
    },
    burstiness: Math.round((bursts / Math.max(total - 1, 1)) * 100),
    maxConsecutiveLong,
    fragmentCount: fragments.length,
    fragmentRate: Math.round((fragments.length / total) * 100),
    andButStartRate: Math.round((andButStarts / total) * 100),
  };
}

// --- Analyze paragraph patterns ---
function analyzeParagraphs(paragraphs: string[]) {
  const sentenceCounts = paragraphs.map(p => extractSentences(p).length);
  const total = sentenceCounts.length;
  if (total === 0) return null;

  const avg = sentenceCounts.reduce((a, b) => a + b, 0) / total;

  // Length distribution
  const single = sentenceCounts.filter(c => c === 1).length;
  const short = sentenceCounts.filter(c => c >= 2 && c <= 3).length;
  const medium = sentenceCounts.filter(c => c >= 4 && c <= 5).length;
  const long = sentenceCounts.filter(c => c >= 6).length;

  // Uniformity — standard deviation of paragraph sentence counts
  const variance = sentenceCounts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / total;
  const stdDev = Math.sqrt(variance);

  // Topic-sentence-first detection
  // Heuristic: paragraph starts with a declarative statement (no "But", "And", "When", "If", etc.)
  const topicFirst = paragraphs.filter(p => {
    const firstSentence = p.split(/[.!?]/)[0]?.trim() || "";
    return !/^(But|And|When|If|However|Although|While|Since|Because|Or|Yet|So|After|Before|During)\s/i.test(firstSentence)
      && !/^["']/.test(firstSentence)
      && firstSentence.length > 20;
  }).length;

  return {
    count: total,
    avgSentencesPerParagraph: Math.round(avg * 10) / 10,
    distribution: {
      singleSentence: Math.round((single / total) * 100),
      short_2_3: Math.round((short / total) * 100),
      medium_4_5: Math.round((medium / total) * 100),
      long_6plus: Math.round((long / total) * 100),
    },
    uniformity: Math.round(stdDev * 10) / 10,
    topicSentenceFirstRate: Math.round((topicFirst / total) * 100),
  };
}

// --- Vocabulary analysis ---
function analyzeVocabulary(text: string) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  const totalWords = words.length;

  // Word frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    const clean = w.replace(/[^a-z'-]/g, "");
    if (clean.length > 2) freq.set(clean, (freq.get(clean) || 0) + 1);
  }

  // Top words (excluding very common stopwords)
  const stopwords = new Set(["the", "and", "that", "this", "with", "for", "are", "was", "were", "been",
    "have", "has", "had", "not", "but", "what", "all", "can", "her", "his", "him",
    "how", "its", "may", "our", "out", "you", "who", "which", "their", "them",
    "then", "there", "these", "they", "from", "will", "would", "could", "should",
    "into", "about", "more", "some", "than", "other", "very", "just", "also"]);

  const topWords = [...freq.entries()]
    .filter(([word]) => !stopwords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word, count]) => ({ word, count, rate: Math.round((count / totalWords) * 10000) / 100 }));

  // AI filler detection — which ones does this author use?
  const fillerUsage: Record<string, number> = {};
  for (const filler of AI_FILLER_WORDS) {
    const regex = new RegExp(filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    const matches = lower.match(regex);
    if (matches) fillerUsage[filler] = matches.length;
  }

  // Hedge phrase detection
  const hedgeUsage: Record<string, number> = {};
  for (const hedge of HEDGE_PHRASES) {
    const regex = new RegExp(hedge.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    const matches = lower.match(regex);
    if (matches) hedgeUsage[hedge] = matches.length;
  }

  // Words the author NEVER uses (from the AI filler list)
  const neverUsed = AI_FILLER_WORDS.filter(f => !fillerUsage[f]);

  // Passive voice detection
  const passivePattern = /\b(was|were|been|being|is|are)\s+([\w]+ed|[\w]+en)\b/gi;
  const passiveMatches = text.match(passivePattern) || [];
  const sentences = extractSentences(text);
  const passiveRate = sentences.length > 0 ? Math.round((passiveMatches.length / sentences.length) * 100) : 0;

  // Contraction usage
  const contractionPattern = /\b\w+'\w+\b/g;
  const contractions = text.match(contractionPattern) || [];
  const contractionRate = totalWords > 0 ? Math.round((contractions.length / totalWords) * 10000) / 100 : 0;

  // Em dash usage
  const emDashes = (text.match(/—/g) || []).length;
  const emDashRate = sentences.length > 0 ? Math.round((emDashes / sentences.length) * 100) : 0;

  return {
    totalWords,
    uniqueWords: freq.size,
    vocabularyRichness: Math.round((freq.size / totalWords) * 100),
    topWords: topWords.slice(0, 30),
    neverUsedAIWords: neverUsed,
    fillerWordsFound: fillerUsage,
    hedgingFound: hedgeUsage,
    passiveVoiceRate: passiveRate,
    contractionRate,
    emDashUsageRate: emDashRate,
  };
}

// --- Structure analysis ---
function analyzeStructure(rawText: string) {
  const lines = rawText.split("\n");

  // List vs prose ratio
  const bulletLines = lines.filter(l => /^\s*[-*•]\s/.test(l)).length;
  const numberedLines = lines.filter(l => /^\s*\d+[.)]\s/.test(l)).length;
  const totalContentLines = lines.filter(l => l.trim().length > 0).length;
  const listLines = bulletLines + numberedLines;
  const proseLines = totalContentLines - listLines;

  // Headers
  const headers = lines.filter(l => /^#{1,6}\s/.test(l));
  const headerWords = headers.map(h => wordCount(h.replace(/^#+\s*/, "")));

  // Consecutive bullet runs
  let maxBulletRun = 0;
  let currentRun = 0;
  for (const line of lines) {
    if (/^\s*[-*•]\s/.test(line)) { currentRun++; maxBulletRun = Math.max(maxBulletRun, currentRun); }
    else if (line.trim().length > 0) currentRun = 0;
  }

  return {
    listToProse: totalContentLines > 0 ? Math.round((listLines / totalContentLines) * 100) : 0,
    bulletLineCount: bulletLines,
    numberedLineCount: numberedLines,
    maxConsecutiveBullets: maxBulletRun,
    headerCount: headers.length,
    avgHeaderWordCount: headerWords.length > 0 ? Math.round(headerWords.reduce((a, b) => a + b, 0) / headerWords.length * 10) / 10 : 0,
  };
}

// --- Opening and closing patterns ---
function analyzeOpeningsClosings(paragraphs: string[]) {
  if (paragraphs.length < 2) return null;

  const openings = paragraphs.slice(0, 3).map(p => {
    const firstSentence = p.split(/[.!?]/)[0]?.trim() || "";
    return firstSentence.substring(0, 100);
  });

  const closings = paragraphs.slice(-3).map(p => {
    const sentences = p.split(/[.!?]/).filter(s => s.trim().length > 5);
    const lastSentence = sentences[sentences.length - 1]?.trim() || "";
    return lastSentence.substring(0, 100);
  });

  // Does the document end with a summary or forward-looking statement?
  const lastParagraph = paragraphs[paragraphs.length - 1].toLowerCase();
  const endsSummary = /in (summary|conclusion)|to (summarize|conclude)|overall/.test(lastParagraph);
  const endsForward = /next|will|going to|what's (next|coming)|the future|moving forward/.test(lastParagraph);

  return {
    openingPatterns: openings,
    closingPatterns: closings,
    endsSummary,
    endsForward,
  };
}

// --- Build the profile ---
function buildProfile(files: string[]) {
  let allText = "";
  let allRaw = "";
  const sources: string[] = [];

  for (const file of files) {
    const raw = readFileSync(file, "utf-8");
    allRaw += raw + "\n\n";
    allText += stripMarkdown(raw) + "\n\n";
    sources.push(basename(file));
  }

  const sentences = extractSentences(allText);
  const paragraphs = extractParagraphs(allText);

  const profile = {
    meta: {
      version: "1.0.0",
      extractedAt: new Date().toISOString(),
      sourceCount: files.length,
      sources,
      totalWords: wordCount(allText),
    },
    sentences: analyzeSentences(sentences),
    paragraphs: analyzeParagraphs(paragraphs),
    vocabulary: analyzeVocabulary(allText),
    structure: analyzeStructure(allRaw),
    openingsClosings: analyzeOpeningsClosings(paragraphs),
    scoring: {
      description: "Thresholds derived from this corpus. Documents are scored against these ranges.",
      sentenceLength: {
        target: { min: 0, max: 0 },
        description: "Average sentence length range. Outside this range = flag."
      },
      paragraphLength: {
        maxSentences: 0,
        description: "Max sentences per paragraph before flagging."
      },
      topicSentenceFirstMax: 0,
      maxConsecutiveLong: 0,
      maxConsecutiveBullets: 0,
      passiveVoiceMax: 0,
    }
  };

  // Set scoring thresholds from the data
  if (profile.sentences) {
    const avg = profile.sentences.avgLength;
    const std = profile.sentences.stdDev;
    profile.scoring.sentenceLength.target = {
      min: Math.round(Math.max(avg - std, 5)),
      max: Math.round(avg + std),
    };
    profile.scoring.maxConsecutiveLong = Math.max(profile.sentences.maxConsecutiveLong + 1, 3);
  }

  if (profile.paragraphs) {
    // Set max paragraph length to 90th percentile of observed
    profile.scoring.paragraphLength.maxSentences = 6;
    profile.scoring.topicSentenceFirstMax = Math.min(profile.paragraphs.topicSentenceFirstRate + 15, 80);
  }

  profile.scoring.maxConsecutiveBullets = Math.max(profile.structure.maxConsecutiveBullets + 2, 7);
  profile.scoring.passiveVoiceMax = Math.max((profile.vocabulary.passiveVoiceRate || 0) + 5, 15);

  return profile;
}

// --- Main ---
function main() {
  const files = collectFiles();

  if (files.length === 0) {
    console.error(`
  voice-extract — extract a stylometric voice profile

  Usage:
    voice-extract --corpus <folder>              All .md/.txt files in folder
    voice-extract --files file1.md file2.md      Specific files
    voice-extract --corpus <folder> --out p.json Custom output path
    voice-extract --corpus <folder> --verbose    Detailed analysis
    `);
    process.exit(1);
  }

  console.log();
  console.log(`  Extracting voice profile from ${files.length} file(s)...`);
  console.log();

  const profile = buildProfile(files);

  writeFileSync(outputPath, JSON.stringify(profile, null, 2));

  // Summary
  console.log(`  ✅ Voice profile extracted`);
  console.log(`  ────────────────────────────`);
  console.log(`  Sources:           ${profile.meta.sourceCount} files`);
  console.log(`  Total words:       ${profile.meta.totalWords}`);
  console.log(`  Sentences:         ${profile.sentences?.count || 0}`);
  console.log(`  Paragraphs:        ${profile.paragraphs?.count || 0}`);
  console.log();
  console.log(`  Avg sentence:      ${profile.sentences?.avgLength} words (target: ${profile.scoring.sentenceLength.target.min}-${profile.scoring.sentenceLength.target.max})`);
  console.log(`  Burstiness:        ${profile.sentences?.burstiness}%`);
  console.log(`  Fragment rate:     ${profile.sentences?.fragmentRate}%`);
  console.log(`  And/But starts:    ${profile.sentences?.andButStartRate}%`);
  console.log();
  console.log(`  Avg paragraph:     ${profile.paragraphs?.avgSentencesPerParagraph} sentences`);
  console.log(`  Single-sentence ¶: ${profile.paragraphs?.distribution.singleSentence}%`);
  console.log(`  Topic-first rate:  ${profile.paragraphs?.topicSentenceFirstRate}%`);
  console.log();
  console.log(`  Passive voice:     ${profile.vocabulary.passiveVoiceRate}%`);
  console.log(`  Em dash usage:     ${profile.vocabulary.emDashUsageRate}% of sentences`);
  console.log(`  Contractions:      ${profile.vocabulary.contractionRate}%`);
  console.log(`  List-to-prose:     ${profile.structure.listToProse}%`);
  console.log(`  Max bullet run:    ${profile.structure.maxConsecutiveBullets}`);
  console.log();
  console.log(`  AI words never used: ${profile.vocabulary.neverUsedAIWords.length}/${AI_FILLER_WORDS.length}`);
  if (Object.keys(profile.vocabulary.fillerWordsFound).length > 0) {
    console.log(`  AI words found:    ${Object.entries(profile.vocabulary.fillerWordsFound).map(([w, c]) => `${w}(${c})`).join(", ")}`);
  }
  console.log();
  console.log(`  Profile saved:     ${outputPath}`);

  if (verbose) {
    console.log();
    console.log(`  Top vocabulary:`);
    for (const w of profile.vocabulary.topWords.slice(0, 15)) {
      console.log(`    ${w.word.padEnd(20)} ${w.count}x (${w.rate}%)`);
    }

    if (profile.openingsClosings) {
      console.log();
      console.log(`  Opening patterns:`);
      for (const o of profile.openingsClosings.openingPatterns) {
        console.log(`    → "${o}..."`);
      }
      console.log(`  Closing style: ${profile.openingsClosings.endsSummary ? "summary" : profile.openingsClosings.endsForward ? "forward-looking" : "other"}`);
    }
  }

  console.log();
}

main();
