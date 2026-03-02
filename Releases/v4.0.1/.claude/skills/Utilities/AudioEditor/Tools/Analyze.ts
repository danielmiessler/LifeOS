#!/usr/bin/env bun
/**
 * Analyze.ts — LLM-powered edit classification
 *
 * Reads a word-level transcript and uses Claude to classify segments as:
 * KEEP, CUT_FILLER, CUT_FALSE_START, CUT_EDIT_MARKER, CUT_STUTTER, CUT_DEAD_AIR
 *
 * Distinguishes rhetorical emphasis from accidental repetition.
 *
 * Usage: bun Analyze.ts <transcript.json> [--output <path>] [--aggressive]
 * Output: JSON edit decision list at <transcript>.edits.json
 */

import { existsSync, readFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { homedir } from "os";

// ============================================================================
// Environment Loading — keys from ~/.config/PAI/.env
// ============================================================================

function loadEnv(): void {
  const envPath = process.env.PAI_CONFIG_DIR
    ? resolve(process.env.PAI_CONFIG_DIR, ".env")
    : resolve(homedir(), ".config/PAI/.env");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently continue if .env doesn't exist
  }
}

loadEnv();

interface Chunk {
  text: string;
  timestamp: [number, number | null];
}

interface EditDecision {
  type: string;
  start: number;
  end: number;
  reason: string;
  context: string;
  confidence: number;
}

const args = process.argv.slice(2);
const inputFile = args.find((a) => !a.startsWith("--"));
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag !== -1 ? args[outputFlag + 1] : undefined;
const aggressive = args.includes("--aggressive");

if (!inputFile) {
  console.error("Usage: bun Analyze.ts <transcript.json> [--output <path>] [--aggressive]");
  process.exit(1);
}

if (!existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not found. Set it in ~/.config/PAI/.env");
  process.exit(1);
}

const outFile =
  outputPath || inputFile.replace(/\.transcript\.json$/, ".edits.json").replace(/\.json$/, ".edits.json");

console.log(`Analyzing: ${inputFile}`);
console.log(`Mode: ${aggressive ? "aggressive" : "standard"}`);

// Load transcript
const transcript = JSON.parse(await Bun.file(inputFile).text());
const chunks: Chunk[] = transcript.chunks || [];

if (chunks.length === 0) {
  console.error("No word chunks found in transcript");
  process.exit(1);
}

// ===== Phase 1: Detect long pauses (no LLM needed) =====
const pauseEdits: EditDecision[] = [];
const pauseThreshold = aggressive ? 3.0 : 5.0;
const keepPause = 1.0; // Keep 1s of any long pause

for (let i = 1; i < chunks.length; i++) {
  const prevEnd = chunks[i - 1].timestamp[1] || chunks[i - 1].timestamp[0];
  const currStart = chunks[i].timestamp[0];
  const gap = currStart - prevEnd;

  if (gap > pauseThreshold) {
    const cutStart = prevEnd + keepPause;
    const cutEnd = currStart;
    if (cutEnd - cutStart > 0.5) {
      const ctx = chunks
        .slice(Math.max(0, i - 3), i + 3)
        .map((c) => c.text.trim())
        .join(" ");
      pauseEdits.push({
        type: "CUT_DEAD_AIR",
        start: Math.round(cutStart * 100) / 100,
        end: Math.round(cutEnd * 100) / 100,
        reason: `${gap.toFixed(1)}s pause (keeping ${keepPause}s)`,
        context: ctx,
        confidence: 1.0,
      });
    }
  }
}

console.log(`Found ${pauseEdits.length} long pauses (>${pauseThreshold}s)`);

// ===== Phase 2: Build windowed transcript for LLM analysis =====
// Process in ~3000-word windows with overlap for context
const WINDOW_SIZE = 3000;
const OVERLAP = 200;
const allEdits: EditDecision[] = [...pauseEdits];

