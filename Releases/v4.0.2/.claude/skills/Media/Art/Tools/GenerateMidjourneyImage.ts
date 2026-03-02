#!/usr/bin/env bun

/**
 * generate-midjourney-image - Midjourney Image Generation CLI
 *
 * Generate images using Midjourney via Discord bot integration.
 * Follows llcli pattern for deterministic, composable CLI design.
 *
 * Usage:
 *   generate-midjourney-image --prompt "..." --aspect-ratio 16:9 --output /tmp/image.png
 *
 * @see ~/.claude/skills/art/SKILL.md
 */

import { DiscordBotClient } from '../lib/discord-bot.js';
import { MidjourneyClient, MidjourneyError } from '../lib/midjourney-client.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

interface CLIArgs {
  prompt: string;
  aspectRatio: string;
  version: string;
  stylize: number;
  quality: number;
  chaos?: number;
  weird?: number;
  tile: boolean;
  output: string;
  timeout: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULTS = {
  aspectRatio: '16:9',
  version: process.env.MIDJOURNEY_DEFAULT_VERSION || '6.1',
  stylize: parseInt(process.env.MIDJOURNEY_DEFAULT_STYLIZE || '100'),
  quality: parseInt(process.env.MIDJOURNEY_DEFAULT_QUALITY || '1'),
  tile: false,
  output: '/tmp/midjourney-image.png',
  timeout: 120,
};

// ============================================================================
// Error Handling
// ============================================================================

class CLIError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = 'CLIError';
  }
}

