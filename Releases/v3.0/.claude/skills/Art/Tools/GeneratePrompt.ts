#!/usr/bin/env bun

/**
 * UL Abstract Illustration Prompt Generator
 *
 * ⚠️ DEPRECATED - THIS TOOL USES OLD CHARACTER-BASED SYSTEM
 * ⚠️ NEEDS COMPLETE REWRITE FOR ABSTRACT SHAPES/IMPRESSIONS ONLY
 * ⚠️ DO NOT USE UNTIL UPDATED
 *
 * This tool needs to be rewritten to generate prompts using:
 * - Abstract shapes and forms (NO characters)
 * - Visual motifs (networks, flows, structures, horizons)
 * - Composition approaches (centered, horizon, flow, opposition, layered)
 *
 * Usage (when updated):
 *   bun run generate-prompt.ts --input essay.md --type essay-illustration
 *   bun run generate-prompt.ts --input essay.md --type blog-header --format json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================================
// Types
// ============================================================================

type CompositionType = "observation" | "horizon" | "dialogue" | "workshop" | "aura";
type CharacterFocus = "maya" | "kai" | "both";
type TokyoNightColor =
  | "Electric Blue"
  | "Vivid Purple"
  | "Bright Cyan"
  | "Neon Green"
  | "Warm Yellow"
  | "Soft Magenta";
type Human3Motif = "agents" | "networks" | "aura" | "substrates" | "horizons" | "ts_stacks";
type BackgroundType = "sepia" | "dark_tokyo_night";
type OutputFormat = "text" | "json";

interface PromptConfig {
  essayTheme: string;
  characterFocus: CharacterFocus;
  compositionType: CompositionType;
  emotionalToneDescription: string;
  coreObjectDescription: string;
  overallMood: string;
  accentColors: TokyoNightColor[];
  human3Motifs: Human3Motif[];
  backgroundType: BackgroundType;
  imageType: "essay-illustration" | "blog-header";
}

interface PromptOutput {
  essay_theme: string;
  character_focus: CharacterFocus;
  composition_type: CompositionType;
  emotional_tone_description: string;
  core_object_description: string;
  overall_mood: string;
  accent_colors: string[];
  human3_motifs: string[];
  image_prompt: string;
  suggested_filename?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ART_AESTHETIC_PATH = resolve(
  process.env.HOME!,
  ".claude/skills/PAI/Aesthetic.md"
);

const COLOR_HEX_MAP: Record<TokyoNightColor, string> = {
  "Electric Blue": "#7aa2f7",
  "Vivid Purple": "#bb9af7",
  "Bright Cyan": "#7dcfff",
  "Neon Green": "#9ece6a",
  "Warm Yellow": "#e0af68",
  "Soft Magenta": "#ff007c",
};

const CHARACTER_DESCRIPTIONS = {
  maya: `Maya is a young, highly curious girl with a round head, simple short hair, and big round glasses (her signature feature). She has a stick-figure body with thin limbs and a slightly oversized head, with minimal facial features (dots for eyes, simple line for mouth when needed).`,
  kai: `Kai is a young boy with a slightly oval head, a soft messy hair tuft on top (his signature feature), and NO glasses. He wears a simple t-shirt and shorts or pants. He has a stick-figure body with thin limbs and a slightly oversized head, with minimal facial features.`,
  both: `Two recurring child characters: Maya and Kai. Maya is a young, highly curious girl with a round head, simple short hair, and big round glasses. Kai is a young boy with a slightly oval head, a soft messy hair tuft, and a simple t-shirt and shorts or pants. Both have stick-figure bodies with thin limbs and slightly oversized heads, with minimal facial features.`,
};

// ============================================================================
// Helpers
// ============================================================================

function parseArgs(): {
  input: string;
  type: "essay-illustration" | "blog-header";
  format: OutputFormat;
  composition?: CompositionType;
  character?: CharacterFocus;
  colors?: string;
  motifs?: string;
} {
  const args = process.argv.slice(2);
  const parsed: any = {
    type: "essay-illustration",
    format: "text",
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    parsed[key] = value;
  }

  return parsed;
}

function readEssayContent(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    console.error(`Error reading essay file: ${path}`);
    throw error;
  }
}

function analyzeContent(essayContent: string): {
  theme: string;
  tone: string;
  metaphors: string[];
  concepts: string[];
} {
  // Simple content analysis
  // In a production version, this could use more sophisticated NLP or LLM analysis

  const lines = essayContent.split("\n");
  const firstParagraph = lines.slice(0, 5).join(" ");

  // Extract title (first # line)
  const titleLine = lines.find((line) => line.startsWith("# "));
  const theme = titleLine?.replace(/^# /, "") || "essay topic";

  // Simple tone detection based on keywords
  const contentLower = essayContent.toLowerCase();
  let tone = "analytical curiosity";

  if (contentLower.includes("future") || contentLower.includes("possibility")) {
    tone = "cautious wonder about future possibilities";
  } else if (contentLower.includes("build") || contentLower.includes("create")) {
    tone = "collaborative optimism";
  } else if (contentLower.includes("problem") || contentLower.includes("challenge")) {
    tone = "analytical focus on challenges and opportunities";
  }

  return {
    theme,
    tone,
    metaphors: [], // Could be extracted with more sophisticated analysis
    concepts: [], // Could be extracted with more sophisticated analysis
  };
}

function selectComposition(
  essayContent: string,
  override?: CompositionType
): CompositionType {
  if (override) return override;

  const contentLower = essayContent.toLowerCase();

  if (contentLower.includes("future") || contentLower.includes("horizon")) {
    return "horizon";
  } else if (contentLower.includes("together") || contentLower.includes("collaborate")) {
    return "dialogue";
  } else if (contentLower.includes("build") || contentLower.includes("create")) {
    return "workshop";
  } else if (contentLower.includes("personal") || contentLower.includes("context")) {
    return "aura";
  }

  return "observation"; // Default
}

function selectCharacter(
  compositionType: CompositionType,
  override?: CharacterFocus
): CharacterFocus {
  if (override) return override;

  if (compositionType === "dialogue") return "both";
  if (compositionType === "workshop") return "kai";
  if (compositionType === "observation") return "maya";

  return "both"; // Default
}

function selectColors(
  essayContent: string,
  override?: string
): TokyoNightColor[] {
  if (override) {
    return override.split(",").map((c) => c.trim() as TokyoNightColor);
  }

  const contentLower = essayContent.toLowerCase();

  if (contentLower.includes("security") || contentLower.includes("privacy")) {
    return ["Vivid Purple"];
  } else if (contentLower.includes("tool") || contentLower.includes("productivity")) {
    return ["Bright Cyan"];
  } else if (contentLower.includes("human") || contentLower.includes("growth")) {
    return ["Neon Green"];
  }

  return ["Electric Blue"]; // Default for AI/tech
}

function selectMotifs(
  essayContent: string,
  override?: string
): Human3Motif[] {
  if (override) {
    return override.split(",").map((m) => m.trim() as Human3Motif);
  }

  const motifs: Human3Motif[] = [];
  const contentLower = essayContent.toLowerCase();

  if (contentLower.includes("agent") || contentLower.includes("ai")) {
    motifs.push("agents");
  }
  if (contentLower.includes("network") || contentLower.includes("connect")) {
    motifs.push("networks");
  }
  if (contentLower.includes("future") || contentLower.includes("horizon")) {
    motifs.push("horizons");
  }
  if (contentLower.includes("personal") || contentLower.includes("context")) {
    motifs.push("aura");
  }

  return motifs.slice(0, 2); // Max 2 motifs
}

function buildVisualMetaphor(
  essayContent: string,
  compositionType: CompositionType,
  characterFocus: CharacterFocus
): string {
  // This is a simplified version. In production, this would use more sophisticated
  // content analysis to generate specific visual metaphors from essay content.

  const analysis = analyzeContent(essayContent);

  let metaphor = "";

  switch (compositionType) {
    case "observation":
      metaphor = `${characterFocus === "maya" ? "Maya" : "Kai"} positioned in the left quarter of the frame, small and observing with ${analysis.tone}, looking at a large visual element on the right that represents the core concept of ${analysis.theme}`;
      break;
    case "horizon":
      metaphor = `${characterFocus === "both" ? "Maya and Kai" : characterFocus === "maya" ? "Maya" : "Kai"} in the foreground, facing a wide distant horizon filled with tiny elements representing future possibilities related to ${analysis.theme}`;
      break;
    case "dialogue":
      metaphor = `Maya and Kai positioned with space between them, interacting with a shared element or concept in the center, representing different perspectives on ${analysis.theme}`;
      break;
    case "workshop":
      metaphor = `${characterFocus === "kai" ? "Kai" : "Both Maya and Kai"} actively building or creating, with elements spreading horizontally showing the process of making something related to ${analysis.theme}`;
      break;
    case "aura":
      metaphor = `${characterFocus === "maya" ? "Maya" : characterFocus === "kai" ? "Kai" : "The character"} surrounded by a soft, translucent aura bubble containing tiny symbolic icons representing aspects of ${analysis.theme}`;
      break;
  }

  return metaphor;
}

function buildMotifsDescription(motifs: Human3Motif[]): string {
  if (motifs.length === 0) return "";

  const descriptions: string[] = [];

  for (const motif of motifs) {
    switch (motif) {
      case "agents":
        descriptions.push("tiny cute pill-shaped agent robots");
        break;
      case "networks":
        descriptions.push("thin network lines connecting small nodes");
        break;
      case "aura":
        descriptions.push(
          "soft aura bubbles around people or robots with tiny symbolic icons like hearts, book-shapes, leaves, or stars (icons must be purely visual and contain no letters or numbers)"
        );
        break;
      case "substrates":
        descriptions.push("horizontal platform layers suggesting infrastructure");
        break;
      case "horizons":
        descriptions.push("distant horizon line filled with tiny silhouettes");
        break;
      case "ts_stacks":
        descriptions.push("stacks of thin blank rectangular sheets");
        break;
    }
  }

  return `Optionally include Human 3.0 motifs that fit the essay: ${descriptions.join(", ")}.`;
}

// ============================================================================
// Prompt Generation
// ============================================================================

function generatePrompt(config: PromptConfig): string {
  const {
    essayTheme,
    characterFocus,
    compositionType,
    emotionalToneDescription,
    coreObjectDescription,
    overallMood,
    accentColors,
    human3Motifs,
    backgroundType,
    imageType,
  } = config;

  // Build color description
  const colorDescriptions = accentColors
    .map((color) => `${color} ${COLOR_HEX_MAP[color]}`)
    .join(" and ");

  // Build character descriptions
  const characterDesc = CHARACTER_DESCRIPTIONS[characterFocus];

  // Build motifs description
  const motifsDesc = buildMotifsDescription(human3Motifs);

  // Background description
  const backgroundDesc =
    backgroundType === "sepia"
      ? "Soft sepia-toned paper background with lots of empty space."
      : "Dark gradient background transitioning from #1a1b26 to #24283b.";

  // Base prompt
  let prompt = `Minimal Tokyo Night–inspired illustration for ${imageType === "blog-header" ? "a blog post" : "an essay"} about ${essayTheme}.

${backgroundDesc} Thin, slightly imperfect deep navy linework and flat color fills only, no shading. Tokyo Night–inspired accent color${accentColors.length > 1 ? "s" : ""} ${colorDescriptions} used sparingly.

${characterDesc}

Show ${characterFocus === "both" ? "Maya and Kai" : characterFocus} in a ${compositionType} scene${imageType === "blog-header" ? " optimized for horizontal 16:9 composition" : ""}. ${emotionalToneDescription.charAt(0).toUpperCase() + emotionalToneDescription.slice(1)}, interacting with ${coreObjectDescription}.

${motifsDesc}

The overall mood should be ${overallMood}. No text, no letters, no numbers, and no labels anywhere in the image.`;

  // Add blog header specifications if applicable
  if (imageType === "blog-header") {
    prompt += `

=== BLOG HEADER SPECIFICATIONS ===

Output format: PNG, 1536x1024 (16:9 landscape for blog header)
Horizontal composition optimized for wide format
Primary focus in upper two-thirds of frame
Maximum quality settings (95% quality)
Editorial cover image quality like The Atlantic or New Yorker or New York Times`;
  }

  return prompt;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = parseArgs();

  if (!args.input) {
    console.error("Usage: bun run generate-prompt.ts --input <essay.md> [options]");
    console.error("\nOptions:");
    console.error("  --type           essay-illustration | blog-header (default: essay-illustration)");
    console.error("  --format         text | json (default: text)");
    console.error("  --composition    observation | horizon | dialogue | workshop | aura");
    console.error("  --character      maya | kai | both");
    console.error('  --colors         "Electric Blue,Neon Green" (comma-separated)');
    console.error('  --motifs         "agents,networks" (comma-separated)');
    process.exit(1);
  }

  // Read essay content
  const essayContent = readEssayContent(args.input);

  // Analyze content
  const analysis = analyzeContent(essayContent);

  // Select visual elements
  const compositionType = selectComposition(essayContent, args.composition);
  const characterFocus = selectCharacter(compositionType, args.character);
  const accentColors = selectColors(essayContent, args.colors);
  const human3Motifs = selectMotifs(essayContent, args.motifs);

  // Build visual metaphor
  const coreObjectDescription = buildVisualMetaphor(
    essayContent,
    compositionType,
    characterFocus
  );

  // Build config
  const config: PromptConfig = {
    essayTheme: analysis.theme,
    characterFocus,
    compositionType,
    emotionalToneDescription: `They are ${analysis.tone}`,
    coreObjectDescription,
    overallMood: analysis.tone.split(" ").slice(0, 2).join(" "), // Simplified mood
    accentColors,
    human3Motifs,
    backgroundType: "sepia",
    imageType: args.type,
  };

  // Generate prompt
  const imagePrompt = generatePrompt(config);

  // Output
  if (args.format === "json") {
    const output: PromptOutput = {
      essay_theme: analysis.theme,
      character_focus: characterFocus,
      composition_type: compositionType,
      emotional_tone_description: config.emotionalToneDescription,
      core_object_description: coreObjectDescription,
      overall_mood: config.overallMood,
      accent_colors: accentColors,
      human3_motifs: human3Motifs,
      image_prompt: imagePrompt,
      suggested_filename: analysis.theme
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".png",
    };

    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(imagePrompt);
  }
}

main();
