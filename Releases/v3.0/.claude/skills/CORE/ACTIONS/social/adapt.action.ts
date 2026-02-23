#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: social/adapt
 * ============================================================================
 *
 * Adapts content for different social media platforms, respecting character
 * limits and platform conventions.
 *
 * INPUT:  { content: string, platforms: string[] }
 * OUTPUT: { adapted: Record<platform, string>, originalLength: number }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const InputSchema = z.object({
  content: z.string().min(1).describe("Original content to adapt"),
  platforms: z.array(z.enum(["x", "linkedin", "bluesky"])).default(["x", "linkedin", "bluesky"])
    .describe("Target platforms"),
  preserveHashtags: z.boolean().optional().default(true)
    .describe("Keep hashtags if they fit"),
  preserveLinks: z.boolean().optional().default(true)
    .describe("Keep links (they count toward limits)"),
});

const OutputSchema = z.object({
  adapted: z.record(z.string()).describe("Adapted content per platform"),
  originalLength: z.number().describe("Original content length"),
  truncated: z.array(z.string()).describe("Platforms where content was truncated"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

// Platform limits and conventions
const PLATFORM_INFO: Record<string, { limit: number; style: string }> = {
  x: {
    limit: 280,
    style: "Concise, punchy. Hashtags at end. Links count as ~23 chars.",
  },
  linkedin: {
    limit: 3000,
    style: "Professional tone. Can be longer form. Call-to-action welcome. Line breaks for readability.",
  },
  bluesky: {
    limit: 300,
    style: "Similar to X/Twitter. Slightly more room. Rich text supported.",
  },
};

export default defineAction<Input, Output>({
  name: "social/adapt",
  version: "1.0.0",
  description: "Adapt content for different social platforms",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["social", "content", "adaptation"],

  deployment: {
    timeout: 30000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const platformDetails = input.platforms
      .map(p => `${p.toUpperCase()} (${PLATFORM_INFO[p]?.limit || 280} chars): ${PLATFORM_INFO[p]?.style || "Standard"}`)
      .join("\n");

    const systemPrompt = `You are a social media content specialist. Adapt the given content for each platform while preserving the core message.

Platform requirements:
${platformDetails}

${input.preserveHashtags ? "Preserve relevant hashtags if they fit." : "Remove hashtags."}
${input.preserveLinks ? "Preserve links (count as ~23 chars on X/Bluesky)." : "Remove links."}

For X/Bluesky: If content is too long, intelligently condense it while keeping the key point.
For LinkedIn: Can expand with context, but don't pad unnecessarily.

Respond ONLY with valid JSON:
{
  "adapted": {
    "x": "Adapted X content here...",
    "linkedin": "Adapted LinkedIn content here...",
    "bluesky": "Adapted Bluesky content here..."
  },
  "truncated": ["x", "bluesky"]
}

Only include platforms that were requested.`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.content,
      level: "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to adapt content: ${result.error || "No parsed output"}`);
    }

    const parsed = result.parsed as { adapted: Record<string, string>; truncated: string[] };

    return {
      adapted: parsed.adapted,
      originalLength: input.content.length,
      truncated: parsed.truncated || [],
    };
  },
});