function handleError(error: unknown): never {
  if (error instanceof MidjourneyError) {
    console.error(`\n❌ Midjourney Error: ${error.message}`);
    console.error(`   Type: ${error.type}`);
    if (error.originalPrompt) {
      console.error(`   Prompt: ${error.originalPrompt}`);
    }
    if (error.suggestion) {
      console.error(`   Suggestion: ${error.suggestion}`);
    }
    process.exit(1);
  }

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
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
generate-midjourney-image - Midjourney Image Generation CLI

Generate images using Midjourney via Discord bot integration.

USAGE:
  generate-midjourney-image --prompt "<prompt>" [OPTIONS]

REQUIRED:
  --prompt <text>         Image generation prompt (quote if contains spaces)

OPTIONS:
  --aspect-ratio <ratio>  Aspect ratio (default: 16:9)
                          Valid: 1:1, 16:9, 9:16, 2:3, 3:2, 4:5, 5:4, 7:4, 4:7, 21:9, 9:21, 3:4, 4:3
  --version <version>     Midjourney version (default: ${DEFAULTS.version})
                          Valid: 6.1, 6, 5.2, 5.1, 5, niji, niji 6
  --stylize <value>       Stylization 0-1000 (default: ${DEFAULTS.stylize})
  --quality <value>       Quality: 0.25, 0.5, 1, 2 (default: ${DEFAULTS.quality})
  --chaos <value>         Chaos 0-100 (optional)
  --weird <value>         Weird 0-3000 (optional)
  --tile                  Enable tiling mode (default: false)
  --output <path>         Output file path (default: ${DEFAULTS.output})
  --timeout <seconds>     Max wait time (default: ${DEFAULTS.timeout})

ENVIRONMENT VARIABLES:
  DISCORD_BOT_TOKEN           Discord bot token (required)
  MIDJOURNEY_CHANNEL_ID       Channel ID for Midjourney (required)
  MIDJOURNEY_DEFAULT_VERSION  Default Midjourney version
  MIDJOURNEY_DEFAULT_QUALITY  Default quality setting
  MIDJOURNEY_DEFAULT_STYLIZE  Default stylize setting

EXAMPLES:
  # Standard blog header
  generate-midjourney-image \\
    --prompt "abstract flowing data streams, minimal shapes, Tokyo Night colors" \\
    --aspect-ratio 16:9 \\
    --output /tmp/header.png

  # High quality square image
  generate-midjourney-image \\
    --prompt "geometric network visualization, abstract tech concept" \\
    --aspect-ratio 1:1 \\
    --quality 2 \\
    --output /tmp/square.png

  # Creative with high stylization
  generate-midjourney-image \\
    --prompt "flowing organic shapes, data visualization" \\
    --stylize 500 \\
    --weird 1000
`);
}

// ============================================================================
// Argument Parsing
// ============================================================================

function parseArgs(args: string[]): CLIArgs {
  const result: Partial<CLIArgs> = {
    aspectRatio: DEFAULTS.aspectRatio,
    version: DEFAULTS.version,
    stylize: DEFAULTS.stylize,
    quality: DEFAULTS.quality,
    tile: DEFAULTS.tile,
    output: DEFAULTS.output,
    timeout: DEFAULTS.timeout,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;

      case '--prompt':
        result.prompt = args[++i];
        break;

      case '--aspect-ratio':
      case '--ar':
        result.aspectRatio = args[++i];
        break;

      case '--version':
      case '-v':
        result.version = args[++i];
        break;

      case '--stylize':
      case '-s':
        result.stylize = parseInt(args[++i]);
        break;

      case '--quality':
      case '-q':
        result.quality = parseFloat(args[++i]);
        break;

      case '--chaos':
        result.chaos = parseInt(args[++i]);
        break;

      case '--weird':
        result.weird = parseInt(args[++i]);
        break;

      case '--tile':
        result.tile = true;
        break;

      case '--output':
      case '-o':
        result.output = args[++i];
        break;

      case '--timeout':
        result.timeout = parseInt(args[++i]);
        break;

      default:
        throw new CLIError(`Unknown argument: ${arg}`);
    }
  }

  // Validate required args
  if (!result.prompt) {
    throw new CLIError('Missing required argument: --prompt');
  }

  return result as CLIArgs;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  try {
    // Load API keys from ${PAI_DIR}/.env
    await loadEnv();

    // Parse arguments
    const args = parseArgs(process.argv.slice(2));

    // Validate environment variables
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.MIDJOURNEY_CHANNEL_ID;

    if (!botToken) {
      throw new CLIError(
        'Missing DISCORD_BOT_TOKEN environment variable. Add it to ${PAI_DIR}/.env'
      );
    }

    if (!channelId) {
      throw new CLIError(
        'Missing MIDJOURNEY_CHANNEL_ID environment variable. Add it to ${PAI_DIR}/.env'
      );
    }

    // Validate Midjourney options
    MidjourneyClient.validateOptions({
      prompt: args.prompt,
      aspectRatio: args.aspectRatio,
      version: args.version,
      stylize: args.stylize,
      quality: args.quality,
      chaos: args.chaos,
      weird: args.weird,
      tile: args.tile,
      timeout: args.timeout,
    });

    console.log('🤖 Midjourney Image Generation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Prompt: ${args.prompt}`);
    console.log(`Aspect Ratio: ${args.aspectRatio}`);
    console.log(`Version: ${args.version}`);
    console.log(`Stylize: ${args.stylize}`);
    console.log(`Quality: ${args.quality}`);
    if (args.chaos) console.log(`Chaos: ${args.chaos}`);
    if (args.weird) console.log(`Weird: ${args.weird}`);
    if (args.tile) console.log(`Tile: enabled`);
    console.log(`Output: ${args.output}`);
    console.log(`Timeout: ${args.timeout}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Initialize Discord bot
    const discordBot = new DiscordBotClient({
      token: botToken,
      channelId: channelId,
    });

    // Initialize Midjourney client
    const midjourneyClient = new MidjourneyClient(discordBot);

    try {
      // Connect to Discord
      await discordBot.connect();

      // Generate image
      const result = await midjourneyClient.generateImage({
        prompt: args.prompt,
        aspectRatio: args.aspectRatio,
        version: args.version,
        stylize: args.stylize,
        quality: args.quality,
        chaos: args.chaos,
        weird: args.weird,
        tile: args.tile,
        timeout: args.timeout,
      });

      // Download image
      await discordBot.downloadImage(result.imageUrl, args.output);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Success!');
      console.log(`   Image URL: ${result.imageUrl}`);
      console.log(`   Saved to: ${args.output}`);
      console.log(`   Message ID: ${result.messageId}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Disconnect
      await discordBot.disconnect();

      process.exit(0);
    } catch (error) {
      // Ensure we disconnect even on error
      await discordBot.disconnect();
      throw error;
    }
  } catch (error) {
    handleError(error);
  }
}

// Run
main();
