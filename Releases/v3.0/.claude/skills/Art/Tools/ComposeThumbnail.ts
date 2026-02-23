#!/usr/bin/env bun

/**
 * ComposeThumbnail - YouTube Thumbnail Composition CLI
 *
 * Composites background, headshot, and text into a YouTube thumbnail.
 * Uses ImageMagick for all composition operations.
 *
 * Features:
 * - Dynamic headshot positioning (left, center, right)
 * - Solid black backdrop boxes behind text for readability
 * - Full-height headshot that dominates the frame
 * - Colored border (Tokyo Night purple default)
 */

import { spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";

// ============================================================================
// Types
// ============================================================================

interface CLIArgs {
  background: string;
  headshot: string;
  title: string;
  subtitle: string;
  output: string;
  titleColor?: string;
  subtitleColor?: string;
  borderColor?: string;
  font?: string;
  headshotPosition?: "left" | "center" | "right";
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  titleColor: "#7dcfff",        // Tokyo Night cyan - VIBRANT by default
  subtitleColor: "#FFFFFF",     // White text for contrast
  borderColor: "#bb9af7",       // Tokyo Night Vivid Purple
  font: "Helvetica-Bold",       // System font that actually exists
  headshotPosition: "left" as const,
  output: `${process.env.HOME}/Downloads/yt-thumbnail-${Date.now()}.png`,
};

const LAYOUT = {
  width: 1280,
  height: 720,
  borderWidth: 16,
  // TEXT - BILLBOARD STYLE (large, bold, dominant)
  titleSize: 100,         // DOMINANT - fills the space
  subtitleSize: 50,       // Proportionally sized, still readable
  titleStroke: 4,         // Bold outline for visibility
  subtitleStroke: 3,      // Visible outline
  textPadding: 6,
  textBoxPadding: 20,
  // Safe zones - headshot and text never overlap
  headshotMaxWidth: 0.40, // Headshot takes max 40% width
  textZoneWidth: 0.55,    // Text zone is 55% width (FILLS the space)
  textZoneGap: 0.05,      // 5% gap between zones
};

// Color presets for text (Tokyo Night palette + extras)
const COLOR_PRESETS: Record<string, string> = {
  white: "#FFFFFF",
  cyan: "#7dcfff",
  purple: "#bb9af7",
  blue: "#7aa2f7",
  magenta: "#ff007c",
  yellow: "#e0af68",
  green: "#9ece6a",
  orange: "#ff9e64",
  red: "#f7768e",
};

function resolveColor(color: string): string {
  // If it's a preset name, return the hex value
  const preset = COLOR_PRESETS[color.toLowerCase()];
  if (preset) return preset;
  // Otherwise assume it's already a hex color
  return color;
}

// ============================================================================
// Error Handling
// ============================================================================

class CLIError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = "CLIError";
  }
}

// ============================================================================
// Helpers
// ============================================================================

function printHelp(): void {
  console.log(`
ComposeThumbnail - YouTube Thumbnail Composition CLI

USAGE:
  bun ~/.claude/skills/Art/Tools/ComposeThumbnail.ts [OPTIONS]

REQUIRED:
  --background <path>     Background image (dramatic tech art)
  --headshot <path>       Headshot image (transparent background)
  --title <text>          Title text (max 6 words, auto-capitalized)
  --subtitle <text>       Subtitle text (max 12 words, auto-capitalized)

OPTIONAL:
  --output <path>         Output path (default: ~/Downloads/yt-thumbnail-{timestamp}.png)
  --position <pos>        Headshot position: left, center, right (default: left)
  --font <name>           Font name (default: Helvetica-Bold)
  --title-color <hex>     Title color (default: #FFFFFF)
  --subtitle-color <hex>  Subtitle color (default: #FFFFFF)
  --border-color <hex>    Border color (default: #bb9af7 Tokyo Night Purple)
  --help, -h              Show this help message

EXAMPLE:
  bun ~/.claude/skills/Art/Tools/ComposeThumbnail.ts \\
    --background ~/Downloads/tech-background.png \\
    --headshot ~/Downloads/headshot-nobg.png \\
    --title "AI AGENTS KILLING SOFTWARE" \\
    --subtitle "WHY TRADITIONAL DEVELOPMENT IS DEAD" \\
    --position left \\
    --output ~/Downloads/thumbnail.png

LAYOUT:
  Canvas:     1280x720 px
  Border:     16px colored border (Tokyo Night purple)
  Headshot:   Full height inside border, positioned left/center/right
  Text:       White text with minimal black backdrop boxes
`);
}

