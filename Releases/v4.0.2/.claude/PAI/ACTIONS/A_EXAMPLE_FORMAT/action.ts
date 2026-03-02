import type { ActionContext } from "../lib/types.v2";

interface Input {
  summary: string;
  title?: string;
  word_count?: number;
  [key: string]: unknown;
}

interface Output {
  formatted: string;
  format: string;
  [key: string]: unknown;
}

export default {
  async execute(input: Input, _ctx: ActionContext): Promise<Output> {
    const { summary, title, word_count, ...upstream } = input;

    if (!summary) throw new Error("Missing required input: summary");

    // Split summary into sentences for bullet formatting
    const sentences = summary
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);

    // Build structured markdown
    const lines: string[] = [];

    if (title) {
      lines.push(`# ${title}`, "");
    }

    lines.push("## Summary", "");

    for (const sentence of sentences) {
      lines.push(`- ${sentence.trim()}`);
    }

    if (word_count) {
      lines.push("", `---`, `*${word_count} words*`);
    }

    const formatted = lines.join("\n");

    return {
      ...upstream,
      formatted,
      format: "markdown",
    };
  },
};
