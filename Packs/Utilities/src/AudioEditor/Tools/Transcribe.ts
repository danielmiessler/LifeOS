#!/usr/bin/env bun
/**
 * Transcribe.ts — Word-level transcription via Whisper
 *
 * Uses insanely-fast-whisper (MPS accelerated) for word-level timestamps.
 * Falls back to standard whisper CLI if unavailable.
 *
 * Usage: bun Transcribe.ts <audio-file> [--output <path>]
 * Output: JSON file with word-level timestamps at <audio-file>.transcript.json
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";

const args = process.argv.slice(2);
const inputFile = args.find((a) => !a.startsWith("--"));
const outputFlag = args.indexOf("--output");
const outputPath =
  outputFlag !== -1 ? args[outputFlag + 1] : undefined;

if (!inputFile) {
  console.error("Usage: bun transcribe.ts <audio-file> [--output <path>]");
  process.exit(1);
}

if (!existsSync(inputFile)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const outFile =
  outputPath || join(dirname(inputFile), `${basename(inputFile, "." + inputFile.split(".").pop())}.transcript.json`);

console.log(`Transcribing: ${inputFile}`);
console.log(`Output: ${outFile}`);

// Check which whisper variant is available
const hasFastWhisper =
  (await $`which insanely-fast-whisper 2>/dev/null`.quiet().nothrow()).exitCode === 0;
const hasWhisper =
  (await $`which whisper 2>/dev/null`.quiet().nothrow()).exitCode === 0;

if (hasFastWhisper) {
  console.log("Using insanely-fast-whisper (MPS accelerated)...");
  const result = await $`insanely-fast-whisper \
    --file-name ${inputFile} \
    --transcript-path ${outFile} \
    --device-id mps \
    --timestamp word \
    --model-name openai/whisper-large-v3 \
    --batch-size 4 2>&1`.quiet().nothrow();

  if (result.exitCode !== 0) {
    console.error("insanely-fast-whisper failed, trying standard whisper...");
  } else {
    console.log("Transcription complete.");
  }
}

if (!hasFastWhisper || !existsSync(outFile)) {
  if (!hasWhisper) {
    console.error("No whisper variant found. Install: pip install openai-whisper");
    process.exit(1);
  }

  console.log("Using standard whisper...");
  const tmpDir = join(dirname(outFile), ".whisper-tmp");
  await $`mkdir -p ${tmpDir}`;

  await $`whisper ${inputFile} \
    --model medium \
    --language en \
    --word_timestamps True \
    --output_format json \
    --output_dir ${tmpDir} 2>&1`.quiet();

  // Find and move the output
  const whisperOut = join(tmpDir, basename(inputFile).replace(/\.[^.]+$/, ".json"));
  if (existsSync(whisperOut)) {
    // Convert whisper format to insanely-fast-whisper format for consistency
    const data = JSON.parse(await Bun.file(whisperOut).text());
    const chunks: { text: string; timestamp: [number, number | null] }[] = [];

    for (const segment of data.segments || []) {
      for (const word of segment.words || []) {
        chunks.push({
          text: word.word,
          timestamp: [word.start, word.end],
        });
      }
    }

    const fullText = chunks.map((c) => c.text).join("");
    await Bun.write(outFile, JSON.stringify({ text: fullText, chunks }, null, 2));
    await $`rm -rf ${tmpDir}`;
    console.log("Transcription complete.");
  } else {
    console.error("Whisper produced no output.");
    await $`rm -rf ${tmpDir}`;
    process.exit(1);
  }
}

// Validate output
const transcript = JSON.parse(await Bun.file(outFile).text());
const chunkCount = transcript.chunks?.length || 0;
const textLen = transcript.text?.length || 0;
console.log(`Words: ${chunkCount} | Text: ${textLen} chars`);
console.log(`Saved: ${outFile}`);
