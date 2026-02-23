import type { ActionContext } from "../lib/types.v2";

interface Input {
  content: string;
  title?: string;
  [key: string]: unknown;
}

interface Output {
  summary: string;
  word_count: number;
  [key: string]: unknown;
}

export default {
  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const { content, ...upstream } = input;

    if (!content) throw new Error("Missing required input: content");

    const llm = ctx.capabilities.llm;
    if (!llm) throw new Error("LLM capability required");

    const result = await llm(content, {
      system:
        "You are a concise summarizer. Summarize the following text in 2-3 sentences. " +
        "Return ONLY the summary, no preamble or labels.",
      tier: "fast",
    });

    const summary = result.text.trim();

    return {
      ...upstream,
      summary,
      word_count: summary.split(/\s+/).length,
    };
  },
};
