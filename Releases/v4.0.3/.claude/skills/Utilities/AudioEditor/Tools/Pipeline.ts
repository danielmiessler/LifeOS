#!/usr/bin/env bun
/**
 * Pipeline.ts — End-to-end audio editing pipeline
 *
 * Chains: transcribe → analyze → edit → (optional) polish
 *
 * Usage: bun Pipeline.ts <audio-file> [--polish] [--aggressive] [--preview]
 * Output: Edited (and optionally polished) audio file
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { basename, dirname, extname, join } from "path";

const TOOLS_DIR = import.meta.dir;

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const audioFile = positional[0];
const doPolish = args.includes("--polish");
const aggressive = args.includes("--aggressive");
const preview = args.includes("--preview");
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag !== -1 ? args[outputFlag + 1] : undefined;

if (!audioFile) {
  console.error("Usage: bun Pipeline.ts <audio-file> [--polish] [--aggressive] [--preview] [--output <path>]");
  console.error("");
  console.error("Flags:");
  console.error("  --polish      Apply Cleanvoice cloud polish after editing (requires CLEANVOICE_API_KEY)");
  console.error("  --aggressive  Tighter detection thresholds for filler words and pauses");
  console.error("  --preview     Show proposed edits without executing them");
  console.error("  --output      Specify output file path");
  process.exit(1);
}

if (!existsSync(audioFile)) {
  console.error(`File not found: ${audioFile}`);
  process.exit(1);
}

const ext = extname(audioFile);
const base = basename(audioFile, ext);
const dir = dirname(audioFile);

console.log("╔══════════════════════════════════════════╗");
console.log("║       AudioEditor Pipeline               ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`Input: ${audioFile}`);
console.log(`Mode: ${aggressive ? "aggressive" : "standard"}${doPolish ? " + polish" : ""}`);
console.log("");

const startTime = Date.now();

// ===== Step 1: Transcribe =====
console.log("━━━ Step 1/4: Transcribe ━━━━━━━━━━━━━━━━━━");
const transcriptFile = join(dir, `${base}.transcript.json`);

if (existsSync(transcriptFile)) {
  console.log(`Transcript exists, reusing: ${transcriptFile}`);
} else {
  const transcribeResult = await $`bun ${join(TOOLS_DIR, "Transcribe.ts")} ${audioFile} --output ${transcriptFile}`.nothrow();
  if (transcribeResult.exitCode !== 0) {
    console.error("Transcription failed.");
    process.exit(1);
  }
}

if (!existsSync(transcriptFile)) {
  console.error(`Transcript not found after transcription: ${transcriptFile}`);
  process.exit(1);
}

console.log("");

// ===== Step 2: Analyze =====
console.log("━━━ Step 2/4: Analyze ━━━━━━━━━━━━━━━━━━━━━");
const editsFile = join(dir, `${base}.edits.json`);

const analyzeArgs = [join(TOOLS_DIR, "Analyze.ts"), transcriptFile, "--output", editsFile];
if (aggressive) analyzeArgs.push("--aggressive");

const analyzeResult = await $`bun ${analyzeArgs}`.nothrow();
if (analyzeResult.exitCode !== 0) {
  console.error("Analysis failed.");
  process.exit(1);
}

if (!existsSync(editsFile)) {
  console.error(`Edits file not found after analysis: ${editsFile}`);
  process.exit(1);
}

// Load and display edit summary
const edits = JSON.parse(await Bun.file(editsFile).text());
console.log("");

if (preview) {
  console.log("━━━ Preview Mode ━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Found ${edits.length} proposed edits:\n`);
  for (const edit of edits) {
    const duration = (edit.end - edit.start).toFixed(1);
    console.log(`  [${formatTime(edit.start)}-${formatTime(edit.end)}] (${duration}s) ${edit.type}`);
    console.log(`    ${edit.reason}`);
    console.log(`    "${edit.context}"`);
    console.log("");
  }
  const totalCut = edits.reduce((sum: number, e: any) => sum + (e.end - e.start), 0);
  console.log(`Total time to cut: ${totalCut.toFixed(1)}s (${(totalCut / 60).toFixed(1)} min)`);
  console.log(`\nEdits saved to: ${editsFile}`);
  console.log("Run without --preview to apply these edits.");
  process.exit(0);
}

// ===== Step 3: Edit =====
console.log("━━━ Step 3/4: Edit ━━━━━━━━━━━━━━━━━━━━━━━━");
const editedFile = doPolish
  ? join(dir, `${base}_edited_pre-polish${ext}`)
  : outputPath || join(dir, `${base}_edited${ext}`);

const editResult = await $`bun ${join(TOOLS_DIR, "Edit.ts")} ${audioFile} ${editsFile} --output ${editedFile}`.nothrow();
if (editResult.exitCode !== 0) {
  console.error("Editing failed.");
  process.exit(1);
}

if (!existsSync(editedFile)) {
  console.error(`Edited file not found: ${editedFile}`);
  process.exit(1);
}

console.log("");

// ===== Step 4: Polish (optional) =====
if (doPolish) {
  console.log("━━━ Step 4/4: Polish ━━━━━━━━━━━━━━━━━━━━━━");
  const polishedFile = outputPath || join(dir, `${base}_edited${ext}`);

  const polishResult = await $`bun ${join(TOOLS_DIR, "Polish.ts")} ${editedFile} --output ${polishedFile}`.nothrow();
  if (polishResult.exitCode !== 0) {
    console.error("Polish failed. Edited file still available at:", editedFile);
    process.exit(1);
  }

  // Clean up pre-polish intermediate file
  await $`rm -f ${editedFile}`.quiet();

  console.log("");
} else {
  console.log("━━━ Step 4/4: Polish (skipped) ━━━━━━━━━━━━");
  console.log("Add --polish flag to enable Cleanvoice cloud polish.");
  console.log("");
}

// ===== Summary =====
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const finalFile = doPolish
  ? outputPath || join(dir, `${base}_edited${ext}`)
  : editedFile;

console.log("╔══════════════════════════════════════════╗");
console.log("║       Pipeline Complete                  ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`Output: ${finalFile}`);
console.log(`Elapsed: ${elapsed}s`);
console.log(`Artifacts:`);
console.log(`  Transcript: ${transcriptFile}`);
console.log(`  Edits:      ${editsFile}`);
console.log(`  Audio:      ${finalFile}`);

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}
