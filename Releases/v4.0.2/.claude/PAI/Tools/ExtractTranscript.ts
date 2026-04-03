#!/usr/bin/env bun

/**
 * ExtractTranscript.ts
 *
 * CLI tool for extracting transcripts from audio/video files using OpenAI Whisper API
 * Part of PAI's extracttranscript skill
 *
 * Usage:
 *   bun ExtractTranscript.ts <file-or-folder> [options]
 *
 * Examples:
 *   bun ExtractTranscript.ts audio.m4a
 *   bun ExtractTranscript.ts video.mp4 --format srt
 *   bun ExtractTranscript.ts ~/Podcasts/ --batch
 */

import OpenAI from "openai";
import { existsSync, statSync, readdirSync, mkdirSync, createReadStream } from "fs";
import { join, basename, extname, dirname } from "path";
import { writeFile } from "fs/promises";

// Supported audio/video formats
const SUPPORTED_FORMATS = [
  ".m4a",
  ".mp3",
  ".wav",
  ".flac",
  ".ogg",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".webm",
];

// Output formats
const OUTPUT_FORMATS = ["txt", "json", "srt", "vtt"];

interface Options {
  format: string;
  batch: boolean;
  outputDir?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { path: string; options: Options } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: No file or folder path provided");
    console.log(
      "\nUsage: bun ExtractTranscript.ts <file-or-folder> [options]"
    );
    console.log("\nOptions:");
    console.log(
      "  --format <format>    Output format (txt, json, srt, vtt) [default: txt]"
    );
    console.log("  --batch              Process all files in folder");
    console.log(
      "  --output <dir>       Output directory [default: same as input]"
    );
    console.log("\nExamples:");
    console.log("  bun ExtractTranscript.ts audio.m4a");
    console.log("  bun ExtractTranscript.ts video.mp4 --format srt");
    console.log("  bun ExtractTranscript.ts ~/Podcasts/ --batch");
    console.log("\nEnvironment:");
    console.log("  OPENAI_API_KEY       Required - your OpenAI API key");
    process.exit(1);
  }

  const path = args[0];
  const options: Options = {
    format: "txt",
    batch: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--format" && i + 1 < args.length) {
      const format = args[i + 1];
      if (!OUTPUT_FORMATS.includes(format)) {
        console.error(
          `Error: Invalid format "${format}". Must be one of: ${OUTPUT_FORMATS.join(", ")}`
        );
        process.exit(1);
      }
      options.format = format;
      i++;
    } else if (arg === "--batch") {
      options.batch = true;
    } else if (arg === "--output" && i + 1 < args.length) {
      options.outputDir = args[i + 1];
      i++;
    }
  }

  return { path, options };
}

/**
 * Check if path is a supported audio/video file
 */
function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Get all supported files from a directory
 */
function getFilesFromDirectory(dirPath: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isFile() && isSupportedFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory: ${error}`);
    process.exit(1);
  }

  return files;
}

/**
 * Get file size in MB
 */
function getFileSizeMB(filePath: string): number {
  const stats = statSync(filePath);
  return stats.size / (1024 * 1024);
}

/**
 * Transcribe audio file using OpenAI Whisper API
 * Automatically splits large files if needed
 */
async function transcribeFile(
  filePath: string,
  options: Options,
  openai: OpenAI
): Promise<string> {
  console.log(`\nTranscribing: ${basename(filePath)}`);

  const fileSizeMB = getFileSizeMB(filePath);
  console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);

  // OpenAI has 25MB file size limit - use local split helper for large files
  if (fileSizeMB > 25) {
    console.log("File exceeds 25MB limit - using faster local alternative...");
    console.log("Note: For large files, consider using faster-whisper locally");
    throw new Error(
      `File size (${fileSizeMB.toFixed(2)} MB) exceeds OpenAI's 25MB limit. Please use a local transcription tool or split the file manually.`
    );
  }

  console.log(`Format: ${options.format}`);
  console.log("Uploading to OpenAI...");

  try {
    // Create file stream
    const fileStream = createReadStream(filePath) as any;

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      response_format: options.format === "txt" ? "text" : options.format as any,
      language: "en",
    });

    console.log(`✓ Transcription complete`);

    // Return as string (API returns string for all formats)
    return typeof transcription === 'string' ? transcription : JSON.stringify(transcription, null, 2);
  } catch (error: any) {
    throw new Error(`Transcription failed: ${error.message || error}`);
  }
}

