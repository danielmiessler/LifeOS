#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: blog/proofread
 * ============================================================================
 *
 * Fixes spelling and grammar errors ONLY. Does not change content, tone, or style.
 *
 * INPUT:  { content: string }
 * OUTPUT: { corrected: string, changes: Change[], changeCount: number }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const ChangeSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  type: z.enum(["spelling", "grammar", "punctuation"]),
  location: z.string().optional().describe("Approximate location in text"),
});

const InputSchema = z.object({
  content: z.string().min(1).describe("The text content to proofread"),
});

const OutputSchema = z.object({
  corrected: z.string().describe("The corrected text"),
  changes: z.array(ChangeSchema).describe("List of changes made"),
  changeCount: z.number().int().describe("Number of corrections made"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export default defineAction<Input, Output>({
  name: "blog/proofread",
  version: "1.0.0",
  description: "Fix spelling and grammar errors only - no content changes",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["blog", "editing", "grammar"],

  deployment: {
    timeout: 30000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const systemPrompt = `You are a meticulous proofreader. Fix ONLY:
- Spelling errors
- Grammar mistakes
- Punctuation errors

DO NOT change:
- Word choice or style
- Sentence structure (unless grammatically incorrect)
- Tone or voice
- Content or meaning
- Formatting (markdown, headers, etc.)

If the text is already correct, return it unchanged.

Respond ONLY with valid JSON:
{
  "corrected": "The full corrected text here...",
  "changes": [
    {"original": "teh", "corrected": "the", "type": "spelling", "location": "paragraph 2"},
    {"original": "its", "corrected": "it's", "type": "grammar", "location": "introduction"}
  ],
  "changeCount": 2
}`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.content,
      level: input.content.length > 5000 ? "standard" : "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to proofread: ${result.error || "No parsed output"}`);
    }

    return OutputSchema.parse(result.parsed);
  },
});
