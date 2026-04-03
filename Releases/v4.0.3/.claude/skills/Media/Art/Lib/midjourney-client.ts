/**
 * midjourney-client.ts - Midjourney Interaction Client
 *
 * High-level client for interacting with Midjourney bot through Discord.
 * Handles prompt formatting, command submission, response parsing,
 * and error detection.
 *
 * @see ~/.claude/skills/art/SKILL.md
 */

import { DiscordBotClient } from './discord-bot.js';
import { Message } from 'discord.js';

// ============================================================================
// Types
// ============================================================================

export interface MidjourneyOptions {
  prompt: string;
  aspectRatio?: string;
  version?: string;
  stylize?: number;
  quality?: number;
  chaos?: number;
  weird?: number;
  tile?: boolean;
  timeout?: number; // in seconds
}

export interface MidjourneyResult {
  imageUrl: string;
  prompt: string;
  messageId: string;
}

export type MidjourneyErrorType =
  | 'content_policy'
  | 'timeout'
  | 'connection'
  | 'invalid_params'
  | 'generation_failed'
  | 'no_image';

export class MidjourneyError extends Error {
  constructor(
    public type: MidjourneyErrorType,
    message: string,
    public originalPrompt?: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'MidjourneyError';
  }
}

// ============================================================================
// Midjourney Client
// ============================================================================

export class MidjourneyClient {
  private discordBot: DiscordBotClient;

  constructor(discordBot: DiscordBotClient) {
    this.discordBot = discordBot;
  }

