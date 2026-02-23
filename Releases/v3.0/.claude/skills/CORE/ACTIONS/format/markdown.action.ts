#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: format/markdown
 * ============================================================================
 *
 * Formats structured content into clean markdown.
 *
 * INPUT:  { content: object | string, template?: string }
 * OUTPUT: { markdown: string, wordCount: number }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";

const InputSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown())])
    .describe("Content to format - string or structured object"),
  template: z.enum(["report", "list", "article", "raw"]).optional().default("raw")
    .describe("Markdown template to apply"),
  title: z.string().optional().describe("Optional title for the document"),
});

const OutputSchema = z.object({
  markdown: z.string().describe("Formatted markdown content"),
  wordCount: z.number().int().describe("Word count of output"),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function formatAsReport(content: Record<string, unknown>, title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`, "");
  }

  for (const [key, value] of Object.entries(content)) {
    const heading = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
    lines.push(`## ${heading}`, "");

    if (Array.isArray(value)) {
      value.forEach(item => lines.push(`- ${item}`));
    } else if (typeof value === "object" && value !== null) {
      lines.push("```json", JSON.stringify(value, null, 2), "```");
    } else {
      lines.push(String(value));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatAsList(content: Record<string, unknown>, title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`, "");
  }

  for (const [key, value] of Object.entries(content)) {
    if (Array.isArray(value)) {
      lines.push(`**${key}:**`);
      value.forEach(item => lines.push(`  - ${item}`));
    } else {
      lines.push(`- **${key}:** ${value}`);
    }
  }

  return lines.join("\n");
}

export default defineAction<Input, Output>({
  name: "format/markdown",
  version: "1.0.0",
  description: "Format content as clean markdown",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["format", "markdown", "output"],

  deployment: {
    timeout: 5000, // Fast, no LLM needed
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    let markdown: string;

    if (typeof input.content === "string") {
      // Already a string, just pass through (maybe add title)
      markdown = input.title ? `# ${input.title}\n\n${input.content}` : input.content;
    } else {
      // Structured content - format based on template
      switch (input.template) {
        case "report":
          markdown = formatAsReport(input.content, input.title);
          break;
        case "list":
          markdown = formatAsList(input.content, input.title);
          break;
        case "article":
          markdown = formatAsReport(input.content, input.title); // TODO: better article format
          break;
        case "raw":
        default:
          markdown = input.title
            ? `# ${input.title}\n\n${JSON.stringify(input.content, null, 2)}`
            : JSON.stringify(input.content, null, 2);
      }
    }

    return {
      markdown,
      wordCount: countWords(markdown),
    };
  },
});
