#!/usr/bin/env bun
/**
 * PickExpression.ts — map content sentiment to a REAL expression-labeled headshot.
 *
 * The expression-matching requirement ("a face shot with an expression matching the
 * content") is a SELECTION problem over real photos, not a face-generation problem.
 * {{PRINCIPAL_NAME}} already has 12 expression-labeled real headshots; using a real photo guarantees
 * photorealism and kills the "obviously-rendered {{PRINCIPAL_NAME}}" slop tell on a channel whose
 * audience knows his real face.
 *
 * Usage:
 *   bun PickExpression.ts --sentiment skeptical
 *   bun PickExpression.ts --topic "Why this new AI hype is nonsense"
 *   bun PickExpression.ts --list
 *
 * Emits JSON: { sentiment, file, path, exists, alternatives }
 * Override the auto-pick anytime by passing --sentiment explicitly, or read the file
 * directly in the workflow if a more specific expression fits.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getClaudeDir } from "../../../LIFEOS/TOOLS/Paths";

const DIR = join(getClaudeDir(), "LIFEOS", "USER", "CUSTOMIZATIONS", "SKILLS", "Art", "HeadshotExamples");

// sentiment -> headshot filename (without .png), with topic keywords that route to it.
const MAP: Array<{ sentiment: string; file: string; keywords: string[] }> = [
  { sentiment: "neutral", file: "headshot-clean", keywords: ["explainer", "teaching", "guide", "how to", "deep dive", "deepdive", "overview", "intro", "tutorial", "framework", "system"] },
  { sentiment: "positive", file: "headshot-smiling", keywords: ["good news", "win", "great", "excited", "love", "best", "amazing", "launch", "announce", "celebrate", "optimistic", "future"] },
  { sentiment: "casual", file: "headshot-outside-smiling", keywords: ["casual", "vlog", "day in", "behind the scenes", "outdoors", "walk", "life"] },
  { sentiment: "curious", file: "headshot-what-is-that", keywords: ["what is", "what's", "explained", "mystery", "weird", "strange", "huh", "question"] },
  { sentiment: "thinking", file: "headshot-pondering", keywords: ["should you", "is it worth", "thinking", "consider", "reflect", "philosophy", "meaning", "deep"] },
  { sentiment: "disgust", file: "headshot-yuk", keywords: ["bad", "terrible", "cringe", "awful", "disgusting", "worst", "hate", "gross", "broken", "ass"] },
  { sentiment: "skeptical", file: "headshot-nah", keywords: ["no", "nope", "myth", "debunk", "nonsense", "wrong", "overrated", "hype", "don't", "stop", "skeptic", "disagree"] },
  { sentiment: "shock", file: "headshot-whatthehell", keywords: ["wtf", "insane", "crazy", "shocking", "outrage", "unbelievable", "what the", "wait what", "lost it", "chaos"] },
  { sentiment: "surprise", file: "headshot-surprised-hat", keywords: ["surprise", "you won't believe", "big news", "huge", "breakthrough", "finally", "revealed", "leak"] },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function resolveFile(base: string): { file: string; path: string; exists: boolean } {
  const path = join(DIR, `${base}.png`);
  return { file: `${base}.png`, path, exists: existsSync(path) };
}

function main(): void {
  if (process.argv.includes("--list")) {
    const onDisk = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".png")) : [];
    console.log(JSON.stringify({ dir: DIR, map: MAP.map((m) => ({ sentiment: m.sentiment, file: `${m.file}.png` })), onDisk }, null, 2));
    return;
  }

  let chosen = MAP.find((m) => m.sentiment === (arg("sentiment") || "").toLowerCase());

  if (!chosen) {
    const topic = (arg("topic") || arg("sentiment") || "").toLowerCase();
    if (topic) {
      let best: { m: (typeof MAP)[number]; hits: number } | null = null;
      for (const m of MAP) {
        const hits = m.keywords.filter((k) => topic.includes(k)).length;
        if (hits > 0 && (!best || hits > best.hits)) best = { m, hits };
      }
      chosen = best?.m;
    }
  }

  const pick = chosen ?? MAP[0]!; // default: neutral / headshot-clean

  const r = resolveFile(pick.file);
  const alternatives = MAP.filter((m) => m.sentiment !== pick.sentiment).map((m) => ({ sentiment: m.sentiment, file: `${m.file}.png` }));
  console.log(JSON.stringify({ sentiment: pick.sentiment, file: r.file, path: r.path, exists: r.exists, alternatives }, null, 2));
  if (!r.exists) process.exit(2);
}

main();
