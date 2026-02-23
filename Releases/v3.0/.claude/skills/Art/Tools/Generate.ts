#!/usr/bin/env bun

/**
 * generate - PAI Image Generation CLI
 *
 * Generate images using Flux 1.1 Pro, Nano Banana, Nano Banana Pro, or GPT-image-1.
 * Follows llcli pattern for deterministic, composable CLI design.
 *
 * Usage:
 *   generate --model nano-banana-pro --prompt "..." --size 16:9 --output /tmp/image.png
 *
 * @see ~/.claude/skills/art/README.md
 */

import Replicate from "replicate";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { writeFile, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

// ============================================================================
// Environment Loading
// ============================================================================

/**
 * Load environment variables from ${PAI_DIR}/.env
 * This ensures API keys are available regardless of how the CLI is invoked
 */
async function loadEnv(): Promise<void> {
  const paiDir = process.env.PAI_DIR || resolve(process.env.HOME!, '.claude');
  const envPath = resolve(paiDir, '.env');
  try {
    const envContent = await readFile(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Only set if not already defined (allow overrides from shell)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // Silently continue if .env doesn't exist - rely on shell env vars
  }
}

// ============================================================================
// Types
// ============================================================================

type Model = "flux" | "nano-banana" | "nano-banana-pro" | "gpt-image-1";
type ReplicateSize = "1:1" | "16:9" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "21:9";
type OpenAISize = "1024x1024" | "1536x1024" | "1024x1536";
type GeminiSize = "1K" | "2K" | "4K";
type Size = ReplicateSize | OpenAISize | GeminiSize;

interface CLIArgs {
  model: Model;
  prompt: string;
  size: Size;
  output: string;
  creativeVariations?: number;
  aspectRatio?: ReplicateSize; // For Gemini models
  transparent?: boolean; // Enable transparent background
  referenceImages?: string[]; // Reference image paths (Nano Banana Pro only) - up to 14 total
  removeBg?: boolean; // Remove background after generation using remove.bg API
  addBg?: string; // Add background color (hex) to transparent image
  thumbnail?: boolean; // Generate additional thumbnail with #EAE9DF background for social previews
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  model: "flux" as Model,
  size: "16:9" as Size,
  output: `${process.env.HOME}/Downloads/ul-image.png`,
};

const REPLICATE_SIZES: ReplicateSize[] = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "21:9"];
const OPENAI_SIZES: OpenAISize[] = ["1024x1024", "1536x1024", "1024x1536"];
const GEMINI_SIZES: GeminiSize[] = ["1K", "2K", "4K"];

// Aspect ratio mapping for Gemini (used with image size like 2K)
const GEMINI_ASPECT_RATIOS: ReplicateSize[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

// ============================================================================
// Error Handling
// ============================================================================

class CLIError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = "CLIError";
  }
}

function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  console.error(`❌ Unknown error:`, error);
  process.exit(1);
}

// ============================================================================
// Image Format Detection
// ============================================================================

/**
 * Detect actual image format from magic bytes.
 * Prevents MIME type mismatch when API returns different format than requested.
 */
function detectImageFormat(data: Buffer | Uint8Array): { format: string; ext: string; mime: string } | null {
  if (data.length < 12) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
    return { format: "png", ext: ".png", mime: "image/png" };
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return { format: "jpeg", ext: ".jpg", mime: "image/jpeg" };
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50)
    return { format: "webp", ext: ".webp", mime: "image/webp" };
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46)
    return { format: "gif", ext: ".gif", mime: "image/gif" };
  return null;
}

/**
 * Save image data with correct file extension based on actual content format.
 * Returns the final path (may differ from requested if format mismatch detected).
 */
