#!/usr/bin/env bun

/**
 * add-bg - Add Background Color CLI
 *
 * Add a solid background color to transparent PNG images.
 * Part of the Images skill for PAI system.
 *
 * Usage:
 *   add-bg input.png "#EAE9DF" output.png
 *   add-bg input.png --ul-brand output.png
 *
 * @see ~/.claude/skills/Images/SKILL.md
 */

import { existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// UL Brand background color for thumbnails/social previews
const UL_BRAND_COLOR = "#EAE9DF";

// ============================================================================
// Help
// ============================================================================

function showHelp(): void {
  console.log(`
add-bg - Add Background Color CLI

Add a solid background color to transparent PNG images using ImageMagick.

USAGE:
  add-bg <input> <color> <output>
  add-bg <input> --ul-brand <output>

ARGUMENTS:
  input       Path to transparent PNG image
  color       Hex color code (e.g., "#EAE9DF") OR --ul-brand
  output      Path to save result

OPTIONS:
  --ul-brand  Use UL brand color (#EAE9DF) for thumbnails

EXAMPLES:
  # Add UL brand background for thumbnail
  add-bg header.png --ul-brand header-thumb.png

  # Add custom background color
  add-bg header.png "#FFFFFF" header-white.png

  # Add dark background
  add-bg logo.png "#1a1a1a" logo-dark.png

REQUIREMENTS:
  ImageMagick must be installed (magick command)

UL BRAND COLOR:
  #EAE9DF - Sepia/cream background for social previews

ERROR CODES:
  0  Success
  1  Error (file not found, invalid color, ImageMagick error)
`);
  process.exit(0);
}

// ============================================================================
// Validation
// ============================================================================

function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ============================================================================
// Add Background
// ============================================================================

async function addBackground(
  inputPath: string,
  hexColor: string,
  outputPath: string
): Promise<void> {
  // Validate input file exists
  if (!existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  // Validate hex color
  if (!validateHexColor(hexColor)) {
    console.error(`❌ Invalid hex color: ${hexColor}`);
    console.error('   Must be in format #RRGGBB (e.g., "#EAE9DF")');
    process.exit(1);
  }

  console.log(`🎨 Adding background ${hexColor} to ${inputPath}`);

  // Use ImageMagick to composite the transparent image onto a colored background
  const command = `magick "${inputPath}" -background "${hexColor}" -flatten "${outputPath}"`;

  try {
    await execAsync(command);
    console.log(`✅ Saved: ${outputPath}`);
  } catch (error) {
    console.error(
      `❌ ImageMagick error:`,
      error instanceof Error ? error.message : String(error)
    );
    console.error("   Make sure ImageMagick is installed: brew install imagemagick");
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Check for help
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
  }

  // Need at least 3 args: input, color/--ul-brand, output
  if (args.length < 3) {
    console.error("❌ Missing arguments");
    console.error("   Usage: add-bg <input> <color|--ul-brand> <output>");
    process.exit(1);
  }

  const inputPath = args[0];
  const colorArg = args[1];
  const outputPath = args[2];

  // Handle --ul-brand flag
  const hexColor = colorArg === "--ul-brand" ? UL_BRAND_COLOR : colorArg;

  await addBackground(inputPath, hexColor, outputPath);
}

main();
