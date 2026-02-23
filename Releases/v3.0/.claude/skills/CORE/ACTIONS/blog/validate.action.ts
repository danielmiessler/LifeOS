#!/usr/bin/env bun
/**
 * ============================================================================
 * ACTION: blog/validate
 * ============================================================================
 *
 * Validates a blog post for common issues before publishing.
 *
 * INPUT:  { content: string, checkLinks?: boolean }
 * OUTPUT: { valid: boolean, issues: Issue[], warnings: Issue[] }
 *
 * ============================================================================
 */

import { defineAction, z, type ActionContext } from "../lib/types";

const IssueSchema = z.object({
  type: z.enum(["missing_title", "missing_frontmatter", "broken_link", "empty_section", "image_missing_alt", "too_short", "no_conclusion"]),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  location: z.string().optional(),
});

const InputSchema = z.object({
  content: z.string().min(1).describe("The markdown blog post content"),
  checkLinks: z.boolean().optional().default(false).describe("Whether to validate external links"),
  minWords: z.number().int().positive().optional().default(300).describe("Minimum word count"),
});

const OutputSchema = z.object({
  valid: z.boolean().describe("Whether the post passes all error checks"),
  issues: z.array(IssueSchema).describe("Errors that must be fixed"),
  warnings: z.array(IssueSchema).describe("Warnings that should be reviewed"),
  stats: z.object({
    wordCount: z.number().int(),
    linkCount: z.number().int(),
    imageCount: z.number().int(),
    headingCount: z.number().int(),
  }),
});

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export default defineAction<Input, Output>({
  name: "blog/validate",
  version: "1.0.0",
  description: "Validate blog post structure and content",

  inputSchema: InputSchema,
  outputSchema: OutputSchema,

  tags: ["blog", "validation", "quality"],

  deployment: {
    timeout: 15000,
  },

  async execute(input: Input, ctx: ActionContext): Promise<Output> {
    const issues: z.infer<typeof IssueSchema>[] = [];
    const warnings: z.infer<typeof IssueSchema>[] = [];
    const content = input.content;

    // Check for title (H1)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (!titleMatch) {
      issues.push({
        type: "missing_title",
        severity: "error",
        message: "No H1 title found at the start of the document",
      });
    }

    // Check for frontmatter (optional but warn)
    if (!content.startsWith("---")) {
      warnings.push({
        type: "missing_frontmatter",
        severity: "warning",
        message: "No YAML frontmatter found - may need date, author, tags",
      });
    }

    // Count links
    const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    const linkCount = linkMatches.length;

    // Check for broken/empty links
    linkMatches.forEach(link => {
      const urlMatch = link.match(/\]\(([^)]*)\)/);
      if (urlMatch && (!urlMatch[1] || urlMatch[1] === "#")) {
        issues.push({
          type: "broken_link",
          severity: "error",
          message: `Empty or placeholder link found: ${link}`,
          location: link,
        });
      }
    });

    // Count images and check for alt text
    const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
    const imageCount = imageMatches.length;
    imageMatches.forEach(img => {
      const altMatch = img.match(/!\[([^\]]*)\]/);
      if (altMatch && !altMatch[1].trim()) {
        warnings.push({
          type: "image_missing_alt",
          severity: "warning",
          message: `Image missing alt text: ${img.substring(0, 50)}...`,
          location: img,
        });
      }
    });

    // Count headings
    const headingMatches = content.match(/^#{1,6}\s+.+$/gm) || [];
    const headingCount = headingMatches.length;

    // Check for empty sections (heading followed immediately by another heading)
    const lines = content.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^#{1,6}\s+/.test(lines[i]) && /^#{1,6}\s+/.test(lines[i + 1])) {
        warnings.push({
          type: "empty_section",
          severity: "warning",
          message: `Empty section: "${lines[i].replace(/^#+\s+/, "")}"`,
          location: lines[i],
        });
      }
    }

    // Word count check
    const wordCount = countWords(content);
    if (wordCount < input.minWords) {
      issues.push({
        type: "too_short",
        severity: "error",
        message: `Post is only ${wordCount} words, minimum is ${input.minWords}`,
      });
    }

    // Check for conclusion-like section
    const hasConclusion = /#{1,3}\s*(conclusion|summary|wrap.?up|final|takeaway)/i.test(content);
    if (!hasConclusion && wordCount > 500) {
      warnings.push({
        type: "no_conclusion",
        severity: "warning",
        message: "No conclusion section found - consider adding a summary",
      });
    }

    return {
      valid: issues.filter(i => i.severity === "error").length === 0,
      issues: issues.filter(i => i.severity === "error"),
      warnings: [...issues.filter(i => i.severity === "warning"), ...warnings],
      stats: {
        wordCount,
        linkCount,
        imageCount,
        headingCount,
      },
    };
  },
});