  /**
   * Generate image with Midjourney
   *
   * Submits prompt, waits for generation, and returns image URL
   */
  async generateImage(options: MidjourneyOptions): Promise<MidjourneyResult> {
    const {
      prompt,
      aspectRatio = '16:9',
      version = '6.1',
      stylize = 100,
      quality = 1,
      chaos,
      weird,
      tile = false,
      timeout = 120,
    } = options;

    // Format the Midjourney prompt
    const formattedPrompt = this.formatPrompt({
      prompt,
      aspectRatio,
      version,
      stylize,
      quality,
      chaos,
      weird,
      tile,
    });

    console.log(`🎨 Submitting to Midjourney: ${formattedPrompt}`);

    // Send the /imagine command
    const initialMessage = await this.discordBot.sendMessage(`/imagine prompt: ${formattedPrompt}`);

    // Wait for Midjourney to complete generation
    let responseMessage: Message;
    try {
      responseMessage = await this.discordBot.waitForMidjourneyResponse(initialMessage.id, {
        timeout,
        pollInterval: 5000,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        throw new MidjourneyError(
          'timeout',
          `Generation timed out after ${timeout}s. The image may still be processing in Discord.`,
          formattedPrompt,
          'Try checking Discord manually or increasing the timeout value.'
        );
      }
      throw error;
    }

    // Check for errors in response
    this.detectErrors(responseMessage, formattedPrompt);

    // Extract image URL
    const imageUrl = this.discordBot.getImageUrl(responseMessage);

    if (!imageUrl) {
      throw new MidjourneyError(
        'no_image',
        'No image found in Midjourney response',
        formattedPrompt,
        'The generation may have failed. Check Discord for error messages.'
      );
    }

    return {
      imageUrl,
      prompt: formattedPrompt,
      messageId: responseMessage.id,
    };
  }

  /**
   * Format Midjourney prompt with parameters
   *
   * Converts structured options into Midjourney command syntax
   */
  private formatPrompt(options: {
    prompt: string;
    aspectRatio: string;
    version: string;
    stylize: number;
    quality: number;
    chaos?: number;
    weird?: number;
    tile: boolean;
  }): string {
    const { prompt, aspectRatio, version, stylize, quality, chaos, weird, tile } = options;

    let formattedPrompt = prompt;

    // Add aspect ratio
    formattedPrompt += ` --ar ${aspectRatio}`;

    // Add version
    formattedPrompt += ` --v ${version}`;

    // Add stylize (default is 100, only add if different)
    if (stylize !== 100) {
      formattedPrompt += ` --s ${stylize}`;
    }

    // Add quality (default is 1, only add if different)
    if (quality !== 1) {
      formattedPrompt += ` --q ${quality}`;
    }

    // Add optional parameters
    if (chaos !== undefined) {
      formattedPrompt += ` --chaos ${chaos}`;
    }

    if (weird !== undefined) {
      formattedPrompt += ` --weird ${weird}`;
    }

    if (tile) {
      formattedPrompt += ` --tile`;
    }

    return formattedPrompt;
  }

  /**
   * Detect errors in Midjourney response
   */
  private detectErrors(message: Message, originalPrompt: string): void {
    const content = message.content.toLowerCase();

    // Content policy violations
    const contentPolicyIndicators = [
      'banned prompt',
      'content policy',
      'violates our community standards',
      'inappropriate content',
      'against our terms',
    ];

    for (const indicator of contentPolicyIndicators) {
      if (content.includes(indicator)) {
        throw new MidjourneyError(
          'content_policy',
          'Prompt violates Midjourney content policy',
          originalPrompt,
          'Try rephrasing your prompt to avoid potentially sensitive content.'
        );
      }
    }

    // Invalid parameters
    const invalidParamIndicators = [
      'invalid parameter',
      'unknown parameter',
      'invalid aspect ratio',
      'invalid version',
    ];

    for (const indicator of invalidParamIndicators) {
      if (content.includes(indicator)) {
        throw new MidjourneyError(
          'invalid_params',
          'Invalid Midjourney parameters',
          originalPrompt,
          'Check your aspect ratio, version, and other parameter values.'
        );
      }
    }

    // Generation failures
    const failureIndicators = [
      'failed to generate',
      'generation failed',
      'error generating',
      'something went wrong',
    ];

    for (const indicator of failureIndicators) {
      if (content.includes(indicator)) {
        throw new MidjourneyError(
          'generation_failed',
          'Midjourney generation failed',
          originalPrompt,
          'Try again or check Discord for more details.'
        );
      }
    }
  }

  /**
   * Parse Midjourney response to extract metadata
   */
  parseResponse(message: Message): {
    prompt: string;
    parameters: Record<string, string>;
  } {
    const content = message.content;

    // Extract prompt (usually before the first --)
    const promptMatch = content.match(/^(.+?)(?:\s+--|\s*$)/);
    const prompt = promptMatch ? promptMatch[1].trim() : content;

    // Extract parameters
    const parameters: Record<string, string> = {};
    const paramRegex = /--(\w+)\s+([^\s-]+)/g;
    let match;

    while ((match = paramRegex.exec(content)) !== null) {
      parameters[match[1]] = match[2];
    }

    return { prompt, parameters };
  }

  /**
   * Validate Midjourney options before submission
   */
  static validateOptions(options: MidjourneyOptions): void {
    // Validate aspect ratio
    const validAspectRatios = [
      '1:1', '16:9', '9:16', '2:3', '3:2', '4:5', '5:4', '7:4', '4:7',
      '21:9', '9:21', '3:4', '4:3'
    ];

    if (options.aspectRatio && !validAspectRatios.includes(options.aspectRatio)) {
      throw new Error(
        `Invalid aspect ratio: ${options.aspectRatio}. Valid ratios: ${validAspectRatios.join(', ')}`
      );
    }

    // Validate version
    const validVersions = ['6.1', '6', '5.2', '5.1', '5', 'niji', 'niji 6'];

    if (options.version && !validVersions.includes(options.version)) {
      throw new Error(
        `Invalid version: ${options.version}. Valid versions: ${validVersions.join(', ')}`
      );
    }

    // Validate stylize (0-1000)
    if (options.stylize !== undefined && (options.stylize < 0 || options.stylize > 1000)) {
      throw new Error('Stylize must be between 0 and 1000');
    }

    // Validate quality
    const validQualities = [0.25, 0.5, 1, 2];

    if (options.quality !== undefined && !validQualities.includes(options.quality)) {
      throw new Error('Quality must be 0.25, 0.5, 1, or 2');
    }

    // Validate chaos (0-100)
    if (options.chaos !== undefined && (options.chaos < 0 || options.chaos > 100)) {
      throw new Error('Chaos must be between 0 and 100');
    }

    // Validate weird (0-3000)
    if (options.weird !== undefined && (options.weird < 0 || options.weird > 3000)) {
      throw new Error('Weird must be between 0 and 3000');
    }

    // Validate timeout
    if (options.timeout !== undefined && options.timeout < 30) {
      throw new Error('Timeout must be at least 30 seconds');
    }
  }
}
