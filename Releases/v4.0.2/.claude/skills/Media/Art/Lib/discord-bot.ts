/**
 * discord-bot.ts - Discord Bot Client for Midjourney Integration
 *
 * Official Discord bot wrapper using discord.js for legitimate interaction
 * with Midjourney bot. Handles connection, message sending, monitoring,
 * and image downloads.
 *
 * @see ~/.claude/skills/art/SKILL.md
 */

import {
  Client,
  GatewayIntentBits,
  Message,
  TextChannel,
  Partials
} from 'discord.js';
import { writeFile } from 'node:fs/promises';

// ============================================================================
// Constants
// ============================================================================

const MIDJOURNEY_BOT_ID = '936929561302675456'; // Official Midjourney bot ID

// ============================================================================
// Types
// ============================================================================

export interface DiscordBotConfig {
  token: string;
  channelId: string;
}

export interface WaitForResponseOptions {
  timeout: number; // in seconds
  pollInterval?: number; // in milliseconds
}

// ============================================================================
// Discord Bot Client
// ============================================================================

export class DiscordBotClient {
  private client: Client;
  private config: DiscordBotConfig;
  private connected: boolean = false;

  constructor(config: DiscordBotConfig) {
    this.config = config;

    // Initialize Discord client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel],
    });
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Set up event handlers
      this.client.once('ready', () => {
        console.log(`✅ Discord bot connected as ${this.client.user?.tag}`);
        this.connected = true;
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('❌ Discord client error:', error);
      });

      // Login with bot token
      this.client.login(this.config.token).catch(reject);
    });
  }

  /**
   * Send a message to the specified channel
   */
  async sendMessage(content: string): Promise<Message> {
    if (!this.connected) {
      throw new Error('Bot not connected. Call connect() first.');
    }

    const channel = await this.client.channels.fetch(this.config.channelId);

    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${this.config.channelId} is not a text channel`);
    }

    const message = await (channel as TextChannel).send(content);
    console.log(`📤 Sent message: ${content}`);

    return message;
  }

  /**
   * Wait for Midjourney's response to a prompt
   *
   * Polls the channel for messages from Midjourney bot that reference
   * our initial message. Returns when the response is complete (has image attachments).
   */
  async waitForMidjourneyResponse(
    initialMessageId: string,
    options: WaitForResponseOptions
  ): Promise<Message> {
    const { timeout, pollInterval = 5000 } = options;
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    console.log(`⏳ Waiting for Midjourney response (timeout: ${timeout}s)...`);

    while (Date.now() - startTime < timeoutMs) {
      // Fetch recent messages from channel
      const channel = await this.client.channels.fetch(this.config.channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or not text-based');
      }

      const messages = await (channel as TextChannel).messages.fetch({ limit: 20 });

      // Find Midjourney's response to our prompt
      for (const [_, message] of messages) {
        // Check if message is from Midjourney bot
        if (message.author.id !== MIDJOURNEY_BOT_ID) {
          continue;
        }

        // Check if this message references our initial prompt
        const referencesOurMessage =
          message.reference?.messageId === initialMessageId ||
          message.interaction?.id === initialMessageId ||
          message.content.includes(initialMessageId);

        if (!referencesOurMessage) {
          continue;
        }

        // Check if generation is complete
        if (this.isGenerationComplete(message)) {
          console.log(`✅ Midjourney generation complete!`);
          return message;
        } else {
          console.log(`⏳ Generation in progress... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
        }
      }

      // Wait before next poll
      await this.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for Midjourney response after ${timeout}s`);
  }

  /**
   * Check if Midjourney generation is complete
   *
   * A complete generation has:
   * - Image attachments
   * - No "Waiting to start" or "%" progress indicators
   */
  private isGenerationComplete(message: Message): boolean {
    // Must have attachments (the generated image)
    if (message.attachments.size === 0) {
      return false;
    }

    // Check for in-progress indicators
    const content = message.content.toLowerCase();
    const inProgressIndicators = [
      'waiting to start',
      '(waiting)',
      '(0%)',
      '(1%)',
      '(2%)',
      '(3%)',
      '(4%)',
      '(5%)',
      '(6%)',
      '(7%)',
      '(8%)',
      '(9%)',
      // Continue patterns for progress
      '%)',
    ];

    for (const indicator of inProgressIndicators) {
      if (content.includes(indicator)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Download image from URL to local path
   */
  async downloadImage(url: string, outputPath: string): Promise<void> {
    console.log(`📥 Downloading image from ${url}...`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await writeFile(outputPath, buffer);

    console.log(`✅ Image saved to ${outputPath}`);
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.client.destroy();
    this.connected = false;
    console.log('👋 Discord bot disconnected');
  }

  /**
   * Get the first image attachment URL from a message
   */
  getImageUrl(message: Message): string | null {
    if (message.attachments.size === 0) {
      return null;
    }

    // Get first attachment
    const attachment = message.attachments.first();

    if (!attachment) {
      return null;
    }

    // Verify it's an image
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const isImage = imageExtensions.some(ext =>
      attachment.url.toLowerCase().includes(ext)
    );

    if (!isImage) {
      return null;
    }

    return attachment.url;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
