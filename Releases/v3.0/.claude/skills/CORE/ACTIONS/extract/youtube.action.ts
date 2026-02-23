#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: extract/youtube
 * ============================================================================
 *
 * Extracts transcript and content from a YouTube video using Fabric CLI.
 *
 * INPUT:  { url: string, pattern?: string }
 * OUTPUT: { transcript: string, processed?: string, videoId: string }
 *
 * NOTE: Requires Fabric CLI installed: https://github.com/danielmiessler/fabric
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { $ } from "bun";

const InputSchema = z.object({
  url: z.string().url().describe("YouTube video URL"),
  pattern: z.enum([
    "extract_wisdom",
    "summarize",
    "extract_main_idea",
    "create_summary",
    "analyze_claims",
    "rate_content",
  ]).optional().describe("Optional Fabric pattern to apply"),
});

const OutputSchema = z.object({
  transcript: z.string().describe("Raw transcript text"),
  processed: z.string().optional().describe("Pattern-processed content if pattern specified"),
  videoId: z.string().describe("YouTube video ID"),
  duration: z.number().optional().describe("Extraction duration in ms"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error("Could not extract video ID from URL");
}

export default defineAction<Input, Output>({
  name: "extract/youtube",
  version: "1.0.0",
  description: "Extract transcript from YouTube video via Fabric",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["extract", "youtube", "video", "fabric"],

  deployment: {
    timeout: 120000, // YouTube extraction can take time
    cpuIntensive: true,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const videoId = extractVideoId(input.url);
    const startTime = Date.now();

    // Extract transcript using Fabric
    let transcript: string;
    try {
      const result = await $`fabric -y "${input.url}"`.text();
      transcript = result.trim();
    } catch (err) {
      throw new Error(`Failed to extract YouTube content: ${err}`);
    }

    if (!transcript || transcript.length < 50) {
      throw new Error("Transcript extraction returned empty or minimal content");
    }

    // Optionally process through pattern
    let processed: string | undefined;
    if (input.pattern) {
      try {
        const patternResult = await $`echo ${transcript} | fabric -p ${input.pattern}`.text();
        processed = patternResult.trim();
      } catch (err) {
        // Pattern processing failed, continue with just transcript
        console.error(`Pattern processing failed: ${err}`);
      }
    }

    return {
      transcript,
      processed,
      videoId,
      duration: Date.now() - startTime,
    };
  },
});
