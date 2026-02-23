#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: blog/write-draft
 * ============================================================================
 *
 * Generates a blog post draft from a topic and optional outline.
 *
 * INPUT:  { topic: string, outline?: string[], style?: string, targetWords?: number }
 * OUTPUT: { draft: string, wordCount: number, title: string }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const InputSchema = z.object({
  topic: z.string().min(1).describe("The topic to write about"),
  outline: z.array(z.string()).optional().describe("Optional section headings"),
  style: z.enum(["technical", "narrative", "tutorial", "opinion"]).optional().default("narrative")
    .describe("Writing style"),
  targetWords: z.number().int().positive().optional().default(1000)
    .describe("Target word count"),
  voice: z.string().optional().describe("Optional voice/persona to write in"),
});

const OutputSchema = z.object({
  draft: z.string().describe("The generated blog post draft in markdown"),
  wordCount: z.number().int().describe("Actual word count"),
  title: z.string().describe("Generated or derived title"),
  sections: z.array(z.string()).describe("Section headings in the draft"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export default defineAction<Input, Output>({
  name: "blog/write-draft",
  version: "1.0.0",
  description: "Generate a blog post draft from a topic",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["blog", "writing", "content"],

  deployment: {
    timeout: 60000, // Writing takes time
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const outlineSection = input.outline?.length
      ? `\nFollow this outline:\n${input.outline.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

    const voiceSection = input.voice
      ? `\nWrite in this voice/style: ${input.voice}`
      : "";

    const styleGuides: Record<string, string> = {
      technical: "Use precise language, include code examples where relevant, explain technical concepts clearly.",
      narrative: "Tell a story, use personal anecdotes, make it engaging and relatable.",
      tutorial: "Step-by-step instructions, clear headings, practical examples the reader can follow.",
      opinion: "Strong thesis, supporting arguments, acknowledge counterpoints, persuasive conclusion.",
    };

    const systemPrompt = `You are an expert blog writer. Write a ${input.style} blog post about the given topic.

Target approximately ${input.targetWords} words.
${styleGuides[input.style || "narrative"]}
${outlineSection}
${voiceSection}

Format as markdown with:
- A compelling title (# heading)
- Clear section headings (## headings)
- Engaging introduction
- Well-structured body
- Strong conclusion

Respond ONLY with valid JSON:
{
  "draft": "# Title\\n\\nFull markdown content here...",
  "wordCount": 1000,
  "title": "The Title",
  "sections": ["Introduction", "Section 1", "Section 2", "Conclusion"]
}`;

    const result = await inference({
      systemPrompt,
      userPrompt: `Write a blog post about: ${input.topic}`,
      level: "standard",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to generate draft: ${result.error || "No parsed output"}`);
    }

    return OutputSchema.parse(result.parsed);
  },
});
