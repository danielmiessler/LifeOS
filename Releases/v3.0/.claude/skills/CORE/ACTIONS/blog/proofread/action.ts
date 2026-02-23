/**
 * blog/proofread - Fix spelling and grammar errors only
 *
 * This action receives capabilities via context injection.
 * It does NOT import any PAI-specific tools.
 */

import type { ActionContext, ActionImplementation } from "../../lib/types.v2";

interface Input {
  content: string;
}

interface Change {
  original: string;
  corrected: string;
  type: "spelling" | "grammar" | "punctuation";
  location?: string;
}

interface Output {
  corrected: string;
  changes: Change[];
  changeCount: number;
}

const SYSTEM_PROMPT = `You are a meticulous proofreader. Fix ONLY:
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

const implementation: ActionImplementation<Input, Output> = {
  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const { llm } = ctx.capabilities;

    if (!llm) {
      throw new Error("This action requires LLM capability");
    }

    const response = await llm(input.content, {
      system: SYSTEM_PROMPT,
      tier: input.content.length > 5000 ? "standard" : "fast",
      json: true,
    });

    if (!response.json) {
      throw new Error("LLM did not return valid JSON");
    }

    return response.json as Output;
  },
};

export default implementation;
