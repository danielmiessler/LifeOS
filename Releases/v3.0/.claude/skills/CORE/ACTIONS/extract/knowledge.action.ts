#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: extract/knowledge
 * ============================================================================
 *
 * Extracts structured knowledge from text content with domain-specific analysis.
 *
 * INPUT:  { content: string, domain?: string }
 * OUTPUT: { summary: string, insights: string[], signals: string[], recommendations: string[], rating: number }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";
import { inference } from "../../../PAI/Tools/Inference";

const InputSchema = z.object({
  content: z.string().min(1).describe("The content to analyze"),
  domain: z.enum(["security", "business", "research", "wisdom", "general"]).optional()
    .describe("Focus domain - auto-detected if not specified"),
  extractQuotes: z.boolean().optional().default(false)
    .describe("Whether to extract notable quotes"),
});

const OutputSchema = z.object({
  summary: z.string().describe("2-3 sentence summary"),
  domain: z.string().describe("Detected or specified domain"),
  insights: z.array(z.string()).describe("Key insights extracted"),
  signals: z.array(z.string()).describe("Signal points for this domain"),
  recommendations: z.array(z.string()).describe("Actionable recommendations"),
  relatedConcepts: z.array(z.string()).describe("Related terms and concepts"),
  quotes: z.array(z.string()).optional().describe("Notable quotes if requested"),
  rating: z.number().min(1).max(10).describe("Quality rating 1-10"),
  confidence: z.number().min(1).max(10).describe("Confidence in extraction 1-10"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

export default defineAction<Input, Output>({
  name: "extract/knowledge",
  version: "1.0.0",
  description: "Extract structured knowledge from content",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["extract", "knowledge", "analysis"],

  deployment: {
    timeout: 45000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const domainGuides: Record<string, string> = {
      security: "Focus on: attack vectors, vulnerabilities, defensive strategies, security tools, threat actors",
      business: "Focus on: revenue opportunities, market insights, growth strategies, competitive advantages",
      research: "Focus on: key findings, methodology, contributions, limitations, future work",
      wisdom: "Focus on: life principles, philosophical insights, practical wisdom, universal truths",
      general: "Extract the most important concepts, facts, and learnings",
    };

    const domainHint = input.domain ? domainGuides[input.domain] :
      "Auto-detect the domain from content. Look for keywords: vulnerability/hack/exploit (security), revenue/profit/market (business), study/methodology/findings (research), philosophy/principle/wisdom (wisdom)";

    const quoteInstruction = input.extractQuotes
      ? '\n"quotes": ["Notable quote 1", "Notable quote 2"],'
      : '';

    const systemPrompt = `You are an expert knowledge extractor. Analyze the given content and extract structured insights.

${domainHint}

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence summary of the content",
  "domain": "security|business|research|wisdom|general",
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "signals": ["Signal point specific to the domain"],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"],
  "relatedConcepts": ["term1", "term2", "term3"],${quoteInstruction}
  "rating": 8,
  "confidence": 9
}

Rating criteria:
- 9-10: Comprehensive, high-value, actionable
- 7-8: Good insights, clear recommendations
- 5-6: Moderate value, some useful info
- 3-4: Limited insights
- 1-2: Poor quality or insufficient`;

    const result = await inference({
      systemPrompt,
      userPrompt: input.content,
      level: input.content.length > 5000 ? "standard" : "fast",
      expectJson: true,
    });

    if (!result.success || !result.parsed) {
      throw new Error(`Failed to extract knowledge: ${result.error || "No parsed output"}`);
    }

    return OutputSchema.parse(result.parsed);
  },
});
