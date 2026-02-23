#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: social/post
 * ============================================================================
 *
 * Posts content to social media platforms using the Broadcast tool.
 *
 * INPUT:  { content: string, platforms: string[], dryRun?: boolean }
 * OUTPUT: { results: PostResult[], success: boolean }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { $ } from "bun";
import { existsSync } from "fs";

const PostResultSchema = z.object({
  platform: z.string(),
  success: z.boolean(),
  url: z.string().optional(),
  error: z.string().optional(),
});

const InputSchema = z.object({
  content: z.string().min(1).max(10000).describe("Content to post"),
  platforms: z.array(z.enum(["x", "linkedin", "bluesky", "all"])).default(["all"])
    .describe("Platforms to post to"),
  dryRun: z.boolean().optional().default(true)
    .describe("Preview without posting (default: true for safety)"),
});

const OutputSchema = z.object({
  results: z.array(PostResultSchema).describe("Results per platform"),
  success: z.boolean().describe("Whether all posts succeeded"),
  preview: z.object({
    x: z.string().optional(),
    linkedin: z.string().optional(),
    bluesky: z.string().optional(),
  }).optional().describe("Content preview per platform in dry run mode"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

// TODO: Configure broadcast tool path for your installation
// const BROADCAST_TOOL = `${process.env.HOME}/.claude/skills/Broadcast/Tools/Broadcast.ts`;
const BROADCAST_TOOL = `${process.env.HOME}/.claude/skills/Broadcast/Tools/Broadcast.ts`;

// Platform character limits
const LIMITS: Record<string, number> = {
  x: 280,
  bluesky: 300,
  linkedin: 3000,
};

function truncateForPlatform(content: string, platform: string): string {
  const limit = LIMITS[platform] || 3000;
  if (content.length <= limit) return content;
  return content.substring(0, limit - 3) + "...";
}

export default defineAction<Input, Output>({
  name: "social/post",
  version: "1.0.0",
  description: "Post content to social media platforms",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["social", "broadcast", "posting"],

  deployment: {
    timeout: 60000,
    secrets: ["X_API_KEY", "LINKEDIN_ACCESS_TOKEN", "BLUESKY_PASSWORD"],
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    // Resolve 'all' to actual platforms
    const platforms = input.platforms.includes("all")
      ? ["x", "linkedin", "bluesky"]
      : input.platforms;

    // Dry run - just show previews
    if (input.dryRun) {
      const preview: Record<string, string> = {};
      for (const platform of platforms) {
        preview[platform] = truncateForPlatform(input.content, platform);
      }
      return {
        results: platforms.map(p => ({
          platform: p,
          success: true,
          url: `[DRY RUN - would post to ${p}]`,
        })),
        success: true,
        preview: preview as Output["preview"],
      };
    }

    // Check if Broadcast tool exists
    if (!existsSync(BROADCAST_TOOL)) {
      throw new Error(`Broadcast tool not found at ${BROADCAST_TOOL}`);
    }

    // Execute actual post
    const platformList = platforms.join(",");
    try {
      const result = await $`bun ${BROADCAST_TOOL} post --content ${input.content} --platforms ${platformList}`.json();

      return {
        results: result.results || [],
        success: result.success || false,
      };
    } catch (err) {
      // Parse error output if possible
      return {
        results: platforms.map(p => ({
          platform: p,
          success: false,
          error: String(err),
        })),
        success: false,
      };
    }
  },
});