async function saveImage(data: Buffer | Uint8Array | any, requestedPath: string): Promise<string> {
  const buffer = data instanceof Buffer ? data : Buffer.from(data as any);
  const detected = detectImageFormat(buffer);
  if (detected) {
    const requestedExt = extname(requestedPath).toLowerCase();
    if (requestedExt && requestedExt !== detected.ext) {
      const correctedPath = requestedPath.replace(/\.[^.]+$/, detected.ext);
      console.warn(`⚠️ API returned ${detected.format.toUpperCase()} data (requested ${requestedExt.slice(1).toUpperCase()}). Saving as ${correctedPath}`);
      await writeFile(correctedPath, buffer);
      return correctedPath;
    }
  }
  await writeFile(requestedPath, buffer);
  return requestedPath;
}

/**
 * Detect MIME type from image file content (magic bytes), falling back to extension.
 */
async function detectMimeType(filePath: string): Promise<string> {
  try {
    const data = await readFile(filePath);
    const detected = detectImageFormat(data);
    if (detected) return detected.mime;
  } catch {
    // Fall through to extension-based detection
  }
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: throw new CLIError(`Unsupported image format: ${ext}. Supported: .png, .jpg, .jpeg, .webp`);
  }
}

// ============================================================================
// Help Text
// ============================================================================

// PAI directory for documentation paths
const PAI_DIR = process.env.PAI_DIR || `${process.env.HOME}/.claude`;