function parseArgs(args: string[]): CLIArgs {
  const result: Partial<CLIArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--background":
        result.background = next;
        i++;
        break;
      case "--headshot":
        result.headshot = next;
        i++;
        break;
      case "--title":
        result.title = next;
        i++;
        break;
      case "--subtitle":
        result.subtitle = next;
        i++;
        break;
      case "--output":
        result.output = next;
        i++;
        break;
      case "--position":
        if (next === "left" || next === "center" || next === "right") {
          result.headshotPosition = next;
        }
        i++;
        break;
      case "--title-color":
        result.titleColor = next;
        i++;
        break;
      case "--subtitle-color":
        result.subtitleColor = next;
        i++;
        break;
      case "--border-color":
        result.borderColor = next;
        i++;
        break;
      case "--font":
        result.font = next;
        i++;
        break;
    }
  }

  // Validate required args
  if (!result.background) throw new CLIError("--background is required");
  if (!result.headshot) throw new CLIError("--headshot is required");
  if (!result.title) throw new CLIError("--title is required");
  if (!result.subtitle) throw new CLIError("--subtitle is required");

  // Validate files exist
  if (!existsSync(result.background)) {
    throw new CLIError(`Background file not found: ${result.background}`);
  }
  if (!existsSync(result.headshot)) {
    throw new CLIError(`Headshot file not found: ${result.headshot}`);
  }

  return {
    background: resolve(result.background),
    headshot: resolve(result.headshot),
    title: result.title.toUpperCase(),
    subtitle: result.subtitle.toUpperCase(),
    output: result.output ? resolve(result.output) : DEFAULTS.output,
    titleColor: result.titleColor || DEFAULTS.titleColor,
    subtitleColor: result.subtitleColor || DEFAULTS.subtitleColor,
    borderColor: result.borderColor || DEFAULTS.borderColor,
    font: result.font || DEFAULTS.font,
    headshotPosition: result.headshotPosition || DEFAULTS.headshotPosition,
  };
}

async function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => (stdout += data.toString()));
    proc.stderr.on("data", (data) => (stderr += data.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new CLIError(`Command failed: ${cmd} ${args.join(" ")}\n${stderr}`, code || 1));
      }
    });
  });
}

// ============================================================================
// Headshot Processing
// ============================================================================

/**
 * Crop headshot to FACE ONLY - removes shoulders/body and zooms into face.
 * This ensures the face dominates the frame without clipped body parts.
 */
async function cropToFaceOnly(headshotPath: string, outputPath: string): Promise<void> {
  // Get original dimensions
  const dimensions = await runCommand("magick", [
    "identify", "-format", "%wx%h", headshotPath
  ]);
  const [width, height] = dimensions.trim().split("x").map(Number);

  // Crop bottom 25% (removes shoulders/body) and zoom 135% into face
  await runCommand("magick", [
    headshotPath,
    "-gravity", "north",           // Anchor to top (face area)
    "-crop", `100%x75%+0+0`,       // Crop bottom 25% (shoulders/body)
    "+repage",
    "-resize", "135%",             // Zoom into face
    "-gravity", "center",
    "-extent", `${width}x${height}`, // Restore original dimensions
    outputPath,
  ]);
}

// ============================================================================
// Main Composition
// ============================================================================

