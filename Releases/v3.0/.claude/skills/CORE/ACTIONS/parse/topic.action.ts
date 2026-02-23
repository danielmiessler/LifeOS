#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: parse/topic
 * ============================================================================
 *
 * Parses natural language text into a structured topic object.
 * Extracts the main topic, subtopics, and keywords.
 *
 * INPUT:  { text: string }
 * OUTPUT: { name: string, subtopics: string[], keywords: string[] }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const InputSchema = z.object({
  text: z.string().min(1).describe("Natural language text describing a topic"),
});

const OutputSchema = z.object({
  name: z.string().describe("The main topic name"),
  subtopics: z.array(z.string()).describe("Related subtopics to explore"),
  keywords: z.array(z.string()).describe("Key terms for searching"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export default defineAction<Input, Output>({
  name: "parse/topic",
  version: "1.0.0",
  description: "Parse natural language into structured topic with subtopics and keywords",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["parse", "nlp", "extraction"],

  deployment: {
    timeout: 15000,
    secrets: [], // Uses inference tool, no direct API keys needed
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const systemPrompt = `You are a topic parser. Given text, extract:
1. The main topic name (concise, 1-5 words)
2. 3-5 subtopics worth exploring
3. 5-10 keywords useful for searching

Respond ONLY with valid JSON in this exact format:
{
  "name": "main topic",
  "subtopics": ["subtopic1", "subtopic2", "subtopic3"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.text,
      level: "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to parse topic: ${result.error || "No parsed output"}`);
    }

    // Validate the parsed result matches our schema
    return OutputSchema.parse(result.parsed);
  },
});