function showHelp(): void {
  console.log(`
generate - PAI Image Generation CLI

Generate images using Flux 1.1 Pro, Nano Banana, or GPT-image-1.

USAGE:
  generate --model <model> --prompt "<prompt>" [OPTIONS]

REQUIRED:
  --model <model>      Model to use: flux, nano-banana, nano-banana-pro, gpt-image-1
  --prompt <text>      Image generation prompt (quote if contains spaces)

OPTIONS:
  --size <size>              Image size/aspect ratio (default: 16:9)
                             Replicate (flux, nano-banana): 1:1, 16:9, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 21:9
                             OpenAI (gpt-image-1): 1024x1024, 1536x1024, 1024x1536
                             Gemini (nano-banana-pro): 1K, 2K, 4K (resolution); aspect ratio inferred from context or defaults to 16:9
  --aspect-ratio <ratio>     Aspect ratio for Gemini nano-banana-pro (default: 16:9)
                             Options: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
  --output <path>            Output file path (default: /tmp/ul-image.png)
  --reference-image <path>   Reference image for style/character consistency (Nano Banana Pro only)
                             Can specify MULTIPLE times for improved consistency
                             Accepts: PNG, JPEG, WebP images
                             API Limits: Up to 5 human refs, 6 object refs, 14 total max
  --transparent              Enable transparent background (adds transparency instructions to prompt)
                             Note: Not all models support transparency natively; may require post-processing
  --remove-bg                Remove background after generation using remove.bg API
                             Creates true transparency by removing the generated background
  --add-bg <hex>             Add background color to a transparent image (e.g., "#EAE9DF")
                             Useful for creating thumbnails/social previews from transparent images
  --thumbnail                Generate BOTH transparent AND thumbnail versions for blog headers
                             Creates: output.png (transparent) + output-thumb.png (#EAE9DF background)
                             Automatically enables --remove-bg
  --creative-variations <n>  Generate N variations (appends -v1, -v2, etc. to output filename)
                             Use with the be-creative skill for true prompt diversity
                             CLI mode: generates N images with same prompt (tests model variability)
  --help, -h                 Show this help message

EXAMPLES:
  # Generate blog header with Nano Banana Pro (16:9, 2K quality)
  generate --model nano-banana-pro --prompt "Abstract editorial illustration..." --size 2K --aspect-ratio 16:9

  # Generate high-res 4K image with Nano Banana Pro
  generate --model nano-banana-pro --prompt "Editorial cover..." --size 4K --aspect-ratio 3:2

  # Generate blog header with original Nano Banana (16:9)
  generate --model nano-banana --prompt "Abstract editorial illustration..." --size 16:9

  # Generate square image with Flux
  generate --model flux --prompt "Minimal geometric art..." --size 1:1 --output /tmp/header.png

  # Generate portrait with GPT-image-1
  generate --model gpt-image-1 --prompt "Editorial cover..." --size 1024x1536

  # Generate 3 creative variations (for testing model variability)
  generate --model gpt-image-1 --prompt "..." --creative-variations 3 --output /tmp/essay.png
  # Outputs: /tmp/essay-v1.png, /tmp/essay-v2.png, /tmp/essay-v3.png

  # Single reference image for style guidance (Nano Banana Pro only)
  generate --model nano-banana-pro --prompt "Tokyo Night themed illustration..." \\
    --reference-image /tmp/style-reference.png --size 2K --aspect-ratio 16:9

  # MULTIPLE reference images for character consistency (Nano Banana Pro only)
  generate --model nano-banana-pro --prompt "Person from references at a party..." \\
    --reference-image face1.jpg --reference-image face2.jpg --reference-image face3.jpg \\
    --size 2K --aspect-ratio 16:9

NOTE: For true creative diversity with different prompts, use the creative workflow which
integrates the be-creative skill. CLI creative mode generates multiple images with the SAME prompt.

MULTI-REFERENCE LIMITS (Gemini API):
  - Up to 5 human reference images for character consistency
  - Up to 6 object reference images
  - Maximum 14 total reference images per request

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN  Required for flux and nano-banana models
  OPENAI_API_KEY       Required for gpt-image-1 model
  GOOGLE_API_KEY       Required for nano-banana-pro model
  REMOVEBG_API_KEY     Required for --remove-bg flag

ERROR CODES:
  0  Success
  1  General error (invalid arguments, API error, file write error)

MORE INFO:
  Documentation: ${PAI_DIR}/skills/Art/README.md
  Source: ${PAI_DIR}/skills/Art/Tools/Generate.ts
`);
  process.exit(0);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
  }

  const parsed: Partial<CLIArgs> = {
    model: DEFAULTS.model,
    output: DEFAULTS.output,
  };

  // Collect reference images into array
  const referenceImages: string[] = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];

    if (!flag.startsWith("--")) {
      throw new CLIError(`Invalid flag: ${flag}. Flags must start with --`);
    }

    const key = flag.slice(2);

    // Handle boolean flags (no value)
    if (key === "transparent") {
      parsed.transparent = true;
      continue;
    }
    if (key === "remove-bg") {
      parsed.removeBg = true;
      continue;
    }
    if (key === "thumbnail") {
      parsed.thumbnail = true;
      parsed.removeBg = true; // Thumbnail mode requires remove-bg
      continue;
    }

    // Handle flags with values
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      throw new CLIError(`Missing value for flag: ${flag}`);
    }

    switch (key) {
      case "model":
        if (value !== "flux" && value !== "nano-banana" && value !== "nano-banana-pro" && value !== "gpt-image-1") {
          throw new CLIError(`Invalid model: ${value}. Must be: flux, nano-banana, nano-banana-pro, or gpt-image-1`);
        }
        parsed.model = value;
        i++; // Skip next arg (value)
        break;
      case "prompt":
        parsed.prompt = value;
        i++; // Skip next arg (value)
        break;
      case "size":
        parsed.size = value as Size;
        i++; // Skip next arg (value)
        break;
      case "aspect-ratio":
        parsed.aspectRatio = value as ReplicateSize;
        i++; // Skip next arg (value)
        break;
      case "output":
        parsed.output = value;
        i++; // Skip next arg (value)
        break;
      case "reference-image":
        // Collect multiple reference images into array
        referenceImages.push(value);
        i++; // Skip next arg (value)
        break;
      case "creative-variations":
        const variations = parseInt(value, 10);
        if (isNaN(variations) || variations < 1 || variations > 10) {
          throw new CLIError(`Invalid creative-variations: ${value}. Must be 1-10`);
        }
        parsed.creativeVariations = variations;
        i++; // Skip next arg (value)
        break;
      case "add-bg":
        // Validate hex color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
          throw new CLIError(`Invalid hex color: ${value}. Must be in format #RRGGBB (e.g., #EAE9DF)`);
        }
        parsed.addBg = value;
        i++; // Skip next arg (value)
        break;
      default:
        throw new CLIError(`Unknown flag: ${flag}`);
    }
  }

  // Assign collected reference images if any
  if (referenceImages.length > 0) {
    parsed.referenceImages = referenceImages;
  }

  // Validate required arguments
  if (!parsed.prompt) {
    throw new CLIError("Missing required argument: --prompt");
  }

  if (!parsed.model) {
    throw new CLIError("Missing required argument: --model");
  }

  // Validate reference-image is only used with nano-banana-pro
  if (parsed.referenceImages && parsed.referenceImages.length > 0 && parsed.model !== "nano-banana-pro") {
    throw new CLIError("--reference-image is only supported with --model nano-banana-pro");
  }

  // Validate reference image count (API limits: 5 human, 6 object, 14 total max)
  if (parsed.referenceImages && parsed.referenceImages.length > 14) {
    throw new CLIError(`Too many reference images: ${parsed.referenceImages.length}. Maximum is 14 total (5 human, 6 object)`);
  }

  // Set model-appropriate default size if not explicitly provided
  if (!parsed.size) {
    switch (parsed.model) {
      case "gpt-image-1":
        parsed.size = "1024x1024";
        break;
      case "nano-banana-pro":
        parsed.size = "2K";
        break;
      default: // flux, nano-banana
        parsed.size = "16:9";
        break;
    }
  }

  // Validate size based on model
  if (parsed.model === "gpt-image-1") {
    if (!OPENAI_SIZES.includes(parsed.size as OpenAISize)) {
      throw new CLIError(`Invalid size for gpt-image-1: ${parsed.size}. Must be: ${OPENAI_SIZES.join(", ")}`);
    }
  } else if (parsed.model === "nano-banana-pro") {
    if (!GEMINI_SIZES.includes(parsed.size as GeminiSize)) {
      throw new CLIError(`Invalid size for nano-banana-pro: ${parsed.size}. Must be: ${GEMINI_SIZES.join(", ")}`);
    }
    // Validate aspect ratio if provided
    if (parsed.aspectRatio && !GEMINI_ASPECT_RATIOS.includes(parsed.aspectRatio)) {
      throw new CLIError(`Invalid aspect-ratio for nano-banana-pro: ${parsed.aspectRatio}. Must be: ${GEMINI_ASPECT_RATIOS.join(", ")}`);
    }
    // Default to 16:9 if not specified
    if (!parsed.aspectRatio) {
      parsed.aspectRatio = "16:9";
    }
  } else {
    if (!REPLICATE_SIZES.includes(parsed.size as ReplicateSize)) {
      throw new CLIError(`Invalid size for ${parsed.model}: ${parsed.size}. Must be: ${REPLICATE_SIZES.join(", ")}`);
    }
  }

  return parsed as CLIArgs;
}

