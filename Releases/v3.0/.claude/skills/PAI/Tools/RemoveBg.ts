#!/usr/bin/env bun

/**
 * remove-bg - Background Removal CLI
 *
 * Remove backgrounds from images using the remove.bg API.
 * Part of the Images skill for PAI system.
 *
 * Usage:
 *   remove-bg input.png                    # Overwrites original
 *   remove-bg input.png output.png         # Saves to new file
 *   remove-bg file1.png file2.png file3.png # Batch process
 *
 * @see ~/.claude/skills/Images/SKILL.md
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// ============================================================================
// Environment Loading
// ============================================================================

async function loadEnv(): Promise<void> {
  const envPath = process.env.PAI_CONFIG_DIR ? resolve(process.env.PAI_CONFIG_DIR, ".env") : resolve(process.env.HOME!, ".config/PAI/.env");
  try {
    const envContent = await readFile(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
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

// ============================================================================
// Help
// ============================================================================

function showHelp(): void {
  console.log(`
remove-bg - Background Removal CLI

Remove backgrounds from images using the remove.bg API.

USAGE:
  remove-bg <input> [output]           Single file
  remove-bg <file1> <file2> ...        Batch process (overwrites originals)

ARGUMENTS:
  input     Path to image file (PNG, JPG, JPEG, WebP)
  output    Optional output path (defaults to overwriting input)

EXAMPLES:
  # Remove background, overwrite original
  remove-bg header.png

  # Remove background, save to new file
  remove-bg header.png header-transparent.png

  # Batch process multiple files
  remove-bg diagram1.png diagram2.png diagram3.png

ENVIRONMENT:
  REMOVEBG_API_KEY    Required - Get from https://www.remove.bg/api

ERROR CODES:
  0  Success
  1  Error (missing API key, file not found, API error)
`);
  process.exit(0);
}

// ============================================================================
// Background Removal
// ============================================================================

async function removeBackground(
  inputPath: string,
  outputPath?: string
): Promise<void> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing environment variable: REMOVEBG_API_KEY");
    console.error("   Add it to ${PAI_DIR}/.env or export it in your shell");
    process.exit(1);
  }

  // Validate input file exists
  if (!existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  const output = outputPath || inputPath;
  console.log(`🔲 Removing background: ${inputPath}`);

  try {
    const imageBuffer = await readFile(inputPath);
    const formData = new FormData();
    formData.append("image_file", new Blob([imageBuffer]), "image.png");
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ remove.bg API error: ${response.status}`);
      console.error(`   ${errorText}`);
      process.exit(1);
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());
    await writeFile(output, resultBuffer);
    console.log(`✅ Saved: ${output}`);
  } catch (error) {
    console.error(
      `❌ Error processing ${inputPath}:`,
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  await loadEnv();

  const args = process.argv.slice(2);

  // Check for help
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
  }

  // Single file with optional output
  if (args.length === 1) {
    await removeBackground(args[0]);
    return;
  }

  // Check if second arg looks like an output path (single file mode)
  // or if we're in batch mode (multiple input files)
  if (args.length === 2) {
    // If second arg exists as a file, treat as batch mode
    // Otherwise treat as input/output pair
    if (existsSync(args[1])) {
      // Both files exist - batch mode
      for (const file of args) {
        await removeBackground(file);
      }
    } else {
      // Second arg is output path
      await removeBackground(args[0], args[1]);
    }
    return;
  }

  // Batch mode - multiple files
  console.log(`🔲 Batch processing ${args.length} files...\n`);
  let success = 0;
  let failed = 0;

  for (const file of args) {
    try {
      await removeBackground(file);
      success++;
    } catch {
      failed++;
    }
  }

  console.log(`\n📊 Complete: ${success} succeeded, ${failed} failed`);
}

main();