async function composeThumbnail(args: CLIArgs): Promise<void> {
  const outputDir = dirname(args.output);
  const timestamp = Date.now();

  // Intermediate files
  const resizedBg = `${outputDir}/.yt-bg-${timestamp}.png`;
  const croppedHeadshot = `${outputDir}/.yt-cropped-${timestamp}.png`;
  const withHeadshot = `${outputDir}/.yt-headshot-${timestamp}.png`;
  const withText = `${outputDir}/.yt-text-${timestamp}.png`;

  const intermediates = [resizedBg, croppedHeadshot, withHeadshot, withText];

  try {
    console.log("🎨 Composing YouTube thumbnail...");

    // Step 1: Resize background to exact dimensions
    console.log("   📐 Resizing background to 1280x720...");
    await runCommand("magick", [
      args.background,
      "-resize", `${LAYOUT.width}x${LAYOUT.height}^`,
      "-gravity", "center",
      "-extent", `${LAYOUT.width}x${LAYOUT.height}`,
      resizedBg,
    ]);

    // Step 2: Crop headshot to FACE ONLY (remove shoulders/body)
    console.log(`   ✂️  Cropping headshot to face only...`);
    await cropToFaceOnly(args.headshot, croppedHeadshot);

    // Step 3: Composite headshot based on position
    console.log(`   👤 Adding headshot (${args.headshotPosition})...`);

    // Calculate headshot height - FULL HEIGHT inside border
    // Face should fill ~95% of vertical space inside the border
    const headshotHeight = LAYOUT.height - (LAYOUT.borderWidth * 2); // 688px

    // Determine gravity and offset based on position
    let gravity: string;
    let geometryOffset: string;

    switch (args.headshotPosition) {
      case "left":
        gravity = "west";
        geometryOffset = "+20+0";
        break;
      case "center":
        gravity = "center";
        geometryOffset = "+0+0";
        break;
      case "right":
        gravity = "east";
        geometryOffset = "+20+0";
        break;
      default:
        gravity = "west";
        geometryOffset = "+20+0";
    }

    await runCommand("magick", [
      resizedBg,
      "(",
        croppedHeadshot,  // Use cropped headshot (face only)
        "-resize", `x${headshotHeight}`,
      ")",
      "-gravity", gravity,
      "-geometry", geometryOffset,
      "-composite",
      withHeadshot,
    ]);

    // Step 4: Add text with stroke outline
    console.log("   📝 Adding text with stroke outlines...");

    // For left/right positions: create combined text block, center in available region
    // For center position: separate title (top) and subtitle (bottom)

    // Resolve colors (support preset names like "cyan" or hex like "#ff007c")
    const titleColorResolved = resolveColor(args.titleColor!);
    const subtitleColorResolved = resolveColor(args.subtitleColor!);

    if (args.headshotPosition === "center") {
      // CENTER: Title at top, subtitle at bottom (outside headshot zone)
      const titleWithStroke = `${outputDir}/.yt-title-${timestamp}.png`;
      const subtitleWithStroke = `${outputDir}/.yt-subtitle-${timestamp}.png`;
      intermediates.push(titleWithStroke, subtitleWithStroke);

      // Create title (WIDE canvas for 100pt BILLBOARD text)
      await runCommand("magick", [
        "-size", "1400x200",
        "xc:transparent",
        "-font", args.font!,
        "-pointsize", String(LAYOUT.titleSize),
        "-gravity", "center",
        "-stroke", "#000000", "-strokewidth", String(LAYOUT.titleStroke), "-fill", "none",
        "-annotate", "+0+0", args.title,
        "-stroke", "none", "-fill", titleColorResolved,
        "-annotate", "+0+0", args.title,
        "-trim", "+repage",
        titleWithStroke,
      ]);

      // Create subtitle (WIDE canvas for 50pt BILLBOARD text)
      await runCommand("magick", [
        "-size", "1400x120",
        "xc:transparent",
        "-font", args.font!,
        "-pointsize", String(LAYOUT.subtitleSize),
        "-gravity", "center",
        "-stroke", "#000000", "-strokewidth", String(LAYOUT.subtitleStroke), "-fill", "none",
        "-annotate", "+0+0", args.subtitle,
        "-stroke", "none", "-fill", subtitleColorResolved,
        "-annotate", "+0+0", args.subtitle,
        "-trim", "+repage",
        subtitleWithStroke,
      ]);

      // Composite title at top (inside border, above headshot zone)
      const withTitle = `${outputDir}/.yt-with-title-${timestamp}.png`;
      intermediates.push(withTitle);
      await runCommand("magick", [
        withHeadshot,
        titleWithStroke,
        "-gravity", "north",
        "-geometry", "+0+25",
        "-composite",
        withTitle,
      ]);

      // Composite subtitle at bottom (inside border, below headshot zone)
      await runCommand("magick", [
        withTitle,
        subtitleWithStroke,
        "-gravity", "south",
        "-geometry", "+0+25",
        "-composite",
        withText,
      ]);

    } else {
      // LEFT or RIGHT: Create text in safe zone (NEVER overlap headshot)

      // Calculate text zone center (opposite side from headshot)
      // Position at 62% or 38% of canvas width with generous margins
      // Account for 16px border + compression during final resize
      const textZoneCenter = args.headshotPosition === "left"
        ? Math.round(LAYOUT.width * 0.62) // 794px - text on right with generous margin
        : Math.round(LAYOUT.width * 0.38); // 486px - text on left with generous margin

      // Create title and subtitle with BILLBOARD sizing
      const titleImg = `${outputDir}/.yt-title-${timestamp}.png`;
      const subtitleImg = `${outputDir}/.yt-subtitle-${timestamp}.png`;
      intermediates.push(titleImg, subtitleImg);

      // Create title - 100pt BILLBOARD text on WIDE canvas (prevents cutoff)
      await runCommand("magick", [
        "-size", "1400x200",
        "xc:transparent",
        "-font", args.font!,
        "-gravity", "center",
        "-pointsize", String(LAYOUT.titleSize),
        "-stroke", "#000000", "-strokewidth", String(LAYOUT.titleStroke), "-fill", "none",
        "-annotate", "+0+0", args.title,
        "-stroke", "none", "-fill", titleColorResolved,
        "-annotate", "+0+0", args.title,
        "-trim", "+repage",
        titleImg,
      ]);

      // Create subtitle - 50pt BILLBOARD text on WIDE canvas (prevents cutoff)
      await runCommand("magick", [
        "-size", "1400x120",
        "xc:transparent",
        "-font", args.font!,
        "-gravity", "center",
        "-pointsize", String(LAYOUT.subtitleSize),
        "-stroke", "#000000", "-strokewidth", String(LAYOUT.subtitleStroke), "-fill", "none",
        "-annotate", "+0+0", args.subtitle,
        "-stroke", "none", "-fill", subtitleColorResolved,
        "-annotate", "+0+0", args.subtitle,
        "-trim", "+repage",
        subtitleImg,
      ]);

      // Position text at center of text zone using absolute coordinates
      // Composite title above center
      const withTitle = `${outputDir}/.yt-with-title-${timestamp}.png`;
      intermediates.push(withTitle);

      // Calculate absolute X position for centering in text zone
      // We'll use page geometry to position at exact coordinates
      // Larger fonts need more vertical spread
      const titleY = Math.round(LAYOUT.height / 2) - 80; // Above center (for 100pt)
      const subtitleY = Math.round(LAYOUT.height / 2) + 50; // Below center (for 50pt)

      await runCommand("magick", [
        withHeadshot,
        titleImg,
        "-gravity", "north",
        "-geometry", `+${textZoneCenter - LAYOUT.width/2}+${titleY}`,
        "-composite",
        withTitle,
      ]);

      // Composite subtitle below title
      await runCommand("magick", [
        withTitle,
        subtitleImg,
        "-gravity", "north",
        "-geometry", `+${textZoneCenter - LAYOUT.width/2}+${subtitleY}`,
        "-composite",
        withText,
      ]);
    }

    // Step 5: Add colored border
    console.log("   🖼️  Adding border...");
    await runCommand("magick", [
      withText,
      "-bordercolor", args.borderColor!,
      "-border", String(LAYOUT.borderWidth),
      "-resize", `${LAYOUT.width}x${LAYOUT.height}!`,
      args.output,
    ]);

    console.log(`✅ Thumbnail saved to ${args.output}`);

    // Verify dimensions
    const identify = await runCommand("magick", ["identify", "-format", "%wx%h", args.output]);
    console.log(`   📏 Dimensions: ${identify.trim()}`);

  } finally {
    // Cleanup intermediate files
    for (const file of intermediates) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await composeThumbnail(args);
  } catch (error) {
    if (error instanceof CLIError) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(error.exitCode);
    }
    throw error;
  }
}

main();