// Build text windows with timestamp markers
function buildWindow(startIdx: number, endIdx: number): string {
  const lines: string[] = [];
  let currentLine = "";
  let lineStartTime = chunks[startIdx].timestamp[0];

  for (let i = startIdx; i < endIdx && i < chunks.length; i++) {
    const word = chunks[i].text;
    currentLine += word;

    // Break into ~15-word lines with timestamps
    const wordCount = currentLine.trim().split(/\s+/).length;
    if (wordCount >= 15 || i === endIdx - 1 || i === chunks.length - 1) {
      const endTime = chunks[i].timestamp[1] || chunks[i].timestamp[0];
      lines.push(`[${formatTime(lineStartTime)}-${formatTime(endTime)}] ${currentLine.trim()}`);
      currentLine = "";
      if (i + 1 < chunks.length) {
        lineStartTime = chunks[i + 1].timestamp[0];
      }
    }
  }

  return lines.join("\n");
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

const aggressiveInstructions = aggressive
  ? `\n- Be MORE aggressive: cut single filler words like isolated "like", "right", "so" when used as verbal tics
- Cut pauses longer than 1.5 seconds
- Cut any word repetition that isn't clearly emphatic`
  : `\n- Be CONSERVATIVE: only cut clear mistakes, not natural speech patterns
- Keep rhetorical devices: parallel structures, lists, emphatic repetition
- When in doubt, classify as KEEP`;

const systemPrompt = `You are an expert audio editor analyzing a podcast transcript to identify sections that should be cut. The transcript has timestamps in [MM:SS.ss-MM:SS.ss] format.

Classify problematic sections. Return a JSON array of edits. Each edit has:
- "type": one of CUT_FILLER, CUT_FALSE_START, CUT_EDIT_MARKER, CUT_STUTTER, CUT_SELF_CORRECTION
- "start": start timestamp in seconds (decimal)
- "end": end timestamp in seconds (decimal)
- "reason": brief description
- "context": the problematic text
- "confidence": 0.0-1.0

## What to CUT

**CUT_EDIT_MARKER**: Speaker says "edit" as a verbal cue to mark cut points. Cut the word "edit" and any surrounding pause. This is the HIGHEST PRIORITY — these are explicit instructions from the speaker to cut here.

**CUT_STUTTER**: Unintentional word repetition like "the the", "I I", "with, with". NOT emphatic repetition like "very very important" or "many many people".

**CUT_FALSE_START**: Speaker starts a sentence, abandons it, and restarts. Example: "So the thing is— so what I was saying is..." — cut "So the thing is—".

**CUT_SELF_CORRECTION**: Speaker says something wrong then corrects. Example: "Not distill it. Well, they actually..." — cut "Not distill it."

**CUT_FILLER**: Filler word clusters: "um", "uh", "ah". Only cut when they are standalone hesitations, not when embedded naturally in speech flow.

## What to KEEP

- Intentional parallel structures: "Here's the tools. Here's the decisions. Here's the sign-offs."
- Emphatic repetition: "massive, massive reduction", "really, really important"
- Rhetorical lists: "You're the best trainer. You're the best coach."
- Natural discourse markers in flowing speech
- "blah blah blah" (intentional shorthand)
- "I mean" when used naturally in a flowing sentence${aggressiveInstructions}

## Output Format

Return ONLY a JSON array. No markdown, no explanation. Example:
[{"type":"CUT_EDIT_MARKER","start":233.68,"end":237.22,"reason":"Verbal edit marker","context":"edit. We're talking about","confidence":0.95}]

If no edits found in a section, return: []`;

// Process in windows
const totalWindows = Math.ceil(chunks.length / (WINDOW_SIZE - OVERLAP));
console.log(`Processing ${chunks.length} words in ${totalWindows} windows...`);

for (let windowStart = 0; windowStart < chunks.length; windowStart += WINDOW_SIZE - OVERLAP) {
  const windowEnd = Math.min(windowStart + WINDOW_SIZE, chunks.length);
  const windowNum = Math.floor(windowStart / (WINDOW_SIZE - OVERLAP)) + 1;
  const windowText = buildWindow(windowStart, windowEnd);

  const startTime = chunks[windowStart].timestamp[0];
  const endTime = chunks[Math.min(windowEnd - 1, chunks.length - 1)].timestamp[1] ||
    chunks[Math.min(windowEnd - 1, chunks.length - 1)].timestamp[0];

  process.stdout.write(
    `  Window ${windowNum}/${totalWindows} [${formatTime(startTime)}-${formatTime(endTime)}]...`
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analyze this transcript section and return the JSON array of edits:\n\n${windowText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`\n  API error: ${response.status} ${err}`);
      continue;
    }

    const data = (await response.json()) as any;
    const text = data.content?.[0]?.text || "[]";

    // Parse JSON from response (handle potential markdown wrapping)
    let edits: EditDecision[];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      edits = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error(` parse error`);
      continue;
    }

    // Deduplicate against existing edits (from overlap regions)
    let added = 0;
    for (const edit of edits) {
      const isDuplicate = allEdits.some(
        (e) => Math.abs(e.start - edit.start) < 1.0 && Math.abs(e.end - edit.end) < 1.0
      );
      if (!isDuplicate && edit.confidence >= 0.6) {
        allEdits.push(edit);
        added++;
      }
    }

    console.log(` ${added} edits`);
  } catch (err) {
    console.error(` error: ${err}`);
  }
}

// ===== Phase 3: Sort and merge overlapping edits =====
allEdits.sort((a, b) => a.start - b.start);

const merged: EditDecision[] = [];
for (const edit of allEdits) {
  if (merged.length > 0 && edit.start < merged[merged.length - 1].end + 0.3) {
    // Merge overlapping edits
    const prev = merged[merged.length - 1];
    prev.end = Math.max(prev.end, edit.end);
    prev.type = prev.type.includes("+") ? prev.type : `${prev.type}+${edit.type}`;
    prev.reason = `${prev.reason}; ${edit.reason}`;
  } else {
    merged.push({ ...edit });
  }
}

// ===== Summary =====
const totalCut = merged.reduce((sum, e) => sum + (e.end - e.start), 0);
const byType: Record<string, number> = {};
for (const e of merged) {
  const baseType = e.type.split("+")[0];
  byType[baseType] = (byType[baseType] || 0) + 1;
}

console.log(`\n=== Analysis Complete ===`);
console.log(`Total edits: ${merged.length}`);
console.log(`Total time to cut: ${totalCut.toFixed(1)}s (${(totalCut / 60).toFixed(1)} min)`);
console.log(`By type:`);
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

// Save
await Bun.write(outFile, JSON.stringify(merged, null, 2));
console.log(`\nSaved: ${outFile}`);