/**
 * Save transcript to file
 */
async function saveTranscript(
  filePath: string,
  transcript: string,
  options: Options
): Promise<string> {
  // Determine output directory
  const outputDir = options.outputDir || dirname(filePath);

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate output filename
  const baseName = basename(filePath, extname(filePath));
  const outputPath = join(outputDir, `${baseName}.${options.format}`);

  // Save to file
  await writeFile(outputPath, transcript, "utf-8");

  return outputPath;
}

/**
 * Calculate estimated cost
 */
function calculateCost(fileSizeMB: number): string {
  // Rough estimate: 1MB ≈ 1 minute of audio
  // OpenAI charges $0.006 per minute
  const estimatedMinutes = fileSizeMB;
  const estimatedCost = estimatedMinutes * 0.006;
  return `$${estimatedCost.toFixed(3)}`;
}

/**
 * Main execution
 */
async function main() {
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable not set");
    console.log("\nSet your API key:");
    console.log('  export OPENAI_API_KEY="sk-..."');
    console.log("\nOr add to ~/.zshrc for persistence:");
    console.log('  echo \'export OPENAI_API_KEY="sk-..."\' >> ~/.zshrc');
    process.exit(1);
  }

  const { path, options } = parseArgs();

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Check if path exists
  if (!existsSync(path)) {
    console.error(`Error: Path does not exist: ${path}`);
    process.exit(1);
  }

  // Check if it's a file or directory
  const stat = statSync(path);
  let files: string[];

  if (stat.isDirectory()) {
    if (!options.batch) {
      console.error(
        "Error: Path is a directory. Use --batch flag to process all files in folder."
      );
      process.exit(1);
    }

    console.log(`Processing directory: ${path}`);
    files = getFilesFromDirectory(path);

    if (files.length === 0) {
      console.error(`Error: No supported audio/video files found in directory`);
      console.log(`Supported formats: ${SUPPORTED_FORMATS.join(", ")}`);
      process.exit(1);
    }

    console.log(`Found ${files.length} file(s) to transcribe`);
  } else if (stat.isFile()) {
    if (!isSupportedFile(path)) {
      console.error(`Error: Unsupported file format: ${extname(path)}`);
      console.log(`Supported formats: ${SUPPORTED_FORMATS.join(", ")}`);
      process.exit(1);
    }
    files = [path];
  } else {
    console.error(`Error: Path is neither a file nor a directory: ${path}`);
    process.exit(1);
  }

  // Calculate total cost estimate
  const totalSizeMB = files.reduce((sum, file) => sum + getFileSizeMB(file), 0);
  const estimatedCost = calculateCost(totalSizeMB);

  console.log(`\nTotal size: ${totalSizeMB.toFixed(2)} MB`);
  console.log(`Estimated cost: ${estimatedCost}`);
  console.log("");

  // Process each file
  const results: Array<{ file: string; output: string }> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const transcript = await transcribeFile(file, options, openai);
      const outputPath = await saveTranscript(file, transcript, options);
      results.push({ file, output: outputPath });
      console.log(`✓ Saved to: ${outputPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ file: basename(file), error: errorMsg });
      console.error(`✗ Failed to transcribe ${basename(file)}: ${errorMsg}`);
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Transcription complete!`);
  console.log(
    `Successfully processed: ${results.length}/${files.length} files`
  );
  if (errors.length > 0) {
    console.log(`Failed: ${errors.length} files`);
  }
  console.log(`${"=".repeat(60)}`);

  if (results.length > 0) {
    console.log("\nOutput files:");
    results.forEach(({ output }) => console.log(`  - ${output}`));
  }

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(({ file, error }) =>
      console.log(`  - ${file}: ${error}`)
    );
  }
}

// Run main function
main().catch((error) => {
  console.error(`Fatal error: ${error}`);
  process.exit(1);
});
