#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: transform/summarize
 * ============================================================================
 *
 * Summarizes text content to a target length.
 *
 * INPUT:  { text: string, targetWords?: number, style?: 'concise' | 'detailed' }
 * OUTPUT: { summary: string, wordCount: number }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const InputSchema = z.object({
  text: z.string().min(1).describe("Text to summarize"),
  targetWords: z.number().int().positive().optional().default(100)
    .describe("Target word count for summary"),
  style: z.enum(["concise", "detailed"]).optional().default("concise")
    .describe("Summary style"),
});

const OutputSchema = z.object({
  summary: z.string().describe("The summarized text"),
  wordCount: z.number().int().describe("Actual word count of summary"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export default defineAction<Input, Output>({
  name: "transform/summarize",
  version: "1.0.0",
  description: "Summarize text content to target length",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["transform", "nlp", "summary"],

  deployment: {
    timeout: 30000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const styleGuide = input.style === "detailed"
      ? "Include key details, examples, and nuance."
      : "Be direct and omit unnecessary details.";

    const systemPrompt = `You are a summarization expert. Summarize the given text to approximately ${input.targetWords} words. ${styleGuide}

Respond ONLY with valid JSON:
{
  "summary": "your summary here",
  "wordCount": 123
}`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.text,
      level: input.text.length > 5000 ? "standard" : "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to summarize: ${result.error || "No parsed output"}`);
    }

    return OutputSchema.parse(result.parsed);
  },
});