// ============================================================================
// Prompt Enhancement
// ============================================================================

function enhancePromptForTransparency(prompt: string): string {
  const transparencyPrefix = "CRITICAL: Transparent background (PNG with alpha channel) - NO background color, pure transparency. Object floating in transparent space. ";
  return transparencyPrefix + prompt;
}

// ============================================================================
// Background Removal
// ============================================================================

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Background Operations
// ============================================================================

/**
 * Add a solid background color to a transparent PNG image
 * Uses ImageMagick to composite the transparent image onto a colored background
 */
async function addBackgroundColor(inputPath: string, outputPath: string, hexColor: string): Promise<void> {
  console.log(`🎨 Adding background color ${hexColor} to image...`);

  // Use ImageMagick to composite the transparent image onto a colored background
  // -background sets the fill color, -flatten composites onto that background
  const command = `magick "${inputPath}" -background "${hexColor}" -flatten "${outputPath}"`;

  try {
    await execAsync(command);
    console.log(`✅ Thumbnail saved to ${outputPath}`);
  } catch (error) {
    throw new CLIError(`Failed to add background color: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function removeBackground(imagePath: string): Promise<void> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) {
    throw new CLIError("Missing environment variable: REMOVEBG_API_KEY");
  }

  console.log("🔲 Removing background with remove.bg API...");

  const imageBuffer = await readFile(imagePath);
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
    throw new CLIError(`remove.bg API error: ${response.status} - ${errorText}`);
  }

  const resultBuffer = Buffer.from(await response.arrayBuffer());
  await writeFile(imagePath, resultBuffer);
  console.log("✅ Background removed successfully");
}

// ============================================================================
// Image Generation
// ============================================================================

async function generateWithFlux(prompt: string, size: ReplicateSize, output: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new CLIError("Missing environment variable: REPLICATE_API_TOKEN");
  }

  const replicate = new Replicate({ auth: token });

  console.log("🎨 Generating with Flux 1.1 Pro...");

  const result = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: {
      prompt,
      aspect_ratio: size,
      output_format: "png",
      output_quality: 95,
      prompt_upsampling: false,
    },
  });

  const finalPath = await saveImage(result, output);
  console.log(`✅ Image saved to ${finalPath}`);
  return finalPath;
}

async function generateWithNanoBanana(prompt: string, size: ReplicateSize, output: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new CLIError("Missing environment variable: REPLICATE_API_TOKEN");
  }

  const replicate = new Replicate({ auth: token });

  console.log("🍌 Generating with Nano Banana...");

  const result = await replicate.run("google/nano-banana", {
    input: {
      prompt,
      aspect_ratio: size,
      output_format: "png",
    },
  });

  const finalPath = await saveImage(result, output);
  console.log(`✅ Image saved to ${finalPath}`);
  return finalPath;
}

async function generateWithGPTImage(prompt: string, size: OpenAISize, output: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new CLIError("Missing environment variable: OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });

  console.log("🤖 Generating with GPT-image-1...");

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    n: 1,
  });

  const imageData = response.data[0].b64_json;
  if (!imageData) {
    throw new CLIError("No image data returned from OpenAI API");
  }

  const imageBuffer = Buffer.from(imageData, "base64");
  const finalPath = await saveImage(imageBuffer, output);
  console.log(`✅ Image saved to ${finalPath}`);
  return finalPath;
}

async function generateWithNanoBananaPro(
  prompt: string,
  size: GeminiSize,
  aspectRatio: ReplicateSize,
  output: string,
  referenceImages?: string[]
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new CLIError("Missing environment variable: GOOGLE_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey });

  if (referenceImages && referenceImages.length > 0) {
    console.log(`🍌✨ Generating with Nano Banana Pro (Gemini 3 Pro) at ${size} ${aspectRatio} with ${referenceImages.length} reference image(s)...`);
  } else {
    console.log(`🍌✨ Generating with Nano Banana Pro (Gemini 3 Pro) at ${size} ${aspectRatio}...`);
  }

  // Prepare content parts
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // Add all reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    for (const referenceImage of referenceImages) {
      // Read image file
      const imageBuffer = await readFile(referenceImage);
      const imageBase64 = imageBuffer.toString("base64");

      // Detect MIME type from actual file content (magic bytes), not just extension
      const mimeType = await detectMimeType(referenceImage);

      parts.push({
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      });
    }
  }

  // Add text prompt
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [{ parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: size,
      },
    },
  });

  // Extract image data from response
  let imageData: string | undefined;

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0].content.parts;
    for (const part of parts) {
      // Check if this part contains inline image data
      if (part.inlineData && part.inlineData.data) {
        imageData = part.inlineData.data;
        break;
      }
    }
  }

  if (!imageData) {
    throw new CLIError("No image data returned from Gemini API");
  }

  const imageBuffer = Buffer.from(imageData, "base64");
  const finalPath = await saveImage(imageBuffer, output);
  console.log(`✅ Image saved to ${finalPath}`);
  return finalPath;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  try {
    // Load API keys from ${PAI_DIR}/.env
    await loadEnv();

    const args = parseArgs(process.argv);

    // Enhance prompt for transparency if requested
    const finalPrompt = args.transparent
      ? enhancePromptForTransparency(args.prompt)
      : args.prompt;

    if (args.transparent) {
      console.log("🔲 Transparent background mode enabled");
      console.log("💡 Note: Not all models support transparency natively; may require post-processing\n");
    }

    // Handle creative variations mode
    if (args.creativeVariations && args.creativeVariations > 1) {
      console.log(`🎨 Creative Mode: Generating ${args.creativeVariations} variations...`);
      console.log(`💡 Note: CLI mode uses same prompt for all variations (tests model variability)`);
      console.log(`   For true creative diversity, use the creative workflow with be-creative skill\n`);

      const basePath = args.output.replace(/\.[^.]+$/, "");
      const promises: Promise<string>[] = [];

      for (let i = 1; i <= args.creativeVariations; i++) {
        const varOutput = `${basePath}-v${i}.png`;
        console.log(`Variation ${i}/${args.creativeVariations}: ${varOutput}`);

        if (args.model === "flux") {
          promises.push(generateWithFlux(finalPrompt, args.size as ReplicateSize, varOutput));
        } else if (args.model === "nano-banana") {
          promises.push(generateWithNanoBanana(finalPrompt, args.size as ReplicateSize, varOutput));
        } else if (args.model === "nano-banana-pro") {
          promises.push(
            generateWithNanoBananaPro(
              finalPrompt,
              args.size as GeminiSize,
              args.aspectRatio!,
              varOutput,
              args.referenceImages
            )
          );
        } else if (args.model === "gpt-image-1") {
          promises.push(generateWithGPTImage(finalPrompt, args.size as OpenAISize, varOutput));
        }
      }

      const actualPaths = await Promise.all(promises);
      console.log(`\n✅ Generated ${args.creativeVariations} variations`);
      console.log(`   Files: ${actualPaths.join(", ")}`);
      return;
    }

    // Standard single image generation — track actual output path (may differ if format corrected)
    let actualOutput: string = args.output;
    if (args.model === "flux") {
      actualOutput = await generateWithFlux(finalPrompt, args.size as ReplicateSize, args.output);
    } else if (args.model === "nano-banana") {
      actualOutput = await generateWithNanoBanana(finalPrompt, args.size as ReplicateSize, args.output);
    } else if (args.model === "nano-banana-pro") {
      actualOutput = await generateWithNanoBananaPro(
        finalPrompt,
        args.size as GeminiSize,
        args.aspectRatio!,
        args.output,
        args.referenceImages
      );
    } else if (args.model === "gpt-image-1") {
      actualOutput = await generateWithGPTImage(finalPrompt, args.size as OpenAISize, args.output);
    }

    // Remove background if requested (use actual output path)
    if (args.removeBg) {
      await removeBackground(actualOutput);
    }

    // Add background color if requested (standalone mode)
    if (args.addBg && !args.thumbnail) {
      // For standalone --add-bg, modify the image in place
      const tempPath = actualOutput.replace(/\.[^.]+$/, "-temp.png");
      await addBackgroundColor(actualOutput, tempPath, args.addBg);
      // Replace original with the one with background
      const { rename } = await import("node:fs/promises");
      await rename(tempPath, actualOutput);
    }

    // Generate thumbnail with background color if requested (blog header mode)
    if (args.thumbnail) {
      const thumbPath = actualOutput.replace(/\.[^.]+$/, "-thumb.png");
      const THUMBNAIL_BG_COLOR = "#EAE9DF"; // Brand background color for social previews
      await addBackgroundColor(actualOutput, thumbPath, THUMBNAIL_BG_COLOR);
      console.log(`\n📸 Blog header mode: Created both versions`);
      console.log(`   Transparent: ${actualOutput}`);
      console.log(`   Thumbnail:   ${thumbPath}`);
    }
  } catch (error) {
    handleError(error);
  }
}

main();
